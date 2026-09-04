import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  AlertTriangle
} from 'lucide-react';
import { User } from '../../types';

interface RejectUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const RejectUserModal: React.FC<RejectUserModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const { rejectUser, showToast } = useApp();
  const [alasan, setAlasan] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim()) {
      showToast('Wajib mengisi alasan penolakan nasabah', 'error');
      return;
    }

    rejectUser(user.id, alasan);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Tolak Pendaftaran Nasabah
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
            Anda akan menolak pengajuan akun nasabah atas nama <strong className="text-slate-900 dark:text-white">{user.name}</strong> ({user.email}).
          </p>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Alasan Penolakan (Wajib Diisi)*
            </label>
            <textarea
              rows={3}
              required
              placeholder="Contoh: KTP buram / nomor identitas tidak valid"
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
              Tolak Nasabah
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
