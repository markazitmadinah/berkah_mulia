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
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class UsersExport implements
    FromQuery,
    WithHeadings,
    WithMapping,
    WithColumnFormatting,
    ShouldAutoSize,
    WithStyles,
    WithEvents,
    WithTitle,
    WithStrictNullComparison
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
        $query = User::query()->latest();

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
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nomor_anggota', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'No',
            'Nama Lengkap',
            'No Anggota',
            'Email',
            'No. Handphone',
            'Alamat',
            'Peran',
            'Status',
            'Terdaftar',
        ];
    }

    public function map($user): array
    {
        static $no = 0;
        $no++;

        return [
            $no,
            $this->safeCell($user->name),
            $this->safeCell($user->nomor_anggota ?? '-'),
            $this->safeCell($user->email),
            $this->safeCell($user->phone),
            $this->safeCell($user->address ?: '-'),
            $this->safeCell($user->role instanceof UserRole ? $user->role->label() : (string) $user->role),
            $this->safeCell($user->status instanceof UserStatus ? $user->status->label() : (string) $user->status),
            $user->created_at?->format('d/m/Y'),
        ];
    }

    /**
     * Cegah formula injection: teks yang diawali =,+,-,@ dikencingi tanda kutip
     * supaya Excel memperlakukannya sebagai teks, bukan formula.
     */
    private function safeCell(string $value): string
    {
        return in_array($value[0] ?? '', ['=', '+', '-', '@'], true) ? "'" . $value : $value;
    }

    public function columnFormats(): array
    {
        return [
            'I' => NumberFormat::FORMAT_DATE_DDMMYYYY,
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
                            ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFF1F5F9'));
                    }
                }

                // Header row height
                $sheet->getRowDimension(1)->setRowHeight(28);
            },
        ];
    }
}
