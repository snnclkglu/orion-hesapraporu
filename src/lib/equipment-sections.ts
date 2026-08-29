// EKİPMAN LİSTESİNİN İKİ BÖLÜMÜ — MEKANİK ve ELEKTRİK. Saf çekirdek
// (DB/HTTP/React yok, değişmez md. 7).
//
// Liste TEKTİR ve iki bölümden oluşur: mekanik bölüm hesap raporunun kendi
// seçimlerinden (`buildEquipmentGroups`), elektrik bölümü ise projeye yüklenen
// ELEKTRİK PROJESİNİN okunmuş malzeme listesinden (`materialRows`) doğar.
// İki kaynak, tek tablo: satın alma, montaj ve müşteri aynı belgeye bakar.
//
// BÖLÜM YOKSA HİÇ YOKTUR. Elektrik projesi yüklenmemiş bir projede elektrik
// bölümü boş bir başlık olarak BASILMAZ — ne ekranda, ne Excel'de, ne PDF'te.
// Boş bir bölüm bandı "satırları unutulmuş" diye okunur; yokluğun kendisi
// bilgidir ve sessizce doğru olanı söyler (`buildEquipmentGroups`in "BOŞ GRUP
// BASILMAZ" kuralının bölüm düzeyindeki karşılığı).
//
// BÖLÜM BANDI ANCAK AYIRACAK BİR ŞEY VARSA BASILIR: tek bölümlü bir belgede
// başlık hiçbir şeyi ayırmaz, belgenin adı zaten onu söyler (dosya adı ve PDF
// kicker'ı "Mekanik/Elektrik Ekipman Listesi" yazar).

import {
  ELECTRICAL_CATEGORIES,
  type ElectricalCategory,
} from "@/lib/electrical/category";
import {
  materialCatalogIdentity,
  type ElectricalCatalogReference,
} from "@/lib/electrical/catalogs";
import type { ElectricalMaterialRow } from "@/lib/electrical/types";
import { rowCatalogSheetKey, UNKNOWN_QTY } from "@/lib/excel/equipment";
import type {
  EqGroup,
  EqRow,
  EquipmentAttachments,
  EquipmentNotes,
} from "@/lib/excel/equipment";
import { kimlikBuyuk } from "@/lib/tr-text";

// ————————————————————————————————————————————————————————————————— bölümler

export type EquipmentSectionKey = "mechanical" | "electrical";

/** Ekipman listesinin bir bölümü — içinde bugünkü grup bantları yaşar. */
export interface EquipmentSection {
  key: EquipmentSectionKey;
  name: string;
  groups: EqGroup[];
}

export const EQUIPMENT_SECTION_LABELS: Record<EquipmentSectionKey, string> = {
  mechanical: "Mekanik Ekipmanlar",
  electrical: "Elektrik Ekipmanları",
};

/**
 * Kullanıcının indirmek istediği bölüm — ekran süzgeci ve indirme ucu AYNI
 * değeri kullanır (`ELEKTRIK-11` ilkesi: süzülmüş bir ekrandan indirilen
 * dosya ekranda görünenden başka satır taşıyamaz).
 */
export const EQUIPMENT_PARTS = ["tumu", "mekanik", "elektrik"] as const;

export type EquipmentPart = (typeof EQUIPMENT_PARTS)[number];

export const EQUIPMENT_PART_LABELS: Record<EquipmentPart, string> = {
  tumu: "Tüm Ekipman Listesi",
  mekanik: "Mekanik Ekipman Listesi",
  elektrik: "Elektrik Ekipman Listesi",
};

/** Sorgu parametresinden bölüm; tanınmayan değer TÜM listeye düşer. */
export function equipmentPartFromParam(value: string | null | undefined): EquipmentPart {
  return (EQUIPMENT_PARTS as readonly string[]).includes(value ?? "")
    ? (value as EquipmentPart)
    : "tumu";
}

/** Bölüm bir listede görünecek mi (`tumu` ikisini de içerir). */
export function partIncludes(part: EquipmentPart, key: EquipmentSectionKey): boolean {
  if (part === "tumu") return true;
  return part === (key === "mechanical" ? "mekanik" : "elektrik");
}

/**
 * Bölümleri kurar — BOŞ BÖLÜM DÖNMEZ.
 *
 * Sıra sabittir: önce mekanik, sonra elektrik. Elektrik projesi mekanik
 * hesabın SONRASINDA gelir (çizim bürosu vinç seçildikten sonra çizer) ve
 * belge de o sırayı izler.
 */
