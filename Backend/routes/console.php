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

// Scheduled: Pengingat setoran — Tabungan Emas & Tabungan Berjangka, harian di 10:00, mingguan & bulanan sesuai tanggal_mulai
Schedule::command('pengingat:setoran')->dailyAt('10:00')
    ->withoutOverlapping()
    ->name('kirim-pengingat-setoran')
    ->description('Kirim notifikasi pengingat bayar setoran (harian/mingguan/bulanan) setiap jam 10 pagi');

// Scheduled: Cek jatuh tempo gadai — AKTIF/DIPERPANJANG lewat jatuh tempo menjadi JATUH_TEMPO,
// JATUH_TEMPO melewati tenggat + toleransi menjadi TERLAMBAT (setiap pagi pukul 08:00)
Schedule::command('gadai:cek-jatuh-tempo')->dailyAt('08:00')
    ->withoutOverlapping()
    ->name('cek-jatuh-tempo-gadai')
    ->description('Auto update status gadai saat jatuh tempo terlewati');

// Scheduled: Pengingat gadai — H-1 jatuh tempo & hari H (setiap pagi pukul 08:30)
Schedule::command('pengingat:gadai')->dailyAt('08:30')
    ->withoutOverlapping()
    ->name('kirim-pengingat-gadai')
    ->description('Kirim notifikasi pengingat jatuh tempo gadai (H-1 dan di hari jatuh tempo)');
