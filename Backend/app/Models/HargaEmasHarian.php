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
        'harga_beli',
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
            'harga_beli' => 'decimal:2',
            'tagihan_harian_default' => 'decimal:2',
            'status_aktif' => 'boolean',
        ];
    }

    // ─── Markup Harga Jual Bertingkat ──────────────────────────
    // Harga jual tabungan emas = harga acuan + markup sesuai gramasi transaksi.
    // Semakin besar gramasi, semakin kecil markup per gram.

    public const MARKUP_1_5_GRAM = 200000;
    public const MARKUP_6_10_GRAM = 150000;
    public const MARKUP_11_GRAM_PLUS = 100000;

    public static function markupPerGram(float $gram): float
    {
        if ($gram <= 5.0) {
            return self::MARKUP_1_5_GRAM;
        }
        if ($gram <= 10.0) {
            return self::MARKUP_6_10_GRAM;
        }

        return self::MARKUP_11_GRAM_PLUS;
    }

    public function hargaJualPerGram(float $gram): float
    {
        return round((float) $this->harga_per_gram + static::markupPerGram($gram), 2);
    }

    public function hargaJualTiers(): array
    {
        $base = (float) $this->harga_per_gram;

        return [
            ['label' => '1–5 gram', 'gramasi_min' => 0.0, 'gramasi_max' => 5.0, 'markup' => self::MARKUP_1_5_GRAM, 'harga_jual' => round($base + self::MARKUP_1_5_GRAM, 2)],
            ['label' => '6–10 gram', 'gramasi_min' => 5.0, 'gramasi_max' => 10.0, 'markup' => self::MARKUP_6_10_GRAM, 'harga_jual' => round($base + self::MARKUP_6_10_GRAM, 2)],
            ['label' => '>10 gram', 'gramasi_min' => 10.0, 'gramasi_max' => null, 'markup' => self::MARKUP_11_GRAM_PLUS, 'harga_jual' => round($base + self::MARKUP_11_GRAM_PLUS, 2)],
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
