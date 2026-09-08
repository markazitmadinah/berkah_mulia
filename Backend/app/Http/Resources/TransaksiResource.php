<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransaksiResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nomor_referensi' => $this->nomor_referensi,
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ]),
            'jenis_tabungan' => $this->whenLoaded('jenisTabungan', fn () => [
                'id' => $this->jenisTabungan->id,
                'kode' => $this->jenisTabungan->kode,
                'nama' => $this->jenisTabungan->nama,
                'tipe' => $this->jenisTabungan->tipe->value,
            ]),
            'pendaftaran_qurban_id' => $this->pendaftaran_qurban_id,
            'jenis_transaksi' => $this->jenis_transaksi->value,
            'jenis_transaksi_label' => $this->jenis_transaksi->label(),
            'nominal' => $this->nominal,
            'nominal_emas' => $this->nominal_emas,
            'nominal_dana' => $this->nominal_selisih,
            'unit_didapat' => $this->unit_didapat,
            'harga_acuan_id' => $this->harga_acuan_id,
            'harga_acuan_snapshot' => $this->harga_acuan_snapshot,
            'biaya_penalti' => $this->biaya_penalti,
            'metode_pembayaran' => $this->metode_pembayaran->value,
            'metode_pembayaran_label' => $this->metode_pembayaran->label(),
            'rekening_bank' => $this->whenLoaded('rekeningBank', fn () => new RekeningBankResource($this->rekeningBank)),
            'bukti_transfer_url' => $this->when(
                $this->bukti_transfer_path,
                fn () => route('bukti-transfer.show', ['transaksi' => $this->id])
            ),
            'status_verifikasi' => $this->status_verifikasi->value,
            'status_verifikasi_label' => $this->status_verifikasi->label(),
            'diverifikasi_oleh' => $this->whenLoaded('diverifikasiOleh', fn () => $this->diverifikasiOleh?->name),
            'diverifikasi_pada' => $this->diverifikasi_pada?->toISOString(),
            'catatan_admin' => $this->catatan_admin,
            'catatan_user' => $this->catatan_user,
            'tanggal_transaksi' => $this->tanggal_transaksi->toDateString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
