<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class KonfigurasiSetoranEmasResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'jenis_tabungan_id' => $this->jenis_tabungan_id,
            'nominal_per_periode' => (float) $this->nominal_per_periode,
            'target_gram_per_periode' => (float) $this->target_gram_per_periode,
            'target_gram_total' => $this->target_gram_total !== null ? (float) $this->target_gram_total : null,
            'frekuensi_setor' => $this->frekuensi_setor->value,
            'frekuensi_setor_label' => $this->frekuensi_setor->label(),
            'jadwal_label' => $this->jadwalLabel(),
            'tanggal_mulai' => $this->tanggal_mulai?->toDateString(),
            'durasi_periode' => $this->durasi_periode,
            'tanggal_deadline' => $this->tanggal_deadline?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}