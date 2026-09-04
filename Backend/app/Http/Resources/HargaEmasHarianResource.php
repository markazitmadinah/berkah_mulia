<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HargaEmasHarianResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tanggal' => $this->tanggal->toDateString(),
            'harga_per_gram' => (float) $this->harga_per_gram,
            'tagihan_harian_default' => (float) $this->tagihan_harian_default,
            'status_aktif' => $this->status_aktif,
            'catatan' => $this->catatan,
            'created_by' => $this->whenLoaded('createdBy', fn () => $this->createdBy?->name),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
