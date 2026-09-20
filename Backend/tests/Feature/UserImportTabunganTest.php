<?php

namespace Tests\Feature;

use App\Exports\UsersTemplate;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\ProgressCalculatorService;
use Illuminate\Http\UploadedFile;
use Tests\ApiTestCase;

class UserImportTabunganTest extends ApiTestCase
{
    /**
     * CSV 54 kolom (mengikuti heading template) dengan blok tabungan yang diisi
     * sesuai argumen. Blanko = blok produk tidak dimiliki nasabah.
     */
    private function csv(
        string $email,
        string $anggota,
        string $mandiriSaldo = '',
        string $hrTarget = '',
        string $hrFrekuensi = 'bulanan',
        string $hrNominal = '',
        string $hrDurasi = '',
        string $hrMulai = '',
        string $hrJatuhTempo = '',
    ): string {
        $headings = (new UsersTemplate)->headings();
        $vals = array_fill(0, count($headings), '');

        $set = function (string $heading, string $value) use (&$vals, $headings) {
            $i = array_search($heading, $headings, true);
            $vals[$i] = $value;
        };

        $set('Nama Lengkap', 'Nasabah Import');
        $set('Email', $email);
        $set('No. Handphone', '081295000001');
        $set('Nomor Anggota (10 digit)', $anggota);
        $set('Alamat', 'Jl. Coba No. 1');
        $set('Password', 'password123');
        $set('Peran', 'Nasabah');
        $set('Status', 'Aktif');

        $set('Mandiri - Saldo Awal (Rp)', $mandiriSaldo);

        $set('Hari Raya - Target (Rp)', $hrTarget);
        $set('Hari Raya - Frekuensi Bayar', $hrFrekuensi);
        $set('Hari Raya - Nominal per Periode (Rp)', $hrNominal);
        $set('Hari Raya - Durasi (Periode)', $hrDurasi);
        $set('Hari Raya - Tanggal Mulai', $hrMulai);
        $set('Hari Raya - Jatuh Tempo', $hrJatuhTempo);

        return implode(',', $headings)."\n".implode(',', $vals)."\n";
    }

    public function test_import_membuat_target_dan_saldo_awal_tabungan(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $file = UploadedFile::fake()->createWithContent(
            'nasabah_tabungan.csv',
            $this->csv('import.satu@gmail.com', '1000000016', '500000', '1000000', 'bulanan', '208333', '5')
        );

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 1);

        $user = User::where('email', 'import.satu@gmail.com')->firstOrFail();

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

