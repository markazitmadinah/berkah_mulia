<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tabungan_berjangka', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('jenis_tabungan_id')->constrained('jenis_tabungan')->cascadeOnDelete();
            $table->decimal('target_nominal', 15, 2);
            $table->integer('durasi_bulan');
            $table->string('frekuensi_setor', 20)->default('bulanan');
            $table->decimal('nominal_per_periode', 15, 2);
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_jatuh_tempo')->nullable();
            $table->string('status', 30)->default('menunggu_approval');
            // menunggu_approval | aktif | selesai | batal
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('catatan')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tabungan_berjangka');
    }
};
