<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\RekeningBankResource;
use App\Models\RekeningBank;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RekeningBankController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = RekeningBank::query();

        // Only admin may inspect inactive accounts; users always get active ones.
        if ($request->user()->isAdmin() && $request->filled('status_aktif')) {
            $query->where('status_aktif', $request->boolean('status_aktif'));
        } else {
            $query->aktif();
        }

        return $this->successResponse(RekeningBankResource::collection($query->get()));
    }
}
