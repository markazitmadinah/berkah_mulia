<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
        });

        // Generate username untuk user yang sudah ada
        // Format: slug dari nama + 4 digit random
        DB::table('users')->orderBy('id')->each(function ($user) {
            $base = Str::slug(explode(' ', trim($user->name))[0], '');
            $base = preg_replace('/[^a-z0-9]/', '', strtolower($base));
            if (strlen($base) < 3) $base = 'user';

            do {
                $candidate = $base . rand(1000, 9999);
            } while (DB::table('users')->where('username', $candidate)->exists());

            DB::table('users')->where('id', $user->id)->update(['username' => $candidate]);
        });

        // Setelah generate, jadikan NOT NULL
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('username');
        });
    }
};
