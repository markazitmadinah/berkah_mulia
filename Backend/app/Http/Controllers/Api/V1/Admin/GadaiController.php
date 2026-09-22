<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\StatusGadai;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeNotifikasi;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AngsuranGadai;
use App\Models\AuditLog;
use App\Models\Gadai;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\EmasConversionService;
use App\Services\GadaiService;
use App\Services\NotifikasiService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Gadai Emas (modul utama). Admin membuat & mengelola seluruh siklus:
 * Peserta + Data Emas → Nilai Taksiran → Besaran Gadai (taksiran × % gadai,
 * default 80%) → Pembiayaan (AKTIF) → Bayar/angsuran (harian/mingguan/bulanan)
 * → Jatuh Tempo → LUNAS (emas dikembalikan) / TERLAMBAT → DIPERPANJANG, atau
 * BATAL (emas dikembalikan + potongan 10%).
 */
class GadaiController extends Controller
{
    use ApiResponse;

    public function __construct(
        private GadaiService $gadaiService,
        private EmasConversionService $emasService,
        private NotifikasiService $notif,
    ) {}

    /**
     * GET /admin/gadai — daftar & ringkasan.
     */
    public function index(Request $request): JsonResponse
    {
        $gadai = Gadai::query()
            ->with(['user:id,name,phone,nomor_anggota', 'angsuran'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', (int) $request->user_id))
            ->when($request->filled('q'), function ($q) use ($request) {
                $searchQ = str_replace(['%', '_'], ['\%', '\_'], $request->q);
                $q->where(function ($qq) use ($searchQ) {
                    $qq->where('nomor_gadai', 'like', "%{$searchQ}%")
                       ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$searchQ}%"));
                });
            })
            ->latest()
            ->paginate(min((int) ($request->per_page ?? 25), 1000));

        $semua = Gadai::query()->count();
        $summary = [
            'total' => $semua,
            'diajukan' => Gadai::query()->where('status', StatusGadai::Diajukan->value)->count(),
            'aktif' => Gadai::query()->whereIn('status', [StatusGadai::Aktif->value, StatusGadai::Diperpanjang->value])->count(),
            'jatuh_tempo' => Gadai::query()->where('status', StatusGadai::JatuhTempo->value)->count(),
            'terlambat' => Gadai::query()->where('status', StatusGadai::Terlambat->value)->count(),
            'lunas' => Gadai::query()->where('status', StatusGadai::Lunas->value)->count(),
        ];

        return $this->successResponse([
            'summary' => $summary,
            'items' => collect($gadai->items())->map(fn (Gadai $g) => $this->gadaiArray($g)),
            'meta' => [
                'current_page' => $gadai->currentPage(),
                'per_page' => $gadai->perPage(),
                'total' => $gadai->total(),
                'last_page' => $gadai->lastPage(),
            ],
        ]);
    }

    /**
     * POST /admin/gadai — buat pengajuan gadai (status DIAJUKAN).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateCreate($request);

        $peserta = User::find($data['user_id']);
        if (! $peserta || $peserta->role !== UserRole::User) {
            return $this->errorResponse('Peserta tidak ditemukan atau bukan nasabah aktif.', 422, 'PESERTA_INVALID');
        }

        $berat = round((float) $data['berat_gram'], 4);
        $kadar = round((float) $data['kadar'], 2);
        $harga = $this->resolveHargaAcuan($data['harga_acuan'] ?? null);
        if ($harga === null) {
            return $this->errorResponse('Harga emas belum diinput oleh admin. Input harga acuan manual atau isi harga harian dulu.', 400, 'HARGA_TIDAK_ADA');
        }

        $beratBersih = $this->gadaiService->hitungBeratBersih($berat, $kadar);
        $taksiran = $this->gadaiService->hitungNilaiTaksiran($beratBersih, $harga);
        $persen = $data['persen_gadai'] ?? 80;
        $besaran = $this->gadaiService->hitungBesaran($taksiran, (float) $persen);

        $gadai = $this->gadaiService->buatGadai([
            'user_id' => $peserta->id,
            'jenis_emas' => $data['jenis_emas'],
            'berat_gram' => $berat,
            'kadar' => $kadar,
            'berat_bersih_gram' => $beratBersih,
            'harga_acuan' => round($harga, 2),
            'nilai_taksiran' => $taksiran,
            'persen_gadai' => round((float) $persen, 2),
            'besaran_gadai' => $besaran,
            'tanggal_aju' => $data['tanggal_aju'] ?? now()->toDateString(),
            'tenor_satuan' => $data['tenor_satuan'],
            'toleransi_hari' => (int) ($data['toleransi_hari'] ?? 0),
            'frekuensi_bayar' => $data['frekuensi_bayar'],
            'nominal_angkuran' => round((float) ($data['nominal_angkuran'] ?? 0), 2),
            'bunga_persen' => round((float) ($data['bunga_persen'] ?? 4.00), 2),
            'tipe_bunga' => $data['tipe_bunga'] ?? 'menurun',
            'status' => StatusGadai::Diajukan,
            'catatan' => $data['catatan'] ?? null,
        ], $request->user()->id);

        AuditLog::record('gadai.store', $gadai, null, $this->gadaiArray($gadai));

        $this->notif->kirimKeSemuaAdmin(
            'Pengajuan Gadai Baru',
            $peserta->name . ' mengajukan gadai emas ' . $berat . ' gr (' . $kadar . '%) senilai Rp '
                . number_format($besaran, 0, ',', '.') . '. Silakan verifikasi.',
            TipeNotifikasi::Verifikasi,
            ['gadai_id' => $gadai->id]
        );

        return $this->createdResponse($this->gadaiArray($gadai->load('user:id,name,phone,nomor_anggota')),
            'Pengajuan gadai emas berhasil dibuat. Tunggu persetujuan admin.');
    }

    /**
     * GET /admin/gadai/{gadai} — detail + riwayat angsuran.
     */
    public function show(Gadai $gadai): JsonResponse
    {
        $gadai->load(['user:id,username,name,phone,nomor_anggota,address', 'angsuran.createdBy:id,name']);

        $data = $this->gadaiArray($gadai);
        $data['angsuran'] = $gadai->angsuran->map(fn (AngsuranGadai $a) => [
            'id' => $a->id,
            'tanggal_bayar' => $a->tanggal_bayar?->toDateString(),
            'nominal' => (float) $a->nominal,
            'metode_pembayaran' => $a->metode_pembayaran,
            'catatan' => $a->catatan,
            'status_verifikasi' => $a->status_verifikasi?->value ?? 'terverifikasi',
            'bukti_transfer_path' => $a->bukti_transfer_path,
            'catatan_admin' => $a->catatan_admin,
            'pencatat' => $a->createdBy?->name,
        ])->values();

        return $this->successResponse($data);
    }

    /**
     * POST /admin/gadai/{gadai}/approve — DIAJUKAN → AKTIF sekaligus
     * (setujui + salurkan dalam satu langkah).
     */
    public function approve(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->status !== StatusGadai::Diajukan) {
            return $this->errorResponse('Hanya pengajuan berstatus DIAJUKAN yang bisa disetujui.', 422, 'STATUS_TIDAK_VALID');
        }

        $tanggalAktif = now();
        $jatuhTempo = $this->gadaiService->hitungJatuhTempo($tanggalAktif, $gadai->tenor_satuan);

        AuditLog::record(
            'gadai.approve',
            $gadai,
            ['status' => $gadai->status->value],
            ['status' => StatusGadai::Aktif->value, 'tanggal_aktif' => $tanggalAktif->toDateString(), 'tanggal_jatuh_tempo' => $jatuhTempo->toDateString()],
        );

        $gadai->update([
            'status' => StatusGadai::Aktif,
            'tanggal_aktif' => $tanggalAktif->toDateString(),
            'tanggal_jatuh_tempo' => $jatuhTempo->toDateString(),
        ]);

        $this->notif->kirim(
            $gadai->user,
            'Gadai Disetujui & Dana Disalurkan',
            'Pengajuan gadai ' . $gadai->nomor_gadai . ' Anda disetujui. Pembiayaan Rp '
                . number_format((float) $gadai->besaran_gadai, 0, ',', '.')
                . ' telah disalurkan. Jatuh tempo ' . $jatuhTempo->translatedFormat('d M Y') . '.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id]
        );

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            "Gadai disetujui & pembiayaan disalurkan. Jatuh tempo {$jatuhTempo->translatedFormat('d M Y')}."
        );
    }

    /**
     * POST /admin/gadai/{gadai}/aktifkan — DISETUJUI → AKTIF (pembiayaan cair).
     * Path legacy untuk rekaman yang masih berstatus DISETUJUI; alur baru
     * menyatukannya ke endpoint /approve.
     */
    public function aktifkan(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->status !== StatusGadai::Disetujui) {
            return $this->errorResponse('Hanya gadai berstatus DISETUJUI yang bisa disalurkan.', 422, 'STATUS_TIDAK_VALID');
        }

        $tanggalAktif = now();
        $jatuhTempo = $this->gadaiService->hitungJatuhTempo($tanggalAktif, $gadai->tenor_satuan);

        AuditLog::record(
            'gadai.aktifkan',
            $gadai,
            ['status' => $gadai->status->value],
            ['status' => StatusGadai::Aktif->value, 'tanggal_aktif' => $tanggalAktif->toDateString(), 'tanggal_jatuh_tempo' => $jatuhTempo->toDateString()],
        );

        $gadai->update([
            'status' => StatusGadai::Aktif,
            'tanggal_aktif' => $tanggalAktif->toDateString(),
            'tanggal_jatuh_tempo' => $jatuhTempo->toDateString(),
        ]);

        $this->notif->kirim(
            $gadai->user,
            'Pembiayaan Gadai Disalurkan',
            'Pembiayaan gadai ' . $gadai->nomor_gadai . ' sebesar Rp '
                . number_format((float) $gadai->besaran_gadai, 0, ',', '.')
                . ' telah disalurkan. Jatuh tempo ' . $jatuhTempo->translatedFormat('d M Y') . '.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id]
        );

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            "Pembiayaan disalurkan. Jatuh tempo {$jatuhTempo->translatedFormat('d M Y')}."
        );
    }

    /**
     * POST /admin/gadai/{gadai}/bayar — catat pembayaran angsuran (harian/mingguan/bulanan).
     */
    public function bayar(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [
            StatusGadai::Aktif,
            StatusGadai::JatuhTempo,
            StatusGadai::Terlambat,
            StatusGadai::Diperpanjang,
        ], true)) {
            return $this->errorResponse('Gadai tidak dalam masa pembayaran aktif.', 422, 'STATUS_TIDAK_VALID');
        }

        // Cegah double-pay: pembayaran web yang masih pending harus dibereskan dahulu.
        if (AngsuranGadai::where('gadai_id', $gadai->id)
            ->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi->value)
            ->exists()) {
            return $this->errorResponse('Masih ada pembayaran angsuran yang menunggu verifikasi. Verifikasi/tolak dahulu sebelum mencatat pembayaran baru.', 422, 'ANGSURAN_PENDING');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:1',
            'tanggal_bayar' => 'nullable|date',
            'metode_pembayaran' => 'nullable|in:cash,transfer',
            'catatan' => 'nullable|string|max:500',
        ]);

        $nominal = round((float) $request->nominal, 2);
        $sisa = $gadai->sisaPokok();

        if ($nominal > $sisa) {
            return $this->errorResponse('Nominal melebihi sisa pokok (Rp ' . number_format($sisa, 0, ',', '.') . ').', 422, 'MELEBIHI_SISA');
        }

        $terbayar = round((float) $gadai->total_dibayar + $nominal, 2);
        $lunas = $terbayar >= (float) $gadai->besaran_gadai;
        $sebelumDibayar = (float) $gadai->total_dibayar;

        $angsuran = DB::transaction(function () use ($request, $gadai, $nominal, $terbayar, $lunas, $sebelumDibayar) {
            $tanggalBayar = $request->filled('tanggal_bayar') ? $request->tanggal_bayar : now()->toDateString();
            $metode = $request->metode_pembayaran ?? 'cash';

            $a = AngsuranGadai::create([
                'gadai_id' => $gadai->id,
                'tanggal_bayar' => $tanggalBayar,
                'nominal' => $nominal,
                'metode_pembayaran' => $metode,
                'catatan' => $request->catatan,
                'created_by' => $request->user()->id,
                'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                'diverifikasi_oleh' => $request->user()->id,
                'diverifikasi_pada' => now(),
            ]);

            $gadai->update([
                'total_dibayar' => $terbayar,
                'status' => $lunas ? StatusGadai::Lunas : $gadai->status,
                'tanggal_lunas' => $lunas ? now()->toDateString() : $gadai->tanggal_lunas,
            ]);

            // Sync to riwayat transaksi user
            Transaksi::create([
                'nomor_referensi' => Transaksi::generateNomorReferensi(),
                'user_id' => $gadai->user_id,
                'gadai_id' => $gadai->id,
                'jenis_transaksi' => 'setor',
                'nominal' => $nominal,
                'metode_pembayaran' => $metode,
                'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                'diverifikasi_oleh' => $request->user()->id,
                'diverifikasi_pada' => now(),
                'catatan_admin' => 'Pembayaran angsuran gadai ' . $gadai->nomor_gadai . ($request->catatan ? ' - ' . $request->catatan : ''),
                'tanggal_transaksi' => $tanggalBayar,
            ]);

            AuditLog::record(
                'gadai.bayar',
                $gadai,
                ['total_dibayar' => $sebelumDibayar],
                ['nominal' => $nominal, 'total_dibayar' => $terbayar, 'status' => $gadai->fresh()->status->value],
            );

            return $a;
        });

        $message = $lunas
            ? 'Pembayaran diterima — gadai LUNAS. Tekan "Kembalikan Emas" untuk menyerahkan emas ke peserta.'
            : 'Pembayaran angsuran tercatat. Sisa pokok: Rp ' . number_format(round($sisa - $nominal, 2), 0, ',', '.') . '.';

        $this->notif->kirim(
            $gadai->user,
            $lunas ? 'Gadai Lunas' : 'Angsuran Gadai Tercatat',
            $lunas
                ? 'Selamat! Gadai ' . $gadai->nomor_gadai . ' Anda telah LUNAS. Emas siap dikembalikan; tunggu konfirmasi pengambilan di toko.'
                : 'Pembayaran angsuran gadai ' . $gadai->nomor_gadai . ' sebesar Rp '
                    . number_format($nominal, 0, ',', '.') . ' telah tercatat. Sisa pokok Rp '
                    . number_format(round($sisa - $nominal, 2), 0, ',', '.') . '.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id, 'angsuran_id' => $angsuran->id]
        );

        return $this->successResponse([
            'angsuran' => [
                'id' => $angsuran->id,
                'tanggal_bayar' => $angsuran->tanggal_bayar->toDateString(),
                'nominal' => $nominal,
            ],
            'gadai' => $this->gadaiArray($gadai->fresh(['user'])),
        ], $message);
    }

    /**
     * POST /admin/gadai/{gadai}/lunasi — pelunasan penuh sisa pokok (admin mencatat nominal
     * yang dilunasi user). Emas langsung dikembalikan: status EMAS_DIKEMBALIKAN, notif ke user.
     */
    public function lunasi(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [
            StatusGadai::Aktif,
            StatusGadai::JatuhTempo,
            StatusGadai::Terlambat,
            StatusGadai::Diperpanjang,
        ], true)) {
            return $this->errorResponse('Gadai tidak dalam masa pembayaran aktif.', 422, 'STATUS_TIDAK_VALID');
        }

        // Cegah double-pay: selesaikan pembayaran pending dahulu sebelum pelunasan.
        if (AngsuranGadai::where('gadai_id', $gadai->id)
            ->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi->value)
            ->exists()) {
            return $this->errorResponse('Masih ada pembayaran angsuran yang menunggu verifikasi. Verifikasi/tolak dahulu sebelum pelunasan.', 422, 'ANGSURAN_PENDING');
        }

        $request->validate([
            'nominal' => 'nullable|numeric|min:1',
        ]);

        $sisa = $gadai->sisaPokok();

        if ($request->filled('nominal') && round((float) $request->nominal, 2) < round($sisa, 2)) {
            return $this->errorResponse('Nominal kurang dari sisa pokok (Rp ' . number_format($sisa, 0, ',', '.') . ').', 422, 'NOMINAL_KURANG');
        }

        DB::transaction(function () use ($gadai, $sisa, $request) {
            if ($sisa > 0) {
                AngsuranGadai::create([
                    'gadai_id' => $gadai->id,
                    'tanggal_bayar' => now()->toDateString(),
                    'nominal' => $sisa,
                    'metode_pembayaran' => 'transfer',
                    'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                    'catatan' => 'Pelunasan penuh sisa pokok.',
                    'created_by' => $request->user()->id,
                ]);

                Transaksi::create([
                    'nomor_referensi' => Transaksi::generateNomorReferensi(),
                    'user_id' => $gadai->user_id,
                    'gadai_id' => $gadai->id,
                    'jenis_transaksi' => 'setor',
                    'nominal' => $sisa,
                    'metode_pembayaran' => 'transfer',
                    'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                    'diverifikasi_oleh' => $request->user()->id,
                    'diverifikasi_pada' => now(),
                    'catatan_admin' => 'Pelunasan penuh sisa pokok gadai ' . $gadai->nomor_gadai,
                    'tanggal_transaksi' => now()->toDateString(),
                ]);
            }

            AuditLog::record(
                'gadai.lunasi',
                $gadai,
                ['status' => $gadai->status->value, 'sisa_pokok' => $sisa],
                ['status' => StatusGadai::EmasDikembalikan->value, 'tanggal_lunas' => now()->toDateString()],
            );

            $gadai->update([
                'status' => StatusGadai::EmasDikembalikan,
                'total_dibayar' => (float) $gadai->besaran_gadai,
                'tanggal_lunas' => now()->toDateString(),
            ]);
        });

        $this->notif->kirim(
            $gadai->user,
            'Silakan Ambil Emas Anda Kembali',
            'Selamat! Gadai ' . $gadai->nomor_gadai . ' Anda telah LUNAS dan emas sudah dikembalikan. '
                . 'Silakan ambil emas fisik Anda kembali di toko.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id, 'status' => StatusGadai::EmasDikembalikan->value]
        );

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            'Gadai LUNAS, emas dikembalikan kepada peserta.'
        );
    }

    /**
     * POST /admin/gadai/{gadai}/kembalikan-emas — serah terima emas ke user
     * setelah angsuran selesai (status LUNAS). Notif hanya ke user.
     */
    public function kembalikanEmas(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->status !== StatusGadai::Lunas) {
            return $this->errorResponse('Hanya gadai berstatus LUNAS yang bisa mengembalikan emas.', 422, 'STATUS_TIDAK_VALID');
        }

        AuditLog::record(
            'gadai.kembalikan_emas',
            $gadai,
            ['status' => $gadai->status->value],
            ['status' => StatusGadai::EmasDikembalikan->value],
        );

        $gadai->update(['status' => StatusGadai::EmasDikembalikan]);

        $this->notif->kirim(
            $gadai->user,
            'Silakan Ambil Emas Anda Kembali',
            'Emas gadai ' . $gadai->nomor_gadai . ' Anda sudah dikembalikan. '
                . 'Silakan ambil emas fisik Anda kembali di toko.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id, 'status' => StatusGadai::EmasDikembalikan->value]
        );

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            'Emas dikembalikan kepada peserta.'
        );
    }

    /**
     * POST /admin/gadai/{gadai}/batal — pembatalan: emas dikembalikan 100%,
     * potongan 10% dari total pembayaran yang sudah masuk; sisanya dikembalikan.
     */
    public function batal(Request $request, Gadai $gadai): JsonResponse
    {
        if (in_array($gadai->status, [StatusGadai::Lunas, StatusGadai::Batal], true)) {
            return $this->errorResponse('Gadai sudah LUNAS/BATAL dan tidak bisa dibatalkan lagi.', 422, 'STATUS_TIDAK_VALID');
        }

        $totalDibayar = (float) $gadai->total_dibayar;
        $rincian = $this->gadaiService->hitungRefundBatal($totalDibayar);

        AuditLog::record(
            'gadai.batal',
            $gadai,
            ['status' => $gadai->status->value, 'total_dibayar' => $totalDibayar],
            ['status' => StatusGadai::Batal->value, 'potongan_10_persen' => $rincian['potongan'], 'refund' => $rincian['refund']],
        );

        $catatan = ($gadai->catatan ? $gadai->catatan . "\n" : '')
            . '[BATAL] Emas dikembalikan. Potongan 10% (Rp '
            . number_format($rincian['potongan'], 0, ',', '.')
            . ') dari pembayaran (Rp '
            . number_format($totalDibayar, 0, ',', '.')
            . '), refund Rp ' . number_format($rincian['refund'], 0, ',', '.') . '.';

        $gadai->update(['status' => StatusGadai::Batal, 'catatan' => $catatan]);

        $this->notif->kirim(
            $gadai->user,
            'Gadai Dibuat Batal',
            'Gadai ' . $gadai->nomor_gadai . ' Anda dibatalkan. Emas dikembalikan 100%; potongan 10% Rp '
                . number_format($rincian['potongan'], 0, ',', '.') . ' dari pembayaran, refund Rp '
                . number_format($rincian['refund'], 0, ',', '.') . '.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id]
        );

        return $this->successResponse([
            'gadai' => $this->gadaiArray($gadai->fresh(['user'])),
            'refund' => [
                'total_dibayar' => $totalDibayar,
                'potongan_10_persen' => $rincian['potongan'],
                'nominal_refund' => $rincian['refund'],
            ],
        ], 'Gadai dibatalkan. Emas dikembalikan ke peserta. Potongan 10% tercatat di catatan gadai.');
    }

    /**
     * POST /admin/gadai/{gadai}/terlambat — tandai JATUH TEMPO → TERLAMBAT secara manual.
     */
    public function terlambat(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [StatusGadai::Aktif, StatusGadai::JatuhTempo], true)) {
            return $this->errorResponse('Hanya gadai AKTIF / JATUH TEMPO yang bisa ditandai terlambat.', 422, 'STATUS_TIDAK_VALID');
        }

        AuditLog::record(
            'gadai.terlambat',
            $gadai,
            ['status' => $gadai->status->value],
            ['status' => StatusGadai::Terlambat->value],
        );

        $gadai->update(['status' => StatusGadai::Terlambat]);

        return $this->successResponse($this->gadaiArray($gadai->fresh(['user'])), 'Gadai ditandai TERLAMBAT. Aplikasikan aturan keterlambatan (perpanjang atau pelunasan).');
    }

    /**
     * POST /admin/gadai/{gadai}/perpanjang — TERLAMBAT/JATUH TEMPO → DIPERPANJANG,
     * jatuh tempo baru = max(hari ini, jatuh tempo lama) + satu periode tenor.
     */
    public function perpanjang(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [StatusGadai::JatuhTempo, StatusGadai::Terlambat, StatusGadai::Diperpanjang], true)) {
            return $this->errorResponse('Hanya gadai JATUH TEMPO / TERLAMBAT / DIPERPANJANG yang bisa diperpanjang.', 422, 'STATUS_TIDAK_VALID');
        }

        $dasar = max(Carbon::parse($gadai->tanggal_jatuh_tempo), now());
        $baru = $this->gadaiService->hitungJatuhTempo($dasar, $gadai->tenor_satuan);

        AuditLog::record(
            'gadai.perpanjang',
            $gadai,
            ['status' => $gadai->status->value, 'tanggal_jatuh_tempo' => $gadai->tanggal_jatuh_tempo?->toDateString()],
            ['status' => StatusGadai::Diperpanjang->value, 'tanggal_jatuh_tempo' => $baru->toDateString()],
        );

        $gadai->update([
            'status' => StatusGadai::Diperpanjang,
            'tanggal_jatuh_tempo' => $baru->toDateString(),
        ]);

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            'Tenor diperpanjang. Jatuh tempo baru: ' . $baru->translatedFormat('d M Y') . '.'
        );
    }

    /**
     * POST /admin/gadai/angsuran/{angsuran}/verifikasi — verifikasi angsuran dari user.
     */
    public function verifikasiAngsuran(Request $request, AngsuranGadai $angsuran): JsonResponse
    {
        if (! $angsuran->isMenungguVerifikasi()) {
            return $this->errorResponse('Angsuran ini sudah diverifikasi sebelumnya.', 409, 'CONFLICT');
        }

        $gadai = $angsuran->gadai;

        if (! in_array($gadai->status, [
            StatusGadai::Aktif,
            StatusGadai::JatuhTempo,
            StatusGadai::Terlambat,
            StatusGadai::Diperpanjang,
        ], true)) {
            return $this->errorResponse('Gadai tidak dalam masa pembayaran aktif.', 422, 'STATUS_TIDAK_VALID');
        }

        $nominal = (float) $angsuran->nominal;
        $sisa = round((float) $gadai->sisaPokok(), 2);
        $pendingLain = round((float) AngsuranGadai::where('gadai_id', $gadai->id)
            ->where('id', '!=', $angsuran->id)
            ->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi->value)
            ->sum('nominal'), 2);
        $sisaEfektif = round($sisa - $pendingLain, 2);

        if ($nominal > $sisaEfektif && abs($nominal - $sisaEfektif) > 0.01) {
            return $this->errorResponse('Nominal melebihi sisa pokok yang belum dibayar (Rp ' . number_format($sisaEfektif, 0, ',', '.') . ').', 422, 'MELEBIHI_SISA');
        }

        $terbayar = round((float) $gadai->total_dibayar + $nominal, 2);
        $lunas = $terbayar >= (float) $gadai->besaran_gadai;

        DB::transaction(function () use ($request, $angsuran, $gadai, $nominal, $terbayar, $lunas) {
            $angsuran->update([
                'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                'diverifikasi_oleh' => $request->user()->id,
                'diverifikasi_pada' => now(),
            ]);

            $gadai->update([
                'total_dibayar' => $terbayar,
                'status' => $lunas ? StatusGadai::Lunas : $gadai->status,
                'tanggal_lunas' => $lunas ? now()->toDateString() : $gadai->tanggal_lunas,
            ]);

            // Sync to riwayat transaksi user
            Transaksi::create([
                'nomor_referensi' => Transaksi::generateNomorReferensi(),
                'user_id' => $gadai->user_id,
                'gadai_id' => $gadai->id,
                'jenis_transaksi' => 'setor',
                'nominal' => $nominal,
                'metode_pembayaran' => $angsuran->metode_pembayaran ?? 'transfer',
                'status_verifikasi' => StatusVerifikasi::Terverifikasi->value,
                'diverifikasi_oleh' => $request->user()->id,
                'diverifikasi_pada' => now(),
                'catatan_admin' => 'Pembayaran angsuran gadai ' . $gadai->nomor_gadai,
                'catatan_user' => $angsuran->catatan,
                'tanggal_transaksi' => $angsuran->tanggal_bayar->toDateString(),
            ]);

            AuditLog::record('gadai.verifikasi_angsuran', $angsuran, null, [
                'nominal' => $nominal,
                'total_dibayar' => $terbayar,
                'lunas' => $lunas,
            ]);
        });

        $message = $lunas
            ? 'Angsuran diverifikasi — gadai LUNAS. Tekan "Kembalikan Emas" untuk menyerahkan emas ke peserta.'
            : 'Angsuran diverifikasi. Sisa pokok: Rp ' . number_format(round($gadai->sisaPokok() - $nominal, 2), 0, ',', '.') . '.';

        $this->notif->kirim(
            $gadai->user,
            $lunas ? 'Gadai Lunas' : 'Angsuran Gadai Diverifikasi',
            $lunas
                ? 'Selamat! Angsuran terakhir Anda terverifikasi dan gadai ' . $gadai->nomor_gadai . ' LUNAS. Emas siap dikembalikan; tunggu konfirmasi pengambilan di toko.'
                : 'Pembayaran angsuran gadai ' . $gadai->nomor_gadai . ' sebesar Rp '
                    . number_format($nominal, 0, ',', '.') . ' telah diverifikasi.',
            TipeNotifikasi::Info,
            ['gadai_id' => $gadai->id, 'angsuran_id' => $angsuran->id]
        );

        return $this->successResponse($this->gadaiArray($gadai->fresh(['user'])), $message);
    }

    /**
     * POST /admin/gadai/angsuran/{angsuran}/tolak — tolak angsuran dari user.
     */
    public function tolakAngsuran(Request $request, AngsuranGadai $angsuran): JsonResponse
    {
        if (! $angsuran->isMenungguVerifikasi()) {
            return $this->errorResponse('Angsuran ini sudah diproses sebelumnya.', 409, 'CONFLICT');
        }

        $request->validate([
            'catatan_admin' => 'required|string|max:500',
        ]);

        $angsuran->update([
            'status_verifikasi' => StatusVerifikasi::Ditolak->value,
            'catatan_admin' => $request->catatan_admin,
            'diverifikasi_oleh' => $request->user()->id,
            'diverifikasi_pada' => now(),
        ]);

        AuditLog::record('gadai.tolak_angsuran', $angsuran);

        $this->notif->kirim(
            $angsuran->gadai->user,
            'Angsuran Gadai Ditolak',
            'Pembayaran angsuran gadai ' . $angsuran->gadai->nomor_gadai . ' sebesar Rp '
                . number_format((float) $angsuran->nominal, 0, ',', '.')
                . ' ditolak. Alasan: ' . $request->catatan_admin,
            TipeNotifikasi::Verifikasi,
            ['gadai_id' => $angsuran->gadai_id, 'angsuran_id' => $angsuran->id]
        );

        return $this->successResponse(null, 'Angsuran ditolak.');
    }

    /**
     * DELETE /admin/gadai/{gadai} — hapus pengajuan yang belum berjalan, atau arsip BATAL.
     */
    public function destroy(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [StatusGadai::Diajukan, StatusGadai::Disetujui, StatusGadai::Batal], true)) {
            return $this->errorResponse('Hanya gadai DIAJUKAN / DISETUJUI / BATAL yang bisa dihapus. Untuk yang masih berjalan gunakan menu Batal/Pelunasan.', 422, 'STATUS_TIDAK_VALID');
        }

        AuditLog::record('gadai.delete', $gadai, $this->gadaiArray($gadai), null);
        $gadai->delete();

        return $this->deletedResponse('Data pengajuan gadai dihapus.');
    }

    // ─── Helpers ───────────────────────────────────────────────

    private function validateCreate(Request $request): array
    {
        return $request->validate([
            'user_id' => 'required|exists:users,id',
            'jenis_emas' => 'required|string|max:100',
            'berat_gram' => 'required|numeric|min:0.01|max:10000',
            'kadar' => 'required|numeric|min:1|max:1000',
            'harga_acuan' => 'nullable|numeric|min:1',
            'persen_gadai' => 'nullable|numeric|min:1|max:100',
            'tenor_satuan' => 'required|in:harian,mingguan,bulanan',
            'frekuensi_bayar' => 'required|in:harian,mingguan,bulanan',
            'nominal_angkuran' => 'nullable|numeric|min:0',
            'bunga_persen' => 'nullable|numeric|min:0|max:100',
            'tipe_bunga' => 'nullable|string|in:menurun,flat',
            'toleransi_hari' => 'nullable|integer|min:0',
            'tanggal_aju' => 'nullable|date',
            'catatan' => 'nullable|string|max:1000',
        ]);
    }

    private function resolveHargaAcuan(?float $manual): ?float
    {
        if ($manual !== null) {
            return $manual;
        }

        $harga = $this->emasService->getHargaTerkini();

        return $harga ? (float) $harga->harga_per_gram : null;
    }

    /**
     * Bentuk serialisasi konsisten untuk daftar/detail gadai.
     */
    private function gadaiArray(Gadai $gadai): array
    {
        $user = $gadai->user;

        return [
            'id' => $gadai->id,
            'nomor_gadai' => $gadai->nomor_gadai,
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'phone' => $user->phone,
                'nomor_anggota' => $user->nomor_anggota,
            ] : null,
            'user_id' => $gadai->user_id,
            'jenis_emas' => $gadai->jenis_emas,
            'berat_gram' => (float) $gadai->berat_gram,
            'kadar' => (float) $gadai->kadar,
            'berat_bersih_gram' => (float) $gadai->berat_bersih_gram,
            'harga_acuan' => (float) $gadai->harga_acuan,
            'nilai_taksiran' => (float) $gadai->nilai_taksiran,
            'persen_gadai' => (float) $gadai->persen_gadai,
            'besaran_gadai' => (float) $gadai->besaran_gadai,
            'tanggal_aju' => $gadai->tanggal_aju?->toDateString(),
            'tanggal_aktif' => $gadai->tanggal_aktif?->toDateString(),
            'tanggal_jatuh_tempo' => $gadai->tanggal_jatuh_tempo?->toDateString(),
            'tenor_satuan' => $gadai->tenor_satuan,
            'toleransi_hari' => (int) $gadai->toleransi_hari,
            'frekuensi_bayar' => $gadai->frekuensi_bayar,
            'nominal_angkuran' => (float) $gadai->nominal_angkuran,
            'bunga_persen' => (float) $gadai->bunga_persen,
            'tipe_bunga' => $gadai->tipe_bunga,
            'total_dibayar' => (float) $gadai->total_dibayar,
            'sisa_pokok' => $gadai->sisaPokok(),
            'tanggal_lunas' => $gadai->tanggal_lunas?->toDateString(),
            'status' => $gadai->status->value,
            'status_label' => $gadai->status->label(),
            'catatan' => $gadai->catatan,
            'created_at' => $gadai->created_at?->toISOString(),
            'angsuran' => $gadai->relationLoaded('angsuran')
                ? $gadai->angsuran->map(fn (AngsuranGadai $a) => [
                    'id' => $a->id,
                    'gadai_id' => $a->gadai_id,
                    'tanggal_bayar' => $a->tanggal_bayar?->toDateString(),
                    'nominal' => (float) $a->nominal,
                    'metode_pembayaran' => $a->metode_pembayaran,
                    'catatan' => $a->catatan,
                    'status_verifikasi' => $a->status_verifikasi instanceof StatusVerifikasi
                        ? $a->status_verifikasi->value
                        : (string) $a->status_verifikasi,
                    'bukti_transfer_path' => $a->bukti_transfer_path,
                    'bukti_transfer_url' => $a->bukti_transfer_path ? url('/api/v1/admin/gadai/angsuran/' . $a->id . '/bukti') : null,
                    'created_at' => $a->created_at?->toISOString(),
                ])->values()
                : [],
        ];
    }

    /**
     * GET /admin/gadai/angsuran/{angsuran}/bukti — lihat file bukti pembayaran angsuran.
     */
    public function showBukti(Request $request, AngsuranGadai $angsuran)
    {
        if (! $angsuran->bukti_transfer_path || ! Storage::disk('local')->exists($angsuran->bukti_transfer_path)) {
            abort(404, 'Bukti transfer tidak ditemukan.');
        }

        return Storage::disk('local')->response($angsuran->bukti_transfer_path);
    }
}