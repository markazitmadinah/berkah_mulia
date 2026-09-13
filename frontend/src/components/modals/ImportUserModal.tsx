import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Upload,
  Download,
  CheckCircle2
} from 'lucide-react';

interface ImportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportUserModal: React.FC<ImportUserModalProps> = ({
  isOpen,
  onClose
}) => {
  const { importUsers, downloadUserTemplate } = useApp();
  const [fileName, setFileName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setFileName(f ? f.name : '');
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Pilih file CSV / Excel terlebih dahulu');
      return;
    }
    setSubmitting(true);
    importUsers(file)
      .then(() => onClose())
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            Import Nasabah dari Excel / CSV
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-300">Format Data</span>
            <button
              type="button"
              onClick={downloadUserTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template .xlsx
            </button>
          </div>

          <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center block cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
            <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">
              {fileName || 'Pilih File .xlsx atau .csv'}
            </span>
            <span className="text-slate-400 mt-1 block">
              Gunakan file template yang sudah disediakan (nama, email, no. HP, no. anggota 16 digit, alamat, dll.)
            </span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {fileName && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>File siap diproses: {fileName}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Mengirim...' : 'Mulai Import Data'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
