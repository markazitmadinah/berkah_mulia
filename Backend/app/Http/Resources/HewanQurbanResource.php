<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HewanQurbanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'jenis_hewan' => $this->jenis_hewan,
            'harga_per_unit' => $this->harga_per_unit,
            'berat_rata_rata' => $this->berat_rata_rata,
            'deskripsi' => $this->deskripsi,
            'periode_qurban_id' => $this->periode_qurban_id,
            'status_aktif' => $this->status_aktif,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
