<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\StatusPendaftaranQurban;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exports\UsersExport;
use App\Exports\UsersTemplate;
use App\Exports\LaporanHarianTemplate;
use App\Http\Controllers\Controller;
use App\Http\Resources\KonfigurasiSetoranEmasResource;
use App\Http\Resources\TransaksiResource;
use App\Http\Resources\UserResource;
use App\Imports\LaporanHarianImport;
use App\Imports\UsersImport;
use App\Models\AuditLog;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\PendaftaranQurban;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\ProgressCalculatorService;
use App\Services\SaldoEmasService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UserController extends Controller
{
    use ApiResponse;

    public function __construct(private NotifikasiService $notif) {}

    /**
     * GET /admin/monitoring-tabungan
     * Pantau progress tabungan semua nasabah: saldo & persentase per jenis tabungan
     * (emas, mandiri, berjangka, hari raya) + qurban aktif.
     */
    public function monitoring(
        Request $request,
        ProgressCalculatorService $progressService,
        SaldoEmasService $saldoEmasService
    ): JsonResponse {
        $request->validate([
            'search' => 'nullable|string|max:255',
            'per_page' => 'nullable|integer|min:1|max:1000',
        ]);

        $query = User::where('role', UserRole::User);

        if ($request->filled('search')) {
            $search = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('nomor_anggota', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = min($request->input('per_page', 20), 1000);
        $users = $query->orderBy('name')->paginate($perPage);

        $jenisList = JenisTabungan::aktif()->orderBy('nama')->get();

        $items = $users->getCollection()->map(function (User $user) use ($jenisList, $progressService, $saldoEmasService) {
            $tabungan = [];
            foreach ($jenisList as $jenis) {
                $progress = $progressService->getProgress($user, $jenis);

                $berjangka = null;
                if ($jenis->sub_jenis?->value === 'berjangka') {
                    $berjangka = TabunganBerjangka::milikUser($user->id)
                        ->whereIn('status', ['aktif', 'menunggu_approval'])
                        ->get()
                        ->map(fn (TabunganBerjangka $tb) => [
                            'id' => $tb->id,
                            'target_nominal' => (float) $tb->target_nominal,
                            'durasi_bulan' => $tb->durasi_bulan,
                            'frekuensi_setor' => $tb->frekuensi_setor,
                            'frekuensi_label' => $tb->frekuensiLabel(),
                            'nominal_per_periode' => (float) $tb->nominal_per_periode,
                            'terkumpul' => round($tb->terkumpulNominal(), 2),
                            'persentase' => $tb->target_nominal > 0
                                ? round(min(100, $tb->terkumpulNominal() / (float) $tb->target_nominal * 100), 1)
                                : 0,
                            'sisa_target' => max(0, round((float) $tb->target_nominal - $tb->terkumpulNominal(), 2)),
                            'status' => $tb->status,
                        ]);
                    $progress['berjangka'] = $berjangka;
                }

                if ($jenis->tipe === TipeTabungan::Emas) {
                    $progress['saldo_dana'] = $saldoEmasService->getSaldoDana($user, $jenis);
                    $progress['setoran_berkala'] = $saldoEmasService
                        ->getAktifList($user, $jenis)
                        ->map(fn (KonfigurasiSetoranEmas $k) => $saldoEmasService->getProgress($user, $k))
                        ->values();
                }

                $tabungan[] = $progress;
            }

            $qurban = PendaftaranQurban::with(['hewanQurban', 'periodeQurban'])
                ->where('user_id', $user->id)
                ->where('status', '!=', 'batal')
                ->whereNotIn('status', [
                    StatusPendaftaranQurban::SudahLunas->value,
                    StatusPendaftaranQurban::SudahDicairkan->value,
                ])
                ->latest('id')
                ->get()
                ->map(fn (PendaftaranQurban $p) => [
                    'id' => $p->id,
                    'hewan' => $p->hewanQurban?->jenis_hewan,
                    'jumlah_hewan' => $p->jumlah_hewan,
                    'target_dana' => (float) $p->target_dana,
                    'total_terkumpul' => (float) $p->total_terkumpul,
                    'persentase' => $p->hitungPersentase(),
                    'status' => $p->status?->value,
                    'frekuensi_setor' => $p->frekuensi_setor ?: 'bulanan',
                    'frekuensi_label' => $p->frekuensiLabel() ?: 'Bulanan',
                    'nominal_per_periode' => $p->nominal_per_periode !== null ? (float) $p->nominal_per_periode : null,
                    'sisa_pembayaran' => $p->sisaPembayaran(),
                    'tertunggak' => $p->tertunggak(),
                ])
                ->values();

            return [
                'user' => (new UserResource($user))->resolve(),
                'tabungan' => $tabungan,
                'qurban' => $qurban,
            ];
        });

        return $this->successResponse($items, 'Berhasil mengambil data monitoring tabungan.');
    }

    /**
     * GET /admin/users/{user}/rencana-emas
     * Daftar rencana setoran berkala emas aktif milik nasabah + rekap gram/dana.
     * Dipakai modal setor & batal-refund admin agar tidak ambigu saat rencana > 1.
     */
    public function rencanaEmas(User $user, SaldoEmasService $saldoEmasService): JsonResponse
    {
        $jenis = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenis) {
            return $this->successResponse([], 'Berhasil mengambil rencana emas.');
        }

        $items = $saldoEmasService
            ->getAktifList($user, $jenis)
            ->map(function (KonfigurasiSetoranEmas $k) use ($user, $saldoEmasService) {
                $progress = $saldoEmasService->getProgress($user, $k);

                return [
                    'konfigurasi_id' => $k->id,
                    'nominal_per_periode' => (float) $k->nominal_per_periode,
                    'frekuensi_label' => $progress['frekuensi_label'] ?? null,
                    'gram_terkumpul' => (float) ($progress['rekap']['gram_terkumpul'] ?? 0),
                    'dana' => (float) ($progress['rekap']['saldo_dana_rencana'] ?? 0),
                ];
            })
            ->values();

        return $this->successResponse($items, 'Berhasil mengambil rencana emas.');
    }

    /**
     * GET /admin/users
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:active,rejected,suspended',
            'role' => 'nullable|string|in:admin,user',
            'search' => 'nullable|string|max:255',
            'per_page' => 'nullable|integer|min:1|max:1000',
        ]);

        $query = User::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('search')) {
            $search = str_replace(['%', '_'], ['\%', '\_'], $request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('nomor_anggota', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = min($request->input('per_page', 15), 1000);
        $users = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data pengguna.',
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    /**
     * GET /admin/users/{user}
     */
    public function show(User $user): JsonResponse
    {
        $user->load('approvedBy');

        return $this->successResponse(new UserResource($user));
    }

    /**
     * GET /admin/users/{user}/produk
     * Semua produk yang digunakan nasabah: tabungan (emas/pribadi) dengan progress,
     * pendaftaran qurban, dan riwayat transaksi.
     */
    public function produk(
        User $user,
        ProgressCalculatorService $progressService,
        SaldoEmasService $saldoEmasService
    ): JsonResponse {
        $user->load('approvedBy');

        $tabungan = [];
        $totalSaldo = 0;

        foreach (JenisTabungan::aktif()->orderBy('nama')->get() as $jenis) {
            $progress = $progressService->getProgress($user, $jenis);
            $konfigurasiList = $jenis->tipe === TipeTabungan::Emas
                ? $saldoEmasService->getAktifList($user, $jenis)
                : collect();

            $include = $progress['saldo'] > 0
                || $progress['pending_amount'] > 0
                || $konfigurasiList->isNotEmpty()
                || ($progress['target'] ?? 0) > 0
                || ($progress['target_emas_gram'] ?? 0) > 0;

            if (! $include) {
                continue;
            }

            $totalSaldo += $progress['saldo'];

            $tabungan[] = [
                'progress' => $progress,
                'konfigurasi' => $konfigurasiList
                    ->map(fn (KonfigurasiSetoranEmas $k) => (new KonfigurasiSetoranEmasResource($k))->resolve())
                    ->values(),
                'setoran_berkala' => $konfigurasiList
                    ->map(fn (KonfigurasiSetoranEmas $k) => $saldoEmasService->getProgress($user, $k))
                    ->values(),
            ];
        }

        $qurban = PendaftaranQurban::with(['hewanQurban', 'periodeQurban'])
            ->where('user_id', $user->id)
            ->latest('id')
            ->get()
            ->map(fn (PendaftaranQurban $p) => [
                'id' => $p->id,
                'hewan' => $p->hewanQurban?->jenis_hewan,
                'tahun' => $p->periodeQurban?->tahun,
                'jumlah_hewan' => $p->jumlah_hewan,
                'target_dana' => (float) $p->target_dana,
                'total_terkumpul' => (float) $p->total_terkumpul,
                'persentase' => $p->hitungPersentase(),
                'status' => $p->status?->value,
                'status_label' => $p->status?->label(),
                'frekuensi_setor' => $p->frekuensi_setor ?: 'bulanan',
                'frekuensi_label' => $p->frekuensiLabel() ?: 'Bulanan',
                'nominal_per_periode' => $p->nominal_per_periode !== null ? (float) $p->nominal_per_periode : null,
                'sisa_pembayaran' => $p->sisaPembayaran(),
                'tanggal_daftar' => $p->tanggal_daftar?->toDateString(),
                'tertunggak' => $p->tertunggak(),
            ])
            ->values();

        $berjangka = TabunganBerjangka::where('user_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (TabunganBerjangka $tb) => [
                'id' => $tb->id,
                'target_nominal' => (float) $tb->target_nominal,
                'durasi_bulan' => $tb->durasi_bulan,
                'frekuensi_setor' => $tb->frekuensi_setor,
                'frekuensi_label' => $tb->frekuensiLabel(),
                'nominal_per_periode' => (float) $tb->nominal_per_periode,
                'tanggal_mulai' => $tb->tanggal_mulai?->toDateString(),
                'tanggal_jatuh_tempo' => $tb->tanggal_jatuh_tempo?->toDateString(),
                'status' => $tb->status,
                'terkumpul' => round($tb->terkumpulNominal(), 2),
                'persentase' => $tb->target_nominal > 0
                    ? round(min(100, $tb->terkumpulNominal() / (float) $tb->target_nominal * 100), 1)
                    : 0,
                'tertunggak' => $tb->tertunggak(),
                'sisa_target' => max(0, round((float) $tb->target_nominal - $tb->terkumpulNominal(), 2)),
            ])
            ->values();

        $transaksi = Transaksi::with(['jenisTabungan', 'rekeningBank'])
            ->where('user_id', $user->id)
            ->latest()
            ->limit(100)
            ->get();

        return $this->successResponse([
            'user' => new UserResource($user),
            'produk' => [
                'tabungan' => $tabungan,
                'qurban' => $qurban,
                'berjangka' => $berjangka,
            ],
            'summary' => [
                'total_tabungan_aktif' => count($tabungan),
                'total_saldo_tabungan' => round($totalSaldo, 2),
                'transaksi_pending' => Transaksi::milikUser($user->id)->menungguVerifikasi()->count(),
            ],
            'transaksi' => TransaksiResource::collection($transaksi),
        ]);
    }

    /**
     * POST /admin/users
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20|unique:users,phone',
            'nomor_anggota' => 'required|string|regex:/^\d{10}$/|unique:users,nomor_anggota',
            'password' => 'required|string|min:8',
            'role' => 'sometimes|string|in:admin,user',
            'status' => 'sometimes|string|in:active,suspended,rejected',
            'address' => 'nullable|string|max:500',
            'created_at' => 'sometimes|date',
            // Saldo awal untuk user lama (migrasi data)
            'saldo_awal' => 'sometimes|array',
            'saldo_awal.*.jenis_tabungan_id' => 'required_with:saldo_awal|integer|exists:jenis_tabungan,id',
            'saldo_awal.*.nominal' => 'required_with:saldo_awal|numeric|min:0',
        ]);

        $roleValue = $request->input('role', 'user');
        $statusValue = $request->input('status', 'active');

        // Auto-generate username unik dari nama depan + 4 digit random
        $username = $this->generateUniqueUsername($request->name);

        $user = new User([
            'name' => $request->name,
            'username' => $username,
            'email' => $request->email,
            'phone' => $request->phone,
            'nomor_anggota' => $request->nomor_anggota,
            'password' => $request->password,
            'address' => $request->address,
        ]);

        $user->role = $roleValue;
        $user->status = $statusValue;
        $user->approved_by = auth()->id();
        $user->approved_at = $statusValue === 'active' ? now() : null;

        if ($request->filled('created_at')) {
            $user->created_at = $request->input('created_at');
        }

        $user->save();

        // Buat transaksi saldo awal untuk user lama (migrasi data)
        if ($request->filled('saldo_awal')) {
            foreach ($request->input('saldo_awal') as $saldo) {
                $nominal = (float) ($saldo['nominal'] ?? 0);
                if ($nominal <= 0) {
                    continue;
                }

                Transaksi::create([
                    'nomor_referensi' => Transaksi::generateNomorReferensi(),
                    'user_id' => $user->id,
                    'jenis_tabungan_id' => $saldo['jenis_tabungan_id'],
                    'jenis_transaksi' => 'setor',
                    'nominal' => $nominal,
                    'metode_pembayaran' => 'cash',
                    'status_verifikasi' => 'terverifikasi',
                    'diverifikasi_oleh' => auth()->id(),
                    'diverifikasi_pada' => now(),
                    'catatan_admin' => 'Saldo awal migrasi data user lama (SALDO_AWAL_LEGACY).',
                    'catatan_user' => 'Saldo awal dari data sebelumnya.',
                    'tanggal_transaksi' => $request->input('created_at', now()->toDateString()),
                ]);
            }
        }

        AuditLog::record('create', $user);

        return $this->createdResponse(new UserResource($user), 'Pengguna berhasil dibuat.');
    }

    /**
     * Generate username unik: slug nama_depan + 4 digit random.
     */
    private function generateUniqueUsername(string $name): string
    {
        $base = preg_replace('/[^a-z0-9]/', '', strtolower(Str::slug(explode(' ', trim($name))[0], '')));
        if (strlen($base) < 3) {
            $base = 'user';
        }
        do {
            $candidate = $base.rand(1000, 9999);
        } while (User::where('username', $candidate)->exists());

        return $candidate;
    }

    /**
     * PUT /admin/users/{user}
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$user->id,
            'phone' => 'sometimes|string|max:20|unique:users,phone,'.$user->id,
            'nomor_anggota' => 'sometimes|string|regex:/^\d{10}$/|unique:users,nomor_anggota,'.$user->id,
            'address' => 'nullable|string|max:500',
            'role' => 'sometimes|string|in:admin,user',
            'created_at' => 'sometimes|date',
            'password' => 'sometimes|nullable|string|min:8',
            'password_confirmation' => 'sometimes|string',
        ]);

        $fillableFields = ['name', 'email', 'phone', 'nomor_anggota', 'address', 'created_at'];
        $allFields = ['name', 'email', 'phone', 'nomor_anggota', 'address', 'role', 'created_at'];
        $oldValues = $user->only($allFields);

        $user->fill($request->only($fillableFields));

        if ($request->filled('role')) {
            $user->role = $request->input('role');
        }

        // Update password hanya jika admin mengirimkan field password
        if ($request->filled('password')) {
            if ($request->input('password') !== $request->input('password_confirmation')) {
                return $this->errorResponse('Konfirmasi password tidak cocok.', 422);
            }
            $user->password = $request->input('password'); // akan di-hash via Cast
        }

        $user->save();
        AuditLog::record('update', $user, $oldValues, $user->fresh()->only($allFields));

        return $this->successResponse(new UserResource($user->fresh()), 'Data pengguna berhasil diperbarui.');
    }

    /**
     * PUT /admin/users/{user}/target-emas
     * Set/ubah target tabungan emas nasabah (admin-only).
     */
    public function updateTargetEmas(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'target_emas_gram' => 'nullable|numeric|min:0.01|max:1000000',
        ]);

        $oldTarget = $user->target_emas_gram;
        $user->target_emas_gram = $request->filled('target_emas_gram') ? round((float) $request->target_emas_gram, 6) : null;
        $user->save();

        AuditLog::record('update', $user, ['target_emas_gram' => $oldTarget], ['target_emas_gram' => $user->target_emas_gram]);

        return $this->successResponse(
            ['target_emas_gram' => $user->target_emas_gram !== null ? (float) $user->target_emas_gram : null],
            $user->target_emas_gram !== null
                ? "Target tabungan emas {$user->name} berhasil diatur."
                : "Target tabungan emas {$user->name} dihapus."
        );
    }

    /**
     * DELETE /admin/users/{user}
     */
    public function destroy(User $user): JsonResponse
    {
        AuditLog::record('delete', $user);
        $user->delete(); // soft delete

        return $this->deletedResponse('Pengguna berhasil dihapus.');
    }

    /**
     * POST /admin/users/{user}/suspend
     */
    public function suspend(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Active) {
            return $this->errorResponse('Hanya akun aktif yang bisa dibekukan.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->status = UserStatus::Suspended;
        $user->save();

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::record('suspend', $user, $oldValues, ['status' => 'suspended']);

        $this->notif->kirim(
            $user,
            'Akun Dibekukan',
            'Akun Anda dibekukan oleh admin. Anda tidak dapat login sampai akun diaktifkan kembali. Hubungi admin untuk informasi lebih lanjut.',
            TipeNotifikasi::ApprovalAkun,
            ['status' => 'suspended']
        );

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil dibekukan.');
    }

    /**
     * POST /admin/users/{user}/activate
     */
    public function activate(User $user): JsonResponse
    {
        if ($user->status !== UserStatus::Suspended) {
            return $this->errorResponse('Hanya akun yang dibekukan yang bisa diaktifkan kembali.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $user->status->value];
        $user->status = UserStatus::Active;
        $user->approved_by = auth()->id();
        $user->approved_at = now();
        $user->save();

        AuditLog::record('activate', $user, $oldValues, ['status' => 'active']);

        $this->notif->kirim(
            $user,
            'Akun Diaktifkan Kembali',
            'Akun Anda telah diaktifkan kembali oleh admin. Anda sudah bisa login dan bertransaksi seperti biasa.',
            TipeNotifikasi::ApprovalAkun,
            ['status' => 'active']
        );

        return $this->successResponse(new UserResource($user->fresh()), 'Akun berhasil diaktifkan kembali.');
    }

    /**
     * GET /admin/users/export
     */
    public function export(Request $request): BinaryFileResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:active,rejected,suspended',
            'role' => 'nullable|string|in:admin,user',
            'search' => 'nullable|string|max:255',
        ]);

        $filename = 'data_nasabah_berkah_mulia_'.now()->format('Y-m-d').'.xlsx';

        return Excel::download(
            new UsersExport($request->status, $request->role, $request->search),
            $filename
        );
    }

    /**
     * GET /admin/users/import/template
     */
    public function importTemplate(): BinaryFileResponse
    {
        return Excel::download(new UsersTemplate, 'template_import_nasabah.xlsx');
    }

    /**
     * POST /admin/users/import
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,csv|max:10240',
        ]);

        $import = new UsersImport;
        try {
            DB::transaction(function () use ($import, $request) {
                Excel::import($import, $request->file('file'));
                $import->prosesTabungan();
            });
        } catch (\Throwable $e) {
            Log::error('Import user gagal: '.$e->getMessage(), ['exception' => $e]);

            return $this->errorResponse('Import gagal. Tidak ada data yang diubah.', 500);
        }

        $ditambahkan = $import->getCreatedCount();
        $diupdate = $import->getUpdatedCount();
        $dilewati = $import->getSkippedCount();

        // Tidak ada satu baris pun terbaca (file kosong / header tidak cocok
        // dengan template). Jangan balas sukses supaya tidak menyesatkan.
        if ($ditambahkan === 0 && $diupdate === 0 && $dilewati === 0) {
            return $this->errorResponse(
                $this->pesanImportKosong($request->file('file')),
                422,
                'IMPORT_KOSONG'
            );
        }

        $tabungan = [
            'target_diatur' => $import->getTargetCount(),
            'saldo_awal_dicatat' => $import->getSaldoAwalCreatedCount(),
            'saldo_awal_diubah' => $import->getSaldoAwalChangedCount(),
            'saldo_awal_dihapus' => $import->getSaldoAwalRemovedCount(),
        ];

        AuditLog::record('import', $request->user(), [], [
            'jumlah_ditambahkan' => $ditambahkan,
            'jumlah_diupdate' => $diupdate,
            'jumlah_dilewati' => $dilewati,
            'tabungan' => $tabungan,
        ]);

        return $this->successResponse([
            'jumlah_ditambahkan' => $ditambahkan,
            'jumlah_diupdate' => $diupdate,
            'jumlah_dilewati' => $dilewati,
            'detail_dilewati' => $import->getSkippedDetail(),
            'tabungan' => $tabungan,
        ], "Import selesai. {$ditambahkan} ditambahkan, {$diupdate} diupdate, {$dilewati} dilewati.");
    }

    /**
     * Diagnosa kenapa file import tidak terbaca sama sekali: periksa seluruh
     * sheet, baris terakhir berisi data, dan kolom mana yang berisi isian,
     * supaya langsung terlihat letak data sebenarnya.
     */
    private function pesanImportKosong($file): string
    {
        try {
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getRealPath());
        } catch (\Throwable $e) {
            Log::warning('Gagal membaca header file import: '.$e->getMessage());

            return 'File tidak terbaca. Pastikan formatnya xlsx/xls/csv dan unduh ulang template terbaru.';
        }

        $report = [];
        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $barisNama = 0;
            $dataDiKolomLain = [];
            $barisKolomPertama = null;

            $cells = $sheet->getHighestDataRow() > 1
                ? $sheet->rangeToArray('A1:'.'D'.$sheet->getHighestDataRow(), '', true, false)
                : [];
            foreach ($cells as $i => $vals) {
                if ($i === 0) {
                    continue; // heading
                }
                $nama = trim((string) ($vals[0] ?? ''));
                if ($nama !== '' && $nama !== \App\Imports\UsersImport::CONTOH_NAMA) {
                    $barisNama++;
                    $barisKolomPertama ??= 'baris '.($i + 1).', nilai '.$nama;
                }
                foreach ($vals as $c => $v) {
                    if ($c > 0 && trim((string) $v) !== '') {
                        $dataDiKolomLain[$c] = ($dataDiKolomLain[$c] ?? 0) + 1;
                    }
                }
            }

            $colLabels = ['B', 'C', 'D'];
            $kolomTerisi = [];
            foreach ($dataDiKolomLain as $c => $count) {
                $kolomTerisi[] = ($colLabels[$c - 1] ?? $c).' ('.$count.' sel)';
            }

            $sheetInfo = 'sheet "'.$sheet->getTitle().'": '
                .'nama terbaca '.$barisNama.' baris';
            if ($barisKolomPertama !== null) {
                $sheetInfo .= ', contoh nama pertama: '.$barisKolomPertama;
            } elseif ($barisNama === 0) {
                $sheetInfo .= ', tidak ada satu pun nama di kolom A';
            }
            $sheetInfo .= '. '.($kolomTerisi
                ? 'Kolom lain yang berisi data: '.implode(', ', array_slice($kolomTerisi, 0, 6)).'.'
                : 'Kolom lain kosong semua.');

            $report[] = $sheetInfo;
        }

        $usp = \App\Imports\UsersImport::CONTOH_NAMA;

        return 'Import tidak menemukan nama nasabah di kolom A (Nama Lengkap). Pemeriksaan: '.implode(' ', $report)
            .' Catatan: baris "'.$usp.'" adalah baris contoh template yang sengaja dilewati, bukan data. '
            .'Isi nama di kolom A mulai baris 3 dan pastikan hanya ada satu sheet berisi data.';
    }

    /**
     * GET /admin/users/import-laporan/template
     */
    public function importLaporanTemplate(): BinaryFileResponse
    {
        return Excel::download(new LaporanHarianTemplate, 'template_import_laporan_harian.xlsx');
    }

    /**
     * POST /admin/users/import-laporan
     * Import dari format Laporan Harian koperasi (Excel).
     * Auto-create user baru berdasarkan nama nasabah + catat transaksi historis.
     */
    public function importLaporan(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ]);

        $import = new LaporanHarianImport;
        try {
            DB::transaction(function () use ($import, $request) {
                Excel::import($import, $request->file('file'));
            });
        } catch (\Throwable $e) {
            Log::error('Import laporan harian gagal: '.$e->getMessage(), ['exception' => $e]);

            return $this->errorResponse('Import gagal: '.$e->getMessage(), 500);
        }

        AuditLog::record('import_laporan', $request->user(), [], [
            'user_dibuat' => $import->getUserDibuat(),
            'transaksi_dibuat' => $import->getTransaksiDibuat(),
        ]);

        return $this->successResponse([
            'user_dibuat' => $import->getUserDibuat(),
            'transaksi_dibuat' => $import->getTransaksiDibuat(),
            'row_dilewati' => $import->getRowDilewati(),
            'detail_dilewati' => $import->getSkippedDetail(),
        ], "Import laporan selesai. {$import->getUserDibuat()} user baru, {$import->getTransaksiDibuat()} transaksi dicatat.");
    }
}
