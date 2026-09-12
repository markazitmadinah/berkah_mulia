<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('angsuran_gadai', function (Blueprint $table) {
            $table->string('status_verifikasi', 30)->default('terverifikasi')->after('catatan');
            $table->string('bukti_transfer_path')->nullable()->after('status_verifikasi');
            $table->text('catatan_admin')->nullable()->after('bukti_transfer_path');
            $table->unsignedBigInteger('diverifikasi_oleh')->nullable()->after('catatan_admin');
            $table->timestamp('diverifikasi_pada')->nullable()->after('diverifikasi_oleh');
        });
    }

    public function down(): void
    {
        Schema::table('angsuran_gadai', function (Blueprint $table) {
            $table->dropColumn([
                'status_verifikasi',
                'bukti_transfer_path',
                'catatan_admin',
                'diverifikasi_oleh',
                'diverifikasi_pada',
            ]);
        });
    }
};
