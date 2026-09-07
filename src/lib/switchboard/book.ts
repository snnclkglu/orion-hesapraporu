// ÜRÜN ÖLÇÜ DEFTERİ — satır derleme, arama ve süzgeç (saf).
//
// Defter PROJEDEN BAĞIMSIZDIR: ölçü ürüne aittir ve bir kez girildiğinde
// bütün projelerde geçerlidir (PANO-12). Ama defteri DOLDURAN kişi bir projenin
// içindedir ve sorusu şudur: "bu işte geçen hangi ürünün ölçüsü eksik?" Bu
// yüzden satırlar iki kaynağın BİRLEŞİMİDİR — defterdeki kayıtlar ve bu
// projede geçen ürünler.
//
// SÜZGEÇ TEK TANIMDIR (ELEKTRIK-11 ile aynı ilke): ekran ve ileride bir
// indirme ucu aynı saf fonksiyondan geçer. İki kez yazılsaydı kullanıcı bir
// markayı süzüp indirdiğinde eline bütün defter geçerdi.

import { trKatla } from "@/lib/drawings/tr-text";
import { electricalCategory } from "@/lib/electrical/category";
import { materialCatalogIdentity } from "@/lib/electrical/catalogs";
import type { ElectricalPart } from "@/lib/electrical/types";
import { footprintFor } from "./footprint";
import { mountRuleFor } from "./mount";
import { deviceModelLookup } from "./registry";
import type { DeviceModel, DimSource, MountType, Zone } from "./types";

/** Defterin bir satırı — ürün başına. */
export interface BookRow {
  /** `electricalCatalogLookupKey(supplier, typeNo)`. */
  lookupKey: string;
  supplier: string;
  typeNo: string;
  designation: string;
  category: string;
  /** Türetilmiş montaj tipi (defterde elle değiştirilebilir). */
  mountType: MountType | null;
  zone: Zone | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  /** `katalog` · `elle` · `tahmin`; hiçbiri veremediyse `null`. */
  source: DimSource | null;
  note: string;
  /** Bu projede kaç AYGIT bu üründen. 0 ise satır yalnız defterden geliyor. */
  deviceCount: number;
  /** Bu projede kaç BİRİM (klemens şeridinde adet). */
  unitCount: number;
  /** Bu ürünün belirlediği toplam ray uzunluğu [mm] — önceliği bu söyler. */
  railMm: number;
  /** Defterde kaydı var mı? */
  inBook: boolean;
  /** Panoya giren bir ürün mü (saha ve gövde gereci defter istemez)? */
  needsDimensions: boolean;
}

export interface BuildBookInput {
  parts: ElectricalPart[];
  models: DeviceModel[];
}

/**
 * Projenin ürünleriyle defteri birleştirir.
 *
 * BİR ETİKET BİR KUTUDUR (`panels.ts` ile aynı kural): aynı aygıtın ikinci
 * satırı sayılmaz, yoksa kontaktörün yardımcı kontağı ürünü iki kez saydırırdı.
 */
export function buildBook(input: BuildBookInput): BookRow[] {
  // Defterde arama TEK TANIMDIR (`registry.ts`). Ekran, yerleşim motoruyla
  // AYNI sonucu görmelidir: tedarikçisi boş bir satırın ölçüsü yerleşimde
  // bulunup ekranda "tahmin" görünseydi kullanıcı ölçüyü boşuna yeniden girerdi.
  const modelBul = deviceModelLookup(input.models);
  const satirlar = new Map<string, BookRow>();
  const gorulen = new Set<string>();

  for (const p of input.parts) {
    const etiket = `${p.installation}|${p.location}|${p.device}`;
    if (p.device) {
      if (gorulen.has(etiket)) continue;
      gorulen.add(etiket);
    }
    if (!p.typeNo.trim() && !p.partNo.trim()) continue;

    const category = electricalCategory(p);
    const kural = mountRuleFor({ category, designation: p.designation, typeNo: p.typeNo });
    const kimlik = materialCatalogIdentity(p);
    const model = modelBul(kimlik.lookupKey);
    const olcu = footprintFor(
      {
        category,
        designation: p.designation,
        typeNo: p.typeNo,
        supplier: p.supplier,
        partNo: p.partNo,
      },
      model,
      null
    );

    // Şerit ailesinde adet ENDİR (PANO-5).
    const seritMi = category === "Fiş, Priz, Klemens ve Bağlantı";
    const adet = seritMi && typeof p.qty === "number" && p.qty > 0 ? Math.round(p.qty) : 1;
    const yerlesir =
      kural.mountType === "din" || kural.mountType === "plaka" || kural.mountType === "kapak";

    const mevcut = satirlar.get(kimlik.lookupKey);
    if (mevcut) {
      mevcut.deviceCount += 1;
      mevcut.unitCount += adet;
      mevcut.railMm += (olcu.widthMm ?? 0) * adet;
      continue;
    }

    satirlar.set(kimlik.lookupKey, {
      lookupKey: kimlik.lookupKey,
      supplier: model?.supplier || kimlik.supplier,
      typeNo: model?.typeNo || kimlik.typeNo,
      designation: p.designation,
      category,
      mountType: model?.mountType ?? kural.mountType,
      zone: model?.zone ?? kural.zone,
      widthMm: olcu.widthMm,
      heightMm: olcu.heightMm,
      depthMm: olcu.depthMm,
      source: olcu.source,
      note: model?.note ?? "",
      deviceCount: 1,
      unitCount: adet,
      railMm: (olcu.widthMm ?? 0) * adet,
      inBook: Boolean(model),
      needsDimensions: yerlesir,
    });
  }

  // Defterde olup bu projede geçmeyen ürünler de görünür: defter projeden
  // bağımsızdır ve mühendis başka bir işte girdiği ölçüyü buradan denetler.
  for (const m of input.models) {
    if (satirlar.has(m.lookupKey)) continue;
    satirlar.set(m.lookupKey, {
      lookupKey: m.lookupKey,
      supplier: m.supplier,
      typeNo: m.typeNo,
      designation: "",
      category: "",
      mountType: m.mountType,
      zone: m.zone,
      widthMm: m.widthMm,
      heightMm: m.heightMm,
      depthMm: m.depthMm,
      source: m.widthMm && m.heightMm && m.depthMm ? m.source : null,
      note: m.note,
      deviceCount: 0,
      unitCount: 0,
      railMm: 0,
      inBook: true,
      needsDimensions: true,
    });
  }

  return [...satirlar.values()];
}

