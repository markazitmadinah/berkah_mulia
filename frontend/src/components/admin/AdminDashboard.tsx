import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Clock,
  CheckCircle2,
  Coins,
  TrendingUp,
  ReceiptText,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Plus,
  Eye,
  Check,
  X
} from 'lucide-react';
import { Transaksi } from '../../types';
import { PriceChart } from '../ui/PriceChart';
import { formatRupiah } from '../../utils/format';

interface AdminDashboardProps {
  onOpenCashModal: () => void;
  onOpenDetailTransaksi: (trx: Transaksi) => void;
  onOpenRejectModal: (trx: Transaksi) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenCashModal,
  onOpenDetailTransaksi,
  onOpenRejectModal
}) => {
  const {
    users,
    transaksi,
    verifikasiTransaksi,
    setActiveTab,
    activeHargaEmas
  } = useApp();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [chartRange, setChartRange] = useState<'1W' | '1M' | '1Y'>('1M');

  const rangeStart = (() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': now.setHours(0, 0, 0, 0); break;
      case 'week': now.setDate(now.getDate() - 6); now.setHours(0, 0, 0, 0); break;
      case 'month': now.setDate(now.getDate() - 30); now.setHours(0, 0, 0, 0); break;
      case 'year': now.setMonth(0, 1); now.setHours(0, 0, 0, 0); break;
    }
    return now.getTime();
  })();
  const inRange = (tanggal: string) => {
    if (!tanggal) return false;
    const [y, m, d] = tanggal.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).getTime() >= rangeStart;
  };

  // KPI Calculations
  const activeUsersCount = users.filter(u => u.status === 'active' && u.role === 'user').length;
  const newUsersInRange = users.filter(u => u.role === 'user' && u.created_at && inRange(u.created_at.slice(0, 10))).length;
  const pendingUsersCount = users.filter(u => u.status === 'pending').length;

  const pendingTrx = transaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi');
  const verifiedTrx = transaksi.filter(t => t.status_verifikasi === 'terverifikasi');
  const verifiedTrxInRange = verifiedTrx.filter(t => inRange(t.tanggal_transaksi));
  const pendingTrxInRange = pendingTrx.filter(t => inRange(t.tanggal_transaksi));

  const totalVerifiedSetoranNominal = verifiedTrxInRange
    .filter(t => t.jenis_transaksi === 'setor')
    .reduce((acc, c) => acc + c.nominal, 0);

  // Real gold growth chart (grams verified from gold deposits per day), range-selectable
  const days = chartRange === '1W' ? 7 : chartRange === '1M' ? 30 : 365;
  const today = new Date();
  const chartByDay = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, grams: 0 };
  });
  verifiedTrx
    .filter(t => t.jenis_transaksi === 'setor' && t.unit_didapat)
    .forEach(t => {
      const slot = chartByDay.find(s => s.key === t.tanggal_transaksi);
      if (slot) slot.grams += t.unit_didapat || 0;
    });
  let chartData = chartByDay.reverse();
  if (chartRange === '1Y') {
    const byMonth = new Map<string, number>();
    chartData.forEach(d => { const k = d.key.slice(0, 7); byMonth.set(k, (byMonth.get(k) || 0) + d.grams); });
    chartData = Array.from(byMonth, ([key, grams]) => ({ key, grams })).sort((a, b) => a.key.localeCompare(b.key));
  } else {
    // hanya tampilkan hari yang punya transaksi (hari signifikan), bukan semua hari kosong
    chartData = chartData.filter(d => d.grams > 0);
  }

  const totalGrams = chartData.reduce((a, d) => a + d.grams, 0).toFixed(1);
  const chartTitle = chartRange === '1W' ? '7 Hari' : chartRange === '1M' ? '30 Hari' : '1 Tahun (bulanan)';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header with Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau ringkasan KPI ekosistem koperasi simpan pinjam syariah dan verifikasi transaksi hari ini.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {(['today', 'week', 'month', 'year'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  dateRange === r
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Nasabah Aktif */}
        <div
          onClick={() => setActiveTab('users')}
          className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> +{newUsersInRange} baru
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nasabah Aktif</span>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {activeUsersCount}
            </p>
          </div>
        </div>

        {/* 2. Nasabah Pending */}
        <div
          onClick={() => setActiveTab('users')}
          className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-amber-500/40 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              Perlu Review
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nasabah Pending</span>
            <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingUsersCount}
            </p>
          </div>
        </div>

        {/* 3. Transaksi Pending & Terverifikasi */}
        <div
          onClick={() => setActiveTab('transaksi')}
          className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-blue-500/40 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ReceiptText className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              {pendingTrxInRange.length} Pending
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trx Terverifikasi</span>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {verifiedTrxInRange.length}
            </p>
          </div>
        </div>

        {/* 4. Total Setoran Terverifikasi */}
        <div
          onClick={() => setActiveTab('transaksi')}
          className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400">Total Akumulasi</span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Setoran Masuk</span>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              Rp {formatRupiah(totalVerifiedSetoranNominal)}
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Gold Deposit Growth & Pending Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Growth Curve Card */}
        <div className="lg:col-span-7 rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Pertumbuhan Setoran Emas ({chartTitle})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grafik total gram fisik emas yang masuk ke simpanan koperasi
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-bold">
              {(['1W', '1M', '1Y'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartRange(tf)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartRange === tf
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <span className="px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
                {totalGrams}g
              </span>
            </div>
          </div>

          <div className="relative h-44 w-full pt-4">
            <PriceChart
              height={100}
              gradientId="adminGrowthGrad"
              data={chartData.map(d => ({ label: d.key, value: d.grams }))}
              formatValue={(v) => `${v.toLocaleString('id-ID')} g`}
              formatLabel={(d) => chartRange === '1Y'
                ? new Date(d + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                : new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              emptyText="Belum ada setoran emas terverifikasi"
            />
            <div className="flex justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>{chartData.length ? (chartRange === '1Y'
                ? new Date(chartData[0].key + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                : new Date(chartData[0].key + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              ) : ''}</span>
              <span>{chartData.length ? (chartRange === '1Y'
                ? new Date(chartData[Math.floor(chartData.length / 2)].key + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                : new Date(chartData[Math.floor(chartData.length / 2)].key + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              ) : ''}</span>
              <span>{chartData.length ? (chartRange === '1Y'
                ? new Date(chartData[chartData.length - 1].key + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
                : new Date(chartData[chartData.length - 1].key + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              ) : ''}</span>
            </div>
          </div>
        </div>

        {/* Pending Verification Quick Queue */}
        <div className="lg:col-span-5 rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Antrean Verifikasi Transaksi
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {pendingTrx.length}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('transaksi')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 my-2 max-h-56 overflow-y-auto">
            {pendingTrx.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                Semua transaksi telah selesai diverifikasi.
              </p>
            ) : (
              pendingTrx.map((trx) => (
                <div key={trx.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {trx.user_name}
                      </span>
                      {trx.unit_didapat && (
                        <span className="text-[10px] font-bold text-amber-600">
                          {trx.unit_didapat}g
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rp {formatRupiah(trx.nominal)} • {trx.jenis_tabungan_nama}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenDetailTransaksi(trx)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer"
                      title="Lihat Detail & Bukti"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => verifikasiTransaksi(trx.id)}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      title="Verifikasi Transaksi"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenRejectModal(trx)}
                      className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-pointer"
                      title="Tolak Transaksi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={onOpenCashModal}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Input Transaksi Cash (Teller)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
