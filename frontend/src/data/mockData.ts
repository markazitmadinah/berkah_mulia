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

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    name: 'Admin Utama (Pengurus)',
    email: 'admin@berkahmulia.syariah.id',
    phone: '081234567890',
    role: 'admin',
    status: 'active',
    address: 'Jl. Pemuda No. 45, Kebayoran Baru, Jakarta Selatan',
    avatar_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email_verified_at: '2025-01-01 08:00:00',
    account_number: 'BM-ADM-001',
    created_at: '2025-01-01 08:00:00'
  },
  {
    id: 2,
    name: 'Ahmad Fathan',
    email: 'ahmad.fathan@gmail.com',
    phone: '081298765432',
    role: 'user',
    status: 'active',
    address: 'Komplek Permata Hijau Blok C3 No. 12, Jakarta',
    avatar_path: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    email_verified_at: '2025-01-10 09:30:00',
    approved_by: 1,
    approved_at: '2025-01-10 10:00:00',
    account_number: 'BM-8294-0192',
    created_at: '2025-01-10 09:30:00'
  },
  {
    id: 3,
    name: 'Siti Rahmawati',
    email: 'siti.rahmawati@gmail.com',
    phone: '085712349876',
    role: 'user',
    status: 'active',
    address: 'Jl. Melati No. 8, Bandung',
    avatar_path: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    email_verified_at: '2025-01-15 11:20:00',
    approved_by: 1,
    approved_at: '2025-01-15 13:00:00',
    account_number: 'BM-5104-9921',
    created_at: '2025-01-15 11:20:00'
  },
  {
    id: 4,
    name: 'Budi Santoso',
    email: 'budi.santoso@yahoo.com',
    phone: '081387654321',
    role: 'user',
    status: 'pending',
    address: 'Jl. Pahlawan No. 22, Surabaya',
    avatar_path: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    account_number: 'BM-Pending-004',
    created_at: '2025-02-28 14:15:00'
  },
  {
    id: 5,
    name: 'Dian Permana',
    email: 'dian.permana@outlook.com',
    phone: '087812903456',
    role: 'user',
    status: 'suspended',
    address: 'Jl. Anggrek No. 15, Yogyakarta',
    avatar_path: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    email_verified_at: '2025-01-18 10:00:00',
    approved_by: 1,
    approved_at: '2025-01-18 12:00:00',
    account_number: 'BM-3321-7712',
    created_at: '2025-01-18 10:00:00'
  },
  {
    id: 6,
    name: 'Nurul Hidayah',
    email: 'nurul.hidayah@gmail.com',
    phone: '082199887766',
    role: 'user',
    status: 'pending',
    address: 'Jl. Teratai No. 4, Semarang',
    avatar_path: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    account_number: 'BM-Pending-006',
    created_at: '2025-03-01 08:45:00'
  }
];

export const INITIAL_JENIS_TABUNGAN: JenisTabungan[] = [
  {
    id: 1,
    kode: 'emas-harian',
    nama: 'Tabungan Emas Syariah',
    deskripsi: 'Setor rupiah berapapun (min Rp 10.000), langsung dikonversi otomatis ke gram fisik emas Antam 99.99% berdasarkan harga acuan harian.',
    tipe: 'emas',
    mode_perhitungan: 'konversi_unit',
    unit_label: 'gram',
    target_unit: 100,
    tanpa_batas_waktu: true,
    aturan_pencairan: 'manual_admin',
    metode_pembayaran_diizinkan: ['cash', 'transfer'],
    allow_withdrawal: true,
    status_aktif: true,
    created_by: 1
  },
  {
    id: 2,
    kode: 'tabungan-pribadi',
    nama: 'Tabungan Pribadi Berkah',
    deskripsi: 'Simpanan sukarela syariah bebas biaya admin bulanan. Setor dan tarik kapan saja untuk kebutuhan darurat maupun rencana masa depan.',
    tipe: 'pribadi',
    mode_perhitungan: 'nominal_bebas',
    target_nominal: 50000000,
    tanpa_batas_waktu: true,
    aturan_pencairan: 'manual_admin',
    metode_pembayaran_diizinkan: ['cash', 'transfer'],
    allow_withdrawal: true,
    status_aktif: true,
    created_by: 1
  },
  {
    id: 3,
    kode: 'qurban-1446h',
    nama: 'Tabungan Qurban 1446 H',
    deskripsi: 'Tabungan terencana menuju Idul Adha 1446 H. Setor bertahap tanpa penarikan sampai target pembelian hewan qurban terpenuhi.',
    tipe: 'qurban',
    mode_perhitungan: 'nominal_tetap',
    unit_label: 'ekor',
    tanpa_batas_waktu: false,
    tanggal_mulai: '2025-01-01',
    tanggal_selesai: '2025-05-30',
    aturan_pencairan: 'tanggal_tertentu',
    tanggal_pencairan: '2025-05-25',
    metode_pembayaran_diizinkan: ['cash', 'transfer'],
    allow_withdrawal: false,
    status_aktif: true,
    created_by: 1
  }
];

