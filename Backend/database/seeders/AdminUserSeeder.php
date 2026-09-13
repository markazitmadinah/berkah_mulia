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
        $admin = User::updateOrCreate(
            ['email' => 'admin@berkahmulia.com'],
            [
                'name' => 'Admin Berkah Mulia',
                'email' => 'admin@berkahmulia.com',
                'phone' => '081200000001',
                'password' => 'password123', // auto-hashed via cast
            ]
        );

        // role & status bukan mass-assignable (lihat $fillable User) — tetapkan langsung.
        $admin->role = UserRole::Admin;
        $admin->status = UserStatus::Active;
        $admin->email_verified_at = now();
        $admin->approved_at = now();
        $admin->save();
    }
}
