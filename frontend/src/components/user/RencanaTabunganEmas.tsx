import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import {
  Banknote,
  CalendarClock,
  Coins,
  CornerDownLeft,
  Plus,
  Target,
  X
} from 'lucide-react';
import { FrekuensiSetoran } from '../../types';

interface RencanaTabunganEmasProps {
  onOpenSetor: (nominal?: number, konfigurasiId?: number) => void;
}

const FREK_LABEL: Record<FrekuensiSetoran, string> = {
  harian: 'per hari',
  mingguan: 'per minggu',
  bulanan: 'per bulan'
};

const toNominal = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;

const formatNominalInput = (s: string) => {
  const n = toNominal(s);
  return n ? n.toLocaleString('id-ID') : '';
};

const tambahPeriode = (tgl: Date, count: number, frek: FrekuensiSetoran): string => {
  const d = new Date(tgl);
  if (frek === 'bulanan') d.setMonth(d.getMonth() + count);
  else if (frek === 'mingguan') d.setDate(d.getDate() + 7 * count);
  else d.setDate(d.getDate() + count);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

type KeluarMode = 'cair' | null;

export const RencanaTabunganEmas: React.FC<RencanaTabunganEmasProps> = ({ onOpenSetor }) => {
  const {
    setoranBerkala,
    buatSetoranBerkala,
    batalkanSetoranBerkala,
    userEmasGoal,
    userEmasGramTotal,
    userEmasRupiahTotal,
    createPenarikanEmas,
    tukarEmas,
    activeHargaEmas,
    showToast
  } = useApp();

  const [kGoal, setKGoal] = useState('');
  const [kNominal, setKNominal] = useState('');
  const [kFrek, setKFrek] = useState<FrekuensiSetoran>('harian');
  const [kDurasi, setKDurasi] = useState('');
  const [kSource, setKSource] = useState<'nominal' | 'durasi'>('nominal');
  const [formBaruOpen, setFormBaruOpen] = useState(false);

  const [keluarMode, setKeluarMode] = useState<KeluarMode>(null);
  const [tukarOpen, setTukarOpen] = useState(false);

  const [batalPlan, setBatalPlan] = useState<null | {
    id: number;
    label: string;
    nominal: number;
    gram: number;
    dana: number;
  }>(null);

  const [rekBank, setRekBank] = useState('Bank Syariah Indonesia (BSI)');
  const [rekNo, setRekNo] = useState('');
  const [rekNama, setRekNama] = useState('');
  const [rekCatatan, setRekCatatan] = useState('');

  const items = setoranBerkala?.items ?? [];
  const dapatMembuat = setoranBerkala?.dapat_membuat ?? true;

  const activeHarga = activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000;

  const goalTercapai = userEmasGoal != null && userEmasGramTotal >= userEmasGoal;

  // --- Form buat rencana: nilai saat ini ---
  const goalVal = kGoal ? Number(kGoal) : 0;
  const goalTotal = goalVal > 0 ? goalVal : (userEmasGoal ?? 0);
  const nominalVal = toNominal(kNominal);
  const durasiVal = Number(kDurasi) || 0;
  const gramPerPeriode = durasiVal > 0 && goalTotal > 0 ? goalTotal / durasiVal : 0;
  const biayaPeriode = activeHarga > 0 && gramPerPeriode > 0 ? gramPerPeriode * activeHarga : 0;
  const tanggalSelesai = durasiVal > 0 && goalTotal > 0
    ? tambahPeriode(new Date(), Math.max(0, durasiVal - 1), kFrek)
    : '';

  // Dua arah: isi nominal => durasi sampai target; isi durasi => nominal per periode. Yang terakhir diedit = sumber.
  const durasiDariNominal = (goal: number, nom: number): number =>
    goal > 0 && nom > 0 && activeHarga > 0 ? Math.ceil((goal * activeHarga) / nom) : 0;
  const nominalDariDurasi = (goal: number, dur: number): number =>
    goal > 0 && dur > 0 && activeHarga > 0 ? Math.ceil((goal * activeHarga) / dur / 1000) * 1000 : 0;

  const onChangeGoal = (raw: string) => {
    setKGoal(raw);
    if (kSource === 'durasi') {
      const n = nominalDariDurasi(Number(raw) || 0, Number(kDurasi) || 0);
      if (n > 0) setKNominal(formatNominalInput(String(n)));
    } else {
      const d = durasiDariNominal(Number(raw) || 0, toNominal(kNominal));
      if (d > 0) setKDurasi(String(d));
    }
  };

  const onChangeNominal = (raw: string) => {
    setKNominal(formatNominalInput(raw));
    setKSource('nominal');
    const d = durasiDariNominal(goalTotal, toNominal(raw));
    if (d > 0) setKDurasi(String(d));
  };

  const onChangeDurasi = (raw: string) => {
    setKDurasi(raw);
    setKSource('durasi');
    const n = nominalDariDurasi(goalTotal, Number(raw) || 0);
    if (n > 0) setKNominal(formatNominalInput(String(n)));
  };

  const resetKeluar = () => {
    setKeluarMode(null);
    setRekNo('');
    setRekNama('');
    setRekCatatan('');
  };

  const handleBuat = () => {
    if (goalVal <= 0) {
      showToast('Isi target rencana ini: berapa gram emas yang ingin dicapai.', 'error');
      return;
    }
    if (nominalVal < 10000) {
      showToast('Nominal pembayaran minimal Rp 10.000.', 'error');
      return;
    }
    if (durasiVal < 1) {
      showToast('Isi berapa lama menabung (jumlah periode).', 'error');
      return;
    }
    buatSetoranBerkala({
      nominal_per_periode: nominalVal,
      target_gram_total: goalVal,
      frekuensi_setor: kFrek,
      durasi_periode: durasiVal
    });
    setKGoal('');
    setKNominal('');
    setKDurasi('');
  };

  const handleKeluar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rekNo.trim() || !rekNama.trim()) {
      showToast('Isi nomor rekening dan atas nama penerima.', 'error');
      return;
    }
    const payload = {
      bank_tujuan: rekBank,
      no_rekening: rekNo,
      atas_nama: rekNama,
      catatan_user: rekCatatan
    };
    createPenarikanEmas(payload);
    resetKeluar();
  };

  const handleBatalRencana = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batalPlan) return;
    const nilaiGram = batalPlan.gram * activeHarga;
    const refund = Math.round(nilaiGram - Math.round(nilaiGram * 0.10) + batalPlan.dana);
    if (refund > 0 && (!rekNo.trim() || !rekNama.trim())) {
      showToast('Isi nomor rekening dan atas nama penerima.', 'error');
      return;
    }
    const payload = refund > 0
      ? { bank_tujuan: rekBank, no_rekening: rekNo, atas_nama: rekNama, catatan_user: rekCatatan }
      : {};
    batalkanSetoranBerkala(batalPlan.id, payload);
    setBatalPlan(null);
    resetKeluar();
  };

  const handleSetor = (nominal?: number, konfigurasiId?: number) => {
    if (items.length === 0) {
      showToast('Buat rencana menabung dulu — di dalamnya Anda set target & pembayaran sekaligus.', 'error');
      return;
    }
    onOpenSetor(nominal, konfigurasiId);
  };

  const inputCls =
    'w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40';
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Tabungan Emas Saya</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Satu langkah: atur target & pembayaran sekaligus, sisanya dipantau di sini.
          </p>
        </div>
      </div>

      {/* Rencana pembayaran aktif — bersusun */}
      {items.length > 0 && (
        <div className="mt-5 space-y-3">
          {items.map((it, idx) => {
            const k = it.konfigurasi;
            const p = it.progress;
            const nominalPlan = k.nominal_per_periode ?? 0;
            const targetTotal = p?.target_gram_total ?? null;
            const gram = p?.rekap.gram_terkumpul ?? 0;
            const pctGram = targetTotal && targetTotal > 0 ? Math.min(100, (gram / targetTotal) * 100) : 0;
            const totalPeriode = k.durasi_periode || 0;
            return (
              <div key={k.id} className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                      Rencana Pembayaran {items.length > 1 ? `#${idx + 1}` : ''}
                    </span>
                    <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                      Rp {formatRupiah(nominalPlan)} {k.frekuensi_setor && FREK_LABEL[k.frekuensi_setor] ? FREK_LABEL[k.frekuensi_setor] : ''} • {totalPeriode}x
                      {k.target_gram_total != null && (
                        <span className="ml-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">→ {k.target_gram_total} gr</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {p?.sisa_periode != null ? `Sisa ${p.sisa_periode}× • ${k.jadwal_label || k.frekuensi_setor_label}` : k.jadwal_label || k.frekuensi_setor_label}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetor(nominalPlan, k.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Setor Rp {formatRupiah(nominalPlan)}
                  </button>
                </div>

                {/* Progress: satu (gram) menuju target rencana ini */}
                <div className="mt-3">
                  {targetTotal && targetTotal > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        <span>Gram terkumpul {gram.toFixed(4)} dari {targetTotal} gr</span>
                        <span className="text-amber-700 dark:text-amber-300">{pctGram.toFixed(1)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500" style={{ width: `${pctGram}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-semibold">Target rencana ini belum ditetapkan.</p>
                  )}
                </div>

                {/* Batal & refund PER rencana — tidak menyentuh rencana lain */}
                <div className="mt-2 pt-2 border-t border-rose-100 dark:border-rose-900/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetKeluar();
                      setBatalPlan({
                        id: k.id,
                        label: items.length > 1 ? `Rencana Pembayaran #${idx + 1}` : 'Rencana Pembayaran',
                        nominal: nominalPlan,
                        gram,
                        dana: p?.rekap.saldo_dana_rencana ?? 0
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 hover:underline cursor-pointer"
                  >
                    <Banknote className="w-3 h-3" /> Batal & Refund (potongan 10%)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slot buat rencana — tersisa bila < 5; terbuka lagi bila satu selesai */}
      <div className={`${items.length > 0 ? 'mt-5 pt-5 border-t border-slate-100 dark:border-slate-800' : 'mt-5'}`}>
        {dapatMembuat && (
          <>
            <button
              type="button"
              onClick={() => setFormBaruOpen(!formBaruOpen)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-extrabold">
                <Plus className="w-4 h-4" />
                {items.length === 0 ? 'Mulai Menabung Emas' : 'Tambah Rencana Lagi'}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Slot tersedia: {5 - items.length} dari 5
              </span>
            </button>

            {formBaruOpen && (
              <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rencana Pembayaran Baru</span>
                <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                  {items.length === 0 ? 'Mulai Menabung Emas' : 'Tambah Rencana Lagi — isi target rencana ini sendiri'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {`Isi salah satu — kolom lain otomatis menghitung sampai target tercapai.`}
                </p>
              </div>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Target rencana ini (gram)</label>
            <input
              type="number" min={0.01} step="any"
              value={kGoal}
              onChange={(e) => onChangeGoal(e.target.value)}
              placeholder="Contoh: 10 — atau 5 untuk rencana kedua"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Nominal pembayaran</label>
            <input
              type="text" inputMode="numeric"
              value={kNominal}
              onChange={(e) => onChangeNominal(e.target.value)}
              placeholder="Contoh: 15.000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Berapa lama ({goalTotal > 0 && durasiVal > 0 ? `${gramPerPeriode.toFixed(4)} gr/${kFrek === 'harian' ? 'hari' : kFrek === 'mingguan' ? 'minggu' : 'bulan'}` : ''})
            </label>
            <input
              type="number" min={1}
              value={kDurasi}
              onChange={(e) => onChangeDurasi(e.target.value)}
              placeholder="Terisi otomatis"
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 -mt-2">
          Menggunakan harga acuan Rp {formatRupiah(activeHarga)}/gr — isi nominal → durasi terhitung, isi durasi → nominal menyesuaikan.
        </p>

        <div>
          <label className={labelCls}>Bayar</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['harian', 'mingguan', 'bulanan'] as FrekuensiSetoran[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setKFrek(f)}
                className={`py-2.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                  kFrek === f
                    ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/25'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-300'
                }`}
              >
                {f === 'harian' ? 'Harian' : f === 'mingguan' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>

        {durasiVal > 0 && (goalTotal > 0 || nominalVal > 0) && (
          <div className="p-4 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <p className="flex items-center gap-1.5"><CornerDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Bayar <strong>Rp {formatRupiah(nominalVal)}</strong> {FREK_LABEL[kFrek]} selama <strong>{durasiVal}x</strong>
            </p>
            {goalTotal > 0 && (
              <p>
                Setiap {FREK_LABEL[kFrek].replace('per ', '')} ≈ <strong className="text-amber-700 dark:text-amber-300">{gramPerPeriode.toFixed(4)} gram</strong>
                {' '}• total target <strong>{goalTotal} gram</strong>
              </p>
            )}
            {tanggalSelesai && (
              <p className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Target {goalTotal} gr tercapai sekitar <strong>{tanggalSelesai}</strong>
              </p>
            )}
            {nominalVal > 0 && biayaPeriode > 0 && (
              <p className={biayaPeriode > nominalVal ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}>
                {biayaPeriode > nominalVal
                  ? `Biaya ${gramPerPeriode.toFixed(4)}gr (Rp ${formatRupiah(Math.round(biayaPeriode))}) melebihi setoran — kelebihannya menunggu di saldo dana.`
                  : `Biaya ${gramPerPeriode.toFixed(4)}gr saat ini ≈ Rp ${formatRupiah(Math.round(biayaPeriode))}`}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleBuat}
            className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-amber-500/25 cursor-pointer"
          >
            {items.length === 0 ? 'Aktifkan Rencana' : 'Buat Rencana Baru'}
          </button>
        </div>
              </div>
            )}
            </>
        )}
        {!dapatMembuat && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-center">
            <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Slot rencana penuh (maksimal 5).</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Selesaikan atau batalkan salah satu rencana untuk membuka slot baru nabung lagi.
            </p>
          </div>
        )}
      </div>

      {/* Aksi keluar */}
      {goalTercapai && (
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setKeluarMode('cair')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600 cursor-pointer"
              >
                <Banknote className="w-4 h-4" /> Cairkan Emas (Full)
              </button>
              <button
                type="button"
                onClick={() => setTukarOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-sm shadow-amber-600/25 cursor-pointer"
              >
                <Coins className="w-4 h-4" /> Tukar Emas
              </button>
        </div>
      )}

      {/* ============ MODAL: Cairkan Emas ============ */}
      {keluarMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden sm:my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Cairkan Emas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Goal tercapai — saldo emas penuh diubah jadi rupiah.
                </p>
              </div>
              <button onClick={resetKeluar} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleKeluar} className="p-6 space-y-4">
              <div className="p-4 rounded-2xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Nilai Pencairan
                </span>
                <p className="text-xl font-extrabold mt-0.5 text-amber-700 dark:text-amber-300">
                  Rp {formatRupiah(userEmasRupiahTotal)}
                </p>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
                  Kurs acuan Rp {formatRupiah(activeHarga)} / gram
                </span>
              </div>

              <div>
                <label className={labelCls}>Bank Tujuan</label>
                <input type="text" value={rekBank} onChange={(e) => setRekBank(e.target.value)} required className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nomor Rekening</label>
                  <input type="text" inputMode="numeric" maxLength={16} value={rekNo}
                    onChange={(e) => setRekNo(e.target.value.replace(/[^\d]/g, '').slice(0, 16))} required
                    placeholder="Contoh: 1234567890" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Atas Nama</label>
                  <input type="text" value={rekNama} onChange={(e) => setRekNama(e.target.value)} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Catatan (Opsional)</label>
                <input type="text" value={rekCatatan} onChange={(e) => setRekCatatan(e.target.value)} className={inputCls} />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button type="button" onClick={resetKeluar}
                  className="py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  Batal
                </button>
                <button type="submit"
                  className="py-2.5 px-6 rounded-2xl text-white text-xs font-extrabold shadow-md active:scale-95 transition-all cursor-pointer bg-amber-600 hover:bg-amber-700 shadow-amber-600/25">
                  Ajukan Pencairan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODAL: Batal & Refund per Rencana ============ */}
      {batalPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden sm:my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Batal & Refund {batalPlan.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hanya rencana ini yang dibatalkan — rencana lain tidak tersentuh.
                </p>
              </div>
              <button onClick={() => setBatalPlan(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatalRencana} className="p-6 space-y-4">
              <div className="p-4 rounded-2xl border border-rose-50 dark:border-rose-950/40 bg-rose-50 dark:bg-rose-950/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Rincian Refund</span>
                {(() => {
                  const nilaiGram = batalPlan.gram * activeHarga;
                  const penalti = Math.round(nilaiGram * 0.10);
                  const refund = Math.round(nilaiGram - penalti + batalPlan.dana);
                  return (
                    <>
                      {refund > 0 ? (
                        <>
                          <p className="text-xl font-extrabold mt-0.5 text-rose-700 dark:text-rose-300">Rp {formatRupiah(refund)}</p>
                          <div className="mt-2 space-y-1 text-[11px] text-rose-700/80 dark:text-rose-300/70">
                            <p>Saldo emas rencana ini: {batalPlan.gram.toFixed(4)} gr ≈ Rp {formatRupiah(Math.round(nilaiGram))}</p>
                            <p>Potongan 10% (dari emas): −Rp {formatRupiah(penalti)}</p>
                            <p>Saldo dana rencana ini: +Rp {formatRupiah(batalPlan.dana)}</p>
                          </div>
                          <span className="text-[11px] text-rose-700/80 dark:text-rose-300/70">Kurs acuan Rp {formatRupiah(activeHarga)} / gram</span>
                        </>
                      ) : (
                        <p className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                          Belum ada saldo yang terkumpul di rencana ini — rencana langsung dibatalkan tanpa refund.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {(() => {
                const nilaiGram = batalPlan.gram * activeHarga;
                const refund = Math.round(nilaiGram - Math.round(nilaiGram * 0.10) + batalPlan.dana);
                return refund > 0 && (
                  <>
                    <div>
                      <label className={labelCls}>Bank Tujuan</label>
                      <input type="text" value={rekBank} onChange={(e) => setRekBank(e.target.value)} required className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nomor Rekening</label>
                        <input type="text" inputMode="numeric" maxLength={16} value={rekNo}
                          onChange={(e) => setRekNo(e.target.value.replace(/[^\d]/g, '').slice(0, 16))} required
                          placeholder="Contoh: 1234567890" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Atas Nama</label>
                        <input type="text" value={rekNama} onChange={(e) => setRekNama(e.target.value)} required className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Catatan (Opsional)</label>
                      <input type="text" value={rekCatatan} onChange={(e) => setRekCatatan(e.target.value)} className={inputCls} />
                    </div>
                  </>
                );
              })()}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button type="button" onClick={() => setBatalPlan(null)}
                  className="py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  Batal
                </button>
                <button type="submit"
                  className="py-2.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-600/25 transition-all cursor-pointer">
                  Ajukan Batal & Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODAL: Confirmasi Tukar Emas ============ */}
      {tukarOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-amber-200 dark:border-amber-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center mb-3">
                <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Tukar Seluruh Emas di Toko?</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Saldo emas {userEmasGramTotal.toFixed(4)} gram (≈ Rp {formatRupiah(userEmasRupiahTotal)}) jadi emas fisik. Bawa bukti penukaran saat datang.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setTukarOpen(false)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                Batal
              </button>
              <button type="button"
                onClick={() => { setTukarOpen(false); tukarEmas(); }}
                className="py-2.5 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-amber-600/25 cursor-pointer">
                Ya, Tukar Emas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};