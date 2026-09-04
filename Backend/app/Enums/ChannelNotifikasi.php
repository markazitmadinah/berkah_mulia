<?php

namespace App\Enums;

enum ChannelNotifikasi: string
{
    case InApp = 'in_app';
    case Email = 'email';

    public function label(): string
    {
        return match ($this) {
            self::InApp => 'In-App',
            self::Email => 'Email',
        };
    }
}
