<?php

namespace App\Enums;

enum FrekuensiSetoran: string
{
    case Harian = 'harian';
    case Mingguan = 'mingguan';
    case Bulanan = 'bulanan';

    public function label(): string
    {
        return match ($this) {
            self::Harian => 'Harian',
            self::Mingguan => 'Mingguan',
            self::Bulanan => 'Bulanan',
        };
    }
}