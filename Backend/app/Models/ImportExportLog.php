<?php

namespace App\Models;

use App\Enums\TipeImportExport;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportExportLog extends Model
{
    protected $table = 'import_export_logs';

    protected $fillable = [
        'user_id',
        'tipe',
        'target',
        'file_path',
        'total_baris',
        'berhasil',
        'gagal',
        'error_detail',
    ];

    protected function casts(): array
    {
        return [
            'tipe' => TipeImportExport::class,
            'total_baris' => 'integer',
            'berhasil' => 'integer',
            'gagal' => 'integer',
            'error_detail' => 'array',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
