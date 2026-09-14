<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotifikasiResource;
use App\Models\Notifikasi;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotifikasiController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        // Notifikasi tampil maksimal 30 hari (window 1 bulan) di halaman
        // pusat notifikasi; lebih lama dari itu otomatis tidak dikembalikan.
        $query = Notifikasi::where('user_id', $request->user()->id)
            ->where('created_at', '>=', now()->subDays(30));

        if ($request->filled('dibaca')) {
            if ($request->boolean('dibaca')) {
                $query->sudahDibaca();
            } else {
                $query->belumDibaca();
            }
        }

        $perPage = min($request->input('per_page', 15), 100);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil notifikasi.',
            'data' => NotifikasiResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
                'unread_count' => Notifikasi::where('user_id', $request->user()->id)
                    ->where('created_at', '>=', now()->subDays(30))
                    ->belumDibaca()
                    ->count(),
            ],
        ]);
    }

    public function markAsRead(Request $request, Notifikasi $notifikasi): JsonResponse
    {
        if ($notifikasi->user_id !== $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke notifikasi ini.', 403, 'FORBIDDEN');
        }

        $notifikasi->tandaiDibaca();

        return $this->successResponse(new NotifikasiResource($notifikasi->fresh()), 'Notifikasi ditandai telah dibaca.');
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        Notifikasi::where('user_id', $request->user()->id)
            ->belumDibaca()
            ->update(['dibaca_pada' => now()]);

        return $this->successResponse(null, 'Semua notifikasi ditandai telah dibaca.');
    }
}
