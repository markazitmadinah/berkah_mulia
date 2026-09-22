<?php

namespace App\Imports;

use App\Enums\FrekuensiSetoran;
use App\Enums\StatusGadai;
use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\StatusPendaftaranQurban;
use App\Enums\TipeTabungan;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Gadai;
use App\Models\HargaEmasHarian;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\TabunganBerjangka;
use App\Models\User;
use App\Models\UserTabunganTarget;
use App\Services\SaldoEmasService;
use Illuminate\Support\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class UsersImport implements SkipsEmptyRows, ToModel, WithCalculatedFormulas, WithHeadingRow
{
    use Importable;

/**
     * Penanda pada catatan_admin transaksi setor saldo awal dari import.
     * Dipakai untuk anti-duplikat dan "set ulang dana" saat file di-import ulang.
     */
    public const MARKER_SALDO_AWAL = \App\Services\SaldoAwalService::MARKER;

    /**
     * Identitas baris contoh pada template unduhan. Baris ini otomatis
     * dilewati saat import agar template yang tidak diedit menjadi data nyata.
     */
    public const CONTOH_NAMA = 'Ahmad Fauzi';

    private array $created = [];

    private array $updated = [];

    private array $skipped = [];

    private array $pending = [];

    private int $rowCounter = 0;

    private int $targetDiatur = 0;

    private int $saldoDicatat = 0;

    private int $saldoDiubah = 0;

    private int $saldoDihapus = 0;

    public function isEmptyWhen(array $row): bool
    {
        return $this->isEmptyRow($row);
    }

    private function isEmptyRow(array $row): bool
    {
        $fields = ['nama_lengkap', 'peran', 'status'];
        foreach ($fields as $field) {
            if (trim((string) ($row[$field] ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    public function model(array $row)
    {
        $this->rowCounter++;
        $baris = $this->rowCounter + 1; // baris 1 = heading

        $nama = trim((string) ($row['nama_lengkap'] ?? ''));

        // No. HP, nomor anggota, alamat, dan password tidak lagi
        // diimport — nasabah mengisinya sendiri di akun masing-masing.

        // Baris contoh dari template: jangan pernah menjadi data nyata.
        if ($nama === self::CONTOH_NAMA) {
            return null;
        }

        // Validasi manual per baris agar nomor baris akurat dan satu baris
        // buruk tidak menghentikan seluruh file.
        $errors = [];
        if ($nama === '') {
            $errors[] = 'Nama Lengkap wajib diisi';
        }
        if ($errors) {
            $this->skipped[] = 'Baris '.$baris.': '.implode(' · ', $errors);

            return null;
        }

        // Identitas: Nama Lengkap (input manual admin), jadi cocokkan persis.
        $existing = User::withTrashed()
            ->whereRaw('LOWER(name) = ?', [Str::lower($nama)])
            ->limit(2)
            ->get();
        if ($existing->count() > 1) {
            $this->skipped[] = "Baris {$baris}: Nama '{$nama}' tidak unik di database. Perbaiki data sebelum import ulang.";

            return null;
        }
        $existing = $existing->first();

        try {
            if ($existing) {
                $update = ['name' => $nama];
                $statusVal = trim((string) ($row['status'] ?? ''));
                if ($statusVal !== '') {
                    $update['status'] = $this->parseStatus($statusVal);
                }
                $update['role'] = $this->parseRole($row['peran'] ?? 'Nasabah');

                // forceFill: role/status sengaja tidak fillable (mass-assignment),
                // tapi import admin harus benar-benar menerapkannya.
                $existing->forceFill($update)->save();
                if ($existing->trashed()) {
                    $existing->restore();
                }
                $this->updated[] = $existing->id;

                // Tabungan ikut diproses untuk user yang diperbarui (set ulang dana).
                $this->pending[] = [
                    'nama' => $nama,
                    'baris' => $baris,
                    'row' => $row,
                ];

                return null;
            }

            $username = $this->generateUniqueUsername($nama);

            // phone diisi placeholder unik; data asli diisi nasabah di akun masing-masing
            // (pola LaporanHarianImport).
            // forceFill: role/status/approved_by/approved_at tidak fillable (mass-assignment).
            $user = (new User)->forceFill([
                'name' => $nama,
                'username' => $username,
                'phone' => $this->generatePlaceholderPhone(),
                'address' => null,
                'password' => Hash::make(Str::random(16)),
                'role' => $this->parseRole($row['peran'] ?? 'Nasabah'),
                'status' => $this->parseStatus($row['status'] ?? 'Aktif'),
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]);
            $user->save();
            $this->created[] = $username;

            // Diproses setelah seluruh baris selesai diinsert agar user.id tersedia.
            $this->pending[] = [
                'nama' => $nama,
                'baris' => $baris,
                'row' => $row,
            ];

            return $user;
        } catch (UniqueConstraintViolationException $e) {
            $this->skipped[] = 'Baris '.$baris
                .': Username/phone placeholder bentrok dengan user lain; import ulang.';

            return null;
        }
    }

    // ─── Tabungan dari import ────────────────────────────────────────

    private function jenisByKode(string $kode): ?JenisTabungan
    {
        return JenisTabungan::where('kode', $kode)->first();
    }

    /**
     * Ambil nilai kolom dari baris berdasarkan HEADING PERSIS template
     * (54 kolom). Heading di-slug sama seperti Maatwebsite (Str::slug(_, '_'))
     * sehingga key baris selalu match selama heading template tidak diubah.
     */
    private function ambil(array $row, string $heading)
    {
        return $row[Str::slug($heading, '_')] ?? null;
    }

    /**
     * Bersihkan nominal rupiah: abaikan pemisah ribuan (titik/koma/spasi),
     * sisakan digit saja. '5.000.000' / '5,000,000' → 5000000.
     */
    private function bersihNominal($value): ?int
    {
        $value = trim((string) ($value ?? ''));

        if ($value === '') {
            return null;
        }

        $digits = preg_replace('/[^\d]/', '', $value);

        return $digits === '' ? null : (int) $digits;
    }

    /**
     * Nilai desimal (gram, kadar, persen) dengan toleransi koma → titik.
     */
    private function bersihDesimal($value): ?float
    {
        $value = trim((string) ($value ?? ''));

        if ($value === '') {
            return null;
        }

        $value = str_replace(',', '.', $value);

        return is_numeric($value) ? (float) $value : null;
    }

    /**
     * Nominal rupiah bulat (target, saldo). Mengembalikan 0 bila kosong.
     */
    private function rupiah(array $row, string $heading): ?int
    {
        return $this->bersihNominal($this->ambil($row, $heading));
    }

    /**
     * Desimal opsional (gram/kadar/persen). Null bila kosong.
     */
    private function desimal(array $row, string $heading): ?float
    {
        return $this->bersihDesimal($this->ambil($row, $heading));
    }

    private function parseFrekuensi($value): ?string
    {
        $value = Str::lower(trim((string) ($value ?? '')));

        return match ($value) {
            'harian' => FrekuensiSetoran::Harian->value,
            'mingguan' => FrekuensiSetoran::Mingguan->value,
            'bulanan' => FrekuensiSetoran::Bulanan->value,
            default => null,
        };
    }

    private function parseTanggal($value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('!d/m/Y', $value) ?: Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Terapkan seluruh blok tabungan untuk setiap baris (user baru/update).
     * Dipanggil oleh controller SETELAH Excel::import selesai.
     */
    public function prosesTabungan(): void
    {
        foreach ($this->pending as $item) {
            $user = User::withTrashed()
                ->whereRaw('LOWER(name) = ?', [Str::lower($item['nama'])])
                ->first();

            // Tabungan hanya dicatat untuk nasabah.
            if (! $user || $user->role !== UserRole::User) {
                continue;
            }

            // Satu baris yang produknya diisi separuh/tidak valid TIDAK boleh
            // membatalkan seluruh file: user (nama + status) tetap terdaftar,
            // blok yang bermasalah dilewati dengan catatan.
            try {
                $this->prosesEmas($user, $item['row'], $item['baris']);
                $this->prosesHariRaya($user, $item['row'], $item['baris']);
                $this->prosesBerjangka($user, $item['row'], $item['baris']);
                $this->prosesQurban($user, $item['row'], $item['baris']);
                $this->prosesMandiri($user, $item['row'], $item['baris']);
                $this->prosesGadai($user, $item['row'], $item['baris']);
            } catch (\Throwable $e) {
                $this->skipped[] = 'Baris '.$item['baris'].": data tabungan tidak valid dan dilewati ({$e->getMessage()}).";
            }
        }
    }

    private function prosesEmas(User $user, array $row, int $baris): void
    {
        $targetGram = $this->desimal($row, 'Emas - Target (gram)');
        if ($targetGram !== null) {
            $jenis = $this->jenisByKode('EMAS');
            if (! $jenis) {
                $this->skipped[] = "Baris {$baris}: Jenis tabungan EMAS tidak ditemukan.";

                return;
            }

            KonfigurasiSetoranEmas::updateOrCreate(
                ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
                [
                    'target_gram_total' => $targetGram,
                    'target_gram_per_periode' => $this->desimal($row, 'Emas - Gram per Periode'),
                    'nominal_per_periode' => $this->rupiah($row, 'Emas - Nominal per Periode (Rp)'),
                    'frekuensi_setor' => $this->parseFrekuensi($this->ambil($row, 'Emas - Frekuensi Bayar') ?? 'bulanan'),
                    'durasi_periode' => $this->bersihNominal($this->ambil($row, 'Emas - Durasi (Periode)')),
                    'tanggal_mulai' => $this->parseTanggal($this->ambil($row, 'Emas - Tanggal Mulai')),
                    'tanggal_deadline' => $this->parseTanggal($this->ambil($row, 'Emas - Jatuh Tempo')),
                    'status' => StatusKonfigurasiSetoran::Aktif->value,
                    'created_by' => auth()->id(),
                ]
            );

            // Salin semantik KonfigurasiSetoranEmasController::store: rencana
            // pertama menetapkan goal global (target_emas_gram) untuk user.
            if ($user->target_emas_gram === null && $targetGram > 0) {
                $user->update(['target_emas_gram' => round($targetGram, 6)]);
            }

            $this->targetDiatur++;
        }

        // "Yang Sudah Terkumpul" emas: nominal rupiah dikonversi ke gram
        // (setoran di luar rencana) dan dicatat sebagai saldo awal terverifikasi.
        $this->prosesSaldoEmasTerkumpul($user, $row, $baris);
    }

    private function prosesSaldoEmasTerkumpul(User $user, array $row, int $baris): void
    {
        $saldo = $this->rupiah($row, 'Emas - Yang Sudah Terkumpul (Rp)');
        if ($saldo === null) {
            return;
        }

        $jenis = $this->jenisByKode('EMAS');
        if (! $jenis) {
            $this->skipped[] = "Baris {$baris}: Jenis tabungan EMAS tidak ditemukan.";

            return;
        }

        $harga = HargaEmasHarian::hargaTerkini();
        if (! $harga) {
            $this->skipped[] = "Baris {$baris}: 'Emas - Yang Sudah Terkumpul' dilewati karena harga emas belum diinput admin.";

            return;
        }

        // Sama seperti setoran emas biasa di luar rencana: gramasi diestimasi dari
        // harga acuan, guna harga jual bertingkat, lalu konversi nominal → gram.
        $gramasi = (float) $harga->harga_per_gram > 0 ? $saldo / (float) $harga->harga_per_gram : 0.0;
        $hargaJual = $harga->hargaJualPerGram($gramasi);
        $porsi = app(SaldoEmasService::class)->hitungSetoran($saldo, null, 0.0, $hargaJual);

        $ekstra = [
            'unit_didapat' => $porsi['unit_didapat'],
            'nominal_emas' => $porsi['nominal_emas'],
            'nominal_selisih' => $porsi['nominal_selisih'],
            'harga_acuan_id' => $harga->id,
            'harga_acuan_snapshot' => $hargaJual,
        ];

        // Sambungkan ke rencana emas (konfigurasi) yang baru dibuat/diperbarui oleh
        // import baris ini agar progress rencana (gram terkumpul, capaian gram,
        // sisa periode, konsistensi) ikut terisi dari saldo awal.
        // ponytail: bila nasabah punya >1 rencana aktif, saldo awal di-attribusi ke
        // rencana terbaru; per-rencana alokasi manual bisa ditambahkan bila dipakai.
        $konfigurasi = app(SaldoEmasService::class)->getAktif($user, $jenis);
        if ($konfigurasi) {
            $ekstra['konfigurasi_id'] = $konfigurasi->id;
        }

        $this->aturSaldoAwal($user, $jenis->id, $saldo, $baris, $ekstra);
    }

    private function prosesHariRaya(User $user, array $row, int $baris): void
    {
        $target = $this->rupiah($row, 'Hari Raya - Target (Rp)');
        if ($target !== null) {
            $jenis = $this->jenisByKode('tabungan-hari-raya');
            if (! $jenis) {
                $this->skipped[] = "Baris {$baris}: Jenis tabungan Hari Raya tidak ditemukan.";

                return;
            }

            UserTabunganTarget::updateOrCreate(
                ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
                [
                    'target_nominal' => $target,
                    'frekuensi_setor' => $this->parseFrekuensi($this->ambil($row, 'Hari Raya - Frekuensi Bayar') ?? 'bulanan'),
                    'nominal_per_periode' => $this->rupiah($row, 'Hari Raya - Nominal per Periode (Rp)'),
                    'durasi_periode' => $this->bersihNominal($this->ambil($row, 'Hari Raya - Durasi (Periode)')),
                    'tanggal_mulai' => $this->parseTanggal($this->ambil($row, 'Hari Raya - Tanggal Mulai')),
                    'tanggal_deadline' => $this->parseTanggal($this->ambil($row, 'Hari Raya - Jatuh Tempo')),
                ]
            );
            $this->targetDiatur++;
        }

        $this->prosesSaldoSudahTerkumpul($user, $row, $baris, 'tabungan-hari-raya', 'Hari Raya');
    }

    private function prosesBerjangka(User $user, array $row, int $baris): void
    {
        $target = $this->rupiah($row, 'Berjangka - Target (Rp)');
        if ($target !== null) {
            $jenis = $this->jenisByKode('tabungan-berjangka');
            if (! $jenis) {
                $this->skipped[] = "Baris {$baris}: Jenis tabungan Berjangka tidak ditemukan.";

                return;
            }

            TabunganBerjangka::updateOrCreate(
                ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
                [
                    'target_nominal' => $target,
                    'frekuensi_setor' => $this->parseFrekuensi($this->ambil($row, 'Berjangka - Frekuensi Bayar') ?? 'bulanan'),
                    'nominal_per_periode' => $this->rupiah($row, 'Berjangka - Nominal per Periode (Rp)'),
                    'durasi_bulan' => $this->bersihNominal($this->ambil($row, 'Berjangka - Durasi (Periode)')),
                    'tanggal_mulai' => $this->parseTanggal($this->ambil($row, 'Berjangka - Tanggal Mulai')),
                    'tanggal_jatuh_tempo' => $this->parseTanggal($this->ambil($row, 'Berjangka - Jatuh Tempo')),
                    'status' => 'aktif',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                    'created_by' => auth()->id(),
                ]
            );
            $this->targetDiatur++;
        }

        // Sambungkan saldo awal ke akun berjangka agar terkumpul dihitung langsung
        // (bukan fallback jendela waktu yang rapuh bila nanti ada setoran bertanda).
        $jenis = $this->jenisByKode('tabungan-berjangka');
        $tb = $jenis
            ? TabunganBerjangka::where('user_id', $user->id)->where('jenis_tabungan_id', $jenis->id)->latest('id')->first()
            : null;
        $this->prosesSaldoSudahTerkumpul($user, $row, $baris, 'tabungan-berjangka', 'Berjangka', $tb ? ['tabungan_berjangka_id' => $tb->id] : []);
    }

    private function prosesQurban(User $user, array $row, int $baris): void
    {
        $target = $this->rupiah($row, 'Qurban - Target (Rp)');
        if ($target !== null) {
            $hewanNama = trim((string) ($this->ambil($row, 'Qurban - Jenis Hewan') ?? ''));
            $periodeText = trim((string) ($this->ambil($row, 'Qurban - Periode') ?? ''));

            $hewan = $hewanNama !== '' ? HewanQurban::aktif()->where('jenis_hewan', $hewanNama)->first() : null;
            $tahun = (int) preg_replace('/\D+/', '', $periodeText);
            $periode = $tahun > 0
                ? PeriodeQurban::where('tahun', $tahun)->first()
                : PeriodeQurban::aktif()->first();

            if (! $hewan && $hewanNama !== '') {
                $this->skipped[] = "Baris {$baris}: Hewan qurban '{$hewanNama}' tidak ditemukan.";

                return;
            }

            PendaftaranQurban::updateOrCreate(
                ['user_id' => $user->id, 'periode_qurban_id' => $periode?->id],
                [
                    'hewan_qurban_id' => $hewan?->id,
                    'jumlah_hewan' => $this->bersihNominal($this->ambil($row, 'Qurban - Jumlah Hewan')) ?? 1,
                    'target_dana' => $target,
                    'total_terkumpul' => 0,
                    'status' => StatusPendaftaranQurban::Menabung->value,
                    'tanggal_daftar' => $this->parseTanggal($this->ambil($row, 'Qurban - Tanggal Daftar')) ?? now()->toDateString(),
                    'frekuensi_setor' => $this->parseFrekuensi($this->ambil($row, 'Qurban - Frekuensi Bayar') ?? 'bulanan'),
                    'nominal_per_periode' => $this->rupiah($row, 'Qurban - Nominal per Periode (Rp)'),
                ]
            );
            $this->targetDiatur++;
        }

        // Saldo awal qurban dicatat setelah pendaftaran dibuat agar total_terkumpul
        // bisa di-refresh & transaksinya tertaut ke pendaftaran (dasar progress qurban).
        $this->prosesSaldoQurbanTerkumpul($user, $row, $baris);
    }

    private function prosesSaldoQurbanTerkumpul(User $user, array $row, int $baris): void
    {
        $saldo = $this->rupiah($row, 'Qurban - Yang Sudah Terkumpul (Rp)');
        if ($saldo === null) {
            return;
        }

        $jenis = $this->jenisByKode('tabungan-qurban');
        if (! $jenis) {
            $this->skipped[] = "Baris {$baris}: Jenis tabungan Qurban tidak ditemukan.";

            return;
        }

        $pendaftaran = PendaftaranQurban::where('user_id', $user->id)
            ->where('status', '!=', 'batal')
            ->latest('id')
            ->first();

        if (! $pendaftaran) {
            $this->skipped[] = "Baris {$baris}: 'Qurban - Yang Sudah Terkumpul' dilewati karena nasabah belum punya pendaftaran qurban (isi kolom target qurban).";

            return;
        }

        $this->aturSaldoAwal($user, $jenis->id, $saldo, $baris, ['pendaftaran_qurban_id' => $pendaftaran->id]);
        app(\App\Services\QurbanTargetService::class)->updateTotalTerkumpul($pendaftaran->fresh());
    }

    private function prosesMandiri(User $user, array $row, int $baris): void
    {
        $this->prosesSaldoSudahTerkumpul($user, $row, $baris, 'tabungan-pribadi', 'Mandiri');
    }

    /**
     * Catat "X - Yang Sudah Terkumpul (Rp)" sebagai saldo awal tabungan
     * (setoran terverifikasi bertanda SALDO_AWAL_IMPORT), idempotent.
     */
    private function prosesSaldoSudahTerkumpul(User $user, array $row, int $baris, string $kode, string $label, array $ekstra = []): void
    {
        $saldo = $this->rupiah($row, $label.' - Yang Sudah Terkumpul (Rp)');
        if ($saldo === null) {
            return;
        }

        $jenis = $this->jenisByKode($kode);
        if (! $jenis) {
            $this->skipped[] = "Baris {$baris}: Jenis tabungan {$label} tidak ditemukan.";

            return;
        }

        $this->aturSaldoAwal($user, $jenis->id, $saldo, $baris, $ekstra);
    }

    private function prosesGadai(User $user, array $row, int $baris): void
    {
        $nomor = trim((string) ($this->ambil($row, 'Gadai - No. Referensi') ?? ''));
        if ($nomor === '') {
            return;
        }

        $statusText = Str::lower(trim((string) ($this->ambil($row, 'Gadai - Status') ?? 'aktif')));
        $status = $this->parseStatusGadai($statusText);

        Gadai::updateOrCreate(
            ['nomor_gadai' => $nomor],
            [
                'user_id' => $user->id,
                'jenis_emas' => trim((string) ($this->ambil($row, 'Gadai - Jenis Emas') ?? '')),
                'berat_gram' => $this->desimal($row, 'Gadai - Berat (gram)'),
                'kadar' => $this->desimal($row, 'Gadai - Kadar (%)') ?? 999.0,
                'berat_bersih_gram' => $this->desimal($row, 'Gadai - Berat Bersih (gram)'),
                'harga_acuan' => $this->rupiah($row, 'Gadai - Harga Acuan (Rp/gram)'),
                'nilai_taksiran' => $this->rupiah($row, 'Gadai - Nilai Taksiran (Rp)'),
                'persen_gadai' => $this->desimal($row, 'Gadai - Persen Gadai (%)') ?? 80.0,
                'besaran_gadai' => $this->rupiah($row, 'Gadai - Besaran Gadai (Rp)'),
                'tenor_satuan' => trim((string) ($this->ambil($row, 'Gadai - Tenor (Satuan)') ?? 'bulan')),
                'toleransi_hari' => $this->bersihNominal($this->ambil($row, 'Gadai - Toleransi Hari')) ?? 0,
                'frekuensi_bayar' => $this->parseFrekuensi($this->ambil($row, 'Gadai - Frekuensi Bayar')) ?? 'harian',
                'nominal_angkuran' => $this->rupiah($row, 'Gadai - Nominal Angsuran (Rp)'),
                'bunga_persen' => $this->desimal($row, 'Gadai - Bunga (%)') ?? 4.0,
                'tipe_bunga' => 'menurun',
                'total_dibayar' => $this->rupiah($row, 'Gadai - Total Dibayar (Rp)'),
                'tanggal_aju' => $this->parseTanggal($this->ambil($row, 'Gadai - Tanggal Aju')),
                'tanggal_aktif' => $this->parseTanggal($this->ambil($row, 'Gadai - Tanggal Aktif')),
                'tanggal_jatuh_tempo' => $this->parseTanggal($this->ambil($row, 'Gadai - Jatuh Tempo')),
                'status' => $status,
                'created_by' => auth()->id(),
            ]
        );
    }

    private function parseStatusGadai(string $value): string
    {
        return match ($value) {
            'disetujui' => StatusGadai::Disetujui->value,
            'aktif' => StatusGadai::Aktif->value,
            'jatuh_tempo' => StatusGadai::JatuhTempo->value,
            'terlambat' => StatusGadai::Terlambat->value,
            'diperpanjang' => StatusGadai::Diperpanjang->value,
            'lunas' => StatusGadai::Lunas->value,
            'emas_dikembalikan' => StatusGadai::EmasDikembalikan->value,
            'batal' => StatusGadai::Batal->value,
            default => StatusGadai::Diajukan->value,
        };
    }

    private function aturSaldoAwal(User $user, int $jenisId, int $saldo, int $baris, array $ekstra = []): void
    {
        $hasil = app(\App\Services\SaldoAwalService::class)->atur($user, $jenisId, $saldo, 'IMPORT_LAPORAN_HARIAN', $ekstra);

        match ($hasil) {
            'created' => $this->saldoDicatat++,
            'updated' => $this->saldoDiubah++,
            'deleted' => $this->saldoDihapus++,
            'denied' => $this->skipped[] = "Baris {$baris}: Saldo awal ditolak karena histori laporan harian untuk tabungan ini sudah ada.",
            default => null,
        };
    }

    public function getCreatedCount(): int
    {
        return count($this->created);
    }

    public function getUpdatedCount(): int
    {
        return count($this->updated);
    }

    public function getSkippedCount(): int
    {
        return count($this->skipped);
    }

    public function getSkippedDetail(): array
    {
        return array_slice($this->skipped, 0, 20);
    }

    public function getTargetCount(): int
    {
        return $this->targetDiatur;
    }

    public function getSaldoAwalCreatedCount(): int
    {
        return $this->saldoDicatat;
    }

    public function getSaldoAwalChangedCount(): int
    {
        return $this->saldoDiubah;
    }

    public function getSaldoAwalRemovedCount(): int
    {
        return $this->saldoDihapus;
    }

    private function parseRole(string $value): string
    {
        $value = Str::lower(trim($value));

        return str_contains($value, 'admin') ? UserRole::Admin->value : UserRole::User->value;
    }

    private function parseStatus(string $value): string
    {
        $value = Str::lower(trim($value));

        return match ($value) {
            'aktif', 'active' => UserStatus::Active->value,
            'ditolak', 'rejected' => UserStatus::Rejected->value,
            'dibekukan', 'suspended' => UserStatus::Suspended->value,
            'menunggu persetujuan', 'pending', 'inactive', 'belum aktif' => UserStatus::Inactive->value,
            default => UserStatus::Active->value,
        };
    }

    /**
     * Nomor telepon placeholder unik (10 digit, awalan 000), untuk memenuhi
     * kolom phone yang NOT NULL. Nasabah mengganti dengan nomor asli di akun.
     */
    private function generatePlaceholderPhone(): string
    {
        do {
            $candidate = '000'.rand(1000000, 9999999);
        } while (User::where('phone', $candidate)->exists());

        return $candidate;
    }

    private function generateUniqueUsername(string $name): string
    {
        $base = preg_replace('/[^a-z0-9]/', '', strtolower(Str::slug(explode(' ', trim($name))[0], '')));
        if (strlen($base) < 3) {
            $base = 'user';
        }
        do {
            $candidate = $base.rand(1000, 9999);
        } while (User::where('username', $candidate)->exists());

        return $candidate;
    }
}