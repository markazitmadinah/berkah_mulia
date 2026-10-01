<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kas koperasi satu buku: selain transaksi nasabah, admin boleh mencatat
     * kas operasional (belanja/biaya/masuk) yang tidak terikat rekening nasabah.
     * user_id & jenis_tabungan_id di-null-kan + penanda kategori='operasional'.
     */
    public function up(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['jenis_tabungan_id']);
        });

        Schema::table('transaksi', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->unsignedBigInteger('jenis_tabungan_id')->nullable()->change();
            $table->string('kategori')->default('nasabah')->index()->after('nomor_referensi');
        });

        Schema::table('transaksi', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('jenis_tabungan_id')->references('id')->on('jenis_tabungan')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['jenis_tabungan_id']);
        });

        Schema::table('transaksi', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
            $table->unsignedBigInteger('jenis_tabungan_id')->nullable(false)->change();
            $table->dropColumn('kategori');
        });

        Schema::table('transaksi', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('jenis_tabungan_id')->references('id')->on('jenis_tabungan');
        });
    }
};