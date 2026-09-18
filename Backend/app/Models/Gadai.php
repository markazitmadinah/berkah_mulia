<?php

namespace App\Models;

use App\Enums\StatusGadai;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gadai extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'gadai';

    protected $fillable = [
        'nomor_gadai',
        'user_id',
        'jenis_emas',
        'berat_gram',
        'kadar',
        'berat_bersih_gram',
        'harga_acuan',
        'nilai_taksiran',
        'persen_gadai',
        'besaran_gadai',
        'tanggal_aju',
        'tanggal_aktif',
        'tanggal_jatuh_tempo',
        'tenor_satuan',
        'toleransi_hari',
        'frekuensi_bayar',
        'nominal_angkuran',
        'bunga_persen',
        'tipe_bunga',
        'total_dibayar',
        'tanggal_lunas',
        'status',
        'catatan',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => StatusGadai::class,
            'berat_gram' => 'decimal:4',
            'kadar' => 'decimal:2',
            'berat_bersih_gram' => 'decimal:4',
            'harga_acuan' => 'decimal:2',
            'nilai_taksiran' => 'decimal:2',
            'persen_gadai' => 'decimal:2',
            'besaran_gadai' => 'decimal:2',
            'nominal_angkuran' => 'decimal:2',
            'bunga_persen' => 'decimal:2',
            'total_dibayar' => 'decimal:2',
            'tanggal_aju' => 'date',
            'tanggal_aktif' => 'date',
            'tanggal_jatuh_tempo' => 'date',
            'tanggal_lunas' => 'date',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function angsuran(): HasMany
    {
        return $this->hasMany(AngsuranGadai::class)->orderBy('tanggal_bayar')->orderBy('id');
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeMilikUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Sisa pokok = besaran gadai − total yang sudah dibayarkan.
     */
    public function sisaPokok(): float
    {
        return round((float) $this->besaran_gadai - (float) $this->total_dibayar, 2);
    }
}