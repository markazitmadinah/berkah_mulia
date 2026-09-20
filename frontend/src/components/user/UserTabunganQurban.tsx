import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah } from '../../utils/format';
import {
  Calendar,
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';

interface UserTabunganQurbanProps {
  onOpenDaftarQurban: () => void;
  onOpenSetorQurban: (pendaftaranId: number) => void;
}

export const UserTabunganQurban: React.FC<UserTabunganQurbanProps> = ({
  onOpenDaftarQurban,
  onOpenSetorQurban
}) => {
  const {
    userSubTab,
    setUserSubTab,
    periodeQurban,
    hewanQurban,
    userPendaftaranQurban,
    userTransaksi,
    lunasQurban
  } = useApp();

  const activePeriode = periodeQurban.find(p => p.status === 'aktif') || periodeQurban[0];
  const availableHewan = hewanQurban.filter(h => h.status_aktif && h.periode_qurban_id === activePeriode?.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-emerald-500/10 dark:from-rose-950/40 dark:via-slate-800 dark:to-emerald-950/30 border border-rose-300/40 dark:border-rose-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
              <QurbanIcon className="w-3.5 h-3.5" />
              Ibadah Qurban {activePeriode?.nama_periode || `Idul Adha ${activePeriode?.tahun ?? new Date().getFullYear()}`}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              Sesuai Syariat Islam
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tabungan Qurban Berkah
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
            Rencanakan pembelian hewan qurban terbaik secara berkala tanpa rasa berat. Dana aman dan transparan hingga waktu pencairan sebelum Idul Adha.
          </p>
        </div>

        <button
          onClick={onOpenDaftarQurban}
          className="py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-95 transition-all cursor-pointer flex-shrink-0"
        >
          <span>Daftar Qurban Baru</span>
        </button>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 w-fit">
        <button
          onClick={() => setUserSubTab('periode-aktif')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            userSubTab === 'periode-aktif'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Periode Aktif & Hewan Tersedia</span>
        </button>

        <button
          onClick={() => setUserSubTab('pendaftaran-saya')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            userSubTab === 'pendaftaran-saya'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Pendaftaran Saya ({userPendaftaranQurban.length})</span>
        </button>
      </div>

      {/* Tab 1: Periode Aktif & Pilihan Hewan */}
      {userSubTab === 'periode-aktif' && (
        <div className="space-y-6">
          {/* Active Period Info Card */}
          {activePeriode && (
            <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                  Status Periode: {activePeriode.status.toUpperCase()}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-2">
                  {activePeriode.nama_periode}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Pendaftaran: {activePeriode.tanggal_buka_pendaftaran} s/d {activePeriode.tanggal_tutup_pendaftaran}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                  <p className="text-[10px] text-slate-400">Estimasi Idul Adha</p>
                  <p className="font-bold text-slate-900 dark:text-white">{activePeriode.tanggal_idul_adha}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                  <p className="text-[10px] text-slate-400">Target Pencairan</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{activePeriode.tanggal_pencairan}</p>
                </div>
              </div>
            </div>
          )}

          {/* List Hewan Cards */}
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">
              Pilihan Hewan Qurban Tersedia
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableHewan.map((hewan) => (
                <div
                  key={hewan.id}
                  className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {hewan.berat_rata_rata || 'Standar Syariah'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">Sertifikat Sehat</span>
                      </div>
                      <QurbanIcon jenisHewan={hewan.jenis_hewan} className="w-7 h-7 text-rose-500 dark:text-rose-400" />
                    </div>

                    <h4 className="text-lg font-extrabold text-slate-900 dark:text-white mt-3">
                      {hewan.jenis_hewan}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {hewan.deskripsi || 'Hewan sehat, gemuk, cukup umur, dan dirawat di peternakan mitra amanah koperasi.'}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Harga Per Ekor / Bagian</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 break-words">
                        Rp {formatRupiah(hewan.harga_per_unit)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onOpenDaftarQurban}
                    className="mt-5 w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-blue-600 hover:text-white text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Pilih Hewan Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pendaftaran Saya & Progress Dana */}
      {userSubTab === 'pendaftaran-saya' && (
        <div className="space-y-5">
          {userPendaftaranQurban.length === 0 ? (
            <div className="rounded-3xl p-12 text-center bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
              <QurbanIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Belum Ada Pendaftaran Qurban</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Pilih hewan qurban di tab "Periode Aktif" dan mulai menyicil tabungan Anda sekarang.
              </p>
              <button
                onClick={() => setUserSubTab('periode-aktif')}
                className="py-2.5 px-5 rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Lihat Hewan Qurban Tersedia
              </button>
            </div>
          ) : (
            userPendaftaranQurban.map((pend) => {
              const hewan = hewanQurban.find(h => h.id === pend.hewan_qurban_id);
              const periode = periodeQurban.find(p => p.id === pend.periode_qurban_id);
              const percent = pend.target_dana > 0
                ? Math.min(100, Math.round((pend.total_terkumpul / pend.target_dana) * 100))
                : 0;
              const sisa = Math.max(0, pend.target_dana - pend.total_terkumpul);

              return (
                <div
                  key={pend.id}
                  className="rounded-3xl p-6 lg:p-8 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        pend.status === 'sudah_dicairkan'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : pend.status === 'sudah_lunas'
                          ? 'bg-blue-600 text-white'
                          : pend.status === 'menunggu_verifikasi'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : pend.status === 'siap_dicairkan'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : pend.status === 'target_tercapai'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        Status: {pend.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">Terdaftar: {pend.tanggal_daftar}</span>
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <QurbanIcon jenisHewan={hewan?.jenis_hewan} className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                      {pend.jumlah_hewan}x {hewan?.jenis_hewan || 'Hewan Qurban'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {periode?.nama_periode} • Atas nama: {pend.catatan || 'Keluarga Nasabah'}
                    </p>

                    {/* Progress details */}
                    <div className="mt-5 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          Terkumpul: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">Rp {formatRupiah(pend.total_terkumpul)}</strong>
                        </span>
                        <span className="font-bold text-slate-500">
                          Target: Rp {formatRupiah(pend.target_dana)} ({percent}%)
                        </span>
                      </div>

                      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                        <span>Sisa Kekurangan: Rp {formatRupiah(sisa)}</span>
                        {percent >= 100 && (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Target Dana Lunas!
                          </span>
                        )}
                      </div>
                    </div>

                    {pend.nominal_per_periode != null && pend.nominal_per_periode > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-slate-500">
                          Kewajiban / {pend.frekuensi_label?.toLowerCase() || 'bulan'}: <strong className="text-blue-600 dark:text-blue-300 font-extrabold">Rp {formatRupiah(pend.nominal_per_periode)}</strong>
                        </span>
                        {pend.sisa_pembayaran != null && pend.sisa_pembayaran > 0 && (
                          <span className="text-slate-400">· sisa {pend.sisa_pembayaran}× bayar</span>
                        )}
                        {pend.tertunggak?.jumlah_periode != null && pend.tertunggak.jumlah_periode > 0 && (
                          <span className="text-rose-600 dark:text-rose-300 font-bold">
                            🔔 Tertunggak {pend.tertunggak.jumlah_periode}× (Rp {formatRupiah(pend.tertunggak.nominal)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {pend.status === 'menabung' && (
                      <button
                        onClick={() => onOpenSetorQurban(pend.id)}
                        className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Setor Cicilan Qurban</span>
                      </button>
                    )}

                    {pend.status === 'target_tercapai' && (
                      <button
                        onClick={() => lunasQurban(pend.id)}
                        className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lunas</span>
                      </button>
                    )}

                    {pend.status === 'menunggu_verifikasi' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-center">
                        <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                          Menunggu Verifikasi Admin
                        </p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                          Panitia akan memverifikasi pelunasan Anda.
                        </p>
                      </div>
                    )}

                    {pend.status !== 'menabung' && pend.status !== 'target_tercapai' && pend.status !== 'menunggu_verifikasi' && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          {pend.status === 'sudah_dicairkan' ? 'Sudah Dicairkan' : 'Qurban Anda Lunas!'}
                        </p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Panitia sedang menyiapkan qurban Anda.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
