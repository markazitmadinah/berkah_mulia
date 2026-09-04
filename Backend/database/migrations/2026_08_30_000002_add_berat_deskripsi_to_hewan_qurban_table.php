<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hewan_qurban', function (Blueprint $table) {
            $table->string('berat_rata_rata', 100)->nullable()->after('harga_per_unit');
            $table->text('deskripsi')->nullable()->after('berat_rata_rata');
        });
    }

    public function down(): void
    {
        Schema::table('hewan_qurban', function (Blueprint $table) {
            $table->dropColumn(['berat_rata_rata', 'deskripsi']);
        });
    }
};