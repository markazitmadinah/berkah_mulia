<?php

namespace Tests\Feature;

use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class EmasTest extends ApiTestCase
{
    public function test_admin_input_harga_baru_append_only(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/emas/harga', [
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1500000,
        ])->assertStatus(201)->assertJsonPath('data.status_aktif', true);

        $this->assertDatabaseCount('harga_emas_harian', 1);
        $this->assertDatabaseHas('harga_emas_harian', ['harga_per_gram' => '1500000.00', 'status_aktif' => true]);
    }

    public function test_input_harga_same_day_deactivate_lama(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $tanggal = now()->toDateString();

        HargaEmasHarian::create(['tanggal' => $tanggal, 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $this->postJson('/api/v1/admin/emas/harga', ['tanggal' => $tanggal, 'harga_per_gram' => 2000000])
            ->assertStatus(201);

        $this->assertDatabaseHas('harga_emas_harian', ['harga_per_gram' => '1000000.00', 'status_aktif' => false]);
        $this->assertDatabaseHas('harga_emas_harian', ['harga_per_gram' => '2000000.00', 'status_aktif' => true]);
    }

    public function test_update_harga_buat_versi_baru_dan_deactivate_lama(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $harga = HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $this->putJson("/api/v1/admin/emas/harga/{$harga->id}", ['harga_per_gram' => 1100000])
            ->assertOk();

        $this->assertEquals(0, HargaEmasHarian::where('id', $harga->id)->first()->status_aktif);
        $this->assertEquals(1, HargaEmasHarian::where('harga_per_gram', 1100000)->where('status_aktif', true)->count());
    }

    public function test_hapus_harga_dipakai_transaksi_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $harga = HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();
        $user = $this->createUser();

        Transaksi::create([
            'nomor_referensi' => 'TRX-E1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 50000,
            'unit_didapat' => 0.05,
            'harga_acuan_id' => $harga->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->deleteJson("/api/v1/admin/emas/harga/{$harga->id}")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_user_harga_terkini_404_jika_belum_ada(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->getJson('/api/v1/emas/harga-terkini')->assertStatus(404)->assertJsonPath('error_code', 'NOT_FOUND');
    }

    public function test_user_harga_terkini_mengembalikan_harga_aktif(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1500000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $this->getJson('/api/v1/emas/harga-terkini')
            ->assertOk()->assertJsonPath('data.harga_per_gram', 1500000);
    }

    public function test_user_setor_emas_mengonversi_nominal_ke_gram(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 10]);
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $response = $this->postSetor('/api/v1/emas/setor', [
            'nominal' => 100000,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'setor')
            ->assertJsonPath('data.status_verifikasi', 'menunggu_verifikasi')
            ->assertJsonPath('data.unit_didapat', '0.1000');

        $this->assertDatabaseHas('transaksi', [
            'jenis_tabungan_id' => JenisTabungan::where('kode', 'emas-harian')->first()->id,
            'unit_didapat' => '0.1000',
            'harga_acuan_snapshot' => '1000000.00',
        ]);
    }

    public function test_setor_emas_tanpa_harga_400(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 10]);

        $this->postSetor('/api/v1/emas/setor', ['nominal' => 100000])
            ->assertStatus(400);
    }

    public function test_setor_duplikat_dalam_30_detik_409(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 10]);
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        Transaksi::create([
            'nomor_referensi' => 'TRX-E2',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 100000,
            'unit_didapat' => 0.1,
            'metode_pembayaran' => 'cash',
            'tanggal_transaksi' => now()->toDateString(),
            'created_at' => now(),
        ]);

        $this->postSetor('/api/v1/emas/setor', ['nominal' => 100000])
            ->assertStatus(409)->assertJsonPath('error_code', 'DUPLICATE');
    }

    public function test_setor_emas_tanpa_goal_ditolak_422(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $this->postSetor('/api/v1/emas/setor', ['nominal' => 100000])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_NOT_SET');

        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_setor_nominal_dibawah_minimum_422(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 10]);
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $this->postSetor('/api/v1/emas/setor', ['nominal' => 5000])
            ->assertStatus(422);
    }

    public function test_admin_riwayat_harga_filter_tanggal(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        HargaEmasHarian::create(['tanggal' => '2026-01-01', 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => auth()->id()]);
        HargaEmasHarian::create(['tanggal' => '2026-02-01', 'harga_per_gram' => 1100000, 'status_aktif' => true, 'created_by' => auth()->id()]);

        $this->getJson('/api/v1/admin/emas/harga-riwayat?dari=2026-02-01&sampai=2026-12-31')
            ->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_user_set_target_emas_gram(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        $this->putJson('/api/v1/emas/goal', ['target_emas_gram' => 10.5])
            ->assertOk()
            ->assertJsonPath('data.target_emas_gram', 10.5);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => '10.5000']);
    }

    public function test_user_tidak_bisa_hapus_atau_ubah_target_saat_goal_aktif(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 5]);

        // Hapus (null) ditolak karena goal masih aktif.
        $this->putJson('/api/v1/emas/goal', ['target_emas_gram' => null])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_LOCKED');

        // Ubah ke nilai lain juga ditolak.
        $this->putJson('/api/v1/emas/goal', ['target_emas_gram' => 8])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'GOAL_LOCKED');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => '5.0000']);
    }

    public function test_target_emas_gram_validasi_min_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->putJson('/api/v1/emas/goal', ['target_emas_gram' => 0])
            ->assertStatus(422);
    }

    public function test_user_tarik_emas_ditolak_sebelum_goal_tercapai(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 5 gram, baru terkumpul 1 gram (terverifikasi).
        $user->update(['target_emas_gram' => 5]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-T1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1000000,
            'unit_didapat' => 1,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->postJson('/api/v1/emas/tarik', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'GOAL_NOT_REACHED');
    }

    public function test_user_tarik_emas_full_saldo_setelah_goal_tercapai(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 2 gram, terkumpul 10 gram → goal tercapai.
        $user->update(['target_emas_gram' => 2]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-T2',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 10000000,
            'unit_didapat' => 10,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        // Pencairan full saldo (10 gram) → nominal 10jt, unit -10.
        $response = $this->postJson('/api/v1/emas/tarik', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'tarik')
            ->assertJsonPath('data.status_verifikasi', 'menunggu_verifikasi')
            ->assertJsonPath('data.unit_didapat', '-10.0000');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => '10000000.00',
            'unit_didapat' => '-10.0000',
        ]);
    }

    public function test_user_batal_emas_refund_90_persen_potong_10(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 5 gram, baru terkumpul 1.5 gram → belum tercapai.
        $user->update(['target_emas_gram' => 5]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-B1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1500000,
            'unit_didapat' => 1.5,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $response = $this->postJson('/api/v1/emas/batal', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);

        // Nilai saldo = 1.5gr × 1jt = 1.500.000; penalti 10% = 150.000; refund 90% = 1.350.000.
        $response->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'tarik')
            ->assertJsonPath('data.status_verifikasi', 'menunggu_verifikasi')
            ->assertJsonPath('data.unit_didapat', '-1.5000')
            ->assertJsonPath('data.biaya_penalti', '150000.00');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => '1500000.00',
            'unit_didapat' => '-1.5000',
            'biaya_penalti' => '150000.00',
        ]);
    }

    public function test_user_batal_emas_setelah_goal_tercapai_ditolak(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 2 gram, terkumpul 3 gram → tercapai, tidak boleh batal.
        $user->update(['target_emas_gram' => 2]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-B2',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 3000000,
            'unit_didapat' => 3,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->postJson('/api/v1/emas/batal', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'GOAL_REACHED');
    }

    public function test_verifikasi_batal_emas_menghapus_goal_pengguna(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 5 gram, baru terkumpul 1.5 gram → belum tercapai.
        $user->update(['target_emas_gram' => 5]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-B3',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1500000,
            'unit_didapat' => 1.5,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $response = $this->postJson('/api/v1/emas/batal', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);
        $response->assertStatus(201);
        $tarikId = $response->json('data.id');

        // Admin verifikasi pembatalan → saldo 0 dan goal dihapus.
        $this->actingAsAdmin();

        $this->postJson("/api/v1/admin/transaksi/{$tarikId}/verifikasi")
            ->assertOk()
            ->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $this->assertDatabaseHas('transaksi', ['id' => $tarikId, 'status_verifikasi' => 'terverifikasi']);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => null]);
    }

    public function test_verifikasi_tarik_emas_gunakan_gram_bukan_nilai_rupiah(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 2 gram, terkumpul 2.0558 gram yang nilainya (2.0558jt) lebih besar
        // dari rupiah yang disetor (1.500.000) karena apresiasi harga emas.
        $user->update(['target_emas_gram' => 2]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-V1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1500000,
            'unit_didapat' => 2.0558,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        // Pencairan full saldo → nominal 2.055.800 (market value), unit -2.0558.
        $response = $this->postJson('/api/v1/emas/tarik', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);
        $response->assertStatus(201);
        $tarikId = $response->json('data.id');

        // Verifikasi admin harus berhasil berdasarkan GRAM, bukan membandingkan
        // nilai pasar (2.055.800) dengan rupiah yang disetor (1.500.000).
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/transaksi/{$tarikId}/verifikasi")
            ->assertOk()
            ->assertJsonPath('data.status_verifikasi', 'terverifikasi');
    }

    public function test_tukar_emas_goal_tercapai_langsung_selesai_dan_reset_goal(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        $user->update(['target_emas_gram' => 2]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-T1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1500000,
            'unit_didapat' => 2.0558,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $response = $this->postJson('/api/v1/emas/tukar');
        $response->assertOk()
            ->assertJsonPath('data.jenis_transaksi', 'tarik')
            ->assertJsonPath('data.status_verifikasi', 'terverifikasi')
            ->assertJsonPath('data.unit_didapat', '-2.0558');

        // Goal emas di-reset setelah tukar selesai.
        $this->assertNull($user->fresh()->target_emas_gram);

        // Notifikasi dikirim ke user (ambil emas di toko) dan ke admin.
        $this->assertDatabaseHas('notifikasi', ['user_id' => $user->id, 'judul' => 'Silakan Ambil Emas di Toko']);
        $this->assertDatabaseHas('notifikasi', ['judul' => 'User Mencapai Target Emas']);
    }

    public function test_tukar_emas_sebelum_goal_422(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        // Goal 5 gram, baru terkumpul 1 gram (belum tercapai).
        $user->update(['target_emas_gram' => 5]);
        Transaksi::create([
            'nomor_referensi' => 'TRX-E-T2',
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1000000,
            'unit_didapat' => 1,
            'harga_acuan_id' => HargaEmasHarian::hargaTerkini()->id,
            'harga_acuan_snapshot' => 1000000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->postJson('/api/v1/emas/tukar')
            ->assertStatus(422)->assertJsonPath('error_code', 'GOAL_NOT_REACHED');
    }
}
