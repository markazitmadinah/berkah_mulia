<?php

namespace Tests\Feature;

use App\Enums\AturanPencairan;
use App\Enums\ModePerhitungan;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeTabungan;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use Tests\ApiTestCase;

class TabunganCustomTest extends ApiTestCase
{
    private function makeCustom(array $overrides = []): JenisTabungan
    {
        return JenisTabungan::create(array_merge([
            'kode' => 'CUS-'.uniqid(),
            'nama' => 'Tabungan Custom',
            'tipe' => TipeTabungan::Custom,
            'mode_perhitungan' => ModePerhitungan::NominalBebas,
            'aturan_pencairan' => AturanPencairan::ManualAdmin,
            'metode_pembayaran_diizinkan' => ['cash', 'transfer'],
            'allow_withdrawal' => true,
            'status_aktif' => true,
            'created_by' => $this->createAdmin()->id,
            'config' => [
                'min_nominal' => 10000,
                'max_nominal' => 1000000,
                'kelipatan' => 10000,
            ],
        ], $overrides));
    }

    public function test_user_bisa_setor_ke_tabungan_custom(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom();

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 50000,
        ])->assertStatus(201)
            ->assertJsonPath('data.jenis_tabungan.id', $jenis->id);

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 50000,
        ]);
    }

    public function test_setor_ditolak_bila_di_bawah_minimum(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->makeCustom();

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 5000,
        ])->assertStatus(422);
    }

    public function test_setor_ditolak_bila_bukan_kelipatan(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->makeCustom();

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 15000,
        ])->assertStatus(422);
    }

    public function test_progress_custom_mengembalikan_saldo(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->makeCustom();

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 100000,
        ])->assertStatus(201);

        $this->getJson("/api/v1/tabungan-custom/{$jenis->id}/progress")
            ->assertOk()
            ->assertJsonPath('data.jenis_tabungan_id', $jenis->id);
    }

    public function test_user_bisa_set_target_saat_goal_boleh_ubah(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom(['config' => [
            'min_nominal' => 10000,
            'goal_boleh_ubah' => true,
        ]]);

        $this->patchJson("/api/v1/tabungan-custom/{$jenis->id}/target", ['target_nominal' => 5000000])
            ->assertOk()
            ->assertJsonPath('data.target_nominal', 5000000);

        $this->getJson("/api/v1/tabungan-custom/{$jenis->id}/target")
            ->assertOk()
            ->assertJsonPath('data.target_nominal', 5000000)
            ->assertJsonPath('data.admin_target_nominal', null);

        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => 5000000,
        ]);
    }

    public function test_target_ditolak_saat_goal_boleh_ubah_nonaktif(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->makeCustom();

        $this->patchJson("/api/v1/tabungan-custom/{$jenis->id}/target", ['target_nominal' => 5000000])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'TARGET_NOT_ALLOWED');
    }

    public function test_setor_nominal_tetap_menolak_nominal_lain(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $jenis = $this->makeCustom([
            'mode_perhitungan' => ModePerhitungan::NominalTetap,
            'config' => [
                'min_nominal' => 10000,
                'setoran_berkala' => true,
                'setoran_berkala_nominal' => 100000,
                'setoran_berkala_periode' => 'bulanan',
            ],
        ]);

        // Nominal berbeda dari nilai tetap -> ditolak
        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 50000,
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'FIXED_NOMINAL_MISMATCH');

        // Nominal sama dengan nilai tetap -> diterima
        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 100000,
        ])->assertStatus(201);
    }

    public function test_auto_setor_opt_in_dan_ditolak_tanpa_setoran_berkala(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        // Produk tanpa setoran berkala -> auto-setor ditolak
        $jenisBiasa = $this->makeCustom();
        $this->putJson("/api/v1/tabungan-custom/{$jenisBiasa->id}/auto-setor", ['aktif' => true])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'AUTO_SETOR_NOT_ALLOWED');

        // Produk dengan setoran berkala -> opt-in berhasil
        $jenis = $this->makeCustom(['config' => [
            'min_nominal' => 10000,
            'setoran_berkala' => true,
            'setoran_berkala_nominal' => 100000,
            'setoran_berkala_periode' => 'bulanan',
        ]]);

        $this->putJson("/api/v1/tabungan-custom/{$jenis->id}/auto-setor", ['aktif' => true])
            ->assertOk()
            ->assertJsonPath('data.aktif', true);

        $this->assertDatabaseHas('user_auto_setor', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'aktif' => true,
        ]);

        $this->getJson("/api/v1/tabungan-custom/{$jenis->id}/auto-setor")
            ->assertOk()
            ->assertJsonPath('data.aktif', true);
    }

    public function test_setor_ditolak_saat_goal_sudah_tercapai(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom(['target_nominal' => 500000]);

        // Saldo sudah mencapai target (terverifikasi)
        Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 100000,
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_REACHED');
    }

    public function test_admin_goal_tracker_menampilkan_user_yang_mencapai_goal(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom(['target_nominal' => 100000]);

        Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 150000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->actingAsAdmin();
        $this->getJson('/api/v1/admin/tabungan-custom/goal-tracker')
            ->assertOk()
            ->assertJsonPath('data.0.users_achieved.0.user_id', $user->id)
            ->assertJsonPath('data.0.users_achieved.0.saldo', 150000);
    }

    private function seedSetor(User $user, JenisTabungan $jenis, float $nominal): void
    {
        Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }

    public function test_tarik_ditolak_bila_melewati_min_saldo(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom(['config' => [
            'min_nominal' => 10000,
            'min_saldo' => 50000,
        ]]);
        $this->seedSetor($user, $jenis, 100000); // saldo = 100.000

        // Tarik 60.000 -> sisa 40.000 < min_saldo 50.000 -> ditolak
        $this->postJson("/api/v1/tabungan-custom/{$jenis->id}/tarik", ['nominal' => 60000])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'BELOW_MIN_SALDO');

        // Tarik 50.000 -> sisa 50.000 >= min_saldo -> diterima
        $this->postJson("/api/v1/tabungan-custom/{$jenis->id}/tarik", ['nominal' => 50000])
            ->assertStatus(201);
    }

    public function test_tarik_menerapkan_potongan_dan_biaya_admin(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom(['config' => [
            'min_nominal' => 10000,
            'potongan' => true,
            'potongan_tipe' => 'persen',
            'potongan_nilai' => 10,
            'biaya_admin' => 5000,
        ]]);
        $this->seedSetor($user, $jenis, 1000000);

        // nominal 100.000 -> potongan 10% = 10.000 + biaya admin 5.000 = 15.000
        $this->postJson("/api/v1/tabungan-custom/{$jenis->id}/tarik", ['nominal' => 100000])
            ->assertStatus(201)
            ->assertJsonPath('data.biaya_penalti', '15000.00')
            ->assertJsonPath('data.nominal', '100000.00')
            ->assertJsonPath('data.catatan_user', fn ($v) => str_contains($v, '85.000'));
    }

    public function test_tarik_ditolak_sebelum_goal_saat_goal_wajib(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom([
            'target_nominal' => 500000,
            'config' => [
                'min_nominal' => 10000,
                'goal_wajib' => true,
            ],
        ]);
        $this->seedSetor($user, $jenis, 100000); // saldo 100.000 < goal 500.000

        $this->postJson("/api/v1/tabungan-custom/{$jenis->id}/tarik", ['nominal' => 20000])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_NOT_REACHED');
    }

    public function test_setor_diizinkan_melebihi_goal_saat_overpayment_saldo(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom([
            'target_nominal' => 100000,
            'config' => [
                'min_nominal' => 10000,
                'overpayment' => 'saldo',
            ],
        ]);
        $this->seedSetor($user, $jenis, 100000); // sudah capai goal

        // overpayment=saldo -> surplus dibiarkan jadi saldo, tidak ditolak
        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 50000,
        ])->assertStatus(201);
    }

    public function test_setor_ditolak_melebihi_goal_saat_overpayment_tolak(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->makeCustom([
            'target_nominal' => 100000,
            'config' => [
                'min_nominal' => 10000,
                'overpayment' => 'tolak',
            ],
        ]);
        $this->seedSetor($user, $jenis, 100000);

        $this->postSetor("/api/v1/tabungan-custom/{$jenis->id}/setor", [
            'nominal' => 50000,
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_REACHED');
    }
}