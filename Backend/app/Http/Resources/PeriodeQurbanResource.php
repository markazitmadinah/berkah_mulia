<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PeriodeQurbanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tahun' => $this->tahun,
            'tanggal_buka_pendaftaran' => $this->tanggal_buka_pendaftaran->toDateString(),
            'tanggal_tutup_pendaftaran' => $this->tanggal_tutup_pendaftaran->toDateString(),
            'tanggal_idul_adha' => $this->tanggal_idul_adha->toDateString(),
            'tanggal_pencairan' => $this->tanggal_pencairan->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_pendaftaran_dibuka' => $this->isPendaftaranDibuka(),
            'hewan_qurban' => HewanQurbanResource::collection($this->whenLoaded('hewanQurban')),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
