import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatRupiah } from '../../utils/format';
import { HargaHariIniResponse } from '../../types';
import { ArrowLeft, Coins, ExternalLink, RefreshCw } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const UserHargaEmasHariIni: React.FC<Props> = ({ onBack }) => {
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
      {/* Header */}
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

      {/* Info Badge */}
      {data && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Update: {data.tanggal} {data.waktu && `pukul ${data.waktu}`}
          </span>
          <a
            href={data.sumber}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Sumber: anekalogam.co.id
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Table */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm overflow-x-auto">
        {loading && !data ? (
          <div className="text-center py-12">
            <RefreshCw className="w-6 h-6 text-slate-300 dark:text-slate-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Memuat harga emas dari Aneka Logam...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-xs font-bold text-rose-500 mb-2">{error}</p>
            <button
              onClick={fetchHarga}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Coba lagi
            </button>
          </div>
        ) : data ? (
          <>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-3 px-3 font-bold">Berat</th>
                  <th className="py-3 px-3 font-bold text-right">Harga Jual (We Sell)</th>
                  <th className="py-3 px-3 font-bold text-right">Harga Beli (We Buy)</th>
                  <th className="py-3 px-3 font-bold text-right hidden sm:table-cell">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {data.items.map((item) => (
                  <tr key={item.berat_gram} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-3">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {item.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        Rp {formatRupiah(item.harga_jual)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        Rp {formatRupiah(item.harga_beli)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right hidden sm:table-cell">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        Rp {formatRupiah(item.harga_jual - item.harga_beli)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[10px] text-slate-400 mt-4 text-center">
              Harga bersifat informatif dan dapat berubah sewaktu-waktu. Harga resmi mengacu pada situs Aneka Logam.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};
