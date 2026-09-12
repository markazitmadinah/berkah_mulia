<?php

namespace App\Models;

use App\Enums\StatusVerifikasi;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AngsuranGadai extends Model
{
    use HasFactory;

    protected $table = 'angsuran_gadai';

    protected $fillable = [
        'gadai_id',
        'tanggal_bayar',
        'nominal',
        'metode_pembayaran',
        'catatan',
        'status_verifikasi',
        'bukti_transfer_path',
        'catatan_admin',
        'diverifikasi_oleh',
        'diverifikasi_pada',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'nominal' => 'decimal:2',
            'tanggal_bayar' => 'date',
            'status_verifikasi' => StatusVerifikasi::class,
            'diverifikasi_pada' => 'datetime',
        ];
    }

    public function gadai(): BelongsTo
    {
        return $this->belongsTo(Gadai::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function diverifikasiOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diverifikasi_oleh');
    }

    /**
     * Check if this angsuran is pending verification.
     */
    public function isMenungguVerifikasi(): bool
    {
        return $this->status_verifikasi === StatusVerifikasi::MenungguVerifikasi;
    }

    /**
     * Check if this angsuran has been verified.
     */
    public function isTerverifikasi(): bool
    {
        return $this->status_verifikasi === StatusVerifikasi::Terverifikasi;
    }
}