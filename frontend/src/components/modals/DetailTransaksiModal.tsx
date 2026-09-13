import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { authFileUrl } from '../../lib/api';
import { formatRupiah } from '../../utils/format';
import {
  X,
  ReceiptText,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Building2,
  Coins
} from 'lucide-react';
import { Transaksi } from '../../types';

interface DetailTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi | null;
}

export const DetailTransaksiModal: React.FC<DetailTransaksiModalProps> = ({
  isOpen,
  onClose,
  transaksi
}) => {
  const [buktiUrl, setBuktiUrl] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    if (transaksi?.bukti_transfer_path) {
      authFileUrl(transaksi.bukti_transfer_path)
        .then(setBuktiUrl)
        .catch(() => setBuktiUrl(''));
    } else {
      setBuktiUrl('');
    }
  }, [transaksi]);

  if (!isOpen || !transaksi) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {transaksi.nomor_referensi}
            </span>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Detail Transaksi
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900">
            <span className="text-slate-500 font-semibold">Status Verifikasi</span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
              transaksi.status_verifikasi === 'terverifikasi'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : transaksi.status_verifikasi === 'menunggu_verifikasi'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
            }`}>
              {transaksi.status_verifikasi === 'terverifikasi' && <CheckCircle2 className="w-3 h-3" />}
              {transaksi.status_verifikasi === 'menunggu_verifikasi' && <Clock className="w-3 h-3" />}
              {transaksi.status_verifikasi === 'ditolak' && <XCircle className="w-3 h-3" />}
              <span className="capitalize">{transaksi.status_verifikasi.replace('_', ' ')}</span>
            </span>
          </div>

          {/* Nominal & Emas details */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
              Nominal Transaksi
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 break-words">
              Rp {formatRupiah(transaksi.nominal)}
            </div>
            {transaksi.unit_didapat && (
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" /> Konversi Fisik: {transaksi.unit_didapat} Gram Emas
              </p>
            )}
          </div>

          {/* Details list */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">Nama Nasabah:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{transaksi.user_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Produk Tabungan:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{transaksi.jenis_tabungan_nama}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Jenis Mutasi:</span>
              <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">{transaksi.jenis_transaksi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Metode Pembayaran:</span>
              <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">{transaksi.metode_pembayaran}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tanggal Transaksi:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{transaksi.tanggal_transaksi}</span>
            </div>
            {transaksi.rekening_bank_nama && (
              <div className="flex justify-between">
                <span className="text-slate-400">Rekening Tujuan:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{transaksi.rekening_bank_nama}</span>
              </div>
            )}
            {transaksi.catatan_user && (
              <div className="pt-2">
                <span className="text-slate-400 block mb-0.5">Catatan Nasabah:</span>
                <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                  "{transaksi.catatan_user}"
                </p>
              </div>
            )}
            {transaksi.catatan_admin && (
              <div className="pt-2">
                <span className="text-rose-500 font-bold block mb-0.5">Catatan Verifikator/Admin:</span>
                <p className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200">
                  "{transaksi.catatan_admin}"
                </p>
              </div>
            )}
          </div>

          {/* Bukti Transfer Image Preview */}
          {buktiUrl && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-2">
                Bukti Transfer / Foto Struk
              </span>
              <button
                onClick={() => setPreviewOpen(true)}
                className="w-full mb-2 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Lihat Bukti Full
              </button>
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-48 bg-slate-100 dark:bg-slate-900">
                <img
                  src={buktiUrl}
                  alt="Bukti Transfer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Fullscreen image preview */}
      {previewOpen && createPortal(
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewOpen(false)}
        >
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={buktiUrl}
            alt="Bukti Transfer"
            className="max-w-full max-h-full w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
      </div>
    </div>
  );
};
