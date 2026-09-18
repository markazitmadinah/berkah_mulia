<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserTabunganTarget extends Model
{
    protected $table = 'user_tabungan_target';

    protected $fillable = ['user_id', 'jenis_tabungan_id', 'target_nominal', 'frekuensi_setor', 'nominal_per_periode'];

    protected function casts(): array
    {
        return [
            'target_nominal' => 'decimal:2',
            'nominal_per_periode' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function jenisTabungan()
    {
        return $this->belongsTo(JenisTabungan::class);
    }

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
     * Sisa berapa kali bayar = sisa target ÷ nominal per periode.
     */
    public function sisaPembayaran(float $terkumpul): ?int
    {
        $nominalPeriode = (float) $this->nominal_per_periode;
        if ($nominalPeriode <= 0) {
            return null;
        }

        return (int) ceil(max(0, (float) $this->target_nominal - $terkumpul) / $nominalPeriode);
    }
}
