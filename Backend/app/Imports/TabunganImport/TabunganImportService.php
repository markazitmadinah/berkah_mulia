<?php

namespace App\Imports\TabunganImport;

use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\StatusPendaftaranQurban;
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
use App\Models\Transaksi;
use App\Models\User;
use App\Models\UserTabunganTarget;
use App\Services\SaldoAwalService;
use App\Services\SaldoEmasService;
use App\Services\QurbanTargetService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Orkestrasi import tabungan 7 sheet:
 * - baca: parse file ke array per sheet.
 * - selesai: validasi + resolve (read-only) → errors/summary + normalized payload.
 * - impor: selesai() + persist atomik DB::transaction.
 */
class TabunganImportService
{
    private const JENIS_EMAS = 'EMAS';
    private const JENIS_PRIBADI = 'tabungan-pribadi';
    private const JENIS_QURBAN = 'tabungan-qurban';
    private const JENIS_HARI_RAYA = 'tabungan-hari-raya';
    private const JENIS_BERJANGKA = 'tabungan-berjangka';
    private const PENANDA_TERLARANG = 'IMPORT_LAPORAN_HARIAN';

    public function __construct(
        private SaldoAwalService $saldoAwal,
        private SaldoEmasService $saldoEmas,
        private QurbanTargetService $qurbanTarget,
    ) {}

    public function baca($file): array
    {
        $reader = new TabunganImportReader();
        \Maatwebsite\Excel\Facades\Excel::import($reader, $file);

        return $reader->data();
    }

    /**
     * Validasi + resolve (read-only). Kembalikan normalized plan siap persist.
     */
    public function selesai(array $data, ?int $adminId = null): array
    {
        $adminId ??= Auth::id();
        $errors = [];
        $warnings = [];
        $counters = [
            'nasabah' => ['baru' => 0, 'ada' => 0],
            'emas' => ['rencana' => 0, 'saldo_awal' => 0],
            'mandiri' => ['saldo_awal' => 0],
            'qurban' => ['daftar' => 0, 'saldo_awal' => 0],
            'hari_raya' => ['target' => 0, 'saldo_awal' => 0],
            'gadai' => ['record' => 0],
            'berjangka' => ['rencana' => 0, 'saldo_awal' => 0],
        ];

        $nasabah = $this->resolveNasabah($data['Nasabah'] ?? [], $errors, $counters);
        $plan = [
            'nasabah' => $nasabah,
            'emas' => empty($errors)
                ? $this->resolveEmas($data['Emas'] ?? [], $nasabah, $errors)
                : [],
            'mandiri' => empty($errors)
                ? $this->resolveMandiri($data['Mandiri'] ?? [], $nasabah, $errors)
                : [],
            'hari_raya' => empty($errors)
                ? $this->resolveHariRaya($data['Hari Raya'] ?? [], $nasabah, $errors)
                : [],
            'qurban' => empty($errors)
                ? $this->resolveQurban($data['Qurban'] ?? [], $nasabah, $errors)
                : [],
            'berjangka' => empty($errors)
                ? $this->resolveBerjangka($data['Berjangka'] ?? [], $nasabah, $errors)
                : [],
            'gadai' => empty($errors)
                ? $this->resolveGadai($data['Gadai'] ?? [], $nasabah, $errors)
                : [],
        ];

        foreach ($plan['emas'] as $r) {
            $counters['emas']['rencana']++;
            if ($r['gram_terkumpul'] !== null || $r['total_sudah_disetor'] !== null) {
                $counters['emas']['saldo_awal']++;
            }
        }
        foreach ($plan['mandiri'] as $r) {
            if ($r['saldo_awal'] !== null) {
                $counters['mandiri']['saldo_awal']++;
            }
        }
        foreach ($plan['qurban'] as $r) {
            $counters['qurban']['daftar']++;
            if ($r['sudah_terkumpul'] !== null) {
                $counters['qurban']['saldo_awal']++;
            }
        }
        foreach ($plan['hari_raya'] as $r) {
            $counters['hari_raya']['target']++;
            if ($r['sudah_terkumpul'] !== null) {
                $counters['hari_raya']['saldo_awal']++;
            }
        }
        foreach ($plan['berjangka'] as $r) {
            $counters['berjangka']['rencana']++;
            if ($r['sudah_terkumpul'] !== null) {
                $counters['berjangka']['saldo_awal']++;
            }
        }
        foreach ($plan['gadai'] as $r) {
            $counters['gadai']['record']++;
        }

        return $this->hasil($errors, $warnings, $counters, $plan);
    }

