<?php

namespace Tests\Feature;

use App\Enums\SubJenisTabungan;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class TabunganHariRayaTest extends ApiTestCase
{
    private function jenisHariRaya(): JenisTabungan
    {
        return JenisTabungan::where('tipe', 'pribadi')
            ->where('sub_jenis', SubJenisTabungan::HariRaya->value)
            ->first();
    }

    private function buatSetor($user, $jenis, $nominal = 100000): Transaksi
    {
        return Transaksi::create([
            'nomor_referensi' => 'TRX-HR-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }

    public function test_status_awal_target_nol(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        $this->getJson('/api/v1/tabungan-hari-raya/status')
            ->assertOk()
            ->assertJsonPath('data.target', 0)
            ->assertJsonPath('data.terkumpul', 0)
            ->assertJsonPath('data.masa_pencairan', false);
    }

    public function test_user_set_target_dan_progress_tercermin(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->jenisHariRaya();
        $this->buatSetor($user, $jenis, 400000);
        $jenis->update(['deadline' => now()->addMonths(2)->toDateString()]);

        $this->putJson('/api/v1/tabungan-hari-raya/target', ['target_nominal' => 1000000])
            ->assertOk()
            ->assertJsonPath('data.target', 1000000)
            ->assertJsonPath('data.terkumpul', 400000)
            ->assertJsonPath('data.persentase', 40)
            ->assertJsonPath('data.masa_pencairan', false);

        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => 1000000,
        ]);
    }

    public function test_cairkan_ditolak_sebelum_satu_minggu_sebelum_hari_raya(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->jenisHariRaya();
        $this->buatSetor($user, $jenis, 500000);
        $jenis->update(['deadline' => now()->addDays(20)->toDateString()]);

        $this->postJson('/api/v1/tabungan-hari-raya/cairkan')
            ->assertStatus(423)
            ->assertJsonPath('error_code', 'LUNA_TUTUP');
    }

    public function test_cairkan_berhasil_saat_masa_pencairan_dan_setor_ditutup(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->jenisHariRaya();
        $this->buatSetor($user, $jenis, 500000);
        $jenis->update(['deadline' => now()->addDays(5)->toDateString()]);

        $this->postJson('/api/v1/tabungan-hari-raya/cairkan')
            ->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'tarik')
            ->assertJsonPath('data.nominal', '500000.00');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => 500000,
        ]);

        $this->postSetor('/api/v1/tabungan-pribadi/setor', [
            'nominal' => 100000,
            'jenis_tabungan_id' => $jenis->id,
        ])->assertStatus(423)->assertJsonPath('error_code', 'LUNA_TUTUP');
    }

    public function test_target_validasi_minimum(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->putJson('/api/v1/tabungan-hari-raya/target', ['target_nominal' => 5000])
            ->assertStatus(422);
    }

    public function test_setor_tanpa_target_hari_raya_ditolak(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->jenisHariRaya();

        $this->assertDatabaseMissing('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
        ]);

        $this->postSetor('/api/v1/tabungan-pribadi/setor', [
            'nominal' => 150000,
            'jenis_tabungan_id' => $jenis->id,
        ])->assertStatus(422)->assertJsonPath('error_code', 'TARGET_NOT_SET');

        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_setor_hari_raya_berhasil_setelah_target_diatur(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->jenisHariRaya();

        $this->putJson('/api/v1/tabungan-hari-raya/target', ['target_nominal' => 1000000])->assertOk();

        $this->postSetor('/api/v1/tabungan-pribadi/setor', [
            'nominal' => 150000,
            'jenis_tabungan_id' => $jenis->id,
        ])->assertStatus(201)->assertJsonPath('data.nominal', '150000.00');
    }
}