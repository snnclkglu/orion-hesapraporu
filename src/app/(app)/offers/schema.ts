// Teklif Zod şemaları. "use server" DEĞİL — şemalar runtime değerdir ve bir
// server action dosyasından export edilemezler (Satış ve İş Emri modülleriyle
// aynı desen).

import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { OFFER_STATUSES } from "@/lib/offers/status";
import { OFFER_LANGS } from "@/lib/offers/lang";
import { adBuyuk } from "@/lib/tr-text";

/**
 * AD ALANLARI BÜYÜK HARFLE SAKLANIR (değişmez md. 3) ve dönüşüm İKİ YERDE
 * birden yapılır: kullanıcı yazarken (anında görsün) ve burada (kayıt hangi
 * kapıdan girerse girsin öyle olsun). `toUpperCase()` KULLANILMAZ — "İş"i
 * "IS" yapar.
 */
const adAlani = (mesaj: string) => z.string().trim().min(1, mesaj).transform(adBuyuk);

export const newOfferSchema = z.object({
  // Müşteri YALNIZ DEFTERDEN seçilir (IS-14): serbest metin ikinci bir müşteri
  // listesi büyütür ve kısaltma/renk gibi defter alanları o kayıtlara
  // bağlanamaz. "Yeni Müşteri" penceresi defterin kendisine yazar.
  customerId: z.uuid("Müşteri seçilmeli"),
  subject: adAlani("Teklif konusu gerekli"),
  lang: z.enum(OFFER_LANGS).default("tr"),
  currency: z.enum(CURRENCIES).default("EUR"),
  // ŞABLON ALANI YOKTUR (TEKLIF-32): şablon KALEMİN sorusudur, belgenin değil.
});

export type NewOfferInput = z.infer<typeof newOfferSchema>;

export const offerDetailsSchema = z.object({
  subject: adAlani("Teklif konusu gerekli"),
  customerId: z.uuid("Müşteri seçilmeli"),
  status: z.enum(OFFER_STATUSES),
  currency: z.enum(CURRENCIES),
});

export type OfferDetailsInput = z.infer<typeof offerDetailsSchema>;

export const copyOfferSchema = z.object({
  sourceOfferId: z.uuid("Kaynak teklif gerekli"),
  customerId: z.uuid("Müşteri seçilmeli"),
  subject: adAlani("Teklif konusu gerekli"),
});

export type CopyOfferInput = z.infer<typeof copyOfferSchema>;

/**
 * Revizyon gövdesi ŞEKİL DOĞRULAMAZ, yalnız bir nesne olmasını ister.
 *
 * Belge modeli `lib/offers/payload.ts`teki `withDefaults` ile normalize edilir
 * ve asıl sözleşme ORASIDIR. Zod'a ikinci bir kopya yazmak, iki tanımın
 * ayrışması demekti: yeni bir alan eklendiğinde şema onu düşürür ve kullanıcı
 * kaydettiği veriyi kaybederdi.
 */
export const saveRevisionSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  notes: z.string().trim().max(4000).default(""),
});

export type SaveRevisionInput = z.infer<typeof saveRevisionSchema>;

/** Defterin listeleri kapalı değildir: yazılan değer tek tıkla deftere girer. */
export const ensureOptionSchema = z.object({
  listKey: z.string().trim().min(1),
  value: z.string().trim().min(1).max(500),
  /** Kademeli listelerde ebeveyn maddenin kimliği (marka → tip/seri). */
  parentId: z.uuid().nullable().default(null),
});

export type EnsureOptionInput = z.infer<typeof ensureOptionSchema>;
