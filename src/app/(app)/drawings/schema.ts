// Teknik Resimler — Zod şemaları.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyada durur (jobs/sales/worklog ile
// aynı desen).

import { z } from "zod";

/**
 * Sihirbazın sunucuya gönderdiği dosya kaydı.
 *
 * Yalnız YOL, BOYUT ve İMZA gider — ayrıştırmayı sunucu yapar. İstemci de aynı
 * saf işlevleri çağırıp ön-inceleme gösterir ama SONUÇ olarak değil GÖRÜNTÜ
 * olarak; tek doğruluk kaynağı sunucudur. Böylece bir gün tanıyıcı listesi
 * değişince eski tarayıcıdan gelen kayıt yanlış ayrıştırılmış olmaz.
 */
export const uploadFileSchema = z.object({
  relPath: z.string().min(1).max(1024),
  size: z.number().int().min(0),
  checksum: z.string().max(128).default(""),
});

export const createPackageSchema = z.object({
  folderName: z.string().min(1).max(512),
  /**
   * Kalem numarası: klasör adından çözülemezse sihirbaz sorar ve buradan gelir.
   * Boş bırakılabilir — paket YİNE açılır ve "Eşleşmemiş" olarak listelenir.
   */
  itemNoOverride: z.string().max(64).default(""),
  // 454 dosyalık gerçek bir paket var; sınır ona göre cömert tutuldu.
  files: z.array(uploadFileSchema).min(1).max(5000),
});

export const finalizeUploadSchema = z.object({
  packageId: z.uuid(),
  /** Depoya gerçekten yazılabilen dosyaların yolları. */
  storedPaths: z.array(z.string()).max(5000),
});

export const packageIdSchema = z.object({ packageId: z.uuid() });

export const remapItemSchema = z.object({
  packageId: z.uuid(),
  /** Boş bırakılırsa bağlantı KOPARILIR, paket silinmez. */
  jobItemId: z.string().default(""),
  /** Paketin `item_no` METNİNİ de seçilen kaleme çevir. */
  rewriteItemNo: z.boolean().default(false),
});

export const ackFindingSchema = z.object({
  packageId: z.uuid(),
  code: z.string().min(1).max(64),
  subject: z.string().max(1024).default(""),
  note: z.string().max(500).default(""),
});

export const bindAliasSchema = z.object({
  packageId: z.uuid(),
  scope: z.enum(["klasor", "dosya"]).default("dosya"),
  /** Tanınmayan yol ya da klasör adı. */
  pattern: z.string().min(1).max(1024),
  /** Bağlanacak parça kodu. */
  resolvesTo: z.string().min(1).max(64),
});

export type CreatePackageInput = z.input<typeof createPackageSchema>;
export type FinalizeUploadInput = z.input<typeof finalizeUploadSchema>;
export type RemapItemInput = z.input<typeof remapItemSchema>;
export type AckFindingInput = z.input<typeof ackFindingSchema>;
export type BindAliasInput = z.input<typeof bindAliasSchema>;

/** Bütün eylemlerin dönüş tipi — `projects/actions.ts` ile aynı sözleşme. */
export type DrawingActionResult = { error?: string };
