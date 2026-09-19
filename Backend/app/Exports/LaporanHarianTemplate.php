<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Template Excel untuk Import Laporan Harian.
 *
 * Menyediakan heading + 2 baris contoh agar admin mengetahui
 * format kolom yang diharapkan oleh LaporanHarianImport.
 */
class LaporanHarianTemplate implements FromArray, ShouldAutoSize, WithEvents, WithHeadings, WithStyles, WithTitle
{
    public function title(): string
    {
        return 'Laporan Harian';
    }

    public function headings(): array
    {
        return [
            'Nama Nasabah',
            'Nomor Anggota',
            'No Handphone',
            'Tanggal Pembayaran',
            'Tabungan Emas',
            'Tabungan Mandiri',
            'Tabungan Hari Raya',
            'Tabungan Kurban',
            'Bayar Gadai',
        ];
    }

    /**
     * Baris contoh supaya admin memahami formatnya.
     */
    public function array(): array
    {
        return [
            ['Ahmad Sunaryo', '1234567890', '081234567890', '01/09/2026', 50000, 25000, '', '', ''],
            ['Siti Aminah', '', '089876543210', '01/09/2026', '', 30000, 20000, 15000, ''],
        ];
    }

    public function styles(Worksheet $sheet): array
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
                $lastCol = $sheet->getHighestColumn();

                $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setWrapText(true);
                $sheet->freezePane('A2');
                $sheet->getRowDimension(1)->setRowHeight(28);

                // Border untuk seluruh area data
                $sheet->getStyle("A1:{$lastCol}3")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN);

                // Format kolom tanggal
                $sheet->getStyle('D2:D100')->getNumberFormat()
                    ->setFormatCode(NumberFormat::FORMAT_DATE_DDMMYYYY);

                // Format kolom nominal
                foreach (['E', 'F', 'G', 'H', 'I'] as $col) {
                    $sheet->getStyle("{$col}2:{$col}100")->getNumberFormat()
                        ->setFormatCode('#,##0');
                }

                // Petunjuk pengisian di bawah contoh
                $sheet->setCellValue('A5', 'PETUNJUK:');
                $sheet->getStyle('A5')->getFont()->setBold(true);
                $sheet->setCellValue('A6', '• Kolom "Nama Nasabah" wajib diisi');
                $sheet->setCellValue('A7', '• Kolom "Nomor Anggota" dan "No Handphone" opsional (membantu identifikasi user)');
                $sheet->setCellValue('A8', '• User baru otomatis dibuat jika nama belum terdaftar');
                $sheet->setCellValue('A9', '• Isi nominal pada kolom tabungan yang sesuai, kosongkan jika tidak ada');
                $sheet->setCellValue('A10', '• Format tanggal: DD/MM/YYYY');
            },
        ];
    }
}
