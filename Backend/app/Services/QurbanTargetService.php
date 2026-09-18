<?php

namespace App\Services;

use App\Enums\JenisTransaksi;
use App\Enums\StatusPendaftaranQurban;
use App\Models\HewanQurban;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use Carbon\Carbon;

class QurbanTargetService
{
    /**
     * Calculate target_dana based on hewan price and quantity.
     * Snapshot = harga_per_unit × jumlah_hewan at registration time.
     */
    public function hitungTargetDana(HewanQurban $hewan, int $jumlahHewan): float
    {
        return $hewan->harga_per_unit * $jumlahHewan;
    }

    /**
     * Normalize/derive nominal per periode untuk qurban.
     * Bila nominal tidak diserahkan, dihitung dari target ÷ jumlah periode
     * (harian/mingguan/bulanan) sampai tanggal idul adha.
     */
    public function nominalPerPeriode(float $target, ?PeriodeQurban $periode, ?string $frekuensi, ?float $nominal): float
    {
        $frekuensi = $frekuensi ?: 'bulanan';
        if ($nominal !== null && $nominal > 0) {
            return round($nominal, 2);
        }

        $deadline = $periode?->tanggal_idul_adha ?? now()->addMonths(12)->toDateString();
        $mulai = now()->startOfDay();
        $akhir = Carbon::parse($deadline)->startOfDay();
        $hari = (int) max(1, $mulai->diffInDays($akhir));

        $totalPeriode = match ($frekuensi) {
            'harian' => $hari,
            'mingguan' => max(1, intdiv($hari, 7)),
            default => max(1, $mulai->diffInMonths($akhir)),
        };

        return round(ceil($target / $totalPeriode * 100) / 100, 2);
    }

    /**
     * Update total_terkumpul for a pendaftaran qurban.
     * Called by TransaksiObserver when a transaction is verified.
     */
    public function updateTotalTerkumpul(PendaftaranQurban $pendaftaran): void
    {
        // Net = setor terverifikasi − tarik terverifikasi. Pencairan administratif
        // dicatat sebagai transaksi tarik, sehingga total tidak "hidup lagi" bila
        // ada setoran pending yang menyusul terverifikasi setelah pencairan.
        $setor = $pendaftaran->transaksi()
            ->terverifikasi()
            ->where('jenis_transaksi', JenisTransaksi::Setor->value)
            ->sum('nominal');

        $tarik = $pendaftaran->transaksi()
            ->terverifikasi()
            ->where('jenis_transaksi', JenisTransaksi::Tarik->value)
            ->sum('nominal');

        $total = max(0, (float) $setor - (float) $tarik);

        $pendaftaran->update(['total_terkumpul' => $total]);

        // Auto-update status if target is reached
        if (
            $pendaftaran->isTargetTercapai()
            && $pendaftaran->status->value === StatusPendaftaranQurban::Menabung->value
        ) {
            $pendaftaran->update(['status' => StatusPendaftaranQurban::TargetTercapai->value]);
        }
    }
}
