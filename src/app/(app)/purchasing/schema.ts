// Satın Alma — Zod şemaları.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyada durur (progress/schema.ts ve
// purchasing/schema.ts ile aynı desen).

import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { PAYMENT_METHODS } from "@/lib/purchasing/terms";

/** `YYYY-MM-DD` ya da boş. Boş metin `null` olur — tarih her zaman bilinmez. */
const gun = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tarih GG.AA.YYYY biçiminde olmalı")
  .transform((v) => (v === "" ? null : v));

/** Normalleştirilmiş tanım anahtarı — `normAnahtar` üretir. */
const anahtar = z.string().trim().min(1, "Kalem anahtarı boş olamaz.").max(300);

/**
 * Tedarikçi adı.
 *
 * BÜYÜK HARFE ÇEVRİLİR (`adBuyuk` kuralı, AGENTS.md md. 14): aynı firma
 * "Yılmaz" ve "YILMAZ" olarak iki kez saklanırsa fiyat karşılaştırması
 * bölünür. Dönüşüm burada, yani hangi kapıdan girerse girsin.
 */
const tedarikci = z
  .string()
  .trim()
  .min(1, "Tedarikçi adı gerekli.")
  .max(120)
  .transform((v) => v.toLocaleUpperCase("tr-TR"));

const paraBirimi = z.enum(CURRENCIES);

/**
 * KUR ZORUNLULUĞU — kullanıcı kararı (md. 13):
 * "TL fiyat girilirse eğer kur bilgisi istenecek ve sistemimizde hep euro
 *  görünecek."
 *
 * Satış Takibi'nde öğrenilen ders (md. 16, 11.08.2026): kuru eksik satırı
 * KAYDETMEK ve sonra "kuru eksik" diye saymak yanlıştı; doğrusu o durumu hiç
 * doğurmamaktır. Kontrol bu yüzden şemadadır, ekranda bir uyarı değil.
 */
const kurKontrolu = <T extends { currency: string; fxRate: number | null }>(v: T, ctx: z.RefinementCtx) => {
  if (v.currency !== "EUR" && (v.fxRate == null || v.fxRate <= 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["fxRate"],
      message: "Avro dışı fiyatta kur zorunludur (1 avro kaç birim eder?).",
    });
  }
};

// ————————————————————————————————————————————————————————————— TEKLİF

export const saveQuoteSchema = z
  .object({
    id: z.uuid().optional(),
    matchKey: anahtar,
    sample: z.string().trim().max(300),
    supplier: tedarikci,
    unitPrice: z.number().nonnegative("Fiyat negatif olamaz."),
    currency: paraBirimi,
    fxRate: z.number().positive().nullable(),
    // ADET SORULMAZ (kullanıcı kararı 12.08.2026): teklif BİRİM FİYATtır ve
    // adet zaten talep havuzunda yazar. İki yerde adet tutmak, ikisinin
    // ayrışması demekti. Alan şemadan tamamen kalktı; sütun eski kayıtlar için
    // veritabanında duruyor ve yeni kayıtlarda `null` gider.
    quotedAt: gun,
    validUntil: gun,
    note: z.string().trim().max(500).default(""),
    itemNo: z.string().trim().max(40).default(""),
    packageId: z.uuid().nullable().default(null),
  })
  .superRefine(kurKontrolu);

export const chooseQuoteSchema = z.object({ id: z.uuid() });
export const deleteQuoteSchema = z.object({ id: z.uuid() });

// ———————————————————————————————————————————————————————————— SİPARİŞ

/**
 * Sipariş SATIRI.
 *
 * `itemNo` ve `packageId` BAĞLAMdır, kimlik değil: çok projeli bir siparişte
 * her satır başka bir işe gider (md. 7) ve bu bilgi başlıkta duramaz.
 */
export const orderLineSchema = z.object({
  matchKey: anahtar,
  sample: z.string().trim().max(300),
  itemNo: z.string().trim().max(40).default(""),
  packageId: z.uuid().nullable().default(null),
  partKey: z.string().trim().max(300).default(""),
  qty: z.number().positive("Sipariş adedi sıfırdan büyük olmalı."),
  unit: z.string().trim().max(20).default("Adet"),
  unitPrice: z.number().nonnegative().nullable(),
  note: z.string().trim().max(300).default(""),
});

