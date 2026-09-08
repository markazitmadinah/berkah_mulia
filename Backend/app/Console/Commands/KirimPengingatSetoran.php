<?php

namespace App\Console\Commands;

use App\Enums\ChannelNotifikasi;
use App\Enums\JenisTransaksi;
use App\Enums\TipeNotifikasi;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Notifikasi;
use App\Models\Transaksi;
use Carbon\Carbon;
use Illuminate\Console\Command;

class KirimPengingatSetoran extends Command
{
    protected $signature = 'pengingat:setoran';

    protected $description = 'Kirim pengingat setoran tabungan emas: harian setiap hari, mingguan & bulanan sesuai tanggal_mulai (pukul 10:00 via scheduler)';

    public function handle(): int
    {
        $hariIni = now();
        $dikirim = 0;

        KonfigurasiSetoranEmas::query()
            ->aktif()
            ->lazyById()
            ->each(function (KonfigurasiSetoranEmas $konfigurasi) use ($hariIni, &$dikirim) {
                $mulai = Carbon::parse($konfigurasi->tanggal_mulai ?: $konfigurasi->created_at);

                if (! $this->jatuhTempo($mulai, $hariIni, $konfigurasi->frekuensi_setor->value)) {
                    return;
                }

                // Rencana yang deadline-nya sudah lewat tidak usah diingatkan.
                if ($konfigurasi->tanggal_deadline && $hariIni->gt(Carbon::parse($konfigurasi->tanggal_deadline)->endOfDay())) {
                    return;
                }

                // Sudah ada setoran hari ini untuk rencana ini → bukan lagi pengingat.
                $sudahSetor = Transaksi::milikUser($konfigurasi->user_id)
                    ->where('jenis_tabungan_id', $konfigurasi->jenis_tabungan_id)
                    ->where('jenis_transaksi', JenisTransaksi::Setor)
                    ->where('konfigurasi_id', $konfigurasi->id)
                    ->whereDate('tanggal_transaksi', $hariIni->toDateString())
                    ->exists();

                if ($sudahSetor) {
                    return;
                }

                // Anti-duplikat bila perintah dijalankan ulang pada hari yang sama.
                $sudahDikirim = Notifikasi::where('user_id', $konfigurasi->user_id)
                    ->where('tipe', TipeNotifikasi::PengingatSetor)
                    ->whereDate('created_at', $hariIni->toDateString())
                    ->where('data->konfigurasi_setoran_id', $konfigurasi->id)
                    ->exists();

                if ($sudahDikirim) {
                    return;
                }

                $nominal = number_format((float) $konfigurasi->nominal_per_periode, 0, ',', '.');

                Notifikasi::create([
                    'user_id' => $konfigurasi->user_id,
                    'judul' => 'Pengingat Setor Tabungan Emas',
                    'pesan' => 'Saatnya bayar setoran '
                        . strtolower($konfigurasi->frekuensi_setor->label())
                        . ' Tabungan Emas sebesar Rp '
                        . $nominal
                        . '. Segera lakukan pembayaran hari ini agar emas Anda terus bertambah.',
                    'tipe' => TipeNotifikasi::PengingatSetor,
                    'channel' => ChannelNotifikasi::InApp,
                    'data' => [
                        'konfigurasi_setoran_id' => $konfigurasi->id,
                        'jenis_tabungan_id' => $konfigurasi->jenis_tabungan_id,
                        'frekuensi_setor' => $konfigurasi->frekuensi_setor->value,
                        'nominal_per_periode' => (float) $konfigurasi->nominal_per_periode,
                        'tanggal_jatuh_tempo' => $hariIni->toDateString(),
                    ],
                ]);

                $dikirim++;
            });

        $this->info("Kompel: {$dikirim} pengingat setoran dikirim.");

        return self::SUCCESS;
    }

    /**
     * Apakah hari ini jadwal jatuh tempo setoran?
     * - harian: selalu.
     * - mingguan: hari yang sama dengan tanggal_mulai (mis. mulai Selasa → tiap Selasa).
     * - bulanan: tanggal yang sama; bila bulan ini tak punya tanggal itu,
     *   jatuh tempo di akhir bulan (mis. mulai tanggal 31 → 30/28/29).
     */
    private function jatuhTempo(Carbon $mulai, Carbon $hariIni, string $frekuensi): bool
    {
        return match ($frekuensi) {
            'harian' => true,
            'mingguan' => $hariIni->isoWeekday() === $mulai->isoWeekday(),
            'bulanan' => $hariIni->day === min($mulai->day, $hariIni->daysInMonth),
            default => false,
        };
    }
}