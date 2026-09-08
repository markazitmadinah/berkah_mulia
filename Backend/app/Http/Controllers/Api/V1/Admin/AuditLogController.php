<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    use ApiResponse;

    /**
     * GET /admin/audit-logs
     * Read-only, no update/delete endpoints per BAGIAN I poin 11.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user');

        if ($request->filled('model_type')) {
            $query->where('model_type', 'like', '%' . $request->model_type . '%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('dari')) {
            $query->where('created_at', '>=', $request->dari);
        }

        if ($request->filled('sampai')) {
            $query->where('created_at', '<=', $request->sampai . ' 23:59:59');
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        $perPage = min($request->input('per_page', 15), 100);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil audit log.',
            'data' => AuditLogResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * DELETE /admin/audit-logs
     * Hapus seluruh riwayat audit agar data tidak menumpuk & membebani sistem.
     * Satu jejak "purge" tetap ditulis setelah penghapusan sebagai bukti tindakan.
     */
    public function destroy(Request $request): JsonResponse
    {
        $deleted = AuditLog::query()->delete();

        AuditLog::record('purge', $request->user(), null, ['riwayat_dihapus' => $deleted]);

        return $this->successResponse(
            ['deleted' => $deleted],
            $deleted > 0
                ? "{$deleted} catatan audit berhasil dihapus."
                : 'Tidak ada catatan audit yang perlu dihapus.'
        );
    }
}