<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusPendaftaranQurban;
use App\Enums\StatusPeriodeQurban;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\HewanQurbanResource;
use App\Http\Resources\PendaftaranQurbanResource;
use App\Http\Resources\PeriodeQurbanResource;
use App\Models\AuditLog;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\QurbanTargetService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QurbanController extends Controller
{
    use ApiResponse;

    public function __construct(
        private NotifikasiService $notif,
        private QurbanTargetService $qurbanService,
        private TransaksiService $transaksiService,
    ) {}

    public function storePeriode(Request $request): JsonResponse
    {
        $request->validate([
            'tahun' => 'required|integer|min:2024',
            'tanggal_buka_pendaftaran' => 'required|date',
            'tanggal_tutup_pendaftaran' => 'nullable|date|after:tanggal_buka_pendaftaran',
            'tanggal_idul_adha' => 'required|date|after:tanggal_buka_pendaftaran',
            'tanggal_pencairan' => 'nullable|date|before:tanggal_idul_adha',
            'status' => 'sometimes|string|in:draft,aktif',
        ]);

        $data = $request->only([
            'tahun',
            'tanggal_buka_pendaftaran',
            'tanggal_tutup_pendaftaran',
            'tanggal_idul_adha',
            'tanggal_pencairan',
            'status',
        ]);

        // Default: tutup +1 bulan dari buka
        if (! isset($data['tanggal_tutup_pendaftaran'])) {
            $data['tanggal_tutup_pendaftaran'] = \Carbon\Carbon::parse($data['tanggal_buka_pendaftaran'])->addMonth()->toDateString();
        }

        // Default: pencairan = idul adha - 14 hari
        if (! isset($data['tanggal_pencairan'])) {
            $data['tanggal_pencairan'] = \Carbon\Carbon::parse($data['tanggal_idul_adha'])->subDays(14)->toDateString();
        }

        $data['created_by'] = auth()->id();
        $data['status'] = $data['status'] ?? 'draft';

        $periode = PeriodeQurban::create($data);
        AuditLog::record('create', $periode);

        return $this->createdResponse(new PeriodeQurbanResource($periode), 'Periode qurban berhasil dibuat.');
    }

    public function updatePeriode(Request $request, PeriodeQurban $periode): JsonResponse
    {
        $request->validate([
            'tahun' => 'sometimes|integer|min:2024',
            'tanggal_buka_pendaftaran' => 'sometimes|date',
            'tanggal_tutup_pendaftaran' => 'sometimes|date',
            'tanggal_idul_adha' => 'sometimes|date',
            'tanggal_pencairan' => 'sometimes|date',
            'status' => 'sometimes|string|in:draft,aktif,ditutup,selesai',
        ]);

        $oldValues = $periode->toArray();
        $periode->update($request->only([
            'tahun',
            'tanggal_buka_pendaftaran',
            'tanggal_tutup_pendaftaran',
            'tanggal_idul_adha',
            'tanggal_pencairan',
            'status',
        ]));
        AuditLog::record('update', $periode, $oldValues, $periode->fresh()->toArray());

        return $this->successResponse(new PeriodeQurbanResource($periode->fresh()), 'Periode qurban berhasil diperbarui.');
    }

    public function storeHewan(Request $request): JsonResponse
    {
        $request->validate([
            'jenis_hewan' => 'required|string|max:255',
            'harga_per_unit' => 'required|numeric|min:0',
            'periode_qurban_id' => 'required|exists:periode_qurban,id',
            'berat_rata_rata' => 'nullable|string|max:100',
            'deskripsi' => 'nullable|string|max:1000',
            'status_aktif' => 'sometimes|boolean',
        ]);

        $hewan = HewanQurban::create(array_merge(
            $request->only(['jenis_hewan', 'harga_per_unit', 'periode_qurban_id', 'berat_rata_rata', 'deskripsi', 'status_aktif']),
            ['created_by' => auth()->id()]
        ));

        AuditLog::record('create', $hewan);

        return $this->createdResponse(new HewanQurbanResource($hewan), 'Hewan qurban berhasil ditambahkan.');
    }

    public function updateHewan(Request $request, HewanQurban $hewan): JsonResponse
    {
        $request->validate([
            'jenis_hewan' => 'sometimes|string|max:255',
            'harga_per_unit' => 'sometimes|numeric|min:0',
            'berat_rata_rata' => 'nullable|string|max:100',
            'deskripsi' => 'nullable|string|max:1000',
            'status_aktif' => 'sometimes|boolean',
        ]);

        $oldValues = $hewan->toArray();
        $hewan->update($request->only(['jenis_hewan', 'harga_per_unit', 'berat_rata_rata', 'deskripsi', 'status_aktif']));
        AuditLog::record('update', $hewan, $oldValues, $hewan->fresh()->toArray());

        return $this->successResponse(new HewanQurbanResource($hewan->fresh()), 'Hewan qurban berhasil diperbarui.');
    }

    public function destroyHewan(HewanQurban $hewan): JsonResponse
    {
        AuditLog::record('delete', $hewan);
        $hewan->delete();

        return $this->deletedResponse('Hewan qurban berhasil dihapus.');
    }

    public function listPeriode(Request $request): JsonResponse
    {
        $perPage = min($request->input('per_page', 15), 1000);
        $items = PeriodeQurban::with('hewanQurban')->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data periode qurban.',
            'data' => PeriodeQurbanResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function listHewan(Request $request): JsonResponse
    {
        $perPage = min($request->input('per_page', 15), 1000);
        $items = HewanQurban::with('periodeQurban')->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data hewan qurban.',
            'data' => HewanQurbanResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function listPendaftaran(Request $request): JsonResponse
    {
        $query = PendaftaranQurban::with(['user', 'hewanQurban', 'periodeQurban']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('periode_id')) {
            $query->where('periode_qurban_id', $request->periode_id);
        }

        $perPage = min($request->input('per_page', 15), 1000);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data pendaftaran qurban.',
            'data' => PendaftaranQurbanResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function storePendaftaran(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'hewan_qurban_id' => 'required|exists:hewan_qurban,id',
            'jumlah_hewan' => 'required|integer|min:1',
            'frekuensi_setor' => 'nullable|string|in:harian,mingguan,bulanan',
            'nominal_per_periode' => 'nullable|numeric|min:1000',
            'catatan' => 'nullable|string|max:500',
        ]);

        $user = User::findOrFail($request->user_id);
        $hewan = HewanQurban::findOrFail($request->hewan_qurban_id);
        $periode = $hewan->periodeQurban;

        if (! $hewan->status_aktif) {
            return $this->errorResponse('Hewan qurban ini tidak tersedia untuk pendaftaran.', 422, 'HEWAN_TIDAK_AKTIF');
        }

        if (! $periode->isPendaftaranDibuka()) {
            return $this->errorResponse('Pendaftaran qurban sudah ditutup atau belum dibuka.', 403, 'REGISTRATION_CLOSED');
        }

        $targetDana = $this->qurbanService->hitungTargetDana($hewan, $request->jumlah_hewan);

        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $user->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => $request->jumlah_hewan,
            'target_dana' => $targetDana,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
            'catatan' => $request->catatan,
            'frekuensi_setor' => $request->frekuensi_setor ?? 'bulanan',
            'nominal_per_periode' => $this->qurbanService->nominalPerPeriode(
                $targetDana,
                $periode,
                $request->frekuensi_setor,
                $request->filled('nominal_per_periode') ? (float) $request->nominal_per_periode : null
            ),
        ]);

        $pendaftaran->load(['hewanQurban', 'periodeQurban']);

        $this->notif->kirimKeSemuaAdmin(
            'Pendaftaran Qurban Baru (Admin)',
            auth()->user()->name . ' mendaftarkan ' . $user->name . ' qurban ' . $hewan->jenis_hewan . ' '
                . $request->jumlah_hewan . ' ekor, target dana Rp ' . number_format($targetDana, 0, ',', '.') . '.',
            TipeNotifikasi::Info,
            ['pendaftaran_qurban_id' => $pendaftaran->id]
        );

        return $this->createdResponse(
            new PendaftaranQurbanResource($pendaftaran),
            'Pendaftaran qurban untuk ' . $user->name . ' berhasil. Target dana: Rp ' . number_format($targetDana, 0, ',', '.')
        );
    }

    public function cairkan(Request $request, PendaftaranQurban $pendaftaran): JsonResponse
    {
        if ($pendaftaran->status === StatusPendaftaranQurban::SudahDicairkan) {
            return $this->errorResponse('Pendaftaran ini sudah dicairkan.', 409, 'CONFLICT');
        }

        // Dana tidak boleh dicairkan sebelum target tercapai (atau sudah dinyatakan lunas).
        if (! in_array($pendaftaran->status, [StatusPendaftaranQurban::TargetTercapai, StatusPendaftaranQurban::SudahLunas], true)) {
            return $this->errorResponse('Dana qurban belum bisa dicairkan karena target belum tercapai.', 422, 'GOAL_NOT_REACHED');
        }

        $oldValues = ['status' => $pendaftaran->status->value, 'total_terkumpul' => $pendaftaran->total_terkumpul];
        $nominal = (float) $pendaftaran->total_terkumpul;

        DB::transaction(function () use ($pendaftaran, $nominal) {
            // Catat pengeluaran sebagai transaksi tarik terverifikasi (jejak ledger),
            // bukan sekadar mengosongkan total_terkumpul.
            $this->catatPencairanQurban($pendaftaran, $nominal, 'Pencairan dana qurban oleh admin.');

            $pendaftaran->update([
                'status' => StatusPendaftaranQurban::SudahDicairkan,
                'total_terkumpul' => 0,
                'tanggal_dicairkan' => now()->toDateString(),
                'dicairkan_oleh' => auth()->id(),
            ]);
        });

        AuditLog::record('cairkan', $pendaftaran, $oldValues, ['status' => 'sudah_dicairkan', 'total_terkumpul' => 0]);

        return $this->successResponse(new PendaftaranQurbanResource($pendaftaran->fresh()->load(['user', 'hewanQurban'])), 'Pendaftaran qurban berhasil dicairkan.');
    }

    public function lunas(Request $request, PendaftaranQurban $pendaftaran): JsonResponse
    {
        if (in_array($pendaftaran->status, [StatusPendaftaranQurban::SudahLunas, StatusPendaftaranQurban::SudahDicairkan])) {
            return $this->errorResponse('Pendaftaran ini sudah dinyatakan lunas.', 409, 'CONFLICT');
        }

        if (! in_array($pendaftaran->status, [StatusPendaftaranQurban::TargetTercapai, StatusPendaftaranQurban::MenungguVerifikasi])) {
            return $this->errorResponse('Nasabah belum mencapai target dana qurban, belum dapat dinyatakan lunas.', 422, 'GOAL_NOT_REACHED');
        }

        $oldValues = ['status' => $pendaftaran->status->value];

        // Lunas dianggap verifikasi pelunasan: progress (total_terkumpul) tetap utuh sebagai bukti.
        $pendaftaran->update(['status' => StatusPendaftaranQurban::SudahLunas]);

        AuditLog::record('lunas', $pendaftaran, $oldValues, ['status' => 'sudah_lunas']);

        $this->notif->kirim(
            $pendaftaran->user,
            'Qurban Anda Lunas',
            'Selamat! Qurban Anda telah dinyatakan lunas. Panitia sedang menyiapkan qurban Anda.',
            TipeNotifikasi::Info,
            ['pendaftaran_qurban_id' => $pendaftaran->id]
        );

        return $this->successResponse(new PendaftaranQurbanResource($pendaftaran->fresh()->load(['user', 'hewanQurban'])), 'Pendaftaran qurban berhasil dinyatakan lunas.');
    }

    public function destroyPendaftaran(PendaftaranQurban $pendaftaran): JsonResponse
    {
        if ($pendaftaran->status === StatusPendaftaranQurban::SudahDicairkan) {
            return $this->errorResponse('Pendaftaran yang sudah dicairkan tidak dapat dihapus.', 409, 'CONFLICT');
        }

        $oldValues = ['status' => $pendaftaran->status->value, 'total_terkumpul' => $pendaftaran->total_terkumpul];

        $nominal = $pendaftaran->terkumpulNetto();

        DB::transaction(function () use ($pendaftaran, $nominal) {
            // Setoran tidak dihapus (jejak audit dipertahankan). Saldo dikembalikan
            // lewat transaksi tarik terverifikasi sehingga netto ledger = 0.
            $this->catatPencairanQurban($pendaftaran, $nominal, 'Pengembalian dana qurban karena pendaftaran dihapus admin.');

            $pendaftaran->delete();
        });

        AuditLog::record('delete', $pendaftaran, $oldValues);

        return $this->deletedResponse('Pendaftaran qurban berhasil dihapus.');
    }

    /**
     * Catat transaksi tarik terverifikasi untuk dana qurban (pencairan/pengembalian).
     * Nominal 0 dilewati (tidak ada dana untuk dikembalikan).
     */
    private function catatPencairanQurban(PendaftaranQurban $pendaftaran, float $nominal, string $catatan): void
    {
        if ($nominal <= 0) {
            return;
        }

        $jenis = JenisTabungan::where('tipe', TipeTabungan::Qurban)->first();

        if (! $jenis) {
            return;
        }

        $this->transaksiService->buatTransaksi([
            'user_id' => $pendaftaran->user_id,
            'jenis_tabungan_id' => $jenis->id,
            'pendaftaran_qurban_id' => $pendaftaran->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $nominal,
            'metode_pembayaran' => MetodePembayaran::Transfer,
            'catatan_admin' => $catatan,
            'auto_verify' => true,
        ]);
    }
}
