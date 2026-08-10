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

/**
 * Paket AÇILIŞI — dosya listesi TAŞIMAZ.
 *
 * Eskiden bütün dosya kayıtları bu çağrının gövdesindeydi ve `next.config.ts`te
 * bir ayar olmadığı için Server Action gövde sınırı 1 MB'tı. Ölçüldü: dosya
 * başına ~170 bayt (yol + 64 haneli imza + boyut) → 2000 dosyada ~340 KB,
 * 5000 dosyada ~850 KB. Türkçe karakterli derin yollarla sınır aşılırdı ve
 * hata, ekranda "paket kaydı açılamadı" diye görünürdü.
 *
 * Çözüm sınırı YÜKSELTMEK DEĞİL, sınırı İLGİSİZ KILMAKTIR: paket açılır,
 * satırlar `addPackageFiles` ile öbek öbek gider, sonra `sealPackageFiles`
 * tanımayı bütün adlara bakarak SUNUCUDA yapar.
 */
export const createPackageSchema = z.object({
  folderName: z.string().min(1).max(512),
  /**
   * Kalem numarası: klasör adından çözülemezse sihirbaz sorar ve buradan gelir.
   * Boş bırakılabilir — paket YİNE açılır ve "Eşleşmemiş" olarak listelenir.
   */
  itemNoOverride: z.string().max(64).default(""),
  /** Yeni revizyon açılıyorsa süperse edilecek paket. */
  supersedesId: z.uuid().optional(),
});

/**
 * Dosya satırları — ÖBEK ÖBEK.
 *
 * Öbek boyu istemcide 500'dür; şema sınırı onun iki katı ki bir gün öbek boyu
 * büyütülürse şema sessiz bir tavan olmasın.
 */
export const addPackageFilesSchema = z.object({
  packageId: z.uuid(),
  files: z.array(uploadFileSchema).min(1).max(1000),
  /**
   * Aynı `rel_path` zaten varsa ne yapılsın.
   *
   * `hata` — sihirbazın öbekleri (aynı yol iki kez gelmemeli).
   * `yeniSurum` — "Dosya Ekle" akışı: eski satır `superse` olur, baytları
   *   kalır, yenisi canlı olarak eklenir. İPTAL klasörünün elle yaptığı şeyin
   *   aynısı; yeni bir paket açmaya gerek yoktur.
   * `atla` — sürdürme kipi: satır zaten yazılmış, yalnız yolu geri istiyoruz.
   */
  onConflict: z.enum(["hata", "yeniSurum", "atla"]).default("hata"),
});

/**
 * Yükleme sonucu — YOL DEĞİL KİMLİK.
 *
 * Eskiden depoya ulaşan dosyalar `.in("rel_path", 200 yol)` ile işaretleniyordu
 * ve postgrest-js `.in()` değerlerini SORGU DİZİSİNE koyar. Gerçek yollar
 * yüzde kodlanınca ~120 karakter ediyor: tek istekte 22–26 KB URL. Bugün
 * çalışıyor olması bir tesadüftür — Cloudflare ~16 KB'de, nginx 8 KB'de keser
 * ve 414 döndüğünde `finalizeUpload` sessizce `{error}` dönerdi.
 *
 * 36 karakterlik UUID'lerle aynı iş 50'lik öbekte ~2 KB URL eder.
 */
export const finalizeUploadSchema = z.object({
  packageId: z.uuid(),
  /** Depoya gerçekten yazılabilen dosyaların kimlikleri. */
  storedFileIds: z.array(z.uuid()).max(5000).default([]),
  /**
   * Yazılamayanlar ve SEBEBİ.
   *
   * Sebebin saklanması bu fazın asıl dersidir: eski sihirbaz `error.message`i
   * atıyordu ve "neden ulaşmadı" sorusu bir daha cevaplanamıyordu.
   */
  failed: z
    .array(
      z.object({
        fileId: z.uuid(),
        message: z.string().max(500).default(""),
      })
    )
    .max(5000)
    .default([]),
});

export const packageIdSchema = z.object({ packageId: z.uuid() });

/**
 * Paket silme — AD YAZILARAK onaylanır.
 *
 * 174 dosya, 121 parça ve yüzlerce depo nesnesi yok eden bir işlem için iki
 * tıklık "Emin misiniz?" yeterli değildi. Yönetim panelindeki proje silmeyle
 * aynı ağırlıkta bir işlemdir; onay da öyle olmalı.
 */
export const deletePackageSchema = z.object({
  packageId: z.uuid(),
  /** Kullanıcının yazdığı paket adı — sunucuda da karşılaştırılır. */
  confirmName: z.string().max(512).default(""),
});

export const remapItemSchema = z.object({
  packageId: z.uuid(),
  /** Boş bırakılırsa bağlantı KOPARILIR, paket silinmez. */
  jobItemId: z.string().default(""),
  /** Paketin `item_no` METNİNİ de seçilen kaleme çevir. */
  rewriteItemNo: z.boolean().default(false),
});

/** Eski paketi süperse et ve üretim kayıtlarını yeni revizyona devret. */
export const supersedeSchema = z.object({
  /** YENİ (yerine geçen) paket. */
  packageId: z.uuid(),
  /** Süperse edilecek ESKİ paket. */
  supersedesId: z.uuid(),
});

/** Aynı (kalem, grup) için açık bir paket var mı — sihirbazın süperse sorusu. */
export const activePackageQuerySchema = z.object({
  itemNo: z.string().max(64).default(""),
  /**
   * GRUP ZORUNLUDUR ve boş olamaz.
   *
   * Klasör adı çözülemeyen paketler `group_code = ""` ile kaydedilir; boş grubu
   * sorgulamak, birbiriyle hiç ilgisi olmayan iki tanınmamış paketi eşleştirip
   * "öncekini süperse edeyim mi?" diye sorardı. Grup grup çalışılan bir
   * projede bu en sık karşılaşılacak yanlış alarm olurdu.
   */
  groupCode: z.string().min(1).max(64),
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

/** Üretim kaydının "gözden geçirildi" işaretini kaldır ya da geri koy. */
export const reviewMarkSchema = z.object({
  packageId: z.uuid(),
  progressId: z.uuid(),
  reviewRequired: z.boolean().default(false),
});

export type CreatePackageInput = z.input<typeof createPackageSchema>;
export type AddPackageFilesInput = z.input<typeof addPackageFilesSchema>;
export type FinalizeUploadInput = z.input<typeof finalizeUploadSchema>;
export type DeletePackageInput = z.input<typeof deletePackageSchema>;
export type RemapItemInput = z.input<typeof remapItemSchema>;
export type SupersedeInput = z.input<typeof supersedeSchema>;
export type ActivePackageQueryInput = z.input<typeof activePackageQuerySchema>;
export type AckFindingInput = z.input<typeof ackFindingSchema>;
export type BindAliasInput = z.input<typeof bindAliasSchema>;
export type ReviewMarkInput = z.input<typeof reviewMarkSchema>;

/** Bütün eylemlerin dönüş tipi — `projects/actions.ts` ile aynı sözleşme. */
export type DrawingActionResult = { error?: string };

/** Bir dosyanın depo hedefi — istemci baytları buraya yazar. */
export interface UploadTarget {
  fileId: string;
  relPath: string;
  storagePath: string;
  /** Baytları GÖNDERİLMEYECEK: yedek dosya ya da bayt bayt kopya. */
  skip: boolean;
}
