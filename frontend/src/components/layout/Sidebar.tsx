import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import { QurbanIcon } from '../QurbanIcon';
import logo from '../../logo.png';
import { JenisTabungan } from '../../types';
import { LogoutConfirmModal } from '../modals/LogoutConfirmModal';
import {
  LayoutDashboard,
  Users,
  Layers,
  Coins,
  ReceiptText,
  Building2,
  Bell,
  FileSpreadsheet,
  Wallet,
  Landmark,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  CalendarCheck,
  Headphones,
  TrendingUp,
  Banknote,
  AlertCircle
} from 'lucide-react';
import { formatRupiah } from '../../utils/format';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  activePribadiSub?: string;
  onOpenPribadiSub?: (sub: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
  activePribadiSub,
  onOpenPribadiSub
}) => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    logout,
    unreadNotifikasiCount,
    theme,
    toggleTheme,
    transaksi,
    jenisTabungan
  } = useApp();

  const pendingTrxCount = transaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi').length;

  const [showLogout, setShowLogout] = useState(false);

  type MenuItemIcon = React.ComponentType<{ className?: string }>;
  interface MenuItem {
    id: string;
    label: string;
    icon: MenuItemIcon;
    badge?: string;
    submenu?: boolean;
    section?: string;
  }

  const isPribadiTab = (tab: string): boolean =>
    tab === 'pribadi' || tab === 'tabungan-pribadi';

  const [pribadiOpen, setPribadiOpen] = useState<boolean>(() => isPribadiTab(activeTab));

  const SUB_ORDER = ['mandiri', 'hari_raya', 'qurban', 'berjangka'];
  const pribadiSubs = SUB_ORDER
    .map((k) => jenisTabungan.find((j) => j.status_aktif && j.sub_jenis === k))
    .filter((j): j is JenisTabungan => Boolean(j));

  const adminMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Beranda' },
    // ── Data & Konfigurasi ──
    { id: 'users', label: 'Manajemen User', icon: Users, section: 'Data & Konfigurasi' },
    { id: 'jenis-tabungan', label: 'Jenis Tabungan', icon: Layers, section: 'Data & Konfigurasi' },
    { id: 'harga-emas', label: 'Harga Emas Harian', icon: Coins, section: 'Data & Konfigurasi' },
    { id: 'rekening-bank', label: 'Rekening Bank', icon: Building2, section: 'Data & Konfigurasi' },
    // ── Operasional Harian ──
    { 
      id: 'transaksi', 
      label: 'Transaksi & Verifikasi', 
      icon: ReceiptText,
      badge: pendingTrxCount > 0 ? `${pendingTrxCount}` : undefined,
      section: 'Operasional Harian'
    },
    { id: 'pembayaran-harian', label: 'Pembayaran Harian', icon: CalendarCheck, section: 'Operasional Harian' },
    { id: 'gadai', label: 'Gadai Emas', icon: Landmark, section: 'Operasional Harian' },
    { id: 'qurban', label: 'Tabungan Qurban', icon: QurbanIcon, section: 'Operasional Harian' },
    // ── Sistem ──
    { 
      id: 'notifikasi', 
      label: 'Notifikasi', 
      icon: Bell,
      badge: unreadNotifikasiCount > 0 ? `${unreadNotifikasiCount}` : undefined,
      section: 'Sistem'
    },
    { id: 'audit-log', label: 'Audit Log', icon: FileSpreadsheet, section: 'Sistem' },
  ];

  const userMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'gadai', label: 'Gadai', icon: Landmark },
    { id: 'emas', label: 'Tabungan Emas', icon: Coins },
    { id: 'pribadi', label: 'Tabungan Pribadi', icon: Wallet, submenu: true },
    { id: 'transaksi-saya', label: 'Riwayat Transaksi', icon: ReceiptText },
    { id: 'rekening-bank-koperasi', label: 'Rekening Koperasi', icon: Landmark },
    { 
      id: 'notifikasi', 
      label: 'Notifikasi', 
      icon: Bell,
      badge: unreadNotifikasiCount > 0 ? `${unreadNotifikasiCount}` : undefined
    },
    { id: 'hubungi-kami', label: 'Hubungi Kami', icon: Headphones },
  ];

  const menuItems = currentUser.role === 'admin' ? adminMenuItems : userMenuItems;

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 flex-shrink-0 flex flex-col justify-between p-4 lg:p-5 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col gap-5 overflow-y-auto">
          {/* Brand Logo & Close Button for Mobile */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Logo Berkah Mulia"
                className="w-10 h-10 object-cover"
              />
              <div>
                <div className="font-extrabold text-lg tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white">
                  Berkah Mulia
                </div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                  Wealth & Ethics Syariah
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex flex-col gap-1 px-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1">
              {currentUser.role === 'admin' ? 'Menu Administrator' : `Menu Nasabah (${userMenuItems.length})`}
            </div>
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || 
                (item.id === 'emas' && (activeTab === 'emas' || activeTab === 'tabungan-emas')) ||
                (item.id === 'transaksi-saya' && activeTab === 'riwayat-transaksi') ||
                (item.id === 'rekening-bank-koperasi' && activeTab === 'rekening-bank');

              const showSectionHeader = item.section && (idx === 0 || menuItems[idx - 1]?.section !== item.section);

              if (item.submenu) {
                const activeParent = isPribadiTab(activeTab);
                return (
                  <>
                    {showSectionHeader && (
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 pt-3 -mb-1 first:pt-0">
                        {item.section}
                      </div>
                    )}
                    <div key={item.id}>
                    <button
                      onClick={() => setPribadiOpen(v => !v)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer text-left ${
                        activeParent
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${activeParent ? 'text-white' : 'text-slate-400 dark:text-slate-300'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {pribadiSubs.length > 0 && (
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${pribadiOpen ? 'rotate-180' : ''} ${activeParent ? 'text-white' : 'text-slate-400'}`} />
                      )}
                    </button>

                    {pribadiOpen && pribadiSubs.length > 0 && (
                      <div className="mt-1 mb-1 ml-5 pl-3 border-l border-slate-200 dark:border-slate-700 flex flex-col gap-1">
                        {pribadiSubs.map((j) => {
                          const sub = j.sub_jenis ?? '';
                          const subActive = activeParent && activePribadiSub === sub;
                          return (
                            <button
                              key={j.id}
                              onClick={() => {
                                setActiveTab('pribadi');
                                onOpenPribadiSub?.(sub);
                                if (onCloseMobile) onCloseMobile();
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left ${
                                subActive
                                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25'
                                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {/* flaticon.com attributable — free icon set */}
                              <img
                                src={`/icons/${sub}.png`}
                                alt={j.nama}
                                className={`w-4 h-4 flex-shrink-0 rounded-sm object-contain grayscale ${subActive ? 'brightness-0 invert' : 'opacity-75 dark:invert dark:opacity-100'}`}
                              />
                              <span className="truncate">{j.nama.replace(/^Tabungan\s+/i, '')}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  </>
                );
              }

              return (
                <>
                  {showSectionHeader && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 pt-3 -mb-1">
                      {item.section}
                    </div>
                  )}
                  <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer text-left ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isActive
                          ? 'bg-white text-emerald-700'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
                </>
              );
            })}
          </nav>
        </div>

        {/* ── Shortcut Setor (khusus Nasabah) ── */}
        {currentUser.role === 'user' && (() => {
          // Hitung sisa angsuran per jenis tabungan dari data transaksi
          const emasProgress = jenisTabungan.find(j => j.tipe === 'emas');
          const hasTrx = transaksi.some(t => t.status_verifikasi === 'terverifikasi');

          const pendingCount = transaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi').length;
          const belumBayar = transaksi.filter(t => t.status_verifikasi === 'belum').length;

          return (
            <div className="mx-1 mb-3">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Setoran</p>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/60 dark:border-amber-800/40 overflow-hidden">
                {/* Header info sisa */}
                <div className="px-3 pt-3 pb-2 space-y-1.5">
                  {pendingCount > 0 && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Menunggu verifikasi
                      </span>
                      <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                        {pendingCount}x
                      </span>
                    </div>
                  )}
                  {hasTrx ? (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">Total transaksi</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {transaksi.filter(t => t.status_verifikasi === 'terverifikasi').length}x lunas
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">Belum ada setoran</p>
                  )}
                </div>

                {/* Tombol setor */}
                {emasProgress ? (
                  <button
                    onClick={() => {
                      setActiveTab('emas');
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 hover:bg-amber-200/80 dark:hover:bg-amber-800/50 transition-all cursor-pointer border-t border-amber-200/60 dark:border-amber-700/40"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Setor Tabungan
                  </button>
                ) : (
                  <button
                    disabled
                    title="Aktifkan tabungan terlebih dahulu"
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-700/40 cursor-not-allowed"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Belum Ada Tabungan Aktif
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bottom Profile & Logout */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 px-1 mt-2">
          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar / Logout</span>
          </button>

          {/* User Card & Theme Toggle */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                userId={currentUser.id}
                avatarPath={currentUser.avatar_path}
                className="w-8 h-8 rounded-full object-cover border border-emerald-500/40"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {currentUser.phone}
                </p>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer"
              title={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </aside>

      <LogoutConfirmModal
        isOpen={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={logout}
      />
    </>
  );
};
