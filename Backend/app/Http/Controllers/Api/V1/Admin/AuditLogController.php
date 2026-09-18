<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    use ApiResponse;

    /**
     * GET /admin/audit-logs
     * Read-only, no update/delete endpoints per BAGIAN I poin 11.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'model_type' => 'nullable|string|max:255',
            'user_id' => 'nullable|integer',
            'dari' => 'nullable|date',
            'sampai' => 'nullable|date',
            'action' => 'nullable|string|max:100',
        ]);

        $query = AuditLog::with('user');

        if ($request->filled('model_type')) {
            $modelType = str_replace(['%', '_'], ['\%', '\_'], $request->model_type);
            $query->where('model_type', 'like', '%' . $modelType . '%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('dari')) {
            $query->where('created_at', '>=', $request->dari);
        }

        if ($request->filled('sampai')) {
            $query->where('created_at', '<=', $request->sampai . ' 23:59:59');
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        $perPage = min($request->input('per_page', 15), 1000);
        $items = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'Berhasil mengambil audit log.',
            'data' => AuditLogResource::collection($items),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }
}