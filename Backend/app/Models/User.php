<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'nomor_anggota',
        'target_emas_gram',
        'password',
        'role',
        'status',
        'address',
        'avatar_path',
        'approved_by',
        'approved_at',
        'rejected_reason',
        'last_login_at',
        'created_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'approved_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
        ];
    }

    // ─── Relationships ─────────────────────────────────────────

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function transaksi(): HasMany
    {
        return $this->hasMany(Transaksi::class);
    }

    public function pendaftaranQurban(): HasMany
    {
        return $this->hasMany(PendaftaranQurban::class);
    }

    public function notifikasi(): HasMany
    {
        return $this->hasMany(Notifikasi::class);
    }

    public function tabunganTarget(): HasMany
    {
        return $this->hasMany(UserTabunganTarget::class);
    }

    // ─── Helpers ───────────────────────────────────────────────

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isUser(): bool
    {
        return $this->role === UserRole::User;
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function isPending(): bool
    {
        return $this->status === UserStatus::Pending;
    }
}
