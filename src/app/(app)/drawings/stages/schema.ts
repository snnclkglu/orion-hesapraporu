// Aşama defteri — Zod şemaları ve slug türetme.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar ve saf yardımcılar bu yüzden kardeş dosyada durur
// (`drawings/schema.ts` ve `[id]/progress/schema.ts` ile aynı desen). Bu dosya
// hem sunucu eyleminden hem de düzenleme penceresinden içe aktarılır: kullanıcı
// adı yazarken göreceği anahtar ile sunucunun yazacağı anahtar AYNI
// fonksiyondan gelmeli, yoksa önizleme yalan söyler.

import { z } from "zod";
import { trKatla } from "@/lib/drawings/tr-text";

/**
 * Sıra adımı — yeni aşama listenin sonuna BU KADAR aralıkla eklenir.
 *
 * Tohum aşamalar 10'ar artıyor (10, 20 … 70) ve bu bilinçlidir: iki aşamanın
 * arasına sonradan bir adım (kumlama, galvaniz) sokabilmek için boşluk gerekir.
 * 1'er artsaydı araya girmek bütün defteri yeniden numaralamayı gerektirirdi.
 */
export const SIRA_ADIMI = 10;

/**
 * Anahtarın en çok kaç karakter olacağı.
 *
 * `[id]/progress/schema.ts`teki `asama` süzgeci de 40'tır; ikisi ayrışırsa
 * burada açılabilen bir aşama orada işaretlenemez olurdu.
 */
export const SLUG_UZUNLUK = 40;

/**
 * ADDAN ANAHTAR — Türkçe karakterler DOĞRU çevrilir.
 *
 * `drawing_stages.slug` ASCII'dir (`^[a-z0-9_]+$` kısıtı) ve bunun sebebi
 * migration'da yazılıdır: `"KESİLDİ".toLowerCase()` İngilizce yerelde
 * `"kesi̇ldi̇"` verir — noktalı i'nin üstüne bir de birleşen nokta (U+0307)
 * ekler — ve `"kesildi"` ile EŞİT DEĞİLDİR. Yani düz bir `toLowerCase()` ile
 * türetilen anahtar, aynı ekranın başka bir yerinde üretilen anahtarla
 * tutmayabilir; kayıt sessizce ikiye bölünür.
 *
 * Bu yüzden çevirme `trKatla` üzerinden gider: i ailesinin dördünü (i ı İ I)
 * tek harfe indirir ve Türkçe aksanlarını ASCII karşılığına düşürür. Sonuç saf
 * ASCII olmayabilir (ör. "é" ya da Kiril bir harf katlamadan geçmez), o yüzden
 * `[A-Z0-9]` dışında kalan HER ŞEY ayraca çevrilir — kısıt bir sürprizle değil
 * burada karşılanır.
 *
 * Türetme tohumun yazım kuralıyla da uyumludur: "Kesildi" → `kesildi`,
 * "Büküldü" → `bukuldu`, "Montaja hazır" → `montaja_hazir`.
 *
 * Boş dönebilir (adda hiç harf/rakam yoksa); çağıran bunu anlaşılır bir mesajla
 * karşılar — anahtarı uydurmak, defterde adıyla bağdaşmayan bir satır bırakırdı.
 */
export function slugFromName(name: string): string {
  return trKatla(name ?? "")
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, SLUG_UZUNLUK)
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/**
 * Ad karşılaştırma anahtarı — TEKİLLİK KONTROLÜ İÇİN.
 *
 * Veritabanındaki `dwg_stage_name_key` bayt bayt tekildir: "Kesildi" ile
 * "KESİLDİ" onun gözünde İKİ AYRI addır ve ikisi de kabul edilir. Oysa defterin
 * var olma sebebi tam olarak budur — "kesildi · Kesildi · KESİLDİ" beş ayrı
 * aşama olsun diye değil, TEK aşama olsun diye kuruldu. Uygulama kontrolü bu
 * yüzden veritabanınkinden BİLİNÇLİ OLARAK DAHA SIKIDIR.
 */
export function nameKey(name: string): string {
  return trKatla(name ?? "");
}

