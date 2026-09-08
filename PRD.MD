# 📘 PRD — Berkah Mulia (BerkahJaya) Backend

> **Aplikasi:** Koperasi Simpan Pinjam Syariah — Tabungan Emas, Pribadi, Qurban & Gadai
> **Stack:** Laravel 11 · PHP 8.2 · MySQL 8 · Sanctum (API-only, tanpa Blade)
> **Base URL API:** `http://localhost:8000/api/v1`
> **Bahasa:** Indonesia · **Timezone:** Asia/Jakarta

---

## DAFTAR ISI

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Peran & Hak Akses (Role)](#2-peran--hak-akses)
3. [Siklus Hidup Akun](#3-siklus-hidup-akun)
4. [Struktur Database & Relasi](#4-struktur-database--relasi)
   - 4.1 Diagram Relasi
   - 4.2 Detail Tabel & Kolom
   - 4.3 Katalog Enum
5. [Fitur per Modul](#5-fitur-per-modul)
   - 5.1 Autentikasi & Registrasi
   - 5.2 Manajemen User (Admin)
   - 5.3 Jenis Tabungan
   - 5.4 Tabungan Emas Harian (+ Selisih & Flat Setoran)
   - 5.5 Tabungan Pribadi
   - 5.6 Tabungan Qurban
   - 5.7 Transaksi & Verifikasi
   - 5.8 Rekening Bank
   - 5.9 Dashboard & Progress
   - 5.10 Notifikasi
   - 5.11 Audit Log
   - 5.12 Gadai Emas
   - 5.13 Tagihan Harian (Checklist Admin)
   - 5.14 Profil Nasabah Multi-Produk
6. [Alur Bisnis Kunci](#6-alur-bisnis-kunci)
7. [Aturan Teknis & Keamanan](#7-aturan-teknis--keamanan)
8. [Daftar Endpoint (85)](#8-daftar-endpoint)
9. [Struktur Kode](#9-struktur-kode)
10. [Item yang Belum Diimplementasi (TODO)](#10-item-yang-belum-diimplementasi)

---

# 1. Ringkasan Produk

Backend REST API untuk koperasi simpan pinjam syariah **"Berkah Mulia"**. Nasabah
menabung menuju tujuan tertentu (emas, tabungan pribadi, atau qurban), dengan
verifikasi manual oleh admin atas setiap setoran/penarikan. Emas dikonversi otomatis
ke gram berdasarkan harga emas harian yang diinput admin. Qurban dikelola dalam
siklus periode tahunan dengan target dana dan pencairan. Gadai emas tersedia
dengan bunga 4% menurun.

**4 produk utama:**
- **Tabungan Emas Harian** — setor nominal flat → dipecah ke porsi emas (konversi gram) + porsi selisih (uang). Selisih terakumulasi dan dikembalikan saat pelunasan.
- **Tabungan Pribadi** — setor & tarik bebas (bisa tanpa target). Sub-jenis: Mandiri, Kurban, Hari Raya.
- **Tabungan Qurban** — target dana per hewan, tanpa tarik, bisa dicairkan
- **Gadai Emas** — nasabah menggadaikan emas, menerima pinjaman, angsuran harian/mingguan/bulanan dengan bunga 4% menurun dari sisa pokok

**Kode Nasabah:** Nomor anggota 16 digit, auto-increment, berlanjut terus (saat ini sudah di angka 500-an). Unik per nasabah — penting karena nama bisa sama.

**Multi-produk:** Satu nasabah bisa memiliki banyak produk aktif sekaligus (tabungan emas multiple batch, tabungan pribadi, gadai multiple).

---

# 2. Peran & Hak Akses

| Peran | Kode | Hak Akses |
|---|---|---|
| **Administrator** | `admin` | Semua endpoint admin + membaca data publik (user yang disetujui mendapat token) |
| **Nasabah** | `user` | Endpoint user: setor, tarik, lihat progress, dashboard sendiri, notifikasi sendiri, lihat gadai sendiri |

**Middleware:**
- `auth:sanctum` — wajib Bearer token valid
- `active` — user harus berstatus `active`
- `role:admin` / `role:user` — pembatas peran

---

# 3. Siklus Hidup Akun

```
                     ┌────────────┐
  register(publik) ─▶│  pending   │
                     └─────┬──────┘
                           │
            ┌──────────────┼───────────────┐
            ▼              ▼               ▼
        approve        reject         (dibiarkan)
         (admin)       (admin)
            │              │
            ▼              ▼
        active         rejected
            │              │
            ├──suspend──▶ suspended ──activate──▶ active
            │
            └──delete (soft)──▶ dihapus
```

**Status (`UserStatus`):** `pending`, `active`, `rejected`, `suspended`
- Register → `pending` (tidak mendapat token, admin harus approve)
- Admin `approve` → `active` + catat `approved_by` / `approved_at`
- Admin `reject` → `rejected` + wajib `rejected_reason`
- Admin `suspend` → `suspended` + semua token di-revoke
- Admin `activate` → `active` kembali
- Admin `delete` → soft delete
- Saat login, akun non-aktif ditolak dengan error spesifik:
  - `ACCOUNT_PENDING` (403), `ACCOUNT_REJECTED` (403), `ACCOUNT_SUSPENDED` (403)

---

# 4. Struktur Database & Relasi

## 4.1 Diagram Relasi

```
                    ┌──────────────┐
                    │    users     │
                    └──────┬───────┘
                           │
        ┌─────────┬────────┴────────┬──────────────┬────────────┬────────────┐
        ▼         ▼                 ▼              ▼            ▼            ▼
┌────────────┐ ┌──────────┐ ┌───────────┐  ┌────────────┐ ┌───────────┐ ┌────────┐
│ transaksi  │ │notifikasi│ │pendaftaran│  │jenis_tabun │ │audit_logs │ │ gadai  │
└─────┬──────┘ └──────────┘ │_qurban    │  │gan (created│ └───────────┘ └───┬────┘
      │                     └─────┬─────┘  │    /updated│                   │
      │        ┌──────────────────┴─┐      └────────────┘                   │
      │        ▼                    ▼                                        ▼
      │  ┌──────────┐         ┌──────────┐                          ┌──────────────┐
      │  │hewan_qurb│         │periode_q │                          │angsuran_gadai│
      │  │an        │         │urban     │                          └──────────────┘
      │  └──────────┘         └──────────┘
      │
      ▼
┌────────────────────┐    ┌───────────────┐    ┌───────────────┐   ┌─────────────────────┐
│ harga_emas_harian  │    │ rekening_bank │    │ import_export │   │konfigurasi_setoran  │
│ (harga_acuan_id)   │    │ (rekening_bank│    │ _logs         │   │_emas                │
└────────────────────┘    │  _id)         │    └───────────────┘   └─────────────────────┘
                          └───────────────┘
```

## 4.2 Detail Tabel & Kolom

### 4.2.1 `users`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| phone | string unique | |
| nomor_anggota | string(16) unique | 16 digit, auto-increment berlanjut |
| password | string | hashed |
| role | string | `UserRole` |
| status | string | `UserStatus` (default `pending`) |
| address | text nullable | |
| avatar_path | string nullable | |
| target_emas_gram | decimal(15,4) nullable | target tabungan emas global |
| email_verified_at | timestamp nullable | |
| approved_by | FK users nullable | admin yang approve |
| approved_at | timestamp nullable | |
| rejected_reason | text nullable | |
| last_login_at | timestamp nullable | |
| timestamps / softDeletes | | |

**Relasi:** hasMany transaksi, pendaftaranQurban, notifikasi, gadai; belongsTo approvedBy

### 4.2.2 `jenis_tabungan` (produk tabungan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| kode | string unique | slug, e.g. `emas-harian` |
| nama | string | |
| deskripsi | text nullable | |
| tipe | string | `TipeTabungan` (emas/pribadi/qurban) |
| mode_perhitungan | string | `ModePerhitungan` |
| target_nominal | decimal(15,2) nullable | target rupiah |
| target_unit | decimal(15,4) nullable | target gram/ekor |
| unit_label | string nullable | "gram", "ekor" |
| tanggal_mulai / tanggal_selesai | date nullable | |
| tanpa_batas_waktu | boolean (default true) | |
| aturan_pencairan | string | `AturanPencairan` |
| tanggal_pencairan | date nullable | |
| metode_pembayaran_diizinkan | json | `["cash","transfer"]` |
| allow_withdrawal | boolean (default false) | |
| status_aktif | boolean (default true) | |
| config | json nullable | fleksibel |
| created_by / updated_by | FK users | |

### 4.2.3 `harga_emas_harian` (append-only / versioned)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| tanggal | date | |
| harga_per_gram | decimal(15,2) | |
| tagihan_harian_default | decimal(15,2) nullable | |
| status_aktif | boolean (default true) | hanya 1 aktif per tanggal |
| catatan | text nullable | |
| created_by | FK users | |

**Aturan:** Input/update = insert baris baru + deactivate baris lama. Riwayat harga tersimpan lengkap.

### 4.2.4 `periode_qurban`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| tahun | integer | tahun referensi |
| tanggal_buka_pendaftaran | date | |
| tanggal_tutup_pendaftaran | date | default = buka + 1 bulan |
| tanggal_idul_adha | date | |
| tanggal_pencairan | date | default = idul_adha − 14 hari |
| status | string | `StatusPeriodeQurban` |
| created_by | FK users | |

### 4.2.5 `hewan_qurban`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| jenis_hewan | string | "Kambing", "Sapi", "Patungan Sapi 1/7" |
| harga_per_unit | decimal(15,2) | |
| periode_qurban_id | FK cascade delete | |
| status_aktif | boolean | |
| created_by | FK users | |

### 4.2.6 `pendaftaran_qurban`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| user_id | FK users | |
| periode_qurban_id | FK | |
| hewan_qurban_id | FK | |
| jumlah_hewan | integer | |
| target_dana | decimal(15,2) | snapshot = harga × jumlah |
| total_terkumpul | decimal(15,2) default 0 | cache ter-denormalisasi |
| status | string | `StatusPendaftaranQurban` (default `menabung`) |
| tanggal_daftar | date | |
| tanggal_dicairkan | date nullable | |
| dicairkan_oleh | FK users nullable | |
| catatan | text nullable | |

### 4.2.7 `transaksi`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| nomor_referensi | string unique | `TRX-YYYYMMDD-XXXXXX` (random hex) |
| user_id | FK users | |
| jenis_tabungan_id | FK | |
| pendaftaran_qurban_id | FK nullable nullOnDelete | jika setoran qurban |
| jenis_transaksi | string | `JenisTransaksi` setor/tarik |
| nominal | decimal(15,2) | |
| nominal_emas | decimal(15,2) nullable | **BARU** — porsi nominal untuk emas |
| nominal_selisih | decimal(15,2) nullable | **BARU** — porsi selisih/uang |
| unit_didapat | decimal(15,4) nullable | gram emas |
| harga_acuan_id | FK nullable | |
| harga_acuan_snapshot | decimal(15,2) nullable | redundan |
| biaya_penalti | decimal(15,2) nullable | |
| metode_pembayaran | string | `MetodePembayaran` |
| rekening_bank_id | FK nullable | jika transfer |
| bukti_transfer_path | string nullable | |
| status_verifikasi | string | `StatusVerifikasi` (default menunggu_verifikasi) |
| diverifikasi_oleh | FK users nullable | |
| diverifikasi_pada | timestamp nullable | |
| catatan_admin / catatan_user | text nullable | |
| tanggal_transaksi | date | |

### 4.2.8 `rekening_bank`
`nama_bank`, `no_rekening`, `atas_nama`, `cabang` (nullable), `status_aktif`, `created_by`

### 4.2.9 `notifikasi`
`user_id` (FK cascade), `judul`, `pesan`, `tipe` (`TipeNotifikasi`), `data` (json),
`channel` (default `in_app`), `dibaca_pada` (nullable)

### 4.2.10 `audit_logs` (append-only)
`user_id` (FK nullable), `action`, `model_type`, `model_id`, `old_values` (json),
`new_values` (json), `ip_address`, `user_agent`
> **Aturan:** tidak ada endpoint update/hapus.

### 4.2.11 `import_export_logs`
`user_id`, `tipe` (`TipeImportExport` import/export), `target`, `file_path`,
`total_baris`, `berhasil`, `gagal`, `error_detail` (json)

### 4.2.12 `gadai` (BARU)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| nomor_gadai | string unique | Auto-increment: "0001", "0002", dst |
| user_id | FK users | |
| tanggal_gadai | date | tanggal mulai gadai |
| berat_emas_gram | decimal(10,4) | berat emas yang digadaikan |
| jumlah_pencairan | decimal(15,2) | nominal uang yang dipinjamkan |
| nominal_angsuran | decimal(15,2) | setoran per periode |
| bunga_persen | decimal(5,2) default 4.00 | persentase bunga per bulan (default 4%) |
| tipe_bunga | string default 'menurun' | `TipeBunga` (menurun/flat) |
| tenor_nilai | integer | nilai tenor (misal: 1, 3, 6) |
| tenor_satuan | string | `TenorSatuan` (hari/minggu/bulan) |
| tanggal_jatuh_tempo | date | dihitung: tanggal_gadai + tenor |
| sisa_pokok | decimal(15,2) | cache: jumlah_pencairan − total_angsuran_pokok |
| total_angsuran_pokok | decimal(15,2) default 0 | cache total pokok yang sudah dibayar |
| total_biaya_titip | decimal(15,2) default 0 | cache total biaya titip yang sudah dibayar |
| status | string default 'aktif' | `StatusGadai` |
| tanggal_lunas | date nullable | |
| catatan | text nullable | |
| created_by | FK users | admin pembuat |
| timestamps, softDeletes | | |

**Relasi:** belongsTo User, hasMany AngsuranGadai
**Index:** user_id, status, tanggal_jatuh_tempo

**Aturan Bunga 4% Menurun:**
Contoh pinjaman Rp1.000.000:
- Bulan 1: biaya titip = Rp1.000.000 × 4% = Rp40.000. Bayar pokok Rp500.000 + biaya Rp40.000 = Rp540.000. Sisa pokok = Rp500.000.
- Bulan 2: biaya titip = Rp500.000 × 4% = Rp20.000. Bayar pokok Rp500.000 + biaya Rp20.000 = Rp520.000. Sisa = Rp0. LUNAS.

### 4.2.13 `angsuran_gadai` (BARU)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| gadai_id | FK gadai cascade | |
| tanggal_bayar | date | |
| nominal_pokok | decimal(15,2) | porsi yang mengurangi pokok |
| nominal_biaya_titip | decimal(15,2) | biaya titip/bunga periode ini |
| total_bayar | decimal(15,2) | nominal_pokok + nominal_biaya_titip |
| sisa_pokok_setelah | decimal(15,2) | snapshot sisa pokok setelah bayar |
| metode_pembayaran | string | `MetodePembayaran` (cash/transfer) |
| catatan | text nullable | |
| created_by | FK users | admin pencatat |
| timestamps | | |

### 4.2.14 `konfigurasi_setoran_emas` (BARU)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| user_id | FK users | |
| jenis_tabungan_id | FK jenis_tabungan | |
| nominal_setoran_flat | decimal(15,2) | total flat per hari (misal Rp20.000) |
| nominal_porsi_emas | decimal(15,2) | porsi untuk beli emas (misal Rp17.000) |
| nominal_porsi_selisih | decimal(15,2) | porsi selisih/uang (misal Rp3.000) |
| tanggal_mulai | date | tanggal mulai menabung |
| tanggal_deadline | date nullable | tanggal batas (misal 100 hari ke depan) |
| durasi_hari | integer nullable | jumlah hari target (misal 100) |
| frekuensi_setor | string default 'harian' | harian/bulanan |
| status | string default 'aktif' | aktif/selesai/batal |
| created_by | FK users nullable | admin yang set |
| timestamps | | |

**Aturan:** Satu user hanya boleh punya 1 konfigurasi aktif per jenis tabungan emas.

### 4.2.15 `user_tabungan_target` (DIPERBARUI)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint PK | |
| user_id | FK users cascade | |
| jenis_tabungan_id | FK jenis_tabungan cascade | |
| target_nominal | unsignedBigInteger default 0 | |
| tanggal_mulai | date nullable | **BARU** — tanggal mulai tabungan |
| tanggal_deadline | date nullable | **BARU** — tanggal batas |
| durasi_hari | integer nullable | **BARU** — total hari target |
| frekuensi_setor | string nullable | **BARU** — harian/mingguan/bulanan |
| timestamps | | |

## 4.3 Katalog Enum

| Enum | Nilai |
|---|---|
| `UserRole` | `admin`, `user` |
| `UserStatus` | `pending`, `active`, `rejected`, `suspended` |
| `TipeTabungan` | `emas`, `pribadi`, `qurban` |
| `ModePerhitungan` | `nominal_bebas`, `nominal_tetap`, `konversi_unit` |
| `AturanPencairan` | `otomatis`, `manual_admin`, `tanggal_tertentu` |
| `JenisTransaksi` | `setor`, `tarik` |
| `MetodePembayaran` | `cash`, `transfer` |
| `StatusVerifikasi` | `menunggu_verifikasi`, `terverifikasi`, `ditolak` |
| `StatusPeriodeQurban` | `draft`, `aktif`, `ditutup`, `selesai` |
| `StatusPendaftaranQurban` | `menabung`, `target_tercapai`, `siap_dicairkan`, `sudah_dicairkan`, `dibatalkan` |
| `TipeNotifikasi` | `info`, `verifikasi`, `pengingat_setor`, `pengingat_pencairan`, `approval_akun` |
| `ChannelNotifikasi` | `in_app`, `email` |
| `TipeImportExport` | `import`, `export` |
| `StatusGadai` | `aktif`, `lunas`, `jatuh_tempo`, `ditarik` |
| `TenorSatuan` | `hari`, `minggu`, `bulan` |
| `TipeBunga` | `menurun`, `flat` |

---

# 5. Fitur per Modul

## 5.1 Autentikasi & Registrasi
| Fitur | Endpoint | Detail |
|---|---|---|
| Register | `POST /auth/register` | Publik, rate 5/mnt. Status → `pending`, **tidak** dapat token. Validasi: name, email unique, phone unique, password min 8 (huruf+angka), konfirmasi. Nomor anggota 16 digit auto-generate. |
| Login | `POST /auth/login` | Publik, rate 5/mnt. Kembalikan user + Bearer token. Akun non-aktif ditolak (403) |
| Logout | `POST /auth/logout` | Auth. Revoke token aktif |
| Get Profile | `GET /auth/me` | Auth. Data profil sendiri |
| Update Profile | `PUT /auth/me` | Auth. Ubah name/phone/address/avatar (jpg/png max 2MB). Tidak bisa ubah role/status |
| Change Password | `POST /auth/change-password` | Auth. Wajib `current_password`. Revoke semua token lain, return token baru |
| Forgot Password | `POST /auth/forgot-password` | Publik, rate 5/mnt. Kirim link reset ke email |
| Reset Password | `POST /auth/reset-password` | Publik. Body: token, email, password + konfirmasi |

## 5.2 Manajemen User (Admin)
| Fitur | Endpoint | Detail |
|---|---|---|
| List Users | `GET /admin/users` | Filter: status, role, search (nama/email). Pagination |
| Detail User | `GET /admin/users/{id}` | |
| **Produk Nasabah** | `GET /admin/users/{id}/produk` | **BARU** — Semua produk aktif nasabah: tabungan emas (progress + selisih), tabungan pribadi, gadai aktif |
| Create User | `POST /admin/users` | Langsung bisa `active`; created_by = auth. Nomor anggota auto-generate jika tidak diisi |
| Update User | `PUT /admin/users/{id}` | |
| Delete User | `DELETE /admin/users/{id}` | Soft delete |
| Approve | `POST /admin/users/{id}/approve` | pending→active. 409 jika bukan pending |
| Reject | `POST /admin/users/{id}/reject` | Wajib `rejected_reason` |
| Suspend | `POST /admin/users/{id}/suspend` | active→suspended, revoke token |
| Activate | `POST /admin/users/{id}/activate` | suspended→active |
| Export | `GET /admin/users/export` | xlsx |
| Import | `POST /admin/users/import` | xlsx/csv max 10MB |
| Template | `GET /admin/users/import/template` | Unduh template |

## 5.3 Jenis Tabungan
| Fitur | Endpoint | Akses |
|---|---|---|
| List | `GET /jenis-tabungan` | Auth (user lihat aktif saja) |
| Detail | `GET /jenis-tabungan/{id}` | Auth |
| Create | `POST /admin/jenis-tabungan` | Admin |
| Update | `PUT /admin/jenis-tabungan/{id}` | Admin |
| Delete | `DELETE /admin/jenis-tabungan/{id}` | Admin — 409 bila masih ada transaksi |
| Toggle Status | `PATCH /admin/jenis-tabungan/{id}/toggle-status` | Admin |

**Kolom konfigurasi pada create:** kode, nama, deskripsi, tipe, mode_perhitungan,
target_nominal, target_unit, unit_label, tanggal_mulai/selesai, tanpa_batas_waktu,
aturan_pencairan, tanggal_pencairan, metode_pembayaran_diizinkan, allow_withdrawal, config.

## 5.4 Tabungan Emas Harian (+ Selisih & Flat Setoran)
| Fitur | Endpoint | Akses |
|---|---|---|
| Harga Terkini | `GET /emas/harga-terkini` | User — fallback ke tanggal terakhir |
| Riwayat Harga | `GET /emas/harga-riwayat` | User — filter tanggal |
| Input Harga | `POST /admin/emas/harga` | Admin — append-only, deactivate lama |
| Update Harga | `PUT /admin/emas/harga/{id}` | Admin — versi baru |
| Hapus Harga | `DELETE /admin/emas/harga/{id}` | Admin — cek FK |
| Setor Emas | `POST /emas/setor` | User |

**Alur setor emas (diperbarui — dengan mekanisme selisih):**
1. Input nominal (min 10.000), metode (cash/transfer)
2. Sistem cek `konfigurasi_setoran_emas` aktif milik user:
   - **Jika ada konfigurasi flat:** nominal dipecah otomatis ke `nominal_emas` (porsi emas) + `nominal_selisih` (porsi uang)
   - **Jika tidak ada:** seluruh nominal dikonversi ke emas (perilaku lama)
3. Porsi emas dikonversi ke gram: `unit_didapat = nominal_emas / harga_per_gram` (4 desimal)
4. Porsi selisih disimpan di kolom `nominal_selisih` pada transaksi
5. Simpan `harga_acuan_id` + `harga_acuan_snapshot`
6. Jika transfer: wajib `rekening_bank_id` + upload bukti (jpg/png/pdf max 2MB)
7. Status transaksi → `menunggu_verifikasi`
8. Error jika tidak ada harga emas aktif

**Mekanisme Selisih:**
- Setiap setoran emas, porsi "selisih/uang" terakumulasi
- Selisih bisa menutup kekurangan jika nasabah tidak setor di hari tertentu
- Saat pelunasan/pencairan, selisih dikembalikan ke nasabah
- Admin bisa melihat total selisih terkumpul per nasabah

**Konfigurasi Setoran Flat (diatur admin per nasabah):**
- `nominal_setoran_flat` — total flat per hari (misal Rp20.000)
- `nominal_porsi_emas` — berapa yang jadi emas (misal Rp17.000)
- `nominal_porsi_selisih` — berapa yang jadi selisih (misal Rp3.000)
- `tanggal_mulai` + `tanggal_deadline` / `durasi_hari` — deadline (misal 100 hari)
- Sifatnya flat: sekali ditentukan, tidak berubah selama periode berjalan
- Beda nasabah bisa beda nominal flat (variatif)

## 5.5 Tabungan Pribadi
| Fitur | Endpoint | Akses |
|---|---|---|
| Setor | `POST /tabungan-pribadi/setor` | User |
| Tarik | `POST /tabungan-pribadi/tarik` | User — hanya jika `allow_withdrawal=true` (403 `WITHDRAWAL_NOT_ALLOWED`), status menunggu verifikasi |
| Progress | `GET /tabungan-pribadi/progress` | User |

**Sub-jenis Tabungan Pribadi:**
- **Tabungan Mandiri** — setor & tarik bebas, kapan saja, berapa saja
- **Tabungan Kurban** — flat (nominal tetap, tidak bisa berubah), ada deadline
- **Tabungan Hari Raya** — flat, ada deadline

**Progress:** total_setoran, total_penarikan, saldo = setor − tarik, pending_amount
(pending TIDAK masuk saldo), persentase = null jika tanpa target.

## 5.6 Tabungan Qurban

**Siklus periode:** `draft` → `aktif` → `ditutup` → `selesai`
- Auto: saat melewati `tanggal_tutup_pendaftaran`, periode aktif → `ditutup`
- Auto: saat mendekati `tanggal_pencairan`, pendaftaran menabung/tercapai → `siap_dicairkan`
- (dijalankan scheduler harian di `routes/console.php`)

**Status pendaftaran:** `menabung` → `target_tercapai` → `siap_dicairkan` → `sudah_dicairkan` / `dibatalkan`

| Fitur | Endpoint | Akses |
|---|---|---|
| Periode Aktif | `GET /qurban/periode-aktif` | User |
| List Hewan | `GET /qurban/hewan` | User |
| Daftar | `POST /qurban/daftar` | User |
| Pendaftaran Saya | `GET /qurban/pendaftaran-saya` | User |
| Setor | `POST /qurban/{id}/setor` | User |
| Progress | `GET /qurban/{id}/progress` | User |
| Buat Periode | `POST /admin/qurban/periode` | Admin |
| Update Periode | `PUT /admin/qurban/periode/{id}` | Admin |
| Tambah Hewan | `POST /admin/qurban/hewan` | Admin |
| Update Hewan | `PUT /admin/qurban/hewan/{id}` | Admin |
| Hapus Hewan | `DELETE /admin/qurban/hewan/{id}` | Admin |
| Monitor Pendaftaran | `GET /admin/qurban/pendaftaran` | Admin |
| Cairkan | `POST /admin/qurban/{id}/cairkan` | Admin |

**Aturan & logika:**
- `target_dana = harga_per_unit × jumlah_hewan` (snapshot)
- Daftar hanya jika periode `aktif` & pendaftaran dibuka (403 `REGISTRATION_CLOSED`)
- `total_terkumpul` & status diupdate otomatis oleh `QurbanTargetService` saat transaksi diverifikasi (via `TransaksiObserver`)
- `isTargetTercapai()` bila `total_terkumpul >= target_dana` → status `target_tercapai`
- Pencairan oleh admin: set `sudah_dicairkan`, `tanggal_dicairkan`, `dicairkan_oleh`

## 5.7 Transaksi & Verifikasi
| Fitur | Endpoint | Akses |
|---|---|---|
| Riwayat Saya | `GET /transaksi-saya` | User (filter status/jenis tabungan) |
| Detail Saya | `GET /transaksi-saya/{id}` | User — hanya milik sendiri (Policy) |
| Upload Bukti | `POST /transaksi/{id}/upload-bukti` | User — hanya saat menunggu, ganti file lama |
| List Semua | `GET /admin/transaksi` | Admin (filter status/metode/search) |
| Detail | `GET /admin/transaksi/{id}` | Admin |
| Verifikasi | `POST /admin/transaksi/{id}/verifikasi` | Admin |
| Tolak | `POST /admin/transaksi/{id}/tolak` | Admin — wajib `catatan_admin` |
| Input Cash | `POST /admin/transaksi/cash` | Admin — otomatis terverifikasi |

**Aturan kunci:**
- **Idempotent:** verifikasi/tolak hanya boleh untuk status `menunggu_verifikasi`; jika sudah diproses → 409 `CONFLICT`
- **Anti-duplikat:** transaksi sama (user + jenis tabungan + nominal) dalam 30 detik dianggap duplikat → 409 `DUPLICATE`
- **Nomor referensi** non-sequential unik: `TRX-YYYYMMDD-XXXXXX`
- Saat verifikasi qurban → total terkumpul otomatis ter-update
- `diverifikasi_oleh` / `diverifikasi_pada` di-catat saat proses
- Semua verifikasi/tolak/cash dicatat ke `audit_logs`

## 5.8 Rekening Bank
| Fitur | Endpoint | Akses |
|---|---|---|
| List Aktif | `GET /rekening-bank` | Auth |
| Tambah | `POST /admin/rekening-bank` | Admin |
| Update | `PUT /admin/rekening-bank/{id}` | Admin |
| Toggle Status | `PATCH /admin/rekening-bank/{id}/toggle-status` | Admin |
| Hapus | `DELETE /admin/rekening-bank/{id}` | Admin |

## 5.9 Dashboard & Progress
| Fitur | Endpoint | Akses |
|---|---|---|
| Dashboard User | `GET /dashboard` | User — ringkasan tiap jenis tabungan + jumlah transaksi pending + gadai aktif |
| Progress per Jenis | `GET /dashboard/{id}/progress` | User — untuk emas tambah `total_unit` (gram) + `total_selisih` |
| Dashboard Admin | `GET /admin/dashboard` | Admin |
| Export Laporan | `GET /admin/laporan/export` | Admin — filter jenis tabungan/dari/sampai |

**KPI Admin:** total nasabah aktif, nasabah pending, transaksi pending/terverifikasi,
rata-rata waktu verifikasi (jam), total setoran terverifikasi, gadai aktif, gadai jatuh tempo.

## 5.10 Notifikasi
| Fitur | Endpoint | Akses |
|---|---|---|
| List | `GET /notifikasi` | Auth (filter dibaca, ada `unread_count`) |
| Tandai Dibaca | `PATCH /notifikasi/{id}/read` | Auth |
| Tandai Semua | `PATCH /notifikasi/read-all` | Auth |

Channel: `in_app` (DB). Tipe: info, verifikasi, pengingat_setor, pengingat_pencairan, approval_akun.

## 5.11 Audit Log
| Fitur | Endpoint | Akses |
|---|---|---|
| List | `GET /admin/audit-logs` | Admin (filter action/model_type/rentang) |

Merekam aksi, model, nilai lama/baru, IP, user-agent. Append-only (read-only, tanpa update/hapus).

## 5.12 Gadai Emas (BARU)

Modul gadai emas memungkinkan nasabah menggadaikan emas fisik dan menerima pinjaman uang. Angsuran dapat dilakukan harian, mingguan, atau bulanan dengan bunga 4% menurun dari sisa pokok.

**Siklus Gadai:** `aktif` → `lunas` / `jatuh_tempo` / `ditarik`

### Endpoint Admin
| Fitur | Endpoint | Detail |
|---|---|---|
| Buat Gadai | `POST /admin/gadai` | Data: user_id, tanggal_gadai, berat_emas_gram, jumlah_pencairan, nominal_angsuran, bunga_persen (default 4), tipe_bunga (default menurun), tenor_nilai, tenor_satuan. `nomor_gadai` auto-generate. |
| List Gadai | `GET /admin/gadai` | Filter: status, user_id, tanggal. Pagination |
| Detail Gadai | `GET /admin/gadai/{id}` | Include riwayat angsuran |
| Update Gadai | `PUT /admin/gadai/{id}` | Hanya untuk gadai aktif |
| Catat Angsuran | `POST /admin/gadai/{id}/angsuran` | Input: nominal_pokok. Biaya titip dihitung otomatis dari sisa pokok × bunga%. Sisa pokok di-update. |
| Simulasi Pelunasan | `GET /admin/gadai/{id}/simulasi-pelunasan` | Real-time: sisa pokok + biaya titip sampai hari ini = total pelunasan |
| Pelunasan Penuh | `POST /admin/gadai/{id}/lunasi` | Lunasi semua sisa pokok + biaya titip. Status → `lunas` |
| Hapus Gadai | `DELETE /admin/gadai/{id}` | Soft delete |

### Endpoint User/Nasabah
| Fitur | Endpoint | Detail |
|---|---|---|
| Gadai Saya | `GET /gadai/saya` | List gadai milik nasabah (filter status) |
| Detail Gadai | `GET /gadai/{id}` | Detail + riwayat angsuran (hanya milik sendiri) |
| Sisa Pelunasan | `GET /gadai/{id}/sisa-pelunasan` | Estimasi sisa pelunasan real-time |

### Aturan & Logika Gadai
- **Nomor gadai** auto-increment terpisah dari nomor anggota: "0001", "0002", dst
- **Bunga menurun:** biaya titip dihitung dari `sisa_pokok × bunga_persen / 100`
  - Untuk harian: biaya per hari = bunga bulanan / 30
  - Untuk mingguan: biaya per minggu = bunga bulanan / 4
- **Satu nasabah bisa punya banyak gadai aktif** (beda tanggal/item)
- **Cache fields** `sisa_pokok`, `total_angsuran_pokok`, `total_biaya_titip` diupdate setiap kali angsuran dicatat
- **Jatuh tempo:** scheduler harian cek gadai yang melewati `tanggal_jatuh_tempo` → status `jatuh_tempo`
- Admin dapat melihat simulasi pelunasan kapan saja (untuk menjawab pertanyaan nasabah "pelunasan saya berapa lagi?")

## 5.13 Tagihan Harian — Checklist Admin (BARU)

Fitur untuk admin melakukan penagihan harian. Admin melihat daftar nasabah yang harus ditagih hari ini, lalu mencentang (checklist) yang sudah bayar.

| Fitur | Endpoint | Detail |
|---|---|---|
| List Tagihan Hari Ini | `GET /admin/tagihan-harian` | Nasabah yang punya konfigurasi setoran harian aktif & belum setor hari ini. Include data: nama, nomor anggota, nominal flat, status setor hari ini |
| Checklist Setoran | `POST /admin/tagihan-harian/{userId}/checklist` | Otomatis buat transaksi cash terverifikasi dengan nominal flat. Split ke nominal_emas + nominal_selisih sesuai konfigurasi. |
| Summary | `GET /admin/tagihan-harian/summary` | Ringkasan: total nasabah harian, sudah setor, belum setor, total nominal terkumpul hari ini |

**Logika:**
1. Query `konfigurasi_setoran_emas` aktif + `user_tabungan_target` aktif dengan frekuensi harian
2. Cross-check dengan transaksi hari ini → filter yang belum setor
3. Checklist = auto-create transaksi cash terverifikasi dengan nominal dari konfigurasi
4. Karena setoran flat, proses ini simpel: klik → transaksi terbuat

## 5.14 Profil Nasabah Multi-Produk (BARU)

Endpoint untuk melihat semua produk yang dimiliki satu nasabah. Saat admin klik nama nasabah, langsung terlihat komposisi semua produk aktif.

| Fitur | Endpoint | Detail |
|---|---|---|
| Semua Produk Nasabah | `GET /admin/users/{id}/produk` | Gabungan semua produk aktif: tabungan emas (progress + selisih + deadline), tabungan pribadi, gadai (sisa pokok + estimasi pelunasan) |

**Response structure:**
```json
{
  "user": { "id": 1, "name": "Fajri", "nomor_anggota": "0000000000000070" },
  "produk": {
    "tabungan_emas": [
      {
        "konfigurasi": { "nominal_flat": 20000, "porsi_emas": 17000, "porsi_selisih": 3000, "deadline": "2026-12-15" },
        "progress": { "total_gram": 1.5000, "total_setoran": 500000, "selisih_terkumpul": 90000 }
      }
    ],
    "tabungan_pribadi": [
      { "jenis": "mandiri", "kode": "mandiri", "saldo": 500000 },
      { "jenis": "kurban", "kode": "kurban", "saldo": 200000, "deadline": "2027-06-15" }
    ],
    "gadai": [
      { "nomor_gadai": "0070", "berat_emas": 7.0000, "jumlah_pencairan": 14000000, "sisa_pokok": 7000000, "status": "aktif" },
      { "nomor_gadai": "0085", "berat_emas": 3.0000, "jumlah_pencairan": 6000000, "sisa_pokok": 3000000, "status": "aktif" }
    ]
  },
  "summary": {
    "total_tabungan_aktif": 3,
    "total_gadai_aktif": 2,
    "total_saldo_tabungan": 850000,
    "total_sisa_pokok_gadai": 10000000
  }
}
```

---

# 6. Alur Bisnis Kunci

## 6.1 Alur Setor & Verifikasi
```
User setor (nominal + metode)
   ├─ transfer → wajib rekening_bank_id + upload bukti
   └─ emas → cek konfigurasi flat:
        ├─ ada flat → split: nominal_emas → konversi gram + nominal_selisih
        └─ tidak ada → konversi seluruh nominal → gram
         ↓
Transaksi dibuat, status = menunggu_verifikasi
         ↓
Admin verifikasi / tolak
   ├─ verifikasi → 409 jika sudah diproses; catat diverifikasi_oleh/pada
   │     └─ jika qurban → total_terkumpul di-update + status (menabung→target_tercapai)
   └─ tolak → wajib catatan_admin
         ↓
Audit log dicatat
```

## 6.2 Alur Qurban
```
Admin buat periode (aktif) + data hewan
   ↓
User daftar (hewan + jumlah) → target_dana = harga × jumlah
   ↓
User setor (via transaksi, menunggu verifikasi)
   ↓
Admin verifikasi → total_terkumpul + status ter-update otomatis
   ↓
Scheduler: periode tutup, pendaftaran → siap_dicairkan
   ↓
Admin cairkan → sudah_dicairkan
```

## 6.3 Alur Gadai Emas (BARU)
```
Admin buat gadai baru (data nasabah + barang emas + pinjaman)
   ↓
Nomor gadai auto-generate ("0001", "0002", ...)
Tanggal jatuh tempo dihitung otomatis
   ↓
Nasabah bayar angsuran (harian/mingguan/bulanan)
   ├─ Admin catat angsuran: input nominal_pokok
   ├─ Biaya titip otomatis dihitung: sisa_pokok × bunga% (menurun)
   └─ Sisa pokok di-update
   ↓
Repeat sampai sisa_pokok = 0 → status "lunas"
ATAU:
   ├─ Admin pilih pelunasan penuh → sisa pokok + biaya titip langsung dilunasi
   └─ Scheduler: tanggal jatuh tempo terlewat → status "jatuh_tempo"
```

## 6.4 Alur Tagihan Harian (BARU)
```
Admin buka halaman Tagihan Harian
   ↓
Sistem list semua nasabah aktif dengan setoran harian
   ├─ Filter: yang belum setor hari ini
   └─ Tampilkan: nama, nomor anggota, nominal flat
   ↓
Admin checklist nasabah yang sudah bayar
   ↓
Sistem otomatis:
   ├─ Buat transaksi cash terverifikasi
   ├─ Split nominal → porsi emas + porsi selisih (jika tabungan emas)
   └─ Konversi porsi emas ke gram
```

---

# 7. Aturan Teknis & Keamanan

- **Auth:** Sanctum Bearer token (`auth:sanctum`)
- **Response standar:** `{ success, message, data, meta }` — meta hanya untuk paginasi
- **Error code standar:** `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`,
  `ACCOUNT_PENDING/REJECTED/SUSPENDED`, `WITHDRAWAL_NOT_ALLOWED`, `REGISTRATION_CLOSED`,
  `NOT_FOUND`, `CONFLICT`, `DUPLICATE`, `TOO_MANY_REQUESTS`
- **Rate limit:** publik 5/mnt (auth), umum 60/mnt (API)
- **Validasi:** wajib, min/max, unique, format, aturan business (min setor 10.000, dll)
- **File:** bukti transfer disimpan disk privat `bukti_transfer` (UUID name), akses via signed/authenticated route, bukan publik. Avatar jpg/png max 2MB.
- **Soft delete** pada tabel bisnis (users, transaksi, pendaftaran_qurban, gadai, dll)
- **Security headers** global (`SecurityHeaders` middleware)
- **Transaksi DB** (`DB::transaction`) untuk operasi yang mengubah banyak data
- **Audit trail** append-only untuk aksi kritis
- **Idempotency guard** untuk verifikasi & anti-duplikat setoran
- Storage lokal default; S3 tersedia via konfigurasi (untuk produksi)

---

# 8. Daftar Endpoint

| # | Method | Endpoint | Akses |
|---|---|---|---|
| 1 | POST | `/auth/register` | Publik |
| 2 | POST | `/auth/login` | Publik |
| 3 | POST | `/auth/logout` | Auth |
| 4 | GET | `/auth/me` | Auth |
| 5 | PUT | `/auth/me` | Auth |
| 6 | POST | `/auth/change-password` | Auth |
| 7 | POST | `/auth/forgot-password` | Publik |
| 8 | POST | `/auth/reset-password` | Publik |
| 9 | GET | `/admin/users` | Admin |
| 10 | GET | `/admin/users/{id}` | Admin |
| 11 | GET | `/admin/users/{id}/produk` | Admin |
| 12 | POST | `/admin/users` | Admin |
| 13 | PUT | `/admin/users/{id}` | Admin |
| 14 | DELETE | `/admin/users/{id}` | Admin |
| 15 | POST | `/admin/users/{id}/approve` | Admin |
| 16 | POST | `/admin/users/{id}/reject` | Admin |
| 17 | POST | `/admin/users/{id}/suspend` | Admin |
| 18 | POST | `/admin/users/{id}/activate` | Admin |
| 19 | GET | `/admin/users/export` | Admin |
| 20 | POST | `/admin/users/import` | Admin |
| 21 | GET | `/admin/users/import/template` | Admin |
| 22 | GET | `/jenis-tabungan` | Auth |
| 23 | GET | `/jenis-tabungan/{id}` | Auth |
| 24 | POST | `/admin/jenis-tabungan` | Admin |
| 25 | PUT | `/admin/jenis-tabungan/{id}` | Admin |
| 26 | DELETE | `/admin/jenis-tabungan/{id}` | Admin |
| 27 | PATCH | `/admin/jenis-tabungan/{id}/toggle-status` | Admin |
| 28 | GET | `/emas/harga-terkini` | User |
| 29 | GET | `/emas/harga-riwayat` | User |
| 30 | POST | `/emas/setor` | User |
| 31 | GET | `/admin/emas/harga-terkini` | Admin |
| 32 | GET | `/admin/emas/harga-riwayat` | Admin |
| 33 | POST | `/admin/emas/harga` | Admin |
| 34 | PUT | `/admin/emas/harga/{id}` | Admin |
| 35 | DELETE | `/admin/emas/harga/{id}` | Admin |
| 36 | POST | `/tabungan-pribadi/setor` | User |
| 37 | POST | `/tabungan-pribadi/tarik` | User |
| 38 | GET | `/tabungan-pribadi/progress` | User |
| 39 | GET | `/qurban/periode-aktif` | User |
| 40 | GET | `/qurban/hewan` | User |
| 41 | POST | `/qurban/daftar` | User |
| 42 | GET | `/qurban/pendaftaran-saya` | User |
| 43 | POST | `/qurban/{id}/setor` | User |
| 44 | GET | `/qurban/{id}/progress` | User |
| 45 | POST | `/admin/qurban/periode` | Admin |
| 46 | PUT | `/admin/qurban/periode/{id}` | Admin |
| 47 | POST | `/admin/qurban/hewan` | Admin |
| 48 | PUT | `/admin/qurban/hewan/{id}` | Admin |
| 49 | DELETE | `/admin/qurban/hewan/{id}` | Admin |
| 50 | GET | `/admin/qurban/pendaftaran` | Admin |
| 51 | POST | `/admin/qurban/{id}/cairkan` | Admin |
| 52 | GET | `/transaksi-saya` | User |
| 53 | GET | `/transaksi-saya/{id}` | User |
| 54 | POST | `/transaksi/{id}/upload-bukti` | User |
| 55 | GET | `/admin/transaksi` | Admin |
| 56 | GET | `/admin/transaksi/{id}` | Admin |
| 57 | POST | `/admin/transaksi/{id}/verifikasi` | Admin |
| 58 | POST | `/admin/transaksi/{id}/tolak` | Admin |
| 59 | POST | `/admin/transaksi/cash` | Admin |
| 60 | GET | `/rekening-bank` | Auth |
| 61 | POST | `/admin/rekening-bank` | Admin |
| 62 | PUT | `/admin/rekening-bank/{id}` | Admin |
| 63 | PATCH | `/admin/rekening-bank/{id}/toggle-status` | Admin |
| 64 | DELETE | `/admin/rekening-bank/{id}` | Admin |
| 65 | GET | `/dashboard` | User |
| 66 | GET | `/dashboard/{id}/progress` | User |
| 67 | GET | `/admin/dashboard` | Admin |
| 68 | GET | `/admin/laporan/export` | Admin |
| 69 | GET | `/notifikasi` | Auth |
| 70 | PATCH | `/notifikasi/{id}/read` | Auth |
| 71 | PATCH | `/notifikasi/read-all` | Auth |
| 72 | GET | `/admin/audit-logs` | Admin |
| 73 | POST | `/admin/gadai` | Admin |
| 74 | GET | `/admin/gadai` | Admin |
| 75 | GET | `/admin/gadai/{id}` | Admin |
| 76 | PUT | `/admin/gadai/{id}` | Admin |
| 77 | POST | `/admin/gadai/{id}/angsuran` | Admin |
| 78 | GET | `/admin/gadai/{id}/simulasi-pelunasan` | Admin |
| 79 | POST | `/admin/gadai/{id}/lunasi` | Admin |
| 80 | DELETE | `/admin/gadai/{id}` | Admin |
| 81 | GET | `/gadai/saya` | User |
| 82 | GET | `/gadai/{id}` | User |
| 83 | GET | `/gadai/{id}/sisa-pelunasan` | User |
| 84 | GET | `/admin/tagihan-harian` | Admin |
| 85 | POST | `/admin/tagihan-harian/{userId}/checklist` | Admin |

---

# 9. Struktur Kode

**Controllers** (`app/Http/Controllers/Api/V1/`)
- `Auth/AuthController` — register/login/logout/me/ubah password/reset
- `JenisTabunganController` — read untuk user
- `EmasController` — harga & setor emas (user) + logika selisih
- `TabunganPribadiController` — setor/tarik/progress
- `QurbanController` — daftar/hewan/setor/progress (user)
- `TransaksiController` — riwayat & upload bukti (user)
- `RekeningBankController` — list (user)
- `DashboardController` — dashboard user + progress
- `NotifikasiController` — list & mark read
- `GadaiController` — gadai saya, detail, sisa pelunasan (user)
- `Admin/*` — UserController, JenisTabunganController, HargaEmasController, QurbanController, TransaksiController, RekeningBankController, DashboardController, AuditLogController, GadaiController, TagihanHarianController

**Services** (`app/Services/`)
- `TransaksiService` — buat transaksi, upload bukti, isDuplicate
- `EmasConversionService` — nominal→gram konversi
- `ProgressCalculatorService` — dashboard & progress user (+ saldo selisih + deadline tracking)
- `QurbanTargetService` — hitung target & update total_terkumpul
- `GadaiCalculationService` — bunga menurun, estimasi pelunasan, jadwal angsuran
- `SelisihEmasService` — akumulasi selisih, split nominal, pencairan selisih

**Observers** (`app/Observers/TransaksiObserver.php`)
- saat `updated` & `status_verifikasi` berubah → update total qurban

**Models** (`app/Models/`) — User, JenisTabungan, HargaEmasHarian, PeriodeQurban, HewanQurban, PendaftaranQurban, Transaksi, RekeningBank, Notifikasi, AuditLog, ImportExportLog, UserTabunganTarget, Gadai, AngsuranGadai, KonfigurasiSetoranEmas

**Resources** (`app/Http/Resources/`) — UserResource, JenisTabunganResource, TransaksiResource, GadaiResource, AngsuranGadaiResource, dsb.

**Enums** (`app/Enums/`) — 16 enum (lihat §4.3)

**Policies** — TransaksiPolicy, PendaftaranQurbanPolicy, GadaiPolicy
**Middleware** — RoleMiddleware, EnsureUserIsActive, SecurityHeaders
**Traits** — ApiResponse (`successResponse`, `errorResponse`, `createdResponse`, `deletedResponse`)

---

# 10. Item yang Belum Diimplementasi (TODO)

| Area | TODO |
|---|---|
| Verifikasi/Tolak transaksi | Kirim notifikasi ke user (`SendTransaksiVerifiedNotification` / `SendTransaksiRejectedNotification`) |
| Approve/Reject user | Kirim notifikasi (`SendUserApprovalNotification` / `SendUserRejectedNotification`) |
| Export laporan admin | Dispatch `GenerateReportExportJob` (link download via notifikasi) |
| Export/Import users | Dispatch job proses (ExportUsers / ProcessUserImportJob) |
| Import template | Buat & return file template |
| Scheduler | Auto-close qurban periode & set `siap_dicairkan` sudah ada; notifikasi pengingat setor/pencairan belum dibuat |
| Scheduler Gadai | Auto-update status gadai yang melewati `tanggal_jatuh_tempo` → `jatuh_tempo` |
| Storage | File kini lokal; S3 untuk produksi (konfigurasi sudah siap) |

> Rujukan lengkap request/response: `API_DOCUMENTATION.md`. Auto-generated docs: `http://localhost:8000/docs/api`