<?php

namespace App\Models;

use App\Enums\AturanPencairan;
use App\Enums\ModePerhitungan;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeTabungan;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JenisTabungan extends Model
{
    use HasFactory;

    protected $table = 'jenis_tabungan';

    protected $fillable = [
        'kode',
        'nama',
        'deskripsi',
        'tipe',
        'sub_jenis',
        'deadline',
        'frekuensi_setoran',
        'mode_perhitungan',
        'target_nominal',
        'target_unit',
        'unit_label',
        'tanggal_mulai',
        'tanggal_selesai',
        'tanpa_batas_waktu',
        'aturan_pencairan',
        'tanggal_pencairan',
        'metode_pembayaran_diizinkan',
        'allow_withdrawal',
        'status_aktif',
        'config',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tipe' => TipeTabungan::class,
            'sub_jenis' => SubJenisTabungan::class,
            'deadline' => 'date',
            'mode_perhitungan' => ModePerhitungan::class,
            'aturan_pencairan' => AturanPencairan::class,
            'target_nominal' => 'decimal:2',
            'target_unit' => 'decimal:4',
            'tanggal_mulai' => 'date',
            'tanggal_selesai' => 'date',
            'tanpa_batas_waktu' => 'boolean',
            'tanggal_pencairan' => 'date',
            'metode_pembayaran_diizinkan' => 'array',
            'allow_withdrawal' => 'boolean',
            'status_aktif' => 'boolean',
            'config' => 'array',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function transaksi(): HasMany
    {
        return $this->hasMany(Transaksi::class);
    }

    public function userTargets(): HasMany
    {
        return $this->hasMany(UserTabunganTarget::class);
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeAktif($query)
    {
        return $query->where('status_aktif', true);
    }

    public function scopeByTipe($query, TipeTabungan $tipe)
    {
        return $query->where('tipe', $tipe);
    }
}
