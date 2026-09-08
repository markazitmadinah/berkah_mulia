<?php

namespace Tests\Feature;

use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\TipeNotifikasi;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Notifikasi;
use App\Models\Transaksi;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\ApiTestCase;

class PengingatSetoranTest extends ApiTestCase
{
    use RefreshDatabase;

    private function buatKonfigurasi(\App\Models\User $user, array $overrides = [], ?Carbon $mulai = null): KonfigurasiSetoranEmas
    {
        return KonfigurasiSetoranEmas::create(array_merge([
            'user_id' => $user->id,
            'jenis_tabungan_id' => \App\Models\JenisTabungan::where('tipe', 'emas')->first()->id,
            'nominal_per_periode' => 15000,
            'target_gram_per_periode' => 0.012,
            'frekuensi_setor' => 'harian',
            'tanggal_mulai' => ($mulai ?: now())->toDateString(),
            'durasi_periode' => 30,
            'tanggal_deadline' => now()->addDays(30)->toDateString(),
            'status' => StatusKonfigurasiSetoran::Aktif,
            'created_by' => $user->id,
        ], $overrides));
    }

    public function test_harian_selalu_dikurangi_tiap_hari(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->buatKonfigurasi($user, ['frekuensi_setor' => 'harian']);

        Carbon::setTestNow('2026-03-10 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();

        $notif = Notifikasi::first();
        $this->assertEquals('Pengingat Setor Tabungan Emas', $notif->judul);
        $this->assertEquals('harian', $notif->data['frekuensi_setor']);
        $this->assertEquals(15000.0, $notif->data['nominal_per_periode']);
        $this->assertEquals('2026-03-10', $notif->data['tanggal_jatuh_tempo']);
        $this->assertDatabaseHas('notifikasi', [
            'user_id' => $user->id,
            'tipe' => TipeNotifikasi::PengingatSetor->value,
        ]);

        Carbon::setTestNow();
    }

    public function test_mingguan_hanya_pada_hari_yang_sama(): void
    {
        $this->seedBase();
        $user = $this->createUser();

        // Mulai Selasa, 2026-03-03.
        $mulai = Carbon::parse('2026-03-03'); // Selasa
        $this->buatKonfigurasi($user, ['frekuensi_setor' => 'mingguan'], $mulai);

        // Selasa berikutnya, 2026-03-10 → dapat pengingat.
        Carbon::setTestNow('2026-03-10 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseCount('notifikasi', 1);

        // Rabu, 2026-03-11 → tidak.
        Carbon::setTestNow('2026-03-11 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseCount('notifikasi', 1);

        Carbon::setTestNow();
    }

    public function test_bulanan_pada_tanggal_sama_dan_akhir_bulan(): void
    {
        $this->seedBase();
        $user = $this->createUser();

        // Mulai tanggal 8.
        $bulanMulai = Carbon::parse('2026-03-08');
        $this->buatKonfigurasi($user, ['frekuensi_setor' => 'bulanan'], $bulanMulai);

        // Tanggal 8 bulan berikutnya → dapat pengingat.
        Carbon::setTestNow('2026-04-08 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseCount('notifikasi', 1);

        // Tanggal 9 → tidak.
        Carbon::setTestNow('2026-04-09 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseCount('notifikasi', 1);

        // Mulai tanggal 31 → jatuh tempo ditanggal 30 (bulan 31 → 30 hari) & 28 Februari.
        $user2 = $this->createUser();
        $this->buatKonfigurasi($user2, ['frekuensi_setor' => 'bulanan'], Carbon::parse('2026-01-31'));

        Carbon::setTestNow('2026-04-30 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseHas('notifikasi', ['user_id' => $user2->id]);

        Carbon::setTestNow('2026-02-28 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->assertDatabaseHas('notifikasi', [
            'user_id' => $user2->id,
            'created_at' => '2026-02-28 10:00:00',
        ]);

        Carbon::setTestNow();
    }

    public function test_running_dua_kali_hari_sama_tidak_duplikat(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->buatKonfigurasi($user, ['frekuensi_setor' => 'harian']);

        Carbon::setTestNow('2026-03-10 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();
        $this->artisan('pengingat:setoran')->assertSuccessful();

        $this->assertDatabaseCount('notifikasi', 1);

        Carbon::setTestNow();
    }

    public function test_sudah_setor_hari_ini_tidak_diingatkan(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $konfig = $this->buatKonfigurasi($user, ['frekuensi_setor' => 'harian']);

        Carbon::setTestNow('2026-03-10 08:00:00');
        Transaksi::create([
            'nomor_referensi' => 'TRX-PG-' . strtoupper(uniqid()),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $konfig->jenis_tabungan_id,
            'konfigurasi_id' => $konfig->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 15000,
            'nominal_emas' => 12000,
            'nominal_selisih' => 3000,
            'unit_didapat' => 0.012,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'menunggu_verifikasi',
            'tanggal_transaksi' => '2026-03-10',
        ]);

        Carbon::setTestNow('2026-03-10 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();

        $this->assertDatabaseCount('notifikasi', 0);

        Carbon::setTestNow();
    }

    public function test_deadline_terlewat_tidak_diingatkan(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $this->buatKonfigurasi($user, [
            'frekuensi_setor' => 'harian',
            'tanggal_deadline' => '2026-03-05',
        ]);

        Carbon::setTestNow('2026-03-10 10:00:00');
        $this->artisan('pengingat:setoran')->assertSuccessful();

        $this->assertDatabaseCount('notifikasi', 0);

        Carbon::setTestNow();
    }
}