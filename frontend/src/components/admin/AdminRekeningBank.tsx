import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Landmark,
  Edit,
  Trash2,
  Building2,
  ShieldCheck,
  CreditCard,
  Plus
} from 'lucide-react';
import { RekeningBank } from '../../types';

interface AdminRekeningBankProps {
  onOpenCreateModal: () => void;
  onOpenEditModal: (rek: RekeningBank) => void;
}

export const AdminRekeningBank: React.FC<AdminRekeningBankProps> = ({
  onOpenCreateModal,
  onOpenEditModal
}) => {
  const {
    rekeningBank,
    deleteRekeningBank,
    toggleStatusRekeningBank,
    transaksi,
    showToast
  } = useApp();

  const handleDelete = (id: number) => {
    const res = deleteRekeningBank(id);
    if (!res.success) {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Manajemen Rekening Bank Koperasi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola rekening bank tujuan transfer setoran nasabah, status keaktifan, dan data pemilik rekening
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rekening</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rekeningBank.map((rek) => {
          const hasTrx = transaksi.some((t) => t.rekening_bank_id === rek.id);

          return (
            <div
              key={rek.id}
              className={`rounded-3xl p-6 bg-white dark:bg-slate-800/90 border shadow-sm transition-all flex flex-col justify-between ${
                rek.status_aktif
                  ? 'border-slate-200/80 dark:border-slate-700/70 hover:border-emerald-500/40'
                  : 'border-slate-200/40 dark:border-slate-800/40 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-xs flex-shrink-0"
                      style={{ backgroundColor: rek.logo_color || '#10B981' }}
                    >
                      {rek.nama_bank.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-sm leading-snug text-slate-900 dark:text-white">
                        {rek.nama_bank}
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{rek.cabang || 'Kantor Pusat'}</p>
                    </div>
                  </div>

                  {/* Toggle Aktif */}
                  <button
                    type="button"
                    onClick={() => toggleStatusRekeningBank(rek.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer ${
                      rek.status_aktif ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={rek.status_aktif ? 'Nonaktifkan Rekening' : 'Aktifkan Rekening'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        rek.status_aktif ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Nomor Rekening</span>
                  <p className="font-mono text-lg font-extrabold text-slate-900 dark:text-white tracking-wider">
                    {rek.no_rekening}
                  </p>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Atas Nama</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{rek.atas_nama}</p>
                  </div>
                </div>
              </div>

              {/* Actions per card */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {rek.status_aktif ? 'Aktif Digunakan' : 'Nonaktif'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEditModal(rek)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(rek.id)}
                    disabled={hasTrx}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                      hasTrx
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 cursor-pointer'
                    }`}
                    title={hasTrx ? 'Rekening tidak dapat dihapus karena tercatat di riwayat transaksi' : 'Hapus Rekening'}
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
