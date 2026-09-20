<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->unsignedInteger('durasi_periode')->nullable()->after('nominal_per_periode');
            $table->date('tanggal_mulai')->nullable()->after('durasi_periode');
            $table->date('tanggal_deadline')->nullable()->after('tanggal_mulai');
        });
    }

    public function down(): void
    {
        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->dropColumn(['durasi_periode', 'tanggal_mulai', 'tanggal_deadline']);
        });
    }
};