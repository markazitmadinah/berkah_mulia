<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PendaftaranQurbanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ]),
            'periode_qurban' => $this->whenLoaded('periodeQurban', fn () => new PeriodeQurbanResource($this->periodeQurban)),
            'hewan_qurban' => $this->whenLoaded('hewanQurban', fn () => new HewanQurbanResource($this->hewanQurban)),
            'jumlah_hewan' => $this->jumlah_hewan,
            'target_dana' => $this->target_dana,
            'total_terkumpul' => $this->total_terkumpul,
            'frekuensi_setor' => $this->frekuensi_setor,
            'frekuensi_label' => $this->frekuensiLabel(),
            'nominal_per_periode' => $this->nominal_per_periode,
            'sisa_pembayaran' => $this->sisaPembayaran(),
            'tertunggak' => $this->tertunggak(),
            'persentase' => $this->hitungPersentase(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'tanggal_daftar' => $this->tanggal_daftar->toDateString(),
            'tanggal_dicairkan' => $this->tanggal_dicairkan?->toDateString(),
            'dicairkan_oleh' => $this->whenLoaded('dicairkanOleh', fn () => $this->dicairkanOleh?->name),
            'catatan' => $this->catatan,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
