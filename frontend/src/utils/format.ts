export const formatRupiah = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Terima "1.234.567,89" / "1234567.89" / "150,5" → 1234567.89 (titik ribuan, koma desimal)
export const parseRupiah = (v: string | number): number => {
  const s = String(v)
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// Format untuk input saat mengetik — koma = pemisah desimal (id-ID), titik = ribuan
export const fmtRupiahTyping = (v: string): string => {
  if (!v) return '';
  const comma = v.indexOf(',');
  let whole = comma === -1 ? v : v.slice(0, comma);
  let dec = comma === -1 ? '' : v.slice(comma + 1).replace(/\D/g, '').slice(0, 2);
  whole = whole.replace(/\D/g, '');
  if (whole && whole !== '0') whole = whole.replace(/^0+(?=\d)/, '');
  const n = whole ? Number(whole) : 0;
  const wholeFmt = n ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : dec ? '0' : '';
  return dec || comma !== -1 ? `${wholeFmt},${dec}` : wholeFmt;
};

// Format bersih saat blur/submit — hilangkan koma menggantung
export const fmtRupiahBlur = (v: string): string => {
  const n = parseRupiah(v);
  return n <= 0 ? '' : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
};
