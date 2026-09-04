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
            'email' => 'baru@example.com',
            'phone' => '081299887766',
            'nomor_anggota' => '0000000020260001',
            'password' => 'password123',
        ])->assertStatus(201)->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', ['email' => 'baru@example.com', 'status' => 'active']);
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

    public function test_admin_bisa_soft_delete_user(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->deleteJson("/api/v1/admin/users/{$user->id}")->assertOk();

        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete', 'model_id' => $user->id]);
    }

    public function test_approve_pending_ke_active(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser(['status' => UserStatus::Pending]);

        $this->postJson("/api/v1/admin/users/{$user->id}/approve")
            ->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'active', 'approved_at' => now()]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'approve', 'model_id' => $user->id]);
    }

    public function test_approve_akun_bukan_pending_409(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();

        $this->postJson("/api/v1/admin/users/{$user->id}/approve")
            ->assertStatus(409)->assertJsonPath('error_code', 'CONFLICT');
    }

    public function test_reject_wajib_reason(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser(['status' => UserStatus::Pending]);

        $this->postJson("/api/v1/admin/users/{$user->id}/reject", ['rejected_reason' => 'Dokumen tidak valid'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'rejected', 'rejected_reason' => 'Dokumen tidak valid']);
    }

    public function test_reject_tanpa_reason_422(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser(['status' => UserStatus::Pending]);

        $this->postJson("/api/v1/admin/users/{$user->id}/reject", [])->assertStatus(422);
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

    public function test_index_filter_status(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $this->createUser(['status' => UserStatus::Pending]);
        $this->createUser(['status' => UserStatus::Active]);

        $this->getJson('/api/v1/admin/users?status=pending')
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
