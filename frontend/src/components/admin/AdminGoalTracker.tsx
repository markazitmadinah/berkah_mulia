import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { formatRupiah } from '../../utils/format';
import { Trophy, Target, RefreshCw, Users } from 'lucide-react';

interface GoalUser {
  user_id: number;
  user_name: string;
  user_email: string;
  saldo: number;
  target: number;
  persentase: number;
}

interface GoalProduct {
  jenis_tabungan_id: number;
  nama: string;
  kode: string;
  target_default: number;
  goal_boleh_ubah: boolean;
  users_achieved: GoalUser[];
  count: number;
}

export const AdminGoalTracker: React.FC = () => {
  const { showToast } = useApp();
  const [data, setData] = useState<GoalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = () => {
    setLoading(true);
    api
      .get<GoalProduct[]>('/admin/tabungan-custom/goal-tracker')
      .then((r) => setData(r.data))
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memuat data goal.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const shown = filter === 'all' ? data : data.filter((d) => d.jenis_tabungan_id === Number(filter));
  const totalPencapai = data.reduce((acc, d) => acc + d.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Goal Tracker
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Goal Tracker Tabungan</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pantau nasabah yang telah mencapai target tabungan custom mereka
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {/* Stat Ringkas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Trophy className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Pencapaian Goal</span>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-2">{totalPencapai} nasabah</p>
        </div>
        <div className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Users className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Produk Custom</span>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-2">{data.length} produk</p>
        </div>
      </div>

      {/* Filter Produk */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Produk Custom</option>
          {data.map((d) => (
            <option key={d.jenis_tabungan_id} value={d.jenis_tabungan_id}>
              {d.nama} ({d.count})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm text-center text-sm text-slate-500">
          Memuat data...
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm text-center">
          <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Belum ada data</p>
          <p className="text-xs text-slate-500 mt-1">
            Belum ada produk custom atau nasabah yang mencapai target.
          </p>
        </div>
      ) : (
        shown.map((prod) => (
          <div
            key={prod.jenis_tabungan_id}
            className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{prod.nama}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {prod.kode} · Target default Rp {formatRupiah(prod.target_default)}
                  {prod.goal_boleh_ubah ? ' · Target bisa diatur nasabah' : ''}
                </p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                {prod.count} nasabah mencapai goal
              </span>
            </div>

            {prod.count === 0 ? (
              <p className="text-xs text-slate-400">Belum ada nasabah yang mencapai target pada produk ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-4 font-bold">Nasabah</th>
                      <th className="py-2 pr-4 font-bold">Saldo</th>
                      <th className="py-2 pr-4 font-bold">Target</th>
                      <th className="py-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prod.users_achieved.map((u) => (
                      <tr key={u.user_id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                        <td className="py-2.5 pr-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{u.user_name}</p>
                          <p className="text-[11px] text-slate-500">{u.user_email}</p>
                        </td>
                        <td className="py-2.5 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Rp {formatRupiah(u.saldo)}
                        </td>
                        <td className="py-2.5 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Rp {formatRupiah(u.target)}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            Goal {u.persentase.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
