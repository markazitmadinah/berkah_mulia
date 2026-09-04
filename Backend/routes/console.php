<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes / Scheduler — Per BAGIAN J
|--------------------------------------------------------------------------
*/

// Scheduled: Check & auto-close qurban registration periods
Schedule::call(function () {
    $today = now()->toDateString();

    // Auto-close registration when past tanggal_tutup_pendaftaran
    \App\Models\PeriodeQurban::where('status', 'aktif')
        ->where('tanggal_tutup_pendaftaran', '<', $today)
        ->update(['status' => 'ditutup']);

    // Auto set pendaftaran to siap_dicairkan near tanggal_pencairan
    $periodes = \App\Models\PeriodeQurban::where('status', 'ditutup')
        ->where('tanggal_pencairan', '<=', $today)
        ->get();

    foreach ($periodes as $periode) {
        \App\Models\PendaftaranQurban::where('periode_qurban_id', $periode->id)
            ->whereIn('status', ['menabung', 'target_tercapai'])
            ->update(['status' => 'siap_dicairkan']);
    }
})->daily()->name('check-qurban-periode-status')
    ->description('Auto close qurban registration & set ready for disbursement');

// Scheduled: Pull today's Antam gold price from Logam Mulia (auto every 12:00 noon)
Schedule::command('hargaemas:sync')->dailyAt('12:00')
    ->name('sync-harga-emas-logam-mulia')
    ->description('Auto update harga emas harian dari web resmi Logam Mulia setiap jam 12 siang');

// Scheduled: Bersihkan notifikasi yang sudah berumur lebih dari 1 bulan (riwayat dari pusat notifikasi)
Schedule::call(function () {
    \App\Models\Notifikasi::where('created_at', '<', now()->subMonth())->delete();
})->daily()->name('bersihkan-notifikasi-lama')
    ->description('Hapus otomatis notifikasi yang berusia lebih dari 1 bulan');

// Scheduled: Auto-catat setoran berkala (periodic auto deposit) — creates pending setor
Schedule::call(function () {    $today = now()->startOfDay();
    $dayOfWeek = $today->dayOfWeek;              // 0=Sun ... 6=Sat
    $dayOfMonth = $today->day;                    // 1..31

    $dibuat = 0;

    \App\Models\UserAutoSetor::with('jenisTabungan')
        ->where('aktif', true)
        ->whereHas('jenisTabungan', fn ($q) => $q->where('status_aktif', true)->where('tipe', 'custom'))
        ->get()
        ->each(function ($auto) use ($today, $dayOfWeek, $dayOfMonth, &$dibuat) {
            $cfg = $auto->jenisTabungan->config ?? [];
            $periode = $cfg['setoran_berkala_periode'] ?? null;
            $nominal = (float) ($cfg['setoran_berkala_nominal'] ?? 0);

            if (! $periode || $nominal <= 0) {
                return;
            }

            // Tentukan apakah hari ini adalah jadwal setoran
            $due = match ($periode) {
                'harian' => true,
                'mingguan' => $dayOfWeek === 1, // Senin
                'bulanan' => $dayOfMonth === 1, // tanggal 1
                default => false,
            };

            if (! $due) {
                return;
            }

            // Dedup: sudah ada setor (pending/verified) untuk user+jenis pada periode ini
            $sudahAda = \App\Models\Transaksi::where('user_id', $auto->user_id)
                ->where('jenis_tabungan_id', $auto->jenis_tabungan_id)
                ->where('jenis_transaksi', 'setor')
                ->where('tanggal_transaksi', $today->toDateString())
                ->whereIn('status_verifikasi', ['menunggu_verifikasi', 'terverifikasi'])
                ->exists();

            if ($sudahAda) {
                return;
            }

            app(\App\Services\TransaksiService::class)->buatTransaksi([
                'user_id' => $auto->user_id,
                'jenis_tabungan_id' => $auto->jenis_tabungan_id,
                'jenis_transaksi' => \App\Enums\JenisTransaksi::Setor,
                'nominal' => $nominal,
                'status_verifikasi' => \App\Enums\StatusVerifikasi::MenungguVerifikasi,
                'tanggal_transaksi' => $today->toDateString(),
                'metode_pembayaran' => \App\Enums\MetodePembayaran::Transfer,
                'catatan_user' => 'Setoran berkala otomatis',
            ]);

            $dibuat++;
        });
})->daily()->name('auto-catat-setoran-berkala')
    ->description('Auto-catat setoran berkala per periode utk user dengan auto-setor aktif');
