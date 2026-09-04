<?php

namespace Tests;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\JenisTabunganSeeder;
use Database\Seeders\RekeningBankSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected function seedBase(): void
    {
        (new AdminUserSeeder)->run();
        (new JenisTabunganSeeder)->run();
        (new RekeningBankSeeder)->run();
    }

    protected function createUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'phone' => fake()->unique()->numerify('08##########'),
        ], $overrides));
    }

    protected function createAdmin(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
            'phone' => fake()->unique()->numerify('08##########'),
        ], $overrides));
    }

    protected function actingAsAdmin(array $overrides = []): User
    {
        $user = $this->createAdmin($overrides);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function actingAsUser(array $overrides = []): User
    {
        $user = $this->createUser($overrides);
        Sanctum::actingAs($user);

        return $user;
    }

    /**
     * Post a transfer setor (required: rekening_bank_id + bukti_transfer file).
     */
    protected function postSetor(string $uri, array $data = []): \Illuminate\Testing\TestResponse
    {
        return $this->post($uri, array_merge([
            'metode_pembayaran' => 'transfer',
            'rekening_bank_id' => 1,
        ], $data, [
            'bukti_transfer' => \Illuminate\Http\UploadedFile::fake()->image('bukti.jpg'),
        ]));
    }
}
