<?php

namespace App\Observers;

use App\Enums\StatusVerifikasi;
use App\Models\Transaksi;
use App\Services\QurbanTargetService;

class TransaksiObserver
{
    public function __construct(private QurbanTargetService $qurbanService) {}

    /**
     * Handle the Transaksi "updated" event.
     * When status_verifikasi changes to terverifikasi, update total_terkumpul.
     */
    public function updated(Transaksi $transaksi): void
    {
        // Only act when verification status actually changed
        if (! $transaksi->wasChanged('status_verifikasi')) {
            return;
        }

        // Update qurban total when verified
        if (
            $transaksi->status_verifikasi === StatusVerifikasi::Terverifikasi
            && $transaksi->pendaftaran_qurban_id
        ) {
            $this->qurbanService->updateTotalTerkumpul($transaksi->pendaftaranQurban);
        }
    }
}
