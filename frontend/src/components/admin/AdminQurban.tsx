import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QurbanIcon } from '../QurbanIcon';
import { formatRupiah } from '../../utils/format';
import {
  Calendar,
  Layers,
  Award,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Plus
} from 'lucide-react';
import { PeriodeQurban, HewanQurban, PendaftaranQurban } from '../../types';

interface AdminQurbanProps {
  onOpenCreatePeriode: () => void;
  onOpenEditPeriode: (item: PeriodeQurban) => void;
  onOpenCreateHewan: () => void;
  onOpenEditHewan: (item: HewanQurban) => void;
}

export const AdminQurban: React.FC<AdminQurbanProps> = ({
  onOpenCreatePeriode,
  onOpenEditPeriode,
  onOpenCreateHewan,
  onOpenEditHewan
}) => {
  const [verifyModalPendaftaran, setVerifyModalPendaftaran] = useState<PendaftaranQurban | null>(null);
  const [deleteModalPendaftaran, setDeleteModalPendaftaran] = useState<PendaftaranQurban | null>(null);

  const {
    adminQurbanTab,
    setAdminQurbanTab,
    periodeQurban,
    hewanQurban,
    pendaftaranQurban,
    lunasPendaftaranQurban,
    deleteHewanQurban,
    deletePendaftaranQurban,
    showToast
  } = useApp();

  const handleDeleteHewan = (id: number) => {
    const res = deleteHewanQurban(id);
    if (!res.success) {
      showToast(res.message, 'error');
    }
  };

  const pendaftaranAktif = pendaftaranQurban.filter(
    (p) => p.status !== 'sudah_lunas' && p.status !== 'sudah_dicairkan'
  );
  const pendaftaranLunas = pendaftaranQurban.filter(
    (p) => p.status === 'sudah_lunas' || p.status === 'sudah_dicairkan'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <QurbanIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <span>Manajemen Tabungan Qurban</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola periode qurban tahunan, katalog hewan qurban, dan pemantauan progress dana nasabah
          </p>
        </div>

        {/* Top Action Button depending on active sub-tab */}
        <div>
          {adminQurbanTab === 'periode' && (
            <button
              onClick={onOpenCreatePeriode}
              className="py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Periode Baru</span>
            </button>
          )}

          {adminQurbanTab === 'hewan' && (
            <button
              onClick={onOpenCreateHewan}
              className="py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Hewan Qurban</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Switcher */}
      <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 w-fit min-w-max">
        <button
          onClick={() => setAdminQurbanTab('periode')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminQurbanTab === 'periode'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Periode Qurban</span>
        </button>

        <button
          onClick={() => setAdminQurbanTab('hewan')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminQurbanTab === 'hewan'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Hewan Qurban ({hewanQurban.length})</span>
        </button>

        <button
          onClick={() => setAdminQurbanTab('pendaftaran')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminQurbanTab === 'pendaftaran'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Monitor Pendaftaran ({pendaftaranAktif.length})</span>
        </button>

        <button
          onClick={() => setAdminQurbanTab('riwayat')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            adminQurbanTab === 'riwayat'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Riwayat Lunas ({pendaftaranLunas.length})</span>
        </button>
      </div>
      </div>

      {/* Sub-Tab 1: Periode Qurban */}
      {adminQurbanTab === 'periode' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {periodeQurban.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      p.status === 'aktif'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : p.status === 'draft'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      Status: {p.status}
                    </span>

                    <button
                      onClick={() => onOpenEditPeriode(p)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Periode</span>
                    </button>
                  </div>

                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-3">
                    {p.nama_periode}
                  </h3>

                  <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pendaftaran Buka:</span>
                      <span className="font-semibold">{p.tanggal_buka_pendaftaran}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pendaftaran Tutup:</span>
                      <span className="font-semibold">{p.tanggal_tutup_pendaftaran}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimasi Idul Adha:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{p.tanggal_idul_adha}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Jadwal Pencairan:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{p.tanggal_pencairan}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Hewan Qurban */}
      {adminQurbanTab === 'hewan' && (
        <div className="space-y-4">
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-3 px-3">Jenis Hewan</th>
                    <th className="py-3 px-3">Bobot Rata-rata</th>
                    <th className="py-3 px-3">Harga per Unit</th>
                    <th className="py-3 px-3">Periode</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {hewanQurban.map((h) => {
                    const hasPendaftaran = pendaftaranQurban.some(p => p.hewan_qurban_id === h.id);
                    const per = periodeQurban.find(p => p.id === h.periode_qurban_id);

                    return (
                      <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          <span className="flex items-center gap-1.5">
                            <QurbanIcon jenisHewan={h.jenis_hewan} className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                            {h.jenis_hewan}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {h.berat_rata_rata || '-'}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                          Rp {formatRupiah(h.harga_per_unit)}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {per?.nama_periode || '-'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.status_aktif
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {h.status_aktif ? 'Tersedia' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onOpenEditHewan(h)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 cursor-pointer"
                              title="Edit Hewan"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteHewan(h.id)}
                              disabled={hasPendaftaran}
                              className={`p-1.5 rounded-lg ${
                                hasPendaftaran
                                  ? 'opacity-30 cursor-not-allowed text-slate-400 bg-slate-100'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer'
                              }`}
                              title={hasPendaftaran ? 'Tidak dapat dihapus karena sudah ada nasabah yang mendaftar' : 'Hapus Hewan'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Monitor Pendaftaran */}
      {adminQurbanTab === 'pendaftaran' && (
        <div className="space-y-4">
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-3 px-3">Nasabah</th>
                    <th className="py-3 px-3">Pilihan Hewan</th>
                    <th className="py-3 px-3">Progress Dana</th>
                    <th className="py-3 px-3">Target Dana</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendaftaranAktif.map((p) => {
                    const hewan = hewanQurban.find(h => h.id === p.hewan_qurban_id);
                    const percent = p.target_dana > 0
                      ? Math.min(100, Math.round((p.total_terkumpul / p.target_dana) * 100))
                      : 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {p.user_name}
                          </div>
                          <span className="text-[10px] text-slate-400">Atas nama: {p.catatan}</span>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <QurbanIcon jenisHewan={hewan?.jenis_hewan} className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                            {p.jumlah_hewan}x {hewan?.jenis_hewan || 'Hewan'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="w-32">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="font-bold text-emerald-600">{percent}%</span>
                              <span className="text-slate-400">Rp {(p.total_terkumpul / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}k</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                          Rp {formatRupiah(p.target_dana)}
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${
                            p.status === 'sudah_dicairkan'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : p.status === 'sudah_lunas'
                              ? 'bg-blue-600 text-white'
                              : p.status === 'menunggu_verifikasi'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : p.status === 'siap_dicairkan'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : p.status === 'target_tercapai'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === 'menunggu_verifikasi' && (
                              <button
                                onClick={() => setVerifyModalPendaftaran(p)}
                                className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Verifikasi</span>
                              </button>
                            )}

                            {p.status !== 'sudah_dicairkan' && p.status !== 'sudah_lunas' && p.status !== 'menunggu_verifikasi' && (
                              <button
                                onClick={() => setDeleteModalPendaftaran(p)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer"
                                title="Hapus pendaftaran (pengajuan pembatalan)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Riwayat Lunas */}
      {adminQurbanTab === 'riwayat' && (
        <div className="space-y-4">
          <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Riwayat Qurban Lunas & Dicairkan
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-3 px-3">Nasabah</th>
                    <th className="py-3 px-3">Pilihan Hewan</th>
                    <th className="py-3 px-3">Terkumpul</th>
                    <th className="py-3 px-3">Target Dana</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendaftaranLunas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Belum ada qurban yang lunas / dicairkan.
                      </td>
                    </tr>
                  ) : (
                    pendaftaranLunas.map((p) => {
                      const hewan = hewanQurban.find(h => h.id === p.hewan_qurban_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {p.user_name}
                            </div>
                            <span className="text-[10px] text-slate-400">Atas nama: {p.catatan}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1.5">
                              <QurbanIcon jenisHewan={hewan?.jenis_hewan} className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                              {p.jumlah_hewan}x {hewan?.jenis_hewan || 'Hewan'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                            Rp {formatRupiah(p.total_terkumpul)}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                            Rp {formatRupiah(p.target_dana)}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${
                              p.status === 'sudah_dicairkan'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}>
                              {p.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Lunas */}
      {verifyModalPendaftaran && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Verifikasi Pelunasan Qurban?
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Konfirmasi bahwa <strong>{verifyModalPendaftaran.user_name}</strong> sudah melunasi qurban. Status akan berubah menjadi <strong className="text-emerald-600 dark:text-emerald-400">Sudah Lunas</strong>.
              </p>
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5 text-left">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Sudah Terkumpul</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Rp {formatRupiah(verifyModalPendaftaran.total_terkumpul)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Target Dana</span>
                  <span className="font-bold">Rp {formatRupiah(verifyModalPendaftaran.target_dana)}</span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setVerifyModalPendaftaran(null)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  lunasPendaftaranQurban(verifyModalPendaftaran.id);
                  setVerifyModalPendaftaran(null);
                }}
                className="py-2.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-600/25 transition-all cursor-pointer"
              >
                Ya, Verifikasi Lunas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Pendaftaran */}
      {deleteModalPendaftaran && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-rose-200 dark:border-rose-800/60 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Hapus Pendaftaran Qurban?
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Hapus pendaftaran <strong>{deleteModalPendaftaran.user_name}</strong> beserta seluruh setoran yang sudah dilakukan. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalPendaftaran(null)}
                className="py-2.5 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePendaftaranQurban(deleteModalPendaftaran.id);
                  setDeleteModalPendaftaran(null);
                }}
                className="py-2.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-rose-600/25 transition-all cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
