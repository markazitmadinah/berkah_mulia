<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\JenisTransaksi;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use App\Models\User;
use App\Models\UserTabunganTarget;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HariRayaController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransaksiService $transaksiService,
    ) {}

    private function resolveJenis(): ?JenisTabungan
    {
        return JenisTabungan::where('tipe', TipeTabungan::Pribadi)
            ->where('sub_jenis', SubJenisTabungan::HariRaya)
            ->aktif()
            ->first();
    }

    private function saldo(User $user, JenisTabungan $jenis): float
    {
        $setor = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->terverifikasi()
            ->where('jenis_transaksi', JenisTransaksi::Setor->value)
            ->sum('nominal');

        $tarik = Transaksi::milikUser($user->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->terverifikasi()
            ->where('jenis_transaksi', JenisTransaksi::Tarik->value)
            ->sum('nominal');

        return (float) ($setor - $tarik);
    }

    /**
     * 1 minggu sebelum tanggal hari raya (deadline) masa pencairan dibuka.
     */
    private function masaPencairanDibuka(JenisTabungan $jenis): bool
    {
        return $jenis->deadline !== null
            && now()->startOfDay()->gte($jenis->deadline->copy()->subDays(7));
    }

    private function statusPayload(JenisTabungan $jenis, User $user, float $saldo): array
    {
        $target = UserTabunganTarget::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->value('target_nominal');

        $target = $target !== null ? (int) $target : 0;

        return [
            'jenis_tabungan_id' => $jenis->id,
            'nama' => $jenis->nama,
            'deadline' => $jenis->deadline?->toDateString(),
            'hari_raya' => $jenis->deadline?->toDateString(),
            'target' => $target,
            'terkumpul' => round($saldo, 2),
            'persentase' => $target > 0 ? round(($saldo / $target) * 100, 2) : null,
            'masa_pencairan' => $this->masaPencairanDibuka($jenis),
        ];
    }

    public function status(Request $request): JsonResponse
    {
        $jenis = $this->resolveJenis();

        if (! $jenis) {
            return $this->errorResponse('Tabungan hari raya belum tersedia.', 404, 'NOT_FOUND');
        }

        return $this->successResponse($this->statusPayload($jenis, $request->user(), $this->saldo($request->user(), $jenis)));
    }

    public function updateTarget(Request $request): JsonResponse
    {
        $jenis = $this->resolveJenis();

        if (! $jenis) {
            return $this->errorResponse('Tabungan hari raya belum tersedia.', 404, 'NOT_FOUND');
        }

        $request->validate([
            'target_nominal' => 'required|numeric|min:10000|max:100000000000',
        ]);

        UserTabunganTarget::updateOrCreate(
            ['user_id' => $request->user()->id, 'jenis_tabungan_id' => $jenis->id],
            ['target_nominal' => (float) $request->target_nominal]
        );

        return $this->successResponse($this->statusPayload($jenis, $request->user(), $this->saldo($request->user(), $jenis)), 'Target tabungan hari raya berhasil disimpan.');
    }

    public function cairkan(Request $request): JsonResponse
    {
        $jenis = $this->resolveJenis();

        if (! $jenis) {
            return $this->errorResponse('Tabungan hari raya belum tersedia.', 404, 'NOT_FOUND');
        }

        if (! $this->masaPencairanDibuka($jenis)) {
            return $this->errorResponse(
                'Dana tabungan hari raya baru dapat dicairkan mulai 1 minggu sebelum tanggal hari raya.',
                423,
                'LUNA_TUTUP'
            );
        }

        // Guard: prevent concurrent withdrawal requests
        $hasPending = Transaksi::milikUser($request->user()->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->where('jenis_transaksi', JenisTransaksi::Tarik->value)
            ->menungguVerifikasi()
            ->exists();

        if ($hasPending) {
            return $this->errorResponse('Anda sudah memiliki pencairan yang sedang menunggu verifikasi.', 409, 'PENDING_WITHDRAWAL_EXISTS');
        }

        $saldo = $this->saldo($request->user(), $jenis);

        if ($saldo < 10000) {
            return $this->errorResponse('Tidak ada saldo tabungan hari raya yang bisa dicairkan.', 422, 'NO_BALANCE');
        }

        $transaksi = $this->transaksiService->buatTransaksi([
            'user_id' => $request->user()->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $saldo,
            'metode_pembayaran' => 'transfer',
            'catatan_user' => 'Pencairan otomatis tabungan hari raya (1 minggu sebelum hari raya).',
        ]);

        return $this->createdResponse(new TransaksiResource($transaksi->load('jenisTabungan')), 'Pencairan tabungan hari raya diajukan. Menunggu verifikasi admin.');
    }
}