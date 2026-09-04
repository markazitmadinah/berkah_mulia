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
  AuditLog
} from '../types';
import { formatRupiah } from '../utils/format';

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
}

interface PenarikanPayload {
  jenis_tabungan_id?: number;
  nominal: number;
  catatan_user?: string;
}

interface PenarikanEmasPayload {
  bank_tujuan: string;
  no_rekening: string;
  atas_nama: string;
  catatan_user?: string;
}

interface DaftarQurbanPayload {
  periode_qurban_id?: number;
  hewan_qurban_id: number;
  jumlah_hewan: number;
  target_dana?: number;
  catatan?: string;
}

interface CashTransaksiPayload {
  user_id: number;
  jenis_tabungan_id: number;
  nominal: number;
  pendaftaran_qurban_id?: number;
  catatan_teller?: string;
}

interface HargaEmasInput {
  tanggal: string;
  harga_per_gram: number;
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminSubTab: string;
  setAdminSubTab: (tab: string) => void;
  userSubTab: string;
  setUserSubTab: (tab: string) => void;
  adminQurbanTab: string;
  setAdminQurbanTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

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

  activeHargaEmas: HargaEmasHarian;
  userTransaksi: Transaksi[];
  userPendaftaranQurban: PendaftaranQurban[];
  userEmasGramTotal: number;
  userEmasTukarGramTotal: number;
  userEmasRupiahTotal: number;
  userEmasGoal: number | null;
  userTabunganPribadiTotal: number;
  userTabunganQurbanTotal: number;
  userTotalSaldo: number;
  unreadNotifikasiCount: number;

  updateProfile: (data: ProfileInput) => void;
  changePassword: (oldPass: string, newPass: string) => boolean;

  approveUser: (userId: number) => void;
  rejectUser: (userId: number, reason: string) => void;
  suspendUser: (userId: number) => void;
  activateUser: (userId: number) => void;
  createUser: (userData: Record<string, unknown>) => void;
  updateUser: (userId: number, userData: Partial<User>) => void;
  deleteUser: (userId: number) => void;
  importUsers: (file: File) => Promise<void>;
  downloadUserTemplate: () => Promise<void>;
  exportUsers: () => Promise<void>;
  exportTransaksi: () => Promise<void>;

  createJenisTabungan: (data: Record<string, unknown>) => void;
  updateJenisTabungan: (id: number, data: Record<string, unknown>) => void;
  deleteJenisTabungan: (id: number) => ActionResult;
  toggleStatusJenisTabungan: (id: number) => void;

  inputHargaEmas: (data: HargaEmasInput) => void;
  syncHargaEmas: () => void;
  deleteHargaEmas: (id: number) => ActionResult;

  createPeriodeQurban: (data: Record<string, unknown>) => void;
  updatePeriodeQurban: (id: number, data: Partial<PeriodeQurban>) => void;
  createHewanQurban: (data: Record<string, unknown>) => void;
  updateHewanQurban: (id: number, data: Record<string, unknown>) => void;
  deleteHewanQurban: (id: number) => ActionResult;
  daftarTabunganQurban: (data: DaftarQurbanPayload) => void;
  cairkanPendaftaranQurban: (id: number) => void;
  lunasPendaftaranQurban: (id: number) => void;
  lunasQurban: (id: number) => void;
  deletePendaftaranQurban: (id: number) => void;

