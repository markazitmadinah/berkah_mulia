import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import { formatRupiah, parseRupiah, fmtRupiahTyping, fmtRupiahBlur } from '../../utils/format';
import {
  ArrowLeft,
  Coins,
  Wallet,
  Landmark,
  Plus,
  Banknote,
  ArrowUpRight,
  Search,
  Users,
  AlertTriangle,
  Target,
  TrendingUp,
  Layers,
  Trash2,
  X
} from 'lucide-react';
import { JenisTabungan, User, FrekuensiSetoran, ProfilTabungan, ProfilQurban, SetoranBerkalaProgress, RencanaCashOption } from '../../types';
import { DaftarQurbanModal } from '../modals/DaftarQurbanModal';
import { QurbanIcon } from '../QurbanIcon';
import { hargaJualPerGram as hargaJualUtil } from '../../utils/hargaJual';

interface AdminManagementJenisProps {
  jenis: JenisTabungan;
  onBack: () => void;
  onOpenCash: (userId: number | undefined, jenisTabunganId: number, berjangkaId?: number, konfigurasiId?: number, nominal?: number) => void;
  onOpenProfilNasabah: (user: User) => void;
  refreshKey?: number;
}

type RowKind = 'saldo' | 'berjangka' | 'qurban';

interface MonitoringBerjangka {
  id: number;
  target_nominal: number;
  durasi_bulan: number;
  frekuensi_setor: FrekuensiSetoran;
  frekuensi_label: string;
  nominal_per_periode: number;
  terkumpul: number;
  persentase: number;
  sisa_target: number;
  status: string;
}

interface Row {
  user: User;
  kind: RowKind;
  progress?: ProfilTabungan['progress'];
  accounts?: MonitoringBerjangka[];
  qurban?: Array<Pick<ProfilQurban, 'id' | 'hewan' | 'jumlah_hewan' | 'target_dana' | 'total_terkumpul' | 'persentase' | 'status' | 'frekuensi_setor' | 'frekuensi_label' | 'nominal_per_periode' | 'sisa_pembayaran' | 'tertunggak'>>;
  tunggakan: { jumlah: number; nominal: number };
}

const FREKUENSI_LABEL: Record<FrekuensiSetoran, string> = {
  harian: 'Harian',
  mingguan: 'Mingguan',
  bulanan: 'Bulanan'
};

const ProgressBar: React.FC<{ value: number | null; color?: string }> = ({ value, color = 'bg-emerald-500' }) => (
  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
  </div>
);

