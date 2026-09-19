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
        $password = env('ADMIN_PASSWORD');
        $isNew = ! User::where('email', $email)->exists();

        if ($isNew && ! $password) {
            $password = Str::password(14);
            $this->command?->warn("Admin baru '{$email}' dibuat dengan password acak (lihat log / atur ADMIN_PASSWORD untuk kustom).");
        }

        $admin = User::updateOrCreate(
            ['email' => $email],
            array_filter([
                'name' => env('ADMIN_NAME') ?: 'Admin Berkah Mulia',
                'username' => env('ADMIN_USERNAME') ?: 'admin',
                'email' => $email,
                'phone' => env('ADMIN_PHONE') ?: '081200000001',
                'password' => $password, // auto-hashed via cast; null → password lama dipertahankan
            ])
        );

        // role & status bukan mass-assignable (lihat $fillable User) — tetapkan langsung.
        $admin->role = UserRole::Admin;
        $admin->status = UserStatus::Active;
        $admin->email_verified_at = now();
        $admin->approved_at = now();
        $admin->save();
    }
}
