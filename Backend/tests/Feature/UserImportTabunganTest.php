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
     * CSV bernilai sama dengan yang diunduh dari template, lengkap kolom tabungan
     * (Mandiri & Hari Raya ikut diuji karena seeding menciptakan keduanya).
     */
    private function csvAdaTabungan(string $email, string $anggota, string $target = '1000000', string $saldo = '500000'): string
    {
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $head = implode(',', [
            'Nama Lengkap', 'Email', 'No. Handphone', 'Nomor Anggota (10 digit)', 'Alamat', 'Password', 'Peran', 'Status',
            "{$mandiri->nama} - Target", "{$mandiri->nama} - Saldo Awal",
            "{$hr->nama} - Target", "{$hr->nama} - Saldo Awal",
        ]);

        $row = implode(',', [
            'Nasabah Import', $email, '081295000001', $anggota, 'Jl. Coba No. 1', 'password123', 'Nasabah', 'Aktif',
            $target, $saldo, $target, $saldo,
        ]);

        return "{$head}\n{$row}\n";
    }

    public function test_import_membuat_target_dan_saldo_awal_tabungan(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $file = UploadedFile::fake()->createWithContent(
            'nasabah_tabungan.csv',
            $this->csvAdaTabungan('import.satu@gmail.com', '1000000016')
        );

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 2)
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 2);

        $user = User::where('email', 'import.satu@gmail.com')->firstOrFail();

        // Target tersimpan per user per jenis.
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'target_nominal' => 1000000,
        ]);
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $hr->id,
            'target_nominal' => 1000000,
        ]);

        // Saldo awal tercatat sebagai setoran terverifikasi (langsung masuk saldo).
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $admin->id,
        ]);
        $this->assertDatabaseHas('transaksi', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $hr->id,
            'jenis_transaksi' => 'setor',
            'nominal' => 500000,
            'status_verifikasi' => 'terverifikasi',
        ]);

        // Terintegrasi dengan tabungan: saldo & target tampil di progress.
        $progress = app(ProgressCalculatorService::class)->getProgress($user, $mandiri);
        $this->assertEquals(500000, $progress['saldo']);
        $this->assertEquals(1000000, $progress['target']);
    }

    public function test_reimport_memperbarui_dana_tanpa_duplikat(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();

        $import1 = UploadedFile::fake()->createWithContent(
            'a.csv',
            $this->csvAdaTabungan('import.dua@gmail.com', '1000000017', '1000000', '500000')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import1])->assertOk();

        // Import ulang dengan target & dana baru → di-update, bukan duplikat.
        $import2 = UploadedFile::fake()->createWithContent(
            'b.csv',
            $this->csvAdaTabungan('import.dua@gmail.com', '1000000017', '2000000', '750000')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import2])
            ->assertOk()
            ->assertJsonPath('data.jumlah_diupdate', 1)
            ->assertJsonPath('data.tabungan.saldo_awal_diubah', 2);

        $user = User::where('email', 'import.dua@gmail.com')->firstOrFail();

        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
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

    public function test_saldo_awal_dikosongkan_menghapus_catatan_import(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();

        $import1 = UploadedFile::fake()->createWithContent(
            'a.csv',
            $this->csvAdaTabungan('import.tiga@gmail.com', '1000000018', '1000000', '500000')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import1])->assertOk();

        // Set ulang dana jadi 0 → catatan saldo awal dihapus (target tetap).
        $import2 = UploadedFile::fake()->createWithContent(
            'b.csv',
            $this->csvAdaTabungan('import.tiga@gmail.com', '1000000018', '1000000', '0')
        );
        $this->post('/api/v1/admin/users/import', ['file' => $import2])
            ->assertOk()
            ->assertJsonPath('data.tabungan.saldo_awal_dihapus', 2);

        $user = User::where('email', 'import.tiga@gmail.com')->firstOrFail();

        // Catatan saldo awal dihapus (soft delete) — query Eloquent (default) tak menampilkannya lagi,
        // tapi rekam jejak tetap ada agar audit jelas.
        $this->assertSame(0, Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $mandiri->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());
        $this->assertSame(0, Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $hr->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());
        $this->assertSame(2, Transaksi::withTrashed()
            ->where('user_id', $user->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());

        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id,
            'jenis_tabungan_id' => $mandiri->id,
            'target_nominal' => 1000000,
        ]);
    }

    public function test_import_tanpa_kolom_tabungan_tetap_berhasil(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $csv = "Nama Lengkap,Email,No. Handphone,Nomor Anggota (10 digit),Alamat,Password,Peran,Status\n"
            ."Nasabah Polos,nasabah.polos@gmail.com,081295000002,1000000019,Jl. Kosong,password123,Nasabah,Aktif\n";

        $file = UploadedFile::fake()->createWithContent('polos.csv', $csv);

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.jumlah_ditambahkan', 1)
            ->assertJsonPath('data.tabungan.target_diatur', 0);

        $this->assertDatabaseCount('user_tabungan_target', 0);
        $this->assertDatabaseCount('transaksi', 0);
    }

    public function test_template_memuat_kolom_tabungan_pribadi(): void
    {
        $this->seedBase();

        $headings = (new UsersTemplate)->headings();

        $this->assertContains('Tabungan Mandiri - Target', $headings);
        $this->assertContains('Tabungan Mandiri - Saldo Awal', $headings);
        $this->assertContains('Tabungan Hari Raya - Target', $headings);
        $this->assertContains('Tabungan Hari Raya - Saldo Awal', $headings);
        $this->assertContains('Tabungan Berjangka - Target', $headings);
        $this->assertContains('Tabungan Berjangka - Saldo Awal', $headings);

        // Kolom wajib dasar tetap ada.
        $this->assertContains('Nomor Anggota (10 digit)', $headings);
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
            $this->csvAdaTabungan('konflik.histori@gmail.com', '1000000086', '1000000', '500000')
        );

        $this->post('/api/v1/admin/users/import', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('data.tabungan.saldo_awal_dicatat', 1);

        $this->assertSame(0, Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $mandiri->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->count());
    }
}
