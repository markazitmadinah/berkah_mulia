<?php

namespace App\Services;

use App\Enums\JenisTransaksi;
use App\Enums\StatusKonfigurasiSetoran;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tabungan emas: pembelian gram sesuai target per periode, dua saldo terpisah
 * (saldo emas dalam gram & saldo dana dalam Rupiah), progress & konsistensi setoran berkala.
 * Mendukung beberapa rencana aktif sekaligus; setoran diatribusikan ke rencana (konfigurasi_id).
 */
class SaldoEmasService
{
    public function getAktif(User $user, JenisTabungan $jenisTabungan): ?KonfigurasiSetoranEmas
    {
        return $this->getAktifList($user, $jenisTabungan)->first();
    }

    /**
     * Ada pengajuan batal & refund (tarik menunggu verifikasi) untuk rencana ini?
     * Rencana dikunci: tidak bisa disetor ulang dan tidak bisa diajukan batal dua kali.
     */
    public function refundTerkunci(User $user, KonfigurasiSetoranEmas $konfigurasi): bool
    {
        return Transaksi::milikUser($user->id)
            ->where('konfigurasi_id', $konfigurasi->id)
            ->where('jenis_transaksi', JenisTransaksi::Tarik->value)
            ->menungguVerifikasi()
            ->exists();
    }

    public function getAktifList(User $user, JenisTabungan $jenisTabungan): \Illuminate\Support\Collection
    {
        return KonfigurasiSetoranEmas::query()
            ->aktif()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Query setoran yang diatribusikan ke rencana ini:
     * 1. transaksi baru yang mencatat konfigurasi_id = rencana,
     * 2. data lama (konfigurasi_id NULL) dalam jendela tanggal rencana — hanya untuk kompatibilitas
     *    transisi, karena sebelum multi-rencana setiap transaksi tak bertanda.
     */
    private function setoranRencana(User $user, KonfigurasiSetoranEmas $k): Builder
    {
        $mulai = Carbon::parse($k->tanggal_mulai ?: $k->created_at)->startOfDay();

        return Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $k->jenis_tabungan_id)
            ->where('jenis_transaksi', 'setor')
            ->terverifikasi()
            ->where(function (Builder $q) use ($k) {
                // Baris bertanda konfigurasi_id dihitung apa pun nominalnya;
                // filter nominal hanya untuk data lama (tanpa tanda).
                $q->where('konfigurasi_id', $k->id)
                    ->orWhere(function (Builder $q2) use ($k) {
                        $q2->whereNull('konfigurasi_id')
                            ->where('nominal', (float) $k->nominal_per_periode);
                    });
            })
            // Semua setoran (termasuk yang bertanda konfigurasi_id) dibatasi pada
            // jendela rencana — setoran setelah deadline tidak dihitung progress/refund.
            ->whereBetween('tanggal_transaksi', [
                $mulai->toDateString(),
                $k->tanggal_deadline ?: now()->toDateString(),
            ]);
    }

    /**
     * Saldo emas (gram) = akumulasi unit_didapat semua transaksi emas terverifikasi.
     */
    public function getSaldoGram(User $user, JenisTabungan $jenisTabungan): float
    {
        return (float) Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->sum('unit_didapat');
    }

    /**
     * Saldo dana (Rupiah) = akumulasi nominal_selisih semua transaksi emas terverifikasi.
     * Setoran menambah saldo dana (selisih≥0 saat setoran belum cukup gram) atau
     * menariknya (selisih<0 saat dana dipakai beli gram); pencairan/batal mengurangi.
     */
    public function getSaldoDana(User $user, JenisTabungan $jenisTabungan): float
    {
        return round((float) Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->terverifikasi()
            ->sum('nominal_selisih'), 2);
    }

    /**
     * Refund batal/pencairan emas: potongan 10% dihitung dari TOTAL tabungan
     * (nilai emas + saldo dana), bukan hanya dari nilai emas.
     *
     * @return array{total: float, penalti: float, refund: float}
     */
    public function hitungRefund(float $nilaiEmas, float $dana): array
    {
        $total = round($nilaiEmas + $dana, 2);

        if ($total <= 0) {
            return ['total' => 0.0, 'penalti' => 0.0, 'refund' => 0.0];
        }

        $penalti = round($total * 0.10, 2);

        return ['total' => $total, 'penalti' => $penalti, 'refund' => round($total - $penalti, 2)];
    }

