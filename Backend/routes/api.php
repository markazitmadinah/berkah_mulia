<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\V1\Admin\JenisTabunganController as AdminJenisTabunganController;
use App\Http\Controllers\Api\V1\Admin\HargaEmasController;
use App\Http\Controllers\Api\V1\Admin\QurbanController as AdminQurbanController;
use App\Http\Controllers\Api\V1\Admin\TransaksiController as AdminTransaksiController;
use App\Http\Controllers\Api\V1\Admin\RekeningBankController as AdminRekeningBankController;
use App\Http\Controllers\Api\V1\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\AuditLogController;
use App\Http\Controllers\Api\V1\JenisTabunganController;
use App\Http\Controllers\Api\V1\EmasController;
use App\Http\Controllers\Api\V1\TabunganPribadiController;
use App\Http\Controllers\Api\V1\TabunganCustomController;
use App\Http\Controllers\Api\V1\QurbanController;
use App\Http\Controllers\Api\V1\TransaksiController;
use App\Http\Controllers\Api\V1\RekeningBankController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\NotifikasiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Prefix: /api/v1
|--------------------------------------------------------------------------
|
| All routes are automatically prefixed with /api/v1 via bootstrap/app.php
| Stateless, token-based auth via Laravel Sanctum (Bearer token).
|
*/

// ─── Public (No Auth) ──────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:5,1');

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:15,1');

    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,1');

    Route::post('/reset-password', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:5,1');
});

