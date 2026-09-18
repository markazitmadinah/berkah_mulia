<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\StatusGadai;
use App\Enums\StatusVerifikasi;
use App\Enums\TipeNotifikasi;
use App\Http\Controllers\Controller;
use App\Models\AngsuranGadai;
use App\Models\AuditLog;
use App\Models\Gadai;
use App\Services\GadaiService;
use App\Services\NotifikasiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class GadaiController extends Controller
{
    use ApiResponse;

    public function __construct(
        private GadaiService $gadaiService,
        private NotifikasiService $notif,
    ) {}

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

        $nominal = round((float) ($request->nominal ?? 0), 2);
        $sisa = round($gadai->sisaPokok(), 2);

        // Account for pending (unverified) angsuran already submitted
        $pendingNominal = AngsuranGadai::where('gadai_id', $gadai->id)
            ->where('status_verifikasi', StatusVerifikasi::MenungguVerifikasi->value)
            ->sum('nominal');
        $sisaEfektif = round($sisa - (float) $pendingNominal, 2);
        $pelunasan = abs($nominal - $sisaEfektif) <= 0.01;

        if ($pelunasan && ! $request->hasFile('bukti_transfer')) {
            return $this->errorResponse('Pelunasan gadai wajib melampirkan bukti transfer.', 422, 'BUKTI_WAJIB');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:1',
            'metode_pembayaran' => 'required|in:cash,transfer',
            'bukti_transfer' => ($pelunasan ? 'required' : 'nullable') . '|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'catatan' => 'nullable|string|max:500',
        ]);

        $angkuran = round((float) $gadai->nominal_angkuran, 2);

        if ($nominal > $sisaEfektif && abs($nominal - $sisaEfektif) > 0.01) {
            return $this->errorResponse('Nominal melebihi sisa pokok yang belum dibayar (Rp ' . number_format($sisaEfektif, 0, ',', '.') . ').', 422, 'MELEBIHI_SISA');
        }

        // User hanya boleh angsur sesuai angkuran yang diset admin, atau melunasi sisa pokok.
        $sesuai = $pelunasan || ($angkuran > 0 && abs($nominal - $angkuran) <= 0.01);
        if (! $sesuai) {
            $pilihan = 'sisa pokok (Rp ' . number_format($sisaEfektif, 0, ',', '.') . ')';
            if ($angkuran > 0) {
                $pilihan = 'angsuran per periode (Rp ' . number_format($angkuran, 0, ',', '.') . ') atau ' . $pilihan;
            }

            return $this->errorResponse('Nominal harus sesuai ketentuan admin: ' . $pilihan . '.', 422, 'NOMINAL_HARUS_SESUAI_ATURAN');
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

        $this->notif->kirimKeSemuaAdmin(
            'Pembayaran Angsuran Gadai',
            $request->user()->name . ' mengirim pembayaran angsuran gadai ' . $gadai->nomor_gadai
                . ' sebesar Rp ' . number_format($nominal, 0, ',', '.')
                . ($pelunasan ? ' (pelunasan). Emas dapat dikembalikan setelah diverifikasi.' : '.')
                . ' Silakan verifikasi.',
            TipeNotifikasi::Verifikasi,
            ['gadai_id' => $gadai->id, 'angsuran_id' => $angsuran->id]
        );

        return $this->createdResponse([
            'id' => $angsuran->id,
            'tanggal_bayar' => $angsuran->tanggal_bayar->toDateString(),
            'nominal' => $nominal,
            'status_verifikasi' => $angsuran->status_verifikasi->value,
        ], $pelunasan
            ? 'Pembayaran pelunasan berhasil dikirim. Tunggu verifikasi admin.'
            : 'Pembayaran angsuran berhasil dikirim. Tunggu verifikasi admin.');
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
            ->paginate(min((int) ($request->per_page ?? 25), 1000));

        $items = collect($gadai->items())->map(fn (Gadai $g) => [
            'id' => $g->id,
            'nomor_gadai' => $g->nomor_gadai,
            'jenis_emas' => $g->jenis_emas,
            'berat_gram' => (float) $g->berat_gram,
            'kadar' => (float) $g->kadar,
            'berat_bersih_gram' => (float) $g->berat_bersih_gram,
            'harga_acuan' => (float) $g->harga_acuan,
            'nilai_taksiran' => (float) $g->nilai_taksiran,
            'besaran_gadai' => (float) $g->besaran_gadai,
            'persen_gadai' => (float) $g->persen_gadai,
            'nominal_angkuran' => (float) $g->nominal_angkuran,
            'bunga_persen' => (float) $g->bunga_persen,
            'tipe_bunga' => $g->tipe_bunga,
            'frekuensi_bayar' => $g->frekuensi_bayar,
            'tenor_satuan' => $g->tenor_satuan,
            'toleransi_hari' => (int) $g->toleransi_hari,
            'tanggal_aju' => $g->tanggal_aju?->toDateString(),
            'tanggal_aktif' => $g->tanggal_aktif?->toDateString(),
            'tanggal_jatuh_tempo' => $g->tanggal_jatuh_tempo?->toDateString(),
            'tanggal_lunas' => $g->tanggal_lunas?->toDateString(),
            'total_dibayar' => (float) $g->total_dibayar,
            'sisa_pokok' => $g->sisaPokok(),
            'status' => $g->status->value,
            'status_label' => $g->status->label(),
            'catatan' => $g->catatan,
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
            'bunga_persen' => (float) $gadai->bunga_persen,
            'tipe_bunga' => $gadai->tipe_bunga,
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