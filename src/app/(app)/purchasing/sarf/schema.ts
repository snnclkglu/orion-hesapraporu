import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";

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

export const consumableExpenseLineSchema = z.object({
  itemId: z.uuid("Sarf malzeme seçin."),
  quantity: z.number().positive("Miktar sıfırdan büyük olmalı."),
  unit: z.string().trim().min(1, "Birim gerekli.").max(30),
  unitPrice: z.number().nonnegative("Birim fiyat negatif olamaz."),
  note: z.string().trim().max(500).default(""),
});

function validateFx(
  value: { currency: string; fxRate: number },
  ctx: z.RefinementCtx
) {
  if (value.currency === "EUR" && value.fxRate !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["fxRate"],
      message: "Avro kaydında kur 1 olmalıdır.",
    });
  }
}

export const createConsumableExpenseSchema = z
  .object({
    ...expenseHeader,
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
