<?php

namespace App\Console\Commands;

use App\Enums\ChannelNotifikasi;
use App\Enums\StatusGadai;
use App\Enums\TipeNotifikasi;
use App\Models\Gadai;
use App\Models\Notifikasi;
use Carbon\Carbon;
use Illuminate\Console\Command;

class KirimPengingatGadai extends Command
{
    protected $signature = 'pengingat:gadai';

    protected $description = 'Kirim pengingat gadai: H-1 jatuh tempo dan di hari jatuh tempo';

    public function handle(): int
    {
        $hariIni = now()->startOfDay();
        $besok = $hariIni->copy()->addDay();
        $dikirim = 0;

        Gadai::whereIn('status', [
            StatusGadai::Aktif,
            StatusGadai::Diperpanjang,
            StatusGadai::JatuhTempo,
            StatusGadai::Terlambat,
        ])->lazyById()->each(function (Gadai $gadai) use ($hariIni, $besok, &$dikirim) {
            $jatuhTempo = Carbon::parse($gadai->tanggal_jatuh_tempo)->startOfDay();

            $pesan = null;
            if ($jatuhTempo->equalTo($besok)) {
                $pesan = 'Gadai ' . $gadai->nomor_gadai . ' Anda akan jatuh tempo besok '
                    . $gadai->tanggal_jatuh_tempo->translatedFormat('d M Y')
                    . '. Segera bayar angsuran atau perpanjang agar emas Anda aman.';
            } elseif ($jatuhTempo->equalTo($hariIni)) {
                $pesan = 'Gadai ' . $gadai->nomor_gadai . ' Anda sudah jatuh tempo hari ini. '
                    . 'Segera lunasi atau hubungi admin untuk perpanjangan.';
            }

            if (! $pesan) {
                return;
            }

            $sudahDikirim = Notifikasi::where('user_id', $gadai->user_id)
                ->where('tipe', TipeNotifikasi::PengingatSetor)
                ->whereDate('created_at', $hariIni->toDateString())
                ->where('data->gadai_id', $gadai->id)
                ->exists();

            if ($sudahDikirim) {
                return;
            }

            Notifikasi::create([
                'user_id' => $gadai->user_id,
                'judul' => 'Pengingat Jatuh Tempo Gadai',
                'pesan' => $pesan,
                'tipe' => TipeNotifikasi::PengingatSetor,
                'channel' => ChannelNotifikasi::InApp,
                'data' => ['gadai_id' => $gadai->id, 'tanggal_jatuh_tempo' => $gadai->tanggal_jatuh_tempo->toDateString()],
            ]);

            $dikirim++;
        });

        $this->info("Kompel: {$dikirim} pengingat gadai dikirim.");

        return self::SUCCESS;
    }
}