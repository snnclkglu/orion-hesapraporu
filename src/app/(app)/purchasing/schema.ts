// Satın Alma — Zod şemaları.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyada durur (progress/schema.ts ve
// purchasing/schema.ts ile aynı desen).

import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { PAYMENT_METHODS } from "@/lib/purchasing/terms";
import { DEFAULT_VAT_RATE } from "@/lib/purchasing/vat";

/**
 * KDV oranı — liste `lib/purchasing/vat.ts`teki `VAT_RATES` ile aynıdır ve
 * ayrışmasını `__tests__/vat.test.ts` engeller (veritabanı kısıtı dâhil).
 * Zod'un literal birleşimi burada elle yazılır çünkü çekirdek saf kalır: sayı
 * listesinden şema üretmek `vat.ts`e zod bağımlılığı sokardı.
 */
const kdvOrani = z
  .union([z.literal(20), z.literal(10), z.literal(1), z.literal(0)])
  .default(DEFAULT_VAT_RATE);

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
    // VADE VE TESLİM SÜRESİ TEKLİFİN PARÇASIDIR (kullanıcı kararı,
    // 15.08.2026): en ucuz fiyat, üç ay vadeli ve altı hafta sonra teslim
    // edilecekse en ucuz teklif değildir. Karşılaştırma tablosu bu iki alan
    // olmadan bir fiyat listesinden ibaret kalırdı.
    paymentMethod: z.enum(["pesin", "kredi_karti", "vadeli"]).default("pesin"),
    paymentTermDays: z.number().int().min(0).max(365).default(0),
    /** 0 = Hazır (stokta) · null = tedarikçi söylemedi. */
    leadTimeDays: z.union([z.number().int().min(0).max(365), z.null()]).default(null),
    note: z.string().trim().max(500).default(""),
    itemNo: z.string().trim().max(40).default(""),
    packageId: z.uuid().nullable().default(null),
    /**
     * TEKLİF PARTİSİ (15.08.2026). Verilmezse eylem AYNI GÜN + AYNI FİRMA
     * partisini arar, yoksa yeni bir parti açar — böylece kodsuz teklif kalmaz.
     */
    batchId: z.uuid().nullable().default(null),
    /** Partinin kapsamı: hangi ekrandan açıldı. */
    scope: z.enum(["hammadde", "ekipman"]).default("ekipman"),
  })
  .superRefine(kurKontrolu);

export const chooseQuoteSchema = z.object({ id: z.uuid() });
export const deleteQuoteSchema = z.object({ id: z.uuid() });

// ————————————————————————————————————————————————————— TEKLİF PARTİSİ
//
// Kullanıcı kararı (15.08.2026): *"Her teklif aç dediğimde bu benzersiz bir
// kodla takip edilebilsin … Teklifi değiştir iptal et düzenle vb özellikler de
// olsun."*

/**
 * Toplu teklifin TEK bir kalemi — adet SORULMAZ (md. 21).
 *
 * TESLİM SÜRESİ SATIRDA ÇÖZÜLMÜŞ HÂLİYLE GELİR: pencere "toplu seçim" ile
 * "kalem bazında değişiklik"i kendi içinde birleştirir ve sunucuya nihai sayıyı
 * yollar. Sunucuda `satır ?? parti` gibi bir yedekleme yazılsaydı, kullanıcının
 * bilerek "Sorulmadı" yaptığı bir kalem sessizce partinin süresine dönerdi —
 * `null` iki farklı şey anlatamaz.
 */
