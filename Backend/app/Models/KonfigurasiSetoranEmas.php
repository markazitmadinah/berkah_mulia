<?php

namespace App\Models;

use App\Enums\FrekuensiSetoran;
use App\Enums\StatusKonfigurasiSetoran;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KonfigurasiSetoranEmas extends Model
{
    use HasFactory;

    protected $table = 'konfigurasi_setoran_emas';

    protected $fillable = [
        'external_id',
        'user_id',
        'jenis_tabungan_id',
        'nominal_per_periode',
        'target_gram_per_periode',
        'target_gram_total',
        'frekuensi_setor',
        'tanggal_mulai',
        'durasi_periode',
        'tanggal_deadline',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'frekuensi_setor' => FrekuensiSetoran::class,
            'status' => StatusKonfigurasiSetoran::class,
            'nominal_per_periode' => 'decimal:2',
            'target_gram_per_periode' => 'decimal:6',
            'target_gram_total' => 'decimal:6',
            'tanggal_mulai' => 'date',
            'tanggal_deadline' => 'date',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function jenisTabungan(): BelongsTo
    {
        return $this->belongsTo(JenisTabungan::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function transaksis(): HasMany
    {
        return $this->hasMany(Transaksi::class, 'konfigurasi_id');
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('status', StatusKonfigurasiSetoran::Aktif);
    }

    public function scopeMilikUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeByExternal(Builder $query, string $externalId): Builder
    {
        return $query->where('external_id', $externalId);
    }

    /**
     * Deskripsi jadwal setoran (harian/mingguan/bulanan) untuk tampilan.
     * "Mulai" memakai tanggal_mulai; fallback created_at seperti SaldoEmasService.
     */
    public function jadwalLabel(): string
    {
        $mulai = Carbon::parse($this->tanggal_mulai ?: $this->created_at);
        $hari = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];

        return match ($this->frekuensi_setor) {
            FrekuensiSetoran::Harian => 'Setiap hari',
            FrekuensiSetoran::Mingguan => 'Setiap ' . $hari[$mulai->dayOfWeekIso],
            FrekuensiSetoran::Bulanan => 'Setiap tanggal ' . $mulai->day,
        };
    }
}