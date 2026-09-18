import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  api,
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  dropStoredUser,
  downloadFile,
  ApiEnvelope
} from '../lib/api';
import {
  User,
  JenisTabungan,
  HargaEmasHarian,
  PeriodeQurban,
  HewanQurban,
  PendaftaranQurban,
  RekeningBank,
  Transaksi,
  Notifikasi,
  AuditLog,
  SetoranBerkalaResponse,
  SetoranBerkalaPayload,
  HariRayaStatus,
  ProfilNasabah,
  MonitoringNasabah,
  PembayaranHarianResponse,
  TunggakanSetoranResponse,
  Gadai,
  GadaiPayload,
  GadaiBayarPayload,
  TabunganBerjangka,
  TabunganBerjangkaResponse,
  TabunganBerjangkaPayload,
  SetorTabunganBerjangkaPayload,
  CairkanTabunganBerjangkaPayload,
  TransaksiFilters,
  FrekuensiSetoran
} from '../types';
import { formatRupiah } from '../utils/format';
import { hargaJualPerGram } from '../utils/hargaJual';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  text: string;
  type: ToastType;
}

interface SetoranPayload {
  jenis_tabungan_id?: number;
  tipe_tabungan?: 'emas' | 'pribadi' | 'qurban';
  nominal: number;
  rekening_bank_id?: number;
  bukti_transfer_path?: string;
  bukti_transfer_file?: File | null;
  catatan_user?: string;
  pendaftaran_qurban_id?: number;
  konfigurasi_id?: number;
}

interface PenarikanPayload {
  jenis_tabungan_id?: number;
  nominal: number;
  catatan_user?: string;
}

interface PenarikanEmasPayload {
  nominal?: number;
  bank_tujuan?: string;
  no_rekening?: string;
  atas_nama?: string;
  catatan_user?: string;
}

interface DaftarQurbanPayload {
  periode_qurban_id?: number;
  hewan_qurban_id: number;
  jumlah_hewan: number;
  target_dana?: number;
  catatan?: string;
  frekuensi_setor?: FrekuensiSetoran;
  nominal_per_periode?: number;
}

interface CashTransaksiPayload {
  user_id: number;
  jenis_tabungan_id: number;
  nominal: number;
  pendaftaran_qurban_id?: number;
  tabungan_berjangka_id?: number;
  konfigurasi_id?: number;
  catatan_teller?: string;
}

interface HargaEmasInput {
  tanggal: string;
  harga_per_gram: number;
  harga_beli?: number | null;
  tagihan_harian_default?: number;
  catatan?: string;
}

interface ProfileInput {
  name?: string;
  phone?: string;
  address?: string;
  avatar?: File | null;
  avatar_path?: string;
}

