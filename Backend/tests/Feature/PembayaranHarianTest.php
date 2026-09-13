<?php

namespace Tests\Feature;

use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class PembayaranHarianTest extends ApiTestCase
{
    private function buatKonfigurasi(\App\Models\User $user, JenisTabungan $jenis, array $overrides = []): KonfigurasiSetoranEmas
    {
        return KonfigurasiSetoranEmas::create(array_merge([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'tanggal_mulai' => now()->toDateString(),
            'durasi_periode' => 30,
            'tanggal_deadline' => now()->addDays(29)->toDateString(),
            'status' => 'aktif',
            'created_by' => $user->id,
        ], $overrides));
    }

    public function test_menampilkan_jadwal_dan_status_bayar_hari_ini(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $jenis = JenisTabungan::where('tipe', 'emas')->first();

        $userBayar = $this->createUser(['nomor_anggota' => 'BM-001']);
        $userBelum = $this->createUser(['nomor_anggota' => 'BM-002']);
        $this->buatKonfigurasi($userBayar, $jenis);
        $this->buatKonfigurasi($userBelum, $jenis);

        // Nasabah A sudah bayar hari ini (cash, terverifikasi).
        Transaksi::create([
            'nomor_referensi' => 'TRX-HARI-INI',
            'user_id' => $userBayar->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $response = $this->getJson('/api/v1/admin/pembayaran-harian');

        $response->assertOk()
            ->assertJsonCount(2, 'data.jadwal')
            ->assertJsonPath('data.jadwal.0.nama', $userBayar->name)
            ->assertJsonPath('data.jadwal.0.status_verifikasi', 'terverifikasi')
            ->assertJsonPath('data.jadwal.0.nomor_referensi', 'TRX-HARI-INI')
            ->assertJsonPath('data.jadwal.1.nama', $userBelum->name)
            ->assertJsonPath('data.jadwal.1.status_verifikasi', 'belum');
    }

    public function test_hanya_jadwal_yang_jatuh_di_tanggal_dipilih(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('tipe', 'emas')->first();

        $harian = $this->createUser(['nomor_anggota' => 'BM-011']);
        $this->buatKonfigurasi($harian, $jenis);

        $belumHari = $this->createUser(['nomor_anggota' => 'BM-012']);
        $this->buatKonfigurasi($belumHari, $jenis, ['frekuensi_setor' => 'mingguan']);

        // Tanggal 3 hari lagi → bukan jadwal mingguan (mulai hari ini, selisih 3 hari).
        $tanggal = now()->addDays(3)->toDateString();

        $response = $this->getJson('/api/v1/admin/pembayaran-harian?tanggal=' . $tanggal);

        $response->assertOk()
            ->assertJsonPath('data.tanggal', $tanggal)
            ->assertJsonCount(1, 'data.jadwal')
            ->assertJsonPath('data.jadwal.0.nama', $harian->name);
    }

    public function test_mingguan_dan_bulanan_muncul_pada_hari_jatuh_temponya(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('tipe', 'emas')->first();

        $mingguan = $this->createUser(['nomor_anggota' => 'BM-031']);
        $bulanan = $this->createUser(['nomor_anggota' => 'BM-032']);
        $this->buatKonfigurasi($mingguan, $jenis, ['frekuensi_setor' => 'mingguan']);
        $this->buatKonfigurasi($bulanan, $jenis, [
            'frekuensi_setor' => 'bulanan',
            'tanggal_mulai' => '2026-01-15',
            'tanggal_deadline' => '2026-06-15',
        ]);

        // Week ke-2 (selisih 7 hari) → mingguan jatuh tempo.
        $tanggalMingguan = now()->addDays(7);
        $hari = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];
        $this->getJson('/api/v1/admin/pembayaran-harian?tanggal=' . $tanggalMingguan->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data.jadwal')
            ->assertJsonPath('data.jadwal.0.nama', $mingguan->name)
            ->assertJsonPath('data.jadwal.0.frekuensi', 'mingguan')
            ->assertJsonPath('data.jadwal.0.jadwal_label', 'Setiap ' . $hari[$tanggalMingguan->dayOfWeekIso]);

        // Bulan dengan tanggal yang sama → bulanan jatuh tempo.
        $this->getJson('/api/v1/admin/pembayaran-harian?tanggal=2026-02-15')
            ->assertOk()
            ->assertJsonCount(1, 'data.jadwal')
            ->assertJsonPath('data.jadwal.0.nama', $bulanan->name)
            ->assertJsonPath('data.jadwal.0.frekuensi', 'bulanan')
            ->assertJsonPath('data.jadwal.0.jadwal_label', 'Setiap tanggal 15');
    }

    public function test_status_menunggu_untuk_setoran_belum_diverifikasi(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('tipe', 'emas')->first();

        $user = $this->createUser(['nomor_anggota' => 'BM-021']);
        $this->buatKonfigurasi($user, $jenis);

        Transaksi::create([
            'nomor_referensi' => 'TRX-PENDING',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'menunggu_verifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->getJson('/api/v1/admin/pembayaran-harian')
            ->assertOk()
            ->assertJsonCount(1, 'data.jadwal')
            ->assertJsonPath('data.jadwal.0.status_verifikasi', 'menunggu_verifikasi')
            ->assertJsonPath('data.jadwal.0.nomor_referensi', 'TRX-PENDING');
    }

    public function test_menampilkan_user_dengan_tagihan_terlewat(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('tipe', 'emas')->first();

        // Mulai 3 hari lalu tanpa setoran → tagihan 4 hari (harian: hari+1 = 4 periode).
        $userTelat = $this->createUser(['nomor_anggota' => 'BM-041']);
        $this->buatKonfigurasi($userTelat, $jenis, [
            'tanggal_mulai' => now()->subDays(3)->toDateString(),
        ]);

        // User tertib: mulai hari ini + sudah setor terverifikasi hari ini → tanpa tagihan.
        $userTertib = $this->createUser(['nomor_anggota' => 'BM-042']);
        $this->buatKonfigurasi($userTertib, $jenis);
        Transaksi::create([
            'nomor_referensi' => 'TRX-TERTIB',
            'user_id' => $userTertib->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->getJson('/api/v1/admin/pembayaran-harian/tunggakan')
            ->assertOk()
            ->assertJsonPath('data.total_user', 1)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.nama', $userTelat->name)
            ->assertJsonPath('data.items.0.frekuensi', 'harian')
            ->assertJsonPath('data.items.0.jumlah_periode_tertunggak', 4)
            ->assertJsonPath('data.items.0.nominal_tagihan', 60000);
    }
}