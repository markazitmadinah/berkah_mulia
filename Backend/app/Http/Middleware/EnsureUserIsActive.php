<?php

namespace App\Http\Middleware;

use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Handle an incoming request.
     * Block API access for users with status pending, rejected, or suspended.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'error_code' => 'UNAUTHENTICATED',
            ], 401);
        }

        return match ($user->status) {
            UserStatus::Active => $next($request),

            UserStatus::Pending => response()->json([
                'success' => false,
                'message' => 'Akun Anda masih menunggu persetujuan admin. Silakan tunggu konfirmasi via email.',
                'error_code' => 'ACCOUNT_PENDING',
            ], 403),

            UserStatus::Rejected => response()->json([
                'success' => false,
                'message' => 'Pendaftaran akun Anda ditolak. Silakan hubungi admin untuk informasi lebih lanjut.',
                'error_code' => 'ACCOUNT_REJECTED',
            ], 403),

            UserStatus::Suspended => response()->json([
                'success' => false,
                'message' => 'Akun Anda telah dibekukan. Silakan hubungi admin.',
                'error_code' => 'ACCOUNT_SUSPENDED',
            ], 403),
        };
    }
}
