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
        Schema::create('harga_emas_harian', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal');
            $table->decimal('harga_per_gram', 15, 2);
            $table->decimal('tagihan_harian_default', 15, 2)->nullable();
            $table->boolean('status_aktif')->default(true); // only 1 active per tanggal
            $table->text('catatan')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            // Append-only / versioned: "update" = insert new row + deactivate old
            $table->index(['tanggal', 'status_aktif']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('harga_emas_harian');
    }
};
