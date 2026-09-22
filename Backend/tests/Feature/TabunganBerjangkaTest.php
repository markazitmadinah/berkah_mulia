<?php

namespace Tests\Feature;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Enums\SubJenisTabungan;
use App\Enums\UserRole;
use App\Models\JenisTabungan;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\ApiTestCase;

class TabunganBerjangkaTest extends ApiTestCase
{
    public function test_user_tidak_bisa_membuat_tabungan_berjangka(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->postJson('/api/v1/tabungan-berjangka', [
            'target_nominal' => 600000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
        ])->assertStatus(500); // route dihapus → error handler, bukan 201

        $res = $this->getJson('/api/v1/tabungan-berjangka')->assertOk();
        $this->assertFalse($res->json('data.dapat_membuat'));
        $this->assertSame(0, $res->json('data.slot_tersedia'));
    }

    public function test_admin_membuat_berjangka_langsung_aktif(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/tabungan-berjangka', [
            'user_id' => $user->id,
            'target_nominal' => 600000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'aktif')
            ->assertJsonStructure(['data' => ['id', 'tanggal_mulai', 'tanggal_jatuh_tempo']]);

        $this->assertDatabaseCount('tabungan_berjangka', 1);
    }

    public function test_admin_dibatasi_5_tabungan_berjangka_per_user(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->actingAsAdmin();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/admin/tabungan-berjangka', [
                'user_id' => $user->id,
                'target_nominal' => 60000,
                'durasi_bulan' => 1,
                'frekuensi_setor' => 'bulanan',
            ])->assertCreated();
        }

        $this->postJson('/api/v1/admin/tabungan-berjangka', [
            'user_id' => $user->id,
            'target_nominal' => 60000,
            'durasi_bulan' => 1,
            'frekuensi_setor' => 'bulanan',
        ])->assertStatus(422)->assertJsonPath('error_code', 'LIMIT_REACHED');
    }

    public function test_user_lihat_dan_admin_dilaporkan_tunggakan_berjangka(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $admin = User::where('role', UserRole::Admin)->first();

        $tb = $this->buatBerjangkaAktif($user->id, $admin->id);

        // User melihat tunggakan per tabungan
        $res = $this->getJson('/api/v1/tabungan-berjangka')->assertOk();
        $item = collect($res->json('data.items'))->first();
        $this->assertNotEmpty($item['tertunggak']);
        $this->assertSame(2, $item['tertunggak']['jumlah_periode']);
        $this->assertEquals(200000.0, $item['tertunggak']['nominal']);

        // Admin tunggakan melaporkan user & nominal tagihannya
        $this->actingAsAdmin();
        $res = $this->getJson('/api/v1/admin/pembayaran-harian/tunggakan')->assertOk();
        $item = collect($res->json('data.items'))
            ->first(fn ($i) => $i['sumber'] === 'berjangka' && $i['user_id'] === $user->id);
        $this->assertNotNull($item);
        $this->assertSame(2, $item['jumlah_periode_tertunggak']);
        $this->assertEquals(200000.0, $item['nominal_tagihan']);
    }

    public function test_batal_tanpa_saldo_langsung_hilang_dari_riwayat(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $admin = User::where('role', UserRole::Admin)->first();

        $tb = $this->buatBerjangkaAktif($user->id, $admin->id);

        $this->postJson("/api/v1/tabungan-berjangka/{$tb->id}/batal")
            ->assertOk();

        $this->assertDatabaseHas('tabungan_berjangka', ['id' => $tb->id, 'status' => 'batal']);

        // Hilang dari riwayat user
        $res = $this->getJson('/api/v1/tabungan-berjangka')->assertOk();
        $this->assertEmpty(collect($res->json('data.items'))->where('id', $tb->id));
    }

    public function test_batal_dengan_saldo_admin_verifikasi_dana_dikembalikan_utuh_dan_tabungan_hilang(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $admin = User::where('role', UserRole::Admin)->first();

        $tb = $this->buatBerjangkaAktif($user->id, $admin->id);
        $this->isiSaldo($tb, $user->id, $admin->id, 200000);

        // Ada saldo → ajukan pembatalan (bukan langsung batal)
        $this->postJson("/api/v1/tabungan-berjangka/{$tb->id}/batal")
            ->assertOk();
        $this->assertDatabaseHas('tabungan_berjangka', ['id' => $tb->id, 'status' => 'pembatalan_diajukan']);

        // Pengajuan ganda ditolak
        $this->postJson("/api/v1/tabungan-berjangka/{$tb->id}/batal")
            ->assertStatus(422)->assertJsonPath('error_code', 'STATUS_TIDAK_VALID');

        // Admin verifikasi pembatalan
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/tabungan-berjangka/{$tb->id}/verifikasi-pembatalan")
            ->assertOk();

        $this->assertDatabaseHas('tabungan_berjangka', ['id' => $tb->id, 'status' => 'batal']);

        // Dana dikembalikan utuh lewat transaksi tarik terverifikasi
        $trx = Transaksi::where('tabungan_berjangka_id', $tb->id)
            ->where('jenis_transaksi', JenisTransaksi::Tarik)
            ->where('status_verifikasi', StatusVerifikasi::Terverifikasi)
            ->first();
        $this->assertNotNull($trx);
        $this->assertEquals(200000.0, (float) $trx->nominal);

        // Tabungan hilang dari daftar admin (default) tapi ada di filter status=batal
        $res = $this->getJson('/api/v1/admin/tabungan-berjangka')->assertOk();
        $this->assertEmpty(collect($res->json('data.items'))->where('id', $tb->id));
        $this->getJson('/api/v1/admin/tabungan-berjangka?status=batal')->assertOk()
            ->assertJsonPath('data.items.0.id', $tb->id);

        // Hilang dari riwayat user
        $this->actingAs($user);
        $res = $this->getJson('/api/v1/tabungan-berjangka')->assertOk();
        $this->assertEmpty(collect($res->json('data.items'))->where('id', $tb->id));
    }

    public function test_verifikasi_pembatalan_hanya_untuk_status_diajukan(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $admin = User::where('role', UserRole::Admin)->first();

        $tb = $this->buatBerjangkaAktif($user->id, $admin->id);

        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/tabungan-berjangka/{$tb->id}/verifikasi-pembatalan")
            ->assertStatus(422)->assertJsonPath('error_code', 'STATUS_TIDAK_VALID');
    }

    public function test_tunggakan_berjangka_tidak_melampaui_target(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $admin = User::where('role', UserRole::Admin)->first();
        $jenis = JenisTabungan::where('sub_jenis', SubJenisTabungan::Berjangka)->firstOrFail();

        // Rencana tak sinkron (mis. hasil import): target 18jt tapi nominal 1jt/hari.
        // Tanpa cap, tunggakan meledak jadi ratusan periode (199× / Rp199jt).
        $tb = TabunganBerjangka::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => 18000000,
            'durasi_bulan' => 18,
            'frekuensi_setor' => 'harian',
            'nominal_per_periode' => 1000000,
            'tanggal_mulai' => now()->subMonths(7)->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(11)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_by' => $admin->id,
        ]);

        $t = $tb->tertunggak();
        $this->assertSame(18, $t['jumlah_periode']); // di-cap target ÷ nominal
        $this->assertEquals(18000000.0, $t['nominal']);
        $this->assertLessThanOrEqual((float) $tb->target_nominal, $t['nominal']);

        // Setelah 6jt terkumpul → sisa 12 periode / Rp12jt (cocok "Sisa target").
        $this->isiSaldo($tb, $user->id, $admin->id, 6000000);
        $t2 = $tb->fresh()->tertunggak();
        $this->assertSame(12, $t2['jumlah_periode']);
        $this->assertEquals(12000000.0, $t2['nominal']);
    }

    private function buatBerjangkaAktif(int $userId, int $adminId, float $target = 600000): TabunganBerjangka
    {
        $jenis = JenisTabungan::where('sub_jenis', SubJenisTabungan::Berjangka)->firstOrFail();

        return TabunganBerjangka::create([
            'user_id' => $userId,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => $target,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 100000,
            'tanggal_mulai' => now()->subMonth()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(5)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $adminId,
            'approved_at' => now(),
            'created_by' => $userId,
        ]);
    }

    private function isiSaldo(TabunganBerjangka $tb, int $userId, int $adminId, float $nominal): Transaksi
    {
        return Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $userId,
            'jenis_tabungan_id' => $tb->jenis_tabungan_id,
            'tabungan_berjangka_id' => $tb->id,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $adminId,
            'diverifikasi_pada' => now(),
            'tanggal_transaksi' => now()->toDateString(),
        ]);
    }
}
