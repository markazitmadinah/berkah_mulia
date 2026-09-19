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
                'phone' => $this->user->phone,
                'nomor_anggota' => $this->user->nomor_anggota,
            ]),
            'user_name' => $this->whenLoaded('user', fn () => $this->user->name),
            'user_phone' => $this->whenLoaded('user', fn () => $this->user->phone),
            'user_nomor_anggota' => $this->whenLoaded('user', fn () => $this->user->nomor_anggota),
            'jenis_tabungan' => $this->whenLoaded('jenisTabungan', fn () => [
                'id' => $this->jenisTabungan->id,
                'kode' => $this->jenisTabungan->kode,
                'nama' => $this->jenisTabungan->nama,
                'tipe' => $this->jenisTabungan->tipe->value,
            ]),
            'jenis_tabungan_nama' => $this->whenLoaded('jenisTabungan', fn () => $this->jenisTabungan->nama),
            'tipe_tabungan' => $this->whenLoaded('jenisTabungan', fn () => $this->jenisTabungan->tipe->value)
                ?? ($this->gadai_id ? 'gadai' : null),
            'sub_jenis' => $this->whenLoaded('jenisTabungan', fn () => $this->jenisTabungan->sub_jenis?->value),
            'nomor_gadai' => $this->whenLoaded('gadai', fn () => $this->gadai->nomor_gadai),
            'rekening_bank_nama' => $this->whenLoaded('rekeningBank', fn () => $this->rekeningBank->nama_bank.' '.$this->rekeningBank->no_rekening),
            'diverifikasi_oleh_name' => $this->whenLoaded('diverifikasiOleh', fn () => $this->diverifikasiOleh?->name),
            'pendaftaran_qurban_id' => $this->pendaftaran_qurban_id,
            'tabungan_berjangka_id' => $this->tabungan_berjangka_id,
            'gadai_id' => $this->gadai_id,
            'gadai' => $this->whenLoaded('gadai', fn () => [
                'id' => $this->gadai->id,
                'nomor_gadai' => $this->gadai->nomor_gadai,
                'jenis_emas' => $this->gadai->jenis_emas,
            ]),
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
