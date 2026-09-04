<?php

namespace App\Services;

use App\Enums\JenisTransaksi;
use App\Enums\StatusPendaftaranQurban;
use App\Models\HewanQurban;
use App\Models\PendaftaranQurban;

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
     * Update total_terkumpul for a pendaftaran qurban.
     * Called by TransaksiObserver when a transaction is verified.
     */
    public function updateTotalTerkumpul(PendaftaranQurban $pendaftaran): void
    {
        $total = $pendaftaran->transaksi()
            ->terverifikasi()
            ->where('jenis_transaksi', JenisTransaksi::Setor->value)
            ->sum('nominal');

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