  createSetoranUser: (data: SetoranPayload) => void;
  updateEmasGoal: (target: number | null) => void;
  createPenarikanUser: (data: PenarikanPayload) => void;
  createPenarikanEmas: (data: PenarikanEmasPayload) => void;
  ajukanBatalEmas: (data: PenarikanEmasPayload) => void;
  tukarEmas: () => void;
  createSetorCustom: (jenisTabunganId: number, data: SetoranPayload) => void;
  createTarikCustom: (jenisTabunganId: number, data: PenarikanPayload) => void;
  updateCustomGoal: (jenisTabunganId: number, targetNominal: number | null) => Promise<void>;
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
  return {
    id: x.id,
    nomor_referensi: x.nomor_referensi || `TRX-${x.id}`,
    user_id: x.user_id,
    user_name: x.user?.name || x.user_name,
    jenis_tabungan_id: jt.id ?? x.jenis_tabungan_id,
    jenis_tabungan_nama: jt.nama || x.jenis_tabungan_nama,
    tipe_tabungan: jt.tipe || x.tipe_tabungan,
    pendaftaran_qurban_id: x.pendaftaran_qurban_id ?? undefined,
    jenis_transaksi: x.jenis_transaksi,
    nominal: Number(x.nominal),
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
    catatan: x.catatan || undefined
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
  const [adminSubTab, setAdminSubTab] = useState<string>('periode');
  const [userSubTab, setUserSubTab] = useState<string>('periode-aktif');
  const [adminQurbanTab, setAdminQurbanTab] = useState<string>('pendaftaran');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [users, setUsers] = useState<User[]>([]);
  const [jenisTabungan, setJenisTabungan] = useState<JenisTabungan[]>([]);
  const [hargaEmas, setHargaEmas] = useState<HargaEmasHarian[]>([]);
  const [hargaTerkini, setHargaTerkini] = useState<HargaEmasHarian | null>(null);
  const [periodeQurban, setPeriodeQurban] = useState<PeriodeQurban[]>([]);
  const [hewanQurban, setHewanQurban] = useState<HewanQurban[]>([]);
  const [pendaftaranQurban, setPendaftaranQurban] = useState<PendaftaranQurban[]>([]);
  const [rekeningBank, setRekeningBank] = useState<RekeningBank[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [toastMessage, setToastMessage] = useState<Toast | null>(null);

  const showToast = (text: string, type: ToastType = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ─── Data loading ─────────────────────────────────────────
  const POLL_MS = 25_000;
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
      const riwayat$ = api
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
      const trx$ = api
        .get<Transaksi[]>(isAdmin ? '/admin/transaksi?per_page=200' : '/transaksi-saya?per_page=200')
        .catch(() => null);
      const users$ = isAdmin ? api.get<User[]>('/admin/users?per_page=200').catch(() => null) : null;
      const audit$ = !light && isAdmin ? api.get<AuditLog[]>('/admin/audit-logs?per_page=100').catch(() => null) : null;
      const me$ = api.get<User>('/auth/me').catch(() => null);

      const [staticRes, notaRes, terkiniRes, riwayatRes, masterRes, pendaRes, trxRes, usersRes, auditRes, meRes] =
        await Promise.all([static$, nota$, terkini$, riwayat$, qurbanMaster$, penda$, trx$, users$, audit$, me$]);

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
      if (trxRes) {
        setTransaksi(trxRes.data.map(normTransaksi));
      } else if (!light) {
        throw new Error('Gagal memuat data.');
      }
      if (usersRes) setUsers(usersRes.data.map(normUser));
      if (auditRes) setAuditLogs(auditRes.data.map(normAudit));
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

  const runAndRefresh = (fn: () => Promise<unknown>, okMsg?: string) => {
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
  };

  // ─── Auth ─────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
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

  const userEmasRupiahTotal = userEmasGramTotal * activeHargaEmas.harga_per_gram;

  // Total gram emas yang sudah berhasil di-tukar (akumulasi riwayat tarik emas terverifikasi)
  // -- bertambah tiap user menyelesaikan goal & menukar emas di toko
  const userEmasTukarGramTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'emas' && t.jenis_transaksi === 'tarik')
    .reduce((acc, curr) => acc + Math.abs(curr.unit_didapat || 0), 0);

  const userEmasGoal = currentUser.target_emas_gram != null ? Number(currentUser.target_emas_gram) : null;

  const userTabunganPribadiTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'pribadi')
    .reduce((acc, curr) => curr.jenis_transaksi === 'setor' ? acc + curr.nominal : acc - curr.nominal, 0);

  const userTabunganQurbanTotal = verifiedUserTransaksi
    .filter(t => t.tipe_tabungan === 'qurban')
    .reduce((acc, curr) => curr.jenis_transaksi === 'setor' ? acc + curr.nominal : acc - curr.nominal, 0);

  const userTotalSaldo = userEmasRupiahTotal + userTabunganPribadiTotal;

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
      .catch((e: { message?: string }) => showToast(e?.message || 'Gagal mengubah password.', 'error'));
    return true;
  };

