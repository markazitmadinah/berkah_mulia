<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HewanQurban extends Model
{
    use HasFactory;

    protected $table = 'hewan_qurban';

    protected $fillable = [
        'jenis_hewan',
        'harga_per_unit',
        'berat_rata_rata',
        'deskripsi',
        'periode_qurban_id',
        'status_aktif',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'harga_per_unit' => 'decimal:2',
            'status_aktif' => 'boolean',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function periodeQurban(): BelongsTo
    {
        return $this->belongsTo(PeriodeQurban::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeAktif($query)
    {
        return $query->where('status_aktif', true);
    }
}
