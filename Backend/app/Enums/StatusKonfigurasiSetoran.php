<?php

namespace App\Enums;

enum StatusKonfigurasiSetoran: string
{
    case Aktif = 'aktif';
    case Selesai = 'selesai';
    case Batal = 'batal';

    public function label(): string
    {
        return match ($this) {
            self::Aktif => 'Aktif',
            self::Selesai => 'Selesai',
            self::Batal => 'Dibatalkan',
        };
    }
}