  // ─── Admin: User Management ───────────────────────────────
  const withRefresh = (fn: () => Promise<unknown>, okMsg: string) => {
    runAndRefresh(fn, okMsg);
  };

  const approveUser = (userId: number) =>
    withRefresh(() => api.post(`/admin/users/${userId}/approve`), 'Akun berhasil disetujui.');
  const rejectUser = (userId: number, reason: string) =>
    withRefresh(() => api.post(`/admin/users/${userId}/reject`, { rejected_reason: reason }), 'Akun berhasil ditolak.');
  const suspendUser = (userId: number) =>
    withRefresh(() => api.post(`/admin/users/${userId}/suspend`), 'Akun berhasil dibekukan.');
  const activateUser = (userId: number) =>
    withRefresh(() => api.post(`/admin/users/${userId}/activate`), 'Akun berhasil diaktifkan kembali.');
  const createUser = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/users', data), 'Pengguna berhasil ditambahkan.');
  const updateUser = (userId: number, data: Partial<User>) =>
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
        let msg = res?.message || 'File import sedang diproses.';
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

  const exportTransaksi = () =>
    downloadFile(`/admin/transaksi/export`, `transaksi_koperasi_berkah_mulia_${new Date().toISOString().slice(0, 10)}.xlsx`)
      .then(() => showToast('Data transaksi berhasil diexport!'))
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal mengexport transaksi.', 'error');
        throw e;
      });

  // ─── Admin: Jenis Tabungan ────────────────────────────────
  const createJenisTabungan = (data: Record<string, unknown>) =>
    withRefresh(() => api.post('/admin/jenis-tabungan', data), 'Produk tabungan berhasil dibuat.');
  const updateJenisTabungan = (id: number, data: Record<string, unknown>) =>
    withRefresh(() => api.put(`/admin/jenis-tabungan/${id}`, data), 'Produk tabungan berhasil diperbarui.');

  const deleteJenisTabungan = (id: number): ActionResult => {
    const hasTransactions = transaksi.some(t => t.jenis_tabungan_id === id);
    if (hasTransactions) {
      return { success: false, message: 'Tidak dapat menghapus produk ini karena sudah terdapat transaksi nasabah (409 CONFLICT).' };
    }
    withRefresh(() => api.del(`/admin/jenis-tabungan/${id}`), 'Produk tabungan berhasil dihapus.');
    return { success: true, message: 'Produk tabungan berhasil dihapus.' };
  };

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
    withRefresh(() => api.post('/admin/emas/harga/sync'), 'Harga emas berhasil disinkronkan dari Logam Mulia.');
  };

  const deleteHargaEmas = (id: number): ActionResult => {
    hargaTerkiniAtRef.current = 0;
    withRefresh(() => api.del(`/admin/emas/harga/${id}`), 'Riwayat harga emas berhasil dihapus.');
    return { success: true, message: 'Riwayat harga emas berhasil dihapus.' };
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
      () => api.post('/qurban/daftar', { hewan_qurban_id: data.hewan_qurban_id, jumlah_hewan: data.jumlah_hewan }),
      'Pendaftaran qurban berhasil. Mulai menyicil setoran tabungan.'
    );
  };

      const cairkanPendaftaranQurban = (id: number) =>
        withRefresh(() => api.post(`/admin/qurban/${id}/cairkan`), 'Pendaftaran qurban berhasil dicairkan.');

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

    let url = '';
    if (tipe === 'emas') {
      url = '/emas/setor';
    } else if (tipe === 'pribadi') {
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

  const updateEmasGoal = (target: number | null) => {
    api.put('/emas/goal', { target_emas_gram: target })
      .then(async () => {
        setCurrentUser(prev => ({ ...prev, target_emas_gram: target }));
        showToast(target != null ? 'Target tabungan emas berhasil disimpan.' : 'Target tabungan emas dihapus.');
        await refresh();
      })
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Terjadi kesalahan. Coba lagi.', 'error');
      });
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

  const createSetorCustom = (jenisTabunganId: number, data: SetoranPayload) => {
    if (data.nominal <= 0) {
      showToast('Nominal setoran harus lebih dari 0.', 'error');
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

    runAndRefresh(
      () => api.postForm(`/tabungan-custom/${jenisTabunganId}/setor`, form),
      'Setoran berhasil diajukan. Menunggu verifikasi admin.'
    );
  };

  const createTarikCustom = (jenisTabunganId: number, data: PenarikanPayload) => {
    if (data.nominal <= 0) {
      showToast('Nominal penarikan harus lebih dari 0.', 'error');
      return;
    }
    runAndRefresh(
      () => api.post(`/tabungan-custom/${jenisTabunganId}/tarik`, { nominal: data.nominal, catatan_user: data.catatan_user }),
      'Permohonan penarikan diajukan. Menunggu verifikasi admin.'
    );
  };

  const updateCustomGoal = (jenisTabunganId: number, targetNominal: number | null) =>
    api.patch(`/tabungan-custom/${jenisTabunganId}/target`, { target_nominal: targetNominal })
      .then(() => showToast(targetNominal != null ? 'Target berhasil disimpan.' : 'Target berhasil dihapus.'))
      .catch((e: { message?: string }) => {
        showToast(e?.message || 'Gagal menyimpan target.', 'error');
      });

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

  const ajukanBatalEmas = (data: PenarikanEmasPayload) => {
    if (userEmasGramTotal <= 0) {
      showToast('Tidak ada saldo emas untuk dibatalkan.', 'error');
      return;
    }
    runAndRefresh(
      () => api.post('/emas/batal', {
        bank_tujuan: data.bank_tujuan,
        no_rekening: data.no_rekening,
        atas_nama: data.atas_nama,
        catatan_user: data.catatan_user || ''
      }),
      'Permohonan pembatalan & refund diajukan. Menunggu verifikasi admin.'
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
    adminSubTab,
    setAdminSubTab,
    userSubTab,
    setUserSubTab,
    adminQurbanTab,
    setAdminQurbanTab,
    searchQuery,
    setSearchQuery,
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
    activeHargaEmas,
    userTransaksi,
    userPendaftaranQurban,
    userEmasGramTotal,
    userEmasTukarGramTotal,
    userEmasRupiahTotal,    userEmasGoal,
    userTabunganPribadiTotal,
    userTabunganQurbanTotal,
    userTotalSaldo,
    unreadNotifikasiCount,
    updateProfile,
    changePassword,
    approveUser,
    rejectUser,
    suspendUser,
    activateUser,
    createUser,
    updateUser,
    deleteUser,
    importUsers,
    downloadUserTemplate,
    exportUsers,
    exportTransaksi,
    createJenisTabungan,
    updateJenisTabungan,
    deleteJenisTabungan,
    toggleStatusJenisTabungan,
    inputHargaEmas,
    syncHargaEmas,
    deleteHargaEmas,
    createPeriodeQurban,
    updatePeriodeQurban,
    createHewanQurban,
    updateHewanQurban,
    deleteHewanQurban,
    daftarTabunganQurban,
    cairkanPendaftaranQurban,
    lunasPendaftaranQurban,
    lunasQurban,
    deletePendaftaranQurban,
    createSetoranUser,
    updateEmasGoal,
    createPenarikanUser,
    createPenarikanEmas,
    ajukanBatalEmas,
    tukarEmas,
    createSetorCustom,
    createTarikCustom,
    updateCustomGoal,
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