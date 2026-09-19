import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Users,
  Download
} from 'lucide-react';

interface ImportLaporanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportLaporanModal: React.FC<ImportLaporanModalProps> = ({ isOpen, onClose }) => {
  const { importLaporanHarian, downloadLaporanHarianTemplate } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setDone(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setDone(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await importLaporanHarian(file);
      setDone(true);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      // Error sudah ditangani di context (showToast)
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Import Laporan Harian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload file Excel laporan harian koperasi
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tombol unduh template */}
          <button
            type="button"
            onClick={() => downloadLaporanHarianTemplate()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 font-bold text-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Unduh Template Laporan Harian (.xlsx)
          </button>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-bold">Format yang didukung:</p>
              <ul className="space-y-0.5 list-disc list-inside text-blue-600 dark:text-blue-400">
                <li>Kolom <strong>Nama Nasabah</strong> — digunakan untuk identifikasi user</li>
                <li>Kolom <strong>Tanggal Pembayaran</strong> — tanggal transaksi historis</li>
                <li>Kolom <strong>Tabungan Emas / Mandiri / Hari Raya</strong> — nominal setor</li>
                <li>User baru otomatis dibuat jika nama belum terdaftar</li>
                <li>User baru diarahkan ke onboarding saat login pertama</li>
              </ul>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Transaksi dari laporan akan langsung <strong>terverifikasi</strong> sebagai data historis. Pastikan file sudah benar sebelum upload.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              file
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/10'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-300 dark:text-slate-500" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Seret & lepas file di sini, atau <span className="text-amber-600 dark:text-amber-400">klik untuk pilih</span>
                </p>
                <p className="text-xs text-slate-400">.xlsx, .xls, .csv — maks. 20MB</p>
              </div>
            )}
          </div>

          {done && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Import berhasil! Data nasabah dan transaksi historis telah diproses.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || loading}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              ) : (
                <><Users className="w-4 h-4" /> Proses Import</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
