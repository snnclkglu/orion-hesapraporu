// Hammadde eylemlerinin Zod şemaları.
//
// KURAL EKRANDA DEĞİL ŞEMADA DURUR (md. 16'nın "kur eksikken kayıt yapılmaz"
// dersi): kayıt hangi kapıdan girerse girsin aynı kısıtlardan geçer.

import { z } from "zod";
import { HAMMADDE_SINIFLARI } from "@/lib/purchasing/hammadde/siniflar";

const sinif = z.enum(HAMMADDE_SINIFLARI as unknown as [string, ...string[]]);

/** Boş dizge = "ezmeyi KALDIR" (purchase_item_meta deseni). */
const bosOlabilir = z.string().trim().max(240).default("");

/** Ölçü: pozitif olmalı ya da hiç olmamalı. Sıfır bir ölçü değildir. */
const olcu = z
  .union([z.number().positive(), z.null()])
  .optional()
  .transform((v) => v ?? null);

export const saveRawMetaSchema = z.object({
  /** ÇÖZÜCÜNÜN ürettiği stok anahtarı — taşındıktan sonraki değil. */
  keys: z.array(z.string().min(1)).min(1).max(500),
  samples: z.array(z.string()).max(500).default([]),
  /** null = dokunma · "" = düzeltmeyi kaldır · değer = taşı */
  kind: z.union([sinif, z.literal(""), z.null()]).default(null),
  label: z.union([bosOlabilir, z.null()]).default(null),
  note: z.union([bosOlabilir, z.null()]).default(null),
  stockLengthMm: z.union([z.number().positive(), z.literal(0), z.null()]).default(null),
  excluded: z.union([z.boolean(), z.null()]).default(null),
});
export type SaveRawMetaInput = z.infer<typeof saveRawMetaSchema>;

export const createRawManualSchema = z.object({
  sample: z.string().trim().min(2, "Tanım gerekli.").max(240),
  kind: sinif,
  itemNo: z.string().trim().max(40).default(""),
  sectionCode: z.string().trim().max(80).default(""),
  quality: z.string().trim().max(80).default(""),
  thicknessMm: olcu,
  widthMm: olcu,
  lengthMm: olcu,
  outerDiaMm: olcu,
  innerDiaMm: olcu,
  qty: z.union([z.number().positive(), z.null()]).optional().transform((v) => v ?? null),
  unit: z.string().trim().min(1).max(16).default("Adet"),
  weightKg: z.union([z.number().positive(), z.null()]).optional().transform((v) => v ?? null),
  note: z.string().trim().max(500).default(""),
});
export type CreateRawManualInput = z.infer<typeof createRawManualSchema>;

export const updateRawManualSchema = createRawManualSchema.extend({
  id: z.string().uuid(),
});
export type UpdateRawManualInput = z.infer<typeof updateRawManualSchema>;
