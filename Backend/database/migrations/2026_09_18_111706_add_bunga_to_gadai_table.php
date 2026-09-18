<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->decimal('bunga_persen', 5, 2)->default(4.00)->after('nominal_angkuran');
            $table->string('tipe_bunga', 20)->default('menurun')->after('bunga_persen');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->dropColumn(['tipe_bunga', 'bunga_persen']);
        });
    }
};
