import React, { useState, useRef, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { LayoutSkeleton, DashboardSkeleton } from './components/ui/Skeleton';

// User Views
import { UserDashboard } from './components/user/UserDashboard';
import { UserTabunganEmas } from './components/user/UserTabunganEmas';
import { UserTabunganPribadi } from './components/user/UserTabunganPribadi';
import { UserTabunganQurban } from './components/user/UserTabunganQurban';
import { UserRiwayatTransaksi } from './components/user/UserRiwayatTransaksi';
import { UserRekeningBank } from './components/user/UserRekeningBank';
import { UserNotifikasi } from './components/user/UserNotifikasi';
import { ProfilePage } from './components/user/ProfilePage';
import { ChangePasswordPage } from './components/user/ChangePasswordPage';

// Admin Views
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminUserManagement } from './components/admin/AdminUserManagement';
import { AdminJenisTabungan } from './components/admin/AdminJenisTabungan';
import { AdminHargaEmas } from './components/admin/AdminHargaEmas';
import { AdminQurban } from './components/admin/AdminQurban';
import { AdminTransaksi } from './components/admin/AdminTransaksi';
import { AdminPembayaranHarian } from './components/admin/AdminPembayaranHarian';
import { AdminRekeningBank } from './components/admin/AdminRekeningBank';
import { AdminNotifikasi } from './components/admin/AdminNotifikasi';
import { AdminAuditLog } from './components/admin/AdminAuditLog';
import { AdminProfilNasabah } from './components/admin/AdminProfilNasabah';
import { AdminGadai } from './components/admin/AdminGadai';
import { UserGadai } from './components/user/UserGadai';

// Modals
import { SetorPage } from './components/user/SetorPage';
import { TarikModal } from './components/modals/TarikModal';
import { DaftarQurbanModal } from './components/modals/DaftarQurbanModal';
import { DetailTransaksiModal } from './components/modals/DetailTransaksiModal';
import { RejectTransaksiModal } from './components/modals/RejectTransaksiModal';
import { CashTransaksiModal } from './components/modals/CashTransaksiModal';
import { UserFormModal } from './components/modals/UserFormModal';
import { UserDetailModal } from './components/modals/UserDetailModal';
import { ImportUserModal } from './components/modals/ImportUserModal';
import { JenisTabunganModal } from './components/modals/JenisTabunganModal';
import { HargaEmasModal } from './components/modals/HargaEmasModal';
import { PeriodeQurbanModal } from './components/modals/PeriodeQurbanModal';
import { HewanQurbanModal } from './components/modals/HewanQurbanModal';
import { RekeningBankModal } from './components/modals/RekeningBankModal';
import { ExportModal } from './components/modals/ExportModal';


import { Transaksi, User, JenisTabungan, HargaEmasHarian, PeriodeQurban, HewanQurban, RekeningBank } from './types';

