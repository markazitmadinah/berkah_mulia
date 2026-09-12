<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\StatusVerifikasi;
use App\Enums\SubJenisTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\AuditLog;
use App\Models\JenisTabungan;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TabunganBerjangkaController extends Controller
{
    use ApiResponse;

    private const MAX_PER_USER = 5;

    public function __construct(
        private TransaksiService $transaksiService,
    ) {}

    /**
     * GET /tabungan-berjangka — daftar tabungan berjangka user.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $items = TabunganBerjangka::milikUser($userId)
            ->latest()
            ->get();

        $result = $items->map(function (TabunganBerjangka $tb) {
            $terkumpul = $tb->terkumpulNominal();
            $pct = $tb->target_nominal > 0 ? min(100, ($terkumpul / (float) $tb->target_nominal) * 100) : 0;
            $isJatuhTempo = $tb->isJatuhTempo();
            $isGoalReached = $tb->isGoalReached();
            $canWithdraw = $tb->canWithdraw();
            $sisaTarget = max(0, (float) $tb->target_nominal - $terkumpul);

            return [
                'id' => $tb->id,
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
                'is_jatuh_tempo' => $isJatuhTempo,
                'is_goal_reached' => $isGoalReached,
                'can_withdraw' => $canWithdraw,
                'sisa_target' => round($sisaTarget, 2),
                'created_at' => $tb->created_at?->toISOString(),
            ];
        });

        $aktifCount = $items->whereIn('status', ['aktif', 'menunggu_approval'])->count();

        return $this->successResponse([
            'items' => $result,
            'dapat_membuat' => $aktifCount < self::MAX_PER_USER,
            'slot_tersedia' => max(0, self::MAX_PER_USER - $aktifCount),
        ]);
    }

    /**
     * POST /tabungan-berjangka — user membuat tabungan berjangka baru (menunggu approval).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_nominal' => 'required|numeric|min:50000',
            'durasi_bulan' => 'required|integer|min:1|max:120',
            'frekuensi_setor' => 'required|in:harian,mingguan,bulanan',
            'catatan' => 'nullable|string|max:500',
        ]);

        $userId = $request->user()->id;

        // Check limit
        $aktifCount = TabunganBerjangka::milikUser($userId)
            ->whereIn('status', ['aktif', 'menunggu_approval'])
            ->count();

        if ($aktifCount >= self::MAX_PER_USER) {
            return $this->errorResponse('Sudah mencapai batas maksimal ' . self::MAX_PER_USER . ' tabungan berjangka aktif.', 422, 'LIMIT_REACHED');
        }

        $jenisBerjangka = JenisTabungan::where('sub_jenis', SubJenisTabungan::Berjangka)->first();
        if (! $jenisBerjangka) {
            return $this->errorResponse('Produk tabungan berjangka belum dikonfigurasi admin.', 400, 'PRODUK_TIDAK_ADA');
        }

        // Calculate nominal per periode
        $target = (float) $data['target_nominal'];
        $durasi = (int) $data['durasi_bulan'];
        $frekuensi = $data['frekuensi_setor'];

        $totalPeriode = match ($frekuensi) {
            'harian' => $durasi * 30,
            'mingguan' => $durasi * 4,
            'bulanan' => $durasi,
        };

        $nominalPerPeriode = $totalPeriode > 0 ? ceil($target / $totalPeriode / 1000) * 1000 : $target;

        $tb = TabunganBerjangka::create([
            'user_id' => $userId,
            'jenis_tabungan_id' => $jenisBerjangka->id,
            'target_nominal' => $target,
            'durasi_bulan' => $durasi,
            'frekuensi_setor' => $frekuensi,
            'nominal_per_periode' => $nominalPerPeriode,
            'status' => 'menunggu_approval',
            'catatan' => $data['catatan'] ?? null,
            'created_by' => $userId,
        ]);

        AuditLog::record('tabungan_berjangka.store', $tb, null, [
            'target' => $target,
            'durasi' => $durasi,
            'frekuensi' => $frekuensi,
        ]);

        return $this->createdResponse([
            'id' => $tb->id,
            'target_nominal' => (float) $tb->target_nominal,
            'durasi_bulan' => $tb->durasi_bulan,
            'nominal_per_periode' => (float) $tb->nominal_per_periode,
            'status' => $tb->status,
        ], 'Tabungan berjangka berhasil diajukan. Tunggu persetujuan admin.');
    }

    /**
     * POST /tabungan-berjangka/{id}/setor — user menyetor ke tabungan berjangka spesifik.
     */
    public function setor(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->user_id !== $request->user()->id) {
            return $this->errorResponse('Tabungan berjangka tidak ditemukan.', 404, 'NOT_FOUND');
        }

        if ($tabunganBerjangka->status !== 'aktif') {
            return $this->errorResponse('Setoran hanya dapat dilakukan pada tabungan berjangka yang aktif.', 422, 'NOT_ACTIVE');
        }

        if ($tabunganBerjangka->tanggal_jatuh_tempo && now()->startOfDay()->gt($tabunganBerjangka->tanggal_jatuh_tempo->endOfDay())) {
            return $this->errorResponse('Periode setoran telah berakhir karena sudah melewati tanggal jatuh tempo.', 423, 'DEADLINE_PASSED');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $transaksi = DB::transaction(function () use ($request, $tabunganBerjangka) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $tabunganBerjangka->jenis_tabungan_id,
                'tabungan_berjangka_id' => $tabunganBerjangka->id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'metode_pembayaran' => 'transfer',
                'rekening_bank_id' => $request->rekening_bank_id,
                'catatan_user' => $request->catatan_user ?: 'Setoran Tabungan Berjangka #' . $tabunganBerjangka->id,
            ]);

            if ($request->hasFile('bukti_transfer')) {
                $this->transaksiService->uploadBuktiTransfer($transaksi, $request->file('bukti_transfer'));
            }

            return $transaksi;
        });

        return $this->createdResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan', 'rekeningBank'])),
            'Setoran tabungan berjangka berhasil diajukan. Menunggu verifikasi admin.'
        );
    }

    /**
     * POST /tabungan-berjangka/{id}/cairkan — user mencairkan tabungan berjangka.
     * HANYA BISA JIKA SUDAH MENCAPAI GOAL & JATUH TEMPO!
     */
    public function cairkan(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->user_id !== $request->user()->id) {
            return $this->errorResponse('Tabungan berjangka tidak ditemukan.', 404, 'NOT_FOUND');
        }

        if ($tabunganBerjangka->status !== 'aktif') {
            return $this->errorResponse('Hanya tabungan berjangka aktif yang dapat dicairkan.', 422, 'STATUS_INVALID');
        }

        // Syarat 1: Sudah mencapai goal
        if (! $tabunganBerjangka->isGoalReached()) {
            $terkumpul = $tabunganBerjangka->terkumpulNominal();
            return $this->errorResponse(
                'Tabungan belum dapat ditarik karena belum mencapai goal target (Terkumpul: Rp ' . number_format($terkumpul, 0, ',', '.') . ' dari Target: Rp ' . number_format((float) $tabunganBerjangka->target_nominal, 0, ',', '.') . ').',
                422,
                'GOAL_NOT_REACHED'
            );
        }

        // Syarat 2: Dalam jangka waktu yang ditentukan (sudah jatuh tempo)
        if (! $tabunganBerjangka->isJatuhTempo()) {
            $tgl = $tabunganBerjangka->tanggal_jatuh_tempo ? $tabunganBerjangka->tanggal_jatuh_tempo->format('d/m/Y') : '-';
            return $this->errorResponse(
                'Tabungan berjangka belum dapat ditarik sebelum tanggal jatuh tempo (' . $tgl . ').',
                422,
                'NOT_MATURED'
            );
        }

        $request->validate([
            'bank_tujuan' => 'required|string|max:100',
            'no_rekening' => 'required|string|max:50',
            'atas_nama' => 'required|string|max:100',
            'catatan' => 'nullable|string|max:500',
        ]);

        $totalSaldo = $tabunganBerjangka->terkumpulNominal();
        if ($totalSaldo <= 0) {
            return $this->errorResponse('Tidak ada saldo untuk dicairkan.', 422, 'NO_BALANCE');
        }

        // Cegah dobel penarikan pending
        $hasPending = Transaksi::where('tabungan_berjangka_id', $tabunganBerjangka->id)
            ->where('jenis_transaksi', 'tarik')
            ->where('status_verifikasi', 'menunggu_verifikasi')
            ->exists();

        if ($hasPending) {
            return $this->errorResponse('Permohonan pencairan sebelumnya sedang diproses admin.', 409, 'ALREADY_PENDING');
        }

        $catatan = 'Pencairan Tabungan Berjangka (Goal Rp ' . number_format((float) $tabunganBerjangka->target_nominal, 0, ',', '.') . ' Tercapai & Jatuh Tempo) ke ' . $request->bank_tujuan . ' (' . $request->no_rekening . ' a.n ' . $request->atas_nama . ').' . ($request->catatan ? ' ' . $request->catatan : '');

        $transaksi = DB::transaction(function () use ($request, $tabunganBerjangka, $totalSaldo, $catatan) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $tabunganBerjangka->jenis_tabungan_id,
                'tabungan_berjangka_id' => $tabunganBerjangka->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $totalSaldo,
                'metode_pembayaran' => 'transfer',
                'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi,
                'catatan_user' => $catatan,
            ]);

            $tabunganBerjangka->update([
                'status' => 'selesai',
            ]);

            return $transaksi;
        });

        AuditLog::record('tabungan_berjangka.cairkan', $tabunganBerjangka, null, [
            'nominal' => $totalSaldo,
            'transaksi_id' => $transaksi->id,
        ]);

        return $this->successResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan', 'tabunganBerjangka'])),
            'Pengajuan pencairan tabungan berjangka berhasil dikirim! Menunggu verifikasi dan transfer dari admin.'
        );
    }

    /**
     * POST /tabungan-berjangka/{id}/batal — user membatalkan tabungan berjangka.
     */
    public function batal(Request $request, TabunganBerjangka $tabunganBerjangka): JsonResponse
    {
        if ($tabunganBerjangka->user_id !== $request->user()->id) {
            return $this->errorResponse('Tabungan berjangka tidak ditemukan.', 404, 'NOT_FOUND');
        }

        if (! in_array($tabunganBerjangka->status, ['menunggu_approval', 'aktif'])) {
            return $this->errorResponse('Tabungan berjangka tidak dapat dibatalkan.', 422, 'STATUS_TIDAK_VALID');
        }

        $tabunganBerjangka->update(['status' => 'batal']);

        AuditLog::record('tabungan_berjangka.batal', $tabunganBerjangka);

        return $this->successResponse(null, 'Tabungan berjangka berhasil dibatalkan.');
    }
}

