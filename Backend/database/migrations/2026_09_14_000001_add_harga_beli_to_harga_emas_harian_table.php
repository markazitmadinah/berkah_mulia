<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Harga beli (buyback) resmi per gram dari Logam Mulia,
     * agar harga jual kembali di aplikasi memakai data asli, bukan spread tetap.
     */
    public function up(): void
    {
        Schema::table('harga_emas_harian', function (Blueprint $table) {
            $table->decimal('harga_beli', 15, 2)->nullable()->after('harga_per_gram');
        });
    }

    public function down(): void
    {
        Schema::table('harga_emas_harian', function (Blueprint $table) {
            $table->dropColumn('harga_beli');
        });
    }
};