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
        $email = env('ADMIN_EMAIL') ?: 'admin@berkahmulia.com';
        $username = env('ADMIN_USERNAME') ?: 'admin';
        $password = env('ADMIN_PASSWORD');

        // Cari admin yang sudah ada berdasarkan username atau email
        $admin = User::where('username', $username)
            ->orWhere('email', $email)
            ->first();

        $isNew = ! $admin;

        if ($isNew) {
            $admin = new User();
            if (! $password) {
                $password = 'password123';
                $this->command?->warn("Admin baru username='{$username}' dibuat dengan password: {$password}. Atur ADMIN_PASSWORD di .env untuk kustom.");
            }
        }

        $admin->name = env('ADMIN_NAME') ?: 'Admin Berkah Mulia';
        $admin->username = $username;
        $admin->email = $email;
        $admin->phone = env('ADMIN_PHONE') ?: '081200000001';
        if ($password) {
            $admin->password = $password;
        }
        $admin->role = UserRole::Admin;
        $admin->status = UserStatus::Active;
        $admin->email_verified_at = $admin->email_verified_at ?: now();
        $admin->approved_at = $admin->approved_at ?: now();
        $admin->save();
    }
}
