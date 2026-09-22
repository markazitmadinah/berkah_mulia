<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambahkan referensi FK yang sejak awal belum tercatat:
     * - transaksi.konfigurasi_id        → konfigurasi_setoran_emas
     * - angsuran_gadai.diverifikasi_oleh → users
     * - tabungan_berjangka.approved_by/created_by → users
     * Pola nullOnDelete: menghapus induk hanya meng-null-kan kolom, tidak
     * memblokir operasi yang sudah berjalan (rencana/reset batal, admin dihapus).
     */
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->foreign('konfigurasi_id')->references('id')->on('konfigurasi_setoran_emas')->nullOnDelete();
        });

        Schema::table('angsuran_gadai', function (Blueprint $table) {
            $table->foreign('diverifikasi_oleh')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('tabungan_berjangka', function (Blueprint $table) {
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tabungan_berjangka', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropForeign(['approved_by']);
        });

        Schema::table('angsuran_gadai', function (Blueprint $table) {
            $table->dropForeign(['diverifikasi_oleh']);
        });

        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropForeign(['konfigurasi_id']);
        });
    }
};