<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Nominal adalah nilai uang — decimal, bukan unsignedBigInteger.
        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->decimal('target_nominal', 15, 2)->default(0)->change();
        });

        // Satu periode per tahun (tahun tidak boleh dobel).
        Schema::table('periode_qurban', function (Blueprint $table) {
            $table->unique('tahun');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('periode_qurban', function (Blueprint $table) {
            $table->dropUnique('periode_qurban_tahun_unique');
        });

        Schema::table('user_tabungan_target', function (Blueprint $table) {
            $table->unsignedBigInteger('target_nominal')->default(0)->change();
        });
    }
};
