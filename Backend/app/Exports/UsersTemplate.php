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
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class UsersTemplate implements FromArray, WithHeadings, WithStyles, ShouldAutoSize, WithEvents, WithTitle
{
    public function title(): string
    {
        return 'Template Import';
    }

    public function headings(): array
    {
        return [
            'Nama Lengkap',
            'Email',
            'No. Handphone',
            'Nomor Anggota (16 digit)',
            'Alamat',
            'Password',
            'Peran',
            'Status',
        ];
    }

    public function array(): array
    {
        return [
            [
                'Contoh Nasabah',
                'nasabah.contoh@gmail.com',
                '08123456789',
                '1234567890123456',
                'Jl. Contoh No. 1, Jakarta',
                'password123',
                'Nasabah',
                'Aktif',
            ],
            [null, null, null, null, null, null, null, null],
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
                $lastCol = $sheet->getHighestColumn();

                $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setWrapText(true);
                $sheet->getRowDimension(1)->setRowHeight(30);
                $sheet->freezePane('A2');

                // Styling for rows 2-3 (example + note rows)
                $sheet->getStyle("A2:{$lastCol}3")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setARGB('FFCBD5E1');
                $sheet->getStyle("A2:{$lastCol}3")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                // Highlight example row
                $sheet->getStyle("A2:{$lastCol}2")
                    ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFFEF3C7'));

                // Data validation: dropdown for Peran (G) and Status (H)
                $this->addValidation($sheet, 'G', 'Nasabah,Administrator');
                $this->addValidation($sheet, 'H', 'Aktif,Menunggu Persetujuan,Ditolak,Dibekukan');

                // Force Nomor Anggota (D) + No. Handphone (C) sebagai teks agar
                // 16 digit tidak berubah jadi notasi ilmiah / kehilangan presisi.
                $sheet->getStyle("D3:D200")->getNumberFormat()->setFormatCode('@');
                $sheet->getStyle("C3:C200")->getNumberFormat()->setFormatCode('@');

                // Add instruction note
                $note = 'Petunjuk: Isi mulai baris 3. Kolom wajib diisi: Nama, Email, No. Handphone, Nomor Anggota (16 digit), dan Password. Baris 2 adalah contoh dan boleh dihapus.';
                $sheet->setCellValue('A5', $note);
                $sheet->mergeCells("A5:{$lastCol}5");
                $sheet->getStyle('A5')->getFont()->setItalic(true)->getColor()->setARGB('FF64748B');
            },
        ];
    }

    private function addValidation(Worksheet $sheet, string $col, string $list): void
    {
        $validation = $sheet->getDataValidation("{$col}3:{$col}200");
        $validation->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
        $validation->setErrorStyle(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::STYLE_STOP);
        $validation->setAllowBlank(true);
        $validation->setShowDropDown(true);
        $validation->setFormula1('"' . $list . '"');
    }
}
