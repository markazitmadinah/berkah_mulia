<?php

namespace App\Exports;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStrictNullComparison;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class UsersExport implements FromQuery, ShouldAutoSize, WithColumnFormatting, WithEvents, WithHeadings, WithMapping, WithStrictNullComparison, WithStyles, WithTitle
{
    private array $filters;

    public function __construct(?string $status = null, ?string $role = null, ?string $search = null)
    {
        $this->filters = compact('status', 'role', 'search');
    }

    public function title(): string
    {
        return 'Data Nasabah';
    }

    public function query()
    {
        $query = User::with([
            'transaksi',
            'pendaftaranQurban',
            'tabunganBerjangka',
        ])->latest();

        if ($this->filters['status']) {
            $query->where('status', $this->filters['status']);
        }
        if ($this->filters['role']) {
            $query->where('role', $this->filters['role']);
        }
        if ($this->filters['search']) {
            $search = $this->filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nomor_anggota', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'No',
            'No Anggota',
            'Username',
            'Nama Lengkap',
            'Email',
            'No. Handphone',
            'Alamat',
            'Total Saldo Simpanan (Rp)',
            'Total Tabungan Emas (g)',
            'Program Aktif',
            'Peran',
            'Status Akun',
            'Kelengkapan Profil',
            'Terdaftar',
        ];
    }

    public function map($user): array
    {
        static $no = 0;
        $no++;

        // Hitung akumulasi saldo setor - tarik terverifikasi (cash)
        $saldoSimpanan = (float) $user->transaksi
            ->filter(fn ($t) => ($t->status_verifikasi?->value ?? (string) $t->status_verifikasi) === 'terverifikasi' && empty($t->nominal_emas))
            ->reduce(function ($carry, $t) {
                $isSetor = ($t->jenis_transaksi?->value ?? (string) $t->jenis_transaksi) === 'setor';
                $nominal = (float) ($t->nominal ?? 0);

                return $carry + ($isSetor ? $nominal : -$nominal);
            }, 0);

        // Hitung total gram emas dari transaksi terverifikasi
        $saldoGram = (float) $user->transaksi
            ->filter(fn ($t) => ($t->status_verifikasi?->value ?? (string) $t->status_verifikasi) === 'terverifikasi' && ! empty($t->unit_didapat))
            ->reduce(function ($carry, $t) {
                $isSetor = ($t->jenis_transaksi?->value ?? (string) $t->jenis_transaksi) === 'setor';
                $gram = (float) ($t->unit_didapat ?? 0);

                return $carry + ($isSetor ? $gram : -$gram);
            }, 0);

        // Program tabungan yang aktif
        $programList = [];
        $qurbanCount = $user->pendaftaranQurban->whereNotIn('status', ['batal', 'sudah_lunas', 'sudah_dicairkan'])->count();
        if ($qurbanCount > 0) {
            $programList[] = "Qurban ({$qurbanCount})";
        }
        $berjangkaCount = $user->tabunganBerjangka->whereIn('status', ['aktif', 'menunggu_approval'])->count();
        if ($berjangkaCount > 0) {
            $programList[] = "Berjangka ({$berjangkaCount})";
        }
        $programStr = ! empty($programList) ? implode(', ', $programList) : 'Simpanan Reguler';

        $isLengkap = ! empty($user->phone) && ! empty($user->address);

        return [
            $no,
            $this->safeCell($user->nomor_anggota ?? '-'),
            $this->safeCell($user->username ?? '-'),
            $this->safeCell($user->name),
            $this->safeCell($user->email),
            $this->safeCell($user->phone ?? '-'),
            $this->safeCell($user->address ?: '-'),
            max(0, $saldoSimpanan),
            max(0, $saldoGram),
            $this->safeCell($programStr),
            $this->safeCell($user->role instanceof UserRole ? $user->role->label() : (string) $user->role),
            $this->safeCell($user->status instanceof UserStatus ? $user->status->label() : (string) $user->status),
            $isLengkap ? 'Lengkap' : 'Belum Lengkap',
            $user->created_at?->format('d/m/Y'),
        ];
    }

    /**
     * Cegah formula injection: teks yang diawali =,+,-,@ dikencingi tanda kutip
     * supaya Excel memperlakukannya sebagai teks, bukan formula.
     */
    private function safeCell(?string $value): string
    {
        if ($value === null || $value === '') {
            return '-';
        }

        return in_array($value[0] ?? '', ['=', '+', '-', '@'], true) ? "'".$value : $value;
    }

    public function columnFormats(): array
    {
        return [
            'H' => '#,##0',
            'I' => '0.0000',
            'N' => NumberFormat::FORMAT_DATE_DDMMYYYY,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF047857']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $highest = $sheet->getHighestRow();
                $lastCol = $sheet->getHighestColumn();

                // Wrap header + freeze
                $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setWrapText(true);
                $sheet->freezePane('A2');

                // Borders for all used cells
                $sheet->getStyle("A1:{$lastCol}{$highest}")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setARGB('FFCBD5E1');

                // Vertical alignment + zebra striping
                $sheet->getStyle("A2:{$lastCol}{$highest}")->getAlignment()
                    ->setVertical(Alignment::VERTICAL_CENTER);
                for ($row = 2; $row <= $highest; $row++) {
                    if ($row % 2 === 0) {
                        $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                            ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFF1F5F9'));
                    }
                }

                // Header row height
                $sheet->getRowDimension(1)->setRowHeight(28);
            },
        ];
    }
}
