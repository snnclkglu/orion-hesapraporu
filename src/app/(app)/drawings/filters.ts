// Teknik Resimler süzgeçleri — TEK TANIM, ekran ve indirme AYNI kuralı kullanır.
//
// İş Takibi'nin dersi (worklog/filters.ts): süzgeç iki yerde ayrı yazılırsa
// indirilen dosya ile ekrandaki tablo sessizce ayrışır. Kullanıcının fark
// etmesi güç, güveni bozan bir hata — bir kez yaşandığında bütün çıktılara
// duyulan güven gider.
//
// Arama TÜRKÇE KATLAMAYLA yapılır: "ŞASE" yazan biri "şase"yi bulmalı, "ISLEME"
// yazan "İŞLEME"yi. `trKatla` i ailesini ve aksanları tek harfe indirir.

import { trKatla } from "@/lib/drawings/tr-text";
import { comparePartCodes } from "@/lib/drawings/part-code";
import type { PartRow, PackageRow, FileRow, FindingRow } from "./data";

/** "Tümü" seçeneği — Select boş string değere izin vermez. */
export const ALL = "__all__";

// ————————————————————————————————————————————————————————— parça defteri

export interface PartFilters {
  query: string;
  kind: string;
  category: string;
  material: string;
  /** hepsi | resimli | resimsiz | kesimli */
  dosya: string;
}

export const EMPTY_PART_FILTERS: PartFilters = {
  query: "",
  kind: ALL,
  category: ALL,
  material: ALL,
  dosya: ALL,
};

export function matchesPart(row: PartRow, f: PartFilters): boolean {
  if (f.kind !== ALL && row.kind !== f.kind) return false;
  if (f.category !== ALL && (row.category || "") !== f.category) return false;
  if (f.material !== ALL && (row.material || "") !== f.material) return false;

  if (f.dosya === "resimli" && !row.has_sheet) return false;
  if (f.dosya === "resimsiz" && (row.has_sheet || row.has_model || row.has_cut)) return false;
  if (f.dosya === "kesimli" && !row.has_cut) return false;

  if (f.query.trim()) {
    // Kod, tanım, ad ve montaj başlığı BİRLİKTE aranır: kullanıcı bazen kodu
    // bazen "TAMBUR"u yazar, hangisini yazdığını sormaya gerek yok.
    const havuz = trKatla(
      [row.part_code, row.description, row.name, row.assembly_title, row.material].join(" ")
    );
    for (const kelime of trKatla(f.query).split(/\s+/).filter(Boolean)) {
      if (!havuz.includes(kelime)) return false;
    }
  }
  return true;
}

