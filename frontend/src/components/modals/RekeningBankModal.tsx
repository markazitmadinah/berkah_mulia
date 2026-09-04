import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Landmark,
  Building2
} from 'lucide-react';
import { RekeningBank } from '../../types';

interface RekeningBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  rekToEdit?: RekeningBank | null;
}

export const RekeningBankModal: React.FC<RekeningBankModalProps> = ({
  isOpen,
  onClose,
  rekToEdit
}) => {
  const { createRekeningBank, updateRekeningBank, showToast } = useApp();

  const [namaBank, setNamaBank] = useState<string>('');
  const [noRekening, setNoRekening] = useState<string>('');
  const [atasNama, setAtasNama] = useState<string>('KSPPS Berkah Mulia');
  const [cabang, setCabang] = useState<string>('Kantor Cabang Utama');
  const [logoColor, setLogoColor] = useState<string>('#10B981');
  const [statusAktif, setStatusAktif] = useState<boolean>(true);

  useEffect(() => {
    if (rekToEdit) {
      setNamaBank(rekToEdit.nama_bank);
      setNoRekening(rekToEdit.no_rekening);
      setAtasNama(rekToEdit.atas_nama);
      setCabang(rekToEdit.cabang || '');
      setLogoColor(rekToEdit.logo_color || '#10B981');
      setStatusAktif(rekToEdit.status_aktif);
    } else {
      setNamaBank('');
      setNoRekening('');
      setAtasNama('KSPPS Berkah Mulia Syariah');
      setCabang('Kantor Cabang Utama');
      setLogoColor('#10B981');
      setStatusAktif(true);
    }
  }, [rekToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBank.trim() || !noRekening.trim() || !atasNama.trim()) {
      showToast('Nama bank, no rekening, dan atas nama wajib diisi', 'error');
      return;
    }

    if (rekToEdit) {
      updateRekeningBank(rekToEdit.id, {
        nama_bank: namaBank,
        no_rekening: noRekening,
        atas_nama: atasNama,
        cabang,
        logo_color: logoColor,
        status_aktif: statusAktif
      });
    } else {
      createRekeningBank({
        nama_bank: namaBank,
        no_rekening: noRekening,
        atas_nama: atasNama,
        cabang,
        logo_color: logoColor,
        status_aktif: statusAktif
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            {rekToEdit ? 'Edit Rekening Bank' : 'Tambah Rekening Bank Koperasi'}
          </h3>
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
              Nama Bank
            </label>
            <input
              type="text"
              required
              value={namaBank}
              onChange={(e) => setNamaBank(e.target.value)}
              placeholder="Contoh: Bank Syariah Indonesia (BSI)"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor Rekening
            </label>
            <input
              type="text"
              required
              value={noRekening}
              onChange={(e) => setNoRekening(e.target.value)}
              placeholder="Contoh: 7123456789"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Atas Nama Rekening
            </label>
            <input
              type="text"
              required
              value={atasNama}
              onChange={(e) => setAtasNama(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Kantor Cabang
              </label>
              <input
                type="text"
                value={cabang}
                onChange={(e) => setCabang(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Warna Badge Bank
              </label>
              <input
                type="color"
                value={logoColor}
                onChange={(e) => setLogoColor(e.target.value)}
                className="w-full h-9 rounded-2xl border border-slate-200 dark:border-slate-700 p-1 cursor-pointer bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Status Penggunaan
            </label>
            <select
              value={statusAktif ? 'true' : 'false'}
              onChange={(e) => setStatusAktif(e.target.value === 'true')}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="true">Aktif (Ditampilkan ke Nasabah)</option>
              <option value="false">Nonaktif (Disembunyikan)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md cursor-pointer"
            >
              {rekToEdit ? 'Simpan Perubahan' : 'Tambah Rekening'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