export const INITIAL_HARGA_EMAS: HargaEmasHarian[] = [
  {
    id: 1,
    tanggal: '2025-02-25',
    harga_per_gram: 1180000,
    tagihan_harian_default: 50000,
    status_aktif: false,
    catatan: 'Harga pembukaan pasar awal pekan',
    created_by: 1,
    created_at: '2025-02-25 08:00:00'
  },
  {
    id: 2,
    tanggal: '2025-02-26',
    harga_per_gram: 1190000,
    tagihan_harian_default: 50000,
    status_aktif: false,
    catatan: 'Kenaikan indeks spot global',
    created_by: 1,
    created_at: '2025-02-26 08:00:00'
  },
  {
    id: 3,
    tanggal: '2025-02-27',
    harga_per_gram: 1195000,
    tagihan_harian_default: 50000,
    status_aktif: false,
    catatan: 'Harga stabil menjelang akhir bulan',
    created_by: 1,
    created_at: '2025-02-27 08:00:00'
  },
  {
    id: 4,
    tanggal: '2025-02-28',
    harga_per_gram: 1200000,
    tagihan_harian_default: 50000,
    status_aktif: true,
    catatan: 'Harga resmi per gram Antam LM Hari Ini (Beli Rp 1.200.000 / Jual Rp 1.180.000)',
    created_by: 1,
    created_at: '2025-02-28 08:00:00'
  }
];

export const INITIAL_PERIODE_QURBAN: PeriodeQurban[] = [
  {
    id: 1,
    tahun: 2025,
    nama_periode: 'Qurban Idul Adha 1446 H (2025)',
    tanggal_buka_pendaftaran: '2025-01-01',
    tanggal_tutup_pendaftaran: '2025-05-15',
    tanggal_idul_adha: '2025-06-06',
    tanggal_pencairan: '2025-05-23',
    status: 'aktif',
    created_by: 1
  },
  {
    id: 2,
    tahun: 2024,
    nama_periode: 'Qurban Idul Adha 1445 H (2024)',
    tanggal_buka_pendaftaran: '2024-01-01',
    tanggal_tutup_pendaftaran: '2024-05-20',
    tanggal_idul_adha: '2024-06-17',
    tanggal_pencairan: '2024-06-01',
    status: 'selesai',
    created_by: 1
  }
];

