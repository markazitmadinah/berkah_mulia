<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HargaEmasHarian extends Model
{
    use HasFactory;

    protected $table = 'harga_emas_harian';

    protected $fillable = [
        'tanggal',
        'harga_per_gram',
        'tagihan_harian_default',
        'status_aktif',
        'catatan',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'harga_per_gram' => 'decimal:2',
            'tagihan_harian_default' => 'decimal:2',
            'status_aktif' => 'boolean',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function transaksi(): HasMany
    {
        return $this->hasMany(Transaksi::class, 'harga_acuan_id');
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeAktif($query)
    {
        return $query->where('status_aktif', true);
    }

    /**
     * Get the currently active gold price.
     * Pure read — never fires outbound network calls (anti DoS / no 3rd-party
     * dependency in request path). Sync is handled by the scheduled
     * `hargaemas:sync` command, not inside a client-triggered request.
     */
    public static function hargaTerkini(): ?self
    {
        return static::aktif()
            ->whereDate('tanggal', '<=', now()->toDateString())
            ->orderByDesc('tanggal')
            ->orderByDesc('id')
            ->first();
    }
}
