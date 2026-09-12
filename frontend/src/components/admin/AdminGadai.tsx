import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Landmark,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  PlayCircle,
  Wallet,
  RefreshCcw,
  CalendarClock,
  AlarmClockOff,
  Undo2,
  Trash2,
  Gem,
  X
} from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { Gadai, MetodePembayaran } from '../../types';

export const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  diajukan: { label: 'Diajukan', cls: 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  disetujui: { label: 'Disetujui', cls: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  aktif: { label: 'Aktif', cls: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  jatuh_tempo: { label: 'Jatuh Tempo', cls: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  terlambat: { label: 'Terlambat', cls: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  diperpanjang: { label: 'Diperpanjang', cls: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
  lunas: { label: 'Lunas', cls: 'bg-emerald-600 text-white border-emerald-600' },
  batal: { label: 'Batal', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' }
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.batal;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
  );
};

export const GadaiDetailModal: React.FC<{ gadai: Gadai; onClose: () => void }> = ({ gadai: initial, onClose }) => {
  const { gadaiDetail, fetchGadaiDetail, clearGadaiDetail, verifikasiAngsuranGadai, tolakAngsuranGadai, showToast, currentUser } = useApp();
  const g = gadaiDetail || initial;
  const [tolakId, setTolakId] = useState<number | null>(null);
  const [tolakCatatan, setTolakCatatan] = useState('');

  useEffect(() => {
    clearGadaiDetail();
    fetchGadaiDetail(initial.id);
  }, [initial.id]);

  const pct = Number(g.besaran_gadai) > 0 ? Math.min(100, (Number(g.total_dibayar) / Number(g.besaran_gadai)) * 100) : 0;
  const isAdmin = currentUser?.role === 'admin';

  const handleVerifikasi = (angsuranId: number) => {
    verifikasiAngsuranGadai(angsuranId);
    setTimeout(() => fetchGadaiDetail(g.id), 500);
  };

  const handleTolak = (angsuranId: number) => {
    if (!tolakCatatan.trim()) return showToast('Alasan penolakan wajib diisi.', 'error');
    tolakAngsuranGadai(angsuranId, tolakCatatan);
    setTolakId(null);
    setTolakCatatan('');
    setTimeout(() => fetchGadaiDetail(g.id), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">{g.nomor_gadai}</span>
                <StatusBadge status={g.status} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {g.user?.name || 'Peserta'} · {g.user?.nomor_anggota || '-'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchGadaiDetail(g.id)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 cursor-pointer"
                title="Muat ulang detail"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <InfoBox label="Jenis Emas" value={g.jenis_emas} />
            <InfoBox label="Kadar" value={`${g.kadar}/1000`} />
            <InfoBox label="Berat Kotor" value={`${g.berat_gram.toLocaleString('id-ID')} g`} />
            <InfoBox label="Berat Bersih" value={`${g.berat_bersih_gram.toLocaleString('id-ID')} g`} highlight />
            <InfoBox label="Harga Acuan" value={formatRupiah(g.harga_acuan)} />
            <InfoBox label="Nilai Taksiran" value={formatRupiah(g.nilai_taksiran)} />
          </div>

          <div className={`rounded-2xl border p-4 mb-4 ${goldCardCls}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
              Besaran Gadai ({g.persen_gadai}% dari taksiran)
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-100">
              {formatRupiah(g.besaran_gadai)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-semibold text-amber-800/80 dark:text-amber-200/80">
              <span>Dibayar: {formatRupiah(g.total_dibayar)}</span>
              <span>Sisa Pokok: {formatRupiah(g.sisa_pokok)}</span>
            </div>

            {/* Progress Bar */}
            {Number(g.besaran_gadai) > 0 && g.status !== 'diajukan' && g.status !== 'disetujui' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Progres Pelunasan</span>
                  <span className={`text-[11px] font-extrabold ${pct >= 100 ? 'text-emerald-700' : 'text-amber-800 dark:text-amber-200'}`}>
                    {Math.round(pct * 10) / 10}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-amber-200/60 dark:bg-amber-900/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      pct >= 100
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    }`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            )}

            {g.status === 'batal' && (
              <p className="text-[11px] font-semibold mt-2 text-amber-700 dark:text-amber-300">
                Emas dikembalikan · potongan 10% dari total yang dibayar
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <InfoBox label="Tenor" value={tenorLabel(g.tenor_satuan)} />
            <InfoBox label="Frekuensi Bayar" value={freqLabel(g.frekuensi_bayar)} />
            <InfoBox label="Nominal Angkuran" value={formatRupiah(g.nominal_angkuran)} />
            <InfoBox label="Tanggal Aju" value={g.tanggal_aju} />
            <InfoBox label="Tanggal Aktif" value={g.tanggal_aktif || '-'} />
            <InfoBox label="Jatuh Tempo" value={g.tanggal_jatuh_tempo || '-'} />
            <InfoBox label="Toleransi (hari)" value={String(g.toleransi_hari)} />
            <InfoBox label="Tanggal Lunas" value={g.tanggal_lunas || '-'} />
            {g.catatan && <InfoBox label="Catatan" value={g.catatan} full />}
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">Riwayat Pembayaran</h4>
            {!g.angsuran || g.angsuran.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-3">Belum ada pembayaran tercatat.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/70">
                {g.angsuran.map((a) => {
                  const isPending = a.status_verifikasi === 'menunggu_verifikasi';
                  const isDitolak = a.status_verifikasi === 'ditolak';
                  const verBadge = isPending
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : isDitolak
                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                  const verLabel = isPending ? 'Menunggu' : isDitolak ? 'Ditolak' : 'Terverifikasi';

                  return (
                    <div key={a.id} className="px-4 py-3 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-100">{a.tanggal_bayar}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${verBadge}`}>{verLabel}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {a.pencatat || 'User'} · {a.metode_pembayaran || 'cash'}
                            {a.catatan && <span> · {a.catatan}</span>}
                          </div>
                          {isDitolak && a.catatan_admin && (
                            <div className="text-[10px] text-rose-500 mt-0.5">Alasan: {a.catatan_admin}</div>
                          )}
                        </div>
                        <span className={`font-extrabold font-mono ${isDitolak ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                          {formatRupiah(a.nominal)}
                        </span>
                      </div>

                      {/* Admin verification buttons */}
                      {isAdmin && isPending && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {tolakId === a.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={tolakCatatan}
                                onChange={e => setTolakCatatan(e.target.value)}
                                placeholder="Alasan penolakan..."
                                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                              />
                              <button onClick={() => handleTolak(a.id)} className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-bold cursor-pointer">Tolak</button>
                              <button onClick={() => { setTolakId(null); setTolakCatatan(''); }} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 text-[10px] font-bold cursor-pointer">Batal</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVerifikasi(a.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Verifikasi
                              </button>
                              <button
                                onClick={() => setTolakId(a.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                              >
                                <X className="w-3 h-3" /> Tolak
                              </button>
                              {a.bukti_transfer_path && (
                                <span className="text-[10px] text-indigo-500 font-bold ml-auto">📎 Bukti terlampir</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBox: React.FC<{ label: string; value: string; highlight?: boolean; full?: boolean }> = ({ label, value, highlight, full }) => (
  <div className={`rounded-2xl border px-3 py-2.5 ${full ? 'col-span-2' : ''} ${highlight
    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/70'}`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 break-all">{value}</div>
  </div>
);

const goldCardCls = 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800';

const tenorLabel = (t: string) => ({ harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' }[t] || t);
const freqLabel = (f: string) => ({ harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' }[f] || f);

export const AdminGadai: React.FC = () => {
  const { gadai, users, hargaEmas, searchQuery, approveGadai, aktifkanGadai, lunasiGadai, batalGadai, tandaiTerlambatGadai, perpanjangGadai, deleteGadai, showToast } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Gadai | null>(null);
  const [bayarFor, setBayarFor] = useState<Gadai | null>(null);
  const [delayBatalId, setDelayBatalId] = useState<number | null>(null);
  const [delayHapusId, setDelayHapusId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return gadai
      .filter(g => filterStatus === 'all' || g.status === filterStatus)
      .filter(g => !q || g.nomor_gadai.toLowerCase().includes(q) || (g.user?.name || '').toLowerCase().includes(q) || g.jenis_emas.toLowerCase().includes(q));
  }, [gadai, filterStatus, searchQuery]);

  const sumActive = (key: 'besaran_gadai' | 'sisa_pokok') =>
    gadai.filter(g => ['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)).reduce((acc, g) => acc + Number(g[key] || 0), 0);

  const hargaAcuanDefault = useMemo(() => {
    const aktif = hargaEmas.find(h => h.status_aktif);
    return aktif ? aktif.harga_per_gram : (hargaEmas[0]?.harga_per_gram || 0);
  }, [hargaEmas]);

  const duaLangkah = (state: boolean, setState: (v: boolean) => void, run: () => void) => {
    if (!state) {
      setState(true);
      setTimeout(() => setState(false), 4000);
      return;
    }
    setState(false);
    run();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 mb-1">
            <Gem className="w-3 h-3" /> Produk Pembiayaan Gadai Emas Syariah
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            <span>Pengelolaan Gadai Emas</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Taksiran dari berat bersih &times; harga acuan. Besaran gadai = persen gadai &times; taksiran.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Buat Pengajuan Gadai
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Pengajuan Masuk" value={String(gadai.filter(g => g.status === 'diajukan').length)} accent="sky" />
        <SumCard label="Aktif Terbayar" value={formatRupiah(sumActive('besaran_gadai'))} accent="emerald" />
        <SumCard label="Piutang Tersisa" value={formatRupiah(sumActive('sisa_pokok'))} accent="amber" />
        <SumCard label="Lunas" value={String(gadai.filter(g => g.status === 'lunas').length)} accent="violet" />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilterStatus('all')} className={filterChip(filterStatus === 'all')}>Semua</button>
        {Object.keys(STATUS_CFG).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={filterChip(filterStatus === s)}>
            {STATUS_CFG[s].label} ({gadai.filter(g => g.status === s).length})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl p-12 text-center text-sm text-slate-400 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
          Belum ada data gadai yang sesuai.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => (
            <div key={g.id} className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">{g.nomor_gadai}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                    {g.user?.name || `Peserta #${g.user_id}`} · {g.jenis_emas} · {g.berat_gram.toLocaleString('id-ID')}g ({g.kadar}/1000)
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Taksiran {formatRupiah(g.nilai_taksiran)} · Besaran {formatRupiah(g.besaran_gadai)} · Jatuh tempo {g.tanggal_jatuh_tempo || '-'}
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

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <ActionBtn
                  show={g.status === 'diajukan'}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  label="Setujui"
                  cls="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                  onClick={() => approveGadai(g.id)}
                />
                <ActionBtn
                  show={g.status === 'disetujui'}
                  icon={<PlayCircle className="w-3.5 h-3.5" />}
                  label="Aktifkan & Salurkan"
                  cls="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                  onClick={() => aktifkanGadai(g.id)}
                />
                <ActionBtn
                  show={['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)}
                  icon={<Wallet className="w-3.5 h-3.5" />}
                  label="Catat Bayar"
                  cls="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                  onClick={() => setBayarFor(g)}
                />
                <ActionBtn
                  show={['aktif', 'jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  label="Lunasi"
                  cls="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                  onClick={() => lunasiGadai(g.id)}
                />
                <ActionBtn
                  show={['aktif', 'jatuh_tempo', 'diperpanjang'].includes(g.status)}
                  icon={<AlarmClockOff className="w-3.5 h-3.5" />}
                  label="Tandai Terlambat"
                  cls="bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                  onClick={() => tandaiTerlambatGadai(g.id)}
                />
                <ActionBtn
                  show={['jatuh_tempo', 'terlambat', 'diperpanjang'].includes(g.status)}
                  icon={<CalendarClock className="w-3.5 h-3.5" />}
                  label="Perpanjang Tenor"
                  cls="bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100"
                  onClick={() => perpanjangGadai(g.id)}
                />
                <button
                  onClick={() => duaLangkah(delayBatalId === g.id, v => { if (v) setDelayBatalId(null); else setDelayBatalId(g.id); }, () => batalGadai(g.id))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {delayBatalId === g.id ? 'Yakin batalkan?' : 'Batalkan'}
                </button>
                {g.status === 'diajukan' && (
                  <button
                    onClick={() => duaLangkah(delayHapusId === g.id, v => { if (v) setDelayHapusId(null); else setDelayHapusId(g.id); }, () => deleteGadai(g.id))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {delayHapusId === g.id ? 'Yakin hapus?' : 'Hapus'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <GadaiCreateModal
          hargaAcuanDefault={hargaAcuanDefault}
          onClose={() => setShowCreate(false)}
        />
      )}
      {bayarFor && (
        <GadaiBayarModal
          gadai={bayarFor}
          onClose={() => setBayarFor(null)}
        />
      )}
      {detail && (
        <GadaiDetailModal
          gadai={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
};

const SumCard: React.FC<{ label: string; value: string; accent: 'sky' | 'emerald' | 'amber' | 'violet' }> = ({ label, value, accent }) => {
  const clr = {
    sky: 'text-sky-600 dark:text-sky-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    violet: 'text-violet-600 dark:text-violet-400'
  }[accent];
  return (
    <div className="rounded-3xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-lg sm:text-xl font-extrabold font-mono mt-0.5 ${clr} break-all`}>{value}</div>
    </div>
  );
};

const filterChip = (active: boolean) =>
  `px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
    active
      ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
  }`;

const ActionBtn: React.FC<{ show: boolean; icon: React.ReactNode; label: string; cls: string; onClick: () => void }> = ({ show, icon, label, cls, onClick }) =>
  show ? (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${cls}`}>
      {icon} {label}
    </button>
  ) : null;

const GadaiCreateModal: React.FC<{ hargaAcuanDefault: number; onClose: () => void }> = ({ hargaAcuanDefault, onClose }) => {
  const { users, createGadai, showToast } = useApp();
  const peserta = users.filter(u => u.role === 'user' && u.status === 'active');

  const [user_id, setUserId] = useState<number | undefined>();
  const [jenis_emas, setJenisEmas] = useState('');
  const [berat_gram, setBeratGram] = useState('');
  const [kadar, setKadar] = useState('916');
  const [harga_acuan, setHargaAcuan] = useState(String(hargaAcuanDefault || ''));
  const [persen_gadai, setPersenGadai] = useState('80');
  const [tenor_satuan, setTenorSatuan] = useState<'harian' | 'mingguan' | 'bulanan'>('bulanan');
  const [toleransi_hari, setToleransiHari] = useState('7');
  const [frekuensi_bayar, setFrekuensiBayar] = useState('bulanan');
  const [nominal_angkuran, setNominalAngkuran] = useState('');
  const [catatan, setCatatan] = useState('');

  const berat = parseFloat(berat_gram) || 0;
  const kadarN = parseFloat(kadar) || 0;
  const hargaN = parseFloat(harga_acuan) || 0;
  const persenN = parseFloat(persen_gadai) || 0;
  const beratBersih = berat * kadarN / 1000;
  const taksiran = beratBersih * hargaN;
  const besaran = taksiran * persenN / 100;

  const submit = () => {
    if (!user_id) return showToast('Pilih peserta terlebih dahulu.', 'error');
    if (!jenis_emas.trim()) return showToast('Jenis emas wajib diisi.', 'error');
    if (berat <= 0) return showToast('Berat emas harus lebih dari 0.', 'error');
    if (kadarN <= 0 || kadarN > 1000) return showToast('Kadar harus antara 1–1000 (per-mille).', 'error');
    if (hargaN <= 0) return showToast('Harga acuan lebih dari 0.', 'error');
    if (persenN <= 0 || persenN > 100) return showToast('Persen gadai antara 1–100.', 'error');
    if (parseFloat(nominal_angkuran) <= 0) return showToast('Nominal angkuran lebih dari 0.', 'error');
    createGadai({
      user_id,
      jenis_emas: jenis_emas.trim(),
      berat_gram: berat,
      kadar: kadarN,
      harga_acuan: hargaN,
      persen_gadai: persenN,
      tenor_satuan,
      toleransi_hari: Math.max(0, parseInt(toleransi_hari) || 0),
      frekuensi_bayar: frekuensi_bayar as 'harian' | 'mingguan' | 'bulanan',
      nominal_angkuran: parseFloat(nominal_angkuran),
      catatan: catatan || undefined
    });
    onClose();
  };

  const inputCls = 'w-full py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Gem className="w-5 h-5 text-amber-500" /> Pengajuan Gadai Baru
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status awal: DIAJUKAN — akan diverifikasi oleh admin.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Peserta</label>
              <select value={user_id ?? ''} onChange={e => setUserId(Number(e.target.value) || undefined)} className={inputCls}>
                <option value="">Pilih peserta…</option>
                {peserta.map(u => (
                  <option key={u.id} value={u.id}>{u.name} {u.nomor_anggota ? `(${u.nomor_anggota})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Jenis Emas</label>
              <input value={jenis_emas} onChange={e => setJenisEmas(e.target.value)} placeholder="cth: Anting emas 22K" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Berat Kotor (gram)</label>
                <input type="number" inputMode="decimal" value={berat_gram} onChange={e => setBeratGram(e.target.value)} placeholder="cth: 10.5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kadar (per-mille, 1–1000)</label>
                <input type="number" inputMode="numeric" value={kadar} onChange={e => setKadar(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Harga Acuan / gram</label>
                <input type="number" inputMode="numeric" value={harga_acuan} onChange={e => setHargaAcuan(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Persen Gadai (%)</label>
                <input type="number" inputMode="numeric" value={persen_gadai} onChange={e => setPersenGadai(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Live preview */}
            <div className={`rounded-2xl border p-4 ${goldCardCls}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">Pratinjau Hitungan</div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-amber-800/90 dark:text-amber-200/90">
                <span>Berat bersih: <b>{beratBersih.toLocaleString('id-ID')} g</b></span>
                <span>Nilai taksiran: <b>{formatRupiah(taksiran)}</b></span>
                <span>Besaran gadai ({persenN || 0}%): <b>{formatRupiah(besaran)}</b></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tenor (periode pertama)</label>
                <select value={tenor_satuan} onChange={e => setTenorSatuan(e.target.value as typeof tenor_satuan)} className={inputCls}>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Toleransi keterlambatan (hari)</label>
                <input type="number" inputMode="numeric" value={toleransi_hari} onChange={e => setToleransiHari(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Frekuensi Bayar</label>
                <select value={frekuensi_bayar} onChange={e => setFrekuensiBayar(e.target.value)} className={inputCls}>
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Nominal Angkuran (per periode)</label>
                <input type="number" inputMode="numeric" value={nominal_angkuran} onChange={e => setNominalAngkuran(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Catatan (opsional)</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Pola emas, kondisi fisik, dsb." className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
              Batal
            </button>
            <button onClick={submit} className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 cursor-pointer">
              Simpan Pengajuan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GadaiBayarModal: React.FC<{ gadai: Gadai; onClose: () => void }> = ({ gadai, onClose }) => {
  const { bayarGadai, showToast } = useApp();
  const [nominal, setNominal] = useState(String(gadai.nominal_angkuran || ''));
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [metode, setMetode] = useState<MetodePembayaran>('cash');
  const [catatan, setCatatan] = useState('');

  const n = parseFloat(nominal) || 0;
  const sisa = Number(gadai.sisa_pokok || 0);

  const submit = () => {
    if (n <= 0) return showToast('Nominal pembayaran harus lebih dari 0.', 'error');
    if (n > sisa && Math.abs(n - sisa) > 1) return showToast(`Nominal melebihi sisa pokok (${formatRupiah(sisa)}).`, 'error');
    bayarGadai(gadai.id, { nominal: Math.min(n, sisa), tanggal_bayar: tanggal, metode_pembayaran: metode, catatan: catatan || undefined });
    onClose();
  };

  const inputCls = 'w-full py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" /> Catat Pembayaran
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {gadai.nomor_gadai} · Sisa pokok <b className="text-amber-600 dark:text-amber-400">{formatRupiah(sisa)}</b>
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nominal Dibayar</label>
              <input type="number" inputMode="numeric" value={nominal} onChange={e => setNominal(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tanggal Bayar</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Metode</label>
              <select value={metode} onChange={e => setMetode(e.target.value as MetodePembayaran)} className={inputCls}>
                <option value="cash">Cash (Tunai)</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Catatan (opsional)</label>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
              Batal
            </button>
            <button onClick={submit} className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 cursor-pointer">
              Simpan Pembayaran
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};