const FrekuensiBadge: React.FC<{ frekuensi: string | null | undefined; label: string | null | undefined }> = ({ frekuensi, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${
    frekuensi === 'harian'
      ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
      : frekuensi === 'mingguan'
      ? 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300'
      : 'bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300'
  }`}>
    {label || frekuensi || 'Bulanan'}
  </span>
);

export const AdminManagementJenis: React.FC<AdminManagementJenisProps> = ({ jenis, onBack, onOpenCash, onOpenProfilNasabah, refreshKey }) => {
  const {
    users,
    monitoringNasabah,
    fetchMonitoringNasabah,
    clearMonitoringNasabah,
    tunggakanSetoran,
    fetchTunggakanSetoran,
    buatSetoranBerkala,
    buatTabunganBerjangkaAdmin,
    setTargetHariRayaAdmin,
    cairkanTabunganAdmin,
    deletePendaftaranQurban,
    showToast
  } = useApp();

  const [search, setSearch] = useState('');
  const [planModal, setPlanModal] = useState<{ user: User | null } | null>(null);
  const [tarikTarget, setTarikTarget] = useState<{ user: User; berjangkaId?: number; rencana?: RencanaCashOption[]; konfigurasiId?: number; saldo?: number } | null>(null);
  const [nominalTarik, setNominalTarik] = useState('');
  const [qurbanTarget, setQurbanTarget] = useState<{ userId?: number } | null>(null);
  const [batalQurban, setBatalQurban] = useState<{ id: number; user_name: string; hewan: string } | null>(null);
  const [selTargetByUser, setSelTargetByUser] = useState<Record<number, string>>({});

  const sbAktif = (r: Row): SetoranBerkalaProgress | null => {
    const sbList = r.kind === 'saldo' ? (r.progress!.setoran_berkala ?? []) : [];
    const saved = selTargetByUser[r.user.id];
    const selKey = saved && saved !== 'global'
      ? saved
      : sbList[0] ? `sb-${sbList[0].konfigurasi_id}` : 'global';
    return sbList.find(sb => `sb-${sb.konfigurasi_id}` === selKey) ?? null;
  };

  useEffect(() => {
    fetchMonitoringNasabah();
    fetchTunggakanSetoran();
    return () => clearMonitoringNasabah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Rencana berkala hanya untuk jenis yang punya konsep "rencana/target"
  const planType = jenis.tipe === 'emas'
    ? 'emas'
    : jenis.sub_jenis === 'berjangka'
    ? 'berjangka'
    : jenis.sub_jenis === 'qurban'
    ? 'qurban'
    : jenis.sub_jenis === 'hari_raya'
    ? 'hari_raya'
    : null;

  const tunggakanByUser = useMemo(() => {
    const map = new Map<number, { jumlah: number; nominal: number }>();
    (tunggakanSetoran?.items ?? [])
      .filter((i) => i.jenis_tabungan_id === jenis.id)
      .forEach((i) => {
        const cur = map.get(i.user_id) ?? { jumlah: 0, nominal: 0 };
        cur.jumlah += i.jumlah_periode_tertunggak;
        cur.nominal += i.nominal_tagihan;
        map.set(i.user_id, cur);
      });
    return map;
  }, [tunggakanSetoran, jenis]);

  const rows: Row[] = useMemo(() => {
    const data = monitoringNasabah ?? [];
    const out: Row[] = [];

    if (jenis.sub_jenis === 'berjangka') {
      data.forEach((m) => {
        const accounts = m.tabungan.find((t) => t.jenis_tabungan_id === jenis.id)?.berjangka ?? [];
        if (accounts.length === 0) return;
        out.push({ user: m.user, kind: 'berjangka', accounts, tunggakan: tunggakanByUser.get(m.user.id) ?? { jumlah: 0, nominal: 0 } });
      });
    } else if (jenis.sub_jenis === 'qurban') {
      data.forEach((m) => {
        if (m.qurban.length === 0) return;
        const tunggakan = m.qurban.reduce((acc, q) => {
          acc.jumlah += q.tertunggak?.jumlah_periode ?? 0;
          acc.nominal += q.tertunggak?.nominal ?? 0;
          return acc;
        }, { jumlah: 0, nominal: 0 });
        out.push({ user: m.user, kind: 'qurban', qurban: m.qurban, tunggakan });
      });
    } else {
      data.forEach((m) => {
        const progress = m.tabungan.find((t) => t.jenis_tabungan_id === jenis.id);
        if (!progress) return;
        const aktif = progress.saldo > 0
          || progress.pending_amount > 0
          || progress.total_setoran > 0
          || progress.target > 0
          || (progress.target_emas_gram ?? 0) > 0;
        if (!aktif) return;
        out.push({ user: m.user, kind: 'saldo', progress, tunggakan: tunggakanByUser.get(m.user.id) ?? { jumlah: 0, nominal: 0 } });
      });
    }

    const q = search.toLowerCase();
    const filtered = q ? out.filter((r) => r.user.name.toLowerCase().includes(q) || (r.user.nomor_anggota || '').toLowerCase().includes(q)) : out;
    return filtered.sort((a, b) => b.tunggakan.jumlah - a.tunggakan.jumlah || a.user.name.localeCompare(b.user.name));
  }, [monitoringNasabah, jenis, tunggakanByUser, search]);

  const totalSaldo = useMemo(() => rows.reduce((acc, r) => {
    if (r.kind === 'saldo') {
      const p = r.progress!;
      return acc + p.saldo + (jenis.tipe === 'emas' ? p.saldo_dana : 0);
    }
    if (r.kind === 'berjangka') return acc + (r.accounts ?? []).reduce((s, a) => s + a.terkumpul, 0);
    return acc + (r.qurban ?? []).reduce((s, q) => s + q.total_terkumpul, 0);
  }, 0), [rows, jenis]);

  const totalTunggakan = useMemo(() => rows.reduce((acc, r) => acc + r.tunggakan.nominal, 0), [rows]);
  const userTertunggak = useMemo(() => rows.filter((r) => r.tunggakan.jumlah > 0).length, [rows]);

  const jenisIcon = jenis.tipe === 'emas'
    ? <Coins className="w-6 h-6 text-amber-500" />
    : jenis.sub_jenis === 'qurban'
    ? <QurbanIcon className="w-6 h-6 text-emerald-500" />
    : jenis.sub_jenis === 'berjangka'
    ? <Wallet className="w-6 h-6 text-violet-500" />
    : jenis.sub_jenis === 'hari_raya'
    ? <Landmark className="w-6 h-6 text-rose-500" />
    : <Wallet className="w-6 h-6 text-sky-500" />;

  const openPlanFor = (user: User | null) => {
    if (planType === 'qurban') {
      setQurbanTarget({ userId: user?.id });
      return;
    }
    if (!planType) return;
    setPlanModal({ user });
  };

  const submitPlan = (userId: number, values: { nominal: number; frekuensi: FrekuensiSetoran; durasi: number; gram: number | null; gramPerPeriode?: number }) => {
    const refetch = () => { fetchMonitoringNasabah(); fetchTunggakanSetoran(); };
    if (planType === 'emas') {
      buatSetoranBerkala(userId, {
        nominal_per_periode: values.nominal,
        frekuensi_setor: values.frekuensi,
        durasi_periode: values.durasi,
        target_gram_total: values.gram && values.gram > 0 ? values.gram : undefined,
        target_gram_per_periode: values.gramPerPeriode && values.gramPerPeriode > 0 ? values.gramPerPeriode : undefined
      });
    } else if (planType === 'berjangka') {
      buatTabunganBerjangkaAdmin(userId, {
        target_nominal: values.nominal,
        durasi_bulan: values.durasi,
        frekuensi_setor: values.frekuensi,
        catatan: 'Dibuat admin (management tabungan).'
      });
    } else if (planType === 'hari_raya') {
      setTargetHariRayaAdmin(userId, values.nominal, {
        frekuensi_setor: values.frekuensi,
        nominal_per_periode: values.gram && values.gram > 0 ? values.gram : undefined
      });
    }
    setTimeout(refetch, 1200);
  };

  const submitTarik = (user: User) => {
    if (!tarikTarget) return;
    const isEmas = jenis.tipe === 'emas';
    const perluPilihRencana = isEmas && (tarikTarget.rencana?.length ?? 0) > 0;
    if (perluPilihRencana && !tarikTarget.konfigurasiId) return;

    const isPribadi = jenis.tipe !== 'emas' && jenis.sub_jenis !== 'berjangka';
    let nominal: number | undefined;
    if (isPribadi) {
      nominal = parseRupiah(nominalTarik);
      if (nominal < 10000) {
        showToast('Nominal penarikan minimal Rp 10.000.', 'error');
        return;
      }
      if (tarikTarget.saldo != null && nominal > tarikTarget.saldo) {
        showToast(`Nominal melebihi saldo tersedia (Rp ${formatRupiah(tarikTarget.saldo)}).`, 'error');
        return;
      }
    }

    cairkanTabunganAdmin(user.id, {
      jenis_tabungan_id: jenis.id,
      tabungan_berjangka_id: tarikTarget.berjangkaId,
      konfigurasi_id: perluPilihRencana ? tarikTarget.konfigurasiId : undefined,
      nominal,
      catatan_admin: isEmas
        ? 'Batal & refund tabungan emas oleh admin (potongan 10% dari total tabungan).'
        : 'Penarikan oleh admin (management tabungan).'
    });
    setTarikTarget(null);
    setNominalTarik('');
    setTimeout(() => { fetchMonitoringNasabah(); fetchTunggakanSetoran(); }, 1500);
  };

  const canTarikSaldo = (p: ProfilTabungan['progress']) =>
    jenis.tipe === 'emas' ? (Number(p.total_unit ?? 0) > 0) : p.saldo >= 10000;

  const handleQurbanClose = () => { setQurbanTarget(null); fetchMonitoringNasabah(); fetchTunggakanSetoran(); };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800">{jenisIcon}</div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{jenis.nama}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{jenis.deskripsi}</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nasabah…"
            className="w-64 py-2.5 pl-9 pr-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-2xl p-3 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 min-w-0">
          <p className="text-[9px] font-bold text-slate-400 uppercase truncate">Nasabah Menabung</p>
          <p className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 whitespace-nowrap">{rows.length}</p>
        </div>
        <div className="rounded-2xl p-3 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 min-w-0">
          <p className="text-[9px] font-bold text-slate-400 uppercase truncate">Total Saldo Terkumpul</p>
          <p className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 whitespace-nowrap">Rp {formatRupiah(totalSaldo)}</p>
        </div>
        <div className="rounded-2xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 min-w-0">
          <p className="text-[9px] font-bold text-rose-600 dark:text-rose-300 uppercase truncate">Total Tunggakan</p>
          <p className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-300 mt-0.5 whitespace-nowrap">Rp {formatRupiah(totalTunggakan)}</p>
        </div>
        <div className="rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 min-w-0">
          <p className="text-[9px] font-bold text-amber-600 dark:text-amber-300 uppercase truncate">Nasabah Tertunggak</p>
          <p className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-300 mt-0.5 whitespace-nowrap">{userTertunggak}</p>
        </div>
      </div>

      {/* Action toolbar */}
      <div className="rounded-3xl p-4 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 sticky top-4 z-20 shadow-sm">
        {planType ? (
          <button
            onClick={() => openPlanFor(null)}
            className="py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Buat Rencana Tabungan
          </button>
        ) : (
          <>
            <button
              onClick={() => onOpenCash(undefined, jenis.id)}
              className="py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition-colors cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5" /> Setor Cash Nasabah
            </button>
            <span className="text-[10px] text-slate-400 font-bold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Produk bebas — tidak ada rencana berkala
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] text-slate-400">
          Klik kartu nasabah untuk melihat profil lengkap & riwayat transaksi.
        </span>
      </div>

      {/* User list */}
      {!monitoringNasabah && (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 mt-3">Memuat nasabah produk {jenis.nama}…</p>
        </div>
      )}

      {monitoringNasabah && rows.length === 0 && (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            Belum ada nasabah yang menabung di produk ini.
          </p>
          {planType && (
            <button
              onClick={() => openPlanFor(null)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Buat Rencana Pertama
            </button>
          )}
          {!planType && (
            <button
              onClick={() => onOpenCash(undefined, jenis.id)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5" /> Setor Cash Nasabah
            </button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {rows.map((r) => (
            <div key={r.user.id} className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <UserAvatar userId={r.user.id} avatarPath={r.user.avatar_path} className="w-11 h-11 rounded-2xl object-cover" />
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onOpenProfilNasabah(r.user)}
                      className="text-sm font-extrabold text-slate-800 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Lihat profil lengkap"
                    >
                      {r.user.name}
                    </button>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                      {r.user.nomor_anggota || r.user.email}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Saldo: <strong className="text-slate-700 dark:text-slate-200">{r.kind === 'saldo' ? `Rp ${formatRupiah(r.progress!.saldo + (jenis.tipe === 'emas' ? r.progress!.saldo_dana : 0))}` : r.kind === 'berjangka' ? `Rp ${formatRupiah((r.accounts ?? []).reduce((s, a) => s + a.terkumpul, 0))}` : `Rp ${formatRupiah((r.qurban ?? []).reduce((s, q) => s + q.total_terkumpul, 0))}`}</strong></span>
                  </div>
                </div>

                {/* Row actions */}
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <button
                    onClick={() => {
                      const berjangkaId = r.kind === 'berjangka' ? r.accounts![0]?.id : undefined;
                      const sb = r.kind === 'saldo' ? sbAktif(r) : null;
                      onOpenCash(r.user.id, jenis.id, berjangkaId, sb?.konfigurasi_id, sb?.nominal_per_periode);
                    }}
                    className="py-1.5 px-2.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                  >
                    <Banknote className="w-3 h-3" /> Setor Cash
                  </button>
                  {r.kind === 'saldo' && (
                    <button
                      onClick={() => {
                        const sbList = r.progress!.setoran_berkala ?? [];
                        setNominalTarik('');
                        setTarikTarget({ user: r.user, rencana: sbList, saldo: r.progress!.saldo });
                      }}
                      disabled={!canTarikSaldo(r.progress!)}
                      className={`py-1.5 px-2.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors ${
                        canTarikSaldo(r.progress!)
                          ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-700 cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpRight className="w-3 h-3" /> {jenis.tipe === 'emas' ? 'Batalkan' : 'Tarik'}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4 space-y-3">
                {r.kind === 'saldo' && (() => {
                  const sbList = r.progress!.setoran_berkala ?? [];
                  const aktifSb = sbAktif(r);
                  const selKey = aktifSb ? `sb-${aktifSb.konfigurasi_id}` : 'global';
                  const tgt = aktifSb ? Number(aktifSb.target_gram_total ?? 0) : 0;
                  const cap = aktifSb ? Number(aktifSb.rekap?.gram_terkumpul ?? 0) : 0;
                  const nominalTotal = aktifSb ? Number(aktifSb.rekap?.nominal_total_setor ?? 0) : 0;
                  const nominalPeriode = aktifSb ? Number(aktifSb.nominal_per_periode ?? 0) : 0;
                  const durasi = aktifSb?.durasi_periode ? Number(aktifSb.durasi_periode) : 0;
                  const targetNominal = nominalPeriode > 0 && durasi > 0 ? nominalPeriode * durasi : 0;
                  const pct = targetNominal > 0
                    ? Math.min(100, Math.max(0, (nominalTotal / targetNominal) * 100))
                    : tgt > 0 ? Math.min(100, (cap / tgt) * 100) : 0;
                  return (
                    <div>
                      {sbList.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Target className="w-3 h-3 text-amber-500 shrink-0" />
                          <select
                            value={selKey}
                            onChange={(e) => setSelTargetByUser(prev => ({ ...prev, [r.user.id]: e.target.value }))}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            {sbList.map(sb => (
                              <option key={sb.konfigurasi_id} value={`sb-${sb.konfigurasi_id}`}>
                                Rencana Rp {formatRupiah(sb.nominal_per_periode)} ({sb.frekuensi_label})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {sbList.length > 0 && aktifSb ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                            <span className="flex items-center gap-1.5">
                              <FrekuensiBadge frekuensi={aktifSb.frekuensi_setor} label={aktifSb.frekuensi_label} />
                              <span className="text-slate-700 dark:text-slate-200">Rp {formatRupiah(aktifSb.nominal_per_periode)} / periode</span>
                            </span>
                            <span className="text-amber-600 dark:text-amber-300">{pct.toFixed(0)}%</span>
                          </div>
                          <ProgressBar value={pct} color="bg-amber-500" />
                          <p className="text-[10px] text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-1.5">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{cap.toFixed(4)} gr dari {tgt} gr</span>
                            {aktifSb.sisa_periode != null ? (
                              <span className={`font-bold ${aktifSb.sisa_periode > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                                {aktifSb.sisa_periode > 0 ? `· sisa ${aktifSb.sisa_periode}× dari ${aktifSb.durasi_periode}×` : '· target tercapai'}
                              </span>
                            ) : aktifSb.tertunggak.jumlah_periode > 0 ? (
                              <span className="font-bold text-rose-600 dark:text-rose-300">· tertunggak {aktifSb.tertunggak.jumlah_periode}×</span>
                            ) : null}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {r.progress!.target_emas_gram ? (
                            <>
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Target Emas</span>
                                <span className="text-amber-600 dark:text-amber-300">{r.progress!.persentase != null ? r.progress!.persentase : 0}%</span>
                              </div>
                              <ProgressBar value={r.progress!.persentase} color="bg-amber-500" />
                              <p className="text-[10px] text-slate-400 mt-1.5">{Number(r.progress!.total_unit ?? 0).toFixed(4)} gram dari {r.progress!.target_emas_gram} gram</p>
                            </>
                          ) : r.progress!.target > 0 ? (
                            <>
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Target</span>
                                <span className="text-slate-700 dark:text-slate-200">{r.progress!.persentase != null ? r.progress!.persentase : 0}%</span>
                              </div>
                              <ProgressBar value={r.progress!.persentase} color="bg-emerald-500" />
                              <p className="text-[10px] text-slate-400 mt-1.5">Rp {formatRupiah(r.progress!.target)}</p>
                            </>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Menabung bebas (tanpa target)</span>
                              <span>Total setoran Rp {formatRupiah(r.progress!.total_setoran)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {r.progress!.frekuensi && (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <FrekuensiBadge frekuensi={r.progress!.frekuensi.frekuensi_setor} label={r.progress!.frekuensi.frekuensi_label} />
                          {r.progress!.frekuensi.nominal_per_periode != null && `Rp ${formatRupiah(r.progress!.frekuensi.nominal_per_periode)} / periode`}
                          {r.progress!.frekuensi.sisa_pembayaran != null && (
                            <span className={`font-bold ${r.progress!.frekuensi.sisa_pembayaran > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                              {r.progress!.frekuensi.sisa_pembayaran > 0 ? `· sisa ${r.progress!.frekuensi.sisa_pembayaran}× lagi` : '· target tercapai'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {r.kind === 'berjangka' && (r.accounts ?? []).map((a) => (
                  <div key={a.id} className="rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Berjangka #{a.id}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[9px] font-bold text-slate-500 dark:text-slate-300 capitalize">{a.status.replace('_', ' ')}</span>
                        <button
                          onClick={() => onOpenCash(r.user.id, jenis.id, a.id)}
                          disabled={a.status !== 'aktif' && a.status !== 'menunggu_approval'}
                          className="py-1 px-2 rounded-lg text-[9px] font-extrabold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Setor
                        </button>
                        <button
                          onClick={() => { setNominalTarik(''); setTarikTarget({ user: r.user, berjangkaId: a.id }); }}
                          disabled={!(a.status === 'aktif' && a.terkumpul > 0)}
                          className="py-1 px-2 rounded-lg text-[9px] font-extrabold bg-slate-900 dark:bg-white dark:text-slate-900 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Tarik
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Progress</span>
                      <span className="text-slate-700 dark:text-slate-200">{a.persentase}%</span>
                    </div>
                    <ProgressBar value={a.persentase} color="bg-violet-500" />
                    <p className="text-[10px] text-slate-400">Rp {formatRupiah(a.terkumpul)} dari Rp {formatRupiah(a.target_nominal)}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <FrekuensiBadge frekuensi={a.frekuensi_setor} label={a.frekuensi_label} />
                      <span className="font-semibold">Rp {formatRupiah(a.nominal_per_periode)} / periode</span>
                      {a.nominal_per_periode > 0 && (
                        <span className={`font-bold ${a.sisa_target > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                          {a.sisa_target > 0 ? `· sisa ±${Math.ceil(a.sisa_target / a.nominal_per_periode)}× dari ${a.durasi_bulan}×` : '· target tercapai'}
                        </span>
                      )}
                    </p>
                  </div>
                ))}

                {r.kind === 'qurban' && (r.qurban ?? []).map((q) => (
                  <div key={q.id} className="rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Qurban {q.hewan} × {q.jumlah_hewan}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{q.persentase != null ? q.persentase : 0}%</span>
                        <button
                          onClick={() => setBatalQurban({ id: q.id, user_name: r.user.name, hewan: `${q.hewan} × ${q.jumlah_hewan}` })}
                          className="py-1 px-2 rounded-lg text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer flex items-center gap-1"
                          title="Batalkan rencana qurban ini"
                        >
                          <Trash2 className="w-2.5 h-2.5" /> Batalkan
                        </button>
                      </div>
                    </div>
                    <ProgressBar value={q.persentase} color="bg-emerald-500" />
                    <p className="text-[10px] text-slate-400">Rp {formatRupiah(q.total_terkumpul)} dari Rp {formatRupiah(q.target_dana)}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <FrekuensiBadge frekuensi={q.frekuensi_setor} label={q.frekuensi_label} />
                      {q.nominal_per_periode != null && q.nominal_per_periode > 0 && (
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Rp {formatRupiah(q.nominal_per_periode)} / periode</span>
                      )}
                      {q.sisa_pembayaran != null && q.sisa_pembayaran > 0 && (
                        <span className="font-bold text-sky-600 dark:text-sky-300">· sisa {q.sisa_pembayaran}× bayar</span>
                      )}
                    </p>
                    {q.tertunggak?.jumlah_periode > 0 && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="font-bold text-rose-600 dark:text-rose-300">Tunggakan {q.tertunggak.jumlah_periode}× · Rp {formatRupiah(q.tertunggak.nominal)}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buat Rencana Modal */}
      {planModal && planType && planType !== 'qurban' && (
        <PlanModal
          jenis={jenis}
          planType={planType === 'berjangka' ? 'berjangka' : planType === 'hari_raya' ? 'hari_raya' : 'emas'}
          users={users.filter((u) => u.role === 'user' && u.status === 'active')}
          initialUserId={planModal.user?.id}
          onClose={() => setPlanModal(null)}
          onSubmit={(userId, values) => { setPlanModal(null); submitPlan(userId, values); }}
        />
      )}

      {/* Tarik Modal */}
      {tarikTarget && (() => {
        const isEmas = jenis.tipe === 'emas';
        const perluPilihRencana = isEmas && (tarikTarget.rencana?.length ?? 0) > 0;
        const isPribadi = jenis.tipe !== 'emas' && jenis.sub_jenis !== 'berjangka';
        return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {isEmas ? (perluPilihRencana ? 'Batal & Refund Rencana' : 'Batal & Refund Tabungan Emas') : 'Konfirmasi Penarikan'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isEmas
                    ? <>Tabungan emas <strong>{tarikTarget.user.name}</strong> akan dibatalkan & direfund dengan <strong>potongan 10%</strong> dari total tabungan (nilai emas + saldo dana). Langsung terverifikasi tanpa menunggu proses lain.</>
                    : isPribadi
                    ? <>Masukkan nominal yang ditarik dari saldo {jenis.nama} <strong>{tarikTarget.user.name}</strong>. Langsung terverifikasi tanpa menunggu proses lain.</>
                    : <>Saldo {jenis.nama} <strong>{tarikTarget.user.name}</strong> akan dicairkan <strong>penuh</strong> dan langsung terverifikasi tanpa menunggu proses lain.</>}
                </p>
                {isPribadi && (
                  <div className="mt-4">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs">
                      Nominal Penarikan (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-slate-400">Rp</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={nominalTarik}
                        onChange={(e) => setNominalTarik(fmtRupiahTyping(e.target.value))}
                        onBlur={() => setNominalTarik(fmtRupiahBlur(nominalTarik))}
                        placeholder="Contoh: 100.000"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-base text-slate-900 dark:text-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Saldo tersedia: <strong className="text-slate-600 dark:text-slate-300">Rp {formatRupiah(tarikTarget.saldo ?? 0)}</strong> · minimal Rp 10.000
                    </p>
                  </div>
                )}
                {perluPilihRencana && (
                  <div className="mt-4">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs">
                      Rencana yang dibatalkan
                    </label>
                    <select
                      value={tarikTarget.konfigurasiId ?? ''}
                      onChange={(e) => setTarikTarget({ ...tarikTarget, konfigurasiId: Number(e.target.value) || undefined })}
                      className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="">— Pilih Rencana —</option>
                      {tarikTarget.rencana!.map((r) => (
                        <option key={r.konfigurasi_id} value={r.konfigurasi_id}>
                          Rencana Rp {r.nominal_per_periode.toLocaleString('id-ID')} ({r.frekuensi_label})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTarikTarget(null)}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => submitTarik(tarikTarget.user)}
                    disabled={perluPilihRencana && !tarikTarget.konfigurasiId}
                    className={`py-2.5 px-6 rounded-xl text-xs font-extrabold shadow-md transition-all ${
                      perluPilihRencana && !tarikTarget.konfigurasiId
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25 cursor-pointer'
                    }`}
                  >
                    {isEmas ? 'Batal & Refund' : 'Tarik Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal Batalkan Rencana Qurban */}
      {batalQurban && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-rose-200 dark:border-rose-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Batalkan Rencana Qurban?
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Batalkan rencana <strong>{batalQurban.hewan}</strong> milik <strong>{batalQurban.user_name}</strong> beserta seluruh setoran yang sudah dilakukan. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setBatalQurban(null)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePendaftaranQurban(batalQurban.id);
                  setBatalQurban(null);
                  setTimeout(() => { fetchMonitoringNasabah(); fetchTunggakanSetoran(); }, 1500);
                }}
                className="py-2.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      <DaftarQurbanModal
        isOpen={qurbanTarget != null}
        onClose={handleQurbanClose}
        userId={qurbanTarget?.userId}
        users={users.filter((u) => u.role === 'user' && u.status === 'active')}
      />
    </div>
  );
};

interface PlanModalProps {
  jenis: JenisTabungan;
  planType: 'emas' | 'berjangka' | 'hari_raya';
  users: User[];
  initialUserId?: number;
  onClose: () => void;
  onSubmit: (userId: number, values: { nominal: number; frekuensi: FrekuensiSetoran; durasi: number; gram: number | null; gramPerPeriode?: number }) => void;
}

const PlanModal: React.FC<PlanModalProps> = ({ jenis, planType, users, initialUserId, onClose, onSubmit }) => {
  const { activeHargaEmas } = useApp();
  const [userId, setUserId] = useState<number>(initialUserId ?? users[0]?.id ?? 0);
  const [nominal, setNominal] = useState('');
  const [durasi, setDurasi] = useState<string>('12');
  const [frekuensi, setFrekuensi] = useState<FrekuensiSetoran>('bulanan');
  const [gram, setGram] = useState('');
  const [err, setErr] = useState('');
  const [selisih, setSelisih] = useState('');
  const [sumberSync, setSumberSync] = useState<'nominal' | 'durasi'>('nominal');

  const hargaEmas = activeHargaEmas?.harga_per_gram;
  const hargaValid = typeof hargaEmas === 'number' && Number.isFinite(hargaEmas) && hargaEmas > 0;

  const gramVal = parseRupiah(gram);
  const nominalVal = parseRupiah(nominal);
  const durasiNum = Math.min(120, Math.max(1, Math.floor(Number(durasi)) || 0));

  // Harga jual per gram: harga acuan aktif + markup bertingkat (satu sumber dengan
  // halaman Harga Emas Hari Ini & perhitungan setoran).
  const hargaJualPerGram = (g: number): number => {
    if (!hargaValid) return 0;
    return hargaJualUtil(hargaEmas as number, g);
  };

  const harga = hargaJualPerGram(gramVal);

  // Tanggal pencairan estimasi: mulai hari ini + (durasi - 1) periode sesuai frekuensi.
  const tglCair = useMemo(() => {
    if (planType !== 'emas' || durasiNum < 1) return null;
    const d = new Date();
    if (frekuensi === 'harian') d.setDate(d.getDate() + durasiNum - 1);
    else if (frekuensi === 'mingguan') d.setDate(d.getDate() + (durasiNum - 1) * 7);
    else d.setMonth(d.getMonth() + durasiNum - 1);
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [planType, durasiNum, frekuensi]);

  const selisihVal = parseRupiah(selisih);

  // Gram yang dibeli PER PEMBAYARAN: nominal dikurangi porsi dana/selisih, dibagi harga jual hari ini.
  // Kirim sebagai target_gram_per_periode → per setoran beli gram ini, sisanya (selisih) masuk saldo dana.
  const gramPerPembayaran = (): number => {
    if (planType !== 'emas' || harga <= 0) return 0;
    const beli = nominalVal - (selisihVal > 0 ? selisihVal : 0);
    return beli > 0 ? beli / harga : 0;
  };

  const sisaKali = () => {
    const gp = gramPerPembayaran();
    return gramVal > 0 && gp > 0 ? Math.max(1, Math.ceil(gramVal / gp)) : 0;
  };

  const onSync = () => {
    if (planType !== 'emas') return;
    if (sumberSync === 'durasi') {
      const n = gramVal > 0 && durasiNum > 0 && harga > 0
        ? Math.ceil((gramVal * harga) / durasiNum / 1000) * 1000 + selisihVal
        : 0;
      if (n > 0) setNominal(fmtRupiahTyping(String(n)));
    } else {
      const d = sisaKali();
      if (d > 0) setDurasi(String(d));
    }
  };

  const title =
    planType === 'emas' ? 'Rencana Setoran Emas Baru' :
    planType === 'berjangka' ? 'Buat Tabungan Berjangka' :
    'Set Target & Frekuensi Hari Raya';

  const guide =
    planType === 'emas'
      ? `Harga emas hari ini Rp ${hargaValid ? formatRupiah(harga) : '(belum tersedia)'}/gram. Isi target gram & nominal — sisa setoran dihitung otomatis.`
      : planType === 'berjangka' ? 'Cicilan per periode dihitung otomatis dari target & durasi.'
      : 'Target nominal menjadi acuan progress tabungan hari raya nasabah.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const goalValue = gramVal;
    if (planType === 'emas' && goalValue <= 0) {
      setErr('Isi target rencana dulu: berapa gram emas yang ingin dicapai.');
      return;
    }
    if (nominalVal < 10000) {
      setErr('Nominal pembayaran minimal Rp 10.000.');
      return;
    }
    if (selisihVal > 0 && selisihVal >= nominalVal) {
      setErr('Selisih/Dana harus lebih kecil dari nominal pembayaran.');
      return;
    }
    if (durasiNum < 1) {
      setErr('Isi berapa lama menabung (jumlah periode).');
      return;
    }
    const gp = gramPerPembayaran();
    onSubmit(userId, {
      nominal: nominalVal,
      frekuensi,
      durasi: durasiNum,
      gram: goalValue > 0 ? goalValue : null,
      gramPerPeriode: selisihVal > 0 && gp > 0 ? gp : undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{jenis.nama}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <X />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nasabah</label>
              <select
                value={userId}
                onChange={(e) => setUserId(Number(e.target.value))}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.nomor_anggota || u.email})</option>
                ))}
              </select>
            </div>

            {planType === 'emas' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Rencana (gram) <span className="font-semibold text-slate-400">— isi dulu, sisanya menyesuaikan</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gram}
                  onChange={(e) => { setGram(e.target.value); setErr(''); }}
                  onBlur={onSync}
                  placeholder="Contoh: 5"
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {planType === 'emas' ? 'Nominal per Periode (Rp)' : 'Target Nominal (Rp)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={nominal}
                onFocus={() => setSumberSync('nominal')}
                onChange={(e) => { setNominal(fmtRupiahTyping(e.target.value)); setErr(''); }}
                onBlur={() => { setNominal(fmtRupiahBlur(nominal)); onSync(); }}
                placeholder={planType === 'emas' ? 'Contoh: 100.000' : 'Contoh: 1.200.000'}
                required
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {planType === 'emas' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Selisih / Dana per Periode (Rp) <span className="font-semibold text-slate-400">— opsional</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selisih}
                  onChange={(e) => { setSelisih(fmtRupiahTyping(e.target.value)); setErr(''); }}
                  onBlur={() => setSelisih(fmtRupiahBlur(selisih))}
                  placeholder="Contoh: 2.000 (opsional)"
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200"
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  Porsi dana per pembayaran: nominal dikurangi selisih ini yang dibelikan gram emas.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Frekuensi Setoran</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FREKUENSI_LABEL) as FrekuensiSetoran[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrekuensi(f)}
                    className={`py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                      frekuensi === f
                        ? planType === 'berjangka'
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                          : 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {FREKUENSI_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            {planType !== 'hari_raya' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {planType === 'emas' ? `Berapa Kali Setoran (${frekuensi === 'harian' ? 'per hari' : frekuensi === 'mingguan' ? 'per minggu' : 'per bulan'})` : 'Durasi (bulan)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={planType === 'emas' ? undefined : 120}
                  value={durasi}
                  onFocus={() => { if (planType === 'emas') setSumberSync('durasi'); }}
                  onChange={(e) => { setDurasi(e.target.value); setErr(''); }}
                  onBlur={() => { setDurasi(String(durasiNum)); onSync(); }}
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            {planType === 'emas' && gramVal > 0 && nominalVal >= 10000 && (
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-3 space-y-1.5">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                  Ringkasan (harga emas hari ini Rp {harga > 0 ? formatRupiah(harga) : '—'}/gr)
                </p>
                {hargaValid && (
                  <>
                    <DetailRow label={`Target ${gramVal} gr`} value={`Rp ${formatRupiah(gramVal * harga)}`} />
                    <DetailRow
                      label="Gramasi / pembayaran"
                      value={`${gramPerPembayaran().toFixed(4)} gr`}
                      muted={selisihVal > 0
                        ? `(${formatRupiah(nominalVal - selisihVal)} ÷ ${formatRupiah(harga)})`
                        : `(${formatRupiah(nominalVal)} ÷ ${formatRupiah(harga)})`}
                    />
                    {selisihVal > 0 && (
                      <DetailRow label="Selisih / pembayaran" value={`Rp ${formatRupiah(selisihVal)}`} />
                    )}
                    <DetailRow label={`${sisaKali()}× setoran @ ${FREKUENSI_LABEL[frekuensi].toLowerCase()}`} value={`Rp ${formatRupiah(nominalVal)}`} />
                    <DetailRow label="Total dibayarkan" value={`Rp ${formatRupiah(nominalVal * sisaKali())}`} />
                    {tglCair && (
                      <DetailRow label="Tarik / cair" value={tglCair} muted={`setelah ${sisaKali()}× setoran ${FREKUENSI_LABEL[frekuensi].toLowerCase()}`} />
                    )}
                    {(() => {
                      const sisa = nominalVal * sisaKali() - gramVal * harga;
                      return (
                        <DetailRow
                          label="Selisih total (pembulatan nominal)"
                          value={`${sisa >= 0 ? '+' : '−'} Rp ${formatRupiah(Math.abs(sisa))}`}
                          muted={sisa >= 0 ? 'kebijakan admin' : 'kurang → bulatkan nominal/durasi'}
                          accent={sisa >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}
                        />
                      );
                    })()}
                  </>
                )}
                {!hargaValid && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300">
                    Harga emas hari ini belum tersedia — isi durasi manual.
                  </p>
                )}
              </div>
            )}

            <p className="text-[10px] text-slate-400">{guide}</p>

            {err && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300">{err}</p>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button type="submit" className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 transition-all cursor-pointer">
                Simpan Rencana
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; muted?: string; accent?: string }> = ({ label, value, muted, accent }) => (
  <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70 flex flex-wrap items-center gap-x-1.5">
    <span>{label}:</span>
    <strong className={accent ?? 'text-amber-800 dark:text-amber-200'}>{value}</strong>
    {muted && <span className="text-[9px]">({muted})</span>}
  </p>
);