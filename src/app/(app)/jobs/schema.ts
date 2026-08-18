// İş Emri (FR.11.02) Zod şemaları + tipleri. "use server" DEĞİL — şemalar
// runtime değer olduğundan actions.ts (server) içinde export edilemez; buraya
// alınır ve hem server action hem client form buradan kullanır.

import { z } from "zod";
import { revizyonHarfi } from "@/lib/jobs/is-emri";
import { adBuyuk } from "@/lib/tr-text";

/**
 * AD ALANI — kayda BÜYÜK HARFLE girer (firma kuralı, bkz. `adBuyuk`).
 *
 * Dönüşüm sunucuda da yapılır, yalnız formda değil: iş emri başka bir yoldan
 * (içe aktarma, ileride bir API) yazıldığında da aynı yazımla durmalıdır.
 */
const upperText = (max: number) =>
  z.string().trim().max(max).default("").transform(adBuyuk);

const dateOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const uuidOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Geçersiz kayıt");

export const jobScopeSchema = z.object({
  proje: z.boolean().default(false),
  devreyeAlma: z.boolean().default(false),
  malzeme: z.boolean().default(false),
  nakliye: z.boolean().default(false),
  imalat: z.boolean().default(false),
  montaj: z.boolean().default(false),
});

export const jobItemSchema = z.object({
  item_no: z.string().trim().max(40).default(""),
  product_name: upperText(300),
  quantity: z.string().trim().max(40).default(""),
});

export const jobInputSchema = z.object({
  job_no: z.string().trim().min(1, "İş no gerekli"),
  /**
   * REVİZYON HARFİ — İLK YAYIN REVİZYONSUZDUR, yani BOŞTUR (kullanıcı kararı,
   * 18.08.2026). İş emri revize edildikçe A · B · C diye ilerler ve belgenin
   * kimliğine girer (`ORC-IE-0063-RA`). Dönüşüm formda ve ŞEMADA birden
   * yapılır: kayıt hangi kapıdan girerse girsin harf kümesi dışına çıkamaz —
   * veritabanındaki `jobs_revision_harf` kısıtının TS yarısı.
   */
  revision: z.string().default("").transform(revizyonHarfi),
  title: z.string().trim().min(1, "İş adı gerekli").transform(adBuyuk),
  customer: z.string().trim().min(1, "Müşteri gerekli").transform(adBuyuk),
  /**
   * Müşteri defteri kaydı. Metin alanları (customer, customer_address…) KALIR:
   * iş emri basıldığı andaki müşteri bilgisinin fotoğrafıdır — defter sonradan
   * güncellenince yayınlanmış iş emri değişmemelidir.
   */
  customer_id: uuidOrNull,
  work_order_date: dateOrNull,
  customer_address: z.string().trim().max(400).default(""),
  customer_tax_office: z.string().trim().max(120).default(""),
  customer_tax_no: z.string().trim().max(60).default(""),
  customer_phone: z.string().trim().max(60).default(""),
  customer_fax: z.string().trim().max(60).default(""),
  contract_exists: z.boolean().default(false),
  contract_date: dateOrNull,
  /*
   * SÖZLEŞME DOSYASI BURADA DEĞİLDİR (18.08.2026). `contract_exists` ve
   * `contract_date` kalır — ikisi iş emrinin bilgisidir ve herkes görebilir;
   * DOSYANIN KENDİSİ `job_contracts` tablosuna taşındı ve `can_see_sales()`
   * ile kesiliyor. Yolu burada bırakmak yalnız arayüzden gizlemek olurdu:
   * `jobs` herkese okunur, yani yol da okunur ve imzalı bağlantı oradan
   * üretilebilirdi. Yükleme yeri Satış Bilgisi penceresidir.
   */
  workshop_exit_date: dateOrNull,
  delivery_date: dateOrNull,
  /**
   * SEVK ve MONTAJ ADRESİ — müşteri künyesindeki adresten AYRIDIR. Vinç çoğu
   * zaman fatura adresine değil bir tesise gider; ikisi ayrı sütundur çünkü
   * sevk ile montaj da ayrılabilir (formda montaj varsayılan olarak sevkin
   * aynısıdır, kullanıcı isterse ayırır). BÜYÜK HARFE ÇEVRİLMEZ: adres bir AD
   * değildir (md. 3 kapsamı) ve `customer_address` de çevrilmiyor.
   */
  shipping_address: z.string().trim().max(400).default(""),
  assembly_address: z.string().trim().max(400).default(""),
  quantity_text: z.string().trim().max(60).default(""),
  job_leader: z.string().trim().max(120).default(""),
  prepared_by_name: z.string().trim().max(120).default(""),
  prepared_by_title: z.string().trim().max(120).default(""),
  scope: jobScopeSchema.default({
    proje: false, devreyeAlma: false, malzeme: false,
    nakliye: false, imalat: false, montaj: false,
  }),
  notes: z.string().trim().max(4000).default(""),
  items: z.array(jobItemSchema).max(100).default([]),
});

export type JobInput = z.infer<typeof jobInputSchema>;
export type JobItemInput = z.infer<typeof jobItemSchema>;

