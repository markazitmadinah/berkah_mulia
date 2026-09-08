<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->decimal('nominal_emas', 15, 2)->nullable()->after('nominal');
            $table->decimal('nominal_selisih', 15, 2)->nullable()->after('nominal_emas');
        });
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropColumn(['nominal_emas', 'nominal_selisih']);
        });
    }
};