import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Landmark, Eye, Gem, Plus, ArrowLeft, Wallet, Upload, X } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { AjukanGadaiPayload, Gadai, MetodePembayaran } from '../../types';
import { StatusBadge, GadaiDetailModal } from '../admin/AdminGadai';

// ─── Progress Bar Component ──────────────────────────────────
const GadaiProgressBar: React.FC<{ total: number; terbayar: number; compact?: boolean }> = ({ total, terbayar, compact }) => {
  const pct = total > 0 ? Math.min(100, (terbayar / total) * 100) : 0;
  const rounded = Math.round(pct * 10) / 10;

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progres Pelunasan</span>
        <span className={`text-[11px] font-extrabold ${pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {rounded}%
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            pct >= 100
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : pct >= 60
              ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
              : 'bg-gradient-to-r from-amber-500 to-amber-400'
          }`}
          style={{ width: `${Math.max(rounded, 1)}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between mt-1 text-[10px] text-slate-400">
          <span>Terbayar: {formatRupiah(terbayar)}</span>
          <span>Total: {formatRupiah(total)}</span>
        </div>
      )}
    </div>
  );
};

// ─── User Gadai Payment Modal ────────────────────────────────
const BayarAngsuranModal: React.FC<{ gadai: Gadai; onClose: () => void }> = ({ gadai, onClose }) => {
  const { bayarGadaiUser, showToast } = useApp();
  const [nominal, setNominal] = useState(String(gadai.nominal_angkuran || ''));
  const [metode, setMetode] = useState<MetodePembayaran>('transfer');
  const [bukti, setBukti] = useState<File | null>(null);
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(false);

  const sisa = Number(gadai.sisa_pokok || 0);
  const n = parseFloat(nominal) || 0;

  const submit = () => {
    if (n <= 0) return showToast('Nominal pembayaran harus lebih dari 0.', 'error');
    if (n > sisa && Math.abs(n - sisa) > 1) return showToast(`Nominal melebihi sisa pokok (${formatRupiah(sisa)}).`, 'error');
    if (metode === 'transfer' && !bukti) return showToast('Upload bukti transfer terlebih dahulu.', 'error');

    const fd = new FormData();
    fd.append('nominal', String(Math.min(n, sisa)));
    fd.append('metode_pembayaran', metode);
    if (catatan) fd.append('catatan', catatan);
    if (bukti) fd.append('bukti_transfer', bukti);

    setLoading(true);
    bayarGadaiUser(gadai.id, fd);
    onClose();
  };

  const iCls = 'w-full py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50';
  const lCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" /> Bayar Angsuran
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {gadai.nomor_gadai} · Sisa pokok <b className="text-amber-600 dark:text-amber-400">{formatRupiah(sisa)}</b>
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <GadaiProgressBar total={Number(gadai.besaran_gadai)} terbayar={Number(gadai.total_dibayar)} compact />

          <div className="space-y-3 mt-4">
            <div>
              <label className={lCls}>Nominal Dibayar</label>
              <input type="number" inputMode="numeric" value={nominal} onChange={e => setNominal(e.target.value)} className={iCls} />
              <p className="text-[10px] text-slate-400 mt-0.5">Angsuran per periode: {formatRupiah(gadai.nominal_angkuran)}</p>
            </div>
            <div>
              <label className={lCls}>Metode Pembayaran</label>
              <select value={metode} onChange={e => setMetode(e.target.value as MetodePembayaran)} className={iCls}>
                <option value="transfer">Transfer Bank</option>
                <option value="cash">Cash (Tunai)</option>
              </select>
            </div>
            {metode === 'transfer' && (
              <div>
                <label className={lCls}>Upload Bukti Transfer</label>
                <label className="flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-amber-400 transition-colors">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {bukti ? bukti.name : 'Pilih file gambar...'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setBukti(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}
            <div>
              <label className={lCls}>Catatan (opsional)</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} className={iCls} placeholder="Catatan untuk admin" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
              Batal
            </button>
            <button onClick={submit} disabled={loading} className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 cursor-pointer disabled:opacity-50">
              {loading ? 'Mengirim...' : 'Kirim Pembayaran'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
export const UserGadai: React.FC = () => {
  const { gadai, hargaEmas } = useApp();
  const [detail, setDetail] = useState<Gadai | null>(null);
  const [ajukan, setAjukan] = useState(false);
  const [bayarFor, setBayarFor] = useState<Gadai | null>(null);

  if (ajukan) {
    return (
      <AjukanGadaiPage
        hargaPerGram={[...hargaEmas].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).find(h => h.status_aktif)?.harga_per_gram ?? null}
        onBack={() => setAjukan(false)}
      />
    );
  }

  const aktifStatuses = ['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'];
  const totalDipinjam = gadai.filter(g => aktifStatuses.includes(g.status)).reduce((a, g) => a + Number(g.besaran_gadai || 0), 0);
  const totalTerbayar = gadai.reduce((a, g) => a + Number(g.total_dibayar || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 mb-1">
            <Gem className="w-3 h-3" /> Gadai Emas Berkah Mulia
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>Gadai Emas Saya</span>
          </h1>
        </div>
        <button
          onClick={() => setAjukan(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Ajukan Gadai
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3">
        Emas Anda menjadi jaminan pembiayaan. Jatuh tempo &amp; pembayaran diatur oleh pengurus koperasi.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pengajuan</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5 text-slate-800 dark:text-slate-100">{gadai.length}</div>
        </div>
        <div className="rounded-3xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pembiayaan Aktif</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5 text-amber-600 dark:text-amber-400 break-all">{formatRupiah(totalDipinjam)}</div>
        </div>
        <div className="rounded-3xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Terbayar</div>
          <div className="text-lg sm:text-xl font-extrabold font-mono mt-0.5 text-emerald-600 dark:text-emerald-400">{formatRupiah(totalTerbayar)}</div>
        </div>
      </div>

      {gadai.length === 0 ? (
        <div className="rounded-3xl p-12 text-center text-sm text-slate-400 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          Belum ada pengajuan gadai. Klik <span className="font-bold text-amber-600 dark:text-amber-400">Ajukan Gadai</span> untuk memulai.
        </div>
      ) : (
        <div className="space-y-3">
          {gadai.map(g => {
            const canPay = aktifStatuses.includes(g.status);
            return (
              <div key={g.id} className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">{g.nomor_gadai}</span>
                      <StatusBadge status={g.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                      {g.jenis_emas} · {g.berat_gram.toLocaleString('id-ID')}g ({g.kadar}/1000) · Taksiran {formatRupiah(g.nilai_taksiran)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Besaran {formatRupiah(g.besaran_gadai)} · Jatuh tempo {g.tanggal_jatuh_tempo || '-'} · Tenor {STATUS_LABEL_FREQ[g.tenor_satuan]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sisa Pokok</div>
                      <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">{formatRupiah(g.sisa_pokok)}</div>
                      <div className="text-[10px] text-slate-400">Terbayar {formatRupiah(g.total_dibayar)}</div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setDetail(g)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 cursor-pointer"
                        title="Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canPay && (
                        <button
                          onClick={() => setBayarFor(g)}
                          className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 cursor-pointer"
                          title="Bayar Angsuran"
                        >
                          <Wallet className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {Number(g.besaran_gadai) > 0 && g.status !== 'diajukan' && g.status !== 'disetujui' && (
                  <GadaiProgressBar total={Number(g.besaran_gadai)} terbayar={Number(g.total_dibayar)} />
                )}

                {/* Quick Pay Button */}
                {canPay && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setBayarFor(g)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer transition-all"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Bayar Angsuran ({formatRupiah(g.nominal_angkuran)}/periode)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <GadaiDetailModal gadai={detail} onClose={() => setDetail(null)} />
      )}
      {bayarFor && (
        <BayarAngsuranModal gadai={bayarFor} onClose={() => setBayarFor(null)} />
      )}
    </div>
  );
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';
const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50';

const AjukanGadaiPage: React.FC<{
  hargaPerGram: number | null;
  onBack: () => void;
}> = ({ hargaPerGram, onBack }) => {
  const { ajukanGadai, showToast } = useApp();
  const [jenis, setJenis] = useState('Antam LM 24K');
  const [berat, setBerat] = useState('');
  const [kadar, setKadar] = useState('916');
  const [tenor, setTenor] = useState<'harian' | 'mingguan' | 'bulanan'>('bulanan');
  const [frekuensi, setFrekuensi] = useState('bulanan');
  const [nominal, setNominal] = useState('');
  const [catatan, setCatatan] = useState('');

  const beratN = parseFloat(berat) || 0;
  const kadarN = parseFloat(kadar) || 0;
  const beratBersih = beratN * kadarN / 1000;
  const taksiran = hargaPerGram ? beratBersih * hargaPerGram : null;
  const besaran = taksiran ? taksiran * 0.8 : null;

  const submit = () => {
    if (!jenis.trim()) return showToast('Jenis emas wajib diisi', 'error');
    if (!(beratN > 0)) return showToast('Berat emas (gram) wajib diisi angka lebih dari 0', 'error');
    if (!(kadarN >= 1 && kadarN <= 1000)) return showToast('Kadar harus antara 1–1000 (per-mille, mis. 916)', 'error');
    if (!(parseFloat(nominal) > 0)) return showToast('Nominal angsuran wajib diisi angka', 'error');

    const payload: AjukanGadaiPayload = {
      jenis_emas: jenis.trim(),
      berat_gram: beratN,
      kadar: kadarN,
      tenor_satuan: tenor,
      frekuensi_bayar: frekuensi as AjukanGadaiPayload['frekuensi_bayar'],
      nominal_angkuran: parseFloat(nominal),
      catatan: catatan.trim() || undefined,
    };
    ajukanGadai(payload);
    onBack();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 mb-1">
            <Gem className="w-3 h-3" /> Gadai Emas Berkah Mulia
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>Ajukan Gadai Emas</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Emas Anda menjadi jaminan pembiayaan. Isi data emas yang akan digadai, lalu kirim untuk diproses pengurus koperasi.
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
      </div>

      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-4 text-xs">
        <div>
          <label className={labelCls}>Jenis Emas</label>
          <input className={inputCls} value={jenis} onChange={e => setJenis(e.target.value)} placeholder="mis. Antam LM 24K" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Berat (gram)</label>
            <input className={inputCls} type="number" inputMode="numeric" min={0.01} value={berat} onChange={e => setBerat(e.target.value)} placeholder="10.5" />
          </div>
          <div>
            <label className={labelCls}>Kadar (per-mille)</label>
            <input className={inputCls} type="number" inputMode="numeric" value={kadar} onChange={e => setKadar(e.target.value)} placeholder="916" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tenor</label>
            <select className={inputCls} value={tenor} onChange={e => setTenor(e.target.value as typeof tenor)}>
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Frekuensi Bayar</label>
            <select className={inputCls} value={frekuensi} onChange={e => setFrekuensi(e.target.value)}>
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Nominal Angsuran (Rp)</label>
          <input className={inputCls} type="number" inputMode="numeric" min={1} value={nominal} onChange={e => setNominal(e.target.value)} placeholder="500000" />
        </div>
        <div>
          <label className={labelCls}>Catatan (opsional)</label>
          <textarea className={inputCls} rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Keterangan tambahan, jika ada" />
        </div>

        <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] space-y-1">
          <div className="flex justify-between"><span className="text-amber-700 dark:text-amber-200">Berat bersih</span><span className="font-bold text-amber-900 dark:text-amber-100">{beratBersih.toLocaleString('id-ID', { maximumFractionDigits: 4 })} gram</span></div>
          {taksiran !== null ? (
            <>
              <div className="flex justify-between"><span className="text-amber-700 dark:text-amber-200">Taksiran emas</span><span className="font-bold text-amber-900 dark:text-amber-100">{formatRupiah(taksiran)}</span></div>
              <div className="flex justify-between"><span className="text-amber-700 dark:text-amber-200">Besaran gadai (80%)</span><span className="font-bold text-amber-900 dark:text-amber-100">{formatRupiah(besaran ?? 0)}</span></div>
            </>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">Harga acuan admin belum tersedia; taksiran dihitung saat pengajuan diproses.</p>
          )}
        </div>

        <button
          onClick={submit}
          className="w-full py-3 rounded-2xl text-xs font-extrabold text-white bg-amber-500 hover:bg-amber-600 shadow-sm cursor-pointer"
        >
          Kirim Pengajuan
        </button>
        <p className="text-[10px] text-slate-400 text-center">Setelah dikirim, pengajuan menunggu persetujuan pengurus koperasi.</p>
      </div>
    </div>
  );
};

const STATUS_LABEL_FREQ: Record<string, string> = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' };