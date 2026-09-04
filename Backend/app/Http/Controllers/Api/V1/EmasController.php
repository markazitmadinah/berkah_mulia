<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\TipeNotifikasi;
use App\Enums\ChannelNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\HargaEmasHarianResource;
use App\Http\Resources\TransaksiResource;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\Notifikasi;
use App\Models\Transaksi;
use App\Services\EmasConversionService;
use App\Services\ProgressCalculatorService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmasController extends Controller
{
    use ApiResponse;

    public function __construct(
        private EmasConversionService $emasService,
        private TransaksiService $transaksiService,
        private ProgressCalculatorService $progressService,
    ) {}

    /**
     * GET /emas/harga-terkini
     */
    public function hargaTerkini(): JsonResponse
    {
        $harga = $this->emasService->getHargaTerkini();

        if (! $harga) {
            return $this->errorResponse('Harga emas belum tersedia.', 404, 'NOT_FOUND');
        }

        return $this->successResponse(new HargaEmasHarianResource($harga));
    }

    /**
     * GET /emas/harga-riwayat
     */
    public function hargaRiwayat(Request $request): JsonResponse
    {
        $query = HargaEmasHarian::query();

        if ($request->filled('dari')) {
            $query->where('tanggal', '>=', $request->dari);
        }
        if ($request->filled('sampai')) {
            $query->where('tanggal', '<=', $request->sampai);
        }

        $perPage = min($request->input('per_page', 15), 500);
        $items = $query->orderByDesc('tanggal')->orderByDesc('status_aktif')->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil riwayat harga emas.',
            'data' => HargaEmasHarianResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * POST /emas/setor
     */
    public function setor(Request $request): JsonResponse
    {
        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'metode_pembayaran' => 'required|string|in:transfer',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        // Get emas jenis tabungan
        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        // Harus set goal dulu sebelum bisa setor emas
        if ($request->user()->target_emas_gram === null) {
            return $this->errorResponse('Anda harus menetapkan target tabungan emas terlebih dahulu sebelum melakukan setoran.', 422, 'GOAL_NOT_SET');
        }

        // Check for duplicate
        if ($this->transaksiService->isDuplicate($request->user()->id, $jenisTabungan->id, JenisTransaksi::Setor->value, $request->nominal)) {
            return $this->errorResponse('Transaksi duplikat terdeteksi. Mohon tunggu sebentar sebelum mengirim ulang.', 409, 'DUPLICATE');
        }

        try {
            $konversi = $this->emasService->konversiNominalKeGram($request->nominal);
        } catch (\RuntimeException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $konversi) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'unit_didapat' => $konversi['unit_didapat'],
                'harga_acuan_id' => $konversi['harga_acuan_id'],
                'harga_acuan_snapshot' => $konversi['harga_acuan_snapshot'],
                'metode_pembayaran' => $request->metode_pembayaran,
                'rekening_bank_id' => $request->rekening_bank_id,
                'catatan_user' => $request->catatan_user,
            ]);

            // Upload bukti transfer if provided
            if ($request->hasFile('bukti_transfer')) {
                $this->transaksiService->uploadBuktiTransfer($transaksi, $request->file('bukti_transfer'));
            }

            return $transaksi;
        });

        $transaksi->load(['jenisTabungan', 'rekeningBank']);

        return $this->createdResponse(
            new TransaksiResource($transaksi),
            'Setoran emas berhasil dicatat. Menunggu verifikasi admin.'
        );
    }

    /**
     * POST /emas/tarik
     * Pencairan FULL saldo emas — hanya boleh jika goal tercapai.
     * Gram pemilik berkurang setelah diverifikasi admin.
     */
    public function tarik(Request $request): JsonResponse
    {
        $request->validate([
            'bank_tujuan' => 'required|string|max:100',
            'no_rekening' => 'required|string|max:50',
            'atas_nama' => 'required|string|max:100',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        try {
            $harga = $this->emasService->getHargaTerkini();
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }

        if (! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);
        $saldoGram = (float) $progress['total_unit'] ?? 0;

        if ($saldoGram <= 0) {
            return $this->errorResponse('Tidak ada saldo emas untuk dicairkan.', 422, 'INSUFFICIENT_BALANCE');
        }

        // Cairkan hanya diizinkan setelah goal tercapai.
        $target = $request->user()->target_emas_gram;
        if ($target === null || $saldoGram < (float) $target) {
            return $this->errorResponse('Pencairan hanya bisa diajukan setelah goal tabungan emas Anda tercapai.', 422, 'GOAL_NOT_REACHED');
        }

        // Include pending penarikan agar tidak terjadi overdraw beruntun.
        $pendingGram = Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->where('jenis_transaksi', 'tarik')
            ->menungguVerifikasi()
            ->sum('unit_didapat');

        if (($saldoGram + (float) $pendingGram) <= 0) {
            return $this->errorResponse('Saldo emas sudah habis atau sedang dalam penarikan lain.', 422, 'INSUFFICIENT_BALANCE');
        }

        $nominal = round($saldoGram * (float) $harga->harga_per_gram, 2);

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $saldoGram, $nominal, $harga) {
            return $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $nominal,
                'unit_didapat' => -1 * $saldoGram,
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $harga->harga_per_gram,
                'metode_pembayaran' => MetodePembayaran::Transfer,
                'catatan_user' => $request->catatan_user
                    ? "Pencairan full saldo ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}). {$request->catatan_user}"
                    : "Pencairan full saldo ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}).",
            ]);
        });

        return $this->createdResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan', 'rekeningBank'])),
            'Permohonan pencairan emas diajukan. Menunggu verifikasi admin.'
        );
    }

    /**
     * POST /emas/tukar
     * Tukar emas fisik di toko — hanya boleh jika goal tercapai.
     * Langsung selesai (auto-verified): gram berkurang, goal di-reset, notif ke admin & user.
     */
    public function tukar(Request $request): JsonResponse
    {
        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        $harga = $this->emasService->getHargaTerkini();
        if (! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);
        $saldoGram = (float) ($progress['total_unit'] ?? 0);

        if ($saldoGram <= 0) {
            return $this->errorResponse('Tidak ada saldo emas untuk ditukar.', 422, 'INSUFFICIENT_BALANCE');
        }

        $target = $request->user()->target_emas_gram;
        if ($target === null || $saldoGram < (float) $target) {
            return $this->errorResponse('Tukar emas hanya bisa dilakukan setelah goal tabungan emas Anda tercapai.', 422, 'GOAL_NOT_REACHED');
        }

        $nominal = round($saldoGram * (float) $harga->harga_per_gram, 2);

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $saldoGram, $nominal, $harga) {
            return $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $nominal,
                'unit_didapat' => -1 * $saldoGram,
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $harga->harga_per_gram,
                'metode_pembayaran' => MetodePembayaran::Cash,
                'catatan_user' => 'Penukaran emas fisik di toko.',
                'auto_verify' => true,
            ]);
        });

        // Reset goal emas setelah tukar selesai (gram sudah berkurang).
        $request->user()->update(['target_emas_gram' => null]);

        // Notif ke user: silakan ambil emas di toko.
        Notifikasi::create([
            'user_id' => $request->user()->id,
            'judul' => 'Silakan Ambil Emas di Toko',
            'pesan' => 'Selamat! Anda sudah mencapai target tabungan emas. Silakan ambil emas fisik Anda di toko sebesar ' . number_format($saldoGram, 4, ',', '.') . ' gram dengan menunjukkan bukti penukaran.',
            'tipe' => TipeNotifikasi::Info,
            'channel' => ChannelNotifikasi::InApp,
            'data' => ['jenis_tabungan' => 'emas'],
        ]);

        // Notif ke semua admin: user sudah mencapai target.
        $admins = \App\Models\User::where('role', \App\Enums\UserRole::Admin)->get();
        foreach ($admins as $admin) {
            Notifikasi::create([
                'user_id' => $admin->id,
                'judul' => 'User Mencapai Target Emas',
                'pesan' => $request->user()->name . ' sudah mencapai target tabungan emas dan menukar ' . number_format($saldoGram, 4, ',', '.') . ' gram di toko.',
                'tipe' => TipeNotifikasi::Verifikasi,
                'channel' => ChannelNotifikasi::InApp,
                'data' => ['jenis_tabungan' => 'emas'],
            ]);
        }

        return $this->successResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan'])),
            'Penukaran emas berhasil. Silakan ambil emas Anda di toko.'
        );
    }

    /**
     * POST /emas/batal
     * Batalkan tabungan emas sebelum goal tercapai → refund 90% dari nilai saldo
     * (potongan 10% dari nilai saldo terkumpul). Sisa gram dinolkan setelah diverifikasi admin.
     */
    public function batal(Request $request): JsonResponse
    {
        $request->validate([
            'bank_tujuan' => 'required|string|max:100',
            'no_rekening' => 'required|string|max:50',
            'atas_nama' => 'required|string|max:100',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        $harga = $this->emasService->getHargaTerkini();
        if (! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);
        $saldoGram = (float) $progress['total_unit'] ?? 0;

        if ($saldoGram <= 0) {
            return $this->errorResponse('Tidak ada saldo emas untuk dibatalkan.', 422, 'INSUFFICIENT_BALANCE');
        }

        // Batal hanya jika goal BELUM tercapai.
        $target = $request->user()->target_emas_gram;
        if ($target !== null && $saldoGram >= (float) $target) {
            return $this->errorResponse('Goal tabungan emas sudah tercapai. Gunakan pencairan, bukan pembatalan.', 422, 'GOAL_REACHED');
        }

        $hargaPerGram = (float) $harga->harga_per_gram;
        $nilaiSaldo = round($saldoGram * $hargaPerGram, 2);
        $penalti = round($nilaiSaldo * 0.10, 2);
        $refund = round($nilaiSaldo - $penalti, 2);

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $saldoGram, $nilaiSaldo, $penalti, $refund, $harga) {
            return $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $nilaiSaldo,
                'unit_didapat' => -1 * $saldoGram,
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $harga->harga_per_gram,
                'biaya_penalti' => $penalti,
                'metode_pembayaran' => MetodePembayaran::Transfer,
                'catatan_user' => $request->catatan_user
                    ? "Pembatalan tabungan emas. Refund 90%: Rp " . number_format($refund, 0, ',', '.') . " (potong 10%: Rp " . number_format($penalti, 0, ',', '.') . ") ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}). {$request->catatan_user}"
                    : "Pembatalan tabungan emas. Refund 90%: Rp " . number_format($refund, 0, ',', '.') . " (potong 10%: Rp " . number_format($penalti, 0, ',', '.') . ") ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}).",
            ]);
        });

        return $this->createdResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan', 'rekeningBank'])),
            'Permohonan pembatalan & refund diajukan. Menunggu verifikasi admin.'
        );
    }

    /**
     * PUT /emas/goal
     */
    public function updateGoal(Request $request): JsonResponse
    {
        $request->validate([
            'target_emas_gram' => 'nullable|numeric|min:0.01|max:1000000',
        ]);

        $user = $request->user();

        // Goal sudah ditetapkan → terkunci. Hanya bisa diubah setelah goal tercapai
        // dan goal dihapus oleh admin saat verifikasi pencairan (cair/batal).
        if ($user->target_emas_gram !== null) {
            return $this->errorResponse('Target sudah ditetapkan. Target hanya bisa diubah setelah goal tercapai dan dikonfirmasi admin.', 422, 'GOAL_LOCKED');
        }

        $user->target_emas_gram = $request->filled('target_emas_gram') ? $request->target_emas_gram : null;
        $user->save();

        return $this->successResponse(
            ['target_emas_gram' => $user->target_emas_gram !== null ? (float) $user->target_emas_gram : null],
            $user->target_emas_gram !== null
                ? 'Target tabungan emas berhasil disimpan.'
                : 'Target tabungan emas dihapus.'
        );
    }
}
