import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  Coins,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  History,
  TrendingUp,
  ShieldCheck,
  Info,
  Plus
} from 'lucide-react';
import { HargaEmasHarian } from '../../types';
import { PriceChart, buildGoldChart } from '../ui/PriceChart';

interface AdminHargaEmasProps {
  onOpenInputHargaModal: () => void;
  onOpenEditHargaModal: (item: HargaEmasHarian) => void;
}

export const AdminHargaEmas: React.FC<AdminHargaEmasProps> = ({
  onOpenInputHargaModal,
  onOpenEditHargaModal
}) => {
  const {
    hargaEmas,
    activeHargaEmas,
    deleteHargaEmas,
    transaksi,
    showToast
  } = useApp();

  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '1Y'>('1W');

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const fmtMonth = (k: string) => new Date(k + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  const formatChartLabel = (d: string) => timeframe === '1Y' ? fmtMonth(d) : fmtDate(d);

  const { points: chartData } = buildGoldChart(hargaEmas, timeframe);
  const n = chartData.length;
  const labelTicks = chartData.length <= 4
    ? chartData.map((p, i) => ({ d: p.label, pct: n > 1 ? i / (n - 1) : 0 }))
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map(i => ({ d: chartData[i].label, pct: n > 1 ? i / (n - 1) : 0 }));

  const handleDelete = (id: number) => {
    const res = deleteHargaEmas(id);
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
            <Coins className="w-6 h-6 text-amber-500" />
            <span>Manajemen Harga Emas Harian (Append-Only)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi harga acuan per gram harian. Setiap update tersimpan sebagai versi baru untuk menjaga integritas transaksi masa lampau.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenInputHargaModal}
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Input Harga Baru</span>
          </button>
        </div>
      </div>

      {/* Active Gold Price Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-amber-500/10 via-orange-400/5 to-amber-500/10 dark:from-amber-950/40 dark:via-slate-800 dark:to-orange-950/20 border border-amber-300/60 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full">
            Harga Acuan Aktif Saat Ini
          </span>
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mt-3">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
              Rp {formatRupiah(activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000)}
            </span>
            <span className="text-base font-bold text-amber-600">/ gram</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tanggal Berlaku: <strong>{activeHargaEmas?.tanggal}</strong> • {activeHargaEmas?.catatan}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 max-w-xs text-xs text-slate-600 dark:text-slate-300 shadow-sm flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
<p>
              Harga diperbarui otomatis setiap hari dari web resmi Logam Mulia (Antam). Admin masih bisa input manual sebagai koreksi, dan perubahan akan otomatis menonaktifkan harga lama.
            </p>
        </div>
      </div>

      {/* Price History Chart with Hover Tracker */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Grafik Pergerakan Harga Emas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Arahkan kursor ke grafik untuk melacak harga per tanggal
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit">
            {(['1W', '1M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-40 w-full pt-4">
          <PriceChart
            key={timeframe}
            height={120}
            gradientId="adminPriceGrad"
            lineColor="#F59E0B"
            data={chartData}
            valueLabel=" /g"
            formatValue={(v) => `Rp ${formatRupiah(v)}`}
            formatLabel={formatChartLabel}
            emptyText="Belum ada data riwayat harga"
          />
          <div className="relative h-3.5 mt-2 text-[10px] text-slate-400">
            {labelTicks.map((t, i) => (
              <span
                key={t.d}
                className={"absolute top-0 whitespace-nowrap".concat(t.pct > 0 && t.pct < 1 ? ' hidden lg:block' : '')}
                style={{
                  left: `${t.pct * 100}%`,
                  transform: t.pct === 0 ? 'none' : t.pct === 1 ? 'translateX(-100%)' : 'translateX(-50%)'
                }}
              >
                {formatChartLabel(t.d)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Riwayat Versi Harga Emas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftar seluruh rekaman harga emas acuan koperasi
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Total {hargaEmas.length} Versi
          </span>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Harga per Gram</th>
                <th className="py-3 px-3">Tagihan Harian</th>
                <th className="py-3 px-3">Catatan / Keterangan</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...hargaEmas].reverse().slice(0, 15).map((item) => {
                const isUsedInTrx = transaksi.some((t) => t.harga_acuan_id === item.id);

                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {item.tanggal}
                    </td>

                    <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                      Rp {formatRupiah(item.harga_per_gram)}
                    </td>

                    <td className="py-3 px-3 text-slate-500">
                      Rp {formatRupiah(item.tagihan_harian_default || 50000)}
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {item.catatan || '-'}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.status_aktif
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {item.status_aktif ? 'Aktif' : 'Arsip'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenEditHargaModal(item)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Bikin Versi Baru"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isUsedInTrx}
                          className={`p-1.5 rounded-lg ${
                            isUsedInTrx
                              ? 'opacity-30 cursor-not-allowed text-slate-400 bg-slate-100 dark:bg-slate-800'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer'
                          }`}
                          title={isUsedInTrx ? 'Tidak dapat dihapus karena sudah dipakai transaksi' : 'Hapus Versi'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
