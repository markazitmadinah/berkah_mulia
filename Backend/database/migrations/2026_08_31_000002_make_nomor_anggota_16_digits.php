<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ubah nomor_anggota menjadi 16 digit angka (format lama YYYY-XXXX
     * dikonversi dengan padding kiri, mis. 2026-0004 → 0000000020260004).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nomor_anggota']);
            $table->string('nomor_anggota', 16)->nullable()->change();
        });

        DB::table('users')->whereNotNull('nomor_anggota')->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $row) {
                $digits = preg_replace('/\D/', '', (string) $row->nomor_anggota);
                $padded = str_pad($digits, 16, '0', STR_PAD_LEFT);
                DB::table('users')->where('id', $row->id)->update(['nomor_anggota' => $padded]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('nomor_anggota');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nomor_anggota']);
            $table->string('nomor_anggota', 9)->nullable()->change();
            $table->unique('nomor_anggota');
        });
    }
};