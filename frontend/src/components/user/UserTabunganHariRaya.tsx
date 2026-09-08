import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { ArrowDownLeft, ArrowUpRight, Calendar, Gift, Target, Sparkles } from 'lucide-react';

interface UserTabunganHariRayaProps {
  onOpenSetorPribadi: (subJenisId?: number) => void;
}

export const UserTabunganHariRaya: React.FC<UserTabunganHariRayaProps> = ({
  onOpenSetorPribadi
}) => {
  const {
    hariRayaStatus,
    setTargetHariRaya,
    cairkanHariRaya,
    userTransaksi,
    currentUser,
    showToast
  } = useApp();

  const [targetInput, setTargetInput] = useState('');

  const st = hariRayaStatus;
  const trx = userTransaksi.filter((t) => t.jenis_tabungan_id === st?.jenis_tabungan_id);

  if (!st) return null;

  const terkumpul = st.terkumpul;
  const pct = st.persentase ?? 0;
  const sisa = Math.max(st.target - terkumpul, 0);
  const deadlineLabels = st.deadline
    ? `pada ${new Date(st.deadline + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'pada tanggal yang diatur admin';

  const handleSimpanTarget = () => {
    const nominal = Number(targetInput.replace(/\D/g, '') || 0);
    if (nominal < 10000) {
      showToast('Minimal target Rp 10.000.', 'error');
      return;
    }
    setTargetHariRaya(nominal);
  };

  const handleCairkan = () => {
    if (window.confirm(`Cairkan seluruh saldo tabungan hari raya (Rp ${formatRupiah(terkumpul)}) ke rekening Anda?`)) {
      cairkanHariRaya();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-rose-500/10 via-orange-400/5 to-amber-500/10 border border-rose-300/40 dark:border-rose-500/20 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {st.nama}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Dicairkan {deadlineLabels}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tabungan Hari Raya
        </h1>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
          Tentukan target sendiri, lalu setor kapan saja. Dana otomatis siap dicairkan 1 minggu sebelum hari raya ke rekening Anda.
        </p>
      </div>

      {st.masa_pencairan && (
        <div className="rounded-3xl p-5 border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5" />
            </span>
            <div>
              <p className="font-extrabold text-base text-slate-900 dark:text-white">Hari Raya Sudah Dekat!</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Masa setoran ditutup. Dana siap dicairkan ke rekening Anda.
              </p>
            </div>
          </div>
          <button
            onClick={handleCairkan}
            disabled={terkumpul < 10000}
            className="py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{terkumpul < 10000 ? 'Belum Ada Dana' : `Cairkan Rp ${formatRupiah(terkumpul)}`}</span>
          </button>
        </div>
      )}

      {/* Target Setup / Progress */}
      {st.target === 0 ? (
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-2xl bg-rose-600/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Atur Target Tabungan Hari Raya</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {st.deadline
                  ? `Dana dicairkan ${st.deadline ? new Date(st.deadline + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}.`
                  : 'Tentukan berapa dana yang ingin dikumpulkan untuk hari raya.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={targetInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setTargetInput(digits ? Number(digits).toLocaleString('id-ID') : '');
                }}
                placeholder="Contoh: 3.000.000"
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
            </div>
            <button
              onClick={handleSimpanTarget}
              className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-sm transition-all cursor-pointer"
            >
              Simpan Target
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Terkumpul</span>
            <span className="my-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">
              Rp {formatRupiah(terkumpul)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Dana terverifikasi di tabungan Anda</span>
          </div>

          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target Saya</span>
            <span className="my-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white break-words">
              Rp {formatRupiah(st.target)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Sisa Rp {formatRupiah(sisa)} menuju target</span>
          </div>

          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capaian Target</span>
            <div className="my-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 break-words">
                {pct.toLocaleString('id-ID')}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Setor CTA */}
      {!st.masa_pencairan && (
        <button
          onClick={() => onOpenSetorPribadi(st.jenis_tabungan_id)}
          disabled={st.target === 0}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={st.target === 0 ? 'Atur target tabungan hari raya terlebih dahulu' : undefined}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>{st.target === 0 ? 'Atur Target Dulu Sebelum Setor' : 'Setor Tabungan Hari Raya'}</span>
        </button>
      )}

      {/* Mutasi */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Mutasi Tabungan Hari Raya</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Riwayat setoran dan pencairan dana</p>
          </div>
          <span className="text-xs text-slate-400 font-bold">Total {trx.length} Mutasi</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {trx.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada mutasi. {currentUser?.name?.split(' ')[0]}, yuk mulai menabung untuk hari raya!
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
                        {t.jenis_transaksi === 'setor' ? 'Setoran Sukarela' : 'Pencairan Hari Raya'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {t.nomor_referensi}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{t.tanggal_transaksi}</span>
                      <span>•</span>
                      <span className="capitalize">{t.metode_pembayaran}</span>
                      {t.catatan_user && <span>• {t.catatan_user}</span>}
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
    </div>
  );
};