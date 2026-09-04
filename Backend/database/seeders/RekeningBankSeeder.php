<?php

namespace Database\Seeders;

use App\Models\RekeningBank;
use App\Models\User;
use Illuminate\Database\Seeder;

class RekeningBankSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();
        $adminId = $admin?->id ?? 1;

        $data = [
            [
                'nama_bank' => 'Bank Syariah Indonesia (BSI)',
                'no_rekening' => '7171234567',
                'atas_nama' => 'Berkah Mulia',
                'cabang' => 'Jakarta Pusat',
            ],
            [
                'nama_bank' => 'Bank Muamalat',
                'no_rekening' => '3051234567',
                'atas_nama' => 'Berkah Mulia',
                'cabang' => 'Jakarta Selatan',
            ],
        ];

        foreach ($data as $item) {
            RekeningBank::updateOrCreate(
                ['no_rekening' => $item['no_rekening']],
                array_merge($item, [
                    'status_aktif' => true,
                    'created_by' => $adminId,
                ])
            );
        }
    }
}
