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
use App\Models\UserTabunganTarget;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class UsersImport implements ToModel, WithHeadingRow, SkipsEmptyRows, WithCalculatedFormulas
{
    use Importable;

    /**
     * Penanda pada catatan_admin transaksi setor saldo awal dari import.
     * Dipakai untuk anti-duplikat dan "set ulang dana" saat file di-import ulang.
     */
    public const MARKER_SALDO_AWAL = 'SALDO_AWAL_IMPORT';

    /**
     * Identitas baris contoh pada template unduhan. Baris ini otomatis
     * dilewati saat import agar template yang tidak diedit tidak menjadi data nyata.
     */
    public const CONTOH_EMAIL = 'nasabah.contoh@gmail.com';
    public const CONTOH_ANGGOTA = '1234567890123456';

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
        $fields = ['nama_lengkap', 'email', 'no_handphone', 'nomor_anggota_16_digit'];
        foreach ($fields as $field) {
            if (trim((string) ($row[$field] ?? '')) !== '') {
                return false;
            }
        }
        return true;
    }

    private function normalizeAnggota($value): string
    {
        $value = trim((string) $value);
        if (is_numeric($value)) {
            $value = number_format((float) $value, 0, '', '');
        }
        return preg_replace('/\D+/', '', $value);
    }

    public function model(array $row)
    {
        $this->rowCounter++;
        $baris = $this->rowCounter + 1; // baris 1 = heading

        $email = Str::lower(trim((string) ($row['email'] ?? '')));
        $phone = preg_replace('/\D+/', '', (string) ($row['no_handphone'] ?? ''));
        $anggota = $this->normalizeAnggota($row['nomor_anggota_16_digit'] ?? '');

        // Baris contoh dari template: jangan pernah menjadi data nyata.
        if ($email === self::CONTOH_EMAIL && $anggota === self::CONTOH_ANGGOTA) {
            return null;
        }

        // Validasi manual per baris agar nomor baris akurat dan satu baris
        // buruk tidak menghentikan seluruh file.
        $errors = [];
        if (trim((string) ($row['nama_lengkap'] ?? '')) === '') {
            $errors[] = 'Nama Lengkap wajib diisi';
        }
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Format email tidak valid';
        }
        if ($phone === '') {
            $errors[] = 'No. Handphone wajib diisi';
        }
        if (! preg_match('/^\d{16}$/', $anggota)) {
            $errors[] = 'Nomor Anggota harus 16 digit angka';
        }
        if (! empty($row['password']) && strlen((string) $row['password']) < 8) {
            $errors[] = 'Password minimal 8 karakter';
        }
        if ($errors) {
            $this->skipped[] = 'Baris ' . $baris . ': ' . implode(' · ', $errors);
            return null;
        }

        $existing = User::withTrashed()->where(function ($q) use ($email, $anggota) {
            $q->where('email', $email)
              ->orWhere('nomor_anggota', $anggota);
        })->first();

        try {
            if ($existing) {
                $update = [
                    'name'  => trim((string) $row['nama_lengkap']),
                    'phone' => $phone,
                    'role'  => $this->parseRole($row['peran'] ?? 'Nasabah'),
                ];

                if (! empty($row['alamat'])) {
                    $update['address'] = trim((string) $row['alamat']);
                }
                if (! empty($row['password'])) {
                    $update['password'] = Hash::make((string) $row['password']);
                }
                $statusVal = trim((string) ($row['status'] ?? ''));
                if ($statusVal !== '') {
                    $update['status'] = $this->parseStatus($statusVal);
                }

                $existing->update($update);
                if ($existing->trashed()) {
                    $existing->restore();
                }
                $this->updated[] = $existing->id;

                // Tabungan ikut diproses untuk user yang diperbarui (set ulang dana).
                $this->pending[] = [
                    'email'   => $email,
                    'anggota' => $anggota,
                    'row'     => $row,
                ];

                return null;
            }

            $user = User::create([
                'name'             => trim((string) $row['nama_lengkap']),
                'email'            => $email,
                'phone'            => $phone,
                'nomor_anggota'    => $anggota,
                'address'          => !empty($row['alamat']) ? trim((string) $row['alamat']) : null,
                'password'         => Hash::make((string) ($row['password'] ?? Str::random(12))),
                'role'             => $this->parseRole($row['peran'] ?? 'Nasabah'),
                'status'           => $this->parseStatus($row['status'] ?? 'Aktif'),
                'approved_by'      => auth()->id(),
                'approved_at'      => now(),
            ]);
            $this->created[] = $email;

            // Diproses setelah seluruh baris selesai diinsert agar user.id tersedia.
            $this->pending[] = [
                'email'   => $email,
                'anggota' => $anggota,
                'row'     => $row,
            ];

            return $user;
        } catch (UniqueConstraintViolationException $e) {
            $this->skipped[] = 'Baris ' . $baris
                . ': Email, No. Handphone, atau Nomor Anggota sudah terdaftar pada user lain';
            return null;
        }
    }

    // ─── Tabungan dari import ────────────────────────────────────────

    /**
     * Jenis tabungan pribadi (Mandiri / Hari Raya / Berjangka) yang aktif.
     * Kolom template & parser memakai nama yang sama sehingga slug heading konsisten.
     */
    private function jenisTabunganPribadi(): array
    {
        static $jenis = null;

        if ($jenis === null) {
            $jenis = JenisTabungan::aktif()
                ->where('tipe', TipeTabungan::Pribadi)
                ->orderBy('nama')
                ->get(['id', 'nama'])
                ->all();
        }

        return $jenis;
    }

    private function keyTarget(string $nama): string
    {
        return Str::slug("{$nama} - Target", '_');
    }

    private function keySaldoAwal(string $nama): string
    {
        return Str::slug("{$nama} - Saldo Awal", '_');
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
     * Terapkan target & saldo awal tabungan untuk setiap baris (user baru/update).
     * Dipanggil oleh controller SETELAH Excel::import selesai.
     */
    public function prosesTabungan(): void
    {
        $jenisList = $this->jenisTabunganPribadi();

        foreach ($this->pending as $item) {
            $user = User::withTrashed()
                ->where(function ($q) use ($item) {
                    $q->where('email', $item['email'])
                      ->orWhere('nomor_anggota', $item['anggota']);
                })
                ->first();

            // Tabungan pribadi hanya dicatat untuk nasabah.
            if (! $user || $user->role !== UserRole::User) {
                continue;
            }

            $row = $item['row'];

            foreach ($jenisList as $jenis) {
                $target = $this->bersihNominal($row[$this->keyTarget($jenis->nama)] ?? null);
                if ($target !== null) {
                    UserTabunganTarget::updateOrCreate(
                        ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
                        ['target_nominal' => $target]
                    );
                    $this->targetDiatur++;
                }

                $saldo = $this->bersihNominal($row[$this->keySaldoAwal($jenis->nama)] ?? null);
                if ($saldo !== null) {
                    $this->aturSaldoAwal($user, $jenis->id, $saldo);
                }
            }
        }
    }

    private function posisiSaldoAwal(int $userId, int $jenisId): ?Transaksi
    {
        return Transaksi::milikUser($userId)
            ->where('jenis_tabungan_id', $jenisId)
            ->where('jenis_transaksi', JenisTransaksi::Setor->value)
            ->where('status_verifikasi', StatusVerifikasi::Terverifikasi->value)
            ->where('catatan_admin', 'like', '%' . self::MARKER_SALDO_AWAL . '%')
            ->latest('id')
            ->first();
    }

    /**
     * "Set ulang dana" saldo awal tabungan nasabah:
     * - belum ada catatan → buat transaksi setor terverifikasi (langsung masuk saldo).
     * - nilainya berubah → perbarui nominal (import ulang).
     * - diisi 0 → hapus catatan saldo awal.
     */
    private function aturSaldoAwal(User $user, int $jenisId, int $saldo): void
    {
        $existing = $this->posisiSaldoAwal($user->id, $jenisId);

        if ($existing) {
            if ($saldo === 0) {
                $existing->delete();
                $this->saldoDihapus++;
            } elseif ((float) $existing->nominal !== (float) $saldo) {
                $existing->update(['nominal' => $saldo]);
                $this->saldoDiubah++;
            }

            return;
        }

        if ($saldo === 0) {
            return;
        }

        Transaksi::create([
            'nomor_referensi'    => Transaksi::generateNomorReferensi(),
            'user_id'            => $user->id,
            'jenis_tabungan_id'  => $jenisId,
            'jenis_transaksi'    => JenisTransaksi::Setor->value,
            'nominal'            => $saldo,
            'metode_pembayaran'  => MetodePembayaran::Cash->value,
            'status_verifikasi'  => StatusVerifikasi::Terverifikasi->value,
            'diverifikasi_oleh'  => auth()->id(),
            'diverifikasi_pada'  => now(),
            'catatan_admin'      => 'Saldo awal dari import (' . self::MARKER_SALDO_AWAL . ').',
            'catatan_user'       => 'Saldo awal tabungan dari data nasabah.',
            'tanggal_transaksi'  => now()->toDateString(),
        ]);

        $this->saldoDicatat++;
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
            default => UserStatus::Active->value,
        };
    }
}