// ═══════════════════════════════════════════════════════ SÜZGEÇ ve SIRA

export type BookSort = "etki" | "marka" | "tip" | "kategori" | "kaynak";

export interface BookFilter {
  /** Serbest arama: marka · tip no · tanım · kategori. */
  q: string;
  /** `katalog` · `elle` · `tahmin` · `eksik`; boş = hepsi. */
  source: string;
  category: string;
  supplier: string;
  mountType: string;
  /** Yalnız bu projede geçen ürünler. */
  onlyInProject: boolean;
  /** Yalnız ölçüsü doğrulanmamış olanlar (tahmin + eksik). */
  onlyUnverified: boolean;
  sort: BookSort;
  desc: boolean;
}

export const EMPTY_BOOK_FILTER: BookFilter = {
  q: "",
  source: "",
  category: "",
  supplier: "",
  mountType: "",
  onlyInProject: false,
  onlyUnverified: false,
  sort: "etki",
  desc: true,
};

export function bookFilterIsEmpty(f: BookFilter): boolean {
  return (
    !f.q.trim() &&
    !f.source &&
    !f.category &&
    !f.supplier &&
    !f.mountType &&
    !f.onlyInProject &&
    !f.onlyUnverified
  );
}

/** Satırın arama metni — Türkçe katlanmış (İ/ı tuzağı, `trKatla`). */
function aramaMetni(r: BookRow): string {
  return trKatla(`${r.supplier} ${r.typeNo} ${r.designation} ${r.category} ${r.note}`);
}

/** Bir satırın kaynak kovası: `eksik` de bir kovadır, boş değil. */
export function bookSourceBucket(r: BookRow): "katalog" | "elle" | "tahmin" | "eksik" {
  return r.source ?? "eksik";
}

export function filterBook(rows: readonly BookRow[], f: BookFilter): BookRow[] {
  const q = trKatla(f.q.trim());
  const sonuc = rows.filter((r) => {
    if (f.onlyInProject && r.deviceCount === 0) return false;
    if (f.onlyUnverified) {
      const kova = bookSourceBucket(r);
      if (kova === "katalog" || kova === "elle") return false;
    }
    if (f.source && bookSourceBucket(r) !== f.source) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.supplier && r.supplier !== f.supplier) return false;
    if (f.mountType && (r.mountType ?? "") !== f.mountType) return false;
    if (q && !aramaMetni(r).includes(q)) return false;
    return true;
  });

  const yon = f.desc ? -1 : 1;
  const kovaSirasi = { katalog: 0, elle: 1, tahmin: 2, eksik: 3 } as const;
  sonuc.sort((a, b) => {
    switch (f.sort) {
      case "marka":
        return yon * a.supplier.localeCompare(b.supplier, "tr");
      case "tip":
        return yon * a.typeNo.localeCompare(b.typeNo, "tr");
      case "kategori":
        return yon * a.category.localeCompare(b.category, "tr");
      case "kaynak":
        return yon * (kovaSirasi[bookSourceBucket(a)] - kovaSirasi[bookSourceBucket(b)]);
      default:
        // ETKİ: ürünün belirlediği ray uzunluğu. Defteri doldurma sırası budur —
        // 970 adet geçen bir klemensin 1 mm'si panoyu bir metre büyütür.
        return yon * (a.railMm - b.railMm || a.unitCount - b.unitCount);
    }
  });
  return sonuc;
}

/** Ekrandaki sayaçlar — süzgeçten ÖNCEKİ toplam (ELEKTRIK-11). */
export function bookCounts(rows: readonly BookRow[]): {
  toplam: number;
  panoya: number;
  olculdu: number;
  tahmin: number;
  eksik: number;
} {
  let panoya = 0;
  let olculdu = 0;
  let tahmin = 0;
  let eksik = 0;
  for (const r of rows) {
    if (!r.needsDimensions) continue;
    panoya += 1;
    const kova = bookSourceBucket(r);
    if (kova === "katalog" || kova === "elle") olculdu += 1;
    else if (kova === "tahmin") tahmin += 1;
    else eksik += 1;
  }
  return { toplam: rows.length, panoya, olculdu, tahmin, eksik };
}