    /**
     * Konversi setoran emas. Dua jalur:
     * 1. Setoran "rencana" (nominal == nominal_per_periode & ada target gram/priode):
     *    sistem mencoba membeli TARGET GRAM PENUH satu periode pada harga saat ini.
     *    Bila saldo dana saat ini + setoran ini mencukupi → dapat gram penuh target;
     *    sisanya masuk saldo dana (bisa negatif bila ikut memakai saldo dana lama).
     *    Bila belum cukup → SEMUA masuk saldo dana (tanpa gram pecahan).
     * 2. Setoran di luar rencana: dikonversi langsung nominal → gram (fallback).
     *
     * @return array{unit_didapat: string, nominal_emas: float, nominal_selisih: float}
     */
    public function hitungSetoran(float $nominal, ?KonfigurasiSetoranEmas $konfigurasi, float $saldoDana, float $harga): array
    {
        $isRencana = $konfigurasi
            && abs($nominal - (float) $konfigurasi->nominal_per_periode) <= 0.001
            && (float) $konfigurasi->target_gram_per_periode > 0;

        if (! $isRencana) {
            $unit = $harga > 0 ? $nominal / $harga : 0.0;

            return [
                'unit_didapat' => number_format(round($unit, 6), 6, '.', ''),
                'nominal_emas' => round($nominal, 2),
                'nominal_selisih' => 0.0,
            ];
        }

        $gramPeriode = (float) $konfigurasi->target_gram_per_periode;
        $biaya = round($gramPeriode * $harga, 2);

        if ($nominal + $saldoDana >= $biaya) {
            return [
                'unit_didapat' => number_format($gramPeriode, 6, '.', ''),
                'nominal_emas' => $biaya,
                'nominal_selisih' => round($nominal - $biaya, 2),
            ];
        }

        return [
            'unit_didapat' => '0.000000',
            'nominal_emas' => 0.0,
            'nominal_selisih' => round($nominal, 2),
        ];
    }

    /**
     * Tandai konfigurasi aktif yang sudah selesai (deadline terlewati ATAU
     * jumlah setoran rencana terverifikasi mencapai durasi periode).
     */
    public function autoSelesaikan(User $user, JenisTabungan $jenisTabungan): void
    {
        $aktif = KonfigurasiSetoranEmas::query()
            ->aktif()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->get();

        foreach ($aktif as $konfigurasi) {
            $selesai = false;

if ($konfigurasi->tanggal_deadline && now()->endOfDay()->gt(Carbon::parse($konfigurasi->tanggal_deadline)->endOfDay())) {
                $selesai = true;
            } elseif ($konfigurasi->durasi_periode && (int) $konfigurasi->durasi_periode > 0) {
                $periodeTerbayar = $this->jumlahPeriodeTerbayar($user, $konfigurasi);

                if ($periodeTerbayar >= (int) $konfigurasi->durasi_periode) {
                    $selesai = true;
                }
            }

            if ($selesai) {
                $konfigurasi->update(['status' => StatusKonfigurasiSetoran::Selesai]);
            }
        }
    }

    /**
     * Jumlah periode yang terbayar = nominal total setoran rencana terverifikasi
     * dibagi nominal per periode. Satu setoran besar bisa menutup beberapa periode.
     */
    private function jumlahPeriodeTerbayar(User $user, KonfigurasiSetoranEmas $konfigurasi): int
    {
        $nominalPeriode = (float) $konfigurasi->nominal_per_periode;
        if ($nominalPeriode <= 0) {
            return $this->setoranRencana($user, $konfigurasi)->count();
        }

        $nominalTotal = (clone $this->setoranRencana($user, $konfigurasi))
            ->whereBetween('tanggal_transaksi', [
                Carbon::parse($konfigurasi->tanggal_mulai ?: $konfigurasi->created_at)->startOfDay()->toDateString(),
                $konfigurasi->tanggal_deadline ?: now()->toDateString(),
            ])
            ->sum('nominal');

        return (int) floor($nominalTotal / $nominalPeriode);
    }