export const createOrderSchema = z
  .object({
    orderNo: z.string().trim().max(60).default(""),
    supplier: tedarikci,
    orderedAt: gun,
    dueAt: gun,
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentTermDays: z.number().int().min(0).max(365),
    advancePct: z.number().min(0).max(100).nullable(),
    advanceAmount: z.number().min(0).nullable(),
    currency: paraBirimi,
    fxRate: z.number().positive().nullable(),
    note: z.string().trim().max(1000).default(""),
    lines: z.array(orderLineSchema).min(1, "En az bir kalem seçilmeli.").max(500),
  })
  .superRefine((v, ctx) => {
    kurKontrolu(v, ctx);
    // "Vadeli" demek ama vade yazmamak boş bir etikettir: ödeme günü teslim
    // günüyle çakışır ve takvim yalan söyler.
    if (v.paymentMethod === "vadeli" && v.paymentTermDays <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentTermDays"],
        message: "Vadeli ödemede gün sayısı gerekir.",
      });
    }
    // Sipariş tarihi ZORUNLUDUR: ödeme takvimi avansı o güne koyar ve tarihsiz
    // bir sipariş takvimden sessizce düşerdi.
    if (!v.orderedAt) {
      ctx.addIssue({ code: "custom", path: ["orderedAt"], message: "Sipariş tarihi gerekli." });
    }
  });

/**
 * Sipariş güncellemesi — YALNIZ hâl değiştiren alanlar.
 *
 * Kalemler burada DEĞİŞMEZ: verilmiş bir siparişin satırlarını sonradan
 * düzenlemek, o satırlara bağlı teslim ve ödeme kayıtlarını sessizce
 * geçersizleştirirdi. Yanlış girilen sipariş İPTAL EDİLİR ve yenisi açılır
 * (`cancelledAt`); iptal kayıt silmez, fiyat arşivinde iz kalır.
 */
export const updateOrderSchema = z.object({
  id: z.uuid(),
  dueAt: gun.optional(),
  receivedAt: gun.optional(),
  advancePaidAt: gun.optional(),
  balancePaidAt: gun.optional(),
  cancelledAt: gun.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const deleteOrderSchema = z.object({ id: z.uuid() });

// ————————————————————————————————————————————————————————— KALEM DEFTERİ

/**
 * Kalemin kategorisini düzeltir ve/veya notunu yazar.
 *
 * Bu araç Teknik Resimler'in Satın Alma sekmesinden BURAYA TAŞINDI (o sekme
 * kaldırıldı): "Diğer" bir çöp kutusu olamaz ve sözlüğün bilemediğini insan
 * söyleyebilmelidir. Anahtar artık NORMALLEŞTİRİLMİŞ tanımdır, yani düzeltme
 * bir kez yapılır ve o kalem her projede doğru kategoride görünür.
 */
export const saveItemMetaSchema = z.object({
  keys: z.array(anahtar).min(1).max(2000),
  /** Örnek tanım — defter tek başına okunduğunda anlaşılsın diye. */
  samples: z.array(z.string().trim().max(300)).max(2000).default([]),
  /** `null` = kategoriye dokunma; boş dizge = düzeltmeyi kaldır (sözlüğe dön). */
  category: z.string().trim().max(60).nullable().default(null),
  /** `null` = nota dokunma. */
  note: z.string().trim().max(500).nullable().default(null),
});

export type SaveItemMetaInput = z.input<typeof saveItemMetaSchema>;

// —————————————————————————————————————————————————————— ANA GRUP DEFTERİ

export const saveGroupNameSchema = z.object({
  groupCode: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\d-]+$/, "Grup kodu yalnız rakam ve tire içerir."),
  name: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v.toLocaleUpperCase("tr-TR")),
});

export type SaveQuoteInput = z.input<typeof saveQuoteSchema>;
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;
export type OrderLineInput = z.input<typeof orderLineSchema>;
export type SaveGroupNameInput = z.input<typeof saveGroupNameSchema>;

/** `progress/schema.ts` ile aynı sözleşme; `ok` işlenen satır sayısını taşır. */
export type PurchasingActionResult = { error?: string; ok?: number; id?: string };
