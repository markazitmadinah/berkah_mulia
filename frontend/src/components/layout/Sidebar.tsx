import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../ui/UserAvatar';
import { QurbanIcon } from '../QurbanIcon';
import logo from '../../logo.png';
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
  PiggyBank,
  Banknote,
  Target
} from 'lucide-react';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile
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
    jenisTabungan,
    showToast
  } = useApp();

  const pendingTrxCount = transaksi.filter(t => t.status_verifikasi === 'menunggu_verifikasi').length;

  type MenuItemIcon = React.ComponentType<{ className?: string }>;
  interface MenuItem {
    id: string;
    label: string;
    icon: MenuItemIcon;
    badge?: string;
    submenu?: boolean;
  }

  const isTabunganTab = (tab: string): boolean =>
    tab === 'emas' || tab === 'tabungan-emas' ||
    tab === 'pribadi' || tab === 'tabungan-pribadi' ||
    tab === 'qurban' || tab === 'tabungan-qurban' ||
    tab.startsWith('tabungan-custom-');

  const [tabunganOpen, setTabunganOpen] = useState<boolean>(() => isTabunganTab(activeTab));

  const subTabForJenis = (j: { tipe: string; id: number }): string | null => {
    if (j.tipe === 'emas') return 'emas';
    if (j.tipe === 'pribadi') return 'pribadi';
    if (j.tipe === 'qurban') return 'qurban';
    if (j.tipe === 'custom') return `tabungan-custom-${j.id}`;
    return null;
  };

  const savingsSubmenu = jenisTabungan.filter((j) => j.status_aktif && ['emas', 'pribadi', 'qurban'].includes(j.tipe));
  const savingsOthers = jenisTabungan.filter((j) => j.status_aktif && j.tipe === 'custom');

  const adminMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Manajemen User', icon: Users },
    { id: 'jenis-tabungan', label: 'Jenis Tabungan', icon: Layers },
    { id: 'goal-tracker', label: 'Goal Tracker', icon: Target },
    { id: 'harga-emas', label: 'Harga Emas Harian', icon: Coins },
    { id: 'qurban', label: 'Tabungan Qurban', icon: QurbanIcon },
    { 
      id: 'transaksi', 
      label: 'Transaksi & Verifikasi', 
      icon: ReceiptText,
      badge: pendingTrxCount > 0 ? `${pendingTrxCount}` : undefined
    },
    { id: 'rekening-bank', label: 'Rekening Bank', icon: Building2 },
    { 
      id: 'notifikasi', 
      label: 'Notifikasi', 
      icon: Bell,
      badge: unreadNotifikasiCount > 0 ? `${unreadNotifikasiCount}` : undefined
    },
    { id: 'audit-log', label: 'Audit Log', icon: FileSpreadsheet },
  ];

  const userMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tabungan', label: 'Tabungan Saya', icon: Layers, submenu: true },
    { id: 'transaksi-saya', label: 'Riwayat Transaksi', icon: ReceiptText },
    { id: 'rekening-bank-koperasi', label: 'Rekening Koperasi', icon: Landmark },
    { 
      id: 'notifikasi', 
      label: 'Notifikasi', 
      icon: Bell,
      badge: unreadNotifikasiCount > 0 ? `${unreadNotifikasiCount}` : undefined
    },
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
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 flex-shrink-0 flex flex-col justify-between p-4 md:p-5 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shadow-xl md:shadow-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
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
              className="md:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex flex-col gap-1 px-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1">
              {currentUser.role === 'admin' ? 'Menu Administrator (9)' : `Menu Nasabah (${userMenuItems.length})`}
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || 
                (item.id === 'transaksi-saya' && activeTab === 'riwayat-transaksi') ||
                (item.id === 'rekening-bank-koperasi' && activeTab === 'rekening-bank');

              if (item.submenu) {
                const isOpen = tabunganOpen;
                const hasSubCount = savingsSubmenu.length > 0 || savingsOthers.length > 0;
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => setTabunganOpen(v => !v)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer text-left ${
                        isTabunganTab(activeTab)
                          ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isTabunganTab(activeTab) ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {hasSubCount && (
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isTabunganTab(activeTab) ? 'text-white' : 'text-slate-400'}`} />
                      )}
                    </button>

                    {isOpen && hasSubCount && (
                      <div className="mt-1 mb-1 ml-5 pl-3 border-l border-slate-200 dark:border-slate-700 flex flex-col gap-1">
                        {[...savingsSubmenu, ...savingsOthers].map((j) => {
                          const tabId = subTabForJenis(j);
                          const subActive = tabId !== null && (activeTab === tabId || activeTab === `tabungan-${tabId === 'emas' || tabId === 'pribadi' || tabId === 'qurban' ? tabId : ''}`);
                          const SubIcon = j.tipe === 'emas' ? Coins : j.tipe === 'pribadi' ? Wallet : j.tipe === 'qurban' ? QurbanIcon : (({Wallet, Coins, PiggyBank, Landmark, Target} as Record<string, MenuItemIcon>)[String((j.config as Record<string, any>)?.ikon || 'Wallet')] ?? Wallet);
                          const label = j.nama.replace(/^Tabungan\s+/i, '');
                          return (
                            <button
                              key={j.id}
                              onClick={() => {
                                if (tabId) {
                                  handleItemClick(tabId);
                                } else {
                                  showToast('Tabungan ini sedang dipersiapkan. Silakan hubungi admin.', 'info');
                                }
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left ${
                                subActive
                                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25'
                                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title={j.deskripsi}
                            >
                              <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${subActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                              <span className="truncate">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer text-left ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
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
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile & Logout */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 px-1 mt-2">
          <button
            onClick={logout}
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
    </>
  );
};
