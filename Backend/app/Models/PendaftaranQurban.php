<?php

namespace App\Models;

use App\Enums\StatusPendaftaranQurban;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PendaftaranQurban extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'pendaftaran_qurban';

    protected $fillable = [
        'user_id',
        'periode_qurban_id',
        'hewan_qurban_id',
        'jumlah_hewan',
        'target_dana',
        'total_terkumpul',
        'status',
        'tanggal_daftar',
        'tanggal_dicairkan',
        'dicairkan_oleh',
        'catatan',
    ];

    protected function casts(): array
    {
        return [
            'jumlah_hewan' => 'integer',
            'target_dana' => 'decimal:2',
            'total_terkumpul' => 'decimal:2',
            'status' => StatusPendaftaranQurban::class,
            'tanggal_daftar' => 'date',
            'tanggal_dicairkan' => 'date',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function periodeQurban(): BelongsTo
    {
        return $this->belongsTo(PeriodeQurban::class);
    }

    public function hewanQurban(): BelongsTo
    {
        return $this->belongsTo(HewanQurban::class);
    }

    public function dicairkanOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dicairkan_oleh');
    }

    public function transaksi(): HasMany
    {
        return $this->hasMany(Transaksi::class);
    }

    // ─── Helpers ───────────────────────────────────────────────

    public function hitungPersentase(): ?float
    {
        if ($this->target_dana <= 0) {
            return null;
        }

        return round(($this->total_terkumpul / $this->target_dana) * 100, 2);
    }

    public function isTargetTercapai(): bool
    {
        return $this->total_terkumpul >= $this->target_dana;
    }
}
