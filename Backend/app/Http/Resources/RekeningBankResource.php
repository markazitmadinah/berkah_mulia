<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RekeningBankResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama_bank' => $this->nama_bank,
            'logo_color' => $this->logo_color,
            'no_rekening' => $this->no_rekening,
            'atas_nama' => $this->atas_nama,
            'cabang' => $this->cabang,
            'status_aktif' => $this->status_aktif,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
