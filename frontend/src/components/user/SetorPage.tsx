import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import {
  ArrowLeft,
  Upload,
  Coins,
  Wallet,
  ShieldCheck,
  FileImage,
  Clock,
  Landmark,
  Trophy,
  Info
} from 'lucide-react';
import { QurbanIcon } from '../QurbanIcon';
import { JenisTabungan, RekeningBank } from '../../types';

interface SetorPageProps {
  defaultTipe?: 'emas' | 'pribadi' | 'qurban';
  defaultJenisId?: number;
  defaultNominal?: number;
  defaultKonfigurasiId?: number;
  qurbanPendaftaranId?: number;
  onBack: () => void;
}

const TIPE_STYLE: Record<string, { active: string; idle: string }> = {
  emas: {
    active:
      'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-sm',
    idle: 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
  },
  pribadi: {
    active:
      'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm',
    idle: 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
  },
  qurban: {
    active:
      'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-sm',
    idle: 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
  }
};

export const SetorPage: React.FC<SetorPageProps> = ({ defaultTipe = 'emas', defaultJenisId, defaultNominal, defaultKonfigurasiId, qurbanPendaftaranId, onBack }) => {
  const {
    jenisTabungan,
    rekeningBank,
    activeHargaEmas,
    createSetoranUser,
    pendaftaranQurban,
    hewanQurban,
    userTransaksi,
    userEmasGramTotal,
    userEmasGoal,
    hariRayaStatus,
    showToast
  } = useApp();

  const visibleJenis = jenisTabungan.filter((j) => j.status_aktif);

  const [selectedJenisId, setSelectedJenisId] = useState<number>(() => {
    const byId = defaultJenisId ? visibleJenis.find((j) => j.id === defaultJenisId) : undefined;
    const byTipe = visibleJenis.find((j) => j.tipe === defaultTipe);
    return (byId ?? byTipe ?? visibleJenis[0])?.id ?? 0;
  });
  const [nominal, setNominal] = useState<string>(defaultNominal ? String(defaultNominal) : '');
  const [selectedRekeningId, setSelectedRekeningId] = useState<number>(
    rekeningBank.find((r) => r.status_aktif)?.id || 1
  );
  const [catatan, setCatatan] = useState<string>('');
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string>('');
  const [selectedQurbanId, setSelectedQurbanId] = useState<number>(
    qurbanPendaftaranId || (pendaftaranQurban[0]?.id || 1)
  );

  const selectedJenis: JenisTabungan | null =
    visibleJenis.find((j) => j.id === selectedJenisId) ?? null;
  const selTipe = selectedJenis?.tipe;

  const prevJenisRef = useRef<number | null>(null);
  const selectedJenisIdNum = selectedJenis?.id ?? null;
  useEffect(() => {
    if (prevJenisRef.current !== null && prevJenisRef.current !== selectedJenisIdNum) {
      setNominal('');
      setCatatan('');
      setBuktiFile(null);
      setBuktiPreview('');
    }
    prevJenisRef.current = selectedJenisIdNum;
  }, [selectedJenisIdNum]);

  const nominalValue = parseRupiah(nominal);
  const activeHarga = activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000;
  const estimasiGram = selTipe === 'emas' && nominalValue > 0 ? (nominalValue / activeHarga).toFixed(4) : null;
  const activeRekening = rekeningBank.filter((r) => r.status_aktif);

  const goalGram = userEmasGoal;
  const sisaGram = goalGram != null ? Math.max(goalGram - userEmasGramTotal, 0) : 0;
  const maxNominal = goalGram != null ? Math.floor(sisaGram * activeHarga) : Infinity;
  const goalTercapai = goalGram != null && userEmasGramTotal >= goalGram;

  const isBerjangka = selectedJenis?.sub_jenis === 'berjangka';
  const deadlineDate = selectedJenis?.deadline ? new Date(selectedJenis.deadline + 'T00:00:00') : null;
  const deadlinePassed = isBerjangka && deadlineDate != null && deadlineDate < new Date();

  const selTrx = userTransaksi.filter((t) => t.jenis_tabungan_id === selectedJenis?.id);
  const saldoJenis =
    selTrx
      .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'setor')
      .reduce((a, c) => a + c.nominal, 0) -
    selTrx
      .filter((t) => t.status_verifikasi === 'terverifikasi' && t.jenis_transaksi === 'tarik')
      .reduce((a, c) => a + c.nominal, 0);
  const targetJenis = selectedJenis?.target_nominal ?? 0;
  const pctJenis = targetJenis > 0 ? Math.min(100, Math.max(0, (saldoJenis / targetJenis) * 100)) : 0;

  const jenisIcon = (j: JenisTabungan) => {
    if (j.tipe === 'emas') return <Coins className="w-4 h-4 text-amber-500" />;
    if (j.tipe === 'qurban') return <QurbanIcon className="w-4 h-4 text-rose-500" />;
    return <Wallet className="w-4 h-4 text-emerald-500" />;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBuktiFile(file);
      setBuktiPreview(URL.createObjectURL(file));
      showToast(`Bukti transfer "${file.name}" siap diunggah.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJenis || !selTipe) {
      showToast('Pilih jenis tabungan terlebih dahulu.', 'error');
      return;
    }
    const efektifNominal = nominalValue;

    if (efektifNominal <= 0) {
      showToast('Nominal setoran harus lebih dari 0', 'error');
      return;
    }

    if (selTipe === 'emas' && goalTercapai) {
      showToast('Goal tabungan emas sudah tercapai. Gunakan menu pencairan.', 'error');
      return;
    }

    if (selTipe === 'emas' && goalGram != null && efektifNominal > maxNominal) {
      showToast(`Nominal melebihi sisa goal. Maksimal Rp ${formatRupiah(maxNominal)}.`, 'error');
      return;
    }

    if (selTipe === 'qurban' && !selectedQurbanId) {
      showToast('Pilih target pendaftaran qurban', 'error');
      return;
    }

    if (deadlinePassed) {
      showToast('Periode setoran tabungan berjangka sudah berakhir.', 'error');
      return;
    }

    if (selectedJenis?.sub_jenis === 'hari_raya' && (hariRayaStatus?.target ?? 0) <= 0) {
      showToast('Atur target tabungan hari raya terlebih dahulu sebelum menyetor.', 'error');
      return;
    }

    if (!buktiFile) {
      showToast('Wajib mengunggah bukti transfer sebelum mengirim.', 'error');
      return;
    }

    createSetoranUser({
      jenis_tabungan_id: selectedJenis.id,
      tipe_tabungan: selTipe,
      nominal: efektifNominal,
      rekening_bank_id: selectedRekeningId,
      bukti_transfer_file: buktiFile,
      catatan_user: catatan,
      pendaftaran_qurban_id: selTipe === 'qurban' ? selectedQurbanId : undefined,
      konfigurasi_id: selTipe === 'emas' ? defaultKonfigurasiId : undefined
    });

    onBack();
  };

  const langkahSetor = [
    'Pilih jenis tabungan dan nominal setoran',
    'Transfer ke rekening koperasi di kolom sebelah (nominal sama persis)',
    'Unggah bukti transfer / struk mutasi',
    'Admin verifikasi maksimal 1×24 jam (1 hari) — saldo tercatat otomatis'
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Formulir Setoran Tabungan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Konfirmasi setoran dana syariah melalui transfer rekening koperasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-bold">Verifikasi maks. 1×24 jam (1 hari)</span>
        </div>
      </div>

      {/* Flow Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {langkahSetor.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </div>
            <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">{s}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form Card */}
        <div className="lg:col-span-7 rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs flex flex-col">
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
            {/* Tipe Tabungan Selector — semua jenis aktif */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Pilih Jenis Tabungan
              </label>
              <div className="flex flex-wrap gap-2">
                {visibleJenis.map((j) => {
                  const st = TIPE_STYLE[j.tipe];
                  const active = j.id === selectedJenisId;
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setSelectedJenisId(j.id)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer min-w-[110px] flex-1 ${
                        active ? st.active : st.idle
                      }`}
                    >
                      {jenisIcon(j)}
                      <span className="text-center leading-tight">{j.nama}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Qurban specific selector */}
            {selTipe === 'qurban' && pendaftaranQurban.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Pendaftaran Qurban
                </label>
                <select
                  value={selectedQurbanId}
                  onChange={(e) => setSelectedQurbanId(Number(e.target.value))}
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  {pendaftaranQurban.map((p) => {
                    const h = hewanQurban.find((hw) => hw.id === p.hewan_qurban_id);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.jumlah_hewan}x {h?.jenis_hewan} (Sisa Target: Rp {formatRupiah(p.target_dana - p.total_terkumpul)})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Nominal Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nominal Setoran (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={nominal}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (selectedJenis?.tipe === 'emas' && goalGram != null && parseRupiah(raw) > maxNominal) {
                      setNominal(fmtRupiahBlur(String(maxNominal)));
                      return;
                    }
                    setNominal(fmtRupiahTyping(raw));
                  }}
                  onBlur={() => setNominal(fmtRupiahBlur(nominal))}
                  placeholder="Contoh: 1.000.000,50"
                  disabled={selectedJenis?.tipe === 'emas' && goalTercapai}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                {[50000, 100000, 250000, 500000, 1000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNominal(preset.toLocaleString('id-ID'))}
disabled={(selectedJenis?.tipe === 'emas' && goalTercapai) || deadlinePassed}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    +{preset >= 1000000 ? `${preset / 1000000}Jt` : `${preset / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

              {/* Goal progress untuk emas */}
              {selectedJenis?.tipe === 'emas' && goalGram != null && (
                <div className={`mt-2 p-3 rounded-2xl border ${goalTercapai ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40'}`}>
                  {goalTercapai ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <Trophy className="w-4 h-4 flex-shrink-0" />
                      Goal tercapai ({goalGram} gram). Gunakan menu pencairan untuk dana emas Anda.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        <span>Progress menuju goal {goalGram} gram</span>
                        <span>{(Math.max(0, userEmasGramTotal / goalGram) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, (userEmasGramTotal / goalGram) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
                        Kurang <span className="font-extrabold">{sisaGram.toFixed(4)} gram</span> lagi untuk mencapai goal.
                        Maksimal setoran: <span className="font-extrabold">Rp {formatRupiah(maxNominal)}</span>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Progress target nominal — selain emas, selama ada target */}
              {selectedJenis?.tipe !== 'emas' && targetJenis > 0 && (
                <div className="mt-2 p-3 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/40">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Progress menuju target Rp {formatRupiah(targetJenis)}</span>
                      <span>{pctJenis.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pctJenis}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70">
                      Saldo saat ini <span className="font-extrabold">Rp {formatRupiah(saldoJenis)}</span> dari target{' '}
                      <span className="font-extrabold">Rp {formatRupiah(targetJenis)}</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* Info deadline tabungan berjangka */}
              {isBerjangka && (
                <div className={`mt-2 p-3 rounded-2xl border ${deadlinePassed ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/50' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50'}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                      <Landmark className="w-4 h-4 flex-shrink-0" />
                      Berjangka — setoran berkala {selectedJenis?.frekuensi_setoran ?? 'berkala'} sampai tanggal jatuh tempo
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Tanggal deadline:{' '}
                      <span className={`font-extrabold ${deadlinePassed ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-300'}`}>
                        {deadlineDate ? deadlineDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      </span>
                      {deadlinePassed
                        ? ' — sudah lewat, setoran ditutup.'
                        : ' — setoran diizinkan sebelum tanggal tersebut.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Aturan nominal produk */}
              <p className="text-[10px] text-slate-400 mt-1">
                Tanpa minimum
              </p>

            {/* Live Gold Gram Estimate */}
            {selTipe === 'emas' && estimasiGram && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <Coins className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Estimasi Fisik Emas:</span>
                </div>
                <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">
                  ≈ {estimasiGram} Gram Emas
                </span>
              </div>
            )}

            {/* Rekening Tujuan Transfer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Rekening Bank Koperasi Tujuan
              </label>
              <select
                value={selectedRekeningId}
                onChange={(e) => setSelectedRekeningId(Number(e.target.value))}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {activeRekening.map((rek) => (
                  <option key={rek.id} value={rek.id}>
                    {rek.nama_bank} - {rek.no_rekening} (a.n {rek.atas_nama})
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Bukti Transfer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Bukti Transfer / Struk Mutasi
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-3 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                  <Upload className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                    Pilih / Unggah Bukti
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG maks 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {buktiPreview && (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 relative group">
                    <img
                      src={buktiPreview}
                      alt="Bukti Transfer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Setoran awal bulan atau titipan keluarga"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

{/* Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3 mt-auto">
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onBack}
                  className="py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={selectedJenis?.tipe === 'emas' && goalTercapai}
                  className="py-2.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kirim Konfirmasi Setoran
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Info & Rekening Column */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Rekening Koperasi */}
          <div className="rounded-3xl p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Rekening Koperasi Aktif</h3>
            </div>
            <div className="space-y-2.5">
              {activeRekening.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada rekening koperasi aktif.</p>
              ) : activeRekening.map((rek) => (
                <div
                  key={rek.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white">{rek.nama_bank}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      Aktif
                    </span>
                  </div>
                  <p className="font-mono text-sm text-slate-700 dark:text-slate-200 mt-1">{rek.no_rekening}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">a.n {rek.atas_nama}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Keamanan */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-emerald-600/10 to-teal-500/10 border border-emerald-200/70 dark:border-emerald-800/50">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">Transaksi Aman & Amanah</h4>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70 mt-0.5 leading-relaxed">
                  Dana dikelola sesuai prinsip syariah, tercatat riwayat transaksi transparan, dan diverifikasi petugas koperasi. Gunakan nominal dan rekening tujuan yang benar.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-2 text-[11px] text-emerald-800/80 dark:text-emerald-300/70">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              <span>Pastikan nominal transfer sama dengan nominal setoran agar tidak terjadi selisih pencatatan.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};