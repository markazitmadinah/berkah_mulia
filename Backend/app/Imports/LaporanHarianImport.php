<?php

namespace App\Imports;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeTabungan;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Illuminate\Support\Collection;

/**
 * Import dari format Laporan Harian (misalnya: LAPORAN HARIAN SEPTEMBER 2026.xlsx).
 *
 * Format kolom yang dikenali (case-insensitive, nama kolom dari heading row):
 *   - Nama Nasabah        → nama user
 *   - Tanggal Pembayaran  → tanggal transaksi
 *   - Tabungan Emas       → nominal setor emas
 *   - BAYAR GADAI         → angsuran gadai (dicatat sebagai catatan)
 *   - Tabungan Mandiri    → nominal setor mandiri
 *   - Tabungan Hari raya  → nominal setor hari raya
 *   - Tabungan Kurban     → nominal setor qurban
 *
 * User baru di-autocreate jika nama belum ada di DB.
 * Semua transaksi langsung terverifikasi (data historis).
 */
class LaporanHarianImport implements ToCollection, WithHeadingRow, SkipsEmptyRows, WithCalculatedFormulas
{
    use Importable;

    public const MARKER = 'IMPORT_LAPORAN_HARIAN';

    private int $userDibuat = 0;
    private int $transaksiDibuat = 0;
    private int $rowDilewati = 0;
    private array $skippedDetail = [];
    private array $namaCache = []; // nama → user_id

    public function isEmptyWhen(array $row): bool
    {
        return empty(trim((string) ($row['nama_nasabah'] ?? $row['nama nasabah'] ?? '')));
    }

    public function collection(Collection $rows): void
    {
        // Ambil jenis tabungan yang relevan
        $jenisMap = $this->buildJenisMap();

        foreach ($rows as $idx => $row) {
            $rowArr = $row->toArray();
            $nama = trim((string) ($rowArr['nama_nasabah'] ?? $rowArr['nama nasabah'] ?? ''));
            if ($nama === '') {
                continue;
            }

            // Cari/buat user berdasarkan nama (case-insensitive)
            $user = $this->findOrCreateUser($nama);

            // Parse tanggal pembayaran
            $tanggal = $this->parseTanggal($rowArr['tanggal_pembayaran'] ?? $rowArr['tanggal pembayaran'] ?? null);

            // Catat transaksi per jenis tabungan
            $this->catatTransaksi($user, $tanggal, $rowArr, $jenisMap);
        }
    }

    /**
     * Map nama jenis tabungan yang ada di DB.
     * Kunci: keyword dari kolom laporan, Value: JenisTabungan model
     */
    private function buildJenisMap(): array
    {
        $all = JenisTabungan::aktif()->get(['id', 'nama', 'tipe', 'sub_jenis']);
        $map = [];
        foreach ($all as $j) {
            $lower = strtolower($j->nama);
            $map[$lower] = $j;
        }
        return $map;
    }

    private function findOrCreateUser(string $nama): User
    {
        $namaLower = strtolower($nama);

        if (isset($this->namaCache[$namaLower])) {
            return $this->namaCache[$namaLower];
        }

        // Cari user dengan nama yang sama (case-insensitive)
        $user = User::where(function ($q) use ($nama) {
            $q->whereRaw('LOWER(name) = ?', [strtolower($nama)]);
        })->first();

        if (! $user) {
            // Auto-create user baru
            $nomorAnggota = $this->generateNomorAnggota();
            $username = $this->generateUsername($nama);
            $emailDummy = 'user.' . $username . '@berkahmulia.local';

            $user = new User([
                'name'          => $nama,
                'username'      => $username,
                'email'         => $emailDummy,
                'phone'         => null,   // diisi saat onboarding
                'address'       => null,   // diisi saat onboarding
                'nomor_anggota' => $nomorAnggota,
                'password'      => Hash::make(Str::random(16)), // password random → harus reset
            ]);
            $user->role = UserRole::User;
            $user->status = UserStatus::Active;
            $user->approved_by = auth()->id();
            $user->approved_at = now();
            $user->save();

            $this->userDibuat++;
        }

        $this->namaCache[$namaLower] = $user;
        return $user;
    }

    private function generateNomorAnggota(): string
    {
        do {
            $candidate = (string) rand(1000000000, 9999999999);
        } while (User::where('nomor_anggota', $candidate)->exists());
        return $candidate;
    }

