# 📚 Berkah Mulia — API Documentation (v1)

> **Base URL:** `http://localhost:8000/api/v1`
>
> **Authentication:** Bearer Token (Laravel Sanctum)
>
> **Content-Type:** `application/json` (kecuali endpoint upload file: `multipart/form-data`)
>
> **Format Response:** Semua response menggunakan format JSON standar (lihat [Format Response](#format-response))

---

## Daftar Isi

1. [Format Response](#format-response)
2. [Error Codes](#error-codes)
3. [Authentication dan Registrasi](#1-authentication--registrasi)
4. [Manajemen User (Admin)](#2-manajemen-user-admin)
5. [Jenis Tabungan](#3-jenis-tabungan)
6. [Tabungan Emas Harian](#4-tabungan-emas-harian)
7. [Tabungan Pribadi](#5-tabungan-pribadi)
8. [Tabungan Qurban](#6-tabungan-qurban)
9. [Transaksi dan Verifikasi](#7-transaksi--verifikasi)
10. [Rekening Bank](#8-rekening-bank)
11. [Dashboard dan Progress](#9-dashboard--progress)
12. [Notifikasi](#10-notifikasi)
13. [Audit Log](#11-audit-log)

---

## Format Response

### Sukses (200/201)

```json
{
  "success": true,
  "message": "Berhasil mengambil data",
  "data": { },
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 42,
    "last_page": 3
  }
}
```

> **Catatan:** `meta` hanya muncul pada response yang di-paginasi (endpoint list).

### Error Validasi (422)

```json
{
  "success": false,
  "message": "Data yang dikirim tidak valid.",
  "errors": {
    "email": ["Email wajib diisi.", "Format email tidak valid."],
    "password": ["Password minimal 8 karakter."]
  }
}
```

### Error Umum (4xx/5xx)

```json
{
  "success": false,
  "message": "Anda tidak memiliki akses ke resource ini.",
  "error_code": "FORBIDDEN"
}
```

---

## Error Codes

| HTTP Code | Error Code | Deskripsi |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Token tidak valid atau expired |
| 401 | `INVALID_CREDENTIALS` | Email atau password salah |
| 403 | `FORBIDDEN` | Tidak punya akses ke resource |
| 403 | `ACCOUNT_PENDING` | Akun menunggu persetujuan |
| 403 | `ACCOUNT_REJECTED` | Akun ditolak |
| 403 | `ACCOUNT_SUSPENDED` | Akun dibekukan |
| 403 | `WITHDRAWAL_NOT_ALLOWED` | Penarikan tidak diizinkan |
| 403 | `REGISTRATION_CLOSED` | Pendaftaran qurban ditutup |
| 404 | `NOT_FOUND` | Resource tidak ditemukan |
| 409 | `CONFLICT` | Operasi konflik (misal: verifikasi ganda) |
| 409 | `DUPLICATE` | Transaksi duplikat terdeteksi |
| 422 | — | Validasi gagal (lihat field `errors`) |
| 429 | `TOO_MANY_REQUESTS` | Rate limit tercapai |
| 500 | `SERVER_ERROR` | Kesalahan server |

---

## Pagination

Semua endpoint list mendukung pagination:

| Parameter | Tipe | Default | Deskripsi |
|---|---|---|---|
| `page` | integer | 1 | Halaman yang diminta |
| `per_page` | integer | 15 | Jumlah item per halaman (max: 100) |

---

## Authentication Header

Untuk endpoint yang memerlukan autentikasi, kirim header:

```
Authorization: Bearer {token}
```

---

# 1. Authentication & Registrasi

## 1.1 Register

Mendaftarkan akun baru. Status otomatis `pending` — tidak mendapat token.

```
POST /auth/register
```

**Akses:** Publik (tanpa token)
**Rate Limit:** 5 request/menit

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `name` | string | Ya | max 255 karakter |
| `email` | string | Ya | format email, unique |
| `phone` | string | Ya | max 20 karakter, unique |
| `password` | string | Ya | min 8 karakter, kombinasi huruf+angka |
| `password_confirmation` | string | Ya | harus sama dengan `password` |
| `address` | string | Tidak | max 500 karakter |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmad Fauzi",
    "email": "ahmad@example.com",
    "phone": "081234567890",
    "password": "rahasia123",
    "password_confirmation": "rahasia123",
    "address": "Jl. Merdeka No. 10, Jakarta"
  }'
```

### Contoh Response (201 Created)

```json
{
  "success": true,
  "message": "Registrasi berhasil. Akun Anda menunggu persetujuan admin.",
  "data": {
    "id": 2,
    "name": "Ahmad Fauzi",
    "email": "ahmad@example.com",
    "phone": "081234567890",
    "role": "user",
    "role_label": "Nasabah",
    "status": "pending",
    "status_label": "Menunggu Persetujuan",
    "address": "Jl. Merdeka No. 10, Jakarta",
    "avatar_path": null,
    "email_verified_at": null,
    "approved_at": null,
    "last_login_at": null,
    "created_at": "2026-08-27T14:00:00.000000Z",
    "updated_at": "2026-08-27T14:00:00.000000Z"
  }
}
```

### Contoh Error Response (422)

```json
{
  "success": false,
  "message": "Data yang dikirim tidak valid.",
  "errors": {
    "email": ["Email sudah terdaftar."],
    "password": ["Password harus mengandung kombinasi huruf dan angka."]
  }
}
```

---

## 1.2 Login

Login dan mendapatkan Bearer token.

```
POST /auth/login
```

**Akses:** Publik
**Rate Limit:** 5 request/menit

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `email` | string | Ya |
| `password` | string | Ya |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@berkahmulia.com",
    "password": "password123"
  }'
```

### Contoh Response (200 OK)

```json
{
  "success": true,
  "message": "Login berhasil.",
  "data": {
    "user": {
      "id": 1,
      "name": "Admin Berkah Mulia",
      "email": "admin@berkahmulia.com",
      "phone": "081200000001",
      "role": "admin",
      "role_label": "Administrator",
      "status": "active",
      "status_label": "Aktif",
      "address": null,
      "avatar_path": null,
      "email_verified_at": "2026-08-27T14:00:00.000000Z",
      "approved_at": "2026-08-27T14:00:00.000000Z",
      "last_login_at": "2026-08-27T14:05:00.000000Z",
      "created_at": "2026-08-27T14:00:00.000000Z",
      "updated_at": "2026-08-27T14:05:00.000000Z"
    },
    "token": "1|a1b2c3d4e5f6g7h8i9j0klmnopqrstuvwxyz",
    "token_type": "Bearer"
  }
}
```

### Login Gagal — Akun Pending (403)

```json
{
  "success": false,
  "message": "Akun Anda masih menunggu persetujuan admin.",
  "error_code": "ACCOUNT_PENDING"
}
```

### Login Gagal — Credentials Salah (401)

```json
{
  "success": false,
  "message": "Email atau password salah.",
  "error_code": "INVALID_CREDENTIALS"
}
```

---

## 1.3 Logout

Revoke token aktif.

```
POST /auth/logout
```

**Akses:** User / Admin (Bearer token)

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer {token}"
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Logout berhasil.",
  "data": null
}
```

---

## 1.4 Get Profile (Me)

Mendapatkan data profil user yang sedang login.

```
GET /auth/me
```

**Akses:** User / Admin (Bearer token)

### Contoh Request

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {token}"
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "id": 2,
    "name": "Ahmad Fauzi",
    "email": "ahmad@example.com",
    "phone": "081234567890",
    "role": "user",
    "role_label": "Nasabah",
    "status": "active",
    "status_label": "Aktif",
    "address": "Jl. Merdeka No. 10, Jakarta",
    "avatar_path": null,
    "email_verified_at": null,
    "approved_at": "2026-08-27T14:10:00.000000Z",
    "last_login_at": "2026-08-27T14:15:00.000000Z",
    "created_at": "2026-08-27T14:00:00.000000Z",
    "updated_at": "2026-08-27T14:10:00.000000Z"
  }
}
```

---

## 1.5 Update Profile

Update profil sendiri (nama, phone, alamat, avatar). **Tidak bisa** mengubah `role` atau `status`.

```
PUT /auth/me
```

**Akses:** User / Admin (Bearer token)
**Content-Type:** `multipart/form-data` (jika upload avatar)

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `name` | string | Tidak | max 255 |
| `phone` | string | Tidak | max 20, unique (kecuali milik sendiri) |
| `address` | string | Tidak | max 500 |
| `avatar` | file | Tidak | image, mimes: jpg/jpeg/png, max 2MB |

### Contoh Request

```bash
curl -X PUT http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmad Fauzi Hidayat",
    "phone": "081234567899",
    "address": "Jl. Baru No. 5, Bandung"
  }'
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Profil berhasil diperbarui.",
  "data": {
    "id": 2,
    "name": "Ahmad Fauzi Hidayat",
    "email": "ahmad@example.com",
    "phone": "081234567899",
    "address": "Jl. Baru No. 5, Bandung"
  }
}
```

---

## 1.6 Change Password

Ubah password. Wajib input password lama. Semua token lain di-revoke.

```
POST /auth/change-password
```

**Akses:** User / Admin (Bearer token)

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `current_password` | string | Ya | harus cocok dengan password saat ini |
| `password` | string | Ya | min 8, kombinasi huruf+angka |
| `password_confirmation` | string | Ya | harus sama dengan `password` |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/auth/change-password \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "rahasia123",
    "password": "rahasiaBaru456",
    "password_confirmation": "rahasiaBaru456"
  }'
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Password berhasil diubah. Semua sesi lain telah dikeluarkan.",
  "data": {
    "token": "2|newTokenAbcDef123456...",
    "token_type": "Bearer"
  }
}
```

---

## 1.7 Forgot Password

Kirim link reset password ke email.

```
POST /auth/forgot-password
```

**Akses:** Publik | **Rate Limit:** 5/menit

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `email` | string | Ya |

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Link reset password telah dikirim ke email Anda.",
  "data": null
}
```

---

## 1.8 Reset Password

Reset password menggunakan token dari email.

```
POST /auth/reset-password
```

**Akses:** Publik

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `token` | string | Ya |
| `email` | string | Ya |
| `password` | string | Ya |
| `password_confirmation` | string | Ya |

---

# 2. Manajemen User (Admin)

> Semua endpoint memerlukan **role admin** dan Bearer token.

## 2.1 List Users

```
GET /admin/users
```

### Query Parameters

| Parameter | Tipe | Deskripsi |
|---|---|---|
| `status` | string | `pending`, `active`, `rejected`, `suspended` |
| `role` | string | `admin`, `user` |
| `search` | string | Cari nama/email |
| `page` | integer | Halaman (default: 1) |
| `per_page` | integer | Per halaman (default: 15, max: 100) |

### Contoh Request

```bash
curl -X GET "http://localhost:8000/api/v1/admin/users?status=pending&search=ahmad" \
  -H "Authorization: Bearer {admin_token}"
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil mengambil data pengguna.",
  "data": [
    {
      "id": 2,
      "name": "Ahmad Fauzi",
      "email": "ahmad@example.com",
      "phone": "081234567890",
      "role": "user",
      "status": "pending",
      "status_label": "Menunggu Persetujuan"
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 1, "last_page": 1 }
}
```

---

## 2.2 Detail User

```
GET /admin/users/{id}
```

---

## 2.3 Create User (Manual)

Admin buat user langsung — bisa set status `active`.

```
POST /admin/users
```

### Request Body

| Field | Tipe | Wajib | Default |
|---|---|---|---|
| `name` | string | Ya | |
| `email` | string | Ya | |
| `phone` | string | Ya | |
| `password` | string | Ya | |
| `role` | string | Tidak | `user` |
| `status` | string | Tidak | `active` |
| `address` | string | Tidak | |

---

## 2.4 Update User

```
PUT /admin/users/{id}
```

---

## 2.5 Delete User (Soft Delete)

```
DELETE /admin/users/{id}
```

---

## 2.6 Approve User

Status `pending` menjadi `active`. Kirim notifikasi ke user.

```
POST /admin/users/{id}/approve
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Akun berhasil disetujui.",
  "data": { "id": 2, "status": "active", "approved_by": "Admin Berkah Mulia", "approved_at": "2026-08-27T14:10:00.000000Z" }
}
```

### Error — Bukan Pending (409)

```json
{
  "success": false,
  "message": "Hanya akun berstatus pending yang bisa di-approve.",
  "error_code": "CONFLICT"
}
```

---

## 2.7 Reject User

Wajib sertakan alasan.

```
POST /admin/users/{id}/reject
```

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `rejected_reason` | string | Ya |

---

## 2.8 Suspend User

Bekukan akun aktif. Semua token di-revoke.

```
POST /admin/users/{id}/suspend
```

---

## 2.9 Activate User

Aktifkan kembali akun suspended.

```
POST /admin/users/{id}/activate
```

---

## 2.10 Export Users

```
GET /admin/users/export?format=xlsx
```

## 2.11 Import Users

```
POST /admin/users/import
```

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `file` | file | Ya | xlsx/csv, max 10MB |

## 2.12 Download Import Template

```
GET /admin/users/import/template
```

---

# 3. Jenis Tabungan

## 3.1 List Jenis Tabungan

User hanya lihat aktif, admin bisa filter.

```
GET /jenis-tabungan
```

**Akses:** User / Admin

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil mengambil data jenis tabungan.",
  "data": [
    {
      "id": 1,
      "kode": "emas-harian",
      "nama": "Tabungan Emas Harian",
      "deskripsi": "Tabungan emas dengan setoran harian...",
      "tipe": "emas",
      "tipe_label": "Tabungan Emas",
      "mode_perhitungan": "konversi_unit",
      "target_nominal": null,
      "target_unit": null,
      "unit_label": "gram",
      "tanpa_batas_waktu": true,
      "aturan_pencairan": "manual_admin",
      "metode_pembayaran_diizinkan": ["cash", "transfer"],
      "allow_withdrawal": false,
      "status_aktif": true
    },
    {
      "id": 2,
      "kode": "tabungan-pribadi",
      "nama": "Tabungan Pribadi",
      "tipe": "pribadi",
      "allow_withdrawal": true
    },
    {
      "id": 3,
      "kode": "tabungan-qurban",
      "nama": "Tabungan Qurban",
      "tipe": "qurban",
      "allow_withdrawal": false
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 3, "last_page": 1 }
}
```

## 3.2 Detail Jenis Tabungan

```
GET /jenis-tabungan/{id}
```

## 3.3 Create Jenis Tabungan (Admin)

```
POST /admin/jenis-tabungan
```

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `kode` | string | Ya | max 50, unique |
| `nama` | string | Ya | max 255 |
| `deskripsi` | string | Tidak | |
| `tipe` | string | Ya | `emas`, `pribadi`, `qurban`, `custom` |
| `mode_perhitungan` | string | Ya | `nominal_bebas`, `nominal_tetap`, `konversi_unit` |
| `target_nominal` | decimal | Tidak | min 0 |
| `target_unit` | decimal | Tidak | min 0 |
| `unit_label` | string | Tidak | max 50 |
| `tanggal_mulai` | date | Tidak | YYYY-MM-DD |
| `tanggal_selesai` | date | Tidak | after tanggal_mulai |
| `tanpa_batas_waktu` | boolean | Tidak | default: true |
| `aturan_pencairan` | string | Ya | `otomatis`, `manual_admin`, `tanggal_tertentu` |
| `tanggal_pencairan` | date | Tidak | |
| `metode_pembayaran_diizinkan` | array | Ya | `["cash","transfer"]` |
| `allow_withdrawal` | boolean | Tidak | default: false |
| `config` | object | Tidak | JSON fleksibel |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/admin/jenis-tabungan \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "kode": "tabungan-haji",
    "nama": "Tabungan Haji",
    "deskripsi": "Tabungan khusus persiapan ibadah haji",
    "tipe": "custom",
    "mode_perhitungan": "nominal_bebas",
    "target_nominal": 35000000,
    "tanpa_batas_waktu": true,
    "aturan_pencairan": "manual_admin",
    "metode_pembayaran_diizinkan": ["cash", "transfer"],
    "allow_withdrawal": false
  }'
```

## 3.4 Update Jenis Tabungan (Admin)

```
PUT /admin/jenis-tabungan/{id}
```

## 3.5 Delete Jenis Tabungan (Admin)

Ditolak (409) jika masih ada transaksi terkait.

```
DELETE /admin/jenis-tabungan/{id}
```

## 3.6 Toggle Status (Admin)

```
PATCH /admin/jenis-tabungan/{id}/toggle-status
```

---

# 4. Tabungan Emas Harian

## 4.1 Harga Emas Terkini

Fallback ke harga terakhir jika belum diinput hari ini.

```
GET /emas/harga-terkini
```

**Akses:** User

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "id": 5,
    "tanggal": "2026-08-27",
    "harga_per_gram": "1050000.00",
    "tagihan_harian_default": "50000.00",
    "status_aktif": true,
    "catatan": "Harga emas per 27 Agustus 2026",
    "created_by": "Admin Berkah Mulia",
    "created_at": "2026-08-27T07:00:00.000000Z"
  }
}
```

## 4.2 Riwayat Harga Emas

```
GET /emas/harga-riwayat?dari=2026-08-01&sampai=2026-08-31
```

## 4.3 Input Harga Emas (Admin)

Append-only: jika tanggal sama, baris lama di-deactivate.

```
POST /admin/emas/harga
```

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `tanggal` | date | Ya |
| `harga_per_gram` | decimal | Ya |
| `tagihan_harian_default` | decimal | Tidak |
| `catatan` | string | Tidak |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/admin/emas/harga \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tanggal": "2026-08-27",
    "harga_per_gram": 1050000,
    "tagihan_harian_default": 50000,
    "catatan": "Harga emas per 27 Agustus 2026"
  }'
```

## 4.4 Update Harga Emas (Admin)

Insert versi baru, deactivate lama (baris lama TIDAK berubah).

```
PUT /admin/emas/harga/{id}
```

## 4.5 Hapus Harga Emas (Admin)

Hanya jika belum dipakai transaksi (cek FK).

```
DELETE /admin/emas/harga/{id}
```

## 4.6 Setor Tabungan Emas (User)

Sistem otomatis konversi nominal ke gram: `unit_didapat = nominal / harga_per_gram`

```
POST /emas/setor
```

**Content-Type:** `multipart/form-data` (jika upload bukti)

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `nominal` | decimal | Ya | min 10000 |
| `metode_pembayaran` | string | Ya | `cash` atau `transfer` |
| `rekening_bank_id` | integer | Ya (jika transfer) | exists |
| `bukti_transfer` | file | Ya (jika transfer) | jpg/jpeg/png/pdf, max 2MB |
| `catatan_user` | string | Tidak | max 500 |

### Contoh Request (Transfer)

```bash
curl -X POST http://localhost:8000/api/v1/emas/setor \
  -H "Authorization: Bearer {user_token}" \
  -F "nominal=100000" \
  -F "metode_pembayaran=transfer" \
  -F "rekening_bank_id=1" \
  -F "bukti_transfer=@/path/to/bukti.jpg" \
  -F "catatan_user=Setoran emas harian"
```

### Contoh Response (201)

```json
{
  "success": true,
  "message": "Setoran emas berhasil dicatat. Menunggu verifikasi admin.",
  "data": {
    "id": 1,
    "nomor_referensi": "TRX-20260827-A3F2C1",
    "user_id": 2,
    "jenis_tabungan": {
      "id": 1,
      "kode": "emas-harian",
      "nama": "Tabungan Emas Harian",
      "tipe": "emas"
    },
    "jenis_transaksi": "setor",
    "jenis_transaksi_label": "Setoran",
    "nominal": "100000.00",
    "unit_didapat": "0.0952",
    "harga_acuan_snapshot": "1050000.00",
    "metode_pembayaran": "transfer",
    "metode_pembayaran_label": "Transfer Bank",
    "rekening_bank": {
      "id": 1,
      "nama_bank": "Bank Syariah Indonesia (BSI)",
      "no_rekening": "7171234567",
      "atas_nama": "Berkah Mulia"
    },
    "bukti_transfer_url": "http://localhost:8000/api/v1/bukti-transfer/1",
    "status_verifikasi": "menunggu_verifikasi",
    "status_verifikasi_label": "Menunggu Verifikasi",
    "diverifikasi_oleh": null,
    "diverifikasi_pada": null,
    "catatan_admin": null,
    "catatan_user": "Setoran emas harian",
    "tanggal_transaksi": "2026-08-27",
    "created_at": "2026-08-27T14:30:00.000000Z"
  }
}
```

## 4.6.1 Pencairan Dana Tabungan Emas (User)

Pencairan **FULL saldo** gram emas menjadi rupiah. Hanya dapat diajukan setelah goal tabungan emas tercapai (`saldo gram >= target_emas_gram`). Nominal dihitung server-side: `nominal = saldoGram × harga_per_gram`; `unit_didapat = -1 × saldoGram` (negatif, mengurangi saldo emas setelah diverifikasi).

```
POST /emas/tarik
```

**Akses:** User

**Content-Type:** `application/json`

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `bank_tujuan` | string | Ya | max 100 |
| `no_rekening` | string | Ya | max 50 |
| `atas_nama` | string | Ya | max 100 |
| `catatan_user` | string | Tidak | max 500 |

> Tidak ada field `nominal` — nilai pencairan selalu full saldo, dihitung server-side.

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/emas/tarik \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"bank_tujuan":"Bank Syariah Indonesia (BSI)","no_rekening":"7123456789","atas_nama":"Ahmad Fauzi","catatan_user":"Kebutuhan dana keluarga"}'
```

### Contoh Response (201)

```json
{
  "success": true,
  "message": "Permohonan pencairan emas diajukan. Menunggu verifikasi admin.",
  "data": {
    "id": 8,
    "nomor_referensi": "TRX-20260831-B4D2E9",
    "jenis_transaksi": "tarik",
    "nominal": "1500000.00",
    "unit_didapat": "-1.4286",
    "harga_acuan_snapshot": "1050000.00",
    "status_verifikasi": "menunggu_verifikasi",
    "catatan_user": "Pencairan full saldo ke Bank Syariah Indonesia (BSI) (7123456789 a.n Ahmad Fauzi). Kebutuhan dana keluarga"
  }
}
```

**Error:**
- `422` + `GOAL_NOT_REACHED`: goal belum tercapai (atau target belum diset).
- `422` + `INSUFFICIENT_BALANCE`: tidak ada saldo emas.
- `400`: harga emas belum diinput admin.

## 4.6.2 Pembatalan & Refund Tabungan Emas (User)

Pembatalan tabungan emas **sebelum** goal tercapai → refund **90%** dari nilai saldo terkumpul (potongan **10%**). Stored sebagai transaksi `tarik` dengan `nominal` = full nilai saldo, `unit_didapat` negatif, dan `biaya_penalti` = 10% nilai saldo. Saldo gram nol setelah diverifikasi admin.

```
POST /emas/batal
```

**Akses:** User

**Content-Type:** `application/json`

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `bank_tujuan` | string | Ya | max 100 |
| `no_rekening` | string | Ya | max 50 |
| `atas_nama` | string | Ya | max 100 |
| `catatan_user` | string | Tidak | max 500 |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/emas/batal \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"bank_tujuan":"Bank Syariah Indonesia (BSI)","no_rekening":"7123456789","atas_nama":"Ahmad Fauzi","catatan_user":"Membatalkan tabungan"}'
```

### Contoh Response (201)

```json
{
  "success": true,
  "message": "Permohonan pembatalan & refund diajukan. Menunggu verifikasi admin.",
  "data": {
    "id": 9,
    "nomor_referensi": "TRX-20260831-9C3F1A",
    "jenis_transaksi": "tarik",
    "nominal": "1500000.00",
    "unit_didapat": "-1.4286",
    "biaya_penalti": "150000.00",
    "harga_acuan_snapshot": "1050000.00",
    "status_verifikasi": "menunggu_verifikasi",
    "catatan_user": "Pembatalan tabungan emas. Refund 90%: Rp 1.350.000 (potong 10%: Rp 150.000) ke Bank Syariah Indonesia (BSI) (7123456789 a.n Ahmad Fauzi). Membatalkan tabungan"
  }
}
```

**Error:**
- `422` + `GOAL_REACHED`: goal sudah tercapai — gunakan pencairan `/emas/tarik`.
- `422` + `INSUFFICIENT_BALANCE`: tidak ada saldo emas.
- `400`: harga emas belum diinput admin.

> `biaya_penalti` (decimal nullable) juga diekspos pada `TransaksiResource` / detail transaksi.

## 4.7 Target Tabungan Emas (User)

Setiap user menyimpan target (goal) gram emas yang ingin ditabung. Nilai dibaca melalui `target_emas_gram` pada resource user (`/auth/me`, `/admin/users`).

```
PUT /emas/goal
```

**Akses:** User

### Request Body

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `target_emas_gram` | decimal | Tidak | min 0.01, max 1000000. `null` untuk menghapus target |

### Contoh Request

```bash
curl -X PUT http://localhost:8000/api/v1/emas/goal \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"target_emas_gram": 10}'
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Target tabungan emas berhasil disimpan.",
  "data": {
    "target_emas_gram": 10
  }
}
```

---

# 5. Tabungan Pribadi

## 5.1 Setor Tabungan Pribadi

```
POST /tabungan-pribadi/setor
```

**Akses:** User | Request body sama dengan Setor Emas (tanpa konversi unit).

## 5.2 Tarik Tabungan Pribadi

Hanya jika `allow_withdrawal=true`. Status: `menunggu_verifikasi`.

```
POST /tabungan-pribadi/tarik
```

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `nominal` | decimal | Ya (min 10000) |
| `catatan_user` | string | Tidak |

## 5.3 Progress Tabungan Pribadi

```
GET /tabungan-pribadi/progress
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "jenis_tabungan_id": 2,
    "kode": "tabungan-pribadi",
    "nama": "Tabungan Pribadi",
    "tipe": "pribadi",
    "total_setoran": "2500000.00",
    "total_penarikan": "500000.00",
    "saldo": "2000000.00",
    "pending_amount": "100000.00",
    "total_unit": null,
    "unit_label": null,
    "target": null,
    "target_unit": null,
    "persentase": null
  }
}
```

> `persentase = null` jika tidak ada target (mode open-ended). `pending_amount` TIDAK dihitung ke `saldo`.

## 5.4 Tabungan Custom

Endpoint generik untuk setiap jenis tabungan bertipe `custom`. Batas setoran (min/maks/kelipatan) dibaca dari kolom `config` JSON yang diisi admin di wizard produk.

```
POST /tabungan-custom/{jenisTabungan}/setor
POST /tabungan-custom/{jenisTabungan}/tarik
GET  /tabungan-custom/{jenisTabungan}/progress
```

**Akses:** User. `{jenisTabungan}` = ID Jenis Tabungan tipe `custom`.

### Request Body Setor

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `nominal` | decimal | Ya | Harus memenuhi `min_nominal`/`max_nominal`/`kelipatan` dari config |
| `metode_pembayaran` | `cash`/`transfer` | Ya | |
| `rekening_bank_id` | int | Jika transfer | |
| `bukti_transfer` | file | Jika transfer | jpg/jpeg/png/pdf, max 2MB |
| `catatan_user` | string | Tidak | |

### Request Body Tarik

| Field | Tipe | Wajib |
|---|---|---|
| `nominal` | decimal | Ya |
| `catatan_user` | string | Tidak |

`tarik` hanya berhasil jika `allow_withdrawal=true` (403 `WITHDRAWAL_NOT_ALLOWED`). Response progress identik dengan Tabungan Pribadi.

---

# 6. Tabungan Qurban

## 6.1 Periode Qurban Aktif

```
GET /qurban/periode-aktif
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "id": 1,
    "tahun": 2027,
    "tanggal_buka_pendaftaran": "2026-09-01",
    "tanggal_tutup_pendaftaran": "2026-10-01",
    "tanggal_idul_adha": "2027-06-07",
    "tanggal_pencairan": "2027-05-24",
    "status": "aktif",
    "status_label": "Aktif (Pendaftaran Dibuka)",
    "is_pendaftaran_dibuka": true,
    "hewan_qurban": [
      { "id": 1, "jenis_hewan": "Kambing", "harga_per_unit": "3500000.00", "status_aktif": true },
      { "id": 2, "jenis_hewan": "Sapi", "harga_per_unit": "25000000.00", "status_aktif": true },
      { "id": 3, "jenis_hewan": "Patungan Sapi 1/7", "harga_per_unit": "3571428.00", "status_aktif": true }
    ]
  }
}
```

## 6.2 List Hewan Qurban

```
GET /qurban/hewan
```

## 6.3 Daftar Qurban

Sistem hitung `target_dana = harga_per_unit * jumlah_hewan`.

```
POST /qurban/daftar
```

### Request Body

| Field | Tipe | Wajib |
|---|---|---|
| `hewan_qurban_id` | integer | Ya |
| `jumlah_hewan` | integer | Ya (min 1) |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/qurban/daftar \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"hewan_qurban_id": 1, "jumlah_hewan": 2}'
```

### Contoh Response (201)

```json
{
  "success": true,
  "message": "Pendaftaran qurban berhasil. Target dana: Rp 7.000.000",
  "data": {
    "id": 1,
    "hewan_qurban": { "id": 1, "jenis_hewan": "Kambing", "harga_per_unit": "3500000.00" },
    "jumlah_hewan": 2,
    "target_dana": "7000000.00",
    "total_terkumpul": "0.00",
    "persentase": 0,
    "status": "menabung",
    "status_label": "Sedang Menabung",
    "tanggal_daftar": "2026-08-27"
  }
}
```

## 6.4 Pendaftaran Qurban Saya

```
GET /qurban/pendaftaran-saya
```

## 6.5 Setor Qurban

```
POST /qurban/{pendaftaran_id}/setor
```

Request body sama dengan setor emas.

## 6.6 Progress Qurban

```
GET /qurban/{pendaftaran_id}/progress
```

## 6.7 Buat Periode Qurban (Admin)

```
POST /admin/qurban/periode
```

| Field | Tipe | Wajib | Default |
|---|---|---|---|
| `tahun` | integer | Ya | |
| `tanggal_buka_pendaftaran` | date | Ya | |
| `tanggal_tutup_pendaftaran` | date | Tidak | buka + 1 bulan |
| `tanggal_idul_adha` | date | Ya | |
| `tanggal_pencairan` | date | Tidak | idul_adha - 14 hari |
| `status` | string | Tidak | `draft` |

## 6.8 Tambah Hewan Qurban (Admin)

```
POST /admin/qurban/hewan
```

| Field | Tipe | Wajib |
|---|---|---|
| `jenis_hewan` | string | Ya |
| `harga_per_unit` | decimal | Ya |
| `periode_qurban_id` | integer | Ya |

## 6.9 Monitor Pendaftaran (Admin)

```
GET /admin/qurban/pendaftaran?status=menabung&periode_id=1
```

## 6.10 Cairkan Qurban (Admin)

```
POST /admin/qurban/{pendaftaran_id}/cairkan
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Pendaftaran qurban berhasil dicairkan.",
  "data": {
    "id": 1,
    "status": "sudah_dicairkan",
    "status_label": "Sudah Dicairkan",
    "tanggal_dicairkan": "2027-05-24",
    "dicairkan_oleh": "Admin Berkah Mulia"
  }
}
```

---

# 7. Transaksi & Verifikasi

## 7.1 Riwayat Transaksi Saya

```
GET /transaksi-saya?status=menunggu_verifikasi&jenis_tabungan_id=1
```

## 7.2 Detail Transaksi Saya

```
GET /transaksi-saya/{id}
```

> User hanya bisa lihat transaksi milik sendiri (Policy).

## 7.3 Upload Bukti Transfer

Hanya jika status masih `menunggu_verifikasi`.

```
POST /transaksi/{id}/upload-bukti
```

**Content-Type:** `multipart/form-data`

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `bukti_transfer` | file | Ya | jpg/jpeg/png/pdf, max 2MB |

## 7.4 List Semua Transaksi (Admin)

```
GET /admin/transaksi?status=menunggu_verifikasi&metode=transfer&search=TRX-202
```

## 7.5 Detail Transaksi (Admin)

```
GET /admin/transaksi/{id}
```

## 7.6 Verifikasi Transaksi (Admin)

**Idempotent-safe:** return 409 jika sudah diproses.

```
POST /admin/transaksi/{id}/verifikasi
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Transaksi berhasil diverifikasi.",
  "data": {
    "id": 1,
    "nomor_referensi": "TRX-20260827-A3F2C1",
    "status_verifikasi": "terverifikasi",
    "status_verifikasi_label": "Terverifikasi",
    "diverifikasi_oleh": "Admin Berkah Mulia",
    "diverifikasi_pada": "2026-08-27T14:45:00.000000Z"
  }
}
```

### Error — Sudah Diproses (409)

```json
{
  "success": false,
  "message": "Transaksi ini sudah diproses sebelumnya.",
  "error_code": "CONFLICT"
}
```

## 7.7 Tolak Transaksi (Admin)

Wajib `catatan_admin`. **Idempotent-safe.**

```
POST /admin/transaksi/{id}/tolak
```

| Field | Tipe | Wajib |
|---|---|---|
| `catatan_admin` | string | Ya (max 500) |

### Contoh Request

```bash
curl -X POST http://localhost:8000/api/v1/admin/transaksi/1/tolak \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"catatan_admin": "Bukti transfer tidak jelas. Silakan upload ulang."}'
```

## 7.8 Input Transaksi Cash (Admin)

Otomatis `terverifikasi`.

```
POST /admin/transaksi/cash
```

| Field | Tipe | Wajib |
|---|---|---|
| `user_id` | integer | Ya |
| `jenis_tabungan_id` | integer | Ya |
| `nominal` | decimal | Ya |
| `pendaftaran_qurban_id` | integer | Tidak |
| `catatan_admin` | string | Tidak |

---

# 8. Rekening Bank

## 8.1 List Rekening Bank Aktif

```
GET /rekening-bank
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": [
    {
      "id": 1,
      "nama_bank": "Bank Syariah Indonesia (BSI)",
      "no_rekening": "7171234567",
      "atas_nama": "Berkah Mulia",
      "cabang": "Jakarta Pusat",
      "status_aktif": true
    },
    {
      "id": 2,
      "nama_bank": "Bank Muamalat",
      "no_rekening": "3051234567",
      "atas_nama": "Berkah Mulia",
      "cabang": "Jakarta Selatan",
      "status_aktif": true
    }
  ]
}
```

## 8.2 Tambah Rekening (Admin): `POST /admin/rekening-bank`
## 8.3 Update Rekening (Admin): `PUT /admin/rekening-bank/{id}`
## 8.4 Toggle Status (Admin): `PATCH /admin/rekening-bank/{id}/toggle-status`
## 8.5 Hapus Rekening (Admin): `DELETE /admin/rekening-bank/{id}`

---

# 9. Dashboard & Progress

## 9.1 Dashboard User

```
GET /dashboard
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "tabungan": [
      {
        "jenis_tabungan_id": 1,
        "kode": "emas-harian",
        "nama": "Tabungan Emas Harian",
        "tipe": "emas",
        "total_setoran": "500000.00",
        "total_penarikan": "0.00",
        "saldo": "500000.00",
        "pending_amount": "100000.00",
        "target": null,
        "persentase": null
      },
      {
        "jenis_tabungan_id": 2,
        "kode": "tabungan-pribadi",
        "nama": "Tabungan Pribadi",
        "tipe": "pribadi",
        "total_setoran": "2500000.00",
        "total_penarikan": "500000.00",
        "saldo": "2000000.00",
        "pending_amount": "0.00",
        "target": null,
        "persentase": null
      }
    ],
    "transaksi_pending": 2
  }
}
```

## 9.2 Progress per Jenis Tabungan

```
GET /dashboard/{jenis_tabungan_id}/progress
```

### Contoh Response — Emas (dengan unit)

```json
{
  "data": {
    "jenis_tabungan_id": 1,
    "kode": "emas-harian",
    "total_setoran": "500000.00",
    "saldo": "500000.00",
    "pending_amount": "100000.00",
    "total_unit": "0.4762",
    "unit_label": "gram",
    "target": null,
    "persentase": null
  }
}
```

## 9.3 Dashboard Admin

```
GET /admin/dashboard
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil",
  "data": {
    "total_nasabah_aktif": 150,
    "total_nasabah_pending": 5,
    "transaksi_pending": 12,
    "transaksi_terverifikasi": 1234,
    "rata_rata_waktu_verifikasi_jam": 2.5,
    "total_setoran_terverifikasi": "125000000.00"
  }
}
```

## 9.4 Export Laporan (Admin)

```
GET /admin/laporan/export?jenis_tabungan_id=1&dari=2026-01-01&sampai=2026-08-31&format=xlsx
```

---

# 10. Notifikasi

## 10.1 List Notifikasi

```
GET /notifikasi?dibaca=false
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil mengambil notifikasi.",
  "data": [
    {
      "id": 1,
      "judul": "Transaksi Terverifikasi",
      "pesan": "Setoran emas Anda sebesar Rp 100.000 telah diverifikasi.",
      "tipe": "verifikasi",
      "tipe_label": "Verifikasi Transaksi",
      "data": { "transaksi_id": 1, "nomor_referensi": "TRX-20260827-A3F2C1" },
      "channel": "in_app",
      "dibaca_pada": null,
      "is_dibaca": false,
      "created_at": "2026-08-27T14:45:00.000000Z"
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 1, "last_page": 1, "unread_count": 1 }
}
```

## 10.2 Tandai Dibaca: `PATCH /notifikasi/{id}/read`
## 10.3 Tandai Semua Dibaca: `PATCH /notifikasi/read-all`

---

# 11. Audit Log (Admin, Read-Only)

```
GET /admin/audit-logs?action=verify&model_type=Transaksi&dari=2026-08-01
```

### Contoh Response (200)

```json
{
  "success": true,
  "message": "Berhasil mengambil audit log.",
  "data": [
    {
      "id": 15,
      "user": { "id": 1, "name": "Admin Berkah Mulia" },
      "action": "verify",
      "model_type": "Transaksi",
      "model_id": 1,
      "old_values": { "status_verifikasi": "menunggu_verifikasi" },
      "new_values": { "status_verifikasi": "terverifikasi" },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-08-27T14:45:00.000000Z"
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 1, "last_page": 1 }
}
```

---

# Ringkasan Seluruh Endpoint (72 Total)

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
| 29a | POST | `/emas/tarik` | User |
| 29b | POST | `/emas/batal` | User |
| 30 | GET | `/admin/emas/harga-terkini` | Admin |
| 31 | GET | `/admin/emas/harga-riwayat` | Admin |
| 32 | POST | `/admin/emas/harga` | Admin |
| 33 | PUT | `/admin/emas/harga/{id}` | Admin |
| 34 | DELETE | `/admin/emas/harga/{id}` | Admin |
| 35 | POST | `/tabungan-pribadi/setor` | User |
| 36 | POST | `/tabungan-pribadi/tarik` | User |
| 37 | GET | `/tabungan-pribadi/progress` | User |
| 37a | POST | `/tabungan-custom/{id}/setor` | User |
| 37b | POST | `/tabungan-custom/{id}/tarik` | User |
| 37c | GET | `/tabungan-custom/{id}/progress` | User |
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
| 72 | PUT | `/emas/goal` | User |

---

> Auto-generated OpenAPI docs: `http://localhost:8000/docs/api`
