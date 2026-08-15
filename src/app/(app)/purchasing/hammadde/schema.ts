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
  /** null = dokunma · "" = düzeltmeyi kaldır · değer = kaliteyi ez */
  quality: z.union([bosOlabilir, z.null()]).default(null),
  /** null = dokunma · 0 = düzeltmeyi kaldır · değer = adedi ez */
  qty: z.union([z.number().positive(), z.literal(0), z.null()]).default(null),
});
/**
 * GİRDİ TİPİ `z.input`TİR, `z.infer` DEĞİL.
 *
 * Alanların çoğu "dokunma" anlamına gelen `null` varsayılanını taşıyor;
 * `z.infer` çıktı tipini verir ve çağıranı DOKUNMAYACAĞI alanları da tek tek
 * `null` yazmaya zorlardı. Tek bir notu kaydeden pencerenin sekiz alan
 * saymasının hiçbir kazancı yok.
 */
export type SaveRawMetaInput = z.input<typeof saveRawMetaSchema>;

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

/**
 * PARÇA ÖLÇÜSÜ DÜZELTMESİ.
 *
 * YENİ TANIM İSTEMCİDE ÜRETİLİR (`tanimiOlcuyleYaz`) ve sunucu onu OLDUĞU GİBİ
 * saklar. Sunucuda yeniden üretmek, aynı metin yeniden yazma kuralını ikinci
 * kez yazmak olurdu — ve iki yazım bir gün ayrışırdı (`moveToEquipmentSchema`
 * ile aynı gerekçe). Sunucunun işi ölçmek değil, sınırı korumaktır.
 *
 * BOŞ TANIM = DÜZELTMEYİ KALDIR (`purchase_item_meta` deseni): satır silinir
 * ve parça ressamın yazdığı hâline döner.
 */
export const saveRawPartDimsSchema = z.object({
  partKey: z.string().trim().min(1).max(240),
  /** Ressamın yazdığı ham tanım — kanıt olarak saklanır, ezilmez. */
  sample: z.string().trim().max(240).default(""),
  label: z.string().trim().max(240).default(""),
  note: z.string().trim().max(500).default(""),
});
export type SaveRawPartDimsInput = z.input<typeof saveRawPartDimsSchema>;

/**
 * EKİPMANA TAŞIMA — hammadde satırını öteki havuza geçirir.
 *
 * `hamTanimlar` İSTEMCİDEN GELİR ve bu bilinçli: taşınan şey bir STOK
 * KALEMİDİR ama ekipman havuzu PARÇA TANIMLARIYLA çalışır. Köprüyü sunucuda
 * yeniden kurmak, aynı çözümlemeyi ikinci kez yazmak olurdu — ve iki
 * çözümleme bir gün ayrışırdı.
 */
export const moveToEquipmentSchema = z.object({
  key: z.string().min(1),
  sample: z.string().trim().max(240).default(""),
  hamTanimlar: z.array(z.string().trim().min(1)).min(1).max(2000),
  /** false = geri al (ekipmandan hammaddeye döndür) */
  tasi: z.boolean().default(true),
});
export type MoveToEquipmentInput = z.infer<typeof moveToEquipmentSchema>;
