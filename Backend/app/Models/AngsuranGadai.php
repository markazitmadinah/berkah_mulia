<?php

namespace App\Models;

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
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'nominal' => 'decimal:2',
            'tanggal_bayar' => 'date',
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
}