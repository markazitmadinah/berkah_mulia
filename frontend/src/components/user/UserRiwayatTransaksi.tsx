import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  ReceiptText,
  Filter,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Eye,
  FileImage
} from 'lucide-react';
import { Transaksi } from '../../types';

interface UserRiwayatTransaksiProps {
  onOpenDetailTransaksi: (trx: Transaksi) => void;
  onOpenUploadBukti: (trx: Transaksi) => void;
}

export const UserRiwayatTransaksi: React.FC<UserRiwayatTransaksiProps> = ({
  onOpenDetailTransaksi,
  onOpenUploadBukti
}) => {
  const { userTransaksi, searchQuery } = useApp();

  const [filterTipe, setFilterTipe] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredTransactions = userTransaksi.filter((trx) => {
    const matchesSearch =
      trx.nomor_referensi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.jenis_tabungan_nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.nominal.toString().includes(searchQuery);

    const matchesTipe = filterTipe === 'all' || trx.tipe_tabungan === filterTipe;
    const matchesStatus = filterStatus === 'all' || trx.status_verifikasi === filterStatus;

    return matchesSearch && matchesTipe && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Riwayat Transaksi Saya</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Seluruh mutasi setoran dan penarikan tabungan emas, pribadi, serta qurban Anda
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tipe Filter */}
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm cursor-pointer"
          >
            <option value="all">Semua Produk Tabungan</option>
            <option value="emas">Tabungan Emas</option>
            <option value="pribadi">Tabungan Pribadi</option>
            <option value="qurban">Tabungan Qurban</option>
            <option value="custom">Tabungan Custom</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm cursor-pointer"
          >
            <option value="all">Semua Status Verifikasi</option>
            <option value="menunggu_verifikasi">Menunggu Verifikasi</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="ditolak">Ditolak</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">No. Referensi</th>
                <th className="py-3 px-3">Produk Tabungan</th>
                <th className="py-3 px-3">Nominal / Gram</th>
                <th className="py-3 px-3">Metode</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Tidak ada transaksi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Ref */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {trx.nomor_referensi}
                    </td>

                    {/* Product */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {trx.jenis_tabungan_nama}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {trx.jenis_transaksi}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3">
                      <div className={`font-extrabold ${
                        trx.jenis_transaksi === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                      }`}>
                        {trx.jenis_transaksi === 'setor' ? '+' : '-'} Rp {formatRupiah(trx.nominal)}
                      </div>
                      {trx.unit_didapat && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          ≈ {trx.unit_didapat} gram emas
                        </span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                        {trx.metode_pembayaran}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                      {trx.tanggal_transaksi}
                    </td>

                    {/* Status */}
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
                        <span className="capitalize">{trx.status_verifikasi.replace('_', ' ')}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetailTransaksi(trx)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {trx.status_verifikasi === 'menunggu_verifikasi' && (
                          <button
                            onClick={() => onOpenUploadBukti(trx)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                            title="Upload / Ganti Bukti Transfer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
