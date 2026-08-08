// İş Emri (FR.11.02) Zod şemaları + tipleri. "use server" DEĞİL — şemalar
// runtime değer olduğundan actions.ts (server) içinde export edilemez; buraya
// alınır ve hem server action hem client form buradan kullanır.

import { z } from "zod";

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
  product_name: z.string().trim().max(300).default(""),
  quantity: z.string().trim().max(40).default(""),
});

export const jobInputSchema = z.object({
  job_no: z.string().trim().min(1, "İş no gerekli"),
  title: z.string().trim().min(1, "İş adı gerekli"),
  customer: z.string().trim().min(1, "Müşteri gerekli"),
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
  /** Sözleşme PDF'inin `contracts` bucket'ındaki yolu (boşsa dosya yok) */
  contract_file_path: z.string().trim().max(400).default(""),
  contract_file_name: z.string().trim().max(260).default(""),
  workshop_exit_date: dateOrNull,
  delivery_date: dateOrNull,
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

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Müşteri adı gerekli").max(200),
  address: z.string().trim().max(400).default(""),
  tax_office: z.string().trim().max(120).default(""),
  tax_no: z.string().trim().max(60).default(""),
  phone: z.string().trim().max(60).default(""),
  fax: z.string().trim().max(60).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/** Formda müşteri açılır listesini besleyen kayıt. */
export interface CustomerOption extends CustomerInput {
  id: string;
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
