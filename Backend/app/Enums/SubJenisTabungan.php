<?php

namespace App\Enums;

enum SubJenisTabungan: string
{
    case Mandiri = 'mandiri';
    case HariRaya = 'hari_raya';
    case Qurban = 'qurban';
    case Berjangka = 'berjangka';

    public function label(): string
    {
        return match ($this) {
            self::Mandiri => 'Tabungan Mandiri',
            self::HariRaya => 'Tabungan Hari Raya',
            self::Qurban => 'Tabungan Qurban',
            self::Berjangka => 'Tabungan Berjangka',
        };
    }
}