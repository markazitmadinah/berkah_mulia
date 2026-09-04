<?php

namespace Tests\Feature;

use App\Enums\ChannelNotifikasi;
use App\Enums\TipeNotifikasi;
use App\Models\Notifikasi;
use Tests\ApiTestCase;

class NotifikasiTest extends ApiTestCase
{
    public function test_user_list_notifikasi_dengan_unread_count(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        Notifikasi::create(['user_id' => $user->id, 'judul' => 'Info', 'pesan' => 'Selamat datang', 'tipe' => TipeNotifikasi::Info, 'channel' => ChannelNotifikasi::InApp]);

        $this->getJson('/api/v1/notifikasi')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.unread_count', 1);
    }

    public function test_mark_as_read(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        $notif = Notifikasi::create(['user_id' => $user->id, 'judul' => 'Info', 'pesan' => 'x', 'tipe' => TipeNotifikasi::Info, 'channel' => ChannelNotifikasi::InApp]);

        $this->patchJson("/api/v1/notifikasi/{$notif->id}/read")
            ->assertOk()->assertJsonPath('data.is_dibaca', true);

        $this->assertNotNull(Notifikasi::find($notif->id)->dibaca_pada);
    }

    public function test_mark_all_read(): void
    {
        $this->seedBase();
        $user = $this->actingAsUser();
        Notifikasi::create(['user_id' => $user->id, 'judul' => 'A', 'pesan' => 'x', 'tipe' => TipeNotifikasi::Info, 'channel' => ChannelNotifikasi::InApp]);
        Notifikasi::create(['user_id' => $user->id, 'judul' => 'B', 'pesan' => 'y', 'tipe' => TipeNotifikasi::Verifikasi, 'channel' => ChannelNotifikasi::InApp]);

        $this->patchJson('/api/v1/notifikasi/read-all')->assertOk();

        $this->assertEquals(0, Notifikasi::where('user_id', $user->id)->belumDibaca()->count());
    }

    public function test_user_tidak_bisa_mark_notifikasi_orang_lain(): void
    {
        $this->seedBase();
        $other = $this->createUser(['email' => 'o@example.com', 'phone' => '081299911122']);
        $this->actingAsUser();
        $notif = Notifikasi::create(['user_id' => $other->id, 'judul' => 'A', 'pesan' => 'x', 'tipe' => TipeNotifikasi::Info, 'channel' => ChannelNotifikasi::InApp]);

        $this->patchJson("/api/v1/notifikasi/{$notif->id}/read")
            ->assertStatus(403)->assertJsonPath('error_code', 'FORBIDDEN');
    }
}
