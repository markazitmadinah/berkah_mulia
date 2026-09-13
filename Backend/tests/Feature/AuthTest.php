<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\ApiTestCase;

class AuthTest extends ApiTestCase
{
    public function test_registrasi_self_service_tidak_tersedia(): void
    {
        $this->seedBase();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'phone' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(404);
    }

    public function test_login_akun_rejected_tidak_membocorkan_status(): void
    {
        $this->seedBase();
        $this->createUser([
            'email' => 'reject@example.com',
            'status' => UserStatus::Rejected,
            'rejected_reason' => 'Dokumen tidak lengkap',
            'password' => 'password123',
        ]);

        $this->postJson('/api/v1/auth/login', ['email' => 'reject@example.com', 'password' => 'password123'])
            ->assertStatus(401)->assertJsonPath('error_code', 'INVALID_CREDENTIALS');
    }

    public function test_login_akun_suspended_tidak_membocorkan_status(): void
    {
        $this->seedBase();
        $this->createUser(['email' => 'susp@example.com', 'status' => UserStatus::Suspended, 'password' => 'password123']);

        $this->postJson('/api/v1/auth/login', ['email' => 'susp@example.com', 'password' => 'password123'])
            ->assertStatus(401)->assertJsonPath('error_code', 'INVALID_CREDENTIALS');
    }

    public function test_login_akun_aktif_berhasil_dan_mengembalikan_token(): void
    {
        $this->seedBase();
        $this->createUser(['email' => 'aktif@example.com', 'password' => 'password123']);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'aktif@example.com', 'password' => 'password123']);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['user', 'token']])
            ->assertJsonPath('data.user.status', 'active');
    }

    public function test_login_password_salah_401(): void
    {
        $this->seedBase();
        $this->createUser(['email' => 'aktif@example.com', 'password' => 'password123']);

        $this->postJson('/api/v1/auth/login', ['email' => 'aktif@example.com', 'password' => 'salah123'])
            ->assertStatus(401)->assertJsonPath('error_code', 'INVALID_CREDENTIALS');
    }

    public function test_auth_endpoint_membutuhkan_token(): void
    {
        $this->seedBase();

        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_me_mengembalikan_profil_user(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser(['email' => 'me@example.com']);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'me@example.com');
    }

    public function test_update_profile_hanya_field_tertentu(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();

        $this->putJson('/api/v1/auth/me', ['name' => 'Nama Baru', 'address' => 'Jakarta'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Nama Baru');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Nama Baru', 'address' => 'Jakarta']);
    }

    public function test_change_password_merotasi_token(): void
    {
        $this->seedBase();
        $user = $this->createUser(['password' => 'password123']);
        $this->actingAs($user);

        $oldToken = $user->createToken('auth-token')->plainTextToken;
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $response = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'password123',
            'password' => 'newpass456',
            'password_confirmation' => 'newpass456',
        ]);

        $response->assertOk()->assertJsonStructure(['data' => ['token']]);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_change_password_current_password_salah_ditolak(): void
    {
        $this->seedBase();
        $user = $this->createUser(['password' => 'password123']);
        $this->actingAs($user);

        $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'salah',
            'password' => 'newpass456',
            'password_confirmation' => 'newpass456',
        ])->assertStatus(422);
    }

    public function test_logout_menghapus_token(): void
    {
        $this->seedBase();
        $user = $this->createUser();
        $token = $user->createToken('auth-token')->plainTextToken;
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_pengguna_suspended_diblokir_di_endpoint_authenticated(): void
    {
        $this->seedBase();
        $this->actingAsUser(['status' => UserStatus::Suspended]);

        $this->getJson('/api/v1/auth/me')->assertStatus(403)->assertJsonPath('error_code', 'ACCOUNT_SUSPENDED');
    }

    public function test_pemilik_dapat_melihat_foto_profil_sendiri(): void
    {
        $this->seedBase();
        Storage::fake('public');
        $owner = $this->actingAsUser();
        Storage::disk('public')->put('avatars/uji.jpg', 'dummy-image-bytes');
        $owner->forceFill(['avatar_path' => 'avatars/uji.jpg'])->save();

        $this->getJson('/api/v1/avatar/'.$owner->id)
            ->assertOk();
    }

    public function test_pengguna_lain_tidak_bisa_melihat_foto_profil_orang_lain(): void
    {
        $this->seedBase();
        Storage::fake('public');
        $other = $this->createUser();
        Storage::disk('public')->put('avatars/uji.jpg', 'dummy-image-bytes');
        $other->forceFill(['avatar_path' => 'avatars/uji.jpg'])->save();

        $this->actingAsUser();

        $this->getJson('/api/v1/avatar/'.$other->id)
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'FORBIDDEN');
    }
}
