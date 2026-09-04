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
        Schema::create('pendaftaran_qurban', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('periode_qurban_id')->constrained('periode_qurban');
            $table->foreignId('hewan_qurban_id')->constrained('hewan_qurban');
            $table->integer('jumlah_hewan');
            $table->decimal('target_dana', 15, 2); // snapshot = harga_per_unit × jumlah_hewan
            $table->decimal('total_terkumpul', 15, 2)->default(0); // denormalized cache
            $table->string('status')->default('menabung'); // enum via PHP: StatusPendaftaranQurban
            $table->date('tanggal_daftar');
            $table->date('tanggal_dicairkan')->nullable();
            $table->foreignId('dicairkan_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->text('catatan')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'periode_qurban_id']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pendaftaran_qurban');
    }
};