export const bulkQuoteLineSchema = z.object({
  matchKey: anahtar,
  sample: z.string().trim().max(300),
  unitPrice: z.number().nonnegative("Fiyat negatif olamaz."),
  /** 0 = Hazır · null = sorulmadı. */
  leadTimeDays: z.union([z.number().int().min(0).max(365), z.null()]).default(null),
  /**
   * KALEMİN MİKTARI — "adet sorulmaz" kuralının TEK istisnası (15.08.2026).
   *
   * Kural şuna dayanıyordu: *"adet zaten havuzda yazar."* Dayanak PLAKADA
   * ÇÖKER — plakanın havuzda karşılığı yoktur ve olmamalıdır (md. 24). Miktar
   * hiçbir yerde durmazsa karşılaştırmanın "Tutar" sütunu plakada kalıcı
   * olarak boş kalır ve karar yalnız birim fiyattan verilir; 3.537 kg'lık bir
   * kalemde kuruşluk fark gerçek paradır.
   *
   * KULLANICIYA YİNE SORULMAZ ve havuzda karşılığı olan kalemde OKUNMAZ:
   * pencere onu bulunduğu ekrandan (havuz satırı ya da kesim planı) alır,
   * `teklifMiktari` hangisinin konuşacağına tek yerde karar verir.
   */
  qty: z.number().positive().nullable().default(null),
  unit: z.string().trim().max(20).default("Adet"),
});

export const saveBulkQuoteSchema = z
  .object({
    supplier: tedarikci,
    currency: paraBirimi,
    fxRate: z.number().positive().nullable(),
    quotedAt: gun,
    paymentMethod: z.enum(["pesin", "kredi_karti", "vadeli"]).default("pesin"),
    paymentTermDays: z.number().int().min(0).max(365).default(0),
    note: z.string().trim().max(500).default(""),
    scope: z.enum(["hammadde", "ekipman"]).default("hammadde"),
    /**
     * HANGİ TALEBİN CEVABI. Verilmezse eylem KALEM KÜMESİNİN İMZASINDAN
     * eşleştirir (aynı küme → aynı talep), yoksa yeni talep açar.
     */
    requestId: z.uuid().nullable().default(null),
    satirlar: z.array(bulkQuoteLineSchema).min(1, "En az bir kaleme fiyat girin.").max(400),
  })
  .superRefine(kurKontrolu);
export type SaveBulkQuoteInput = z.input<typeof saveBulkQuoteSchema>;

/**
 * PARTİYİ DÜZENLE — başlık + satırlar birlikte yazılır.
 *
 * SATIR KİMLİĞİYLE güncellenir, silip-yazma YOK (`editOrder`in dersi): teklif
 * kimliğine bağlı "kazanan" işareti ve fiyat arşivi izi kaybolmamalı. Yükte
 * olmayan satır SİLİNİR — kullanıcı bir kalemi listeden çıkardıysa o teklif
 * gerçekten geri alınmıştır.
 */
export const editQuoteBatchSchema = z
  .object({
    id: z.uuid(),
    supplier: tedarikci,
    quotedAt: gun,
    currency: paraBirimi,
    fxRate: z.number().positive().nullable(),
    paymentMethod: z.enum(["pesin", "kredi_karti", "vadeli"]).default("pesin"),
    paymentTermDays: z.number().int().min(0).max(365).default(0),
    note: z.string().trim().max(500).default(""),
    satirlar: z
      .array(
        z.object({
          id: z.uuid(),
          unitPrice: z.number().nonnegative(),
          leadTimeDays: z.union([z.number().int().min(0).max(365), z.null()]).default(null),
        })
      )
      .max(400),
  })
  .superRefine(kurKontrolu);
export type EditQuoteBatchInput = z.input<typeof editQuoteBatchSchema>;

export const cancelQuoteBatchSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().max(300).default(""),
});

export const quoteBatchIdSchema = z.object({ id: z.uuid() });

/**
 * PARTİLERİ BİRLEŞTİR — kullanıcı isteği: *"İstersem bu sayfada teklifleri
 * birleştir ayrı diyebileyim."*
 *
 * AYNI FİRMA ŞARTTIR ve bu bir kelepçedir, bir kolaylık değil: parti "bir
 * firmanın bir teklifi"dir ve iki firmayı tek partiye koymak o tanımı bozar —
 * karşılaştırma sütunu kimin fiyatını gösterdiğini söyleyemez olurdu.
 */
export const mergeQuoteBatchesSchema = z.object({
  hedefId: z.uuid(),
  kaynakIdler: z.array(z.uuid()).min(1).max(50),
});

