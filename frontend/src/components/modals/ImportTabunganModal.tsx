import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ImportTabunganPreview } from '../../types';
import {
  X,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download,
  SearchCheck,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ImportTabunganModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportTabunganModal: React.FC<ImportTabunganModalProps> = ({ isOpen, onClose }) => {
  const { previewImportTabungan, importTabungan, downloadImportTabunganTemplate } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportTabunganPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [showRincian, setShowRincian] = useState(false);

  if (!isOpen) return null;

  const hasErrors = (preview?.errors?.length ?? 0) > 0;
  const hasWarnings = (preview?.warnings?.length ?? 0) > 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setDone(false);
    setShowRincian(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setPreview(null);
      setDone(false);
      setShowRincian(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const hasil = await previewImportTabungan(file);
      setPreview(hasil);
      setShowRincian(hasil.errors.length > 0);
    } catch {
      // Error ditangani di context (showToast)
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      await importTabungan(file);
      setDone(true);
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      // Error ditangani di context (showToast)
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setDone(false);
    setShowRincian(false);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const chips: Array<{ label: string; nilai: number }> = [];
  if (preview) {
    const s = preview.summary;
    chips.push(
      { label: 'Nasabah baru', nilai: s.nasabah.baru },
      { label: 'Nasabah ada', nilai: s.nasabah.ada },
      { label: 'Rencana emas', nilai: s.emas.rencana },
      { label: 'Saldo awal emas', nilai: s.emas.saldo_awal },
      { label: 'Saldo awal mandiri', nilai: s.mandiri.saldo_awal },
      { label: 'Daftar qurban', nilai: s.qurban.daftar },
      { label: 'Saldo awal qurban', nilai: s.qurban.saldo_awal },
      { label: 'Target hari raya', nilai: s.hari_raya.target },
      { label: 'Saldo awal hari raya', nilai: s.hari_raya.saldo_awal },
      { label: 'Rencana berjangka', nilai: s.berjangka.rencana },
      { label: 'Saldo awal berjangka', nilai: s.berjangka.saldo_awal },
      { label: 'Record gadai', nilai: s.gadai.record }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Import Tabungan (7 Sheet)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nasabah, Emas, Mandiri, Qurban, Hari Raya, Gadai, Berjangka
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

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Tombol unduh template */}
          <button
            type="button"
            onClick={() => downloadImportTabunganTemplate()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 font-bold text-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Unduh Template Import Tabungan (.xlsx)
          </button>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-bold">Cara pakai:</p>
              <ul className="space-y-0.5 list-disc list-inside text-blue-600 dark:text-blue-400">
                <li>Isi sheet <strong>Nasabah</strong> dulu — satu nasabah sekali (kolom Nasabah ID untuk referensi antar sheet)</li>
                <li>Sheet produk diisi hanya jika ada data; kolom <strong>Rencana</strong> dipakai untuk membedakan beberapa rencana per nasabah</li>
                <li>Import berjalan <strong>atomic</strong>: bila ada satu baris salah, seluruh file tidak diproses</li>
                <li>Import ulang <strong>idempoten</strong> — tidak membuat data ganda</li>
              </ul>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Selalu jalankan <strong>Preview &amp; Validasi</strong> sebelum import agar kesalahan tidak membatalkan seluruh berkas.
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
                  Seret &amp; lepas file di sini, atau <span className="text-amber-600 dark:text-amber-400">klik untuk pilih</span>
                </p>
                <p className="text-xs text-slate-400">.xlsx, .xls, .csv — maks. 20MB</p>
              </div>
            )}
          </div>

          {/* Hasil preview */}
          {preview && (
            <div className="space-y-4">
              {/* Ringkasan */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <SearchCheck className="w-4 h-4 text-emerald-600" /> Ringkasan Validasi
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRincian((v) => !v)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {showRincian ? 'Sembunyikan' : 'Rincian'}
                    {showRincian ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {chips.map((c) => (
                    <div key={c.label} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">{c.nilai}</p>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{c.label}</p>
                    </div>
                  ))}
                </div>

                {showRincian && (
                  <div className="mt-3 space-y-3">
                    {hasErrors && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                        <p className="px-3 py-2 text-[11px] font-extrabold text-red-700 dark:text-red-300 border-b border-red-100 dark:border-red-800/40 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> {preview.errors.length} Kesalahan — import diblokir
                        </p>
                        <ul className="p-3 space-y-1.5 max-h-40 overflow-y-auto">
                          {preview.errors.map((err, i) => (
                            <li key={i} className="text-[11px] text-red-700 dark:text-red-300">
                              <span className="font-bold">{err.sheet} baris {err.baris}</span> • {err.kolom}: {err.pesan}
                              {err.nilai ? ` (nilai: ${err.nilai})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {hasWarnings && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                        <p className="px-3 py-2 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 border-b border-amber-100 dark:border-amber-800/40">
                          {preview.warnings.length} Peringatan
                        </p>
                        <ul className="p-3 space-y-1.5 max-h-40 overflow-y-auto">
                          {preview.warnings.map((w, i) => (
                            <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300">
                              <span className="font-bold">{w.sheet} baris {w.baris}</span> • {w.kolom}: {w.pesan}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!hasErrors && !hasWarnings && (
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Tidak ada kesalahan atau peringatan.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {hasErrors && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    Perbaiki <strong>{preview.errors.length}</strong> kesalahan pada file, lalu upload ulang. Tidak ada data yang ditulis.
                  </p>
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Import selesai! Data nasabah &amp; tabungan telah diproses.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || importing}
              className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!file || importing}
              className="flex-1 py-3 rounded-2xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memvalidasi...</>
              ) : (
                <><SearchCheck className="w-4 h-4" /> Preview &amp; Validasi</>
              )}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || !preview || hasErrors || loading || importing}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
              ) : (
                <><Database className="w-4 h-4" /> Import Sekarang</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};