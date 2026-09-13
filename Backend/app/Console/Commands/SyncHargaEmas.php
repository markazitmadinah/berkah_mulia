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

    // logammulia.com diblokir Cloudflare untuk semua request non-browser (HTTP 403).
    // Pakai harga-emas.org yang memuat tabel harga ANTAM resmi dan masih terbuka.
    private const SUMBER = 'https://harga-emas.org/';

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
            $harga = $this->parseHargaPerGram($html);
            $tanggal = $this->parseTanggal($html);

            if (! $harga) {
                $this->error('Harga 1 gr tidak ditemukan di halaman Logam Mulia.');
                return self::FAILURE;
            }
            if (! $tanggal) {
                $tanggal = now()->toDateString();
            }

            $row = HargaEmasHarian::whereDate('tanggal', $tanggal)->where('status_aktif', true)->first();

            if ($row) {
                $old = (float) $row->harga_per_gram;
                $row->update([
                    'harga_per_gram' => $harga,
                    'catatan' => 'Auto-sync Logam Mulia',
                ]);
                AuditLog::record('auto_update', $row, ['harga_per_gram' => $old], ['harga_per_gram' => $harga]);
                $this->info("Harga emas {$tanggal} diperbarui: Rp {$harga} gr (sebelumnya Rp {$old}).");
            } else {
                // Hanya satu baris aktif pada satu waktu: nonaktifkan baris aktif lama
                // agar hargaTerkini() tidak memakai harga hari lain.
                HargaEmasHarian::where('status_aktif', true)->update(['status_aktif' => false]);
                $row = HargaEmasHarian::create([
                    'tanggal' => $tanggal,
                    'harga_per_gram' => $harga,
                    'status_aktif' => true,
                    'catatan' => 'Auto-sync Logam Mulia',
                    'created_by' => null,
                ]);
                AuditLog::record('auto_create', $row);
                $this->info("Harga emas {$tanggal} dibuat: Rp {$harga} gr.");
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Gagal sinkronisasi: '.$e->getMessage());
            return self::FAILURE;
        }
    }

    private function parseHargaPerGram(string $html): ?int
    {
        // Baris "1 gr" pada tabel harga ANTAM → kolom pertama setelahnya adalah harga beli per gram.
        if (preg_match('/<p>1<\/p><\/td><td[^>]*><div[^>]*><p>([\d.,]+)<\/p>/i', $html, $m)) {
            return (int) preg_replace('/[^\d]/', '', $m[1]);
        }

        return null;
    }

    private function parseTanggal(string $html): ?string
    {
        // harga-emas.org: "Harga Emas Hari Ini Pada 10 Sep 2026, 19.20 WIB"
        if (preg_match('/Pada\s+(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/i', $html, $m)) {
            return $this->buildDate($m[1], $m[2], $m[3]);
        }

        // cadangan: format lama "Harga Emas Hari Ini, 10 Sep 2026"
        if (preg_match('/Harga Emas Hari Ini,?\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/i', $html, $m)) {
            return $this->buildDate($m[1], $m[2], $m[3]);
        }

        return null;
    }

    private function buildDate(string $day, string $month, string $year): ?string
    {
        $bulan = [
            'jan' => '01', 'feb' => '02', 'mar' => '03', 'apr' => '04',
            'mei' => '05', 'may' => '05', 'jun' => '06', 'jul' => '07',
            'agu' => '08', 'aug' => '08', 'sep' => '09', 'okt' => '10', 'oct' => '10',
            'nov' => '11', 'des' => '12', 'dec' => '12',
        ];
        $mBulan = strtolower($month);
        if (! isset($bulan[$mBulan])) {
            return null;
        }

        return sprintf('%04d-%s-%02d', (int) $year, $bulan[$mBulan], (int) $day);
    }
}