    /**
     * Progress & konsistensi setoran berkala.
     */
    public function getProgress(User $user, KonfigurasiSetoranEmas $konfigurasi): array
    {
        $frekuensi = $konfigurasi->frekuensi_setor->value;
        $nominalPeriode = (float) $konfigurasi->nominal_per_periode;
        $mulai = Carbon::parse($konfigurasi->tanggal_mulai ?: $konfigurasi->created_at)->startOfDay();

        $seharusnya = $this->jumlahPeriodeTerlewati($frekuensi, $mulai, now());
        if ($konfigurasi->durasi_periode) {
            $seharusnya = min($seharusnya, (int) $konfigurasi->durasi_periode);
        }

        $setorRencana = $this->setoranRencana($user, $konfigurasi)->whereBetween('tanggal_transaksi', [
            $mulai->toDateString(),
            $konfigurasi->tanggal_deadline ?: now()->toDateString(),
        ]);

        $terlaksana = (clone $setorRencana)->count();
        $nominalTotal = (clone $setorRencana)->sum('nominal');

        // Periode yang terbayar dihitung dari nominal (satu setoran bisa menutup banyak periode),
        // bukan dari jumlah transaksi — agar progress & tunggakan mengikuti nominal yang disetor.
        $periodeTerbayar = $nominalPeriode > 0
            ? (int) floor((float) $nominalTotal / $nominalPeriode)
            : $terlaksana;

        // Gram terkumpul RENCANA ini = unit_didapat setoran yang diatribusikan ke rencana ini.
        $gramTerkumpul = (clone $setorRencana)->sum('unit_didapat');

        $persentase = $seharusnya > 0
            ? round(min(100, ($periodeTerbayar / $seharusnya) * 100), 2)
            : 100.0;

        $sisaPeriode = null;
        $estimasiSelesai = null;
        if ($konfigurasi->durasi_periode) {
            $sisaPeriode = max(0, (int) $konfigurasi->durasi_periode - $periodeTerbayar);
            $estimasiSelesai = $konfigurasi->tanggal_deadline?->toDateString();
        }

        $targetGramTotal = $konfigurasi->target_gram_total !== null
            ? round((float) $konfigurasi->target_gram_total, 6)
            : ($konfigurasi->durasi_periode
                ? round((float) $konfigurasi->target_gram_per_periode * (int) $konfigurasi->durasi_periode, 6)
                : null);
        $capaianGram = $targetGramTotal > 0
            ? round(min(100, ($gramTerkumpul / $targetGramTotal) * 100), 2)
            : null;

        return [
            'konfigurasi_id' => $konfigurasi->id,
            'frekuensi_setor' => $frekuensi,
            'frekuensi_label' => $konfigurasi->frekuensi_setor->label(),
            'nominal_per_periode' => round((float) $konfigurasi->nominal_per_periode, 2),
            'durasi_periode' => $konfigurasi->durasi_periode,
            'rekap' => [
                'jumlah_setoran' => $terlaksana,
                'nominal_total_setor' => round((float) $nominalTotal, 2),
                'gram_terkumpul' => round((float) $gramTerkumpul, 6),
                'saldo_dana' => $this->getSaldoDana($user, JenisTabungan::findOrFail($konfigurasi->jenis_tabungan_id)),
                'saldo_dana_rencana' => round((clone $setorRencana)->sum('nominal_selisih'), 2),
            ],
            'konsistensi' => [
                'periode_seharusnya' => $seharusnya,
                'periode_terlaksana' => $periodeTerbayar,
                'persentase' => $persentase,
                'status' => $persentase >= 100 ? 'tepat_waktu' : 'tertinggal',
            ],
            // Tagihan: periode jatuh tempo yang belum dibayar. Per frekuensi: harian=hari,
            // mingguan=minggu, bulanan=bulan. Nominal = jumlah periode tertunggak × nominal/priode.
            'tertunggak' => [
                'jumlah_periode' => max(0, $seharusnya - $periodeTerbayar),
                'nominal' => round(max(0, $seharusnya - $periodeTerbayar) * $nominalPeriode, 2),
            ],
            'sisa_periode' => $sisaPeriode,
            'estimasi_selesai' => $estimasiSelesai,
            'target_gram_total' => $targetGramTotal,
            'capaian_gram' => $capaianGram,
        ];
    }

    /**
     * Riwayat setoran terverifikasi milik SATU rencana (atribusi sama dengan getProgress):
     * nominal terkumpul, gram yang dibeli, dan delta saldo dana dari rencana itu.
     */
    public function getSaldoRencana(User $user, KonfigurasiSetoranEmas $konfigurasi): array
    {
        $mulai = Carbon::parse($konfigurasi->tanggal_mulai ?: $konfigurasi->created_at)->startOfDay();
        $setors = $this->setoranRencana($user, $konfigurasi)->whereBetween('tanggal_transaksi', [
            $mulai->toDateString(),
            $konfigurasi->tanggal_deadline ?: now()->toDateString(),
        ]);

        return [
            'nominal' => round((float) (clone $setors)->sum('nominal'), 2),
            'gram' => round((float) (clone $setors)->sum('unit_didapat'), 6),
            'dana' => round((float) (clone $setors)->sum('nominal_selisih'), 2),
        ];
    }

    public function tambahPeriode(Carbon $tanggal, int $jumlah, string $frekuensi): Carbon
    {
        return match ($frekuensi) {
            'mingguan' => $tanggal->copy()->addWeeks($jumlah),
            'bulanan' => $tanggal->copy()->addMonthsNoOverflow($jumlah),
            default => $tanggal->copy()->addDays($jumlah),
        };
    }

    private function jumlahPeriodeTerlewati(string $frekuensi, Carbon $mulai, Carbon $sampai): int
    {
        $hari = (int) max(0, $mulai->startOfDay()->diffInDays($sampai->startOfDay()));

        return match ($frekuensi) {
            'mingguan' => intdiv($hari, 7) + 1,
            'bulanan' => max(1, $mulai->diffInMonths($sampai->startOfDay()) + 1),
            default => $hari + 1,
        };
    }
}