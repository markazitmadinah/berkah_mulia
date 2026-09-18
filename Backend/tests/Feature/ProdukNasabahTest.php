<?php

namespace Tests\Feature;

use App\Enums\StatusVerifikasi;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\UserTabunganTarget;
use Tests\ApiTestCase;

class ProdukNasabahTest extends ApiTestCase
{
    public function test_admin_melihat_produk_nasabah(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $user->update(['target_emas_gram' => 10]);

        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $admin->id]);

        $emas = JenisTabungan::where('tipe', 'emas')->first();
        $pribadi = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $konfigurasi = KonfigurasiSetoranEmas::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $emas->id,
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'tanggal_mulai' => now()->toDateString(),
            'durasi_periode' => 30,
            'tanggal_deadline' => now()->addDays(29)->toDateString(),
            'status' => 'aktif',
            'created_by' => $admin->id,
        ]);

        Transaksi::create([
            'user_id' => $user->id,
            'nomor_referensi' => 'TRX-' . strtoupper(uniqid()),
            'jenis_tabungan_id' => $emas->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        Transaksi::create([
            'user_id' => $user->id,
            'nomor_referensi' => 'TRX-' . strtoupper(uniqid()),
            'jenis_tabungan_id' => $pribadi->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 100000,
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
            'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $response = $this->getJson('/api/v1/admin/users/' . $user->id . '/produk');

        $response->assertStatus(200)
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.summary.total_tabungan_aktif', 2)
            ->assertJsonCount(2, 'data.produk.tabungan')
            ->assertJsonCount(2, 'data.transaksi');

        $tabEmas = collect($response->json('data.produk.tabungan'))->firstWhere('progress.kode', 'EMAS');
        $this->assertNotNull($tabEmas['konfigurasi']);
        $this->assertEquals(3000.0, $tabEmas['progress']['saldo_dana']);
        $this->assertEquals(0.012, $tabEmas['progress']['total_unit']);
        $this->assertNotEmpty($tabEmas['setoran_berkala']);

        $tabPribadi = collect($response->json('data.produk.tabungan'))->firstWhere('progress.kode', 'tabungan-pribadi');
        $this->assertEquals(100000, $tabPribadi['progress']['pending_amount']);
    }

    public function test_produk_memuat_frekuensi_berjangka_dan_target_emas(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $user->update(['target_emas_gram' => 5]);

        $jenisHariRaya = JenisTabungan::where('sub_jenis', 'hari_raya')->first();
        UserTabunganTarget::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenisHariRaya->id,
            'target_nominal' => 1200000,
            'frekuensi_setor' => 'mingguan',
            'nominal_per_periode' => 100000,
        ]);

        Transaksi::create([
            'user_id' => $user->id,
            'nomor_referensi' => 'TRX-' . strtoupper(uniqid()),
            'jenis_tabungan_id' => $jenisHariRaya->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 300000,
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $berjangkaJenis = JenisTabungan::where('sub_jenis', 'berjangka')->first();
        TabunganBerjangka::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $berjangkaJenis->id,
            'target_nominal' => 1200000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 200000,
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(6)->toDateString(),
            'status' => 'menunggu_approval',
            'approved_by' => $admin->id,
        ]);

        $res = $this->getJson('/api/v1/admin/users/' . $user->id . '/produk')
            ->assertOk();

        $tabEmas = collect($res->json('data.produk.tabungan'))->firstWhere('progress.kode', 'EMAS');
        $this->assertEquals(5.0, $tabEmas['progress']['target_emas_gram']);

        $tabHariRaya = collect($res->json('data.produk.tabungan'))->firstWhere('progress.sub_jenis', 'hari_raya');
        $this->assertNotNull($tabHariRaya['progress']['frekuensi']);
        $this->assertEquals('mingguan', $tabHariRaya['progress']['frekuensi']['frekuensi_setor']);
        $this->assertEquals(100000.0, $tabHariRaya['progress']['frekuensi']['nominal_per_periode']);
        $this->assertEquals(9, $tabHariRaya['progress']['frekuensi']['sisa_pembayaran']);

        $berjangka = $res->json('data.produk.berjangka');
        $this->assertCount(1, $berjangka);
        $this->assertEquals('menunggu_approval', $berjangka[0]['status']);
        $this->assertArrayHasKey('tertunggak', $berjangka[0]);
    }

    public function test_user_role_tidak_bisa_melihat_produk(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $nasabah = $this->createUser();

        $this->getJson('/api/v1/admin/users/' . $nasabah->id . '/produk')
            ->assertStatus(403);
    }

    public function test_produk_user_tanpa_aktivitas_kosong(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $nasabah = $this->createUser();

        $this->getJson('/api/v1/admin/users/' . $nasabah->id . '/produk')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data.produk.tabungan')
            ->assertJsonCount(0, 'data.transaksi')
            ->assertJsonPath('data.summary.total_saldo_tabungan', 0);
    }

    public function test_admin_monitoring_memuat_progress_semua_nasabah(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $user->update(['target_emas_gram' => 10]);

        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $admin->id]);

        $emas = JenisTabungan::where('tipe', 'emas')->first();
        $berjangkaJenis = JenisTabungan::where('sub_jenis', 'berjangka')->first();

        Transaksi::create([
            'user_id' => $user->id,
            'nomor_referensi' => 'TRX-' . strtoupper(uniqid()),
            'jenis_tabungan_id' => $emas->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        \App\Models\TabunganBerjangka::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $berjangkaJenis->id,
            'target_nominal' => 600000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 100000,
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(6)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_by' => $admin->id,
        ]);

        $res = $this->getJson('/api/v1/admin/monitoring-tabungan')
            ->assertOk();

        $row = collect($res->json('data'))->firstWhere('user.id', $user->id);
        $this->assertNotNull($row);

        $tabEmas = collect($row['tabungan'])->firstWhere('tipe', 'emas');
        $this->assertEquals(15000, $tabEmas['saldo']);
        $this->assertEquals(0.012, $tabEmas['total_unit']);

        $tabBerjangka = collect($row['tabungan'])->firstWhere('sub_jenis', 'berjangka');
        $this->assertNotEmpty($tabBerjangka['berjangka']);
        $this->assertSame(1, count($tabBerjangka['berjangka']));

        // Cari berdasarkan nama nasabah
        $this->getJson('/api/v1/admin/monitoring-tabungan?search=' . urlencode(mb_substr($user->name, 0, 3)))
            ->assertOk()
            ->assertJsonPath('data.0.user.id', $user->id);
    }

    public function test_user_role_tidak_bisa_monitoring(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->getJson('/api/v1/admin/monitoring-tabungan')->assertStatus(403);
    }
}