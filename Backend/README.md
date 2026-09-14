# Berkah Mulia — Backend API

Platform tabungan digital multi-produk (Tabungan Emas Harian, Tabungan Pribadi, dan Tabungan Qurban) berbasis Laravel 11 + REST API.

## Tech Stack

- **Framework:** Laravel 11.x, PHP 8.2+
- **Database:** MySQL 8.0+
- **Auth:** Laravel Sanctum (token-based, Bearer)
- **Import/Export:** maatwebsite/excel
- **Audit Trail:** Manual (tabel `audit_logs`)
- **Role/Permission:** spatie/laravel-permission (extensible)
- **Testing:** Pest
- **API Docs:** dedoc/scramble (auto-generated OpenAPI)

## Setup Instructions

### 1. Clone & Install Dependencies

```bash
git clone <repo-url> berkahmulia-backend
cd berkahmulia-backend
composer install
```

### 2. Environment Configuration

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` sesuai kebutuhan:
- `DB_DATABASE=berkahmulia`
- `DB_USERNAME=root`
- `DB_PASSWORD=`
- `FRONTEND_URL=http://localhost:3000` (untuk CORS whitelist)
- `MAIL_MAILER=log` (development) / `smtp` (production)

### 3. Create Database & Run Migrations

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS berkahmulia"
php artisan migrate --seed
```

### 4. Storage & File Bukti Transfer

```bash
php artisan storage:link   # OPSIONAL — hanya diperlukan jika ada unggahan ke disk publik
```

File bukti transfer memakai disk privat `bukti_transfer` dan **dikirim lewat endpoint ber-API key** (`GET /api/v1/transaksi/{transaksi}/bukti`, `GET /api/v1/admin/gadai/angsuran/{angsuran}/bukti`), sehingga **tidak butuh `storage:link`** dan tidak bisa diakses publik tanpa token.

### 5. Run Development Server

```bash
php artisan serve
```

API tersedia di: `http://localhost:8000/api/v1/...`

### 6. Queue Worker

**Tidak wajib.** Saat ini tidak ada job yang diantrekan — notifikasi, import, dan export berjalan sinkron. Jika nanti ada job `ShouldQueue` yang ditambahkan, jalankan:

```bash
php artisan queue:work --queue=default
```

### 7. Sinkronisasi Harga Emas (sebelum fitur emas dipakai)

Aplikasi **tidak menanam harga emas di seeder** (menghindari data basi). Setelah migrasi, ambil harga dari `anekalogam.co.id/id/logam-mulia` atau input manual lewat menu admin:

```bash
php artisan hargaemas:sync
```

Tanpa ada baris aktif `harga_emas_harian`, endpoint emas mengembalikan 400/404 sampai harga tersedia.

### 8. Task Scheduler (Wajib untuk Auto-close Qurban, Sync Harga & Pengingat Setoran)

Jadwal aktif di `routes/console.php`:
- `hargaemas:sync` — sinkronisasi harga emas (12:00).
- `pengingat:setoran` — notifikasi pengingat bayar setoran menabung emas (10:00 tiap hari; harian tiap hari, mingguan & bulanan mengikuti `tanggal_mulai`).
- Auto-close periode qurban & bersihkan notifikasi lama (daily).

```bash
# Development (run once):
php artisan schedule:run

# Production (crontab):
* * * * * cd /path-to-project && php artisan schedule:run >> /dev/null 2>&1
```

## Default Admin Account

| Field | Value |
|---|---|
| Email | `admin@berkahmulia.com` |
| Password | `password123` |
| Role | `admin` |

## API Documentation

Dokumentasi API otomatis tersedia di:

```
http://localhost:8000/docs/api
```

Powered by [Scramble](https://scramble.dedoc.co/) — auto-generated OpenAPI spec.

## API Prefix

Semua endpoint menggunakan prefix `/api/v1/`:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
...
```

## Struktur Folder

```
app/
  Enums/          # PHP 8.2 backed enums (13 files)
  Http/
    Controllers/Api/V1/
      Auth/       # AuthController
      Admin/      # UserController, JenisTabunganController, HargaEmasController,
                  # QurbanController, TransaksiController, RekeningBankController,
                  # DashboardController, AuditLogController
      *.php       # User-facing controllers
    Requests/     # Form Request classes per endpoint
    Resources/    # API Resource classes (JSON response formatting)
    Middleware/   # EnsureUserIsActive, RoleMiddleware, SecurityHeaders
  Models/         # 11 Eloquent models with relations
  Observers/      # TransaksiObserver (auto-update qurban progress)
  Policies/       # TransaksiPolicy, PendaftaranQurbanPolicy
  Services/       # Business logic (EmasConversion, QurbanTarget, Progress, Transaksi)
  Traits/         # ApiResponse trait
routes/
  api.php         # Semua API routes (prefix /api/v1)
  console.php     # Scheduler (qurban, sinkronisasi harga emas, pengingat setoran)
database/
  migrations/     # 13 migration files
  seeders/        # Admin, JenisTabungan, RekeningBank seeders
```

## Keamanan

- ✅ Sanctum token authentication
- ✅ Rate limiting (login: 5/minute, API: 60/minute)
- ✅ Password policy (min 8 chars, alphanumeric)
- ✅ File upload security (UUID naming, private disk, MIME validation)
- ✅ CORS whitelist (bukan wildcard)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, HSTS)
- ✅ Audit trail immutable (append-only, no update/delete)
- ✅ Idempotency guard (double-submit prevention)
- ✅ Token revocation on password change
- ✅ Soft delete for sensitive data

## License

Proprietary — Berkah Mulia.
