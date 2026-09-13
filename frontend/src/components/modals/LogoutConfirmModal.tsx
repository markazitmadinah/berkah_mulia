import React from 'react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm sm:my-8 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <LogOut className="w-5 h-5" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Logout</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin keluar dari akun ini? Anda akan kembali ke halaman masuk.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/25 transition-all cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};