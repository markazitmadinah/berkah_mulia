<?php

namespace App\Services;

use App\Enums\ChannelNotifikasi;
use App\Enums\TipeNotifikasi;
use App\Enums\UserRole;
use App\Models\Notifikasi;
use App\Models\User;

/**
 * Pusat pembuatan notifikasi in-app. Semua event yang mau memberitahu
 * user/admin lewat NotifikasiService, bukan Notifikasi::create manual.
 */
class NotifikasiService
{
    public function kirim(User $user, string $judul, string $pesan, TipeNotifikasi $tipe, array $data = []): Notifikasi
    {
        return Notifikasi::create([
            'user_id' => $user->id,
            'judul' => $judul,
            'pesan' => $pesan,
            'tipe' => $tipe,
            'channel' => ChannelNotifikasi::InApp,
            'data' => $data,
        ]);
    }

    public function kirimKeSemuaAdmin(string $judul, string $pesan, TipeNotifikasi $tipe, array $data = []): void
    {
        foreach (User::where('role', UserRole::Admin->value)->get() as $admin) {
            $this->kirim($admin, $judul, $pesan, $tipe, $data);
        }
    }
}