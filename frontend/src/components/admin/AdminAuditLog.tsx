import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  Calendar,
  Terminal,
  Activity,
  Trash2
} from 'lucide-react';

export const AdminAuditLog: React.FC = () => {
  const { auditLogs, searchQuery, hapusAuditLogs } = useApp();

  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterModel, setFilterModel] = useState<string>('all');
  const [confirmPurge, setConfirmPurge] = useState(false);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.deskripsi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.model.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesModel = filterModel === 'all' || log.model === filterModel;

    return matchesSearch && matchesAction && matchesModel;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Append-Only Immutable Security Ledger
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Audit Log Sistem & Rekam Jejak</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Catatan kepatuhan dan audit aktivitas pengurus/admin yang bersifat read-only tanpa hak ubah/hapus
          </p>
        </div>

        {/* Hapus riwayat — cegah penumpukan data */}
        <button
          type="button"
          onClick={() => {
            if (!confirmPurge) {
              setConfirmPurge(true);
              setTimeout(() => setConfirmPurge(false), 4000);
              return;
            }
            setConfirmPurge(false);
            hapusAuditLogs();
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
            confirmPurge
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/25'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirmPurge ? 'Klik lagi untuk konfirmasi hapus semua' : 'Hapus Riwayat Log'}
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Jenis Aksi</option>
          <option value="APPROVE_USER">Persetujuan User (APPROVE_USER)</option>
          <option value="REJECT_USER">Penolakan User (REJECT_USER)</option>
          <option value="VERIFY_TRANSACTION">Verifikasi Transaksi (VERIFY_TRANSACTION)</option>
          <option value="REJECT_TRANSACTION">Tolak Transaksi (REJECT_TRANSACTION)</option>
          <option value="CREATE_CASH_TRANSACTION">Input Transaksi Cash</option>
          <option value="UPDATE_GOLD_PRICE">Update Harga Emas</option>
          <option value="CAIRKAN_QURBAN">Pencairan Dana Qurban</option>
        </select>

        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="py-2 px-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer"
        >
          <option value="all">Semua Modul Data</option>
          <option value="User">User / Nasabah</option>
          <option value="Transaksi">Transaksi</option>
          <option value="HargaEmas">Harga Emas</option>
          <option value="PendaftaranQurban">Tabungan Qurban</option>
          <option value="JenisTabungan">Jenis Tabungan</option>
          <option value="RekeningBank">Rekening Bank</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-3xl p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">Waktu Kejadian</th>
                <th className="py-3 px-3">Eksekutor</th>
                <th className="py-3 px-3">Aksi (Action)</th>
                <th className="py-3 px-3">Modul</th>
                <th className="py-3 px-3">Deskripsi Perubahan</th>
                <th className="py-3 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Tidak ada catatan audit log yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {log.created_at}
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {log.user_name}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {log.model} #{log.model_id}
                    </td>

                    <td className="py-3 px-3 text-slate-700 dark:text-slate-200">
                      {log.deskripsi}
                    </td>

                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