        $import1 = UploadedFile::fake()->createWithContent(
            'a.csv',
            $this->csv('import.dua@gmail.com', '1000000017', '500000', '1000000')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import1])->assertOk();

        // Import ulang dengan dana baru → di-update, bukan duplikat.
        $import2 = UploadedFile::fake()->createWithContent(
            'b.csv',
            $this->csv('import.dua@gmail.com', '1000000017', '750000', '2000000')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import2])
            ->assertOk()
            ->assertJsonPath('data.jumlah_diupdate', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_diubah', 1);

        $user = User::where('email', 'import.dua@gmail.com')->firstOrFail();

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

        $csv = $this->csv('nasabah.polos@gmail.com', '1000000019');

        $file = UploadedFile::fake()->createWithContent('polos.csv', $csv);

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 0);

        $this->assertDatabaseCount('user_tabungan_target', 0);
        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_template_memuat_kolom_tabungan(): void
    {
        $headings = (new UsersTemplate)->headings();

        // Blok dasar tetap ada.
        $this->assertContains('Nomor Anggota (10 digit)', $headings);

        // Kolom tabungan per produk (54 kolom).
        $this->assertContains('Emas - Target (gram)', $headings);
        $this->assertContains('Hari Raya - Target (Rp)', $headings);
        $this->assertContains('Qurban - Target (Rp)', $headings);
        $this->assertContains('Berjangka - Target (Rp)', $headings);
        $this->assertContains('Mandiri - Saldo Awal (Rp)', $headings);
        $this->assertContains('Gadai - No. Referensi', $headings);
        $this->assertContains('Gadai - Status', $headings);

        // Total kolom persis 54.
        $this->assertCount(54, $headings);
    }

    public function test_import_baris_lengkap_54_kolom_mengisi_semua_produk(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $admin = \App\Models\User::where('role', 'admin')->first();
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

        $headings = (new UsersTemplate)->headings();
        $vals = array_fill(0, count($headings), '');

        $set = function (string $heading, string $value) use (&$vals, $headings) {
            $vals[array_search($heading, $headings, true)] = $value;
        };

        $set('Nama Lengkap', 'Nasabah Lengkap');
        $set('Email', 'lengkap@example.com');
        $set('No. Handphone', '081295009999');
        $set('Nomor Anggota (10 digit)', '1000000001');
        $set('Alamat', 'Jl. Lengkap');
        $set('Password', 'password123');
        $set('Peran', 'Nasabah');
        $set('Status', 'Aktif');

        $set('Emas - Target (gram)', '25');
        $set('Emas - Gram per Periode', '1');
        $set('Emas - Frekuensi Bayar', 'Bulanan');
        $set('Emas - Nominal per Periode (Rp)', '1500000');
        $set('Emas - Durasi (Periode)', '25');
        $set('Emas - Tanggal Mulai', '01/01/2026');
        $set('Emas - Jatuh Tempo', '01/02/2028');

        $set('Hari Raya - Target (Rp)', '5000000');
        $set('Hari Raya - Frekuensi Bayar', 'Bulanan');
        $set('Hari Raya - Nominal per Periode (Rp)', '208333');
        $set('Hari Raya - Durasi (Periode)', '24');
        $set('Hari Raya - Tanggal Mulai', '01/01/2026');
        $set('Hari Raya - Jatuh Tempo', '01/01/2028');

        $set('Qurban - Target (Rp)', '4500000');
        $set('Qurban - Jumlah Hewan', '1');
        $set('Qurban - Jenis Hewan', 'Kambing');
        $set('Qurban - Periode', '2026');
        $set('Qurban - Frekuensi Bayar', 'Bulanan');
        $set('Qurban - Nominal per Periode (Rp)', '375000');
        $set('Qurban - Tanggal Daftar', '01/05/2026');

        $set('Berjangka - Target (Rp)', '6000000');
        $set('Berjangka - Frekuensi Bayar', 'Bulanan');
        $set('Berjangka - Nominal per Periode (Rp)', '500000');
        $set('Berjangka - Durasi (Periode)', '12');
        $set('Berjangka - Tanggal Mulai', '01/06/2026');
        $set('Berjangka - Jatuh Tempo', '01/06/2027');

        $set('Mandiri - Saldo Awal (Rp)', '1000000');

        $set('Gadai - No. Referensi', 'GDS-260101-0001');
        $set('Gadai - Tanggal Aju', '01/05/2026');
        $set('Gadai - Jenis Emas', 'Antam 99');
        $set('Gadai - Berat (gram)', '10');
        $set('Gadai - Kadar (%)', '999');
        $set('Gadai - Berat Bersih (gram)', '9.99');
        $set('Gadai - Harga Acuan (Rp/gram)', '1500000');
        $set('Gadai - Nilai Taksiran (Rp)', '14985000');
        $set('Gadai - Persen Gadai (%)', '90');
        $set('Gadai - Besaran Gadai (Rp)', '13486500');
        $set('Gadai - Tenor (Satuan)', 'bulan');
        $set('Gadai - Toleransi Hari', '7');
        $set('Gadai - Frekuensi Bayar', 'bulanan');
        $set('Gadai - Nominal Angsuran (Rp)', '561938');
        $set('Gadai - Bunga (%)', '1.5');
        $set('Gadai - Total Dibayar (Rp)', '13486500');
        $set('Gadai - Tanggal Aktif', '01/05/2026');
        $set('Gadai - Jatuh Tempo', '01/05/2027');
        $set('Gadai - Status', 'Aktif');

        $csv = implode(',', $headings)."\n".implode(',', $vals)."\n";
        $file = UploadedFile::fake()->createWithContent('lengkap.csv', $csv);

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 4);

        $user = User::where('email', 'lengkap@example.com')->firstOrFail();

        // Goal global emas ikut ter-set dari target rencana (progress dashboard tampil).
        $this->assertNotNull($user->target_emas_gram);
        $this->assertEqualsWithDelta(25.0, (float) $user->target_emas_gram, 0.000001);

        $emas = JenisTabungan::where('kode', 'EMAS')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();
        $berjangka = JenisTabungan::where('kode', 'tabungan-berjangka')->first();
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        // Konfigurasi setoran emas terisi target, jadwal, dan tanggal.
        $this->assertDatabaseHas('konfigurasi_setoran_emas', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $emas->id,
            'target_gram_total' => 25,
            'target_gram_per_periode' => 1,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 1500000,
            'durasi_periode' => 25,
            'tanggal_deadline' => '2028-02-01 00:00:00',
        ]);

        // Hari Raya: target + durasi + tanggal (kolom baru).
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $hr->id,
            'target_nominal' => 5000000,
            'frekuensi_setor' => 'bulanan',
            'nominal_per_periode' => 208333,
            'durasi_periode' => 24,
            'tanggal_mulai' => '2026-01-01 00:00:00',
            'tanggal_deadline' => '2028-01-01 00:00:00',
        ]);

        // Qurban terhubung ke hewan & periode yang dipilih.
        $this->assertDatabaseHas('pendaftaran_qurban', [
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'jumlah_hewan' => 1,
            'target_dana' => 4500000,
            'status' => 'menabung',
        ]);

        // Berjangka: target, durasi_bulan, jadwal aktif.
        $this->assertDatabaseHas('tabungan_berjangka', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $berjangka->id,
            'target_nominal' => 6000000,
            'durasi_bulan' => 12,
            'status' => 'aktif',
        ]);

        // Mandiri: saldo awal otomatis terverifikasi (progress mandiri terisi).
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'nominal' => 1000000,
            'status_verifikasi' => 'terverifikasi',
        ]);
        $progress = app(ProgressCalculatorService::class)->getProgress($user, $mandiri);
        $this->assertEquals(1000000, $progress['saldo']);

        // Gadai: seluruh kolom masuk, kadar permille (999) & status aktif.
        $this->assertDatabaseHas('gadai', [
            'user_id' => $user->id,
            'nomor_gadai' => 'GDS-260101-0001',
            'jenis_emas' => 'Antam 99',
            'berat_gram' => 10,
            'kadar' => 999,
            'nominal_angkuran' => 561938,
            'bunga_persen' => 1.5,
            'status' => 'aktif',
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
            $this->csv('konflik.histori@gmail.com', '1000000086', '500000', '1000000')
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