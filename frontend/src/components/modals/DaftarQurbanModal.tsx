import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah } from '../../utils/format';
import {
  X,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface DaftarQurbanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DaftarQurbanModal: React.FC<DaftarQurbanModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    periodeQurban,
    hewanQurban,
    daftarTabunganQurban,
    showToast
  } = useApp();

  const activePeriode = periodeQurban.find(p => p.status === 'aktif') || periodeQurban[0];
  const availableHewan = hewanQurban.filter(h => h.status_aktif && h.periode_qurban_id === activePeriode?.id);

  const [selectedHewanId, setSelectedHewanId] = useState<number>(availableHewan[0]?.id || 1);
  const [jumlahHewan, setJumlahHewan] = useState<number>(1);
  const [catatan, setCatatan] = useState<string>('Keluarga Besar Bpk/Ibu Nasabah');

  if (!isOpen) return null;

  const selectedHewan = hewanQurban.find(h => h.id === selectedHewanId);
  const totalTargetDana = (selectedHewan?.harga_per_unit || 0) * jumlahHewan;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriode) {
      showToast('Tidak ada periode qurban yang aktif saat ini', 'error');
      return;
    }
    if (!selectedHewan) {
      showToast('Pilih hewan qurban terlebih dahulu', 'error');
      return;
    }

    daftarTabunganQurban({
      periode_qurban_id: activePeriode.id,
      hewan_qurban_id: selectedHewan.id,
      jumlah_hewan: jumlahHewan,
      target_dana: totalTargetDana,
      catatan
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Pendaftaran Tabungan Qurban Baru
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activePeriode?.nama_periode || `Periode Qurban ${activePeriode?.tahun ?? new Date().getFullYear()}`}
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
          {/* Pilihan Hewan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Pilih Hewan Qurban
            </label>
            <div className="space-y-2">
              {availableHewan.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelectedHewanId(h.id)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedHewanId === h.id
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <QurbanIcon jenisHewan={h.jenis_hewan} className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      {h.jenis_hewan}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {h.berat_rata_rata} • {h.deskripsi}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      Rp {formatRupiah(h.harga_per_unit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Jumlah Hewan / Bagian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Jumlah Ekor / Bagian
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setJumlahHewan(Math.max(1, jumlahHewan - 1))}
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                -
              </button>
              <span className="font-extrabold text-base text-slate-900 dark:text-white px-2">
                {jumlahHewan}
              </span>
              <button
                type="button"
                onClick={() => setJumlahHewan(jumlahHewan + 1)}
                className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Total Target Dana Calculation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Target Dana Tabungan
              </span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Rp {formatRupiah(totalTargetDana)}
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Bisa dicicil bertahap
            </span>
          </div>

          {/* Catatan / Atas Nama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Qurban Atas Nama
            </label>
            <input
              type="text"
              placeholder="Contoh: Ahmad Fauzi bin Mahmud & Keluarga"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              required
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Actions */}
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
              Konfirmasi Pendaftaran
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
