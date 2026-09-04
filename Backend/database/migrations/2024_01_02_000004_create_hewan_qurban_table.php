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
        Schema::create('hewan_qurban', function (Blueprint $table) {
            $table->id();
            $table->string('jenis_hewan'); // "Kambing", "Sapi", "Patungan Sapi 1/7", etc.
            $table->decimal('harga_per_unit', 15, 2);
            $table->foreignId('periode_qurban_id')->constrained('periode_qurban')->cascadeOnDelete();
            $table->boolean('status_aktif')->default(true);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('periode_qurban_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hewan_qurban');
    }
};
