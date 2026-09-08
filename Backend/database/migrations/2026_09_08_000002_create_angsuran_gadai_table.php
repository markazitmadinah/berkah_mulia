<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('angsuran_gadai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gadai_id')->constrained('gadai')->cascadeOnDelete();
            $table->date('tanggal_bayar');
            $table->decimal('nominal', 15, 2);
            $table->string('metode_pembayaran', 10)->default('cash');
            $table->text('catatan')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('gadai_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('angsuran_gadai');
    }
};