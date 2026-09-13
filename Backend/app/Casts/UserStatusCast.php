<?php

namespace App\Casts;

use App\Enums\UserStatus;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

/**
 * Toleran terhadap nilai status lama/tak dikenal di DB (mis. sisa 'pending'):
 * tidak boleh membuat auth 500, cukup dianggap belum aktif.
 */
class UserStatusCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): UserStatus
    {
        return UserStatus::tryFrom((string) $value) ?? UserStatus::Inactive;
    }

    public function set($model, string $key, $value, array $attributes): string
    {
        return $value instanceof UserStatus ? $value->value : (string) $value;
    }
}