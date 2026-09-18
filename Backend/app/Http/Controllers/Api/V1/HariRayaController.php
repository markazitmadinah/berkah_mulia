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
use Illuminate\Validation\Rule;
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

    /**
     * Hash target + frekuensi (opsional) ke record user_tabungan_target.
     * nominal_per_periode otomatis dari target jika tidak diserahkan.
     */
    private function simpanTarget(User $user, JenisTabungan $jenis, Request $request, float $target): UserTabunganTarget
    {
        $frekuensi = $request->input('frekuensi_setor') ?: 'bulanan';
        $nominal = $request->filled('nominal_per_periode') ? (float) $request->nominal_per_periode : null;

        if ($nominal === null || $nominal <= 0) {
            $deadline = $jenis->deadline ?? now()->addMonths(12);
            $mulai = now()->startOfDay();
            $akhir = $deadline->copy()->startOfDay();
            $hari = (int) max(1, $mulai->diffInDays($akhir));

            $totalPeriode = match ($frekuensi) {
                'harian' => $hari,
                'mingguan' => max(1, intdiv($hari, 7)),
                default => max(1, $mulai->diffInMonths($akhir)),
            };

            $nominal = round(ceil($target / $totalPeriode * 100) / 100, 2);
        }

        return UserTabunganTarget::updateOrCreate(
            ['user_id' => $user->id, 'jenis_tabungan_id' => $jenis->id],
            [
                'target_nominal' => $target,
                'frekuensi_setor' => $frekuensi,
                'nominal_per_periode' => $nominal,
            ]
        );
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
        $targetRow = UserTabunganTarget::where('user_id', $user->id)
            ->where('jenis_tabungan_id', $jenis->id)
            ->first();

        $target = $targetRow ? (int) $targetRow->target_nominal : 0;

        return [
            'jenis_tabungan_id' => $jenis->id,
            'nama' => $jenis->nama,
            'deadline' => $jenis->deadline?->toDateString(),
            'hari_raya' => $jenis->deadline?->toDateString(),
            'target' => $target,
            'terkumpul' => round($saldo, 2),
            'frekuensi' => $targetRow ? [
                'frekuensi_setor' => $targetRow->frekuensi_setor ?: 'bulanan',
                'frekuensi_label' => $targetRow->frekuensiLabel() ?: 'Bulanan',
                'nominal_per_periode' => $targetRow->nominal_per_periode,
                'sisa_pembayaran' => $targetRow->sisaPembayaran($saldo),
            ] : null,
            'sisa_nominal' => max(0, $target - $saldo),
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

    public function updateTargetAdmin(Request $request): JsonResponse
    {
        $jenis = $this->resolveJenis();

        if (! $jenis) {
            return $this->errorResponse('Tabungan hari raya belum tersedia.', 404, 'NOT_FOUND');
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'target_nominal' => 'required|numeric|min:10000|max:100000000000',
            'frekuensi_setor' => 'nullable|string|in:harian,mingguan,bulanan',
            'nominal_per_periode' => 'nullable|numeric|min:1000',
        ]);

        $user = User::findOrFail($request->user_id);

        $this->simpanTarget($user, $jenis, $request, (float) $request->target_nominal);

        return $this->successResponse($this->statusPayload($jenis, $user, $this->saldo($user, $jenis)), 'Target tabungan hari raya untuk ' . $user->name . ' berhasil disimpan.');
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