<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Tests\ApiTestCase;

class AuditLogTest extends ApiTestCase
{
    public function test_audit_log_read_only(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        AuditLog::record('test', $user);

        $this->getJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_audit_log_filter_action(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        AuditLog::record('create', $user);
        AuditLog::record('update', $user);

        $this->getJson('/api/v1/admin/audit-logs?action=create')
            ->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_audit_log_filter_model_type(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        AuditLog::record('create', $user);

        $this->getJson('/api/v1/admin/audit-logs?model_type=User')
            ->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_aksi_create_user_via_admin_tercatat_di_audit_log(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Siti',
            'email' => 'siti@example.com',
            'phone' => '081233344455',
            'nomor_anggota' => '0000000020260002',
            'password' => 'password123',
        ])->assertStatus(201);

        $this->assertDatabaseHas('audit_logs', ['action' => 'create', 'model_type' => User::class]);
    }

    public function test_purge_audit_log_menghapus_riwayat_dan_menyisakan_jejak_purge(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $user = $this->createUser();
        AuditLog::record('create', $user);
        AuditLog::record('update', $user);

        $this->deleteJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.deleted', 2);

        $this->assertSame(1, AuditLog::count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'purge']);
    }
}
