<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Template import tabungan 7 sheet. Satu baris contoh per sheet (A2) yang
 * otomatis dilewati import — diisi dari baris 3.
 *
 * Konfigurasi kolom hidup di konstanta di bawah (SHEETS) supaya template,
 * parser, dan validator membaca definisi yang sama: tambah/hapus kolom di
 * satu tempat.
 */
class TabunganImportTemplate implements WithMultipleSheets
{
    /**
     * Identitas baris contoh pada setiap sheet. Baris ini otomatis dilewati
     * saat import (nasabah_id ini disisipkan pada seluruh baris contoh).
     */
    public const CONTOH_NASABAH_ID = 'NSB-0000';

    /**
     * Definisi 7 sheet: nama → {contoh, kolom_validasi, kolom_teks}
     * Heading urut = posisi kolom sheet.
     */
    public const SHEETS = [
        'Nasabah' => [
            'contoh' => [
                'NSB-0000', 'Ahmad Fauzi', '0812345678',
                'ahmad', '081234567890',
                'Jl. Merdeka No. 1',
            ],
            'validasi' => [], // tidak ada dropdown
        ],
        'Emas' => [
            'contoh' => [
                'NSB-0000', 'Rencana 1', 'Bulanan', '1500000', '10',
                '01/01/2026', '2.5', '3000000',
            ],
            'validasi' => ['Frekuensi' => 'Harian,Mingguan,Bulanan'],
        ],
        'Mandiri' => [
            'contoh' => [
                'NSB-0000', '1000000',
            ],
            'validasi' => [],
        ],
        'Qurban' => [
            'contoh' => [
                'NSB-0000', 'Qurban 1', '2026', 'Kambing', '1', 'Bulanan',
                '375000', '01/05/2026', '1000000',
            ],
            'validasi' => ['Frekuensi' => 'Harian,Mingguan,Bulanan'],
        ],
        'Hari Raya' => [
            'contoh' => [
                'NSB-0000', '5000000', 'Bulanan', '208333', '01/01/2026', '1000000',
            ],
            'validasi' => ['Frekuensi' => 'Harian,Mingguan,Bulanan'],
        ],
        'Gadai' => [
            'contoh' => [
                'NSB-0000', 'GDS-260101-0001', 'Antam 99', '10', '999', '9.99',
                '1500000', '14985000', '90', '13486500', 'bulan', 'bulanan',
                '561938', '1.5', '13486500', '01/05/2026', '01/05/2027', 'Aktif',
            ],
            'validasi' => ['Frekuensi' => 'Harian,Mingguan,Bulanan'],
        ],
        'Berjangka' => [
            'contoh' => [
                'NSB-0000', 'Biaya Umroh', '6000000', '12', 'Bulanan', '500000',
                '01/06/2026', '1000000',
            ],
            'validasi' => ['Frekuensi' => 'Harian,Mingguan,Bulanan'],
        ],
    ];

