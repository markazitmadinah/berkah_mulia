<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class UserTabunganTarget extends Model
{
    protected $table = 'user_tabungan_target';

    protected $fillable = ['user_id', 'jenis_tabungan_id', 'target_nominal', 'frekuensi_setor', 'nominal_per_periode', 'durasi_periode', 'tanggal_mulai', 'tanggal_deadline'];

    protected function casts(): array
    {
        return [
            'target_nominal' => 'decimal:2',
            'nominal_per_periode' => 'decimal:2',
            'durasi_periode' => 'integer',
            'tanggal_mulai' => 'date',
            'tanggal_deadline' => 'date',
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

    /**
     * Tunggakan periode (harian/mingguan/bulanan) sejak tanggal daftar yang sudah
     * lewat tapi belum dibayar. Matematika disamakan dengan PendaftaranQurban::tertunggak
     * agar hari raya tampil konsisten dengan qurban di dashboard nasabah.
     *
     * @return array{jumlah_periode: int, nominal: float}
     */
    public function tertunggak(float $terkumpul): array
    {
        $nominalPeriode = (float) $this->nominal_per_periode;
        $frekuensi = $this->frekuensi_setor;

        if ($nominalPeriode <= 0) {
            return ['jumlah_periode' => 0, 'nominal' => 0.0];
        }

        $mulai = Carbon::parse($this->tanggal_mulai ?? $this->created_at)->startOfDay();
        $sampai = now()->startOfDay();

        // Total periode rencana = target ÷ nominal per periode (analog jatuh tempo).
        $totalPeriode = (int) ceil((float) $this->target_nominal / $nominalPeriode);

        $periodeTerlewat = $totalPeriode > 0
            ? min($totalPeriode, $this->jumlahPeriodeTerlewat($frekuensi, $mulai, $sampai))
            : max(0, $this->jumlahPeriodeTerlewat($frekuensi, $mulai, $sampai));

        $periodeTerbayar = (int) floor((float) $terkumpul / $nominalPeriode);

        return [
            'jumlah_periode' => max(0, $periodeTerlewat - $periodeTerbayar),
            'nominal' => round(max(0, $periodeTerlewat - $periodeTerbayar) * $nominalPeriode, 2),
        ];
    }

    private function jumlahPeriodeTerlewat(string $frekuensi, Carbon $mulai, Carbon $sampai): int
    {
        $hari = (int) max(0, $mulai->diffInDays($sampai));

        return match ($frekuensi) {
            'mingguan' => intdiv($hari, 7) + 1,
            'bulanan' => max(1, $mulai->diffInMonths($sampai) + 1),
            default => $hari + 1,
        };
    }
}
