<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Multi-rencana emas:
     * - transaksi: atribusi setoran ke rencana (konfigurasi_id, nullable utk data lama).
     * - konfigurasi: target gram total rencana ini sendiri (per-rencana, terpisah dari goal global).
     */
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->unsignedBigInteger('konfigurasi_id')->nullable()->after('pendaftaran_qurban_id');
            $table->index('konfigurasi_id');
        });

        Schema::table('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->decimal('target_gram_total', 18, 6)->nullable()->after('target_gram_per_periode');
        });
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropIndex(['konfigurasi_id']);
            $table->dropColumn('konfigurasi_id');
        });

        Schema::table('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->dropColumn('target_gram_total');
        });
    }
};