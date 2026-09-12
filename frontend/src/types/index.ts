// PRD Enums & Types for Koperasi Simpan Pinjam Syariah "Berkah Mulia"

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type TipeTabungan = 'emas' | 'pribadi' | 'qurban';
export type SubJenisTabungan = 'mandiri' | 'hari_raya' | 'qurban' | 'berjangka';
export type FrekuensiSetoran = 'harian' | 'mingguan' | 'bulanan';
export type ModePerhitungan = 'nominal_bebas' | 'nominal_tetap' | 'konversi_unit';
export type AturanPencairan = 'otomatis' | 'manual_admin' | 'tanggal_tertentu';
export type JenisTransaksi = 'setor' | 'tarik';
export type MetodePembayaran = 'cash' | 'transfer';
export type StatusVerifikasi = 'menunggu_verifikasi' | 'terverifikasi' | 'ditolak';
export type StatusPeriodeQurban = 'draft' | 'aktif' | 'ditutup' | 'selesai';
export type StatusPendaftaranQurban = 'menabung' | 'target_tercapai' | 
'menunggu_verifikasi' | 'siap_dicairkan' | 'sudah_lunas' | 'sudah_dicairkan' | 'dibatalkan';
export type TipeNotifikasi = 'info' | 'verifikasi' | 'pengingat_setor' | 'pengingat_pencairan' | 'approval_akun';
export type ChannelNotifikasi = 'in_app' | 'email';
export type StatusGadai = 'diajukan' | 'disetujui' | 'aktif' | 'jatuh_tempo' | 'terlambat' | 'diperpanjang' | 'lunas' | 'batal';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  nomor_anggota?: string;
  target_emas_gram?: number | null;
  role: UserRole;
  status: UserStatus;
  address?: string;
  avatar_path?: string;
  email_verified_at?: string;
  approved_by?: number;
  approved_at?: string;
  rejected_reason?: string;
  last_login_at?: string;
  created_at: string;
  account_number?: string;
}

export interface JenisTabungan {
  id: number;
  kode: string;
  nama: string;
  deskripsi?: string;
  tipe: TipeTabungan;
  tipe_label?: string;
  sub_jenis?: SubJenisTabungan | null;
  sub_jenis_label?: string | null;
  deadline?: string | null;
  frekuensi_setoran?: FrekuensiSetoran | null;
  mode_perhitungan: ModePerhitungan;
  target_nominal?: number;
  target_unit?: number;
  unit_label?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  tanpa_batas_waktu: boolean;
  aturan_pencairan: AturanPencairan;
  tanggal_pencairan?: string;
  metode_pembayaran_diizinkan: MetodePembayaran[];
  allow_withdrawal: boolean;
  status_aktif: boolean;
  created_by?: number;
  config?: Record<string, any>;
}

export interface HargaEmasHarian {
  id: number;
  tanggal: string;
  harga_per_gram: number;
  tagihan_harian_default?: number;
  status_aktif: boolean;
  catatan?: string;
  created_by: number;
  created_at: string;
}

export interface PeriodeQurban {
  id: number;
  tahun: number;
  nama_periode: string;
  tanggal_buka_pendaftaran: string;
  tanggal_tutup_pendaftaran: string;
  tanggal_idul_adha: string;
  tanggal_pencairan: string;
  status: StatusPeriodeQurban;
  created_by: number;
}

export interface HewanQurban {
  id: number;
  jenis_hewan: string;
  deskripsi?: string;
  harga_per_unit: number;
  berat_rata_rata?: string;
  periode_qurban_id: number;
  status_aktif: boolean;
  created_by: number;
}

export interface PendaftaranQurban {
  id: number;
  user_id: number;
  user_name?: string;
  periode_qurban_id: number;
  hewan_qurban_id: number;
  jumlah_hewan: number;
  target_dana: number;
  total_terkumpul: number;
  status: StatusPendaftaranQurban;
  tanggal_daftar: string;
  tanggal_dicairkan?: string;
  dicairkan_oleh?: number;
  catatan?: string;
}

export interface RekeningBank {
  id: number;
  nama_bank: string;
  no_rekening: string;
  atas_nama: string;
  cabang?: string;
  status_aktif: boolean;
  created_by?: number;
  logo_color?: string;
}

