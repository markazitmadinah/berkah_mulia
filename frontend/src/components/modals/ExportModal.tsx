import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { exportTablePdf } from '../../utils/exportPdf';
import { formatRupiah } from '../../utils/format';
import { filterTransaksi } from '../../utils/rekapTransaksi';
import { TransaksiFilters } from '../../types';

type ExportType = 'nasabah' | 'transaksi';
type ExportFormat = 'pdf' | 'xlsx';

interface ExportModalProps {
  type: ExportType;
  isOpen: boolean;
  onClose: () => void;
  filters?: TransaksiFilters;
  aliran?: string;
  periode?: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  user: 'Nasabah',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  rejected: 'Ditolak',
  suspended: 'Dibekukan',
};
const JENIS_LABEL: Record<string, string> = {
  setor: 'Setoran',
  tarik: 'Penarikan',
};
const METODE_LABEL: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
};
const VERIF_LABEL: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
};

export const ExportModal: React.FC<ExportModalProps> = ({ type, isOpen, onClose, filters }) => {
  const { users, transaksi, exportUsers, exportTransaksi, fetchTransaksiForExport, fetchUsersForExport } = useApp();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isNasabah = type === 'nasabah';
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${isNasabah ? 'data_nasabah' : 'pembukuan_transaksi'}_berkah_mulia_${today}`;

  const filteredTransaksi = isNasabah ? [] : filterTransaksi(transaksi, filters || {});

  const rangeText = !isNasabah
    ? (filters?.tanggal_awal || filters?.tanggal_akhir)
      ? `${filters?.tanggal_awal || '…'} s/d ${filters?.tanggal_akhir || '…'}`
      : ''
    : '';

  const buildNasabahRows = (source = users) =>
    source.map((u) => ({
      no: '',
      anggota: u.nomor_anggota || '-',
      username: u.username || '-',
      name: u.name,
      phone: u.phone || '-',
      alamat: u.address || '-',
      role: ROLE_LABEL[u.role] || u.role,
      status: STATUS_LABEL[u.status] || u.status,
      created: u.created_at?.slice(0, 10) || '-',
    }));

  const buildTransaksiRows = (source = filteredTransaksi) =>
    source.map((t) => ({
      no: '',
      ref: t.nomor_referensi,
      nasabah: t.user_name || '-',
      produk: t.jenis_tabungan_nama || '-',
      jenis: JENIS_LABEL[t.jenis_transaksi] || t.jenis_transaksi,
      nominal: t.jenis_transaksi === 'setor' ? `+ Rp ${formatRupiah(t.nominal)}` : `- Rp ${formatRupiah(t.nominal)}`,
      gram: t.unit_didapat ?? 0,
      metode: METODE_LABEL[t.metode_pembayaran] || t.metode_pembayaran,
      tanggal: t.tanggal_transaksi || '-',
      status: VERIF_LABEL[t.status_verifikasi] || t.status_verifikasi,
    }));

  const buildSummary = (source = filteredTransaksi) => {
    const verified = source.filter((t) => t.status_verifikasi === 'terverifikasi');
    const masuk = verified.filter((t) => t.jenis_transaksi === 'setor').reduce((a, t) => a + t.nominal, 0);
    const keluar = verified.filter((t) => t.jenis_transaksi === 'tarik').reduce((a, t) => a + t.nominal, 0);
    const summary = [
      { label: 'Uang Masuk', value: `Rp ${formatRupiah(masuk)}` },
      { label: 'Uang Keluar', value: `Rp ${formatRupiah(keluar)}` },
      { label: 'Selisih Kas', value: `Rp ${formatRupiah(masuk - keluar)}` },
      { label: 'Jumlah Transaksi', value: String(source.length) },
    ];
    if (rangeText) summary.push({ label: 'Periode', value: rangeText });
    return summary;
  };

  const handleExport = async () => {
    setSubmitting(true);
    try {
      if (format === 'xlsx') {
        if (isNasabah) await exportUsers();
        else await exportTransaksi(filters);
      } else {
        if (isNasabah) {
          const pdfUsers = await fetchUsersForExport();
          exportTablePdf(
            'Laporan Data Nasabah',
            `Rekapitulasi nasabah & anggota — ${pdfUsers.length} nasabah terdaftar`,
            `${filename}.pdf`,
            [
              { header: 'No', dataKey: 'no' },
              { header: 'No Anggota', dataKey: 'anggota' },
              { header: 'Username', dataKey: 'username' },
              { header: 'Nama Lengkap', dataKey: 'name' },

              { header: 'No. HP', dataKey: 'phone' },
              { header: 'Alamat', dataKey: 'alamat' },
              { header: 'Peran', dataKey: 'role' },
              { header: 'Status', dataKey: 'status' },
              { header: 'Terdaftar', dataKey: 'created' },
            ],
            buildNasabahRows(pdfUsers)
          );
        } else {
          const pdfTransactions = await fetchTransaksiForExport(filters);
          exportTablePdf(
            'Pembukuan Transaksi Koperasi',
            `Rekap mutasi transaksi ${rangeText ? `— periode ${rangeText} · ` : '— '}${pdfTransactions.length} transaksi tercatat`,
            `${filename}.pdf`,
            [
              { header: 'No', dataKey: 'no' },
              { header: 'No Referensi', dataKey: 'ref' },
              { header: 'Nasabah', dataKey: 'nasabah' },
              { header: 'Produk', dataKey: 'produk' },
              { header: 'Jenis', dataKey: 'jenis' },
              { header: 'Nominal', dataKey: 'nominal' },
              { header: 'Gram Emas', dataKey: 'gram' },
              { header: 'Metode', dataKey: 'metode' },
              { header: 'Tanggal', dataKey: 'tanggal' },
              { header: 'Status', dataKey: 'status' },
            ],
            buildTransaksiRows(pdfTransactions),
            buildSummary(pdfTransactions)
          );
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md sm:my-8 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Export {isNasabah ? 'Data Nasabah' : 'Pembukuan Transaksi'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  format === 'pdf'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                <FileText className={`w-7 h-7 ${format === 'pdf' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className={`font-bold ${format === 'pdf' ? 'text-emerald-700' : 'text-slate-600 dark:text-slate-300'}`}>Export PDF</span>
                <span className="text-[10px] text-slate-400">Laporan siap cetak</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  format === 'xlsx'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                <FileSpreadsheet className={`w-7 h-7 ${format === 'xlsx' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className={`font-bold ${format === 'xlsx' ? 'text-emerald-700' : 'text-slate-600 dark:text-slate-300'}`}>Export XLSX</span>
                <span className="text-[10px] text-slate-400">Buka di Excel (2 sheet)</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                {isNasabah
                  ? 'Seluruh data nasabah akan diexport'
                  : `Seluruh transaksi sesuai filter akan diexport${rangeText ? ` (periode ${rangeText})` : ' (semua periode)'}`}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={submitting}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-600/25 cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {format === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                {submitting ? 'Memproses...' : `Download ${format.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};