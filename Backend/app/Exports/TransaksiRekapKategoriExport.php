<?php

namespace App\Exports;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Models\Transaksi;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class TransaksiRekapKategoriExport implements FromArray, WithColumnFormatting, WithColumnWidths, WithEvents, WithHeadings, WithStyles, WithTitle
{
    private array $rows;

    public function __construct(array $filters = [])
    {
        $this->rows = $this->buildRekap($filters);
    }

    public function title(): string
    {
        return 'Rekap Kategori';
    }

    public function headings(): array
    {
        return ['Kategori', 'Uang Masuk (Rp)', 'Uang Keluar (Rp)', 'Selisih (Rp)', 'Jumlah Transaksi'];
    }

    private function buildRekap(array $filters): array
    {
        $transaksi = Transaksi::with('jenisTabungan')
            ->filterAdmin($filters)
            ->where('status_verifikasi', StatusVerifikasi::Terverifikasi)
            ->get(['jenis_tabungan_id', 'jenis_transaksi', 'nominal']);

        $perKategori = $transaksi->groupBy(fn ($t) => $t->jenisTabungan?->nama ?? 'Lainnya');

        $rows = $perKategori
            ->map(function (Collection $group, string $kategori) {
                $masuk = (float) $group->where('jenis_transaksi', JenisTransaksi::Setor)->sum('nominal');
                $keluar = (float) $group->where('jenis_transaksi', JenisTransaksi::Tarik)->sum('nominal');

                return [$kategori, $masuk, $keluar, $masuk - $keluar, $group->count()];
            })
            ->sortByDesc(fn (array $row) => $row[1] + $row[2])
            ->values()
            ->all();

        $rekap = collect($rows);
        $rows[] = [
            'TOTAL SEMUA KATEGORI',
            $rekap->sum(1),
            $rekap->sum(2),
            $rekap->sum(3),
            $rekap->sum(4),
        ];

        return $rows;
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function columnFormats(): array
    {
        return [
            'B' => '#,##0',
            'C' => '#,##0',
            'D' => '#,##0',
            'E' => '#,##0',
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 28,
            'B' => 18,
            'C' => 18,
            'D' => 18,
            'E' => 18,
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

                $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setWrapText(true);
                $sheet->freezePane('A2');

                $sheet->getStyle("A1:{$lastCol}{$highest}")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setARGB('FFCBD5E1');

                $sheet->getStyle("A2:{$lastCol}{$highest}")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                for ($row = 2; $row <= $highest; $row++) {
                    if ($row % 2 === 0) {
                        $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                            ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFF1F5F9'));
                    }
                }

                $totalRow = $sheet->getStyle("A{$highest}:{$lastCol}{$highest}");
                $totalRow->getFont()->setBold(true);
                $totalRow->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFECFDF5'));

                $sheet->getRowDimension(1)->setRowHeight(28);
            },
        ];
    }
}