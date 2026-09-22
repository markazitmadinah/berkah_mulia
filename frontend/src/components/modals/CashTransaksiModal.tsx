import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RencanaCashOption } from '../../types';
import { api } from '../../lib/api';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
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
  initialUserId?: number;
  initialJenisId?: number;
  initialBerjangkaId?: number;
  initialKonfigurasiId?: number;
  initialNominal?: number;
}

export const CashTransaksiModal: React.FC<CashTransaksiModalProps> = ({
  isOpen,
  onClose,
  initialUserId,
  initialJenisId,
  initialBerjangkaId,
  initialKonfigurasiId,
  initialNominal
}) => {
  const {
    users,
    jenisTabungan,
    pendaftaranQurban,
    hewanQurban,
    tabunganBerjangka,
    fetchTabunganBerjangka,
    inputTransaksiCash,
    showToast
  } = useApp();

  const activeUsers = users.filter(u => u.status === 'active' && u.role === 'user');

  const pendaftaranQurbanAktif = pendaftaranQurban.filter((p) => p.status === 'menabung');

  const [selectedUserId, setSelectedUserId] = useState<number>(activeUsers[0]?.id || 2);
  const [selectedJenisId, setSelectedJenisId] = useState<number>(jenisTabungan[0]?.id || 1);
  const [nominal, setNominal] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('Setoran tunai via teller kantor');
  const [selectedQurbanId, setSelectedQurbanId] = useState<number>(pendaftaranQurbanAktif[0]?.id || 1);
  const [selectedBerjangkaId, setSelectedBerjangkaId] = useState<number>(0);
  const [selectedKonfigurasiId, setSelectedKonfigurasiId] = useState<number | undefined>(undefined);
  const [rencanaOptions, setRencanaOptions] = useState<RencanaCashOption[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTabunganBerjangka();
    if (initialUserId) setSelectedUserId(initialUserId);
    if (initialJenisId) setSelectedJenisId(initialJenisId);
    if (initialBerjangkaId) setSelectedBerjangkaId(initialBerjangkaId);
    if (initialKonfigurasiId) setSelectedKonfigurasiId(initialKonfigurasiId);
    if (initialNominal && initialNominal > 0) setNominal(initialNominal.toLocaleString('id-ID'));
  }, [isOpen, initialUserId, initialJenisId, initialBerjangkaId, initialKonfigurasiId, initialNominal]);

  useEffect(() => {
    const list = pendaftaranQurbanAktif.filter((p) => p.user_id === selectedUserId);
    if (list.length > 0 && !list.some((p) => p.id === selectedQurbanId)) {
      setSelectedQurbanId(list[0].id);
    }
  }, [selectedUserId, pendaftaranQurbanAktif]);

  // Rencana emas aktif milik nasabah — diambil sendiri agar tidak ambigu
  // saat nasabah punya lebih dari satu rencana (tanpa perlu dikirim pemanggil).
  useEffect(() => {
    if (!isOpen || !selectedUserId) return;
    const jenis = jenisTabungan.find((j) => j.id === selectedJenisId);
    if (jenis?.tipe !== 'emas') {
      setRencanaOptions([]);
      return;
    }

    let cancelled = false;
    api.get<RencanaCashOption[]>(`/admin/users/${selectedUserId}/rencana-emas`)
      .then((res) => {
        if (cancelled) return;
        setRencanaOptions(res.data);
        if (res.data.length === 1) setSelectedKonfigurasiId(res.data[0].konfigurasi_id);
      })
      .catch(() => { if (!cancelled) setRencanaOptions([]); });
    return () => { cancelled = true; };
  }, [isOpen, selectedUserId, selectedJenisId, jenisTabungan]);

  if (!isOpen) return null;

  const selectedJenis = jenisTabungan.find(j => j.id === selectedJenisId);

  // Ambil akun berjangka milik nasabah terpilih (aktif / diajukan) untuk pencatatan setoran
  const berjangkaList = (tabunganBerjangka?.items ?? []).filter(
    (t) => t.user_id === selectedUserId && t.status !== 'batal'
  );

  const nominalValue = parseRupiah(nominal);
  const rencanaTerpilih = rencanaOptions.find((r) => r.konfigurasi_id === selectedKonfigurasiId);
  const qurbanTerpilih = pendaftaranQurbanAktif.find((p) => p.id === selectedQurbanId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalValue <= 0) {
      showToast('Nominal harus lebih besar dari 0', 'error');
      return;
    }

    if (selectedJenis?.tipe === 'emas' && rencanaTerpilih && nominalValue < rencanaTerpilih.nominal_per_periode) {
      showToast(`Nominal minimal untuk rencana ini adalah Rp ${formatRupiah(rencanaTerpilih.nominal_per_periode)} (1 periode setoran).`, 'error');
      return;
    }

    if (selectedJenis?.tipe === 'qurban' && qurbanTerpilih?.nominal_per_periode && nominalValue < qurbanTerpilih.nominal_per_periode) {
      showToast(`Nominal minimal untuk target qurban ini adalah Rp ${formatRupiah(qurbanTerpilih.nominal_per_periode)} (1 periode setoran ${qurbanTerpilih.frekuensi_label?.toLowerCase() || 'bulanan'}).`, 'error');
      return;
    }

    const isBerjangka = selectedJenis?.sub_jenis === 'berjangka';
    if (isBerjangka && !selectedBerjangkaId) {
      showToast('Pilih akun tabungan berjangka terlebih dahulu.', 'error');
      return;
    }

    if (selectedJenis?.tipe === 'emas' && rencanaOptions.length > 0 && !selectedKonfigurasiId) {
      showToast('Pilih rencana setoran terlebih dahulu.', 'error');
      return;
    }

    inputTransaksiCash({
      user_id: selectedUserId,
      jenis_tabungan_id: selectedJenisId,
      nominal: nominalValue,
      catatan_teller: catatan,
      pendaftaran_qurban_id: selectedJenis?.tipe === 'qurban' ? selectedQurbanId : undefined,
      tabungan_berjangka_id: isBerjangka ? selectedBerjangkaId : undefined,
      konfigurasi_id: selectedJenis?.tipe === 'emas' ? selectedKonfigurasiId : undefined
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
              onChange={(e) => {
                setSelectedUserId(Number(e.target.value));
                setSelectedKonfigurasiId(undefined);
                setRencanaOptions([]);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.nomor_anggota || u.username})
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
              onChange={(e) => {
                setSelectedJenisId(Number(e.target.value));
                setSelectedKonfigurasiId(undefined);
                setRencanaOptions([]);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {jenisTabungan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nama} ({j.tipe.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Rencana Emas selected */}
          {rencanaOptions.length > 0 && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Rencana Setoran (Tabungan Emas)
              </label>
              <select
                value={selectedKonfigurasiId ?? ''}
                onChange={(e) => {
                  const kId = Number(e.target.value);
                  setSelectedKonfigurasiId(kId || undefined);
                  const rencana = rencanaOptions.find((r) => r.konfigurasi_id === kId);
                  if (rencana) setNominal(rencana.nominal_per_periode.toLocaleString('id-ID'));
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="">— Pilih Rencana —</option>
                {rencanaOptions.map((r) => (
                  <option key={r.konfigurasi_id} value={r.konfigurasi_id}>
                    Rencana Rp {r.nominal_per_periode.toLocaleString('id-ID')} ({r.frekuensi_label})
                  </option>
                ))}
              </select>
            </div>
          )}

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
                {pendaftaranQurbanAktif
                    .filter((p) => p.user_id === selectedUserId)
                    .map((p) => {
                  const h = hewanQurban.find(hw => hw.id === p.hewan_qurban_id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.user_name} - {p.jumlah_hewan}x {h?.jenis_hewan} (Sisa: Rp {formatRupiah(p.target_dana - p.total_terkumpul)})
                    </option>
                  );
                })}
              </select>
              {qurbanTerpilih?.nominal_per_periode ? (
                <p className="text-[9px] text-slate-400 mt-1">
                  Kewajiban / {qurbanTerpilih.frekuensi_label?.toLowerCase() || 'bulan'}: <strong className="text-slate-600 dark:text-slate-300">Rp {formatRupiah(qurbanTerpilih.nominal_per_periode)}</strong>
                </p>
              ) : null}
            </div>
          )}

          {/* Akun berjangka jika produk berjangka terpilih */}
          {selectedJenis?.sub_jenis === 'berjangka' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Akun Tabungan Berjangka
              </label>
              <select
                value={selectedBerjangkaId}
                onChange={(e) => setSelectedBerjangkaId(Number(e.target.value))}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value={0}>— Pilih Akun —</option>
                {berjangkaList.map((t) => (
                  <option key={t.id} value={t.id}>
                    Berjangka {t.durasi_bulan} bln — Target Rp {formatRupiah(t.target_nominal)} ({t.status})
                  </option>
                ))}
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
                inputMode="decimal"
                value={nominal}
                onChange={(e) => setNominal(fmtRupiahTyping(e.target.value))}
                onBlur={() => setNominal(fmtRupiahBlur(nominal))}
                placeholder="Contoh: 1.000.000,50"
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
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-600/25 cursor-pointer"
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
