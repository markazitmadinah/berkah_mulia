<?php

namespace App\Enums;

enum UserStatus: string
{
    case Active = 'active';
    case Rejected = 'rejected';
    case Suspended = 'suspended';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Aktif',
            self::Rejected => 'Ditolak',
            self::Suspended => 'Dibekukan',
        };
    }
}
