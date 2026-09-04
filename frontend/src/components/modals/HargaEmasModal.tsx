import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Coins,
  Calendar,
  Sparkles
} from 'lucide-react';
import { HargaEmasHarian } from '../../types';

const fmtNominal = (v: string): string =>
  v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const parseNominal = (v: string): number => Number(v.replace(/\D/g, '')) || 0;

interface HargaEmasModalProps {
  isOpen: boolean;
  onClose: () => void;
  hargaToEdit?: HargaEmasHarian | null;
}

export const HargaEmasModal: React.FC<HargaEmasModalProps> = ({
  isOpen,
  onClose,
  hargaToEdit
}) => {
  const { inputHargaEmas, showToast } = useApp();

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [hargaPerGram, setHargaPerGram] = useState<string>('1.215.000');
  const [tagihanHarian, setTagihanHarian] = useState<string>('50.000');
  const [catatan, setCatatan] = useState<string>('Penyesuaian kurs emas LM Antam 99.99%');

  useEffect(() => {
    if (hargaToEdit) {
      setTanggal(new Date().toISOString().slice(0, 10));
      setHargaPerGram(fmtNominal(String(hargaToEdit.harga_per_gram)));
      setTagihanHarian(fmtNominal(String(hargaToEdit.tagihan_harian_default || 50000)));
      setCatatan(`Update penyesuaian dari versi tanggal ${hargaToEdit.tanggal}`);
    }
  }, [hargaToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hargaPerGramNum = parseNominal(hargaPerGram);
    if (hargaPerGramNum <= 0) {
      showToast('Harga per gram harus lebih dari 0', 'error');
      return;
    }

    inputHargaEmas({
      tanggal,
      harga_per_gram: hargaPerGramNum,
      tagihan_harian_default: parseNominal(tagihanHarian),
      catatan
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Input Harga Emas Baru
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tanggal Berlaku
            </label>
            <input
              type="date"
              required
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Harga Acuan Emas per Gram (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={fmtNominal(hargaPerGram)}
                onChange={(e) => setHargaPerGram(fmtNominal(e.target.value))}
                placeholder="Contoh: 1.215.000,00"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Rekomendasi Setoran Harian (Rp)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={fmtNominal(tagihanHarian)}
              onChange={(e) => setTagihanHarian(fmtNominal(e.target.value))}
              placeholder="Contoh: 50.000,00"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan Penyesuaian
            </label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

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
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md cursor-pointer"
            >
              Simpan Versi Baru
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
