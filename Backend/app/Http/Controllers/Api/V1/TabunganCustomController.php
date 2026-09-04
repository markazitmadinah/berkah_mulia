<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\JenisTabungan;
use App\Models\UserAutoSetor;
use App\Models\UserTabunganTarget;
use App\Services\ProgressCalculatorService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Setor/tarik/progress untuk jenis tabungan tipe `custom`.
 * Konfigurasi (min/maks/kelipatan/pencairan) dibaca dari kolom `config` JSON
 * yang diisi admin lewat wizard "Tambah Produk Tabungan".
 */
class TabunganCustomController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransaksiService $transaksiService,
        private ProgressCalculatorService $progressService,
    ) {}

    public function setor(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $jenisTabungan->status_aktif || $jenisTabungan->tipe->value !== 'custom') {
            return $this->errorResponse('Jenis tabungan tidak tersedia.', 404, 'NOT_FOUND');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:1',
            'metode_pembayaran' => 'required|string|in:transfer',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $cfg = $jenisTabungan->config ?? [];
        $nominal = (float) $request->nominal;
        $min = isset($cfg['min_nominal']) ? (float) $cfg['min_nominal'] : 1;
        $max = isset($cfg['max_nominal']) && $cfg['max_nominal'] ? (float) $cfg['max_nominal'] : null;
        $kelipatan = isset($cfg['kelipatan']) && $cfg['kelipatan'] ? (float) $cfg['kelipatan'] : null;

        // Mode nominal_tetap: nominal dipaksa sama dengan nilai setoran berkala
        if ($jenisTabungan->mode_perhitungan->value === 'nominal_tetap') {
            $tetap = isset($cfg['setoran_berkala_nominal']) ? (float) $cfg['setoran_berkala_nominal'] : 0;
            if ($tetap > 0 && $nominal !== $tetap) {
                return $this->errorResponse(
                    "Produk ini hanya menerima setoran tetap Rp ".number_format($tetap, 0, ',', '.').'.',
                    422,
                    'FIXED_NOMINAL_MISMATCH'
                );
            }
        }

        if ($nominal < $min) {
            return $this->errorResponse("Nominal setor minimal Rp ".number_format($min, 0, ',', '.').'.', 422, 'BELOW_MINIMUM');
        }
        if ($max && $nominal > $max) {
            return $this->errorResponse("Nominal setor maksimal Rp ".number_format($max, 0, ',', '.').'.', 422, 'ABOVE_MAXIMUM');
        }
        if ($kelipatan && fmod($nominal, $kelipatan) !== 0.0) {
            return $this->errorResponse("Nominal setor harus kelipatan Rp ".number_format($kelipatan, 0, ',', '.').'.', 422, 'NOT_MULTIPLE');
        }

        // Block setor if user has already reached their goal, unless overpayment
        // mode allows surplus to stay as balance.
        $saldo = $this->progressService->getSaldo($request->user(), $jenisTabungan);
        $target = (float) ($jenisTabungan->target_nominal ?? 0);
        if (!empty($cfg['goal_boleh_ubah'])) {
            $ug = UserTabunganTarget::where('user_id', $request->user()->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)->first();
            $target = $ug ? (float) $ug->target_nominal : 0;
        }
        $overpayment = $cfg['overpayment'] ?? 'tolak';
        if ($target > 0 && $saldo >= $target && $overpayment !== 'saldo') {
            return $this->errorResponse('Target tabungan sudah tercapai. Silakan hubungi admin untuk pencairan dana.', 422, 'GOAL_REACHED');
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

    public function tarik(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $jenisTabungan->status_aktif || $jenisTabungan->tipe->value !== 'custom') {
            return $this->errorResponse('Jenis tabungan tidak tersedia.', 404, 'NOT_FOUND');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:1',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        if (! $jenisTabungan->allow_withdrawal) {
            return $this->errorResponse('Penarikan tidak diizinkan untuk jenis tabungan ini.', 403, 'WITHDRAWAL_NOT_ALLOWED');
        }

        $cfg = $jenisTabungan->config ?? [];
        $nominal = (float) $request->nominal;
        $saldo = $this->progressService->getSaldo($request->user(), $jenisTabungan);

        // Min saldo: saldo setelah penarikan tidak boleh di bawah ambang.
        $minSaldo = isset($cfg['min_saldo']) ? (float) $cfg['min_saldo'] : 0;
        if ($minSaldo > 0 && ($saldo - $nominal) < $minSaldo) {
            return $this->errorResponse(
                "Penarikan ditolak. Saldo setelah tarik minimal Rp ".number_format($minSaldo, 0, ',', '.').'.',
                422,
                'BELOW_MIN_SALDO'
            );
        }

        // Goal wajib tercapai: bila target wajib dan belum tercapai, tarikan diblok.
        $target = (float) ($jenisTabungan->target_nominal ?? 0);
        if (!empty($cfg['goal_boleh_ubah'])) {
            $ug = UserTabunganTarget::where('user_id', $request->user()->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)->first();
            $target = $ug ? (float) $ug->target_nominal : 0;
        }
        if (!empty($cfg['goal_wajib']) && $target > 0 && $saldo < $target) {
            return $this->errorResponse('Target tabungan wajib tercapai sebelum bisa ditarik.', 422, 'GOAL_NOT_REACHED');
        }

        // Potongan / biaya admin saat pencairan. Nominal = jumlah bruto yang diambil
        // dari saldo; nasabah menerima netto (bruto - biaya). Biaya dicatat di
        // biaya_penalti agar transparan dan tidak mengubah rumus saldo.
        $biaya = 0.0;
        if (!empty($cfg['potongan']) && isset($cfg['potongan_nilai'])) {
            $potongan = (float) $cfg['potongan_nilai'];
            $biaya = $cfg['potongan_tipe'] === 'persen'
                ? round($nominal * $potongan / 100, 2)
                : $potongan;
        }
        if (isset($cfg['biaya_admin']) && (float) $cfg['biaya_admin'] > 0) {
            $biaya += (float) $cfg['biaya_admin'];
        }
        if ($biaya >= $nominal) {
            return $this->errorResponse('Biaya pencairan melebihi nominal penarikan.', 422, 'FEE_EXCEEDS_WITHDRAWAL');
        }
        $netto = $nominal - $biaya;

        $catatan = (string) $request->catatan_user;
        $catatan .= ($catatan ? "\n" : '')
            . "Diterima ke nasabah: Rp ".number_format($netto, 0, ',', '.')
            . " (potongan/biaya Rp ".number_format($biaya, 0, ',', '.').')';

        $transaksi = $this->transaksiService->buatTransaksi([
            'user_id' => $request->user()->id,
            'jenis_tabungan_id' => $jenisTabungan->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $nominal,
            'biaya_penalti' => $biaya,
            'metode_pembayaran' => 'transfer',
            'catatan_user' => $catatan,
        ]);

        return $this->createdResponse(new TransaksiResource($transaksi->load('jenisTabungan')), 'Penarikan berhasil dicatat. Menunggu verifikasi admin.');
    }

    public function progress(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $jenisTabungan->status_aktif || $jenisTabungan->tipe->value !== 'custom') {
            return $this->errorResponse('Jenis tabungan tidak tersedia.', 404, 'NOT_FOUND');
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);

        return $this->successResponse($progress);
    }

    /**
     * GET/PATCH /tabungan-custom/{jenisTabungan}/target
     * User-set target for products with config.goal_boleh_ubah = true.
     */
    public function target(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $jenisTabungan->status_aktif || $jenisTabungan->tipe->value !== 'custom') {
            return $this->errorResponse('Jenis tabungan tidak tersedia.', 404, 'NOT_FOUND');
        }

        $cfg = $jenisTabungan->config ?? [];
        if (empty($cfg['goal_boleh_ubah'])) {
            return $this->errorResponse('Produk ini tidak mengizinkan pengaturan target personal.', 403, 'TARGET_NOT_ALLOWED');
        }

        $user = $request->user();

        if ($request->isMethod('GET')) {
            $target = UserTabunganTarget::where('user_id', $user->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->first();

            return $this->successResponse([
                'target_nominal' => $target?->target_nominal,
                'admin_target_nominal' => $jenisTabungan->target_nominal,
            ]);
        }

        $request->validate([
            'target_nominal' => 'required|numeric|min:10000',
        ]);

        $record = UserTabunganTarget::updateOrCreate(
            ['user_id' => $user->id, 'jenis_tabungan_id' => $jenisTabungan->id],
            ['target_nominal' => $request->target_nominal],
        );

        return $this->successResponse([
            'target_nominal' => $record->target_nominal,
        ], 'Target berhasil disimpan.');
    }

    /**
     * GET/PUT /tabungan-custom/{jenisTabungan}/auto-setor
     * User opt-in/out of periodic (berkala) auto deposit for this product.
     */
    public function autoSetor(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $jenisTabungan->status_aktif || $jenisTabungan->tipe->value !== 'custom') {
            return $this->errorResponse('Jenis tabungan tidak tersedia.', 404, 'NOT_FOUND');
        }

        $cfg = $jenisTabungan->config ?? [];
        if (empty($cfg['setoran_berkala']) || empty($cfg['setoran_berkala_periode'])) {
            return $this->errorResponse('Produk ini tidak memiliki setoran berkala.', 403, 'AUTO_SETOR_NOT_ALLOWED');
        }

        $user = $request->user();

        if ($request->isMethod('GET')) {
            $record = UserAutoSetor::where('user_id', $user->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->first();

            return $this->successResponse([
                'aktif' => (bool) ($record?->aktif),
                'nominal' => (float) ($cfg['setoran_berkala_nominal'] ?? 0),
                'periode' => $cfg['setoran_berkala_periode'],
            ]);
        }

        $request->validate([
            'aktif' => 'required|boolean',
        ]);

        $record = UserAutoSetor::updateOrCreate(
            ['user_id' => $user->id, 'jenis_tabungan_id' => $jenisTabungan->id],
            ['aktif' => (bool) $request->aktif],
        );

        return $this->successResponse([
            'aktif' => (bool) $record->aktif,
        ], $record->aktif ? 'Setoran berkala otomatis diaktifkan.' : 'Setoran berkala otomatis dinonaktifkan.');
    }

    /**
     * GET /admin/tabungan-custom/goal-tracker
     * Admin view: per custom product, users who have reached their goal.
     */
    public function goalTracker(): JsonResponse
    {
        $customIds = JenisTabungan::where('tipe', 'custom')->where('status_aktif', true)->pluck('id');
        if ($customIds->isEmpty()) {
            return $this->successResponse([]);
        }

        // Bulk saldo: SUM verified setor − SUM verified tarik per (user, jenis)
        $setor = DB::table('transaksi')
            ->whereIn('jenis_tabungan_id', $customIds)
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'setor')
            ->select('user_id', 'jenis_tabungan_id', DB::raw('SUM(nominal) as total_setor'))
            ->groupBy('user_id', 'jenis_tabungan_id')
            ->get();

        $tarik = DB::table('transaksi')
            ->whereIn('jenis_tabungan_id', $customIds)
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'tarik')
            ->select('user_id', 'jenis_tabungan_id', DB::raw('SUM(nominal) as total_tarik'))
            ->groupBy('user_id', 'jenis_tabungan_id')
            ->get();

        $saldoMap = [];
        foreach ($setor as $row) {
            $key = "{$row->user_id}_{$row->jenis_tabungan_id}";
            $saldoMap[$key] = (float) $row->total_setor;
        }
        foreach ($tarik as $row) {
            $key = "{$row->user_id}_{$row->jenis_tabungan_id}";
            $saldoMap[$key] = ($saldoMap[$key] ?? 0) - (float) $row->total_tarik;
        }

        // Load user goals (for goal_boleh_ubah products)
        $userGoals = DB::table('user_tabungan_target')
            ->whereIn('jenis_tabungan_id', $customIds)
            ->select('user_id', 'jenis_tabungan_id', 'target_nominal')
            ->get()
            ->keyBy(fn ($r) => "{$r->user_id}_{$r->jenis_tabungan_id}");

        // Load user names
        $userIds = collect($saldoMap)->keys()->map(fn ($k) => explode('_', $k)[0])->unique()->values();
        $users = $userIds->isEmpty() ? collect() : \App\Models\User::whereIn('id', $userIds)->get()->keyBy('id');

        // Build result per product
        $products = JenisTabungan::whereIn('id', $customIds)->get();
        $result = [];

        foreach ($products as $jenis) {
            $cfg = $jenis->config ?? [];
            $adminTarget = (float) ($jenis->target_nominal ?? 0);
            $goalBolehUbah = !empty($cfg['goal_boleh_ubah']);

            $achieved = [];
            foreach ($saldoMap as $key => $saldo) {
                [$uid, $jid] = explode('_', $key);
                if ((int) $jid !== $jenis->id) continue;
                if ($saldo <= 0) continue;

                // Determine effective target
                $target = $adminTarget;
                if ($goalBolehUbah) {
                    $ug = $userGoals->get($key);
                    $target = $ug ? (float) $ug->target_nominal : 0;
                }

                if ($target <= 0 || $saldo < $target) continue;

                $user = $users->get((int) $uid);
                $achieved[] = [
                    'user_id' => (int) $uid,
                    'user_name' => $user?->name ?? '-',
                    'user_email' => $user?->email ?? '-',
                    'saldo' => $saldo,
                    'target' => $target,
                    'persentase' => round(($saldo / $target) * 100, 1),
                ];
            }

            usort($achieved, fn ($a, $b) => $b['persentase'] <=> $a['persentase']);

            $result[] = [
                'jenis_tabungan_id' => $jenis->id,
                'nama' => $jenis->nama,
                'kode' => $jenis->kode,
                'target_default' => $adminTarget,
                'goal_boleh_ubah' => $goalBolehUbah,
                'users_achieved' => $achieved,
                'count' => count($achieved),
            ];
        }

        return $this->successResponse($result);
    }
}
