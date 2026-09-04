<?php

namespace App\Models;

use App\Enums\ChannelNotifikasi;
use App\Enums\TipeNotifikasi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notifikasi extends Model
{
    use HasFactory;

    protected $table = 'notifikasi';

    protected $fillable = [
        'user_id',
        'judul',
        'pesan',
        'tipe',
        'data',
        'channel',
        'dibaca_pada',
    ];

    protected function casts(): array
    {
        return [
            'tipe' => TipeNotifikasi::class,
            'channel' => ChannelNotifikasi::class,
            'data' => 'array',
            'dibaca_pada' => 'datetime',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeBelumDibaca($query)
    {
        return $query->whereNull('dibaca_pada');
    }

    public function scopeSudahDibaca($query)
    {
        return $query->whereNotNull('dibaca_pada');
    }

    // ─── Helpers ───────────────────────────────────────────────

    public function tandaiDibaca(): void
    {
        if (is_null($this->dibaca_pada)) {
            $this->update(['dibaca_pada' => now()]);
        }
    }
}
