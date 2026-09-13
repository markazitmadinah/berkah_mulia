import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import {
  X,
  ArrowUpRight,
  Wallet,
  AlertCircle,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface TarikModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TarikModal: React.FC<TarikModalProps> = ({ isOpen, onClose }) => {
  const {
    userTabunganMandiriTotal,
    jenisTabungan,
    createPenarikanUser,
    showToast
  } = useApp();

  const [nominal, setNominal] = useState<string>('');
  const [bankTujuan, setBankTujuan] = useState<string>('');
  const [noRekTujuan, setNoRekTujuan] = useState<string>('');
  const [atasNama, setAtasNama] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('');

  if (!isOpen) return null;

  const nominalValue = parseRupiah(nominal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalValue <= 0) {
      showToast('Nominal penarikan harus lebih dari 0', 'error');
      return;
    }

    if (nominalValue > userTabunganMandiriTotal) {
      showToast('Saldo tabungan mandiri Anda tidak mencukupi untuk penarikan ini', 'error');
      return;
    }

    if (!bankTujuan.trim() || !noRekTujuan.trim() || !atasNama.trim()) {
      showToast('Lengkapi data bank tujuan (Nama Bank, No. Rekening, Atas Nama) terlebih dahulu', 'error');
      return;
    }

    const mandiriTab = jenisTabungan.find(j => j.tipe === 'pribadi' && j.sub_jenis === 'mandiri') 
      || jenisTabungan.find(j => j.tipe === 'pribadi' && j.allow_withdrawal)
      || jenisTabungan.find(j => j.tipe === 'pribadi');
    if (!mandiriTab) return;

    createPenarikanUser({
      jenis_tabungan_id: mandiriTab.id,
      nominal: nominalValue,
      catatan_user: `Pencairan ke ${bankTujuan} (${noRekTujuan} a.n ${atasNama}). ${catatan}`
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Tarik Saldo Tabungan Mandiri
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Permohonan pencairan dana simpanan sukarela Wadi'ah (terpisah dari Tabungan Berjangka)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Saldo info card */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Saldo Mandiri Tersedia
              </span>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                Rp {formatRupiah(userTabunganMandiriTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNominal(userTabunganMandiriTotal.toLocaleString('id-ID'))}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 cursor-pointer"
            >
              Tarik Semua
            </button>
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nominal yang Ingin Ditarik (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={nominal}
                onChange={(e) => setNominal(fmtRupiahTyping(e.target.value))}
                onBlur={() => setNominal(fmtRupiahBlur(nominal))}
                placeholder="Contoh: 1.000.000,50"
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Bank Tujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Bank Tujuan Pencairan
              </label>
              <input
                type="text"
                value={bankTujuan}
                onChange={(e) => setBankTujuan(e.target.value)}
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
                value={noRekTujuan}
                onChange={(e) => setNoRekTujuan(e.target.value)}
                required
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Atas Nama Rekening Penerima
            </label>
            <input
              type="text"
              value={atasNama}
              onChange={(e) => setAtasNama(e.target.value)}
              required
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Alasan / Catatan Penarikan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Kebutuhan keluarga mendesak"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-600/25 transition-all cursor-pointer"
            >
              Ajukan Penarikan
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
