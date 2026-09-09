<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\StatusGadai;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AngsuranGadai;
use App\Models\AuditLog;
use App\Models\Gadai;
use App\Models\User;
use App\Services\EmasConversionService;
use App\Services\GadaiService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
    ) {}

    /**
     * GET /admin/gadai — daftar & ringkasan.
     */
    public function index(Request $request): JsonResponse
    {
        $gadai = Gadai::query()
            ->with(['user:id,name,phone,nomor_anggota'])
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
            ->paginate(min((int) ($request->per_page ?? 25), 100));

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

        $gadai = Gadai::create([
            'nomor_gadai' => $this->gadaiService->buatNomorGadai(),
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
            'status' => StatusGadai::Diajukan,
            'catatan' => $data['catatan'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('gadai.store', $gadai, null, $this->gadaiArray($gadai));

        return $this->createdResponse($this->gadaiArray($gadai->load('user:id,name,phone,nomor_anggota')),
            'Pengajuan gadai emas berhasil dibuat. Tunggu persetujuan admin.');
    }

    /**
     * GET /admin/gadai/{gadai} — detail + riwayat angsuran.
     */
    public function show(Gadai $gadai): JsonResponse
    {
        $gadai->load(['user:id,email,name,phone,nomor_anggota,address', 'angsuran.createdBy:id,name']);

        $data = $this->gadaiArray($gadai);
        $data['angsuran'] = $gadai->angsuran->map(fn (AngsuranGadai $a) => [
            'id' => $a->id,
            'tanggal_bayar' => $a->tanggal_bayar?->toDateString(),
            'nominal' => (float) $a->nominal,
            'metode_pembayaran' => $a->metode_pembayaran,
            'catatan' => $a->catatan,
            'pencatat' => $a->createdBy?->name,
        ])->values();

        return $this->successResponse($data);
    }

    /**
     * POST /admin/gadai/{gadai}/approve — DIAJUKAN → DISETUJUI.
     */
    public function approve(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->status !== StatusGadai::Diajukan) {
            return $this->errorResponse('Hanya pengajuan berstatus DIAJUKAN yang bisa disetujui.', 422, 'STATUS_TIDAK_VALID');
        }

        AuditLog::record(
            'gadai.approve',
            $gadai,
            ['status' => $gadai->status->value],
            ['status' => StatusGadai::Disetujui->value],
        );

        $gadai->update(['status' => StatusGadai::Disetujui]);

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            'Gadai disetujui. Klik "Salurkan Pembiayaan" untuk mencairkan besaran gadai.'
        );
    }

    /**
     * POST /admin/gadai/{gadai}/aktifkan — DISETUJUI → AKTIF (pembiayaan cair).
     * Menghitung tanggal jatuh tempo dari tanggal_aktif + tenor.
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
            $a = AngsuranGadai::create([
                'gadai_id' => $gadai->id,
                'tanggal_bayar' => $request->filled('tanggal_bayar') ? $request->tanggal_bayar : now()->toDateString(),
                'nominal' => $nominal,
                'metode_pembayaran' => $request->metode_pembayaran ?? 'cash',
                'catatan' => $request->catatan,
                'created_by' => $request->user()->id,
            ]);

            $gadai->update([
                'total_dibayar' => $terbayar,
                'status' => $lunas ? StatusGadai::Lunas : $gadai->status,
                'tanggal_lunas' => $lunas ? now()->toDateString() : $gadai->tanggal_lunas,
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
            ? 'Pembayaran diterima — gadai LUNAS. Emas dikembalikan ke peserta.'
            : 'Pembayaran angsuran tercatat. Sisa pokok: Rp ' . number_format(round($sisa - $nominal, 2), 0, ',', '.') . '.';

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
     * POST /admin/gadai/{gadai}/lunasi — pelunasan penuh sisa pokok, emas dikembalikan.
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

        $sisa = $gadai->sisaPokok();

        DB::transaction(function () use ($gadai, $sisa, $request) {
            if ($sisa > 0) {
                AngsuranGadai::create([
                    'gadai_id' => $gadai->id,
                    'tanggal_bayar' => now()->toDateString(),
                    'nominal' => $sisa,
                    'metode_pembayaran' => 'transfer',
                    'catatan' => 'Pelunasan penuh sisa pokok.',
                    'created_by' => $request->user()->id,
                ]);
            }

            AuditLog::record(
                'gadai.lunasi',
                $gadai,
                ['status' => $gadai->status->value, 'sisa_pokok' => $sisa],
                ['status' => StatusGadai::Lunas->value, 'tanggal_lunas' => now()->toDateString()],
            );

            $gadai->update([
                'status' => StatusGadai::Lunas,
                'total_dibayar' => (float) $gadai->besaran_gadai,
                'tanggal_lunas' => now()->toDateString(),
            ]);
        });

        return $this->successResponse(
            $this->gadaiArray($gadai->fresh(['user'])),
            'Gadai LUNAS. Emas dikembalikan kepada peserta.'
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
     * DELETE /admin/gadai/{gadai} — hapus hanya pengajuan yang belum berjalan.
     */
    public function destroy(Request $request, Gadai $gadai): JsonResponse
    {
        if (! in_array($gadai->status, [StatusGadai::Diajukan, StatusGadai::Disetujui], true)) {
            return $this->errorResponse('Hanya gadai DIAJUKAN / DISETUJUI yang bisa dihapus. Untuk yang sudah berjalan gunakan menu Batal/Pelunasan.', 422, 'STATUS_TIDAK_VALID');
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
            'total_dibayar' => (float) $gadai->total_dibayar,
            'sisa_pokok' => $gadai->sisaPokok(),
            'tanggal_lunas' => $gadai->tanggal_lunas?->toDateString(),
            'status' => $gadai->status->value,
            'status_label' => $gadai->status->label(),
            'catatan' => $gadai->catatan,
            'created_at' => $gadai->created_at?->toISOString(),
        ];
    }
}