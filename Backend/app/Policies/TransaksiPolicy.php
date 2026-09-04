<?php

namespace App\Policies;

use App\Models\Transaksi;
use App\Models\User;

class TransaksiPolicy
{
    /**
     * User can only view their own transactions.
     */
    public function view(User $user, Transaksi $transaksi): bool
    {
        return $user->isAdmin() || $user->id === $transaksi->user_id;
    }

    /**
     * Only the transaction owner can upload bukti transfer.
     */
    public function uploadBukti(User $user, Transaksi $transaksi): bool
    {
        return $user->id === $transaksi->user_id && $transaksi->isMenungguVerifikasi();
    }

    /**
     * Only admin can verify/reject transactions.
     */
    public function verify(User $user, Transaksi $transaksi): bool
    {
        return $user->isAdmin();
    }
}
