<?php

namespace App\Exports;

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

class UsersTemplate implements FromArray, ShouldAutoSize, WithEvents, WithHeadings, WithStyles, WithTitle
{
    public function title(): string
    {
        return 'Template Import';
    }

    /**
     * Nama kolom harus PERSIS sama dengan kunci yang dibaca parser
     * (App\Imports\UsersImport). Jangan diganti tanpa sinkron import.
     *
     * Layout final (49 kolom):
     *   A..C   data dasar user (3)
     *   D..J   tabungan Emas (7)
     *   K..P   tabungan Hari Raya (6)
     *   Q..V   tabungan Qurban (7)
     *   W..AB  tabungan Berjangka (6)
     *   AC     tabungan Mandiri (1)
     *   AD..AV gadai (19)
     */
    public function headings(): array
    {
        return [
            // ─── Blok A: data dasar user ─────────────────────────────
            // Email, No. Handphone, Alamat, Nomor Anggota & Password sengaja
            // tidak lagi diminta di template — nasabah mengisinya sendiri
            // di akun masing-masing setelah import.
            'Nama Lengkap',
            'Peran',
            'Status',

            // ─── Blok B: Tabungan Emas (target dalam gram) ──────────
            'Emas - Target (gram)',
            'Emas - Gram per Periode',
            'Emas - Frekuensi Bayar',
            'Emas - Nominal per Periode (Rp)',
            'Emas - Durasi (Periode)',
            'Emas - Tanggal Mulai',
            'Emas - Jatuh Tempo',

            // ─── Blok C: Tabungan Hari Raya (target rupiah) ─────────
            'Hari Raya - Target (Rp)',
            'Hari Raya - Frekuensi Bayar',
            'Hari Raya - Nominal per Periode (Rp)',
            'Hari Raya - Durasi (Periode)',
            'Hari Raya - Tanggal Mulai',
            'Hari Raya - Jatuh Tempo',

            // ─── Blok D: Tabungan Qurban (mirip target rupiah) ──────
            'Qurban - Target (Rp)',
            'Qurban - Jumlah Hewan',
            'Qurban - Jenis Hewan',
            'Qurban - Periode',
            'Qurban - Frekuensi Bayar',
            'Qurban - Nominal per Periode (Rp)',
            'Qurban - Tanggal Daftar',

            // ─── Blok E: Tabungan Berjangka (target rupiah + durasi) ─
            'Berjangka - Target (Rp)',
            'Berjangka - Frekuensi Bayar',
            'Berjangka - Nominal per Periode (Rp)',
            'Berjangka - Durasi (Periode)',
            'Berjangka - Tanggal Mulai',
            'Berjangka - Jatuh Tempo',

            // ─── Blok F: Tabungan Mandiri (setor bebas) ─────────────
            'Mandiri - Saldo Awal (Rp)',

            // ─── Blok G: Gadai (19 kolom lengkap) ───────────────────
            'Gadai - No. Referensi',
            'Gadai - Tanggal Aju',
            'Gadai - Jenis Emas',
            'Gadai - Berat (gram)',
            'Gadai - Kadar (%)',
            'Gadai - Berat Bersih (gram)',
            'Gadai - Harga Acuan (Rp/gram)',
            'Gadai - Nilai Taksiran (Rp)',
            'Gadai - Persen Gadai (%)',
            'Gadai - Besaran Gadai (Rp)',
            'Gadai - Tenor (Satuan)',
            'Gadai - Toleransi Hari',
            'Gadai - Frekuensi Bayar',
            'Gadai - Nominal Angsuran (Rp)',
            'Gadai - Bunga (%)',
            'Gadai - Total Dibayar (Rp)',
            'Gadai - Tanggal Aktif',
            'Gadai - Jatuh Tempo',
            'Gadai - Status',
        ];
    }

    public function array(): array
    {
        // Baris kedua = contoh, dilewati saat import (skipped via CONTOH_NAMA).
        $contoh = [
            // ─── Blok A ─────────────────────────────────────────────
            'Ahmad Fauzi',
            'Nasabah',
            'Aktif',

            // ─── Blok B: Emas (target 25 gram) ──────────────────────
            '25',
            '1',
            'Bulanan',
            '1500000',
            '25',
            '01/01/2026',
            '01/02/2028',

            // ─── Blok C: Hari Raya (target Rp 5.000.000) ────────────
            '5000000',
            'Bulanan',
            '208333',
            '24',
            '01/01/2026',
            '01/01/2028',

            // ─── Blok D: Qurban (target Rp 4.500.000) ───────────────
            '4500000',
            '1',
            'Kambing',
            '2026',
            'Bulanan',
            '375000',
            '01/05/2026',

            // ─── Blok E: Berjangka (target Rp 6.000.000) ────────────
            '6000000',
            'Bulanan',
            '500000',
            '12',
            '01/06/2026',
            '01/06/2027',

            // ─── Blok F: Mandiri (saldo awal) ───────────────────────
            '1000000',

            // ─── Blok G: Gadai (19 kolom); kadar satuan per-mille (999 = 99,9%) ──
            'GDS-260101-0001',
            '01/05/2026',
            'Antam 99',
            '10',
            '999',
            '9.99',
            '1500000',
            '14985000',
            '90',
            '13486500',
            'bulan',
            '7',
            'bulanan',
            '561938',
            '1.5',
            '13486500',
            '01/05/2026',
            '01/05/2027',
            'Aktif',
        ];

        // Baris 2 = contoh, baris 3 = kosong (keduanya dilewati).
        return [$contoh, array_fill(0, count($contoh), null)];
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
                $sheet->freezePane('A2');

                // Data validation dropdown untuk Peran (B) & Status (C)
                $this->addValidation($sheet, 'B', 'Nasabah');
                $this->addValidation($sheet, 'C', 'Aktif,Menunggu Persetujuan,Ditolak,Dibekukan');

                // Kolom angka di-render teks agar tidak jadi notasi ilmiah / tanggal serial.
                $textCols = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'];
                foreach ($textCols as $col) {
                    $sheet->getStyle("{$col}2:{$col}200")->getNumberFormat()->setFormatCode('@');
                }

                // Petunjuk pengisian dalam komentar A1.
                $note = 'Petunjuk: Isi mulai baris 3 (baris 2 = contoh, otomatis dilewati). '
                    . 'Kolom wajib: Nama Lengkap (A). '
                    . 'Email, No. Handphone, Nomor Anggota, Alamat, dan Password TIDAK lagi diminta di template — '
                    . 'nasabah mengisinya sendiri di akun masing-masing setelah import. '
                    . 'Blok tabungan OPSIONAL — kosongkan seluruh kolom produk yang tidak dimiliki nasabah. '
                    . 'Angka tulis tanpa titik/koma (contoh: 5000000). Tanggal format DD/MM/YYYY (contoh: 01/05/2026). '
                    . 'Emas memakai GRAM untuk target; Hari Raya/Qurban/Berjangka memakai Rupiah. '
                    . 'Peran hanya "Nasabah" — Admin tidak pernah dibuat lewat import.';
                $sheet->getComment('A1')->getText()->createTextRun($note);
                $sheet->getComment('A1')->setWidth('320pt');
                $sheet->getComment('A1')->setHeight('150pt');
            },
        ];
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
