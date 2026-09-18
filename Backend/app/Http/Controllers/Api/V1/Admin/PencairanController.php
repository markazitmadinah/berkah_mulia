<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusKonfigurasiSetoran;
use App\Enums\SubJenisTabungan;
use App\Enums\TipeNotifikasi;
use App\Enums\TipeTabungan;
use App\Http\Controllers\Controller;
use App\Http\Resources\TransaksiResource;
use App\Models\HargaEmasHarian;
use App\Models\JenisTabungan;
use App\Models\KonfigurasiSetoranEmas;
use App\Models\TabunganBerjangka;
use App\Models\Transaksi;
use App\Models\User;
use App\Services\NotifikasiService;
use App\Services\SaldoEmasService;
use App\Services\TransaksiService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PencairanController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransaksiService $transaksiService,
        private SaldoEmasService $saldoEmasService,
        private NotifikasiService $notif,
    ) {}

    /**
     * POST /admin/tabungan/{user}/cairkan
     * Admin mencairkan langsung (auto-verify) saldo tabungan nasabah: emas,
     * pribadi (mandiri/hari raya), atau berjangka (via tabungan_berjangka_id).
     */
    public function cairkan(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'jenis_tabungan_id' => 'required|exists:jenis_tabungan,id',
            'tabungan_berjangka_id' => 'nullable|integer|exists:tabungan_berjangka,id',
            'konfigurasi_id' => 'nullable|integer|exists:konfigurasi_setoran_emas,id',
            'nominal' => 'nullable|numeric|min:1',
            'catatan_admin' => 'nullable|string|max:500',
        ]);

        $jenis = JenisTabungan::findOrFail($request->jenis_tabungan_id);

        return match (true) {
            $jenis->tipe === TipeTabungan::Emas => $this->cairkanEmas($request, $user, $jenis),
            $jenis->sub_jenis === SubJenisTabungan::Berjangka => $this->cairkanBerjangka($request, $user, $jenis),
            // Qurban punya alur sendiri per pendaftaran (status + target) — jangan
            // diperlakukan sebagai tabungan pribadi bebas.
            $jenis->tipe === TipeTabungan::Qurban => $this->errorResponse(
                'Dana qurban dicairkan melalui menu qurban (per pendaftaran).',
                422,
                'QURBAN_GUNAKAN_MENU_QURBAN'
            ),
            default => $this->cairkanPribadi($request, $user, $jenis),
        };
    }

    private function cairkanEmas(Request $request, User $user, JenisTabungan $jenis): JsonResponse
    {
        $konfigurasi = null;
        if ($request->filled('konfigurasi_id')) {
            $konfigurasi = KonfigurasiSetoranEmas::where('id', $request->konfigurasi_id)
                ->where('user_id', $user->id)
                ->where('jenis_tabungan_id', $jenis->id)
                ->first();

            if (! $konfigurasi) {
                return $this->errorResponse('Rencana setoran tidak ditemukan untuk nasabah ini.', 404, 'NOT_FOUND');
            }
        }

        // Bila nasabah punya rencana aktif, refund wajib per rencana (hindari ambiguitas
        // saat rencana lebih dari satu). Tanpa rencana aktif → cairkan seluruh saldo (data lama).
        if (! $konfigurasi) {
            if ($this->saldoEmasService->getAktifList($user, $jenis)->isNotEmpty()) {
                return $this->errorResponse('Pilih rencana yang akan dibatalkan & refund.', 422, 'KONFIGURASI_WAJIB_DIPILIH');
            }

            return $this->cairkanEmasPenuh($request, $user, $jenis);
        }

        if ($konfigurasi->status !== StatusKonfigurasiSetoran::Aktif) {
            return $this->errorResponse('Rencana setoran berkala ini sudah tidak aktif.', 422, 'TIDAK_AKTIF');
        }

        if ($this->saldoEmasService->refundTerkunci($user, $konfigurasi)) {
            return $this->errorResponse('Rencana ini masih punya pengajuan batal & refund yang menunggu verifikasi admin.', 422, 'REFUND_PENDING');
        }

        $rekap = $this->saldoEmasService->getSaldoRencana($user, $konfigurasi);
        $gram = (float) $rekap['gram'];
        $dana = (float) $rekap['dana'];

        if ($gram <= 0 && $dana <= 0) {
            return $this->errorResponse('Tidak ada saldo emas yang bisa dicairkan.', 422, 'NO_BALANCE');
        }

        $harga = HargaEmasHarian::hargaTerkini();
        if ($gram > 0 && ! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin.', 400, 'HARGA_BELUM_ADA');
        }

        $nilaiGram = $gram > 0 ? round($gram * $harga->hargaJualPerGram($gram), 2) : 0.0;
        ['penalti' => $penalti, 'refund' => $refund] = $this->saldoEmasService->hitungRefund($nilaiGram, $dana);

        $transaksi = DB::transaction(function () use ($user, $jenis, $konfigurasi, $gram, $dana, $nilaiGram, $penalti, $refund, $request, $harga) {
            KonfigurasiSetoranEmas::whereKey($konfigurasi->id)->lockForUpdate()->firstOrFail();
            $konfigurasi->refresh();

            if ($konfigurasi->status !== StatusKonfigurasiSetoran::Aktif) {
                abort(422, 'Rencana setoran berkala ini sudah tidak aktif.');
            }

            $t = $this->transaksiService->buatTransaksi([
                'user_id' => $user->id,
                'jenis_tabungan_id' => $jenis->id,
                'konfigurasi_id' => $konfigurasi->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $refund,
                'nominal_emas' => $nilaiGram,
                'nominal_selisih' => -1 * $dana,
                'unit_didapat' => -1 * $gram,
                'biaya_penalti' => $penalti,
                'harga_acuan_id' => $harga?->id,
                'harga_acuan_snapshot' => $harga ? $harga->hargaJualPerGram($gram) : null,
                'metode_pembayaran' => MetodePembayaran::Transfer,
                'catatan_admin' => $request->catatan_admin ?: 'Batal & refund rencana setoran emas oleh admin (potongan 10%).',
                'auto_verify' => true,
            ]);

            $konfigurasi->update(['status' => StatusKonfigurasiSetoran::Batal]);

            return $t;
        });

        $this->beriTahuUser($user, 'Rencana Setoran Dibatalkan', 'Rencana setoran berkala Anda resmi dibatalkan. Refund sebesar Rp ' . number_format($refund, 0, ',', '.') . ' telah diproses admin.');

        return $this->createdResponse(new TransaksiResource($transaksi->load('user:id,name', 'jenisTabungan')), 'Batal & refund rencana emas berhasil diproses.');
    }

    /**
     * Batal & refund seluruh saldo emas jenis (tanpa rencana aktif / data lama).
     * Potongan 10% dihitung dari TOTAL tabungan (nilai emas + saldo dana).
     */
    private function cairkanEmasPenuh(Request $request, User $user, JenisTabungan $jenis): JsonResponse
    {
        $saldoGram = $this->saldoEmasService->getSaldoGram($user, $jenis);
        $dana = $this->saldoEmasService->getSaldoDana($user, $jenis);

        if ($saldoGram <= 0 && $dana <= 0) {
            return $this->errorResponse('Tidak ada saldo emas yang bisa dicairkan.', 422, 'NO_BALANCE');
        }

        $harga = HargaEmasHarian::hargaTerkini();
        if ($saldoGram > 0 && ! $harga) {
            return $this->errorResponse('Harga emas belum diinput oleh admin.', 400, 'HARGA_BELUM_ADA');
        }

        $nilaiGram = $saldoGram > 0 ? round($saldoGram * $harga->hargaJualPerGram($saldoGram), 2) : 0.0;
        ['penalti' => $penalti, 'refund' => $refund] = $this->saldoEmasService->hitungRefund($nilaiGram, $dana);

        $transaksi = $this->ciptakanTarik($user, $jenis, $refund, $request, [
            'nominal_emas' => $nilaiGram,
            'nominal_selisih' => -1 * $dana,
            'unit_didapat' => -1 * $saldoGram,
            'biaya_penalti' => $penalti,
            'harga_acuan_id' => $harga?->id,
            'harga_acuan_snapshot' => $harga ? $harga->hargaJualPerGram($saldoGram) : null,
        ]);

        $user->update(['target_emas_gram' => null]);

        $this->beriTahuUser($user, 'Pembatalan Tabungan Emas', 'Tabungan emas Anda dibatalkan. Refund sebesar Rp ' . number_format($refund, 0, ',', '.') . ' (setelah potongan 10%) telah diproses admin.');

        return $this->createdResponse(new TransaksiResource($transaksi->load('user:id,name', 'jenisTabungan')), 'Batal & refund emas berhasil diproses.');
    }

    private function cairkanPribadi(Request $request, User $user, JenisTabungan $jenis): JsonResponse
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

        $saldo = (float) ($setor - $tarik);
        if ($saldo < 10000) {
            return $this->errorResponse('Tidak ada saldo tabungan yang bisa dicairkan.', 422, 'NO_BALANCE');
        }

        // Admin boleh menarik sebagian: nominal dari form; tanpa nominal = tarik penuh.
        $nominal = $request->filled('nominal') ? (float) $request->nominal : $saldo;

        if ($nominal < 10000) {
            return $this->errorResponse('Nominal penarikan minimal Rp 10.000.', 422, 'NOMINAL_MINIMAL');
        }
        if ($nominal > $saldo) {
            return $this->errorResponse('Nominal penarikan melebihi saldo tersedia (Rp ' . number_format($saldo, 0, ',', '.') . ').', 422, 'NOMINAL_MELEBIHI_SALDO');
        }

        $transaksi = $this->ciptakanTarik($user, $jenis, $nominal, $request);

        if ($jenis->sub_jenis === SubJenisTabungan::HariRaya) {
            $this->beriTahuUser($user, 'Pencairan Tabungan Hari Raya', 'Pencairan tabungan hari raya sebesar Rp ' . number_format($nominal, 0, ',', '.') . ' telah diproses admin.');
        } else {
            $this->beriTahuUser($user, 'Pencairan Tabungan Mandiri', 'Pencairan tabungan mandiri sebesar Rp ' . number_format($nominal, 0, ',', '.') . ' telah diproses admin.');
        }

        return $this->createdResponse(new TransaksiResource($transaksi->load('user:id,name', 'jenisTabungan')), 'Pencairan tabungan berhasil diproses.');
    }

    private function cairkanBerjangka(Request $request, User $user, JenisTabungan $jenis): JsonResponse
    {
        $tb = TabunganBerjangka::where('id', $request->tabungan_berjangka_id)
            ->where('user_id', $user->id)
            ->first();

        if (! $tb) {
            return $this->errorResponse('Tabungan berjangka tidak ditemukan untuk nasabah ini.', 404, 'NOT_FOUND');
        }

        if ($tb->status !== 'aktif') {
            return $this->errorResponse('Hanya tabungan berjangka aktif yang dapat dicairkan.', 422, 'STATUS_INVALID');
        }

        $saldo = $tb->terkumpulNominal();
        if ($saldo <= 0) {
            return $this->errorResponse('Tidak ada saldo tabungan berjangka yang bisa dicairkan.', 422, 'NO_BALANCE');
        }

        $transaksi = DB::transaction(function () use ($request, $user, $jenis, $tb, $saldo) {
            $t = $this->transaksiService->buatTransaksi([
                'user_id' => $user->id,
                'jenis_tabungan_id' => $jenis->id,
                'tabungan_berjangka_id' => $tb->id,
                'jenis_transaksi' => JenisTransaksi::Tarik,
                'nominal' => $saldo,
                'metode_pembayaran' => MetodePembayaran::Transfer,
                'catatan_admin' => $request->catatan_admin ?: 'Pencairan tabungan berjangka oleh admin.',
                'auto_verify' => true,
            ]);

            $tb->update(['status' => 'selesai']);

            return $t;
        });

        $this->beriTahuUser($user, 'Pencairan Tabungan Berjangka', 'Pencairan tabungan berjangka sebesar Rp ' . number_format($saldo, 0, ',', '.') . ' telah diproses admin.');

        return $this->createdResponse(new TransaksiResource($transaksi->load('user:id,name', 'jenisTabungan')), 'Pencairan tabungan berjangka berhasil diproses.');
    }

    private function ciptakanTarik(User $user, JenisTabungan $jenis, float $nominal, Request $request, array $extra = []): Transaksi
    {
        return $this->transaksiService->buatTransaksi(array_merge([
            'user_id' => $user->id,
            'jenis_tabungan_id' => $jenis->id,
            'jenis_transaksi' => JenisTransaksi::Tarik,
            'nominal' => $nominal,
            'metode_pembayaran' => MetodePembayaran::Transfer,
            'catatan_admin' => $request->catatan_admin,
            'auto_verify' => true,
        ], $extra));
    }

    private function beriTahuUser(User $user, string $judul, string $pesan): void
    {
        $this->notif->kirim($user, $judul, $pesan, TipeNotifikasi::Verifikasi);
    }
}