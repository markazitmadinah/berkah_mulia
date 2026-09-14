import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import { LogoutConfirmModal } from '../modals/LogoutConfirmModal';
import {
  Bell,
  Sun,
  Moon,
  ChevronDown,
  User,
  KeyRound,
  CheckCheck,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Menu
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile: () => void;
  onOpenPasswordModal: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenProfile,
  onOpenPasswordModal,
  onToggleMobileMenu
}) => {
  const {
    theme,
    toggleTheme,
    currentUser,
    activeTab,
    setActiveTab,
    logout,
    notifikasi,
    markNotifikasiRead,
    markAllNotifikasiRead
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const userNotifs = notifikasi.filter(n => n.user_id === currentUser.id);

  // Notifikasi di navbar khusus untuk hari ini saja; besok ganti hari otomatis kosong.
  const isToday = (iso: string): boolean => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const todayNotifs = userNotifs.filter(n => isToday(n.created_at));
  const todayUnread = todayNotifs.filter(n => !n.dibaca_pada).length;

  return (
    <>
    <header className="h-16 md:h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 md:gap-4 sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
      {/* Left Search Bar & Mobile Hamburger */}
      <div className="flex items-center gap-3 flex-1 max-w-md min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 shadow-xs cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sharia Status Pill for User */}
        {currentUser.role === 'user' && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Syariah Terverifikasi</span>
          </div>
        )}

        {/* Audit Log — akses cepat pojok kanan atas (admin) */}
        {currentUser.role === 'admin' && (
          <button
            onClick={() => setActiveTab(activeTab === 'audit-log' ? 'dashboard' : 'audit-log')}
            title="Audit Log & Rekam Jejak"
            className={`p-2 sm:p-2.5 rounded-full border transition-all shadow-xs cursor-pointer ${
              activeTab === 'audit-log'
                ? 'bg-blue-600 border-emerald-600 text-white shadow-blue-600/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 sm:p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all shadow-xs cursor-pointer"
          title={theme === 'dark' ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 sm:p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all shadow-xs relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {todayUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                {todayUnread}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-72 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">Notifikasi Sistem</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {todayUnread} Baru
                  </span>
                </div>
                {todayUnread > 0 && (
                  <button
                    onClick={markAllNotifikasiRead}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Tandai Semua
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 my-2">
                {todayNotifs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">Belum ada notifikasi hari ini.</p>
                ) : (
                  todayNotifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotifikasiRead(n.id)}
                      className={`p-2.5 rounded-2xl my-1 transition-all cursor-pointer ${
                        n.dibaca_pada
                          ? 'opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          : 'bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {n.judul}
                        </span>
                        {!n.dibaca_pada && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                        {n.pesan}
                      </p>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {n.created_at}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 sm:pr-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 transition-all shadow-xs cursor-pointer"
          >
            <UserAvatar
              userId={currentUser.id}
              avatarPath={currentUser.avatar_path}
              className="w-7 h-7 rounded-full object-cover border border-emerald-500/30"
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 hidden lg:block max-w-[120px] truncate">
              {currentUser.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Menu Modal / Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-3 w-60 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {currentUser.email}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ID: {currentUser.account_number || 'BM-NASABAH'}
                  </span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-left"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ubah Profil</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenPasswordModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-left"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ganti Password</span>
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogout(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    <LogoutConfirmModal
      isOpen={showLogout}
      onClose={() => setShowLogout(false)}
      onConfirm={logout}
    />
    </>
  );
};
