<?php

// PHP 8.5 deprecates several PDO constants (e.g. PDO::MYSQL_ATTR_SSL_CA) still
// referenced by the Laravel framework config. Running on PHP 8.5, these
// deprecation notices would otherwise echo into API JSON responses.
error_reporting(E_ALL & ~E_DEPRECATED);

use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Register middleware aliases
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'active' => EnsureUserIsActive::class,
        ]);

        // Append security headers to all requests
        $middleware->append(SecurityHeaders::class);

        // API-only token authentication (Bearer). We deliberately do NOT prepend
        // Sanctum's EnsureFrontendRequestsAreStateful: it would treat browser
        // origins (localhost:3000) as a cookie-session SPA and force CSRF, causing
        // 419 on every POST from the React client. This API is token-based.
        // $middleware->api(prepend: [
        //     \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        // ]);

        // Rate limiting for API
        $middleware->throttleApi('300,1');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Custom JSON exception handler for API — per BAGIAN H format
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource tidak ditemukan.',
                    'error_code' => 'NOT_FOUND',
                ], 404);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Anda tidak memiliki akses ke resource ini.',
                    'error_code' => 'FORBIDDEN',
                ], 403);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data yang dikirim tidak valid.',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                    'error_code' => 'TOO_MANY_REQUESTS',
                ], 429);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Token tidak valid atau sudah expired.',
                    'error_code' => 'UNAUTHENTICATED',
                ], 401);
            }
        });

        // API-only: unauthenticated request that hits the auth layer but the
        // client sent no JSON Accept header would try to redirect to route
        // 'login' (which doesn't exist) -> RouteNotFoundException. An API auth
        // failure is always 401, never a redirect.
        $exceptions->render(function (\Symfony\Component\Routing\Exception\RouteNotFoundException $e, Request $request) {
            if ($request->is('api/*') && str_contains($e->getMessage(), 'login')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Token tidak valid atau sudah expired.',
                    'error_code' => 'UNAUTHENTICATED',
                ], 401);
            }
        });

        // Catch-all for non-local environments: don't expose stack traces
        $exceptions->render(function (\Throwable $e, Request $request) {
            if (($request->is('api/*') || $request->expectsJson()) && ! app()->environment('local')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Terjadi kesalahan pada server.',
                    'error_code' => 'SERVER_ERROR',
                ], 500);
            }
        });
    })->create();
