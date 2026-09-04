<?php

namespace Tests\Feature;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Models\JenisTabungan;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\HewanQurban;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class TransaksiTest extends ApiTestCase
{
    private function createPendingTransaksi(int $userId, int $jenisId, int $nominal = 100000, $pendaftaranId = null): Transaksi
    {
        return Transaksi::create([
            'nomor_referensi' => 'TRX-' . strtoupper(uniqid()),
            'user_id' => $userId,
            'jenis_tabungan_id' => $jenisId,
            'pendaftaran_qurban_id' => $pendaftaranId,
            'jenis_transaksi' => JenisTransaksi::Setor,
            'nominal' => $nominal,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }

    public function test_user_hanya_melihat_transaksi_sendiri(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $this->createPendingTransaksi($user->id, $jenis->id);

        $this->getJson('/api/v1/transaksi-saya')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_user_tidak_bisa_lihat_transaksi_orang_lain(): void
    {
        $this->seedBase();
        $this->actingAsUser(['email' => 'a@example.com', 'phone' => '081211199911']);
        $other = $this->createUser(['email' => 'b@example.com', 'phone' => '081211199922']);
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($other->id, $jenis->id);

        $this->getJson("/api/v1/transaksi-saya/{$trx->id}")
            ->assertStatus(403)->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_admin_verifikasi_transaksi(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($user->id, $jenis->id);

        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/verifikasi")
            ->assertOk()->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $this->assertDatabaseHas('transaksi', ['id' => $trx->id, 'status_verifikasi' => 'terverifikasi', 'diverifikasi_oleh' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'verify', 'model_id' => $trx->id]);
    }

    public function test_admin_verifikasi_dua_kali_409_idempotent(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($user->id, $jenis->id);

        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/verifikasi")->assertOk();
        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/verifikasi")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_admin_tolak_transaksi_wajib_catatan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($user->id, $jenis->id);

        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/tolak", ['catatan_admin' => 'Bukti tidak jelas'])
            ->assertOk()->assertJsonPath('data.status_verifikasi', 'ditolak');

        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/tolak", ['catatan_admin' => 'lagi'])
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_admin_cash_transaksi_auto_terverifikasi(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'nominal' => 150000,
        ])->assertStatus(201)->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $this->assertDatabaseHas('transaksi', ['jenis_tabungan_id' => $jenis->id, 'status_verifikasi' => 'terverifikasi', 'diverifikasi_oleh' => $admin->id]);
    }

    public function test_cash_transaksi_qurban_update_total(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $periode = PeriodeQurban::create([
            'tahun' => date('Y'),
            'tanggal_buka_pendaftaran' => now()->subDay()->toDateString(),
            'tanggal_tutup_pendaftaran' => now()->addMonth()->toDateString(),
            'tanggal_idul_adha' => now()->addMonths(2)->toDateString(),
            'tanggal_pencairan' => now()->addMonths(2)->subDays(14)->toDateString(),
            'status' => 'aktif',
            'created_by' => auth()->id(),
        ]);
        $hewan = HewanQurban::create(['jenis_hewan' => 'Kambing', 'harga_per_unit' => 300000, 'periode_qurban_id' => $periode->id, 'created_by' => auth()->id()]);
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 300000,
            'status' => 'menabung',
            'tanggal_daftar' => now()->toDateString(),
        ]);
        $jenis = JenisTabungan::where('tipe', 'qurban')->first();

        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'pendaftaran_qurban_id' => $pendaftaran->id,
            'nominal' => 300000,
        ])->assertStatus(201)->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $pendaftaran->refresh();
        $this->assertEquals(300000, (int) $pendaftaran->total_terkumpul);
        $this->assertEquals('target_tercapai', $pendaftaran->status->value);
    }

    public function test_non_admin_tidak_bisa_verifikasi(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $user = $this->createUser(['email' => 'c@example.com', 'phone' => '081211199933']);
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($user->id, $jenis->id);

        $this->postJson("/api/v1/admin/transaksi/{$trx->id}/verifikasi")
            ->assertStatus(403);
    }
}
