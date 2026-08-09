// Satış Takibi Zod şemaları + satır tipleri. "use server" DEĞİL — şemalar
// runtime değer olduğundan server action dosyasında export edilemez
// (iş emri modülüyle aynı desen).

import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";

const dateOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Boş metin `null`, dolu metin sayı. Negatif tutar/miktar kabul edilmez. */
const numOrNull = z
  .number()
  .nullable()
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Negatif değer girilemez");

export const saleInputSchema = z.object({
  scope: z.string().trim().max(300).default(""),
  due_date: dateOrNull,
  shipment_date: dateOrNull,
  quantity: numOrNull,
  unit: z.string().trim().max(40).default("Adet"),
  unit_weight_kg: numOrNull,
  unit_price: numOrNull,
  currency: z.enum(CURRENCIES),
  fx_rate: numOrNull.refine((v) => v === null || v > 0, "Kur sıfırdan büyük olmalı"),
  shipment_place: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export type SaleInput = z.infer<typeof saleInputSchema>;

/**
 * Satış listesi satırı: iş kalemi + (varsa) ticari kayıt.
 *
 * Ticari kayıt YOKSA alanlar boştur — satır yine listelenir; iş emrinde açılan
 * her kalem bu sayfada kendiliğinden görünür, fiyatı sonra girilir.
 */
export interface SaleRow {
  /** job_items.id — kaydın anahtarı budur, sales tablosunun id'si değil */
  itemId: string;
  itemNo: string;
  productName: string;
  jobId: string;
  jobNo: string;
  /** İş emrindeki resmî unvan */
  customer: string;
  /** Müşteri defterindeki kısaltma ve renk (defter dışı işlerde null) */
  customerShort?: string | null;
  customerHue?: number | null;
  jobStatus: string;
  /** Sözleşme tarihi (yoksa iş emri tarihi) — yıl bu alandan okunur */
  contractDate: string | null;
  hasSale: boolean;
  sale: SaleInput;
  /** Veritabanında türetilen toplamlar (kayıt yoksa null) */
  totalWeightKg: number | null;
  totalPrice: number | null;
  eurAmount: number | null;
}

/** Boş ticari kayıt — henüz fiyat girilmemiş kalem için. */
export const EMPTY_SALE: SaleInput = {
  scope: "",
  due_date: null,
  shipment_date: null,
  quantity: null,
  unit: "Adet",
  unit_weight_kg: null,
  unit_price: null,
  currency: "EUR",
  fx_rate: 1,
  shipment_place: "",
  notes: "",
};

/** Satırın yılı: sözleşme tarihi esastır (Excel'deki "Sözleşme İmza Yılı"). */
export function saleYear(row: Pick<SaleRow, "contractDate">): string {
  return /^(\d{4})/.exec(row.contractDate ?? "")?.[1] ?? "";
}
