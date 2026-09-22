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
['username' => 'nasabah1'],
            [
                'name' => 'Nasabah Uji',
                'username' => 'nasabah1',
                'nomor_anggota' => '1000000001',
                'email' => 'nasabah1@berkahmulia.local',
                'phone' => '081200000002',
                'password' => 'password123',
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'approved_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['username' => 'nasabah2'],
            [
                'name' => 'Nasabah Uji 2',
                'username' => 'nasabah2',
                'nomor_anggota' => '1000000002',
                'email' => 'nasabah2@berkahmulia.local',
                'phone' => '081200000003',
                'password' => 'password123',
                'role' => UserRole::User,
                'status' => UserStatus::Active,
                'approved_at' => now(),
            ]
        );
    }
}