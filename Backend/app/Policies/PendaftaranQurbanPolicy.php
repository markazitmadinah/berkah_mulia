<?php

namespace App\Policies;

use App\Models\PendaftaranQurban;
use App\Models\User;

class PendaftaranQurbanPolicy
{
    public function view(User $user, PendaftaranQurban $pendaftaran): bool
    {
        return $user->isAdmin() || $user->id === $pendaftaran->user_id;
    }

    public function setor(User $user, PendaftaranQurban $pendaftaran): bool
    {
        return $user->id === $pendaftaran->user_id;
    }
}
