<?php

namespace App\Enums;

enum TipeNotifikasi: string
{
    case Info = 'info';
    case Verifikasi = 'verifikasi';
    case PengingatSetor = 'pengingat_setor';
    case PengingatPencairan = 'pengingat_pencairan';
    case ApprovalAkun = 'approval_akun';

    public function label(): string
    {
        return match ($this) {
            self::Info => 'Informasi',
            self::Verifikasi => 'Verifikasi Transaksi',
            self::PengingatSetor => 'Pengingat Setoran',
            self::PengingatPencairan => 'Pengingat Pencairan',
            self::ApprovalAkun => 'Persetujuan Akun',
        };
    }
}
