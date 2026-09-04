<?php

namespace App\Models;

use App\Enums\StatusPeriodeQurban;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PeriodeQurban extends Model
{
    use HasFactory;

    protected $table = 'periode_qurban';

    protected $fillable = [
        'tahun',
        'tanggal_buka_pendaftaran',
        'tanggal_tutup_pendaftaran',
        'tanggal_idul_adha',
        'tanggal_pencairan',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'tahun' => 'integer',
            'tanggal_buka_pendaftaran' => 'date',
            'tanggal_tutup_pendaftaran' => 'date',
            'tanggal_idul_adha' => 'date',
            'tanggal_pencairan' => 'date',
            'status' => StatusPeriodeQurban::class,
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function hewanQurban(): HasMany
    {
        return $this->hasMany(HewanQurban::class);
    }

    public function pendaftaran(): HasMany
    {
        return $this->hasMany(PendaftaranQurban::class);
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeAktif($query)
    {
        return $query->where('status', StatusPeriodeQurban::Aktif);
    }

    /**
     * Check if registration is currently open.
     */
    public function isPendaftaranDibuka(): bool
    {
        $today = now()->toDateString();

        return $this->status === StatusPeriodeQurban::Aktif
            && $today >= $this->tanggal_buka_pendaftaran->toDateString()
            && $today <= $this->tanggal_tutup_pendaftaran->toDateString();
    }
}
