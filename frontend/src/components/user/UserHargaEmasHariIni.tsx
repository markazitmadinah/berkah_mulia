import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { HargaHariIniResponse } from '../../types';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HargaHariIniTable } from '../ui/HargaHariIniTable';

interface Props {
  onBack: () => void;
}

export const UserHargaEmasHariIni: React.FC<Props> = ({ onBack }) => {
  const { activeHargaEmas } = useApp();
  const [data, setData] = useState<HargaHariIniResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHarga = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<HargaHariIniResponse>('/emas/harga-hari-ini');
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
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Harga Emas Hari Ini
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar harga Logam Mulia ANTAM Certicard 99.99%
            </p>
          </div>
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