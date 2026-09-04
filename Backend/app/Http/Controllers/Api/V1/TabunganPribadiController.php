<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\JenisTabungan;
use App\Services\ProgressCalculatorService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TabunganPribadiController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransaksiService $transaksiService,
        private ProgressCalculatorService $progressService,
    ) {}

    public function setor(Request $request): JsonResponse
    {
        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'metode_pembayaran' => 'required|string|in:transfer',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Pribadi)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan pribadi belum tersedia.', 404, 'NOT_FOUND');
        }

        if ($this->transaksiService->isDuplicate($request->user()->id, $jenisTabungan->id, JenisTransaksi::Setor->value, $request->nominal)) {
            return $this->errorResponse('Transaksi duplikat terdeteksi.', 409, 'DUPLICATE');
        }

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'metode_pembayaran' => $request->metode_pembayaran,
                'rekening_bank_id' => $request->rekening_bank_id,
                'catatan_user' => $request->catatan_user,
            ]);

            if ($request->hasFile('bukti_transfer')) {
                $this->transaksiService->uploadBuktiTransfer($transaksi, $request->file('bukti_transfer'));
            }

            return $transaksi;
        });

        return $this->createdResponse(new TransaksiResource($transaksi->load('jenisTabungan')), 'Setoran berhasil dicatat.');
    }

    public function tarik(Request $request): JsonResponse
    {
        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Pribadi)->aktif()->first();

        if (! $jenisTabungan || ! $jenisTabungan->allow_withdrawal) {
            return $this->errorResponse('Penarikan tidak diizinkan untuk jenis tabungan ini.', 403, 'WITHDRAWAL_NOT_ALLOWED');
        }

        // Balance is validated at admin verification time (see
        // Admin\TransaksiController::verifikasi) so no overdraft is ever confirmed.

        $transaksi = $this->transaksiService->buatTransaksi([
            'user_id' => $request->user()->id,
            'jenis_tabungan_id' => $jenisTabungan->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $request->nominal,
            'metode_pembayaran' => 'transfer',
            'catatan_user' => $request->catatan_user,
        ]);

        return $this->createdResponse(new TransaksiResource($transaksi->load('jenisTabungan')), 'Penarikan berhasil dicatat. Menunggu verifikasi admin.');
    }

    public function progress(Request $request): JsonResponse
    {
        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Pribadi)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan pribadi belum tersedia.', 404, 'NOT_FOUND');
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);

        return $this->successResponse($progress);
    }
}
