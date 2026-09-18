import React, { useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { useApp } from '../../context/AppContext';
import BorderGlow from '../ui/BorderGlow';
import { CountUp } from '../ui/CountUp';
import { PriceChart, buildGoldChart } from '../ui/PriceChart';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah } from '../../utils/format';
import { MARKUP_1_5_GRAM, hargaJualPerGram } from '../../utils/hargaJual';
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  Layers,
  Landmark,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

interface UserDashboardProps {
  onOpenSetorEmas: () => void;
  onOpenSetorPribadi: () => void;
  onOpenTarikPribadi: () => void;
  onOpenDaftarQurban?: () => void;
  onOpenSetorQurban?: (pendaftaranId?: number) => void;
  onOpenPribadiSub?: (sub: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onOpenSetorEmas,
  onOpenSetorPribadi,
  onOpenTarikPribadi,
  onOpenDaftarQurban,
  onOpenSetorQurban,
  onOpenPribadiSub
}) => {
  const {
    currentUser,
    userTransaksi,
    userPendaftaranQurban,
    userEmasGramTotal,
    userEmasTukarGramTotal,
    userEmasRupiahTotal,
    userTabunganPribadiTotal,
    userTabunganQurbanTotal,
    userTotalSaldo,
    userEmasGoal,
    activeHargaEmas,
    hargaEmas,
    periodeQurban,
    setActiveTab,
    setUserSubTab,
    showToast,
    refreshHargaEmas,
    theme
  } = useApp();

  const [timeframe, setTimeframe] = useState<'1W' | '1M' | '1Y'>('1W');
  const [showNomorAnggota, setShowNomorAnggota] = useState(true);
  const [refreshingHarga, setRefreshingHarga] = useState(false);
  const isDark = theme === 'dark';

  const handleRefreshHarga = async () => {
    if (refreshingHarga) return;
    setRefreshingHarga(true);
    try {
      await refreshHargaEmas();
      showToast('Harga emas diperbarui.');
    } catch {
      showToast('Gagal memperbarui harga emas.', 'error');
    } finally {
      setRefreshingHarga(false);
    }
  };

  const fmtNomorAnggota = (na: string) =>
    /^\d{10}$/.test(na) ? na.replace(/(\d{4})(?=\d)/g, '$1 ').trim() : na;

  // Garis horizontal background kartu, dihasilkan dari digit harga emas
  // (bukan random), agar menyesuaikan harga emas aktif.
  const goldLines = (price: number): { top: string; width: string; op: string }[] => {
    const seed = String(price).replace(/\D/g, '');
    return Array.from({ length: 14 }, (_, i) => {
      const d = Number(seed[(i * 5) % seed.length]) || 3;
      const width = 25 + ((d * 13 + i * 17) % 65);
      const op = (0.04 + (d % 4) / 28).toFixed(2);
      return { top: `${(i * 100) / 14 + (i % 3) * 1.5}%`, width: `${width}%`, op };
    });
  };

  // Pending transactions count
  const pendingUserTrx = userTransaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi');

  // Recent 4 transactions
  const recentTransactions = [...userTransaksi].slice(0, 4);

  // ─── Harga Emas riwayat → chart data (per timeframe) ────────
  // Harga jual (buyback) = harga_beli asli dari sync, fallback spread tetap bila belum tersedia
  const BUYBACK_SPREAD = 20000;
  const buybackPrice = activeHargaEmas?.harga_beli
    ?? (activeHargaEmas ? activeHargaEmas.harga_per_gram - BUYBACK_SPREAD : 1200000 - BUYBACK_SPREAD);
  const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const fmtMonth = (k: string) => new Date(k + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  const formatChartLabel = (d: string) => timeframe === '1Y' ? fmtMonth(d) : fmtDate(d);

  // Chart pakai harga jual (acuan + markup 1–5 gram) agar konsisten dengan Harga Emas Hari Ini
  const hargaJualHistory = hargaEmas.map(h => ({ ...h, harga_per_gram: h.harga_per_gram + MARKUP_1_5_GRAM }));
  const { points: chartPoints, basePrice } = buildGoldChart(hargaJualHistory, timeframe);

  const lastPrice = chartPoints[chartPoints.length - 1]?.value ?? null;
  const pctChange = basePrice && lastPrice ? ((lastPrice - basePrice) / basePrice) * 100 : null;
  const upside = (pctChange ?? 0) >= 0;
  const pctLabel = timeframe === '1W' ? 'pekan ini' : timeframe === '1M' ? 'bulan ini' : 'setahun ini';

  const n = chartPoints.length;

  const labelTicks = chartPoints.length <= 4
    ? chartPoints.map((p, i) => ({ d: p.label, pct: n > 1 ? i / (n - 1) : 0 }))
    : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].map(i => ({ d: chartPoints[i].label, pct: n > 1 ? i / (n - 1) : 0 }));

  const aktifPeriode = periodeQurban[0];
  const tahunPencairan = aktifPeriode?.tanggal_pencairan
    ? new Date(aktifPeriode.tanggal_pencairan).getFullYear()
    : new Date().getFullYear();

  const staggerWrap = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      className="space-y-6"
      variants={staggerWrap}
      initial="hidden"
      animate="show"
    >
      {/* Greeting Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
            <span>Assalamu'alaikum,</span>
            <span className="text-emerald-600 dark:text-emerald-400">{currentUser.name.split(' ')[0]}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Kelola portofolio simpanan syariah, tabungan emas, dan qurban Anda dengan amanah & transparan.
          </p>
        </div>

        {/* Pending Banner Alert if any */}
        {pendingUserTrx.length > 0 && (
          <div
            onClick={() => setActiveTab('transaksi-saya')}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 shadow-xs cursor-pointer hover:scale-[1.01] transition-transform"
          >
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {pendingUserTrx.length} Transaksi Menunggu Verifikasi
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                Klik untuk melihat status atau perbarui bukti
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400 ml-1" />
          </div>
        )}
      </motion.div>

      {/* Top 3 Cards Row (Gold Balance, Virtual Syariah Card, Quick Actions) */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* 1. Gold Balance Card */}
        <BorderGlow
          className="md:col-span-4 h-full"
          edgeSensitivity={34}
          glowColor="40 92 52"
          backgroundColor={isDark ? '#1e293b' : '#fffbeb'}
          borderRadius={24}
          glowRadius={20}
          glowIntensity={1.1}
          coneSpread={26}
          colors={isDark ? ['#fbbf24', '#f59e0b', '#b45309'] : ['#fcd34d', '#f59e0b', '#d97706']}
        >
          <div className="h-full p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-amber-100/60 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-amber-950/30 border border-amber-200/70 dark:border-amber-500/20 flex flex-col justify-between relative overflow-hidden group shine-sweep">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/10 dark:bg-amber-400/5 blur-xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Tabungan Emas
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                Antam 99.99%
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                  <CountUp value={userEmasGramTotal} decimals={2} />
                </span>
                <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">gram</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
                ≈ Rp <CountUp value={userEmasRupiahTotal} />
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={() => {
                if (userEmasGoal == null) {
                  showToast('Set target tabungan emas dahulu untuk melakukan setoran emas.', 'error');
                  return;
                }
                onOpenSetorEmas();
              }}
              className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Setor Emas</span>
            </button>
            <button
              onClick={() => setActiveTab('emas')}
              className="py-2 px-3 rounded-xl bg-white/90 dark:bg-slate-700/80 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Riwayat</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          </div>
        </BorderGlow>

        {/* 2. Virtual Syariah Membership Card */}
        <BorderGlow
          className="md:col-span-5 h-full"
          edgeSensitivity={26}
          glowColor="160 84 40"
          backgroundColor="#0f172a"
          borderRadius={24}
          glowRadius={28}
          glowIntensity={1.25}
          coneSpread={28}
          colors={['#34d399', '#2dd4bf', '#10b981']}
        >
          <div className="h-full p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-emerald-950/80 text-white border border-slate-700/50 flex flex-col justify-between relative overflow-hidden shine-sweep">
          {/* Garis horizontal background — mengikuti harga emas aktif */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {goldLines(activeHargaEmas?.harga_per_gram || 1200000).map((b, i) => (
              <div
                key={i}
                className="absolute left-0 h-px sm:h-[2px] rounded-full bg-emerald-300"
                style={{ top: b.top, width: b.width, opacity: b.op }}
              />
            ))}
          </div>
          {/* Card overlay shine */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-extrabold tracking-widest text-emerald-400 uppercase">
                BERKAH MULIA
              </span>
            </div>
          </div>

          <div className="my-5 sm:my-6 z-10">
            {currentUser.nomor_anggota && (
              <>
                <p className="text-[9px] font-mono tracking-widest text-emerald-400/90">NO. ANGGOTA</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-base sm:text-xl font-mono font-bold tracking-widest text-white">
                    {showNomorAnggota ? fmtNomorAnggota(currentUser.nomor_anggota) : '•••• •••• ••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNomorAnggota(v => !v)}
                    className="inline-flex items-center justify-center cursor-pointer text-emerald-300 hover:text-emerald-100 transition-colors"
                    aria-label={showNomorAnggota ? 'Sembunyikan nomor anggota' : 'Tampilkan nomor anggota'}
                    title={showNomorAnggota ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showNomorAnggota ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
            {currentUser.created_at && (
              <p className="mt-1 text-[9px] font-mono tracking-widest text-slate-400/90">
                BERGABUNG&nbsp;{new Date(currentUser.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between text-xs z-10">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Nama Anggota</p>
              <p className="font-bold text-slate-100 uppercase tracking-wide truncate max-w-[150px]">{currentUser.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-slate-400">Total Portofolio</p>
              <p className="font-extrabold text-emerald-400 text-xs sm:text-sm">Rp <CountUp value={userTotalSaldo} /></p>
              <p className="text-[10px] font-bold text-amber-400/90 mt-0.5">
                Emas ditukar: <CountUp value={userEmasTukarGramTotal} decimals={2} />g
              </p>
            </div>
          </div>
          </div>
        </BorderGlow>

        {/* 3. Quick Actions Pills */}
        <BorderGlow
          className="md:col-span-3 h-full"
          edgeSensitivity={34}
          glowColor="160 84 40"
          backgroundColor={isDark ? '#1e293b' : '#ffffff'}
          borderRadius={24}
          glowRadius={18}
          glowIntensity={1.1}
          coneSpread={24}
          colors={['#34d399', '#22d3ee', '#10b981']}
        >
          <div className="h-full p-5 sm:p-6 rounded-3xl bg-white/80 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Aksi Cepat
            </h3>
            <span className="text-[10px] text-slate-400">Transaksi</span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-2">
            <button
              onClick={onOpenSetorPribadi}
              className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                Setor Pribadi
              </span>
            </button>

            <button
              onClick={onOpenTarikPribadi}
              className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/40 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                Tarik Tunai
              </span>
            </button>
          </div>

          <button
            onClick={() => setActiveTab('pribadi')}
            className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <span>Lihat Detail Portofolio</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          </div>
        </BorderGlow>
      </motion.div>

      {/* Middle Row: Gold Market Insight Chart & Product Progress Overview */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Market Insight Vector Card */}
        <div className="lg:col-span-7 rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Pergerakan Harga Emas Syariah
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acuan kurs fisik LM Antam terverifikasi hari ini
              </p>
            </div>

            {/* Actions: refresh + harga lengkap */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshHarga}
                title="Perbarui harga (harga bisa berubah setiap jam)"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingHarga ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setActiveTab('harga-hari-ini')}
                title="Lihat daftar harga lengkap 0,5gr–25gr"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer"
              >
                Harga Lengkap <ArrowRight className="w-3 h-3" />
              </button>

              {/* Timeframe Pills */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit">
                {(['1W', '1M', '1Y'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      timeframe === tf
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Prices Buy & Sell */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4">
            <div className="flex items-center justify-between sm:block gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Jual Emas (per gram)</p>
              <div className="flex items-baseline gap-1 sm:mt-1">
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                  Rp <CountUp value={hargaJualPerGram(activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000, 0)} />
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">/g</span>
              </div>
              {pctChange !== null && (
                <span className={`hidden sm:flex text-[11px] font-bold items-center gap-1 mt-0.5 ${upside ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {upside ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />} {upside ? '+' : ''}{pctChange.toFixed(1)}% {pctLabel}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:block gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Jual (Buyback)</p>
              <div className="flex items-baseline gap-1 sm:mt-1">
                <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                  Rp <CountUp value={buybackPrice} />
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">/g</span>
              </div>
              <span className="hidden sm:block text-[11px] font-semibold text-slate-400 mt-0.5">
                Spread likuiditas syariah transparan
              </span>
            </div>
          </div>

          {/* Smooth Wave Price Chart + Hover Tracker */}
          <div className="flex-1 w-full pt-2 flex flex-col">
            <div className="relative flex-1 w-full min-h-28">
              <PriceChart
                key={timeframe}
                height={100}
                fillHeight
                gradientId="userPriceGrad"
                data={chartPoints}
                valueLabel=" /g"
                formatValue={(v) => `Rp ${formatRupiah(v)}`}
                formatLabel={formatChartLabel}
                emptyText="Belum ada data riwayat harga"
              />
            </div>
            <div className="relative h-3.5 mt-2 text-[10px] text-slate-400">
              {labelTicks.length === 0 ? (
                <span className="absolute inset-x-0 text-center">Belum ada data riwayat harga</span>
              ) : labelTicks.map((t, i) => (
                <span
                  key={t.d}
                  className={"absolute top-0 whitespace-nowrap".concat(t.pct > 0 && t.pct < 1 ? ' hidden lg:block' : '')}
                  style={{
                    left: `${t.pct * 100}%`,
                    transform: t.pct === 0 ? 'none' : t.pct === 1 ? 'translateX(-100%)' : 'translateX(-50%)'
                  }}
                >
                  {formatChartLabel(t.d)}{i === labelTicks.length - 1 && (t.d === localToday() ? ' (Hari Ini)' : ' (Terbaru)')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabungan Pribadi & Qurban Progress Cards */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Tabungan Pribadi Box */}
          <div
            onClick={() => onOpenPribadiSub?.('mandiri') ?? setActiveTab('pribadi')}
            className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs hover:border-emerald-500/40 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Tabungan Pribadi</h4>
                  <p className="text-[11px] text-slate-400">Simpanan Sukarela Tanpa Biaya Admin</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Saldo Tersedia</p>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  Rp <CountUp value={userTabunganPribadiTotal} />
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl">
                Bisa Ditarik
              </span>
            </div>
          </div>

          {/* Tabungan Qurban Box */}
          <div
            onClick={() => onOpenPribadiSub?.('qurban') ?? setActiveTab('qurban')}
            className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs hover:border-emerald-500/40 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <QurbanIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{aktifPeriode?.nama_periode || 'Tabungan Qurban'}</h4>
                  <p className="text-[11px] text-slate-400">Pencairan Ibadah Idul Adha {tahunPencairan}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {userPendaftaranQurban.length > 0 ? (
              <div className="mt-3">
                {userPendaftaranQurban.map((pq) => {
                  const percent = pq.target_dana > 0
                    ? Math.min(100, Math.round((pq.total_terkumpul / pq.target_dana) * 100))
                    : 0;
                  return (
                    <div key={pq.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-200">
                          Terkumpul: Rp <CountUp value={pq.total_terkumpul} />
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">{percent}%</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Target: Rp {formatRupiah(pq.target_dana)}</span>
                        <span className="capitalize font-semibold text-emerald-600 dark:text-emerald-400">
                          {pq.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 text-center py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada pendaftaran qurban aktif.</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDaftarQurban) {
                      onOpenDaftarQurban();
                    } else {
                      setActiveTab('qurban');
                      setUserSubTab('periode-aktif');
                    }
                  }}
                  className="mt-1 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  + Daftar Hewan Qurban Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Bottom Row: Recent Transactions Table */}
      <motion.div
        variants={fadeUp}
        className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Riwayat Transaksi Terkini
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftar mutasi setoran dan penarikan tabungan Anda
            </p>
          </div>
          <button
            onClick={() => setActiveTab('transaksi-saya')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua ({userTransaksi.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 mt-2">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Belum ada transaksi. Silakan setor tabungan pertama Anda.
            </div>
          ) : (
            recentTransactions.map((trx) => (
              <div key={trx.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    trx.jenis_transaksi === 'setor'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  }`}>
                    {trx.jenis_transaksi === 'setor' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs md:text-sm text-slate-900 dark:text-white">
                        {trx.jenis_tabungan_nama}
                      </span>
                      {trx.unit_didapat && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                          {trx.unit_didapat} g
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="font-mono">{trx.nomor_referensi}</span>
                      <span>•</span>
                      <span>{trx.tanggal_transaksi}</span>
                      <span>•</span>
                      <span className="capitalize">{trx.metode_pembayaran}</span>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <p className={`font-extrabold text-xs md:text-sm ${
                    trx.jenis_transaksi === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {trx.jenis_transaksi === 'setor' ? '+' : '-'} Rp {formatRupiah(trx.nominal)}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                    trx.status_verifikasi === 'terverifikasi'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : trx.status_verifikasi === 'menunggu_verifikasi'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {trx.status_verifikasi === 'terverifikasi' ? 'Terverifikasi' : trx.status_verifikasi === 'menunggu_verifikasi' ? 'Menunggu' : 'Ditolak'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
    </MotionConfig>
  );
};
