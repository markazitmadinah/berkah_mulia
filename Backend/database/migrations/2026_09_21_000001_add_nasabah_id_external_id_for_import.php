<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Identitas nasabah dari import (nasabah_id) & kunci rencana per produk
     * (external_id / rencana_id). Semua nullable + unique agar import bersifat
     * idempoten: re-import tidak menduplikasi user ataupun rencana.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nasabah_id', 50)->nullable()->unique()->after('nomor_anggota');
        });

        Schema::table('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->string('external_id', 64)->nullable()->unique()->after('id');
        });

        Schema::table('pendaftaran_qurban', function (Blueprint $table) {
            $table->string('external_id', 64)->nullable()->unique()->after('id');
        });

        Schema::table('tabungan_berjangka', function (Blueprint $table) {
            $table->string('external_id', 64)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nasabah_id']);
            $table->dropColumn('nasabah_id');
        });

        foreach (['konfigurasi_setoran_emas', 'pendaftaran_qurban', 'tabungan_berjangka'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->dropUnique(['external_id']);
                $table->dropColumn('external_id');
            });
        }
    }
};