<?php

namespace App\Services;

use App\Models\HargaEmasHarian;

class EmasConversionService
{
    /**
     * Convert nominal (Rupiah) to grams of gold based on current price.
     *
     * @return array{unit_didapat: string, harga_acuan_id: int, harga_acuan_snapshot: string}
     *
     * @throws \RuntimeException if no active gold price found
     */
    public function konversiNominalKeGram(float $nominal): array
    {
        $hargaTerkini = HargaEmasHarian::hargaTerkini();

        if (! $hargaTerkini) {
            throw new \RuntimeException('Harga emas belum diinput oleh admin. Silakan hubungi admin.');
        }

        $unitDidapat = $nominal / $hargaTerkini->harga_per_gram;

        return [
            'unit_didapat' => number_format($unitDidapat, 4, '.', ''),
            'harga_acuan_id' => $hargaTerkini->id,
            'harga_acuan_snapshot' => $hargaTerkini->harga_per_gram,
        ];
    }

    /**
     * Get the current active gold price.
     */
    public function getHargaTerkini(): ?HargaEmasHarian
    {
        return HargaEmasHarian::hargaTerkini();
    }
}
