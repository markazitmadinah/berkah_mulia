<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\ApiTestCase;

class UserStatusDefaultsTest extends ApiTestCase
{
    public function test_user_baru_tanpa_status_role_default_aktif_dan_user(): void
    {
        $user = User::factory()->create(['phone' => fake()->unique()->numerify('08##########')]);

        $this->assertSame(UserStatus::Active, $user->status);
        $this->assertSame(UserRole::User, $user->role);
    }

    public function test_status_lama_tak_dikenal_tidak_500_dan_ditangani_403(): void
    {
        $user = $this->createUser();
        DB::table('users')->where('id', $user->id)->update(['status' => 'pending']);
        Sanctum::actingAs(User::find($user->id));

        $response = $this->getJson('/api/v1/dashboard'); // grup auth:sanctum + active

        $response->assertStatus(403)
            ->assertJsonPath('error_code', 'ACCOUNT_INACTIVE');
    }
}