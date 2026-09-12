<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\StatusGadai;
use App\Enums\StatusVerifikasi;
use App\Http\Controllers\Controller;
use App\Models\AngsuranGadai;
use App\Models\AuditLog;
use App\Models\Gadai;
use App\Services\EmasConversionService;
use App\Services\GadaiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class GadaiController extends Controller
{
    use ApiResponse;

    public function __construct(
        private GadaiService $gadaiService,
        private EmasConversionService $emasService,
    ) {}

    /**
     * POST /gadai-saya — nasabah mengajukan gadai sendiri (status DIAJUKAN).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenis_emas' => 'required|string|max:100',
            'berat_gram' => 'required|numeric|min:0.01|max:10000',
            'kadar' => 'required|numeric|min:1|max:1000',
            'tenor_satuan' => 'required|in:harian,mingguan,bulanan',
            'frekuensi_bayar' => 'required|in:harian,mingguan,bulanan',
            'nominal_angkuran' => 'required|numeric|min:1',
            'catatan' => 'nullable|string|max:1000',
        ]);

        $harga = $this->emasService->getHargaTerkini();
        if (! $harga) {
            return $this->errorResponse('Harga emas acuan belum diinput oleh admin. Coba lagi nanti.', 400, 'HARGA_TIDAK_ADA');
        }

        $berat = round((float) $data['berat_gram'], 4);
        $kadar = round((float) $data['kadar'], 2);
        $beratBersih = $this->gadaiService->hitungBeratBersih($berat, $kadar);
        $taksiran = $this->gadaiService->hitungNilaiTaksiran($beratBersih, (float) $harga->harga_per_gram);
        $besaran = $this->gadaiService->hitungBesaran($taksiran, 80);

        $gadai = Gadai::create([
            'nomor_gadai' => $this->gadaiService->buatNomorGadai(),
            'user_id' => $request->user()->id,
            'jenis_emas' => $data['jenis_emas'],
            'berat_gram' => $berat,
            'kadar' => $kadar,
            'berat_bersih_gram' => $beratBersih,
            'harga_acuan' => round((float) $harga->harga_per_gram, 2),
            'nilai_taksiran' => $taksiran,
            'persen_gadai' => 80,
            'besaran_gadai' => $besaran,
            'tanggal_aju' => now()->toDateString(),
            'tenor_satuan' => $data['tenor_satuan'],
            'toleransi_hari' => 0,
            'frekuensi_bayar' => $data['frekuensi_bayar'],
            'nominal_angkuran' => round((float) $data['nominal_angkuran'], 2),
            'status' => StatusGadai::Diajukan,
            'catatan' => $data['catatan'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('gadai.store', $gadai, null, ['nomor_gadai' => $gadai->nomor_gadai, 'besaran_gadai' => $besaran]);

        return $this->createdResponse([
            'id' => $gadai->id,
            'nomor_gadai' => $gadai->nomor_gadai,
            'nilai_taksiran' => $taksiran,
            'besaran_gadai' => $besaran,
            'persen_gadai' => 80,
            'status' => $gadai->status->value,
        ], 'Pengajuan gadai berhasil dikirim. Tunggu persetujuan admin.');
    }

    /**
     * POST /gadai-saya/{gadai}/bayar — nasabah mengirim pembayaran angsuran.
     * Status: menunggu_verifikasi (admin harus approve).
     */
    public function bayar(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->user_id !== $request->user()->id) {
            return $this->errorResponse('Gadai tidak ditemukan.', 404, 'NOT_FOUND');
        }

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
            'metode_pembayaran' => 'required|in:cash,transfer',
            'bukti_transfer' => 'nullable|image|max:5120',
            'catatan' => 'nullable|string|max:500',
        ]);

        $nominal = round((float) $request->nominal, 2);
        $sisa = $gadai->sisaPokok();

        // Account for pending (unverified) angsuran already submitted
        $pendingNominal = AngsuranGadai::where('gadai_id', $gadai->id)
            ->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi->value)
            ->sum('nominal');
        $sisaEfektif = round($sisa - (float) $pendingNominal, 2);

        if ($nominal > $sisaEfektif && abs($nominal - $sisaEfektif) > 1) {
            return $this->errorResponse('Nominal melebihi sisa pokok yang belum dibayar (Rp ' . number_format($sisaEfektif, 0, ',', '.') . ').', 422, 'MELEBIHI_SISA');
        }

        $buktiPath = null;
        if ($request->hasFile('bukti_transfer')) {
            $buktiPath = $request->file('bukti_transfer')
                ->store('bukti-angsuran-gadai/' . $gadai->id, 'local');
        }

        $angsuran = AngsuranGadai::create([
            'gadai_id' => $gadai->id,
            'tanggal_bayar' => now()->toDateString(),
            'nominal' => $nominal,
            'metode_pembayaran' => $request->metode_pembayaran,
            'catatan' => $request->catatan,
            'status_verifikasi' => StatusVerifikasi::MenungguVerifikasi->value,
            'bukti_transfer_path' => $buktiPath,
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('gadai.bayar_user', $gadai, null, [
            'angsuran_id' => $angsuran->id,
            'nominal' => $nominal,
        ]);

        return $this->createdResponse([
            'id' => $angsuran->id,
            'tanggal_bayar' => $angsuran->tanggal_bayar->toDateString(),
            'nominal' => $nominal,
            'status_verifikasi' => $angsuran->status_verifikasi->value,
        ], 'Pembayaran angsuran berhasil dikirim. Tunggu verifikasi admin.');
    }

    /**
     * GET /gadai-saya — daftar gadai milik nasabah.
     */
    public function index(Request $request): JsonResponse
    {
        $gadai = Gadai::query()
            ->milikUser($request->user()->id)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(min((int) ($request->per_page ?? 25), 100));

        $items = collect($gadai->items())->map(fn (Gadai $g) => [
            'id' => $g->id,
            'nomor_gadai' => $g->nomor_gadai,
            'jenis_emas' => $g->jenis_emas,
            'berat_gram' => (float) $g->berat_gram,
            'berat_bersih_gram' => (float) $g->berat_bersih_gram,
            'nilai_taksiran' => (float) $g->nilai_taksiran,
            'besaran_gadai' => (float) $g->besaran_gadai,
            'persen_gadai' => (float) $g->persen_gadai,
            'nominal_angkuran' => (float) $g->nominal_angkuran,
            'frekuensi_bayar' => $g->frekuensi_bayar,
            'tenor_satuan' => $g->tenor_satuan,
            'tanggal_aktif' => $g->tanggal_aktif?->toDateString(),
            'tanggal_jatuh_tempo' => $g->tanggal_jatuh_tempo?->toDateString(),
            'total_dibayar' => (float) $g->total_dibayar,
            'sisa_pokok' => $g->sisaPokok(),
            'status' => $g->status->value,
            'status_label' => $g->status->label(),
            'created_at' => $g->created_at?->toISOString(),
        ]);

        return $this->successResponse([
            'items' => $items,
            'meta' => [
                'current_page' => $gadai->currentPage(),
                'per_page' => $gadai->perPage(),
                'total' => $gadai->total(),
                'last_page' => $gadai->lastPage(),
            ],
        ]);
    }

    /**
     * GET /gadai-saya/{gadai} — detail + riwayat angsuran (hanya milik sendiri).
     */
    public function show(Request $request, Gadai $gadai): JsonResponse
    {
        if ($gadai->user_id !== $request->user()->id) {
            return $this->errorResponse('Gadai tidak ditemukan.', 404, 'NOT_FOUND');
        }

        $gadai->load('angsuran');

        return $this->successResponse([
            'id' => $gadai->id,
            'nomor_gadai' => $gadai->nomor_gadai,
            'jenis_emas' => $gadai->jenis_emas,
            'berat_gram' => (float) $gadai->berat_gram,
            'kadar' => (float) $gadai->kadar,
            'berat_bersih_gram' => (float) $gadai->berat_bersih_gram,
            'harga_acuan' => (float) $gadai->harga_acuan,
            'nilai_taksiran' => (float) $gadai->nilai_taksiran,
            'persen_gadai' => (float) $gadai->persen_gadai,
            'besaran_gadai' => (float) $gadai->besaran_gadai,
            'nominal_angkuran' => (float) $gadai->nominal_angkuran,
            'frekuensi_bayar' => $gadai->frekuensi_bayar,
            'tenor_satuan' => $gadai->tenor_satuan,
            'tanggal_aju' => $gadai->tanggal_aju?->toDateString(),
            'tanggal_aktif' => $gadai->tanggal_aktif?->toDateString(),
            'tanggal_jatuh_tempo' => $gadai->tanggal_jatuh_tempo?->toDateString(),
            'tanggal_lunas' => $gadai->tanggal_lunas?->toDateString(),
            'total_dibayar' => (float) $gadai->total_dibayar,
            'sisa_pokok' => $gadai->sisaPokok(),
            'status' => $gadai->status->value,
            'status_label' => $gadai->status->label(),
            'catatan' => $gadai->catatan,
            'angsuran' => $gadai->angsuran->map(fn (AngsuranGadai $a) => [
                'id' => $a->id,
                'tanggal_bayar' => $a->tanggal_bayar?->toDateString(),
                'nominal' => (float) $a->nominal,
                'metode_pembayaran' => $a->metode_pembayaran,
                'catatan' => $a->catatan,
                'status_verifikasi' => $a->status_verifikasi?->value ?? 'terverifikasi',
                'bukti_transfer_path' => $a->bukti_transfer_path,
                'pencatat' => $a->createdBy?->name,
            ])->values(),
        ]);
    }
}