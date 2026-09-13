<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('status', 'pending')
            ->update(['status' => 'active']);
    }

    public function down(): void
    {
        // status 'pending' sudah dihapus dari aplikasi; tidak ada rollback data aman.
    }
};