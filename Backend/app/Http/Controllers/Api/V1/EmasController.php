<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\ChannelNotifikasi;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\HargaEmasHarianResource;
use App\Http\Resources\TransaksiResource;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
use App\Services\EmasConversionService;
use App\Services\NotifikasiService;
use App\Services\ProgressCalculatorService;
use App\Services\SaldoEmasService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class EmasController extends Controller
{
    use ApiResponse;

    public function __construct(
        private EmasConversionService $emasService,
        private TransaksiService $transaksiService,
        private ProgressCalculatorService $progressService,
        private SaldoEmasService $saldoEmasService,
        private NotifikasiService $notif,
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
        $request->validate([
            'dari' => 'nullable|date',
            'sampai' => 'nullable|date',
        ]);

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
            'konfigurasi_id' => 'nullable|exists:konfigurasi_setoran_emas,id',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        // Get emas jenis tabungan
        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        // Check for duplicate
        if ($this->transaksiService->isDuplicate($request->user()->id, $jenisTabungan->id, JenisTransaksi::Setor->value, $request->nominal)) {
            return $this->errorResponse('Transaksi duplikat terdeteksi. Mohon tunggu sebentar sebelum mengirim ulang.', 409, 'DUPLICATE');
        }

        // Rencana tujuan setoran: eksplisit via konfigurasi_id, atau fallback rencana aktif terbaru.
        $konfigurasi = null;
        if ($request->filled('konfigurasi_id')) {
            $konfigurasi = KonfigurasiSetoranEmas::aktif()
                ->where('id', $request->konfigurasi_id)
                ->where('user_id', $request->user()->id)
                ->where('jenis_tabungan_id', $jenisTabungan->id)
                ->first();

            if (! $konfigurasi) {
                return $this->errorResponse('Rencana setoran berkala tidak aktif atau bukan milik Anda.', 422, 'TIDAK_AKTIF');
            }
        } else {
            $konfigurasi = $this->saldoEmasService->getAktif($request->user(), $jenisTabungan);
        }

        if ($konfigurasi && $this->saldoEmasService->refundTerkunci($request->user(), $konfigurasi)) {
            return $this->errorResponse('Rencana ini sedang menunggu verifikasi pengajuan batal & refund. Setoran tidak dapat dilakukan.', 422, 'REFUND_PENDING');
        }

        // Goal global boleh null untuk user lama/manual — adopsi target rencana aktif terbaru.
        if ($request->user()->target_emas_gram === null) {
            if ($konfigurasi?->target_gram_total !== null) {
                $request->user()->update(['target_emas_gram' => round((float) $konfigurasi->target_gram_total, 6)]);
            } else {
                return $this->errorResponse('Anda harus menetapkan target tabungan emas terlebih dahulu sebelum melakukan setoran.', 422, 'GOAL_NOT_SET');
            }
        }

        $harga = $this->emasService->getHargaTerkini();

        if (! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
        }

        $saldoDana = $this->saldoEmasService->getSaldoDana($request->user(), $jenisTabungan);
        $porsi = $this->saldoEmasService->hitungSetoran(
            (float) $request->nominal,
            $konfigurasi,
            $saldoDana,
            (float) $harga->harga_per_gram
        );

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $porsi, $harga, $konfigurasi) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'konfigurasi_id' => $konfigurasi?->id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'nominal_emas' => $porsi['nominal_emas'],
                'nominal_selisih' => $porsi['nominal_selisih'],
                'unit_didapat' => $porsi['unit_didapat'],
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $harga->harga_per_gram,
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
            'no_rekening' => 'required|numeric|digits_between:6,20',
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
            \Illuminate\Support\Facades\Log::error('Gagal mengambil harga emas: ' . $e->getMessage());
            return $this->errorResponse('Gagal mengambil harga emas. Silakan coba lagi.', 400);
        }

        if (! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
        }

        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);
        $saldoGram = (float) ($progress['total_unit'] ?? 0);

        if ($saldoGram <= 0) {
            return $this->errorResponse('Tidak ada saldo emas untuk dicairkan.', 422, 'INSUFFICIENT_BALANCE');
        }

        // Cairkan hanya diizinkan setelah goal tercapai.
        $target = $request->user()->target_emas_gram;
        if ($target === null || $saldoGram < (float) $target) {
            return $this->errorResponse('Pencairan hanya bisa diajukan setelah goal tabungan emas Anda tercapai.', 422, 'GOAL_NOT_REACHED');
        }

        // Anti overdraw & double payout: hanya SATU pengajuan penarikan/pembatalan
        // yang boleh menunggu verifikasi pada satu waktu (tarik = full saldo).
        if ($this->adaPengajuanPending($request, $jenisTabungan)) {
            return $this->errorResponse('Anda masih memiliki pengajuan penarikan/pembatalan yang menunggu verifikasi admin.', 422, 'WITHDRAWAL_PENDING');
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

        // Anti overdraw: emas fisik tidak boleh ditukar saat masih ada pengajuan penarikan pending.
        if ($this->adaPengajuanPending($request, $jenisTabungan)) {
            return $this->errorResponse('Anda masih memiliki pengajuan penarikan yang menunggu verifikasi admin.', 422, 'WITHDRAWAL_PENDING');
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
        $this->notif->kirim(
            $request->user(),
            'Silakan Ambil Emas di Toko',
            'Selamat! Anda sudah mencapai target tabungan emas. Silakan ambil emas fisik Anda di toko sebesar '
                . number_format($saldoGram, 4, ',', '.')
                . ' gram dengan menunjukkan bukti penukaran.',
            TipeNotifikasi::Info,
            ['jenis_tabungan' => 'emas']
        );

        // Notif ke semua admin: user sudah mencapai target.
        $this->notif->kirimKeSemuaAdmin(
            'User Mencapai Target Emas',
            $request->user()->name
                . ' sudah mencapai target tabungan emas dan menukar '
                . number_format($saldoGram, 4, ',', '.')
                . ' gram di toko.',
            TipeNotifikasi::Verifikasi,
            ['jenis_tabungan' => 'emas']
        );

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
            'no_rekening' => 'required|numeric|digits_between:6,20',
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
        $saldoGram = (float) ($progress['total_unit'] ?? 0);
        $saldoDana = $this->saldoEmasService->getSaldoDana($request->user(), $jenisTabungan);

        if ($saldoGram <= 0 && $saldoDana <= 0) {
            return $this->errorResponse('Tidak ada saldo emas untuk dibatalkan.', 422, 'INSUFFICIENT_BALANCE');
        }

        // Batal hanya jika goal BELUM tercapai.
        $target = $request->user()->target_emas_gram;
        if ($target !== null && $saldoGram >= (float) $target) {
            return $this->errorResponse('Goal tabungan emas sudah tercapai. Gunakan pencairan, bukan pembatalan.', 422, 'GOAL_REACHED');
        }

        // Anti overdraw / refund ganda: batal ditolak selama ada pengajuan tarik/batal lain.
        if ($this->adaPengajuanPending($request, $jenisTabungan)) {
            return $this->errorResponse('Anda masih memiliki pengajuan penarikan/pembatalan yang menunggu verifikasi admin.', 422, 'WITHDRAWAL_PENDING');
        }

        $hargaPerGram = (float) $harga->harga_per_gram;
        $nilaiSaldo = round($saldoGram * $hargaPerGram, 2);
        $penalti = round($nilaiSaldo * 0.10, 2);
        $refundEmas = round($nilaiSaldo - $penalti, 2);
        $refundTotal = round($refundEmas + $saldoDana, 2);

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $saldoGram, $nilaiSaldo, $penalti, $refundEmas, $refundTotal, $saldoDana, $hargaPerGram, $harga) {
            return $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $refundTotal,
                'nominal_emas' => $nilaiSaldo,
                'nominal_selisih' => -1 * $saldoDana,
                'unit_didapat' => -1 * $saldoGram,
                'harga_acuan_id' => $harga->id,
                'harga_acuan_snapshot' => $hargaPerGram,
                'biaya_penalti' => $penalti,
                'metode_pembayaran' => MetodePembayaran::Transfer,
                'catatan_user' => $request->catatan_user
                    ? "Pembatalan tabungan emas. Refund: emas 90% (Rp " . number_format($refundEmas, 0, ',', '.') . " setelah potong 10% Rp " . number_format($penalti, 0, ',', '.') . ") + saldo dana 100% (Rp " . number_format($saldoDana, 0, ',', '.') . ") = Rp " . number_format($refundTotal, 0, ',', '.') . " ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}). {$request->catatan_user}"
                    : "Pembatalan tabungan emas. Refund: emas 90% (Rp " . number_format($refundEmas, 0, ',', '.') . " setelah potong 10% Rp " . number_format($penalti, 0, ',', '.') . ") + saldo dana 100% (Rp " . number_format($saldoDana, 0, ',', '.') . ") = Rp " . number_format($refundTotal, 0, ',', '.') . " ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}).",
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

    /**
     * GET /emas/harga-hari-ini
     * Mengambil daftar harga emas hari ini (0.5 g – 25 g) dari anekalogam.co.id.
     * Di-cache 30 menit agar tidak memukul situs eksternal di setiap request.
     */
    public function hargaHariIni(): JsonResponse
    {
        try {
            $data = Cache::remember('harga_emas_hari_ini', 1800, fn () => $this->scrapeHargaHariIni());
        } catch (\Throwable $e) {
            return $this->errorResponse('Gagal mengambil harga emas dari sumber: '.$e->getMessage(), 502, 'UPSTREAM_ERROR');
        }

        if (! $data) {
            return $this->errorResponse('Daftar harga emas tidak ditemukan.', 404, 'NOT_FOUND');
        }

        return $this->successResponse($data, 'Berhasil mengambil harga emas hari ini.');
    }

    private function scrapeHargaHariIni(): ?array
    {
        $client = new \GuzzleHttp\Client([
            'timeout' => 40,
            'http_errors' => false,
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' => 'id,en-US;q=0.9,en;q=0.8',
            ],
        ]);

        $html = null;
        $lastStatus = 0;
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $res = $client->get('https://anekalogam.co.id/id/logam-mulia');
            $lastStatus = $res->getStatusCode();
            if ($lastStatus === 200) {
                $html = $res->getBody()->getContents();
                break;
            }
            usleep(500000);
        }

        if ($html === null) {
            return null;
        }

        // Parse tanggal "Terakhir Diperbarui: 14 September 2026 ... 10.54"
        $tanggal = now()->toDateString();
        $waktu = '';
        if (preg_match('/Terakhir Diperbarui:.*?<strong[^>]*>(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})[\s\S]*?<span[^>]*><\/span>\s*([\d.]+)/i', $html, $tm)) {
            $bulan = [
                'januari' => '01', 'februari' => '02', 'maret' => '03', 'april' => '04',
                'mei' => '05', 'juni' => '06', 'juli' => '07', 'agustus' => '08',
                'september' => '09', 'oktober' => '10', 'november' => '11', 'desember' => '12',
            ];
            $mLower = strtolower($tm[2]);
            if (isset($bulan[$mLower])) {
                $tanggal = sprintf('%04d-%s-%02d', (int) $tm[3], $bulan[$mLower], (int) $tm[1]);
            }
            $waktu = $tm[4];
        }

        // Parse semua baris harga dari tabel utama (0.5 gram s/d 25 gram).
        // Pisahkan per <tr> → padding aman dari baris lain (mis. "1 kilogram", edisi "-i").
        $rows = [];
        if (preg_match_all(
            '/<tr>[\s\S]*?class="view-product">([\d.,]+gram)<\/a>[\s\S]*?<span class="lm-price">[\s\S]*?<span>Rp<\/span>[\s\S]*?<span>([\d.,]+)<\/span>[\s\S]*?<\/span>[\s\S]*?<span class="lm-price">[\s\S]*?<span>Rp<\/span>[\s\S]*?<span>([\d.,]+)<\/span>[\s\S]*?<\/span>[\s\S]*?<\/tr>/i',
            $html,
            $matches,
            PREG_SET_ORDER
        )) {
            foreach ($matches as $m) {
                $num = str_replace('gram', '', $m[1]);
                $berat = (float) str_replace(',', '.', $num);
                if ($berat <= 0 || $berat > 25) {
                    continue;
                }
                $rows[] = [
                    'berat_gram' => $berat,
                    'label' => $m[1],
                    'harga_jual' => (int) preg_replace('/[^\d]/', '', $m[2]),
                    'harga_beli' => (int) preg_replace('/[^\d]/', '', $m[3]),
                ];
            }
        }

        if (empty($rows)) {
            return null;
        }

        return [
            'tanggal' => $tanggal,
            'waktu' => $waktu,
            'sumber' => 'https://anekalogam.co.id/id/logam-mulia',
            'items' => $rows,
        ];
    }

    /**
     * True bila masih ada pengajuan penarikan/pembatalan (jenis 'tarik') yang
     * menunggu verifikasi pada jenis tabungan ini. Dipakai tarik/tukar/batal
     * agar emas yang sama tidak dicairkan/ditukar/terefund lebih dari sekali.
     */
    private function adaPengajuanPending(Request $request, JenisTabungan $jenisTabungan): bool
    {
        return Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenisTabungan->id)
            ->where('jenis_transaksi', 'tarik')
            ->whereNotNull('unit_didapat')
            ->menungguVerifikasi()
            ->exists();
    }
}
