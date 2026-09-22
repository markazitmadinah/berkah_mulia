<?php

namespace App\Imports\TabunganImport;

use App\Enums\StatusGadai;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Baca satu baris sheet mentah (key = heading di-slug) menjadi array kolom
 * yang dinormalisasi + tervalidasi per produk.
 */
class TabunganImportValidator
{
    public function __construct(
        private string $sheet,
        private int $baris,
        private array $row,
    ) {}

    public static function contoh(string $nasabahId): bool
    {
        return trim((string) $nasabahId) === \App\Exports\TabunganImportTemplate::CONTOH_NASABAH_ID;
    }

    public function teks(string $kolom): string
    {
        return trim((string) ($this->row[Str::slug($kolom, '_')] ?? ''));
    }

    public function nullableTeks(string $kolom): ?string
    {
        $nilai = $this->teks($kolom);

        return $nilai === '' ? null : $nilai;
    }

    /**
     * Nominal rupiah bulat: abaikan pemisah ribuan (titik/koma/spasi), sisakan digit.
     */
    public function rupiah(string $kolom): ?int
    {
        $digits = preg_replace('/[^\d]/', '', $this->teks($kolom));

        return $digits === '' || $digits === null ? null : (int) $digits;
    }

    /**
     * Desimal (gram, kadar, persen) dengan toleransi koma → titik.
     */
    public function desimal(string $kolom): ?float
    {
        $nilai = str_replace(',', '.', $this->teks($kolom));

        return $nilai === '' ? null : (is_numeric($nilai) ? (float) $nilai : null);
    }

    public function banyak(string $kolom): ?int
    {
        $nilai = $this->rupiah($kolom);

        return $nilai === null ? null : (int) $nilai;
    }

    public function tanggal(string $kolom): ?string
    {
        $nilai = $this->teks($kolom);
        if ($nilai === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('!d/m/Y', $nilai)?->toDateString()
                ?? Carbon::parse($nilai)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    public function frekuensi(string $kolom, string $default = 'bulanan'): ?string
    {
        return match (Str::lower($this->teks($kolom))) {
            'harian' => 'harian',
            'mingguan' => 'mingguan',
            'bulanan' => 'bulanan',
            '' => $default,
            default => null,
        };
    }

    public function statusGadai(string $kolom, string $default = 'aktif'): string
    {
        return match (Str::lower(Str::replace(['tahun tempo', 'jatuh tempo'], ['tahun_tempo', 'jatuh_tempo'], $this->teks($kolom)))) {
            'diajukan' => StatusGadai::Diajukan->value,
            'disetujui' => StatusGadai::Disetujui->value,
            'aktif' => StatusGadai::Aktif->value,
            'jatuh_tempo' => StatusGadai::JatuhTempo->value,
            'terlambat' => StatusGadai::Terlambat->value,
            'diperpanjang' => StatusGadai::Diperpanjang->value,
            'lunas' => StatusGadai::Lunas->value,
            'emas_dikembalikan' => StatusGadai::EmasDikembalikan->value,
            'batal' => StatusGadai::Batal->value,
            '' => $default,
            default => 'diajukan',
        };
    }

    /**
     * Apakah baris sheet ini benar-benar kosong (tidak ada data)? Baris kosong
     * dilewati supaya template yang diisi parsial tidak menghasilkan record kosong.
     */
    public function kosong(): bool
    {
        return collect($this->row)->every(fn ($v) => trim((string) $v) === '');
    }
}