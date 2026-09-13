import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  CheckCircle2,
  Coins,
  TrendingUp,
  ReceiptText,
  ArrowUpRight,
  Clock3,
  ChevronRight,
  Plus,
  Eye,
  Check,
  X,
  FileImage,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Transaksi } from '../../types';
import { authFileUrl } from '../../lib/api';
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
    gadai,
    tabunganBerjangka,
    pendaftaranQurban,
    verifikasiTransaksi,
    approveTabunganBerjangka,
    tolakTabunganBerjangka,
    verifikasiPembatalanBerjangka,
    verifikasiAngsuranGadai,
    tolakAngsuranGadai,
    approveGadai,
    lunasQurban,
    setActiveTab,
    activeHargaEmas,
    showToast
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

  const pendingTrx = transaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi');
  const verifiedTrx = transaksi.filter(t => t.status_verifikasi === 'terverifikasi');
  const verifiedTrxInRange = verifiedTrx.filter(t => inRange(t.tanggal_transaksi));
  const pendingTrxInRange = pendingTrx.filter(t => inRange(t.tanggal_transaksi));

  // Approval Center state
  const [approvalTab, setApprovalTab] = useState<'transaksi' | 'angsuran' | 'berjangka' | 'gadai' | 'qurban'>('transaksi');
  const [previewBuktiUrl, setPreviewBuktiUrl] = useState<string | null>(null);
  const [previewBuktiTitle, setPreviewBuktiTitle] = useState<string>('');
  const [rejectAngsuranId, setRejectAngsuranId] = useState<number | null>(null);
  const [rejectAngsuranCatatan, setRejectAngsuranCatatan] = useState('');
  const [rejectBerjangkaId, setRejectBerjangkaId] = useState<number | null>(null);

  // Approval Lists across all features
  const pendingAngsuranList = gadai.flatMap(g =>
    (g.angsuran || [])
      .filter(a => a.status_verifikasi === 'menunggu_verifikasi')
      .map(a => ({ ...a, gadaiParent: g }))
  );
  const pendingTabBerjangkaList = (tabunganBerjangka?.items ?? []).filter(t => t.status === 'menunggu_approval');
  const pendingPembatalanList = (tabunganBerjangka?.items ?? []).filter(t => t.status === 'pembatalan_diajukan');
  const pendingGadaiList = gadai.filter(g => g.status === 'diajukan');
  const pendingQurbanList = (pendaftaranQurban ?? []).filter(p => p.status === 'menunggu_verifikasi');

  const gadaiPengajuan = pendingGadaiList.length;
  const gadaiAktif = gadai.filter(g => ['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)).length;
  const angsuranGadaiPending = pendingAngsuranList.length;
  const tabBerjangkaPending = pendingTabBerjangkaList.length + pendingPembatalanList.length;
  const totalAllPending = pendingTrx.length + angsuranGadaiPending + tabBerjangkaPending + gadaiPengajuan + pendingQurbanList.length;

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
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
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

        {/* 2. Transaksi Pending & Terverifikasi */}
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

        {/* 3. Trx Pending */}
        <div
          onClick={() => setActiveTab('transaksi')}
          className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-amber-500/40 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock3 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              {pendingTrxInRange.length} Pending
            </span>
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trx Pending</span>
            <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingTrx.length}
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

      {/* Middle Row: Gold Deposit Growth & Unified Approval Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Growth Curve Card */}
        <div className="lg:col-span-6 rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
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

        {/* Unified Approval Center */}
        <div className="lg:col-span-6 rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header with Title and Total Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Pusat Persetujuan & Verifikasi
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  totalAllPending > 0
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 animate-pulse'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {totalAllPending} Menunggu
                </span>
              </div>
              <button
                onClick={() => {
                  if (approvalTab === 'transaksi') setActiveTab('transaksi');
                  else if (approvalTab === 'angsuran' || approvalTab === 'gadai') setActiveTab('gadai');
                  else if (approvalTab === 'berjangka') setActiveTab('tabungan');
                  else if (approvalTab === 'qurban') setActiveTab('qurban');
                }}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Kelola Modul</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Approval Sub-tabs Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
              <button
                onClick={() => setApprovalTab('transaksi')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  approvalTab === 'transaksi'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Transaksi</span>
                {pendingTrx.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    approvalTab === 'transaksi' ? 'bg-white text-emerald-700' : 'bg-blue-600 text-white'
                  }`}>
                    {pendingTrx.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setApprovalTab('angsuran')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  approvalTab === 'angsuran'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Angsuran Gadai</span>
                {angsuranGadaiPending > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    approvalTab === 'angsuran' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
                  }`}>
                    {angsuranGadaiPending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setApprovalTab('berjangka')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  approvalTab === 'berjangka'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Tab. Berjangka</span>
                {tabBerjangkaPending > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    approvalTab === 'berjangka' ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                  }`}>
                    {tabBerjangkaPending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setApprovalTab('gadai')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  approvalTab === 'gadai'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Gadai Baru</span>
                {gadaiPengajuan > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    approvalTab === 'gadai' ? 'bg-white text-sky-700' : 'bg-sky-600 text-white'
                  }`}>
                    {gadaiPengajuan}
                  </span>
                )}
              </button>

              <button
                onClick={() => setApprovalTab('qurban')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  approvalTab === 'qurban'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Qurban</span>
                {pendingQurbanList.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    approvalTab === 'qurban' ? 'bg-white text-teal-700' : 'bg-teal-600 text-white'
                  }`}>
                    {pendingQurbanList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Body Contents */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 my-2 max-h-56 overflow-y-auto pr-1">
              {/* 1. Transaksi */}
              {approvalTab === 'transaksi' && (
                pendingTrx.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    Semua transaksi tabungan telah selesai diverifikasi.
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
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
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
                )
              )}

              {/* 2. Angsuran Gadai */}
              {approvalTab === 'angsuran' && (
                pendingAngsuranList.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    Tidak ada pembayaran angsuran gadai yang menunggu verifikasi.
                  </p>
                ) : (
                  pendingAngsuranList.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {item.gadaiParent.user?.name || 'Nasabah'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            {item.gadaiParent.nomor_gadai}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Rp {formatRupiah(item.nominal)} • {item.metode_pembayaran || 'transfer'} ({item.tanggal_bayar})
                        </p>
                        {item.catatan && (
                          <p className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            "{item.catatan}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.bukti_transfer_path && (
                          <button
                            onClick={() => {
                              setPreviewBuktiTitle(`Bukti Angsuran Gadai - ${item.gadaiParent.nomor_gadai}`);
                              const path = (item as any).bukti_transfer_url || `/api/v1/admin/gadai/angsuran/${item.id}/bukti`;
                              authFileUrl(path)
                                .then(setPreviewBuktiUrl)
                                .catch(() => showToast('Gagal memuat bukti pembayaran.', 'error'));
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 hover:bg-blue-100 cursor-pointer"
                            title="Lihat Foto Bukti Pembayaran"
                          >
                            <FileImage className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => verifikasiAngsuranGadai(item.id)}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                          title="Verifikasi Angsuran"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setRejectAngsuranId(item.id);
                            setRejectAngsuranCatatan('');
                          }}
                          className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-pointer"
                          title="Tolak Angsuran"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* 3. Tabungan Berjangka */}
              {approvalTab === 'berjangka' && (
                pendingTabBerjangkaList.length === 0 && pendingPembatalanList.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    Tidak ada pengajuan tabungan berjangka yang menunggu approval.
                  </p>
                ) : (
                  <>
                    {pendingPembatalanList.map((item) => (
                      <div key={`pembatalan-${item.id}`} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {item.user?.name || 'Nasabah'}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              Pembatalan Diajukan
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Dana dikembalikan: Rp {formatRupiah(item.terkumpul ?? 0)} • Target: Rp {formatRupiah(item.target_nominal)}
                          </p>
                        </div>

                        <button
                          onClick={() => verifikasiPembatalanBerjangka(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Verifikasi Pembatalan & Kembalikan Dana"
                        >
                          <Check className="w-3.5 h-3.5" /> Kembalikan Dana
                        </button>
                      </div>
                    ))}
                    {pendingTabBerjangkaList.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {item.user?.name || 'Nasabah'}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                              {item.durasi_bulan} Bulan
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Target: Rp {formatRupiah(item.target_nominal)} • Setoran: Rp {formatRupiah(item.nominal_per_periode)}/{item.frekuensi_label || item.frekuensi_setor}
                          </p>
                          {item.catatan && (
                            <p className="text-[10px] text-slate-400 italic truncate max-w-xs">
                              "{item.catatan}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => approveTabunganBerjangka(item.id)}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            title="Setujui Tabungan Berjangka"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRejectBerjangkaId(item.id)}
                            className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-pointer"
                            title="Tolak Pengajuan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )
              )}

              {/* 4. Pengajuan Gadai Baru */}
              {approvalTab === 'gadai' && (
                pendingGadaiList.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    Tidak ada pengajuan gadai baru yang menunggu review.
                  </p>
                ) : (
                  pendingGadaiList.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {item.user?.name || 'Nasabah'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                            {item.nomor_gadai}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.jenis_emas} ({item.berat_gram}g) • Pinjaman: Rp {formatRupiah(item.besaran_gadai)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => approveGadai(item.id)}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                          title="Setujui & Salurkan Gadai (80% Taksiran)"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveTab('gadai')}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Buka Modul Gadai untuk Taksiran Custom"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* 5. Qurban */}
              {approvalTab === 'qurban' && (
                pendingQurbanList.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    Tidak ada pendaftaran qurban yang menunggu verifikasi pelunasan.
                  </p>
                ) : (
                  pendingQurbanList.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {item.user_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                            {item.jumlah_hewan}x Hewan
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Terkumpul: Rp {formatRupiah(item.total_terkumpul)} / Target: Rp {formatRupiah(item.target_dana)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => lunasQurban(item.id)}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                          title="Verifikasi Qurban Lunas"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveTab('qurban')}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer"
                          title="Buka Modul Qurban"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          <button
            onClick={onOpenCashModal}
            className="w-full mt-3 py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Input Transaksi Cash (Teller)</span>
          </button>
        </div>
      </div>

      {/* ─── Modal: Preview Bukti Angsuran Gadai ─── */}
      {previewBuktiUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileImage className="w-4 h-4 text-emerald-600" />
                <span>{previewBuktiTitle || 'Bukti Pembayaran'}</span>
              </h4>
              <button
                onClick={() => setPreviewBuktiUrl(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="my-4 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center max-h-96">
              <img
                src={previewBuktiUrl}
                alt="Bukti Transfer"
                className="max-h-96 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <a
                href={previewBuktiUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Tab Baru</span>
              </a>
              <button
                onClick={() => setPreviewBuktiUrl(null)}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Tolak Angsuran Gadai ─── */}
      {rejectAngsuranId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Tolak Pembayaran Angsuran</span>
              </h4>
              <button
                onClick={() => setRejectAngsuranId(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="my-4 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectAngsuranCatatan}
                onChange={(e) => setRejectAngsuranCatatan(e.target.value)}
                placeholder="Contoh: Bukti transfer tidak terbaca / nominal tidak sesuai."
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectAngsuranId(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!rejectAngsuranCatatan.trim()) {
                    showToast('Harap isi alasan penolakan.', 'error');
                    return;
                  }
                  tolakAngsuranGadai(rejectAngsuranId, rejectAngsuranCatatan);
                  setRejectAngsuranId(null);
                }}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Tolak Angsuran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Tolak Tabungan Berjangka ─── */}
      {rejectBerjangkaId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Tolak Pembuatan Tabungan?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pengajuan tabungan berjangka ini akan dibatalkan dan nasabah akan mendapat notifikasi.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button
                onClick={() => setRejectBerjangkaId(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  tolakTabunganBerjangka(rejectBerjangkaId);
                  setRejectBerjangkaId(null);
                }}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
