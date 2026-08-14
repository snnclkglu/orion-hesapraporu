import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { PAYMENT_METHODS } from "@/lib/purchasing/terms";
import { DEFAULT_VAT_RATE } from "@/lib/purchasing/vat";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin.");

const expenseHeader = {
  expenseDate: isoDate,
  supplierId: z.uuid("Tedarikçi seçin."),
  documentNo: z.string().trim().max(100).default(""),
  department: z.string().trim().max(120).default(""),
  currency: z.enum(CURRENCIES),
  fxRate: z.number().positive("Kur sıfırdan büyük olmalı."),
  fxRateDate: isoDate.nullable().default(null),
  fxSource: z.enum(["daily", "manual"]).default("manual"),
  note: z.string().trim().max(1000).default(""),
};

const paymentHeader = {
  dueAt: isoDate,
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentTermDays: z.number().int().min(0).max(365),
};

export const consumableExpenseLineSchema = z.object({
  itemId: z.uuid("Sarf malzeme seçin."),
  quantity: z.number().positive("Miktar sıfırdan büyük olmalı."),
  unit: z.string().trim().min(1, "Birim gerekli.").max(30),
  unitPrice: z.number().nonnegative("Birim fiyat negatif olamaz."),
  note: z.string().trim().max(500).default(""),
  /** Satırın MARKA/KALİTE snapshotu (md. 18). */
  quality: z.string().trim().max(120).default(""),
  // Oran listesi SİPARİŞLE ORTAKTIR (`lib/purchasing/vat.ts`); %0 14.08.2026'da
  // eklendi ve iki ekran da aynı listeyi gösterir.
  vatRate: z
    .union([z.literal(20), z.literal(10), z.literal(1), z.literal(0)])
    .default(DEFAULT_VAT_RATE),
});

function validateFx(
  value: { currency: string; fxRate: number; paymentMethod?: string; paymentTermDays?: number },
  ctx: z.RefinementCtx
) {
  if (value.currency === "EUR" && value.fxRate !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["fxRate"],
      message: "Avro kaydında kur 1 olmalıdır.",
    });
  }
  if (value.paymentMethod === "vadeli" && (value.paymentTermDays ?? 0) <= 0) {
    ctx.addIssue({ code: "custom", path: ["paymentTermDays"], message: "Vadeli ödeme için gün girin." });
  }
  if (value.paymentMethod && value.paymentMethod !== "vadeli" && value.paymentTermDays !== 0) {
    ctx.addIssue({ code: "custom", path: ["paymentTermDays"], message: "Peşin ve kredi kartında vade 0 gündür." });
  }
}

export const createConsumableExpenseSchema = z
  .object({
    ...expenseHeader,
    ...paymentHeader,
    lines: z.array(consumableExpenseLineSchema).min(1, "En az bir satır ekleyin.").max(50),
  })
  .superRefine(validateFx);

export const updateConsumableExpenseSchema = z
  .object({
    id: z.uuid(),
    ...expenseHeader,
    line: consumableExpenseLineSchema,
  })
  .superRefine(validateFx);

export const deleteConsumableExpenseSchema = z.object({ id: z.uuid() });

export const ensureConsumableItemSchema = z.object({
  name: z.string().trim().min(2, "Malzeme adı gerekli.").max(200),
  groupName: z.string().trim().min(1, "Sarf grubu gerekli.").max(120),
  defaultUnit: z.string().trim().min(1, "Varsayılan birim gerekli.").max(30),
});

export const expenseRateSchema = z.object({
  expenseDate: isoDate,
  currency: z.enum(CURRENCIES),
});

export type CreateConsumableExpenseInput = z.input<typeof createConsumableExpenseSchema>;
export type UpdateConsumableExpenseInput = z.input<typeof updateConsumableExpenseSchema>;
export type EnsureConsumableItemInput = z.input<typeof ensureConsumableItemSchema>;

export type ConsumableActionResult = {
  error?: string;
  ok?: number;
  id?: string;
};
