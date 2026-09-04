<?php

namespace App\Imports;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Validators\Failure;

class UsersImport implements ToModel, WithHeadingRow, WithValidation, SkipsEmptyRows, WithCalculatedFormulas, SkipsOnFailure
{
    use Importable;

    private array $created = [];
    private array $updated = [];
    private array $skipped = [];

    public function isEmptyWhen(array $row): bool
    {
        return $this->isEmptyRow($row);
    }

    public function prepareForValidation(array $row): array
    {
        $row['nama_lengkap'] = trim((string) ($row['nama_lengkap'] ?? ''));
        $row['email'] = Str::lower(trim((string) ($row['email'] ?? '')));
        $row['no_handphone'] = preg_replace('/\D+/', '', (string) ($row['no_handphone'] ?? ''));
        $row['nomor_anggota_16_digit'] = $this->normalizeAnggota($row['nomor_anggota_16_digit'] ?? '');
        return $row;
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

    public function onFailure(Failure ...$failures): void
    {
        foreach ($failures as $failure) {
            foreach ($failure->errors() as $error) {
                $this->skipped[] = "Baris " . ($failure->row() . 1) . ": " . $error;
            }
        }
    }

    public function model(array $row)
    {
        $email = Str::lower(trim($row['email'] ?? ''));
        $phone = preg_replace('/\D+/', '', (string) ($row['no_handphone'] ?? ''));
        $anggota = $row['nomor_anggota_16_digit'] ?? '';

        $existing = User::withTrashed()->where(function ($q) use ($email, $anggota) {
            $q->where('email', $email)
              ->orWhere('nomor_anggota', $anggota);
        })->first();

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

            return null;
        }

        $this->created[] = $email;

        return User::create([
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
    }

    public function rules(): array
    {
        return [
            'nama_lengkap'          => ['required', 'string'],
            'email'                 => ['required', 'email'],
            'no_handphone'          => ['required'],
            'nomor_anggota_16_digit'=> ['required', 'regex:/^\d{16}$/'],
            'password'              => ['nullable', 'string', 'min:8'],
        ];
    }

    public function customValidationMessages(): array
    {
        return [
            'nama_lengkap.required'           => 'Nama Lengkap wajib diisi.',
            'email.required'                  => 'Email wajib diisi.',
            'email.email'                     => 'Format email tidak valid.',
            'no_handphone.required'           => 'No. Handphone wajib diisi.',
            'nomor_anggota_16_digit.required' => 'Nomor Anggota wajib diisi.',
            'nomor_anggota_16_digit.regex'    => 'Nomor Anggota harus 16 digit angka.',
            'password.min'                    => 'Password minimal 8 karakter.',
        ];
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
            'menunggu persetujuan', 'pending' => UserStatus::Pending->value,
            'ditolak', 'rejected' => UserStatus::Rejected->value,
            'dibekukan', 'suspended' => UserStatus::Suspended->value,
            default => UserStatus::Active->value,
        };
    }
}