export const INITIAL_HEWAN_QURBAN: HewanQurban[] = [
  {
    id: 1,
    jenis_hewan: 'Kambing / Domba Standar (Tipe A)',
    deskripsi: 'Bobot 27-30 kg, sehat sesuai syariat, sertifikat veteriner',
    harga_per_unit: 3500000,
    berat_rata_rata: '28 kg',
    periode_qurban_id: 1,
    status_aktif: true,
    created_by: 1
  },
  {
    id: 2,
    jenis_hewan: 'Kambing / Domba Premium (Tipe Super)',
    deskripsi: 'Bobot 35-40 kg, gemuk, sehat, bertanduk bagus',
    harga_per_unit: 4800000,
    berat_rata_rata: '38 kg',
    periode_qurban_id: 1,
    status_aktif: true,
    created_by: 1
  },
  {
    id: 3,
    jenis_hewan: 'Patungan Sapi 1/7 (Sapi Limosin/Simental)',
    deskripsi: 'Satu bagian dari tujuh orang untuk sapi bobot >350 kg',
    harga_per_unit: 3800000,
    berat_rata_rata: '360 kg (Total)',
    periode_qurban_id: 1,
    status_aktif: true,
    created_by: 1
  },
  {
    id: 4,
    jenis_hewan: 'Sapi Utuh (Tipe Madura/Bali)',
    deskripsi: 'Bobot 280-320 kg, 1 ekor utuh untuk 7 nama mudhohi',
    harga_per_unit: 24500000,
    berat_rata_rata: '300 kg',
    periode_qurban_id: 1,
    status_aktif: true,
    created_by: 1
  }
];

export const INITIAL_PENDAFTARAN_QURBAN: PendaftaranQurban[] = [
  {
    id: 1,
    user_id: 2,
    periode_qurban_id: 1,
    hewan_qurban_id: 1,
    jumlah_hewan: 1,
    target_dana: 3500000,
    total_terkumpul: 3500000,
    status: 'siap_dicairkan',
    tanggal_daftar: '2025-01-12',
    catatan: 'Qurban atas nama Ahmad Fathan & Keluarga'
  },
  {
    id: 2,
    user_id: 3,
    periode_qurban_id: 1,
    hewan_qurban_id: 3,
    jumlah_hewan: 1,
    target_dana: 3800000,
    total_terkumpul: 2500000,
    status: 'menabung',
    tanggal_daftar: '2025-01-20',
    catatan: 'Patungan 1/7 Sapi Berkah'
  }
];

export const INITIAL_REKENING_BANK: RekeningBank[] = [
  {
    id: 1,
    nama_bank: 'Bank Syariah Indonesia (BSI)',
    no_rekening: '7144889922',
    atas_nama: 'KSPPS Berkah Mulia Tabungan',
    cabang: 'KCP Jakarta Rasuna Said',
    status_aktif: true,
    created_by: 1,
    logo_color: '#00A39D'
  },
  {
    id: 2,
    nama_bank: 'Bank Muamalat Indonesia',
    no_rekening: '3010098765',
    atas_nama: 'KSPPS Berkah Mulia Operasional',
    cabang: 'KC Jakarta Thamrin',
    status_aktif: true,
    created_by: 1,
    logo_color: '#802682'
  },
  {
    id: 3,
    nama_bank: 'BCA Syariah',
    no_rekening: '8820192831',
    atas_nama: 'Koperasi Berkah Mulia Syariah',
    cabang: 'KCP Jatinegara',
    status_aktif: true,
    created_by: 1,
    logo_color: '#00539C'
  }
];