export function equipmentSections(input: {
  mechanical?: EqGroup[];
  electrical?: EqGroup[];
}): EquipmentSection[] {
  const out: EquipmentSection[] = [];
  const mechanical = (input.mechanical ?? []).filter((group) => group.rows.length > 0);
  const electrical = (input.electrical ?? []).filter((group) => group.rows.length > 0);
  if (mechanical.length > 0) {
    out.push({
      key: "mechanical",
      name: EQUIPMENT_SECTION_LABELS.mechanical,
      groups: mechanical,
    });
  }
  if (electrical.length > 0) {
    out.push({
      key: "electrical",
      name: EQUIPMENT_SECTION_LABELS.electrical,
      groups: electrical,
    });
  }
  return out;
}

/** Seçilen bölüme göre süzer — ekran, Excel ve PDF aynı fonksiyondan geçer. */
export function sectionsForPart(
  sections: readonly EquipmentSection[],
  part: EquipmentPart
): EquipmentSection[] {
  return sections.filter((section) => partIncludes(part, section.key));
}

/**
 * Bölümlerin bütün grupları, sırayla.
 *
 * Katalog sayfası toplayıcısı ve ek sıralayıcısı grup dizisiyle çalışır
 * (`collectCatalogSheetPages`, `orderAttachmentsForAppendix`); onlara bölüm
 * kavramı taşımak, ek destesinin sırasını değiştirmeyen bir imza değişikliği
 * olurdu.
 */
export function sectionGroups(sections: readonly EquipmentSection[]): EqGroup[] {
  return sections.flatMap((section) => section.groups);
}

/** Bölümlerdeki toplam satır adedi — sayaçlar ve boşluk denetimi için. */
export function countSectionRows(sections: readonly EquipmentSection[]): number {
  return sections.reduce(
    (n, section) => n + section.groups.reduce((m, group) => m + group.rows.length, 0),
    0
  );
}

/**
 * Seçilmiş bölüm kümesinin belge adı.
 *
 * `tumu` istendiği hâlde projede elektrik yoksa kümede yalnız mekanik kalır ve
 * belge kendine "Tüm" demez. Böylece eski/mevcut projelerde elektrik için boş
 * bir alan açılmadığı gibi dosya adı da var olmayan bir bölümü vaat etmez.
 */
export function equipmentListTitle(sections: readonly EquipmentSection[]): string {
  if (sections.length > 1) return EQUIPMENT_PART_LABELS.tumu;
  if (sections[0]?.key === "electrical") return EQUIPMENT_PART_LABELS.elektrik;
  if (sections[0]?.key === "mechanical") return EQUIPMENT_PART_LABELS.mekanik;
  return "Ekipman Listesi";
}

/**
 * Bölüm bandı basılsın mı.
 *
 * TEK BÖLÜMLÜ BELGEDE BASILMAZ: hiçbir şeyi ayırmayan bir başlık, tablonun
 * üstüne konmuş ikinci bir addan başka şey değildir. Belgenin hangi bölümü
 * taşıdığı adında ve künyesinde yazar.
 */
export function showSectionBands(sections: readonly EquipmentSection[]): boolean {
  return sections.length > 1;
}

// ——————————————————————————————————————————————————— elektrik ekipman satırı

/**
 * Elektrik satırlarının `EqRow.kind` değeri.
 *
 * Katalog bağlantı sözlükleri `dsKey(kind, marka, model)` ile anahtarlanır;
 * kendi türü olmasaydı elektrik ürünü ile aynı marka/model yazan bir mekanik
 * ürün aynı anahtara düşerdi.
 */
export const ELECTRICAL_EQUIPMENT_KIND = "electrical";

/**
 * Adet ve Excel hücresi kuralları `excel/equipment.ts`te tanımlıdır (orada
 * `EqRow.qty` yaşıyor); burada YALNIZ yeniden dışa açılır ki elektrik
 * bölümüyle çalışan çağıran iki dosyayı birden içe aktarmasın.
 */
export { UNKNOWN_QTY, qtyCellValue } from "@/lib/excel/equipment";

