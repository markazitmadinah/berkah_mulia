<?php

namespace App\Exports;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Models\Transaksi;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
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

class TransaksiExport implements FromQuery, WithColumnFormatting, WithColumnWidths, WithEvents, WithHeadings, WithMapping, WithStrictNullComparison, WithStyles, WithTitle
{
    private const SUMMARY_HEADER_ROWS = 3;

    private array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function title(): string
    {
        return 'Data Transaksi';
    }

    public function query()
    {
        return Transaksi::with(['user', 'jenisTabungan'])
            ->filterAdmin($this->filters)
            ->latest();
    }

    public function headings(): array
    {
        return [
            'No',
            'No Referensi',
            'Nasabah',
            'Produk',
            'Jenis Mutasi',
            'Nominal (Rp)',
            'Unit (g)',
            'Metode',
            'Tanggal',
        ];
    }

    public function map($row): array
    {
        static $no = 0;
        $no++;

        return [
            $no,
            $this->safeCell($row->nomor_referensi),
            $this->safeCell($row->user->name ?? $row->user_name ?? '-'),
            $this->safeCell($row->jenisTabungan->nama ?? '-'),
            $this->safeCell($row->jenis_transaksi instanceof JenisTransaksi ? $row->jenis_transaksi->label() : (string) $row->jenis_transaksi),
            (float) ($row->nominal ?? 0),
            (float) ($row->unit_didapat ?? 0),
            $this->safeCell($row->metode_pembayaran instanceof MetodePembayaran ? $row->metode_pembayaran->label() : (string) $row->metode_pembayaran),
            $row->tanggal_transaksi?->format('d/m/Y'),
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

    public function columnWidths(): array
    {
        return [
            'A' => 5,
            'B' => 22,
            'C' => 24,
            'D' => 22,
            'E' => 15,
            'F' => 16,
            'G' => 12,
            'H' => 14,
            'I' => 13,
        ];
    }

    public function columnFormats(): array
    {
        return [
            'F' => '#,##0',
            'G' => '0.0000',
            'I' => NumberFormat::FORMAT_DATE_DDMMYYYY,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF047857']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $lastCol = $sheet->getHighestColumn();

                $lastData = $sheet->getHighestRow() + self::SUMMARY_HEADER_ROWS;

                $sheet->insertNewRowBefore(1, self::SUMMARY_HEADER_ROWS);

                $headerRow = 1 + self::SUMMARY_HEADER_ROWS;
                $firstData = $headerRow + 1;

                $this->writeTitleBlock($sheet, $lastCol);
                $this->styleHeader($sheet, $lastCol, $headerRow);
                $this->styleDataTable($sheet, $lastCol, $firstData, $lastData);

                $sheet->freezePane('A'.$firstData);

                $this->appendSummary($sheet, $lastData, $lastCol);
            },
        ];
    }

    private function writeTitleBlock(Worksheet $sheet, string $lastCol): void
    {
        $sheet->setCellValue('A1', 'PEMBUKUAN TRANSAKSI — KOPERASI BERKAH MULIA');
        $sheet->mergeCells("A1:{$lastCol}1");
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new Color('FF047857'));
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension(1)->setRowHeight(24);

        $sheet->setCellValue('A2', $this->periodLabel());
        $sheet->mergeCells("A2:{$lastCol}2");
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A2')->getFont()->setItalic(true)->setColor(new Color('FF475569'));
        $sheet->getRowDimension(2)->setRowHeight(18);
    }

    private function periodLabel(): string
    {
        $periode = $this->filters['periode'] ?? null;
        $aliran = $this->filters['aliran'] ?? 'semua';

        $periodeLabel = match ($periode) {
            'hari-ini' => 'Hari Ini',
            '7-hari' => '7 Hari Terakhir',
            '30-hari' => '30 Hari Terakhir',
            'bulan-ini' => 'Bulan Ini',
            'semua' => 'Semua Periode',
            default => 'Periode Kustom',
        };

        $rentang = null;
        if (! empty($this->filters['tanggal_awal']) && ! empty($this->filters['tanggal_akhir'])) {
            $fmt = fn (string $tanggal) => \Illuminate\Support\Carbon::parse($tanggal)->translatedFormat('d M Y');
            $rentang = $fmt($this->filters['tanggal_awal']).' s/d '.$fmt($this->filters['tanggal_akhir']);
        } elseif (! empty($this->filters['tanggal_awal'])) {
            $rentang = 'dari '.$this->filters['tanggal_awal'];
        } elseif (! empty($this->filters['tanggal_akhir'])) {
            $rentang = 'hingga '.$this->filters['tanggal_akhir'];
        }

        $aliranLabel = match ($aliran) {
            'masuk' => 'Uang Masuk',
            'keluar' => 'Uang Keluar',
            default => 'Semua',
        };

        return 'Periode: '.$periodeLabel.($rentang ? ' ('.$rentang.')' : '')
            .'   •   Aliran: '.$aliranLabel
            .'   •   Diexport '.now()->translatedFormat('d M Y H:i');
    }

