<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\KonfigurasiSetoranEmasResource;
use App\Http\Resources\TransaksiResource;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Transaksi;
use App\Services\EmasConversionService;
use App\Services\NotifikasiService;
use App\Services\SaldoEmasService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KonfigurasiSetoranEmasController extends Controller
{
    use ApiResponse;

    public function __construct(
        private EmasConversionService $emasService,
        private SaldoEmasService $saldoEmasService,
        private TransaksiService $transaksiService,
        private NotifikasiService $notif,
    ) {}

    /**
     * GET /emas/setoran-berkala
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $jenis = $this->jenisTabunganEmas();

        if (! $jenis) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        $this->saldoEmasService->autoSelesaikan($user, $jenis);
        $aktifList = $this->saldoEmasService->getAktifList($user, $jenis);

        return $this->successResponse([
            'dapat_membuat' => $aktifList->count() < 5,
            'items' => $aktifList->map(fn (KonfigurasiSetoranEmas $k) => [
                'konfigurasi' => new KonfigurasiSetoranEmasResource($k),
                'progress' => $this->saldoEmasService->getProgress($user, $k),
                'refund_diajukan' => $this->saldoEmasService->refundTerkunci($user, $k),
            ])->values(),
        ]);
    }

    /**
     * POST /emas/setoran-berkala
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nominal_per_periode' => 'required|numeric|min:10000',
            'frekuensi_setor' => 'required|in:harian,mingguan,bulanan',
            'durasi_periode' => 'required|integer|min:1',
            'target_emas_gram' => 'nullable|numeric|min:0.01|max:1000000',
            'target_gram_per_periode' => 'nullable|numeric|gt:0',
            'target_gram_total' => 'nullable|numeric|min:0.01|max:1000000',
            'tanggal_mulai' => 'nullable|date|after_or_equal:today',
        ]);

        $user = $request->user();
        $jenis = $this->jenisTabunganEmas();

        if (! $jenis) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        $this->saldoEmasService->autoSelesaikan($user, $jenis);

        // Maksimal 5 rencana pembayaran aktif; slot terbuka lagi begitu satu selesai/batal.
        $jumlahAktif = $this->saldoEmasService->getAktifList($user, $jenis)->count();
        if ($jumlahAktif >= 5) {
            return $this->errorResponse('Slot rencana pembayaran sudah penuh (maksimal 5). Selesaikan atau batalkan salah satu untuk menambah.', 422, 'MAX_RENCANA_AKTIF');
        }

        // Multi-rencana: nasabah bebas membuka rencana baru (kec. goal global terkunci).
        // target_emas_gram = goal GLOBAL (ditandai di users, dikunci setelah plan pertama);
        // target_gram_total = target RENCANA ini sendiri (per-rencana, contoh "nabung lagi 5g").
        $targetRencana = (float) ($request->filled('target_gram_total')
            ? $request->target_gram_total
            : ($request->filled('target_emas_gram') ? $request->target_emas_gram : 0));

        if ($request->filled('target_emas_gram')) {
            if ($user->target_emas_gram !== null
                && abs((float) $user->target_emas_gram - (float) $request->target_emas_gram) > 0.0001) {
                return $this->errorResponse('Target sudah ditetapkan. Target global hanya bisa diubah setelah goal tercapai dan dikonfirmasi admin.', 422, 'GOAL_LOCKED');
            }
            if ($user->target_emas_gram === null) {
                $user->update(['target_emas_gram' => round((float) $request->target_emas_gram, 6)]);
            }
        }

        // User manual/baru tanpa target_emas_gram: rencana pertama menetapkan goal global.
        if ($user->target_emas_gram === null && $targetRencana > 0) {
            $user->update(['target_emas_gram' => round($targetRencana, 6)]);
        }

        $frekuensi = $request->frekuensi_setor;
        $mulai = $request->filled('tanggal_mulai') ? Carbon::parse($request->tanggal_mulai) : now();
        $durasi = (int) $request->durasi_periode;
        $deadline = $durasi
            ? $this->saldoEmasService->tambahPeriode($mulai, max(0, $durasi - 1), $frekuensi)
            : null;

        $gramPeriode = $request->filled('target_gram_per_periode')
            ? round((float) $request->target_gram_per_periode, 6)
            : ($targetRencana > 0
                ? round($targetRencana / $durasi, 6)
                : ($user->target_emas_gram !== null
                    ? round((float) $user->target_emas_gram / $durasi, 6)
                    : 0.0));

        if ($gramPeriode <= 0) {
            return $this->errorResponse('Set target gram emas dahulu sebelum membuat setoran berkala.', 422, 'GOAL_NOT_SET');
        }

        $konfigurasi = KonfigurasiSetoranEmas::create([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'nominal_per_periode' => round((float) $request->nominal_per_periode, 2),
            'target_gram_per_periode' => $gramPeriode,
            'target_gram_total' => $targetRencana > 0 ? round($targetRencana, 6) : null,
            'frekuensi_setor' => $frekuensi,
            'tanggal_mulai' => $mulai->toDateString(),
            'durasi_periode' => $durasi,
            'tanggal_deadline' => $deadline?->toDateString(),
            'status' => StatusKonfigurasiSetoran::Aktif,
            'created_by' => $user->id,
        ]);

        return $this->createdResponse(
            new KonfigurasiSetoranEmasResource($konfigurasi),
            'Setoran berkala emas berhasil dibuat.'
        );
    }

    /**
     * POST /emas/setoran-berkala/{konfigurasi}/batalkan
     * Batal & refund PER RENCANA (tidak menyentuh rencana lain):
     * nilai emas rencana dikembalikan 90% (potongan 10%), saldo dana rencana 100%.
     * Refund berupa transaksi tarik yang menunggu verifikasi admin.
     */
    public function batalkan(Request $request, KonfigurasiSetoranEmas $konfigurasi): JsonResponse
    {
        if ($konfigurasi->user_id !== $request->user()->id) {
            return $this->errorResponse('Konfigurasi setoran berkala tidak ditemukan.', 404, 'NOT_FOUND');
        }

        if ($konfigurasi->status !== StatusKonfigurasiSetoran::Aktif) {
            return $this->errorResponse('Konfigurasi setoran berkala ini sudah tidak aktif.', 422, 'TIDAK_AKTIF');
        }

        $user = $request->user();

        if ($this->saldoEmasService->refundTerkunci($user, $konfigurasi)) {
            return $this->errorResponse('Rencana ini masih punya pengajuan batal & refund yang menunggu verifikasi admin.', 422, 'REFUND_PENDING');
        }

        $rekap = $this->saldoEmasService->getSaldoRencana($user, $konfigurasi);
        $gram = (float) $rekap['gram'];
        $danaRencana = (float) $rekap['dana'];

        if ($gram > 0) {
            $harga = $this->emasService->getHargaTerkini();
            if (! $harga) {
                return $this->errorResponse('Harga emas belum diinput oleh admin. Silakan hubungi admin.', 400);
            }
            $nilaiGram = round($gram * (float) $harga->harga_per_gram, 2);
        } else {
            $nilaiGram = 0.0;
        }

        $penalti = round($nilaiGram * 0.10, 2);
        $refund = round(($nilaiGram - $penalti) + $danaRencana, 2);

        $transaksi = null;

        if ($refund > 0) {
            $request->validate([
                'bank_tujuan' => 'required|string|max:100',
                'no_rekening' => 'required|numeric|digits_between:6,20',
                'atas_nama' => 'required|string|max:100',
                'catatan_user' => 'nullable|string|max:500',
            ]);

            $transaksi = DB::transaction(function () use ($user, $konfigurasi, $gram, $nilaiGram, $penalti, $danaRencana, $refund, $request) {
                return $this->transaksiService->buatTransaksi([
                    'user_id' => $user->id,
                    'jenis_tabungan_id' => $konfigurasi->jenis_tabungan_id,
                    'konfigurasi_id' => $konfigurasi->id,
                    'jenis_transaksi' => JenisTransaksi::Tarik,
                    'nominal' => $refund,
                    'nominal_emas' => $nilaiGram,
                    'nominal_selisih' => -1 * $danaRencana,
                    'unit_didapat' => -1 * $gram,
                    'biaya_penalti' => $penalti,
                    'metode_pembayaran' => MetodePembayaran::Transfer,
                    'catatan_user' => 'Pembatalan rencana setoran berkala. Refund: emas 90% (Rp '
                        . number_format($nilaiGram - $penalti, 0, ',', '.')
                        . ' setelah potong 10% Rp ' . number_format($penalti, 0, ',', '.')
                        . ') + saldo dana 100% (Rp ' . number_format($danaRencana, 0, ',', '.')
                        . ') = Rp ' . number_format($refund, 0, ',', '.')
                        . ' ke ' . $request->bank_tujuan . ' (' . $request->no_rekening . ' a.n ' . $request->atas_nama . ').',
                ]);
            });
        }

        // Rencana TIDAK langsung dibatalkan jika ada refund: transaksi menunggu verifikasi admin,
        // rencana baru resmi BATAL setelah transaksi tersebut diverifikasi
        // (lihat TransaksiController::verifikasi). Rencana kosong (refund 0) dibatalkan langsung.
        if ($refund <= 0) {
            $konfigurasi->update(['status' => StatusKonfigurasiSetoran::Batal]);
        }

        if ($refund > 0) {
            $this->notif->kirimKeSemuaAdmin(
                'Pengajuan Batal & Refund Rencana',
                $user->name . ' mengajukan pembatalan rencana setoran berkala. Refund Rp '
                    . number_format($refund, 0, ',', '.')
                    . ' menunggu verifikasi admin.',
                TipeNotifikasi::Verifikasi,
                ['konfigurasi_setoran_id' => $konfigurasi->id, 'transaksi_id' => $transaksi->id]
            );
        }

        return $this->successResponse([
            'rencana' => new KonfigurasiSetoranEmasResource($konfigurasi->fresh()),
            'refund' => [
                'gram_dibatalkan' => $gram,
                'nilai_gram' => $nilaiGram,
                'penalti_10_persen' => $penalti,
                'saldo_dana' => $danaRencana,
                'nominal_refund' => $refund,
                'transaksi_refund_id' => $transaksi?->id,
            ],
        ], $refund > 0
            ? 'Pengajuan batal & refund diajukan. Rencana dikunci sampai refund diverifikasi admin.'
            : 'Pengajuan batal diajukan. Rencana dikunci sampai diverifikasi admin.');
    }

    /**
     * POST /emas/dana/cair
     * Pencairan saldo dana (uang, bukan gram). Tanpa potongan; diverifikasi admin.
     * nominal opsional; default = seluruh saldo dana yang tersedia.
     */
    public function cairkanDana(Request $request): JsonResponse
    {
        $request->validate([
            'nominal' => 'nullable|numeric|min:10000',
            'bank_tujuan' => 'required|string|max:100',
            'no_rekening' => 'required|numeric|digits_between:6,20',
            'atas_nama' => 'required|string|max:100',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenis = $this->jenisTabunganEmas();

        if (! $jenis) {
            return $this->errorResponse('Tabungan emas belum tersedia.', 404, 'NOT_FOUND');
        }

        $user = $request->user();
        $saldoDana = $this->saldoEmasService->getSaldoDana($user, $jenis);
        $pending = (float) Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->where('jenis_transaksi', 'tarik')
            ->where('nominal_selisih', '<', 0)
            ->menungguVerifikasi()
            ->sum('nominal_selisih');

        $bisaCair = round($saldoDana + $pending, 2);

        if ($bisaCair <= 0) {
            return $this->errorResponse('Tidak ada saldo dana untuk dicairkan.', 422, 'INSUFFICIENT_BALANCE');
        }

        $jumlah = $request->filled('nominal') ? round((float) $request->nominal, 2) : $bisaCair;

        if ($jumlah > $bisaCair) {
            return $this->errorResponse('Nominal melebihi saldo dana yang tersedia.', 422, 'INSUFFICIENT_BALANCE');
        }

        $transaksi = $this->transaksiService->buatTransaksi([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $jumlah,
            'unit_didapat' => 0,
            'nominal_selisih' => -1 * $jumlah,
            'metode_pembayaran' => MetodePembayaran::Transfer,
            'catatan_user' => 'Pencairan saldo dana tabungan emas sebesar Rp '
                . number_format($jumlah, 0, ',', '.')
                . " ke {$request->bank_tujuan} ({$request->no_rekening} a.n {$request->atas_nama}).",
        ]);

        return $this->createdResponse(
            new TransaksiResource($transaksi->load(['jenisTabungan'])),
            'Permohonan pencairan saldo dana diajukan. Menunggu verifikasi admin.'
        );
    }

    private function jenisTabunganEmas(): ?JenisTabungan
    {
        return JenisTabungan::where('tipe', TipeTabungan::Emas)->aktif()->first();
    }
}