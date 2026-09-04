<?php

namespace Tests\Feature;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use Illuminate\Support\Facades\DB;
use Tests\ApiTestCase;

class DashboardTest extends ApiTestCase
{
    public function test_dashboard_user_menghitung_saldo_dan_pending(): void
    {
        $this->seedBase();
        $admin = $this->createAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $setor = Transaksi::create([
            'nomor_referensi' => 'TRX-D1', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Setor, 'nominal' => 250000, 'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi, 'tanggal_transaksi' => now()->toDateString(),
        ]);
        $setor->update(['status_verifikasi' => StatusVerifikasi::Terverifikasi, 'diverifikasi_oleh' => $admin->id, 'diverifikasi_pada' => now()]);

        Transaksi::create([
            'nomor_referensi' => 'TRX-D2', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Setor, 'nominal' => 50000, 'metode_pembayaran' => 'cash',
            'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi, 'tanggal_transaksi' => now()->toDateString(),
        ]);

        \Laravel\Sanctum\Sanctum::actingAs($user);

        $this->getJson('/api/v1/dashboard')->assertOk()
            ->assertJsonPath('data.transaksi_pending', 1);
    }

    public function test_progress_per_jenis_emas_menyertakan_total_unit(): void
    {
        $this->seedBase();
        $admin = $this->createAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'emas-harian')->first();

        $trx = Transaksi::create([
            'nomor_referensi' => 'TRX-D3', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Setor, 'nominal' => 100000, 'unit_didapat' => 0.1,
            'metode_pembayaran' => 'cash', 'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'diverifikasi_oleh' => $admin->id, 'diverifikasi_pada' => now(), 'tanggal_transaksi' => now()->toDateString(),
        ]);

        \Laravel\Sanctum\Sanctum::actingAs($user);

        $this->getJson("/api/v1/dashboard/{$jenis->id}/progress")
            ->assertOk()
            ->assertJsonPath('data.total_unit', 0.1)
            ->assertJsonPath('data.saldo', 100000);
    }

    public function test_admin_dashboard_kpi(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('Admin dashboard memakai TIMESTAMPDIFF khusus MySQL; test DB memakai SQLite.');
        }

        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser();

        $this->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.total_nasabah_aktif', 1)
            ->assertJsonPath('data.total_nasabah_pending', 0);
    }
}
