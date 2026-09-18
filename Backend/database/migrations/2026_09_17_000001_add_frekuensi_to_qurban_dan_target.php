<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pendaftaran_qurban', function (Blueprint $table) {
            $table->string('frekuensi_setor')->nullable()->after('tanggal_daftar');
            $table->decimal('nominal_per_periode', 15, 2)->nullable()->after('frekuensi_setor');
        });

        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->string('frekuensi_setor')->nullable()->after('target_nominal');
            $table->decimal('nominal_per_periode', 15, 2)->nullable()->after('frekuensi_setor');
        });
    }

    public function down(): void
    {
        Schema::table('pendaftaran_qurban', function (Blueprint $table) {
            $table->dropColumn(['frekuensi_setor', 'nominal_per_periode']);
        });

        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->dropColumn(['frekuensi_setor', 'nominal_per_periode']);
        });
    }
};