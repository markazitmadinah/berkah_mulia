import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Landmark,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  Info
} from 'lucide-react';

export const UserRekeningBank: React.FC = () => {
  const { rekeningBank, showToast } = useApp();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const activeRekening = rekeningBank.filter(r => r.status_aktif);

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Nomor rekening ${text} berhasil disalin ke clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-teal-500/10 dark:from-emerald-950/40 dark:via-slate-800 dark:to-cyan-950/30 border border-emerald-300/40 dark:border-emerald-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              Rekening Resmi Koperasi
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
              Aman & Terverifikasi
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Rekening Bank Tujuan Transfer
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Gunakan daftar rekening resmi Koperasi Simpan Pinjam Syariah Berkah Mulia di bawah ini untuk melakukan setoran tabungan emas, pribadi, atau qurban.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 max-w-xs text-xs text-slate-600 dark:text-slate-300 shadow-sm flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p>
            Pastikan menyertakan bukti transfer mutasi saat mengajukan setoran agar diverifikasi dengan cepat oleh admin.
          </p>
        </div>
      </div>

      {/* Rekening Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeRekening.map((rek) => (
          <div
            key={rek.id}
            className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: rek.logo_color || '#10B981' }}
                  >
                    {rek.nama_bank.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {rek.nama_bank}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">{rek.cabang || 'Kantor Pusat Syariah'}</p>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Aktif" />
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nomor Rekening
                </p>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white tracking-wider">
                    {rek.no_rekening}
                  </span>
                  <button
                    onClick={() => handleCopy(rek.id, rek.no_rekening)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-all cursor-pointer"
                    title="Salin Nomor Rekening"
                  >
                    {copiedId === rek.id ? (
                      <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Atas Nama Rekening
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {rek.atas_nama}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Rekening Resmi
              </span>
              <button
                onClick={() => handleCopy(rek.id, rek.no_rekening)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {copiedId === rek.id ? 'Tersalin!' : 'Salin Rekening'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
