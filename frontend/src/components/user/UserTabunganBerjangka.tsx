import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import {
  Wallet,
  Plus,
  Calendar,
  Target,
  Clock,
  Repeat,
  ArrowDownLeft,
  ArrowUpRight,
  XCircle,
  CheckCircle2,
  Hourglass,
  Lock,
  Sparkles,
  AlertTriangle,
  Upload,
  X
} from 'lucide-react';
import { FrekuensiSetoran, TabunganBerjangka } from '../../types';

interface UserTabunganBerjangkaProps {
  onOpenSetorPribadi?: (subJenisId?: number) => void;
  jenisTabunganId?: number;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  menunggu_approval: {
    label: 'Menunggu Approval',
    cls: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: <Hourglass className="w-3 h-3" />
  },
  aktif: {
    label: 'Aktif Berjalan',
    cls: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  selesai: {
    label: 'Selesai Dicairkan',
    cls: 'bg-indigo-600 text-white border-indigo-600',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  batal: {
    label: 'Dibatalkan',
    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    icon: <XCircle className="w-3 h-3" />
  },
  pembatalan_diajukan: {
    label: 'Pembatalan Diajukan',
    cls: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: <Hourglass className="w-3 h-3" />
  },
};

// ─── Modal Buat Tabungan Berjangka ───────────────────────────
const CreateBerjangkaModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { buatTabunganBerjangka, showToast } = useApp();
  const [target, setTarget] = useState('');
  const [durasi, setDurasi] = useState('12');
  const [frekuensi, setFrekuensi] = useState<FrekuensiSetoran>('bulanan');
  const [catatan, setCatatan] = useState('');

  const targetN = parseRupiah(target);
  const durasiN = parseInt(durasi) || 0;

  const totalPeriode = frekuensi === 'harian' ? durasiN * 30 : frekuensi === 'mingguan' ? durasiN * 4 : durasiN;
  const perPeriode = totalPeriode > 0 ? Math.ceil((targetN / totalPeriode) * 100) / 100 : 0;

  const submit = () => {
    if (targetN < 50000) return showToast('Target minimal Rp 50.000.', 'error');
    if (durasiN < 1 || durasiN > 120) return showToast('Durasi harus antara 1–120 bulan.', 'error');
    buatTabunganBerjangka({ target_nominal: targetN, durasi_bulan: durasiN, frekuensi_setor: frekuensi, catatan: catatan || undefined });
    onClose();
  };

  const iCls = 'w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50';
  const lCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-500" /> Buat Tabungan Berjangka
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tentukan target nominal, durasi, dan jadwal setoran berkala.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={lCls}>Target Nominal (Rp)</label>
              <input type="text" inputMode="decimal" value={fmtRupiahTyping(target)} onChange={e => setTarget(fmtRupiahTyping(e.target.value))} onBlur={() => setTarget(fmtRupiahBlur(target))} placeholder="Contoh: 5.000.000,00" className={iCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Durasi (bulan)</label>
                <input type="number" inputMode="numeric" min={1} max={120} value={durasi} onChange={e => setDurasi(e.target.value)} className={iCls} />
              </div>
              <div>
                <label className={lCls}>Frekuensi Setor</label>
                <select value={frekuensi} onChange={e => setFrekuensi(e.target.value as FrekuensiSetoran)} className={iCls}>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lCls}>Catatan (opsional)</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Tujuan tabungan, misal: Biaya Pendidikan" className={iCls} />
            </div>
          </div>

          {/* Preview */}
          {targetN > 0 && durasiN > 0 && (
            <div className="rounded-2xl p-4 mt-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-2">Pratinjau Rencana</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-indigo-500">Target:</span> <b className="text-indigo-900 dark:text-indigo-100">{formatRupiah(targetN)}</b></div>
                <div><span className="text-indigo-500">Durasi:</span> <b className="text-indigo-900 dark:text-indigo-100">{durasiN} bulan</b></div>
                <div><span className="text-indigo-500">Periode:</span> <b className="text-indigo-900 dark:text-indigo-100">{totalPeriode}× {frekuensi}</b></div>
                <div><span className="text-indigo-500">Per Periode:</span> <b className="text-indigo-900 dark:text-indigo-100">±{formatRupiah(perPeriode)}</b></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
              Batal
            </button>
            <button onClick={submit} className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer">
              Ajukan Tabungan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Setor Khusus Tabungan Berjangka ─────────────────────
const SetorBerjangkaModal: React.FC<{ tb: TabunganBerjangka; onClose: () => void }> = ({ tb, onClose }) => {
  const { rekeningBank, setorTabunganBerjangka, showToast } = useApp();
  const [nominal, setNominal] = useState(String(tb.nominal_per_periode || ''));
  const [rekeningId, setRekeningId] = useState<number>(rekeningBank.find(r => r.status_aktif)?.id || 1);
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [catatan, setCatatan] = useState('');

  const activeRekening = rekeningBank.filter(r => r.status_aktif);
  const selectedBank = rekeningBank.find(r => r.id === rekeningId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nominalNum = parseRupiah(nominal);
    if (nominalNum <= 0) {
      showToast('Nominal setoran tidak valid.', 'error');
      return;
    }
    if (!buktiFile) {
      showToast('Wajib mengunggah bukti transfer.', 'error');
      return;
    }

    setorTabunganBerjangka(tb.id, {
      nominal: nominalNum,
      rekening_bank_id: rekeningId,
      bukti_transfer: buktiFile,
      catatan_user: catatan || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" /> Setor Tabungan Berjangka #{tb.id}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: {formatRupiah(tb.target_nominal)} · Anjuran {tb.frekuensi_label ?? tb.frekuensi_setor}: {formatRupiah(tb.nominal_per_periode)}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nominal Setoran (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={fmtRupiahTyping(nominal)}
                  onChange={e => setNominal(fmtRupiahTyping(e.target.value))}
                  onBlur={() => setNominal(fmtRupiahBlur(nominal))}
                  placeholder="Contoh: 1.000.000,50"
                  required
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rekening Bank Koperasi Tujuan
              </label>
              <select
                value={rekeningId}
                onChange={e => setRekeningId(Number(e.target.value))}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {activeRekening.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nama_bank} - {r.no_rekening} (a.n {r.atas_nama})
                  </option>
                ))}
              </select>
              {selectedBank && (
                <div className="mt-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-200">{selectedBank.nama_bank}</span>
                    <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">{selectedBank.no_rekening} a.n {selectedBank.atas_nama}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">Transfer</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Upload Bukti Transfer
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                required
                onChange={e => setBuktiFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan transfer..."
                className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 cursor-pointer transition-all"
              >
                Kirim Bukti Setoran
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Cairkan Tabungan Berjangka ─────────────────────────
const CairkanBerjangkaModal: React.FC<{ tb: TabunganBerjangka; onClose: () => void }> = ({ tb, onClose }) => {
  const { cairkanTabunganBerjangka, showToast } = useApp();
  const [bankTujuan, setBankTujuan] = useState('');
  const [noRekTujuan, setNoRekTujuan] = useState('');
  const [atasNama, setAtasNama] = useState('');
  const [catatan, setCatatan] = useState('');

  const terkumpul = tb.terkumpul ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankTujuan.trim() || !noRekTujuan.trim() || !atasNama.trim()) {
      showToast('Lengkapi info bank tujuan penerima terlebih dahulu.', 'error');
      return;
    }

    cairkanTabunganBerjangka(tb.id, {
      bank_tujuan: bankTujuan.trim(),
      no_rekening: noRekTujuan.trim(),
      atas_nama: atasNama.trim(),
      catatan: catatan.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" /> Cairkan Tabungan Berjangka #{tb.id}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target tercapai dan telah melewati masa tenggat waktu jatuh tempo.
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 mb-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Target Goal</span>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{formatRupiah(tb.target_nominal)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Saldo Dicairkan</span>
                <p className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base">{formatRupiah(terkumpul)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Tujuan
                </label>
                <input
                  type="text"
                  required
                  value={bankTujuan}
                  onChange={e => setBankTujuan(e.target.value)}
                  placeholder="BCA / Mandiri / BSI"
                  className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  required
                  value={noRekTujuan}
                  onChange={e => setNoRekTujuan(e.target.value)}
                  placeholder="1234567890"
                  className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Atas Nama Pemilik Rekening
              </label>
              <input
                type="text"
                required
                value={atasNama}
                onChange={e => setAtasNama(e.target.value)}
                placeholder="Nama lengkap sesuai buku rekening"
                className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Tambahan (opsional)
              </label>
              <input
                type="text"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Misal: Penarikan untuk biaya renovasi"
                className="w-full py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 cursor-pointer transition-all"
              >
                Ajukan Pencairan Dana
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
export const UserTabunganBerjangka: React.FC<UserTabunganBerjangkaProps> = () => {
  const { tabunganBerjangka, fetchTabunganBerjangka, batalTabunganBerjangka } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmBatalId, setConfirmBatalId] = useState<number | null>(null);
  const [setorTargetTb, setSetorTargetTb] = useState<TabunganBerjangka | null>(null);
  const [cairkanTargetTb, setCairkanTargetTb] = useState<TabunganBerjangka | null>(null);

  useEffect(() => {
    fetchTabunganBerjangka();
  }, []);

  const items = tabunganBerjangka?.items ?? [];
  const dapatMembuat = tabunganBerjangka?.dapat_membuat ?? true;
  const slotTersedia = tabunganBerjangka?.slot_tersedia ?? 5;

  const handleBatal = (id: number) => {
    if (confirmBatalId === id) {
      batalTabunganBerjangka(id);
      setConfirmBatalId(null);
    } else {
      setConfirmBatalId(id);
      setTimeout(() => setConfirmBatalId(null), 4000);
    }
  };

  if (items.length === 0) {
    // Empty state — show create form
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-indigo-500/10 via-slate-400/5 to-blue-500/10 border border-indigo-300/40 dark:border-indigo-500/20 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Tabungan Berjangka
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Belum Ada Tabungan Berjangka
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Buat tabungan berjangka dengan target nominal dan durasi waktu tertentu. Setoran berkala sesuai jadwal yang Anda tentukan sendiri. <b>Dana hanya dapat ditarik jika sudah mencapai goal dan melewati tanggal jatuh tempo.</b>
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-600/25 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Buat Tabungan Berjangka
          </button>
        </div>

        <div className="rounded-3xl p-8 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mx-auto">
            <Target className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Ketentuan Penarikan Tabungan Berjangka</h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto space-y-2 text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
            <p className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span><b>Dana Terkunci:</b> Tabungan berjangka tidak dapat ditarik sewaktu-waktu (terpisah dari Tabungan Mandiri).</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span><b>Syarat 1 — Mencapai Goal:</b> Total nominal yang terkumpul harus telah mencapai atau melampaui target yang ditentukan.</span>
            </p>
            <p className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span><b>Syarat 2 — Jatuh Tempo Tiba:</b> Tanggal saat penarikan harus sudah mencapai atau melewati tanggal jatuh tempo periode tabungan.</span>
            </p>
          </div>
        </div>

        {showCreate && <CreateBerjangkaModal onClose={() => { setShowCreate(false); fetchTabunganBerjangka(); }} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-indigo-500/10 via-slate-400/5 to-blue-500/10 border border-indigo-300/40 dark:border-indigo-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Tabungan Berjangka
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {items.filter(i => i.status === 'aktif').length} Aktif · Sisa Slot {slotTersedia}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tabungan Berjangka Saya
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Simpanan dengan target nominal dan durasi waktu tertentu. <b>Hanya bisa ditarik jika sudah mencapai goal dalam jangka waktu yang ditentukan.</b>
          </p>
        </div>
        {dapatMembuat && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 cursor-pointer transition-all active:scale-95 flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Buat Baru
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {items.map((tb) => (
          <BerjangkaCard
            key={tb.id}
            tb={tb}
            onSetor={() => setSetorTargetTb(tb)}
            onCairkan={() => setCairkanTargetTb(tb)}
            onBatal={() => handleBatal(tb.id)}
            confirmBatal={confirmBatalId === tb.id}
          />
        ))}
      </div>

      {showCreate && <CreateBerjangkaModal onClose={() => { setShowCreate(false); fetchTabunganBerjangka(); }} />}
      {setorTargetTb && <SetorBerjangkaModal tb={setorTargetTb} onClose={() => { setSetorTargetTb(null); fetchTabunganBerjangka(); }} />}
      {cairkanTargetTb && <CairkanBerjangkaModal tb={cairkanTargetTb} onClose={() => { setCairkanTargetTb(null); fetchTabunganBerjangka(); }} />}
    </div>
  );
};

// ─── Card Component ──────────────────────────────────────────
const BerjangkaCard: React.FC<{
  tb: TabunganBerjangka;
  onSetor: () => void;
  onCairkan: () => void;
  onBatal: () => void;
  confirmBatal: boolean;
}> = ({ tb, onSetor, onCairkan, onBatal, confirmBatal }) => {
  const pct = tb.persentase ?? 0;
  const terkumpul = tb.terkumpul ?? 0;
  const sisa = Math.max((tb.target_nominal ?? 0) - terkumpul, 0);
  const cfg = STATUS_CFG[tb.status] || STATUS_CFG.batal;

  const deadlineDate = tb.tanggal_jatuh_tempo ? new Date(tb.tanggal_jatuh_tempo + 'T00:00:00') : null;
  const isJatuhTempo = tb.is_jatuh_tempo ?? (deadlineDate != null && deadlineDate <= new Date());
  const isGoalReached = tb.is_goal_reached ?? (terkumpul >= tb.target_nominal);
  const canWithdraw = tb.can_withdraw ?? (tb.status === 'aktif' && isGoalReached && isJatuhTempo);

  return (
    <div className={`rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border transition-all ${
      canWithdraw
        ? 'border-emerald-400 dark:border-emerald-600/80 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/20'
        : 'border-slate-200/80 dark:border-slate-700/70 shadow-sm'
    }`}>
      {/* Banner tagihan — periode setoran berkala yang belum dibayar */}
      {tb.status === 'aktif' && (tb.tertunggak?.jumlah_periode ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
              {tb.tertunggak?.jumlah_periode.toLocaleString('id-ID')}{' '}
              {tb.frekuensi_setor === 'harian' ? 'hari' : tb.frekuensi_setor === 'mingguan' ? 'minggu' : 'bulan'} setoran belum dibayar ·{' '}
              {formatRupiah(tb.tertunggak?.nominal ?? 0)}
            </p>
          </div>
          <button
            onClick={onSetor}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold shadow-sm shadow-rose-600/30 cursor-pointer transition-all active:scale-95"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Setor Sekarang
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Target {formatRupiah(tb.target_nominal)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${cfg.cls}`}>
              {cfg.icon} {cfg.label}
            </span>
            {tb.status === 'aktif' && canWithdraw && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3" /> Siap Dicairkan
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Durasi {tb.durasi_bulan} bulan · {tb.frekuensi_label ?? tb.frekuensi_setor} · Anjuran {formatRupiah(tb.nominal_per_periode)}/periode
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terkumpul</div>
          <div className="text-base sm:text-lg font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{formatRupiah(terkumpul)}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progres Capaian Target</span>
          <span className={`text-[11px] font-extrabold ${pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
            {Math.round(pct * 10) / 10}%
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              pct >= 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
            }`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-slate-400">
          <span>Terkumpul: {formatRupiah(terkumpul)}</span>
          <span>Sisa Target: {formatRupiah(sisa)}</span>
        </div>
      </div>

      {/* Status Persyaratan Penarikan (Lock State Notice) */}
      {tb.status === 'aktif' && (
        <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-500" /> Status Syarat Penarikan Dana:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded-xl flex items-center gap-2 ${
              isGoalReached ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {isGoalReached ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />}
              <span>Goal Target: {isGoalReached ? 'Tercapai 100%' : `Kurang ${formatRupiah(sisa)}`}</span>
            </div>
            <div className={`p-2 rounded-xl flex items-center gap-2 ${
              isJatuhTempo ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {isJatuhTempo ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />}
              <span>Jangka Waktu: {isJatuhTempo ? 'Sudah Jatuh Tempo' : `Jatuh tempo ${tb.tanggal_jatuh_tempo || '-'}`}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <InfoPill icon={<Calendar className="w-3.5 h-3.5" />} label="Mulai" value={tb.tanggal_mulai || 'Belum aktif'} />
        <InfoPill icon={<Clock className="w-3.5 h-3.5" />} label="Jatuh Tempo" value={tb.tanggal_jatuh_tempo || '-'} />
        <InfoPill icon={<Repeat className="w-3.5 h-3.5" />} label="Frekuensi" value={tb.frekuensi_label ?? tb.frekuensi_setor ?? '-'} />
        <InfoPill icon={<Wallet className="w-3.5 h-3.5" />} label="Per Periode" value={formatRupiah(tb.nominal_per_periode)} />
      </div>

      {tb.catatan && (
        <p className="text-[11px] text-slate-400 mb-3 italic">Catatan: "{tb.catatan}"</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        {tb.status === 'aktif' && !isJatuhTempo && (
          <button
            onClick={onSetor}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer transition-all active:scale-95"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Setor ke Tabungan Ini
          </button>
        )}

        {tb.status === 'aktif' && (
          canWithdraw ? (
            <button
              onClick={onCairkan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md shadow-blue-600/25 cursor-pointer transition-all active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4" /> Cairkan Tabungan ({formatRupiah(terkumpul)})
            </button>
          ) : (
            <button
              disabled
              title="Tabungan berjangka hanya bisa ditarik jika sudah mencapai goal target dan melewati tanggal jatuh tempo."
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Penarikan Terkunci
            </button>
          )
        )}

        {(tb.status === 'menunggu_approval' || tb.status === 'aktif') && (
          <button
            onClick={onBatal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer transition-all ml-auto"
          >
            <XCircle className="w-3.5 h-3.5" /> {confirmBatal ? 'Yakin batalkan?' : 'Batalkan'}
          </button>
        )}

        {tb.status === 'menunggu_approval' && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold ml-auto flex items-center gap-1">
            <Hourglass className="w-3.5 h-3.5" /> Menunggu persetujuan admin
          </span>
        )}

        {tb.status === 'pembatalan_diajukan' && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold ml-auto flex items-center gap-1">
            <Hourglass className="w-3.5 h-3.5" /> Menunggu verifikasi pembatalan admin. Saldo akan dikembalikan utuh.
          </span>
        )}

        {tb.status === 'selesai' && (
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold ml-auto flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Telah Berhasil Dicairkan
          </span>
        )}
      </div>
    </div>
  );
};

const InfoPill: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 px-2.5 py-2">
    <div className="flex items-center gap-1 text-slate-400 mb-0.5">
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">{value}</div>
  </div>
);

