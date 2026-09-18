<?php

namespace App\Models;

use App\Enums\StatusPendaftaranQurban;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

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
        'frekuensi_setor',
        'nominal_per_periode',
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
            'nominal_per_periode' => 'decimal:2',
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

    /**
     * Saldo netto ledger (setor − tarik, hanya terverifikasi). Dipakai untuk
     * menghitung nominal pengembalian saat pendaftaran dibatalkan.
     */
    public function terkumpulNetto(): float
    {
        $setor = (float) $this->transaksi()
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        $tarik = (float) $this->transaksi()
            ->where('status_verifikasi', 'terverifikasi')
            ->where('jenis_transaksi', 'tarik')
            ->sum('nominal');

        return max(0, $setor - $tarik);
    }

    // ─── Frekuensi & sisa pembayaran ──────────────────────────

    public function frekuensiLabel(): ?string
    {
        return match ($this->frekuensi_setor) {
            'harian' => 'Harian',
            'mingguan' => 'Mingguan',
            'bulanan' => 'Bulanan',
            default => null,
        };
    }

    /**
     * Sisa berapa kali bayar = sisa nominal ÷ nominal per periode.
     */
    public function sisaPembayaran(): ?int
    {
        $nominalPeriode = (float) $this->nominal_per_periode;
        if ($nominalPeriode <= 0) {
            return null;
        }

        return (int) ceil(max(0, (float) $this->target_dana - (float) $this->total_terkumpul) / $nominalPeriode);
    }

    /**
     * Periode jatuh tempo (harian/mingguan/bulanan) sejak tanggal daftar yang sudah
     * lewat tapi belum dibayar. Periode "terlaksana" = nominal terkumpul ÷ nominal
     * per periode. Matematikanya mengikuti TabunganBerjangka::tertunggak agar
     * konsisten dengan tunggakan berjangka & setoran berkala.
     */
    public function tertunggak(): array
    {
        $nominalPeriode = (float) $this->nominal_per_periode;
        if ($nominalPeriode <= 0) {
            return ['jumlah_periode' => 0, 'nominal' => 0.0];
        }

        $mulai = Carbon::parse($this->tanggal_daftar ?: $this->created_at)->startOfDay();
        $sampai = now()->startOfDay();

        $hitungPeriode = function (Carbon $dari, Carbon $ke) {
            $hari = (int) max(0, $dari->diffInDays($ke));

            return match ($this->frekuensi_setor) {
                'mingguan' => intdiv($hari, 7) + 1,
                'bulanan' => max(1, $dari->diffInMonths($ke) + 1),
                default => $hari + 1,
            };
        };

        // Total periode rencana = target ÷ nominal per periode (analog jatuh tempo).
        $totalPeriode = (int) ceil((float) $this->target_dana / $nominalPeriode);
        $seharusnya = min($hitungPeriode($mulai, $sampai), $totalPeriode);

        $terlaksana = (int) floor(((float) $this->total_terkumpul) / $nominalPeriode);

        return [
            'jumlah_periode' => max(0, $seharusnya - $terlaksana),
            'nominal' => round(max(0, $seharusnya - $terlaksana) * $nominalPeriode, 2),
        ];
    }
}
