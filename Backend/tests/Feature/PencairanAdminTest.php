<?php

namespace Tests\Feature;

use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class PencairanAdminTest extends ApiTestCase
{
    private function jenis(string $kode): JenisTabungan
    {
        return JenisTabungan::where('kode', $kode)->firstOrFail();
    }

    private function buatSetor($user, $jenis, $nominal): Transaksi
    {
        return Transaksi::create([
            'nomor_referensi' => 'TRX-PC-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }

    public function test_admin_cairkan_mandiri(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->actingAsAdmin();
        $mandiri = $this->jenis('tabungan-pribadi');
        $this->buatSetor($user, $mandiri, 500000);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $mandiri->id,
        ])->assertStatus(201)->assertJsonPath('data.jenis_transaksi', 'tarik');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => 500000,
            'status_verifikasi' => 'terverifikasi',
        ]);
    }

    public function test_admin_cairkan_mandiri_sebagian(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->actingAsAdmin();
        $mandiri = $this->jenis('tabungan-pribadi');
        $this->buatSetor($user, $mandiri, 500000);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $mandiri->id,
            'nominal' => 200000,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '200000.00');

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $mandiri->id,
            'nominal' => 1000000,
        ])->assertStatus(422)->assertJsonPath('error_code', 'NOMINAL_MELEBIHI_SALDO');
    }

    public function test_admin_cairkan_hari_raya(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->actingAsAdmin();
        $jenis = $this->jenis('tabungan-hari-raya');
        $this->buatSetor($user, $jenis, 400000);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $jenis->id,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '400000.00');
    }

    public function test_admin_cairkan_emas(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $user = $this->createUser();
        $emas = $this->jenis('EMAS');

        // Setor 2 gram terverifikasi (harga 1jt/gram → nominal_emas 2jt sudah lewat skema setor).
        Transaksi::create([
            'nomor_referensi' => 'TRX-PC-EMAS-1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $emas->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 2000000,
            'nominal_emas' => 2000000,
            'nominal_selisih' => 0,
            'unit_didapat' => '2.000000',
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);
        $user->update(['target_emas_gram' => 2]);

        // Batal & refund penuh: nilai 2gr × 1,2jt (harga jual) = 2,4jt dipotong 10% → refund 2,16jt.
        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $emas->id,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '2160000.00');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $emas->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => 2160000,
            'biaya_penalti' => 240000,
            'status_verifikasi' => 'terverifikasi',
        ]);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => null]);
    }

    private function buatKonfigurasi($user, $jenis, array $overrides = []): KonfigurasiSetoranEmas
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

    private function buatSetorEmasRencana($user, $jenis, KonfigurasiSetoranEmas $konfigurasi, string $unit): void
    {
        Transaksi::create([
            'nomor_referensi' => 'TRX-PC-R-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'konfigurasi_id' => $konfigurasi->id,
            'jenis_transaksi' => 'setor',
            'nominal' => (float) $konfigurasi->nominal_per_periode,
            'nominal_emas' => (float) $konfigurasi->nominal_per_periode,
            'nominal_selisih' => 0,
            'unit_didapat' => $unit,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }

    public function test_admin_batal_refund_emas_per_rencana(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $user = $this->createUser();
        $user->update(['target_emas_gram' => 10]);
        $emas = $this->jenis('EMAS');

        $rencanaA = $this->buatKonfigurasi($user, $emas);
        $rencanaB = $this->buatKonfigurasi($user, $emas);
        $this->buatSetorEmasRencana($user, $emas, $rencanaA, '2.000000');
        $this->buatSetorEmasRencana($user, $emas, $rencanaB, '1.000000');

        // Refund rencana A: potongan 10% dari total setoran emas (nominal 15.000 → 1.500),
        // bukan dari nilai pasar 2gr. Nilai emas 2 × 1,2jt = 2,4jt − 1.500 = 2.398.500.
        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $emas->id,
            'konfigurasi_id' => $rencanaA->id,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '2398500.00');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'konfigurasi_id' => $rencanaA->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => 2398500,
            'biaya_penalti' => 1500,
            'status_verifikasi' => 'terverifikasi',
        ]);

        $this->assertDatabaseHas('konfigurasi_setoran_emas', ['id' => $rencanaA->id, 'status' => 'batal']);
        $this->assertDatabaseHas('konfigurasi_setoran_emas', ['id' => $rencanaB->id, 'status' => 'aktif']);

        // Refund ulang rencana yang sama → sudah tidak aktif.
        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $emas->id,
            'konfigurasi_id' => $rencanaA->id,
        ])->assertStatus(422)->assertJsonPath('error_code', 'TIDAK_AKTIF');

        // Goal global tetap (bukan pencairan seluruh saldo).
        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => 10]);
    }

    public function test_admin_cairkan_emas_multi_rencana_wajib_pilih_rencana(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $user = $this->createUser();
        $emas = $this->jenis('EMAS');
        $this->buatKonfigurasi($user, $emas);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $emas->id,
        ])->assertStatus(422)->assertJsonPath('error_code', 'KONFIGURASI_WAJIB_DIPILIH');
    }

    public function test_admin_cairkan_emas_konfigurasi_bukan_milik_user_ditolak(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $user = $this->createUser();
        $lain = $this->createUser();
        $emas = $this->jenis('EMAS');
        $rencanaLain = $this->buatKonfigurasi($lain, $emas);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $emas->id,
            'konfigurasi_id' => $rencanaLain->id,
        ])->assertStatus(404)->assertJsonPath('error_code', 'NOT_FOUND');
    }

    public function test_admin_list_rencana_emas_nasabah(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $user = $this->createUser();
        $emas = $this->jenis('EMAS');
        $rencanaA = $this->buatKonfigurasi($user, $emas);
        $this->buatKonfigurasi($user, $emas);
        $this->buatSetorEmasRencana($user, $emas, $rencanaA, '2.000000');

        $data = $this->getJson("/api/v1/admin/users/{$user->id}/rencana-emas")
            ->assertStatus(200)
            ->json('data');

        $this->assertCount(2, $data);
        $rencana = collect($data)->firstWhere('konfigurasi_id', $rencanaA->id);
        $this->assertSame(2.0, (float) $rencana['gram_terkumpul']);
    }

    public function test_admin_cairkan_berjangka_wajib_tabungan_berjangka_id(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->actingAsAdmin();
        $jenis = $this->jenis('tabungan-berjangka');

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $jenis->id,
        ])->assertStatus(404)->assertJsonPath('error_code', 'NOT_FOUND');
    }

    public function test_admin_cairkan_berjangka(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $admin = $this->actingAsAdmin();
        $jenis = $this->jenis('tabungan-berjangka');

        $tb = TabunganBerjangka::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => 1200000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 200000,
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(6)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        Transaksi::create([
            'nomor_referensi' => 'TRX-PC-BJ-1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'tabungan_berjangka_id' => $tb->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 400000,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/tabungan/{$user->id}/cairkan", [
            'jenis_tabungan_id' => $jenis->id,
            'tabungan_berjangka_id' => $tb->id,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '400000.00');

        $this->assertDatabaseHas('tabungan_berjangka', ['id' => $tb->id, 'status' => 'selesai']);
    }
}