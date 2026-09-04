import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface UserTabunganPribadiProps {
  onOpenSetorPribadi: () => void;
  onOpenTarikPribadi: () => void;
}

export const UserTabunganPribadi: React.FC<UserTabunganPribadiProps> = ({
  onOpenSetorPribadi,
  onOpenTarikPribadi
}) => {
  const {
    userTransaksi,
    userTabunganPribadiTotal,
    jenisTabungan
  } = useApp();

  const pribadiConfig = jenisTabungan.find(j => j.tipe === 'pribadi');
  const pribadiTransactions = userTransaksi.filter(t => t.tipe_tabungan === 'pribadi');
  
  const totalSetor = pribadiTransactions
    .filter(t => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'setor')
    .reduce((acc, c) => acc + c.nominal, 0);

  const totalTarik = pribadiTransactions
    .filter(t => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'tarik')
    .reduce((acc, c) => acc + c.nominal, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-emerald-500/10 via-teal-400/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-slate-800 dark:to-teal-950/30 border border-emerald-300/40 dark:border-emerald-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Simpanan Sukarela Syariah (Wadi'ah)
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              Bebas Biaya Admin
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tabungan Pribadi Berkah
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Simpanan fleksibel dengan prinsip titipan amanah (Wadi'ah Yad Dhamanah). Setor kapan saja dan tarik saat dibutuhkan tanpa potongan biaya bulanan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSetorPribadi}
            className="py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Setor</span>
          </button>

          {pribadiConfig?.allow_withdrawal && (
            <button
              onClick={onOpenTarikPribadi}
              className="py-3 px-5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tarik</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Metric Cards: Saldo, Total Setor, Total Tarik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Tabungan Tersedia</span>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">
              Rp {formatRupiah(userTabunganPribadiTotal)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Siap ditarik kapan saja
          </p>
        </div>

        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Riwayat Setoran</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words">
              Rp {formatRupiah(totalSetor)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Akumulasi seluruh setoran disetujui</p>
        </div>

        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Riwayat Penarikan</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words">
              Rp {formatRupiah(totalTarik)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total dana yang telah dicairkan</p>
        </div>
      </div>

      {/* Mutasi Transaksi Tabungan Pribadi */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Mutasi Tabungan Pribadi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Riwayat setoran dan permohonan penarikan saldo simpanan
            </p>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            Total {pribadiTransactions.length} Mutasi
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {pribadiTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada mutasi transaksi tabungan pribadi.
            </div>
          ) : (
            pribadiTransactions.map((trx) => (
              <div key={trx.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    trx.jenis_transaksi === 'setor'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  }`}>
                    {trx.jenis_transaksi === 'setor' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {trx.jenis_transaksi === 'setor' ? 'Setoran Sukarela' : 'Penarikan Dana'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {trx.nomor_referensi}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{trx.tanggal_transaksi}</span>
                      <span>•</span>
                      <span className="capitalize">{trx.metode_pembayaran}</span>
                      {trx.catatan_user && <span>• Catatan: "{trx.catatan_user}"</span>}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <p className={`font-extrabold text-sm ${
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
                    {trx.status_verifikasi === 'terverifikasi' ? 'Terverifikasi' : trx.status_verifikasi === 'menunggu_verifikasi' ? 'Menunggu Verifikasi' : 'Ditolak'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