/**
 * Elektrik malzemesinin ekipman listesindeki KARARLI satır anahtarı.
 *
 * `electrical_parts` yeni bir EPLAN PDF'i okunduğunda silinip yeniden kurulur
 * (`ELEKTRIK-6`); satır UUID'sine bağlanan bir not ilk yeniden okumada koparadı.
 * `ElectricalMaterialRow.key` ürün kimliğidir (malzeme kodu → tedarikçi|tip →
 * tanım) ve okumalar arasında yaşar; "Ek Özellikler" notu ile "Ek Belge"
 * yüklemesi ona bağlanır (`ELEKTRIK-12` ile aynı gerekçe).
 */
export function electricalEquipmentRowKey(materialKey: string): string {
  // Not ve ek action'larının güvenlik sözleşmesi `<harf-rakam>:<harf-rakam>`
  // biçimidir. EPLAN ürün anahtarı ise nokta, eğik çizgi, boşluk ve Türkçe
  // harf taşıyabilir (`SIE.5SL6210-7`, `HELUKABEL|JZ-600 / OZ-600`). Ham
  // anahtarı kullanmak satırı ekranda gösterir ama not/ek kaydını reddederdi.
  // İki bağımsız FNV-1a turu, anahtarı kısa ve kararlı bir hex kimliğine
  // indirir; büyük/küçük harf farkı aynı ürünün notunu koparmaz.
  const canonical = kimlikBuyuk(materialKey.normalize("NFC").trim());
  const hash = (seed: number) => {
    let value = seed >>> 0;
    for (let i = 0; i < canonical.length; i += 1) {
      value ^= canonical.charCodeAt(i);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, "0");
  };
  return `electrical:${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}

/**
 * Elektrik malzeme satırlarını ekipman listesinin gruplarına çevirir.
 *
 * GRUP ADI TÜRETİLMİŞ KATEGORİDİR (`ELEKTRIK-13`): elle yazılan bir alan değil,
 * tanım/tip/tedarikçi/malzeme kodundan saf kuralla çıkan işlev ailesi. Sıra
 * `ELECTRICAL_CATEGORIES` sözlüğünündür — belgede geçmeyen aile grup açmaz.
 *
 * TANIM ÜRETİCİNİN YAZDIĞI GİBİ KALIR. Mekanik satırlar `baslikDuzeni`den
 * geçer çünkü onların adını uygulama yazar ("Ana Kaldırma Redüktörü"); elektrik
 * tanımı ise kaynak belgenin kendi metnidir (`CIRCUIT BREAKER 400V 6KA, 3POLE`)
 * ve "Circuit Breaker 400V 6Ka" hâline getirmek onu bozar. Marka ve model ise
 * ÜRÜN KİMLİĞİDİR ve mekanik satırlarla aynı kuraldan geçer (`kimlikBuyuk`) —
 * aynı tabloda iki yazım kabul edilemez.
 */
export function buildElectricalEquipmentGroups(
  materials: readonly ElectricalMaterialRow[],
  options: {
    notes?: EquipmentNotes;
    attachments?: EquipmentAttachments;
  } = {}
): EqGroup[] {
  const byCategory = new Map<ElectricalCategory, EqRow[]>();
  for (const material of materials) {
    const rowKey = electricalEquipmentRowKey(material.key);
    const row: EqRow = {
      kind: ELECTRICAL_EQUIPMENT_KIND,
      rowKey,
      component: electricalComponentName(material),
      brand: kimlikBuyuk(material.supplier) || "-",
      model: kimlikBuyuk(material.typeNo) || "-",
      // Katalog bağı ÜRÜN KİMLİĞİNE bağlanır, görünen tip numarasına değil:
      // kablo ailesinde (`JZ-600 / OZ-600`) görünen tip birden çok kesiti
      // kapsar ve iki ayrı ürünü aynı belgeye bağlardı (`ELEKTRIK-15`).
      catalogModel: materialCatalogIdentity(material).typeNo || undefined,
      spec: electricalSpecText(material),
      qty: material.qty ?? UNKNOWN_QTY,
      ...(options.notes?.[rowKey] ? { note: options.notes[rowKey] } : {}),
      ...(options.attachments?.[rowKey]?.length
        ? { attachments: options.attachments[rowKey] }
        : {}),
    };
    const list = byCategory.get(material.category);
    if (list) list.push(row);
    else byCategory.set(material.category, [row]);
  }
  // Sıra taksonomininkidir; belgede geçmeyen aile grup AÇMAZ.
  return ELECTRICAL_CATEGORIES.filter((category) => byCategory.has(category)).map(
    (category) => ({ name: category, rows: byCategory.get(category)! })
  );
}

/**
 * Satırın ekipman adı.
 *
 * Tanım boşsa (EPLAN'da tanımsız ama tip numaralı ürün) kimlik alanlarına
 * düşülür; UYDURULMAZ, yalnız var olan alan öne alınır (değişmez md. 4).
 */
function electricalComponentName(material: ElectricalMaterialRow): string {
  return (
    material.designation.trim() ||
    material.typeNo.trim() ||
    material.partNo.trim() ||
    material.supplier.trim() ||
    "—"
  );
}

/**
 * "Özellikler" hücresi — projenin malzeme kodu ve ürünün geçtiği panolar.
 *
 * Pano listesi KISALTILMAZ: "bu ürün nerede kullanılıyor" sorusunun cevabı tam
 * olmalıdır; kesilmiş bir liste okuyana eksik olduğunu söylemez.
 */
function electricalSpecText(material: ElectricalMaterialRow): string {
  const parts: string[] = [];
  if (material.partNo.trim()) parts.push(material.partNo.trim());
  if (material.locations.length > 0) {
    parts.push(`Pano: ${material.locations.map((l) => `+${l}`).join(" ")}`);
  }
  return parts.join(" · ");
}

// ————————————————————————————————————————————————— elektrik katalog bağları

/**
 * Elektrik satırlarının belge bağlantıları.
 *
 * İKİ SÖZLÜK, İKİ HÜCRE — mekanik satırlarla AYNI dilbilgisi:
 *   `sheetUrls`     → EKİPMAN ADINA bağlanır; ürünün TEKNİK FÖYÜdür.
 *   `datasheetUrls` → MODEL hücresine bağlanır; ürünün TAM KATALOĞUdur.
 *
 * Föy yoksa ad tam kataloğa düşer (bağlantısız bırakmak, var olan bir belgeyi
 * saklamak olurdu) ve o durumda model hücresi bağlantı ALMAZ: aynı belgeye iki
 * kez bağlanan bir satır, ikinci bağlantının başka bir şey olduğunu söylerdi.
 *
 * Adres MUTLAKTIR (`origin` verilirse): Excel ve PDF uygulamanın dışında
 * açılır. Uç oturum ister — belge özel kovadadır ve tarayıcıya imzalı depo
 * adresi verilmez (`ELEKTRIK-12`).
 */
export function buildElectricalCatalogUrls(
  groups: readonly EqGroup[],
  materials: readonly ElectricalMaterialRow[],
  references: readonly ElectricalCatalogReference[],
  origin = ""
): { sheetUrls: Map<string, string>; datasheetUrls: Map<string, string> } {
  const sheetUrls = new Map<string, string>();
  const datasheetUrls = new Map<string, string>();
  const byMaterialKey = new Map(references.map((r) => [r.materialKey, r]));
  // Satırın anahtarı SATIRDAN üretilir (`rowCatalogSheetKey`) — çağrı yerinde
  // yeniden kurulan bir anahtar `catalogModel`i düşürüp bağlantıyı sessizce
  // etkisiz bırakmıştı (bkz. o yardımcının başlığı).
  const rowByMaterialKey = new Map<string, EqRow>();
  for (const group of groups) {
    for (const row of group.rows) {
      if (!row.rowKey) continue;
      rowByMaterialKey.set(row.rowKey, row);
    }
  }
  for (const material of materials) {
    const reference = byMaterialKey.get(material.key);
    if (!reference) continue;
    const row = rowByMaterialKey.get(electricalEquipmentRowKey(material.key));
    if (!row) continue;
    const key = rowCatalogSheetKey(row);
    if (!key) continue;
    const nameDocumentId = reference.technicalDocumentId ?? reference.catalogDocumentId;
    if (nameDocumentId) sheetUrls.set(key, electricalCatalogHref(nameDocumentId, origin));
    if (
      reference.catalogDocumentId &&
      reference.catalogDocumentId !== nameDocumentId
    ) {
      datasheetUrls.set(key, electricalCatalogHref(reference.catalogDocumentId, origin));
    }
  }
  return { sheetUrls, datasheetUrls };
}

/** Oturumlu katalog/föy ucunun adresi (`ELEKTRIK-12`). */
export function electricalCatalogHref(documentId: string, origin = ""): string {
  return `${origin}/api/electrical-catalog/${documentId}`;
}
