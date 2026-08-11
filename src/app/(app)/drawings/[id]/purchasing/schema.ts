// Satın Alma — Zod şemaları.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyada durur (progress/schema.ts ile aynı
// desen).

import { z } from "zod";

/**
 * Kategori adı.
 *
 * DESEN DAYATILMAZ, yalnız uzunluk sınırlanır: kullanıcı "Hidrolik" de yazar
 * "Kablo ve Kablo Kanalı" da. Boş ad ve yalnız boşluktan oluşan ad reddedilir —
 * onlar bir kategori değil bir kazadır.
 */
const kategoriAdi = z
  .string()
  .trim()
  .min(1, "Kategori adı boş olamaz.")
  .max(60, "Kategori adı en çok 60 karakter olabilir.");

/** İlerleme anahtarı — `progress/schema.ts` ile aynı dilbilgisi. */
const anahtar = z.string().min(1).max(200);

/**
 * Seçili kalemleri bir kategoriye taşı.
 *
 * TÜMÜ DEĞİL SEÇİLİ OLANLAR: kullanıcı bunu açıkça istedi ve doğrusu da budur —
 * "Diğer"deki otuz kalemin hepsi aynı yere gitmez.
 */
export const movePurchaseCategorySchema = z.object({
  packageId: z.uuid(),
  keys: z.array(anahtar).min(1).max(2000),
  category: kategoriAdi,
});

/** Yeni kategori tanımla (yalnız EK kategoriler defterde durur). */
export const createPurchaseCategorySchema = z.object({
  name: kategoriAdi,
});

export type MovePurchaseCategoryInput = z.input<typeof movePurchaseCategorySchema>;
export type CreatePurchaseCategoryInput = z.input<typeof createPurchaseCategorySchema>;

/** `progress/schema.ts` ile aynı sözleşme; `ok` işlenen satır sayısını taşır. */
export type PurchaseActionResult = { error?: string; ok?: number };
