<?php

namespace Tests\Feature;

use App\Enums\AturanPencairan;
use App\Enums\ModePerhitungan;
use App\Enums\TipeTabungan;
use App\Models\JenisTabungan;
use Tests\ApiTestCase;

class JenisTabunganTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'kode' => 'tabungan-tambahan',
            'nama' => 'Tabungan Tambahan',
            'tipe' => TipeTabungan::Pribadi->value,
            'mode_perhitungan' => ModePerhitungan::NominalBebas->value,
            'aturan_pencairan' => AturanPencairan::ManualAdmin->value,
            'metode_pembayaran_diizinkan' => ['cash', 'transfer'],
            'allow_withdrawal' => true,
            'status_aktif' => true,
        ], $overrides);
    }

    private function makeExtra(string $kode, string $nama): JenisTabungan
    {
        return JenisTabungan::create(array_merge($this->payload(['kode' => $kode, 'nama' => $nama]), [
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]));
    }

    public function test_tipe_built_in_duplikat_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        // emas & qurban = satu produk per tipe.
        foreach (['emas', 'qurban'] as $tipe) {
            $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => "{$tipe}-2", 'tipe' => $tipe, 'nama' => ucfirst($tipe) . ' Kedua']))
                ->assertStatus(422)->assertJsonPath('error_code', 'SINGLE_INSTANCE_TYPE');
        }

        // pribadi tanpa sub-jenis ditolak; semua sub-jenis pribadi sudah ada.
        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'pribadi-2']))
            ->assertStatus(422)->assertJsonPath('error_code', 'SUB_JENIS_REQUIRED');

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'mandiri-2', 'sub_jenis' => 'mandiri']))
            ->assertStatus(422)->assertJsonPath('error_code', 'SINGLE_INSTANCE_TYPE');

        $this->assertEquals(5, JenisTabungan::count());
    }

    public function test_kode_duplikat_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->assertNotNull(JenisTabungan::where('kode', 'EMAS')->first());

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'EMAS']))
            ->assertStatus(422);
    }

    public function test_admin_bisa_update(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $this->putJson("/api/v1/admin/jenis-tabungan/{$jenis->id}", ['nama' => 'Tabungan Pribadi Plus'])
            ->assertOk()->assertJsonPath('data.nama', 'Tabungan Pribadi Plus');
    }

    public function test_admin_bisa_toggle_status(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $this->patchJson("/api/v1/admin/jenis-tabungan/{$jenis->id}/toggle-status")
            ->assertOk()->assertJsonPath('data.status_aktif', false);
    }

    public function test_hapus_jenis_dengan_transaksi_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = $this->makeExtra('jenis-trx', 'Tabungan Trx');

        \App\Models\Transaksi::create([
            'nomor_referensi' => 'TRX-TEST-0001',
            'user_id' => $this->createUser(['email' => 'trx@example.com', 'phone' => '081277766655'])->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 50000,
            'metode_pembayaran' => 'cash',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->deleteJson("/api/v1/admin/jenis-tabungan/{$jenis->id}")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_hapus_jenis_tanpa_transaksi_berhasil(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $jenis = $this->makeExtra('jenis-nontrx', 'Tabungan Tanpa Transaksi');

        $this->deleteJson("/api/v1/admin/jenis-tabungan/{$jenis->id}")->assertOk();
        $this->assertDatabaseMissing('jenis_tabungan', ['id' => $jenis->id]);
    }

    public function test_hapus_tabungan_bawaan_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        foreach (['EMAS', 'tabungan-pribadi', 'tabungan-qurban', 'tabungan-hari-raya', 'tabungan-berjangka'] as $kode) {
            $jenis = JenisTabungan::where('kode', $kode)->first();
            $this->deleteJson("/api/v1/admin/jenis-tabungan/{$jenis->id}")
                ->assertStatus(422)->assertJsonPath('error_code', 'DEFAULT_LOCKED');
        }
    }

    public function test_maximal_6_jenis_tabungan_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        // Seeder sudah membuat 5 produk (emas, mandiri, hari_raya, berjangka, qurban).
        $this->assertEquals(5, JenisTabungan::count());

        $this->makeExtra('tambahan-1', 'Tambahan 1');

        $this->assertEquals(6, JenisTabungan::count());

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'kelebihan']))
            ->assertStatus(422)->assertJsonPath('error_code', 'MAX_SAVING_ACCOUNT');

        $this->assertEquals(6, JenisTabungan::count());
    }

    public function test_update_sub_jenis_ke_sub_yang_sudah_ada_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $hariRaya = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $this->putJson("/api/v1/admin/jenis-tabungan/{$hariRaya->id}", ['sub_jenis' => 'mandiri'])
            ->assertStatus(422)->assertJsonPath('error_code', 'SINGLE_INSTANCE_TYPE');
    }

    public function test_user_hanya_melihat_jenis_aktif(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        $jenis = JenisTabungan::create(array_merge($this->payload(['kode' => 'nonaktif', 'nama' => 'Nonaktif']), [
            'created_by' => $user->id,
            'updated_by' => $user->id,
            'status_aktif' => false,
        ]));

        $response = $this->getJson('/api/v1/jenis-tabungan')->assertOk();

        $this->assertFalse(collect($response->json('data'))->pluck('kode')->contains('nonaktif'));
    }

    public function test_user_bisa_lihat_detail_jenis(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $this->getJson("/api/v1/jenis-tabungan/{$jenis->id}")
            ->assertOk()->assertJsonPath('data.kode', 'tabungan-pribadi');
    }
}