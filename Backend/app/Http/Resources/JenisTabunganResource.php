<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JenisTabunganResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kode' => $this->kode,
            'nama' => $this->nama,
            'deskripsi' => $this->deskripsi,
            'tipe' => $this->tipe->value,
            'tipe_label' => $this->tipe->label(),
            'mode_perhitungan' => $this->mode_perhitungan->value,
            'target_nominal' => $this->target_nominal,
            'target_unit' => $this->target_unit,
            'unit_label' => $this->unit_label,
            'tanggal_mulai' => $this->tanggal_mulai?->toDateString(),
            'tanggal_selesai' => $this->tanggal_selesai?->toDateString(),
            'tanpa_batas_waktu' => $this->tanpa_batas_waktu,
            'aturan_pencairan' => $this->aturan_pencairan->value,
            'tanggal_pencairan' => $this->tanggal_pencairan?->toDateString(),
            'metode_pembayaran_diizinkan' => $this->metode_pembayaran_diizinkan,
            'allow_withdrawal' => $this->allow_withdrawal,
            'status_aktif' => $this->status_aktif,
            'config' => $this->config ?? (object) [],
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
