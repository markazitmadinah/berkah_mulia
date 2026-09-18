<?php

namespace App\Services;

use App\Enums\StatusVerifikasi;
use App\Enums\TipeTabungan;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use App\Models\UserTabunganTarget;

class ProgressCalculatorService
{
    public function __construct(private SaldoEmasService $saldoEmasService) {}

    /**
     * Target nominal yang tampil = target milik user (user_tabungan_target,
     * mis. dari import nasabah) bila ada; jatuh kembali ke target jenis.
     */
    private function targetUser(User $user, JenisTabungan $jenisTabungan): float
    {
        $target = UserTabunganTarget::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->value('target_nominal');

        return $target !== null ? (float) $target : (float) ($jenisTabungan->target_nominal ?? 0);
    }
    /**
     * Current verified balance for a user's jenis tabungan (verified setor − verified tarik).
     */
    public function getSaldo(User $user, JenisTabungan $jenisTabungan): float
    {
        $totalSetor = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        $totalTarik = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->where('jenis_transaksi', 'tarik')
            ->sum('nominal');

        return max(0, (float) ($totalSetor - $totalTarik));
    }

    /**
     * Get overall dashboard summary for a user.
     */
    public function getDashboardSummary(User $user): array
    {
        $summary = [];

        foreach (JenisTabungan::aktif()->get() as $jenis) {
            $totalTerverifikasi = Transaksi::milikUser($user->id)
                ->where('jenis_tabungan_id', $jenis->id)
                ->terverifikasi()
                ->where('jenis_transaksi', 'setor')
                ->sum('nominal');

            $totalPenarikan = Transaksi::milikUser($user->id)
                ->where('jenis_tabungan_id', $jenis->id)
                ->terverifikasi()
                ->where('jenis_transaksi', 'tarik')
                ->sum('nominal');

            $pendingAmount = Transaksi::milikUser($user->id)
                ->where('jenis_tabungan_id', $jenis->id)
                ->menungguVerifikasi()
                ->where('jenis_transaksi', 'setor')
                ->sum('nominal');

            $saldo = max(0, $totalTerverifikasi - $totalPenarikan);

            $target = $this->targetUser($user, $jenis);

            // Emas progress diukur dalam gram (target_emas_gram), bukan rupiah.
            if ($jenis->tipe === TipeTabungan::Emas) {
                $targetGram = $user->target_emas_gram !== null ? (float) $user->target_emas_gram : 0.0;
                $unit = (float) Transaksi::milikUser($user->id)
                    ->where('jenis_tabungan_id', $jenis->id)
                    ->terverifikasi()
                    ->sum('unit_didapat');
                $persentase = $targetGram > 0 ? round(min(100, ($unit / $targetGram) * 100), 2) : null;
            } else {
                $persentase = $target > 0 ? round(($saldo / $target) * 100, 2) : null;
            }

            $summary[] = [
                'jenis_tabungan_id' => $jenis->id,
                'kode' => $jenis->kode,
                'nama' => $jenis->nama,
                'tipe' => $jenis->tipe->value,
                'sub_jenis' => $jenis->sub_jenis?->value ?? null,
                'total_setoran' => $totalTerverifikasi,
                'total_penarikan' => $totalPenarikan,
                'saldo' => $saldo,
                'pending_amount' => $pendingAmount,
                'target' => $target,
                'persentase' => $persentase,
            ];
        }

        $totalPending = Transaksi::milikUser($user->id)
            ->menungguVerifikasi()
            ->count();

        return [
            'tabungan' => $summary,
            'transaksi_pending' => $totalPending,
        ];
    }

    /**
     * Get progress for a specific jenis tabungan.
     */
    public function getProgress(User $user, JenisTabungan $jenisTabungan): array
    {
        $totalSetor = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        $totalTarik = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->where('jenis_transaksi', 'tarik')
            ->sum('nominal');

        $pendingAmount = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->menungguVerifikasi()
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        $totalUnit = null;
        if ($jenisTabungan->tipe === TipeTabungan::Emas) {
            $totalUnit = Transaksi::milikUser($user->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->terverifikasi()
                ->sum('unit_didapat');
        }

        $saldo = max(0, $totalSetor - $totalTarik);

        $target = $this->targetUser($user, $jenisTabungan);

        $frekuensi = null;
        $targetRow = UserTabunganTarget::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->first();
        if ($targetRow) {
            $frekuensi = [
                'frekuensi_setor' => $targetRow->frekuensi_setor ?: 'bulanan',
                'frekuensi_label' => $targetRow->frekuensiLabel() ?: 'Bulanan',
                'nominal_per_periode' => (float) $targetRow->nominal_per_periode,
                'sisa_pembayaran' => $targetRow->sisaPembayaran($saldo),
            ];
        }

        // Emas progress diukur dalam gram (target_emas_gram), bukan rupiah.
        if ($jenisTabungan->tipe === TipeTabungan::Emas) {
            $targetGram = $user->target_emas_gram !== null ? (float) $user->target_emas_gram : 0.0;
            $persentase = $targetGram > 0 ? round(min(100, ((float) $totalUnit / $targetGram) * 100), 2) : null;
        } else {
            $persentase = $target > 0 ? round(($saldo / $target) * 100, 2) : null;
        }

        return [
            'jenis_tabungan_id' => $jenisTabungan->id,
            'kode' => $jenisTabungan->kode,
            'nama' => $jenisTabungan->nama,
            'tipe' => $jenisTabungan->tipe->value,
            'sub_jenis' => $jenisTabungan->sub_jenis?->value ?? null,
            'total_setoran' => $totalSetor,
            'total_penarikan' => $totalTarik,
            'saldo' => $saldo,
            'pending_amount' => $pendingAmount,
            'total_unit' => $totalUnit,
            'unit_label' => $jenisTabungan->unit_label,
            'saldo_dana' => $jenisTabungan->tipe === TipeTabungan::Emas
                ? $this->saldoEmasService->getSaldoDana($user, $jenisTabungan)
                : 0.0,
            'target' => $target,
            'target_emas_gram' => $jenisTabungan->tipe === TipeTabungan::Emas
                ? ($user->target_emas_gram !== null ? (float) $user->target_emas_gram : null)
                : null,
            'target_unit' => $jenisTabungan->target_unit,
            'persentase' => $persentase,
            'frekuensi' => $frekuensi,
        ];
    }
}
