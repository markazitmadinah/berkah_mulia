<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeTabungan;
use App\Exports\TransaksiExport;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\AuditLog;
use App\Models\Transaksi;
use App\Services\ProgressCalculatorService;
use App\Services\QurbanTargetService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TransaksiController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransaksiService $transaksiService,
        private QurbanTargetService $qurbanService,
        private ProgressCalculatorService $progressService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Transaksi::with(['user', 'jenisTabungan', 'rekeningBank']);

        if ($request->filled('status')) {
            $query->where('status_verifikasi', $request->status);
        }
        if ($request->filled('metode')) {
            $query->where('metode_pembayaran', $request->metode);
        }
        if ($request->filled('jenis_tabungan_id')) {
            $query->where('jenis_tabungan_id', $request->jenis_tabungan_id);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nomor_referensi', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$search}%"));
            });
        }

        $perPage = min($request->input('per_page', 15), 100);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data transaksi.',
            'data' => TransaksiResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * GET /admin/transaksi/export
     */
    public function export(Request $request): BinaryFileResponse
    {
        $filename = 'transaksi_koperasi_berkah_mulia_' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(
            new TransaksiExport($request->status, $request->metode, $request->search),
            $filename
        );
    }

    public function show(Transaksi $transaksi): JsonResponse
    {
        $transaksi->load(['user', 'jenisTabungan', 'rekeningBank', 'diverifikasiOleh', 'pendaftaranQurban']);

        return $this->successResponse(new TransaksiResource($transaksi));
    }

    /**
     * POST /admin/transaksi/{transaksi}/verifikasi
     * Idempotent-safe: reject if already verified/rejected (409).
     */
    public function verifikasi(Transaksi $transaksi): JsonResponse
    {
        if (! $transaksi->isMenungguVerifikasi()) {
            return $this->errorResponse('Transaksi ini sudah diproses sebelumnya.', 409, 'CONFLICT');
        }

        // Balance guard for withdrawals: verify only if current balance can cover it.
        if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik) {
            $jenis = $transaksi->jenisTabungan;
            $user = $transaksi->user;
            if ($jenis && $user) {
                if ($jenis->tipe === TipeTabungan::Emas) {
                    // Emas balance is tracked in grams (unit_didapat), not rupiah.
                    // The withdrawal nominal is the rupiah market value (grams × price),
                    // so it must not be compared against rupiah actually deposited.
                    $saldoGram = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->terverifikasi()
                        ->sum('unit_didapat');

                    $pendingLainGram = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->where('jenis_transaksi', 'tarik')
                        ->where('id', '!=', $transaksi->id)
                        ->menungguVerifikasi()
                        ->sum('unit_didapat');

                    $tarikGram = abs((float) $transaksi->unit_didapat);
                    if ($tarikGram > ($saldoGram - (float) $pendingLainGram)) {
                        return $this->errorResponse('Saldo emas tidak mencukupi untuk memverifikasi penarikan ini.', 422, 'INSUFFICIENT_BALANCE');
                    }
                } else {
                    $saldo = $this->progressService->getSaldo($user, $jenis);
                    $pendingLain = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->where('jenis_transaksi', 'tarik')
                        ->where('id', '!=', $transaksi->id)
                        ->menungguVerifikasi()
                        ->sum('nominal');
                    if ($transaksi->nominal > ($saldo - $pendingLain)) {
                        return $this->errorResponse('Saldo tidak mencukupi untuk memverifikasi penarikan ini.', 422, 'INSUFFICIENT_BALANCE');
                    }
                }
            }
        }

        DB::transaction(function () use ($transaksi) {
            $oldValues = ['status_verifikasi' => $transaksi->status_verifikasi->value];

            $transaksi->update([
                'status_verifikasi' => StatusVerifikasi::Terverifikasi,
                'diverifikasi_oleh' => auth()->id(),
                'diverifikasi_pada' => now(),
            ]);

            // Clear emas goal after full withdrawal or cancel so progress bar resets.
            if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik
                && $transaksi->jenisTabungan?->tipe === TipeTabungan::Emas) {
                $transaksi->user->update(['target_emas_gram' => null]);
            }

            // Qurban total_terkumpul is updated automatically by TransaksiObserver::updated.

            AuditLog::record('verify', $transaksi, $oldValues, ['status_verifikasi' => 'terverifikasi']);
        });

        // TODO: Dispatch SendTransaksiVerifiedNotification

        return $this->successResponse(new TransaksiResource($transaksi->fresh()->load(['user', 'jenisTabungan'])), 'Transaksi berhasil diverifikasi.');
    }

    /**
     * POST /admin/transaksi/{transaksi}/tolak
     */
    public function tolak(Request $request, Transaksi $transaksi): JsonResponse
    {
        $request->validate([
            'catatan_admin' => 'required|string|max:500',
        ]);

        if (! $transaksi->isMenungguVerifikasi()) {
            return $this->errorResponse('Transaksi ini sudah diproses sebelumnya.', 409, 'CONFLICT');
        }

        $oldValues = ['status_verifikasi' => $transaksi->status_verifikasi->value];

        $transaksi->update([
            'status_verifikasi' => StatusVerifikasi::Ditolak,
            'diverifikasi_oleh' => auth()->id(),
            'diverifikasi_pada' => now(),
            'catatan_admin' => $request->catatan_admin,
        ]);

        AuditLog::record('reject', $transaksi, $oldValues, ['status_verifikasi' => 'ditolak', 'catatan_admin' => $request->catatan_admin]);

        // TODO: Dispatch SendTransaksiRejectedNotification

        return $this->successResponse(new TransaksiResource($transaksi->fresh()), 'Transaksi berhasil ditolak.');
    }

    /**
     * POST /admin/transaksi/cash
     * Admin inputs cash transaction → auto verified.
     */
    public function storeCash(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'jenis_tabungan_id' => 'required|exists:jenis_tabungan,id',
            'nominal' => 'required|numeric|min:1',
            'pendaftaran_qurban_id' => 'nullable|exists:pendaftaran_qurban,id',
            'catatan_admin' => 'nullable|string|max:500',
        ]);

        $transaksi = DB::transaction(function () use ($request) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user_id,
                'jenis_tabungan_id' => $request->jenis_tabungan_id,
                'pendaftaran_qurban_id' => $request->pendaftaran_qurban_id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'metode_pembayaran' => MetodePembayaran::Cash,
                'catatan_admin' => $request->catatan_admin,
                'auto_verify' => true,
            ]);

            // Update qurban progress if applicable
            if ($transaksi->pendaftaran_qurban_id) {
                $this->qurbanService->updateTotalTerkumpul($transaksi->pendaftaranQurban);
            }

            AuditLog::record('create_cash', $transaksi);

            return $transaksi;
        });

        return $this->createdResponse(
            new TransaksiResource($transaksi->load(['user', 'jenisTabungan'])),
            'Transaksi cash berhasil dicatat dan otomatis terverifikasi.'
        );
    }
}
