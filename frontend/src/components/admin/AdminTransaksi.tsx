import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  ReceiptText,
  Search,
  Filter,
  Eye,
  Check,
  X,
  FileImage,
  Coins,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import { Transaksi } from '../../types';

interface AdminTransaksiProps {
  onOpenCashModal: () => void;
  onOpenDetailTransaksi: (trx: Transaksi) => void;
  onOpenRejectModal: (trx: Transaksi) => void;
  onOpenExportModal: () => void;
}

export const AdminTransaksi: React.FC<AdminTransaksiProps> = ({
  onOpenCashModal,
  onOpenDetailTransaksi,
  onOpenRejectModal,
  onOpenExportModal
}) => {
  const {
    transaksi,
    searchQuery,
    verifikasiTransaksi
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMetode, setFilterMetode] = useState<string>('all');
  const [filterTipe, setFilterTipe] = useState<string>('all');

  const filteredTransactions = transaksi.filter((trx) => {
    const matchesSearch =
      trx.nomor_referensi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.jenis_tabungan_nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.nominal.toString().includes(searchQuery);

    const matchesStatus = filterStatus === 'all' || trx.status_verifikasi === filterStatus;
    const matchesMetode = filterMetode === 'all' || trx.metode_pembayaran === filterMetode;
    const matchesTipe = filterTipe === 'all' || trx.tipe_tabungan === filterTipe;

    return matchesSearch && matchesStatus && matchesMetode && matchesTipe;
  });

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
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Input Transaksi Cash</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="py-2.5 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer flex-shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Status</option>
          <option value="menunggu_verifikasi">Menunggu Verifikasi (Pending)</option>
          <option value="terverifikasi">Terverifikasi (Disetujui)</option>
          <option value="ditolak">Ditolak (Rejected)</option>
        </select>

        <select
          value={filterMetode}
          onChange={(e) => setFilterMetode(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Metode Pembayaran</option>
          <option value="transfer">Transfer Bank</option>
          <option value="cash">Tunai / Teller (Cash)</option>
        </select>

        <select
          value={filterTipe}
          onChange={(e) => setFilterTipe(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Produk Tabungan</option>
          <option value="emas">Tabungan Emas</option>
          <option value="pribadi">Tabungan Pribadi</option>
          <option value="qurban">Tabungan Qurban</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
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
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Tidak ada transaksi yang cocok.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Ref */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {trx.nomor_referensi}
                    </td>

                    {/* Nasabah */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {trx.user_name}
                      </div>
                      <span className="text-[10px] text-slate-400">User ID: #{trx.user_id}</span>
                    </td>

                    {/* Product */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {trx.jenis_tabungan_nama}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {trx.jenis_transaksi}
                      </span>
                    </td>

                    {/* Nominal */}
                    <td className="py-3 px-3">
                      <div className={`font-extrabold ${
                        trx.jenis_transaksi === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                      }`}>
                        {trx.jenis_transaksi === 'setor' ? '+' : '-'} Rp {formatRupiah(trx.nominal)}
                      </div>
                      {trx.unit_didapat && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          {trx.unit_didapat} gram
                        </span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        trx.metode_pembayaran === 'cash'
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {trx.metode_pembayaran}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-slate-500">
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

                    {/* Actions per row: Lihat Detail & Bukti, Verifikasi, Tolak */}
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
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
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
          </table>
        </div>
      </div>
    </div>
  );
};
