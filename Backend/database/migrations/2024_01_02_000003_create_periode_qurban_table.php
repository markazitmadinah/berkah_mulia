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
        Schema::create('periode_qurban', function (Blueprint $table) {
            $table->id();
            $table->integer('tahun'); // Masehi reference year
            $table->date('tanggal_buka_pendaftaran');
            $table->date('tanggal_tutup_pendaftaran'); // default = buka + 1 month
            $table->date('tanggal_idul_adha');
            $table->date('tanggal_pencairan'); // default = idul_adha - 14 days
            $table->string('status')->default('draft'); // enum via PHP: StatusPeriodeQurban
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('tahun');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('periode_qurban');
    }
};
