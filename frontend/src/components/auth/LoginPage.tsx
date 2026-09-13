import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Mail, Lock, LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import logo from '../../logo.png';

export const LoginPage: React.FC = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Login gagal. Periksa email dan password Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[#faf8ff]">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img
            src={logo}
            alt="Logo Berkah Mulia"
            className="w-11 h-11 object-cover"
          />
          <div>
            <div className="font-extrabold text-lg tracking-tight font-display">Berkah Mulia</div>
            <p className="text-[10px] font-bold text-blue-200 tracking-widest uppercase">Wealth & Ethics Syariah</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight font-display">
            Manajemen Tabungan Emas & Qurban Syariah
          </h1>
          <p className="mt-4 text-sm text-blue-100/90 leading-relaxed">
            Portal resmi Koperasi Berkah Mulia. Kelola setoran, verifikasi transaksi, dan pantau tabungan nasabah dalam satu platform.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-3 text-blue-50/80">
              <ShieldCheck className="w-4 h-4 text-blue-300 flex-shrink-0" />
              Setoran diawasi & diproses teller setiap hari kerja
            </div>
            <div className="flex items-center gap-3 text-blue-50/80">
              <ShieldCheck className="w-4 h-4 text-blue-300 flex-shrink-0" />
              Bukti transfer terverifikasi otomatis oleh sistem
            </div>
            <div className="flex items-center gap-3 text-blue-50/80">
              <ShieldCheck className="w-4 h-4 text-blue-300 flex-shrink-0" />
              Konversi fisik gram emas mengikuti harga harian
            </div>
          </div>
        </div>

        <p className="relative text-[11px] text-blue-200/60">
          © 2026 Koperasi Berkah Mulia. Seluruh data dilindungi.
        </p>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8 justify-center">
            <img
              src={logo}
              alt="Logo Berkah Mulia"
              className="w-20 h-20 object-cover rounded-2xl shadow-lg shadow-blue-600/10"
            />
            <span className="font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white font-display">Berkah Mulia</span>
            <p className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Wealth & Ethics Syariah</p>
          </div>

          <h2 className="text-[1.7rem] sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display leading-tight text-center lg:text-left">
            Selamat Datang Kembali
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 text-center lg:text-left">
            Masuk untuk mengakses dashboard tabungan syariah Anda.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@berkahmulia.com"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
            </button>
          </form>

          <div className="mt-8 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Data demo (untuk uji coba):</span>
            Admin: <code className="font-mono text-emerald-700 dark:text-blue-300">admin@berkahmulia.com</code> / <code className="font-mono text-emerald-700 dark:text-blue-300">password123</code>
            <br />
            Nasabah: <code className="font-mono text-emerald-700 dark:text-blue-300">client@gmail.com</code> / <code className="font-mono text-emerald-700 dark:text-blue-300">password123</code>
          </div>
        </div>
      </div>
    </div>
  );
};