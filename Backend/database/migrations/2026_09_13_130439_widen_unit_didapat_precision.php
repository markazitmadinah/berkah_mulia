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
        // Gram emas dihitung hingga 6 desimal (lihat konfigurasi_setoran_emas yang
        // memakai DECIMAL(...,6)); kolom ini hanya 4 desimal → terjadi drift 0.0000x
        // per setoran. Lebarkan agar kalkulasi tersimpan utuh.
        Schema::table('transaksi', function (Blueprint $table) {
            $table->decimal('unit_didapat', 18, 8)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transaksi', function (Blueprint $table) {
            $table->decimal('unit_didapat', 15, 4)->nullable()->change();
        });
    }
};
