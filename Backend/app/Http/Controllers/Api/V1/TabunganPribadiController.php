<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\UserTabunganTarget;
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

    /**
     * Resolve the pribadi-family jenis target for setor/tarik/progress.
     * Accepts an explicit jenis_tabungan_id (sub: mandiri/hari_raya/berjangka)
     * and falls back to the first active pribadi (mandiri).
     */
    private function resolveJenis(Request $request): ?JenisTabungan
    {
        $jenisTabungan = null;

        if ($request->filled('jenis_tabungan_id')) {
            $jenisTabungan = JenisTabungan::aktif()->find($request->jenis_tabungan_id);

            if (! $jenisTabungan || $jenisTabungan->tipe !== TipeTabungan::Pribadi) {
                return null;
            }
        }

        if (! $jenisTabungan) {
            $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Pribadi)->aktif()->first();
        }

        return $jenisTabungan;
    }

    public function setor(Request $request): JsonResponse
    {
        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'metode_pembayaran' => 'required|string|in:transfer',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
            'jenis_tabungan_id' => 'nullable|exists:jenis_tabungan,id',
            'tabungan_berjangka_id' => 'nullable|exists:tabungan_berjangka,id',
        ]);

        $jenisTabungan = $this->resolveJenis($request);

        if (! $jenisTabungan) {
            return $this->errorResponse('Jenis tabungan pribadi tidak valid atau belum tersedia.', 404, 'NOT_FOUND');
        }

        // Bila setoran diatribusikan ke akun berjangka, akun itu harus milik user,
        // sejenis, dan aktif — mencegah tabungan berjangka milik user lain ikut terhitung.
        if ($request->filled('tabungan_berjangka_id')) {
            $tb = \App\Models\TabunganBerjangka::where('id', $request->tabungan_berjangka_id)
                ->where('user_id', $request->user()->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->where('status', 'aktif')
                ->exists();

            if (! $tb) {
                return $this->errorResponse('Tabungan berjangka tidak valid untuk setoran ini.', 422, 'BERJANGKA_TIDAK_VALID');
            }
        }

        if ($jenisTabungan->sub_jenis === SubJenisTabungan::Berjangka
            && $jenisTabungan->deadline
            && $jenisTabungan->deadline->lt(now()->startOfDay())) {
            return $this->errorResponse(
                'Periode setoran tabungan berjangka sudah berakhir (' . $jenisTabungan->deadline->format('d/m/Y') . ').',
                423,
                'DEADLINE_PASSED'
            );
        }

        if ($jenisTabungan->sub_jenis === SubJenisTabungan::HariRaya
            && $jenisTabungan->deadline
            && now()->startOfDay()->gte($jenisTabungan->deadline->copy()->subDays(7))) {
            return $this->errorResponse(
                'Masa setoran tabungan hari raya ditutup — dana siap dicairkan mulai 1 minggu sebelum hari raya.',
                423,
                'LUNA_TUTUP'
            );
        }

        if ($jenisTabungan->sub_jenis === SubJenisTabungan::HariRaya
            && ! UserTabunganTarget::where('user_id', $request->user()->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->exists()) {
            return $this->errorResponse(
                'Atur target tabungan hari raya terlebih dahulu sebelum menyetor.',
                422,
                'TARGET_NOT_SET'
            );
        }

        if ($this->transaksiService->isDuplicate($request->user()->id, $jenisTabungan->id, JenisTransaksi::Setor->value, $request->nominal)) {
            return $this->errorResponse('Transaksi duplikat terdeteksi.', 409, 'DUPLICATE');
        }

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'tabungan_berjangka_id' => $request->tabungan_berjangka_id,
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
            'jenis_tabungan_id' => 'nullable|exists:jenis_tabungan,id',
        ]);

        $jenisTabungan = $this->resolveJenis($request);

        if (! $jenisTabungan || ! $jenisTabungan->allow_withdrawal) {
            return $this->errorResponse('Penarikan tidak diizinkan untuk jenis tabungan ini.', 403, 'WITHDRAWAL_NOT_ALLOWED');
        }

        if ($jenisTabungan->sub_jenis === SubJenisTabungan::Berjangka) {
            return $this->errorResponse('Tabungan berjangka hanya dapat dicairkan setelah target tercapai dan tanggal jatuh tempo tiba melalui menu Tabungan Berjangka.', 422, 'BERJANGKA_WITHDRAWAL_RESTRICTED');
        }

        // Saldo guard: pastikan saldo tabungan mandiri mencukupi dan terpisah dari dana berjangka
        $totalSetor = Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->whereNull('tabungan_berjangka_id')
            ->terverifikasi()
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        $totalTarik = Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->whereNull('tabungan_berjangka_id')
            ->terverifikasi()
            ->where('jenis_transaksi', 'tarik')
            ->sum('nominal');

        $pendingTarik = Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->whereNull('tabungan_berjangka_id')
            ->menungguVerifikasi()
            ->where('jenis_transaksi', 'tarik')
            ->sum('nominal');

        $saldoTersedia = (float) $totalSetor - (float) $totalTarik - (float) $pendingTarik;

        if ((float) $request->nominal > $saldoTersedia) {
            return $this->errorResponse('Saldo ' . $jenisTabungan->nama . ' tidak mencukupi (Tersedia: Rp ' . number_format(max(0, $saldoTersedia), 0, ',', '.') . ').', 422, 'INSUFFICIENT_BALANCE');
        }

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
        $jenisTabungan = $this->resolveJenis($request);

        if (! $jenisTabungan) {
            return $this->errorResponse('Jenis tabungan pribadi tidak valid atau belum tersedia.', 404, 'NOT_FOUND');
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);

        return $this->successResponse($progress);
    }
}
