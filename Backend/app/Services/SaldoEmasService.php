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
     * Target emas global (target_emas_gram) hanya relevan selama masih ada rencana
     * aktif yang membelinya. Saat rencana TERAKHIR dibatalkan, bersihkan target agar
     * progress tidak menggantung di goal yang tak akan pernah tercapai lagi.
     */
    public function bersihkanGoalKalaRencanaHabis(User $user, int $jenisId): void
    {
        $adaRencana = KonfigurasiSetoranEmas::query()
            ->aktif()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisId)
            ->exists();

        if (! $adaRencana) {
            $user->update(['target_emas_gram' => null]);
        }
    }

    /**
     * Rencana yang sudah tuntas (goal tercapai → emas dicair/ditarik penuh) resmi
     * ditutup 'selesai' agar admin bisa membuatkan rencana baru. Karena semua rencana
     * selesai, goal global ikut dibersihkan (progress bar reset di tab user & admin).
     */
    public function tutupRencanaSetelahCairPenuh(User $user, int $jenisId): void
    {
        KonfigurasiSetoranEmas::query()
            ->aktif()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisId)
            ->update(['status' => StatusKonfigurasiSetoran::Selesai]);

        $this->bersihkanGoalKalaRencanaHabis($user, $jenisId);
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

        // Setoran legacy (konfigurasi_id NULL) & saldo awal import tanpa tanda rencana
        // hanya diatribusikan ke rencana TERTUA milik user+jenis. Sebelum multi-rencana
        // hanya ada satu rencana, jadi setoran tanpa tanda tak boleh dihitung ulang di
        // semua rencana (double-count gram/refund/progress).
        $rencanaTertua = KonfigurasiSetoranEmas::query()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $k->jenis_tabungan_id)
            ->orderBy('id')
            ->first();
        $countLegacy = $rencanaTertua !== null && $rencanaTertua->id === $k->id;

        return Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $k->jenis_tabungan_id)
            ->where('jenis_transaksi', 'setor')
            ->terverifikasi()
            ->where(function (Builder $q) use ($k, $countLegacy) {
                // Baris bertanda konfigurasi_id dihitung apa pun nominalnya.
                $q->where('konfigurasi_id', $k->id);
                if ($countLegacy) {
                    // Data lama (tanpa tanda) hanya di rencana tertua; saldo awal import
                    // (MARKER) dihitung apa pun nominalnya, sisanya harus match nominal
                    // per periode (satu-satunya penanda atribusi sebelum multi-rencana).
                    $q->orWhere(function (Builder $q2) use ($k) {
                        $q2->whereNull('konfigurasi_id')
                            ->where(function (Builder $q3) use ($k) {
                                $q3->where('catatan_admin', 'like', '%'.SaldoAwalService::MARKER.'%')
                                    ->orWhere('nominal', (float) $k->nominal_per_periode);
                            });
                    });
                }
            })
            // Semua setoran (termasuk yang bertanda konfigurasi_id) dibatasi pada
            // jendela rencana — setoran setelah deadline tidak dihitung progress/refund.
            // Pengecualian: saldo awal import selalu dihitung (mewakili setoran sebelum
            // rencana), termasuk saat tanggal_mulai masih di masa depan.
            // whereDate (bukan whereBetween string tanggal) agar benar di MySQL (kolom DATE)
            // maupun SQLite (TEXT 'Y-m-d 00:00:00').
            ->where(function (Builder $q) use ($k, $mulai) {
                $q->where('catatan_admin', 'like', '%'.SaldoAwalService::MARKER.'%')
                    ->orWhere(function (Builder $q2) use ($k, $mulai) {
                        $q2->whereDate('tanggal_transaksi', '>=', $mulai->toDateString())
                            ->whereDate('tanggal_transaksi', '<=', $k->tanggal_deadline ?: now()->toDateString());
                    });
            });
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
     * Rincian refund BATAL & REFUND per rencana (user & admin):
     * - total_setoran_emas = SUM nominal setoran rencana terverifikasi yang berhasil
     *   dikonversi menjadi gram (unit_didapat > 0) — SATU-SATUNYA dasar potongan.
     * - potongan 10% hanya dari total_setoran_emas (rupiah yang disetor jadi gram),
     *   TIDAK dari nilai pasar gram (gram × harga jual) dan tidak menyentuh saldo dana.
     * - saldo dana rencana dikembalikan 100% (uang, bukan emas — bebas potongan).
     *
     * @return array{gram: float, total_setoran_emas: float, nilai_emas: float, potongan: float, refund_emas: float, saldo_dana_rencana: float, refund_total: float}
     */
    public function rincianRefund(User $user, KonfigurasiSetoranEmas $konfigurasi, float $hargaJualPerGram): array
    {
        $setors = $this->setoranRencana($user, $konfigurasi);

        $gram = round((float) (clone $setors)->sum('unit_didapat'), 6);
        $saldoDana = round((float) (clone $setors)->sum('nominal_selisih'), 2);
        $totalSetoranEmas = round((float) (clone $setors)
            ->where('unit_didapat', '>', 0)
            ->sum('nominal'), 2);

        $nilaiEmas = round($gram * $hargaJualPerGram, 2);
        $potongan = round($totalSetoranEmas * 0.10, 2);
        $refundEmas = round($nilaiEmas - $potongan, 2);

        return [
            'gram' => $gram,
            'total_setoran_emas' => $totalSetoranEmas,
            'nilai_emas' => $nilaiEmas,
            'potongan' => $potongan,
            'refund_emas' => $refundEmas,
            'saldo_dana_rencana' => $saldoDana,
            'refund_total' => round($refundEmas + $saldoDana, 2),
        ];
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

        $setorRencana = $this->setoranRencana($user, $konfigurasi);

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
                'total_setoran_emas' => round((float) (clone $setorRencana)->where('unit_didapat', '>', 0)->sum('nominal'), 2),
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
        $setors = $this->setoranRencana($user, $konfigurasi);

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
        $mulaiHari = $mulai->copy()->startOfDay();
        $sampaiHari = $sampai->copy()->startOfDay();

        // Rencana belum dimulai → belum ada periode jatuh tempo (jangan tampil tertunggak).
        if ($sampaiHari->lt($mulaiHari)) {
            return 0;
        }

        $hari = (int) max(0, $mulaiHari->diffInDays($sampaiHari));

        return match ($frekuensi) {
            'mingguan' => intdiv($hari, 7) + 1,
            'bulanan' => max(1, $mulaiHari->diffInMonths($sampaiHari) + 1),
            default => $hari + 1,
        };
    }
}