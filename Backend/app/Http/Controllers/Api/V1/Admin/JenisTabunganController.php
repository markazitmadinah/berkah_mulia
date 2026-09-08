<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\JenisTabunganResource;
use App\Models\AuditLog;
use App\Models\JenisTabungan;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JenisTabunganController extends Controller
{
    use ApiResponse;

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'kode' => 'required|string|max:50|unique:jenis_tabungan,kode',
            'nama' => 'required|string|max:255',
            'deskripsi' => 'nullable|string',
            'tipe' => 'required|string|in:emas,pribadi,qurban',
            'sub_jenis' => 'nullable|string|in:mandiri,hari_raya,qurban,berjangka',
            'deadline' => 'nullable|date',
            'frekuensi_setoran' => 'nullable|string|in:harian,mingguan,bulanan',
            'mode_perhitungan' => 'required|string|in:nominal_bebas,nominal_tetap,konversi_unit',
            'target_nominal' => 'nullable|numeric|min:0',
            'target_unit' => 'nullable|numeric|min:0',
            'unit_label' => 'nullable|string|max:50',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'tanpa_batas_waktu' => 'boolean',
            'aturan_pencairan' => 'required|string|in:otomatis,manual_admin,tanggal_tertentu',
            'tanggal_pencairan' => 'nullable|date',
            'metode_pembayaran_diizinkan' => 'required|array|min:1',
            'metode_pembayaran_diizinkan.*' => 'string|in:cash,transfer',
            'allow_withdrawal' => 'boolean',
            'config' => 'nullable|array',
            'status_aktif' => 'sometimes|boolean',
        ]);

        $allowed = [
            'kode', 'nama', 'deskripsi', 'tipe', 'sub_jenis', 'deadline', 'frekuensi_setoran',
            'mode_perhitungan', 'target_nominal', 'target_unit',
            'unit_label', 'tanggal_mulai', 'tanggal_selesai', 'tanpa_batas_waktu', 'aturan_pencairan',
            'tanggal_pencairan', 'metode_pembayaran_diizinkan', 'allow_withdrawal', 'config',
            'status_aktif',
        ];

        if (JenisTabungan::count() >= 6) {
            return $this->errorResponse('Jumlah jenis tabungan maksimal 6. Hapus salah satu tabungan tambahan terlebih dahulu.', 422, 'MAX_SAVING_ACCOUNT');
        }

        // Built-in products are 1:1: emas & qurban once per tipe; pribadi
        // branches into unique sub-jenis (mandiri/hari_raya/berjangka).
        $tipe = $request->input('tipe');
        $sub = $request->input('sub_jenis');

        if ($tipe === 'pribadi' && ! $sub) {
            return $this->errorResponse('Sub-jenis wajib diisi untuk tabungan pribadi (mandiri, hari_raya, berjangka).', 422, 'SUB_JENIS_REQUIRED');
        }

        $existing = $tipe === 'pribadi'
            ? JenisTabungan::where('tipe', $tipe)->where('sub_jenis', $sub)->exists()
            : JenisTabungan::where('tipe', $tipe)->exists();

        if ($existing) {
            return $this->errorResponse('Jenis tabungan tersebut sudah ada.', 422, 'SINGLE_INSTANCE_TYPE');
        }

        $jenis = JenisTabungan::create(array_merge(
            $request->only($allowed),
            [
                'created_by' => auth()->id(),
                'updated_by' => auth()->id(),
            ]
        ));

        AuditLog::record('create', $jenis);

        return $this->createdResponse(new JenisTabunganResource($jenis), 'Jenis tabungan berhasil dibuat.');
    }

    public function update(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        $request->validate([
            'kode' => 'sometimes|string|max:50|unique:jenis_tabungan,kode,' . $jenisTabungan->id,
            'nama' => 'sometimes|string|max:255',
            'deskripsi' => 'nullable|string',
            'tipe' => 'sometimes|string|in:emas,pribadi,qurban',
            'sub_jenis' => 'sometimes|nullable|string|in:mandiri,hari_raya,qurban,berjangka',
            'deadline' => 'nullable|date',
            'frekuensi_setoran' => 'nullable|string|in:harian,mingguan,bulanan',
            'mode_perhitungan' => 'sometimes|string|in:nominal_bebas,nominal_tetap,konversi_unit',
            'target_nominal' => 'nullable|numeric|min:0',
            'target_unit' => 'nullable|numeric|min:0',
            'unit_label' => 'nullable|string|max:50',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'tanpa_batas_waktu' => 'boolean',
            'aturan_pencairan' => 'sometimes|string|in:otomatis,manual_admin,tanggal_tertentu',
            'tanggal_pencairan' => 'nullable|date',
            'metode_pembayaran_diizinkan' => 'sometimes|array|min:1',
            'metode_pembayaran_diizinkan.*' => 'string|in:cash,transfer',
            'allow_withdrawal' => 'boolean',
            'config' => 'nullable|array',
            'status_aktif' => 'sometimes|boolean',
        ]);

        $allowed = [
            'kode', 'nama', 'deskripsi', 'tipe', 'sub_jenis', 'deadline', 'frekuensi_setoran',
            'mode_perhitungan', 'target_nominal', 'target_unit',
            'unit_label', 'tanggal_mulai', 'tanggal_selesai', 'tanpa_batas_waktu', 'aturan_pencairan',
            'tanggal_pencairan', 'metode_pembayaran_diizinkan', 'allow_withdrawal', 'config',
            'status_aktif',
        ];

        $oldValues = $jenisTabungan->toArray();

        $tipe = $request->input('tipe', $jenisTabungan->tipe?->value);
        $sub = $request->input('sub_jenis', $jenisTabungan->sub_jenis?->value);

        if ($tipe === 'pribadi' && ! $sub) {
            return $this->errorResponse('Sub-jenis wajib diisi untuk tabungan pribadi (mandiri, hari_raya, berjangka).', 422, 'SUB_JENIS_REQUIRED');
        }

        $existing = $tipe === 'pribadi'
            ? JenisTabungan::where('tipe', $tipe)->where('sub_jenis', $sub)->whereKeyNot($jenisTabungan->id)->exists()
            : JenisTabungan::where('tipe', $tipe)->whereKeyNot($jenisTabungan->id)->exists();

        if ($existing) {
            return $this->errorResponse('Jenis tabungan tersebut sudah ada.', 422, 'SINGLE_INSTANCE_TYPE');
        }

        $jenisTabungan->update(array_merge($request->only($allowed), ['updated_by' => auth()->id()]));
        AuditLog::record('update', $jenisTabungan, $oldValues, $jenisTabungan->fresh()->toArray());

        return $this->successResponse(new JenisTabunganResource($jenisTabungan->fresh()), 'Jenis tabungan berhasil diperbarui.');
    }

    public function destroy(JenisTabungan $jenisTabungan): JsonResponse
    {
        $defaultKodes = ['emas-harian', 'EMAS', 'tabungan-pribadi', 'tabungan-qurban', 'tabungan-hari-raya', 'tabungan-berjangka'];

        if (in_array($jenisTabungan->kode, $defaultKodes, true)) {
            return $this->errorResponse('Tabungan bawaan tidak bisa dihapus.', 422, 'DEFAULT_LOCKED');
        }

        // Check if there are active transactions
        if ($jenisTabungan->transaksi()->exists()) {
            return $this->errorResponse('Tidak bisa menghapus jenis tabungan yang masih memiliki transaksi.', 409, 'CONFLICT');
        }

        AuditLog::record('delete', $jenisTabungan);
        $jenisTabungan->delete();

        return $this->deletedResponse('Jenis tabungan berhasil dihapus.');
    }

    public function toggleStatus(JenisTabungan $jenisTabungan): JsonResponse
    {
        $oldStatus = $jenisTabungan->status_aktif;
        $jenisTabungan->update(['status_aktif' => ! $oldStatus]);

        AuditLog::record('toggle_status', $jenisTabungan, ['status_aktif' => $oldStatus], ['status_aktif' => ! $oldStatus]);

        $label = $jenisTabungan->status_aktif ? 'diaktifkan' : 'dinonaktifkan';

        return $this->successResponse(new JenisTabunganResource($jenisTabungan->fresh()), "Jenis tabungan berhasil {$label}.");
    }
}
