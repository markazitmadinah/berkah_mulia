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

        return (float) ($totalSetor - $totalTarik);
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

            $saldo = $totalTerverifikasi - $totalPenarikan;

            $target = $this->targetUser($user, $jenis);

            $summary[] = [
                'jenis_tabungan_id' => $jenis->id,
                'kode' => $jenis->kode,
                'nama' => $jenis->nama,
                'tipe' => $jenis->tipe->value,
                'total_setoran' => $totalTerverifikasi,
                'total_penarikan' => $totalPenarikan,
                'saldo' => $saldo,
                'pending_amount' => $pendingAmount,
                'target' => $target,
                'persentase' => $target > 0
                    ? round(($saldo / $target) * 100, 2)
                    : null,
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

        $saldo = $totalSetor - $totalTarik;

        $target = $this->targetUser($user, $jenisTabungan);

        return [
            'jenis_tabungan_id' => $jenisTabungan->id,
            'kode' => $jenisTabungan->kode,
            'nama' => $jenisTabungan->nama,
            'tipe' => $jenisTabungan->tipe->value,
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
            'target_unit' => $jenisTabungan->target_unit,
            'persentase' => $target > 0
                ? round(($saldo / $target) * 100, 2)
                : null,
        ];
    }
}
