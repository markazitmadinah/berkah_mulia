import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import { todayISO } from '../../utils/rekapTransaksi';
import { X, CheckCircle2, Wallet } from 'lucide-react';

interface KasOperasionalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KasOperasionalModal: React.FC<KasOperasionalModalProps> = ({ isOpen, onClose }) => {
  const { inputKasOperasional, showToast } = useApp();

  const [jenisKas, setJenisKas] = useState<'setor' | 'tarik'>('setor');
  const [nominal, setNominal] = useState<string>('');
  const [deskripsi, setDeskripsi] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>(todayISO());

  useEffect(() => {
    if (!isOpen) return;
    setJenisKas('setor');
    setNominal('');
    setDeskripsi('');
    setTanggal(todayISO());
  }, [isOpen]);

  if (!isOpen) return null;

  const nominalValue = parseRupiah(nominal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalValue < 1000) {
      showToast('Nominal minimal Rp 1.000.', 'error');
      return;
    }
    if (!deskripsi.trim()) {
      showToast('Deskripsi wajib diisi.', 'error');
      return;
    }

    inputKasOperasional({
      jenis_transaksi: jenisKas,
      nominal: nominalValue,
      deskripsi: deskripsi.trim(),
      tanggal: tanggal || undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Otomatis Terverifikasi</span>
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Input Kas Operasional (Belanja & Biaya)
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {/* Jenis Aliran Kas */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900">
              {([
                { key: 'setor', label: 'Pemasukan Kas' },
                { key: 'tarik', label: 'Pengeluaran Kas' }
              ] as const).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setJenisKas(o.key)}
                  className={`py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                    jenisKas === o.key
                      ? o.key === 'setor'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="flex items-start gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-slate-900 rounded-xl p-3">
              <Wallet className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>Tidak terikat rekening nasabah. Hanya aliran kas koperasi — tercatat di rekapitulasi & pembukuan tanpa mengubah saldo tabungan nasabah.</span>
            </p>

            {/* Deskripsi */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Deskripsi / Keperluan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Contoh: Beli alat tulis kantor, bayar listrik, langganan internet…"
                required
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Nominal */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {jenisKas === 'setor' ? 'Nominal Diterima (Rp)' : 'Nominal Dibayarkan (Rp)'} <span className="text-rose-500">*</span>
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
                  placeholder="Contoh: 250.000"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Tanggal */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Submit */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-600/25 cursor-pointer"
              >
                Simpan Kas Operasional
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};