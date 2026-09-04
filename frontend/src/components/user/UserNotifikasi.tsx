import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Award
} from 'lucide-react';

export const UserNotifikasi: React.FC = () => {
  const {
    currentUser,
    notifikasi,
    markNotifikasiRead,
    markAllNotifikasiRead,
    unreadNotifikasiCount
  } = useApp();

  const userNotifs = notifikasi.filter(n => n.user_id === currentUser.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Pusat Notifikasi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Informasi status verifikasi setoran, perkembangan tabungan, dan update harga
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
        {userNotifs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Belum ada notifikasi untuk Anda.
          </div>
        ) : (
          userNotifs.map((n) => (
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
                    : n.tipe === 'pengingat_pencairan'
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                }`}>
                  {n.tipe === 'verifikasi' && <CheckCircle2 className="w-4 h-4" />}
                  {n.tipe === 'pengingat_pencairan' && <Award className="w-4 h-4" />}
                  {n.tipe !== 'verifikasi' && n.tipe !== 'pengingat_pencairan' && <Info className="w-4 h-4" />}
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
