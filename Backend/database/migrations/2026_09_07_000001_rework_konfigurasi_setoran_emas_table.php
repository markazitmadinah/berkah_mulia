<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Model tabungan emas baru:
     * - nominal per periode (setoran) + target gram per periode (bukan porsi emas/selisih).
     * - Hapus field porsi emas/selisih & target_nominal (model lama pakai pembagian tetap).
     */
    public function up(): void
    {
        Schema::table('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->dropColumn(['nominal_porsi_emas', 'nominal_porsi_selisih', 'target_nominal']);
            $table->renameColumn('nominal_setoran_flat', 'nominal_per_periode');
            $table->decimal('target_gram_per_periode', 18, 6)->nullable()->after('nominal_per_periode');
        });
    }

    public function down(): void
    {
        Schema::table('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->renameColumn('nominal_per_periode', 'nominal_setoran_flat');
            $table->dropColumn('target_gram_per_periode');
            $table->decimal('nominal_porsi_emas', 15, 2)->nullable()->after('nominal_setoran_flat');
            $table->decimal('nominal_porsi_selisih', 15, 2)->nullable()->after('nominal_porsi_emas');
            $table->decimal('target_nominal', 15, 2)->nullable()->after('tanggal_deadline');
        });
    }
};