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

        // DIAJUKAN → AKTIF (setujui & salurkan sekali jalan; jatuh tempo = hari ini + 1 bulan)
        $aktif = $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")
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

        // Pelunasan sisa 3.328.000 → EMAS DIKEMBALIKAN langsung (lunasi = serah terima)
        $lunas = $this->postJson("/api/v1/admin/gadai/{$g['id']}/lunasi")
            ->assertOk()->json('data');
        $this->assertEquals('emas_dikembalikan', $lunas['status']);
        $this->assertEquals(7328000, $lunas['total_dibayar']);
        $this->assertNotNull($lunas['tanggal_lunas']);
        $this->assertDatabaseCount('angsuran_gadai', 3);

        // Setelah emas dikembalikan tidak bisa lunasi/diubah lagi
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/lunasi")->assertStatus(422);
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/kembalikan-emas")->assertStatus(422);
    }

    public function test_kembalikan_emas_hanya_dari_status_lunas(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        // Belum lunas → tidak bisa kembalikan emas
        $g = $this->ajukanGadai($user->id);
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/kembalikan-emas")->assertStatus(422);

        // Bayar lunas via angsuran → status LUNAS (belum dikembalikan)
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 7328000])
            ->assertOk()->assertJsonPath('data.gadai.status', 'lunas');

        // Kembalikan emas → EMAS_DIKEMBALIKAN + notif untuk user saja
        $kembali = $this->postJson("/api/v1/admin/gadai/{$g['id']}/kembalikan-emas")
            ->assertOk()->json('data');
        $this->assertEquals('emas_dikembalikan', $kembali['status']);

        $this->assertDatabaseHas('notifikasi', [
            'user_id' => $user->id,
            'judul' => 'Silakan Ambil Emas Anda Kembali',
        ]);
    }

    public function test_user_hanya_boleh_angsur_sesuai_ketentuan_admin(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();

        \Laravel\Sanctum\Sanctum::actingAs($user);

        // Nominal bukan angkuran (2jt) dan bukan sisa pokok (7.328.000) → 422
        $this->postJson("/api/v1/gadai-saya/{$g['id']}/bayar", ['nominal' => 500000, 'metode_pembayaran' => 'transfer'])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'NOMINAL_HARUS_SESUAI_ATURAN');

        // Angkuran sesuai admin → diterima (flag image)
        $upload = \Illuminate\Http\UploadedFile::fake()->image('bukti.jpg', 200, 200);
        $this->postJson("/api/v1/gadai-saya/{$g['id']}/bayar", [
            'nominal' => 2000000,
            'metode_pembayaran' => 'transfer',
            'bukti_transfer' => $upload,
        ])->assertCreated();
    }

    public function test_user_pelunasan_wajib_bukti_transfer(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();

        \Laravel\Sanctum\Sanctum::actingAs($user);

        // Pelunasan sisa penuh tanpa bukti → 422 BUKTI_WAJIB. Route user bayar.
        $this->postJson("/api/v1/gadai-saya/{$g['id']}/bayar", [
            'nominal' => 7328000,
            'metode_pembayaran' => 'transfer',
        ])->assertStatus(422)->assertJsonPath('error_code', 'BUKTI_WAJIB');

        // Dengan bukti → pending verifikasi
        $upload = \Illuminate\Http\UploadedFile::fake()->image('bukti.jpg', 200, 200);
        $res = $this->postJson("/api/v1/gadai-saya/{$g['id']}/bayar", [
            'nominal' => 7328000,
            'metode_pembayaran' => 'transfer',
            'bukti_transfer' => $upload,
        ])->assertCreated()->json('data');
        $this->assertEquals('menunggu_verifikasi', $res['status_verifikasi']);

        // Admin verifikasi pelunasan → LUNAS, emas siap dikembalikan
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/gadai/angsuran/{$res['id']}/verifikasi")
            ->assertOk()->assertJsonPath('data.status', 'lunas');

        // Admin serah terima emas → EMAS_DIKEMBALIKAN
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/kembalikan-emas")
            ->assertOk()->assertJsonPath('data.status', 'emas_dikembalikan');
    }

    public function test_batal_mengembalikan_emas_dengan_potongan_10_persen(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();
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

    public function test_batal_lalu_hapus_rekaman_batal(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/bayar", ['nominal' => 2000000])->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$g['id']}/batal")->assertOk();

        $this->deleteJson("/api/v1/admin/gadai/{$g['id']}")
            ->assertOk()
            ->assertJsonPath('message', 'Data pengajuan gadai dihapus.');

        $this->assertSoftDeleted('gadai', ['id' => $g['id']]);

        // Rekaman lunas tetap tidak bisa dihapus
        $lunas = $this->ajukanGadai($user->id);
        $this->postJson("/api/v1/admin/gadai/{$lunas['id']}/approve")->assertOk();
        $this->postJson("/api/v1/admin/gadai/{$lunas['id']}/lunasi")->assertOk();
        $this->deleteJson("/api/v1/admin/gadai/{$lunas['id']}")->assertStatus(422);
    }

    public function test_perpanjang_menggeser_jatuh_tempo(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $g = $this->ajukanGadai($user->id);

        // DIAJUKAN → AKTIF langsung (setujui & salurkan sekali jalan)
        $aktif = $this->postJson("/api/v1/admin/gadai/{$g['id']}/approve")->assertOk()->json('data');
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

    public function test_user_tidak_bisa_mengajukan_gadai_sendiri(): void
    {
        // Endpoint POST /gadai-saya sudah dihapus; pembuatan gadai hanya via admin.
        // Verifikasi route tidak ada: POST ke GET-only path → 405 (atau 500 di local Whoops).
        $this->actingAsAdmin();
        $res = $this->postJson('/api/v1/gadai-saya', ['jenis_emas' => 'x']);
        $this->assertContains($res->status(), [405, 500], 'POST /gadai-saya harus ditolak (route dihapus).');
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