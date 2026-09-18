export const MARKUP_1_5_GRAM = 200000;
export const MARKUP_6_10_GRAM = 150000;
export const MARKUP_11_GRAM_PLUS = 100000;

export interface TierHargaJual {
  label: string;
  gramasi_min: number;
  gramasi_max: number | null;
  markup: number;
  harga_jual: number;
}

export function markupPerGram(gram: number): number {
  if (gram <= 5) return MARKUP_1_5_GRAM;
  if (gram <= 10) return MARKUP_6_10_GRAM;
  return MARKUP_11_GRAM_PLUS;
}

export function hargaJualPerGram(hargaPerGram: number, gram: number): number {
  return hargaPerGram + markupPerGram(gram);
}

export function hargaJualTiers(hargaPerGram: number): TierHargaJual[] {
  return [
    { label: '1–5 gram', gramasi_min: 0, gramasi_max: 5, markup: MARKUP_1_5_GRAM, harga_jual: hargaPerGram + MARKUP_1_5_GRAM },
    { label: '6–10 gram', gramasi_min: 5, gramasi_max: 10, markup: MARKUP_6_10_GRAM, harga_jual: hargaPerGram + MARKUP_6_10_GRAM },
    { label: '>10 gram', gramasi_min: 10, gramasi_max: null, markup: MARKUP_11_GRAM_PLUS, harga_jual: hargaPerGram + MARKUP_11_GRAM_PLUS },
  ];
}

// Gram estimasi dari nominal, memakai harga jual bertingkat sesuai gramasi
// (gramasi awal dihitung terhadap harga acuan, lalu harga jual tier-nya dipakai).
export function estimasiGramDariNominal(nominal: number, hargaPerGram: number): number | null {
  if (nominal <= 0 || hargaPerGram <= 0) return null;
  const gramasi = nominal / hargaPerGram;
  const hargaJual = hargaJualPerGram(hargaPerGram, gramasi);
  return nominal / hargaJual;
}