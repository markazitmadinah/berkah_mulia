<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\FrekuensiSetoran;
use App\Http\Controllers\Controller;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Services\SaldoEmasService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PembayaranHarianController extends Controller
{
    use ApiResponse;

    public function __construct(
        private SaldoEmasService $saldoEmasService,
    ) {}

    /**
     * GET /admin/pembayaran-harian/tunggakan
     * Semua user yang rencana setoran berkala aktifnya memiliki TAGIHAN terlewat
     * (periode jatuh tempo belum dibayar) untuk frekuensi harian/mingguan/bulanan.
     * Tagihan per user direkap: jumlah periode tertunggak + nominal total yang harus dibayar.
     */
    public function tunggakan(): JsonResponse
    {
        $konfigurasi = KonfigurasiSetoranEmas::query()
            ->aktif()
            ->with(['user', 'jenisTabungan'])
            ->get();

        $rows = $konfigurasi->map(function (KonfigurasiSetoranEmas $k) {
            if (! $k->user) {
                return null;
            }

            $progress = $this->saldoEmasService->getProgress($k->user, $k);
            $tertunggak = $progress['tertunggak'];

            if ($tertunggak['jumlah_periode'] <= 0) {
                return null;
            }

            return [
                'sumber' => 'emas',
                'id' => $k->id,
                'konfigurasi_id' => $k->id,
                'user_id' => $k->user->id,
                'nama' => $k->user->name,
                'nomor_anggota' => $k->user->nomor_anggota,
                'jenis_tabungan_id' => $k->jenis_tabungan_id,
                'jenis_tabungan_nama' => $k->jenisTabungan?->nama,
                'frekuensi' => $k->frekuensi_setor->value,
                'frekuensi_label' => $k->frekuensi_setor->label(),
                'jadwal_label' => $k->jadwalLabel(),
                'nominal_per_periode' => (float) $k->nominal_per_periode,
                'tanggal_mulai' => $k->tanggal_mulai?->toDateString(),
                'jumlah_periode_tertunggak' => $tertunggak['jumlah_periode'],
                'nominal_tagihan' => $tertunggak['nominal'],
            ];
        })->filter()->values();

        // Tabungan berjangka juga setor berkala — hitung tunggakan dengan logika yang sama.
        $berjangkaRows = TabunganBerjangka::query()
            ->where('status', 'aktif')
            ->with('user')
            ->get()
            ->map(function (TabunganBerjangka $tb) {
                if (! $tb->user) {
                    return null;
                }

                $tertunggak = $tb->tertunggak();

                if ($tertunggak['jumlah_periode'] <= 0) {
                    return null;
                }

                return [
                    'sumber' => 'berjangka',
                    'id' => $tb->id,
                    'user_id' => $tb->user->id,
                    'nama' => $tb->user->name,
                    'nomor_anggota' => $tb->user->nomor_anggota,
                    'jenis_tabungan_id' => $tb->jenis_tabungan_id,
                    'jenis_tabungan_nama' => $tb->jenisTabungan()?->first()?->nama ?? 'Tabungan Berjangka',
                    'frekuensi' => $tb->frekuensi_setor,
                    'frekuensi_label' => $tb->frekuensiLabel(),
                    'jadwal_label' => 'Setiap ' . $tb->frekuensiLabel(),
                    'nominal_per_periode' => (float) $tb->nominal_per_periode,
                    'tanggal_mulai' => $tb->tanggal_mulai?->toDateString(),
                    'jumlah_periode_tertunggak' => $tertunggak['jumlah_periode'],
                    'nominal_tagihan' => $tertunggak['nominal'],
                ];
            })->filter()->values();

        $rows = collect($rows)->concat($berjangkaRows)->values();

        $totalNominal = collect($rows)->sum('nominal_tagihan');
        $totalUser = collect($rows)->pluck('user_id')->unique()->count();

        return $this->successResponse([
            'total_user' => $totalUser,
            'total_nominal' => round((float) $totalNominal, 2),
            'items' => $rows,
        ], 'Berhasil mengambil daftar tunggakan setoran.');
    }

    /**
     * GET /admin/pembayaran-harian?tanggal=YYYY-MM-DD
     *
     * Daftar nasabah yang jadwal setoran berkala aktifnya jatuh pada tanggal ini,
     * beserta status pembayarannya (terverifikasi / ditolak / menunggu / belum)
     * dari transaksi setor di tanggal tsb.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['tanggal' => 'nullable|date']);
        $tanggal = $request->filled('tanggal')
            ? Carbon::parse($request->tanggal)
            : now();

        $jadwal = KonfigurasiSetoranEmas::query()
            ->aktif()
            ->with(['user', 'jenisTabungan'])
            ->get()
            ->filter(fn (KonfigurasiSetoranEmas $k) => $this->jadwalJatuh($k, $tanggal));

        $transaksiHariIni = Transaksi::query()
            ->whereIn('user_id', $jadwal->pluck('user_id')->unique())
            ->whereIn('jenis_tabungan_id', $jadwal->pluck('jenis_tabungan_id')->unique())
            ->where('jenis_transaksi', 'setor')
            ->whereDate('tanggal_transaksi', $tanggal->toDateString())
            ->get()
            ->keyBy(fn (Transaksi $t) => $t->user_id . '-' . $t->jenis_tabungan_id);

        $rows = $jadwal->map(function (KonfigurasiSetoranEmas $k) use ($transaksiHariIni) {
            $user = $k->user;
            $trx = $transaksiHariIni->get($k->user_id . '-' . $k->jenis_tabungan_id);

            return [
                'konfigurasi_id' => $k->id,
                'user_id' => $user?->id,
                'nama' => $user?->name,
                'nomor_anggota' => $user?->nomor_anggota,
                'jenis_tabungan_id' => $k->jenis_tabungan_id,
                'jenis_tabungan_nama' => $k->jenisTabungan?->nama,
                'frekuensi' => $k->frekuensi_setor->value,
                'frekuensi_label' => $k->frekuensi_setor->label(),
                'jadwal_label' => $k->jadwalLabel(),
                'nominal_per_periode' => (float) $k->nominal_per_periode,
                'target_gram_per_periode' => (float) $k->target_gram_per_periode,
                'target_gram_total' => $k->target_gram_total !== null
                    ? (float) $k->target_gram_total
                    : ($k->durasi_periode ? round((float) $k->target_gram_per_periode * (int) $k->durasi_periode, 6) : null),
                'tanggal_mulai' => $k->tanggal_mulai?->toDateString(),
                'status_verifikasi' => $trx?->status_verifikasi?->value ?? 'belum',
                'transaksi_id' => $trx?->id,
                'nomor_referensi' => $trx?->nomor_referensi,
                'nominal' => $trx?->nominal !== null ? (float) $trx->nominal : null,
                'metode_pembayaran' => $trx?->metode_pembayaran?->value,
            ];
        })->values();

        return $this->successResponse([
            'tanggal' => $tanggal->toDateString(),
            'jadwal' => $rows,
        ], 'Berhasil mengambil daftar pembayaran harian.');
    }

    /**
     * Apakah tanggal tersebut merupakan salah satu periode setoran dari konfigurasi.
     * Periode mengikuti sifat lazy dari SaldoEmasService::jumlahPeriodeTerlewati.
     */
    private function jadwalJatuh(KonfigurasiSetoranEmas $k, Carbon $tanggal): bool
    {
        $mulai = Carbon::parse($k->tanggal_mulai ?: $k->created_at)->startOfDay();
        if ($tanggal->startOfDay()->lt($mulai)) {
            return false;
        }

        // Sudah lewat deadline → bukan jadwal aktif lagi.
        if ($k->tanggal_deadline && $tanggal->startOfDay()->gt(Carbon::parse($k->tanggal_deadline)->endOfDay())) {
            return false;
        }

        $hariSelisih = (int) max(0, $mulai->diffInDays($tanggal->startOfDay()));

        return match ($k->frekuensi_setor) {
            FrekuensiSetoran::Harian => true,
            FrekuensiSetoran::Mingguan => $hariSelisih % 7 === 0,
            FrekuensiSetoran::Bulanan => $mulai->day === $tanggal->day,
        };
    }
}