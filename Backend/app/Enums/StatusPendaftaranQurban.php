<?php

namespace App\Enums;

enum StatusPendaftaranQurban: string
{
    case Menabung = 'menabung';
    case TargetTercapai = 'target_tercapai';
    case MenungguVerifikasi = 'menunggu_verifikasi';
    case SiapDicairkan = 'siap_dicairkan';
    case SudahLunas = 'sudah_lunas';
    case SudahDicairkan = 'sudah_dicairkan';
    case Dibatalkan = 'dibatalkan';

    public function label(): string
    {
        return match ($this) {
            self::Menabung => 'Sedang Menabung',
            self::TargetTercapai => 'Target Tercapai',
            self::MenungguVerifikasi => 'Menunggu Verifikasi Admin',
            self::SiapDicairkan => 'Siap Dicairkan',
            self::SudahLunas => 'Sudah Lunas',
            self::SudahDicairkan => 'Sudah Dicairkan',
            self::Dibatalkan => 'Dibatalkan',
        };
    }
}
