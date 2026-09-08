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
        Schema::create('jenis_tabungan', function (Blueprint $table) {
            $table->id();
            $table->string('kode')->unique(); // slug identifier
            $table->string('nama');
            $table->text('deskripsi')->nullable();
            $table->string('tipe'); // enum via PHP: TipeTabungan (emas/pribadi/qurban)
            $table->string('mode_perhitungan'); // enum via PHP: ModePerhitungan
            $table->decimal('target_nominal', 15, 2)->nullable();
            $table->decimal('target_unit', 15, 4)->nullable(); // gram, ekor, etc.
            $table->string('unit_label')->nullable(); // "gram", "ekor", etc.
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->boolean('tanpa_batas_waktu')->default(true);
            $table->string('aturan_pencairan'); // enum via PHP: AturanPencairan
            $table->date('tanggal_pencairan')->nullable();
            $table->json('metode_pembayaran_diizinkan'); // ["cash","transfer"]
            $table->boolean('allow_withdrawal')->default(false);
            $table->boolean('status_aktif')->default(true);
            $table->json('config')->nullable(); // field fleksibel tambahan
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('updated_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index('tipe');
            $table->index('status_aktif');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('jenis_tabungan');
    }
};
