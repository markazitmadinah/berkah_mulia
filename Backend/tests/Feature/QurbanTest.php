<?php

namespace Tests\Feature;

use App\Enums\StatusPendaftaranQurban;
use App\Enums\StatusPeriodeQurban;
use App\Enums\TipeTabungan;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\Transaksi;
use App\Services\QurbanTargetService;
use Tests\ApiTestCase;

class QurbanTest extends ApiTestCase
{
    private function createAktifPeriode(array $overrides = []): PeriodeQurban
    {
        return PeriodeQurban::create(array_merge([
            'tahun' => date('Y'),
            'tanggal_buka_pendaftaran' => now()->subDay()->toDateString(),
            'tanggal_tutup_pendaftaran' => now()->addMonth()->toDateString(),
            'tanggal_idul_adha' => now()->addMonths(2)->toDateString(),
            'tanggal_pencairan' => now()->addMonths(2)->subDays(14)->toDateString(),
            'status' => StatusPeriodeQurban::Aktif,
            'created_by' => auth()->id(),
        ], $overrides));
    }

    private function createHewan(PeriodeQurban $periode, int $harga = 1000000): HewanQurban
    {
        return HewanQurban::create([
            'jenis_hewan' => 'Kambing',
            'harga_per_unit' => $harga,
            'periode_qurban_id' => $periode->id,
            'created_by' => auth()->id(),
        ]);
    }

