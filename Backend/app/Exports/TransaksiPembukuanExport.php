<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class TransaksiPembukuanExport implements WithMultipleSheets
{
    private array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function sheets(): array
    {
        return [
            new TransaksiExport($this->filters),
            new TransaksiRekapExport($this->filters),
            new TransaksiRekapKategoriExport($this->filters),
        ];
    }
}