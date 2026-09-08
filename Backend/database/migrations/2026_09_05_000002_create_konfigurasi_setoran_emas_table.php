<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('konfigurasi_setoran_emas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('jenis_tabungan_id')->constrained('jenis_tabungan')->restrictOnDelete();
            $table->decimal('nominal_setoran_flat', 15, 2);
            $table->decimal('nominal_porsi_emas', 15, 2);
            $table->decimal('nominal_porsi_selisih', 15, 2);
            $table->string('frekuensi_setor')->default('harian');
            $table->date('tanggal_mulai')->nullable();
            $table->integer('durasi_periode')->nullable();
            $table->date('tanggal_deadline')->nullable();
            $table->decimal('target_nominal', 15, 2)->nullable();
            $table->string('status')->default('aktif');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            // ponytail: satu-aktif-per-user dijaga di service (MySQL tak punya partial unique index)
            $table->index(['user_id', 'jenis_tabungan_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('konfigurasi_setoran_emas');
    }
};