    public function sheets(): array
    {
        $sheets = [];
        foreach (array_keys(self::SHEETS) as $judul) {
            $sheets[] = new class($judul) implements
                FromArray,
                ShouldAutoSize,
                WithEvents,
                \Maatwebsite\Excel\Concerns\WithTitle,
                \Maatwebsite\Excel\Concerns\WithHeadings,
                \Maatwebsite\Excel\Concerns\WithStyles
            {

                public function __construct(private string $judul) {}

                public function title(): string
                {
                    return $this->judul;
                }

                public function headings(): array
                {
                    return match ($this->judul) {
                        'Nasabah' => ['Nasabah ID', 'Nama Lengkap', 'No. Anggota', 'Username', 'No. Handphone', 'Alamat'],
                        'Emas' => ['Nasabah ID', 'Rencana', 'Frekuensi', 'Nominal Setoran (Rp)', 'Target Gram Total', 'Tanggal Mulai', 'Gram Terkumpul', 'Total Sudah Disetor (Rp)'],
                        'Mandiri' => ['Nasabah ID', 'Saldo Awal (Rp)'],
                        'Qurban' => ['Nasabah ID', 'Rencana', 'Periode Tahun', 'Jenis Hewan', 'Jumlah Hewan', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Daftar', 'Sudah Terkumpul (Rp)'],
                        'Hari Raya' => ['Nasabah ID', 'Target (Rp)', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Mulai', 'Sudah Terkumpul (Rp)'],
                        'Gadai' => ['Nasabah ID', 'Nomor Gadai', 'Jenis Emas', 'Berat (gram)', 'Kadar', 'Berat Bersih (gram)', 'Harga Acuan (Rp/gram)', 'Nilai Taksiran (Rp)', 'Persen Gadai (%)', 'Besaran Gadai (Rp)', 'Tenor (Satuan)', 'Frekuensi', 'Nominal Angsuran (Rp)', 'Bunga (%)', 'Total Dibayar (Rp)', 'Tanggal Aju', 'Jatuh Tempo', 'Status'],
                        'Berjangka' => ['Nasabah ID', 'Rencana', 'Target (Rp)', 'Durasi (Bulan)', 'Frekuensi', 'Nominal Setoran (Rp)', 'Tanggal Mulai', 'Sudah Terkumpul (Rp)'],
                        default => [],
                    };
                }

                public function array(): array
                {
                    return [[...array_values(TabunganImportTemplate::SHEETS[$this->judul]['contoh'])]];
                }

                public function styles(Worksheet $sheet)
                {
                    return [
                        1 => [
                            'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF047857']],
                            'alignment' => [
                                'horizontal' => Alignment::HORIZONTAL_CENTER,
                                'vertical' => Alignment::VERTICAL_CENTER,
                                'wrapText' => true,
                            ],
                        ],
                    ];
                }

                public function registerEvents(): array
                {
                    return [
                        AfterSheet::class => function (AfterSheet $event) {
                            $sheet = $event->sheet->getDelegate();
                            $lastCol = $sheet->getHighestColumn();

                            $sheet->getRowDimension(1)->setRowHeight(34);
                            $sheet->freezePane('A3');

                            // semua kolom angka/nomor diteks-kan agar tidak jadi serial tanggal/notasi ilmiah
                            for ($kol = Coordinate::columnIndexFromString('A'); $kol <= Coordinate::columnIndexFromString($lastCol); $kol++) {
                                $c = Coordinate::stringFromColumnIndex($kol);
                                $sheet->getStyle("{$c}2:{$c}200")->getNumberFormat()->setFormatCode('@');
                            }

                            // dropdown kolom Frekuensi (heading mengandung "Frekuensi")
                            $headings = $this->headings();
                            foreach ($headings as $i => $h) {
                                $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($i + 1);
                                if (str_contains($h, 'Frekuensi')) {
                                    $validation = $sheet->getDataValidation("{$col}3:{$col}200");
                                    $validation->setType(DataValidation::TYPE_LIST);
                                    $validation->setErrorStyle(DataValidation::STYLE_STOP);
                                    $validation->setAllowBlank(true);
                                    $validation->setShowDropDown(true);
                                    $validation->setFormula1('"Harian,Mingguan,Bulanan"');
                                }
                            }

                            $note = 'Petunjuk: Isi mulai baris 3. Baris 2 = contoh (nasabah_id NSB-0000) yang otomatis dilewati. '
                                . 'Kolom wajib di sheet Nasabah: Nasabah ID + Nama Lengkap. '
                                . "Sheet di luar Nasabah opsional: kosongkan seluruh kolom pada sheet yang tidak dimiliki nasabah. "
                                . 'Nasabah tetap terdaftar walau tidak menabung produk apa pun. '
                                . "Satu user boleh punya >1 rencana di sheet Emas/Berjangka/Qurban: isi kolom 'Rencana' dengan nama unik (mis. Rencana 1 / Rencana 2). "
                                . 'Tanggal format DD/MM/YYYY (contoh: 01/05/2026). Angka tanpa titik/koma (contoh: 5000000). '
                                . "Kolom 'Gram Terkumpul / Saldo Awal / Sudah Terkumpul' = saldo awal (bukan transaksi baru); tercatat sekali dan idempoten saat di-import ulang. "
                                . 'Emas memakai GRAM untuk target; Mandiri/Qurban/Hari Raya/Berjangka memakai Rupiah. '
                                . "Qurban: 'Periode Tahun' & 'Jenis Hewan' harus sudah ada di katalog qurban.";
                            $sheet->getComment('A1')->getText()->createTextRun($note);
                            $sheet->getComment('A1')->setWidth('360pt');
                            $sheet->getComment('A1')->setHeight('140pt');
                        },
                    ];
                }
            };
        }

        return $sheets;
    }
}
