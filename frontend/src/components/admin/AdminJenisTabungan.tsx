import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Layers,
  Calendar,
  Settings
} from 'lucide-react';
import { JenisTabungan } from '../../types';

const DEFAULT_KODES = ['EMAS', 'tabungan-pribadi', 'tabungan-qurban', 'tabungan-hari-raya', 'tabungan-berjangka'];
const MAX_JENIS_TABUNGAN = 6;

interface AdminJenisTabunganProps {
  onOpenKelola: (item: JenisTabungan) => void;
}

export const AdminJenisTabungan: React.FC<AdminJenisTabunganProps> = ({
  onOpenKelola
}) => {
  const {
    jenisTabungan,
    toggleStatusJenisTabungan,
    updateJenisTabungan
  } = useApp();

  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<number, string>>({});

  const isDefault = (kode: string) => DEFAULT_KODES.includes(kode);
  const shortKode = (k: string) => k.replace(/^tabungan-/i, '');

  const handleSaveHariRayaDeadline = (item: JenisTabungan) => {
    const value = (deadlineDrafts[item.id] ?? item.deadline ?? '').trim();
    updateJenisTabungan(item.id, { deadline: value || null });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Manajemen Jenis Produk Tabungan</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {jenisTabungan.length}/{MAX_JENIS_TABUNGAN} produk — produk bawaan (Emas, Pribadi: Mandiri/Hari Raya/Qurban/Berjangka) terkunci dan tidak bisa dihapus
          </p>
        </div>
      </div>

      {/* Grid of Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {jenisTabungan.map((item) => {
          const def = isDefault(item.kode);

          return (
            <div
              key={item.id}
              className={`rounded-3xl p-6 bg-white dark:bg-slate-800/90 border shadow-sm transition-all flex flex-col justify-between ${
                item.status_aktif
                  ? 'border-slate-200/80 dark:border-slate-700/70 hover:border-emerald-500/40'
                  : 'border-slate-200/40 dark:border-slate-800/40 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {shortKode(item.kode)}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {item.tipe}
                    </span>
                  </div>

                  {/* Toggle Aktif */}
                  <button
                    type="button"
                    aria-pressed={item.status_aktif}
                    onClick={() => toggleStatusJenisTabungan(item.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 ease-in-out flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                      item.status_aktif ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={item.status_aktif ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${
                        item.status_aktif ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-3">
                  {item.nama}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.deskripsi || 'Tidak ada deskripsi tambahan.'}
                </p>

                {/* Configuration Details list */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Mode Perhitungan:</span>
                    <span className="font-semibold capitalize">{item.mode_perhitungan.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Izin Tarik Tunai:</span>
                    <span className={`font-bold ${item.allow_withdrawal ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {item.allow_withdrawal ? 'Diizinkan (Tarik Bebas)' : 'Tidak Diizinkan'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Aturan Pencairan:</span>
                    <span className="font-semibold capitalize">{item.aturan_pencairan.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Metode Bayar:</span>
                    <span className="font-semibold uppercase">{item.metode_pembayaran_diizinkan.join(', ')}</span>
                  </div>
                  {item.deadline && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Deadline (Berjangka):</span>
                      <span className="font-semibold">
                        {new Date(item.deadline + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {item.frekuensi_setoran && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Frekuensi Setoran:</span>
                      <span className="font-semibold capitalize">{item.frekuensi_setoran}</span>
                    </div>
                  )}
                </div>

                {item.sub_jenis === 'hari_raya' && (
                  <div className="mt-4">
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Tanggal Hari Raya (Pencairan)
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        Dana nasabah otomatis dapat dicairkan mulai 1 minggu sebelum tanggal ini.
                      </p>
                      <input
                        type="date"
                        value={deadlineDrafts[item.id] ?? item.deadline ?? ''}
                        onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveHariRayaDeadline(item)}
                      className="mt-2 w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                )}
              </div>

{/* Action per card */}
              <button
                onClick={() => onOpenKelola(item)}
                className="mt-6 w-full py-3 px-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-colors cursor-pointer"
                title="Kelola tabungan, rencana, setoran cash, dan penarikan produk ini"
              >
                <Settings className="w-4 h-4" /> Kelola Tabungan
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
