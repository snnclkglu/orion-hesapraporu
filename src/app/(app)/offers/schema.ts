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
  /**
   * Teklifi veren hazırlayan firma. `null` = standart ORION VİNÇ.
   * Hazırlayan firma da aynı müşteri defterinden seçilir; serbest kurum adı ikinci bir
   * logo/künye defteri oluştururdu.
   */
  issuerCustomerId: z.uuid("Teklifi hazırlayan firma geçersiz").nullable().default(null),
  // ŞABLON ALANI YOKTUR (TEKLIF-32): şablon KALEMİN sorusudur, belgenin değil.
});

export type NewOfferInput = z.infer<typeof newOfferSchema>;

/**
 * TEKLİF KONUSU — kapaktan düzenlenir.
 *
 * Kullanıcı isteği (18.08.2026): *"KAPAK bölümünde teklif Konusunu
 * düzenleyebilmeliyim. PDF ismi de oradan çeksin."* Konu bugüne kadar yalnız
 * teklif AÇILIRKEN soruluyordu; oysa kapsam çalışırken netleşir ve dosya adı
 * ("32T x 30M PORTAL VİNÇ - TETR-… - REV 01.pdf") tam da o metinden kurulur.
 *
 * KONU BELGENİN DEĞİL TEKLİFİN ALANIDIR (`offers.subject`), revizyonun
 * payload'ında durmaz: liste, dosya adı, altbilgi künyesi ve maliyet
 * belgesinin adı hep onu okur. Payload'a taşınsaydı her revizyon başka bir
 * konu taşıyabilir ve teklif listesi hangisini göstereceğini bilemezdi.
 *
 * BÜYÜK HARF SAKLANIR (`adBuyuk`, değişmez md. 3) — `toUpperCase()` DEĞİL.
 */
export const offerSubjectSchema = z.object({
  subject: adAlani("Teklif konusu gerekli"),
});

export type OfferSubjectInput = z.infer<typeof offerSubjectSchema>;

export const offerDetailsSchema = z.object({
  subject: adAlani("Teklif konusu gerekli"),
  customerId: z.uuid("Müşteri seçilmeli"),
  status: z.enum(OFFER_STATUSES),
  currency: z.enum(CURRENCIES),
  /**
   * Yalnız kazanılmış teklifte anlamlıdır. Opsiyonel oluşu, teklif detayındaki
   * hızlı durum seçicisinin mevcut tarihi bilmeden diğer künye alanlarını
   * gönderebilmesini sağlar; ana düzenleme penceresi alanı açıkça yollar.
   */
  wonOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Kazanılma tarihi geçersiz")
    .nullable()
    .optional(),
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
  /**
   * NOT VERİLMEZSE DOKUNULMAZ — ve bu `.default("")` DEĞİLDİR.
   *
   * Editör her kayıtta `notes: ""` gönderiyordu; elle kaydederken zararsızdı
   * ama otomatik kayıtla birlikte revizyon notunu SANİYEDE BİR boşaltmak
   * demek oldu. Not editörde düzenlenmiyor: yeni revizyon açılırken bir
   * öncekinden kopyalanıyor (`newOfferRevision`) ve orası tek yazarı.
   * `undefined` = "bu alanı ilgilendirmeyen bir kayıt"; boş metin = "notu sil".
   */
  notes: z.string().trim().max(4000).optional(),
  /**
   * ARKA PLAN KAYDI (otomatik kayıt): liste yolları TAZELENMEZ.
   *
   * `revalidatePath` her çağrıda yürürlükteki RSC ağacını da yeniden
   * çektirir; her yazma duraklamasında bunu yapmak, kullanıcı yazarken sürekli
   * bir ağ turu ve olası odak/kaydırma sıçraması demekti. Liste ve panel
   * sayfaları `force-dynamic`tir, yani oraya gidildiğinde zaten taze
   * üretilirler — tazeleme onların DOĞRULUĞU için değil, hızı için vardı.
   */
  background: z.boolean().default(false),
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
