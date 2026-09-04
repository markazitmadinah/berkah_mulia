import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah } from '../../utils/format';
import {
  X,
  Coins,
  Wallet,
  CheckCircle2,
  DollarSign,
  UserCheck
} from 'lucide-react';

interface CashTransaksiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashTransaksiModal: React.FC<CashTransaksiModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    users,
    jenisTabungan,
    pendaftaranQurban,
    hewanQurban,
    inputTransaksiCash,
    showToast
  } = useApp();

  const activeUsers = users.filter(u => u.status === 'active' && u.role === 'user');

  const [selectedUserId, setSelectedUserId] = useState<number>(activeUsers[0]?.id || 2);
  const [selectedJenisId, setSelectedJenisId] = useState<number>(jenisTabungan[0]?.id || 1);
  const [nominal, setNominal] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('Setoran tunai via teller kantor');
  const [selectedQurbanId, setSelectedQurbanId] = useState<number>(pendaftaranQurban[0]?.id || 1);

  if (!isOpen) return null;

  const selectedJenis = jenisTabungan.find(j => j.id === selectedJenisId);

  const nominalValue = Number(nominal.replace(/\./g, ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalValue <= 0) {
      showToast('Nominal harus lebih besar dari 0', 'error');
      return;
    }

    inputTransaksiCash({
      user_id: selectedUserId,
      jenis_tabungan_id: selectedJenisId,
      nominal: nominalValue,
      catatan_teller: catatan,
      pendaftaran_qurban_id: selectedJenis?.tipe === 'qurban' ? selectedQurbanId : undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Otomatis Terverifikasi</span>
            </div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              Input Transaksi Setoran Tunai (Teller)
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
          {/* Pilih Nasabah */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Pilih Nasabah
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.nomor_anggota || u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Produk */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Produk Tabungan
            </label>
            <select
              value={selectedJenisId}
              onChange={(e) => setSelectedJenisId(Number(e.target.value))}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {jenisTabungan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nama} ({j.tipe.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Qurban target if qurban selected */}
          {selectedJenis?.tipe === 'qurban' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Pendaftaran Qurban
              </label>
              <select
                value={selectedQurbanId}
                onChange={(e) => setSelectedQurbanId(Number(e.target.value))}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {pendaftaranQurban.map((p) => {
                  const h = hewanQurban.find(hw => hw.id === p.hewan_qurban_id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.user_name} - {p.jumlah_hewan}x {h?.jenis_hewan} (Sisa: Rp {formatRupiah(p.target_dana - p.total_terkumpul)})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Nominal Input */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nominal Diterima Kasir/Teller (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={nominal}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setNominal(digits ? Number(digits).toLocaleString('id-ID') : '');
                }}
                placeholder="Masukkan nominal, contoh: 1.000.000"
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Catatan Teller */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan Teller
            </label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
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
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer"
            >
              Simpan Transaksi Cash
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
