import React from 'react';
import { formatRupiah } from '../../utils/format';
import { HargaHariIniResponse } from '../../types';
import { hargaJualPerGram } from '../../utils/hargaJual';
import { Coins, RefreshCw } from 'lucide-react';

interface Props {
  data: HargaHariIniResponse | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  hargaPerGram?: number | null;
}

export const HargaHariIniTable: React.FC<Props> = ({ data, loading, error, onRefresh, hargaPerGram }) => {
  const showMember = typeof hargaPerGram === 'number' && hargaPerGram > 0;
  if (loading && !data) {
    return (
      <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm text-center py-12">
        <RefreshCw className="w-6 h-6 text-slate-300 dark:text-slate-600 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Memuat harga emas dari Aneka Logam...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm text-center py-12">
        <p className="text-xs font-bold text-rose-500 mb-2">{error}</p>
        <button
          onClick={onRefresh}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm overflow-x-auto">
      {/* Info Badge */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5" />
          Update: {data.tanggal} {data.waktu && `pukul ${data.waktu}`}
        </span>
      </div>

      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
            <th className="py-3 px-3 font-bold">Berat</th>
            <th className="py-3 px-3 font-bold text-right">Harga Jual (We Sell)</th>
            <th className="py-3 px-3 font-bold text-right hidden sm:table-cell">Harga Beli (We Buy)</th>
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
                  Rp {formatRupiah(showMember
                    ? Math.round(hargaJualPerGram(hargaPerGram as number, item.berat_gram) * item.berat_gram)
                    : item.harga_jual)}
                </span>
              </td>
              <td className="py-3.5 px-3 text-right">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  Rp {formatRupiah(item.harga_beli)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-slate-400 mt-4 text-center">
        Harga bersifat informatif dan dapat berubah sewaktu-waktu. Harga resmi mengacu pada situs Aneka Logam.
      </p>
    </div>
  );
};