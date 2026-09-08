<?php

namespace App\Console\Commands;

use App\Services\GadaiService;
use Illuminate\Console\Command;

class CekJatuhTempoGadai extends Command
{
    protected $signature = 'gadai:cek-jatuh-tempo';

    protected $description = 'Perbarui status gadai: AKTIF/DIPERPANJANG lewat jatuh tempo menjadi JATUH_TEMPO, dan JATUH_TEMPO lewat tenggat+toleransi menjadi TERLAMBAT';

    public function handle(GadaiService $service): int
    {
        $berubah = $service->cekJatuhTempo();
        $this->info("Pemeriksaan jatuh tempo gadai selesai. {$berubah} gadai berubah status.");

        return self::SUCCESS;
    }
}