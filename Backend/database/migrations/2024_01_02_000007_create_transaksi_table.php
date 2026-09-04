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
        Schema::create('transaksi', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_referensi')->unique(); // TRX-YYYYMMDD-XXXXXX (random)
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('jenis_tabungan_id')->constrained('jenis_tabungan');
            $table->foreignId('pendaftaran_qurban_id')->nullable()->constrained('pendaftaran_qurban')->nullOnDelete();
            $table->string('jenis_transaksi')->default('setor'); // enum via PHP: JenisTransaksi
            $table->decimal('nominal', 15, 2);
            $table->decimal('unit_didapat', 15, 4)->nullable(); // e.g. grams of gold
            $table->foreignId('harga_acuan_id')->nullable()->constrained('harga_emas_harian')->nullOnDelete();
            $table->decimal('harga_acuan_snapshot', 15, 2)->nullable(); // redundant price snapshot
            $table->string('metode_pembayaran'); // enum via PHP: MetodePembayaran
            $table->foreignId('rekening_bank_id')->nullable()->constrained('rekening_bank')->nullOnDelete();
            $table->string('bukti_transfer_path')->nullable();
            $table->string('status_verifikasi')->default('menunggu_verifikasi'); // enum via PHP: StatusVerifikasi
            $table->foreignId('diverifikasi_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('diverifikasi_pada')->nullable();
            $table->text('catatan_admin')->nullable();
            $table->text('catatan_user')->nullable();
            $table->date('tanggal_transaksi');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'jenis_tabungan_id']);
            $table->index('status_verifikasi');
            $table->index('tanggal_transaksi');
            $table->index('metode_pembayaran');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaksi');
    }
};
