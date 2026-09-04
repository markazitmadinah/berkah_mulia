import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  Coins,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Target,
  Trophy,
  Settings2,
  Banknote,
  TriangleAlert,
  Lock,
  X
} from 'lucide-react';

interface UserTabunganEmasProps {
  onOpenSetorEmas: () => void;
}

export const UserTabunganEmas: React.FC<UserTabunganEmasProps> = ({ onOpenSetorEmas }) => {
  const {
    userTransaksi,
    userEmasGramTotal,
    userEmasRupiahTotal,
    userEmasGoal,
    updateEmasGoal,
    createPenarikanEmas,
    ajukanBatalEmas,
    tukarEmas,
    activeHargaEmas,
    hargaEmas,
    showToast
  } = useApp();

  const [showHistoryTable, setShowHistoryTable] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [modalMode, setModalMode] = useState<'cairkan' | 'batal' | null>(null);
  const [confirmMode, setConfirmMode] = useState<'cairkan' | 'batal' | null>(null);
  const [tukarModalOpen, setTukarModalOpen] = useState(false);
  const [tarikBank, setTarikBank] = useState('Bank Syariah Indonesia (BSI)');
  const [tarikNoRek, setTarikNoRek] = useState('');
  const [tarikAtasNama, setTarikAtasNama] = useState('');
  const [tarikCatatan, setTarikCatatan] = useState('');

  const emasTransactions = userTransaksi.filter(t => t.tipe_tabungan === 'emas');
  const goalPersen = userEmasGoal != null && userEmasGoal > 0
    ? Math.min(100, Math.max(0, (userEmasGramTotal / userEmasGoal) * 100))
    : 0;
  const goalTercapai = userEmasGoal != null && userEmasGramTotal >= userEmasGoal;
  const activeHarga = activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000;
  const estimasiPenalti = userEmasRupiahTotal * 0.10;
  const estimasiRefund = userEmasRupiahTotal - estimasiPenalti;

  const handleSaveGoal = () => {
    const val = Number(goalDraft);
    if (!goalDraft || isNaN(val) || val <= 0) {
      showToast('Target harus berupa angka gram lebih dari 0.', 'error');
      return;
    }
    updateEmasGoal(val);
    setGoalFormOpen(false);
  };

  const closeModal = () => {
    setModalMode(null);
    setTarikNoRek('');
    setTarikAtasNama('');
    setTarikCatatan('');
  };

  const confirmPenalty = (mode: 'cairkan' | 'batal') => {
    if (mode === 'batal') {
      setConfirmMode(mode);
    } else {
      setModalMode(mode);
    }
  };

  const proceedToForm = () => {
    setModalMode(confirmMode);
    setConfirmMode(null);
  };

  const handleSubmitPencairan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarikNoRek.trim() || !tarikAtasNama.trim()) {
      showToast('Isi nomor rekening dan atas nama penerima.', 'error');
      return;
    }
    const payload = {
      bank_tujuan: tarikBank,
      no_rekening: tarikNoRek,
      atas_nama: tarikAtasNama,
      catatan_user: tarikCatatan
    };
    if (modalMode === 'batal') {
      ajukanBatalEmas(payload);
    } else {
      createPenarikanEmas(payload);
    }
    closeModal();
  };

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

        <button
          onClick={() => {
            if (userEmasGoal == null) {
              showToast('Set target tabungan emas dahulu untuk melakukan setoran emas.', 'error');
              return;
            }
            onOpenSetorEmas();
          }}
          className="py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Setor Emas Sekarang</span>
        </button>
      </div>

      {/* 2 Stat Cards: Saldo & Harga Terkini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Total Saldo Emas */}
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Akumulasi Saldo Emas</span>
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

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
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
              onClick={() => setShowHistoryTable(!showHistoryTable)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistoryTable ? 'Sembunyikan Riwayat Harga' : 'Lihat Riwayat Harga Emas'}</span>
            </button>
            <span className="text-[11px] text-slate-400">
              Min. Setor: Rp 10.000
            </span>
          </div>
        </div>
      </div>

      {/* Goal Tabungan Emas */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Target Tabungan Emas Saya</h3>
          </div>
          {userEmasGoal != null && (
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Sisa: <span className="text-amber-600 dark:text-amber-400 font-extrabold">{(userEmasGoal - userEmasGramTotal).toFixed(4)} gram</span>
            </span>
          )}
        </div>

        {userEmasGoal != null ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {userEmasGramTotal.toFixed(4)} / {userEmasGoal} gram
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{goalPersen.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                style={{ width: `${goalPersen}%` }}
              />
            </div>
            {goalPersen >= 100 && (
              <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                Target tercapai! Selamat, lanjutkan kebiasaan menabung emas Anda.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Belum ada target. Tentukan target gram emas yang ingin Anda capai agar progresnya terpantau di sini.
          </p>
        )}

        {goalFormOpen && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <input
              type="number"
              min={0.01}
              step="any"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveGoal(); } }}
              placeholder="Contoh: 10 gram"
              className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGoalFormOpen(false)}
                className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveGoal}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer"
              >
                Simpan Target
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {userEmasGoal == null && (
            <button
              type="button"
              onClick={() => { setGoalDraft(userEmasGoal != null ? String(userEmasGoal) : ''); setGoalFormOpen(v => !v); }}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{goalFormOpen ? 'Tutup' : 'Buat Target Saya'}</span>
            </button>
          )}
          {userEmasGoal != null && (
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5" title="Target hanya bisa diubah setelah goal tercapai dan dikonfirmasi admin.">
              <Lock className="w-3.5 h-3.5" />
              Target terkunci hingga goal tercapai
            </span>
          )}

          {goalTercapai ? (
            <button
              type="button"
              onClick={() => setTukarModalOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm shadow-amber-600/25 transition-opacity cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              Tukar Emas
            </button>
          ) : (
            <button
              type="button"
              onClick={() => confirmPenalty('batal')}
              disabled={userEmasGramTotal <= 0}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Banknote className="w-4 h-4" />
              Batal & Refund Dana
            </button>
          )}
        </div>
      </div>

      {/* Optional Gold Price History Table */}
      {showHistoryTable && (
        <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              Riwayat Harga Acuan Harian (Append-only)
            </h3>
            <span className="text-xs text-slate-400">{hargaEmas.length} Catatan Versi</span>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Harga / Gram</th>
                  <th className="py-2.5 px-3">Catatan / Keterangan</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...hargaEmas].slice(-15).reverse().map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{h.tanggal}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      Rp {formatRupiah(h.harga_per_gram)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{h.catatan}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        h.status_aktif
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {h.status_aktif ? 'Aktif Saat Ini' : 'Arsip'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Popup Peringatan Penalty 10% (batal sebelum goal) */}
      {confirmMode === 'batal' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-rose-200 dark:border-rose-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center mb-4">
                <TriangleAlert className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Anda akan kena potongan 10%
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Pencairan sebelum goal tabungan emas tercapai dikenakan potongan{' '}
                <span className="font-bold text-rose-600 dark:text-rose-400">10%</span> dari nilai saldo emas Anda.
              </p>

              <div className="mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 space-y-1.5 text-left">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Saldo Anda</span>
                  <span className="font-bold">Rp {formatRupiah(userEmasRupiahTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400">
                  <span>Potongan 10% (−)</span>
                  <span className="font-bold">Rp {formatRupiah(estimasiPenalti)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-emerald-600 dark:text-emerald-400 border-t border-rose-200 dark:border-rose-800/40 pt-1.5 mt-1">
                  <span>Refund diterima</span>
                  <span>Rp {formatRupiah(estimasiRefund)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={proceedToForm}
                className="py-2.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                Lanjutkan Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Tukar Emas */}
      {tukarModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-amber-200 dark:border-amber-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center mb-4">
                <Coins className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Tukar Seluruh Saldo Emas di Toko?
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Anda akan menukar seluruh saldo emas menjadi emas fisik. Pastikan Anda membawa{' '}
                <span className="font-bold text-amber-600 dark:text-amber-400">bukti penukaran</span>{' '}
                saat datang ke toko.
              </p>

              <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5 text-left">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Saldo Emas Anda</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{userEmasGramTotal.toFixed(4)} gram</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Nilai Tukar (kurs acuan)</span>
                  <span className="font-bold">Rp {formatRupiah(userEmasRupiahTotal)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setTukarModalOpen(false)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setTukarModalOpen(false);
                  tukarEmas();
                }}
                className="py-2.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-amber-600/25 transition-all cursor-pointer"
              >
                Ya, Tukar Emas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cairkan / Batal Dana Emas */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden sm:my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {modalMode === 'cairkan' ? 'Cairkan Dana Tabungan Emas' : 'Batalkan & Refund Dana'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {modalMode === 'cairkan'
                    ? 'Goal tercapai — pencairan penuh saldo emas menjadi rupiah'
                    : 'Pembatalan tabungan sebelum goal tercapai — dipotong 10%'}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPencairan} className="p-6 space-y-4">
              <div className={`p-4 rounded-2xl border ${modalMode === 'cairkan' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${modalMode === 'cairkan' ? 'text-amber-800 dark:text-amber-300' : 'text-rose-800 dark:text-rose-300'}`}>
                  {modalMode === 'cairkan' ? 'Nilai Pencairan (Full Saldo)' : 'Rincian Refund (90%)'}
                </span>
                <p className={`text-lg sm:text-xl font-extrabold mt-0.5 break-words ${modalMode === 'cairkan' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {modalMode === 'cairkan'
                    ? `Rp ${formatRupiah(userEmasRupiahTotal)}`
                    : `Rp ${formatRupiah(estimasiRefund)}`}
                </p>
                {modalMode === 'batal' && (
                  <div className="mt-2 space-y-1 text-[11px] text-rose-700/80 dark:text-rose-300/70">
                    <p>Saldo: {userEmasGramTotal.toFixed(4)} gram ≈ Rp {formatRupiah(userEmasRupiahTotal)}</p>
                    <p>Potongan 10%: −Rp {formatRupiah(estimasiPenalti)}</p>
                    <p>Refund diterima: Rp {formatRupiah(estimasiRefund)}</p>
                  </div>
                )}
                <span className={`text-[11px] ${modalMode === 'cairkan' ? 'text-amber-700/80 dark:text-amber-300/70' : 'text-rose-700/80 dark:text-rose-300/70'}`}>
                  Kurs acuan Rp {formatRupiah(activeHarga)} / gram
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Bank Tujuan Pencairan
                  </label>
                  <input
                    type="text"
                    value={tarikBank}
                    onChange={(e) => setTarikBank(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nomor Rekening Penerima
                  </label>
                  <input
                    type="text"
                    value={tarikNoRek}
                    onChange={(e) => setTarikNoRek(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Atas Nama Rekening Penerima
                  </label>
                  <input
                    type="text"
                    value={tarikAtasNama}
                    onChange={(e) => setTarikAtasNama(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Alasan / Catatan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kebutuhan dana keluarga"
                  value={tarikCatatan}
                  onChange={(e) => setTarikCatatan(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`py-2.5 px-6 rounded-2xl text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer ${modalMode === 'cairkan' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'}`}
                >
                  {modalMode === 'cairkan' ? 'Ajukan Pencairan' : 'Ajukan Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
