import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Landmark, Eye, Gem, Plus, ArrowLeft } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { AjukanGadaiPayload, Gadai } from '../../types';
import { StatusBadge, GadaiDetailModal } from '../admin/AdminGadai';

export const UserGadai: React.FC = () => {
  const { gadai, hargaEmas } = useApp();
  const [detail, setDetail] = useState<Gadai | null>(null);
  const [ajukan, setAjukan] = useState(false);

  if (ajukan) {
    return (
      <AjukanGadaiPage
        hargaPerGram={[...hargaEmas].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)).find(h => h.status_aktif)?.harga_per_gram ?? null}
        onBack={() => setAjukan(false)}
      />
    );
  }

  const totalDipinjam = gadai.filter(g => ['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)).reduce((a, g) => a + Number(g.besaran_gadai || 0), 0);
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
        Emas Anda menjadi jaminan pembiayaan. Jatuh tempo & pembayaran diatur oleh pengurus koperasi.
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
          {gadai.map(g => (
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
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sisa Pokok</div>
                    <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">{formatRupiah(g.sisa_pokok)}</div>
                    <div className="text-[10px] text-slate-400">Terbayar {formatRupiah(g.total_dibayar)}</div>
                  </div>
                  <button
                    onClick={() => setDetail(g)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 cursor-pointer"
                    title="Detail"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <GadaiDetailModal gadai={detail} onClose={() => setDetail(null)} />
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