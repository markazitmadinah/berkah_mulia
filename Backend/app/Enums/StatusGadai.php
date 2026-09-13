<?php

namespace App\Enums;

/**
 * Status siklus gadai emas:
 * DIAJUKAN → DISETUJUI → AKTIF → JATUH_TEMPO → LUNAS → EMAS_DIKEMBALIKAN
 * TERLAMBAT → DIPERPANJANG; BATAL untuk pembatalan (emas dikembalikan, potongan 10%).
 */
enum StatusGadai: string
{
    case Diajukan = 'diajukan';
    case Disetujui = 'disetujui';
    case Aktif = 'aktif';
    case JatuhTempo = 'jatuh_tempo';
    case Terlambat = 'terlambat';
    case Diperpanjang = 'diperpanjang';
    case Lunas = 'lunas';
    case EmasDikembalikan = 'emas_dikembalikan';
    case Batal = 'batal';

    public function label(): string
    {
        return match ($this) {
            self::Diajukan => 'Diajukan',
            self::Disetujui => 'Disetujui',
            self::Aktif => 'Aktif',
            self::JatuhTempo => 'Jatuh Tempo',
            self::Terlambat => 'Terlambat',
            self::Diperpanjang => 'Diperpanjang',
            self::Lunas => 'Lunas',
            self::EmasDikembalikan => 'Emas Dikembalikan',
            self::Batal => 'Batal',
        };
    }
}