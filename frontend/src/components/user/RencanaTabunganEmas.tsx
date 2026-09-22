import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/format';
import { hargaJualPerGram } from '../../utils/hargaJual';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Coins,
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

type KeluarMode = 'cair' | null;

export const RencanaTabunganEmas: React.FC<RencanaTabunganEmasProps> = ({ onOpenSetor }) => {
  const {
    setoranBerkala,
    batalkanSetoranBerkala,
    userEmasGoal,
    userEmasGramTotal,
    userEmasRupiahTotal,
    createPenarikanEmas,
    tukarEmas,
    activeHargaEmas,
    showToast
  } = useApp();

  const [keluarMode, setKeluarMode] = useState<KeluarMode>(null);
  const [tukarOpen, setTukarOpen] = useState(false);

  const [batalPlan, setBatalPlan] = useState<null | {
    id: number;
    label: string;
    nominal: number;
    gram: number;
    dana: number;
    totalSetor: number;
  }>(null);

  const [rekBank, setRekBank] = useState('Bank Syariah Indonesia (BSI)');
  const [rekNo, setRekNo] = useState('');
  const [rekNama, setRekNama] = useState('');
  const [rekCatatan, setRekCatatan] = useState('');

  const items = setoranBerkala?.items ?? [];

  const activeHarga = activeHargaEmas ? activeHargaEmas.harga_per_gram : 1200000;

  // Rumus refund batal per rencana — SAMA dengan backend (SaldoEmasService::rincianRefund):
  // potongan 10% hanya dari TOTAL SETORAN EMAS (rupiah yang berhasil jadi gram),
  // bukan dari nilai pasar gram; saldo dana rencana dikembalikan penuh.
  const hitungRefundRencana = (p: { gram: number; dana: number; totalSetor: number }) => {
    const nilaiGram = p.gram * (p.gram > 0 ? hargaJualPerGram(activeHarga, p.gram) : 0);
    const potongan = Math.round(p.totalSetor * 0.10);
    const refundEmas = Math.round(nilaiGram - potongan);
    return {
      nilaiGram: Math.round(nilaiGram),
      potongan,
      refundEmas,
      refundTotal: Math.round(refundEmas + p.dana)
    };
  };

  const goalTercapai = userEmasGoal != null && userEmasGramTotal >= userEmasGoal;

  const resetKeluar = () => {
    setKeluarMode(null);
    setRekNo('');
    setRekNama('');
    setRekCatatan('');
  };

  const handleSetor = (nominal?: number, konfigurasiId?: number) => {
    if (items.length === 0) {
      showToast('Belum ada rencana menabung aktif. Hubungi admin untuk membuatkan rencana Anda.', 'error');
      return;
    }
    onOpenSetor(nominal, konfigurasiId);
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
    const { refundTotal } = hitungRefundRencana(batalPlan);
    if (refundTotal > 0 && (!rekNo.trim() || !rekNama.trim())) {
      showToast('Isi nomor rekening dan atas nama penerima.', 'error');
      return;
    }
    const payload = refundTotal > 0
      ? { bank_tujuan: rekBank, no_rekening: rekNo, atas_nama: rekNama, catatan_user: rekCatatan }
      : {};
    batalkanSetoranBerkala(batalPlan.id, payload);
    setBatalPlan(null);
    resetKeluar();
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
            const refundPending = !!it.refund_diajukan;
            const nominalPlan = k.nominal_per_periode ?? 0;
            const targetTotal = p?.target_gram_total ?? null;
            const gram = p?.rekap.gram_terkumpul ?? 0;
            const pctGram = targetTotal && targetTotal > 0 ? Math.min(100, (gram / targetTotal) * 100) : 0;
            const totalPeriode = k.durasi_periode || 0;
            const nominalSetor = p?.rekap.nominal_total_setor ?? 0;
            const targetNominal = totalPeriode > 0 ? nominalPlan * totalPeriode : 0;
            const pctPeriode = targetNominal > 0
              ? Math.min(100, Math.max(0, (nominalSetor / targetNominal) * 100))
              : pctGram;
            const sisaPeriode = p?.sisa_periode != null ? Number(p.sisa_periode) : null;
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
                    disabled={refundPending}
                    onClick={() => handleSetor(nominalPlan, k.id)}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                      refundPending
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 text-white shadow-md shadow-blue-600/25'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Setor Rp {formatRupiah(nominalPlan)}
                  </button>
                </div>

                {refundPending && (
                  <div className="mt-3 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-3.5">
                    <p className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Pengajuan batal &amp; refund menunggu verifikasi admin
                    </p>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                      Rencana dikunci sementara. Setelah admin memverifikasi, rencana ini resmi dibatalkan.
                    </p>
                  </div>
                )}

                {/* Tagihan: periode jatuh tempo yang belum dibayar — biar tak kelupaan */}
                {(() => {
                  const tertunggak = p?.tertunggak?.jumlah_periode ?? 0;
                  const nominalTagihan = p?.tertunggak?.nominal ?? 0;
                  if (tertunggak <= 0) return null;
                  const satuan =
                    k.frekuensi_setor === 'harian' ? 'hari'
                    : k.frekuensi_setor === 'mingguan' ? 'minggu' : 'bulan';
                  return (
                    <div className="mt-3 rounded-2xl border border-rose-200/70 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 p-3.5">
                      <p className="text-[11px] font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Tagihan Anda {tertunggak.toLocaleString('id-ID')} {satuan} ({formatRupiah(nominalTagihan)})
                      </p>
                      <p className="text-[10px] text-rose-600/80 dark:text-rose-300/70 mt-0.5">
                        Periode belum dibayar: {tertunggak.toLocaleString('id-ID')} × Rp {formatRupiah(nominalPlan)} — segera setor agar tidak menumpuk.
                      </p>
                      <button
                        type="button"
                        disabled={refundPending}
                        onClick={() => handleSetor(nominalPlan, k.id)}
                        className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer ${
                          refundPending
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                            : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/25'
                        }`}
                        title="Setor 1 periode; tagihan berkurang otomatis setiap setoran terverifikasi"
                      >
                        <Plus className="w-3.5 h-3.5" /> Setor Sekarang ({formatRupiah(nominalPlan)}/periode)
                      </button>
                    </div>
                  );
                })()}

                {/* Progress: pembayaran periode (nominal) + capaian gram */}
                <div className="mt-3">
                  {totalPeriode > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        <span>Cicilan dibayar {sisaPeriode != null ? `${totalPeriode - sisaPeriode} dari ${totalPeriode}` : '—'}×</span>
                        {sisaPeriode != null && <span className="text-amber-700 dark:text-amber-300">{pctPeriode.toFixed(1)}%</span>}
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500" style={{ width: `${pctPeriode}%` }} />
                      </div>
                      {targetTotal && targetTotal > 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-400">
                          Gram terkumpul {gram.toFixed(4)} dari {targetTotal} gr
                        </p>
                      )}
                    </div>
                  ) : targetTotal && targetTotal > 0 ? (
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
                {refundPending ? (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-300 mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/50 text-right">
                    Menunggu verifikasi refund oleh admin…
                  </p>
                ) : (
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
                          dana: p?.rekap.saldo_dana_rencana ?? 0,
                          totalSetor: p?.rekap.total_setoran_emas ?? 0
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 hover:underline cursor-pointer"
                    >
                      <Banknote className="w-3 h-3" /> Batal & Refund (potongan 10%)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden sm:my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Cairkan Emas (Full)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Goal tercapai — saldo emas penuh dicairkan dengan potongan 10%.
                </p>
              </div>
              <button onClick={resetKeluar} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleKeluar} className="p-6 space-y-4">
              <div className="p-4 rounded-2xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Perkiraan Diterima
                </span>
                <p className="text-xl font-extrabold mt-0.5 text-amber-700 dark:text-amber-300">
                  Rp {formatRupiah(Math.round(userEmasRupiahTotal - userEmasRupiahTotal * 0.10))}
                </p>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/70">
                  <p>Nilai emas: Rp {formatRupiah(userEmasRupiahTotal)}</p>
                  <p>Potongan 10%: −Rp {formatRupiah(Math.round(userEmasRupiahTotal * 0.10))}</p>
                </div>
                <span className="block mt-1 text-[11px] text-amber-700/70 dark:text-amber-300/60">
                  Kurs acuan Rp {formatRupiah(activeHarga)} / gram · saldo dana (jika ada) ikut dicairkan & dipotong 10%.
                </span>
              </div>

              <div>
                <label className={labelCls}>Bank Tujuan</label>
                <input type="text" value={rekBank} onChange={(e) => setRekBank(e.target.value)} required className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nomor Rekening</label>
                  <input type="text" inputMode="numeric" maxLength={20} value={rekNo}
                    onChange={(e) => setRekNo(e.target.value.replace(/[^\d]/g, '').slice(0, 20))} required
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden sm:my-8 animate-in zoom-in-95 duration-200">
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
                  const {
                    nilaiGram,
                    potongan,
                    refundEmas,
                    refundTotal
                  } = hitungRefundRencana(batalPlan);
                  return (
                    <>
                      {refundTotal > 0 ? (
                        <>
                          <p className="text-xl font-extrabold mt-0.5 text-rose-700 dark:text-rose-300">Rp {formatRupiah(refundTotal)}</p>
                          <div className="mt-2 space-y-1 text-[11px] text-rose-700/80 dark:text-rose-300/70">
                            <p>Nilai emas ({batalPlan.gram.toFixed(4)} gr × harga jual): Rp {formatRupiah(nilaiGram)}</p>
                            <p>Total setoran emas (rupiah yang jadi gram): Rp {formatRupiah(Math.round(batalPlan.totalSetor))}</p>
                            <p>Potongan 10% (dari total setoran emas): −Rp {formatRupiah(potongan)}</p>
                            <p>Refund emas: Rp {formatRupiah(refundEmas)}</p>
                            <p>Saldo dana rencana (dikembalikan penuh): Rp {formatRupiah(batalPlan.dana)}</p>
                          </div>
                          <span className="text-[11px] text-rose-700/80 dark:text-rose-300/70">Harga jual Rp {formatRupiah(batalPlan.gram > 0 ? hargaJualPerGram(activeHarga, batalPlan.gram) : 0)} / gram</span>
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
                const { refundTotal } = hitungRefundRencana(batalPlan);
                return refundTotal > 0 && (
                  <>
                    <div>
                      <label className={labelCls}>Bank Tujuan</label>
                      <input type="text" value={rekBank} onChange={(e) => setRekBank(e.target.value)} required className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nomor Rekening</label>
                        <input type="text" inputMode="numeric" maxLength={20} value={rekNo}
                          onChange={(e) => setRekNo(e.target.value.replace(/[^\d]/g, '').slice(0, 20))} required
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