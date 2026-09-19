<?php

namespace App\Exports;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Models\Transaksi;
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

class TransaksiExport implements FromQuery, ShouldAutoSize, WithColumnFormatting, WithEvents, WithHeadings, WithMapping, WithStrictNullComparison, WithStyles, WithTitle
{
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
        $query = Transaksi::with([
            'user',
            'jenisTabungan',
            'rekeningBank',
            'diverifikasiOleh',
            'pendaftaranQurban.hewanQurban',
            'tabunganBerjangka',
            'gadai',
        ]);

        return $query->filterAdmin($this->filters)->latest();
    }

    public function headings(): array
    {
        return [
            'No',
            'No Referensi',
            'No Anggota',
            'Nama Nasabah',
            'No. Handphone',
            'Produk Tabungan',
            'Detail Program',
            'Jenis Mutasi',
            'Nominal (Rp)',
            'Gram Emas (g)',
            'Harga Emas Acuan (Rp)',
            'Biaya Penalti (Rp)',
            'Metode Pembayaran',
            'Rekening Tujuan / Kas',
            'Tanggal Transaksi',
            'Status Verifikasi',
            'Diverifikasi Oleh',
            'Waktu Verifikasi',
            'Catatan Nasabah',
            'Catatan Admin',
        ];
    }

    public function map($row): array
    {
        static $no = 0;
        $no++;

        $detailProgram = '-';
        if ($row->pendaftaranQurban) {
            $detailProgram = 'Qurban '.($row->pendaftaranQurban->hewanQurban?->jenis_hewan ?? 'Hewan').' ('.$row->pendaftaranQurban->jumlah_hewan.' ekor)';
        } elseif ($row->tabunganBerjangka) {
            $detailProgram = 'Berjangka '.$row->tabunganBerjangka->durasi_bulan.' Bln ('.($row->tabunganBerjangka->frekuensiLabel() ?: $row->tabunganBerjangka->frekuensi_setor).')';
        } elseif ($row->gadai) {
            $detailProgram = 'Gadai '.($row->gadai->nomor_gadai ?? '-');
        } elseif ($row->konfigurasi_id) {
            $detailProgram = 'Tabungan Emas Rutin';
        }

        $rekening = '-';
        if (($row->metode_pembayaran?->value ?? (string) $row->metode_pembayaran) === 'transfer') {
            $rekening = $row->rekeningBank
                ? ($row->rekeningBank->nama_bank.' - '.$row->rekeningBank->nomor_rekening.' a.n '.$row->rekeningBank->atas_nama)
                : 'Transfer Bank';
        } elseif (($row->metode_pembayaran?->value ?? (string) $row->metode_pembayaran) === 'cash') {
            $rekening = 'Kas Kantor / Tunai';
        }

        return [
            $no,
            $this->safeCell($row->nomor_referensi),
            $this->safeCell($row->user->nomor_anggota ?? '-'),
            $this->safeCell($row->user->name ?? ($row->user_name ?? '-')),
            $this->safeCell($row->user->phone ?? '-'),
            $this->safeCell($row->jenisTabungan->nama ?? '-'),
            $this->safeCell($detailProgram),
            $this->safeCell($row->jenis_transaksi instanceof JenisTransaksi ? $row->jenis_transaksi->label() : (string) $row->jenis_transaksi),
            (float) ($row->nominal ?? 0),
            (float) ($row->unit_didapat ?? 0),
            (float) ($row->harga_acuan_snapshot ?? 0),
            (float) ($row->biaya_penalti ?? 0),
            $this->safeCell($row->metode_pembayaran instanceof MetodePembayaran ? $row->metode_pembayaran->label() : (string) $row->metode_pembayaran),
            $this->safeCell($rekening),
            $row->tanggal_transaksi?->format('d/m/Y'),
            $this->safeCell($row->status_verifikasi instanceof StatusVerifikasi ? $row->status_verifikasi->label() : (string) $row->status_verifikasi),
            $this->safeCell($row->diverifikasiOleh?->name ?? '-'),
            $this->safeCell($row->diverifikasi_pada?->format('d/m/Y H:i') ?? '-'),
            $this->safeCell($row->catatan_user ?? '-'),
            $this->safeCell($row->catatan_admin ?? '-'),
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
            'I' => '#,##0',
            'J' => '0.0000',
            'K' => '#,##0',
            'L' => '#,##0',
            'O' => NumberFormat::FORMAT_DATE_DDMMYYYY,
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

                $sheet->getRowDimension(1)->setRowHeight(28);
            },
        ];
    }
}
