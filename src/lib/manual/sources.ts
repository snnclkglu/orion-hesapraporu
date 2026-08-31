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

import { rollupBy } from "@/lib/electrical/rollup";
import type { ElectricalPart, ElectricalSheet } from "@/lib/electrical/types";
import type { ReportCoverSpec } from "@/lib/pdf/report";
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
  /**
   * Seçimin belirleyici teknik özelliği ("i=52,57 · 22 kNm", "Ø400 mm").
   * DETAYLI ve KATALOGLU varyantlarda bir sütun olarak basılır; kaynak bunu
   * doldurmuyorsa sütun HİÇ AÇILMAZ — boş bir sütun bilgi değil kusurdur
   * (değişmez md. 4·5).
   */
  specs?: string;
  /** Katalog föyünün insan okunur atfı ("YILMAZ H/B, s. 214"). */
  catalogRef?: string;
  /**
   * Satır bir SEÇENEK (alternatif ekipman) — vince TAKILI DEĞİLDİR.
   *
   * Ekipman listesi seçenekleri ana satırın altında gösterir ve el kitabında
   * da öyle basılır. Ama bakım çizelgesi ve yağlama tablosu yalnız TAKILI
   * ekipmanı sayar: takılmamış bir redüktörün yağını değiştirmek diye bir
   * görev yoktur ve o satır bakımcıyı olmayan bir parçayı aramaya gönderirdi.
   */
  alternative?: boolean;
}

/** Teknik Resim Takibi defterinin el kitabına giren yüzü. */
export interface ManualDrawingRow {
  no: string;
  name: string;
  status: string;
}

/** Çözücünün beslendiği bütün kaynaklar. Hepsi isteğe bağlıdır. */
export interface ManualSourceData {
  /** Hesap raporuyla aynı kaynaktan üretilen kapak özellikleri. */
  coverSpecs?: ReportCoverSpec[];
  classes?: LabeledValue[];
  characteristics?: LabeledValue[];
  speeds?: LabeledValue[];
  equipment?: ManualEquipmentRow[];
  electricalParts?: ElectricalPart[];
  electricalSheets?: ElectricalSheet[];
  drawings?: ManualDrawingRow[];
  /**
   * Kaldırma mekanizması grubu ("M8") — bakım kural defterindeki `minGroup`
   * kuralları bunu okur.
   *
   * Sınıflandırma tablosunda da geçer ama oradan METİN AYIKLAMAK gerekirdi
   * (etiket dile ve biçime bağlıdır); grup burada AYRI bir alan olarak durur.
   * Bilinmiyorsa BOŞTUR ve `minGroup` kuralları çıkmaz — varsayılmaz
   * (değişmez md. 4).
   */
  hoistGroup?: string;
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

/**
 * EKİPMAN TABLOSU — kapsam paketinin verdiği ayrıntı basamağına göre.
 *
 * Kullanıcı isteği (30.08.2026): *"bir müşteriye ekipman listesini detaylı
 * kataloglu veririm diğerine standart versiyonu."*
 *
 * SÜTUN VERİ VARSA AÇILIR. `detayli` teknik özellik sütununu, `kataloglu`
 * ayrıca katalog sütununu ister; ama kaynak o alanı doldurmuyorsa sütun hiç
 * basılmaz. Baştan sona boş bir sütun, okuyana bir şey vaat edip vermemekti —
 * üstelik dar sütunda tabloyu gereksiz yere tam genişliğe iterdi (KITAP-11).
 */
function ekipmanTablosu(
  rows: readonly ManualEquipmentRow[],
  variant?: string
): ManualTable {
  const ozellik = variant === "detayli" || variant === "kataloglu";
  const katalog = variant === "kataloglu";
  const ozellikVar = ozellik && rows.some((r) => (r.specs ?? "").trim() !== "");
  const katalogVar = katalog && rows.some((r) => (r.catalogRef ?? "").trim() !== "");

  return {
    head: [
      "Ekipman",
      "Marka",
      "Model",
      ...(ozellikVar ? ["Teknik Özellik"] : []),
      "Adet",
      "Grup",
      ...(katalogVar ? ["Katalog"] : []),
    ],
    rows: rows.map((r) => [
      r.component,
      r.brand,
      r.model,
      ...(ozellikVar ? [r.specs ?? ""] : []),
      r.qty,
      r.group,
      ...(katalogVar ? [r.catalogRef ?? ""] : []),
    ]),
  };
}

/** Otomatik bloğun kaynaktan çözülmüş tablosu; kaynak yoksa BOŞ tablo. */
export function resolveAutoTable(
  source: ManualAutoSource,
  data: ManualSourceData,
  variant?: string
): ManualTable {
  switch (source) {
    case "siniflandirma":
      return etiketDegerTablosu(data.classes);
    case "karakteristik":
      return etiketDegerTablosu(data.characteristics);
    case "hiz":
      return etiketDegerTablosu(data.speeds);

    case "ekipman":
      return ekipmanTablosu(data.equipment ?? [], variant);

    case "rulman":
      return ekipmanTablosu(
        (data.equipment ?? []).filter((r) => RULMAN_DESENI.test(r.component)),
        variant
      );

    case "halat":
      return ekipmanTablosu(
        (data.equipment ?? []).filter((r) => HALAT_DESENI.test(r.component)),
        variant
      );

    case "elektrikMalzeme":
      return {
        head: ["Pano", "Proje Satırı", "Toplam Adet"],
        rows: rollupBy(data.electricalParts ?? [], "location").map((m) => [
          m.label,
          String(m.lines),
          // NULL SIFIR DEĞİLDİR: okunamayan adet boş basılır.
          m.qty === null ? "" : String(m.qty),
        ]),
        caption:
          "Pano bazında özet. Ürün ve aygıt düzeyindeki tam malzeme dökümü elektrik projesinde; seçilen teknik föyler tam sürümün EK-F bölümündedir.",
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
  block: { source: ManualAutoSource; frozen?: ManualTable; variant?: string },
  data: ManualSourceData
): ManualTable {
  return block.frozen ?? resolveAutoTable(block.source, data, block.variant);
}
