<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HargaEmasBackfillSeeder extends Seeder
{
    /**
     * Isi riwayat harga demo ~12 bulan (business day, Minggu libur) agar
     * chart 1W/1M/1Y terlihat beda. Semua baris diberi catatan 'backfill demo'
     * agar mudah dihapus: DELETE FROM harga_emas_harian WHERE catatan LIKE '%backfill demo%'.
     */
    public function run(): void
    {
        $existing = DB::table('harga_emas_harian')->pluck('tanggal')->map(fn ($d) => (string) $d)->all();
        $existing = array_flip($existing);

        $rows = [];
        $price = 2600000.0; // harga pada akhir backfill (23 Agu 2026), bersebelahan dengan data asli 24 Agu (2.610.000)
        $end = Carbon::parse('2026-08-23');
        $start = Carbon::parse('2025-09-01');
        $now = now();

        for ($d = $end; $d->gte($start); $d->subDay()) {
            if ($d->dayOfWeek === Carbon::SUNDAY) { // gold shop weekday: Minggu tutup
                continue;
            }
            $ds = $d->toDateString();
            if (isset($existing[$ds])) {
                continue;
            }
            $rows[] = [
                'tanggal' => $ds,
                'harga_per_gram' => round($price / 500) * 500,
                'status_aktif' => false,
                'catatan' => 'backfill demo 12 bulan (hapus untuk produksi)',
                'created_by' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            // jalan mundur: sedikit acak ±0,15% per hari, dijaga dalam kisar wajar
            $price *= 1 + (mt_rand(-150, 150) / 100000);
            $price = max(2100000.0, min(2800000.0, $price));
        }

        DB::table('harga_emas_harian')->insert($rows);
        $this->command->info('Backfill harga emas: '.count($rows).' baris ditambahkan.');
    }
}