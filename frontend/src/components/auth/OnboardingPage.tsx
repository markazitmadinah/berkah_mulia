import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, MapPin, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import logo from '../../logo.png';

export const OnboardingPage: React.FC = () => {
  const { currentUser, updateProfile, showToast } = useApp();

  const [name, setName]       = useState(currentUser.name || '');
  const [phone, setPhone]     = useState(currentUser.phone || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast('Nomor HP wajib diisi', 'error');
      return;
    }
    if (!address.trim()) {
      showToast('Alamat wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      // updateProfile tidak return Promise, tapi langsung update state
      updateProfile({ name: name.trim(), phone: phone.trim(), address: address.trim() });
      // State akan diupdate oleh context; onboarding redirect akan hilang otomatis
    } catch (err) {
      showToast((err as { message?: string })?.message || 'Gagal menyimpan profil', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-yellow-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg shadow-amber-500/30 mb-4">
            <img src={logo} alt="Logo" className="w-10 h-10 object-cover" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 mb-3">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest">Langkah Terakhir</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Lengkapi Profil Anda
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Halo, <span className="font-bold text-slate-700 dark:text-slate-300">{currentUser.name}</span>! Sebelum masuk ke dashboard, lengkapi data berikut terlebih dahulu.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/60 dark:shadow-slate-900/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap sesuai KTP"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
              </div>
              {currentUser.nomor_anggota && (
                <p className="mt-1 text-[10px] text-slate-400">No. Anggota: <span className="font-mono font-bold">{currentUser.nomor_anggota}</span></p>
              )}
            </div>

            {/* No HP */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nomor HP / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789"
                  inputMode="tel"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />
              </div>
            </div>

            {/* Alamat */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Domisili <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan, Kota"
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 resize-none"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Data ini diperlukan untuk keperluan administrasi tabungan dan notifikasi. Anda bisa mengubahnya kapan saja melalui halaman profil.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 transition-all cursor-pointer"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                : <><CheckCircle2 className="w-4 h-4" /> Simpan & Masuk ke Dashboard</>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-4">
          © 2026 Koperasi Berkah Mulia · Seluruh data dilindungi
        </p>
      </div>
    </div>
  );
};