/** Süzgeç seçeneklerini VERİDEN üretir — sabit liste veriyle ayrışırdı. */
export function partOptions(rows: PartRow[]) {
  const tekil = (sec: (r: PartRow) => string) =>
    [...new Set(rows.map(sec).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  return {
    categories: tekil((r) => r.category),
    materials: tekil((r) => r.material),
  };
}

export type PartSortKey =
  | "kod"
  | "tanim"
  | "adet"
  | "malzeme"
  | "kalinlik"
  | "kategori"
  | "agirlik";

/**
 * Sıralayıcılar. Kod SEGMENT SEGMENT SAYISAL karşılaştırılır — düz metin
 * sıralaması `-10`u `-2`den önce koyar ve defter ressamın numaralandırmasıyla
 * ilgisiz bir sırayla açılır.
 */
export const PART_SORTS: Record<PartSortKey, (a: PartRow, b: PartRow) => number> = {
  kod: (a, b) => {
    if (a.part_code && b.part_code) return comparePartCodes(a.part_code, b.part_code);
    // Kodsuz satın alma satırları sona düşer, kendi aralarında defter sırasıyla.
    if (a.part_code) return -1;
    if (b.part_code) return 1;
    return a.sort - b.sort;
  },
  tanim: (a, b) => (a.description || "").localeCompare(b.description || "", "tr"),
  adet: (a, b) => (a.qty ?? -1) - (b.qty ?? -1),
  malzeme: (a, b) => (a.material || "").localeCompare(b.material || "", "tr"),
  kalinlik: (a, b) => (a.thickness_mm ?? -1) - (b.thickness_mm ?? -1),
  kategori: (a, b) => (a.category || "").localeCompare(b.category || "", "tr"),
  agirlik: (a, b) => (a.weight_kg ?? -1) - (b.weight_kg ?? -1),
};

export function sortParts(rows: PartRow[], key: PartSortKey, desc: boolean): PartRow[] {
  const kiyas = PART_SORTS[key];
  const kopya = [...rows].sort(kiyas);
  return desc ? kopya.reverse() : kopya;
}

// ————————————————————————————————————————————————————————— satın alma

/**
 * Satın alma satırının SÜZÜLEBİLİR yüzü.
 *
 * `SatinAlmaSatiri` tipine bağlanmaz, YAPISAL bir arayüzdür (`ProgressPart`
 * kalıbının aynısı): süzgeç tanımı çekirdeğin satır şeklini değil yalnız
 * süzdüğü alanları bilmelidir. `alindi` defterin değil İLERLEME KAYDININ
 * bilgisidir ve sayfa onu birleştirip verir.
 */
export interface PurchaseFilterRow {
  tanim: string;
  sinif: string;
  malzeme: string;
  parcaKodu: string;
  adet: number | null;
  toplamAgirlikKg: number | null;
  alindi: boolean;
}

export interface PurchaseFilters {
  query: string;
  sinif: string;
  malzeme: string;
  /** hepsi | alindi | bekliyor */
  durum: string;
}

export const EMPTY_PURCHASE_FILTERS: PurchaseFilters = {
  query: "",
  sinif: ALL,
  malzeme: ALL,
  durum: ALL,
};

export function matchesPurchase(row: PurchaseFilterRow, f: PurchaseFilters): boolean {
  if (f.sinif !== ALL && row.sinif !== f.sinif) return false;
  if (f.malzeme !== ALL && (row.malzeme || "") !== f.malzeme) return false;
  if (f.durum === "alindi" && !row.alindi) return false;
  if (f.durum === "bekliyor" && row.alindi) return false;

  if (f.query.trim()) {
    // Kod da havuzdadır: satın almacı bazen "M16", bazen "DIN934", bazen
    // parça numarasını yazar; hangisini yazdığını sormaya gerek yok.
    const havuz = trKatla([row.tanim, row.malzeme, row.parcaKodu, row.sinif].join(" "));
    for (const kelime of trKatla(f.query).split(/\s+/).filter(Boolean)) {
      if (!havuz.includes(kelime)) return false;
    }
  }
  return true;
}

/**
 * Süzgeç seçenekleri VERİDEN üretilir.
 *
 * Kategori listesi sabit sözlükten DEĞİL bu paketin satırlarından çıkar:
 * sözlük on beş kategori tanıyor ama tek bir pakette ancak yedi sekizi geçiyor
 * ve boş bir açılır liste kullanıcıya olmayan bir seçenek gösterirdi. Sıra
 * `SATIN_ALMA_SINIFLARI`nın kendi sırasıdır; onu çağıran verir.
 */
export function purchaseOptions(rows: PurchaseFilterRow[], sinifSirasi: readonly string[]) {
  const gecen = new Set(rows.map((r) => r.sinif).filter(Boolean));
  return {
    siniflar: sinifSirasi.filter((s) => gecen.has(s)),
    materials: [...new Set(rows.map((r) => r.malzeme).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "tr")
    ),
  };
}

export type PurchaseSortKey = "kategori" | "tanim" | "adet" | "agirlik" | "kod" | "durum";

export const PURCHASE_SORTS: Record<
  PurchaseSortKey,
  (a: PurchaseFilterRow, b: PurchaseFilterRow) => number
> = {
  // Kategori kendi içinde tanıma göre sıralanır: aynı ailenin kalemleri yan
  // yana ve okunur bir düzende dursun (satınalmacı tedarikçi başına bakar).
  kategori: (a, b) =>
    a.sinif === b.sinif
      ? a.tanim.localeCompare(b.tanim, "tr")
      : a.sinif.localeCompare(b.sinif, "tr"),
  tanim: (a, b) => a.tanim.localeCompare(b.tanim, "tr"),
  adet: (a, b) => (a.adet ?? -1) - (b.adet ?? -1),
  agirlik: (a, b) => (a.toplamAgirlikKg ?? -1) - (b.toplamAgirlikKg ?? -1),
  kod: (a, b) =>
    a.parcaKodu && b.parcaKodu
      ? comparePartCodes(a.parcaKodu, b.parcaKodu)
      : a.parcaKodu
        ? -1
        : b.parcaKodu
          ? 1
          : a.tanim.localeCompare(b.tanim, "tr"),
  durum: (a, b) => Number(a.alindi) - Number(b.alindi),
};

export function sortPurchases<T extends PurchaseFilterRow>(
  rows: T[],
  key: PurchaseSortKey,
  desc: boolean,
  sinifSirasi: readonly string[]
): T[] {
  // KATEGORİ SIRASI ALFABETİK DEĞİL SÖZLÜĞÜN SIRASIDIR: "Bağlantı Elemanı"
  // alfabede başa düşer ama listenin başında motor/redüktör görmek istenir —
  // sözlük zaten ürün ailesi önceliğine göre dizilmiştir.
  if (key === "kategori") {
    const yer = new Map(sinifSirasi.map((s, i) => [s, i]));
    const kopya = [...rows].sort((a, b) => {
      const d = (yer.get(a.sinif) ?? 999) - (yer.get(b.sinif) ?? 999);
      return d !== 0 ? d : a.tanim.localeCompare(b.tanim, "tr");
    });
    return desc ? kopya.reverse() : kopya;
  }
  const kopya = [...rows].sort(PURCHASE_SORTS[key]);
  return desc ? kopya.reverse() : kopya;
}

// ————————————————————————————————————————————————————————— paket listesi

export interface PackageFilters {
  query: string;
  status: string;
  /** hepsi | eslesmis | eslesmemis */
  eslesme: string;
}

export const EMPTY_PACKAGE_FILTERS: PackageFilters = { query: "", status: ALL, eslesme: ALL };

export function matchesPackage(row: PackageRow, f: PackageFilters): boolean {
  if (f.status !== ALL && row.status !== f.status) return false;
  if (f.eslesme === "eslesmis" && !row.job_item_id) return false;
  if (f.eslesme === "eslesmemis" && row.job_item_id) return false;
  if (f.query.trim()) {
    const havuz = trKatla(
      [row.item_no, row.folder_name, row.description, row.group_code, row.jobs?.title].join(" ")
    );
    for (const kelime of trKatla(f.query).split(/\s+/).filter(Boolean)) {
      if (!havuz.includes(kelime)) return false;
    }
  }
  return true;
}

export type PackageSortKey = "kalem" | "paket" | "dosya" | "parca" | "tanima" | "tarih";

export const PACKAGE_SORTS: Record<PackageSortKey, (a: PackageRow, b: PackageRow) => number> = {
  kalem: (a, b) => (a.item_no || "").localeCompare(b.item_no || "", "tr"),
  paket: (a, b) =>
    (a.description || a.folder_name).localeCompare(b.description || b.folder_name, "tr"),
  dosya: (a, b) => a.file_count - b.file_count,
  parca: (a, b) => a.part_count - b.part_count,
  tanima: (a, b) => (a.recognition_pct ?? -1) - (b.recognition_pct ?? -1),
  tarih: (a, b) => a.created_at.localeCompare(b.created_at),
};

export function sortPackages(
  rows: PackageRow[],
  key: PackageSortKey,
  desc: boolean
): PackageRow[] {
  const kopya = [...rows].sort(PACKAGE_SORTS[key]);
  return desc ? kopya.reverse() : kopya;
}

/** Bir işin bütün paketleri — kalem numarası başlığı altında. */
export interface PackageGroup {
  itemNo: string;
  rows: PackageRow[];
  fileCount: number;
  storedCount: number;
  partCount: number;
  /** Depoya ulaşmamış toplam dosya (grup başlığı bunu kırmızı basar). */
  missing: number;
}

/**
 * BİR İŞİN BİRDEN ÇOK PAKETİ OLABİLİR ve bu ilk günden beri destekleniyor:
 * anahtar (kalem, grup) çiftidir, tekillik kısıtı BİLİNÇLİ olarak yoktur.
 * `0057-00`+`0500` (monoray) ile `0057-00`+`2000` (köprü) ayrı paketlerdir ve
 * birbirini etkilemez.
 *
 * Eksik olan LİSTELEMEYDİ: aynı işin parçaları listede beş bağımsız satır
 * olarak duruyor ve yan yana gelmiyordu. Kalemsiz paketler kendi başlığı
 * altında toplanır — "eşleşmemiş" bir grup adı değildir ama listede kaybolmak
 * da olmaz.
 */
export function groupPackages(rows: PackageRow[]): PackageGroup[] {
  const gruplar = new Map<string, PackageRow[]>();
  for (const r of rows) {
    const anahtar = (r.item_no || "").trim();
    const liste = gruplar.get(anahtar);
    if (liste) liste.push(r);
    else gruplar.set(anahtar, [r]);
  }
  // Sıra GELDİĞİ GİBİ korunur: gruplama sıralamayı ezmemeli, yalnız aynı
  // kalemin satırlarını bir araya toplamalı.
  return [...gruplar.entries()].map(([itemNo, satirlar]) => {
    let fileCount = 0;
    let storedCount = 0;
    let partCount = 0;
    let missing = 0;
    for (const r of satirlar) {
      const beklenen = Math.max(0, r.file_count - r.skipped_count);
      fileCount += beklenen;
      storedCount += r.stored_count;
      partCount += r.part_count;
      missing += Math.max(0, beklenen - r.stored_count);
    }
    return { itemNo, rows: satirlar, fileCount, storedCount, partCount, missing };
  });
}

// ————————————————————————————————————————————————————————— dosya gezgini

export function matchesFile(row: FileRow, query: string): boolean {
  if (!query.trim()) return true;
  const havuz = trKatla([row.rel_path, row.part_code, row.material].join(" "));
  return trKatla(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((k) => havuz.includes(k));
}

// ————————————————————————————————————————————————————————— rapor

export function matchesFinding(row: FindingRow, query: string): boolean {
  if (!query.trim()) return true;
  const havuz = trKatla([row.code, row.subject, row.title, row.detail].join(" "));
  return trKatla(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((k) => havuz.includes(k));
}
