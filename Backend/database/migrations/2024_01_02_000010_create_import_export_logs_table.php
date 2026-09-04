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
        Schema::create('import_export_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users'); // admin who performed the action
            $table->string('tipe'); // enum via PHP: TipeImportExport
            $table->string('target'); // e.g. "users"
            $table->string('file_path')->nullable();
            $table->integer('total_baris')->default(0);
            $table->integer('berhasil')->default(0);
            $table->integer('gagal')->default(0);
            $table->json('error_detail')->nullable(); // list of row errors
            $table->timestamps();

            $table->index(['user_id', 'tipe']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('import_export_logs');
    }
};
