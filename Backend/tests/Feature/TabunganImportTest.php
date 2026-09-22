<?php

namespace Tests\Feature;

use App\Imports\TabunganImport\TabunganImportService;
use App\Models\Gadai;
use App\Models\HargaEmasHarian;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use App\Models\UserTabunganTarget;
use Illuminate\Http\UploadedFile;
use App\Exports\TabunganImportTemplate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\ApiTestCase;

class TabunganImportTest extends ApiTestCase
{
    protected function fixture(): int
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

        $periode = PeriodeQurban::create([
            'tahun' => 2026,
            'status' => 'aktif',
            'tanggal_buka_pendaftaran' => '2026-01-01',
            'tanggal_tutup_pendaftaran' => '2026-06-01',
            'tanggal_idul_adha' => '2026-05-27',
            'tanggal_pencairan' => '2026-05-13',
            'created_by' => $admin->id,
        ]);
        HewanQurban::create([
            'jenis_hewan' => 'Kambing',
            'harga_per_unit' => 4500000,
            'periode_qurban_id' => $periode->id,
            'status_aktif' => true,
            'created_by' => $admin->id,
        ]);

        return $admin->id;
    }

    private function dataLengkap(): array
    {
        return [
            'Nasabah' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'nama_lengkap' => 'Budi Santoso',
                    'no_anggota' => '0812938475',
                    'username' => 'budi.santoso',
                    'no_handphone' => '081299887766',
                    'alamat' => 'Jl. Merdeka 1',
                ],
            ],
            'Emas' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'rencana' => 'Perhiasan', 'frekuensi' => 'bulanan',
                    'nominal_setoran_rp' => '1.000.000', 'target_gram_total' => '10',
                    'tanggal_mulai' => '01/01/2026',
                    'gram_terkumpul' => '2', 'total_sudah_disetor_rp' => '2.400.000',
                ],
            ],
            'Mandiri' => [
                3 => ['nasabah_id' => 'NSB-0001', 'saldo_awal_rp' => '500000'],
            ],
            'Qurban' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'rencana' => 'Qurban 2026', 'periode_tahun' => '2026',
                    'jenis_hewan' => 'Kambing', 'jumlah_hewan' => '1', 'frekuensi' => 'bulanan',
                    'nominal_setoran_rp' => '375000', 'tanggal_daftar' => '01/05/2026',
                    'sudah_terkumpul_rp' => '1000000',
                ],
            ],
            'Hari Raya' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'target_rp' => '5000000', 'frekuensi' => 'bulanan',
                    'nominal_setoran_rp' => '208333', 'tanggal_mulai' => '01/01/2026',
                    'sudah_terkumpul_rp' => '1000000',
                ],
            ],
            'Gadai' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'nomor_gadai' => 'GDS-001', 'jenis_emas' => 'Antam 99',
                    'berat_gram' => '10', 'kadar' => '999', 'berat_bersih_gram' => '9.99',
                    'harga_acuan_rpgram' => '1500000', 'nilai_taksiran_rp' => '14985000',
                    'persen_gadai' => '90', 'besaran_gadai_rp' => '13486500', 'tenor_satuan' => 'bulan',
                    'frekuensi' => 'bulanan', 'nominal_angsuran_rp' => '561938', 'bunga' => '1.5',
                    'total_dibayar_rp' => '13486500', 'tanggal_aju' => '01/05/2026',
                    'jatuh_tempo' => '01/05/2027', 'status' => 'Aktif',
                ],
            ],
            'Berjangka' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'rencana' => 'Biaya Umroh', 'target_rp' => '6000000',
                    'durasi_bulan' => '12', 'frekuensi' => 'bulanan', 'nominal_setoran_rp' => '500000',
                    'tanggal_mulai' => '01/01/2026', 'sudah_terkumpul_rp' => '1000000',
                ],
            ],
        ];
    }

    public function test_import_lengkap_terhubung_semua_produk(): void
    {
        $adminId = $this->fixture();
        $hasil = app(TabunganImportService::class)->impor($this->dataLengkap(), $adminId);

        $this->assertEmpty($hasil['errors'], 'errors: '.json_encode($hasil['errors']));

        $user = User::where('nasabah_id', 'NSB-0001')->firstOrFail();
        $this->assertSame('Budi Santoso', $user->name);
        $this->assertSame('Budi Santoso', $user->name);

        // Emas: 1 rencana, external_id tersimpan, saldo awal tertaut per rencana.
        $kse = KonfigurasiSetoranEmas::byExternal('NSB-0001:Perhiasan')->firstOrFail();
        $this->assertSame('aktif', $kse->status->value);
        $saldoEmas = Transaksi::where('konfigurasi_id', $kse->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')->first();
        $this->assertEquals(2400000, (float) $saldoEmas->nominal);
        $this->assertEqualsWithDelta(2.0, (float) $saldoEmas->unit_didapat, 0.0001);

        // Mandiri: saldo awal berupa setoran terverifikasi.
        $mandiri = JenisTabungan::where('kode', 'tabungan-pribadi')->first();
        $this->assertTrue(Transaksi::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $mandiri->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
            ->where('nominal', 500000)->exists());

        // Hari Raya: target tersimpan + saldo awal.
        $hr = JenisTabungan::where('kode', 'tabungan-hari-raya')->first();
        $this->assertDatabaseHas('user_tabungan_target', [
            'user_id' => $user->id, 'jenis_tabungan_id' => $hr->id, 'target_nominal' => 5000000,
        ]);

        // Qurban: target_dana dihitung dari katalog, terkumpul ikut prog.
        $pendaftaran = PendaftaranQurban::byExternal('NSB-0001:Qurban 2026')->firstOrFail();
        $this->assertEquals(4500000, (float) $pendaftaran->target_dana);
        $this->assertEquals(1000000, (float) $pendaftaran->total_terkumpul);

        // Berjangka: jatuh tempo = mulai + durasi; saldo awal tertaut akun.
        $tb = TabunganBerjangka::byExternal('NSB-0001:Biaya Umroh')->firstOrFail();
        $this->assertSame('2026-01-01', $tb->tanggal_mulai->toDateString());
        $this->assertSame('2027-01-01', $tb->tanggal_jatuh_tempo->toDateString());
        $this->assertEquals(1000000, $tb->terkumpulNominal());

        // Gadai: record dibuat + user tertaut.
        $this->assertDatabaseHas('gadai', ['nomor_gadai' => 'GDS-001', 'user_id' => $user->id, 'status' => 'aktif']);
    }

    public function test_multi_rencana_emas_dan_import_ulang_idempoten(): void
    {
        $adminId = $this->fixture();
        $service = app(TabunganImportService::class);

        $data = $this->dataLengkap();
        $data['Emas'][4] = [
            'nasabah_id' => 'NSB-0001', 'rencana' => 'Fondasi', 'frekuensi' => 'bulanan',
            'nominal_setoran_rp' => '500000', 'target_gram_total' => '5',
            'tanggal_mulai' => '01/01/2026',
            'gram_terkumpul' => '', 'total_sudah_disetor_rp' => '600000',
        ];

        $service->impor($data, $adminId);
        $service->impor($data, $adminId);

        $user = User::where('nasabah_id', 'NSB-0001')->firstOrFail();

        // Dua rencana emas berbeda tetap ada, bukan duplikat saat re-import.
        $this->assertSame(2, KonfigurasiSetoranEmas::milikUser($user->id)->count());
        $this->assertNotNull(KonfigurasiSetoranEmas::byExternal('NSB-0001:Perhiasan')->first());
        $this->assertNotNull(KonfigurasiSetoranEmas::byExternal('NSB-0001:Fondasi')->first());

        // Tepat 1 catatan saldo awal per rencana.
        foreach (['Perhiasan', 'Fondasi'] as $rencana) {
            $kse = KonfigurasiSetoranEmas::byExternal("NSB-0001:{$rencana}")->first();
            $this->assertSame(1, Transaksi::withTrashed()
                ->where('konfigurasi_id', $kse->id)
                ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')
                ->count(), "duplikat saldo awal rencana {$rencana}");
        }

        // Masih 1 user.
        $this->assertSame(1, User::where('nasabah_id', 'NSB-0001')->count());
    }

    public function test_error_validasi_membatalkan_seluruh_import(): void
    {
        $adminId = $this->fixture();
        $service = app(TabunganImportService::class);

        // Ada sheet produk yang merujuk nasabah tidak terdaftar di sheet Nasabah.
        $data = $this->dataLengkap();
        $data['Emas'] = [
            4 => ['nasabah_id' => 'NSB-9999', 'rencana' => 'X', 'frekuensi' => 'bulanan'],
        ];

        $hasil = $service->impor($data, $adminId);
        $this->assertNotEmpty($hasil['errors']);
        $this->assertSame('Emas', $hasil['errors'][0]['sheet']);
        $this->assertSame(4, $hasil['errors'][0]['baris']);

        // Tidak ada satu pun user/produk dibuat.
        $this->assertSame(0, User::where('nasabah_id', 'NSB-0001')->count());
    }

    public function test_qurban_hewan_tidak_ada_ditolak_tanpa_membuat_produk(): void
    {
        $adminId = $this->fixture();
        $data = $this->dataLengkap();
        $data['Qurban'][3]['jenis_hewan'] = 'Sapi Limosin'; // tidak ada di katalog

        $hasil = app(TabunganImportService::class)->impor($data, $adminId);
        $this->assertNotEmpty($hasil['errors']);
        $this->assertStringContainsString('Hewan', $hasil['errors'][0]['pesan']);
        // Atomik: satu baris invalid di sheet mana pun membatalkan seluruh import.
        $this->assertSame(0, User::where('nasabah_id', 'NSB-0001')->count());
        $this->assertSame(0, PendaftaranQurban::count());
    }

    public function test_batas_5_rencana_emas_dibatasi(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser(['nasabah_id' => 'NSB-777']);
        $jenis = JenisTabungan::where('kode', 'EMAS')->first();

        for ($i = 1; $i <= 5; $i++) {
            KonfigurasiSetoranEmas::create([
                'user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id,
                'nominal_per_periode' => 100000, 'frekuensi_setor' => 'bulanan',
                'target_gram_total' => 1, 'status' => 'aktif',
            ]);
        }

        $data = [
            'Nasabah' => [
                3 => ['nasabah_id' => 'NSB-777', 'nama_lengkap' => 'Budi Santoso'],
            ],
            'Emas' => [
                3 => [
                    'nasabah_id' => 'NSB-777', 'rencana' => 'Baru', 'frekuensi' => 'bulanan',
                    'nominal_setoran_rp' => '100000', 'target_gram_total' => '1',
                ],
            ],
        ];

        $this->expectException(\RuntimeException::class);
        app(TabunganImportService::class)->impor($data, User::where('role', 'admin')->first()->id);
    }

    public function test_template_dan_preview_via_endpoint(): void
    {
        $this->fixture();

        // Template ter-download (file xlsx dari objek ekspor yang sama & berisi 7 sheet terpisah).
        $res = $this->get('/api/v1/admin/import-tabungan/template');
        $res->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $tmp = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        file_put_contents($tmp, \Maatwebsite\Excel\Facades\Excel::raw(new TabunganImportTemplate, \Maatwebsite\Excel\Excel::XLSX));
        $wb = IOFactory::load($tmp);
        unlink($tmp);
        $this->assertSame(
            ['Nasabah', 'Emas', 'Mandiri', 'Qurban', 'Hari Raya', 'Gadai', 'Berjangka'],
            $wb->getSheetNames()
        );
        // Setiap sheet punya header spesifiknya sendiri (baris 1) yang dimengerti parser.
        $this->assertContains('Nama Lengkap', $wb->getSheetByName('Nasabah')->rangeToArray('A1:Z1')[0]);
        $this->assertContains('No. Anggota', $wb->getSheetByName('Nasabah')->rangeToArray('A1:Z1')[0]);
        $this->assertContains('Berat Bersih (gram)', $wb->getSheetByName('Gadai')->rangeToArray('A1:Z1')[0]);
        $this->assertContains('Target (Rp)', $wb->getSheetByName('Berjangka')->rangeToArray('A1:Z1')[0]);

        // Preview file xlsx (7 sheet) dengan 1 baris data per sheet.
        $file = $this->buatXlsx($this->dataLengkap());
        $this->post('/api/v1/admin/import-tabungan/preview', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(0, 'data.errors');

        // Belum ada yang dipersist saat preview.
        $this->assertSame(0, User::where('nasabah_id', 'NSB-0001')->count());
    }

    public function test_import_via_endpoint_menulis_data(): void
    {
        $this->fixture();
        $file = $this->buatXlsx($this->dataLengkap());

        $this->post('/api/v1/admin/import-tabungan', ['file' => $file])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertNotNull(User::where('nasabah_id', 'NSB-0001')->first());
        $this->assertSame('0812938475', User::where('nasabah_id', 'NSB-0001')->first()->nomor_anggota);
        $this->assertNotNull(KonfigurasiSetoranEmas::byExternal('NSB-0001:Perhiasan')->first());
    }

    public function test_saldo_awal_emas_pakai_gram_impor_dan_progress_rencana(): void
    {
        $adminId = $this->fixture();

        // Gram dan rupiah sengaja tidak sinkron (1 gr tapi Rp1.500.000) — kolom
        // Gram Terkumpul harus menang, bukan dihitung ulang dari rupiah.
        // Tanggal mulai di masa depan: rencana belum berjalan, jangan tampil tertunggak.
        $data = [
            'Nasabah' => [
                3 => ['nasabah_id' => 'NSB-0001', 'nama_lengkap' => 'Budi Santoso'],
            ],
            'Emas' => [
                3 => [
                    'nasabah_id' => 'NSB-0001', 'rencana' => 'Emas Nikah', 'frekuensi' => 'bulanan',
                    'nominal_setoran_rp' => '1.500.000', 'target_gram_total' => '10',
                    'tanggal_mulai' => '01/11/2026',
                    'gram_terkumpul' => '1', 'total_sudah_disetor_rp' => '1.500.000',
                ],
            ],
        ];

        $hasil = app(TabunganImportService::class)->impor($data, $adminId);
        $this->assertEmpty($hasil['errors'], 'errors: '.json_encode($hasil['errors']));

        $user = User::where('nasabah_id', 'NSB-0001')->firstOrFail();
        $kse = KonfigurasiSetoranEmas::byExternal('NSB-0001:Emas Nikah')->firstOrFail();

        $saldoEmas = Transaksi::where('konfigurasi_id', $kse->id)
            ->where('catatan_admin', 'like', '%SALDO_AWAL_IMPORT%')->first();
        $this->assertEquals(1500000, (float) $saldoEmas->nominal);
        $this->assertEqualsWithDelta(1.0, (float) $saldoEmas->unit_didapat, 0.0001);

        // Progress rencana menghitung saldo awal (gram 1) walau tanggal_mulai di masa depan.
        $progress = app(\App\Services\SaldoEmasService::class)->getProgress($user, $kse);
        $this->assertEqualsWithDelta(1.0, $progress['rekap']['gram_terkumpul'], 0.0001);
        $this->assertSame(0, $progress['konsistensi']['periode_seharusnya']);
        $this->assertSame(0, $progress['tertunggak']['jumlah_periode']);
    }

    private function buatXlsx(array $sheets): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->removeSheetByIndex(0);

        $headings = [
            'Nasabah' => ['Nasabah ID', 'Nama Lengkap', 'No. Anggota', 'Username', 'No. Handphone', 'Alamat'],
            'Emas' => ['Nasabah ID', 'Rencana', 'Frekuensi', 'Nominal Setoran (Rp)', 'Target Gram Total', 'Tanggal Mulai', 'Gram Terkumpul', 'Total Sudah Disetor (Rp)'],
            'Mandiri' => ['Nasabah ID', 'Saldo Awal (Rp)'],
            'Qurban' => ['Nasabah ID', 'Rencana', 'Periode Tahun', 'Jenis Hewan', 'Jumlah Hewan', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Daftar', 'Sudah Terkumpul (Rp)'],
            'Hari Raya' => ['Nasabah ID', 'Target (Rp)', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Mulai', 'Sudah Terkumpul (Rp)'],
            'Gadai' => ['Nasabah ID', 'Nomor Gadai', 'Jenis Emas', 'Berat (gram)', 'Kadar', 'Berat Bersih (gram)', 'Harga Acuan (Rp/gram)', 'Nilai Taksiran (Rp)', 'Persen Gadai (%)', 'Besaran Gadai (Rp)', 'Tenor (Satuan)', 'Frekuensi', 'Nominal Angsuran (Rp)', 'Bunga (%)', 'Total Dibayar (Rp)', 'Tanggal Aju', 'Jatuh Tempo', 'Status'],
            'Berjangka' => ['Nasabah ID', 'Rencana', 'Target (Rp)', 'Durasi (Bulan)', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Mulai', 'Sudah Terkumpul (Rp)'],
        ];

        foreach ($sheets as $judul => $rows) {
            $sheet = $spreadsheet->createSheet();
            $sheet->setTitle($judul);
            $sheet->fromArray($headings[$judul], null, 'A1');
            foreach ($rows as $baris => $row) {
                $vals = array_map(fn ($h) => $row[\Illuminate\Support\Str::slug($h, '_')] ?? '', $headings[$judul]);
                $sheet->fromArray([$vals], null, 'A'.$baris);
            }
        }

        $path = tempnam(sys_get_temp_dir(), 'tabungan_').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile($path, 'import-tabungan.xlsx', null, null, true);
    }
}