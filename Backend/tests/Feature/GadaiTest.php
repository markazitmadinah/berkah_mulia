<?php

namespace Tests\Feature;

use App\Enums\StatusGadai;
use App\Models\Gadai;
use App\Models\HargaEmasHarian;
use App\Services\GadaiService;
use Carbon\Carbon;
use Tests\ApiTestCase;

class GadaiTest extends ApiTestCase
{
    private function setorGadaiData(array $overrides = []): array
    {
        return array_merge([
            'jenis_emas' => 'Antam LM 24K',
            'berat_gram' => 10,
            'kadar' => 916,
            'harga_acuan' => 1000000,
            'persen_gadai' => 80,
            'tenor_satuan' => 'bulanan',
            'frekuensi_bayar' => 'bulanan',
            'nominal_angkuran' => 2000000,
            'toleransi_hari' => 0,
        ], $overrides);
    }

    private function ajukanGadai(int $userId): array
    {
        return $this->postJson('/api/v1/admin/gadai', array_merge(
            ['user_id' => $userId],
            $this->setorGadaiData()
        ))->assertStatus(201)->assertJsonPath('success', true)->json('data');
    }

    public function test_store_menghitung_taksiran_dan_besaran_gadai(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $data = $this->ajukanGadai($user->id);

        // 10g × 916/1000 (per-mille) = 9,16g bersih; × Rp1.000.000 = Rp9.160.000 taksiran;
        // 80% → besaran gadai Rp7.328.000.
        $this->assertEquals(9.16, $data['berat_bersih_gram']);
        $this->assertEquals(9160000, $data['nilai_taksiran']);
        $this->assertEquals(7328000, $data['besaran_gadai']);
        $this->assertNotEquals($data['nilai_taksiran'], $data['besaran_gadai']);
        $this->assertEquals('diajukan', $data['status']);
    }

    public function test_alur_penuh_approve_aktifkan_bayar_lunas(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        // DIAJUKAN → DISETUJUI
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'disetujui');

        // DISETUJUI → AKTIF (jatuh tempo = hari ini + 1 bulan)
        $aktif = $this->postJson("/api/v1/admin/gadai/{$g['id']}/aktifkan")
            ->assertOk()
            ->assertJsonPath('data.status', 'aktif')
            ->json('data');
        $this->assertNotNull($aktif['tanggal_aktif']);
        $this->assertNotNull($aktif['tanggal_jatuh_tempo']);
        $this->assertEquals(
            Carbon::parse($aktif['tanggal_aktif'])->addMonthsNoOverflow(1)->toDateString(),
            $aktif['tanggal_jatuh_tempo']
        );

