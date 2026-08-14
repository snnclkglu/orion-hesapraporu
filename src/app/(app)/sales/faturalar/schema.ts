import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fatura tarihi gerekli.");

export const createInvoiceSchema = z
  .object({
    itemNo: z.string().trim().max(40).default(""),
    invoiceDate: isoDate,
    invoiceNo: z.string().trim().max(100).default(""),
    customerId: z.uuid().nullable().default(null),
    customer: z.string().trim().min(1, "Müşteri gerekli.").max(200),
    qty: z.number().positive("Adet sıfırdan büyük olmalı."),
    unitPrice: z.number().nonnegative("Birim fiyat negatif olamaz."),
    currency: z.enum(CURRENCIES),
    fxRate: z.number().positive().nullable(),
    note: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.currency !== "EUR" && (v.fxRate == null || v.fxRate <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["fxRate"],
        message: "Avro dışı faturada kur gerekli (1 avro kaç birim eder?).",
      });
    }
  });

export const createInvoiceCustomerSchema = z.object({
  name: z.string().trim().min(1, "Müşteri adı gerekli.").max(200),
});

export const deleteInvoiceSchema = z.object({ id: z.uuid() });

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type CreateInvoiceCustomerInput = z.input<typeof createInvoiceCustomerSchema>;
export type SalesInvoiceActionResult = {
  error?: string;
  ok?: number;
  id?: string;
  customer?: { id: string; name: string; short: string | null; hue: number | null };
};
