<?php

namespace Tests\Feature;

use App\Exports\UsersTemplate;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\ProgressCalculatorService;
use Illuminate\Http\UploadedFile;
use Tests\ApiTestCase;

class UserImportTabunganTest extends ApiTestCase
{
    /**
     * CSV mengikuti heading template (53 kolom). Blok kosong = produk tidak dimiliki.
     * Heading TIDAK dikunci ke posisi kolom; dipetakan via nama heading → nilai.
     */
    private function csv(array $set = []): string
    {
        return $this->csvMulti([$set]);
    }

    /**
     * Satu baris heading (dari template) + N baris data. Baris kedua contoh
     * template tidak disertakan sehingga seluruh baris adalah data nasabah.
     */
    private function csvMulti(array $dataRows): string
    {
        $headings = (new UsersTemplate)->headings();

        $lines = [implode(',', $headings)];
        foreach ($dataRows as $set) {
            $vals = array_map(fn (string $h) => $set[$h] ?? '', $headings);
            $lines[] = implode(',', $vals);
        }

        return implode("\n", $lines)."\n";
    }

    private function importCsv(array $set, string $namaFile = 'nasabah.csv'): \Illuminate\Testing\TestResponse
    {
        return $this->post('/api/v1/admin/users/import', [
            'file' => UploadedFile::fake()->createWithContent($namaFile, $this->csv($set)),
        ]);
    }

    /**
     * Kolom "Yang Sudah Terkumpul" per produk (heading → nilai) untuk satu baris nasabah.
     */
    private function setTerkumpul(int $mandiri = 0, int $emas = 0, int $hariRaya = 0, int $qurban = 0, int $berjangka = 0): array
    {
        return [
            'Mandiri - Yang Sudah Terkumpul (Rp)' => $mandiri > 0 ? (string) $mandiri : '',
            'Emas - Yang Sudah Terkumpul (Rp)' => $emas > 0 ? (string) $emas : '',
            'Hari Raya - Yang Sudah Terkumpul (Rp)' => $hariRaya > 0 ? (string) $hariRaya : '',
            'Qurban - Yang Sudah Terkumpul (Rp)' => $qurban > 0 ? (string) $qurban : '',
            'Berjangka - Yang Sudah Terkumpul (Rp)' => $berjangka > 0 ? (string) $berjangka : '',
        ];
    }

    public function test_import_membuat_target_dan_saldo_awal_tabungan(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $res = $this->importCsv([
            'Nama Lengkap' => 'Nasabah Import',
            'Peran' => 'Nasabah',
            'Status' => 'Aktif',
            'Mandiri - Yang Sudah Terkumpul (Rp)' => '500000',
            'Hari Raya - Target (Rp)' => '1000000',
            'Hari Raya - Frekuensi Bayar' => 'bulanan',
            'Hari Raya - Nominal per Periode (Rp)' => '208333',
            'Hari Raya - Durasi (Periode)' => '5',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 1);

        $user = User::where('name', 'Nasabah Import')->firstOrFail();

        // Target tersimpan untuk Hari Raya beserta rincian setoran.
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $hr->id,
            'target_nominal' => 1000000,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 208333,
            'durasi_periode' => 5,
        ]);

