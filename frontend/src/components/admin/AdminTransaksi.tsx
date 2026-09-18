import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { filterTransaksi, isoDate, todayISO } from '../../utils/rekapTransaksi';
import {
  ReceiptText,
  Eye,
  Check,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CalendarDays,
  CalendarRange,
  RotateCcw
} from 'lucide-react';
import { RekapPeriod, Transaksi, TransaksiFilters } from '../../types';

interface AdminTransaksiProps {
  onOpenCashModal: () => void;
  onOpenDetailTransaksi: (trx: Transaksi) => void;
  onOpenRejectModal: (trx: Transaksi) => void;
  onOpenExportModal: (filters?: TransaksiFilters) => void;
}

const PER_PAGE = 20;

const TIPE_LABEL: Record<string, string> = {
  emas: 'Tabungan Emas',
  pribadi: 'Tabungan Pribadi',
  qurban: 'Tabungan Qurban',
  gadai: 'Angsuran Gadai'
};

const STAT_LABEL: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak'
};

export const AdminTransaksi: React.FC<AdminTransaksiProps> = ({
  onOpenCashModal,
  onOpenDetailTransaksi,
  onOpenRejectModal,
  onOpenExportModal
}) => {
  const {
    transaksi,
    verifikasiTransaksi
  } = useApp();

  const [filters, setFilters] = useState<TransaksiFilters>({});
  const [aliran, setAliran] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [filters, aliran]);

  const set = (patch: Partial<TransaksiFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const today = todayISO();

  const applyQuickRange = (kind: 'hari-ini' | '7-hari' | '30-hari' | 'bulan-ini' | 'semua') => {
    if (kind === 'semua') {
      set({ tanggal_awal: undefined, tanggal_akhir: undefined });
      return;
    }
    if (kind === 'hari-ini') {
      set({ tanggal_awal: today, tanggal_akhir: today });
      return;
    }
    const start = new Date();
    if (kind === 'bulan-ini') {
      start.setDate(1);
    } else {
      start.setDate(start.getDate() - (kind === '7-hari' ? 6 : 29));
    }
    set({ tanggal_awal: isoDate(start), tanggal_akhir: today });
  };

  const filteredTransactions = useMemo(() => {
    return filterTransaksi(transaksi, filters);
  }, [transaksi, filters]);

  const verified = useMemo(
    () => filteredTransactions.filter((t) => t.status_verifikasi === 'terverifikasi'),
    [filteredTransactions]
  );

  const totalMasuk = useMemo(
    () => verified.filter((t) => t.jenis_transaksi === 'setor').reduce((a, t) => a + t.nominal, 0),
    [verified]
  );
  const totalKeluar = useMemo(
    () => verified.filter((t) => t.jenis_transaksi === 'tarik').reduce((a, t) => a + t.nominal, 0),
    [verified]
  );
  const pendingCount = useMemo(
    () => filteredTransactions.filter((t) => t.status_verifikasi === 'menunggu_verifikasi').length,
    [filteredTransactions]
  );

  const rekapTotal = useMemo(
    () => ({
      masuk: totalMasuk,
      keluar: totalKeluar,
      selisih: totalMasuk - totalKeluar,
      jumlah: filteredTransactions.length
    }),
    [totalMasuk, totalKeluar, filteredTransactions]
  );

  const rekapRows = useMemo(
    () => aliran === 'masuk'
      ? filteredTransactions.filter((t) => t.jenis_transaksi === 'setor')
      : aliran === 'keluar'
      ? filteredTransactions.filter((t) => t.jenis_transaksi === 'tarik')
      : filteredTransactions,
    [filteredTransactions, aliran]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rekapRows.length / PER_PAGE)),
    [rekapRows]
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return rekapRows.slice(start, start + PER_PAGE);
  }, [rekapRows, page]);

  const tipeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const t of transaksi) {
      const tipe = t.tipe_tabungan;
      if (!tipe || seen.has(tipe)) continue;
      seen.add(tipe);
      options.push({ value: tipe, label: TIPE_LABEL[tipe] || tipe });
    }
    return options;
  }, [transaksi]);

  const statCards = [
    {
      label: 'Uang Masuk',
      icon: ArrowDownLeft,
      value: totalMasuk,
      sub: `${verified.filter((t) => t.jenis_transaksi === 'setor').length} setoran`,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      label: 'Uang Keluar',
      icon: ArrowUpRight,
      value: totalKeluar,
      sub: `${verified.filter((t) => t.jenis_transaksi === 'tarik').length} penarikan`,
      iconBg: 'bg-rose-100 dark:bg-rose-950',
      textColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      label: 'Selisih Kas',
      icon: Wallet,
      value: totalMasuk - totalKeluar,
      sub: 'Masuk − Keluar (terverifikasi)',
      iconBg: 'bg-blue-100 dark:bg-blue-950',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Transaksi',
      icon: CalendarDays,
      value: filteredTransactions.length,
      sub: `${pendingCount} menunggu verifikasi`,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
      textColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  const quickRanges: { key: 'hari-ini' | '7-hari' | '30-hari' | 'bulan-ini' | 'semua'; label: string }[] = [
    { key: 'hari-ini', label: 'Hari Ini' },
    { key: '7-hari', label: '7 Hari' },
    { key: '30-hari', label: '30 Hari' },
    { key: 'bulan-ini', label: 'Bulan Ini' },
    { key: 'semua', label: 'Semua' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Transaksi & Verifikasi Setoran</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Verifikasi mutasi bukti transfer nasabah dan input setoran tunai teller langsung di kantor koperasi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCashModal}
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Input Transaksi Cash</span>
          </button>

          <button
            onClick={() => onOpenExportModal(filters)}
            className="py-2.5 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer flex-shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {card.label}
              </span>
              <span className={`p-2 rounded-xl ${card.iconBg}`}>
                <card.icon className={`w-4 h-4 ${card.textColor}`} />
              </span>
            </div>
            <div className={`mt-2 font-extrabold text-slate-900 dark:text-white truncate ${card.label === 'Transaksi' ? 'text-xl' : 'text-sm sm:text-lg'}`}>
              {card.label === 'Transaksi' ? card.value : `Rp ${formatRupiah(card.value)}`}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 -mt-4">
        Nilai uang masuk/keluar hanya menghitung transaksi berstatus terverifikasi.
      </p>

      {/* Filter Row */}
      <div className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-center gap-y-3 gap-x-4">
          {/* Periode quick buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              Periode
            </span>
            {quickRanges.map((q) => (
              <button
                key={q.key}
                onClick={() => applyQuickRange(q.key)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                  filters.tanggal_awal === undefined && q.key === 'semua'
                    ? 'bg-emerald-600 text-white'
                    : q.key !== 'semua' &&
                      filters.tanggal_awal !== undefined &&
                      filters.tanggal_awal === filters.tanggal_akhir &&
                      q.key === 'hari-ini'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                }`}
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={() => set({ tanggal_awal: undefined, tanggal_akhir: undefined })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              title="Reset tanggal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Separator vertical desktop */}
          <div className="hidden xl:block w-px h-8 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">Dari</span>
            <input
              type="date"
              value={filters.tanggal_awal ?? ''}
              max={filters.tanggal_akhir || undefined}
              onChange={(e) => set({ tanggal_awal: e.target.value || undefined })}
              className="w-full sm:w-[9.5rem] py-2 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            />
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">s/d</span>
            <input
              type="date"
              value={filters.tanggal_akhir ?? ''}
              min={filters.tanggal_awal || undefined}
              onChange={(e) => set({ tanggal_akhir: e.target.value || undefined })}
              className="w-full sm:w-[9.5rem] py-2 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            />
          </div>

          <div className="flex-none xl:flex-1" />

          {/* Status / Metode / Produk */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.status ?? 'all'}
              onChange={(e) => set({ status: e.target.value })}
              className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="menunggu_verifikasi">Menunggu Verifikasi (Pending)</option>
              <option value="terverifikasi">Terverifikasi (Disetujui)</option>
              <option value="ditolak">Ditolak (Rejected)</option>
            </select>

            <select
              value={filters.metode ?? 'all'}
              onChange={(e) => set({ metode: e.target.value })}
              className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            >
              <option value="all">Semua Metode Pembayaran</option>
              <option value="transfer">Transfer Bank</option>
              <option value="cash">Tunai / Teller (Cash)</option>
            </select>

            <select
              value={filters.tipe ?? 'all'}
              onChange={(e) => set({ tipe: e.target.value })}
              className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
            >
              <option value="all">Semua Produk Tabungan</option>
              {tipeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Transaksi */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-emerald-600" />
            Detail Transaksi
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
              {rekapRows.length}
            </span>
          </h2>
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 gap-1">
            {([
              { key: 'semua', label: 'Semua' },
              { key: 'masuk', label: 'Uang Masuk' },
              { key: 'keluar', label: 'Uang Keluar' }
            ] as const).map((a) => (
              <button
                key={a.key}
                onClick={() => setAliran(a.key)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  aliran === a.key
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-800">
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">No. Referensi</th>
                <th className="py-3 px-3">Nasabah</th>
                <th className="py-3 px-3">Produk</th>
                <th className="py-3 px-3">Nominal / Unit</th>
                <th className="py-3 px-3">Metode</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Tidak ada transaksi yang cocok.
                  </td>
                </tr>
              ) : (
                pageRows.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {trx.nomor_referensi}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{trx.user_name}</div>
                      <span className="text-[10px] text-slate-400">User ID: #{trx.user_id}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{trx.jenis_tabungan_nama}</div>
                      <span className="text-[10px] text-slate-400 capitalize">{trx.jenis_transaksi}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className={`font-extrabold ${trx.jenis_transaksi === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {trx.jenis_transaksi === 'setor' ? '+' : '-'} Rp {formatRupiah(trx.nominal)}
                      </div>
                      {trx.unit_didapat && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {trx.unit_didapat} gram
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        trx.metode_pembayaran === 'cash'
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {trx.metode_pembayaran}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{trx.tanggal_transaksi}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        trx.status_verifikasi === 'terverifikasi'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : trx.status_verifikasi === 'menunggu_verifikasi'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}>
                        {trx.status_verifikasi === 'terverifikasi' && <CheckCircle2 className="w-3 h-3" />}
                        {trx.status_verifikasi === 'menunggu_verifikasi' && <Clock className="w-3 h-3" />}
                        {trx.status_verifikasi === 'ditolak' && <XCircle className="w-3 h-3" />}
                        <span>{STAT_LABEL[trx.status_verifikasi] || trx.status_verifikasi.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetailTransaksi(trx)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Lihat Detail & Bukti Transfer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {trx.status_verifikasi === 'menunggu_verifikasi' && (
                          <>
                            <button
                              onClick={() => verifikasiTransaksi(trx.id)}
                              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                              title="Verifikasi Transaksi"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenRejectModal(trx)}
                              className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-300 transition-colors cursor-pointer"
                              title="Tolak Transaksi (Wajib Catatan)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rekapRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 sticky bottom-0">
                  <td colSpan={8} className="py-3 px-3">
                    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-right">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Uang Masuk</span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">+ Rp {formatRupiah(rekapTotal.masuk)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Uang Keluar</span>
                        <span className="font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap">− Rp {formatRupiah(rekapTotal.keluar)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Selisih</span>
                        <span className={`font-extrabold whitespace-nowrap ${rekapTotal.selisih >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                          Rp {formatRupiah(rekapTotal.selisih)}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {'<'} Prev
            </button>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Halaman {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next {'>'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};