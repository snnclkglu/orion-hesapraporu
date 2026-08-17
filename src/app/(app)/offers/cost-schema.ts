// Maliyet Zod şemaları. "use server" DEĞİL — şemalar runtime değerdir ve bir
// server action dosyasından export edilemezler (teklifle aynı desen).

import { z } from "zod";

/**
 * Maliyet gövdesi ŞEKİL DOĞRULAMAZ, yalnız bir nesne olmasını ister.
 *
 * Belge modeli `lib/offers/cost/payload.ts`teki `withCostDefaults` ile
 * normalize edilir ve asıl sözleşme ORASIDIR. Zod'a ikinci bir kopya
 * yazılsaydı iki tanım ayrışır, modele yeni bir katsayı eklendiğinde şema onu
 * düşürür ve kullanıcı girdiği veriyi kaybederdi (teklifin `saveRevisionSchema`
 * kararıyla birebir aynı).
 */
export const saveCostSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  notes: z.string().trim().max(4000).default(""),
});

export type SaveCostInput = z.infer<typeof saveCostSchema>;
