<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\HargaEmasHarian;
use GuzzleHttp\Client;
use Illuminate\Console\Command;

class SyncHargaEmas extends Command
{
    protected $signature = 'hargaemas:sync';

    protected $description = 'Ambil harga emas hari ini dari web resmi Logam Mulia dan simpan ke harga_emas_harian';

    private const SUMBER = 'https://anekalogam.co.id/id/logam-mulia';

    public function handle(): int
    {
        try {
            $client = new Client([
                'timeout' => 40,
                'http_errors' => false,
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language' => 'id,en-US;q=0.9,en;q=0.8',
                ],
            ]);

            $html = null;
            $lastStatus = 0;
            for ($attempt = 1; $attempt <= 3; $attempt++) {
                $res = $client->get(self::SUMBER);
                $lastStatus = $res->getStatusCode();
                if ($lastStatus === 200) {
                    $html = $res->getBody()->getContents();
                    break;
                }
                usleep(500000);
            }
            if ($html === null) {
                $this->error('Gagal mengambil halaman Logam Mulia (HTTP '.$lastStatus.').');
                return self::FAILURE;
            }
            $prices = $this->parseHargaPerGram($html);
            $tanggal = $this->parseTanggal($html);

            if (! $prices) {
                $this->error('Harga 1 gr tidak ditemukan di halaman Logam Mulia.');
                return self::FAILURE;
            }
            if (! $tanggal) {
                $tanggal = now()->toDateString();
            }

            $harga = $prices['harga_per_gram'];
            $hargaBeli = $prices['harga_beli'];
            $row = HargaEmasHarian::whereDate('tanggal', $tanggal)->where('status_aktif', true)->first();

            if ($row) {
                $old = (float) $row->harga_per_gram;
                $row->update([
                    'harga_per_gram' => $harga,
                    'harga_beli' => $hargaBeli,
                    'catatan' => 'Auto-sync Logam Mulia',
                ]);
                AuditLog::record('auto_update', $row, ['harga_per_gram' => $old], ['harga_per_gram' => $harga, 'harga_beli' => $hargaBeli]);
                $this->info("Harga emas {$tanggal} diperbarui: jual Rp {$harga}, beli Rp {$hargaBeli} gr (sebelumnya jual Rp {$old}).");
            } else {
                // Hanya satu baris aktif pada satu waktu: nonaktifkan baris aktif lama
                // agar hargaTerkini() tidak memakai harga hari lain.
                HargaEmasHarian::where('status_aktif', true)->update(['status_aktif' => false]);
                $row = HargaEmasHarian::create([
                    'tanggal' => $tanggal,
                    'harga_per_gram' => $harga,
                    'harga_beli' => $hargaBeli,
                    'status_aktif' => true,
                    'catatan' => 'Auto-sync Logam Mulia',
                    'created_by' => null,
                ]);
                AuditLog::record('auto_create', $row);
                $this->info("Harga emas {$tanggal} dibuat: jual Rp {$harga}, beli Rp {$hargaBeli} gr.");
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Gagal sinkronisasi: '.$e->getMessage());
            return self::FAILURE;
        }
    }

    private function parseHargaPerGram(string $html): ?array
    {
        // Baris "1gram" pada tabel Aneka Logam → ambil dua harga: "We sell" & "We buy".
        // preg_match berhenti di link emas-lm-1-gram pertama (baris 1gram, bukan edisi lama "-i").
        if (preg_match('/popup-product\/emas-lm-1-gram.*?<span>([\d.]+)<\/span>[\s\S]*?<span>([\d.]+)<\/span>/is', $html, $m)) {
            return [
                'harga_per_gram' => (int) preg_replace('/[^\d]/', '', $m[1]),
                'harga_beli' => (int) preg_replace('/[^\d]/', '', $m[2]),
            ];
        }

        return null;
    }

    private function parseTanggal(string $html): ?string
    {
        // anekalogam.co.id: "Terakhir Diperbarui: ... 14 September 2026 ..."
        if (preg_match('/Terakhir Diperbarui:.*?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i', $html, $m)) {
            return $this->buildDate($m[1], $m[2], $m[3]);
        }

        return null;
    }

    private function buildDate(string $day, string $month, string $year): ?string
    {
        $bulan = [
            'januari' => '01', 'februari' => '02', 'maret' => '03', 'april' => '04',
            'mei' => '05', 'juni' => '06', 'juli' => '07', 'agustus' => '08',
            'september' => '09', 'oktober' => '10', 'november' => '11', 'desember' => '12',
        ];
        $mBulan = strtolower($month);
        if (! isset($bulan[$mBulan])) {
            return null;
        }

        return sprintf('%04d-%s-%02d', (int) $year, $bulan[$mBulan], (int) $day);
    }
}