<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'nasabah@berkahmulia.com'],
            [
                'name' => 'Nasabah Uji',
                'email' => 'nasabah@berkahmulia.com',
                'phone' => '081200000002',
                'password' => 'password123',
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'nasabah2@berkahmulia.com'],
            [
                'name' => 'Nasabah Uji 2',
                'email' => 'nasabah2@berkahmulia.com',
                'phone' => '081200000003',
                'password' => 'password123',
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );
    }
}