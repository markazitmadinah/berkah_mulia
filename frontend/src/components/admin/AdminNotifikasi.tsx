import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const AdminNotifikasi: React.FC = () => {
  const {
    currentUser,
    notifikasi,
    markNotifikasiRead,
    markAllNotifikasiRead,
    unreadNotifikasiCount
  } = useApp();

  const adminNotifs = notifikasi.filter(n => n.user_id === currentUser.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Notifikasi Sistem & Verifikasi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Peringatan transaksi baru masuk, permintaan registrasi anggota, dan log aktivitas operasional
          </p>
        </div>

        {unreadNotifikasiCount > 0 && (
          <button
            onClick={markAllNotifikasiRead}
            className="py-2 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tandai Semua Dibaca</span>
          </button>
        )}
      </div>

      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
        {adminNotifs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Belum ada notifikasi baru untuk admin.
          </div>
        ) : (
          adminNotifs.map((n) => (
            <div
              key={n.id}
              onClick={() => markNotifikasiRead(n.id)}
              className={`py-4 flex items-start justify-between gap-4 transition-all cursor-pointer ${
                n.dibaca_pada ? 'opacity-70' : 'bg-emerald-50/40 dark:bg-emerald-950/20 -mx-3 px-3 rounded-2xl'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  n.tipe === 'verifikasi'
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300'
                }`}>
                  {n.tipe === 'verifikasi' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {n.judul}
                    </h4>
                    {!n.dibaca_pada && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {n.pesan}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {n.created_at}
                  </span>
                </div>
              </div>

              {!n.dibaca_pada && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markNotifikasiRead(n.id);
                  }}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex-shrink-0 cursor-pointer"
                >
                  Tandai Dibaca
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
