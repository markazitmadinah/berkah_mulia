import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import { formatRupiah } from '../../utils/format';
import { UserRoundSearch, ArrowLeft, Coins, Wallet, Target, TrendingUp, ArrowUpRight, ArrowDownLeft, Clock, Search, Layers, BadgeCheck, Landmark, Repeat, CalendarClock, RefreshCw } from 'lucide-react';
import { User } from '../../types';

interface AdminProfilNasabahProps {
  onBack: () => void;
  initialUserId?: number;
}

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  suspended: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  rejected: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
};

const trxStatusBadge: Record<string, string> = {
  terverifikasi: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  menunggu_verifikasi: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  ditolak: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
};

const ProgressBar: React.FC<{ value: number | null; color?: string }> = ({ value, color = 'bg-amber-500' }) => (
  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
    <div
      className={`h-full rounded-full ${color} transition-all`}
      style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
    />
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

export const AdminProfilNasabah: React.FC<AdminProfilNasabahProps> = ({ onBack, initialUserId }) => {
  const { users, profilNasabah, profilNasabahError, fetchProfilNasabah, clearProfilNasabah } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<number>(initialUserId ?? 0);
  const [trxSearch, setTrxSearch] = useState('');

  useEffect(() => {
    setTrxSearch('');
    if (selectedUserId) fetchProfilNasabah(selectedUserId);
    return () => clearProfilNasabah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const p = profilNasabah;
  const user: User | null = p?.user ?? (selectedUserId ? users.find((u) => u.id === selectedUserId) ?? null : null);

  const filteredTrx = useMemo(() => {
    if (!p) return [];
    const q = trxSearch.toLowerCase();
    return (p.transaksi || []).filter((t) =>
      !q ||
      t.nomor_referensi.toLowerCase().includes(q) ||
      (t.jenis_tabungan_nama || '').toLowerCase().includes(q) ||
      (t.user_name || '').toLowerCase().includes(q)
    );
  }, [p, trxSearch]);

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
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <UserRoundSearch className="w-6 h-6 text-amber-500" />
              Profil Nasabah
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Monitoring tabungan, setoran berkala, dan riwayat transaksi nasabah.
            </p>
          </div>
        </div>

        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(Number(e.target.value))}
          className="w-64 py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          <option value={0}>Pilih nasabah…</option>
          {users
            .filter((u) => u.role === 'user')
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.nomor_anggota} — {u.name}
              </option>
            ))}
        </select>
      </div>

      {!selectedUserId && (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <Layers className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            Pilih nasabah dari dropdown di atas untuk melihat profil lengkapnya.
          </p>
        </div>
      )}

      {selectedUserId && !p && !profilNasabahError && (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400 mt-3">Memuat profil nasabah…</p>
        </div>
      )}

      {selectedUserId && profilNasabahError && (
        <div className="rounded-3xl p-10 bg-white dark:bg-slate-800/90 border border-rose-100 dark:border-rose-900 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-rose-300 mb-3" />
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{profilNasabahError}</p>
          <button
            onClick={() => fetchProfilNasabah(selectedUserId)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {p && user && (
        <>
          {/* Profile Card */}
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4">
            <UserAvatar userId={user.id} avatarPath={user.avatar_path} className="w-16 h-16 rounded-2xl object-cover" />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{user.name}</h2>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${statusBadge[user.status] || 'bg-slate-100 text-slate-600'}`}>
                  {user.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                {user.nomor_anggota || user.username}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>@{user.username || '-'}</span>
                <span>{user.phone || '-'}</span>
                {user.address && <span>{user.address}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Tabungan Aktif</p>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 break-all">{p.summary.total_tabungan_aktif}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Total Saldo</p>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 break-all">Rp {formatRupiah(p.summary.total_saldo_tabungan)}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40">
                <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">Transaksi Pending</p>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 break-all">{p.summary.transaksi_pending}</p>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40">
                <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">Jumlah Transaksi</p>
                <p className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5 break-all">{p.transaksi.length}</p>
              </div>
            </div>
          </div>

          {/* Products / Tabungan */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" /> Tabungan Nasabah
            </h3>
            {p.produk.tabungan.length === 0 && p.produk.qurban.length === 0 && p.produk.berjangka.length === 0 ? (
              <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
                Nasabah belum memiliki tabungan aktif.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {p.produk.tabungan
                  .filter((t) => t.progress.sub_jenis !== 'berjangka' && t.progress.sub_jenis !== 'qurban')
                  .map((t) => {
                    const prog = t.progress;
                    const isEmas = prog.tipe === 'emas';
                    const isHariRaya = prog.sub_jenis === 'hari_raya';
                    return (
                      <div key={prog.jenis_tabungan_id} className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-5 pt-5">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${isEmas ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300' : isHariRaya ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300' : 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300'}`}>
                              {isEmas ? <Coins className="w-4 h-4" /> : isHariRaya ? <Landmark className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-extrabold text-slate-800 dark:text-white">{prog.nama}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{isEmas ? 'Tabungan Emas' : isHariRaya ? 'Tabungan Hari Raya' : 'Tabungan Pribadi'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {prog.frekuensi && <FrekuensiBadge frekuensi={prog.frekuensi.frekuensi_setor} label={prog.frekuensi.frekuensi_label} />}
                            {t.konfigurasi && t.konfigurasi.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <Repeat className="w-3 h-3" /> Setoran Berkala
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                                Bebas
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 text-center divide-x divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 mt-4">
                          <div className="px-2 py-3.5">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Saldo</p>
                            <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 break-all">Rp {formatRupiah(prog.saldo)}</p>
                          </div>
                          <div className="px-2 py-3.5">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Total Setoran</p>
                            <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 break-all">Rp {formatRupiah(prog.total_setoran)}</p>
                          </div>
                          <div className="px-2 py-3.5">
                            <p className="text-[9px] text-amber-600 dark:text-amber-300 font-bold uppercase">{isEmas ? 'Emas Terkumpul' : 'Pending'}</p>
                            <p className={`text-sm font-extrabold mt-1 break-all ${isEmas ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-white'}`}>
                              {isEmas ? `${Number(prog.total_unit ?? 0).toFixed(4)} gram` : `Rp ${formatRupiah(prog.pending_amount)}`}
                            </p>
                          </div>
                        </div>

                        {prog.target ? (
                          <div className="px-5 py-4">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Target</span>
                              <span className="text-slate-700 dark:text-slate-200">{prog.persentase != null ? prog.persentase : 0}%</span>
                            </div>
                            <ProgressBar value={prog.persentase} />
                            <p className="text-[10px] text-slate-400 mt-1.5">Rp {formatRupiah(prog.target)}</p>
                          </div>
                        ) : prog.target_emas_gram ? (
                          <div className="px-5 py-4">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Target Emas</span>
                              <span className="text-amber-600 dark:text-amber-300">{prog.persentase != null ? prog.persentase : 0}%</span>
                            </div>
                            <ProgressBar value={prog.persentase} color="bg-amber-500" />
                            <p className="text-[10px] text-slate-400 mt-1.5">{Number(prog.total_unit ?? 0).toFixed(4)} gram dari {prog.target_emas_gram} gram</p>
                          </div>
                        ) : null}

                        {prog.frekuensi && (
                          <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px]">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Repeat className="w-3 h-3" /> Setoran <strong className="text-slate-700 dark:text-slate-200">{prog.frekuensi.nominal_per_periode != null ? `Rp ${formatRupiah(prog.frekuensi.nominal_per_periode)}` : '—'}</strong> / {prog.frekuensi.frekuensi_label}
                            </span>
                            {prog.frekuensi.sisa_pembayaran != null && (
                              <span className="text-slate-500 dark:text-slate-400">
                                Sisa <strong className="text-rose-600 dark:text-rose-300">{prog.frekuensi.sisa_pembayaran}x</strong> pembayaran
                              </span>
                            )}
                          </div>
                        )}

                        {t.setoran_berkala && t.setoran_berkala.length > 0 && (
                          <div className="px-5 py-4 bg-amber-50/50 dark:bg-amber-950/10 space-y-4">
                            {t.setoran_berkala.map((sb) => (
                              <div key={sb.konfigurasi_id ?? 'sb'} className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                                    Rencana {t.setoran_berkala!.length > 1 ? `#${t.setoran_berkala!.indexOf(sb) + 1} ` : ''}• Rp {formatRupiah(sb.nominal_per_periode ?? 0)}
                                  </span>
                                  {sb.sisa_periode != null && (
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Sisa {sb.sisa_periode}x</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Konsistensi</span>
                                      <span className="text-emerald-600 dark:text-emerald-300">{sb.konsistensi.persentase}%</span>
                                    </div>
                                    <ProgressBar value={sb.konsistensi.persentase} color="bg-emerald-500" />
                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                      {sb.konsistensi.periode_terlaksana} dari {sb.konsistensi.periode_seharusnya} periode ·{' '}
                                      {sb.konsistensi.status === 'tepat_waktu' ? 'Tepat waktu' : 'Tertinggal'}
                                    </p>
                                  </div>
                                  {sb.capaian_gram != null && (
                                    <div>
                                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                        <span>Capaian Target Gram</span>
                                        <span className="text-amber-600 dark:text-amber-300">{sb.capaian_gram}%</span>
                                      </div>
                                      <ProgressBar value={sb.capaian_gram} color="bg-amber-500" />
                                      <p className="text-[10px] text-slate-400 mt-1.5">
                                        {sb.rekap.gram_terkumpul} gr dari target {sb.target_gram_total ?? '—'} gr
                                      </p>
                                    </div>
                                  )}
                                </div>
                                {sb.estimasi_selesai && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <CalendarClock className="w-3 h-3" /> Estimasi selesai: <strong>{sb.estimasi_selesai}</strong>
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Berjangka cards */}
                {p.produk.berjangka.map((tb) => (
                  <div key={tb.id} className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-5 pt-5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-white">Tabungan Berjangka</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">{tb.durasi_bulan} bulan · {tb.frekuensi_label}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-[10px] font-bold text-violet-600 dark:text-violet-300 capitalize shrink-0">
                        {tb.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 text-center divide-x divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 mt-4">
                      <div className="px-2 py-3.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Target</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 break-all">Rp {formatRupiah(tb.target_nominal)}</p>
                      </div>
                      <div className="px-2 py-3.5">
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-300 font-bold uppercase">Terkumpul</p>
                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-300 mt-1 break-all">Rp {formatRupiah(tb.terkumpul)}</p>
                      </div>
                      <div className="px-2 py-3.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Cicilan</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 break-all">Rp {formatRupiah(tb.nominal_per_periode)}</p>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Progress</span>
                        <span className="text-slate-700 dark:text-slate-200">{tb.persentase}%</span>
                      </div>
                      <ProgressBar value={tb.persentase} color="bg-violet-500" />
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {tb.tanggal_mulai || '-'} → {tb.tanggal_jatuh_tempo || '-'} · Sisa target Rp {formatRupiah(tb.sisa_target)}
                      </p>
                      {tb.tertunggak.jumlah_periode > 0 && (
                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-300 mt-1.5">
                          Tertunggak {tb.tertunggak.jumlah_periode}× · Rp {formatRupiah(tb.tertunggak.nominal)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {p.produk.qurban.map((q) => (
                  <div key={q.id} className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-5 pt-5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-white">Qurban {q.hewan}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Periode {q.tahun || '-'} · {q.jumlah_hewan} ekor</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <FrekuensiBadge frekuensi={q.frekuensi_setor} label={q.frekuensi_label} />
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-300 capitalize">
                          {q.status_label}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 text-center divide-x divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 mt-4">
                      <div className="px-2 py-3.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Target Dana</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1 break-all">Rp {formatRupiah(q.target_dana)}</p>
                      </div>
                      <div className="px-2 py-3.5">
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-300 font-bold uppercase">Terkumpul</p>
                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-300 mt-1 break-all">Rp {formatRupiah(q.total_terkumpul)}</p>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Progress</span>
                        <span className="text-slate-700 dark:text-slate-200">{q.persentase != null ? q.persentase : 0}%</span>
                      </div>
                      <ProgressBar value={q.persentase} color="bg-emerald-500" />
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {q.nominal_per_periode != null && `Cicilan Rp ${formatRupiah(q.nominal_per_periode)} / ${q.frekuensi_label} · `}
                        {q.sisa_pembayaran != null && `Sisa ${q.sisa_pembayaran}x · `}Terdaftar: {q.tanggal_daftar || '-'}
                      </p>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Riwayat Transaksi */}
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-500" /> Riwayat Transaksi
                <span className="text-[10px] font-bold text-slate-400">({p.transaksi.length})</span>
              </h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={trxSearch}
                  onChange={(e) => setTrxSearch(e.target.value)}
                  placeholder="Cari referensi / tabungan…"
                  className="w-64 py-2 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>

            {filteredTrx.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Tidak ada transaksi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2 px-3 font-bold">Tanggal</th>
                      <th className="py-2 px-3 font-bold">Referensi</th>
                      <th className="py-2 px-3 font-bold">Jenis</th>
                      <th className="py-2 px-3 font-bold">Tabungan</th>
                      <th className="py-2 px-3 text-right font-bold">Nominal</th>
                      <th className="py-2 px-3 text-right font-bold">Emas / Selisih</th>
                      <th className="py-2 px-3 font-bold">Metode</th>
                      <th className="py-2 px-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTrx.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.tanggal_transaksi}</td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.nomor_referensi}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            t.jenis_transaksi === 'setor'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}>
                            {t.jenis_transaksi === 'setor' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {t.jenis_transaksi === 'setor' ? 'Setor' : 'Tarik'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{t.jenis_tabungan_nama || '-'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-200">Rp {formatRupiah(t.nominal)}</td>
                        <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {t.nominal_emas != null ? (
                            <>
                              <span className="text-amber-600 dark:text-amber-300">Rp {formatRupiah(t.nominal_emas)}</span>
                              {t.nominal_dana != null && t.nominal_dana !== 0 ? (
                                <span className={t.nominal_dana > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  {' '}{t.nominal_dana > 0 ? '+' : '−'} Rp {formatRupiah(Math.abs(t.nominal_dana))}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 capitalize">{t.metode_pembayaran}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${trxStatusBadge[t.status_verifikasi] || 'bg-slate-100 text-slate-600'}`}>
                            {t.status_verifikasi === 'menunggu_verifikasi' ? <Clock className="w-3 h-3 inline mr-0.5" /> : <BadgeCheck className="w-3 h-3 inline mr-0.5" />}
                            {t.status_verifikasi.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};