// BOM Excel okuma — SABİT ŞEMA DEĞİL, SÜTUN SÖZLÜĞÜ.
//
// İki gerçek pakette dokuz çalışma sayfası var ve BEŞ AYRI SÜTUN ŞEKLİ
// kullanıyorlar:
//
//   7 sütun   HALAT KLAVUZU DEPO      (Item QTY yok, Category yok)
//   9 sütun   MONORAY DEPO            (bugüne kadar "standart" sanılan)
//  11 sütun   İPTAL DEPO              (+ Project, Web Link)
//  13 sütun   MTC ÜRÜN AĞACI          (+ Mass, REV)
//  14 sütun   İPTAL ÜRÜN AĞACI        (+ File Path)
//
// Sayfa adları da sabit değil: `BOM` · `Sayfa1` · `Sayfa2`. MTC'nin DEPO
// dosyası satın almayı, sac parçalarını ve profil kesim boylarını ÜÇ AYRI
// SAYFAYA ayırmış — ressam işi daha düzenli yapmış, daha dağınık değil.
// "Yalnız BOM sayfasını oku" kuralı o düzenin üçte ikisini çöpe atardı.
//
// Üç kural:
//   1. BÜTÜN sayfalar okunur.
//   2. Başlık satırı ARANIR (1. satır olduğu varsayılmaz) ve eşleme SÜTUN
//      ADIYLA yapılır — indisle değil. `Item QTY` ile `QTY` tam olarak indisle
//      okumanın düştüğü tuzaktır ve ikisi farklı şeydir.
//   3. Sözlükte karşılığı olmayan sütun ATILMAZ, `extra`da saklanır. Bugün
//      anlamsız olan `Web Link` yarın müşteri adı olarak işe yarayabilir.

import { trKatla } from "./tr-text";
import type { BomRow, BomSourceKind } from "./types";

/** Sözlükteki alanlar — `BomRow`un adlandırılmış sütunlarıyla birebir. */
export type BomField =
  | "itemPath"
  | "partNumber"
  | "bomStructure"
  | "description"
  | "title"
  | "materialRaw"
  | "itemQtyRaw"
  | "qtyRaw"
  | "category"
  | "massRaw"
  | "revRaw";

/**
 * Başlık eş anlamlıları.
 *
 * Kaynak başlıklar bugün İNGİLİZCE (Inventor'ın öntanımı, çevrilmemiş) ama
 * ressam bir gün şablonu Türkçeleştirirse dosya okunamaz hâle gelmemeli.
 * Türkçe karşılıklar bu yüzden şimdiden burada.
 */
const SOZLUK: Record<BomField, string[]> = {
  itemPath: ["ITEM", "SIRA", "SIRA NO", "KALEM"],
  partNumber: ["PART NUMBER", "PARÇA NO", "PARÇA NUMARASI", "PARCA NO", "KOD"],
  bomStructure: ["BOM STRUCTURE", "YAPI", "TÜR"],
  description: ["DESCRIPTION", "TANIM", "AÇIKLAMA", "ACIKLAMA"],
  title: ["TITLE", "BAŞLIK", "BASLIK", "GRUP", "MONTAJ"],
  materialRaw: ["MATERIAL", "MALZEME", "METARIAL"],
  itemQtyRaw: ["ITEM QTY", "ADET", "MİKTAR (ADET)"],
  qtyRaw: ["QTY", "MIKTAR", "MİKTAR", "TOPLAM"],
  category: ["CATEGORY", "KATEGORİ", "KATEGORI", "İMALAT", "IMALAT"],
  massRaw: ["MASS", "AĞIRLIK", "AGIRLIK", "KÜTLE", "KUTLE"],
  revRaw: ["REV", "REVİZYON", "REVIZYON"],
};

/**
 * Görünmez boşluklar — KAÇIŞ DİZİSİYLE yazılır.
 *
 * Bölünmez boşluk (U+00A0) kaynakta gerçekten var: MTC ürün ağacının ilk
 * satırında `KÖPRÜLÜ TAVAN\u00a0VİNÇ` yazıyor. Normal boşlukla aynı sayılmazsa
 * `ITEM QTY` başlığı eşleşmez ve sütun sessizce kaybolur.
 *
 * Karakterin kendisini kaynağa gömmek olmazdı: görünmediği için bir gün biri
 * onu "fazladan boşluk" sanıp siler ve hata ancak o Excel okunurken çıkar.
 */
const GORUNMEZ_BOSLUK = /[\u00a0\u2007\u202f\ufeff]/g;

/** Başlık karşılaştırma anahtarı: görünmez boşluk sadeleşir, tr-TR büyür. */
export function normalizeHeader(raw: string): string {
  return trKatla(String(raw).replace(GORUNMEZ_BOSLUK, " ").replace(/\s+/g, " "));
}

const TERS_SOZLUK = new Map<string, BomField>();
for (const [alan, adlar] of Object.entries(SOZLUK) as [BomField, string[]][]) {
  for (const ad of adlar) TERS_SOZLUK.set(normalizeHeader(ad), alan);
}

/** Başlık satırı bu kadar bilinen sütun taşımalı; altında satır başlık sayılmaz. */
const EN_AZ_ESLESME = 2;
/** Başlık ilk kaç satırda aranır. */
const BASLIK_PENCERESI = 10;

