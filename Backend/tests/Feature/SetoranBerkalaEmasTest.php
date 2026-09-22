<?php

namespace Tests\Feature;

use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\SaldoAwalService;
use App\Services\SaldoEmasService;
use Laravel\Sanctum\Sanctum;
use Tests\ApiTestCase;

class SetoranBerkalaEmasTest extends ApiTestCase
{
    /**
     * Rencana hanya dibuat admin atas nama nasabah. Membuat rencana untuk $target,
     * lalu kembali bertindak sebagai $target untuk langkah tes berikutnya.
     */
    private function postSetoranBerkala(User $target, array $data): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($this->createAdmin());
        $response = $this->postJson('/api/v1/admin/emas/setoran-berkala', array_merge(['user_id' => $target->id], $data));
        Sanctum::actingAs($target);

        return $response;
    }
    private function buatHargaDanGoal(\App\Models\User $user, float $harga = 1000000): JenisTabungan
    {
        $user->update(['target_emas_gram' => 10]);
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => $harga, 'status_aktif' => true, 'created_by' => $user->id]);

        return JenisTabungan::where('tipe', 'emas')->first();
    }

    private function buatKonfigurasi(\App\Models\User $user, JenisTabungan $jenis, array $overrides = []): KonfigurasiSetoranEmas
    {
        return KonfigurasiSetoranEmas::create(array_merge([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'tanggal_mulai' => now()->toDateString(),
            'durasi_periode' => 30,
            'tanggal_deadline' => now()->addDays(29)->toDateString(),
            'status' => 'aktif',
            'created_by' => $user->id,
        ], $overrides));
    }

    private function buatSetorTerverifikasi(\App\Models\User $user, JenisTabungan $jenis, array $overrides = []): Transaksi
    {
        return Transaksi::create(array_merge([
            'nomor_referensi' => 'TRX-SB-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ], $overrides));
    }

    public function test_user_buat_setoran_berkala_harian(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $user->update(['target_emas_gram' => 10]);

        $response = $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal_per_periode', 15000)
            ->assertJsonPath('data.target_gram_per_periode', 0.012)
            ->assertJsonPath('data.frekuensi_setor', 'harian')
            ->assertJsonPath('data.durasi_periode', 30)
            ->assertJsonPath('data.status', 'aktif');

        $this->assertDatabaseHas('konfigurasi_setoran_emas', [
            'user_id' => $user->id,
            'nominal_per_periode' => '15000.00',
            'target_gram_per_periode' => '0.012000',
            'tanggal_deadline' => now()->addDays(29)->toDateString() . ' 00:00:00',
        ]);
    }

    public function test_bisa_membuat_beberapa_rencana_aktif_sekaligus(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->buatHargaDanGoal($user);

        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(201);

        // Rencana kedua "nabung lagi 5 gram" — nominal & target berbeda, tetap diperbolehkan.
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 50000,
            'target_gram_total' => 5,
            'frekuensi_setor' => 'mingguan',
            'durasi_periode' => 12,
        ])->assertStatus(201)
            ->assertJsonPath('data.target_gram_total', 5);

        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.dapat_membuat', true)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.konfigurasi.target_gram_total', 5);
    }

    public function test_batas_maksimal_5_rencana_aktif(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->buatHargaDanGoal($user);

        for ($i = 0; $i < 5; $i++) {
            $this->postSetoranBerkala($user, [
                'nominal_per_periode' => 15000,
                'target_gram_total' => 2,
                'frekuensi_setor' => 'harian',
                'durasi_periode' => 30,
            ])->assertStatus(201);
        }

        // Slot ke-6 ditolak; dapat_membuat jadi false.
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_gram_total' => 2,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Slot rencana pembayaran sudah penuh (maksimal 5). Selesaikan atau batalkan salah satu untuk menambah.');

        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.dapat_membuat', false)
            ->assertJsonCount(5, 'data.items');
    }

    public function test_target_global_tetap_terkunci_tapi_target_rencana_kedua_boleh_berbeda(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->buatHargaDanGoal($user); // goal global 10 gr

        // Mengubah goal global lewat target_emas_gram → tetap ditolak.
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_emas_gram' => 5,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(422)->assertJsonPath('error_code', 'GOAL_LOCKED');

        // Tapi target khusus rencana baru (5 gr) diperbolehkan.
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 50000,
            'target_gram_total' => 5,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 107,
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'target_emas_gram' => 10]);
    }

    public function test_goal_dan_rencana_dibuat_sekaligus_dan_gram_per_periode_diderivasi(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser(); // belum ada goal
        $this->buatHargaDanGoal($user);
        $user->update(['target_emas_gram' => null]); // buatHargaDanGoal hanya untuk seed harga/jenis

        // User baru: cukup isi target + durasi; target_gram_per_periode dihitung = goal / durasi.
        $response = $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_emas_gram' => 0.36,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.target_gram_per_periode', 0.012);

        $this->assertDatabaseHas('konfigurasi_setoran_emas', [
            'user_id' => $user->id,
            'nominal_per_periode' => '15000.00',
            'target_gram_per_periode' => '0.012000',
            'durasi_periode' => 30,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'target_emas_gram' => 0.36,
        ]);

        // Total target periode konsisten dengan goal (0.012 × 30 = 0.36).
        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.items.0.progress.target_gram_total', 0.36);
    }

    public function test_ubah_goal_sambil_membuat_rencana_ditolak_saat_goal_terkunci(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->buatHargaDanGoal($user); // goal 10 gr sudah dikunci

        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_emas_gram' => 5,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(422)->assertJsonPath('error_code', 'GOAL_LOCKED');
    }

    public function test_buat_rencana_tanpa_goal_422(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(422)->assertJsonPath('error_code', 'GOAL_NOT_SET');
    }

    public function test_setor_rencana_beli_target_gram_penuh_sisa_masuk_saldo_dana(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis); // nominal 15rb, target 0.012gr → biaya = 0,012 × 1,2jt (markup tier 1-5) = 14.400

        $response = $this->postSetor('/api/v1/emas/setor', ['nominal' => 15000]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal', '15000.00')
            ->assertJsonPath('data.nominal_emas', '14400.00')
            ->assertJsonPath('data.nominal_dana', '600.00')
            ->assertJsonPath('data.unit_didapat', '0.01200000');

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'nominal' => '15000.00',
            'nominal_emas' => '14400.00',
            'nominal_selisih' => '600.00',
            'unit_didapat' => '0.0120',
        ]);
    }

    public function test_setor_atribut_gram_ke_rencana_tujuannya(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);

        // Dua rencana aktif dengan nominal berbeda.
        $rencanaA = $this->buatKonfigurasi($user, $jenis); // 15rb, 0.012gr → biaya 12rb
        $rencanaB = $this->buatKonfigurasi($user, $jenis, [
            'nominal_per_periode' => 50000,
            'target_gram_per_periode' => 0.05,
        ]); // 50rb, 0.05gr → biaya 50rb

        // Setoran terverifikasi diatribusikan ke rencana tujuannya masing-masing.
        $this->buatSetorTerverifikasi($user, $jenis, ['konfigurasi_id' => $rencanaA->id]);
        $this->buatSetorTerverifikasi($user, $jenis, [
            'konfigurasi_id' => $rencanaB->id,
            'nominal' => 50000,
            'nominal_emas' => 50000,
            'nominal_selisih' => 0,
            'unit_didapat' => 0.05,
        ]);

        $response = $this->getJson('/api/v1/emas/setoran-berkala')->assertOk();

        // items urut terbaru dulu: B (0.05gr), lalu A (0.012gr) — tidak saling bocor.
        $response->assertJsonPath('data.items.0.progress.rekap.gram_terkumpul', 0.05)
            ->assertJsonPath('data.items.0.progress.rekap.jumlah_setoran', 1)
            ->assertJsonPath('data.items.1.progress.rekap.gram_terkumpul', 0.012)
            ->assertJsonPath('data.items.1.progress.rekap.jumlah_setoran', 1);
    }

    public function test_admin_cash_setor_mengikuti_rencana_terpilih(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $jenis = $this->buatHargaDanGoal($user);
        $rencanaA = $this->buatKonfigurasi($user, $jenis);
        $this->buatKonfigurasi($user, $jenis, [
            'nominal_per_periode' => 50000,
            'target_gram_per_periode' => 0.05,
        ]);

        Sanctum::actingAs($this->createAdmin());
        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'nominal' => 15000,
            'konfigurasi_id' => $rencanaA->id,
        ])->assertStatus(201);

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'konfigurasi_id' => $rencanaA->id,
            'jenis_transaksi' => 'setor',
        ]);

        Sanctum::actingAs($user);
        // Urut terbaru dulu: B (kosong), lalu A (1 setoran) — setoran masuk ke rencana yang dipilih.
        $this->getJson('/api/v1/emas/setoran-berkala')->assertOk()
            ->assertJsonPath('data.items.0.progress.rekap.jumlah_setoran', 0)
            ->assertJsonPath('data.items.1.progress.rekap.jumlah_setoran', 1);
    }

    public function test_setor_luar_rencana_dikonversi_langsung_ke_gram(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis);

        $response = $this->postSetor('/api/v1/emas/setor', ['nominal' => 20000]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal_emas', '20000.00')
            ->assertJsonPath('data.nominal_dana', '0.00')
            ->assertJsonPath('data.unit_didapat', '0.01666700');
    }

    public function test_setor_rencana_tidak_cukup_semua_masuk_saldo_dana_tanpa_gram(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user, 2000000);
        // Nominal 15rb hanya cukup 0,0075gr @2jt, tapi target 0,012gr → belum dibeli.
        $this->buatKonfigurasi($user, $jenis);

        $response = $this->postSetor('/api/v1/emas/setor', ['nominal' => 15000]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal_emas', '0.00')
            ->assertJsonPath('data.nominal_dana', '15000.00')
            ->assertJsonPath('data.unit_didapat', '0.00000000');
    }

    public function test_setor_rencana_harga_naik_tidak_jatuh_ke_gram_pecahan(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        // Harga menjadi 2jt/gram → biaya 1 gram = 2jt > nominal 1,2jt → tidak boleh "0,6 gram".
        $this->buatKonfigurasi($user, $jenis, [
            'nominal_per_periode' => 1200000,
            'target_gram_per_periode' => 1,
        ]);
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 2000000, 'status_aktif' => true, 'created_by' => $user->id]);

        $response = $this->postSetor('/api/v1/emas/setor', ['nominal' => 1200000]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal_dana', '1200000.00')
            ->assertJsonPath('data.unit_didapat', '0.00000000');
    }

    public function test_setor_rencana_harga_turun_membeli_1_gram_penuh(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis, [
            'nominal_per_periode' => 1200000,
            'target_gram_per_periode' => 1,
        ]);

        // Harga acuan 1jt → harga jual 1 gram = 1jt + markup 200rb = 1,2jt, setoran 1,2jt → 1 gram penuh tanpa sisa.
        $response = $this->postSetor('/api/v1/emas/setor', ['nominal' => 1200000]);

        $response->assertStatus(201)
            ->assertJsonPath('data.nominal_emas', '1200000.00')
            ->assertJsonPath('data.nominal_dana', '0.00')
            ->assertJsonPath('data.unit_didapat', '1.00000000');
    }

    public function test_setor_rencana_memakai_saldo_dana_lama_untuk_lengkapi_1_gram(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis, [
            'nominal_per_periode' => 1500000,
            'target_gram_per_periode' => 1,
        ]);

        // Saldo dana 300rb sudah ada dari setoran terverifikasi sebelumnya
        // (1,5jt diaplikasikan ke 1 gram dgn harga jual = 1jt + markup 200rb = 1,2jt → dana 300rb).
        $sebelumnya = Transaksi::create([
            'nomor_referensi' => 'TRX-SB-LAMA-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 1500000,
            'nominal_emas' => 1200000,
            'nominal_selisih' => 300000,
            'unit_didapat' => 1,
            'harga_per_gram' => 1200000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->subDay()->toDateString(),
        ]);
        $sebelumnya->created_at = now()->subHour();
        $sebelumnya->save();

        // Setor 2 saat harga acuan 1,6jt: harga jual 1 gram = 1,6jt + markup 200rb = 1,8jt
        // = nominal 1,5jt + saldo dana 300rb → tepat cukup.
        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1600000, 'status_aktif' => true, 'created_by' => $user->id]);
        $kedua = $this->postSetor('/api/v1/emas/setor', ['nominal' => 1500000]);

        $kedua->assertStatus(201)
            ->assertJsonPath('data.nominal_emas', '1800000.00')
            ->assertJsonPath('data.nominal_dana', '-300000.00')
            ->assertJsonPath('data.unit_didapat', '1.00000000');
    }

    public function test_progress_menampilkan_rekap_dan_konsistensi(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis);

        for ($i = 0; $i < 2; $i++) {
            $this->buatSetorTerverifikasi($user, $jenis);
        }

        $response = $this->getJson('/api/v1/emas/setoran-berkala');

        $response->assertOk()
            ->assertJsonPath('data.dapat_membuat', true)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.konfigurasi.status', 'aktif')
            ->assertJsonPath('data.items.0.progress.rekap.jumlah_setoran', 2)
            ->assertJsonPath('data.items.0.progress.rekap.saldo_dana', 6000)
            ->assertJsonPath('data.items.0.progress.konsistensi.periode_terlaksana', 2)
            ->assertJsonPath('data.items.0.progress.konsistensi.periode_seharusnya', 1)
            ->assertJsonPath('data.items.0.progress.konsistensi.status', 'tepat_waktu');
    }

    public function test_batalkan_jadi_pengajuan_dan_batal_setelah_diverifikasi(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $konfigurasi = $this->buatKonfigurasi($user, $jenis);
        $this->buatSetorTerverifikasi($user, $jenis, ['konfigurasi_id' => $konfigurasi->id]);

        // Pengajuan batal: rencana TIDAK langsung batal, refund menunggu verifikasi.
        $response = $this->postJson("/api/v1/emas/setoran-berkala/{$konfigurasi->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertOk();
        $refundId = $response->json('data.refund.transaksi_refund_id');
        $this->assertNotNull($refundId);

        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.dapat_membuat', true)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.konfigurasi.status', 'aktif')
            ->assertJsonPath('data.items.0.refund_diajukan', true);

        // Tidak bisa diajukan dua kali / disetor ulang selagi menunggu.
        $this->postJson("/api/v1/emas/setoran-berkala/{$konfigurasi->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'REFUND_PENDING');

        $this->postSetor('/api/v1/emas/setor', [
            'nominal' => 20000,
            'konfigurasi_id' => $konfigurasi->id,
        ])->assertStatus(422)->assertJsonPath('error_code', 'REFUND_PENDING');

        // Verifikasi admin → rencana resmi BATAL, slot terbuka lagi, bisa buat ulang.
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/transaksi/{$refundId}/verifikasi")->assertOk();

        $this->actingAsUser();
        $this->assertDatabaseHas('konfigurasi_setoran_emas', ['id' => $konfigurasi->id, 'status' => 'batal']);
        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.dapat_membuat', true)
            ->assertJsonCount(0, 'data.items');

        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'mingguan',
            'durasi_periode' => 12,
        ])->assertStatus(201);
    }

    public function test_batalkan_per_rencana_membuat_refund_potongan_10_persen(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user, 1000000);
        $rencana = $this->buatKonfigurasi($user, $jenis);

        // Satu setoran rencana terverifikasi: 0,012gr (biaya 12.000) + saldo dana 3.000.
        $this->buatSetorTerverifikasi($user, $jenis, ['konfigurasi_id' => $rencana->id]);

        // Refund baru: potongan 10% hanya dari TOTAL SETORAN EMAS (nominal 15.000 →
        // potongan 1.500), bukan dari nilai pasar gram. Nilai emas 0,012gr × 1,2jt =
        // 14.400 − 1.500 = 12.900; saldo dana 3.000 dikembalikan penuh → total 15.900.
        $response = $this->postJson("/api/v1/emas/setoran-berkala/{$rencana->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.rencana.status', 'aktif')
            ->assertJsonPath('data.refund.gram_dibatalkan', 0.012)
            ->assertJsonPath('data.refund.nilai_gram', 14400)
            ->assertJsonPath('data.refund.total_setoran_emas', 15000)
            ->assertJsonPath('data.refund.refund_emas', 12900)
            ->assertJsonPath('data.refund.penalti_10_persen', 1500)
            ->assertJsonPath('data.refund.saldo_dana', 3000)
            ->assertJsonPath('data.refund.nominal_refund', 15900);

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'konfigurasi_id' => $rencana->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => '15900.00',
            'biaya_penalti' => '1500.00',
            'nominal_selisih' => '-3000.00',
            'unit_didapat' => '-0.0120',
            'status_verifikasi' => 'menunggu_verifikasi',
        ]);

        // Rencana kosong langsung batal (tidak ada yang direfund).
        $rencanaB = $this->buatKonfigurasi($user, $jenis);
        $this->postJson("/api/v1/emas/setoran-berkala/{$rencanaB->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertOk()
            ->assertJsonPath('data.refund.nominal_refund', 0)
            ->assertJsonPath('data.rencana.status', 'batal');

        $this->assertDatabaseHas('konfigurasi_setoran_emas', [
            'id' => $rencanaB->id,
            'status' => 'batal',
        ]);

        // Rencana yang masih punya pengajuan refund tidak bisa diajukan ulang.
        $this->postJson("/api/v1/emas/setoran-berkala/{$rencana->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'REFUND_PENDING');

        // Verifikasi refund admin → rencana pertama resmi batal.
        $refundId = $response->json('data.refund.transaksi_refund_id');
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/transaksi/{$refundId}/verifikasi")->assertOk();
        $this->assertDatabaseHas('konfigurasi_setoran_emas', ['id' => $rencana->id, 'status' => 'batal']);
    }

    public function test_refund_penalti_berbasis_total_setoran_emas_saja_saldo_dana_bebas_potongan(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user, 1000000);
        $rencana = $this->buatKonfigurasi($user, $jenis);

        // Setoran A: berhasil jadi gram 0,012gr (nominal 15.000, sisa 3.000 → dana).
        $this->buatSetorTerverifikasi($user, $jenis, ['konfigurasi_id' => $rencana->id]);
        // Setoran B: SELURUH nominal masuk saldo dana (unit 0) — tidak boleh jadi dasar potongan.
        $this->buatSetorTerverifikasi($user, $jenis, [
            'konfigurasi_id' => $rencana->id,
            'nominal_emas' => 0,
            'nominal_selisih' => 15000,
            'unit_didapat' => 0,
        ]);

        // Potongan = 10% × 15.000 (hanya setoran A) = 1.500; nilai emas 0,012 × 1,2jt =
        // 14.400 − 1.500 = 12.900; saldo dana (3.000 + 15.000 = 18.000) dikembalikan penuh → 30.900.
        $this->postJson("/api/v1/emas/setoran-berkala/{$rencana->id}/batalkan", [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])
            ->assertOk()
            ->assertJsonPath('data.refund.gram_dibatalkan', 0.012)
            ->assertJsonPath('data.refund.total_setoran_emas', 15000)
            ->assertJsonPath('data.refund.nilai_gram', 14400)
            ->assertJsonPath('data.refund.refund_emas', 12900)
            ->assertJsonPath('data.refund.penalti_10_persen', 1500)
            ->assertJsonPath('data.refund.saldo_dana', 18000)
            ->assertJsonPath('data.refund.nominal_refund', 30900);

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'konfigurasi_id' => $rencana->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => '30900.00',
            'biaya_penalti' => '1500.00',
            'nominal_selisih' => '-18000.00',
            'unit_didapat' => '-0.0120',
        ]);
    }

    public function test_cairkan_dana_mengurangi_saldo(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis);

        for ($i = 0; $i < 2; $i++) {
            $this->buatSetorTerverifikasi($user, $jenis);
        }

        $response = $this->postJson('/api/v1/emas/dana/cair', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'tarik')
            ->assertJsonPath('data.nominal', '6000.00')
            ->assertJsonPath('data.nominal_dana', '-6000.00')
            ->assertJsonPath('data.unit_didapat', '0.00000000');

        // Belum terverifikasi → saldo dana belum berkurang, tapi pencairan kedua diblokir.
        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.items.0.progress.rekap.saldo_dana', 6000);

        $this->postJson('/api/v1/emas/dana/cair', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'INSUFFICIENT_BALANCE');
    }

    public function test_cair_dana_nominal_parsial_dibatasi_saldo(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis);
        $this->buatSetorTerverifikasi($user, $jenis); // saldo dana 3000

        // Parsial melebihi saldo → ditolak.
        $this->postJson('/api/v1/emas/dana/cair', [
            'nominal' => 500000,
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'INSUFFICIENT_BALANCE'); // melebihi saldo 3000

        $this->postJson('/api/v1/emas/dana/cair', [
            'nominal' => 5000,
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422); // di bawah min 10.000
    }

    public function test_cair_dana_tanpa_saldo_422(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->postJson('/api/v1/emas/dana/cair', [
            'bank_tujuan' => 'BSI',
            'no_rekening' => '7123456789',
            'atas_nama' => 'Ahmad',
        ])->assertStatus(422)->assertJsonPath('error_code', 'INSUFFICIENT_BALANCE');
    }

    public function test_rencana_pertama_tanpa_goal_global_menetapkan_target_dan_bisa_setor(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $this->assertNull($user->fresh()->target_emas_gram);

        HargaEmasHarian::create(['tanggal' => now()->toDateString(), 'harga_per_gram' => 1000000, 'status_aktif' => true, 'created_by' => $user->id]);

        $response = $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 15000,
            'target_gram_total' => 10,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 30,
        ])->assertStatus(201);

        $this->assertEqualsWithDelta(10, (float) $user->fresh()->target_emas_gram, 0.000001);

        $konfigurasi = KonfigurasiSetoranEmas::where('user_id', $user->id)->first();

        $this->postSetor('/api/v1/emas/setor', [
            'nominal' => 15000,
            'konfigurasi_id' => $konfigurasi->id,
        ])->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'setor');
    }

    public function test_konfigurasi_otomatis_selesai_setelah_deadline(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis, [
            'tanggal_mulai' => now()->subDays(2)->toDateString(),
            'durasi_periode' => 1,
            'tanggal_deadline' => now()->subDays(2)->toDateString(),
        ]);

        $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->assertJsonPath('data.dapat_membuat', true)
            ->assertJsonCount(0, 'data.items');

        $this->assertDatabaseHas('konfigurasi_setoran_emas', [
            'user_id' => $user->id,
            'status' => 'selesai',
        ]);
    }

    public function test_saldo_awal_legacy_tanpa_tanda_hanya_diatribusikan_ke_rencana_tertua(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);

        $rencanaLama = $this->buatKonfigurasi($user, $jenis);
        $rencanaBaru = $this->buatKonfigurasi($user, $jenis);

        // Saldo awal import tanpa konfigurasi_id (jalur UsersImport / TabunganImportService:608,630).
        Transaksi::create([
            'nomor_referensi' => 'TRX-SA-' . uniqid(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'catatan_admin' => 'Saldo awal import (SALDO_AWAL_IMPORT).',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $service = app(SaldoEmasService::class);

        $this->assertSame(15000.0, $service->getSaldoRencana($user, $rencanaLama)['nominal']);
        $this->assertSame(0.0, $service->getSaldoRencana($user, $rencanaBaru)['nominal']);
    }

    public function test_goal_global_hilang_hanya_kala_rencana_terakhir_batal(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $rencana = $this->buatKonfigurasi($user, $jenis);

        $service = app(SaldoEmasService::class);

        // Masih ada rencana aktif → goal tidak boleh hilang.
        $service->bersihkanGoalKalaRencanaHabis($user, $jenis->id);
        $this->assertEqualsWithDelta(10.0, (float) $user->fresh()->target_emas_gram, 0.000001);

        // Rencana terakhir dibatalkan → goal dibersihkan.
        $rencana->update(['status' => 'batal']);
        $service->bersihkanGoalKalaRencanaHabis($user, $jenis->id);
        $this->assertNull($user->fresh()->target_emas_gram);
    }

    public function test_verifikasi_pencairan_saldo_dana_tidak_menghapus_goal_emas(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);
        $this->buatKonfigurasi($user, $jenis);

        // Saldo dana Rp 50.000 terverifikasi, lalu pengajuan pencairan dana-only
        // (unit_didapat 0, tanpa konfigurasi_id) seperti /emas/dana/cair.
        Transaksi::create([
            'nomor_referensi' => 'TRX-D1-' . uniqid(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 50000,
            'nominal_selisih' => 50000,
            'unit_didapat' => 0,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        $tarik = Transaksi::create([
            'nomor_referensi' => 'TRX-D2-' . uniqid(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'tarik',
            'nominal' => 20000,
            'nominal_selisih' => -20000,
            'unit_didapat' => 0,
            'metode_pembayaran' => 'transfer',
            'status_verifikasi' => 'menunggu_verifikasi',
            'tanggal_transaksi' => now()->toDateString(),
        ]);

        Sanctum::actingAs($this->createAdmin());

        $this->postJson('/api/v1/admin/transaksi/' . $tarik->id . '/verifikasi')
            ->assertOk();

        // Pencairan dana tidak menyentuh gram → goal emas harus tetap ada.
        $this->assertEqualsWithDelta(10.0, (float) $user->fresh()->target_emas_gram, 0.000001);
    }

    public function test_e2e_multi_rencana_saldo_awal_import_tidak_dobel_dan_setoran_bertanda_tetap_masuk_rencananya(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $jenis = $this->buatHargaDanGoal($user);

        // Dua rencana aktif, nominal per periode sama (memicu konflik atribusi legacy).
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 50000,
            'target_gram_per_periode' => 0.05,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 10,
        ])->assertStatus(201);
        $this->postSetoranBerkala($user, [
            'nominal_per_periode' => 50000,
            'target_gram_per_periode' => 0.05,
            'frekuensi_setor' => 'harian',
            'durasi_periode' => 10,
        ])->assertStatus(201);

        $rencanaA = KonfigurasiSetoranEmas::where('user_id', $user->id)->orderBy('id')->first();
        $rencanaB = KonfigurasiSetoranEmas::where('user_id', $user->id)->orderByDesc('id')->first();

        // Import saldo awal 200.000 TANPA konfigurasi_id (jalur UsersImport / TabunganImportService:608,630).
        Sanctum::actingAs($this->createAdmin());
        $harga = HargaEmasHarian::whereDate('tanggal', now()->toDateString())->firstOrFail();
        app(SaldoAwalService::class)->atur($user, $jenis->id, 200000, null, [
            'unit_didapat' => '0.200000',
            'nominal_emas' => 200000,
            'nominal_selisih' => 0,
            'harga_acuan_id' => $harga->id,
            'harga_acuan_snapshot' => 1000000,
        ]);

        // Saldo awal hanya dihitung SATU kali, di rencana tertua.
        Sanctum::actingAs($user);
        $items = $this->getJson('/api/v1/emas/setoran-berkala')
            ->assertOk()
            ->json('data.items');

        $getTotalSetor = fn (array $items, int $id): float => (float) collect($items)
            ->first(fn ($i) => $i['konfigurasi']['id'] === $id)['progress']['rekap']['nominal_total_setor'];
        $getGram = fn (array $items, int $id): float => (float) collect($items)
            ->first(fn ($i) => $i['konfigurasi']['id'] === $id)['progress']['rekap']['gram_terkumpul'];

        $this->assertSame(200000.0, $getTotalSetor($items, $rencanaA->id));
        $this->assertSame(0.0, $getTotalSetor($items, $rencanaB->id));
        $this->assertEqualsWithDelta(0.2, $getGram($items, $rencanaA->id), 0.000001);
        $this->assertEqualsWithDelta(0.0, $getGram($items, $rencanaB->id), 0.000001);

        // Setoran BARU yang bertanda konfigurasi tetap masuk rencananya sendiri.
        $setor = $this->postSetor('/api/v1/emas/setor', [
            'nominal' => 50000,
            'konfigurasi_id' => $rencanaB->id,
        ])->assertStatus(201);

        // Simulasi admin memverifikasi setoran (baru terhitung setelah terverifikasi).
        Sanctum::actingAs($this->createAdmin());
        $this->postJson('/api/v1/admin/transaksi/' . $setor->json('data.id') . '/verifikasi')->assertOk();

        Sanctum::actingAs($user);
        $items = $this->getJson('/api/v1/emas/setoran-berkala')->assertOk()->json('data.items');
        $this->assertSame(50000.0, $getTotalSetor($items, $rencanaB->id));
        $this->assertSame(200000.0, $getTotalSetor($items, $rencanaA->id));
        // Nominal 50000 < biaya 0.05g x harga-jual (acuan+markup) → mengendap di dana rencana, bukan gram.
        $this->assertSame(0.0, $getGram($items, $rencanaB->id));
        $this->assertEqualsWithDelta(50000.0, (float) collect($items)
            ->first(fn ($i) => $i['konfigurasi']['id'] === $rencanaB->id)['progress']['rekap']['saldo_dana_rencana'], 0.000001);
    }
}