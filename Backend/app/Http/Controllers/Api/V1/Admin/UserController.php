<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exports\UsersExport;
use App\Exports\UsersTemplate;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Imports\UsersImport;
use App\Models\AuditLog;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UserController extends Controller
{
    use ApiResponse;

    /**
     * GET /admin/users
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $perPage = min($request->input('per_page', 15), 100);
        $users = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data pengguna.',
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    /**
     * GET /admin/users/{user}
     */
    public function show(User $user): JsonResponse
    {
        $user->load('approvedBy');

        return $this->successResponse(new UserResource($user));
    }

    /**
     * POST /admin/users
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|max:20|unique:users,phone',
            'nomor_anggota' => 'required|string|regex:/^\d{16}$/|unique:users,nomor_anggota',
            'password' => 'required|string|min:8',
            'role' => 'sometimes|string|in:admin,user',
            'status' => 'sometimes|string|in:pending,active',
            'address' => 'nullable|string|max:500',
            'created_at' => 'sometimes|date',
        ]);

        $data = [
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'nomor_anggota' => $request->nomor_anggota,
            'password' => $request->password,
            'role' => $request->input('role', 'user'),
            'status' => $request->input('status', 'active'), // Admin-created = active
            'address' => $request->address,
            'approved_by' => auth()->id(),
            'approved_at' => $request->input('status', 'active') === 'active' ? now() : null,
        ];

        if ($request->filled('created_at')) {
            $data['created_at'] = $request->input('created_at');
        }

        $user = User::create($data);

        AuditLog::record('create', $user);

        return $this->createdResponse(new UserResource($user), 'Pengguna berhasil dibuat.');
    }

    /**
     * PUT /admin/users/{user}
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|string|max:20|unique:users,phone,' . $user->id,
            'nomor_anggota' => 'sometimes|string|regex:/^\d{16}$/|unique:users,nomor_anggota,' . $user->id,
            'address' => 'nullable|string|max:500',
            'role' => 'sometimes|string|in:admin,user',
            'created_at' => 'sometimes|date',
        ]);

        $fields = ['name', 'email', 'phone', 'nomor_anggota', 'address', 'role', 'created_at'];
        $oldValues = $user->only($fields);
        $user->update($request->only($fields));
        AuditLog::record('update', $user, $oldValues, $user->fresh()->only($fields));

        return $this->successResponse(new UserResource($user->fresh()), 'Data pengguna berhasil diperbarui.');
    }

    /**
     * DELETE /admin/users/{user}
     */
    public function destroy(User $user): JsonResponse
    {
        AuditLog::record('delete', $user);
        $user->delete(); // soft delete

        return $this->deletedResponse('Pengguna berhasil dihapus.');
    }

    /**
     * POST /admin/users/{user}/approve
     */
    public function approve(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Pending) {
            return $this->errorResponse('Hanya akun berstatus pending yang bisa di-approve.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->update([
            'status' => UserStatus::Active,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        AuditLog::record('approve', $user, $oldValues, ['status' => 'active']);

        // TODO: Dispatch SendUserApprovalNotification job

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil disetujui.');
    }

    /**
     * POST /admin/users/{user}/reject
     */
    public function reject(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'rejected_reason' => 'required|string|max:500',
        ]);

        if ($user->status !== UserStatus::Pending) {
            return $this->errorResponse('Hanya akun berstatus pending yang bisa ditolak.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->update([
            'status' => UserStatus::Rejected,
            'rejected_reason' => $request->rejected_reason,
        ]);

        AuditLog::record('reject', $user, $oldValues, ['status' => 'rejected', 'rejected_reason' => $request->rejected_reason]);

        // TODO: Dispatch SendUserRejectedNotification job

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil ditolak.');
    }

    /**
     * POST /admin/users/{user}/suspend
     */
    public function suspend(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Active) {
            return $this->errorResponse('Hanya akun aktif yang bisa dibekukan.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->update(['status' => UserStatus::Suspended]);

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::record('suspend', $user, $oldValues, ['status' => 'suspended']);

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil dibekukan.');
    }

    /**
     * POST /admin/users/{user}/activate
     */
    public function activate(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Suspended) {
            return $this->errorResponse('Hanya akun yang dibekukan yang bisa diaktifkan kembali.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->update([
            'status' => UserStatus::Active,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        AuditLog::record('activate', $user, $oldValues, ['status' => 'active']);

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil diaktifkan kembali.');
    }

    /**
     * GET /admin/users/export
     */
    public function export(Request $request): BinaryFileResponse
    {
        $filename = 'data_nasabah_berkah_mulia_' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(
            new UsersExport($request->status, $request->role, $request->search),
            $filename
        );
    }

    /**
     * GET /admin/users/import/template
     */
    public function importTemplate(): BinaryFileResponse
    {
        return Excel::download(new UsersTemplate(), 'template_import_nasabah.xlsx');
    }

    /**
     * POST /admin/users/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,csv|max:10240',
        ]);

        $import = new UsersImport();
        try {
            DB::transaction(function () use ($import, $request) {
                Excel::import($import, $request->file('file'));
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Import user gagal: ' . $e->getMessage(), ['exception' => $e]);
            return $this->errorResponse('Import gagal. Tidak ada data yang diubah.', 500);
        }

        AuditLog::record('import', $request->user(), [], [
            'jumlah_ditambahkan' => $import->getCreatedCount(),
            'jumlah_diupdate'    => $import->getUpdatedCount(),
            'jumlah_dilewati'    => $import->getSkippedCount(),
        ]);

        return $this->successResponse([
            'jumlah_ditambahkan' => $import->getCreatedCount(),
            'jumlah_diupdate'    => $import->getUpdatedCount(),
            'jumlah_dilewati'    => $import->getSkippedCount(),
            'detail_dilewati'    => $import->getSkippedDetail(),
        ], "Import selesai. {$import->getCreatedCount()} ditambahkan, {$import->getUpdatedCount()} diupdate, {$import->getSkippedCount()} dilewati.");
    }
}
