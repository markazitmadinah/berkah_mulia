<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AuthController extends Controller
{
    use ApiResponse;

    /**
     * POST /auth/login
     * Reject login for rejected/suspended users with specific messages.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return $this->errorResponse('Email atau password salah.', 401, 'INVALID_CREDENTIALS');
        }

        // Anti-enumeration: a non-active account returns the SAME generic 401 as
        // a wrong password, so attackers cannot probe which emails exist or their
        // exact status. Legitimate users are still notified via their registration
        // email/notification; rejected reason stays internal.
        if ($user->status !== UserStatus::Active) {
            return $this->errorResponse('Email atau password salah.', 401, 'INVALID_CREDENTIALS');
        }

        // Update last login
        $user->update(['last_login_at' => now()]);

        // Create Sanctum token
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'user' => new UserResource($user),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Login berhasil.');
    }

    /**
     * POST /auth/logout
     * Revoke current token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Logout berhasil.');
    }

    /**
     * GET /auth/me
     */
    public function me(Request $request): JsonResponse
    {
        return $this->successResponse(new UserResource($request->user()));
    }

    /**
     * GET /avatar/{user}
     * Stream the user's profile photo. Accessible by the owner or an admin.
     */
    public function avatar(Request $request, User $user)
    {
        if ($user->id !== $request->user()->id && $request->user()->role !== UserRole::Admin) {
            return $this->errorResponse('Anda tidak memiliki akses ke foto profil ini.', 403, 'FORBIDDEN');
        }

        if (! $user->avatar_path || ! Storage::disk('public')->exists($user->avatar_path)) {
            throw new NotFoundHttpException('Foto profil tidak ditemukan.');
        }

        return Storage::disk('public')->response($user->avatar_path);
    }

    /**
     * PUT /auth/me
     * Update own profile — cannot change role or status.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->only(['name', 'phone', 'address']);

        // Handle avatar upload
        if ($request->hasFile('avatar')) {
            // Delete old avatar to prevent storage bloat and info leak
            if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
                Storage::disk('public')->delete($user->avatar_path);
            }

            $path = $request->file('avatar')->store('avatars', 'public');
            $data['avatar_path'] = $path;
        }

        $user->update($data);

        return $this->successResponse(new UserResource($user->fresh()), 'Profil berhasil diperbarui.');
    }

    /**
     * POST /auth/forgot-password
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        // Always return success to prevent email enumeration — per anti-enumeration best practice.
        Password::sendResetLink($request->only('email'));

        return $this->successResponse(null, 'Jika email Anda terdaftar, link reset password telah dikirim.');
    }

    /**
     * POST /auth/reset-password
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|regex:/^(?=.*[a-zA-Z])(?=.*\d).+$/|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                // Revoke all tokens on password reset — per BAGIAN I poin 1
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return $this->successResponse(null, 'Password berhasil direset.');
        }

        return $this->errorResponse('Gagal mereset password. Token tidak valid atau sudah expired.', 400);
    }

    /**
     * POST /auth/change-password
     * Requires current password. Revokes all tokens.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->update(['password' => $request->password]);

        // Revoke all tokens — per BAGIAN I poin 1
        $user->tokens()->delete();

        // Issue new token for current session
        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->successResponse([
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Password berhasil diubah. Semua sesi lain telah dikeluarkan.');
    }
}
