<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Exports\UsersExport;
use App\Exports\UsersTemplate;
use App\Http\Controllers\Controller;
use App\Http\Resources\KonfigurasiSetoranEmasResource;
use App\Http\Resources\TransaksiResource;
use App\Http\Resources\UserResource;
use App\Imports\UsersImport;
use App\Models\AuditLog;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\PendaftaranQurban;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\ProgressCalculatorService;
use App\Services\SaldoEmasService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UserController extends Controller
{
    use ApiResponse;

    public function __construct(private NotifikasiService $notif) {}

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
            $search = str_replace(['%', '_'], ['\%', '\_'], $request->search);
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
     * GET /admin/users/{user}/produk
     * Semua produk yang digunakan nasabah: tabungan (emas/pribadi) dengan progress,
     * pendaftaran qurban, dan riwayat transaksi.
     */
    public function produk(
        User $user,
        ProgressCalculatorService $progressService,
        SaldoEmasService $saldoEmasService
    ): JsonResponse {
        $user->load('approvedBy');

        $tabungan = [];
        $totalSaldo = 0;

        foreach (JenisTabungan::aktif()->orderBy('nama')->get() as $jenis) {
            $progress = $progressService->getProgress($user, $jenis);
            $konfigurasiList = $jenis->tipe === TipeTabungan::Emas
                ? $saldoEmasService->getAktifList($user, $jenis)
                : collect();

            $include = $progress['saldo'] > 0
                || $progress['pending_amount'] > 0
                || $konfigurasiList->isNotEmpty();

            if (! $include) {
                continue;
            }

            $totalSaldo += $progress['saldo'];

            $tabungan[] = [
                'progress' => $progress,
                'konfigurasi' => $konfigurasiList
                    ->map(fn (KonfigurasiSetoranEmas $k) => (new KonfigurasiSetoranEmasResource($k))->resolve())
                    ->values(),
                'setoran_berkala' => $konfigurasiList
                    ->map(fn (KonfigurasiSetoranEmas $k) => $saldoEmasService->getProgress($user, $k))
                    ->values(),
            ];
        }

        $qurban = PendaftaranQurban::with(['hewanQurban', 'periodeQurban'])
            ->where('user_id', $user->id)
            ->latest('id')
            ->get()
            ->map(fn (PendaftaranQurban $p) => [
                'id' => $p->id,
                'hewan' => $p->hewanQurban?->jenis_hewan,
                'tahun' => $p->periodeQurban?->tahun,
                'jumlah_hewan' => $p->jumlah_hewan,
                'target_dana' => (float) $p->target_dana,
                'total_terkumpul' => (float) $p->total_terkumpul,
                'persentase' => $p->hitungPersentase(),
                'status' => $p->status?->value,
                'status_label' => $p->status?->label(),
                'tanggal_daftar' => $p->tanggal_daftar?->toDateString(),
            ])
            ->values();

        $transaksi = Transaksi::with(['jenisTabungan', 'rekeningBank'])
            ->where('user_id', $user->id)
            ->latest()
            ->limit(100)
            ->get();

        return $this->successResponse([
            'user' => new UserResource($user),
            'produk' => [
                'tabungan' => $tabungan,
                'qurban' => $qurban,
            ],
            'summary' => [
                'total_tabungan_aktif' => count($tabungan),
                'total_saldo_tabungan' => round($totalSaldo, 2),
                'transaksi_pending' => Transaksi::milikUser($user->id)->menungguVerifikasi()->count(),
            ],
            'transaksi' => TransaksiResource::collection($transaksi),
        ]);
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
            'status' => 'sometimes|string|in:active,suspended,rejected',
            'address' => 'nullable|string|max:500',
            'created_at' => 'sometimes|date',
        ]);

        $roleValue = $request->input('role', 'user');
        $statusValue = $request->input('status', 'active');

        $user = new User([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'nomor_anggota' => $request->nomor_anggota,
            'password' => $request->password,
            'address' => $request->address,
        ]);

        $user->role = $roleValue;
        $user->status = $statusValue;
        $user->approved_by = auth()->id();
        $user->approved_at = $statusValue === 'active' ? now() : null;

        if ($request->filled('created_at')) {
            $user->created_at = $request->input('created_at');
        }

        $user->save();

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
            'password' => 'sometimes|nullable|string|min:8',
            'password_confirmation' => 'sometimes|string',
        ]);

        $fillableFields = ['name', 'email', 'phone', 'nomor_anggota', 'address', 'created_at'];
        $allFields = ['name', 'email', 'phone', 'nomor_anggota', 'address', 'role', 'created_at'];
        $oldValues = $user->only($allFields);

        $user->fill($request->only($fillableFields));

        if ($request->filled('role')) {
            $user->role = $request->input('role');
        }

        // Update password hanya jika admin mengirimkan field password
        if ($request->filled('password')) {
            if ($request->input('password') !== $request->input('password_confirmation')) {
                return $this->errorResponse('Konfirmasi password tidak cocok.', 422);
            }
            $user->password = $request->input('password'); // akan di-hash via Cast
        }

        $user->save();
        AuditLog::record('update', $user, $oldValues, $user->fresh()->only($allFields));

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
     * POST /admin/users/{user}/suspend
     */
    public function suspend(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Active) {
            return $this->errorResponse('Hanya akun aktif yang bisa dibekukan.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->status = UserStatus::Suspended;
        $user->save();

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::record('suspend', $user, $oldValues, ['status' => 'suspended']);

        $this->notif->kirim(
            $user,
            'Akun Dibekukan',
            'Akun Anda dibekukan oleh admin. Anda tidak dapat login sampai akun diaktifkan kembali. Hubungi admin untuk informasi lebih lanjut.',
            TipeNotifikasi::ApprovalAkun,
            ['status' => 'suspended']
        );

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
        $user->status = UserStatus::Active;
        $user->approved_by = auth()->id();
        $user->approved_at = now();
        $user->save();

        AuditLog::record('activate', $user, $oldValues, ['status' => 'active']);

        $this->notif->kirim(
            $user,
            'Akun Diaktifkan Kembali',
            'Akun Anda telah diaktifkan kembali oleh admin. Anda sudah bisa login dan bertransaksi seperti biasa.',
            TipeNotifikasi::ApprovalAkun,
            ['status' => 'active']
        );

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
                $import->prosesTabungan();
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Import user gagal: ' . $e->getMessage(), ['exception' => $e]);
            return $this->errorResponse('Import gagal. Tidak ada data yang diubah.', 500);
        }

        $tabungan = [
            'target_diatur'      => $import->getTargetCount(),
            'saldo_awal_dicatat' => $import->getSaldoAwalCreatedCount(),
            'saldo_awal_diubah'  => $import->getSaldoAwalChangedCount(),
            'saldo_awal_dihapus' => $import->getSaldoAwalRemovedCount(),
        ];

        AuditLog::record('import', $request->user(), [], [
            'jumlah_ditambahkan' => $import->getCreatedCount(),
            'jumlah_diupdate'    => $import->getUpdatedCount(),
            'jumlah_dilewati'    => $import->getSkippedCount(),
            'tabungan'           => $tabungan,
        ]);

        return $this->successResponse([
            'jumlah_ditambahkan' => $import->getCreatedCount(),
            'jumlah_diupdate'    => $import->getUpdatedCount(),
            'jumlah_dilewati'    => $import->getSkippedCount(),
            'detail_dilewati'    => $import->getSkippedDetail(),
            'tabungan'           => $tabungan,
        ], "Import selesai. {$import->getCreatedCount()} ditambahkan, {$import->getUpdatedCount()} diupdate, {$import->getSkippedCount()} dilewati.");
    }
}
