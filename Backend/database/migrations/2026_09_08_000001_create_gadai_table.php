<?php

use App\Enums\StatusGadai;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gadai', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_gadai', 10)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            // ── Data Emas ──
            $table->string('jenis_emas', 100);
            $table->decimal('berat_gram', 10, 4);
            $table->decimal('kadar', 5, 2)->default(99.90);
            $table->decimal('berat_bersih_gram', 10, 4);
            $table->decimal('harga_acuan', 15, 2);
            $table->decimal('nilai_taksiran', 15, 2);
            $table->decimal('persen_gadai', 5, 2)->default(80.00);
            $table->decimal('besaran_gadai', 15, 2);

            // ── Tenor & Pembayaran ──
            $table->date('tanggal_aju');
            $table->date('tanggal_aktif')->nullable();
            $table->date('tanggal_jatuh_tempo')->nullable();
            $table->string('tenor_satuan', 10)->default('bulan');
            $table->integer('toleransi_hari')->default(0);
            $table->string('frekuensi_bayar', 10)->default('harian');
            $table->decimal('nominal_angkuran', 15, 2)->default(0);

            // ── Saldo & Status ──
            $table->decimal('total_dibayar', 15, 2)->default(0);
            $table->date('tanggal_lunas')->nullable();
            $table->string('status', 20)->default(StatusGadai::Diajukan->value);
            $table->text('catatan')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index('tanggal_jatuh_tempo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gadai');
    }
};