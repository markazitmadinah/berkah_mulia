<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\StatusPendaftaranQurban;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\HewanQurbanResource;
use App\Http\Resources\PendaftaranQurbanResource;
use App\Http\Resources\PeriodeQurbanResource;
use App\Http\Resources\TransaksiResource;
use App\Models\HewanQurban;
use App\Models\JenisTabungan;
use App\Models\Notifikasi;
use App\Models\PendaftaranQurban;
use App\Models\PeriodeQurban;
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
        private QurbanTargetService $qurbanService,
        private TransaksiService $transaksiService,
    ) {}

    public function periodeAktif(): JsonResponse
    {
        $periode = PeriodeQurban::aktif()->with('hewanQurban')->first();

        if (! $periode) {
            return $this->errorResponse('Tidak ada periode qurban yang sedang aktif.', 404, 'NOT_FOUND');
        }

        return $this->successResponse(new PeriodeQurbanResource($periode));
    }

    public function listHewan(Request $request): JsonResponse
    {
        $periode = PeriodeQurban::aktif()->first();

        if (! $periode) {
            return $this->errorResponse('Tidak ada periode qurban aktif.', 404, 'NOT_FOUND');
        }

        $hewan = HewanQurban::where('periode_qurban_id', $periode->id)->aktif()->get();

        return $this->successResponse(HewanQurbanResource::collection($hewan));
    }

    public function daftar(Request $request): JsonResponse
    {
        $request->validate([
            'hewan_qurban_id' => 'required|exists:hewan_qurban,id',
            'jumlah_hewan' => 'required|integer|min:1',
        ]);

        $hewan = HewanQurban::findOrFail($request->hewan_qurban_id);
        $periode = $hewan->periodeQurban;

        if (! $periode->isPendaftaranDibuka()) {
            return $this->errorResponse('Pendaftaran qurban sudah ditutup atau belum dibuka.', 403, 'REGISTRATION_CLOSED');
        }

        $targetDana = $this->qurbanService->hitungTargetDana($hewan, $request->jumlah_hewan);

        $pendaftaran = PendaftaranQurban::create([
            'user_id' => $request->user()->id,
            'periode_qurban_id' => $periode->id,
            'hewan_qurban_id' => $hewan->id,
            'jumlah_hewan' => $request->jumlah_hewan,
            'target_dana' => $targetDana,
            'status' => StatusPendaftaranQurban::Menabung,
            'tanggal_daftar' => now()->toDateString(),
        ]);

        $pendaftaran->load(['hewanQurban', 'periodeQurban']);

        return $this->createdResponse(
            new PendaftaranQurbanResource($pendaftaran),
            'Pendaftaran qurban berhasil. Target dana: Rp ' . number_format($targetDana, 0, ',', '.')
        );
    }

    public function pendaftaranSaya(Request $request): JsonResponse
    {
        $perPage = min($request->input('per_page', 15), 100);
        $pendaftaran = PendaftaranQurban::where('user_id', $request->user()->id)
            ->with(['user', 'hewanQurban', 'periodeQurban'])
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data pendaftaran qurban.',
            'data' => PendaftaranQurbanResource::collection($pendaftaran),
            'meta' => [
                'current_page' => $pendaftaran->currentPage(),
                'per_page' => $pendaftaran->perPage(),
                'total' => $pendaftaran->total(),
                'last_page' => $pendaftaran->lastPage(),
            ],
        ]);
    }

    public function setor(Request $request, PendaftaranQurban $pendaftaran): JsonResponse
    {
        // Check ownership
        if ($pendaftaran->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke pendaftaran ini.', 403, 'FORBIDDEN');
        }

        if ($pendaftaran->status !== StatusPendaftaranQurban::Menabung) {
            return $this->errorResponse('Pendaftaran ini sudah lunas / tidak lagi aktif untuk setoran tambahan.', 409, 'CONFLICT');
        }

        $request->validate([
            'nominal' => 'required|numeric|min:10000',
            'metode_pembayaran' => 'required|string|in:transfer',
            'rekening_bank_id' => 'required|exists:rekening_bank,id',
            'bukti_transfer' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'catatan_user' => 'nullable|string|max:500',
        ]);

        $jenisTabungan = JenisTabungan::where('tipe', TipeTabungan::Qurban)->aktif()->first();

        if (! $jenisTabungan) {
            return $this->errorResponse('Tabungan qurban belum tersedia.', 404, 'NOT_FOUND');
        }

        $transaksi = DB::transaction(function () use ($request, $jenisTabungan, $pendaftaran) {
            $transaksi = $this->transaksiService->buatTransaksi([
                'user_id' => $request->user()->id,
                'jenis_tabungan_id' => $jenisTabungan->id,
                'pendaftaran_qurban_id' => $pendaftaran->id,
                'jenis_transaksi' => JenisTransaksi::Setor,
                'nominal' => $request->nominal,
                'metode_pembayaran' => $request->metode_pembayaran,
                'rekening_bank_id' => $request->rekening_bank_id,
                'catatan_user' => $request->catatan_user,
            ]);

            if ($request->hasFile('bukti_transfer')) {
                $this->transaksiService->uploadBuktiTransfer($transaksi, $request->file('bukti_transfer'));
            }

            return $transaksi;
        });

        return $this->createdResponse(new TransaksiResource($transaksi->load('jenisTabungan')), 'Setoran qurban berhasil dicatat.');
    }

    public function progress(Request $request, PendaftaranQurban $pendaftaran): JsonResponse
    {
        if ($pendaftaran->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke pendaftaran ini.', 403, 'FORBIDDEN');
        }

        $pendaftaran->load(['hewanQurban', 'periodeQurban']);

        return $this->successResponse(new PendaftaranQurbanResource($pendaftaran));
    }

    public function lunas(Request $request, PendaftaranQurban $pendaftaran): JsonResponse
    {
        if ($pendaftaran->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke pendaftaran ini.', 403, 'FORBIDDEN');
        }

        if ($pendaftaran->status !== StatusPendaftaranQurban::TargetTercapai) {
            return $this->errorResponse('Pelunasan hanya dapat diajukan setelah target dana tercapai.', 409, 'GOAL_NOT_REACHED');
        }

        $oldValues = ['status' => $pendaftaran->status->value];
        $pendaftaran->update(['status' => StatusPendaftaranQurban::MenungguVerifikasi]);

        // Kirim notifikasi ke semua admin untuk memverifikasi pelunasan qurban.
        $admins = \App\Models\User::where('role', \App\Enums\UserRole::Admin)->get();
        foreach ($admins as $admin) {
            Notifikasi::create([
                'user_id' => $admin->id,
                'judul' => 'Verifikasi Pelunasan Qurban',
                'pesan' => $request->user()->name . ' mengajukan pelunasan qurban (' . ($pendaftaran->hewanQurban->jenis_hewan ?? 'hewan') . '). Silakan verifikasi.',
                'tipe' => TipeNotifikasi::Verifikasi,
                'channel' => \App\Enums\ChannelNotifikasi::InApp,
                'data' => ['pendaftaran_qurban_id' => $pendaftaran->id],
            ]);
        }

        return $this->successResponse(
            new PendaftaranQurbanResource($pendaftaran->fresh()->load(['user', 'hewanQurban'])),
            'Pengajuan pelunasan berhasil dikirim. Menunggu verifikasi admin.'
        );
    }
}
