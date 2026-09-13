import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Layers
} from 'lucide-react';
import { HewanQurban } from '../../types';
import { parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';

interface HewanQurbanModalProps {
  isOpen: boolean;
  onClose: () => void;
  hewanToEdit?: HewanQurban | null;
}

export const HewanQurbanModal: React.FC<HewanQurbanModalProps> = ({
  isOpen,
  onClose,
  hewanToEdit
}) => {
  const { periodeQurban, createHewanQurban, updateHewanQurban, showToast } = useApp();

  const [periodeId, setPeriodeId] = useState<number>(periodeQurban[0]?.id || 1);
  const [jenisHewan, setJenisHewan] = useState<string>('Kambing / Domba Standar');
  const [hargaInput, setHargaInput] = useState<string>('3.000.000');
  const [beratRataRata, setBeratRataRata] = useState<string>('25 - 30 kg');
  const [deskripsi, setDeskripsi] = useState<string>('Hewan sehat, terawat, cukup umur sesuai syariat');
  const [statusAktif, setStatusAktif] = useState<boolean>(true);

  useEffect(() => {
    if (hewanToEdit) {
      setPeriodeId(hewanToEdit.periode_qurban_id);
      setJenisHewan(hewanToEdit.jenis_hewan);
      setHargaInput(fmtRupiahTyping(String(Number(hewanToEdit.harga_per_unit) || 0)));
      setBeratRataRata(hewanToEdit.berat_rata_rata || '');
      setDeskripsi(hewanToEdit.deskripsi || '');
      setStatusAktif(hewanToEdit.status_aktif);
    } else {
      setPeriodeId(periodeQurban[0]?.id || 1);
      setJenisHewan('Kambing / Domba Standar');
      setHargaInput('3.000.000');
      setBeratRataRata('25 - 30 kg');
      setDeskripsi('Hewan sehat, terawat, cukup umur sesuai syariat');
      setStatusAktif(true);
    }
  }, [hewanToEdit?.id, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hargaPerUnit = parseRupiah(hargaInput);
    if (!jenisHewan.trim() || !(hargaPerUnit > 0)) {
      showToast('Jenis hewan dan harga per unit wajib diisi', 'error');
      return;
    }

    if (hewanToEdit) {
      updateHewanQurban(hewanToEdit.id, {
        periode_qurban_id: periodeId,
        jenis_hewan: jenisHewan,
        harga_per_unit: Number(hargaPerUnit),
        berat_rata_rata: beratRataRata,
        deskripsi,
        status_aktif: statusAktif
      });
    } else {
      createHewanQurban({
        periode_qurban_id: periodeId,
        jenis_hewan: jenisHewan,
        harga_per_unit: Number(hargaPerUnit),
        berat_rata_rata: beratRataRata,
        deskripsi,
        status_aktif: statusAktif
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            {hewanToEdit ? 'Edit Hewan Qurban' : 'Tambah Hewan Qurban Baru'}
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
              Periode Qurban
            </label>
            <select
              value={periodeId}
              onChange={(e) => setPeriodeId(Number(e.target.value))}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              {periodeQurban.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_periode} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama / Jenis Hewan
            </label>
            <input
              type="text"
              required
              value={jenisHewan}
              onChange={(e) => setJenisHewan(e.target.value)}
              placeholder="Contoh: Sapi 1/7 Bagian (Standar)"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Harga per Ekor / Bagian (Rp)
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={fmtRupiahTyping(hargaInput)}
                onChange={(e) => setHargaInput(fmtRupiahTyping(e.target.value))}
                onBlur={() => setHargaInput(fmtRupiahBlur(hargaInput))}
                placeholder="Contoh: 3.000.000,00"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-xs text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Bobot Rata-rata
              </label>
              <input
                type="text"
                value={beratRataRata}
                onChange={(e) => setBeratRataRata(e.target.value)}
                placeholder="Contoh: 28 - 32 kg"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="w-full p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Status Ketersediaan
            </label>
            <select
              value={statusAktif ? 'true' : 'false'}
              onChange={(e) => setStatusAktif(e.target.value === 'true')}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="true">Tersedia (Bisa Dipilih Nasabah)</option>
              <option value="false">Habis / Ditutup</option>
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
              {hewanToEdit ? 'Simpan Perubahan' : 'Tambah Hewan'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
