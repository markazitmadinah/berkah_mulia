<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            // Make jenis_tabungan_id nullable for gadai-type transactions
            $table->unsignedBigInteger('jenis_tabungan_id')->nullable()->change();

            // Add gadai_id to link gadai transactions (skip if already exists)
            if (!Schema::hasColumn('transaksi', 'gadai_id')) {
                $table->foreignId('gadai_id')->nullable()->after('pendaftaran_qurban_id')
                    ->constrained('gadai')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gadai_id');
            $table->unsignedBigInteger('jenis_tabungan_id')->nullable(false)->change();
        });
    }
};
