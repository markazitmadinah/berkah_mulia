<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\JenisTabunganResource;
use App\Models\JenisTabungan;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JenisTabunganController extends Controller
{
    use ApiResponse;

    /**
     * GET /jenis-tabungan
     * Users only see active ones.
     */
    public function index(Request $request): JsonResponse
    {
        $query = JenisTabungan::query();

        // Non-admin users only see active products
        if (! $request->user()->isAdmin()) {
            $query->aktif();
        } elseif ($request->filled('status_aktif')) {
            $query->where('status_aktif', $request->boolean('status_aktif'));
        }

        $perPage = min($request->input('per_page', 15), 100);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil data jenis tabungan.',
            'data' => JenisTabunganResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /**
     * GET /jenis-tabungan/{jenisTabungan}
     * Non-admin users cannot inspect inactive products.
     */
    public function show(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        if (! $request->user()->isAdmin() && ! $jenisTabungan->status_aktif) {
            return response()->json([
                'success' => false,
                'message' => 'Resource tidak ditemukan.',
                'error_code' => 'NOT_FOUND',
            ], 404);
        }

        return $this->successResponse(new JenisTabunganResource($jenisTabungan));
    }
}
