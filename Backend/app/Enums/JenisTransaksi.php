<?php

namespace App\Enums;

enum JenisTransaksi: string
{
    case Setor = 'setor';
    case Tarik = 'tarik';

    public function label(): string
    {
        return match ($this) {
            self::Setor => 'Setoran',
            self::Tarik => 'Penarikan',
        };
    }
}
