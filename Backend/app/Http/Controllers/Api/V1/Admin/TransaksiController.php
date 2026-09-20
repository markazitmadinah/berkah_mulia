<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\StatusPendaftaranQurban;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Exports\TransaksiPembukuanExport;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\AuditLog;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\Notifikasi;
use App\Models\PendaftaranQurban;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\ProgressCalculatorService;
use App\Services\QurbanTargetService;
use App\Services\SaldoEmasService;
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
        private SaldoEmasService $saldoEmasService,
        private NotifikasiService $notif,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:menunggu_verifikasi,terverifikasi,ditolak',
            'metode' => 'nullable|string|in:cash,transfer',
            'jenis_tabungan_id' => 'nullable|integer|exists:jenis_tabungan,id',
            'tipe' => 'nullable|string|in:emas,pribadi,qurban,gadai',
            'tanggal_awal' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date|after_or_equal:tanggal_awal',
            'search' => 'nullable|string|max:255',
        ]);

        $query = Transaksi::with(['user', 'jenisTabungan', 'rekeningBank', 'gadai'])
            ->filterAdmin($request->only([
                'status',
                'metode',
                'jenis_tabungan_id',
                'tipe',
                'tanggal_awal',
                'tanggal_akhir',
                'search',
            ]));

        $perPage = min($request->input('per_page', 15), 1000);
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
        $request->validate([
            'status' => 'nullable|string|in:menunggu_verifikasi,terverifikasi,ditolak',
            'metode' => 'nullable|string|in:cash,transfer',
            'jenis_tabungan_id' => 'nullable|integer|exists:jenis_tabungan,id',
            'tipe' => 'nullable|string|in:emas,pribadi,qurban,gadai',
            'search' => 'nullable|string|max:255',
            'tanggal_awal' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date|after_or_equal:tanggal_awal',
            'aliran' => 'nullable|string|in:semua,masuk,keluar',
            'periode' => 'nullable|string|max:30',
        ]);

        $filters = $request->only([
            'status',
            'metode',
            'jenis_tabungan_id',
            'tipe',
            'search',
            'tanggal_awal',
            'tanggal_akhir',
            'aliran',
            'periode',
        ]);
        $filename = 'pembukuan_transaksi_koperasi_berkah_mulia_'.now()->format('Y-m-d').'.xlsx';

        return Excel::download(new TransaksiPembukuanExport($filters), $filename);
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

        // Balance guard: verify only if current balance can cover the transaction.
        $jenis = $transaksi->jenisTabungan;
        $user = $transaksi->user;

        if (! $user) {
            return $this->errorResponse('Transaksi tidak memiliki nasabah yang valid.', 422, 'INVALID_TRANSACTION');
        }

        // Penarikan wajib punya jenis tabungan agar guard saldo tidak bisa dilewati.
        if (! $jenis && $transaksi->jenis_transaksi === JenisTransaksi::Tarik) {
            return $this->errorResponse('Transaksi penarikan tidak memiliki jenis tabungan yang valid.', 422, 'INVALID_TRANSACTION');
        }

        if ($jenis) {
            if ($jenis->tipe === TipeTabungan::Emas) {
                // Emas balance is tracked two ways: grams (unit_didapat) & saldo dana (nominal_selisih).
                // The withdrawal nominal is the rupiah market value (grams × price),
                // so it must not be compared against rupiah actually deposited.
                if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik) {
                    $saldoGram = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->terverifikasi()
                        ->sum('unit_didapat');

                    // Pending penarikan lain bernilai negatif (unit_didapat < 0),
                    // jadi sisa yang tersedia = saldo ditambah total pending (bukan dikurang).
                    $pendingLainGram = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->where('jenis_transaksi', 'tarik')
                        ->where('id', '!=', $transaksi->id)
                        ->menungguVerifikasi()
                        ->sum('unit_didapat');

                    $tarikGram = abs((float) $transaksi->unit_didapat);
                    if ($tarikGram > ($saldoGram + (float) $pendingLainGram)) {
                        return $this->errorResponse('Saldo emas tidak mencukupi untuk memverifikasi penarikan ini.', 422, 'INSUFFICIENT_BALANCE');
                    }
                }

                // Guard saldo dana: semua transaksi emas punya delta dana (nominal_selisih).
                // Setor bisa memakai saldo dana untuk melengkapi gram (nominal_selisih < 0) —
                // verifikasi tidak boleh membuat saldo dana negatif.
                if ($transaksi->nominal_selisih !== null && (float) $transaksi->nominal_selisih < 0) {
                    $saldoDana = $this->saldoEmasService->getSaldoDana($user, $jenis);
                    $pendingDanaLain = Transaksi::milikUser($user->id)
                        ->where('jenis_tabungan_id', $jenis->id)
                        ->where('id', '!=', $transaksi->id)
                        ->menungguVerifikasi()
                        ->sum('nominal_selisih');

                    $danaSetelah = round($saldoDana + (float) $pendingDanaLain + (float) $transaksi->nominal_selisih, 2);
                    if ($danaSetelah < 0) {
                        return $this->errorResponse('Saldo dana tidak mencukupi untuk memverifikasi transaksi ini.', 422, 'INSUFFICIENT_BALANCE');
                    }
                }
            } elseif ($transaksi->jenis_transaksi === JenisTransaksi::Tarik) {
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

        DB::transaction(function () use ($transaksi) {
            $oldValues = ['status_verifikasi' => $transaksi->status_verifikasi->value];

            $transaksi->update([
                'status_verifikasi' => StatusVerifikasi::Terverifikasi,
                'diverifikasi_oleh' => auth()->id(),
                'diverifikasi_pada' => now(),
            ]);

            // Clear emas goal after FULL withdrawal/cancel so progress bar resets.
            // Refund pembatalan PER RENCANA (ber-konfigurasi_id) tidak menghapus goal global.
            if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik
                && $transaksi->jenisTabungan?->tipe === TipeTabungan::Emas
                && is_null($transaksi->konfigurasi_id)) {
                $transaksi->user->update(['target_emas_gram' => null]);
            }

            // Refund batal PER RENCANA terverifikasi → rencana baru resmi BATAL.
            if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik
                && $transaksi->jenisTabungan?->tipe === TipeTabungan::Emas
                && $transaksi->konfigurasi_id !== null) {
                KonfigurasiSetoranEmas::where('id', $transaksi->konfigurasi_id)
                    ->where('user_id', $transaksi->user_id)
                    ->aktif()
                    ->update(['status' => StatusKonfigurasiSetoran::Batal]);

                $this->notif->kirim(
                    $transaksi->user,
                    'Rencana Setoran Dibuat Batal',
                    'Rencana setoran berkala Anda resmi dibatalkan. Refund sebesar Rp '
                        .number_format((float) $transaksi->nominal, 0, ',', '.')
                        .' telah diproses.',
                    TipeNotifikasi::Info,
                    ['konfigurasi_setoran_id' => $transaksi->konfigurasi_id, 'transaksi_id' => $transaksi->id]
                );
            }

            // Tabungan berjangka: tarik terverifikasi → tabungan resmi ditutup ('selesai').
            // (Status tidak lagi diubah saat pengajuan agar penolakan tidak mengunci tabungan.)
            if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik && $transaksi->tabungan_berjangka_id) {
                TabunganBerjangka::whereKey($transaksi->tabungan_berjangka_id)
                    ->where('status', 'aktif')
                    ->update(['status' => 'selesai']);
            }

            // Notif ke user: transaksi terverifikasi.
            $this->notif->kirim(
                $transaksi->user,
                'Transaksi Terverifikasi',
                ($transaksi->jenis_transaksi === JenisTransaksi::Setor ? 'Setoran' : 'Pencairan')
                    .' '.($transaksi->jenisTabungan?->nama ?? '')
                    .' sebesar Rp '.number_format((float) $transaksi->nominal, 0, ',', '.')
                    .' telah diverifikasi.',
                TipeNotifikasi::Verifikasi,
                ['transaksi_id' => $transaksi->id, 'jenis_transaksi' => $transaksi->jenis_transaksi]
            );

            // Setoran emas terverifikasi mencapai target → dorong user lanjut/ambil emas.
            if ($transaksi->jenis_transaksi === JenisTransaksi::Setor
                && $transaksi->jenisTabungan?->tipe === TipeTabungan::Emas) {
                $target = $transaksi->user->fresh()->target_emas_gram;
                if ($target !== null
                    && $this->saldoEmasService->getSaldoGram($transaksi->user, $transaksi->jenisTabungan) >= (float) $target
                    && ! Notifikasi::where('user_id', $transaksi->user_id)
                        ->where('tipe', TipeNotifikasi::PengingatPencairan)
                        ->whereDate('created_at', now()->toDateString())
                        ->exists()) {
                    $this->notif->kirim(
                        $transaksi->user,
                        'Target Tabungan Emas Tercapai!',
                        'Selamat! Saldo emas Anda kini mencapai '.number_format((float) $target, 6, ',', '.')
                            .' gram. Anda bisa melanjutkan menabung, menjual emas, atau menukarnya di toko.',
                        TipeNotifikasi::PengingatPencairan,
                        ['jenis_tabungan' => 'emas', 'target_gram' => (float) $target]
                    );
                }
            }

            // Qurban total_terkumpul is updated automatically by TransaksiObserver::updated.

            AuditLog::record('verify', $transaksi, $oldValues, ['status_verifikasi' => 'terverifikasi']);
        });

        // TODO: Dispatch SendTransaksiVerifiedNotification (in-app via NotifikasiService sudah terkirim)

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

        // Tabungan berjangka: tolak tarik → kembalikan status agar bisa diajukan ulang.
        // (Termasuk memperbaiki data lama yang sempat terkunci 'selesai' saat pengajuan.)
        if ($transaksi->jenis_transaksi === JenisTransaksi::Tarik && $transaksi->tabungan_berjangka_id) {
            TabunganBerjangka::whereKey($transaksi->tabungan_berjangka_id)
                ->where('status', 'selesai')
                ->update(['status' => 'aktif']);
        }

        AuditLog::record('reject', $transaksi, $oldValues, ['status_verifikasi' => 'ditolak', 'catatan_admin' => $request->catatan_admin]);

        $this->notif->kirim(
            $transaksi->user,
            'Transaksi Ditolak',
            ($transaksi->jenis_transaksi === JenisTransaksi::Setor ? 'Setoran' : 'Pencairan')
                .' Anda sebesar Rp '.number_format((float) $transaksi->nominal, 0, ',', '.')
                .' ditolak admin. Alasan: '.$request->catatan_admin,
            TipeNotifikasi::Verifikasi,
            ['transaksi_id' => $transaksi->id, 'jenis_transaksi' => $transaksi->jenis_transaksi]
        );

        // TODO: Dispatch SendTransaksiRejectedNotification (in-app via NotifikasiService sudah terkirim)

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
            'nominal' => 'required|numeric|min:10000',
            'pendaftaran_qurban_id' => 'nullable|exists:pendaftaran_qurban,id',
            'tabungan_berjangka_id' => 'nullable|integer|exists:tabungan_berjangka,id',
            'konfigurasi_id' => 'nullable|integer|exists:konfigurasi_setoran_emas,id',
            'catatan_admin' => 'nullable|string|max:500',
        ]);

        $jenis = JenisTabungan::findOrFail($request->jenis_tabungan_id);

        if ($request->filled('pendaftaran_qurban_id')) {
            $penda = PendaftaranQurban::findOrFail($request->pendaftaran_qurban_id);
            if ($penda->user_id != $request->user_id) {
                return $this->errorResponse('Pendaftaran qurban tidak cocok dengan nasabah yang dipilih.', 422, 'QURBAN_TIDAK_COCOK');
            }
            if ($jenis->tipe !== TipeTabungan::Qurban) {
                return $this->errorResponse('Pendaftaran qurban hanya berlaku untuk produk tabungan qurban.', 422, 'QURBAN_BUKAN_QURBAN');
            }
            if ($penda->status !== StatusPendaftaranQurban::Menabung) {
                return $this->errorResponse('Qurban ini sudah lunas / tidak lagi aktif untuk setoran tambahan.', 422, 'QURBAN_TERKUNCI');
            }
            if ((float) $penda->nominal_per_periode > 0 && (float) $request->nominal < (float) $penda->nominal_per_periode) {
                return $this->errorResponse(
                    'Nominal minimal untuk target qurban ini adalah Rp '.number_format((float) $penda->nominal_per_periode, 0, ',', '.').' (1 periode setoran '.($penda->frekuensiLabel() ?: 'bulanan').').',
                    422,
                    'NOMINAL_KURANG_1_PERIODE'
                );
            }
        }

        if ($request->filled('tabungan_berjangka_id')) {
            $tb = TabunganBerjangka::findOrFail($request->tabungan_berjangka_id);
            if ($tb->user_id != $request->user_id || $tb->jenis_tabungan_id != $request->jenis_tabungan_id) {
                return $this->errorResponse('Tabungan berjangka tidak cocok dengan nasabah atau produk yang dipilih.', 422, 'BERJANGKA_TIDAK_COCOK');
            }
        }

        $konfigurasiDipilih = null;
        if ($request->filled('konfigurasi_id')) {
            $konfigurasiDipilih = KonfigurasiSetoranEmas::findOrFail($request->konfigurasi_id);
            if ($konfigurasiDipilih->user_id != $request->user_id || $konfigurasiDipilih->jenis_tabungan_id != $request->jenis_tabungan_id) {
                return $this->errorResponse('Rencana setoran tidak cocok dengan nasabah atau produk yang dipilih.', 422, 'KONFIGURASI_TIDAK_COCOK');
            }
            if ($jenis->tipe === TipeTabungan::Emas && (float) $request->nominal < (float) $konfigurasiDipilih->nominal_per_periode) {
                return $this->errorResponse(
                    'Nominal minimal untuk rencana ini adalah Rp '.number_format((float) $konfigurasiDipilih->nominal_per_periode, 0, ',', '.').' (1 periode setoran).',
                    422,
                    'NOMINAL_KURANG_1_PERIODE'
                );
            }
        }

        // Emas: tolak setoran bila rencana yang bersangkutan sedang menunggu batal & refund.
        if ($jenis->tipe === TipeTabungan::Emas) {
            $userCek = User::findOrFail($request->user_id);
            $konfigurasiCek = $konfigurasiDipilih ?? $this->saldoEmasService->getAktif($userCek, $jenis);
            if ($konfigurasiCek && $this->saldoEmasService->refundTerkunci($userCek, $konfigurasiCek)) {
                return $this->errorResponse('Rencana ini masih punya pengajuan batal & refund yang menunggu verifikasi admin.', 422, 'REFUND_PENDING');
            }
        }

        $transaksi = DB::transaction(function () use ($request, $jenis, $konfigurasiDipilih) {
            $data = [
                'user_id' => $request->user_id,
                'jenis_tabungan_id' => $request->jenis_tabungan_id,
                'pendaftaran_qurban_id' => $request->pendaftaran_qurban_id,
                'tabungan_berjangka_id' => $request->tabungan_berjangka_id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'metode_pembayaran' => MetodePembayaran::Cash,
                'catatan_admin' => $request->catatan_admin,
                'auto_verify' => true,
            ];

            // Setoran emas (termasuk door-to-door/cash) memakai konversi yang sama:
            // beli target gram penuh per periode bila mengikuti setoran rencana.
            if ($jenis->tipe === TipeTabungan::Emas) {
                $user = User::findOrFail($request->user_id);
                $harga = HargaEmasHarian::hargaTerkini();

                if (! $harga) {
                    abort(400, 'Harga emas belum diinput oleh admin. Silakan hubungi admin.');
                }

                $konfigurasi = $konfigurasiDipilih ?? $this->saldoEmasService->getAktif($user, $jenis);
                $gramasi = $konfigurasi && (float) $konfigurasi->target_gram_per_periode > 0
                    ? (float) $konfigurasi->target_gram_per_periode
                    : ((float) $harga->harga_per_gram > 0 ? (float) $request->nominal / (float) $harga->harga_per_gram : 0.0);
                $hargaJual = $harga->hargaJualPerGram($gramasi);

                $porsi = $this->saldoEmasService->hitungSetoran(
                    (float) $request->nominal,
                    $konfigurasi,
                    $this->saldoEmasService->getSaldoDana($user, $jenis),
                    $hargaJual
                );

                $data += [
                    'konfigurasi_id' => $konfigurasi?->id,
                    'nominal_emas' => $porsi['nominal_emas'],
                    'nominal_selisih' => $porsi['nominal_selisih'],
                    'unit_didapat' => $porsi['unit_didapat'],
                    'harga_acuan_id' => $harga->id,
                    'harga_acuan_snapshot' => $hargaJual,
                ];
            }

            $transaksi = $this->transaksiService->buatTransaksi($data);

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
