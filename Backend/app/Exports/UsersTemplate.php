<?php

namespace App\Exports;

use App\Enums\TipeTabungan;
use App\Models\JenisTabungan;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
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
        return array_merge($this->baseHeadings(), $this->tabunganHeadings());
    }

    /**
     * Kolom dasar identitas nasabah.
     */
    private function baseHeadings(): array
    {
        return [
            'Nama Lengkap',
            'Email',
            'No. Handphone',
            'Nomor Anggota (10 digit)',
            'Alamat',
            'Password',
            'Peran',
            'Status',
        ];
    }

    /**
     * Kolom opsional per jenis tabungan pribadi aktif (Mandiri, Hari Raya, Berjangka):
     * target nominal & saldo awal (dana yang sudah dibayarkan). Nama heading
     * harus konsisten dengan parser di App\Imports\UsersImport.
     */
    private function tabunganHeadings(): array
    {
        $headings = [];

        foreach ($this->jenisTabunganPribadi() as $jenis) {
            $headings[] = "{$jenis->nama} - Target";
            $headings[] = "{$jenis->nama} - Saldo Awal";
        }

        return $headings;
    }

    private function jenisTabunganPribadi(): array
    {
        return JenisTabungan::aktif()
            ->where('tipe', TipeTabungan::Pribadi)
            ->orderBy('nama')
            ->get()
            ->all();
    }

    public function array(): array
    {
        $row = [
            'Contoh Nasabah',
            'nasabah.contoh@gmail.com',
            '08123456789',
            '1234567890',
            'Jl. Contoh No. 1, Jakarta',
            'password123',
            'Nasabah',
            'Aktif',
        ];

        $pertama = true;
        foreach ($this->jenisTabunganPribadi() as $jenis) {
            $row[] = $pertama ? '1000000' : null; // Target (contoh)
            $row[] = $pertama ? '500000' : null;  // Saldo Awal (contoh)
            $pertama = false;
        }

        return [$row, array_fill(0, count($row), null)];
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

                // Styling untuk baris 2-3 (contoh + catatan)
                $sheet->getStyle("A2:{$lastCol}3")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setARGB('FFCBD5E1');
                $sheet->getStyle("A2:{$lastCol}3")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                // Highlight baris contoh
                $sheet->getStyle("A2:{$lastCol}2")
                    ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFFEF3C7'));

                // Data validation: dropdown untuk Peran (G) dan Status (H)
                $this->addValidation($sheet, 'G', 'Nasabah,Administrator');
                $this->addValidation($sheet, 'H', 'Aktif,Menunggu Persetujuan,Ditolak,Dibekukan');

                // Kolom nomor wajib (handphone, anggota) + semua kolom tabungan
                // diformat teks agar angka panjang/tabungan tidak jadi notasi ilmiah.
                $sheet->getStyle('C3:D200')->getNumberFormat()->setFormatCode('@');
                foreach ($this->tabunganColumnLetters() as $col) {
                    $sheet->getStyle("{$col}3:{$col}200")->getNumberFormat()->setFormatCode('@');
                }

                // Petunjuk pengisian diletakkan sebagai komentar sel (bukan nilai sel),
                // supaya tidak ikut terbaca sebagai baris data saat file di-import.
                $note = 'Petunjuk: Isi mulai baris 3. Kolom wajib: Nama, Email, No. Handphone, Nomor Anggota (10 digit). '
                    . 'Kolom tabungan ("Target" dan "Saldo Awal") bersifat OPSIONAL — kosongkan bila tabungan tidak ada. '
                    . 'Target = nominal target tabungan; Saldo Awal = dana yang sudah dibayarkan, dicatat otomatis sebagai '
                    . 'saldo awal terverifikasi tanpa input manual dari nasabah. Isi angka tanpa titik/koma (contoh: 500000). '
                    . 'Baris 2 adalah contoh dan otomatis dilewati saat import — jangan diubah menjadi data baru.';
                $sheet->getComment('A1')->getText()->createTextRun($note);
                $sheet->getComment('A1')->setWidth('300pt');
                $sheet->getComment('A1')->setHeight('130pt');
            },
        ];
    }

    /**
     * Huruf kolom untuk setiap kolom tabungan (Target + Saldo Awal), di urutan
     * setelah kolom dasar (A..H).
     */
    private function tabunganColumnLetters(): array
    {
        $letters = [];
        $index = count($this->baseHeadings()) + 1; // mulai kolom 9 (I)

        foreach ($this->jenisTabunganPribadi() as $jenis) {
            $letters[] = $this->colLetter($index);
            $letters[] = $this->colLetter($index + 1);
            $index += 2;
        }

        return $letters;
    }

    private function colLetter(int $index): string
    {
        $letter = '';
        while ($index > 0) {
            $mod = ($index - 1) % 26;
            $letter = chr(65 + $mod) . $letter;
            $index = intdiv($index - 1, 26);
        }
        return $letter;
    }

    private function addValidation(Worksheet $sheet, string $col, string $list): void
    {
        $validation = $sheet->getDataValidation("{$col}3:{$col}200");
        $validation->setType(DataValidation::TYPE_LIST);
        $validation->setErrorStyle(DataValidation::STYLE_STOP);
        $validation->setAllowBlank(true);
        $validation->setShowDropDown(true);
        $validation->setFormula1('"' . $list . '"');
    }
}