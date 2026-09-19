import { RekapPeriod, RekapRow, Transaksi, TransaksiFilters } from '../types';

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtLong(s: string): string {
  return toDate(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtShort(s: string): string {
  return toDate(s).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function startOfWeek(s: string): Date {
  const d = toDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function filterTransaksi(list: Transaksi[], f: TransaksiFilters): Transaksi[] {
  return list.filter((t) => {
    if (f.status && f.status !== 'all' && t.status_verifikasi !== f.status) return false;
    if (f.metode && f.metode !== 'all' && t.metode_pembayaran !== f.metode) return false;
    if (f.tipe && f.tipe !== 'all' && t.tipe_tabungan !== f.tipe) return false;
    if (f.jenis_tabungan_id && t.jenis_tabungan_id !== f.jenis_tabungan_id) return false;
    if (f.search?.trim()) {
      const search = f.search.trim().toLowerCase();
      const haystack = [
        t.nomor_referensi,
        t.user_name,
        t.user_phone,
        t.user_nomor_anggota,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (f.tanggal_awal && t.tanggal_transaksi < f.tanggal_awal) return false;
    if (f.tanggal_akhir && t.tanggal_transaksi > f.tanggal_akhir) return false;
    return true;
  });
}

export function buildRekap(list: Transaksi[], period: RekapPeriod): RekapRow[] {
  const sorted = [...list].sort((a, b) => a.tanggal_transaksi.localeCompare(b.tanggal_transaksi));
  const map = new Map<string, RekapRow>();

  for (const t of sorted) {
    let key: string;
    let label: string;

    if (period === 'harian') {
      key = t.tanggal_transaksi;
      label = fmtLong(t.tanggal_transaksi);
    } else if (period === 'mingguan') {
      const start = startOfWeek(t.tanggal_transaksi);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      key = isoDate(start);
      label = `${fmtShort(isoDate(start))} – ${fmtShort(isoDate(end))}`;
    } else {
      key = t.tanggal_transaksi.slice(0, 7);
      label = toDate(`${key}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    let row = map.get(key);
    if (!row) {
      row = { label, mulai: key, selesai: key, masuk: 0, keluar: 0, selisih: 0, jumlah: 0 };
      map.set(key, row);
    }
    row.jumlah += 1;
    if (t.status_verifikasi === 'terverifikasi') {
      if (t.jenis_transaksi === 'setor') row.masuk += t.nominal;
      else row.keluar += t.nominal;
    }
  }

  const rows = [...map.values()];
  for (const r of rows) r.selisih = r.masuk - r.keluar;
  return rows;
}