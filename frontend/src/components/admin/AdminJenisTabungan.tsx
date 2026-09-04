import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Layers,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Coins,
  Wallet,
  Sparkles,
  Info,
  Lock,
  Plus
} from 'lucide-react';
import { JenisTabungan } from '../../types';

const DEFAULT_KODES = ['emas-harian', 'EMAS', 'tabungan-pribadi', 'tabungan-qurban'];
const MAX_JENIS_TABUNGAN = 6;

interface AdminJenisTabunganProps {
  onOpenCreateModal: () => void;
  onOpenEditModal: (item: JenisTabungan) => void;
}

export const AdminJenisTabungan: React.FC<AdminJenisTabunganProps> = ({
  onOpenCreateModal,
  onOpenEditModal
}) => {
  const {
    jenisTabungan,
    deleteJenisTabungan,
    toggleStatusJenisTabungan,
    transaksi,
    showToast
  } = useApp();

  const handleDelete = (id: number) => {
    const res = deleteJenisTabungan(id);
    if (!res.success) {
      showToast(res.message, 'error');
    }
  };

  const isDefault = (kode: string) => DEFAULT_KODES.includes(kode);
  const isMax = jenisTabungan.length >= MAX_JENIS_TABUNGAN;
  const shortKode = (k: string) => k.replace(/^tabungan-/i, '');

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
            {jenisTabungan.length}/{MAX_JENIS_TABUNGAN} produk — 3 tabungan bawaan (Emas, Pribadi, Qurban) terkunci dan tidak bisa dihapus
          </p>
        </div>

        <button
          onClick={() => {
            if (isMax) {
              showToast('Jumlah jenis tabungan sudah mencapai batas maksimal (6).', 'error');
              return;
            }
            onOpenCreateModal();
          }}
          className="py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jenis Tabungan</span>
        </button>
      </div>

      {/* Grid of Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {jenisTabungan.map((item) => {
          const hasTrx = transaksi.some((t) => t.jenis_tabungan_id === item.id);
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
                    {def && (
                      <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center gap-1" title="Tabungan bawaan, tidak bisa dihapus">
                        <Lock className="w-3 h-3" /> Bawaan
                      </span>
                    )}
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
                      item.status_aktif ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
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
                </div>
              </div>

              {/* Action buttons per card */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {hasTrx ? 'Ada transaksi aktif' : 'Belum ada transaksi'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEditModal(item)}
                    disabled={def}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                      def
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer'
                    }`}
                    title={def ? 'Tabungan bawaan (Emas/Pribadi/Qurban) sudah fix, settingan tidak bisa diubah' : 'Edit Produk'}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={hasTrx || def}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                      hasTrx || def
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 cursor-pointer'
                    }`}
                    title={def ? 'Tabungan bawaan tidak bisa dihapus' : hasTrx ? 'Produk tidak dapat dihapus karena memiliki riwayat transaksi (409)' : 'Hapus Produk'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
