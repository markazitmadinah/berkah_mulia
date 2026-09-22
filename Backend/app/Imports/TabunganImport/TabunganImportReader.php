<?php

namespace App\Imports\TabunganImport;

use App\Exports\TabunganImportTemplate;
use Maatwebsite\Excel\Concerns\SkipsUnknownSheets;
use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Baca file Excel ke array per sheet ({sheet: [ [kolom_slug => nilai, ...], ... ]}).
 * Hanya 7 sheet yang dikenali di proses; sheet lain diabaikan. Heading di-slug
 * (Nama Lengkap → nama_lengkap, dst) seperti Maatwebsite.
 */
class TabunganImportReader implements SkipsUnknownSheets, WithMultipleSheets
{
    /** @var array<string, array<int, array<string, mixed>>> */
    private array $data = [];

    public function sheets(): array
    {
        $sheets = [];
        foreach (array_keys(TabunganImportTemplate::SHEETS) as $judul) {
            $sheets[] = new class($this, $judul) implements ToArray, WithHeadingRow
            {
                public function __construct(private TabunganImportReader $reader, private string $judul) {}

                public function headingRow(): int
                {
                    return 1;
                }

                public function array(array $rows): void
                {
                    $this->reader->tampung($this->judul, $rows);
                }
            };
        }

        return $sheets;
    }

    public function onUnknownSheet($sheetName): void
    {
        // Abaikan sheet yang tidak dikenali (mis. sheet default Excel "Sheet1").
    }

    public function tampung(string $judul, array $rows): void
    {
        // Baris 1 = heading, baris 2 = contoh template; data nyata mulai baris 3.
        $terindeks = [];
        foreach ($rows as $i => $row) {
            $terindeks[$i + 3] = $row;
        }
        $this->data[$judul] = $terindeks;
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function data(): array
    {
        return $this->data;
    }
}