<?php

namespace App\Console\Commands;

use App\Enums\ChannelNotifikasi;
use App\Enums\JenisTransaksi;
use App\Enums\TipeNotifikasi;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Notifikasi;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;

class KirimPengingatSetoran extends Command
{
    protected $signature = 'pengingat:setoran';

    protected $description = 'Kirim pengingat setoran: Tabungan Emas & Tabungan Berjangka, harian/mingguan/bulanan sesuai tanggal_mulai (pukul 10:00 via scheduler)';

    public function handle(): int
    {
        $hariIni = now();
        $dikirim = 0;

        KonfigurasiSetoranEmas::query()->aktif()->lazyById()
            ->each(function (KonfigurasiSetoranEmas $konfigurasi) use ($hariIni, &$dikirim) {
                if ($this->kirimSatu(
                    user: $konfigurasi->user,
                    pemilik: $konfigurasi,
                    label: 'Tabungan Emas',
                    frekuensi: $konfigurasi->frekuensi_setor->value,
                    mulai: Carbon::parse($konfigurasi->tanggal_mulai ?: $konfigurasi->created_at),
                    nominal: (float) $konfigurasi->nominal_per_periode,
                    deadline: $konfigurasi->tanggal_deadline ? Carbon::parse($konfigurasi->tanggal_deadline) : null,
                    kurirDataKonfigurasi: fn (array $data, string $id) => $data + ['konfigurasi_setoran_id' => $id],
                    transaksiId: $konfigurasi->id,
                    transaksiKueri: fn ($q, $id) => $q
                        ->where('jenis_tabungan_id', $konfigurasi->jenis_tabungan_id)
                        ->where('konfigurasi_id', $id),
                    sudahDikirim: fn ($q, $id) => $q->where('data->konfigurasi_setoran_id', $id),
                )) {
                    $dikirim++;
                }
            });

        TabunganBerjangka::where('status', 'aktif')->lazyById()
            ->each(function (TabunganBerjangka $tb) use ($hariIni, &$dikirim) {
                if ($this->kirimSatu(
                    user: $tb->user,
                    pemilik: $tb,
                    label: 'Tabungan Berjangka',
                    frekuensi: $tb->frekuensi_setor,
                    mulai: Carbon::parse($tb->tanggal_mulai ?: $tb->created_at),
                    nominal: (float) $tb->nominal_per_periode,
                    deadline: $tb->tanggal_jatuh_tempo ? Carbon::parse($tb->tanggal_jatuh_tempo) : null,
                    kurirDataKonfigurasi: fn (array $data, string $id) => $data + ['tabungan_berjangka_id' => $id],
                    transaksiId: $tb->id,
                    transaksiKueri: fn ($q, $id) => $q->where('tabungan_berjangka_id', $id),
                    sudahDikirim: fn ($q, $id) => $q->where('data->tabungan_berjangka_id', $id),
                )) {
                    $dikirim++;
                }
            });

        $this->info("Kompel: {$dikirim} pengingat setoran dikirim.");

        return self::SUCCESS;
    }

    /**
     * Cek jadwal & kirim satu pengingat. true bila pengingat dikirim.
     */
    private function kirimSatu(
        User $user,
        Model $pemilik,
        string $label,
        string $frekuensi,
        Carbon $mulai,
        float $nominal,
        ?Carbon $deadline,
        \Closure $transaksiKueri,
        string $transaksiId,
        \Closure $sudahDikirim,
        \Closure $kurirDataKonfigurasi,
    ): bool {
        $hariIni = now();

        if (! $this->jatuhTempo($mulai, $hariIni, $frekuensi)) {
            return false;
        }

        // Rencana yang deadline-nya sudah lewat tidak usah diingatkan.
        if ($deadline && $hariIni->gt($deadline->copy()->endOfDay())) {
            return false;
        }

        // Sudah ada setoran hari ini untuk rencana ini → bukan lagi pengingat.
        $sudahSetor = Transaksi::milikUser($user->id)
            ->where('jenis_transaksi', JenisTransaksi::Setor)
            ->whereDate('tanggal_transaksi', $hariIni->toDateString())
            ->when($pemilik instanceof KonfigurasiSetoranEmas, fn ($q) => $q->where('jenis_tabungan_id', $pemilik->jenis_tabungan_id))
            ->tap(fn ($q) => $transaksiKueri($q, $transaksiId))
            ->exists();

        if ($sudahSetor) {
            return false;
        }

        // Anti-duplikat bila perintah dijalankan ulang pada hari yang sama.
        $sudahDikirimNotif = Notifikasi::where('user_id', $user->id)
            ->where('tipe', TipeNotifikasi::PengingatSetor)
            ->whereDate('created_at', $hariIni->toDateString())
            ->tap(fn ($q) => $sudahDikirim($q, $transaksiId))
            ->exists();

        if ($sudahDikirimNotif) {
            return false;
        }

        Notifikasi::create([
            'user_id' => $user->id,
            'judul' => 'Pengingat Setor ' . $label,
            'pesan' => 'Saatnya bayar setoran '
                . strtolower($this->labelFrekuensi($frekuensi))
                . ' ' . $label . ' sebesar Rp '
                . number_format($nominal, 0, ',', '.')
                . '. Segera lakukan pembayaran hari ini agar tabungan Anda terus bertumbuh.',
            'tipe' => TipeNotifikasi::PengingatSetor,
            'channel' => ChannelNotifikasi::InApp,
            'data' => $kurirDataKonfigurasi([
                'jenis_tabungan_id' => data_get($pemilik, 'jenis_tabungan_id'),
                'frekuensi_setor' => $frekuensi,
                'nominal_per_periode' => $nominal,
                'tanggal_jatuh_tempo' => $hariIni->toDateString(),
            ], $transaksiId),
        ]);

        return true;
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

    private function labelFrekuensi(string $frekuensi): string
    {
        return match ($frekuensi) {
            'harian' => 'harian',
            'mingguan' => 'mingguan',
            default => 'bulanan',
        };
    }
}