        // Catat 2 angsuran → belum lunas
        $a1 = $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 2000000])
            ->assertOk()->json('data');
        $this->assertEquals('aktif', $a1['gadai']['status']);
        $this->assertEquals(2000000, $a1['gadai']['total_dibayar']);

        $a2 = $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 2000000])
            ->assertOk()->json('data');
        $this->assertEquals(4000000, $a2['gadai']['total_dibayar']);

        // Bayar melebihi sisa → ditolak
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 99999999])
            ->assertStatus(422);

        // Pelunasan sisa 3.328.000 → LUNAS, emas dikembalikan
        $lunas = $this->postJson("/api/v1/admin/gadai/{$g['id']}/lunasi")
            ->assertOk()->json('data');
        $this->assertEquals('lunas', $lunas['status']);
        $this->assertEquals(7328000, $lunas['total_dibayar']);
        $this->assertNotNull($lunas['tanggal_lunas']);
        $this->assertDatabaseCount('angsuran_gadai', 3);
    }

    public function test_batal_mengembalikan_emas_dengan_potongan_10_persen(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/aktifkan")->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 5000000])->assertOk();

        $batal = $this->postJson("/api/v1/admin/gadai/{$g['id']}/batal")
            ->assertOk()->json('data');

        $this->assertEquals('batal', $batal['gadai']['status']);
        // Potongan 10% dari pembayaran 5jt = 500rb; refund 4,5jt.
        $this->assertEquals(500000, $batal['refund']['potongan_10_persen']);
        $this->assertEquals(4500000, $batal['refund']['nominal_refund']);

        // Tidak bisa dibatalkan dua kali
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/batal")->assertStatus(422);
    }

    public function test_perpanjang_menggeser_jatuh_tempo(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();
        $aktif = $this->postJson("/api/v1/admin/gadai/{$g['id']}/aktifkan")->assertOk()->json('data');
        $jatuhTempoLama = $aktif['tanggal_jatuh_tempo'];

        // Simulasikan melewati jatuh tempo → tandai JATUH TEMPO → perpanjang
        Gadai::find($g['id'])->update(['status' => StatusGadai::JatuhTempo]);

        $perpanjang = $this->postJson("/api/v1/admin/gadai/{$g['id']}/perpanjang")
            ->assertOk()->json('data');
        $this->assertEquals('diperpanjang', $perpanjang['status']);
        $this->assertTrue(
            Carbon::parse($perpanjang['tanggal_jatuh_tempo'])->gt(Carbon::parse($jatuhTempoLama))
        );
    }

    public function test_scheduler_cekJatuhTempo_mengubah_status(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = Gadai::create([
            'nomor_gadai' => '9999',
            'user_id' => $user->id,
            'jenis_emas' => 'Antam',
            'berat_gram' => 5,
            'kadar' => 999,
            'berat_bersih_gram' => 4.995,
            'harga_acuan' => 1000000,
            'nilai_taksiran' => 4995000,
            'persen_gadai' => 80,
            'besaran_gadai' => 3996000,
            'tanggal_aju' => now()->subDays(5)->toDateString(),
            'tanggal_aktif' => now()->subDays(6)->toDateString(),
            'tanggal_jatuh_tempo' => now()->subDay()->toDateString(),
            'tenor_satuan' => 'harian',
            'toleransi_hari' => 0,
            'frekuensi_bayar' => 'harian',
            'status' => StatusGadai::Aktif,
            'created_by' => $user->id,
        ]);

        $service = new GadaiService;

        $this->assertEquals(1, $service->cekJatuhTempo());
        $this->assertEquals(StatusGadai::JatuhTempo, $g->fresh()->status);

        $this->assertEquals(1, $service->cekJatuhTempo());
        $this->assertEquals(StatusGadai::Terlambat, $g->fresh()->status);
    }

    public function test_user_dapat_mengajukan_gadai_sendiri(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();

        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        \Laravel\Sanctum\Sanctum::actingAs($user);

        $res = $this->postJson('/api/v1/gadai-saya', [
            'jenis_emas' => 'Antam LM 24K',
            'berat_gram' => 10,
            'kadar' => 916,
            'tenor_satuan' => 'bulanan',
            'frekuensi_bayar' => 'bulanan',
            'nominal_angkuran' => 732800,
        ])->assertStatus(201)->assertJsonPath('success', true)->json('data');

        $this->assertEquals('diajukan', $res['status']);
        $this->assertEquals(80, $res['persen_gadai']);
        $this->assertEquals(9160000, $res['nilai_taksiran']);
        $this->assertEquals(7328000, $res['besaran_gadai']);

        // Harga acuan selalu pakai harga harian admin, bukan input nasabah.
        $list = $this->getJson('/api/v1/gadai-saya')->assertOk()->json('data.items');
        $this->assertCount(1, $list);
        $this->assertEquals($res['id'], $list[0]['id']);

        // Muncul di daftar admin untuk diproses (approve/aktifkan).
        \Laravel\Sanctum\Sanctum::actingAs($admin);
        $adminList = $this->getJson('/api/v1/admin/gadai?status=diajukan')->assertOk()->json('data.items');
        $this->assertCount(1, $adminList);
    }

    public function test_user_hanya_melihat_gadai_milik_sendiri(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $userA = $this->createUser();
        $userB = $this->createUser();
        $gA = $this->ajukanGadai($userA->id);
        $gB = $this->ajukanGadai($userB->id);

        $this->actingAsUser(['email' => 'own@example.com']);
        $list = $this->getJson('/api/v1/gadai-saya')
            ->assertOk()->json('data.items');
        $this->assertCount(0, $list);

        // userA melihat miliknya
        \Laravel\Sanctum\Sanctum::actingAs($userA);
        $listA = $this->getJson('/api/v1/gadai-saya')
            ->assertOk()->json('data.items');
        $this->assertCount(1, $listA);
        $this->assertEquals($gA['id'], $listA[0]['id']);

        $this->getJson("/api/v1/gadai-saya/{$gB['id']}")->assertStatus(404);
        $this->getJson("/api/v1/gadai-saya/{$gA['id']}")->assertOk();
    }
}