// ------------------------------------------------------------------ müşteri

/**
 * Yeni müşteride ZORUNLU tek alan ADIDIR. Vergi dairesi/numarası ve adres iş
 * emri basılırken gerekir ama müşteri çoğu zaman iş açılırken, elde yalnız
 * firma adı varken deftere girilir; zorunlu tutmak kullanıcıyı uydurma değer
 * yazmaya iterdi.
 */
export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Müşteri adı gerekli").max(200).transform(adBuyuk),
  /** Liste ekranlarındaki kısaltma. Boş bırakılırsa adın ilk kelimesi kullanılır. */
  short_name: upperText(40),
  address: z.string().trim().max(400).default(""),
  tax_office: z.string().trim().max(120).default(""),
  tax_no: z.string().trim().max(60).default(""),
  phone: z.string().trim().max(60).default(""),
  fax: z.string().trim().max(60).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/** Defter kaydının okunduğu sütun listesi — action'lar ve sayfalar aynı seti ister. */
export const CUSTOMER_COLUMNS =
  "id, name, short_name, color_hue, address, tax_office, tax_no, phone, fax, notes";

/** Formda müşteri açılır listesini besleyen kayıt. */
export interface CustomerOption extends CustomerInput {
  id: string;
  /** OKLCH ton açısı (0–359) — bkz. lib/tags.ts */
  color_hue: number;
}

// --------------------------------------------------- iş kalemi numaralandırma

/**
 * İş kalemi numaralarının otomatik hâli.
 *
 * Firma kuralı: iş no `0075` ise TEK kalemli işin kalem numarası `0075-00`,
 * ÇOK kalemli işte numaralar `0075-01`den başlar. Yani ikinci kalem eklendiği
 * anda ilk kalemin numarası da `-00`dan `-01`e kayar; bu davranış bilinçlidir
 * ve otomatik numaralandırma açıkken uygulanır.
 *
 * `job_no` zaten `0075-00` gibi son ekli girilmişse kök (ilk tire öncesi)
 * alınır — eski kayıtlar da doğru numaralanır.
 */
export function autoItemNos(jobNo: string, count: number): string[] {
  const base = (jobNo.split("-")[0] ?? "").trim();
  if (!base || count <= 0) return Array.from({ length: Math.max(0, count) }, () => "");
  if (count === 1) return [`${base}-00`];
  return Array.from({ length: count }, (_, i) => `${base}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * İş kalemlerinin adet toplamı — "İş Bilgileri / Adet" alanının otomatik değeri.
 *
 * Adet alanı serbest metindir ("3", "3 Adet", "Muhtelif"); baştaki sayı okunur,
 * sayı yoksa o kalem 0 sayılır. Hiçbir kalemde sayı yoksa boş dönülür ki alan
 * "0" yazmakla yanlış bir kesinlik iddia etmesin.
 */
export function autoQuantityText(items: { quantity: string }[]): string {
  let total = 0;
  let sawNumber = false;
  for (const it of items) {
    const m = /^\s*(\d+(?:[.,]\d+)?)/.exec(it.quantity ?? "");
    if (!m) continue;
    sawNumber = true;
    total += parseFloat(m[1].replace(",", "."));
  }
  if (!sawNumber) return "";
  return String(Number.isInteger(total) ? total : total.toFixed(2).replace(".", ","));
}

// ---------------------------------------------------------------- boş kayıt

/**
 * BOŞ İŞ EMRİ — `"use client"` MODÜLÜNDE DEĞİL BURADA durur.
 *
 * Sabit bir süre `job-form.tsx`teydi ve iki sunucu bileşeni (`jobs/new`,
 * `/dev/jobs-preview`) onu oradan içe aktarıp YAYIYORDU (`{ ...EMPTY_JOB }`).
 * RSC grafiğinde bir istemci modülünün dışa aktarımı GERÇEK DEĞER DEĞİL bir
 * istemci REFERANSIDIR: bütün olarak prop geçirmek çalışır (istemcide çözülür)
 * ama yaymak alanların hiçbirini getirmez — form `scope` alanı olmayan bir
 * nesneyle monte oluyor ve "Cannot read properties of undefined (reading
 * 'proje')" ile patlıyordu. Sabitin yeri şemanın yanıdır; şema zaten hem
 * sunucudan hem istemciden okunan tarafsız modüldür.
 */
export const EMPTY_JOB: JobInput = {
  job_no: "",
  revision: "",
  title: "",
  customer: "",
  customer_id: null,
  work_order_date: "",
  customer_address: "",
  customer_tax_office: "",
  customer_tax_no: "",
  customer_phone: "",
  customer_fax: "",
  contract_exists: false,
  contract_date: "",
  workshop_exit_date: "",
  delivery_date: "",
  shipping_address: "",
  assembly_address: "",
  quantity_text: "",
  job_leader: "",
  prepared_by_name: "",
  prepared_by_title: "",
  scope: { proje: false, devreyeAlma: false, malzeme: false, nakliye: false, imalat: false, montaj: false },
  notes: "",
  items: [],
};
