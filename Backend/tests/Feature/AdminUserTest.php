<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Tests\ApiTestCase;

class AdminUserTest extends ApiTestCase
{
    public function test_non_admin_tidak_bisa_akses_admin_users(): void
    {
        $this->seedBase();
        $this->actingAsUser();

        $this->getJson('/api/v1/admin/users')->assertStatus(403)->assertJsonPath('error_code', 'FORBIDDEN');
    }

    public function test_admin_bisa_list_users(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser();

        $this->getJson('/api/v1/admin/users')->assertOk()->assertJsonPath('success', true);
    }

    public function test_admin_bisa_membuat_user_langsung_active(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/users', [
            'name' => 'User Baru',
            'username' => 'user.baru',
            'phone' => '081299887766',
            'nomor_anggota' => '0020260001',
            'password' => 'password123',
        ])->assertStatus(201)->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', ['username' => 'user.baru', 'status' => 'active']);
    }

    public function test_admin_bisa_update_user(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->putJson("/api/v1/admin/users/{$user->id}", ['name' => 'Nama Updated'])
            ->assertOk()->assertJsonPath('data.name', 'Nama Updated');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Nama Updated']);
    }

    public function test_update_user_terima_status_rejected_dan_revoke_token(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $user->createToken('auth-token');
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->putJson("/api/v1/admin/users/{$user->id}", ['status' => 'rejected'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'rejected']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_update_user_status_active_kembali(): void
    {
        $this->seedBase();
        $admin = $this->actingAsAdmin();
        $user = $this->createUser(['status' => UserStatus::Rejected]);

        $this->putJson("/api/v1/admin/users/{$user->id}", ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'active', 'approved_by' => $admin->id]);
        $this->assertNotNull(User::find($user->id)->approved_at);
    }

    public function test_admin_bisa_soft_delete_user(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->deleteJson("/api/v1/admin/users/{$user->id}")->assertOk();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete', 'model_id' => $user->id]);
    }

    public function test_approve_reject_user_endpoint_tidak_tersedia(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->postJson("/api/v1/admin/users/{$user->id}/approve")->assertStatus(404);
        $this->postJson("/api/v1/admin/users/{$user->id}/reject", ['rejected_reason' => 'x'])->assertStatus(404);
    }

    public function test_suspend_menghapus_token(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        $user->createToken('auth-token');
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->postJson("/api/v1/admin/users/{$user->id}/suspend")
            ->assertOk()->assertJsonPath('data.status', 'suspended');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_activate_akun_suspended(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser(['status' => UserStatus::Suspended]);

        $this->postJson("/api/v1/admin/users/{$user->id}/activate")
            ->assertOk()->assertJsonPath('data.status', 'active');
    }

    public function test_activate_akun_non_suspended_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->postJson("/api/v1/admin/users/{$user->id}/activate")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_index_filter_status_suspended(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser();
        $this->createUser(['status' => UserStatus::Suspended]);

        $this->getJson('/api/v1/admin/users?status=suspended')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_index_search_nama(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser(['name' => 'Zainal Abidin']);
        $this->createUser(['name' => 'Budi']);

        $this->getJson('/api/v1/admin/users?search=Abidin')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', 'Zainal Abidin');
    }

    public function test_export_import_mengembalikan_response_placeholder(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        // Export & template kini mengunduh file .xlsx (BinaryFileResponse)
        $response = $this->get('/api/v1/admin/users/export');
        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $template = $this->get('/api/v1/admin/users/import/template');
        $template->assertOk();
        $template->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
}
