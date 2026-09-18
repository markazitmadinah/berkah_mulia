import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { HargaHariIniResponse } from '../../types';
import { Coins, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HargaHariIniTable } from '../ui/HargaHariIniTable';

export const AdminHargaHariIni: React.FC = () => {
  const { activeHargaEmas } = useApp();
  const [data, setData] = useState<HargaHariIniResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHarga = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<HargaHariIniResponse>('/admin/emas/harga-hari-ini');
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat harga emas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHarga();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            <span>Harga Emas Hari Ini</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar harga Logam Mulia ANTAM Certicard 99.99%
          </p>
        </div>

        <button
          onClick={fetchHarga}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <HargaHariIniTable data={data} loading={loading} error={error} onRefresh={fetchHarga} hargaPerGram={activeHargaEmas?.harga_per_gram} />
    </div>
  );
};