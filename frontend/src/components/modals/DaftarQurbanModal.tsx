import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import { FrekuensiSetoran, User } from '../../types';
import {
  X,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Repeat,
  Target
} from 'lucide-react';

interface DaftarQurbanModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
  users?: User[];
}

const FREKUENSI_LABEL: Record<FrekuensiSetoran, string> = {
  harian: 'Harian',
  mingguan: 'Mingguan',
  bulanan: 'Bulanan'
};

export const DaftarQurbanModal: React.FC<DaftarQurbanModalProps> = ({
  isOpen,
  onClose,
  userId,
  users
}) => {
  const {
    periodeQurban,
    hewanQurban,
    daftarTabunganQurban,
    daftarQurbanAdmin,
    showToast
  } = useApp();

  const [localUserId, setLocalUserId] = useState<number>(0);
  const isAdmin = userId != null || (users?.length ?? 0) > 0;

  const activePeriode = periodeQurban.find(p => p.status === 'aktif') || periodeQurban[0];
  const availableHewan = hewanQurban.filter(h => h.status_aktif && h.periode_qurban_id === activePeriode?.id);

  const [selectedHewanId, setSelectedHewanId] = useState<number>(availableHewan[0]?.id || 1);
  const [jumlahHewan, setJumlahHewan] = useState<number>(1);
  const [catatan, setCatatan] = useState<string>('Keluarga Besar Bpk/Ibu Nasabah');
  const [frekuensi, setFrekuensi] = useState<FrekuensiSetoran>('bulanan');
  const [nominalPeriode, setNominalPeriode] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const first = availableHewan[0]?.id;
      if (first) setSelectedHewanId(first);
      setFrekuensi('bulanan');
      setNominalPeriode('');
      setLocalUserId(userId ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const selectedHewan = hewanQurban.find(h => h.id === selectedHewanId);
  const totalTargetDana = (selectedHewan?.harga_per_unit || 0) * jumlahHewan;

  // Hitung ulang rencana otomatis — satu sumber dengan nominalPerPeriode() backend
  // (QurbanTargetService): nominal = round(ceil(target / totalPeriode * 100) / 100, 2).
  const diffInMonths = (start: Date, end: Date): number => {
    const s = new Date(start), e = new Date(end);
    let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (months > 0 && s.getDate() > e.getDate()) months -= 1;
    else if (months < 0 && s.getDate() < e.getDate()) months += 1;
    months = Math.abs(months);
    const floorEnd = new Date(s.getFullYear(), s.getMonth() + months, s.getDate());
    if (floorEnd >= e) return months;
    const ceilEnd = new Date(s.getFullYear(), s.getMonth() + months + 1, s.getDate());
    const daysToFloor = Math.round((e.getTime() - floorEnd.getTime()) / 86400000);
    const daysToCeil = Math.round((ceilEnd.getTime() - e.getTime()) / 86400000);
    return months + daysToFloor / (daysToCeil + daysToFloor);
  };

  // Acuan rencana: dari HARI INI (hari pendaftaran) menuju Idul Adha — bukan dari
  // tanggal awal periode. Karena itu makin lama daftar, makin sedikit sisa waktu &
  // makin besar nominal yang harus dibayar per periode.
  const rencanaMulai = new Date(); rencanaMulai.setHours(0, 0, 0, 0);
  const ymd = activePeriode?.tanggal_idul_adha?.slice(0, 10);
  const rencanaAkhir = ymd
    ? (() => { const [y, mo, d] = ymd.split('-').map(Number); return new Date(y, mo - 1, d); })()
    : new Date(rencanaMulai.getFullYear(), rencanaMulai.getMonth() + 12, rencanaMulai.getDate());
  const sisaHari = Math.max(1, Math.round((rencanaAkhir.getTime() - rencanaMulai.getTime()) / 86400000));
  const sisaMinggu = Math.max(1, Math.floor(sisaHari / 7));
  const sisaBulan = Math.max(1, Math.round(diffInMonths(rencanaMulai, rencanaAkhir)));
  const idulAdhaLabel = ymd
    ? rencanaAkhir.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const autoPlan = (f: FrekuensiSetoran): { kali: number; nominal: number } => {
    const rawPeriode =
      f === 'harian' ? sisaHari
      : f === 'mingguan' ? Math.max(1, Math.floor(sisaHari / 7))
      : Math.max(1, diffInMonths(rencanaMulai, rencanaAkhir));
    const nominal = Math.round(Math.ceil((totalTargetDana / rawPeriode) * 100) / 100 * 100) / 100;
    return { kali: Math.max(1, Math.round(rawPeriode)), nominal };
  };

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

    const targetUserId = userId ?? localUserId;
    if (isAdmin && !targetUserId) {
      showToast('Pilih nasabah terlebih dahulu', 'error');
      return;
    }

    const payload = {
      periode_qurban_id: activePeriode.id,
      hewan_qurban_id: selectedHewan.id,
      jumlah_hewan: jumlahHewan,
      target_dana: totalTargetDana,
      catatan,
      frekuensi_setor: frekuensi,
      nominal_per_periode: parseRupiah(nominalPeriode) > 0 ? parseRupiah(nominalPeriode) : undefined
    };

    if (isAdmin && targetUserId) {
      daftarQurbanAdmin(targetUserId, payload);
    } else {
      daftarTabunganQurban(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
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
          {/* Pilihan Nasabah (admin, tanpa user spesifik) */}
          {isAdmin && userId == null && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nasabah</label>
              <select
                value={localUserId || ''}
                onChange={(e) => setLocalUserId(Number(e.target.value))}
                required
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>— Pilih Nasabah —</option>
                {users!.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.nomor_anggota || u.username})</option>
                ))}
              </select>
            </div>
          )}

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

          {/* Frekuensi Setoran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Repeat className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Frekuensi Setoran
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FREKUENSI_LABEL) as FrekuensiSetoran[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrekuensi(f)}
                  className={`py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                    frekuensi === f
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {FREKUENSI_LABEL[f]}
                </button>
              ))}
            </div>
            {frekuensi !== 'bulanan' && (
              <p className="text-[10px] text-slate-400 mt-1.5">
                Setoran {frekuensi} berarti target akan dihitung ulang menjadi cicilan per {frekuensi}.
              </p>
            )}
          </div>

          {/* Nominal per Periode — hanya admin; user otomatis dari sisa waktu */}
          <div>
            {isAdmin && (
              <>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Target className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Nominal per Periode (Opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={nominalPeriode}
                    onChange={(e) => setNominalPeriode(fmtRupiahTyping(e.target.value))}
                    onBlur={() => setNominalPeriode(fmtRupiahBlur(nominalPeriode))}
                    placeholder="Kosongkan untuk hitung otomatis dari target"
                    className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200"
                  />
                </div>
                {parseRupiah(nominalPeriode) > 0 ? (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-bold">
                    Pembayaran Rp {formatRupiah(parseRupiah(nominalPeriode))} per {frekuensi}.
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Rencana otomatis dari hari ini (nominal dikosongkan)
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      Sisa {sisaHari.toLocaleString('id-ID')} hari / {sisaMinggu} minggu / {sisaBulan} bulan menuju Idul Adha {idulAdhaLabel}
                    </p>
                    {(Object.keys(FREKUENSI_LABEL) as FrekuensiSetoran[]).map((f) => {
                      const p = autoPlan(f);
                      return (
                        <p
                          key={f}
                          className={`text-[10px] font-bold ${
                            frekuensi === f
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {FREKUENSI_LABEL[f]}: {p.kali.toLocaleString('id-ID')}× bayar · Rp {formatRupiah(p.nominal)} /{FREKUENSI_LABEL[f].toLowerCase()}
                          {frekuensi === f && ' (dipilih)'}
                        </p>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Total target: Rp {formatRupiah(totalTargetDana)}
                    </p>
                  </div>
                )}
              </>
            )}

            {!isAdmin && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Rencana otomatis dari hari ini
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  Sisa {sisaHari.toLocaleString('id-ID')} hari / {sisaMinggu} minggu / {sisaBulan} bulan menuju Idul Adha {idulAdhaLabel}
                </p>
                {(Object.keys(FREKUENSI_LABEL) as FrekuensiSetoran[]).map((f) => {
                  const p = autoPlan(f);
                  return (
                    <p
                      key={f}
                      className={`text-[10px] font-bold ${
                        frekuensi === f
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {FREKUENSI_LABEL[f]}: {p.kali.toLocaleString('id-ID')}× bayar · Rp {formatRupiah(p.nominal)} /{FREKUENSI_LABEL[f].toLowerCase()}
                      {frekuensi === f && ' (dipilih)'}
                    </p>
                  );
                })}
                <p className="text-[10px] text-slate-400 font-semibold">
                  Total target: Rp {formatRupiah(totalTargetDana)}
                </p>
              </div>
            )}
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
