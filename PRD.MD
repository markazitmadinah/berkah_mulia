# 📘 PRD — Berkah Mulia (BerkahJaya) Backend

> **Aplikasi:** Koperasi Simpan Pinjam Syariah — Tabungan Emas, Pribadi & Qurban
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
   - 5.4 Tabungan Emas Harian
   - 5.5 Tabungan Pribadi
   - 5.6 Tabungan Qurban
   - 5.7 Transaksi & Verifikasi
   - 5.8 Rekening Bank
   - 5.9 Dashboard & Progress
   - 5.10 Notifikasi
   - 5.11 Audit Log
6. [Alur Bisnis Kunci](#6-alur-bisnis-kunci)
7. [Aturan Teknis & Keamanan](#7-aturan-teknis--keamanan)
8. [Daftar Endpoint (71)](#8-daftar-endpoint)
9. [Struktur Kode](#9-struktur-kode)
10. [Item yang Belum Diimplementasi (TODO)](#10-item-yang-belum-diimplementasi)

---

# 1. Ringkasan Produk

Backend REST API untuk koperasi simpan pinjam syariah **"Berkah Mulia"**. Nasabah
menabung menuju tujuan tertentu (emas, tabungan pribadi, atau qurban), dengan
verifikasi manual oleh admin atas setiap setoran/penarikan. Emas dikonversi otomatis
ke gram berdasarkan harga emas harian yang diinput admin. Qurban dikelola dalam
siklus periode tahunan dengan target dana dan pencairan.

**3 produk tabungan utama** (dikonfigurasi via tabel `jenis_tabungan`):
- **Tabungan Emas Harian** — setor nominal → dikonversi ke gram
- **Tabungan Pribadi** — setor & tarik bebas (bisa tanpa target)
- **Tabungan Qurban** — target dana per hewan, tanpa tarik, bisa dicairkan

---

# 2. Peran & Hak Akses

| Peran | Kode | Hak Akses |
|---|---|---|
| **Administrator** | `admin` | Semua endpoint admin + membaca data publik (user yang disetujui mendapat token) |
| **Nasabah** | `user` | Endpoint user: setor, tarik, lihat progress, dashboard sendiri, notifikasi sendiri |

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
        ┌─────────┬────────┴────────┬──────────────┬────────────┐
        ▼         ▼                 ▼              ▼            ▼
┌────────────┐ ┌──────────┐ ┌───────────┐  ┌────────────┐ ┌───────────┐
│ transaksi  │ │notifikasi│ │pendaftaran│  │jenis_tabun │ │audit_logs │
└─────┬──────┘ └──────────┘ │_qurban    │  │gan (created│ └───────────┘
      │                     └─────┬─────┘  │    /updated│
      │        ┌──────────────────┴─┐      └────────────┘
      │        ▼                    ▼
      │  ┌──────────┐         ┌──────────┐
      │  │hewan_qurb│         │periode_q │
      │  │an        │         │urban     │
      │  └──────────┘         └──────────┘
      │
      ▼
┌────────────────────┐    ┌───────────────┐    ┌───────────────┐
│ harga_emas_harian  │    │ rekening_bank │    │ import_export │
│ (harga_acuan_id)   │    │ (rekening_bank│    │ _logs         │
└────────────────────┘    │  _id)         │    └───────────────┘
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
| password | string | hashed |
| role | string | `UserRole` |
| status | string | `UserStatus` (default `pending`) |
| address | text nullable | |
| avatar_path | string nullable | |
| email_verified_at | timestamp nullable | |
| approved_by | FK users nullable | admin yang approve |
| approved_at | timestamp nullable | |
| rejected_reason | text nullable | |
| last_login_at | timestamp nullable | |
| timestamps / softDeletes | | |

**Relasi:** hasMany transaksi, pendaftaranQurban, notifikasi; belongsTo approvedBy

### 4.2.2 `jenis_tabungan` (produk tabungan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| kode | string unique | slug, e.g. `emas-harian` |
| nama | string | |
| deskripsi | text nullable | |
| tipe | string | `TipeTabungan` (emas/pribadi/qurban/custom) |
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
| unit_didapat | decimal(15,4) nullable | gram emas |
| harga_acuan_id | FK nullable | |
| harga_acuan_snapshot | decimal(15,2) nullable | redundan |
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

## 4.3 Katalog Enum

| Enum | Nilai |
|---|---|
| `UserRole` | `admin`, `user` |
| `UserStatus` | `pending`, `active`, `rejected`, `suspended` |
| `TipeTabungan` | `emas`, `pribadi`, `qurban`, `custom` |
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

---

# 5. Fitur per Modul

## 5.1 Autentikasi & Registrasi
| Fitur | Endpoint | Detail |
|---|---|---|
| Register | `POST /auth/register` | Publik, rate 5/mnt. Status → `pending`, **tidak** dapat token. Validasi: name, email unique, phone unique, password min 8 (huruf+angka), konfirmasi |
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
| Create User | `POST /admin/users` | Langsung bisa `active`; created_by = auth |
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

## 5.4 Tabungan Emas Harian
| Fitur | Endpoint | Akses |
|---|---|---|
| Harga Terkini | `GET /emas/harga-terkini` | User — fallback ke tanggal terakhir |
| Riwayat Harga | `GET /emas/harga-riwayat` | User — filter tanggal |
| Input Harga | `POST /admin/emas/harga` | Admin — append-only, deactivate lama |
| Update Harga | `PUT /admin/emas/harga/{id}` | Admin — versi baru |
| Hapus Harga | `DELETE /admin/emas/harga/{id}` | Admin — cek FK |
| Setor Emas | `POST /emas/setor` | User |

**Alur setor emas:**
1. Input nominal (min 10.000), metode (cash/transfer)
2. Sistem ambil `harga_emas_harian` aktif terkini (`EmasConversionService`)
3. Hitung `unit_didapat = nominal / harga_per_gram` (4 desimal)
4. Simpan `harga_acuan_id` + `harga_acuan_snapshot`
5. Jika transfer: wajib `rekening_bank_id` + upload bukti (jpg/png/pdf max 2MB)
6. Status transaksi → `menunggu_verifikasi`
7. Error jika tidak ada harga emas aktif

## 5.5 Tabungan Pribadi
| Fitur | Endpoint | Akses |
|---|---|---|
| Setor | `POST /tabungan-pribadi/setor` | User |
| Tarik | `POST /tabungan-pribadi/tarik` | User — hanya jika `allow_withdrawal=true` (403 `WITHDRAWAL_NOT_ALLOWED`), status menunggu verifikasi |
| Progress | `GET /tabungan-pribadi/progress` | User |

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
| Dashboard User | `GET /dashboard` | User — ringkasan tiap jenis tabungan + jumlah transaksi pending |
| Progress per Jenis | `GET /dashboard/{id}/progress` | User — untuk emas tambah `total_unit` (gram) |
| Dashboard Admin | `GET /admin/dashboard` | Admin |
| Export Laporan | `GET /admin/laporan/export` | Admin — filter jenis tabungan/dari/sampai |

**KPI Admin:** total nasabah aktif, nasabah pending, transaksi pending/terverifikasi,
rata-rata waktu verifikasi (jam), total setoran terverifikasi.

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

---

# 6. Alur Bisnis Kunci

## 6.1 Alur Setor & Verifikasi
```
User setor (nominal + metode)
   ├─ transfer → wajib rekening_bank_id + upload bukti
   └─ emas → konversi nominal→gram + snapshot harga
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
- **Soft delete** pada tabel bisnis (users, transaksi, pendaftaran_qurban, dll)
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
| 11 | POST | `/admin/users` | Admin |
| 12 | PUT | `/admin/users/{id}` | Admin |
| 13 | DELETE | `/admin/users/{id}` | Admin |
| 14 | POST | `/admin/users/{id}/approve` | Admin |
| 15 | POST | `/admin/users/{id}/reject` | Admin |
| 16 | POST | `/admin/users/{id}/suspend` | Admin |
| 17 | POST | `/admin/users/{id}/activate` | Admin |
| 18 | GET | `/admin/users/export` | Admin |
| 19 | POST | `/admin/users/import` | Admin |
| 20 | GET | `/admin/users/import/template` | Admin |
| 21 | GET | `/jenis-tabungan` | Auth |
| 22 | GET | `/jenis-tabungan/{id}` | Auth |
| 23 | POST | `/admin/jenis-tabungan` | Admin |
| 24 | PUT | `/admin/jenis-tabungan/{id}` | Admin |
| 25 | DELETE | `/admin/jenis-tabungan/{id}` | Admin |
| 26 | PATCH | `/admin/jenis-tabungan/{id}/toggle-status` | Admin |
| 27 | GET | `/emas/harga-terkini` | User |
| 28 | GET | `/emas/harga-riwayat` | User |
| 29 | POST | `/emas/setor` | User |
| 30 | GET | `/admin/emas/harga-terkini` | Admin |
| 31 | GET | `/admin/emas/harga-riwayat` | Admin |
| 32 | POST | `/admin/emas/harga` | Admin |
| 33 | PUT | `/admin/emas/harga/{id}` | Admin |
| 34 | DELETE | `/admin/emas/harga/{id}` | Admin |
| 35 | POST | `/tabungan-pribadi/setor` | User |
| 36 | POST | `/tabungan-pribadi/tarik` | User |
| 37 | GET | `/tabungan-pribadi/progress` | User |
| 38 | GET | `/qurban/periode-aktif` | User |
| 39 | GET | `/qurban/hewan` | User |
| 40 | POST | `/qurban/daftar` | User |
| 41 | GET | `/qurban/pendaftaran-saya` | User |
| 42 | POST | `/qurban/{id}/setor` | User |
| 43 | GET | `/qurban/{id}/progress` | User |
| 44 | POST | `/admin/qurban/periode` | Admin |
| 45 | PUT | `/admin/qurban/periode/{id}` | Admin |
| 46 | POST | `/admin/qurban/hewan` | Admin |
| 47 | PUT | `/admin/qurban/hewan/{id}` | Admin |
| 48 | DELETE | `/admin/qurban/hewan/{id}` | Admin |
| 49 | GET | `/admin/qurban/pendaftaran` | Admin |
| 50 | POST | `/admin/qurban/{id}/cairkan` | Admin |
| 51 | GET | `/transaksi-saya` | User |
| 52 | GET | `/transaksi-saya/{id}` | User |
| 53 | POST | `/transaksi/{id}/upload-bukti` | User |
| 54 | GET | `/admin/transaksi` | Admin |
| 55 | GET | `/admin/transaksi/{id}` | Admin |
| 56 | POST | `/admin/transaksi/{id}/verifikasi` | Admin |
| 57 | POST | `/admin/transaksi/{id}/tolak` | Admin |
| 58 | POST | `/admin/transaksi/cash` | Admin |
| 59 | GET | `/rekening-bank` | Auth |
| 60 | POST | `/admin/rekening-bank` | Admin |
| 61 | PUT | `/admin/rekening-bank/{id}` | Admin |
| 62 | PATCH | `/admin/rekening-bank/{id}/toggle-status` | Admin |
| 63 | DELETE | `/admin/rekening-bank/{id}` | Admin |
| 64 | GET | `/dashboard` | User |
| 65 | GET | `/dashboard/{id}/progress` | User |
| 66 | GET | `/admin/dashboard` | Admin |
| 67 | GET | `/admin/laporan/export` | Admin |
| 68 | GET | `/notifikasi` | Auth |
| 69 | PATCH | `/notifikasi/{id}/read` | Auth |
| 70 | PATCH | `/notifikasi/read-all` | Auth |
| 71 | GET | `/admin/audit-logs` | Admin |

---

# 9. Struktur Kode

**Controllers** (`app/Http/Controllers/Api/V1/`)
- `Auth/AuthController` — register/login/logout/me/ubah password/reset
- `JenisTabunganController` — read untuk user
- `EmasController` — harga & setor emas (user)
- `TabunganPribadiController` — setor/tarik/progress
- `QurbanController` — daftar/hewan/setor/progress (user)
- `TransaksiController` — riwayat & upload bukti (user)
- `RekeningBankController` — list (user)
- `DashboardController` — dashboard user + progress
- `NotifikasiController` — list & mark read
- `Admin/*` — UserController, JenisTabunganController, HargaEmasController, QurbanController, TransaksiController, RekeningBankController, DashboardController, AuditLogController

**Services** (`app/Services/`)
- `TransaksiService` — buat transaksi, upload bukti, isDuplicate
- `EmasConversionService` — nominal→gram konversi
- `ProgressCalculatorService` — dashboard & progress user
- `QurbanTargetService` — hitung target & update total_terkumpul

**Observers** (`app/Observers/TransaksiObserver.php`)
- saat `updated` & `status_verifikasi` berubah → update total qurban

**Models** (`app/Models/`) — User, JenisTabungan, HargaEmasHarian, PeriodeQurban, HewanQurban, PendaftaranQurban, Transaksi, RekeningBank, Notifikasi, AuditLog, ImportExportLog

**Resources** (`app/Http/Resources/`) — UserResource, JenisTabunganResource, TransaksiResource, dsb. (10 resource)

**Enums** (`app/Enums/`) — 13 enum (lihat §4.3)

**Policies** — TransaksiPolicy, PendaftaranQurbanPolicy
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
| Storage | File kini lokal; S3 untuk produksi (konfigurasi sudah siap) |

> Rujukan lengkap request/response: `API_DOCUMENTATION.md`. Auto-generated docs: `http://localhost:8000/docs/api`
