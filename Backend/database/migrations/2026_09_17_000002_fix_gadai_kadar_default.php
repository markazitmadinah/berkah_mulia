<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->decimal('kadar', 5, 2)->default(999.00)->change();
        });

        DB::table('gadai')->where('kadar', 99.90)->update(['kadar' => 999.00]);
    }

    public function down(): void
    {
        Schema::table('gadai', function (Blueprint $table) {
            $table->decimal('kadar', 5, 2)->default(99.90)->change();
        });
    }
};