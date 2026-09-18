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
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class TransaksiExport implements
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

    public function __construct(
        ?string $status = null,
        ?string $metode = null,
        ?string $search = null,
        ?string $tanggalAwal = null,
        ?string $tanggalAkhir = null,
        ?string $tipe = null
    ) {
        $this->filters = compact('status', 'metode', 'search', 'tanggalAwal', 'tanggalAkhir', 'tipe');
    }

    public function title(): string
    {
        return 'Data Transaksi';
    }

    public function query()
    {
        $query = Transaksi::with(['user', 'jenisTabungan'])->latest();

        if ($this->filters['status']) {
            $query->where('status_verifikasi', $this->filters['status']);
        }
        if ($this->filters['metode']) {
            $query->where('metode_pembayaran', $this->filters['metode']);
        }
        if ($this->filters['tipe']) {
            $query->when(
                $this->filters['tipe'] === 'gadai',
                fn ($q) => $q->whereNotNull('gadai_id'),
                fn ($q) => $q->whereHas('jenisTabungan', fn ($jq) => $jq->where('tipe', $this->filters['tipe']))
            );
        }
        if ($this->filters['search']) {
            $search = $this->filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('nomor_referensi', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%"));
            });
        }
        if ($this->filters['tanggalAwal']) {
            $query->whereDate('tanggal_transaksi', '>=', $this->filters['tanggalAwal']);
        }
        if ($this->filters['tanggalAkhir']) {
            $query->whereDate('tanggal_transaksi', '<=', $this->filters['tanggalAkhir']);
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'No',
            'No Referensi',
            'Nasabah',
            'Produk Tabungan',
            'Jenis Transaksi',
            'Nominal (Rp)',
            'Gram Emas (g)',
            'Metode Pembayaran',
            'Tanggal Transaksi',
            'Status',
        ];
    }

    public function map($row): array
    {
        static $no = 0;
        $no++;

        return [
            $no,
            $this->safeCell($row->nomor_referensi),
            $this->safeCell($row->user->name ?? ($row->user_name ?? '-')),
            $this->safeCell($row->jenisTabungan->nama ?? '-'),
            $this->safeCell($row->jenis_transaksi instanceof JenisTransaksi ? $row->jenis_transaksi->label() : (string) $row->jenis_transaksi),
            $row->nominal,
            $row->unit_didapat,
            $this->safeCell($row->metode_pembayaran instanceof MetodePembayaran ? $row->metode_pembayaran->label() : (string) $row->metode_pembayaran),
            $row->tanggal_transaksi?->format('d/m/Y'),
            $this->safeCell($row->status_verifikasi instanceof StatusVerifikasi ? $row->status_verifikasi->label() : (string) $row->status_verifikasi),
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
            'F' => '#,##0',
            'G' => '0.####',
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

                $sheet->getStyle("A1:{$lastCol}1")->getAlignment()->setWrapText(true);
                $sheet->freezePane('A2');

                $sheet->getStyle("A1:{$lastCol}{$highest}")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setARGB('FFCBD5E1');

                $sheet->getStyle("A2:{$lastCol}{$highest}")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                for ($row = 2; $row <= $highest; $row++) {
                    if ($row % 2 === 0) {
                        $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                            ->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFF1F5F9'));
                    }
                }

                $sheet->getRowDimension(1)->setRowHeight(28);
            },
        ];
    }
}
