import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Coins,
  Target,
  Landmark,
  Wallet,
  Settings
} from 'lucide-react';
import { JenisTabungan } from '../../types';

interface JenisTabunganModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: JenisTabungan | null;
}

const STEPS = [
  { id: 1, label: 'Informasi Dasar', icon: Info },
  { id: 2, label: 'Setoran', icon: Coins },
  { id: 3, label: 'Goal', icon: Target },
  { id: 4, label: 'Pencairan', icon: Landmark },
  { id: 5, label: 'Saldo & Refund', icon: Wallet },
  { id: 6, label: 'Pengaturan Lanjutan', icon: Settings }
];

const inputCls =
  'w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white';
const labelCls = 'block font-bold text-slate-700 dark:text-slate-300 mb-1.5';
const stepTitle = 'font-extrabold text-sm text-slate-900 dark:text-white pb-3 mb-4 border-b border-slate-100 dark:border-slate-700';

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-center justify-between w-full py-2 cursor-pointer"
  >
    <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
    <span
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </span>
  </button>
);

const formatThousand = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseThousand = (txt: string): string => txt.replace(/\D/g, '');

const NumField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  money?: boolean;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, prefix, money = true, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigits = useRef(0);

  const display = money ? formatThousand(value) : value;

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) {
      const formatted = formatThousand(value.slice(0, caretDigits.current));
      el.setSelectionRange(formatted.length, formatted.length);
    }
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (money) {
      const digitsBefore = parseThousand(e.target.value.slice(0, e.target.selectionStart ?? 0));
      caretDigits.current = digitsBefore.length;
      onChange(parseThousand(e.target.value));
    } else {
      onChange(e.target.value);
    }
  };

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{prefix}</span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`${inputCls} ${prefix ? 'pl-8' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
};

export const JenisTabunganModal: React.FC<JenisTabunganModalProps> = ({
  isOpen,
  onClose,
  itemToEdit
}) => {
  const { createJenisTabungan, updateJenisTabungan, showToast } = useApp();
  const [step, setStep] = useState(1);

  // 1. Informasi Dasar
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [tipe, setTipe] = useState('custom');
  const [ikon, setIkon] = useState('Wallet');
  const [deskripsi, setDeskripsi] = useState('');
  const [statusAktif, setStatusAktif] = useState(true);

  // 2. Setoran
  const [mode, setMode] = useState('nominal_bebas');
  const [minNominal, setMinNominal] = useState('');
  const [maxNominal, setMaxNominal] = useState('');
  const [kelipatan, setKelipatan] = useState('');
  const [berkala, setBerkala] = useState(false);
  const [berkalaNominal, setBerkalaNominal] = useState('');
  const [berkalaPeriode, setBerkalaPeriode] = useState('bulanan');

  // 3. Goal
  const [goalAktif, setGoalAktif] = useState(false);
  const [goalJenis, setGoalJenis] = useState('nominal');
  const [goalNilai, setGoalNilai] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalWajib, setGoalWajib] = useState(false);
  const [goalBolehUbah, setGoalBolehUbah] = useState(false);

  // 4. Pencairan
  const [cairSebelumGoal, setCairSebelumGoal] = useState(true);
  const [cairSetelahGoal, setCairSetelahGoal] = useState('lengkap');
  const [potongan, setPotongan] = useState(false);
  const [potonganTipe, setPotonganTipe] = useState('persen');
  const [potonganNilai, setPotonganNilai] = useState('');
  const [biayaAdmin, setBiayaAdmin] = useState('');
  const [approvalAdmin] = useState('manual_admin');

  // 5. Saldo & Refund
  const [minSaldo, setMinSaldo] = useState('');
  const [refund, setRefund] = useState(true);
  const [batal, setBatal] = useState('penuh');
  const [overpayment, setOverpayment] = useState('saldo');

  // 6. Pengaturan Lanjutan
  const [notif, setNotif] = useState(true);
  const [sk, setSk] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    const cfg = itemToEdit ? ((itemToEdit as any).config as Record<string, any> | undefined) ?? {} : {};
    if (itemToEdit) {
      setNama(itemToEdit.nama);
      setKode(itemToEdit.kode);
      setTipe(itemToEdit.tipe);
      setDeskripsi(itemToEdit.deskripsi || '');
      setStatusAktif(itemToEdit.status_aktif);
      setMode(itemToEdit.mode_perhitungan);
      const hasGoal = !!(itemToEdit.target_nominal || itemToEdit.target_unit);
      setGoalAktif(hasGoal);
      setGoalJenis(itemToEdit.target_unit ? 'unit' : 'nominal');
      setGoalNilai(String(itemToEdit.target_nominal || itemToEdit.target_unit || ''));
      setGoalDeadline(itemToEdit.tanggal_selesai || '');
      setCairSebelumGoal(itemToEdit.allow_withdrawal);
      setIkon(cfg.ikon || 'Wallet');
      setMinNominal(String(cfg.min_nominal ?? ''));
      setMaxNominal(String(cfg.max_nominal ?? ''));
      setKelipatan(String(cfg.kelipatan ?? ''));
      setBerkala(!!cfg.setoran_berkala);
      setBerkalaNominal(String(cfg.setoran_berkala_nominal ?? ''));
      setBerkalaPeriode(cfg.setoran_berkala_periode || 'bulanan');
      setGoalWajib(!!cfg.goal_wajib);
      setGoalBolehUbah(!!cfg.goal_boleh_ubah);
      setCairSetelahGoal(cfg.cair_setelah_goal || 'lengkap');
      setPotongan(!!cfg.potongan);
      setPotonganTipe(cfg.potongan_tipe || 'persen');
      setPotonganNilai(String(cfg.potongan_nilai ?? ''));
      setBiayaAdmin(String(cfg.biaya_admin ?? ''));
      setMinSaldo(String(cfg.min_saldo ?? ''));
      setRefund(cfg.refund !== undefined ? !!cfg.refund : true);
      setBatal(cfg.batal || 'penuh');
      setOverpayment(cfg.overpayment || 'saldo');
      setNotif(cfg.notifikasi !== undefined ? !!cfg.notifikasi : true);
      setSk(cfg.sk || '');
    } else {
      setNama(''); setKode(''); setTipe('custom'); setIkon('Wallet'); setDeskripsi(''); setStatusAktif(true);
      setMode('nominal_bebas'); setMinNominal(''); setMaxNominal(''); setKelipatan(''); setBerkala(false);
      setBerkalaNominal(''); setBerkalaPeriode('bulanan');
      setGoalAktif(false); setGoalJenis('nominal'); setGoalNilai(''); setGoalDeadline(''); setGoalWajib(false);
      setGoalBolehUbah(false);
      setCairSebelumGoal(true); setCairSetelahGoal('lengkap'); setPotongan(false); setPotonganTipe('persen');
      setPotonganNilai(''); setBiayaAdmin('');
      setMinSaldo(''); setRefund(true); setBatal('penuh'); setOverpayment('saldo');
      setNotif(true); setSk('');
    }
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const potonganAktif = potongan && Number(potonganNilai) > 0;

  const buildPayload = () => ({
    ikon,
    min_nominal: minNominal ? Number(minNominal) : null,
    max_nominal: maxNominal ? Number(maxNominal) : null,
    kelipatan: kelipatan ? Number(kelipatan) : null,
    setoran_berkala: berkala,
    setoran_berkala_nominal: berkala ? Number(berkalaNominal || 0) : null,
    setoran_berkala_periode: berkala ? berkalaPeriode : null,
    goal_wajib: goalWajib,
    goal_boleh_ubah: goalBolehUbah,
    cair_setelah_goal: cairSetelahGoal,
    potongan: potonganAktif,
    potongan_tipe: potonganAktif ? potonganTipe : null,
    potongan_nilai: potonganAktif ? Number(potonganNilai || 0) : null,
    biaya_admin: biayaAdmin ? Number(biayaAdmin) : null,
    min_saldo: minSaldo ? Number(minSaldo) : null,
    refund,
    batal,
    overpayment,
    notifikasi: notif,
    sk
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !kode.trim()) {
      showToast('Nama dan kode produk wajib diisi', 'error');
      return;
    }
    if (goalAktif && !goalBolehUbah && !goalNilai.trim()) {
      showToast('Isi nilai target goal terlebih dahulu', 'error');
      return;
    }

    const common: Record<string, unknown> = {
      nama,
      kode: kode.toUpperCase(),
      tipe,
      deskripsi,
      mode_perhitungan: mode,
      status_aktif: statusAktif,
      allow_withdrawal: cairSebelumGoal,
      aturan_pencairan: approvalAdmin,
      config: buildPayload()
    };

    if (goalAktif) {
      common.tanggal_mulai = null;
      common.tanggal_selesai = goalDeadline || null;
      common.tanpa_batas_waktu = !goalDeadline;
      if (goalBolehUbah) {
        common.target_nominal = null;
        common.target_unit = null;
      } else if (goalJenis === 'unit') {
        common.target_unit = Number(goalNilai);
        common.target_nominal = null;
      } else {
        common.target_nominal = Number(goalNilai);
        common.target_unit = null;
      }
    } else {
      common.target_nominal = null;
      common.target_unit = null;
      common.tanggal_selesai = null;
      common.tanpa_batas_waktu = true;
    }

    if (itemToEdit) {
      updateJenisTabungan(itemToEdit.id, common);
    } else {
      createJenisTabungan({
        ...common,
        metode_pembayaran_diizinkan: ['transfer']
      });
    }
    onClose();
  };

  const finishable = step < 6;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl sm:my-8 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            {itemToEdit ? 'Edit Produk Tabungan' : 'Tambah Produk Tabungan'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : done
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 text-xs max-h-[60vh] overflow-y-auto">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>① Informasi Dasar</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama Produk</label>
                  <input type="text" value={nama} onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Tabungan Umroh Berkah" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Kode Produk (Unik)</label>
                  <input type="text" value={kode} onChange={(e) => setKode(e.target.value)}
                    placeholder="Contoh: UMR-01" className={`${inputCls} uppercase font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Kategori</label>
                  <select value={tipe} onChange={(e) => setTipe(e.target.value)} className={inputCls}>
                    <option value="emas">Emas Syariah</option>
                    <option value="pribadi">Pribadi (Wadi'ah)</option>
                    <option value="qurban">Qurban</option>
                    <option value="custom">Custom Syariah</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ikon</label>
                  <select value={ikon} onChange={(e) => setIkon(e.target.value)} className={inputCls}>
                    <option value="Wallet">Wallet (Dompet)</option>
                    <option value="Coins">Coins (Koin)</option>
                    <option value="PiggyBank">PiggyBank (Celengan)</option>
                    <option value="Landmark">Landmark (Bank)</option>
                    <option value="Target">Target (Sasaran)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Deskripsi</label>
                <textarea rows={3} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Deskripsi singkat ketentuan dan keunggulan syariah produk..."
                  className={`${inputCls} resize-none`} />
              </div>
              <Toggle checked={statusAktif} onChange={setStatusAktif} label="Status aktif" />
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>② Setoran</h4>
              <div>
                <label className={labelCls}>Mode Setoran</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
                  <option value="nominal_bebas">Nominal Bebas</option>
                  <option value="nominal_tetap">Nominal Tetap Per Periode</option>
                  <option value="konversi_unit">Konversi ke Unit (Gram)</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumField label="Minimum" value={minNominal} onChange={setMinNominal} prefix="Rp" />
                <NumField label="Maksimum" value={maxNominal} onChange={setMaxNominal} prefix="Rp" />
                <NumField label="Kelipatan" value={kelipatan} onChange={setKelipatan} prefix="Rp" />
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                <Toggle checked={berkala} onChange={setBerkala} label="Setoran berkala (otomatis)" />
                {berkala && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumField label="Nominal setoran berkala" value={berkalaNominal} onChange={setBerkalaNominal} prefix="Rp" />
                    <div>
                      <label className={labelCls}>Periode</label>
                      <select value={berkalaPeriode} onChange={(e) => setBerkalaPeriode(e.target.value)} className={inputCls}>
                        <option value="harian">Harian</option>
                        <option value="mingguan">Mingguan</option>
                        <option value="bulanan">Bulanan</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>③ Goal</h4>
              <Toggle checked={goalAktif} onChange={setGoalAktif} label="Aktifkan target goal" />
              {goalAktif && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Jenis Target</label>
                      {tipe === 'custom' ? (
                        <input
                          type="text"
                          readOnly
                          value="Nominal (Rupiah)"
                          className={`${inputCls} opacity-70 cursor-not-allowed`}
                        />
                      ) : (
                        <select value={goalJenis} onChange={(e) => setGoalJenis(e.target.value)} className={inputCls}>
                          <option value="nominal">Nominal (Rupiah)</option>
                          <option value="unit">Unit (Gram)</option>
                        </select>
                      )}
                    </div>
                    <NumField
                      label={goalJenis === 'unit' ? 'Nilai Target (Gram)' : 'Nilai Target'}
                      value={goalNilai}
                      onChange={setGoalNilai}
                      prefix={goalJenis === 'unit' ? '' : 'Rp'}
                      disabled={goalBolehUbah}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Deadline (kosongkan = tanpa batas waktu)</label>
                    <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className={inputCls} />
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
                    <Toggle checked={goalWajib} onChange={setGoalWajib} label="Target wajib tercapai" />
                    <Toggle
                      checked={goalBolehUbah}
                      onChange={(v) => { setGoalBolehUbah(v); if (v) setGoalNilai(''); }}
                      label="User boleh mengubah target"
                    />
                    {goalBolehUbah && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                        Admin tidak mengisi target. Nasabah yang menentukan sendiri nominal target tabungannya (seperti tabungan emas).
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>④ Pencairan</h4>
              <Toggle checked={cairSebelumGoal} onChange={setCairSebelumGoal} label="Boleh tarik sebelum goal tercapai" />
              <div>
                <label className={labelCls}>Pencairan setelah goal</label>
                <select value={cairSetelahGoal} onChange={(e) => setCairSetelahGoal(e.target.value)} className={inputCls}>
                  <option value="lengkap">Cairkan seluruh saldo</option>
                  <option value="bertahap">Cairkan bertahap</option>
                  <option value="terjadwal">Terjadwal (tanggal tertentu)</option>
                </select>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                <Toggle checked={potongan} onChange={setPotongan} label="Ada potongan saat pencairan" />
                {potongan && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Tipe Potongan</label>
                      <select value={potonganTipe} onChange={(e) => setPotonganTipe(e.target.value)} className={inputCls}>
                        <option value="persen">Persen (%)</option>
                        <option value="nominal">Nominal (Rp)</option>
                      </select>
                    </div>
                    <NumField label={potonganTipe === 'persen' ? 'Persentase' : 'Nominal'} value={potonganNilai}
                      onChange={setPotonganNilai} prefix={potonganTipe === 'persen' ? '%' : 'Rp'} />
                  </div>
                )}
                <NumField label="Biaya admin" value={biayaAdmin} onChange={setBiayaAdmin} prefix="Rp" />
              </div>
              <div>
                <label className={labelCls}>Approval Admin</label>
                <p className={inputCls}>Manual (perlu persetujuan admin)</p>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>⑤ Saldo &amp; Refund</h4>
              <NumField label="Saldo minimum" value={minSaldo} onChange={setMinSaldo} prefix="Rp" />
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
                <Toggle checked={refund} onChange={setRefund} label="Refund tersedia" />
                <div>
                  <label className={labelCls}>Pembatalan / penutupan</label>
                  <select value={batal} onChange={(e) => setBatal(e.target.value)} className={inputCls}>
                    <option value="penuh">Dana dikembalikan penuh</option>
                    <option value="potong">Dana dikembalikan dengan potongan</option>
                    <option value="tidak">Tidak bisa dibatalkan</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Overpayment (setoran lebih)</label>
                  <select value={overpayment} onChange={(e) => setOverpayment(e.target.value)} className={inputCls}>
                    <option value="saldo">Biarkan jadi saldo</option>
                    <option value="refund">Refund otomatis</option>
                    <option value="tolak">Tolak (tidak diterima)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="space-y-4">
              <h4 className={stepTitle}>⑥ Pengaturan Lanjutan</h4>
              {berkala && (
                <p className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 p-3 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Setoran berkala aktif (diatur pada langkah 2). Nasabah bisa otomatis menabung periodik.
                </p>
              )}
              <Toggle checked={notif} onChange={setNotif} label="Kirim notifikasi transaksi" />
              <div>
                <label className={labelCls}>Syarat &amp; Ketentuan</label>
                <textarea rows={4} value={sk} onChange={(e) => setSk(e.target.value)}
                  placeholder="S&K yang ditampilkan ke nasabah..."
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? 'Batal' : 'Kembali'}
            </button>

            {finishable ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer flex items-center gap-1.5"
              >
                Lanjut
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {itemToEdit ? 'Simpan Perubahan' : 'Simpan Produk'}
              </button>
            )}
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
