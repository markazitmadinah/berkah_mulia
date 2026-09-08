<?php

namespace Tests\Feature;

use App\Enums\StatusVerifikasi;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
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

        $tabEmas = collect($response->json('data.produk.tabungan'))->firstWhere('progress.kode', 'emas-harian');
        $this->assertNotNull($tabEmas['konfigurasi']);
        $this->assertEquals(3000.0, $tabEmas['progress']['saldo_dana']);
        $this->assertEquals(0.012, $tabEmas['progress']['total_unit']);
        $this->assertNotEmpty($tabEmas['setoran_berkala']);

        $tabPribadi = collect($response->json('data.produk.tabungan'))->firstWhere('progress.kode', 'tabungan-pribadi');
        $this->assertEquals(100000, $tabPribadi['progress']['pending_amount']);
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
}