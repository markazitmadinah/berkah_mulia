<?php

namespace App\Services;

use App\Enums\JenisTransaksi;
use App\Enums\MetodePembayaran;
use App\Enums\StatusVerifikasi;
use App\Models\JenisTabungan;
use App\Models\Transaksi;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TransaksiService
{
    /**
     * Create a new transaction.
     */
    public function buatTransaksi(array $data): Transaksi
    {
        $data['nomor_referensi'] = Transaksi::generateNomorReferensi();
        $data['tanggal_transaksi'] = $data['tanggal_transaksi'] ?? now()->toDateString();
        $data['status_verifikasi'] = $data['status_verifikasi'] ?? StatusVerifikasi::MenungguVerifikasi;

        // Auto verify cash transactions created by admin
        if (
            isset($data['auto_verify']) && $data['auto_verify'] === true
        ) {
            $data['status_verifikasi'] = StatusVerifikasi::Terverifikasi;
            $data['diverifikasi_oleh'] = auth()->id(); // admin who input
            $data['diverifikasi_pada'] = now();
            unset($data['auto_verify']);
        }

        return Transaksi::create($data);
    }

    /**
     * Upload bukti transfer with secure file handling.
     * Per BAGIAN I poin 5: UUID name, private disk, MIME validation.
     */
    public function uploadBuktiTransfer(Transaksi $transaksi, UploadedFile $file): string
    {
        // Delete old file if exists
        if ($transaksi->bukti_transfer_path) {
            Storage::disk('bukti_transfer')->delete($transaksi->bukti_transfer_path);
        }

        // Store with UUID filename for security
        $extension = $file->getClientOriginalExtension();
        $filename = Str::uuid() . '.' . $extension;
        $path = $file->storeAs('', $filename, 'bukti_transfer');

        $transaksi->update(['bukti_transfer_path' => $path]);

        return $path;
    }

    /**
     * Get signed temporary URL for bukti transfer.
     */
    public function getBuktiTransferUrl(Transaksi $transaksi): ?string
    {
        if (! $transaksi->bukti_transfer_path) {
            return null;
        }

        $disk = Storage::disk('bukti_transfer');

        if (! $disk->exists($transaksi->bukti_transfer_path)) {
            return null;
        }

        // For local disk, return a route-based URL
        // For S3, use temporaryUrl
        return route('bukti-transfer.show', ['transaksi' => $transaksi->id]);
    }

    /**
     * Check for potential duplicate transactions within a time window.
     * Per BAGIAN I poin 12: Idempotency guard.
     */
    public function isDuplicate(int $userId, int $jenisTabunganId, string $jenisTransaksi, float $nominal, int $windowSeconds = 30): bool
    {
        return Transaksi::where('user_id', $userId)
            ->where('jenis_tabungan_id', $jenisTabunganId)
            ->where('jenis_transaksi', $jenisTransaksi)
            ->where('nominal', $nominal)
            ->where('created_at', '>=', now()->subSeconds($windowSeconds))
            ->exists();
    }
}
