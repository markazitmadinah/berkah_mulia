<?php

namespace Tests\Feature;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Enums\SubJenisTabungan;
use App\Exports\TransaksiExport;
use App\Exports\TransaksiPembukuanExport;
use App\Exports\TransaksiRekapExport;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use Tests\ApiTestCase;

class TransaksiTest extends ApiTestCase
{
    private function createPendingTransaksi(int $userId, int $jenisId, int $nominal = 100000, $pendaftaranId = null): Transaksi
    {
        return Transaksi::create([
            'nomor_referensi' => 'TRX-'.strtoupper(uniqid()),
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

    public function test_cash_qurban_ditolak_kurang_dari_satu_periode(): void
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
        $hewan = HewanQurban::create(['jenis_hewan' => 'Lembu', 'harga_per_unit' => 8000000, 'periode_qurban_id' => $periode->id, 'created_by' => auth()->id()]);
        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => 1,
            'target_dana' => 8000000,
            'status' => 'menabung',
            'frekuensi_setor' => 'harian',
            'nominal_per_periode' => 29520.30,
            'tanggal_daftar' => now()->toDateString(),
        ]);
        $jenis = JenisTabungan::where('tipe', 'qurban')->first();

        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'pendaftaran_qurban_id' => $pendaftaran->id,
            'nominal' => 20000,
        ])->assertStatus(422)->assertJsonPath('error_code', 'NOMINAL_KURANG_1_PERIODE');

        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'pendaftaran_qurban_id' => $pendaftaran->id,
            'nominal' => 29520.30,
        ])->assertStatus(201);
    }

    public function test_cash_transaksi_berjangka_terhubung_akun_spesifik(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser();

        $jenis = JenisTabungan::where('sub_jenis', SubJenisTabungan::Berjangka)->firstOrFail();
        $tb = TabunganBerjangka::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'target_nominal' => 600000,
            'durasi_bulan' => 6,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 100000,
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths(6)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $admin->id,
            'approved_at' => now(),
            'created_by' => $admin->id,
        ]);

        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'tabungan_berjangka_id' => $tb->id,
            'nominal' => 200000,
        ])->assertStatus(201)->assertJsonPath('data.status_verifikasi', 'terverifikasi');

        $this->assertDatabaseHas('transaksi', [
            'tabungan_berjangka_id' => $tb->id,
            'status_verifikasi' => 'terverifikasi',
            'user_id' => $user->id,
        ]);
        $this->assertEquals(200000.0, $tb->terkumpulNominal());

        // Berjangka milik user lain → ditolak
        $userLain = $this->createUser(['email' => 'lain@example.com', 'phone' => '081211199932']);
        $this->postJson('/api/v1/admin/transaksi/cash', [
            'user_id' => $userLain->id,
            'jenis_tabungan_id' => $jenis->id,
            'tabungan_berjangka_id' => $tb->id,
            'nominal' => 50000,
        ])->assertStatus(422)->assertJsonPath('error_code', 'BERJANGKA_TIDAK_COCOK');
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

    public function test_admin_filter_transaksi_per_tanggal(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $trx = $this->createPendingTransaksi($user->id, $jenis->id, 150000);

        $dalamRentang = now()->toDateString();
        $trx->update(['tanggal_transaksi' => $dalamRentang]);
        $this->createPendingTransaksi($user->id, $jenis->id, 250000)
            ->update(['tanggal_transaksi' => now()->subDays(30)->toDateString()]);

        $this->getJson('/api/v1/admin/transaksi?per_page=50&tanggal_awal='.now()->subDay()->toDateString().'&tanggal_akhir='.now()->addDay()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.nomor_referensi', $trx->nomor_referensi);

        $this->getJson('/api/v1/admin/transaksi?tanggal_awal=bukan-tanggal')
            ->assertStatus(422);
    }

    public function test_admin_export_transaksi_per_tanggal(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $this->createPendingTransaksi($user->id, $jenis->id, 500000);
        $this->createPendingTransaksi($user->id, $jenis->id, 75000)
            ->update(['tanggal_transaksi' => now()->subDays(7)->toDateString()]);

        $res = $this->get('/api/v1/admin/transaksi/export?tanggal_awal=&tanggal_akhir='.now()->toDateString());
        $res->assertStatus(200);
        $res->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('.xlsx', $res->headers->get('content-disposition'));
    }

    public function test_admin_filter_transaksi_jenis_search_dan_export_memakai_kriteria_yang_sama(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser([
            'name' => 'Nasabah Filter',
            'phone' => '081299991111',
            'nomor_anggota' => '1000000099',
        ]);
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $jenisLain = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();
        $matched = $this->createPendingTransaksi($user->id, $jenis->id, 125000);
        $this->createPendingTransaksi($user->id, $jenisLain->id, 250000);

        $query = http_build_query([
            'per_page' => 1000,
            'jenis_tabungan_id' => $jenis->id,
            'search' => '1000000099',
        ]);

        $this->getJson('/api/v1/admin/transaksi?'.$query)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $matched->id)
            ->assertJsonPath('data.0.user_nomor_anggota', '1000000099');

        $filters = [
            'jenis_tabungan_id' => $jenis->id,
            'search' => '1000000099',
        ];
        $this->assertSame([$matched->id], (new TransaksiExport($filters))->query()->pluck('id')->all());
        $this->assertSame(1, (new TransaksiRekapExport($filters))->array()[1][4]);

        $this->get('/api/v1/admin/transaksi/export?'.$query)
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    public function test_export_transaksi_semua_hanya_satu_sheet_dengan_footer_total_1_baris(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $setor = $this->createPendingTransaksi($user->id, $jenis->id, 500000);
        $setor->update(['jenis_transaksi' => JenisTransaksi::Setor, 'status_verifikasi' => StatusVerifikasi::Terverifikasi]);
        $tarik = $this->createPendingTransaksi($user->id, $jenis->id, 150000);
        $tarik->update(['jenis_transaksi' => JenisTransaksi::Tarik, 'status_verifikasi' => StatusVerifikasi::Terverifikasi]);

        $path = tempnam(sys_get_temp_dir(), 'trx') . '.xlsx';
        file_put_contents($path, Excel::raw(new TransaksiPembukuanExport(['aliran' => 'semua']), \Maatwebsite\Excel\Excel::XLSX));

        $wb = IOFactory::load($path);
        $sheet = $wb->getSheetByName('Data Transaksi');
        $this->assertNotNull($sheet, 'Sheet Data Transaksi harus ada');

        $last = $sheet->getHighestRow();
        // Footer: label+nilai digabung (merge) jadi satu sel per aliran.
        $this->assertSame('Uang Masuk: Rp 500.000', $sheet->getCell('A'.$last)->getValue());
        $this->assertSame('Uang Keluar: Rp 150.000', $sheet->getCell('D'.$last)->getValue());
        $this->assertSame('Total: Rp 350.000', $sheet->getCell('G'.$last)->getValue());

        unlink($path);
    }

    public function test_export_transaksi_aliran_masuk_footer_total_saja(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $jenis = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $setor = $this->createPendingTransaksi($user->id, $jenis->id, 500000);
        $setor->update(['jenis_transaksi' => JenisTransaksi::Setor, 'status_verifikasi' => StatusVerifikasi::Terverifikasi]);
        $tarik = $this->createPendingTransaksi($user->id, $jenis->id, 150000);
        $tarik->update(['jenis_transaksi' => JenisTransaksi::Tarik, 'status_verifikasi' => StatusVerifikasi::Terverifikasi]);

        $path = tempnam(sys_get_temp_dir(), 'trx') . '.xlsx';
        file_put_contents($path, Excel::raw(new TransaksiPembukuanExport(['aliran' => 'masuk']), \Maatwebsite\Excel\Excel::XLSX));

        $wb = IOFactory::load($path);
        $sheet = $wb->getSheetByName('Data Transaksi');
        $last = $sheet->getHighestRow();
        $this->assertSame('Total Uang Masuk: Rp 500.000', $sheet->getCell('A'.$last)->getValue());
        $this->assertGreaterThan(1, $last);

        unlink($path);
    }
}
