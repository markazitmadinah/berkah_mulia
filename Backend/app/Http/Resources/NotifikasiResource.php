<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotifikasiResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'judul' => $this->judul,
            'pesan' => $this->pesan,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'data' => $this->data,
            'channel' => $this->channel->value,
            'dibaca_pada' => $this->dibaca_pada?->toISOString(),
            'is_dibaca' => ! is_null($this->dibaca_pada),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
