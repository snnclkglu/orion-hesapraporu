export const CONSUMABLE_VAT_RATES = [20, 10, 1] as const;

export type ConsumableVatRate = (typeof CONSUMABLE_VAT_RATES)[number];

export interface ConsumableVatLine {
  net: number;
  vatRate: ConsumableVatRate;
}

export interface ConsumableVatTotals {
  net: number;
  vat: number;
  gross: number;
}

/**
 * KDV yalnız giriş ekranındaki fatura kontrolüdür. Dönen `net`, veritabanına
 * yazılan ve analizlerde kullanılan KDV hariç sarf tutarıdır.
 */
export function calculateConsumableVatTotals(
  lines: readonly ConsumableVatLine[]
): ConsumableVatTotals {
  let net = 0;
  let vat = 0;
  for (const line of lines) {
    if (!Number.isFinite(line.net) || line.net < 0) continue;
    net += line.net;
    vat += line.net * (line.vatRate / 100);
  }
  return { net, vat, gross: net + vat };
}
