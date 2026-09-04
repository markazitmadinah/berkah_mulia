import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { formatRupiah } from '../../utils/format';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Info,
  Layers,
  Lock,
  PiggyBank,
  Repeat,
  Settings2,
  ShieldCheck,
  Target,
  Trophy,
  Wallet,
  X,
  AlertTriangle
} from 'lucide-react';
import { JenisTabungan } from '../../types';

interface UserTabunganCustomProps {
  jenis: JenisTabungan;
  onOpenSetor: () => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet,
  Coins,
  PiggyBank,
  Banknote,
  Target
};

export const UserTabunganCustom: React.FC<UserTabunganCustomProps> = ({ jenis, onOpenSetor }) => {
  const { userTransaksi, showToast, createTarikCustom, updateCustomGoal } = useApp();

  const [modal, setModal] = useState<'tarik' | null>(null);
  const [nominal, setNominal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [userGoal, setUserGoal] = useState<number | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [autoSetorAktif, setAutoSetorAktif] = useState(false);
  const [autoSetorLoading, setAutoSetorLoading] = useState(false);

  const cfg = useMemo(() => jenis.config ?? {}, [jenis.config]);
  const Icon = ICONS[String(cfg.ikon || 'Wallet')] ?? Wallet;
  const goalBolehUbah = !!cfg.goal_boleh_ubah;
  const setoranBerkala = !!cfg.setoran_berkala;

  useEffect(() => {
    if (!goalBolehUbah) return;
    let stale = false;
    api.get<{ target_nominal: number | null; admin_target_nominal: number | null }>(`/tabungan-custom/${jenis.id}/target`)
      .then((r) => { if (!stale) setUserGoal(r.data.target_nominal ?? null); })
      .catch(() => {});
    return () => { stale = true; };
  }, [goalBolehUbah, jenis.id]);

  useEffect(() => {
    if (!setoranBerkala) return;
    let stale = false;
    api.get<{ aktif: boolean }>(`/tabungan-custom/${jenis.id}/auto-setor`)
      .then((r) => { if (!stale) setAutoSetorAktif(r.data.aktif); })
      .catch(() => {});
    return () => { stale = true; };
  }, [setoranBerkala, jenis.id]);

  const handleToggleAutoSetor = () => {
    setAutoSetorLoading(true);
    api.put<{ aktif: boolean }>(`/tabungan-custom/${jenis.id}/auto-setor`, { aktif: !autoSetorAktif })
      .then((r) => {
        setAutoSetorAktif(r.data.aktif);
        showToast(r.data.aktif ? 'Setoran berkala otomatis diaktifkan.' : 'Setoran berkala otomatis dinonaktifkan.');
      })
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal mengubah setoran berkala.', 'error'))
      .finally(() => setAutoSetorLoading(false));
  };

  const handleSaveGoal = () => {
    const val = Number(goalDraft.replace(/\./g, ''));
    if (!goalDraft || isNaN(val) || val <= 0) {
      showToast('Target harus berupa angka lebih dari 0.', 'error');
      return;
    }
    updateCustomGoal(jenis.id, val);
    setUserGoal(val);
    setGoalFormOpen(false);
  };

  const trx = userTransaksi
    .filter((t) => t.jenis_tabungan_id === jenis.id)
    .sort((a, b) => b.id - a.id);

  const totalSetor = trx
    .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'setor')
    .reduce((acc, c) => acc + c.nominal, 0);
  const totalTarik = trx
    .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'tarik')
    .reduce((acc, c) => acc + c.nominal, 0);
  const saldo = totalSetor - totalTarik;

  const adminTarget = jenis.target_nominal ?? 0;
  const target = userGoal ?? adminTarget;
  const persen = target > 0 ? Math.min(100, (saldo / target) * 100) : 0;
  const goalTercapai = target > 0 && saldo >= target;

  const resetForm = () => {
    setNominal('');
    setCatatan('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(nominal);
    if (!n || n <= 0) {
      showToast('Masukkan nominal yang valid.', 'error');
      return;
    }
    if (n > saldo) {
      showToast(`Saldo tidak mencukupi (Tersedia: Rp ${formatRupiah(saldo)}).`, 'error');
      return;
    }
    if (Number(cfg.min_saldo) > 0 && saldo - n < Number(cfg.min_saldo)) {
      showToast(`Saldo setelah tarik minimal Rp ${formatRupiah(Number(cfg.min_saldo))}.`, 'error');
      return;
    }
    createTarikCustom(jenis.id, { jenis_tabungan_id: jenis.id, nominal: n, catatan_user: catatan });
    setModal(null);
    resetForm();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-emerald-500/10 via-teal-400/5 to-cyan-500/10 dark:from-emerald-950/40 dark:via-slate-800 dark:to-teal-950/30 border border-emerald-300/40 dark:border-emerald-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" />
              {jenis.tipe === 'custom' ? 'Produk Khusus Syariah' : 'Produk Tabungan'}
            </span>
            {jenis.status_aktif && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Aktif
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {jenis.nama}
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            {jenis.deskripsi ||
              'Produk tabungan yang dikonfigurasi khusus oleh koperasi. Setoran dan penarikan diatur sesuai ketentuan produk.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSetor}
            disabled={(goalBolehUbah && userGoal == null) || goalTercapai}
            className="py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Setor</span>
          </button>

          {jenis.allow_withdrawal && (
            <button
              onClick={() => { setModal('tarik'); setNominal(''); setCatatan(''); }}
              className="py-3 px-5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tarik</span>
            </button>
          )}
        </div>
      </div>

      {/* Blocker: goal belum diisi */}
      {goalBolehUbah && userGoal == null && (
        <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Target belum diatur</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Anda harus menentukan target tabungan terlebih dahulu sebelum bisa melakukan setoran.
            </p>
          </div>
        </div>
      )}

      {/* Blocker: goal tercapai */}
      {goalTercapai && (
        <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/40 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Target tercapai!</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Saldo Anda sudah mencapai target (Rp {formatRupiah(target)}). Anda tidak dapat melakukan setoran lagi.
              Silakan hubungi admin untuk konfirmasi pencairan dana.
            </p>
          </div>
        </div>
      )}

      {/* Progress Goal */}
      {target > 0 && (
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Progress Target</h3>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-xl text-emerald-600 dark:text-emerald-400">
                {persen.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Rp {formatRupiah(saldo)} dari Rp {formatRupiah(target)}
              </p>
            </div>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${persen}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {jenis.tanggal_selesai && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Deadline {new Date(jenis.tanggal_selesai + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {!!cfg.goal_wajib && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Target wajib tercapai
              </span>
            )}
          </div>
        </div>
      )}

      {/* Goal Setting for User (goal_boleh_ubah) */}
      {goalBolehUbah && userGoal == null && (
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-dashed border-emerald-300 dark:border-emerald-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Belum ada target. Tentukan target nominal yang ingin Anda capai agar progresnya terpantau di sini.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => { setGoalDraft(userGoal != null ? String(userGoal) : ''); setGoalFormOpen(v => !v); }}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{goalFormOpen ? 'Tutup' : 'Buat Target Saya'}</span>
            </button>
          </div>
          {goalFormOpen && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                type="text"
                inputMode="numeric"
                min={10000}
                value={goalDraft}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setGoalDraft(digits ? Number(digits).toLocaleString('id-ID') : '');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveGoal(); } }}
                placeholder="Contoh: 5.000.000"
                className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setGoalFormOpen(false)} className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">Batal</button>
                <button type="button" onClick={handleSaveGoal} className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer">Simpan Target</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto Setor Berkala */}
      {setoranBerkala && (
        <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Repeat className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Setoran Berkala Otomatis</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                {autoSetorAktif
                  ? `Sistem akan mencatat setoran Rp ${formatRupiah(Number(cfg.setoran_berkala_nominal || 0))} setiap ${String(cfg.setoran_berkala_periode)}.`
                  : 'Aktifkan agar sistem mencatat setoran periodik secara otomatis.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoSetor}
            disabled={autoSetorLoading}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0 self-start sm:self-auto ${autoSetorAktif ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            aria-pressed={autoSetorAktif}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoSetorAktif ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Tabungan</span>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">
              Rp {formatRupiah(saldo)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Saldo terverifikasi
          </p>
        </div>

        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Setoran</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words">
              Rp {formatRupiah(totalSetor)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Akumulasi seluruh setoran disetujui</p>
        </div>

        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Penarikan</span>
          <div className="my-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words">
              Rp {formatRupiah(totalTarik)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total dana yang telah dicairkan</p>
        </div>
      </div>

      {/* Info Produk */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Info className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Ketentuan Produk</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Coins className="w-3 h-3" /> Mode Setoran
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {String(jenis.mode_perhitungan).replace(/_/g, ' ')}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {cfg.min_nominal ? `Min Rp ${formatRupiah(Number(cfg.min_nominal))}` : 'Tanpa minimum'}{' '}
              {cfg.max_nominal ? `• Maks Rp ${formatRupiah(Number(cfg.max_nominal))}` : ''}{' '}
              {cfg.kelipatan ? `• Kelipatan Rp ${formatRupiah(Number(cfg.kelipatan))}` : ''}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Repeat className="w-3 h-3" /> Setoran Berkala
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {cfg.setoran_berkala
                ? `Rp ${formatRupiah(Number(cfg.setoran_berkala_nominal || 0))} / ${String(cfg.setoran_berkala_periode)}`
                : 'Tidak aktif'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Otomatis sesuai periode</p>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pencairan
            </p>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {String(jenis.aturan_pencairan).replace(/_/g, ' ')}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {jenis.allow_withdrawal ? 'Tarik bebas tersedia' : 'Hanya cair sesuai ketentuan'}
              {cfg.biaya_admin ? ` • Biaya Rp ${formatRupiah(Number(cfg.biaya_admin))}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Mutasi */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Mutasi {jenis.nama}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Riwayat setoran dan permohonan penarikan</p>
          </div>
          <span className="text-xs text-slate-400 font-bold">Total {trx.length} Mutasi</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
          {trx.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada mutasi transaksi untuk produk ini.
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
                        {t.jenis_transaksi === 'setor' ? 'Setoran' : 'Penarikan'}
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

      {/* Modal Tarik */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Tarik {jenis.nama}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nominal (Rp)</label>
                <input
                  type="number"
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  placeholder="Masukkan nominal"
                  autoFocus
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <p className="rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 p-3">
                Saldo tersedia: <b>Rp {formatRupiah(saldo)}</b>. Penarikan akan diverifikasi admin terlebih dahulu.
                {Number(cfg.min_saldo) > 0 && ` Saldo setelah tarik minimal Rp ${formatRupiah(Number(cfg.min_saldo))}.`}
              </p>

              {(() => {
                const n = Number(nominal);
                if (!n || n <= 0) return null;
                let biaya = 0;
                if (cfg.potongan && Number(cfg.potongan_nilai) > 0) {
                  const p = Number(cfg.potongan_nilai);
                  biaya += cfg.potongan_tipe === 'persen' ? (n * p) / 100 : p;
                }
                if (Number(cfg.biaya_admin) > 0) biaya += Number(cfg.biaya_admin);
                const netto = n - biaya;
                if (biaya > 0) {
                  return (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1">
                      <p className="font-bold text-slate-700 dark:text-slate-300">Rincian pencairan</p>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Nominal ditarik dari saldo</span><b>Rp {formatRupiah(n)}</b>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>Potongan / biaya</span><b>− Rp {formatRupiah(biaya)}</b>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 text-slate-900 dark:text-white">
                        <span>Diterima nasabah</span><b>Rp {formatRupiah(netto)}</b>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Catatan (opsional)</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan untuk verifikator"
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  Ajukan Penarikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};