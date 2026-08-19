// OTOMATİK BLOKLARIN ÇÖZÜMÜ — saf.
//
// EL KİTABININ VAR OLMA SEBEBİ BU DOSYADIR. Sınıflandırma tablosu hesap
// raporunda, ekipman listesi ekipman panelinde, malzeme listesi elektrik
// projesinde, resim listesi Teknik Resim Takibi'nde ZATEN YAZILIDIR. Elle
// kopyalanan her tablo bir gün kaynağıyla ayrışır ve müşteri elindeki
// kılavuzla vinci karşılaştırdığında farkı görür.
//
// ÇÖZÜCÜ SAFTIR: veriyi ÇAĞIRAN toplar (`manual/sources-data.ts` sunucuda,
// hesap motorundan ve Supabase'ten), burası yalnız tabloya çevirir. Böylece
// ekran, PDF ve Excel üçü de aynı satırları basar.
//
// BOŞ KAYNAK BOŞ TABLO ÜRETİR, uydurma satır değil (değişmez md. 4). Boş
// tablo `printedManual` süzgecinde düşer ve bölüm gerekiyorsa `emptyText`
// ile kendini açıklar.

import { materialRows } from "@/lib/electrical/rollup";
import type { ElectricalPart, ElectricalSheet } from "@/lib/electrical/types";
import type { ManualAutoSource, ManualTable } from "./types";

/** Etiket-değer satırı — hesap raporundan gelen üç tablonun ortak şekli. */
export interface LabeledValue {
  label: string;
  value: string;
}

/** Ekipman listesinin el kitabına giren yüzü. */
export interface ManualEquipmentRow {
  /** "Tambur rulmanı", "Çelik halat" — ekipman listesindeki ad. */
  component: string;
  brand: string;
  model: string;
  /** Serbest metinli adet ("2 adet", "4"); okunamayan BOŞ kalır. */
  qty: string;
  /** Hangi modülden geldi ("Ana Kaldırma") — listeyi okunur kılar. */
  group: string;
}

/** Teknik Resim Takibi defterinin el kitabına giren yüzü. */
export interface ManualDrawingRow {
  no: string;
  name: string;
  status: string;
}

/** Çözücünün beslendiği bütün kaynaklar. Hepsi isteğe bağlıdır. */
export interface ManualSourceData {
  classes?: LabeledValue[];
  characteristics?: LabeledValue[];
  speeds?: LabeledValue[];
  equipment?: ManualEquipmentRow[];
  electricalParts?: ElectricalPart[];
  electricalSheets?: ElectricalSheet[];
  drawings?: ManualDrawingRow[];
}

/**
 * RULMAN VE HALAT SATIRLARI EKİPMAN LİSTESİNDEN SÜZÜLÜR, ayrı bir kaynaktan
 * değil: "Tambur rulmanı" satırı zaten oradadır ve ikinci bir liste tutmak
 * ikisinin ayrışması demekti. Süzgeç EKİPMAN ADINA bakar — anahtar değil ad,
 * çünkü ekipman listesi satırının `rowKey`i modül+alan biçimindedir ve rulman
 * dört ayrı modülde dört ayrı anahtarla geçer.
 */
const RULMAN_DESENI = /rulman|yatak/i;
const HALAT_DESENI = /halat/i;

function etiketDegerTablosu(rows: readonly LabeledValue[] | undefined): ManualTable {
  return {
    head: ["Özellik", "Değer"],
    // DEĞERSİZ SATIR BASILMAZ: "Kanca Yüksekliği : —" bilgi değil kusurdur
    // (teklifteki aynı kural).
    rows: (rows ?? [])
      .filter((r) => r.value.trim() && r.value.trim() !== "—")
      .map((r) => [r.label, r.value]),
  };
}

function ekipmanTablosu(rows: readonly ManualEquipmentRow[]): ManualTable {
  return {
    head: ["Ekipman", "Marka", "Model", "Adet", "Grup"],
    rows: rows.map((r) => [r.component, r.brand, r.model, r.qty, r.group]),
  };
}

/** Otomatik bloğun kaynaktan çözülmüş tablosu; kaynak yoksa BOŞ tablo. */
export function resolveAutoTable(
  source: ManualAutoSource,
  data: ManualSourceData
): ManualTable {
  switch (source) {
    case "siniflandirma":
      return etiketDegerTablosu(data.classes);
    case "karakteristik":
      return etiketDegerTablosu(data.characteristics);
    case "hiz":
      return etiketDegerTablosu(data.speeds);

    case "ekipman":
      return ekipmanTablosu(data.equipment ?? []);

    case "rulman":
      return ekipmanTablosu(
        (data.equipment ?? []).filter((r) => RULMAN_DESENI.test(r.component))
      );

    case "halat":
      return ekipmanTablosu(
        (data.equipment ?? []).filter((r) => HALAT_DESENI.test(r.component))
      );

    case "elektrikMalzeme":
      return {
        head: ["Adet", "Tanım", "Tip No", "Tedarikçi", "Malzeme Kodu", "Panolar"],
        rows: materialRows(data.electricalParts ?? []).map((m) => [
          // NULL SIFIR DEĞİLDİR: okunamayan adet boş basılır.
          m.qty === null ? "" : String(m.qty),
          m.designation,
          m.typeNo,
          m.supplier,
          m.partNo,
          m.locations.map((l) => `+${l}`).join(" "),
        ]),
      };

    case "elektrikSayfa":
      return {
        head: ["Sayfa", "Pano", "Pafta", "Sayfa Adı"],
        rows: (data.electricalSheets ?? []).map((s) => [
          String(s.page),
          s.location ? `+${s.location}` : "",
          s.sheetNo,
          s.title,
        ]),
      };

    case "teknikResim":
      return {
        head: ["Resim No", "Ad", "Durum"],
        rows: (data.drawings ?? []).map((d) => [d.no, d.name, d.status]),
      };
  }
}

/**
 * Otomatik bloğun BASILACAK tablosu.
 *
 * TASLAKTA CANLI, YAYIMDA DONMUŞ: `frozen` varsa O basılır ve kaynak artık
 * okunmaz. Aksi hâlde yayımlanmış bir kılavuz, hesap raporu sonradan revize
 * edilince sessizce başka bir şey söylerdi (`types.ts` başlığı).
 */
export function autoTableFor(
  block: { source: ManualAutoSource; frozen?: ManualTable },
  data: ManualSourceData
): ManualTable {
  return block.frozen ?? resolveAutoTable(block.source, data);
}
