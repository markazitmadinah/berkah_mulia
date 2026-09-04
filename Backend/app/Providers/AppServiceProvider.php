<?php

namespace App\Providers;

use App\Models\Transaksi;
use App\Observers\TransaksiObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Gate Scramble (API docs) routes to non-production. Default config enables
        // /docs/api + /docs/api.json everywhere, leaking the full API schema.
        // Prod access can be re-enabled behind auth/basic when needed.
        $this->app['config']->set('scramble.enabled', app()->environment('local', 'development'));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Enforce Sanctum token expiry (minutes). .env: SANCTUM_TOKEN_EXPIRY_MINUTES.
        // Without this, config('sanctum.expiration') is null → tokens never expire.
        $this->app['config']->set('sanctum.expiration', (int) env('SANCTUM_TOKEN_EXPIRY_MINUTES', 10080));

        // Register model observers
        Transaksi::observe(TransaksiObserver::class);
    }
}
