<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeNotifikasi;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\JenisTabungan;
use App\Models\TabunganBerjangka;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TabunganBerjangkaController extends Controller
{
    use ApiResponse;

    public function __construct(private NotifikasiService $notif) {}

    /**
     * GET /admin/tabungan-berjangka — semua tabungan berjangka nasabah.
     */
    public function index(Request $request): JsonResponse
    {
        $query = TabunganBerjangka::with('user:id,name,phone,nomor_anggota')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status), fn ($q) => $q->where('status', '!=', 'batal'))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->user_id))
            ->latest();

        $items = $query->paginate(min((int) ($request->per_page ?? 25), 100));

        return $this->successResponse([
            'items' => collect($items->items())->map(fn (TabunganBerjangka $tb) => $this->toArray($tb)),
            'summary' => [
                'menunggu_approval' => TabunganBerjangka::where('status', 'menunggu_approval')->count(),
                'aktif' => TabunganBerjangka::where('status', 'aktif')->count(),
                'pembatalan_diajukan' => TabunganBerjangka::where('status', 'pembatalan_diajukan')->count(),
                'selesai' => TabunganBerjangka::where('status', 'selesai')->count(),
                'dibatalkan' => TabunganBerjangka::where('status', 'batal')->count(),
            ],
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * POST /admin/tabungan-berjangka — admin membuat tabungan berjangka untuk user (auto-approve).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'target_nominal' => 'required|numeric|min:50000',
            'durasi_bulan' => 'required|integer|min:1|max:120',
            'frekuensi_setor' => 'required|in:harian,mingguan,bulanan',
            'catatan' => 'nullable|string|max:500',
        ]);

        $peserta = User::find($data['user_id']);
        if (! $peserta || $peserta->role !== UserRole::User) {
            return $this->errorResponse('Peserta tidak ditemukan atau bukan nasabah.', 422, 'PESERTA_INVALID');
        }

        $jenisBerjangka = JenisTabungan::where('sub_jenis', SubJenisTabungan::Berjangka)->first();
        if (! $jenisBerjangka) {
            return $this->errorResponse('Produk tabungan berjangka belum dikonfigurasi.', 400, 'PRODUK_TIDAK_ADA');
        }

        $aktifCount = TabunganBerjangka::milikUser($peserta->id)
            ->whereIn('status', ['aktif', 'menunggu_approval'])
            ->count();

        if ($aktifCount >= 5) {
            return $this->errorResponse('Nasabah sudah mencapai batas maksimal 5 tabungan berjangka aktif.', 422, 'LIMIT_REACHED');
        }

        $target = (float) $data['target_nominal'];
        $durasi = (int) $data['durasi_bulan'];
        $frekuensi = $data['frekuensi_setor'];

        $totalPeriode = match ($frekuensi) {
            'harian' => $durasi * 30,
            'mingguan' => $durasi * 4,
            'bulanan' => $durasi,
        };

        $nominalPerPeriode = $totalPeriode > 0 ? ceil($target / $totalPeriode * 100) / 100 : $target;

        // Admin create → auto-approve
        $tb = TabunganBerjangka::create([
            'user_id' => $peserta->id,
            'jenis_tabungan_id' => $jenisBerjangka->id,
            'target_nominal' => $target,
            'durasi_bulan' => $durasi,
            'frekuensi_setor' => $frekuensi,
            'nominal_per_periode' => $nominalPerPeriode,
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths($durasi)->toDateString(),
            'status' => 'aktif',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'catatan' => $data['catatan'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('tabungan_berjangka.admin_store', $tb, null, [
            'target' => $target,
            'durasi' => $durasi,
        ]);

        $this->notif->kirim(
            $peserta,
            'Tabungan Berjangka Aktif',
            'Tabungan berjangka Anda sebesar Rp ' . number_format($target, 0, ',', '.')
                . ' telah diaktifkan. Setoran ' . $tb->frekuensiLabel() . ' Rp '
                . number_format($nominalPerPeriode, 0, ',', '.') . ' selama ' . $durasi . ' bulan.',
            TipeNotifikasi::Info,
            ['tabungan_berjangka_id' => $tb->id]
        );

        return $this->createdResponse(
            $this->toArray($tb->load('user:id,name,phone,nomor_anggota')),
            'Tabungan berjangka berhasil dibuat dan langsung aktif.'
        );
    }

    /**
     * POST /admin/tabungan-berjangka/{id}/approve — approve tabungan berjangka user.
     */
    public function approve(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->status !== 'menunggu_approval') {
            return $this->errorResponse('Hanya tabungan berstatus menunggu approval yang bisa disetujui.', 422, 'STATUS_TIDAK_VALID');
        }

        $tabunganBerjangka->update([
            'status' => 'aktif',
            'tanggal_mulai' => now()->toDateString(),
            'tanggal_jatuh_tempo' => now()->addMonths($tabunganBerjangka->durasi_bulan)->toDateString(),
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('tabungan_berjangka.approve', $tabunganBerjangka);

        $this->notif->kirim(
            $tabunganBerjangka->user,
            'Tabungan Berjangka Disetujui',
            'Tabungan berjangka Anda sebesar Rp ' . number_format((float) $tabunganBerjangka->target_nominal, 0, ',', '.')
                . ' disetujui dan mulai aktif. Setoran ' . $tabunganBerjangka->frekuensiLabel() . ' Rp '
                . number_format((float) $tabunganBerjangka->nominal_per_periode, 0, ',', '.') . '.',
            TipeNotifikasi::Info,
            ['tabungan_berjangka_id' => $tabunganBerjangka->id]
        );

        return $this->successResponse(
            $this->toArray($tabunganBerjangka->fresh()->load('user:id,name,phone,nomor_anggota')),
            'Tabungan berjangka disetujui dan mulai aktif.'
        );
    }

    /**
     * POST /admin/tabungan-berjangka/{id}/tolak — tolak tabungan berjangka user.
     */
    public function tolak(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->status !== 'menunggu_approval') {
            return $this->errorResponse('Hanya tabungan berstatus menunggu approval yang bisa ditolak.', 422, 'STATUS_TIDAK_VALID');
        }

        $tabunganBerjangka->update(['status' => 'batal']);

        AuditLog::record('tabungan_berjangka.tolak', $tabunganBerjangka);

        $this->notif->kirim(
            $tabunganBerjangka->user,
            'Tabungan Berjangka Ditolak',
            'Pengajuan tabungan berjangka Anda ditolak admin.',
            TipeNotifikasi::Verifikasi,
            ['tabungan_berjangka_id' => $tabunganBerjangka->id]
        );

        return $this->successResponse(null, 'Tabungan berjangka ditolak.');
    }

    /**
     * POST /admin/tabungan-berjangka/{id}/verifikasi-pembatalan — verifikasi pembatalan
     * tabungan berjangka yang diajukan nasabah. Dana dikembalikan utuh lalu tabungan hilang dari daftar.
     */
    public function verifikasiPembatalan(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->status !== 'pembatalan_diajukan') {
            return $this->errorResponse('Hanya tabungan berstatus pengajuan pembatalan yang dapat diverifikasi.', 422, 'STATUS_TIDAK_VALID');
        }

        $saldo = $tabunganBerjangka->terkumpulNominal();

        $transaksi = DB::transaction(function () use ($request, $tabunganBerjangka, $saldo) {
            if ($saldo > 0) {
                $transaksi = (new TransaksiService)->buatTransaksi([
                    'user_id' => $tabunganBerjangka->user_id,
                    'jenis_tabungan_id' => $tabunganBerjangka->jenis_tabungan_id,
                    'tabungan_berjangka_id' => $tabunganBerjangka->id,
                    'jenis_transaksi' => JenisTransaksi::Tarik,
                    'nominal' => $saldo,
                    'metode_pembayaran' => 'transfer',
                    'status_verifikasi' => StatusVerifikasi::Terverifikasi,
                    'diverifikasi_oleh' => $request->user()->id,
                    'diverifikasi_pada' => now(),
                    'catatan_admin' => 'Pengembalian dana utuh pembatalan tabungan berjangka #' . $tabunganBerjangka->id . '.',
                ]);
            }

            $tabunganBerjangka->update(['status' => 'batal']);

            return $transaksi ?? null;
        });

        AuditLog::record('tabungan_berjangka.verifikasi_pembatalan', $tabunganBerjangka, null, [
            'saldo' => $saldo,
            'transaksi_id' => $transaksi?->id,
        ]);

        $this->notif->kirim(
            $tabunganBerjangka->user,
            'Pembatalan Disetujui & Dana Dikembalikan',
            $saldo > 0
                ? 'Pembatalan tabungan berjangka #' . $tabunganBerjangka->id . ' disetujui. Saldo Rp ' . number_format($saldo, 0, ',', '.') . ' dikembalikan utuh.'
                : 'Pembatalan tabungan berjangka #' . $tabunganBerjangka->id . ' disetujui.',
            TipeNotifikasi::Info,
            ['tabungan_berjangka_id' => $tabunganBerjangka->id]
        );

        return $this->successResponse(
            $this->toArray($tabunganBerjangka->fresh()->load('user:id,name,phone,nomor_anggota')),
            $saldo > 0
                ? 'Pembatalan diverifikasi. Dana Rp ' . number_format($saldo, 0, ',', '.') . ' dikembalikan utuh ke nasabah.'
                : 'Pembatalan diverifikasi.'
        );
    }

    private function toArray(TabunganBerjangka $tb): array
    {
        $terkumpul = $tb->terkumpulNominal();
        $pct = $tb->target_nominal > 0 ? min(100, ($terkumpul / (float) $tb->target_nominal) * 100) : 0;

        return [
            'id' => $tb->id,
            'user_id' => $tb->user_id,
            'user' => $tb->relationLoaded('user') ? $tb->user?->only(['id', 'name', 'phone', 'nomor_anggota']) : null,
            'target_nominal' => (float) $tb->target_nominal,
            'durasi_bulan' => $tb->durasi_bulan,
            'frekuensi_setor' => $tb->frekuensi_setor,
            'frekuensi_label' => $tb->frekuensiLabel(),
            'nominal_per_periode' => (float) $tb->nominal_per_periode,
            'tanggal_mulai' => $tb->tanggal_mulai?->toDateString(),
            'tanggal_jatuh_tempo' => $tb->tanggal_jatuh_tempo?->toDateString(),
            'status' => $tb->status,
            'catatan' => $tb->catatan,
            'terkumpul' => round($terkumpul, 2),
            'persentase' => round($pct, 1),
            'is_jatuh_tempo' => $tb->isJatuhTempo(),
            'is_goal_reached' => $tb->isGoalReached(),
            'can_withdraw' => $tb->canWithdraw(),
            'sisa_target' => max(0, round((float) $tb->target_nominal - $terkumpul, 2)),
            'created_at' => $tb->created_at?->toISOString(),
        ];
    }
}
