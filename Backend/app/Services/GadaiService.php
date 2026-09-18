<?php

namespace App\Services;

use App\Enums\StatusGadai;
use App\Models\Gadai;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Gadai emas: penilaian/taksiran (berat_bersih × harga_acuan), besaran gadai
 * (nilai_taksiran × persen_gadai, default 80%), tenor (harian/mingguan/bulanan)
 * dan pengecekan jatuh tempo.
 *
 * PENTING: nilai_taksiran ≠ besaran_gadai. Emas ditaksir (mis. Rp10 juta) lalu
 * peserta hanya menerima persentase-nya (mis. 80% = Rp8 juta).
 */
class GadaiService
{
    /**
     * Berat bersih (gram) = berat kotor × kadar/1000 (kadar satuan per-mille, mis. 916).
     */
    public function hitungBeratBersih(float $berat, float $kadar): float
    {
        return round($berat * $kadar / 1000, 4);
    }

    /**
     * Nilai taksiran (Rp) = berat bersih × harga acuan per gram.
     */
    public function hitungNilaiTaksiran(float $beratBersih, float $hargaAcuan): float
    {
        return round($beratBersih * $hargaAcuan, 2);
    }

    /**
     * Besaran gadai (Rp) = nilai taksiran × persen gadai / 100.
     */
    public function hitungBesaran(float $nilaiTaksiran, float $persenGadai): float
    {
        return round($nilaiTaksiran * $persenGadai / 100, 2);
    }

    /**
     * Jatuh tempo = tanggal aktif + SATU periode tenor (harian +1, mingguan +7, bulanan +1 bulan).
     */
    public function hitungJatuhTempo(Carbon $tanggalAktif, string $tenorSatuan): Carbon
    {
        return match ($tenorSatuan) {
            'mingguan' => $tanggalAktif->copy()->addWeeks(1),
            'bulanan' => $tanggalAktif->copy()->addMonthsNoOverflow(1),
            default => $tanggalAktif->copy()->addDays(1),
        };
    }

    /**
     * Simpan gadai baru dan beri nomor berurutan "0001", "0002", dst (padan nomor anggota 10 digit),
     * diturunkan dari urutan id. Hitung + insert dibungkus transaksi dan dikunci (advisory lock
     * MySQL; sqlite diserialkan oleh transaksi itu sendiri) agar dua pengajuan paralel
     * tidak mendapat nomor yang sama.
     * # ponytail: GET_LOCK scoped per koneksi DB — cukup untuk satu app; ganti sequence DB publik bila multi-app.
     */
    public function buatGadai(array $data, int $createdById): Gadai
    {
        // GET_LOCK() hanya ada di MySQL; sqlite diserialkan oleh transaksi itu sendiri.
        $mysql = DB::getDriverName() === 'mysql';

        return DB::transaction(function () use ($data, $createdById, $mysql) {
            if ($mysql && ! DB::selectOne('SELECT GET_LOCK(?, 10) AS ok', ['gadai_nomor_seq'])?->ok) {
                abort(503, 'Gagal membuat nomor gadai, silakan coba lagi.');
            }

            try {
                $max = Gadai::withTrashed()->max('id') ?? 0;

                return Gadai::create($data + [
                    'nomor_gadai' => str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT),
                    'created_by' => $createdById,
                ]);
            } finally {
                if ($mysql) {
                    DB::select('SELECT RELEASE_LOCK(?)', ['gadai_nomor_seq']);
                }
            }
        });
    }

    /**
     * Potongan pembatalan: 10% dari total yang sudah dibayar; emas fisik kembali 100%.
     * Refund = total_dibayar − potongan 10%.
     */
    public function hitungRefundBatal(float $totalDibayar): array
    {
        $potongan = round($totalDibayar * 0.10, 2);
        $refund = round($totalDibayar - $potongan, 2);

        return ['potongan' => $potongan, 'refund' => $refund];
    }

    /**
     * Cek jatuh tempo (dipanggil scheduler harian):
     * - AKTIF / DIPERPANJANG melewati tanggal_jatuh_tempo → JATUH_TEMPO.
     * - JATUH_TEMPO melewati tenggat + toleransi_hari → TERLAMBAT.
     * Batas "lewat" = esok hari dari tanggal jatuh tempo (hari-H masih TEPAT WAKTU).
     */
    public function cekJatuhTempo(): int
    {
        $hariIni = now()->startOfDay();
        $berubah = 0;

        Gadai::query()
            ->whereIn('status', [
                StatusGadai::Aktif->value,
                StatusGadai::JatuhTempo->value,
                StatusGadai::Diperpanjang->value,
            ])
            ->whereNotNull('tanggal_jatuh_tempo')
            ->lazyById()
            ->each(function (Gadai $gadai) use ($hariIni, &$berubah) {
                $jatuhTempo = Carbon::parse($gadai->tanggal_jatuh_tempo)->startOfDay();

                if ($gadai->status === StatusGadai::JatuhTempo) {
                    $tenggatTerlambat = $jatuhTempo->copy()->addDays((int) $gadai->toleransi_hari);
                    if ($hariIni->gt($tenggatTerlambat)) {
                        $gadai->update(['status' => StatusGadai::Terlambat]);
                        $berubah++;
                    }
                } elseif ($hariIni->gt($jatuhTempo)) {
                    $gadai->update(['status' => StatusGadai::JatuhTempo]);
                    $berubah++;
                }
            });

        return $berubah;
    }
}