    private function generateUsername(string $nama): string
    {
        $base = preg_replace('/[^a-z0-9]/', '', strtolower(Str::slug(explode(' ', trim($nama))[0], '')));
        if (strlen($base) < 3) {
            $base = 'user';
        }
        do {
            $candidate = $base . rand(1000, 9999);
        } while (User::where('username', $candidate)->exists());
        return $candidate;
    }

    private function parseTanggal($value): string
    {
        if ($value instanceof \DateTime) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value)) {
            // Excel serial date
            try {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value)->format('Y-m-d');
            } catch (\Throwable $e) {
                return now()->toDateString();
            }
        }
        if ($value) {
            try {
                return \Carbon\Carbon::parse((string) $value)->toDateString();
            } catch (\Throwable $e) {
                return now()->toDateString();
            }
        }
        return now()->toDateString();
    }

    private function bersihNominal($value): ?int
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '' || strtolower($value) === 'null') {
            return null;
        }
        $digits = preg_replace('/[^\d]/', '', $value);
        return $digits === '' ? null : (int) $digits;
    }

    /**
     * Map kolom laporan ke jenis tabungan di DB.
     * Cari JenisTabungan yang sub_jenis/nama cocok dengan keyword.
     */
    private function resolveJenis(array $jenisMap, string ...$keywords): ?object
    {
        foreach ($keywords as $kw) {
            $kwLower = strtolower($kw);
            foreach ($jenisMap as $namaJenis => $jenis) {
                if (str_contains($namaJenis, $kwLower) || str_contains($kwLower, $namaJenis)) {
                    return $jenis;
                }
            }
        }
        return null;
    }

    private function catatTransaksi(User $user, string $tanggal, array $row, array $jenisMap): void
    {
        // Kolom yang dipetakan ke jenis tabungan
        $mappings = [
            ['keys' => ['tabungan_emas', 'tabungan emas'], 'keywords' => ['emas']],
            ['keys' => ['tabungan_mandiri', 'tabungan mandiri'], 'keywords' => ['mandiri']],
            ['keys' => ['tabungan_hari_raya', 'tabungan hari raya'], 'keywords' => ['hari raya', 'hariraya']],
            ['keys' => ['tabungan_kurban', 'tabungan kurban'], 'keywords' => ['kurban', 'qurban']],
        ];

        foreach ($mappings as $m) {
            $nominal = null;
            foreach ($m['keys'] as $key) {
                $nominal = $this->bersihNominal($row[$key] ?? $row[str_replace('_', ' ', $key)] ?? null);
                if ($nominal !== null) break;
            }

            if ($nominal === null || $nominal <= 0) {
                continue;
            }

            $jenis = $this->resolveJenis($jenisMap, ...$m['keywords']);
            if (! $jenis) {
                continue; // Jenis tabungan tidak ditemukan di DB, skip
            }

            // Hindari duplikat: cek apakah transaksi dengan marker sudah ada untuk tanggal & user & jenis ini
            $sudahAda = Transaksi::where('user_id', $user->id)
                ->where('jenis_tabungan_id', $jenis->id)
                ->where('catatan_admin', 'like', '%' . self::MARKER . '%')
                ->whereDate('tanggal_transaksi', $tanggal)
                ->where('nominal', $nominal)
                ->exists();

            if ($sudahAda) {
                continue;
            }

            Transaksi::create([
                'nomor_referensi'   => Transaksi::generateNomorReferensi(),
                'user_id'           => $user->id,
                'jenis_tabungan_id' => $jenis->id,
                'jenis_transaksi'   => JenisTransaksi::Setor->value,
                'nominal'           => $nominal,
                'metode_pembayaran' => MetodePembayaran::Cash->value,
                'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                'diverifikasi_oleh' => auth()->id(),
                'diverifikasi_pada' => now(),
                'catatan_admin'     => 'Data historis dari laporan harian (' . self::MARKER . ').',
                'catatan_user'      => 'Setoran tercatat dari laporan harian.',
                'tanggal_transaksi' => $tanggal,
            ]);

            $this->transaksiDibuat++;
        }
    }

    public function getUserDibuat(): int    { return $this->userDibuat; }
    public function getTransaksiDibuat(): int { return $this->transaksiDibuat; }
    public function getRowDilewati(): int   { return $this->rowDilewati; }
    public function getSkippedDetail(): array { return array_slice($this->skippedDetail, 0, 20); }
}
