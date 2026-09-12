<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TabunganBerjangka extends Model
{
    protected $table = 'tabungan_berjangka';

    protected $fillable = [
        'user_id',
        'jenis_tabungan_id',
        'target_nominal',
        'durasi_bulan',
        'frekuensi_setor',
        'nominal_per_periode',
        'tanggal_mulai',
        'tanggal_jatuh_tempo',
        'status',
        'approved_by',
        'approved_at',
        'catatan',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'target_nominal' => 'decimal:2',
            'nominal_per_periode' => 'decimal:2',
            'durasi_bulan' => 'integer',
            'tanggal_mulai' => 'date',
            'tanggal_jatuh_tempo' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    // ─── Relationships ────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function jenisTabungan(): BelongsTo
    {
        return $this->belongsTo(JenisTabungan::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function transaksi(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Transaksi::class);
    }

    // ─── Scopes ───────────────────────────────────────────────

    public function scopeMilikUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('status', 'aktif');
    }

    // ─── Helpers ──────────────────────────────────────────────

    public function isAktif(): bool
    {
        return $this->status === 'aktif';
    }

    public function isMenungguApproval(): bool
    {
        return $this->status === 'menunggu_approval';
    }

    /**
     * Hitung total nominal setoran terverifikasi untuk tabungan berjangka ini.
     */
    public function terkumpulNominal(): float
    {
        // 1. Ambil transaksi yang terikat langsung via tabungan_berjangka_id
        $nominalDirect = (float) Transaksi::where('tabungan_berjangka_id', $this->id)
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        if ($nominalDirect > 0) {
            return $nominalDirect;
        }

        // 2. Fallback untuk transaksi terdahulu berdasarkan waktu dan jenis_tabungan_id
        return (float) Transaksi::where('user_id', $this->user_id)
            ->whereNull('tabungan_berjangka_id')
            ->where('jenis_tabungan_id', $this->jenis_tabungan_id)
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'setor')
            ->when($this->tanggal_mulai, fn ($q) => $q->where('created_at', '>=', $this->tanggal_mulai))
            ->when($this->tanggal_jatuh_tempo, fn ($q) => $q->where('created_at', '<=', $this->tanggal_jatuh_tempo->endOfDay()))
            ->sum('nominal');
    }

    public function isJatuhTempo(): bool
    {
        return $this->tanggal_jatuh_tempo !== null && now()->startOfDay()->gte($this->tanggal_jatuh_tempo->startOfDay());
    }

    public function isGoalReached(): bool
    {
        return $this->terkumpulNominal() >= (float) $this->target_nominal;
    }

    /**
     * Tabungan berjangka hanya bisa ditarik jika:
     * 1. Status aktif atau selesai
     * 2. Sudah jatuh tempo (jangka waktu berakhir)
     * 3. Target nominal tercapai (mencapai goal)
     */
    public function canWithdraw(): bool
    {
        return in_array($this->status, ['aktif', 'selesai'])
            && $this->isJatuhTempo()
            && $this->isGoalReached();
    }

    /**
     * Hitung frekuensi label.
     */
    public function frekuensiLabel(): string
    {
        return match ($this->frekuensi_setor) {
            'harian' => 'Harian',
            'mingguan' => 'Mingguan',
            'bulanan' => 'Bulanan',
            default => $this->frekuensi_setor,
        };
    }
}