export const INITIAL_TRANSAKSI: Transaksi[] = [
  {
    id: 1,
    nomor_referensi: 'TRX-20250228-E192A0',
    user_id: 2,
    user_name: 'Ahmad Fathan',
    jenis_tabungan_id: 1,
    jenis_tabungan_nama: 'Tabungan Emas Syariah',
    tipe_tabungan: 'emas',
    jenis_transaksi: 'setor',
    nominal: 12000000,
    unit_didapat: 10.0000,
    harga_acuan_id: 4,
    harga_acuan_snapshot: 1200000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 1,
    rekening_bank_nama: 'BSI (7144889922)',
    bukti_transfer_path: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status_verifikasi: 'terverifikasi',
    diverifikasi_oleh: 1,
    diverifikasi_oleh_name: 'Admin Utama',
    diverifikasi_pada: '2025-02-28 09:15:00',
    catatan_user: 'Setor tabungan emas bulanan 10 gram',
    catatan_admin: 'Dana masuk mutasi BSI valid',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 08:30:00'
  },
  {
    id: 2,
    nomor_referensi: 'TRX-20250228-E882B1',
    user_id: 2,
    user_name: 'Ahmad Fathan',
    jenis_tabungan_id: 1,
    jenis_tabungan_nama: 'Tabungan Emas Syariah',
    tipe_tabungan: 'emas',
    jenis_transaksi: 'setor',
    nominal: 42240000,
    unit_didapat: 35.2000,
    harga_acuan_id: 4,
    harga_acuan_snapshot: 1200000,
    metode_pembayaran: 'cash',
    status_verifikasi: 'terverifikasi',
    diverifikasi_oleh: 1,
    diverifikasi_oleh_name: 'Admin Utama',
    diverifikasi_pada: '2025-02-28 10:00:00',
    catatan_user: 'Setoran Tunai di Kantor Koperasi',
    catatan_admin: 'Kasir teller terima fisik tunai',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 10:00:00'
  },
  {
    id: 3,
    nomor_referensi: 'TRX-20250228-P7712C',
    user_id: 2,
    user_name: 'Ahmad Fathan',
    jenis_tabungan_id: 2,
    jenis_tabungan_nama: 'Tabungan Pribadi Berkah',
    tipe_tabungan: 'pribadi',
    jenis_transaksi: 'setor',
    nominal: 15000000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 1,
    rekening_bank_nama: 'BSI (7144889922)',
    bukti_transfer_path: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status_verifikasi: 'terverifikasi',
    diverifikasi_oleh: 1,
    diverifikasi_oleh_name: 'Admin Utama',
    diverifikasi_pada: '2025-02-28 10:30:00',
    catatan_user: 'Simpanan pribadi persiapan pendidikan',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 10:20:00'
  },
  {
    id: 4,
    nomor_referensi: 'TRX-20250228-Q9901A',
    user_id: 2,
    user_name: 'Ahmad Fathan',
    jenis_tabungan_id: 3,
    jenis_tabungan_nama: 'Tabungan Qurban 1446 H',
    tipe_tabungan: 'qurban',
    pendaftaran_qurban_id: 1,
    jenis_transaksi: 'setor',
    nominal: 3500000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 2,
    rekening_bank_nama: 'Bank Muamalat (3010098765)',
    bukti_transfer_path: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status_verifikasi: 'terverifikasi',
    diverifikasi_oleh: 1,
    diverifikasi_oleh_name: 'Admin Utama',
    diverifikasi_pada: '2025-02-28 11:00:00',
    catatan_user: 'Pelunasan Tabungan Qurban Kambing Tipe A',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 10:50:00'
  },
  {
    id: 5,
    nomor_referensi: 'TRX-20250228-E1109P',
    user_id: 4,
    user_name: 'Budi Santoso',
    jenis_tabungan_id: 1,
    jenis_tabungan_nama: 'Tabungan Emas Syariah',
    tipe_tabungan: 'emas',
    jenis_transaksi: 'setor',
    nominal: 12000000,
    unit_didapat: 10.0000,
    harga_acuan_id: 4,
    harga_acuan_snapshot: 1200000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 1,
    rekening_bank_nama: 'BSI (7144889922)',
    bukti_transfer_path: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status_verifikasi: 'menunggu_verifikasi',
    catatan_user: 'Beli emas 10 gram via transfer BSI',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 11:30:00'
  },
  {
    id: 6,
    nomor_referensi: 'TRX-20250228-E7741S',
    user_id: 3,
    user_name: 'Siti Rahmawati',
    jenis_tabungan_id: 1,
    jenis_tabungan_nama: 'Tabungan Emas Syariah',
    tipe_tabungan: 'emas',
    jenis_transaksi: 'setor',
    nominal: 60000000,
    unit_didapat: 50.0000,
    harga_acuan_id: 4,
    harga_acuan_snapshot: 1200000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 3,
    rekening_bank_nama: 'BCA Syariah (8820192831)',
    bukti_transfer_path: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    status_verifikasi: 'menunggu_verifikasi',
    catatan_user: 'Setoran emas 50g investasi keluarga',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 11:45:00'
  },
  {
    id: 7,
    nomor_referensi: 'TRX-20250228-P3312H',
    user_id: 2,
    user_name: 'Ahmad Fathan',
    jenis_tabungan_id: 2,
    jenis_tabungan_nama: 'Tabungan Pribadi Berkah',
    tipe_tabungan: 'pribadi',
    jenis_transaksi: 'tarik',
    nominal: 2000000,
    metode_pembayaran: 'transfer',
    rekening_bank_id: 1,
    rekening_bank_nama: 'BSI (7144889922)',
    status_verifikasi: 'menunggu_verifikasi',
    catatan_user: 'Penarikan saldo pribadi untuk keperluan berobat',
    tanggal_transaksi: '2025-02-28',
    created_at: '2025-02-28 12:00:00'
  }
];

