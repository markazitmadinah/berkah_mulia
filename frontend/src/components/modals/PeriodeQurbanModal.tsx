import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Calendar
} from 'lucide-react';
import { PeriodeQurban } from '../../types';

interface PeriodeQurbanModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodeToEdit?: PeriodeQurban | null;
}

export const PeriodeQurbanModal: React.FC<PeriodeQurbanModalProps> = ({
  isOpen,
  onClose,
  periodeToEdit
}) => {
  const { createPeriodeQurban, updatePeriodeQurban, showToast } = useApp();

  const [tahun, setTahun] = useState<string>('2026');
  const [tglBuka, setTglBuka] = useState<string>('2026-01-01');
  const [tglTutup, setTglTutup] = useState<string>('2026-05-30');
  const [tglIdulAdha, setTglIdulAdha] = useState<string>('2026-06-06');
  const [tglPencairan, setTglPencairan] = useState<string>('2026-06-01');
  const [status, setStatus] = useState<'aktif' | 'selesai' | 'ditutup' | 'draft'>('aktif');

  useEffect(() => {
    if (periodeToEdit) {
      setTahun(String(periodeToEdit.tahun));
      setTglBuka(periodeToEdit.tanggal_buka_pendaftaran);
      setTglTutup(periodeToEdit.tanggal_tutup_pendaftaran);
      setTglIdulAdha(periodeToEdit.tanggal_idul_adha);
      setTglPencairan(periodeToEdit.tanggal_pencairan);
      setStatus(periodeToEdit.status);
    } else {
      setTahun('2026');
      setTglBuka('2026-01-01');
      setTglTutup('2026-05-30');
      setTglIdulAdha('2026-06-06');
      setTglPencairan('2026-06-01');
      setStatus('aktif');
    }
  }, [periodeToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tahun.trim()) {
      showToast('Tahun periode wajib diisi', 'error');
      return;
    }

    const payload = {
      tahun: Number(tahun),
      tanggal_buka_pendaftaran: tglBuka,
      tanggal_tutup_pendaftaran: tglTutup,
      tanggal_idul_adha: tglIdulAdha,
      tanggal_pencairan: tglPencairan,
      status
    };

    if (periodeToEdit) {
      updatePeriodeQurban(periodeToEdit.id, payload);
    } else {
      createPeriodeQurban(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            {periodeToEdit ? 'Edit Periode Qurban' : 'Buat Periode Qurban Baru'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Periode
            </label>
            <p className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Qurban Berkah {tahun} M
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tahun Periode
              </label>
              <input
                type="number"
                required
                min={2024}
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                placeholder="Contoh: 2026"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Buka Pendaftaran
              </label>
              <input
                type="date"
                required
                value={tglBuka}
                onChange={(e) => setTglBuka(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Tutup Pendaftaran
              </label>
              <input
                type="date"
                required
                value={tglTutup}
                onChange={(e) => setTglTutup(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Estimasi Hari Idul Adha
              </label>
              <input
                type="date"
                required
                value={tglIdulAdha}
                onChange={(e) => setTglIdulAdha(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Target Pencairan
              </label>
              <input
                type="date"
                required
                value={tglPencairan}
                onChange={(e) => setTglPencairan(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Status Periode
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="aktif">Aktif (Pendaftaran Dibuka)</option>
              <option value="draft">Draft (Belum Dibuka)</option>
              {periodeToEdit && (
                <>
                  <option value="ditutup">Ditutup</option>
                  <option value="selesai">Selesai (Diarsipkan)</option>
                </>
              )}
            </select>
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
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md cursor-pointer"
            >
              {periodeToEdit ? 'Simpan Periode' : 'Buat Periode'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
