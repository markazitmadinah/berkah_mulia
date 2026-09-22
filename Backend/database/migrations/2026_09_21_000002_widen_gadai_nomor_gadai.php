<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->string('nomor_gadai', 64)->change();
        });
    }

    public function down(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->string('nomor_gadai', 10)->change();
        });
    }
};