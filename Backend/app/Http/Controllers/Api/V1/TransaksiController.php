<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\Transaksi;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class TransaksiController extends Controller
{
    use ApiResponse;

    public function __construct(private TransaksiService $transaksiService) {}

    /**
     * GET /transaksi-saya
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:menunggu_verifikasi,terverifikasi,ditolak',
            'jenis_tabungan_id' => 'nullable|integer|exists:jenis_tabungan,id',
        ]);

        $query = Transaksi::milikUser($request->user()->id)
            ->with(['jenisTabungan', 'rekeningBank', 'gadai']);

        if ($request->filled('status')) {
            $query->where('status_verifikasi', $request->status);
        }

        if ($request->filled('jenis_tabungan_id')) {
            $query->where('jenis_tabungan_id', $request->jenis_tabungan_id);
        }

        $perPage = min($request->input('per_page', 15), 100);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil riwayat transaksi.',
            'data' => TransaksiResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * GET /transaksi-saya/{transaksi}
     */
    public function show(Request $request, Transaksi $transaksi): JsonResponse
    {
        // Policy check: user can only view own transactions
        if ($transaksi->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke transaksi ini.', 403, 'FORBIDDEN');
        }

        $transaksi->load(['jenisTabungan', 'rekeningBank', 'pendaftaranQurban', 'gadai']);

        return $this->successResponse(new TransaksiResource($transaksi));
    }

    /**
     * POST /transaksi/{transaksi}/upload-bukti
     */
    public function uploadBukti(Request $request, Transaksi $transaksi): JsonResponse
    {
        // Ownership check
        if ($transaksi->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke transaksi ini.', 403, 'FORBIDDEN');
        }

        if (! $transaksi->isMenungguVerifikasi()) {
            return $this->errorResponse('Bukti transfer hanya bisa diupload untuk transaksi yang belum diverifikasi.', 409, 'CONFLICT');
        }

        $request->validate([
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
        ]);

        $this->transaksiService->uploadBuktiTransfer($transaksi, $request->file('bukti_transfer'));

        return $this->successResponse(new TransaksiResource($transaksi->fresh()), 'Bukti transfer berhasil diupload.');
    }

    /**
     * GET /transaksi/{transaksi}/bukti  (bukti-transfer.show)
     *
     * Stream the stored proof-of-transfer. Accessible by the transaction owner or an admin.
     */
    public function showBukti(Request $request, Transaksi $transaksi): StreamedResponse
    {
        $user = $request->user();

        if ($transaksi->user_id !== $user->id && $user->role !== UserRole::Admin) {
            return $this->errorResponse('Anda tidak memiliki akses ke bukti transfer ini.', 403, 'FORBIDDEN');
        }

        $disk = Storage::disk('bukti_transfer');

        if (! $transaksi->bukti_transfer_path || ! $disk->exists($transaksi->bukti_transfer_path)) {
            throw new NotFoundHttpException('Bukti transfer tidak ditemukan.');
        }

        return $disk->response($transaksi->bukti_transfer_path);
    }
}
