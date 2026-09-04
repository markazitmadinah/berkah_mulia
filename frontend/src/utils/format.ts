export const formatRupiah = (n: number | string | null | undefined): string =>
  Number(n ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
