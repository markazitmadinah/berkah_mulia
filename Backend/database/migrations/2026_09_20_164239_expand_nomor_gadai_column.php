<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Expand nomor_gadai from 10 to 30 chars to accommodate longer reference numbers
     * like "GDS-260110-1001" (15 chars) from the import template.
     */
    public function up(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            // Expand from 10 to 30 chars; unique constraint already exists, no need to re-add.
            $table->string('nomor_gadai', 30)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->string('nomor_gadai', 10)->change();
        });
    }
};
