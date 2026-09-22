<?php

namespace App\Services;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Models\Transaksi;
use App\Models\User;

/**
 * "Nominal terkumpul" / saldo awal tabungan nasabah.
 * Set/atur ulang secara idempoten lewat SATU transaksi setor terverifikasi bertanda:
 * - belum ada catatan → buat transaksi setor terverifikasi.
 * - nilainya berubah → perbarui nominal (import ulang / input ulang admin).
 * - nominal 0 → hapus catatan saldo awal.
 * Dipakai import nasabah (UsersImport).
 */
class SaldoAwalService
{
    /**
     * Penanda pada catatan_admin transaksi setor saldo awal.
     */
    public const MARKER = 'SALDO_AWAL_IMPORT';

    public function posisi(User $user, int $jenisId): ?Transaksi
    {
        return Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenisId)
            ->where('jenis_transaksi', JenisTransaksi::Setor->value)
            ->where('status_verifikasi', StatusVerifikasi::Terverifikasi->value)
            ->where('catatan_admin', 'like', '%'.self::MARKER.'%')
            ->latest('id')
            ->first();
    }

    /**
     * @param  string|null  $penandaTerlarang  bila diisi, saldo > 0 ditolak ('denied') jika
     *                                         sudah ada histori bertanda ini (mis. laporan harian).
     * @param  array  $ekstra  bidang tambahan (tabungan emas: unit_didapat, nominal_emas,
     *                         nominal_selisih, harga_acuan_id, harga_acuan_snapshot) yang
     *                         disimpan bersama transaksi & ikut diperbarui saat update.
     *
     * @return 'created'|'updated'|'deleted'|'none'|'denied'
     */
    public function atur(User $user, int $jenisId, int $saldo, ?string $penandaTerlarang = null, array $ekstra = []): string
    {
        if ($saldo > 0 && $penandaTerlarang !== null) {
            $memilikiHistori = Transaksi::milikUser($user->id)
                ->where('jenis_tabungan_id', $jenisId)
                ->where('catatan_admin', 'like', '%'.$penandaTerlarang.'%')
                ->exists();

            if ($memilikiHistori) {
                return 'denied';
            }
        }

        $existing = $this->posisi($user, $jenisId);

        if ($existing) {
            if ($saldo === 0) {
                $existing->delete();

                return 'deleted';
            }
            if ((float) $existing->nominal !== (float) $saldo) {
                $existing->update(array_merge(['nominal' => $saldo], $ekstra));

                return 'updated';
            }

            // Nominal sama tapi relasi (konfigurasi_id / tabungan_berjangka_id /
            // pendaftaran_qurban_id) bisa belum tertaut dari saldo awal imports lama
            // dijalankan sebelum atribusi ke rencana ada — import ulang tetap
            // menyambungkannya agar rekap rencana (gram, konsistensi) ikut terisi.
            if ($ekstra) {
                $existing->update($ekstra);
            }

            return 'none';
        }

        if ($saldo === 0) {
            return 'none';
        }

        Transaksi::create(array_merge([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenisId,
            'jenis_transaksi' => JenisTransaksi::Setor->value,
            'nominal' => $saldo,
            'metode_pembayaran' => MetodePembayaran::Cash->value,
            'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
            'diverifikasi_oleh' => auth()->id(),
            'diverifikasi_pada' => now(),
            'catatan_admin' => 'Saldo awal dari import / input admin ('.self::MARKER.').',
            'catatan_user' => 'Saldo awal tabungan dari data nasabah.',
            'tanggal_transaksi' => now()->toDateString(),
        ], $ekstra));

        return 'created';
    }
}