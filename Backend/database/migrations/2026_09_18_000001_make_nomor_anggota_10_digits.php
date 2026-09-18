<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ubah nomor_anggota menjadi 10 digit angka.
     * Data lama (16 digit) dikonversi dengan mengambil 10 digit terakhir.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nomor_anggota']);
        });

        $terpakai = [];

        DB::table('users')->whereNotNull('nomor_anggota')->orderBy('id')->chunkById(500, function ($rows) use (&$terpakai) {
            foreach ($rows as $row) {
                $digits = preg_replace('/\D/', '', (string) $row->nomor_anggota);
                $sepuluh = str_pad(substr($digits, -10), 10, '0', STR_PAD_LEFT);

                // ponytail: jika 10 digit terakhir bentrok (nomor lama berbagi sufiks),
                // kosongkan agar admin isi ulang, daripada gagal unique constraint.
                $nilai = isset($terpakai[$sepuluh]) ? null : $sepuluh;
                if ($nilai !== null) {
                    $terpakai[$nilai] = true;
                }

                DB::table('users')->where('id', $row->id)->update(['nomor_anggota' => $nilai]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('nomor_anggota', 10)->nullable()->change();
            $table->unique('nomor_anggota');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['nomor_anggota']);
            $table->string('nomor_anggota', 16)->nullable()->change();
        });

        DB::table('users')->whereNotNull('nomor_anggota')->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $row) {
                $digits = preg_replace('/\D/', '', (string) $row->nomor_anggota);
                DB::table('users')->where('id', $row->id)->update([
                    'nomor_anggota' => str_pad($digits, 16, '0', STR_PAD_LEFT),
                ]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('nomor_anggota');
        });
    }
};
