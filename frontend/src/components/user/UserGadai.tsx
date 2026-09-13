import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Landmark, Eye, Gem, Wallet, Upload, X, Building2, CheckCircle2 } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { Gadai } from '../../types';
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
const BayarAngsuranModal: React.FC<{ gadai: Gadai; initialMode?: 'angkuran' | 'pelunasan'; onClose: () => void }> = ({ gadai, initialMode, onClose }) => {
  const { bayarGadaiUser, showToast } = useApp();
  const sisa = Math.max(Number(gadai.sisa_pokok || 0), 0);
  const angkuran = Number(gadai.nominal_angkuran || 0);
  const [mode, setMode] = useState<'angkuran' | 'pelunasan'>(initialMode ?? (angkuran > 0 && angkuran <= sisa ? 'angkuran' : 'pelunasan'));
  const [bukti, setBukti] = useState<File | null>(null);
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(false);

  const n = mode === 'pelunasan' ? sisa : angkuran;

  const submit = () => {
    if (n <= 0) return showToast('Nominal pembayaran harus lebih dari 0.', 'error');
    if (mode === 'angkuran' && angkuran > sisa + 1) return showToast('Sisa pokok kurang dari angkuran. Gunakan opsi Lunasi Sisa.', 'error');
    if (!bukti) return showToast('Upload bukti transfer terlebih dahulu.', 'error');

    const fd = new FormData();
    fd.append('nominal', String(n));
    fd.append('metode_pembayaran', 'transfer');
    if (catatan) fd.append('catatan', catatan);
    fd.append('bukti_transfer', bukti);

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
                <Wallet className="w-5 h-5 text-amber-500" /> {mode === 'pelunasan' ? 'Lunasi Gadai' : 'Bayar Angsuran'}
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
              <label className={lCls}>Jenis Pembayaran</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('angkuran')}
                  disabled={angkuran <= 0 || angkuran > sisa + 1}
                  className={`px-3 py-2.5 rounded-2xl border text-[11px] font-bold text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    mode === 'angkuran'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Angkuran
                  <div className="text-[10px] font-extrabold mt-0.5">{angkuran > 0 ? formatRupiah(angkuran) : '-'}</div>
                </button>
                <button
                  onClick={() => setMode('pelunasan')}
                  disabled={sisa <= 0}
                  className={`px-3 py-2.5 rounded-2xl border text-[11px] font-bold text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    mode === 'pelunasan'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Lunasi Sisa Kini
                  <div className="text-[10px] font-extrabold mt-0.5">{formatRupiah(sisa)}</div>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Nominal terkunci sesuai ketentuan pengurus. Lunasi sisa sekali bayar = gadai selesai, emas dikembalikan.</p>
            </div>
            <div>
              <label className={lCls}>Nominal Dibayar</label>
              <input type="text" value={formatRupiah(n)} readOnly className={`${iCls} bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400`} />
            </div>
            <div>
              <label className={lCls}>Metode Pembayaran</label>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Transfer Bank
              </div>
            </div>
            <div>
              <label className={lCls}>Upload Bukti Transfer</label>
              <label className="flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-amber-400 transition-colors">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {bukti ? bukti.name : 'Pilih file gambar...'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setBukti(e.target.files?.[0] || null)} />
              </label>
              {mode === 'pelunasan' && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Bukti transfer wajib untuk pelunasan.</p>
              )}
            </div>
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
              {loading ? 'Mengirim...' : (mode === 'pelunasan' ? 'Kirim Pelunasan' : 'Kirim Pembayaran')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
export const UserGadai: React.FC = () => {
  const { gadai } = useApp();
  const [detail, setDetail] = useState<Gadai | null>(null);
  const [bayarFor, setBayarFor] = useState<Gadai | null>(null);
  const [lunasiFor, setLunasiFor] = useState<Gadai | null>(null);

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
          Belum ada pembiayaan gadai. Pengajuan gadai dilakukan melalui pengurus koperasi.
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
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setBayarFor(g)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer transition-all"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Bayar Angsuran ({formatRupiah(g.nominal_angkuran)}/periode)
                    </button>
                    <button
                      onClick={() => setLunasiFor(g)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lunasi Sekarang
                    </button>
                  </div>
                )}

                {g.status === 'lunas' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Gadai Anda LUNAS. Emas siap dikembalikan — tunggu konfirmasi pengambilan dari toko.
                  </div>
                )}
                {g.status === 'emas_dikembalikan' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Silakan ambil emas Anda kembali di toko.
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
      {lunasiFor && (
        <BayarAngsuranModal gadai={lunasiFor} initialMode="pelunasan" onClose={() => setLunasiFor(null)} />
      )}
    </div>
  );
};

const STATUS_LABEL_FREQ: Record<string, string> = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' };