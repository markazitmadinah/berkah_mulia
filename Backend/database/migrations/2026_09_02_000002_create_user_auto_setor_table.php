<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_auto_setor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('jenis_tabungan_id')->constrained('jenis_tabungan')->cascadeOnDelete();
            $table->boolean('aktif')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'jenis_tabungan_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_auto_setor');
    }
};
