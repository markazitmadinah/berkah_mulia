// PRD Enums & Types for Koperasi Simpan Pinjam Syariah "Berkah Mulia"

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type TipeTabungan = 'emas' | 'pribadi' | 'qurban' | 'custom';
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
  jenis_tabungan_id: number;
  jenis_tabungan_nama?: string;
  tipe_tabungan?: TipeTabungan;
  pendaftaran_qurban_id?: number;
  jenis_transaksi: JenisTransaksi;
  nominal: number;
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

export interface UserSummaryProgress {
  total_saldo: number;
  total_emas_gram: number;
  nilai_emas_rupiah: number;
  total_tabungan_pribadi: number;
  total_tabungan_qurban: number;
  pending_transaksi_count: number;
  pending_nominal: number;
  transaksi_terverifikasi_count: number;
}
