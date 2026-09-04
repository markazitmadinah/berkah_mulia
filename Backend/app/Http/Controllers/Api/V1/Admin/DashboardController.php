<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Transaksi;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    use ApiResponse;

    /**
     * GET /admin/dashboard
     */
    public function index(): JsonResponse
    {
        $totalNasabahAktif = User::where('role', 'user')->where('status', UserStatus::Active)->count();
        $totalPending = User::where('status', UserStatus::Pending)->count();

        $transaksiPending = Transaksi::menungguVerifikasi()->count();
        $transaksiTerverifikasi = Transaksi::terverifikasi()->count();

        $avgVerifikasiTime = Transaksi::terverifikasi()
            ->whereNotNull('diverifikasi_pada')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, diverifikasi_pada)) as avg_hours')
            ->value('avg_hours');

        $totalSetoran = Transaksi::terverifikasi()
            ->where('jenis_transaksi', 'setor')
            ->sum('nominal');

        return $this->successResponse([
            'total_nasabah_aktif' => $totalNasabahAktif,
            'total_nasabah_pending' => $totalPending,
            'transaksi_pending' => $transaksiPending,
            'transaksi_terverifikasi' => $transaksiTerverifikasi,
            'rata_rata_waktu_verifikasi_jam' => round($avgVerifikasiTime ?? 0, 1),
            'total_setoran_terverifikasi' => $totalSetoran,
        ]);
    }
}
