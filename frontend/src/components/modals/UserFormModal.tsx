import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  UserCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Shield
} from 'lucide-react';
import { User } from '../../types';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  userToEdit
}) => {
  const { createUser, updateUser, showToast } = useApp();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [nomorAnggota, setNomorAnggota] = useState<string>('');
  const [tanggalBergabung, setTanggalBergabung] = useState<string>(new Date().toISOString().slice(0, 10));
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [status, setStatus] = useState<'active' | 'pending' | 'suspended' | 'rejected'>('active');
  const [address, setAddress] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');

  const hariIni = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setPhone(userToEdit.phone);
      setNomorAnggota(userToEdit.nomor_anggota || '');
      setTanggalBergabung(userToEdit.created_at?.slice(0, 10) || hariIni());
      setRole(userToEdit.role);
      setStatus(userToEdit.status);
      setAddress(userToEdit.address || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setNomorAnggota('');
      setTanggalBergabung(hariIni());
      setRole('user');
      setStatus('active');
      setAddress('');
      setPassword('');
      setPasswordConfirm('');
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama lengkap wajib diisi', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Alamat email tidak valid', 'error');
      return;
    }
    if (!phone.trim()) {
      showToast('Nomor telepon / WhatsApp wajib diisi', 'error');
      return;
    }
    if (!/^\d{9,15}$/.test(phone)) {
      showToast('Nomor telepon harus angka 9–15 digit', 'error');
      return;
    }
    if (!/^\d{16}$/.test(nomorAnggota)) {
      showToast('Nomor anggota wajib 16 digit angka (contoh: 0000000020260001)', 'error');
      return;
    }

    if (!userToEdit) {
      if (!password) {
        showToast('Password wajib diisi untuk akun baru', 'error');
        return;
      }
      if (password.length < 8) {
        showToast('Password minimal 8 karakter', 'error');
        return;
      }
      if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        showToast('Password harus mengandung huruf dan angka', 'error');
        return;
      }
      if (password !== passwordConfirm) {
        showToast('Konfirmasi password tidak cocok', 'error');
        return;
      }
    }

    if (userToEdit) {
      updateUser(userToEdit.id, {
        name,
        email,
        phone,
        nomor_anggota: nomorAnggota,
        role,
        status,
        address,
        created_at: tanggalBergabung
      });
    } else {
      createUser({
        name,
        email,
        phone,
        nomor_anggota: nomorAnggota,
        role,
        status,
        address,
        password,
        password_confirmation: passwordConfirm,
        created_at: tanggalBergabung
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg sm:my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
              {userToEdit ? 'Edit Data Nasabah / Pengurus' : 'Tambah Nasabah Baru'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Isi parameter data keanggotaan dan profil identitas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Muhammad Ihsan"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                required
                inputMode="numeric"
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="08123456789"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor Anggota (16 digit)
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={16}
                value={nomorAnggota}
                onChange={(e) => setNomorAnggota(e.target.value.replace(/\D/g, '').slice(0, 16))}
                placeholder="0000000020260001"
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Bergabung
              </label>
              <input
                type="date"
                required
                value={tanggalBergabung}
                onChange={(e) => setTanggalBergabung(e.target.value)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {nomorAnggota.length === 16 && (
            <div className="py-2.5 px-3 rounded-2xl bg-emerald-50 dark:bg-slate-900 border border-dashed border-emerald-300 dark:border-emerald-500/40 font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-400 tracking-widest">
              {nomorAnggota.replace(/(\d{4})(?=\d)/g, '$1 ').trim()}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Peran (Role)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="user">Nasabah (User)</option>
                <option value="admin">Pengurus / Admin</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Status Akun
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="active">Aktif (Active)</option>
                <option value="pending">Menunggu Persetujuan (Pending)</option>
                {userToEdit && (
                  <>
                    <option value="suspended">Ditangguhkan (Suspended)</option>
                    <option value="rejected">Ditolak (Rejected)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Domisili
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Jl. Raya Syariah No. 45, Jakarta"
              className="w-full p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {!userToEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password Awal
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 karakter, huruf & angka"
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Ulangi password"
                  className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/25 cursor-pointer"
            >
              {userToEdit ? 'Simpan Perubahan' : 'Tambah User'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