/** Ad: tek satır, kısa. 60 karakter bir aşama adı için fazlasıyla cömerttir. */
const asamaAdi = z.string().trim().min(1, "Aşama adı gerekli.").max(60, "Aşama adı çok uzun.");

/** Sıra: ekranda küçükten büyüğe dizilir; negatif olmasının bir anlamı yok. */
const sira = z.number().int().min(0).max(9999);

/**
 * Renk: OKLCH TON AÇISI (0–359), HEX DEĞİL.
 *
 * `customers.color_hue` ve `work_categories` ile aynı kural (bkz. lib/tags.ts):
 * aynı hex açık ve koyu temada birden okunmaz. Veri yalnız açıyı taşır;
 * doygunluk ve parlaklık `globals.css`teki `.oc-tag` kuralındadır.
 *
 * OLUŞTURMADA İSTEĞE BAĞLIDIR: gelmezse sunucu `nextDistinctHue` ile var
 * olanlardan EN UZAK tonu verir. Pencere bir ton öneriyor olsa da sunucu
 * kendi başına da doğru davranmalıdır.
 */
const ton = z.number().int().min(0).max(359);

/** Not: aşamanın ne anlama geldiği. Rapora değil, defterin kendisine yazılır. */
const not = z.string().trim().max(500, "Not çok uzun.");

export const createStageSchema = z.object({
  name: asamaAdi,
  sort: sira,
  colorHue: ton.optional(),
  note: not.default(""),
  active: z.boolean().default(true),
});

/**
 * Düzenleme — `slug` ALANI YOKTUR VE OLMAYACAKTIR.
 *
 * `drawing_part_progress.stage` metni bu anahtara eşittir. Anahtar değişirse
 * atölyenin o aşamadaki bütün kaydı defterden kopar: kayıt silinmez ama artık
 * hiçbir aşamaya bağlanmaz, yani "kaç parça kesildi" sorusu bir daha doğru
 * cevaplanamaz. Görünen adı düzeltmek serbesttir (`name`), anahtar sabittir —
 * migration'ın `slug`/`name` ayrımının tek sebebi budur.
 */
export const updateStageSchema = z.object({
  id: z.uuid(),
  name: asamaAdi,
  sort: sira,
  colorHue: ton,
  note: not.default(""),
  active: z.boolean().default(true),
});

/** Hızlı aktif/pasif anahtarı — satırdaki tek dokunuşluk yol. */
export const setStageActiveSchema = z.object({
  id: z.uuid(),
  active: z.boolean(),
});

/**
 * Sırayı bir basamak kaydır.
 *
 * İstemci YENİ SIRA GÖNDERMEZ, yalnız yön söyler: numaraları istemciden almak,
 * açık kalmış eski bir sekmenin o günden beri eklenmiş bir aşamayı listeden
 * düşürmesi demekti (aynı gerekçe `applyFolderSuggestion`ta yazılı).
 */
export const moveStageSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["yukari", "asagi"]),
});

/**
 * Silme — YALNIZ HİÇ KULLANILMAMIŞ AŞAMA İÇİN.
 *
 * Kullanımı sunucu SAYAR; istemcinin gösterdiği sayı bir görüntüdür. Kullanılan
 * aşama silinmez, pasife alınır: geçmiş kayıtların aşaması bir gün adsız
 * kalmamalı. Yanlışlıkla açılmış, hiç işaretlenmemiş bir satırı da defterde
 * ilelebet tutmak gereksiz — orada silme gerçekten geri alınabilir bir hatadır.
 */
export const deleteStageSchema = z.object({ id: z.uuid() });

export type CreateStageInput = z.input<typeof createStageSchema>;
export type UpdateStageInput = z.input<typeof updateStageSchema>;
export type SetStageActiveInput = z.input<typeof setStageActiveSchema>;
export type MoveStageInput = z.input<typeof moveStageSchema>;
export type DeleteStageInput = z.input<typeof deleteStageSchema>;

/** Evin sözleşmesi — `drawings/schema.ts` `DrawingActionResult` ile aynı. */
export type StageActionResult = { error?: string };