    public function test_admin_buat_periode_dengan_default_tutup_dan_pencairan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/admin/qurban/periode', [
            'tahun' => date('Y'),
            'tanggal_buka_pendaftaran' => '2026-01-05',
            'tanggal_idul_adha' => '2026-06-01',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'draft');

        $periode = PeriodeQurban::latest('id')->first();
        $this->assertEquals('2026-02-05', $periode->tanggal_tutup_pendaftaran->toDateString());
        $this->assertEquals('2026-05-18', $periode->tanggal_pencairan->toDateString());
    }

    public function test_admin_buat_hewan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();

        $this->postJson('/api/v1/admin/qurban/hewan', [
            'jenis_hewan' => 'Sapi',
            'harga_per_unit' => 25000000,
            'periode_qurban_id' => $periode->id,
        ])->assertStatus(201)->assertJsonPath('data.jenis_hewan', 'Sapi');
    }

    public function test_user_daftar_qurban_menghitung_target_dana(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 1000000);

        $this->postJson('/api/v1/qurban/daftar', [
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 2,
        ])->assertStatus(201)
            ->assertJsonPath('data.target_dana', '2000000.00')
            ->assertJsonPath('data.status', 'menabung');
    }

    public function test_daftar_qurban_dengan_frekuensi(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 1200000);

        $this->postJson('/api/v1/qurban/daftar', [
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 200000,
        ])->assertStatus(201)
            ->assertJsonPath('data.frekuensi_setor', 'bulanan')
            ->assertJsonPath('data.frekuensi_label', 'Bulanan')
            ->assertJsonPath('data.nominal_per_periode', '200000.00')
            ->assertJsonPath('data.sisa_pembayaran', 6);
    }

    public function test_tunggakan_qurban_menghitung_periode_jatuh_tempo(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 1000000);
        $user = $this->createUser();

        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 100000,
            'status' => StatusPendaftaranQurban::Menabung,
            'frekuensi_setor' => 'harian',
            'nominal_per_periode' => 100000,
            'tanggal_daftar' => now()->subDays(3)->toDateString(),
        ]);

        // 4 periode jatuh tempo (H+0 s/d H+3) − 1 periode terbayar = 3 tertunggak.
        $tertunggak = $pendaftaran->tertunggak();
        $this->assertSame(3, $tertunggak['jumlah_periode']);
        $this->assertEquals(300000.0, $tertunggak['nominal']);
    }

    public function test_tunggakan_qurban_tidak_melebihi_total_periode_rencana(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 1000000);
        $user = $this->createUser();

        // 20 hari berlalu tapi rencana hanya 10 periode (1jt ÷ 100rb) → tunggakan max 10.
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 0,
            'status' => StatusPendaftaranQurban::Menabung,
            'frekuensi_setor' => 'harian',
            'nominal_per_periode' => 100000,
            'tanggal_daftar' => now()->subDays(20)->toDateString(),
        ]);

        $tertunggak = $pendaftaran->tertunggak();
        $this->assertSame(10, $tertunggak['jumlah_periode']);
        $this->assertEquals(1000000.0, $tertunggak['nominal']);
    }

    public function test_monitoring_nasabah_menyertakan_tunggakan_qurban(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 1000000);
        $user = $this->createUser();

        PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 100000,
            'status' => StatusPendaftaranQurban::Menabung,
            'frekuensi_setor' => 'harian',
            'nominal_per_periode' => 100000,
            'tanggal_daftar' => now()->subDays(3)->toDateString(),
        ]);

        $res = $this->getJson('/api/v1/admin/monitoring-tabungan')->assertOk();
        $row = collect($res->json('data'))->firstWhere('user.id', $user->id);

        $this->assertNotNull($row);
        $this->assertSame(3, $row['qurban'][0]['tertunggak']['jumlah_periode']);
        $this->assertEquals(300000.0, $row['qurban'][0]['tertunggak']['nominal']);
    }

    public function test_user_daftar_saat_pendaftaran_ditutup_403(): void    {
        $this->seedBase();
        $this->actingAsUser();
        $periode = $this->createAktifPeriode([
            'status' => StatusPeriodeQurban::Ditutup,
        ]);
        $hewan = $this->createHewan($periode);

        $this->postJson('/api/v1/qurban/daftar', ['hewan_qurban_id' => $hewan->id, 'jumlah_hewan' => 1])
            ->assertStatus(403)->assertJsonPath('error_code', 'REGISTRATION_CLOSED');
    }

    public function test_setor_qurban_dan_verifikasi_memicu_target_tercapai(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        \Laravel\Sanctum\Sanctum::actingAs($user);
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 100000);

        $daftar = $this->postJson('/api/v1/qurban/daftar', ['hewan_qurban_id' => $hewan->id, 'jumlah_hewan' => 1]);
        $pendaftaranId = $daftar->json('data.id');
        $this->assertEquals(100000, $pendaftaranId ? PendaftaranQurban::find($pendaftaranId)->target_dana : null);

        $setor = $this->postSetor("/api/v1/qurban/{$pendaftaranId}/setor", [
            'nominal' => 100000,
        ]);

        $setor->assertStatus(201)->assertJsonPath('data.status_verifikasi', 'menunggu_verifikasi');

        $transaksi = Transaksi::where('pendaftaran_qurban_id', $pendaftaranId)->first();
        $admin = $this->createAdmin();
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/transaksi/{$transaksi->id}/verifikasi")
            ->assertOk()->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $pendaftaran = PendaftaranQurban::find($pendaftaranId);
        $this->assertEquals(100000, (int) $pendaftaran->total_terkumpul);
        $this->assertEquals(StatusPendaftaranQurban::TargetTercapai, $pendaftaran->status);
    }

    public function test_setor_qurban_status_cair_tidak_bisa(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'status' => StatusPendaftaranQurban::SudahDicairkan,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postSetor("/api/v1/qurban/{$pendaftaran->id}/setor", ['nominal' => 100000])
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_setor_qurban_orang_lain_403(): void
    {
        $this->seedBase();
        $owner = $this->createUser(['email' => 'owner@example.com', 'phone' => '081211122233']);
        $this->actingAsUser(['email' => 'lain@example.com', 'phone' => '081244455566']);

        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $owner->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postSetor("/api/v1/qurban/{$pendaftaran->id}/setor", ['nominal' => 100000])
            ->assertStatus(403)->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_admin_cairkan_pendaftaran(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 1000000,
            'status' => StatusPendaftaranQurban::TargetTercapai,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/qurban/{$pendaftaran->id}/cairkan")
            ->assertOk()->assertJsonPath('data.status', 'sudah_dicairkan');

        $this->assertDatabaseHas('pendaftaran_qurban', ['id' => $pendaftaran->id, 'status' => 'sudah_dicairkan', 'dicairkan_oleh' => $admin->id, 'total_terkumpul' => '0.00']);
    }

    public function test_cairkan_dua_kali_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'status' => StatusPendaftaranQurban::SudahDicairkan,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/qurban/{$pendaftaran->id}/cairkan")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_admin_nyatakan_lunas_dari_target_tercapai(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 1000000,
            'status' => StatusPendaftaranQurban::TargetTercapai,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/qurban/{$pendaftaran->id}/lunas")
            ->assertOk()->assertJsonPath('data.status', 'sudah_lunas');

        $this->assertDatabaseHas('pendaftaran_qurban', ['id' => $pendaftaran->id, 'status' => 'sudah_lunas']);
    }

    public function test_admin_nyatakan_lunas_sebelum_goal_422(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 500000,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/qurban/{$pendaftaran->id}/lunas")
            ->assertStatus(422)->assertJsonPath('error_code', 'GOAL_NOT_REACHED');
    }

    public function test_admin_lunas_dua_kali_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 1000000,
            'status' => StatusPendaftaranQurban::SudahLunas,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->postJson("/api/v1/admin/qurban/{$pendaftaran->id}/lunas")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_periode_aktif_endpoint(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $this->createAktifPeriode();

        $this->getJson('/api/v1/qurban/periode-aktif')->assertOk()->assertJsonPath('success', true);
    }

    public function test_periode_aktif_404_jika_tidak_ada(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->getJson('/api/v1/qurban/periode-aktif')->assertStatus(404);
    }

    public function test_admin_monitor_pendaftaran_filter_status(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->getJson('/api/v1/admin/qurban/pendaftaran?status=menabung')
            ->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_daftar_hewan_nonaktif_ditolak(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode, 500000);
        $hewan->update(['status_aktif' => false]);

        $this->postJson('/api/v1/qurban/daftar', ['hewan_qurban_id' => $hewan->id, 'jumlah_hewan' => 1])
            ->assertStatus(422)->assertJsonPath('error_code', 'HEWAN_TIDAK_AKTIF');
    }

    public function test_admin_hapus_pendaftaran_mengembalikan_dana_dan_menyimpan_riwayat_setoran(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'total_terkumpul' => 500000,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $trx = Transaksi::create([
            'nomor_referensi' => 'TRX-Q-DEL1',
            'user_id' => $user->id,
            'jenis_tabungan_id' => JenisTabungan::where('tipe', TipeTabungan::Qurban)->firstOrFail()->id,
            'pendaftaran_qurban_id' => $pendaftaran->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $this->deleteJson("/api/v1/admin/qurban/pendaftaran/{$pendaftaran->id}")
            ->assertOk();

        $this->assertSoftDeleted('pendaftaran_qurban', ['id' => $pendaftaran->id]);

        // Setoran TIDAK dihapus — riwayat dana nasabah tetap sebagai jejak audit.
        $this->assertDatabaseHas('transaksi', ['id' => $trx->id, 'deleted_at' => null]);

        // Dana dikembalikan lewat transaksi tarik terverifikasi (netto ledger = 0).
        $refund = Transaksi::where('pendaftaran_qurban_id', $pendaftaran->id)
            ->where('jenis_transaksi', 'tarik')
            ->where('status_verifikasi', 'terverifikasi')
            ->first();
        $this->assertNotNull($refund);
        $this->assertEquals(500000.0, (float) $refund->nominal);
    }

    public function test_admin_tidak_bisa_hapus_pendaftaran_sudah_dicairkan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $periode = $this->createAktifPeriode();
        $hewan = $this->createHewan($periode);
        $user = $this->createUser();
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 1000000,
            'status' => StatusPendaftaranQurban::SudahDicairkan,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $this->deleteJson("/api/v1/admin/qurban/pendaftaran/{$pendaftaran->id}")
            ->assertStatus(409)
            ->assertJsonPath('error_code', 'CONFLICT');
    }
}