// ————————————————————————————————————————————————————— TEKLİF TALEBİ
//
// Kullanıcı kararı (15.08.2026): *"Bu bölümde teklifi düzenle, teklifi ayır,
// birleştir vb özellikler de olmalı."*
//
// BİRLEŞTİR ve AYIR artık TALEP düzeyindedir: "aynı teklifi birkaç firmadan
// aldım" demek, o firmaların cevaplarını TEK bir talebin altında toplamaktır.
// Parti düzeyindeki birleştirme (aynı firmanın iki listesini tek kodda toplama)
// KALDIRILMADI — o başka bir sorunun cevabıdır ve pencerenin içinde durur.

/** Talepleri tek talepte topla — kalem kümeleri farklı olabilir, şart yok. */
export const mergeQuoteRequestsSchema = z.object({
  hedefId: z.uuid(),
  kaynakIdler: z.array(z.uuid()).min(1).max(50),
});

/** Bir firmanın teklifini talepten ÇIKAR — kendi talebine taşınır. */
export const splitQuoteBatchSchema = z.object({ id: z.uuid() });

export const renameQuoteRequestSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Teklif adı boş olamaz.").max(160),
});

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
  // FİYAT KDV HARİÇTİR (kullanıcı kararı, 14.08.2026): "kullanıcı hep kdv
  // hariç fiyat girer, kdv otomatik gelir". Fiyat arşivi ve bütün panolar bu
  // sayıyı okuyor; KDV yalnız ödenecek tutarı büyütür.
  unitPrice: z.number().nonnegative().nullable(),
  vatRate: kdvOrani,
  /** Satırın MARKA/KALİTE snapshotu (md. 16). */
  quality: z.string().trim().max(120).default(""),
  note: z.string().trim().max(300).default(""),
});

/** Öneri defterine yeni bir marka/kalite yazar (case-folded tekil). */
export const ensureQualitySchema = z.object({
  name: z.string().trim().min(1, "Marka/Kalite gerekli.").max(120),
});
export type EnsureQualityInput = z.input<typeof ensureQualitySchema>;

/**
 * Sipariş BAŞLIĞININ alanları — açma ve düzenleme aynı sözlüğü paylaşır.
 *
 * İki şemaya ayrı ayrı yazılsalardı biri er geç ötekinden ayrılırdı: yeni
 * siparişte zorunlu olan bir alan düzenlemede serbest kalır ve pencere kaydı
 * sessizce eksiltirdi.
 *
 * TERMİN ZORUNLU DEĞİLDİR (kullanıcı kararı, 13.08.2026): *"Termin tarihi
 * girilmeden sipariş açılabilsin ancak daha sonra siparişler bölümünden termin
 * tarihi girilebilsin."* Kural zaten `gun`un sözleşmesinde yazılı — boş metin
 * `null` olur, çünkü tarih HER ZAMAN bilinmez.
 */
const siparisBasligi = {
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
};

/** Başlığın iç tutarlılığı — açma ve düzenleme aynı denetimden geçer. */
const baslikKontrolu = (
  v: { currency: string; fxRate: number | null; paymentMethod: string; paymentTermDays: number; orderedAt: string | null },
  ctx: z.RefinementCtx
) => {
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
};

export const createOrderSchema = z
  .object({
    ...siparisBasligi,
    lines: z.array(orderLineSchema).min(1, "En az bir kalem seçilmeli.").max(500),
  })
  .superRefine(baslikKontrolu);

