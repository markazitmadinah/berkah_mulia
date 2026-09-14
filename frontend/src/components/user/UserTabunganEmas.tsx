import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  Trophy
} from 'lucide-react';
import { RencanaTabunganEmas } from './RencanaTabunganEmas';

interface UserTabunganEmasProps {
  onOpenSetorEmas: (nominal?: number, konfigurasiId?: number) => void;
}

export const UserTabunganEmas: React.FC<UserTabunganEmasProps> = ({ onOpenSetorEmas }) => {
  const {
    userTransaksi,
    userEmasGramTotal,
    userEmasRupiahTotal,
    userEmasGoal,
    activeHargaEmas,
    hargaEmas,
    setActiveTab
  } = useApp();

  const emasTransactions = userTransaksi.filter(t => t.tipe_tabungan === 'emas');

  const goalTercapai = userEmasGoal != null && userEmasGramTotal >= userEmasGoal;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-emerald-500/10 dark:from-amber-950/40 dark:via-slate-800 dark:to-emerald-950/30 border border-amber-300/40 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Emas Fisik Antam LM 99.99%
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Syariah Compliant
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tabungan Emas Syariah
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Setor nominal rupiah secara berkala mulai dari Rp 10.000, langsung terkonversi otomatis menjadi kepemilikan gram emas fisik dengan acuan harga real-time harian.
          </p>
        </div>
      </div>

      {/* 2 Kartu: Saldo (Emas + Dana dalam satu) & Harga Terkini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Total Saldo Emas + Dana */}
        <div className="rounded-3xl p-6 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-800/90 border border-amber-200/70 dark:border-amber-800/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Total Akumulasi Saldo Emas</span>
              {goalTercapai && <Trophy className="w-4 h-4 text-amber-500" />}
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 mt-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                {userEmasGramTotal.toFixed(4)}
              </span>
              <span className="text-sm sm:text-base font-bold text-amber-500">gram</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Estimasi Nilai Pasar: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold whitespace-nowrap">Rp {formatRupiah(userEmasRupiahTotal)}</strong>
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-amber-200/60 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Penyimpanan: Brankas KSPPS Berkah Mulia</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Terjamin 100%
            </span>
          </div>
        </div>

        {/* Harga Acuan Hari Ini */}
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Harga Acuan Emas Hari Ini</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 self-start sm:self-auto">
                {activeHargaEmas?.tanggal || 'Update Terkini'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 mt-2">
              <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                Rp {formatRupiah(activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000)}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-400 whitespace-nowrap">/ gram</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeHargaEmas?.catatan || 'Harga resmi acuan dasar konversi setoran harian'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('harga-hari-ini')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Harga Emas Hari Ini</span>
            </button>
            <span className="text-[11px] text-slate-400">
              Min. Setor: Rp 10.000
            </span>
          </div>
        </div>
      </div>

      {/* Rencana Tabungan Emas (target + setoran berkala dalam satu kartu) */}
      <RencanaTabunganEmas onOpenSetor={onOpenSetorEmas} />

      {/* Emas Transactions History */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Riwayat Setoran Tabungan Emas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daftar konversi setoran rupiah ke gram emas
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Total {emasTransactions.length} Transaksi
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {emasTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada setoran emas. Klik tombol "Setor Emas Sekarang" di atas.
            </div>
          ) : (
            emasTransactions.map((trx) => (
              <div key={trx.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {trx.jenis_transaksi === 'setor' ? '+' : '-'} {Math.abs(trx.unit_didapat || 0)} Gram Emas
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {trx.nomor_referensi}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>Nominal: Rp {formatRupiah(trx.nominal)}</span>
                      <span>•</span>
                      <span>Kurs Acuan: Rp {formatRupiah(trx.harga_acuan_snapshot)}/g</span>
                      <span>•</span>
                      <span>{trx.tanggal_transaksi}</span>
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    trx.status_verifikasi === 'terverifikasi'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : trx.status_verifikasi === 'menunggu_verifikasi'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {trx.status_verifikasi === 'terverifikasi' ? 'Terverifikasi' : trx.status_verifikasi === 'menunggu_verifikasi' ? 'Menunggu Verifikasi' : 'Ditolak'}
                  </span>
                  {trx.metode_pembayaran === 'transfer' && trx.rekening_bank_nama && (
                    <span className="text-[10px] text-slate-400 mt-1">
                      Transfer via {trx.rekening_bank_nama}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
