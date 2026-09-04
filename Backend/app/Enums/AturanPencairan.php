<?php

namespace App\Enums;

enum AturanPencairan: string
{
    case Otomatis = 'otomatis';
    case ManualAdmin = 'manual_admin';
    case TanggalTertentu = 'tanggal_tertentu';

    public function label(): string
    {
        return match ($this) {
            self::Otomatis => 'Pencairan Otomatis',
            self::ManualAdmin => 'Pencairan Manual oleh Admin',
            self::TanggalTertentu => 'Pencairan pada Tanggal Tertentu',
        };
    }
}