export interface RawSheet {
  /** Paket kökünden göreli Excel yolu */
  fileRelPath: string;
  sheetName: string;
  /** Ham satırlar; boş hücre "" */
  rows: string[][];
}

export interface SheetRead {
  fileRelPath: string;
  sheetName: string;
  sourceKind: BomSourceKind;
  /** 1 tabanlı başlık satırı; 0 = bulunamadı */
  headerRowNo: number;
  /** Alan → sütun indisi */
  mapping: Partial<Record<BomField, number>>;
  /** Sözlükte olmayan sütunlar — atılmaz, `extra`ya girer */
  unmapped: { index: number; header: string }[];
  /** `Item` sütunu gerçek hiyerarşi mi (noktalı) yoksa sıra numarası mı? */
  hierarchical: boolean;
  rows: BomRow[];
}

function baslikSatiriBul(rows: string[][]): { index: number; matched: number } {
  let enIyi = { index: -1, matched: 0 };
  const son = Math.min(rows.length, BASLIK_PENCERESI);
  for (let i = 0; i < son; i++) {
    const sayi = rows[i].filter((h) => h && TERS_SOZLUK.has(normalizeHeader(h))).length;
    if (sayi > enIyi.matched) enIyi = { index: i, matched: sayi };
  }
  return enIyi.matched >= EN_AZ_ESLESME ? enIyi : { index: -1, matched: 0 };
}

/**
 * Bir çalışma sayfasını okur.
 *
 * Başlık bulunamazsa satır ÜRETİLMEZ ama sayfa yine sonuçta durur
 * (`headerRowNo = 0`): rapor "bu sayfayı okuyamadım" diyebilsin. Sessizce
 * atlamak, verinin yarısının nereye gittiğini sorduran türden bir davranıştır.
 */
export function readSheet(sheet: RawSheet, sourceKind: BomSourceKind): SheetRead {
  const taban: SheetRead = {
    fileRelPath: sheet.fileRelPath,
    sheetName: sheet.sheetName,
    sourceKind,
    headerRowNo: 0,
    mapping: {},
    unmapped: [],
    hierarchical: false,
    rows: [],
  };

  const { index: baslikIdx } = baslikSatiriBul(sheet.rows);
  if (baslikIdx < 0) return taban;

  const basliklar = sheet.rows[baslikIdx];
  const mapping: Partial<Record<BomField, number>> = {};
  const unmapped: { index: number; header: string }[] = [];

  basliklar.forEach((ham, idx) => {
    if (!ham) return;
    const alan = TERS_SOZLUK.get(normalizeHeader(ham));
    // Aynı alanı iki sütun taşıyorsa İLKİ kazanır: sonraki genellikle bir
    // toplam ya da tekrar sütunudur.
    if (alan && mapping[alan] === undefined) mapping[alan] = idx;
    else unmapped.push({ index: idx, header: ham });
  });

  const veriSatirlari = sheet.rows.slice(baslikIdx + 1);
  const hucre = (satir: string[], alan: BomField): string => {
    const i = mapping[alan];
    return i === undefined ? "" : (satir[i] ?? "").trim();
  };

  // `Item` sütunu DEPO'da düz bir sıra numarası ("1","2","3"), ÜRÜN AĞACI'nda
  // gerçek bir hiyerarşidir ("1", "1.1", "6.9.1.1"). Ayrımı dosya adına değil
  // İÇERİĞE sorarız: noktalı bir değer varsa hiyerarşidir. Dosya adı yanlış
  // yazılmış olabilir, veri yanlış olamaz.
  const hierarchical = veriSatirlari.some((s) => /^\d+(\.\d+)+$/.test(hucre(s, "itemPath")));

  const rows: BomRow[] = [];
  veriSatirlari.forEach((satir, i) => {
    if (!satir.some((h) => h && h.trim())) return;

    const extra: Record<string, string> = {};
    for (const u of unmapped) {
      const v = (satir[u.index] ?? "").trim();
      if (v) extra[u.header] = v;
    }

    rows.push({
      fileRelPath: sheet.fileRelPath,
      sheetName: sheet.sheetName,
      sourceKind,
      rowNo: baslikIdx + 2 + i,
      itemPath: hierarchical ? hucre(satir, "itemPath") : "",
      partNumber: hucre(satir, "partNumber"),
      bomStructure: hucre(satir, "bomStructure"),
      description: hucre(satir, "description"),
      title: hucre(satir, "title"),
      materialRaw: hucre(satir, "materialRaw"),
      itemQtyRaw: hucre(satir, "itemQtyRaw"),
      qtyRaw: hucre(satir, "qtyRaw"),
      category: hucre(satir, "category"),
      massRaw: hucre(satir, "massRaw"),
      revRaw: hucre(satir, "revRaw"),
      extra,
    });
  });

  return { ...taban, headerRowNo: baslikIdx + 1, mapping, unmapped, hierarchical, rows };
}

/** Sözlükteki alanların kaçı eşlendi — tanıma oranının Excel ayağı. */
export function mappingScore(read: SheetRead): { matched: number; total: number } {
  const total = Object.keys(SOZLUK).length;
  return { matched: Object.keys(read.mapping).length, total };
}
