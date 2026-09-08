<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jenis_tabungan', function (Blueprint $table) {
            $table->string('sub_jenis')->nullable()->after('tipe');
            $table->date('deadline')->nullable()->after('sub_jenis');
            $table->string('frekuensi_setoran')->nullable()->after('deadline');
        });
    }

    public function down(): void
    {
        Schema::table('jenis_tabungan', function (Blueprint $table) {
            $table->dropColumn(['sub_jenis', 'deadline', 'frekuensi_setoran']);
        });
    }
};