    /**
     * Import penuh: validasi + persist dalam DB::transaction.
     */
    public function impor(array $fileData, ?int $adminId = null): array
    {
        $adminId ??= Auth::id();
        $hasil = $this->selesai($fileData, $adminId);

        if ($hasil['errors']) {
            return $hasil;
        }

        return DB::transaction(function () use ($hasil, $adminId) {
            $users = $this->persistNasabah($hasil['plan']['nasabah'], $adminId);
            $this->persistEmas($hasil['plan']['emas'], $users, $adminId);
            $this->persistMandiri($hasil['plan']['mandiri'], $users, $adminId);
            $this->persistHariRaya($hasil['plan']['hari_raya'], $users);
            $this->persistQurban($hasil['plan']['qurban'], $users, $adminId);
            $this->persistBerjangka($hasil['plan']['berjangka'], $users, $adminId);
            $this->persistGadai($hasil['plan']['gadai'], $users, $adminId);

            return $hasil;
        });
    }

    // ───────────────────────────────────────────────────────────────
    // Resolvers (read-only)
    // ───────────────────────────────────────────────────────────────

    private function resolveNasabah(array $rows, array &$errors, array &$counters): array
    {
        $nasabah = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Nasabah', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            $nama = $p->teks('Nama Lengkap');
            if ($nasabahId === '') {
                $errors[] = $this->err('Nasabah', $baris, 'Nasabah ID', '', 'Wajib diisi');
                continue;
            }
            if ($nama === '') {
                $errors[] = $this->err('Nasabah', $baris, 'Nama Lengkap', '', 'Wajib diisi');
                continue;
            }
            if (isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Nasabah', $baris, 'Nasabah ID', $nasabahId, 'Nasabah ID duplikat');
                continue;
            }
            $existing = User::withTrashed()->where('nasabah_id', $nasabahId)->first();
            if (! $existing) {
                $existing = $this->cariNasabah($p);
                if ($existing && $existing->nasabah_id === null) {
                    $existing->update(['nasabah_id' => $nasabahId]);
                }
            }
            $noAnggota = $p->nullableTeks('No. Anggota');
            if ($noAnggota !== null) {
                if (preg_match('/^\d{10}$/', $noAnggota) !== 1) {
                    $errors[] = $this->err('Nasabah', $baris, 'No. Anggota', $noAnggota, 'Harus 10 digit angka');
                    continue;
                }
                $pemilik = User::withTrashed()->where('nomor_anggota', $noAnggota)->first();
                if ($pemilik && (! $existing || $pemilik->id !== $existing->id)) {
                    $errors[] = $this->err('Nasabah', $baris, 'No. Anggota', $noAnggota, 'Sudah dipakai nasabah lain');
                    continue;
                }
            }
            $username = $p->nullableTeks('Username');
            if ($username !== null) {
                if (preg_match('/^[A-Za-z0-9._]{3,50}$/', $username) !== 1) {
                    $errors[] = $this->err('Nasabah', $baris, 'Username', $username, 'Hanya huruf, angka, titik, underscore (3–50 karakter)');
                    continue;
                }
                $pemilik = User::withTrashed()->where('username', $username)->first();
                if ($pemilik && (! $existing || $pemilik->id !== $existing->id)) {
                    $errors[] = $this->err('Nasabah', $baris, 'Username', $username, 'Sudah dipakai nasabah lain');
                    continue;
                }
            }
            $nasabah[$nasabahId] = [
                'user' => $existing,
                'nama_lengkap' => $nama,
                'username' => $username,
                'no_handphone' => $p->nullableTeks('No. Handphone'),
                'alamat' => $p->nullableTeks('Alamat'),
                'no_anggota' => $noAnggota,
                'baris' => $baris,
            ];
            $counters['nasabah'][$existing ? 'ada' : 'baru']++;
        }
        return $nasabah;
    }

    private function resolveEmas(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        $dedupe = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Emas', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            $rencana = $p->nullableTeks('Rencana') ?? 'Default';
            if (! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Emas', $baris, 'Nasabah ID', $nasabahId, 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $frekuensi = $p->frekuensi('Frekuensi');
            if ($frekuensi === null) {
                $errors[] = $this->err('Emas', $baris, 'Frekuensi', $p->teks('Frekuensi'), 'Harus Harian/Mingguan/Bulanan');
                continue;
            }
            $key = "{$nasabahId}:{$rencana}";
            if (isset($dedupe[$key])) {
                $errors[] = $this->err('Emas', $baris, 'Rencana', $rencana, 'Duplikat rencana untuk nasabah ini (baris '.$dedupe[$key].')');
                continue;
            }
            $dedupe[$key] = $baris;
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'rencana' => $rencana,
                'frekuensi' => $frekuensi,
                'nominal_per_periode' => $p->rupiah('Nominal Setoran (Rp)'),
                'target_gram_total' => $p->desimal('Target Gram Total'),
                'tanggal_mulai' => $p->tanggal('Tanggal Mulai'),
                'gram_terkumpul' => $p->desimal('Gram Terkumpul'),
                'total_sudah_disetor' => $p->rupiah('Total Sudah Disetor (Rp)'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    private function resolveMandiri(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Mandiri', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            if (! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Mandiri', $baris, 'Nasabah ID', $nasabahId, 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'saldo_awal' => $p->rupiah('Saldo Awal (Rp)'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    private function resolveHariRaya(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Hari Raya', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            if (! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Hari Raya', $baris, 'Nasabah ID', $nasabahId, 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $target = $p->rupiah('Target (Rp)');
            $frekuensi = $p->frekuensi('Frekuensi');
            if ($target === null) {
                $errors[] = $this->err('Hari Raya', $baris, 'Target (Rp)', '', 'Wajib diisi');
                continue;
            }
            if ($frekuensi === null) {
                $errors[] = $this->err('Hari Raya', $baris, 'Frekuensi', $p->teks('Frekuensi'), 'Harus Harian/Mingguan/Bulanan');
                continue;
            }
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'target_nominal' => $target,
                'frekuensi' => $frekuensi,
                'nominal_per_periode' => $p->rupiah('Nominal Setoran (Rp)'),
                'tanggal_mulai' => $p->tanggal('Tanggal Mulai'),
                'sudah_terkumpul' => $p->rupiah('Sudah Terkumpul (Rp)'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    private function resolveQurban(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        $dedupe = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Qurban', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            $rencana = $p->nullableTeks('Rencana') ?? 'Default';
            if (! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Qurban', $baris, 'Nasabah ID', $nasabahId, 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $key = "{$nasabahId}:{$rencana}";
            if (isset($dedupe[$key])) {
                $errors[] = $this->err('Qurban', $baris, 'Rencana', $rencana, 'Duplikat rencana untuk nasabah ini (baris '.$dedupe[$key].')');
                continue;
            }
            $dedupe[$key] = $baris;
            $periodeTahun = $p->banyak('Periode Tahun');
            $periode = $periodeTahun
                ? PeriodeQurban::where('tahun', $periodeTahun)->first()
                : PeriodeQurban::aktif()->first();
            if (! $periode) {
                $errors[] = $this->err('Qurban', $baris, 'Periode Tahun', (string) ($periodeTahun ?? ''), 'Periode tidak ditemukan / tidak ada periode aktif');
                continue;
            }
            $jenisHewanNama = $p->teks('Jenis Hewan');
            $hewan = $jenisHewanNama !== ''
                ? HewanQurban::where('jenis_hewan', $jenisHewanNama)
                    ->where('periode_qurban_id', $periode->id)
                    ->aktif()->first()
                : null;
            if (! $hewan) {
                $errors[] = $this->err('Qurban', $baris, 'Jenis Hewan', $jenisHewanNama, 'Hewan tidak ditemukan / tidak aktif di periode tersebut');
                continue;
            }
            $frekuensi = $p->frekuensi('Frekuensi');
            if ($frekuensi === null) {
                $errors[] = $this->err('Qurban', $baris, 'Frekuensi', $p->teks('Frekuensi'), 'Harus Harian/Mingguan/Bulanan');
                continue;
            }
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'rencana' => $rencana,
                'periode' => $periode,
                'hewan' => $hewan,
                'jumlah_hewan' => $p->banyak('Jumlah Hewan') ?? 1,
                'target_dana' => $this->qurbanTarget->hitungTargetDana($hewan, $p->banyak('Jumlah Hewan') ?? 1),
                'frekuensi' => $frekuensi,
                'nominal_per_periode' => $p->rupiah('Nominal Setoran (Rp)'),
                'tanggal_daftar' => $p->tanggal('Tanggal Daftar') ?? now()->toDateString(),
                'sudah_terkumpul' => $p->rupiah('Sudah Terkumpul (Rp)'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    private function resolveBerjangka(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        $dedupe = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Berjangka', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->teks('Nasabah ID');
            $rencana = $p->nullableTeks('Rencana') ?? 'Default';
            if (! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Berjangka', $baris, 'Nasabah ID', $nasabahId, 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $key = "{$nasabahId}:{$rencana}";
            if (isset($dedupe[$key])) {
                $errors[] = $this->err('Berjangka', $baris, 'Rencana', $rencana, 'Duplikat rencana untuk nasabah ini (baris '.$dedupe[$key].')');
                continue;
            }
            $dedupe[$key] = $baris;
            $target = $p->rupiah('Target (Rp)');
            $durasi = $p->banyak('Durasi (Bulan)');
            $nominal = $p->rupiah('Nominal Setoran (Rp)');
            $frekuensi = $p->frekuensi('Frekuensi');
            if ($target === null || $target < 50000) {
                $errors[] = $this->err('Berjangka', $baris, 'Target (Rp)', (string) ($target ?? ''), 'Minimal Rp50.000');
                continue;
            }
            if ($durasi === null || $durasi < 1 || $durasi > 120) {
                $errors[] = $this->err('Berjangka', $baris, 'Durasi (Bulan)', (string) ($durasi ?? ''), 'Wajib 1..120');
                continue;
            }
            if ($nominal === null || $nominal <= 0) {
                $errors[] = $this->err('Berjangka', $baris, 'Nominal Setoran (Rp)', (string) ($nominal ?? ''), 'Wajib > 0');
                continue;
            }
            if ($frekuensi === null) {
                $errors[] = $this->err('Berjangka', $baris, 'Frekuensi', $p->teks('Frekuensi'), 'Harus Harian/Mingguan/Bulanan');
                continue;
            }
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'rencana' => $rencana,
                'target_nominal' => $target,
                'durasi_bulan' => $durasi,
                'nominal_per_periode' => $nominal,
                'frekuensi' => $frekuensi,
                'tanggal_mulai' => $p->tanggal('Tanggal Mulai') ?? now()->toDateString(),
                'sudah_terkumpul' => $p->rupiah('Sudah Terkumpul (Rp)'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    private function resolveGadai(array $rows, array $nasabah, array &$errors): array
    {
        $out = [];
        $nomor = [];
        foreach ($rows as $baris => $row) {
            $p = new TabunganImportValidator('Gadai', $baris, $row);
            if ($p->kosong() || $p->contoh($p->teks('Nasabah ID'))) {
                continue;
            }
            $nasabahId = $p->nullableTeks('Nasabah ID');
            if ($nasabahId === null || ! isset($nasabah[$nasabahId])) {
                $errors[] = $this->err('Gadai', $baris, 'Nasabah ID', $nasabahId ?? '', 'Tidak terdaftar di sheet Nasabah');
                continue;
            }
            $nomorGadai = $p->teks('Nomor Gadai');
            if ($nomorGadai === '') {
                $errors[] = $this->err('Gadai', $baris, 'Nomor Gadai', '', 'Wajib diisi');
                continue;
            }
            $key = \Illuminate\Support\Str::lower($nomorGadai);
            if (isset($nomor[$key])) {
                $errors[] = $this->err('Gadai', $baris, 'Nomor Gadai', $nomorGadai, 'Duplikat nomor gadai (baris '.$nomor[$key].')');
                continue;
            }
            $nomor[$key] = $baris;
            $out[] = [
                'nasabah_id' => $nasabahId,
                'user' => $nasabah[$nasabahId]['user'],
                'nomor_gadai' => $nomorGadai,
                'jenis_emas' => $p->nullableTeks('Jenis Emas'),
                'berat_gram' => $p->desimal('Berat (gram)'),
                'kadar' => $p->desimal('Kadar') ?? 999.0,
                'berat_bersih_gram' => $p->desimal('Berat Bersih (gram)'),
                'harga_acuan' => $p->rupiah('Harga Acuan (Rp/gram)'),
                'nilai_taksiran' => $p->rupiah('Nilai Taksiran (Rp)'),
                'persen_gadai' => $p->desimal('Persen Gadai (%)') ?? 80.0,
                'besaran_gadai' => $p->rupiah('Besaran Gadai (Rp)'),
                'tenor_satuan' => $p->nullableTeks('Tenor (Satuan)') ?? 'bulan',
                'frekuensi' => $p->frekuensi('Frekuensi') ?? 'harian',
                'nominal_angsuran' => $p->rupiah('Nominal Angsuran (Rp)'),
                'bunga_persen' => $p->desimal('Bunga (%)') ?? 4.0,
                'total_dibayar' => $p->rupiah('Total Dibayar (Rp)') ?? 0,
                'tanggal_aju' => $p->tanggal('Tanggal Aju'),
                'tanggal_jatuh_tempo' => $p->tanggal('Jatuh Tempo'),
                'status' => $p->statusGadai('Status'),
                'baris' => $baris,
            ];
        }
        return $out;
    }

    // ───────────────────────────────────────────────────────────────
    // Persist (dalam DB::transaction)
    // ───────────────────────────────────────────────────────────────

    /**
     * @return array<string, User> peta nasabah_id → User (baru / existing)
     */
    private function persistNasabah(array $rows, int $adminId): array
    {
        $users = [];
        foreach ($rows as $nasabahId => $row) {
            if ($row['user'] instanceof User) {
                $update = [];
                if ($row['user']->nomor_anggota === null) {
                    $update['nomor_anggota'] = $row['no_anggota'] ?? $this->generateNomorAnggota();
                }
                if ($row['username'] !== null && $row['user']->username !== $row['username']) {
                    $update['username'] = $row['username'];
                }
                if ($update !== []) {
                    $row['user']->update($update);
                }
                $users[$nasabahId] = $row['user'];
                continue;
            }
            $username = $row['username'] ?? $this->generateUniqueUsername($row['nama_lengkap']);
            $user = new User();
            $user->forceFill([
                'name' => $row['nama_lengkap'],
                'username' => $username,
                'nasabah_id' => $nasabahId,
                'phone' => $row['no_handphone'] ?? $this->generatePlaceholderPhone(),
                'address' => $row['alamat'],
                'nomor_anggota' => $row['no_anggota'] ?? $this->generateNomorAnggota(),
                'password' => bcrypt(Str::random(16)),
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'approved_at' => now(),
            ]);
            $user->save();
            $users[$nasabahId] = $user;
        }
        return $users;
    }

    private function generateNomorAnggota(): string
    {
        do {
            $candidate = (string) rand(1000000000, 9999999999);
        } while (User::withTrashed()->where('nomor_anggota', $candidate)->exists());

        return $candidate;
    }

    private function persistEmas(array $rows, array $users, int $adminId): void
    {
        $jenis = $this->jenis(self::JENIS_EMAS);
        if (! $jenis) {
            return;
        }
        foreach ($rows as $r) {
            /** @var User $user */
            $user = $users[$r['nasabah_id']];
            $externalId = "{$r['nasabah_id']}:{$r['rencana']}";
            $kse = KonfigurasiSetoranEmas::byExternal($externalId)->first()
                ?? $this->fuzzyEmas($user, $r);
            if ($kse) {
                $kse->update([
                    'nominal_per_periode' => $r['nominal_per_periode'] ?? $kse->nominal_per_periode,
                    'frekuensi_setor' => $r['frekuensi'],
                    'target_gram_total' => $r['target_gram_total'] ?? $kse->target_gram_total,
                    'tanggal_mulai' => $r['tanggal_mulai'] ?? $kse->tanggal_mulai,
                ]);
                if ($kse->external_id === null) {
                    $kse->update(['external_id' => $externalId]);
                }
            } else {
                $this->cekLimitAktif($user->id, self::JENIS_EMAS, 5, $r['baris'], 'rencana emas');
                $kse = KonfigurasiSetoranEmas::create([
                    'external_id' => $externalId,
                    'user_id' => $user->id,
                    'jenis_tabungan_id' => $jenis->id,
                    'nominal_per_periode' => $r['nominal_per_periode'] ?? 0,
                    'frekuensi_setor' => $r['frekuensi'],
                    'target_gram_total' => $r['target_gram_total'],
                    'tanggal_mulai' => $r['tanggal_mulai'] ?? now()->toDateString(),
                    'status' => StatusKonfigurasiSetoran::Aktif,
                    'created_by' => $adminId,
                ]);
            }
            if ($user->target_emas_gram === null && ($r['target_gram_total'] ?? 0) > 0) {
                $user->update(['target_emas_gram' => round((float) $r['target_gram_total'], 6)]);
            }
            if (($r['gram_terkumpul'] ?? null) !== null || ($r['total_sudah_disetor'] ?? null) !== null) {
                $this->aturSaldoAwalRencana($user, $jenis->id, 'konfigurasi_id', $kse->id, $r, $adminId);
            }
        }
    }

    private function persistMandiri(array $rows, array $users, int $adminId): void
    {
        $jenis = $this->jenis(self::JENIS_PRIBADI);
        if (! $jenis) {
            return;
        }
        foreach ($rows as $r) {
            $saldo = $r['saldo_awal'] ?? 0;
            $this->saldoAwal->atur($users[$r['nasabah_id']], $jenis->id, $saldo, self::PENANDA_TERLARANG);
        }
    }

    private function persistHariRaya(array $rows, array $users): void
    {
        $jenis = $this->jenis(self::JENIS_HARI_RAYA);
        if (! $jenis) {
            return;
        }
        foreach ($rows as $r) {
            $user = $users[$r['nasabah_id']];
            UserTabunganTarget::updateOrCreate(
                ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
                [
                    'target_nominal' => $r['target_nominal'],
                    'frekuensi_setor' => $r['frekuensi'],
                    'nominal_per_periode' => $r['nominal_per_periode'] ?? 0,
                    'tanggal_mulai' => $r['tanggal_mulai'] ?? now()->toDateString(),
                ]
            );
            $saldo = $r['sudah_terkumpul'] ?? 0;
            $this->saldoAwal->atur($user, $jenis->id, $saldo, self::PENANDA_TERLARANG);
        }
    }

    private function persistQurban(array $rows, array $users, int $adminId): void
    {
        $jenis = $this->jenis(self::JENIS_QURBAN);
        if (! $jenis) {
            return;
        }
        foreach ($rows as $r) {
            $user = $users[$r['nasabah_id']];
            $externalId = "{$r['nasabah_id']}:{$r['rencana']}";
            $pendaftaran = PendaftaranQurban::byExternal($externalId)->first()
                ?? PendaftaranQurban::where('user_id', $user->id)
                    ->where('periode_qurban_id', $r['periode']->id)
                    ->withoutTrashed()->first();
            $nominalPeriode = $r['nominal_per_periode']
                ?? $this->qurbanTarget->nominalPerPeriode($r['target_dana'], $r['periode'], $r['frekuensi'], null);
            if ($pendaftaran) {
                $pendaftaran->update([
                    'hewan_qurban_id' => $r['hewan']->id,
                    'jumlah_hewan' => $r['jumlah_hewan'],
                    'target_dana' => $r['target_dana'],
                    'frekuensi_setor' => $r['frekuensi'],
                    'nominal_per_periode' => $nominalPeriode,
                    'tanggal_daftar' => $r['tanggal_daftar'],
                    'status' => StatusPendaftaranQurban::Menabung,
                ]);
                if ($pendaftaran->external_id === null) {
                    $pendaftaran->update(['external_id' => $externalId]);
                }
            } else {
                $pendaftaran = PendaftaranQurban::create([
                    'external_id' => $externalId,
                    'user_id' => $user->id,
                    'periode_qurban_id' => $r['periode']->id,
                    'hewan_qurban_id' => $r['hewan']->id,
                    'jumlah_hewan' => $r['jumlah_hewan'],
                    'target_dana' => $r['target_dana'],
                    'total_terkumpul' => 0,
                    'status' => StatusPendaftaranQurban::Menabung,
                    'tanggal_daftar' => $r['tanggal_daftar'],
                    'frekuensi_setor' => $r['frekuensi'],
                    'nominal_per_periode' => $nominalPeriode,
                ]);
            }
            $saldo = $r['sudah_terkumpul'] ?? 0;
            if ($saldo > 0) {
                if ($this->terlarang($user->id, $jenis->id)) {
                    continue;
                }
                $this->aturSaldoAwalRencana($user, $jenis->id, 'pendaftaran_qurban_id', $pendaftaran->id, [
                    'total_sudah_disetor' => $saldo,
                ], $adminId);
                $this->qurbanTarget->updateTotalTerkumpul($pendaftaran->fresh());
            }
        }
    }

    private function persistBerjangka(array $rows, array $users, int $adminId): void
    {
        $jenis = $this->jenis(self::JENIS_BERJANGKA);
        if (! $jenis) {
            return;
        }
        foreach ($rows as $r) {
            $user = $users[$r['nasabah_id']];
            $externalId = "{$r['nasabah_id']}:{$r['rencana']}";
            $tb = TabunganBerjangka::byExternal($externalId)->first();
            if (! $tb) {
                $this->cekLimitAktif($user->id, self::JENIS_BERJANGKA, 5, $r['baris'], 'rencana berjangka');
                $mulai = \Carbon\Carbon::parse($r['tanggal_mulai']);
                $tb = TabunganBerjangka::create([
                    'external_id' => $externalId,
                    'user_id' => $user->id,
                    'jenis_tabungan_id' => $jenis->id,
                    'target_nominal' => $r['target_nominal'],
                    'durasi_bulan' => $r['durasi_bulan'],
                    'frekuensi_setor' => $r['frekuensi'],
                    'nominal_per_periode' => $r['nominal_per_periode'],
                    'tanggal_mulai' => $mulai->toDateString(),
                    'tanggal_jatuh_tempo' => $mulai->copy()->addMonths($r['durasi_bulan'])->toDateString(),
                    'status' => 'aktif',
                    'approved_by' => $adminId,
                    'approved_at' => now(),
                    'created_by' => $adminId,
                ]);
            }
            if (($r['sudah_terkumpul'] ?? 0) > 0) {
                $this->aturSaldoAwalRencana($user, $jenis->id, 'tabungan_berjangka_id', $tb->id, $r, $adminId);
            }
        }
    }

    private function persistGadai(array $rows, array $users, int $adminId): void
    {
        foreach ($rows as $r) {
            $gadai = Gadai::withoutTrashed()->where('nomor_gadai', $r['nomor_gadai'])->first();
            $fill = [
                'user_id' => $users[$r['nasabah_id']]->id,
                'jenis_emas' => $r['jenis_emas'],
                'berat_gram' => $r['berat_gram'],
                'kadar' => $r['kadar'],
                'berat_bersih_gram' => $r['berat_bersih_gram'],
                'harga_acuan' => $r['harga_acuan'],
                'nilai_taksiran' => $r['nilai_taksiran'],
                'persen_gadai' => $r['persen_gadai'],
                'besaran_gadai' => $r['besaran_gadai'],
                'tenor_satuan' => $r['tenor_satuan'],
                'frekuensi_bayar' => $r['frekuensi'],
                'nominal_angkuran' => $r['nominal_angsuran'],
                'bunga_persen' => $r['bunga_persen'],
                'tipe_bunga' => 'menurun',
                'total_dibayar' => $r['total_dibayar'],
                'tanggal_aju' => $r['tanggal_aju'],
                'tanggal_aktif' => $r['tanggal_aju'],
                'tanggal_jatuh_tempo' => $r['tanggal_jatuh_tempo'],
                'status' => $r['status'],
                'created_by' => $adminId,
            ];
            if ($gadai) {
                $gadai->update($fill);
            } else {
                Gadai::create(array_merge(['nomor_gadai' => $r['nomor_gadai']], $fill));
            }
        }
    }

    // ───────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────

    private function cariNasabah(TabunganImportValidator $p): ?User
    {
        $query = User::whereNull('nasabah_id');
        $phone = $p->nullableTeks('No. Handphone');
        $username = $p->nullableTeks('Username');
        if ($phone !== null) {
            $query->where('phone', $phone);
        }
        if ($username !== null) {
            $query->orWhere('username', $username);
        }
        $query->orWhereRaw('LOWER(name) = ?', [Str::lower($p->teks('Nama Lengkap'))]);

        return $query->withoutTrashed()->first();
    }

    private function aturSaldoAwalRencana(User $user, int $jenisId, string $fkColumn, int $fkValue, array $r, int $adminId): string
    {
        if ($this->terlarang($user->id, $jenisId)) {
            return 'denied';
        }
        $nominal = $r['total_sudah_disetor'] ?? $r['sudah_terkumpul'] ?? 0;
        if ($nominal <= 0) {
            return 'none';
        }
        $existing = $this->posisiRencana($user->id, $jenisId, $fkColumn, $fkValue);
        $ekstra = [$fkColumn => $fkValue];

        $jenis = $this->jenis(self::JENIS_EMAS);
        $harga = HargaEmasHarian::hargaTerkini();
        if ($jenis && $jenisId === $jenis->id && $harga) {
            $gram = $r['gram_terkumpul'] ?? null;
            $sudah = $r['total_sudah_disetor'] ?? $nominal;
            $gramasi = $gram ?? ((float) $sudah / max(0.0001, (float) $harga->harga_per_gram));
            $hargaJual = $harga->hargaJualPerGram((float) $gramasi);

            if ($gram !== null) {
                // Gram impor = sumber kebenaran; jangan dihitung ulang dari rupiah
                // (rupiah bisa tidak sinkron dengan harga hari ini). Seluruh rupiah
                // dianggap sudah jadi gram, tanpa saldo dana.
                if ($sudah == 0) {
                    $sudah = round((float) $gram * $hargaJual, 2);
                }
                $unit = (float) $gram;
                $emas = (float) $sudah;
                $selisih = 0.0;
            } else {
                $porsi = $this->saldoEmas->hitungSetoran((float) $sudah, null, 0.0, $hargaJual);
                $unit = (float) $porsi['unit_didapat'];
                $emas = (float) $porsi['nominal_emas'];
                $selisih = (float) $porsi['nominal_selisih'];
            }

            $ekstra += [
                'unit_didapat' => number_format(round($unit, 6), 6, '.', ''),
                'nominal_emas' => round($emas, 2),
                'nominal_selisih' => round($selisih, 2),
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $hargaJual,
            ];
            $nominal = (int) round($sudah);
        }

        if ($existing) {
            if ((float) $existing->nominal !== (float) $nominal) {
                $existing->update(array_merge(['nominal' => $nominal], $ekstra));

                return 'updated';
            }
            $existing->update($ekstra);

            return 'none';
        }

        Transaksi::create(array_merge([
            'nomor_referensi' => Transaksi::generateNomorReferensi(),
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenisId,
            'jenis_transaksi' => 'setor',
            'nominal' => $nominal,
            'metode_pembayaran' => 'cash',
            'status_verifikasi' => 'terverifikasi',
            'diverifikasi_oleh' => $adminId,
            'diverifikasi_pada' => now(),
            'catatan_admin' => 'Saldo awal import tabungan ('.SaldoAwalService::MARKER.').',
            'catatan_user' => 'Saldo awal tabungan dari data import.',
            'tanggal_transaksi' => now()->toDateString(),
        ], $ekstra));

        return 'created';
    }

    private function posisiRencana(int $userId, int $jenisId, string $fkColumn, int $fkValue): ?Transaksi
    {
        return Transaksi::where('user_id', $userId)
            ->where('jenis_tabungan_id', $jenisId)
            ->where('jenis_transaksi', 'setor')
            ->where('status_verifikasi', 'terverifikasi')
            ->where($fkColumn, $fkValue)
            ->where('catatan_admin', 'like', '%'.SaldoAwalService::MARKER.'%')
            ->latest('id')
            ->first();
    }

    private function terlarang(int $userId, int $jenisId): bool
    {
        return Transaksi::where('user_id', $userId)
            ->where('jenis_tabungan_id', $jenisId)
            ->where('catatan_admin', 'like', '%'.self::PENANDA_TERLARANG.'%')
            ->exists();
    }

    private function fuzzyEmas(User $user, array $r): ?KonfigurasiSetoranEmas
    {
        $aktif = KonfigurasiSetoranEmas::milikUser($user->id)->aktif()->get();
        if ($aktif->count() !== 1) {
            return null;
        }
        $k = $aktif->first();
        if ($k->external_id !== null) {
            return null;
        }
        if (($k->frekuensi_setor?->value ?? $k->frekuensi_setor) !== $r['frekuensi']) {
            return null;
        }
        if (abs((float) $k->nominal_per_periode - (float) ($r['nominal_per_periode'] ?? 0)) > 0.01 && ($r['nominal_per_periode'] ?? null) !== null) {
            return null;
        }
        $k->update(['external_id' => "{$r['nasabah_id']}:{$r['rencana']}"]);

        return $k;
    }

    private function cekLimitAktif(int $userId, string $kode, int $max, int $baris, string $label): void
    {
        $count = $kode === self::JENIS_EMAS
            ? KonfigurasiSetoranEmas::milikUser($userId)->aktif()->count()
            : TabunganBerjangka::milikUser($userId)->whereIn('status', ['aktif', 'menunggu_approval'])->count();
        if ($count >= $max) {
            throw new \RuntimeException("Baris {$baris}: nasabah sudah mencapai batas {$max} {$label} aktif.");
        }
    }

    private function jenis(string $kode): ?JenisTabungan
    {
        return JenisTabungan::where('kode', $kode)->first();
    }

    private function hasil(array $errors, array $warnings, array $counters, array $plan): array
    {
        return [
            'errors' => $errors,
            'warnings' => $warnings,
            'summary' => $counters,
            'plan' => $plan,
        ];
    }

    private function err(string $sheet, int $baris, string $kolom, string $nilai, string $pesan): array
    {
        return ['sheet' => $sheet, 'baris' => $baris, 'kolom' => $kolom, 'nilai' => $nilai, 'pesan' => $pesan];
    }

    private function generateUniqueUsername(string $name): string
    {
        $base = strtolower(preg_replace('/[^a-z0-9]/', '', Str::ascii(explode(' ', trim($name))[0] ?? '')) ?: 'user');
        if (strlen($base) < 3) {
            $base = 'user';
        }
        do {
            $candidate = $base.rand(1000, 9999);
        } while (User::where('username', $candidate)->exists());

        return $candidate;
    }

    private function generatePlaceholderPhone(): string
    {
        do {
            $candidate = '000'.rand(1000000, 9999999);
        } while (User::where('phone', $candidate)->exists());

        return $candidate;
    }
}