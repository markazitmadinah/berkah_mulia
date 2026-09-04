<?php

namespace App\Enums;

enum ModePerhitungan: string
{
    case NominalBebas = 'nominal_bebas';
    case NominalTetap = 'nominal_tetap';
    case KonversiUnit = 'konversi_unit';

    public function label(): string
    {
        return match ($this) {
            self::NominalBebas => 'Nominal Bebas',
            self::NominalTetap => 'Nominal Tetap',
            self::KonversiUnit => 'Konversi ke Unit (gram/ekor)',
        };
    }
}
