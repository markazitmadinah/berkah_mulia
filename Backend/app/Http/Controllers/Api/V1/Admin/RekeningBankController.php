<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\RekeningBankResource;
use App\Models\AuditLog;
use App\Models\RekeningBank;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RekeningBankController extends Controller
{
    use ApiResponse;

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nama_bank' => 'required|string|max:255',
            'no_rekening' => 'required|string|max:50',
            'atas_nama' => 'required|string|max:255',
            'cabang' => 'nullable|string|max:255',
            'logo_color' => 'nullable|string|max:32',
        ]);

        $rekening = RekeningBank::create(array_merge(
            $request->only(['nama_bank', 'no_rekening', 'atas_nama', 'cabang', 'logo_color']),
            ['created_by' => auth()->id()]
        ));
        AuditLog::record('create', $rekening);

        return $this->createdResponse(new RekeningBankResource($rekening), 'Rekening bank berhasil ditambahkan.');
    }

    public function update(Request $request, RekeningBank $rekeningBank): JsonResponse
    {
        $request->validate([
            'nama_bank' => 'sometimes|string|max:255',
            'no_rekening' => 'sometimes|string|max:50',
            'atas_nama' => 'sometimes|string|max:255',
            'cabang' => 'nullable|string|max:255',
            'logo_color' => 'nullable|string|max:32',
        ]);

        $oldValues = $rekeningBank->toArray();
        $rekeningBank->update($request->only(['nama_bank', 'no_rekening', 'atas_nama', 'cabang', 'logo_color']));
        AuditLog::record('update', $rekeningBank, $oldValues, $rekeningBank->fresh()->toArray());

        return $this->successResponse(new RekeningBankResource($rekeningBank->fresh()), 'Rekening bank berhasil diperbarui.');
    }

    public function toggleStatus(RekeningBank $rekeningBank): JsonResponse
    {
        $oldStatus = $rekeningBank->status_aktif;
        $rekeningBank->update(['status_aktif' => ! $oldStatus]);
        AuditLog::record('toggle_status', $rekeningBank, ['status_aktif' => $oldStatus], ['status_aktif' => ! $oldStatus]);

        $label = $rekeningBank->status_aktif ? 'diaktifkan' : 'dinonaktifkan';

        return $this->successResponse(new RekeningBankResource($rekeningBank->fresh()), "Rekening bank berhasil {$label}.");
    }

    public function destroy(RekeningBank $rekeningBank): JsonResponse
    {
        AuditLog::record('delete', $rekeningBank);
        $rekeningBank->delete();

        return $this->deletedResponse('Rekening bank berhasil dihapus.');
    }
}