export const INITIAL_NOTIFIKASI: Notifikasi[] = [
  {
    id: 1,
    user_id: 1, // Admin
    judul: 'Transaksi Baru Menunggu Verifikasi',
    pesan: 'Siti Rahmawati mengajukan setoran emas Rp 60.000.000 (50 gram). Harap periksa bukti mutasi transfer.',
    tipe: 'verifikasi',
    channel: 'in_app',
    dibaca_pada: null,
    created_at: '2025-02-28 11:46:00'
  },
  {
    id: 2,
    user_id: 1, // Admin
    judul: 'Pendaftaran Anggota Baru',
    pesan: 'Nurul Hidayah telah mendaftar akun baru dengan status Menunggu Persetujuan.',
    tipe: 'approval_akun',
    channel: 'in_app',
    dibaca_pada: null,
    created_at: '2025-03-01 08:46:00'
  },
  {
    id: 3,
    user_id: 2, // User Ahmad Fathan
    judul: 'Setoran Emas Berhasil Diverifikasi',
    pesan: 'Alhamdulillah, setoran emas Rp 12.000.000 (10.0000 gram) Anda telah disetujui admin dan ditambahkan ke saldo.',
    tipe: 'verifikasi',
    channel: 'in_app',
    dibaca_pada: null,
    created_at: '2025-02-28 09:15:00'
  },
  {
    id: 4,
    user_id: 2, // User Ahmad Fathan
    judul: 'Target Qurban 1446 H Tercapai!',
    pesan: 'Selamat, tabungan Qurban 1 ekor Kambing Tipe A Anda telah genap Rp 3.500.000 dan berstatus Siap Dicairkan.',
    tipe: 'pengingat_pencairan',
    channel: 'in_app',
    dibaca_pada: null,
    created_at: '2025-02-28 11:00:00'
  },
  {
    id: 5,
    user_id: 2,
    judul: 'Update Harga Emas Hari Ini',
    pesan: 'Harga emas acuan resmi hari ini adalah Rp 1.200.000 / gram (+Rp 5.000 / 0.42%).',
    tipe: 'info',
    channel: 'in_app',
    dibaca_pada: '2025-02-28 08:15:00',
    created_at: '2025-02-28 08:00:00'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 1,
    user_id: 1,
    user_name: 'Admin Utama',
    action: 'HARGA_EMAS_UPDATE',
    model_type: 'HargaEmasHarian',
    model_id: 4,
    new_values: { harga_per_gram: 1200000, status_aktif: true },
    ip_address: '180.252.164.21',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    created_at: '2025-02-28 08:00:00'
  },
  {
    id: 2,
    user_id: 1,
    user_name: 'Admin Utama',
    action: 'TRANSAKSI_VERIFIKASI',
    model_type: 'Transaksi',
    model_id: 1,
    old_values: { status_verifikasi: 'menunggu_verifikasi' },
    new_values: { status_verifikasi: 'terverifikasi', diverifikasi_oleh: 1 },
    ip_address: '180.252.164.21',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    created_at: '2025-02-28 09:15:00'
  },
  {
    id: 3,
    user_id: 1,
    user_name: 'Admin Utama',
    action: 'TRANSAKSI_CASH_INPUT',
    model_type: 'Transaksi',
    model_id: 2,
    new_values: { nominal: 42240000, unit_didapat: 35.2, status_verifikasi: 'terverifikasi' },
    ip_address: '180.252.164.21',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    created_at: '2025-02-28 10:00:00'
  }
];
