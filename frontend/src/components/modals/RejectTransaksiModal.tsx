import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  X,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Transaksi } from '../../types';

interface RejectTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi | null;
}

export const RejectTransaksiModal: React.FC<RejectTransaksiModalProps> = ({
  isOpen,
  onClose,
  transaksi
}) => {
  const { tolakTransaksi, showToast } = useApp();
  const [alasan, setAlasan] = useState<string>('');

  if (!isOpen || !transaksi) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim()) {
      showToast('Wajib mengisi alasan penolakan transaksi', 'error');
      return;
    }

    tolakTransaksi(transaksi.id, alasan);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Tolak Transaksi Nasabah
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Anda akan menolak transaksi <strong className="text-slate-900 dark:text-white">{transaksi.nomor_referensi}</strong> sebesar <strong>Rp {formatRupiah(transaksi.nominal)}</strong> atas nama <strong>{transaksi.user_name}</strong>.
          </p>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Alasan Penolakan (Wajib Diisi)*
            </label>
            <textarea
              rows={3}
              required
              placeholder="Contoh: Bukti transfer buram / nominal tidak sesuai mutasi bank"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-md cursor-pointer"
            >
              Konfirmasi Tolak
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