export interface Transaksi {
  id: number;
  nomor_referensi: string;
  user_id: number;
  user_name?: string;
  jenis_tabungan_id?: number | null;
  jenis_tabungan_nama?: string;
  tipe_tabungan?: TipeTabungan | 'gadai';
  sub_jenis?: SubJenisTabungan;
  pendaftaran_qurban_id?: number;
  gadai_id?: number | null;
  nomor_gadai?: string;
  tabungan_berjangka_id?: number | null;
  jenis_transaksi: JenisTransaksi;
  nominal: number;
  nominal_emas?: number; // nilai gram yang dibeli (setoran rencana emas)
  nominal_dana?: number; // delta saldo dana Rupiah (signed)
  unit_didapat?: number; // gram emas
  harga_acuan_id?: number;
  harga_acuan_snapshot?: number;
  metode_pembayaran: MetodePembayaran;
  rekening_bank_id?: number;
  rekening_bank_nama?: string;
  bukti_transfer_path?: string;
  status_verifikasi: StatusVerifikasi;
  diverifikasi_oleh?: number;
  diverifikasi_oleh_name?: string;
  diverifikasi_pada?: string;
  catatan_admin?: string;
  catatan_user?: string;
  tanggal_transaksi: string;
  created_at: string;
}

export interface Notifikasi {
  id: number;
  user_id: number;
  judul: string;
  pesan: string;
  tipe: TipeNotifikasi;
  data?: Record<string, any>;
  channel: ChannelNotifikasi;
  dibaca_pada?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  model?: string;
  deskripsi?: string;
  model_type: string;
  model_id: number | string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface KonfigurasiSetoranEmas {
  id: number;
  user_id: number;
  jenis_tabungan_id: number;
  nominal_per_periode: number;
  target_gram_per_periode: number;
  target_gram_total?: number | null;
  frekuensi_setor: FrekuensiSetoran;
  frekuensi_setor_label?: string;
  jadwal_label?: string;
  tanggal_mulai?: string;
  durasi_periode?: number;
  tanggal_deadline?: string;
  status: 'aktif' | 'selesai' | 'batal';
  status_label?: string;
  created_at?: string;
}

export interface SetoranBerkalaProgress {
  konfigurasi_id: number;
  nominal_per_periode: number;
  durasi_periode: number | null;
  rekap: {
    jumlah_setoran: number;
    nominal_total_setor: number;
    gram_terkumpul: number;
    saldo_dana: number;
    saldo_dana_rencana: number;
  };
  konsistensi: {
    periode_seharusnya: number;
    periode_terlaksana: number;
    persentase: number;
    status: 'tepat_waktu' | 'tertinggal';
  };
  sisa_periode: number | null;
  estimasi_selesai: string | null;
  target_gram_total: number | null;
  capaian_gram: number | null;
}

export interface SetoranBerkalaResponse {
  dapat_membuat: boolean;
  status: string | null;
  items: Array<{
    konfigurasi: KonfigurasiSetoranEmas;
    progress: SetoranBerkalaProgress;
  }>;
}

export interface SetoranBerkalaPayload {
  nominal_per_periode: number;
  target_gram_total?: number; // target RENCANA ini sendiri (per-rencana, mis. "nabung lagi 5g")
  frekuensi_setor: FrekuensiSetoran;
  durasi_periode: number;
}

export interface HariRayaStatus {
  jenis_tabungan_id: number;
  nama: string;
  deadline: string | null;
  hari_raya: string | null;
  target: number;
  terkumpul: number;
  persentase: number | null;
  masa_pencairan: boolean;
}

export interface UserSummaryProgress {
  total_emas_gram: number;
  nilai_emas_rupiah: number;
  total_tabungan_pribadi: number;
  total_tabungan_qurban: number;
  pending_transaksi_count: number;
  pending_nominal: number;
  transaksi_terverifikasi_count: number;
}

export interface ProfilTabungan {
  progress: {
    jenis_tabungan_id: number;
    kode: string;
    nama: string;
    tipe: string;
    total_setoran: number;
    total_penarikan: number;
    saldo: number;
    pending_amount: number;
    total_unit: number | null;
    unit_label: string | null;
    saldo_dana: number;
    target: number | null;
    target_unit: number | null;
    persentase: number | null;
  };
  konfigurasi: KonfigurasiSetoranEmas[] | null;
  setoran_berkala: SetoranBerkalaProgress[] | null;
}

export interface ProfilQurban {
  id: number;
  hewan: string;
  tahun: number | null;
  jumlah_hewan: number;
  target_dana: number;
  total_terkumpul: number;
  persentase: number | null;
  status: string;
  status_label: string;
  tanggal_daftar: string;
}

export interface ProfilNasabah {
  user: User;
  produk: {
    tabungan: ProfilTabungan[];
    qurban: ProfilQurban[];
  };
  summary: {
    total_tabungan_aktif: number;
    total_saldo_tabungan: number;
    transaksi_pending: number;
  };
  transaksi: Transaksi[];
}

export interface PembayaranHarianItem {
  konfigurasi_id: number;
  user_id: number;
  nama: string;
  nomor_anggota?: string;
  jenis_tabungan_id: number;
  jenis_tabungan_nama?: string;
  frekuensi: string;
  frekuensi_label: string;
  jadwal_label?: string;
  nominal_per_periode: number;
  target_gram_per_periode: number;
  tanggal_mulai?: string;
  status_verifikasi: 'terverifikasi' | 'ditolak' | 'menunggu_verifikasi' | 'belum';
  transaksi_id?: number;
  nomor_referensi?: string;
  nominal?: number;
  metode_pembayaran?: string;
}

export interface PembayaranHarianResponse {
  tanggal: string;
  jadwal: PembayaranHarianItem[];
}

export interface AngsuranGadai {
  id: number;
  gadai_id: number;
  tanggal_bayar: string;
  nominal: number;
  metode_pembayaran?: MetodePembayaran;
  catatan?: string | null;
  status_verifikasi?: StatusVerifikasi;
  bukti_transfer_path?: string | null;
  catatan_admin?: string | null;
  pencatat?: string;
  created_at?: string;
}

export interface Gadai {
  id: number;
  nomor_gadai: string;
  user_id: number;
  user?: { id: number; name: string; phone?: string; nomor_anggota?: string } | null;
  jenis_emas: string;
  berat_gram: number;
  kadar: number;
  berat_bersih_gram: number;
  harga_acuan: number;
  nilai_taksiran: number;
  persen_gadai: number;
  besaran_gadai: number;
  tanggal_aju: string;
  tanggal_aktif?: string | null;
  tanggal_jatuh_tempo?: string | null;
  tenor_satuan: 'harian' | 'mingguan' | 'bulanan';
  toleransi_hari: number;
  frekuensi_bayar: FrekuensiSetoran;
  nominal_angkuran: number;
  total_dibayar: number;
  sisa_pokok: number;
  tanggal_lunas?: string | null;
  status: StatusGadai;
  status_label?: string;
  catatan?: string | null;
  angsuran?: AngsuranGadai[];
  created_at?: string;
}

export interface GadaiPayload {
  user_id: number;
  jenis_emas: string;
  berat_gram: number;
  kadar: number;
  harga_acuan: number;
  persen_gadai: number;
  tenor_satuan: 'harian' | 'mingguan' | 'bulanan';
  toleransi_hari: number;
  frekuensi_bayar: FrekuensiSetoran;
  nominal_angkuran: number;
  catatan?: string;
}

export interface AjukanGadaiPayload {
  jenis_emas: string;
  berat_gram: number;
  kadar: number;
  tenor_satuan: 'harian' | 'mingguan' | 'bulanan';
  frekuensi_bayar: FrekuensiSetoran;
  nominal_angkuran: number;
  catatan?: string;
}

export interface GadaiBayarPayload {
  nominal: number;
  tanggal_bayar?: string;
  metode_pembayaran: MetodePembayaran;
  catatan?: string;
}

export interface UserGadaiBayarPayload {
  nominal: number;
  metode_pembayaran: MetodePembayaran;
  bukti_transfer?: File | null;
  catatan?: string;
}

export type StatusTabunganBerjangka = 'menunggu_approval' | 'aktif' | 'selesai' | 'batal';

export interface TabunganBerjangka {
  id: number;
  user_id?: number;
  user?: { id: number; name: string; phone?: string; nomor_anggota?: string } | null;
  target_nominal: number;
  durasi_bulan: number;
  frekuensi_setor: FrekuensiSetoran;
  frekuensi_label?: string;
  nominal_per_periode: number;
  tanggal_mulai?: string | null;
  tanggal_jatuh_tempo?: string | null;
  status: StatusTabunganBerjangka;
  catatan?: string | null;
  terkumpul?: number;
  persentase?: number;
  is_jatuh_tempo?: boolean;
  is_goal_reached?: boolean;
  can_withdraw?: boolean;
  sisa_target?: number;
  created_at?: string;
}

export interface TabunganBerjangkaResponse {
  items: TabunganBerjangka[];
  dapat_membuat: boolean;
  slot_tersedia: number;
}

export interface TabunganBerjangkaPayload {
  target_nominal: number;
  durasi_bulan: number;
  frekuensi_setor: FrekuensiSetoran;
  catatan?: string;
}

export interface SetorTabunganBerjangkaPayload {
  nominal: number;
  rekening_bank_id: number;
  bukti_transfer: File;
  catatan_user?: string;
}

export interface CairkanTabunganBerjangkaPayload {
  bank_tujuan: string;
  no_rekening: string;
  atas_nama: string;
  catatan?: string;
}
