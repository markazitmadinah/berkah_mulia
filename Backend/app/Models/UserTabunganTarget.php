<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserTabunganTarget extends Model
{
    protected $table = 'user_tabungan_target';

    protected $fillable = ['user_id', 'jenis_tabungan_id', 'target_nominal'];

    protected function casts(): array
    {
        return [
            'target_nominal' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function jenisTabungan()
    {
        return $this->belongsTo(JenisTabungan::class);
    }
}
