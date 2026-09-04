<?php

namespace App\Enums;

enum StatusPeriodeQurban: string
{
    case Draft = 'draft';
    case Aktif = 'aktif';
    case Ditutup = 'ditutup';
    case Selesai = 'selesai';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Aktif => 'Aktif (Pendaftaran Dibuka)',
            self::Ditutup => 'Pendaftaran Ditutup',
            self::Selesai => 'Selesai',
        };
    }
}