    private function styleHeader(Worksheet $sheet, string $lastCol, int $headerRow): void
    {
        $sheet->getStyle("A{$headerRow}:{$lastCol}{$headerRow}")
            ->applyFromArray([
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF047857']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
        $sheet->getStyle("A{$headerRow}:{$lastCol}{$headerRow}")->getAlignment()->setWrapText(true);
        $sheet->getRowDimension($headerRow)->setRowHeight(28);
    }

    private function styleDataTable(Worksheet $sheet, string $lastCol, int $firstData, int $lastData): void
    {
        $sheet->getStyle("A{$firstData}:{$lastCol}{$lastData}")->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)
            ->getColor()->setARGB('FFCBD5E1');

        $sheet->getStyle("A{$firstData}:{$lastCol}{$lastData}")
            ->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle("A{$firstData}:{$lastCol}{$lastData}")
            ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        for ($row = $firstData; $row <= $lastData; $row++) {
            if ($row % 2 === 0) {
                $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                    ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFF1F5F9'));
            }
        }
    }

    /**
     * Footer ringkasan 1 baris di bawah tabel — isi menyesuaikan aliran yang dipilih admin:
     * semua → Uang Masuk + Uang Keluar, Total di ujung kanan; masuk/keluar → hanya Total.
     * ponytail: footer dihitung per-query; jika data sangat besar, jadikan agregat DB di query().
     */
    private function appendSummary(Worksheet $sheet, int $lastData, string $lastCol): void
    {
        $verified = Transaksi::filterAdmin($this->filters)
            ->where('status_verifikasi', StatusVerifikasi::Terverifikasi)
            ->get(['jenis_transaksi', 'nominal']);

        $aliran = $this->filters['aliran'] ?? 'semua';

        $sumBy = fn (JenisTransaksi $jenis) => (float) $verified->where('jenis_transaksi', $jenis)->sum('nominal');

        $masuk = $sumBy(JenisTransaksi::Setor);
        $keluar = $sumBy(JenisTransaksi::Tarik);

        $footerRow = $lastData + 1;

        $sheet->getStyle("A{$footerRow}:{$lastCol}{$footerRow}")
            ->applyFromArray([
                'font' => ['bold' => true, 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFECFDF5']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
        $sheet->getStyle("A{$footerRow}:{$lastCol}{$footerRow}")
            ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setARGB('FFCBD5E1');

        if ($aliran === 'masuk') {
            $this->writeFooterPair($sheet, $footerRow, 'A', 'C', 'Total Uang Masuk', $masuk);
        } elseif ($aliran === 'keluar') {
            $this->writeFooterPair($sheet, $footerRow, 'A', 'C', 'Total Uang Keluar', $keluar);
        } else {
            $this->writeFooterPair($sheet, $footerRow, 'A', 'C', 'Uang Masuk', $masuk);
            $this->writeFooterPair($sheet, $footerRow, 'D', 'F', 'Uang Keluar', $keluar);
            $this->writeFooterPair($sheet, $footerRow, 'G', $lastCol, 'Total', $masuk - $keluar);
        }
    }

    private function writeFooterPair(Worksheet $sheet, int $row, string $from, string $to, string $label, float $nilai): void
    {
        // Merge label→nilai jadi satu sel biar teks "Uang Masuk: Rp ..." tampil penuh
        // (kolom A hanya lebar 5; kalau label duduk di A, tulisannya kepotong).
        $sheet->mergeCells("{$from}{$row}:{$to}{$row}");

        $cell = $from.$row;
        $sheet->setCellValue($cell, "{$label}: Rp ".number_format($nilai, 0, ',', '.'));
        $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    }
}