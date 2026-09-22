<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
$username = env('ADMIN_USERNAME') ?: 'admin';
        $password = env('ADMIN_PASSWORD');
        $isNew = ! User::withTrashed()->where('username', $username)->exists();

        if ($isNew && ! $password) {
            $password = Str::password(14);
            $this->command?->warn("Admin baru '{$username}' dibuat dengan password acak (lihat log / atur ADMIN_PASSWORD untuk kustom).");
        }

        $admin = User::updateOrCreate(
            ['username' => $username],
            // password null → password lama dipertahankan
            array_filter([
                'name' => env('ADMIN_NAME') ?: 'Admin Berkah Mulia',
                'username' => $username,
                'phone' => env('ADMIN_PHONE') ?: '081200000001',
                'password' => $password, // auto-hashed via cast; null → password lama dipertahankan
            ])
        );

        // role & status bukan mass-assignable (lihat $fillable User) — tetapkan langsung.
        $admin->role = UserRole::Admin;
        $admin->status = UserStatus::Active;
        $admin->approved_at = now();
        $admin->save();
    }
}