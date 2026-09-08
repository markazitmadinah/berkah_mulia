<?php

namespace Database\Seeders;

use App\Enums\AturanPencairan;
use App\Enums\ModePerhitungan;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeTabungan;
use App\Models\JenisTabungan;
use App\Models\User;
use Illuminate\Database\Seeder;

class JenisTabunganSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();
        $adminId = $admin?->id ?? 1;

        $tabunganData = [
            [
                'kode' => 'emas-harian',
                'nama' => 'Tabungan Emas Harian',
                'deskripsi' => 'Tabungan emas dengan setoran harian yang dikonversi ke gram emas berdasarkan harga per gram yang berlaku saat transaksi.',
                'tipe' => TipeTabungan::Emas,
                'mode_perhitungan' => ModePerhitungan::KonversiUnit,
                'unit_label' => 'gram',
                'tanpa_batas_waktu' => true,
                'aturan_pencairan' => AturanPencairan::ManualAdmin,
                'metode_pembayaran_diizinkan' => ['transfer'],
                'allow_withdrawal' => false,
                'status_aktif' => true,
            ],
            [
                'kode' => 'tabungan-pribadi',
                'nama' => 'Tabungan Mandiri',
                'deskripsi' => 'Simpanan sukarela dengan nominal bebas. Setor kapan saja dan tarik saat dibutuhkan.',
                'tipe' => TipeTabungan::Pribadi,
                'sub_jenis' => SubJenisTabungan::Mandiri,
                'mode_perhitungan' => ModePerhitungan::NominalBebas,
                'tanpa_batas_waktu' => true,
                'aturan_pencairan' => AturanPencairan::ManualAdmin,
                'metode_pembayaran_diizinkan' => ['transfer'],
                'allow_withdrawal' => true,
                'status_aktif' => true,
            ],
            [
                'kode' => 'tabungan-hari-raya',
                'nama' => 'Tabungan Hari Raya',
                'deskripsi' => 'Simpanan khusus menyambut hari raya. Setoran bebas, pencairan diatur saat hari raya.',
                'tipe' => TipeTabungan::Pribadi,
                'sub_jenis' => SubJenisTabungan::HariRaya,
                'mode_perhitungan' => ModePerhitungan::NominalBebas,
                'tanpa_batas_waktu' => false,
                'aturan_pencairan' => AturanPencairan::ManualAdmin,
                'metode_pembayaran_diizinkan' => ['transfer'],
                'allow_withdrawal' => false,
                'status_aktif' => true,
            ],
            [
                'kode' => 'tabungan-berjangka',
                'nama' => 'Tabungan Berjangka',
                'deskripsi' => 'Simpanan dengan target tenggat waktu. Setoran berkala sampai tanggal deadline, dana terkunci sampai jatuh tempo.',
                'tipe' => TipeTabungan::Pribadi,
                'sub_jenis' => SubJenisTabungan::Berjangka,
                'mode_perhitungan' => ModePerhitungan::NominalBebas,
                'deadline' => now()->addMonths(12)->toDateString(),
                'frekuensi_setoran' => 'bulanan',
                'tanpa_batas_waktu' => false,
                'aturan_pencairan' => AturanPencairan::ManualAdmin,
                'metode_pembayaran_diizinkan' => ['transfer'],
                'allow_withdrawal' => false,
                'status_aktif' => true,
            ],
            [
                'kode' => 'tabungan-qurban',
                'nama' => 'Tabungan Qurban',
                'deskripsi' => 'Tabungan qurban untuk pembelian hewan qurban. Target dana dihitung otomatis berdasarkan jenis dan jumlah hewan.',
                'tipe' => TipeTabungan::Qurban,
                'sub_jenis' => SubJenisTabungan::Qurban,
                'mode_perhitungan' => ModePerhitungan::NominalTetap,
                'tanpa_batas_waktu' => false,
                'aturan_pencairan' => AturanPencairan::TanggalTertentu,
                'metode_pembayaran_diizinkan' => ['transfer'],
                'allow_withdrawal' => false,
                'status_aktif' => true,
            ],
        ];

        foreach ($tabunganData as $data) {
            JenisTabungan::updateOrCreate(
                ['kode' => $data['kode']],
                array_merge($data, [
                    'created_by' => $adminId,
                    'updated_by' => $adminId,
                ])
            );
        }
    }
}
