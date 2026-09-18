<?php

namespace App\Models;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaksi extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'transaksi';

    protected $fillable = [
        'nomor_referensi',
        'user_id',
        'jenis_tabungan_id',
        'pendaftaran_qurban_id',
        'tabungan_berjangka_id',
        'gadai_id',
        'konfigurasi_id',
        'jenis_transaksi',
        'nominal',
        'nominal_emas',
        'nominal_selisih',
        'unit_didapat',
        'harga_acuan_id',
        'harga_acuan_snapshot',
        'biaya_penalti',
        'metode_pembayaran',
        'rekening_bank_id',
        'bukti_transfer_path',
        'status_verifikasi',
        'diverifikasi_oleh',
        'diverifikasi_pada',
        'catatan_admin',
        'catatan_user',
        'tanggal_transaksi',
    ];

    protected function casts(): array
    {
        return [
            'jenis_transaksi' => JenisTransaksi::class,
            'metode_pembayaran' => MetodePembayaran::class,
            'status_verifikasi' => StatusVerifikasi::class,
            'nominal' => 'decimal:2',
            'nominal_emas' => 'decimal:2',
            'nominal_selisih' => 'decimal:2',
            'unit_didapat' => 'decimal:8',
            'harga_acuan_snapshot' => 'decimal:2',
            'biaya_penalti' => 'decimal:2',
            'tanggal_transaksi' => 'date',
            'diverifikasi_pada' => 'datetime',
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

    public function pendaftaranQurban(): BelongsTo
    {
        return $this->belongsTo(PendaftaranQurban::class);
    }

    public function tabunganBerjangka(): BelongsTo
    {
        return $this->belongsTo(TabunganBerjangka::class);
    }

    public function gadai(): BelongsTo
    {
        return $this->belongsTo(Gadai::class);
    }

    public function konfigurasiSetoranEmas(): BelongsTo
    {
        return $this->belongsTo(KonfigurasiSetoranEmas::class, 'konfigurasi_id');
    }

    public function hargaAcuan(): BelongsTo
    {
        return $this->belongsTo(HargaEmasHarian::class, 'harga_acuan_id');
    }

    public function rekeningBank(): BelongsTo
    {
        return $this->belongsTo(RekeningBank::class);
    }

    public function diverifikasiOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diverifikasi_oleh');
    }

    // ─── Scopes ────────────────────────────────────────────────

    public function scopeMenungguVerifikasi($query)
    {
        return $query->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi);
    }

    public function scopeTerverifikasi($query)
    {
        return $query->where('status_verifikasi', StatusVerifikasi::Terverifikasi);
    }

    public function scopeMilikUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    // ─── Helpers ───────────────────────────────────────────────

    /**
     * Generate a unique, non-sequential reference number.
     * Format: TRX-YYYYMMDD-XXXXXX
     */
    public static function generateNomorReferensi(): string
    {
        do {
            $nomor = 'TRX-' . now()->format('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        } while (static::where('nomor_referensi', $nomor)->exists());

        return $nomor;
    }

    public function isMenungguVerifikasi(): bool
    {
        return $this->status_verifikasi === StatusVerifikasi::MenungguVerifikasi;
    }

    public function isTerverifikasi(): bool
    {
        return $this->status_verifikasi === StatusVerifikasi::Terverifikasi;
    }
}
