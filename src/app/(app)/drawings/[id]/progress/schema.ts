// Üretim durumu — Zod şemaları.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyada durur (jobs/sales/worklog ve
// drawings'in kendi `schema.ts`i ile aynı desen).

import { z } from "zod";

/**
 * İlerleme anahtarı — DESEN DAYATILMAZ.
 *
 * İki ayrı anahtar uzayı taşır: kodlu parçada `0043-00-0100-05`, kodsuz satın
 * alma kaleminde `SATINALMA:<katlanmış açıklama>`. İkincisi bir cümle
 * uzunluğunda olabildiği için sınır 200'dür ve kod deseni ŞART KOŞULMAZ:
 * anahtar uzayını sunucuda daraltmak, defterde gerçekten duran bir kalemi
 * işaretlenemez yapardı.
 */
const anahtar = z.string().min(1).max(200);

/** Aşama slug'ı — `drawing_stages.slug` ile aynı ASCII dilbilgisi. */
const asama = z.string().min(1).max(40).regex(/^[a-z0-9_]+$/, "Aşama anahtarı geçersiz.");

/**
 * Toplu işaretleme.
 *
 * 261 parçayı tek tek işaretlemek kullanılamaz bir ekran olurdu; sınır 2000
 * bilinçli olarak cömerttir (en büyük gerçek paket 261 parça + 68 satın alma
 * kalemi taşıyor ve bir gün iki katı gelebilir).
 */
export const markStageSchema = z.object({
  packageId: z.uuid(),
  stage: asama,
  keys: z.array(anahtar).min(1).max(2000),
  mode: z.enum(["isaretle", "kaldir"]).default("isaretle"),
  /** Boş bırakılırsa tarih yazılmaz — atölye her zaman tarihi bilmez. */
  doneAt: z.string().max(10).default(""),
});

/** Tek parça: adet, tarih ve not birlikte yazılır. */
export const setPartStageSchema = z.object({
  packageId: z.uuid(),
  stage: asama,
  key: anahtar,
  /**
   * TABAN 1'DİR. Sıfır "işaretli ama hiç yapılmamış" gibi belirsiz bir hâl
   * üretirdi; ekranda 1'in altına inmek işareti KALDIRIR ve bu durum hiç
   * doğmaz.
   */
  qtyDone: z.number().int().min(1).max(1_000_000),
  doneAt: z.string().max(10).default(""),
  /**
   * TAHMİNİ teslim tarihi — `doneAt` ile karıştırılmaz.
   *
   * `doneAt` işaretin konduğu gündür (geçmiş), `dueAt` malzemenin beklendiği
   * gündür (gelecek). Satın alma ekranı ikisini ayrı sorar; tek alanda
   * tutulsalardı "üç hafta sonra gelecek" ile "üç hafta önce sipariş edildi"
   * aynı hücreye yazılırdı.
   */
  dueAt: z.string().max(10).default(""),
  note: z.string().max(500).default(""),
});

/**
 * Klasör önerisini uygula.
 *
 * İSTEMCİNİN LİSTESİ GÖNDERİLMEZ, yalnız klasör yolu ve aşama gider: kapsam
 * sunucuda `drawing_files` + `drawing_parts`tan yeniden hesaplanır. Aksi hâlde
 * eski bir sekme, o günden beri değişmiş bir paketi eski kapsamla
 * işaretleyebilirdi.
 */
export const applySuggestionSchema = z.object({
  packageId: z.uuid(),
  stage: asama,
  folderPath: z.string().min(1).max(1024),
  doneAt: z.string().max(10).default(""),
});

export type MarkStageInput = z.input<typeof markStageSchema>;
export type SetPartStageInput = z.input<typeof setPartStageSchema>;
export type ApplySuggestionInput = z.input<typeof applySuggestionSchema>;

/** `drawings/schema.ts` ile aynı sözleşme; `ok` işlenen satır sayısını taşır. */
export type ProgressActionResult = { error?: string; ok?: number };
