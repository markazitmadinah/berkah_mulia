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
            'kode' => 'tabungan-custom',
            'nama' => 'Tabungan Custom',
            'tipe' => TipeTabungan::Custom->value,
            'mode_perhitungan' => ModePerhitungan::NominalBebas->value,
            'aturan_pencairan' => AturanPencairan::ManualAdmin->value,
            'metode_pembayaran_diizinkan' => ['cash', 'transfer'],
            'allow_withdrawal' => true,
            'status_aktif' => true,
        ], $overrides);
    }

    public function test_admin_bisa_membuat_jenis_tabungan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.kode', 'tabungan-custom')
            ->assertJsonPath('data.status_aktif', true);

        $this->assertDatabaseHas('jenis_tabungan', ['kode' => 'tabungan-custom']);
    }

    public function test_kode_duplikat_ditolak(): void
    {        $this->seedBase();
        $this->actingAsAdmin();
        $this->assertNotNull(JenisTabungan::where('kode', 'emas-harian')->first());

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'emas-harian']))
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
        $jenis = JenisTabungan::create(array_merge($this->payload(['kode' => 'jenis-trx', 'nama' => 'Tabungan Trx']), [
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]));

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
        $jenis = JenisTabungan::create(array_merge($this->payload(), ['created_by' => auth()->id(), 'updated_by' => auth()->id()]));

        $this->deleteJson("/api/v1/admin/jenis-tabungan/{$jenis->id}")->assertOk();
        $this->assertDatabaseMissing('jenis_tabungan', ['id' => $jenis->id]);
    }

    public function test_hapus_tabungan_bawaan_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        foreach (['emas-harian', 'tabungan-pribadi', 'tabungan-qurban'] as $kode) {
            $jenis = JenisTabungan::where('kode', $kode)->first();
            $this->deleteJson("/api/v1/admin/jenis-tabungan/{$jenis->id}")
                ->assertStatus(422)->assertJsonPath('error_code', 'DEFAULT_LOCKED');
        }
    }

    public function test_maximal_6_jenis_tabungan_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        for ($i = 1; $i <= 3; $i++) {
            $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => "tambahan-{$i}", 'nama' => "Tambahan {$i}"]))
                ->assertStatus(201);
        }

        $this->assertEquals(6, JenisTabungan::count());

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'kelebihan']))
            ->assertStatus(422)->assertJsonPath('error_code', 'MAX_SAVING_ACCOUNT');

        $this->assertEquals(6, JenisTabungan::count());
    }

    public function test_duplikat_tipe_bawaan_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'pribadi-2', 'tipe' => TipeTabungan::Pribadi->value, 'nama' => 'Pribadi Kedua']))
            ->assertStatus(422)->assertJsonPath('error_code', 'SINGLE_INSTANCE_TYPE');

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload(['kode' => 'emas-2', 'tipe' => TipeTabungan::Emas->value, 'nama' => 'Emas Kedua']))
            ->assertStatus(422)->assertJsonPath('error_code', 'SINGLE_INSTANCE_TYPE');

        $this->assertEquals(3, JenisTabungan::count());
    }

    public function test_tipe_bawaan_boleh_custom_dan_update_tercegah(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/jenis-tabungan', $this->payload())
            ->assertStatus(201);

        $pribadi = JenisTabungan::where('kode', 'tabungan-pribadi')->firstOrFail();
        $this->putJson("/api/v1/admin/jenis-tabungan/{$pribadi->id}", ['tipe' => TipeTabungan::Pribadi->value])
            ->assertOk();

        $custom = JenisTabungan::where('kode', 'tabungan-custom')->firstOrFail();
        $this->putJson("/api/v1/admin/jenis-tabungan/{$custom->id}", ['tipe' => TipeTabungan::Pribadi->value])
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
