<?php

namespace App\Services;

use App\Models\HargaEmasHarian;

class EmasConversionService
{
    /**
     * Get the current active gold price.
     */
    public function getHargaTerkini(): ?HargaEmasHarian
    {
        return HargaEmasHarian::hargaTerkini();
    }
}
