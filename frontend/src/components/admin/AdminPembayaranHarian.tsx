import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  XCircle,
  CircleDashed,
  Banknote,
  Search,
  RefreshCw,
  BadgeCheck
} from 'lucide-react';
import { PembayaranHarianItem } from '../../types';

interface AdminPembayaranHarianProps {
  onOpenCash: (userId: number, jenisTabunganId: number) => void;
  refreshKey?: number;
}

const statusConfig: Record<string, { icon: React.ReactNode; box: string; text: string }> = {
  terverifikasi: {
    box: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  menunggu_verifikasi: {
    box: 'bg-amber-500 text-white shadow-md shadow-amber-500/30',
    text: 'text-amber-600 dark:text-amber-300',
    icon: <Clock3 className="w-5 h-5" />,
  },
  ditolak: {
    box: 'bg-rose-500 text-white shadow-md shadow-rose-500/30',
    text: 'text-rose-600 dark:text-rose-300',
    icon: <XCircle className="w-5 h-5" />,
  },
  belum: {
    box: 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-400',
    text: 'text-slate-400',
    icon: <CircleDashed className="w-5 h-5" />,
  },
};

const statusLabel: Record<string, string> = {
  terverifikasi: 'Lunas',
  menunggu_verifikasi: 'Menunggu Verifikasi',
  ditolak: 'Ditolak',
  belum: 'Belum Bayar',
};

export const AdminPembayaranHarian: React.FC<AdminPembayaranHarianProps> = ({ onOpenCash, refreshKey }) => {
  const { pembayaranHarian, fetchPembayaranHarian, clearPembayaranHarian, loading, verifikasiTransaksi } = useApp();
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPembayaranHarian(tanggal);
    return () => clearPembayaranHarian();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, refreshKey]);

  const filtered = useMemo(() => {
    if (!pembayaranHarian) return [];
    const q = search.toLowerCase();
    return pembayaranHarian.jadwal.filter(
      (j) => !q || j.nama?.toLowerCase().includes(q) || (j.nomor_anggota || '').toLowerCase().includes(q)
    );
  }, [pembayaranHarian, search]);

  const summary = useMemo(() => {
    const jadwal = pembayaranHarian?.jadwal ?? [];
    return {
      total: jadwal.length,
      lunas: jadwal.filter((j) => j.status_verifikasi === 'terverifikasi').length,
      menunggu: jadwal.filter((j) => j.status_verifikasi === 'menunggu_verifikasi').length,
      belum: jadwal.filter((j) => j.status_verifikasi === 'belum' || j.status_verifikasi === 'ditolak').length,
    };
  }, [pembayaranHarian]);

  const renderStatus = (item: PembayaranHarianItem) => {
    const cfg = statusConfig[item.status_verifikasi];
    return (
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.box}`}>
          {cfg.icon}
        </span>
        <div className="min-w-0">
          <p className={`text-xs font-extrabold ${cfg.text}`}>{statusLabel[item.status_verifikasi]}</p>
          {item.nomor_referensi ? (
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {item.nomor_referensi} {item.nominal != null ? `· Rp ${formatRupiah(item.nominal)}` : ''}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 capitalize">{item.metode_pembayaran || '—'}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-amber-500" />
            Pembayaran Harian
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Jadwal setoran berkala (harian/mingguan/bulanan) yang jatuh tempo di tanggal dipilih. Centang otomatis saat terverifikasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={tanggal}
            onChange={(e) => e.target.value && setTanggal(e.target.value)}
            className="py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <button
            onClick={() => fetchPembayaranHarian(tanggal)}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Muat ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="px-4 py-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Total Jadwal</p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{summary.total}</p>
        </div>
        <div className="px-4 py-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 uppercase">Sudah Bayar</p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 mt-1">{summary.lunas}</p>
        </div>
        <div className="px-4 py-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-300 uppercase">Menunggu Verifikasi</p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-1">{summary.menunggu}</p>
        </div>
        <div className="px-4 py-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Belum Bayar</p>
          <p className="text-2xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">{summary.belum}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama / nomor anggota…"
          className="w-full sm:w-72 py-2.5 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
      </div>

      {loading && !pembayaranHarian ? (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 mt-3">Memuat pembayaran harian…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <CalendarCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            Tidak ada jadwal setoran berkala yang jatuh pada tanggal ini.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtered.map((item) => {
            const bayar = item.status_verifikasi === 'belum' || item.status_verifikasi === 'ditolak';
            const verifBerkala =
              item.status_verifikasi === 'menunggu_verifikasi' &&
              item.transaksi_id != null;

            const handleVerifikasi = () => {
              if (!item.transaksi_id) return;
              verifikasiTransaksi(item.transaksi_id);
              fetchPembayaranHarian(tanggal);
            };

            return (
              <div
                key={item.konfigurasi_id}
                className="rounded-3xl px-5 py-4 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 hover:border-amber-200 dark:hover:border-amber-800 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-[220px]">
                  {renderStatus(item)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{item.nama}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${
                        item.frekuensi === 'harian'
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                          : item.frekuensi === 'mingguan'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300'
                          : 'bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300'
                      }`}>
                        {item.frekuensi_label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{item.nomor_anggota || '-'}</p>
                  </div>
                </div>

                <div className="hidden md:flex flex-col min-w-[160px]">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Produk</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{item.jenis_tabungan_nama || '-'}</p>
                  <p className="text-[10px] text-slate-400">{item.jadwal_label || item.frekuensi_label}</p>
                </div>

                <div className="hidden md:flex flex-col min-w-[140px]">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Setoran / Periode</p>
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Rp {formatRupiah(item.nominal_per_periode)}</p>
                  <p className="text-[10px] text-slate-400">
                    Target {item.target_gram_per_periode} gram emas
                  </p>
                </div>

                {verifBerkala ? (
                  <button
                    onClick={handleVerifikasi}
                    className="py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/25 transition-colors cursor-pointer"
                    title="Verifikasi bukti transfer yang dikirim via aplikasi"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verifikasi Bukti
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenCash(item.user_id, item.jenis_tabungan_id)}
                    disabled={!bayar}
                    className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      bayar
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                    title={bayar ? 'Catat pembayaran tunai (otomatis terverifikasi)' : 'Sudah dibayar'}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    {bayar ? 'Catat Tunai' : 'Selesai'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};