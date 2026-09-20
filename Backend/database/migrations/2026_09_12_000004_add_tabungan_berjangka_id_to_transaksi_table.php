<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('transaksi', 'tabungan_berjangka_id')) {
            Schema::table('transaksi', function (Blueprint $table) {
                $table->foreignId('tabungan_berjangka_id')
                    ->nullable()
                    ->after('pendaftaran_qurban_id')
                    ->constrained('tabungan_berjangka')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropForeign(['tabungan_berjangka_id']);
            $table->dropColumn('tabungan_berjangka_id');
        });
    }
};
