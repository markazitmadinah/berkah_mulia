<?php

namespace Tests\Feature;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class TabunganPribadiTest extends ApiTestCase
{
    private function pribadiJenis(): JenisTabungan
    {
        return JenisTabungan::where('kode', 'tabungan-pribadi')->first();
    }

    private function createVerified(Transaksi $t, int $adminId): Transaksi
    {
        $t->update([
            'status_verifikasi' => StatusVerifikasi::Terverifikasi,
            'diverifikasi_oleh' => $adminId,
            'diverifikasi_pada' => now(),
        ]);

        return $t;
    }

    public function test_setor_pribadi(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->postSetor('/api/v1/tabungan-pribadi/setor', [
            'nominal' => 100000,
        ])->assertStatus(201)->assertJsonPath('data.status_verifikasi', 'menunggu_verifikasi');
    }

    public function test_tarik_pribadi_berhasil(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->postJson('/api/v1/tabungan-pribadi/tarik', ['nominal' => 50000])
            ->assertStatus(201)
            ->assertJsonPath('data.jenis_transaksi', 'tarik');
    }

    public function test_tarik_ditolak_jika_allow_withdrawal_false(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        $this->pribadiJenis()->update(['allow_withdrawal' => false]);

        $this->postJson('/api/v1/tabungan-pribadi/tarik', ['nominal' => 50000])
            ->assertStatus(403)->assertJsonPath('error_code', 'WITHDRAWAL_NOT_ALLOWED');
    }

    public function test_progress_menghitung_saldo_hanya_terverifikasi(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = $this->pribadiJenis();

        $setor1 = Transaksi::create([
            'nomor_referensi' => 'TRX-P1', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Setor, 'nominal' => 100000, 'metode_pembayaran' => 'cash',
            'tanggal_transaksi' => now()->toDateString(), 'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
        ]);
        $setor2 = Transaksi::create([
            'nomor_referensi' => 'TRX-P2', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Setor, 'nominal' => 200000, 'metode_pembayaran' => 'cash',
            'tanggal_transaksi' => now()->toDateString(), 'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
        ]);
        $tarik = Transaksi::create([
            'nomor_referensi' => 'TRX-P3', 'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Tarik, 'nominal' => 50000, 'metode_pembayaran' => 'transfer',
            'tanggal_transaksi' => now()->toDateString(), 'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
        ]);
        $this->createVerified($setor1, $admin->id);
        $this->createVerified($tarik, $admin->id);

        \Laravel\Sanctum\Sanctum::actingAs($user);

        $this->getJson('/api/v1/tabungan-pribadi/progress')
            ->assertOk()
            ->assertJsonPath('data.total_setoran', 100000)
            ->assertJsonPath('data.total_penarikan', 50000)
            ->assertJsonPath('data.saldo', 50000)
            ->assertJsonPath('data.pending_amount', 200000);
    }
}
