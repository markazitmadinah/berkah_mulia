<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\HargaEmasHarianResource;
use App\Models\AuditLog;
use App\Models\HargaEmasHarian;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class HargaEmasController extends Controller
{
    use ApiResponse;

    public function hargaTerkini(): JsonResponse
    {
        $harga = HargaEmasHarian::hargaTerkini();

        if (! $harga) {
            return $this->errorResponse('Harga emas belum tersedia.', 404, 'NOT_FOUND');
        }

        return $this->successResponse(new HargaEmasHarianResource($harga));
    }

    public function hargaRiwayat(Request $request): JsonResponse
    {
        $request->validate([
            'dari' => 'nullable|date',
            'sampai' => 'nullable|date',
        ]);

        $query = HargaEmasHarian::query();

        if ($request->filled('dari')) {
            $query->where('tanggal', '>=', $request->dari);
        }
        if ($request->filled('sampai')) {
            $query->where('tanggal', '<=', $request->sampai);
        }

        $perPage = min($request->input('per_page', 15), 500);
        $items = $query->orderByDesc('tanggal')->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil riwayat harga emas.',
            'data' => HargaEmasHarianResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * POST /admin/emas/harga/sync
     * Pull today's gold price automatically from Logam Mulia's official site.
     */
    public function syncDariLogamMulia(): JsonResponse
    {
        $code = Artisan::call('hargaemas:sync');
        $output = trim(Artisan::output());

        return $code === 0
            ? $this->successResponse(null, $output ?: 'Harga emas berhasil disinkronkan dari Logam Mulia.')
            : $this->errorResponse($output ?: 'Gagal sinkronisasi harga emas dari Logam Mulia.', 502, 'SYNC_FAILED');
    }

    /**
     * POST /admin/emas/harga
     * Insert new price (append-only per F.3).
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'tanggal' => 'required|date',
            'harga_per_gram' => 'required|numeric|min:1',
            'harga_beli' => 'nullable|numeric|min:1',
            'tagihan_harian_default' => 'nullable|numeric|min:0',
            'catatan' => 'nullable|string|max:500',
        ]);

        $harga = DB::transaction(function () use ($request) {
            // Deactivate old price for the same date
            HargaEmasHarian::whereDate('tanggal', $request->tanggal)
                ->where('status_aktif', true)
                ->update(['status_aktif' => false]);

            return HargaEmasHarian::create([
                'tanggal' => $request->tanggal,
                'harga_per_gram' => $request->harga_per_gram,
                'harga_beli' => $request->harga_beli,
                'tagihan_harian_default' => $request->tagihan_harian_default,
                'status_aktif' => true,
                'catatan' => $request->catatan,
                'created_by' => auth()->id(),
            ]);
        });

        AuditLog::record('create', $harga);

        return $this->createdResponse(new HargaEmasHarianResource($harga), 'Harga emas berhasil diinput.');
    }

    /**
     * PUT /admin/emas/harga/{hargaEmas}
     * "Update" = insert new version, deactivate old (append-only per F.3).
     */
    public function update(Request $request, HargaEmasHarian $hargaEmas): JsonResponse
    {
        $request->validate([
            'harga_per_gram' => 'required|numeric|min:1',
            'harga_beli' => 'nullable|numeric|min:1',
            'tagihan_harian_default' => 'nullable|numeric|min:0',
            'catatan' => 'nullable|string|max:500',
        ]);

        $newHarga = DB::transaction(function () use ($request, $hargaEmas) {
            // Deactivate old version
            $hargaEmas->update(['status_aktif' => false]);

            return HargaEmasHarian::create([
                'tanggal' => $hargaEmas->tanggal,
                'harga_per_gram' => $request->harga_per_gram,
                'harga_beli' => $request->harga_beli,
                'tagihan_harian_default' => $request->tagihan_harian_default,
                'status_aktif' => true,
                'catatan' => $request->catatan ?? $hargaEmas->catatan,
                'created_by' => auth()->id(),
            ]);
        });

        AuditLog::record('update_version', $newHarga, $hargaEmas->toArray(), $newHarga->toArray());

        return $this->successResponse(new HargaEmasHarianResource($newHarga), 'Harga emas berhasil diperbarui (versi baru dibuat).');
    }

    /**
     * DELETE /admin/emas/harga/{hargaEmas}
     * Only allow if no transactions reference this price.
     */
    public function destroy(HargaEmasHarian $hargaEmas): JsonResponse
    {
        if ($hargaEmas->transaksi()->exists()) {
            return $this->errorResponse('Tidak bisa menghapus harga yang sudah digunakan dalam transaksi.', 409, 'CONFLICT');
        }

        AuditLog::record('delete', $hargaEmas);
        $hargaEmas->update(['status_aktif' => false]);

        return $this->deletedResponse('Harga emas berhasil dihapus.');
    }
}
