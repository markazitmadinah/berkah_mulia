<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exports\TabunganImportTemplate;
use App\Http\Controllers\Controller;
use App\Imports\TabunganImport\TabunganImportService;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Import data tabungan 7 sheet (Nasabah, Emas, Mandiri, Qurban,
 * Hari Raya, Gadai, Berjangka). Validasi penuh sebelum menulis, atomic
 * transaction, idempoten terhadap import ulang.
 */
class ImportTabunganController extends Controller
{
    use ApiResponse;

    /**
     * GET /admin/import-tabungan/template
     */
    public function template(): BinaryFileResponse
    {
        return Excel::download(new TabunganImportTemplate, 'template_import_tabungan_7sheet.xlsx');
    }

    /**
     * POST /admin/import-tabungan/preview
     * Validasi + resolve tanpa menulis data.
     */
    public function preview(Request $request, TabunganImportService $service): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ]);

        try {
            $hasil = $service->selesai($service->baca($request->file('file')));
        } catch (\Throwable $e) {
            Log::error('Preview import tabungan gagal: '.$e->getMessage(), ['exception' => $e]);

            return $this->errorResponse('File tidak dapat dibaca. '.$e->getMessage(), 422);
        }

        if ($hasil['errors']) {
            return $this->successResponse($this->bentukPreview($hasil), 'Preview selesai. Terdapat '.count($hasil['errors']).' kesalahan.');
        }

        return $this->successResponse($this->bentukPreview($hasil), 'Preview selesai. Data siap diimport.');
    }

    /**
     * POST /admin/import-tabungan
     */
    public function import(Request $request, TabunganImportService $service): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:20480',
        ]);

        try {
            $baca = $service->baca($request->file('file'));
        } catch (\Throwable $e) {
            Log::error('Import tabungan: file tidak terbaca. '.$e->getMessage(), ['exception' => $e]);

            return $this->errorResponse('File tidak dapat dibaca. '.$e->getMessage(), 422);
        }

        $hasil = $service->selesai($baca, $request->user()->id);
        if ($hasil['errors']) {
            return response()->json([
                'success' => false,
                'message' => 'Import dibatalkan: '.count($hasil['errors']).' kesalahan ditemukan.',
                'data' => $this->bentukPreview($hasil),
            ], 422);
        }

        try {
            $hasil = DB::transaction(fn () => $service->impor($baca, $request->user()->id));
        } catch (\Throwable $e) {
            Log::error('Import tabungan gagal: '.$e->getMessage(), ['exception' => $e]);

            return $this->errorResponse('Import gagal: '.$e->getMessage(), 500);
        }

        AuditLog::record('import_tabungan', $request->user(), [], ['summary' => $hasil['summary']]);

        return $this->successResponse($this->bentukPreview($hasil), 'Import selesai.');
    }

    /**
     * Preview tanpa 'plan' — hanya info untuk ditampilkan frontend.
     */
    private function bentukPreview(array $hasil): array
    {
        return [
            'summary' => $hasil['summary'],
            'errors' => $hasil['errors'],
            'warnings' => $hasil['warnings'],
        ];
    }
}