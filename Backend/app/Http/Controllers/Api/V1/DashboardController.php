<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JenisTabungan;
use App\Services\ProgressCalculatorService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use ApiResponse;

    public function __construct(private ProgressCalculatorService $progressService) {}

    /**
     * GET /dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $summary = $this->progressService->getDashboardSummary($request->user());

        return $this->successResponse($summary);
    }

    /**
     * GET /dashboard/{jenisTabungan}/progress
     */
    public function progress(Request $request, JenisTabungan $jenisTabungan): JsonResponse
    {
        $progress = $this->progressService->getProgress($request->user(), $jenisTabungan);

        return $this->successResponse($progress);
    }
}
