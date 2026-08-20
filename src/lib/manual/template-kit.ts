// ŞABLONUN YAPI TAŞLARI — tipler ve blok kurucuları (saf).
//
// NEDEN AYRI DOSYA: şablon 2026-08-20'de on ana bölümden yirmi altıya çıktı ve
// tek dosyada üç bin satırı geçiyordu. Bölüm ağacı artık `template-parts/`
// altında konu konu yaşar; hepsi bu dosyadan aynı kurucuları alır.
//
// KURUCULAR TEK YERDEDİR ve bu bir kolaylık değil bir SÖZLEŞMEDİR: `bosluk()`
// ile doğan bir blok "mühendis dolduracak" demektir ve editörün rehberi
// (`lib/manual/guide.ts`) tam olarak bunu okur. İkinci bir yerde elle
// `{ kind: "text", text: "" }` yazılsaydı rehber onu tanımaz, "standart metin
// hazır" derdi.

import type { ManualAutoSource, ManualBlock, ManualNoteLevel, ManualSection } from "./types";

/** Şablon düğümü — `id`ler kopyalama anında üretilir, şablonda yoktur. */
export interface TemplateBlock {
  kind: ManualBlock["kind"];
  text?: string;
  margin?: string;
  items?: string[];
  ordered?: boolean;
  result?: string;
  level?: ManualNoteLevel;
  title?: string;
  source?: ManualAutoSource;
  emptyText?: string;
  /** Şablon görselinin anahtarı (`lib/manual/assets.ts`). */
  assetKey?: string;
  widthPct?: number;
  fullWidth?: boolean;
  head?: string[];
  rows?: string[][];
  caption?: string;
}

export interface TemplateSection {
  key: string;
  title: string;
  blocks?: TemplateBlock[];
  children?: TemplateSection[];
  appendix?: ManualSection["appendix"];
}

/** Paragraf. `margin` kaynak kılavuzun `Marginale` stilidir: kısa kenar notu. */
export const p = (text: string, margin?: string): TemplateBlock => ({
  kind: "text",
  text,
  margin,
});

/** Sırasız madde listesi. */
export const ul = (...items: string[]): TemplateBlock => ({ kind: "list", items });

/** Numaralı işlem listesi; `result` beklenen SONUÇ satırıdır (okla basılır). */
export const ol = (items: string[], result?: string): TemplateBlock => ({
  kind: "list",
  ordered: true,
  items,
  result,
});

/** Uyarı kutusu — düzey ARTAN ciddiyettedir (`types.ts`, KITAP-13). */
export const not = (level: ManualNoteLevel, text: string, title?: string): TemplateBlock => ({
  kind: "note",
  level,
  text,
  title,
});

/** Kaynağından ÜRETİLEN tablo: taslakta canlı, yayımda donmuş (KITAP-7). */
export const oto = (source: ManualAutoSource, emptyText?: string): TemplateBlock => ({
  kind: "auto",
  source,
  emptyText,
});

/** Elle doldurulacak tablo — başlıkları şablondan, satırları mühendisten. */
export const tablo = (head: string[], rows: string[][] = [], caption?: string): TemplateBlock => ({
  kind: "table",
  head,
  rows,
  caption,
});

/**
 * Şablon görseli — baytları repoda (`public/manual-assets/`).
 *
 * `fullWidth` AÇIK BİR KARARDIR: verilmezse görsel sütun akışında kalır ve
 * `widthPct` kabın (sütunun) yüzdesidir. Sayfanın tamamına yayılması gereken
 * görsel bunu ayrıca söyler.
 */
export const resim = (
  assetKey: string,
  caption?: string,
  widthPct?: number,
  fullWidth?: boolean
): TemplateBlock => ({ kind: "image", assetKey, caption, widthPct, fullWidth });

/**
 * DOLDURULACAK BOŞLUK.
 *
 * Vince özel bir metnin yerini tutar ve `text`i BOŞTUR — `placeholder` yasağı
 * (değişmez md. 5) tam olarak budur: örnek bir cümle yazsaydık kopyalanır ve
 * yanlış bir kılavuzla teslim edilirdi. Editörde başlık altında boş bir kutu
 * ve "bu bölüm VİNCE ÖZELDİR" rehberi görünür, belgede hiç görünmez.
 */
export const bosluk = (margin?: string): TemplateBlock => ({ kind: "text", text: "", margin });