const MainLayout: React.FC = () => {
  const { currentUser, activeTab, setActiveTab, loading, transaksi, uploadBuktiTransaksi, jenisTabungan } = useApp();

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Bukti transfer upload
  const buktiFileInputRef = useRef<HTMLInputElement>(null);
  const [buktiUploadTrxId, setBuktiUploadTrxId] = useState<number | null>(null);

  const handleUploadBukti = (trx: Transaksi) => {
    if (buktiFileInputRef.current) {
      setBuktiUploadTrxId(trx.id);
      buktiFileInputRef.current.click();
    }
  };

  // Setor page state
  const [setorDefaultTipe, setSetorDefaultTipe] = useState<'emas' | 'pribadi' | 'qurban'>('emas');
  const [setorDefaultJenisId, setSetorDefaultJenisId] = useState<number | undefined>();
  const [setorDefaultNominal, setSetorDefaultNominal] = useState<number | undefined>();
  const [setorDefaultKonfigurasiId, setSetorDefaultKonfigurasiId] = useState<number | undefined>();
  const [setorQurbanPendaftaranId, setSetorQurbanPendaftaranId] = useState<number | undefined>();
  const [pribadiInitialSub, setPribadiInitialSub] = useState<string>('mandiri');

  const [isTarikOpen, setIsTarikOpen] = useState(false);
  const [isDaftarQurbanOpen, setIsDaftarQurbanOpen] = useState(false);
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [cashInitialUserId, setCashInitialUserId] = useState<number | undefined>();
  const [cashInitialJenisId, setCashInitialJenisId] = useState<number | undefined>();
  const [cashRefreshKey, setCashRefreshKey] = useState(0);

  const openCashFor = (userId: number, jenisTabunganId: number) => {
    setCashInitialUserId(userId);
    setCashInitialJenisId(jenisTabunganId);
    setIsCashOpen(true);
  };

  const openCashModal = () => {
    setCashInitialUserId(undefined);
    setCashInitialJenisId(undefined);
    setIsCashOpen(true);
  };


  // Detail & Action modals
  const [selectedTrx, setSelectedTrx] = useState<Transaksi | null>(null);
  const [isDetailTrxOpen, setIsDetailTrxOpen] = useState(false);
  const [isRejectTrxOpen, setIsRejectTrxOpen] = useState(false);

  // User management modals
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [isImportUserOpen, setIsImportUserOpen] = useState(false);
  const [profilUserId, setProfilUserId] = useState<number | null>(null);

  // Product & Gold modals
  const [isJenisModalOpen, setIsJenisModalOpen] = useState(false);
  const [jenisToEdit, setJenisToEdit] = useState<JenisTabungan | null>(null);
  const [isHargaModalOpen, setIsHargaModalOpen] = useState(false);
  const [hargaToEdit, setHargaToEdit] = useState<HargaEmasHarian | null>(null);

  // Qurban modals
  const [isPeriodeModalOpen, setIsPeriodeModalOpen] = useState(false);
  const [periodeToEdit, setPeriodeToEdit] = useState<PeriodeQurban | null>(null);
  const [isHewanModalOpen, setIsHewanModalOpen] = useState(false);
  const [hewanToEdit, setHewanToEdit] = useState<HewanQurban | null>(null);

  // Rekening modals
  const [isRekeningModalOpen, setIsRekeningModalOpen] = useState(false);
  const [rekToEdit, setRekToEdit] = useState<RekeningBank | null>(null);

  // Export modal (nasabah / transaksi)
  const [exportType, setExportType] = useState<'nasabah' | 'transaksi'>('nasabah');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const openExport = (type: 'nasabah' | 'transaksi') => {
    setExportType(type);
    setIsExportOpen(true);
  };

  // Setor Handlers (dedicated page instead of popup)
  const handleOpenSetor = (tipe: 'emas' | 'pribadi' | 'qurban', qurbanId?: number, jenisId?: number, nominal?: number, konfigurasiId?: number) => {
    setSetorDefaultTipe(tipe);
    setSetorDefaultJenisId(jenisId);
    setSetorDefaultNominal(nominal);
    setSetorDefaultKonfigurasiId(konfigurasiId);
    setSetorQurbanPendaftaranId(qurbanId);
    setActiveTab('setor');
  };

  const handleOpenDetailTrx = (trx: Transaksi) => {
    setSelectedTrx(trx);
    setIsDetailTrxOpen(true);
  };

  const handleOpenRejectTrx = (trx: Transaksi) => {
    setSelectedTrx(trx);
    setIsRejectTrxOpen(true);
  };

  // User Management Handlers
  const handleOpenCreateUser = () => {
    setUserToEdit(null);
    setIsUserFormOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setUserToEdit(user);
    setIsUserFormOpen(true);
  };

  const handleOpenDetailUser = (user: User) => {
    setSelectedUserDetail(user);
    setIsUserDetailOpen(true);
  };

  const handleOpenProfilNasabah = (user: User) => {
    setProfilUserId(user.id);
    setActiveTab('profil-nasabah');
  };

  useEffect(() => {
    if (activeTab !== 'profil-nasabah') setProfilUserId(null);
  }, [activeTab]);

  // Product & Gold Handlers
  const handleOpenEditJenis = (item: JenisTabungan) => {
    setJenisToEdit(item);
    setIsJenisModalOpen(true);
  };

  const handleOpenInputHarga = () => {
    setHargaToEdit(null);
    setIsHargaModalOpen(true);
  };

  const handleOpenEditHarga = (item: HargaEmasHarian) => {
    setHargaToEdit(item);
    setIsHargaModalOpen(true);
  };

  // Qurban Handlers
  const handleOpenCreatePeriode = () => {
    setPeriodeToEdit(null);
    setIsPeriodeModalOpen(true);
  };

  const handleOpenEditPeriode = (p: PeriodeQurban) => {
    setPeriodeToEdit(p);
    setIsPeriodeModalOpen(true);
  };

  const handleOpenCreateHewan = () => {
    setHewanToEdit(null);
    setIsHewanModalOpen(true);
  };

  const handleOpenEditHewan = (h: HewanQurban) => {
    setHewanToEdit(h);
    setIsHewanModalOpen(true);
  };

  const handleOpenCreateRekening = () => {
    setRekToEdit(null);
    setIsRekeningModalOpen(true);
  };

  const handleOpenEditRekening = (r: RekeningBank) => {
    setRekToEdit(r);
    setIsRekeningModalOpen(true);
  };

return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* Role-Aware Sidebar with Mobile Drawer */}
      <Sidebar
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        activePribadiSub={pribadiInitialSub}
        onOpenPribadiSub={(sub) => {
          setPribadiInitialSub(sub);
          setActiveTab('pribadi');
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-2 sm:pt-3">
        <Navbar
          onOpenProfile={() => setActiveTab('profil')}
          onOpenPasswordModal={() => setActiveTab('ganti-password')}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {loading && transaksi.length === 0 && activeTab === 'dashboard' ? (
            <DashboardSkeleton />
          ) : (
          <div className="max-w-5xl xl:max-w-7xl mx-auto pb-12">
            {/* USER VIEWS */}
            {currentUser.role === 'user' && (
              <>
                {activeTab === 'dashboard' && (
                  <UserDashboard
                    onOpenSetorEmas={() => handleOpenSetor('emas')}
                    onOpenSetorPribadi={() => handleOpenSetor('pribadi')}
                    onOpenTarikPribadi={() => setIsTarikOpen(true)}
                    onOpenDaftarQurban={() => setIsDaftarQurbanOpen(true)}
                    onOpenSetorQurban={(pendaftaranId) => handleOpenSetor('qurban', pendaftaranId)}
                    onOpenPribadiSub={(sub) => {
                      setPribadiInitialSub(sub);
                      setActiveTab('pribadi');
                    }}
                  />
                )}
                {(activeTab === 'emas' || activeTab === 'tabungan-emas') && (
                  <UserTabunganEmas onOpenSetorEmas={(nominal?: number, konfigurasiId?: number) => handleOpenSetor('emas', undefined, undefined, nominal, konfigurasiId)} />
                )}
                {(activeTab === 'pribadi' || activeTab === 'tabungan-pribadi') && (
                  <UserTabunganPribadi
                    key={pribadiInitialSub}
                    initialSub={pribadiInitialSub}
                    onOpenSetorPribadi={(subJenisId?: number) => handleOpenSetor('pribadi', undefined, subJenisId)}
                    onOpenTarikPribadi={() => setIsTarikOpen(true)}
                    onOpenDaftarQurban={() => setIsDaftarQurbanOpen(true)}
                    onOpenSetorQurban={(pendaftaranId) => handleOpenSetor('qurban', pendaftaranId)}
                  />
                )}
                {(activeTab === 'qurban' || activeTab === 'tabungan-qurban') && (
                  <UserTabunganQurban
                    onOpenDaftarQurban={() => setIsDaftarQurbanOpen(true)}
                    onOpenSetorQurban={(pendaftaranId) => handleOpenSetor('qurban', pendaftaranId)}
                  />
                )}
                {activeTab === 'transaksi-saya' || activeTab === 'riwayat-transaksi' ? (
                  <UserRiwayatTransaksi
                    onOpenDetailTransaksi={handleOpenDetailTrx}
                    onOpenUploadBukti={handleUploadBukti}
                  />
                ) : null}
                {(activeTab === 'rekening-bank-koperasi' || activeTab === 'rekening-bank') && (
                  <UserRekeningBank />
                )}
                {activeTab === 'notifikasi' && <UserNotifikasi />}
                {activeTab === 'gadai' && <UserGadai />}
                {activeTab === 'setor' && (
                  <SetorPage
                    defaultTipe={setorDefaultTipe}
                    defaultJenisId={setorDefaultJenisId}
                    defaultNominal={setorDefaultNominal}
                    defaultKonfigurasiId={setorDefaultKonfigurasiId}
                    qurbanPendaftaranId={setorQurbanPendaftaranId}
                    onBack={() => setActiveTab('dashboard')}
                  />
                )}
                {activeTab === 'profil' && (
                  <ProfilePage onBack={() => setActiveTab('dashboard')} />
                )}
                {activeTab === 'ganti-password' && (
                  <ChangePasswordPage onBack={() => setActiveTab('dashboard')} />
                )}
              </>
            )}

            {/* ADMIN VIEWS (9 MENUS) */}
            {currentUser.role === 'admin' && (
              <>
                {activeTab === 'dashboard' && (
                  <AdminDashboard
                    onOpenCashModal={openCashModal}
                    onOpenDetailTransaksi={handleOpenDetailTrx}
                    onOpenRejectModal={handleOpenRejectTrx}
                  />
                )}
                {activeTab === 'users' && (
                  <AdminUserManagement
                    onOpenCreateUser={handleOpenCreateUser}
                    onOpenEditUser={handleOpenEditUser}
                    onOpenDetailUser={handleOpenDetailUser}
                    onOpenImportModal={() => setIsImportUserOpen(true)}
                    onOpenExportModal={() => openExport('nasabah')}
                    onOpenProfilNasabah={handleOpenProfilNasabah}
                  />
                )}
                {activeTab === 'profil-nasabah' && (
                  <AdminProfilNasabah
                    initialUserId={profilUserId ?? undefined}
                    onBack={() => setActiveTab('users')}
                  />
                )}
                {activeTab === 'jenis-tabungan' && (
                  <AdminJenisTabungan
                    onOpenEditModal={handleOpenEditJenis}
                  />
                )}
                {activeTab === 'harga-emas' && (
                  <AdminHargaEmas
                    onOpenInputHargaModal={handleOpenInputHarga}
                    onOpenEditHargaModal={handleOpenEditHarga}
                  />
                )}
                {activeTab === 'qurban' && (
                  <AdminQurban
                    onOpenCreatePeriode={handleOpenCreatePeriode}
                    onOpenEditPeriode={handleOpenEditPeriode}
                    onOpenCreateHewan={handleOpenCreateHewan}
                    onOpenEditHewan={handleOpenEditHewan}
                  />
                )}
                {activeTab === 'transaksi' && (
                  <AdminTransaksi
                    onOpenCashModal={openCashModal}
                    onOpenDetailTransaksi={handleOpenDetailTrx}
                    onOpenRejectModal={handleOpenRejectTrx}
                    onOpenExportModal={() => openExport('transaksi')}
                  />
                )}
                {activeTab === 'pembayaran-harian' && (
                  <AdminPembayaranHarian
                    onOpenCash={openCashFor}
                    refreshKey={cashRefreshKey}
                  />
                )}
                {activeTab === 'rekening-bank' && (
                  <AdminRekeningBank
                    onOpenCreateModal={handleOpenCreateRekening}
                    onOpenEditModal={handleOpenEditRekening}
                  />
                )}
               {activeTab === 'notifikasi' && <AdminNotifikasi />}
               {activeTab === 'audit-log' && <AdminAuditLog />}
               {activeTab === 'gadai' && <AdminGadai />}
                {activeTab === 'profil' && (
                  <ProfilePage onBack={() => setActiveTab('dashboard')} />
                )}
                {activeTab === 'ganti-password' && (
                  <ChangePasswordPage onBack={() => setActiveTab('dashboard')} />
                )}
              </>
            )}
          </div>
          )}
        </main>
      </div>

      {/* ALL MODALS */}
      <TarikModal
        isOpen={isTarikOpen}
        onClose={() => setIsTarikOpen(false)}
      />

      <DaftarQurbanModal
        isOpen={isDaftarQurbanOpen}
        onClose={() => setIsDaftarQurbanOpen(false)}
      />

      <DetailTransaksiModal
        isOpen={isDetailTrxOpen}
        onClose={() => setIsDetailTrxOpen(false)}
        transaksi={selectedTrx}
      />

      <RejectTransaksiModal
        isOpen={isRejectTrxOpen}
        onClose={() => setIsRejectTrxOpen(false)}
        transaksi={selectedTrx}
      />

      <CashTransaksiModal
        isOpen={isCashOpen}
        onClose={() => {
          setIsCashOpen(false);
          setCashRefreshKey((k) => k + 1);
        }}
        initialUserId={cashInitialUserId}
        initialJenisId={cashInitialJenisId}
      />

      <UserFormModal
        isOpen={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        userToEdit={userToEdit}
      />

      <UserDetailModal
        isOpen={isUserDetailOpen}
        onClose={() => setIsUserDetailOpen(false)}
        user={selectedUserDetail}
      />

      <ImportUserModal
        isOpen={isImportUserOpen}
        onClose={() => setIsImportUserOpen(false)}
      />

      <ExportModal
        type={exportType}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <JenisTabunganModal
        isOpen={isJenisModalOpen}
        onClose={() => setIsJenisModalOpen(false)}
        itemToEdit={jenisToEdit}
      />

      <HargaEmasModal
        isOpen={isHargaModalOpen}
        onClose={() => setIsHargaModalOpen(false)}
        hargaToEdit={hargaToEdit}
      />

      <PeriodeQurbanModal
        isOpen={isPeriodeModalOpen}
        onClose={() => setIsPeriodeModalOpen(false)}
        periodeToEdit={periodeToEdit}
      />

      <HewanQurbanModal
        isOpen={isHewanModalOpen}
        onClose={() => setIsHewanModalOpen(false)}
        hewanToEdit={hewanToEdit}
      />

      <RekeningBankModal
        isOpen={isRekeningModalOpen}
        onClose={() => setIsRekeningModalOpen(false)}
        rekToEdit={rekToEdit}
      />



      {/* Hidden file input for bukti transfer upload */}
      <input
        ref={buktiFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && buktiUploadTrxId != null) {
            uploadBuktiTransaksi(buktiUploadTrxId, file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center p-6 bg-[#faf8ff]">
          <div className="max-w-lg w-full rounded-3xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h1 className="text-base font-extrabold text-rose-600 mb-2">Terjadi kesalahan di aplikasi</h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">{String(this.state.error.message || this.state.error)}</p>
            <pre className="text-[10px] bg-slate-50 dark:bg-slate-800 rounded-xl p-3 overflow-auto max-h-40 text-rose-700 dark:text-rose-300 whitespace-pre-wrap break-all">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 py-2 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AuthGate: React.FC = () => {
  const { booted, currentUser } = useApp();

  if (!booted) {
    return <LayoutSkeleton />;
  }

  return currentUser.id > 0 ? (
    <ErrorBoundary key={currentUser.id}>
      <MainLayout />
    </ErrorBoundary>
  ) : (
    <LoginPage />
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthGate />
      </AppProvider>
    </ErrorBoundary>
  );
}
