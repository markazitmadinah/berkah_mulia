import React, { useRef, useState, useCallback } from 'react';

export interface PriceChartDatum {
  label: string;
  value: number;
}

interface PriceChartProps {
  data: PriceChartDatum[];
  height?: number;
  valueLabel?: string;
  formatValue?: (v: number) => string;
  formatLabel?: (d: string) => string;
  lineColor?: string;
  gradientId?: string;
  emptyText?: string;
  fillHeight?: boolean;
}

const W = 500;

export type GoldTimeframe = '1W' | '1M' | '1Y';

// 1W = 7 hari terakhir; 1M = tanggal 1 s.d. akhir bulan berjalan; 1Y = rata-rata harga per bulan (12 bulan terakhir)
export function buildGoldChart(
  hist: Array<{ tanggal: string; harga_per_gram: number }>,
  timeframe: GoldTimeframe
): { points: PriceChartDatum[]; basePrice: number | null } {
  const asc = [...hist].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1));
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const monthOf = (d: string) => d.slice(0, 7);

  let points: PriceChartDatum[] = [];
  let basePrice: number | null = null;

  if (timeframe === '1Y') {
    const byKey = new Map<string, { sum: number; n: number }>();
    for (const h of asc) {
      const k = monthOf(h.tanggal);
      const e = byKey.get(k) ?? { sum: 0, n: 0 };
      e.sum += h.harga_per_gram;
      e.n += 1;
      byKey.set(k, e);
    }
    points = [...byKey.keys()].sort().slice(-12).map(k => {
      const e = byKey.get(k)!;
      return { label: k, value: Math.round(e.sum / e.n) };
    });
    basePrice = points[0]?.value ?? null;
    return { points, basePrice };
  }

  if (timeframe === '1W') {
    const cutoff = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    points = asc.filter(h => h.tanggal >= cutoff).map(h => ({ label: h.tanggal, value: h.harga_per_gram }));
    const before = asc.filter(h => h.tanggal < cutoff).pop();
    basePrice = before?.harga_per_gram ?? points[0]?.value ?? null;
    return { points, basePrice };
  }

  // '1M': agregat per minggu (kelompok 7 hari) dalam bulan berjalan, dari tanggal 1 s.d. akhir bulan
  const mkey = today.slice(0, 7);
  const buckets = new Map<number, { sum: number; n: number; first: string }>();
  for (const h of asc) {
    if (monthOf(h.tanggal) !== mkey) continue;
    const b = Math.floor((Number(h.tanggal.slice(8, 10)) - 1) / 7);
    const e = buckets.get(b) ?? { sum: 0, n: 0, first: h.tanggal };
    e.sum += h.harga_per_gram;
    e.n += 1;
    buckets.set(b, e);
  }
  points = [...buckets.keys()].sort((a, b) => a - b).map(b => {
    const e = buckets.get(b)!;
    return { label: e.first, value: Math.round(e.sum / e.n / 500) * 500 };
  });
  const before = asc.filter(h => monthOf(h.tanggal) < mkey).pop();
  basePrice = before?.harga_per_gram ?? points[0]?.value ?? null;
  // Tampilkan titik terakhir dengan harga & tanggal entry terbaru di bulan berjalan
  // (label bucket pertama bisa tampak 'basi' padahal sudah ada data hari ini)
  if (points.length) {
    const latest = [...asc].reverse().find(h => monthOf(h.tanggal) === mkey);
    if (latest) {
      points[points.length - 1] = { label: latest.tanggal, value: latest.harga_per_gram };
    }
  }
  return { points, basePrice };
}

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  height = 100,
  valueLabel = '',
  formatValue,
  formatLabel = (d) => d,
  lineColor = '#10B981',
  gradientId = 'bmChartGrad',
  emptyText = 'Belum ada data riwayat',
  fillHeight = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const n = data.length;

  const min = n ? Math.min(...data.map((d) => d.value)) : 0;
  const max = n ? Math.max(...data.map((d) => d.value)) : 0;
  // rentangkan domain agar gerakan kecil (±0,2%) tak digambar setinggi chart (terlihat berantakan)
  const mid = n ? (max + min) / 2 : 0;
  const spread = Math.max((max - min) * 0.6, mid * 0.02);
  const low = mid - spread;
  const high = mid + spread;
  const band = high - low || 1;

  const pts = data.map((d, i) => ({
    x: n > 1 ? (i / (n - 1)) * W : W / 2,
    y: 6 + (1 - (d.value - low) / band) * (height - 12)
  }));

  // garis horizontal background pada level harga (step "bagus" dari domain harga)
  const rawStep = band / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const dR = rawStep / pow;
  const step = (dR >= 5 ? 10 : dR >= 2 ? 5 : dR >= 1 ? 2 : 1) * pow;
  const gridYs: number[] = [];
  for (let v = Math.ceil(low / step) * step; v <= high; v += step) {
    gridYs.push(6 + (1 - (v - low) / band) * (height - 12));
  }

  const smoothPath = () => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  };

  const line = smoothPath();
  const area = line ? `${line} L ${W} ${height} L 0 ${height} Z` : '';

  const handleMove = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || n < 2) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * W;
      let idx = Math.round((x / W) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      setHoverIdx(idx);
    },
    [n]
  );

  if (n === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        {emptyText}
      </div>
    );
  }

  const px = hoverIdx != null ? (hoverIdx / (n - 1)) * 100 : 0;
  const py = hoverIdx != null ? (pts[hoverIdx].y / height) * 100 : 0;

  return (
    <div className="relative w-full" style={{ height: fillHeight ? '100%' : height }}>
      <svg
        ref={svgRef}
        className="w-full h-full overflow-visible cursor-crosshair"
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => {
          if (e.touches[0]) handleMove(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) handleMove(e.touches[0].clientX);
        }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((gy, i) => (
          <line
            key={'g' + i}
            x1="0"
            x2={W}
            y1={gy}
            y2={gy}
            stroke={lineColor}
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && (
          <path
            d={area}
            fill={`url(#${gradientId})`}
            style={{ animation: 'bm-fade 0.8s ease 0.4s both' }}
          />
        )}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {pts.length > 0 && (
        <div
          className="pointer-events-none absolute w-3 h-3 rounded-full"
          style={{
            left: `${(pts[pts.length - 1].x / W) * 100}%`,
            top: `${(pts[pts.length - 1].y / height) * 100}%`,
            marginLeft: -6,
            marginTop: -6,
            background: lineColor,
            animation: 'bm-pulse 2.4s ease-out infinite'
          }}
        />
      )}
      {pts.map((p, i) => (
        <div
          key={'d' + i}
          className="pointer-events-none absolute w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
          style={{
            left: `${(p.x / W) * 100}%`,
            top: `${(p.y / height) * 100}%`,
            marginLeft: -4,
            marginTop: -4,
            background: lineColor,
            animation: 'bm-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            animationDelay: `${0.15 + i * 0.07}s`
          }}
        />
      ))}

      {hoverIdx != null && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-400/70"
            style={{ left: `${px}%` }}
          />
          <div
            className="pointer-events-none absolute w-3 h-3 rounded-full border-[3px] border-white dark:border-slate-900 shadow-md"
            style={{ left: `calc(${px}% - 6px)`, top: `calc(${py}% - 6px)`, background: lineColor }}
          />
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -170%)' }}
          >
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-bold whitespace-nowrap shadow-lg">
              {formatValue ? formatValue(data[hoverIdx].value) : data[hoverIdx].value.toLocaleString('id-ID')}
              {valueLabel}
              <div className="text-[9px] font-semibold opacity-70 mt-0.5">
                {formatLabel(data[hoverIdx].label)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};