import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import {
  Users,
  FileSpreadsheet,
  Ban,
  RotateCcw,
  Trash2,
  Edit,
  Eye,
  Plus,
  UserRoundSearch
} from 'lucide-react';
import { User } from '../../types';
interface AdminUserManagementProps {
  onOpenCreateUser: () => void;
  onOpenEditUser: (user: User) => void;
  onOpenDetailUser: (user: User) => void;
  onOpenImportTabungan: () => void;
  onOpenExportModal: () => void;
  onOpenProfilNasabah: (user: User) => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  onOpenCreateUser,
  onOpenEditUser,
  onOpenDetailUser,
  onOpenImportTabungan,
  onOpenExportModal,
  onOpenProfilNasabah
}) => {
  const {
    users,
    suspendUser,
    activateUser,
    deleteUser
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  const filteredUsers = users.filter((u) => {
    const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
    const matchesRole = filterRole === 'all' || u.role === filterRole;

    return matchesStatus && matchesRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Manajemen User & Nasabah</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola data nasabah, verifikasi status akun, dan data kepengurusan
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenCreateUser}
            className="py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User</span>
          </button>

          <button
            onClick={onOpenImportTabungan}
            title="Import data tabungan lengkap 7 sheet (Nasabah, Emas, Mandiri, Qurban, Hari Raya, Gadai, Berjangka)"
            className="py-2.5 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-violet-600" />
            <span>Import Tabungan</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="py-2.5 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Status Akun</option>
          <option value="active">Aktif (Active)</option>
          <option value="suspended">Ditangguhkan (Suspended)</option>
          <option value="rejected">Ditolak (Rejected)</option>
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Peran</option>
          <option value="user">Nasabah (User)</option>
          <option value="admin">Pengurus (Admin)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">Nama & Username</th>
                <th className="py-3 px-3">No. Anggota</th>
                <th className="py-3 px-3">Telepon</th>
                <th className="py-3 px-3">Peran</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Aksi per Baris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Tidak ada data nasabah yang cocok.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          userId={u.id}
                          avatarPath={u.avatar_path}
                          className="w-8 h-8 rounded-full object-cover border border-emerald-500/30 flex-shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {u.name}
                          </div>
                          <span className="text-[11px] text-slate-400">@{u.username}</span>
                        </div>
                      </div>
                    </td>

                    {/* Account number */}
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
{u.nomor_anggota || '-'}
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {u.phone}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                        u.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : u.status === 'suspended'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}>
                        {u.status}
                      </span>
                    </td>

                    {/* Actions per row: Detail, Edit, Hapus, Approve, Reject, Suspend, Activate */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Detail */}
                        <button
                          onClick={() => onOpenDetailUser(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Detail Profil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Profil Nasabah */}
                        <button
                          onClick={() => onOpenProfilNasabah(u)}
                          className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 hover:bg-amber-200 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                          title="Buka Profil Nasabah"
                        >
                          <UserRoundSearch className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onOpenEditUser(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Suspend (for active) */}
                        {u.status === 'active' && u.role !== 'admin' && (
                          <button
                            onClick={() => suspendUser(u.id)}
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 transition-colors cursor-pointer"
                            title="Suspend Akun"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Activate (for suspended/rejected) */}
                        {(u.status === 'suspended' || u.status === 'rejected') && (
                          <button
                            onClick={() => activateUser(u.id)}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 transition-colors cursor-pointer"
                            title="Aktifkan Kembali"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete (Soft delete) */}
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus data nasabah ${u.name}?`)) {
                                deleteUser(u.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 transition-colors cursor-pointer"
                            title="Hapus User (Soft Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