interface ActionResult {
  success: boolean;
  message: string;
}

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  booted: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;

  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userSubTab: string;
  setUserSubTab: (tab: string) => void;
  adminQurbanTab: string;
  setAdminQurbanTab: (tab: string) => void;

  users: User[];
  jenisTabungan: JenisTabungan[];
  hargaEmas: HargaEmasHarian[];
  periodeQurban: PeriodeQurban[];
  hewanQurban: HewanQurban[];
  pendaftaranQurban: PendaftaranQurban[];
  rekeningBank: RekeningBank[];
  transaksi: Transaksi[];
  notifikasi: Notifikasi[];
  auditLogs: AuditLog[];
  gadai: Gadai[];
  gadaiDetail: Gadai | null;
  fetchGadaiDetail: (id: number) => void;
  clearGadaiDetail: () => void;
  createGadai: (data: GadaiPayload) => void;
  approveGadai: (id: number) => void;
  aktifkanGadai: (id: number) => void;
  bayarGadai: (id: number, data: GadaiBayarPayload) => void;
  lunasiGadai: (id: number, nominal?: number) => void;
  kembalikanEmasGadai: (id: number) => void;
  batalGadai: (id: number) => void;
  tandaiTerlambatGadai: (id: number) => void;
  perpanjangGadai: (id: number) => void;
  deleteGadai: (id: number) => void;
  bayarGadaiUser: (gadaiId: number, data: FormData) => void;
  verifikasiAngsuranGadai: (angsuranId: number) => void;
  tolakAngsuranGadai: (angsuranId: number, catatan: string) => void;
  tabunganBerjangka: TabunganBerjangkaResponse | null;
  fetchTabunganBerjangka: () => void;
  setorTabunganBerjangka: (id: number, data: SetorTabunganBerjangkaPayload) => void;
  cairkanTabunganBerjangka: (id: number, data: CairkanTabunganBerjangkaPayload) => void;
  batalTabunganBerjangka: (id: number) => void;
  approveTabunganBerjangka: (id: number) => void;
  tolakTabunganBerjangka: (id: number) => void;
  verifikasiPembatalanBerjangka: (id: number) => void;
  setoranBerkala: SetoranBerkalaResponse | null;
  profilNasabah: ProfilNasabah | null;
  profilNasabahError: string | null;
  fetchProfilNasabah: (userId: number) => void;
  clearProfilNasabah: () => void;
  pembayaranHarian: PembayaranHarianResponse | null;
  tunggakanSetoran: TunggakanSetoranResponse | null;
  monitoringNasabah: MonitoringNasabah[] | null;
  fetchMonitoringNasabah: () => void;
  clearMonitoringNasabah: () => void;
  fetchPembayaranHarian: (tanggal?: string) => void;
  clearPembayaranHarian: () => void;
  fetchTunggakanSetoran: () => void;
  clearTunggakanSetoran: () => void;

  activeHargaEmas: HargaEmasHarian;
  userTransaksi: Transaksi[];
  userPendaftaranQurban: PendaftaranQurban[];
  userEmasGramTotal: number;
  userEmasTukarGramTotal: number;
  userEmasRupiahTotal: number;
  userEmasGoal: number | null;
  userTabunganPribadiTotal: number;
  userTabunganMandiriTotal: number;
  userTabunganBerjangkaTotal: number;
  userTabunganQurbanTotal: number;
  userTotalSaldo: number;
  unreadNotifikasiCount: number;

  updateProfile: (data: ProfileInput) => void;
  changePassword: (oldPass: string, newPass: string) => boolean;

  suspendUser: (userId: number) => void;
  activateUser: (userId: number) => void;
  createUser: (userData: Record<string, unknown>) => void;
  updateUser: (userId: number, userData: Record<string, unknown>) => void;
  deleteUser: (userId: number) => void;
  importUsers: (file: File) => Promise<void>;
  importLaporanHarian: (file: File) => Promise<void>;
  downloadUserTemplate: () => Promise<void>;
  exportUsers: () => Promise<void>;
  exportTransaksi: (filters?: TransaksiFilters) => Promise<void>;

  createJenisTabungan: (data: Record<string, unknown>) => void;
  updateJenisTabungan: (id: number, data: Record<string, unknown>) => void;
  toggleStatusJenisTabungan: (id: number) => void;

  inputHargaEmas: (data: HargaEmasInput) => void;
  syncHargaEmas: () => Promise<void>;
  deleteHargaEmas: (id: number) => ActionResult;
  refreshHargaEmas: () => Promise<void>;

  createPeriodeQurban: (data: Record<string, unknown>) => void;
  updatePeriodeQurban: (id: number, data: Partial<PeriodeQurban>) => void;
  createHewanQurban: (data: Record<string, unknown>) => void;
  updateHewanQurban: (id: number, data: Record<string, unknown>) => void;
  deleteHewanQurban: (id: number) => ActionResult;
  daftarTabunganQurban: (data: DaftarQurbanPayload) => void;
  daftarQurbanAdmin: (userId: number, data: DaftarQurbanPayload) => void;
  lunasPendaftaranQurban: (id: number) => void;
  lunasQurban: (id: number) => void;
  deletePendaftaranQurban: (id: number) => void;

  createSetoranUser: (data: SetoranPayload) => void;
  buatSetoranBerkala: (userId: number, data: SetoranBerkalaPayload) => void;
  batalkanSetoranBerkala: (id: number, data: PenarikanEmasPayload) => void;
  setTargetHariRayaAdmin: (userId: number, target: number, data?: { frekuensi_setor?: FrekuensiSetoran; nominal_per_periode?: number }) => void;
  cairkanTabunganAdmin: (userId: number, data: { jenis_tabungan_id: number; tabungan_berjangka_id?: number; konfigurasi_id?: number; nominal?: number; catatan_admin?: string }) => void;
  buatTabunganBerjangkaAdmin: (userId: number, payload: TabunganBerjangkaPayload) => void;
  createPenarikanUser: (data: PenarikanPayload) => void;
  createPenarikanEmas: (data: PenarikanEmasPayload) => void;
  tukarEmas: () => void;
  hariRayaStatus: HariRayaStatus | null;
  cairkanHariRaya: () => void;
  inputTransaksiCash: (data: CashTransaksiPayload) => void;
  verifikasiTransaksi: (id: number) => void;
  tolakTransaksi: (id: number, catatan: string) => void;
  uploadBuktiTransaksi: (id: number, file: File) => void;

  createRekeningBank: (data: Record<string, unknown>) => void;
  updateRekeningBank: (id: number, data: Record<string, unknown>) => void;
  toggleStatusRekeningBank: (id: number) => void;
  deleteRekeningBank: (id: number) => ActionResult;

  markNotifikasiRead: (id: number) => void;
  markAllNotifikasiRead: () => void;

  toastMessage: Toast | null;
  showToast: (text: string, type?: ToastType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const EMPTY_USER: User = {
  id: 0,
  name: '',
  email: '',
  phone: '',
  role: 'user',
  status: 'active',
  created_at: ''
};

const FALLBACK_HARGA: HargaEmasHarian = {
  id: 0,
  tanggal: new Date().toISOString().slice(0, 10),
  harga_per_gram: 1200000,
  tagihan_harian_default: 50000,
  status_aktif: true,
  catatan: 'Menunggu konfigurasi harga acuan',
  created_by: 0,
  created_at: ''
};

// ─── Normalizers: backend resource → komponen 2.0 ─────────────
const normUser = (u: unknown): User => {
  const x = (u ?? {}) as Record<string, any>;
  return {
    ...(x as User),
    role: (x.role as User['role']) || 'user',
    status: (x.status as User['status']) || 'active',
    account_number: `BM-${String(x.id ?? 0).padStart(6, '0')}`
  };
};

const normRekening = (r: unknown): RekeningBank => {
  const x = (r ?? {}) as Record<string, any>;
  return {
    ...(x as RekeningBank),
    status_aktif: (x.status_aktif as boolean) ?? true,
    logo_color: (x.logo_color as string) || '#10B981'
  };
};

const normPeriode = (p: unknown): PeriodeQurban => {
  const x = (p ?? {}) as Record<string, any>;
  return {
    ...(x as PeriodeQurban),
    nama_periode: (x.nama_periode as string) || `Qurban ${x.tahun ?? ''}`,
    tanggal_tutup_pendaftaran: (x.tanggal_tutup_pendaftaran as string) || '',
    tanggal_pencairan: (x.tanggal_pencairan as string) || ''
  };
};

const normTransaksi = (t: unknown): Transaksi => {
  const x = (t ?? {}) as Record<string, any>;
  const jt = (x.jenis_tabungan || {}) as Record<string, any>;
  const rb = (x.rekening_bank || null) as Record<string, any> | null;
  const gd = (x.gadai || null) as Record<string, any> | null;
  const isGadai = Boolean(x.gadai_id || gd || (x.catatan_admin && /gadai/i.test(x.catatan_admin)));
  const nomorGadai = gd?.nomor_gadai || x.nomor_gadai || (x.catatan_admin?.match(/BM-GD-[A-Z0-9-]+/i)?.[0]);

  return {
    id: x.id,
    nomor_referensi: x.nomor_referensi || `TRX-${x.id}`,
    user_id: x.user_id,
    user_name: x.user?.name || x.user_name,
    jenis_tabungan_id: jt.id ?? x.jenis_tabungan_id ?? undefined,
    jenis_tabungan_nama: jt.nama || (isGadai ? `Angsuran Gadai${nomorGadai ? ` (${nomorGadai})` : ''}` : (x.jenis_tabungan_nama || 'Transaksi')),
    tipe_tabungan: jt.tipe || (isGadai ? 'gadai' : x.tipe_tabungan),
    sub_jenis: jt.sub_jenis ?? x.sub_jenis ?? undefined,
    pendaftaran_qurban_id: x.pendaftaran_qurban_id ?? undefined,
    gadai_id: x.gadai_id ?? gd?.id ?? undefined,
    nomor_gadai: nomorGadai,
    tabungan_berjangka_id: x.tabungan_berjangka_id ?? undefined,
    jenis_transaksi: x.jenis_transaksi,
    nominal: Number(x.nominal),
    nominal_emas: x.nominal_emas != null ? Number(x.nominal_emas) : undefined,
    nominal_dana: x.nominal_dana != null ? Number(x.nominal_dana) : undefined,
    unit_didapat: x.unit_didapat != null ? Number(x.unit_didapat) : undefined,
    harga_acuan_snapshot: x.harga_acuan_snapshot != null ? Number(x.harga_acuan_snapshot) : undefined,
    metode_pembayaran: x.metode_pembayaran,
    rekening_bank_id: rb?.id ?? x.rekening_bank_id,
    rekening_bank_nama: rb ? `${rb.nama_bank} (${rb.no_rekening})` : undefined,
    bukti_transfer_path: x.bukti_transfer_url || x.bukti_transfer_path,
    status_verifikasi: x.status_verifikasi,
    diverifikasi_oleh_name: x.diverifikasi_oleh,
    diverifikasi_pada: x.diverifikasi_pada,
    catatan_admin: x.catatan_admin,
    catatan_user: x.catatan_user,
    tanggal_transaksi: (x.tanggal_transaksi || '').slice(0, 10),
    created_at: x.created_at
  };
};

const normPendaftaran = (p: unknown): PendaftaranQurban => {
  const x = (p ?? {}) as Record<string, any>;
  const user = (x.user || {}) as Record<string, any>;
  const per = (x.periode_qurban || {}) as Record<string, any>;
  const hew = (x.hewan_qurban || {}) as Record<string, any>;
  return {
    id: x.id,
    user_id: user.id ?? x.user_id ?? 0,
    user_name: user.name || x.user_name,
    periode_qurban_id: per.id ?? x.periode_qurban_id,
    hewan_qurban_id: hew.id ?? x.hewan_qurban_id,
    jumlah_hewan: x.jumlah_hewan,
    target_dana: Number(x.target_dana),
    total_terkumpul: Number(x.total_terkumpul),
    status: x.status,
    tanggal_daftar: (x.tanggal_daftar || '').slice(0, 10),
    tanggal_dicairkan: x.tanggal_dicairkan,
    dicairkan_oleh: x.dicairkan_oleh ?? undefined,
    catatan: x.catatan || undefined,
    frekuensi_setor: x.frekuensi_setor,
    frekuensi_label: x.frekuensi_label,
    nominal_per_periode: x.nominal_per_periode != null ? Number(x.nominal_per_periode) : null,
    sisa_pembayaran: x.sisa_pembayaran != null ? Number(x.sisa_pembayaran) : null,
    persentase: x.persentase != null ? Number(x.persentase) : null
  };
};

const AUDIT_DESKRIPSI: Record<string, string> = {
  register: 'Pendaftaran akun baru',
  create: 'Membuat data baru',
  update: 'Memperbarui data',
  update_version: 'Menambah versi harga emas',
  delete: 'Menghapus data',
  approve: 'Menyetujui akun nasabah',
  reject: 'Menolak data',
  suspend: 'Membekukan akun',
  activate: 'Mengaktifkan kembali akun',
  cairkan: 'Mencairkan dana qurban',
  verify: 'Memverifikasi transaksi',
  create_cash: 'Transaksi cash dibuat (auto-level)',
  toggle_status: 'Mengubah status aktif'
};

const mapAuditAction = (action: string, model: string): string => {
  switch (action) {
    case 'approve':
      return 'APPROVE_USER';
    case 'reject':
      return model === 'Transaksi' ? 'REJECT_TRANSACTION' : 'REJECT_USER';
    case 'verify':
      return 'VERIFY_TRANSACTION';
    case 'create_cash':
      return 'CREATE_CASH_TRANSACTION';
    case 'update_version':
      return 'UPDATE_GOLD_PRICE';
    case 'cairkan':
      return 'CAIRKAN_QURBAN';
    case 'suspend':
      return 'SUSPEND_USER';
    case 'activate':
      return 'ACTIVATE_USER';
    case 'create':
      return model === 'User' ? 'USER_CREATE' : 'CREATE';
    case 'update':
      return model === 'User' ? 'USER_UPDATE' : 'UPDATE';
    case 'delete':
      return model === 'User' ? 'USER_SOFT_DELETE' : 'DELETE';
    case 'toggle_status':
      return 'TOGGLE_STATUS';
    default:
      return action.toUpperCase();
  }
};

const normAudit = (a: unknown): AuditLog => {
  const x = (a ?? {}) as Record<string, any>;
  const user = (x.user || {}) as Record<string, any>;
  const model = x.model_type || '';
  return {
    id: x.id,
    user_id: user.id ?? x.user_id,
    user_name: user.name || x.user_name || '-',
    action: mapAuditAction(x.action, model),
    model: model,
    model_type: model,
    model_id: x.model_id,
    old_values: x.old_values,
    new_values: x.new_values,
    ip_address: x.ip_address || '127.0.0.1',
    user_agent: x.user_agent || '',
    deskripsi: AUDIT_DESKRIPSI[x.action] || x.action.replace(/_/g, ' '),
    created_at: x.created_at
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bm_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('bm_theme', next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const stored = getStoredUser();
    return stored ? normUser(stored) : EMPTY_USER;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [userSubTab, setUserSubTab] = useState<string>('periode-aktif');
  const [adminQurbanTab, setAdminQurbanTab] = useState<string>('pendaftaran');

  const [users, setUsers] = useState<User[]>([]);
  const [jenisTabungan, setJenisTabungan] = useState<JenisTabungan[]>([]);
  const [hargaEmas, setHargaEmas] = useState<HargaEmasHarian[]>([]);
  const [hargaTerkini, setHargaTerkini] = useState<HargaEmasHarian | null>(null);
  const [setoranBerkala, setSetoranBerkala] = useState<SetoranBerkalaResponse | null>(null);
  const [hariRayaStatus, setHariRayaStatus] = useState<HariRayaStatus | null>(null);
  const [profilNasabah, setProfilNasabah] = useState<ProfilNasabah | null>(null);
  const [profilNasabahError, setProfilNasabahError] = useState<string | null>(null);
  const [pembayaranHarian, setPembayaranHarian] = useState<PembayaranHarianResponse | null>(null);
  const [tunggakanSetoran, setTunggakanSetoran] = useState<TunggakanSetoranResponse | null>(null);
  const [monitoringNasabah, setMonitoringNasabah] = useState<MonitoringNasabah[] | null>(null);
  const [periodeQurban, setPeriodeQurban] = useState<PeriodeQurban[]>([]);
  const [hewanQurban, setHewanQurban] = useState<HewanQurban[]>([]);
  const [pendaftaranQurban, setPendaftaranQurban] = useState<PendaftaranQurban[]>([]);
  const [rekeningBank, setRekeningBank] = useState<RekeningBank[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [gadai, setGadai] = useState<Gadai[]>([]);
  const [gadaiDetail, setGadaiDetail] = useState<Gadai | null>(null);
  const [tabunganBerjangka, setTabunganBerjangka] = useState<TabunganBerjangkaResponse | null>(null);

  const [toastMessage, setToastMessage] = useState<Toast | null>(null);

  const showToast = (text: string, type: ToastType = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ─── Data loading ─────────────────────────────────────────
  const POLL_MS = 10_000;
  const hargaTerkiniAtRef = useRef(0);
  const refreshingRef = useRef(false);
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  const refresh = async (forUser: User = currentUser, mode: 'full' | 'light' = 'full') => {
    if (!forUser || !forUser.id) return;
    if (refreshingRef.current && mode === 'light') return;
    refreshingRef.current = true;
    setLoading(true);
    try {
      const light = mode === 'light';
      const now = Date.now();
      // Static master data (jenis tabungan, rekening bank) must re-fetch on
      // every full refresh so create/edit/delete show up immediately without
      // requiring a manual page reload (light polling skips them).
      const needStatic = !light;
      const needTerkini = !light && now - hargaTerkiniAtRef.current > 60_000;
      const isAdmin = forUser.role === 'admin';

      const static$ = needStatic
        ? Promise.all([
            api.get<JenisTabungan[]>('/jenis-tabungan?per_page=100'),
            api.get<RekeningBank[]>('/rekening-bank?per_page=100')
          ])
        : null;
      const nota$ = api.get<Notifikasi[]>('/notifikasi?per_page=50').catch(() => null);
      const terkini$ = needTerkini
        ? api
            .get<HargaEmasHarian>(isAdmin ? '/admin/emas/harga-terkini' : '/emas/harga-terkini')
            .catch(() => null)
        : null;
      // Riwayat harga (500 baris) paling berat; light poll skip supaya notif +
      // transaksi/verifikasi selalu ter-update bersama dan tidak kena timeout.
      const riwayat$ = light
        ? null
        : api
            .get<HargaEmasHarian[]>(isAdmin ? '/admin/emas/harga-riwayat?per_page=500' : '/emas/harga-riwayat?per_page=500')
            .catch(() => null);
      const qurbanMaster$ = light
        ? null
        : isAdmin
          ? Promise.all([
              api.get<PeriodeQurban[]>('/admin/qurban/periode?per_page=100').catch(() => null),
              api.get<HewanQurban[]>('/admin/qurban/hewan?per_page=100').catch(() => null)
            ])
          : api.get<PeriodeQurban>('/qurban/periode-aktif').catch(() => null);
      const penda$ = api
        .get<PendaftaranQurban[]>(isAdmin ? '/admin/qurban/pendaftaran?per_page=200' : '/qurban/pendaftaran-saya?per_page=200')
        .catch(() => null);
      const setoranBerkala$ = isAdmin
        ? null
        : api.get<SetoranBerkalaResponse>('/emas/setoran-berkala').catch(() => null);
      const hariRaya$ = isAdmin
        ? null
        : api.get<HariRayaStatus>('/tabungan-hari-raya/status').catch(() => null);
      const trx$ = api
        .get<Transaksi[]>(isAdmin ? '/admin/transaksi?per_page=1000' : '/transaksi-saya?per_page=200')
        .catch(() => null);
      const users$ = isAdmin ? api.get<User[]>('/admin/users?per_page=200').catch(() => null) : null;
      const audit$ = !light && isAdmin ? api.get<AuditLog[]>('/admin/audit-logs?per_page=100').catch(() => null) : null;
      const gadai$ = api
        .get<{ items: Gadai[] }>(isAdmin ? '/admin/gadai?per_page=200' : '/gadai-saya?per_page=200')
        .catch(() => null);
      const tabBerjangka$ = api
        .get<TabunganBerjangkaResponse>(isAdmin ? '/admin/tabungan-berjangka?per_page=100' : '/tabungan-berjangka')
        .catch(() => null);
      const me$ = api.get<User>('/auth/me').catch(() => null);

      const [staticRes, notaRes, terkiniRes, riwayatRes, masterRes, pendaRes, trxRes, usersRes, auditRes, gadaiRes, tabBerjangkaRes, setoranRes, hariRayaRes, meRes] =
        await Promise.all([static$, nota$, terkini$, riwayat$, qurbanMaster$, penda$, trx$, users$, audit$, gadai$, tabBerjangka$, setoranBerkala$, hariRaya$, me$]);

      if (!light) {
        if (staticRes) {
          setJenisTabungan(staticRes[0].data);
          setRekeningBank(staticRes[1].data.map(normRekening));
        }
        if (terkiniRes) {
          setHargaTerkini(terkiniRes.data || null);
          hargaTerkiniAtRef.current = now;
        }
        if (masterRes) {
          let per: PeriodeQurban[] = [];
          let hew: HewanQurban[] = [];
          if (isAdmin) {
            per = masterRes[0]?.data || [];
            hew = masterRes[1]?.data || [];
} else {
          const periode = (masterRes as ApiEnvelope<PeriodeQurban> | null)?.data;
          if (periode) {
            per = [periode];
            hew = (periode as PeriodeQurban & { hewan_qurban?: HewanQurban[] }).hewan_qurban || [];
          }
        }
        setPeriodeQurban(per.map(normPeriode));
        setHewanQurban(hew);
      }
      }

      if (notaRes) {
        setNotifikasi(notaRes.data.map(n => ({ ...n, user_id: forUser.id })));
        setUnreadCount(Number((notaRes.meta as Record<string, unknown> | undefined)?.unread_count) || 0);
      }
      if (riwayatRes) setHargaEmas(riwayatRes.data);
      if (pendaRes) setPendaftaranQurban(pendaRes.data.map(normPendaftaran));
      if (setoranRes) setSetoranBerkala(setoranRes.data);
      if (hariRayaRes) setHariRayaStatus(hariRayaRes.data);
      if (trxRes) {
        setTransaksi(trxRes.data.map(normTransaksi));
      } else if (!light) {
        throw new Error('Gagal memuat data.');
      }
      if (usersRes) setUsers(usersRes.data.map(normUser));
      if (auditRes) setAuditLogs(auditRes.data.map(normAudit));
      if (gadaiRes) setGadai(gadaiRes.data.items);
      if (tabBerjangkaRes) setTabunganBerjangka(tabBerjangkaRes.data);
      if (meRes) {
        const fresh = normUser(meRes.data);
        setCurrentUser(fresh);
        setStoredUser(fresh);
      }
      if (!isAdmin) {
        setUsers([]);
        setAuditLogs([]);
      }
    } catch (e) {
      const err = e as { message?: string };
      showToast(err?.message || 'Gagal memuat data.', 'error');
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  };

  const refreshRef = useRef<typeof refresh>(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      const u = userRef.current;
      if (!u || !u.id) return;
      refreshRef.current(u, 'light').catch(() => undefined);
    };
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAndRefresh = (fn: () => Promise<unknown>, okMsg?: string) =>
    fn()
      .then(async (res) => {
        const resp = res as { message?: string } | undefined;
        if (okMsg) showToast(okMsg);
        else if (resp?.message) showToast(resp.message);
        await refresh();
      })
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Terjadi kesalahan. Coba lagi.', 'error');
      });

  // ─── Auth ─────────────────────────────────────────────────
  const login = async (username: string, password: string) => {
    const res = await api.post<{ user: User; token: string; needs_onboarding?: boolean }>('/auth/login', { username, password });
    const { user, token } = res.data;
    setToken(token);
    const u = normUser(user);
    setStoredUser(u);
    setCurrentUser(u);
    setActiveTab('dashboard');
    await refresh(u);
  };

  const logout = () => {
    if (getToken()) api.post('/auth/logout').catch(() => undefined);
    clearToken();
    dropStoredUser();
    setCurrentUser(EMPTY_USER);
    setUsers([]);
    setJenisTabungan([]);
    setHargaEmas([]);
    setHargaTerkini(null);
    setSetoranBerkala(null);
    setProfilNasabah(null);
    setPeriodeQurban([]);
    setHewanQurban([]);
    setPendaftaranQurban([]);
    setRekeningBank([]);
    setTransaksi([]);
    setNotifikasi([]);
    setAuditLogs([]);
    setUnreadCount(0);
    setActiveTab('dashboard');
    showToast('Anda telah keluar dari sistem.', 'info');
  };

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setBooted(true);
        return;
      }
      try {
        const res = await api.get<User>('/auth/me');
        const u = normUser(res.data);
        setCurrentUser(u);
        setStoredUser(u);
        await refresh(u);
      } catch {
        clearToken();
        dropStoredUser();
        setCurrentUser(EMPTY_USER);
      } finally {
        setBooted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Getters ──────────────────────────────────────────────
  const activeHargaEmas: HargaEmasHarian =
    hargaTerkini ||
    hargaEmas.find(h => h.status_aktif) ||
    hargaEmas[hargaEmas.length - 1] ||
    FALLBACK_HARGA;

  const userTransaksi = transaksi.filter(t => t.user_id === currentUser.id);
  const userPendaftaranQurban = pendaftaranQurban.filter(p => p.user_id === currentUser.id);

  const verifiedUserTransaksi = userTransaksi.filter(t => t.status_verifikasi === 'terverifikasi');

  const userEmasGramTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'emas')
    .reduce((acc, curr) => acc + (curr.unit_didapat || 0), 0);

  const userEmasRupiahTotal = userEmasGramTotal > 0
    ? userEmasGramTotal * hargaJualPerGram(activeHargaEmas.harga_per_gram, userEmasGramTotal)
    : 0;

  // Total gram emas yang sudah berhasil di-tukar (akumulasi riwayat tarik emas terverifikasi)
  // -- bertambah tiap user menyelesaikan goal & menukar emas di toko
  const userEmasTukarGramTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'emas' && t.jenis_transaksi === 'tarik')
    .reduce((acc, curr) => acc + Math.abs(curr.unit_didapat || 0), 0);

  const userEmasGoal = currentUser.target_emas_gram != null ? Number(currentUser.target_emas_gram) : null;

  // ─── Saldo Tabungan Mandiri murni ─────────────────────────
  // HANYA transaksi pribadi yang BUKAN berjangka, BUKAN hari raya, dan TANPA tabungan_berjangka_id
  const userTabunganMandiriTotal = verifiedUserTransaksi
    .filter(t => {
      if (t.tipe_tabungan !== 'pribadi') return false;
      if (t.tabungan_berjangka_id) return false;
      if (t.sub_jenis === 'berjangka' || t.sub_jenis === 'hari_raya') return false;
      if (t.jenis_tabungan_nama && /berjangka|hari raya/i.test(t.jenis_tabungan_nama)) return false;
      return true;
    })
    .reduce((acc, curr) => curr.jenis_transaksi === 'setor' ? acc + curr.nominal : acc - curr.nominal, 0);

  // Total dana terkumpul pada seluruh tabungan berjangka milik user
  const userTabunganBerjangkaTotal = (tabunganBerjangka?.items || [])
    .reduce((acc, curr) => acc + (curr.terkumpul || 0), 0);

  // userTabunganPribadiTotal mengacu ke saldo Tabungan Mandiri (yang bebas ditarik sukarela)
  const userTabunganPribadiTotal = userTabunganMandiriTotal;

  const userTabunganQurbanTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'qurban')
    .reduce((acc, curr) => curr.jenis_transaksi === 'setor' ? acc + curr.nominal : acc - curr.nominal, 0);

  const userTotalSaldo = userEmasRupiahTotal + userTabunganMandiriTotal + userTabunganBerjangkaTotal + userTabunganQurbanTotal;

  const unreadNotifikasiCount =
    unreadCount || notifikasi.filter(n => n.user_id === currentUser.id && !n.dibaca_pada).length;

  // ─── Profil & Password ────────────────────────────────────
  const updateProfile = (data: ProfileInput) => {
    const form = new FormData();
    if (data.name !== undefined) form.append('name', data.name);
    if (data.phone !== undefined) form.append('phone', data.phone);
    if (data.address !== undefined && data.address !== '') form.append('address', data.address);
    if (data.avatar instanceof File) form.append('avatar', data.avatar);

    api
      .putForm<User>('/auth/me', form)
      .then(async (res) => {
        const u = normUser(res.data);
        setCurrentUser(u);
        setStoredUser(u);
        showToast('Profil berhasil diperbarui.');
      })
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memperbarui profil.', 'error'));
  };

  const changePassword = (oldPass: string, newPass: string): boolean => {
    api
      .post<{ token: string }>('/auth/change-password', {
        current_password: oldPass,
        password: newPass,
        password_confirmation: newPass
      })
      .then(res => {
        if (res.data?.token) setToken(res.data.token);
        showToast('Password berhasil diubah. Sesi lain telah dikeluarkan.');
      })
      .catch((e: { message?: string; errors?: Record<string, string[]> }) => {
        const firstErr = e.errors ? Object.values(e.errors)[0]?.[0] : undefined;
        showToast(firstErr || e?.message || 'Gagal mengubah password.', 'error');
      });
    return true;
  };

  // ─── Admin: User Management ───────────────────────────────
  const withRefresh = (fn: () => Promise<unknown>, okMsg: string) =>
    runAndRefresh(fn, okMsg);

  // ─── Admin: Profil Nasabah ────────────────────────────────
  const fetchProfilNasabah = (userId: number) => {
    setProfilNasabah(null);
    setProfilNasabahError(null);
    api
      .get<ProfilNasabah>(`/admin/users/${userId}/produk`)
      .then((res) => {
        const d = res.data;
        setProfilNasabah({
          ...d,
          user: normUser(d.user),
          transaksi: (d.transaksi || []).map(normTransaksi)
        });
      })
      .catch((e: { message?: string }) => {
        setProfilNasabahError(e?.message || 'Gagal memuat profil nasabah.');
        showToast(e?.message || 'Gagal memuat profil nasabah.', 'error');
      });
  };

  const clearProfilNasabah = () => {
    setProfilNasabah(null);
    setProfilNasabahError(null);
  };

  // ─── Admin: Pembayaran Harian ──────────────────────────────
  const fetchPembayaranHarian = (tanggal?: string) => {
    setLoading(true);
    api
      .get<PembayaranHarianResponse>(`/admin/pembayaran-harian${tanggal ? `?tanggal=${tanggal}` : ''}`)
      .then((res) => setPembayaranHarian(res.data))
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memuat pembayaran harian.', 'error'))
      .finally(() => setLoading(false));
  };

  const clearPembayaranHarian = () => setPembayaranHarian(null);

  const fetchTunggakanSetoran = () => {
    setLoading(true);
    api
      .get<TunggakanSetoranResponse>('/admin/pembayaran-harian/tunggakan')
      .then((res) => setTunggakanSetoran(res.data))
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memuat tunggakan setoran.', 'error'))
      .finally(() => setLoading(false));
  };

  const clearTunggakanSetoran = () => setTunggakanSetoran(null);

  const fetchMonitoringNasabah = () => {
    api
      .get<MonitoringNasabah[]>('/admin/monitoring-tabungan?per_page=1000')
      .then((res) => setMonitoringNasabah(res.data))
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memuat monitoring tabungan.', 'error'));
  };

  const clearMonitoringNasabah = () => setMonitoringNasabah(null);

  const suspendUser = (userId: number) =>
    withRefresh(() => api.post(`/admin/users/${userId}/suspend`), 'Akun berhasil dibekukan.');
  const activateUser = (userId: number) =>
    withRefresh(() => api.post(`/admin/users/${userId}/activate`), 'Akun berhasil diaktifkan kembali.');
  const createUser = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/users', data), 'Pengguna berhasil ditambahkan.');
  const updateUser = (userId: number, data: Record<string, unknown>) =>
    withRefresh(() => api.put(`/admin/users/${userId}`, data), 'Data pengguna berhasil diperbarui.');
  const deleteUser = (userId: number) =>
    withRefresh(() => api.del(`/admin/users/${userId}`), 'Pengguna berhasil dihapus.');
  const importUsers = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .postForm<any>('/admin/users/import', form)
      .then((res) => {
        const detail: string[] = (res?.data?.detail_dilewati || []) as string[];
        const t = res?.data?.tabungan as Record<string, number> | undefined;
        let msg = res?.message || 'File import sedang diproses.';
        if (t) {
          const parts: string[] = [];
          if (t.target_diatur) parts.push(`${t.target_diatur} target set`);
          if (t.saldo_awal_dicatat) parts.push(`${t.saldo_awal_dicatat} saldo awal dicatat`);
          if (t.saldo_awal_diubah) parts.push(`${t.saldo_awal_diubah} saldo diperbarui`);
          if (t.saldo_awal_dihapus) parts.push(`${t.saldo_awal_dihapus} saldo dihapus`);
          if (parts.length) msg += ' · Tabungan: ' + parts.join(', ');
        }
        if (detail.length) {
          msg += ' ' + detail.slice(0, 5).join(' · ');
        }
        showToast(msg, detail.length ? 'error' : 'success');
      })
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengimpor file.', 'error');
        throw e;
      });
  };

  const importLaporanHarian = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .postForm<any>('/admin/users/import-laporan', form)
      .then((res) => {
        const userDibuat = res?.data?.user_dibuat ?? 0;
        const transaksiDibuat = res?.data?.transaksi_dibuat ?? 0;
        const detail: string[] = (res?.data?.detail_dilewati || []) as string[];
        let msg = res?.message || `Import selesai: ${userDibuat} user baru, ${transaksiDibuat} transaksi dicatat.`;
        if (detail.length) msg += ' · ' + detail.slice(0, 3).join(' · ');
        showToast(msg, 'success');
        return refresh(currentUser);
      })
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengimpor laporan harian.', 'error');
        throw e;
      });
  };

  const downloadUserTemplate = () =>
    downloadFile('/admin/users/import/template', 'template_import_nasabah.xlsx')
      .then(() => showToast('Template import berhasil diunduh!'))
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengunduh template.', 'error');
        throw e;
      });

  const exportUsers = () =>
    downloadFile(`/admin/users/export`, `data_nasabah_berkah_mulia_${new Date().toISOString().slice(0, 10)}.xlsx`)
      .then(() => showToast('Data nasabah berhasil diexport!'))
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengexport data.', 'error');
        throw e;
      });

  const exportTransaksi = (filters: TransaksiFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.tanggal_awal) params.set('tanggal_awal', filters.tanggal_awal);
    if (filters.tanggal_akhir) params.set('tanggal_akhir', filters.tanggal_akhir);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.metode && filters.metode !== 'all') params.set('metode', filters.metode);
    if (filters.tipe && filters.tipe !== 'all') params.set('tipe', filters.tipe);

    const qs = params.toString();
    return downloadFile(`/admin/transaksi/export${qs ? `?${qs}` : ''}`, `pembukuan_transaksi_koperasi_berkah_mulia_${new Date().toISOString().slice(0, 10)}.xlsx`)
      .then(() => showToast('Data pembukuan transaksi berhasil diexport!'))
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengexport transaksi.', 'error');
        throw e;
      });
  };

  // ─── Admin: Jenis Tabungan ────────────────────────────────
  const createJenisTabungan = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/jenis-tabungan', data), 'Produk tabungan berhasil dibuat.');
  const updateJenisTabungan = (id: number, data: Record<string, unknown>) =>
    withRefresh(() => api.put(`/admin/jenis-tabungan/${id}`, data), 'Produk tabungan berhasil diperbarui.');

  const toggleStatusJenisTabungan = (id: number) => {
    const target = jenisTabungan.find((j) => j.id === id);
    if (!target) return;
    const next = !target.status_aktif;
    setJenisTabungan((prev) => prev.map((j) => (j.id === id ? { ...j, status_aktif: next } : j)));
    api
      .patch(`/admin/jenis-tabungan/${id}/toggle-status`)
      .then(async () => {
        await refresh();
        showToast('Status keaktifan produk berhasil diubah.');
      })
      .catch((e: { message?: string }) => {
        setJenisTabungan((prev) => prev.map((j) => (j.id === id ? { ...j, status_aktif: !next } : j)));
        showToast(e?.message || 'Gagal mengubah status keaktifan produk.', 'error');
      });
  };

  // ─── Admin: Harga Emas ────────────────────────────────────
  const inputHargaEmas = (data: HargaEmasInput) => {
    hargaTerkiniAtRef.current = 0; // force harga terkini to refresh now
    withRefresh(() => api.post('/admin/emas/harga', data), 'Harga emas baru berhasil disimpan.');
  };

  const syncHargaEmas = () => {
    hargaTerkiniAtRef.current = 0;
    return withRefresh(() => api.postLong('/admin/emas/harga/sync'), 'Harga emas berhasil disinkronkan dari Logam Mulia.');
  };

  const deleteHargaEmas = (id: number): ActionResult => {
    hargaTerkiniAtRef.current = 0;
    withRefresh(() => api.del(`/admin/emas/harga/${id}`), 'Riwayat harga emas berhasil dihapus.');
    return { success: true, message: 'Riwayat harga emas berhasil dihapus.' };
  };

  // Ambil ulang harga terkini + riwayat tanpa reload penuh (dipakai tombol refresh di dashboard)
  const refreshHargaEmas = async () => {
    const isAdmin = currentUser.role === 'admin';
    const p = isAdmin ? '/admin/emas/' : '/emas/';
    const [terkini, riwayat] = await Promise.all([
      api.get<HargaEmasHarian>(p + 'harga-terkini').catch(() => null),
      api.get<HargaEmasHarian[]>(p + 'harga-riwayat?per_page=500').catch(() => null),
    ]);
    if (terkini) {
      setHargaTerkini(terkini.data);
      hargaTerkiniAtRef.current = Date.now();
    }
    if (riwayat) setHargaEmas(riwayat.data);
    if (!terkini && !riwayat) throw new Error('Gagal memperbarui harga emas.');
  };

  // ─── Admin: Qurban ────────────────────────────────────────
  const createPeriodeQurban = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/qurban/periode', data), 'Periode qurban berhasil dibuat.');
  const updatePeriodeQurban = (id: number, data: Partial<PeriodeQurban>) =>
    withRefresh(() => api.put(`/admin/qurban/periode/${id}`, data), 'Periode qurban berhasil diperbarui.');
  const createHewanQurban = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/qurban/hewan', data), 'Hewan qurban berhasil ditambahkan.');
  const updateHewanQurban = (id: number, data: Record<string, unknown>) =>
    withRefresh(() => api.put(`/admin/qurban/hewan/${id}`, data), 'Data hewan qurban berhasil diperbarui.');

  const deleteHewanQurban = (id: number): ActionResult => {
    withRefresh(() => api.del(`/admin/qurban/hewan/${id}`), 'Data hewan qurban berhasil dihapus.');
    return { success: true, message: 'Data hewan qurban berhasil dihapus.' };
  };

  const daftarTabunganQurban = (data: DaftarQurbanPayload) => {
    withRefresh(
      () => api.post('/qurban/daftar', {
        hewan_qurban_id: data.hewan_qurban_id,
        jumlah_hewan: data.jumlah_hewan,
        frekuensi_setor: data.frekuensi_setor,
        nominal_per_periode: data.nominal_per_periode,
        catatan: data.catatan
      }),
      'Pendaftaran qurban berhasil. Mulai menyicil setoran tabungan.'
    );
  };

  const daftarQurbanAdmin = (userId: number, data: DaftarQurbanPayload) => {
    runAndRefresh(
      () => api.post('/admin/qurban/pendaftaran', {
        user_id: userId,
        hewan_qurban_id: data.hewan_qurban_id,
        jumlah_hewan: data.jumlah_hewan,
        frekuensi_setor: data.frekuensi_setor,
        nominal_per_periode: data.nominal_per_periode,
        catatan: data.catatan
      }),
      'Pendaftaran qurban untuk nasabah berhasil dibuat.'
    );
  };

  const lunasPendaftaranQurban = (id: number) =>
    withRefresh(() => api.post(`/admin/qurban/${id}/lunas`), 'Pendaftaran qurban berhasil dinyatakan lunas.');

      const lunasQurban = (id: number) =>
        withRefresh(() => api.post(`/qurban/${id}/lunas`), 'Pengajuan pelunasan berhasil dikirim. Menunggu verifikasi admin.');

      const deletePendaftaranQurban = (id: number) =>
        withRefresh(() => api.del(`/admin/qurban/pendaftaran/${id}`), 'Pendaftaran qurban berhasil dihapus.');


  // ─── Transaksi (User) ─────────────────────────────────────
  const createSetoranUser = (data: SetoranPayload) => {
    const tipe = data.tipe_tabungan;
    if (!tipe) {
      showToast('Tipe tabungan tidak valid.', 'error');
      return;
    }
    if (data.nominal < 10000) {
      showToast('Minimal setoran adalah Rp 10.000.', 'error');
      return;
    }

    const form = new FormData();
    form.append('nominal', String(data.nominal));
    form.append('metode_pembayaran', 'transfer');
    if (!data.rekening_bank_id) {
      showToast('Pilih rekening bank tujuan transfer.', 'error');
      return;
    }
    form.append('rekening_bank_id', String(data.rekening_bank_id));
    if (data.bukti_transfer_file) form.append('bukti_transfer', data.bukti_transfer_file);
    if (data.catatan_user) form.append('catatan_user', data.catatan_user);
    if (data.konfigurasi_id) form.append('konfigurasi_id', String(data.konfigurasi_id));

    let url = '';
    if (tipe === 'emas') {
      url = '/emas/setor';
    } else if (tipe === 'pribadi') {
      if (!data.jenis_tabungan_id) {
        showToast('Pilih jenis tabungan pribadi terlebih dahulu.', 'error');
        return;
      }
      form.append('jenis_tabungan_id', String(data.jenis_tabungan_id));
      url = '/tabungan-pribadi/setor';
    } else {
      if (!data.pendaftaran_qurban_id) {
        showToast('Pilih target pendaftaran qurban.', 'error');
        return;
      }
      url = `/qurban/${data.pendaftaran_qurban_id}/setor`;
    }

    runAndRefresh(
      () => api.postForm(url, form),
      'Setoran berhasil diajukan. Transaksi Anda akan diverifikasi dalam 1 hari (24 jam).'
    );
  };

  const buatSetoranBerkala = (userId: number, data: SetoranBerkalaPayload) => {
    runAndRefresh(
      () => api.post('/admin/emas/setoran-berkala', { user_id: userId, ...data }),
      'Rencana setoran berkala emas berhasil dibuat untuk nasabah.'
    );
  };

  const batalkanSetoranBerkala = (id: number, data: PenarikanEmasPayload) => {
    runAndRefresh(
      () => api.post(`/emas/setoran-berkala/${id}/batalkan`, {
        bank_tujuan: data.bank_tujuan,
        no_rekening: data.no_rekening,
        atas_nama: data.atas_nama,
        catatan_user: data.catatan_user || ''
      }),
      'Rencana dibatalkan. Pengajuan refund (setelah potongan 10%) diajukan — menunggu verifikasi admin.'
    );
  };

  const setTargetHariRayaAdmin = (
    userId: number,
    target: number,
    data?: { frekuensi_setor?: FrekuensiSetoran; nominal_per_periode?: number }
  ) => {
    runAndRefresh(
      () => api.put('/admin/tabungan-hari-raya/target', {
        user_id: userId,
        target_nominal: target,
        frekuensi_setor: data?.frekuensi_setor,
        nominal_per_periode: data?.nominal_per_periode
      }),
      'Target tabungan hari raya untuk nasabah berhasil disimpan.'
    );
  };

  const cairkanTabunganAdmin = (userId: number, data: { jenis_tabungan_id: number; tabungan_berjangka_id?: number; konfigurasi_id?: number; nominal?: number; catatan_admin?: string }) => {
    runAndRefresh(
      () => api.post(`/admin/tabungan/${userId}/cairkan`, data),
      'Pencairan tabungan nasabah berhasil diproses (terverifikasi).'
    );
  };

  const buatTabunganBerjangkaAdmin = (userId: number, payload: TabunganBerjangkaPayload) => {
    runAndRefresh(
      () => api.post('/admin/tabungan-berjangka', { user_id: userId, ...payload }),
      'Tabungan berjangka untuk nasabah berhasil dibuat (aktif).'
    );
  };

  const cairkanHariRaya = () => {
    runAndRefresh(
      () => api.post('/tabungan-hari-raya/cairkan'),
      'Pencairan tabungan hari raya diajukan. Menunggu verifikasi admin.'
    );
  };

  const createPenarikanUser = (data: PenarikanPayload) => {
    if (data.nominal < 10000) {
      showToast('Minimal penarikan adalah Rp 10.000.', 'error');
      return;
    }
    if (data.nominal > userTabunganPribadiTotal) {
      showToast(`Saldo Anda tidak mencukupi (Tersedia: Rp ${formatRupiah(userTabunganPribadiTotal)}).`, 'error');
      return;
    }
    runAndRefresh(
      () => api.post('/tabungan-pribadi/tarik', { nominal: data.nominal, catatan_user: data.catatan_user }),
      'Permohonan penarikan diajukan. Menunggu verifikasi admin.'
    );
  };

  const createPenarikanEmas = (data: PenarikanEmasPayload) => {
    if (userEmasGramTotal <= 0) {
      showToast('Tidak ada saldo emas untuk dicairkan.', 'error');
      return;
    }
    runAndRefresh(
      () => api.post('/emas/tarik', {
        bank_tujuan: data.bank_tujuan,
        no_rekening: data.no_rekening,
        atas_nama: data.atas_nama,
        catatan_user: data.catatan_user || ''
      }),
      'Permohonan pencairan emas diajukan. Menunggu verifikasi admin.'
    );
  };

  const tukarEmas = () => {
    if (userEmasGramTotal <= 0) {
      showToast('Tidak ada saldo emas untuk ditukar.', 'error');
      return;
    }
    withRefresh(
      () => api.post('/emas/tukar'),
      'Penukaran emas berhasil. Silakan ambil emas Anda di toko.'
    );
  };

  // ─── Transaksi (Admin) ────────────────────────────────────
  const inputTransaksiCash = (data: CashTransaksiPayload) =>
    withRefresh(
      () => api.post('/admin/transaksi/cash', {
        user_id: data.user_id,
        jenis_tabungan_id: data.jenis_tabungan_id,
        nominal: data.nominal,
        pendaftaran_qurban_id: data.pendaftaran_qurban_id,
        tabungan_berjangka_id: data.tabungan_berjangka_id,
        konfigurasi_id: data.konfigurasi_id,
        catatan_admin: data.catatan_teller
      }),
      'Transaksi cash berhasil dibukukan dan otomatis terverifikasi.'
    );

  const verifikasiTransaksi = (id: number) =>
    withRefresh(() => api.post(`/admin/transaksi/${id}/verifikasi`), 'Transaksi berhasil diverifikasi.');

  const tolakTransaksi = (id: number, catatan: string) =>
    withRefresh(() => api.post(`/admin/transaksi/${id}/tolak`, { catatan_admin: catatan }), 'Transaksi berhasil ditolak.');

  const uploadBuktiTransaksi = (id: number, file: File) => {
    const form = new FormData();
    form.append('bukti_transfer', file);
    runAndRefresh(() => api.postForm(`/transaksi/${id}/upload-bukti`, form), 'Bukti transfer berhasil diupload.');
  };

  // ─── Admin: Rekening Bank ─────────────────────────────────
  const createRekeningBank = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/rekening-bank', data), 'Rekening bank berhasil ditambahkan.');
  const updateRekeningBank = (id: number, data: Record<string, unknown>) =>
    withRefresh(() => api.put(`/admin/rekening-bank/${id}`, data), 'Data rekening berhasil diperbarui.');
  const toggleStatusRekeningBank = (id: number) => {
    const target = rekeningBank.find((r) => r.id === id);
    if (!target) return;
    const next = !target.status_aktif;
    setRekeningBank((prev) => prev.map((r) => (r.id === id ? { ...r, status_aktif: next } : r)));
    api
      .patch(`/admin/rekening-bank/${id}/toggle-status`)
      .then(async () => {
        await refresh();
        showToast('Status keaktifan rekening berhasil diubah.');
      })
      .catch((e: { message?: string }) => {
        setRekeningBank((prev) => prev.map((r) => (r.id === id ? { ...r, status_aktif: !next } : r)));
        showToast(e?.message || 'Gagal mengubah status keaktifan rekening.', 'error');
      });
  };

  const deleteRekeningBank = (id: number): ActionResult => {
    const hasTransactions = transaksi.some(t => t.rekening_bank_id === id);
    if (hasTransactions) {
      return { success: false, message: 'Rekening ini tidak dapat dihapus karena sudah dipakai transaksi nasabah.' };
    }
    withRefresh(() => api.del(`/admin/rekening-bank/${id}`), 'Rekening bank berhasil dihapus.');
    return { success: true, message: 'Rekening bank berhasil dihapus.' };
  };

  // ─── Gadai (Admin) ────────────────────────────────────────
  const fetchGadaiDetail = (id: number) => {
    setLoading(true);
    api
      .get<Gadai>(currentUser.role === 'admin' ? `/admin/gadai/${id}` : `/gadai-saya/${id}`)
      .then((res) => setGadaiDetail(res.data))
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal memuat detail gadai.', 'error'))
      .finally(() => setLoading(false));
  };

  const clearGadaiDetail = () => setGadaiDetail(null);

  const createGadai = (data: GadaiPayload) =>
    withRefresh(() => api.post('/admin/gadai', data), 'Pengajuan gadai berhasil dibuat (status DIAJUKAN).');

  const approveGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/approve`), 'Pengajuan gadai disetujui & pembiayaan disalurkan.');

  const aktifkanGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/aktifkan`), 'Pembiayaan disalurkan. Jatuh tempo dihitung.');

  const bayarGadai = (id: number, data: GadaiBayarPayload) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/bayar`, data), 'Pembayaran angsuran gadai tercatat.');

  const lunasiGadai = (id: number, nominal?: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/lunasi`, nominal ? { nominal } : {}), 'Gadai LUNAS. Silakan ambil emas Anda kembali.');

  const kembalikanEmasGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/kembalikan-emas`), 'Emas dikembalikan kepada peserta.');

  const batalGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/batal`), 'Gadai dibatalkan (potongan 10%). Emas dikembalikan.');

  const tandaiTerlambatGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/terlambat`), 'Gadai ditandai TERLAMBAT.');

  const perpanjangGadai = (id: number) =>
    withRefresh(() => api.post(`/admin/gadai/${id}/perpanjang`), 'Tenor gadai diperpanjang satu periode.');

  const deleteGadai = (id: number) =>
    withRefresh(() => api.del(`/admin/gadai/${id}`), 'Rekaman gadai dihapus.');

  const bayarGadaiUser = (gadaiId: number, formData: FormData) =>
    withRefresh(
      () => api.post(`/gadai-saya/${gadaiId}/bayar`, formData),
      'Pembayaran angsuran berhasil dikirim. Tunggu verifikasi admin.'
    );

  const verifikasiAngsuranGadai = (angsuranId: number) =>
    withRefresh(() => api.post(`/admin/gadai/angsuran/${angsuranId}/verifikasi`), 'Angsuran berhasil diverifikasi.');

  const tolakAngsuranGadai = (angsuranId: number, catatan: string) =>
    withRefresh(() => api.post(`/admin/gadai/angsuran/${angsuranId}/tolak`, { catatan_admin: catatan }), 'Angsuran ditolak.');

  // ─── Tabungan Berjangka ────────────────────────────────────
  const fetchTabunganBerjangka = () => {
    const url = currentUser.role === 'admin' ? '/admin/tabungan-berjangka?per_page=100' : '/tabungan-berjangka';
    api.get<TabunganBerjangkaResponse>(url)
      .then((res) => setTabunganBerjangka(res.data))
      .catch(() => undefined);
  };

  const setorTabunganBerjangka = (id: number, data: SetorTabunganBerjangkaPayload) => {
    const form = new FormData();
    form.append('nominal', String(data.nominal));
    form.append('rekening_bank_id', String(data.rekening_bank_id));
    form.append('bukti_transfer', data.bukti_transfer);
    if (data.catatan_user) form.append('catatan_user', data.catatan_user);

    runAndRefresh(
      () => api.postForm(`/tabungan-berjangka/${id}/setor`, form),
      'Setoran tabungan berjangka berhasil diajukan. Menunggu verifikasi admin.'
    );
  };

  const cairkanTabunganBerjangka = (id: number, data: CairkanTabunganBerjangkaPayload) => {
    runAndRefresh(
      () => api.post(`/tabungan-berjangka/${id}/cairkan`, data),
      'Pengajuan pencairan tabungan berjangka berhasil dikirim! Menunggu transfer & verifikasi admin.'
    );
  };

  const batalTabunganBerjangka = (id: number) =>
    withRefresh(() => api.post(`/tabungan-berjangka/${id}/batal`), 'Tabungan berjangka dibatalkan.');

  const approveTabunganBerjangka = (id: number) =>
    withRefresh(() => api.post(`/admin/tabungan-berjangka/${id}/approve`), 'Tabungan berjangka disetujui dan aktif.');

  const tolakTabunganBerjangka = (id: number) =>
    withRefresh(() => api.post(`/admin/tabungan-berjangka/${id}/tolak`), 'Tabungan berjangka ditolak.');

  const verifikasiPembatalanBerjangka = (id: number) =>
    withRefresh(() => api.post(`/admin/tabungan-berjangka/${id}/verifikasi-pembatalan`), 'Pembatalan diverifikasi. Dana dikembalikan utuh ke nasabah.');

  // ─── Notifikasi ───────────────────────────────────────────
  const markNotifikasiRead = (id: number) => {
    setNotifikasi(prev => prev.map(n => (n.id === id ? { ...n, dibaca_pada: new Date().toISOString() } : n)));
    api.patch(`/notifikasi/${id}/read`).catch(() => undefined);
  };

  const markAllNotifikasiRead = () => {
    setNotifikasi(prev =>
      prev.map(n => (n.user_id === currentUser.id ? { ...n, dibaca_pada: new Date().toISOString() } : n))
    );
    setUnreadCount(0);
    api.patch('/notifikasi/read-all').catch(() => undefined);
    showToast('Semua notifikasi ditandai telah dibaca.');
  };

  const providerValue: AppContextType = {
    theme,
    toggleTheme,
    booted,
    loading,
    login,
    logout,
    currentUser,
    activeTab,
setActiveTab,
  userSubTab,
    setUserSubTab,
    adminQurbanTab,
    setAdminQurbanTab,
    users,
    jenisTabungan,
    hargaEmas,
    periodeQurban,
    hewanQurban,
    pendaftaranQurban,
    rekeningBank,
    transaksi,
    notifikasi,
    auditLogs,
    gadai,
    gadaiDetail,
    fetchGadaiDetail,
    clearGadaiDetail,
    createGadai,
    approveGadai,
    aktifkanGadai,
    bayarGadai,
    lunasiGadai,
    kembalikanEmasGadai,
    batalGadai,
    tandaiTerlambatGadai,
    perpanjangGadai,
    deleteGadai,
    setoranBerkala,
    profilNasabah,
    profilNasabahError,
    fetchProfilNasabah,
    clearProfilNasabah,
    pembayaranHarian,
    tunggakanSetoran,
    fetchPembayaranHarian,
    clearPembayaranHarian,
    fetchTunggakanSetoran,
    clearTunggakanSetoran,
    monitoringNasabah,
    fetchMonitoringNasabah,
    clearMonitoringNasabah,
    activeHargaEmas,
    userTransaksi,
    userPendaftaranQurban,
    userEmasGramTotal,
    userEmasTukarGramTotal,
    userEmasRupiahTotal,
    userEmasGoal,
    userTabunganPribadiTotal,
    userTabunganMandiriTotal,
    userTabunganBerjangkaTotal,
    userTabunganQurbanTotal,
    userTotalSaldo,
    unreadNotifikasiCount,
    updateProfile,
    changePassword,
    suspendUser,
    activateUser,
    createUser,
    updateUser,
    deleteUser,
    importUsers,
    importLaporanHarian,
    downloadUserTemplate,
    exportUsers,
    exportTransaksi,
    createJenisTabungan,
    updateJenisTabungan,
toggleStatusJenisTabungan,
    inputHargaEmas,
    syncHargaEmas,
    deleteHargaEmas,
    refreshHargaEmas,
    createPeriodeQurban,
    updatePeriodeQurban,
    createHewanQurban,
    updateHewanQurban,
    deleteHewanQurban,
    daftarTabunganQurban,
daftarQurbanAdmin,
  lunasPendaftaranQurban,
    lunasQurban,
    deletePendaftaranQurban,
    createSetoranUser,
    buatSetoranBerkala,
    hariRayaStatus,
    setTargetHariRayaAdmin,
    cairkanTabunganAdmin,
    buatTabunganBerjangkaAdmin,
    cairkanHariRaya,
    createPenarikanUser,
    createPenarikanEmas,
    tukarEmas,
    batalkanSetoranBerkala,
    inputTransaksiCash,
    verifikasiTransaksi,
    tolakTransaksi,
    uploadBuktiTransaksi,
    createRekeningBank,
    updateRekeningBank,
    toggleStatusRekeningBank,
    deleteRekeningBank,
    markNotifikasiRead,
    markAllNotifikasiRead,
    bayarGadaiUser,
    verifikasiAngsuranGadai,
    tolakAngsuranGadai,
    tabunganBerjangka,
    fetchTabunganBerjangka,
    setorTabunganBerjangka,
    cairkanTabunganBerjangka,
    batalTabunganBerjangka,
    approveTabunganBerjangka,
    tolakTabunganBerjangka,
    verifikasiPembatalanBerjangka,
    toastMessage,
    showToast
  };

  return (
    <AppContext.Provider value={providerValue}>
      {children}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[100] max-w-sm w-full sm:w-96 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-semibold ${
              toastMessage.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-800'
                : toastMessage.type === 'info'
                ? 'bg-slate-50/95 border-slate-200 text-slate-800'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                toastMessage.type === 'error' ? 'bg-rose-500' : toastMessage.type === 'info' ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs sm:text-sm leading-relaxed">{toastMessage.text}</span>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};