        // Saldo awal mandiri tercatat sebagai setoran terverifikasi (langsung masuk saldo).
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $admin->id,
        ]);

        // Terintegrasi dengan tabungan: saldo & target tampil di progress.
        $progress = app(ProgressCalculatorService::class)->getProgress($user, $mandiri);
        $this->assertEquals(500000, $progress['saldo']);
    }

    public function test_reimport_memperbarui_dana_tanpa_duplikat(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $this->importCsv([
            'Nama Lengkap' => 'Nasabah Import',
            'Mandiri - Yang Sudah Terkumpul (Rp)' => '500000',
            'Hari Raya - Target (Rp)' => '1000000',
        ]);

        // Import ulang dengan dana baru → di-update, bukan duplikat.
        $this->importCsv([
            'Nama Lengkap' => 'Nasabah Import',
            'Mandiri - Yang Sudah Terkumpul (Rp)' => '750000',
            'Hari Raya - Target (Rp)' => '2000000',
        ], 'b.csv')
            ->assertOk()
            ->assertJsonPath('data.jumlah_diupdate', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_diubah', 1);

        $user = User::where('name', 'Nasabah Import')->firstOrFail();

        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $hr->id,
            'target_nominal' => 2000000,
        ]);

        // Hanya 1 catatan saldo awal per tabungan.
        $this->assertSame(1, Transaksi::withTrashed()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $mandiri->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'nominal' => 750000,
        ]);
    }

    public function test_import_tanpa_kolom_tabungan_tetap_berhasil(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->importCsv(['Nama Lengkap' => 'Nasabah Polos'])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 0);

        $this->assertDatabaseCount('user_tabungan_target', 0);
        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_import_baris_produk_separuh_tidak_membatalkan_user(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        // Nama polos (semua produk kosong) + target emas separuh (tanpa rincian).
        $csv = $this->csvMulti([
            ['Nama Lengkap' => 'Non Nabung', 'Peran' => 'Nasabah', 'Status' => 'Aktif'],
            ['Nama Lengkap' => 'Emas Separuh', 'Peran' => 'Nasabah', 'Status' => 'Aktif', 'Emas - Target (gram)' => '25'],
        ]);

        $res = $this->post('/api/v1/admin/users/import', [
            'file' => UploadedFile::fake()->createWithContent('separuh.csv', $csv),
        ]);

        $res->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 2)
            ->assertJsonPath('data.tabungan.target_diatur', 0);

        // Kedua user tetap terdaftar walau blok emas baris 3 ditolak schema.
        $this->assertNotNull(User::where('name', 'Non Nabung')->first());
        $this->assertNotNull(User::where('name', 'Emas Separuh')->first());
        $this->assertDatabaseCount('user_tabungan_target', 0);

        $detail = $res->json('data.detail_dilewati');
        $this->assertIsArray($detail);
        $this->assertNotEmpty(array_filter($detail, fn (string $d) => str_contains($d, 'Baris 3') && str_contains($d, 'data tabungan tidak valid')));
    }

    public function test_template_memuat_kolom_tabungan(): void
    {
        $headings = (new UsersTemplate)->headings();

        // Kolom target per produk tetap ada.
        $this->assertContains('Emas - Target (gram)', $headings);
        $this->assertContains('Hari Raya - Target (Rp)', $headings);
        $this->assertContains('Qurban - Target (Rp)', $headings);
        $this->assertContains('Berjangka - Target (Rp)', $headings);
        $this->assertContains('Gadai - No. Referensi', $headings);
        $this->assertContains('Gadai - Status', $headings);

        // Setiap blok tabungan punya kolom "Yang Sudah Terkumpul" (tersambung progress).
        foreach (['Emas', 'Hari Raya', 'Qurban', 'Berjangka', 'Mandiri'] as $produk) {
            $this->assertContains($produk.' - Yang Sudah Terkumpul (Rp)', $headings);
        }
        // Template tidak lagi meminta data yang diisi nasabah sendiri.
        $this->assertNotContains('Email', $headings);

        // Total kolom persis 53.
        $this->assertCount(53, $headings);
    }

    public function test_import_yang_sudah_terkumpul_terhubung_ke_progress_semua_tabungan(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $admin = User::where('role', 'admin')->first();
        $periode = \App\Models\PeriodeQurban::create([
            'tahun' => 2026,
            'status' => 'aktif',
            'tanggal_buka_pendaftaran' => '2026-01-01',
            'tanggal_tutup_pendaftaran' => '2026-06-01',
            'tanggal_idul_adha' => '2026-05-27',
            'tanggal_pencairan' => '2026-05-13',
            'created_by' => $admin->id,
        ]);
        \App\Models\HewanQurban::create([
            'jenis_hewan' => 'Kambing',
            'harga_per_unit' => 4500000,
            'periode_qurban_id' => $periode->id,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $this->importCsv(array_merge([
            'Nama Lengkap' => 'Nasabah Lengkap',
            'Peran' => 'Nasabah',
            'Status' => 'Aktif',

            'Emas - Target (gram)' => '25',
            'Emas - Gram per Periode' => '1',
            'Emas - Nominal per Periode (Rp)' => '1500000',
            'Emas - Durasi (Periode)' => '25',
            'Hari Raya - Target (Rp)' => '5000000',
            'Qurban - Target (Rp)' => '4500000',
            'Qurban - Jumlah Hewan' => '1',
            'Qurban - Jenis Hewan' => 'Kambing',
            'Qurban - Periode' => '2026',
            'Berjangka - Target (Rp)' => '6000000',
            'Berjangka - Nominal per Periode (Rp)' => '500000',
            'Berjangka - Durasi (Periode)' => '12',
        ], $this->setTerkumpul(
            mandiri: 1000000,
            emas: 2000000,
            hariRaya: 1000000,
            qurban: 1000000,
            berjangka: 1000000,
        )))
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 4)
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 5);

        $user = User::where('name', 'Nasabah Lengkap')->firstOrFail();
        $emas = JenisTabungan::where('kode', 'EMAS')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();
        $berjangka = JenisTabungan::where('kode', 'tabungan-berjangka')->first();
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        // Setiap "Yang Sudah Terkumpul" → setoran terverifikasi bertanda saldo awal.
        $this->assertSaldoAwal($user, $mandiri, 1000000);
        $this->assertSaldoAwal($user, $hr, 1000000);
        $this->assertSaldoAwal($user, $berjangka, 1000000);
        $this->assertSaldoAwal($user, $emas, 2000000);

        // Emas: nominal dikonversi ke gram (harga jual bertingkat), jadi progress gram ikut terisi.
        $emasRow = Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $emas->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->first();
        $this->assertTrue((float) $emasRow->unit_didapat > 1.5, 'unit_didapat harus > 1.5 gram untuk Rp 2.000.000');
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $emas->id,
            'nominal' => 2000000,
            'nominal_selisih' => 0,
        ]);
        $progressEmas = app(ProgressCalculatorService::class)->getProgress($user, $emas);
        $this->assertEquals(2000000, $progressEmas['saldo']);
        $this->assertEqualsWithDelta(1.666667, (float) $progressEmas['total_unit'], 0.00001);

        // Emas: saldo awal tertaut rencana → gram terkumpul & capaian rencana ikut terisi.
        $rencana = app(\App\Services\SaldoEmasService::class)->getAktif($user, $emas);
        $this->assertNotNull($rencana, 'rencana emas harus ada');
        $this->assertDatabaseHas('transaksi', [
            'id' => $emasRow->id,
            'konfigurasi_id' => $rencana->id,
        ]);
        $rekap = app(\App\Services\SaldoEmasService::class)->getProgress($user, $rencana)['rekap'];
        $this->assertEqualsWithDelta((float) $emasRow->unit_didapat, (float) $rekap['gram_terkumpul'], 0.00001);

        // Berjangka: saldo awal tertaut akun berjangka → terkumpul dihitung langsung.
        $tb = \App\Models\TabunganBerjangka::where('user_id', $user->id)->first();
        $this->assertNotNull($tb, 'tabungan berjangka harus ada');
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $berjangka->id,
            'tabungan_berjangka_id' => $tb->id,
            'nominal' => 1000000,
        ]);
        $this->assertEquals(1000000, $tb->terkumpulNominal());

        // Qurban: transaksi tertaut pendaftaran → total_terkumpul terisi, progress tampil.
        $pendaftaran = $user->pendaftaranQurban()->first();
        $this->assertNotNull($pendaftaran);
        $this->assertEquals(1000000, (float) $pendaftaran->total_terkumpul);

        // Semua progress rupiah terisi saldo sesuai kolom terkumpul.
        foreach (['mandiri' => $mandiri, 'hari_raya' => $hr, 'berjangka' => $berjangka] as $label => $jenis) {
            $progress = app(ProgressCalculatorService::class)->getProgress($user, $jenis);
            $this->assertEquals(1000000, $progress['saldo'], "saldo {$label}");
        }
    }

    public function test_import_ulang_nominal_sama_menyambung_kembali_relasi_saldo_awal(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $admin = User::where('role', 'admin')->first();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $data = [
            'Nama Lengkap' => 'Relasi Saldo Awal',
            'Emas - Target (gram)' => '10',
            'Emas - Gram per Periode' => '1',
            'Emas - Nominal per Periode (Rp)' => '2000000',
            'Emas - Durasi (Periode)' => '10',
            'Emas - Yang Sudah Terkumpul (Rp)' => '2000000',
        ];

        $this->importCsv($data)->assertOk();

        $user = User::where('name', 'Relasi Saldo Awal')->firstOrFail();
        $emas = JenisTabungan::where('kode', 'EMAS')->first();
        $emasRow = Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $emas->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->first();

        // Simulasikan saldo awal lama (diimport sebelum atribusi ke rencana ada).
        $emasRow->update(['konfigurasi_id' => null]);

        // Import ulang nominal sama → relasi tersambung lagi (bukan duplikat).
        $this->importCsv($data, 'b.csv')
            ->assertOk()
            ->assertJsonPath('data.jumlah_diupdate', 1);

        $rencana = app(\App\Services\SaldoEmasService::class)->getAktif($user, $emas);
        $this->assertSame(1, Transaksi::withTrashed()
            ->where('user_id', $user->id)
            ->where('jenis_tabungan_id', $emas->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count(), 'tidak boleh duplikat');
        $this->assertDatabaseHas('transaksi', [
            'id' => $emasRow->id,
            'konfigurasi_id' => $rencana->id,
        ]);
        $rekap = app(\App\Services\SaldoEmasService::class)->getProgress($user, $rencana)['rekap'];
        $this->assertEqualsWithDelta((float) $emasRow->unit_didapat, (float) $rekap['gram_terkumpul'], 0.00001);
    }

    public function test_import_ulang_yang_sudah_terkumpul_tidak_membuat_duplikat(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $admin = User::where('role', 'admin')->first();
        HargaEmasHarian::create([
            'tanggal' => now()->toDateString(),
            'harga_per_gram' => 1000000,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        $baris = array_merge(['Nama Lengkap' => 'Nasabah Import'], $this->setTerkumpul(mandiri: 500000, emas: 1000000, hariRaya: 500000));

        $this->importCsv($baris)->assertOk();
        $this->importCsv($baris, 'ulang.csv')->assertOk();

        $user = User::where('name', 'Nasabah Import')->firstOrFail();

        // Tetap satu catatan saldo awal per tabungan walau di-import ulang.
        foreach (['tabungan-pribadi', 'EMAS', 'tabungan-hari-raya'] as $kode) {
            $jenis = JenisTabungan::where('kode', $kode)->first();
            $this->assertSame(1, $this->countSaldoAwal($user, $jenis->id), "duplikat saldo awal {$kode}");
        }
    }

    private function countSaldoAwal(User $user, int $jenisId): int
    {
        return Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenisId)
            ->where('jenis_transaksi', 'setor')
            ->where('status_verifikasi', 'terverifikasi')
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count();
    }

    private function assertSaldoAwal(User $user, JenisTabungan $jenis, int $nominal): void
    {
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'status_verifikasi' => 'terverifikasi',
        ]);
    }

    public function test_import_laporan_memprioritaskan_nomor_anggota_daripada_nama(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser([
            'name' => 'Nama Di Database',
            'email' => 'identitas@example.com',
            'phone' => '081295009988',
            'nomor_anggota' => '1000000088',
        ]);

        $csv = "Nama Nasabah,Nomor Anggota,Tanggal Pembayaran,Tabungan Mandiri\n"
            ."Nama Berbeda,1000000088,2026-09-10,150000\n";
        $file = UploadedFile::fake()->createWithContent('laporan.csv', $csv);

        $this->post('/api/v1/admin/users/import-laporan', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.user_dibuat', 0)
            ->assertJsonPath('data.transaksi_dibuat', 1);

        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'nominal' => 150000,
            'tanggal_transaksi' => '2026-09-10 00:00:00',
        ]);
    }

    public function test_import_laporan_melewati_nama_ambigu_tanpa_identitas_unik(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser(['name' => 'Nama Sama', 'email' => 'sama1@example.com', 'phone' => '081295001111']);
        $this->createUser(['name' => 'Nama Sama', 'email' => 'sama2@example.com', 'phone' => '081295002222']);

        $csv = "Nama Nasabah,Tanggal Pembayaran,Tabungan Mandiri\n"
            ."Nama Sama,2026-09-10,150000\n";
        $file = UploadedFile::fake()->createWithContent('laporan-ambigu.csv', $csv);

        $this->post('/api/v1/admin/users/import-laporan', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.user_dibuat', 0)
            ->assertJsonPath('data.transaksi_dibuat', 0)
            ->assertJsonPath('data.row_dilewati', 1);

        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_import_laporan_menolak_histori_jika_saldo_awal_sudah_ada(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser([
            'name' => 'Konflik Saldo',
            'phone' => '081295003333',
            'nomor_anggota' => '1000000087',
        ]);
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $admin->id,
            'diverifikasi_pada' => now(),
            'catatan_admin' => 'Saldo awal dari import (SALDO_AWAL_IMPORT).',
            'tanggal_transaksi' => '2026-09-01',
        ]);

        $csv = "Nama Nasabah,Nomor Anggota,Tanggal Pembayaran,Tabungan Mandiri\n"
            ."Konflik Saldo,1000000087,2026-09-10,150000\n";
        $file = UploadedFile::fake()->createWithContent('laporan-konflik.csv', $csv);

        $this->post('/api/v1/admin/users/import-laporan', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.transaksi_dibuat', 0)
            ->assertJsonPath('data.row_dilewati', 1);

        $this->assertSame(0, Transaksi::where('catatan_admin', 'like', '%IMPORT_LAPORAN_HARIAN%')->count());
    }

    public function test_import_saldo_awal_menolak_jika_histori_laporan_sudah_ada(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser([
            'name' => 'Konflik Histori',
            'email' => 'konflik.histori@gmail.com',
            'phone' => '081295004444',
            'nomor_anggota' => '1000000086',
        ]);
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        Transaksi::create([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 150000,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $admin->id,
            'diverifikasi_pada' => now(),
            'catatan_admin' => 'Data historis dari laporan harian (IMPORT_LAPORAN_HARIAN).',
            'tanggal_transaksi' => '2026-09-10',
        ]);

        $file = UploadedFile::fake()->createWithContent(
            'saldo-setelah-histori.csv',
            $this->csv([
                'Nama Lengkap' => 'Konflik Histori',
                'Mandiri - Yang Sudah Terkumpul (Rp)' => '500000',
                'Hari Raya - Target (Rp)' => '1000000',
            ])
        );

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_diupdate', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 0);

        $this->assertSame(0, Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $mandiri->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());
    }
}