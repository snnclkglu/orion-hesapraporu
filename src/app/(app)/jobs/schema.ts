// İş Emri (FR.11.02) Zod şemaları + tipleri. "use server" DEĞİL — şemalar
// runtime değer olduğundan actions.ts (server) içinde export edilemez; buraya
// alınır ve hem server action hem client form buradan kullanır.

import { z } from "zod";

const dateOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

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
  work_order_date: dateOrNull,
  customer_address: z.string().trim().max(400).default(""),
  customer_tax_office: z.string().trim().max(120).default(""),
  customer_tax_no: z.string().trim().max(60).default(""),
  customer_phone: z.string().trim().max(60).default(""),
  customer_fax: z.string().trim().max(60).default(""),
  contract_exists: z.boolean().default(false),
  contract_date: dateOrNull,
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
