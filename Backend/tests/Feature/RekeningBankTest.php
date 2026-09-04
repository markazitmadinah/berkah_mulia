<?php

namespace Tests\Feature;

use App\Models\RekeningBank;
use Tests\ApiTestCase;

class RekeningBankTest extends ApiTestCase
{
    public function test_admin_bisa_tambah_rekening(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/rekening-bank', [
            'nama_bank' => 'Bank Mandiri',
            'no_rekening' => '1234567890',
            'atas_nama' => 'Berkah Mulia',
            'cabang' => 'Bandung',
        ])->assertStatus(201)->assertJsonPath('data.nama_bank', 'Bank Mandiri');

        $this->assertDatabaseHas('rekening_bank', ['no_rekening' => '1234567890']);
    }

    public function test_admin_bisa_update_rekening(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $rekening = RekeningBank::first();

        $this->putJson("/api/v1/admin/rekening-bank/{$rekening->id}", ['atas_nama' => 'PT Berkah Mulia'])
            ->assertOk()->assertJsonPath('data.atas_nama', 'PT Berkah Mulia');
    }

    public function test_admin_toggle_status(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $rekening = RekeningBank::first();
        $this->assertTrue($rekening->status_aktif);

        $this->patchJson("/api/v1/admin/rekening-bank/{$rekening->id}/toggle-status")
            ->assertOk()->assertJsonPath('data.status_aktif', false);
    }

    public function test_admin_hapus_rekening(): void
    {
        $this->seedBase();
        $this->actingAsAdmin();
        $rekening = RekeningBank::first();

        $this->deleteJson("/api/v1/admin/rekening-bank/{$rekening->id}")->assertOk();
        $this->assertDatabaseMissing('rekening_bank', ['id' => $rekening->id]);
    }

    public function test_user_list_rekening_aktif_saja(): void
    {
        $this->seedBase();
        $this->actingAsUser();
        RekeningBank::first()->update(['status_aktif' => false]);

        $this->getJson('/api/v1/rekening-bank')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
