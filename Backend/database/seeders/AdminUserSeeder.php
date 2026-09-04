<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@berkahmulia.com'],
            [
                'name' => 'Admin Berkah Mulia',
                'email' => 'admin@berkahmulia.com',
                'phone' => '081200000001',
                'password' => 'password123', // auto-hashed via cast
                'role' => UserRole::Admin,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );
    }
}
