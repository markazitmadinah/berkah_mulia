<?php

namespace App\Enums;

enum TipeTabungan: string
{
    case Emas = 'emas';
    case Pribadi = 'pribadi';
    case Qurban = 'qurban';

    public function label(): string
    {
        return match ($this) {
            self::Emas => 'Tabungan Emas',
            self::Pribadi => 'Tabungan Pribadi',
            self::Qurban => 'Tabungan Qurban',
        };
    }
}
