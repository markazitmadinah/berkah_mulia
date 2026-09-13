import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { UserTabunganQurban } from './UserTabunganQurban';
import { UserTabunganHariRaya } from './UserTabunganHariRaya';
import { UserTabunganBerjangka } from './UserTabunganBerjangka';
import { JenisTabungan } from '../../types';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Repeat,
  Flame
} from 'lucide-react';

interface UserTabunganPribadiProps {
  initialSub?: string;
  onOpenSetorPribadi: (subJenisId?: number) => void;
  onOpenTarikPribadi: () => void;
  onOpenDaftarQurban: () => void;
  onOpenSetorQurban: (pendaftaranId: number) => void;
}

const SUB_ORDER = ['mandiri', 'hari_raya', 'qurban', 'berjangka'] as const;

const SUB_STYLE: Record<string, { active: string; badge: string; grad: string }> = {
  mandiri: {
    active: 'bg-blue-600 text-white shadow-md shadow-blue-600/25',
    badge: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    grad: 'from-emerald-500/10 via-teal-400/5 to-cyan-500/10 border-emerald-300/40 dark:border-emerald-500/20'
  },
  hari_raya: {
    active: 'bg-rose-600 text-white shadow-md shadow-rose-600/25',
    badge: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    grad: 'from-rose-500/10 via-orange-400/5 to-amber-500/10 border-rose-300/40 dark:border-rose-500/20'
  },
  berjangka: {
    active: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25',
    badge: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
    grad: 'from-indigo-500/10 via-slate-400/5 to-blue-500/10 border-indigo-300/40 dark:border-indigo-500/20'
  },
  qurban: {
    active: 'bg-teal-600 text-white shadow-md shadow-teal-600/25',
    badge: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
    grad: 'from-teal-500/10 via-emerald-400/5 to-lime-500/10 border-teal-300/40 dark:border-teal-500/20'
  }
};

export const UserTabunganPribadi: React.FC<UserTabunganPribadiProps> = ({
  initialSub = 'mandiri',
  onOpenSetorPribadi,
  onOpenTarikPribadi,
  onOpenDaftarQurban,
  onOpenSetorQurban
}) => {
  const {
    userTransaksi,
    jenisTabungan,
    userTabunganMandiriTotal
  } = useApp();

  const subJenisList = SUB_ORDER
    .map((k) => jenisTabungan.find((j) => j.sub_jenis === k))
    .filter((j): j is JenisTabungan => Boolean(j));

  const [activeSub] = useState<string>(() =>
    subJenisList.some((j) => j.sub_jenis === initialSub)
      ? initialSub
      : SUB_ORDER.find((k) => subJenisList.some((j) => j.sub_jenis === k)) ?? 'mandiri'
  );
  const activeJenis = subJenisList.find((j) => j.sub_jenis === activeSub);

  const trx = userTransaksi.filter((t) => {
    if (t.jenis_tabungan_id === activeJenis?.id) {
      if (t.tabungan_berjangka_id) return false;
      return true;
    }
    return false;
  });

  const totalSetor = trx
    .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'setor')
    .reduce((acc, c) => acc + c.nominal, 0);

  const totalTarik = trx
    .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'tarik')
    .reduce((acc, c) => acc + c.nominal, 0);

  const saldo = userTabunganMandiriTotal;

  const deadlineDate = activeJenis?.deadline ? new Date(activeJenis.deadline + 'T00:00:00') : null;
  const deadlinePassed = deadlineDate != null && deadlineDate < new Date();
  const style = SUB_STYLE[activeJenis?.sub_jenis ?? 'mandiri'] ?? SUB_STYLE.mandiri;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─── Tab Qurban ─── */}
      {activeSub === 'qurban' && (
        <UserTabunganQurban
          onOpenDaftarQurban={onOpenDaftarQurban}
          onOpenSetorQurban={onOpenSetorQurban}
        />
      )}

      {/* ─── Tab Hari Raya ─── */}
      {activeSub === 'hari_raya' && (
        <UserTabunganHariRaya onOpenSetorPribadi={onOpenSetorPribadi} />
      )}

      {/* ─── Tab Berjangka ─── */}
      {activeSub === 'berjangka' && (
        <UserTabunganBerjangka
          onOpenSetorPribadi={onOpenSetorPribadi}
          jenisTabunganId={activeJenis?.id}
        />
      )}

      {/* ─── Tab Mandiri (Default) ─── */}
      {activeSub === 'mandiri' && (
        <>
      {/* Top Banner */}
      <div className={`rounded-3xl p-6 lg:p-8 bg-gradient-to-r ${style.grad} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6`}>
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badge} flex items-center gap-1.5`}>
              <Wallet className="w-3.5 h-3.5" />
              Tabungan Mandiri
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Bebas Tarik & Setor Kapan Saja
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tabungan Mandiri (Wadi'ah)
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Simpanan fleksibel dengan prinsip titipan amanah (Wadi'ah Yad Dhamanah). Setor kapan saja dan tarik saat dibutuhkan tanpa potongan biaya bulanan (terpisah dari Tabungan Berjangka).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenSetorPribadi(activeJenis?.id)}
            className="py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Setor</span>
          </button>

          <button
            onClick={onOpenTarikPribadi}
            className="py-3 px-5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Tarik Saldo</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Tabungan Tersedia</span>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">
              Rp {formatRupiah(saldo)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            {activeJenis?.allow_withdrawal ? 'Siap ditarik kapan saja' : 'Dana terkunci sesuai ketentuan produk'}
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

      {/* Mutasi Transaksi */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Mutasi {activeJenis?.nama ?? 'Tabungan'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Riwayat setoran dan permohonan penarikan saldo simpanan
            </p>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            Total {trx.length} Mutasi
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {trx.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada mutasi transaksi {activeJenis?.nama.toLowerCase() ?? 'tabungan'}.
            </div>
          ) : (
            trx.map((t) => (
              <div key={t.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    t.jenis_transaksi === 'setor'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  }`}>
                    {t.jenis_transaksi === 'setor' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {t.jenis_transaksi === 'setor' ? 'Setoran Sukarela' : 'Penarikan Dana'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {t.nomor_referensi}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{t.tanggal_transaksi}</span>
                      <span>•</span>
                      <span className="capitalize">{t.metode_pembayaran}</span>
                      {t.catatan_user && <span>• Catatan: "{t.catatan_user}"</span>}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                  <p className={`font-extrabold text-sm ${
                    t.jenis_transaksi === 'setor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {t.jenis_transaksi === 'setor' ? '+' : '-'} Rp {formatRupiah(t.nominal)}
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                    t.status_verifikasi === 'terverifikasi'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : t.status_verifikasi === 'menunggu_verifikasi'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {t.status_verifikasi === 'terverifikasi' ? 'Terverifikasi' : t.status_verifikasi === 'menunggu_verifikasi' ? 'Menunggu Verifikasi' : 'Ditolak'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};