// ─── Authenticated (Any Role, Must Be Active) ─────────────────
Route::middleware(['auth:sanctum', 'active'])->group(function () {

    // Auth — profile & password
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/me', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    // Jenis Tabungan — read access for all authenticated users
    Route::get('/jenis-tabungan', [JenisTabunganController::class, 'index']);
    Route::get('/jenis-tabungan/{jenisTabungan}', [JenisTabunganController::class, 'show']);

    // Rekening Bank — read access for all
    Route::get('/rekening-bank', [RekeningBankController::class, 'index']);

    // Notifikasi
    Route::prefix('notifikasi')->group(function () {
        Route::get('/', [NotifikasiController::class, 'index']);
        Route::patch('/{notifikasi}/read', [NotifikasiController::class, 'markAsRead']);
        Route::patch('/read-all', [NotifikasiController::class, 'markAllAsRead']);
    });

    // Bukti Transfer — serve stored proof file (named route referenced by TransaksiResource)
    Route::get('/transaksi/{transaksi}/bukti', [TransaksiController::class, 'showBukti'])
        ->name('bukti-transfer.show');

    // Foto profil — serve stored avatar (owner or admin)
    Route::get('/avatar/{user}', [AuthController::class, 'avatar']);

    // ─── User-Only Routes ──────────────────────────────────────
    Route::middleware('role:user')->group(function () {

        // Emas
        Route::get('/emas/harga-terkini', [EmasController::class, 'hargaTerkini']);
        Route::get('/emas/harga-riwayat', [EmasController::class, 'hargaRiwayat']);
        Route::post('/emas/setor', [EmasController::class, 'setor']);
Route::post('/emas/tarik', [EmasController::class, 'tarik']);
Route::post('/emas/tukar', [EmasController::class, 'tukar']);
Route::post('/emas/batal', [EmasController::class, 'batal']);
        Route::put('/emas/goal', [EmasController::class, 'updateGoal']);

        // Tabungan Pribadi
        Route::post('/tabungan-pribadi/setor', [TabunganPribadiController::class, 'setor']);
        Route::post('/tabungan-pribadi/tarik', [TabunganPribadiController::class, 'tarik']);
        Route::get('/tabungan-pribadi/progress', [TabunganPribadiController::class, 'progress']);

        // Tabungan Custom — jenis tabungan tipe `custom`
        Route::post('/tabungan-custom/{jenisTabungan}/setor', [TabunganCustomController::class, 'setor']);
        Route::post('/tabungan-custom/{jenisTabungan}/tarik', [TabunganCustomController::class, 'tarik']);
        Route::get('/tabungan-custom/{jenisTabungan}/progress', [TabunganCustomController::class, 'progress']);
        Route::match(['get', 'patch'], '/tabungan-custom/{jenisTabungan}/target', [TabunganCustomController::class, 'target']);
        Route::match(['get', 'put'], '/tabungan-custom/{jenisTabungan}/auto-setor', [TabunganCustomController::class, 'autoSetor']);

        // Qurban — User
        Route::get('/qurban/periode-aktif', [QurbanController::class, 'periodeAktif']);
        Route::get('/qurban/hewan', [QurbanController::class, 'listHewan']);
        Route::post('/qurban/daftar', [QurbanController::class, 'daftar']);
        Route::get('/qurban/pendaftaran-saya', [QurbanController::class, 'pendaftaranSaya']);
Route::post('/qurban/{pendaftaran}/setor', [QurbanController::class, 'setor']);
Route::post('/qurban/{pendaftaran}/lunas', [QurbanController::class, 'lunas']);
Route::get('/qurban/{pendaftaran}/progress', [QurbanController::class, 'progress']);

        // Transaksi — User
        Route::get('/transaksi-saya', [TransaksiController::class, 'index']);
        Route::get('/transaksi-saya/{transaksi}', [TransaksiController::class, 'show']);
        Route::post('/transaksi/{transaksi}/upload-bukti', [TransaksiController::class, 'uploadBukti']);

        // Dashboard — User
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/dashboard/{jenisTabungan}/progress', [DashboardController::class, 'progress']);
    });

    // ─── Admin-Only Routes ─────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {

        // User Management
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::get('/users/export', [AdminUserController::class, 'export']);
        Route::get('/users/import/template', [AdminUserController::class, 'importTemplate']);
        Route::post('/users/import', [AdminUserController::class, 'import']);
        Route::get('/users/{user}', [AdminUserController::class, 'show']);
        Route::post('/users', [AdminUserController::class, 'store']);
        Route::put('/users/{user}', [AdminUserController::class, 'update']);
        Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);
        Route::post('/users/{user}/approve', [AdminUserController::class, 'approve']);
        Route::post('/users/{user}/reject', [AdminUserController::class, 'reject']);
        Route::post('/users/{user}/suspend', [AdminUserController::class, 'suspend']);
        Route::post('/users/{user}/activate', [AdminUserController::class, 'activate']);

        // Jenis Tabungan
        Route::post('/jenis-tabungan', [AdminJenisTabunganController::class, 'store']);
        Route::put('/jenis-tabungan/{jenisTabungan}', [AdminJenisTabunganController::class, 'update']);
        Route::delete('/jenis-tabungan/{jenisTabungan}', [AdminJenisTabunganController::class, 'destroy']);
        Route::patch('/jenis-tabungan/{jenisTabungan}/toggle-status', [AdminJenisTabunganController::class, 'toggleStatus']);

        // Harga Emas
        Route::get('/emas/harga-terkini', [HargaEmasController::class, 'hargaTerkini']);
        Route::get('/emas/harga-riwayat', [HargaEmasController::class, 'hargaRiwayat']);
        Route::post('/emas/harga', [HargaEmasController::class, 'store']);
        Route::post('/emas/harga/sync', [HargaEmasController::class, 'syncDariLogamMulia']);
        Route::put('/emas/harga/{hargaEmas}', [HargaEmasController::class, 'update']);
        Route::delete('/emas/harga/{hargaEmas}', [HargaEmasController::class, 'destroy']);

        // Qurban — Admin
        Route::get('/qurban/periode', [AdminQurbanController::class, 'listPeriode']);
        Route::get('/qurban/hewan', [AdminQurbanController::class, 'listHewan']);
        Route::post('/qurban/periode', [AdminQurbanController::class, 'storePeriode']);
        Route::put('/qurban/periode/{periode}', [AdminQurbanController::class, 'updatePeriode']);
        Route::post('/qurban/hewan', [AdminQurbanController::class, 'storeHewan']);
        Route::put('/qurban/hewan/{hewan}', [AdminQurbanController::class, 'updateHewan']);
        Route::delete('/qurban/hewan/{hewan}', [AdminQurbanController::class, 'destroyHewan']);
        Route::get('/qurban/pendaftaran', [AdminQurbanController::class, 'listPendaftaran']);
        Route::post('/qurban/{pendaftaran}/cairkan', [AdminQurbanController::class, 'cairkan']);
Route::post('/qurban/{pendaftaran}/lunas', [AdminQurbanController::class, 'lunas']);
        Route::delete('/qurban/pendaftaran/{pendaftaran}', [AdminQurbanController::class, 'destroyPendaftaran']);

        // Transaksi — Admin
        Route::get('/transaksi', [AdminTransaksiController::class, 'index']);
        Route::get('/transaksi/export', [AdminTransaksiController::class, 'export']);
        Route::get('/transaksi/{transaksi}', [AdminTransaksiController::class, 'show']);
        Route::post('/transaksi/{transaksi}/verifikasi', [AdminTransaksiController::class, 'verifikasi']);
        Route::post('/transaksi/{transaksi}/tolak', [AdminTransaksiController::class, 'tolak']);
        Route::post('/transaksi/cash', [AdminTransaksiController::class, 'storeCash']);

        // Rekening Bank — Admin
        Route::post('/rekening-bank', [AdminRekeningBankController::class, 'store']);
        Route::put('/rekening-bank/{rekeningBank}', [AdminRekeningBankController::class, 'update']);
        Route::patch('/rekening-bank/{rekeningBank}/toggle-status', [AdminRekeningBankController::class, 'toggleStatus']);
        Route::delete('/rekening-bank/{rekeningBank}', [AdminRekeningBankController::class, 'destroy']);

        // Dashboard — Admin
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);

        // Goal Tracker — Admin
        Route::get('/tabungan-custom/goal-tracker', [TabunganCustomController::class, 'goalTracker']);

        // Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });
});