/**
 * Sipariş DÜZENLEMESİ — kullanıcı kararı 13.08.2026:
 * *"Siparişler sayfasında önceden girilen sipariş düzenlenebilsin."*
 *
 * ÖNCEKİ KARAR (`updateOrderSchema` başlığındaki not) TERSİNE ÇEVRİLDİ. Orada
 * "yanlış sipariş İPTAL edilir, yenisi açılır" yazıyordu ve gerekçesi hâlâ
 * geçerli bir RİSKtir — verilmiş bir siparişin satırlarını değiştirmek, o
 * satırlara bağlı teslim ve ödeme kayıtlarını sessizce geçersizleştirebilir.
 * Ama iptal + yeniden açmak yanlış yazılmış bir birim fiyat için çok pahalı bir
 * yoldu: sipariş numarası yanıyor, teslim ve ödeme işaretleri baştan giriliyor.
 *
 * RİSK KAPATILDI, YOK SAYILMADI:
 *  · Satır KİMLİĞİYLE güncellenir (silinip yeniden yazılmaz) — `received_qty`
 *    ve satırın kendi geçmişi yerinde kalır.
 *  · Çıkarılan satırın paket işareti geri alınır (`editOrder`), yoksa atölye
 *    artık sipariş edilmemiş bir kalemi "ısmarlandı" görmeye devam ederdi.
 *  · YENİ KALEM EKLENMEZ: kalemin havuzdaki karşılığı (paket, iş kalemi, pay
 *    dağılımı) yalnız Talep Havuzu'nda bilinir. Ek kalem için yeni sipariş.
 */
export const editOrderSchema = z
  .object({
    id: z.uuid(),
    ...siparisBasligi,
    lines: z
      .array(orderLineSchema.extend({ id: z.uuid() }))
      .min(1, "Siparişte en az bir kalem kalmalı.")
      .max(500),
  })
  .superRefine(baslikKontrolu);

/**
 * Sipariş HÂL güncellemesi — çiplerin ve takvimin yazdığı alanlar.
 *
 * `editOrderSchema`dan AYRI durur ve ayrılığı bilinçlidir: burası tek bir
 * işaretin (teslim alındı, avans ödendi, termin girildi) yolu, orası bütün bir
 * kaydın düzenlemesi. Tek şemaya indirilseydi bir çipe dokunmak, penceredeki
 * bütün alanları yeniden yazan bir istek üretirdi.
 *
 * TERMİN BURADAN DA YAZILIR (`dueAt`): kullanıcı kararı 13.08.2026 —
 * *"Termin tarihi girilmiş bir siparişin termin tarihi değiştirilebilsin."*
 * Alan `optional`dır ("dokunma"), boş dizge ise "temizle" demektir.
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

/**
 * TALEP HAVUZU SATIR DÜZELTMESİ (md. 1) — otomatik çekilen tanım/adet yanlışsa.
 *
 * `key` (match_key) SABİTtir: yalnız GÖRÜNEN tanım (`label`) ve adet (`qty`)
 * override edilir; boş `label` / null `qty` override'ı KALDIRIR.
 */
export const saveDemandOverrideSchema = z.object({
  key: anahtar,
  sample: z.string().trim().max(300).default(""),
  label: z.string().trim().max(300).default(""),
  qty: z.number().nonnegative().nullable().default(null),
  category: z.string().trim().max(60).default(""),
  note: z.string().trim().max(500).default(""),
});
export type SaveDemandOverrideInput = z.input<typeof saveDemandOverrideSchema>;

/** MANUEL TALEP (md. 21) — havuza elle eklenen kalem. */
export const createManualDemandSchema = z.object({
  sample: z.string().trim().min(1, "Tanım gerekli.").max(300),
  category: z.string().trim().max(60).default("Diğer"),
  itemNo: z.string().trim().max(40).default(""),
  quantity: z.number().nonnegative().nullable().default(null),
  unit: z.string().trim().max(30).default("Adet"),
  weightKg: z.number().nonnegative().nullable().default(null),
  quality: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});
export type CreateManualDemandInput = z.input<typeof createManualDemandSchema>;

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
export type EditOrderInput = z.input<typeof editOrderSchema>;
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;
export type OrderLineInput = z.input<typeof orderLineSchema>;
export type SaveGroupNameInput = z.input<typeof saveGroupNameSchema>;

/** `progress/schema.ts` ile aynı sözleşme; `ok` işlenen satır sayısını taşır. */
/** `no` — kullanıcıya gösterilecek kod (sipariş numarası, teklif parti kodu). */
export type PurchasingActionResult = { error?: string; ok?: number; id?: string; no?: string };
