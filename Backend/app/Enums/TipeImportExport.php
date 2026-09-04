<?php

namespace App\Enums;

enum TipeImportExport: string
{
    case Import = 'import';
    case Export = 'export';

    public function label(): string
    {
        return match ($this) {
            self::Import => 'Import',
            self::Export => 'Export',
        };
    }
}
