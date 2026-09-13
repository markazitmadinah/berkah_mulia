import React from 'react';
import { UserAvatar } from '../ui/UserAvatar';
import {
  X,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  CreditCard
} from 'lucide-react';
import { User } from '../../types';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
            Profil Nasabah
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Avatar & Header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
            <UserAvatar
              userId={user.id}
              avatarPath={user.avatar_path}
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/40"
            />
            <div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                {user.name}
              </h4>
              <p className="text-slate-400 font-mono text-[11px]">
                No. Anggota: {user.nomor_anggota || 'Belum Terbit'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  user.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user.role}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                  user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{user.phone}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{user.address || 'Alamat belum diatur'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Terdaftar pada: {user.created_at}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
