// Kaldırma grubu sunum katmanı: bölüm yapısı (2.1 … 2.7) + her hesap satırının
// SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
//
// Hesabın kendisi `modules/hoistGroup.ts`tedir; burası yalnız gösterimdir.
// Satırlar sonucu motorun semantik anahtarından (`key`) okur; PDF raporun
// formül satırlarını da bu katman üretir.

import { drumShaftDimsCm, hoistSpecView } from "../modules/hoistGroup";
import type {
  HoistInputs,
  HoistSelections,
  HoistWhich,
} from "../modules/hoistGroup";
import { hasSafetyBrake } from "../types";
import type { TechnicalSpecs } from "../types";

export interface HoistCtx {
  c: Record<string, number | string>; // semantik anahtar → değer (motor çıktısı)
  inp: HoistInputs;
  sel: HoistSelections;
  specs: TechnicalSpecs;
  which: HoistWhich;
}

/**
 * Bu kaldırma grubunun teknik özelliklerden okunan büyüklükleri.
 * Ana, yardımcı ve monoray kaldırma grupları aynı sunumu paylaşır; hangi
 * alanın okunacağını motorun `hoistSpecView`'ı belirler.
 */
const viewOf = (x: HoistCtx) => hoistSpecView(x.specs, x.which);

/**
 * Tambur mili ölçülerinin motor birimindeki (cm) karşılığı.
 *
 * Girdi alanları mm'dir (`drumSpan*Mm`, `shaftD1Mm` …) ve sihirbaz ile rapor
 * girdi tablosunda mm olarak görünür. Buna karşılık 2.2.3/2.2.4/2.2.5 hesap
 * satırlarının SONUÇLARI motorun cm tabanındadır (L cm, M kg·cm, σ kg/cm²,
 * W cm³). Formül satırındaki sayılar bu yüzden cm cinsinden yazılır — satırın
 * birim etiketi ile yerine konmuş sayılar aynı birimde olmalıdır, aksi hâlde
 * rapor 10 kat yanlış okunur.
 *
 * Dönüşüm motorun kendi yardımcısıyla yapılır (`drumShaftDimsCm`); sunumda
 * ikinci bir "/ 10" yazılmaz.
 */
const dimsOf = (x: HoistCtx) => drumShaftDimsCm(x.inp);

export interface HoistRowDef {
  /** Sonucun okunacağı semantik anahtar (`<blok>.<büyüklük>`) */
  key: string;
  label: string;
  formula?: string;          // sembolik formül (ör. "F = G / n / η")
  /** Motor hücresi yerine sunuma dönüştürülmüş değer. */
  valueFrom?: (ctx: HoistCtx) => number | string;
  subst?: (ctx: HoistCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /**
   * Ölçü bir ÇAPTIR — gösterilen değerin başına "Ø" konur (bkz. fields.ts
   * `withDiameterSign`). Arayüz ve PDF aynı bayrağı okur.
   */
  diameter?: true;
}

export interface HoistSectionDef {
  id: string;                // "2.1"
  title: string;
  description?: string;
  inputKeys: (keyof HoistInputs & string)[];
  selectionKeys: (keyof HoistSelections & string)[];
  rows: HoistRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "rope.safety") */
  checkSuffixes: string[];
  /**
   * Bölüm yalnız bu koşul sağlandığında gösterilir (arayüz ve rapor ortak).
   * Emniyet freni her kaldırma grubunda bulunmaz; olmayan grupta bölüm hiç
   * çizilmez — boş bir "seçim yapılmadı" bloğu rapora gürültü katardı.
   */
  visible?: (specs: TechnicalSpecs, which: HoistWhich) => boolean;
  /**
   * Bu bölümün ekipman listesindeki satır slug'ları (`EqRow.rowKey`in
   * `<modulKey>:` sonrası). Bölüm GİZLENDİĞİNDE bu satırlar da listeden düşer
   * (ekran + Excel + PDF). Slug'lar `excel/equipment.ts`teki satır
   * üreticileriyle birebir aynıdır ve bu bağ bir koruma testiyle ölçülür
   * (`hidden-sections-equipment.test.ts`) — elle yazılmış bir slug'ın
   * yazım hatası sessizce "satır düşmüyor"a dönüşmesin.
   */
  equipmentSlugs?: readonly string[];
}

// Sayı biçimleyici (formül substitüsyonu için, TR yerel)
const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

export const HOIST_SECTIONS: HoistSectionDef[] = [
  {
    id: "2.1",
    title: "Halat",
    equipmentSlugs: ["rope", "ropeLeft"],
    description:
      "Donanım, halat verimi, halat yükü ve halat seçimi (FEM 1.001). Tek makara " +
      "verimi, rulmanlı yataklı makara (yüksek verim) standart kabulüdür.",
    inputKeys: [
      "reevingLabel", "drivenFalls", "totalFalls", "sheaveEfficiency",
      "fixedSheaveCount", "hookBlockWeightKg", "ropeWeightKg", "ropeBalancingType",
    ],
    selectionKeys: [
      "ropeBrand", "ropeDiaMm", "ropeConstruction", "ropeCore",
      "ropeWireStrength", "ropeBreakingLoadKn", "ropeWeightKgPerM",
    ],
    rows: [
      // Yükün tonajı halat zincirinin BAŞIDIR: rapor okuyucusu önce hangi
      // yükün kaldırıldığını görmeli, sonra halat kuvvetine inmelidir.
      {
        key: "load.capacityT", label: "Kaldırma Kapasitesi", formula: "Q  [teknik özellik]",
        subst: (x) => `${n(viewOf(x).capacityT, 3)} t`,
        unit: "t", digits: 3,
      },
      {
        key: "reeving.mechanicalAdvantage", label: "Mekanik Avantaj",
        formula: "i = n_toplam / n_tahrik",
        subst: (x) => `${n(x.inp.totalFalls)} / ${n(x.inp.drivenFalls)}`,
      },
      {
        key: "reeving.ropeEfficiency", label: "Halat Donanımı Verimi",
        formula: "η = (η_m^s / i) · (1 − η_m^i) / (1 − η_m)",
        subst: (x) => `(${n(x.inp.sheaveEfficiency, 3)}^${n(x.inp.fixedSheaveCount)} / ${n(num(x.c["reeving.mechanicalAdvantage"]))}) · (1 − ${n(x.inp.sheaveEfficiency, 3)}^${n(num(x.c["reeving.mechanicalAdvantage"]))}) / (1 − ${n(x.inp.sheaveEfficiency, 3)})`,
        digits: 4,
      },
      {
        key: "load.hoisted", label: "Kaldırılan Yük", formula: "G_yük = Q · 1000",
        subst: (x) => `${n(viewOf(x).capacityT)} · 1000`,
        unit: "kg",
      },
      {
        key: "load.total", label: "Toplam Yük", formula: "G_t = G_yük + G_blok + G_halat",
        subst: (x) => `${n(num(x.c["load.hoisted"]))} + ${n(x.inp.hookBlockWeightKg)} + ${n(x.inp.ropeWeightKg)}`,
        unit: "kg",
      },
      {
        key: "rope.requiredSafety", label: "Gerekli Halat Emniyet Katsayısı",
        formula: "Zp = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) =>
          `${viewOf(x).mechanismClass} → ${n(num(x.c["rope.requiredSafety"]))}`,
        standard: "FEM 1.001 T.4.2.2.1.2",
      },
      {
        key: "rope.load", label: "Halat Yükü", formula: "F = G_t / n_toplam / η",
        subst: (x) => `${n(num(x.c["load.total"]))} / ${n(x.inp.totalFalls)} / ${n(num(x.c["reeving.ropeEfficiency"]), 4)}`,
        unit: "kg",
      },
      {
        key: "rope.requiredBreakingLoad", label: "Gerekli Min. Kopma Yükü",
        formula: "F_k,min = F · Zp",
        subst: (x) => `${n(num(x.c["rope.load"]))} · ${n(num(x.c["rope.requiredSafety"]))}`,
        unit: "kg",
      },
      {
        key: "rope.breakingLoad", label: "Seçilen Halatın Kopma Yükü",
        formula: "F_k = F_k,kN / 9,81 · 1000",
        subst: (x) => `${n(x.sel.ropeBreakingLoadKn)} / 9,81 · 1000`, unit: "kg",
      },
      {
        key: "rope.actualSafety", label: "Gerçekleşen Emniyet Katsayısı",
        formula: "n = F_k / F",
        subst: (x) => `${n(num(x.c["rope.breakingLoad"]))} / ${n(num(x.c["rope.load"]))}`,
      },
    ],
    checkSuffixes: ["rope.safety"],
  },
  {
    id: "2.2.1",
    title: "Tambur",
    equipmentSlugs: ["drum"],
    description: "Minimum tambur çapı (FEM H katsayısı) ve tambur sacı gerilme kontrolü.",
    inputKeys: ["drumWallThicknessMm"],
    selectionKeys: ["drumDiaMm", "drumMaterial"],
    rows: [
      {
        key: "drum.coefficient", label: "Tambur Çap Katsayısı",
        formula: "H = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) =>
          `${viewOf(x).mechanismClass} → ${n(num(x.c["drum.coefficient"]))}`,
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        key: "drum.minDia", label: "Minimum Tambur Çapı", formula: "D_min = H · d", diameter: true,
        subst: (x) => `${n(num(x.c["drum.coefficient"]))} · ${n(x.sel.ropeDiaMm)}`, unit: "mm",
      },
      {
        key: "drum.groovePitch", label: "Hatve p", formula: "p = d + pay  [DIN 15061]",
        subst: (x) => `${n(x.sel.ropeDiaMm)} + ${n(num(x.c["drum.groovePitch"]) - x.sel.ropeDiaMm, 1)}`,
        unit: "mm", standard: "DIN 15061",
      },
      {
        key: "drum.bearingStress", label: "Ezilme Gerilmesi",
        formula: "σ_ez = 0,5 · F · 100 / (p · s)",
        subst: (x) => `0,5 · ${n(num(x.c["rope.load"]))} · 100 / (${n(num(x.c["drum.groovePitch"]))} · ${n(x.inp.drumWallThicknessMm)})`,
        unit: "kg/cm²",
      },
      {
        key: "drum.bendingStress", label: "Eğilme Gerilmesi",
        formula: "σ_eğ = 0,96 · F · (1 / ((D/10)² · (s/10)⁶))^0,25",
        subst: (x) => `0,96 · ${n(num(x.c["rope.load"]))} · (1 / ((${n(x.sel.drumDiaMm)}/10)² · (${n(x.inp.drumWallThicknessMm)}/10)⁶))^0,25`,
        unit: "kg/cm²",
      },
      {
        key: "drum.combinedStress", label: "Bileşik Gerilme",
        formula: "σ_b = √(σ_eğ² + σ_ez² − σ_ez·σ_eğ)",
        subst: (x) => `√(${n(num(x.c["drum.bendingStress"]))}² + ${n(num(x.c["drum.bearingStress"]))}² − ${n(num(x.c["drum.bearingStress"]))}·${n(num(x.c["drum.bendingStress"]))})`,
        unit: "kg/cm²",
      },
      {
        key: "drum.allowableStress", label: "İzin Verilen Gerilme",
        formula: "σ_em = f(malzeme)",
        subst: (x) => `${x.sel.drumMaterial} → ${n(num(x.c["drum.allowableStress"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["drum.stress", "drum.dia"],
  },
  {
    id: "2.2.2",
    title: "Yiv Boyu",
    inputKeys: ["safetyGrooveCount"],
    selectionKeys: ["drumGrooveLengthText"],
    rows: [
      {
        key: "drum.requiredGrooves", label: "Gerekli Sarım Sayısı",
        formula: "z = (i · h) / (π · D) + z_emn",
        subst: (x) => `(${n(num(x.c["reeving.mechanicalAdvantage"]))} · ${n(viewOf(x).liftHeightM)}) / (π · ${n(x.sel.drumDiaMm / 1000, 3)}) + ${n(x.inp.safetyGrooveCount)}`,
      },
      {
        key: "drum.requiredGrooveLength", label: "Gerekli Yiv Boyu", formula: "L = z · p",
        subst: (x) => `${n(num(x.c["drum.requiredGrooves"]))} · ${n(num(x.c["drum.groovePitch"]))}`,
        unit: "mm", digits: 1,
      },
      {
        key: "rope.lengthPerGroove", label: "Tek Yiv İçin Halat Boyu",
        formula: "L_h = z · π · D + 0,10 · h · (n_toplam / n_tahrik)",
        subst: (x) =>
          `${n(num(x.c["drum.requiredGrooves"]))} · π · ${n(x.sel.drumDiaMm / 1000, 3)} + ` +
          `0,10 · ${n(viewOf(x).liftHeightM)} · (${n(x.inp.totalFalls)} / ${n(x.inp.drivenFalls)})`,
        unit: "m", digits: 2,
      },
      {
        key: "rope.totalLength", label: "Toplam Çelik Halat Boyu",
        formula: "L_top = L_h · n_tahrik",
        subst: (x) => `${n(num(x.c["rope.lengthPerGroove"]))} · ${n(x.inp.drivenFalls)}`,
        unit: "m", digits: 2,
      },
      {
        key: "rope.arrangement", label: "Halat Sipariş Bölünümü",
        formula: "denge düzenine göre parça adedi, helis yönü ve parça boyu",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "2.2.3",
    title: "Tambur Mili",
    description:
      "Tambur, redüktör tarafı mesnet (Ra) ile tambur yatağı tarafı mesnet (Rg) " +
      "arasında iki mesnetli kiriş olarak çözülür. Yükler: her yiv bölgesindeki " +
      "halat yükü T ve namlu ortasındaki tambur ağırlığı W. Reaksiyonlar hem " +
      "redüktör radyal yük kontrolünde hem tambur yatağı / rulman seçiminde " +
      "kullanılır; mil gerilmeleri D1 kesitinde (eğilme) ve D2 kesitinde (kesme) " +
      "bulunur. Halatlar yiv boyunca hareket ettiğinden iki uç hâli ayrı ayrı " +
      "çözülür; her mesnet KENDİ kritik hâliyle boyutlandırılır (zarf değeri).",
    inputKeys: [
      "drumWeightKg",
      "drumSpanAMm", "drumSpanBMm", "drumSpanCMm", "drumSpanDMm",
      "drumSpanEMm", "drumSpanFMm", "drumSpanGMm",
      "ropeLoadPosition", "shaftD1Mm", "shaftD2Mm",
    ],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "drumShaft.ropeLoadPerPoint", label: "Yük Noktası Başına Halat Yükü (T)",
        formula: "T = F_halat · n_tahrik / yiv bölgesi adedi",
        subst: (x) => `${n(num(x.c["rope.load"]))} · ${n(x.inp.drivenFalls)} / ${n(x.inp.drumSpanEMm > 0 ? 2 : 1)}`,
        unit: "kg",
      },
      {
        key: "drumShaft.span", label: "Mesnetler Arası Açıklık (L)",
        formula: "L = A + B + C + D + E + F + G",
        valueFrom: (x) => num(x.c["drumShaft.span"]) * 10,
        subst: (x) => `${n(x.inp.drumSpanAMm)} + ${n(x.inp.drumSpanBMm)} + ${n(x.inp.drumSpanCMm)} + ${n(x.inp.drumSpanDMm)} + ${n(x.inp.drumSpanEMm)} + ${n(x.inp.drumSpanFMm)} + ${n(x.inp.drumSpanGMm)}`,
        unit: "mm",
      },
      {
        key: "drumShaft.weightArm", label: "Tambur Ağırlık Merkezi (Mesnet A'dan)",
        formula: "x_W = A + (B + C + D + E + F) / 2",
        valueFrom: (x) => num(x.c["drumShaft.weightArm"]) * 10,
        subst: (x) => `${n(x.inp.drumSpanAMm)} + (${n(x.inp.drumSpanBMm + x.inp.drumSpanCMm + x.inp.drumSpanDMm + x.inp.drumSpanEMm + x.inp.drumSpanFMm)}) / 2`,
        unit: "mm",
      },
      {
        key: "drumShaft.reactionBearingOuter", label: "Rg — Halatlar Dış Uçlarda",
        formula: "R_g = (T·x₁ + T·x₂ + W·x_W) / L",
        subst: (x) =>
          `(${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXOuter1"]))} + ${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXOuter2"]))} + ${n(x.inp.drumWeightKg)}·${n(num(x.c["drumShaft.weightArm"]))}) / ${n(num(x.c["drumShaft.span"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearboxOuter", label: "Ra — Halatlar Dış Uçlarda",
        formula: "R_a = ΣT + W − R_g",
        subst: (x) =>
          `${n(num(x.c["drumShaft.ropeLoadPerPoint"]) * 2)} + ${n(x.inp.drumWeightKg)} − ${n(num(x.c["drumShaft.reactionBearingOuter"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionBearingInner", label: "Rg — Halatlar İç Uçlarda",
        formula: "R_g = (T·x₁ + T·x₂ + W·x_W) / L",
        subst: (x) =>
          `(${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXInner1"]))} + ${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXInner2"]))} + ${n(x.inp.drumWeightKg)}·${n(num(x.c["drumShaft.weightArm"]))}) / ${n(num(x.c["drumShaft.span"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearboxInner", label: "Ra — Halatlar İç Uçlarda",
        formula: "R_a = ΣT + W − R_g",
        subst: (x) =>
          `${n(num(x.c["drumShaft.ropeLoadPerPoint"]) * 2)} + ${n(x.inp.drumWeightKg)} − ${n(num(x.c["drumShaft.reactionBearingInner"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearbox", label: "Tasarım Reaksiyonu — Redüktör Tarafı (Ra)",
        formula: "R_a = maks(R_a,dış ; R_a,iç)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.reactionGearboxOuter"]))} ; ${n(num(x.c["drumShaft.reactionGearboxInner"]))})`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionBearing", label: "Tasarım Reaksiyonu — Tambur Yatağı Tarafı (Rg)",
        formula: "R_g = maks(R_g,dış ; R_g,iç)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.reactionBearingOuter"]))} ; ${n(num(x.c["drumShaft.reactionBearingInner"]))})`,
        unit: "kg",
      },
      {
        key: "drumShaft.momentGearbox", label: "Redüktör Tarafı Eğilme Momenti",
        formula: "M_a = R_a · A",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · ${n(dimsOf(x).aCm)}`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.momentBearing", label: "Tambur Yatağı Tarafı Eğilme Momenti",
        formula: "M_g = R_g · G",
        subst: (x) => `${n(num(x.c["drumShaft.reactionBearing"]))} · ${n(dimsOf(x).gCm)}`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.moment", label: "Yönetici Eğilme Momenti (M)",
        formula: "M = maks(M_a, M_g)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.momentGearbox"]))}; ${n(num(x.c["drumShaft.momentBearing"]))})`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.bendingStress", label: "Eğilme Gerilmesi (D1 Kesiti)",
        formula: "σ = M / (π · D1³ / 32)",
        subst: (x) => `${n(num(x.c["drumShaft.moment"]))} / (π · ${n(dimsOf(x).d1Cm)}³ / 32)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.shearStress", label: "Kesme Gerilmesi (D2 Kesiti)",
        // Dolu dairesel kesitte parabolik kayma dağılımının tepe değeri
        // ortalamanın 4/3 katıdır (tarafsız eksende).
        formula: "τ = (4/3) · R / (π · D2² / 4)",
        subst: (x) =>
          `(4/3) · ${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / (π · ${n(dimsOf(x).d2Cm)}² / 4)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.combinedStress", label: "Bileşik Gerilme",
        formula: "σ_bil = √(σ² + τ²)",
        subst: (x) => `√(${n(num(x.c["drumShaft.bendingStress"]))}² + ${n(num(x.c["drumShaft.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.allowableBending", label: "İzin Verilen Eğilme Gerilmesi",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableBending"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumShaft.allowableShear", label: "İzin Verilen Kesme Gerilmesi",
        formula: "τ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableShear"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumShaft.allowableCombined", label: "İzin Verilen Bileşik Gerilme",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableCombined"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaft.bending", "shaft.shear", "shaft.stress"],
  },
  {
    id: "2.2.4",
    title: "Tambur Kaynağı",
    description:
      "Tambur namlusu ile yanak sacı arasındaki çevresel köşe kaynağı: tambur " +
      "torkundan gelen burulma ile mesnet reaksiyonundan gelen kesme birlikte " +
      "etkir; dikişe dik normal gerilme yoktur. Taşıyıcı kesit FEM Ek " +
      "A-3.2.2.3 HESAP-4 uyarınca BOĞAZ alanıdır (a · L_k) — dikişin izdüşüm " +
      "halka alanı değil.",
    inputKeys: ["drumWeldThicknessMm", "drumWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        key: "drumWeld.length", label: "Kaynak Boyu", formula: "L_k = π · D",
        valueFrom: (x) => num(x.c["drumWeld.length"]) * 10,
        subst: (x) => `π · ${n(x.sel.drumDiaMm)}`, unit: "mm",
      },
      {
        key: "drumWeld.throatArea", label: "Taşıyıcı Boğaz Kesiti",
        formula: "A_k = a · L_k",
        subst: (x) => `${n(dimsOf(x).drumWeldThroatCm, 3)} · ${n(num(x.c["drumWeld.length"]))}`,
        unit: "cm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "drumWeld.polarModulus", label: "Burulma Direnç Momenti (boğaz kesiti)",
        formula: "W_p = A_k · D / 2",
        subst: (x) => `${n(num(x.c["drumWeld.throatArea"]))} · ${n(x.sel.drumDiaMm / 10)} / 2`,
        unit: "cm³",
      },
      {
        key: "drumWeld.torsionStress", label: "Burulma Gerilmesi",
        formula: "τ_b = M_t · 100000 / 9,81 / W_p",
        subst: (x) => `${n(num(x.c["drum.torquePerDrum"]), 3)} · 100000 / 9,81 / ${n(num(x.c["drumWeld.polarModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumWeld.shearStress", label: "Kesme Gerilmesi",
        formula: "τ_k = R / A_k",
        subst: (x) => `${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / ${n(num(x.c["drumWeld.throatArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumWeld.totalShear", label: "Toplam Kayma Gerilmesi",
        formula: "τ = τ_k + τ_b",
        subst: (x) => `${n(num(x.c["drumWeld.shearStress"]))} + ${n(num(x.c["drumWeld.torsionStress"]))}`,
        unit: "kg/cm²",
      },
      // İKİ standart da KENDİ gerilme tanımıyla hesaplanır; kullanım oranı
      // büyük olan yönetir. Rapor okuyucusu hangi gerilmenin hangi sınırla
      // karşılaştırıldığını satır satır görebilmelidir.
      {
        key: "drumWeld.combinedStress", label: "Eşdeğer Gerilme (FEM)",
        formula: "σ_cp = √(σ² + 2 · τ²)",
        subst: (x) => `√(0² + 2 · ${n(num(x.c["drumWeld.totalShear"]))}²)`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "drumWeld.principalStress", label: "Asal Gerilme (CMAA)",
        formula: "σ_v = ½·σ ± ½·√(σ² + 4 · τ²)",
        subst: (x) => `± ½ · √(0² + 4 · ${n(num(x.c["drumWeld.totalShear"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 3.4.4.2",
      },
      {
        key: "drumWeld.allowableFem", label: "İzin Verilen Gerilme — FEM (σ_cp için)",
        formula: "σ_a,k = f(çelik ; Durum I)",
        subst: (x) => `${x.sel.drumMaterial} → ${n(num(x.c["drumWeld.allowableFem"]))}`,
        unit: "N/mm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "drumWeld.allowableCmaa", label: "İzin Verilen Gerilme — CMAA (σ_v için)",
        formula: "σ_ALL = 0,60 · σ_akma",
        subst: (x) => `0,60 · ${n(num(x.c["drumWeld.allowableCmaa"]) / 0.6)}`,
        unit: "N/mm²", standard: "CMAA 70 3.4.4.2",
      },
      {
        key: "drumWeld.allowableCmaaShear", label: "İzin Verilen Kayma — CMAA (τ için)",
        formula: "τ_em = 0,35 · σ_akma",
        subst: (x) => `0,35 · ${n(num(x.c["drumWeld.allowableCmaaShear"]) / 0.35)}`,
        unit: "N/mm²", standard: "CMAA 70 3.4.1",
      },
      {
        key: "drumWeld.utilizationFem", label: "Kullanım Oranı — FEM",
        formula: "η_FEM = σ_cp / σ_a,k", unit: "-", digits: 3,
      },
      {
        key: "drumWeld.utilizationCmaa", label: "Kullanım Oranı — CMAA",
        formula: "η_CMAA = maks(σ_v / 0,60σ_akma ; τ / 0,35σ_akma)",
        unit: "-", digits: 3,
      },
      {
        key: "drumWeld.governing", label: "Yöneten Kural",
        formula: "büyük kullanım oranı yönetir",
      },
      {
        key: "drumWeld.governingStress", label: "Karşılaştırılan Gerilme",
        formula: "yöneten kuralın gerilmesi", unit: "N/mm²",
      },
      {
        key: "drumWeld.allowable", label: "Karşılaştırılan Sınır",
        formula: "yöneten kuralın izin gerilmesi", unit: "N/mm²",
      },
    ],
    checkSuffixes: ["drumWeld.stress"],
  },
  {
    id: "2.2.5",
    title: "Tambur Mili Kaynağı",
    description:
      "Mil ile tambur göbeği arasındaki çevresel köşe kaynağı yalnız kesme " +
      "taşımaz: mesnet reaksiyonu dikiş düzleminden (yanak/flanş sacı) bir kol " +
      "kadar uzakta etkir — tambur yatağı tarafında bu kol ölçü zincirindeki " +
      "G ölçüsüdür, redüktör tarafında A'dır. İki mesnedin momenti ayrı " +
      "hesaplanıp zarfı alınır; kesme gerilmesi kritik reaksiyonla bulunur. " +
      "Taşıyıcı kesit FEM Ek A-3.2.2.3 md.4 uyarınca BOĞAZ alanıdır (a · L_k). " +
      "Tambur torku bu dikişten geçmez — tork yolu redüktör tarafı yanaktan " +
      "namluya girer (bölüm 2.2.4); bu uç yalnız mesnet reaksiyonunu aktarır.",
    inputKeys: ["shaftWeldThicknessMm", "shaftWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        key: "shaftWeld.length", label: "Kaynak Boyu", formula: "L_k = π · D1",
        valueFrom: (x) => num(x.c["shaftWeld.length"]) * 10,
        subst: (x) => `π · ${n(x.inp.shaftD1Mm)}`, unit: "mm",
      },
      {
        key: "shaftWeld.throatArea", label: "Taşıyıcı Boğaz Kesiti",
        formula: "A_k = a · L_k",
        subst: (x) => `${n(dimsOf(x).shaftWeldThroatCm, 3)} · ${n(num(x.c["shaftWeld.length"]))}`,
        unit: "cm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "shaftWeld.shearStress", label: "Kesme Gerilmesi", formula: "τ = R / A_k",
        subst: (x) => `${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / ${n(num(x.c["shaftWeld.throatArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "shaftWeld.arm", label: "Kaynak Kolu (yükün flanşa uzaklığı)",
        formula: "e = max(G ; A) tarafının kolu",
        valueFrom: (x) => num(x.c["shaftWeld.arm"]) * 10,
        subst: (x) => {
          return `G = ${n(x.inp.drumSpanGMm)} · A = ${n(x.inp.drumSpanAMm)} → ${n(num(x.c["shaftWeld.arm"]) * 10)}`;
        },
        unit: "mm",
      },
      {
        key: "shaftWeld.bendingMoment", label: "Eğilme Momenti",
        formula: "M_k = R · e",
        subst: (x) => `${n(num(x.c["shaftWeld.arm"]) > 0 ? num(x.c["shaftWeld.bendingMoment"]) / num(x.c["shaftWeld.arm"]) : NaN)} · ${n(num(x.c["shaftWeld.arm"]))}`,
        unit: "kg·cm",
      },
      {
        key: "shaftWeld.sectionModulus", label: "Eğilme Direnç Momenti",
        formula: "W_k = π · a · D1² / 4",
        subst: (x) => {
          const d = dimsOf(x);
          return `π · ${n(d.shaftWeldThroatCm, 3)} · ${n(d.d1Cm)}² / 4`;
        },
        unit: "cm³",
      },
      {
        key: "shaftWeld.bendingStress", label: "Eğilme Gerilmesi",
        formula: "σ_eğ = M_k / W_k",
        subst: (x) => `${n(num(x.c["shaftWeld.bendingMoment"]))} / ${n(num(x.c["shaftWeld.sectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "shaftWeld.combinedStress", label: "Eşdeğer Gerilme (FEM)",
        formula: "σ_cp = √(σ_eğ² + 2 · τ²)",
        subst: (x) => `√(${n(num(x.c["shaftWeld.bendingStress"]))}² + 2 · ${n(num(x.c["shaftWeld.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "shaftWeld.principalStress", label: "Asal Gerilme (CMAA)",
        formula: "σ_v = ½·σ_eğ ± ½·√(σ_eğ² + 4 · τ²)",
        subst: (x) => `½ · ${n(num(x.c["shaftWeld.bendingStress"]))} ± ½ · √(${n(num(x.c["shaftWeld.bendingStress"]))}² + 4 · ${n(num(x.c["shaftWeld.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 3.4.4.2",
      },
      {
        key: "shaftWeld.allowableFem", label: "İzin Verilen Gerilme — FEM (σ_cp için)",
        formula: "σ_a,k = f(çelik ; Durum I)",
        subst: (x) => `${x.sel.drumMaterial} → ${n(num(x.c["shaftWeld.allowableFem"]))}`,
        unit: "N/mm²", standard: "FEM 1.001 T.3.2.2.3",
      },
      {
        key: "shaftWeld.allowableCmaa", label: "İzin Verilen Gerilme — CMAA (σ_v için)",
        formula: "σ_ALL = 0,60 · σ_akma",
        subst: (x) => `0,60 · ${n(num(x.c["shaftWeld.allowableCmaa"]) / 0.6)}`,
        unit: "N/mm²", standard: "CMAA 70 3.4.4.2",
      },
      {
        key: "shaftWeld.allowableCmaaShear", label: "İzin Verilen Kayma — CMAA (τ için)",
        formula: "τ_em = 0,35 · σ_akma",
        subst: (x) => `0,35 · ${n(num(x.c["shaftWeld.allowableCmaaShear"]) / 0.35)}`,
        unit: "N/mm²", standard: "CMAA 70 3.4.1",
      },
      {
        key: "shaftWeld.utilizationFem", label: "Kullanım Oranı — FEM",
        formula: "η_FEM = σ_cp / σ_a,k", unit: "-", digits: 3,
      },
      {
        key: "shaftWeld.utilizationCmaa", label: "Kullanım Oranı — CMAA",
        formula: "η_CMAA = maks(σ_v / 0,60σ_akma ; τ / 0,35σ_akma)",
        unit: "-", digits: 3,
      },
      {
        key: "shaftWeld.governing", label: "Yöneten Kural",
        formula: "büyük kullanım oranı yönetir",
      },
      {
        key: "shaftWeld.governingStress", label: "Karşılaştırılan Gerilme",
        formula: "yöneten kuralın gerilmesi", unit: "N/mm²",
      },
      {
        key: "shaftWeld.allowable", label: "Karşılaştırılan Sınır",
        formula: "yöneten kuralın izin gerilmesi", unit: "N/mm²",
      },
    ],
    checkSuffixes: ["shaftWeld.stress"],
  },
  {
    id: "2.2.6",
    title: "Tambur Rulmanı",
    equipmentSlugs: ["drumBearing"],
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM T.2.1.3.2).",
    inputKeys: ["bearingFactorY1", "bearingFactorY2"],
    selectionKeys: ["bearingType", "bearingCode", "bearingBoreMm", "bearingDynCKn", "bearingStatC0Kn"],
    rows: [
      {
        key: "drumBearing.bore", label: "Rulman İç Çapı / Mil Oturma Çapı",
        formula: "d_rulman = D2",
        subst: (x) => `${n(x.sel.bearingBoreMm)} = ${n(x.inp.shaftD2Mm)}`,
        unit: "mm",
      },
      {
        key: "drumBearing.radialLoad", label: "Radyal Yük (Tambur Yatağı Reaksiyonundan)",
        formula: "F_r = R_g · 0,00981",
        subst: (x) => `${n(num(x.c["drumShaft.reactionBearing"]))} · 0,00981`, unit: "kN",
      },
      {
        key: "drumBearing.axialLoad", label: "Eksenel Yük", formula: "F_a = 0,1 · F_r",
        subst: (x) => `0,1 · ${n(num(x.c["drumBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "drumBearing.equivalentStatic", label: "Eşdeğer Statik Yük",
        formula: "P₀ = F_r + Y₁ · F_a",
        subst: (x) => `${n(num(x.c["drumBearing.radialLoad"]))} + ${n(x.inp.bearingFactorY1)} · ${n(num(x.c["drumBearing.axialLoad"]))}`,
        unit: "kN",
      },
      {
        key: "drumBearing.staticSafety", label: "Statik Emniyet", formula: "s₀ = C₀ / P₀",
        subst: (x) => `${n(x.sel.bearingStatC0Kn)} / ${n(num(x.c["drumBearing.equivalentStatic"]))}`,
      },
      {
        key: "drum.rpm", label: "Tambur Devri", formula: "n_t = (v · i) / (D · π)",
        subst: (x) => `(${n(viewOf(x).liftSpeedMpm)} · ${n(num(x.c["reeving.mechanicalAdvantage"]))}) / (${n(x.sel.drumDiaMm / 1000, 3)} · π)`,
        unit: "d/dak",
      },
      {
        key: "drumBearing.lifeHours", label: "Rulman Ömrü (L10)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)^(10/3)",
        subst: (x) => `(10⁶ / (60·${n(num(x.c["drum.rpm"]))})) · (${n(x.sel.bearingDynCKn)}/${n(num(x.c["drumBearing.equivalentDynamic"]))})^(10/3)`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        key: "drumBearing.requiredLifeMin", label: "Gerekli Minimum Ömür",
        formula: "L_min = f(kullanım sınıfı)",
        subst: (x) =>
          `${viewOf(x).usageClass} → ${n(num(x.c["drumBearing.requiredLifeMin"]), 0)}`,
        unit: "saat", digits: 0,
      },
    ],
    checkSuffixes: ["bearing.bore", "bearing.life", "bearing.static"],
  },
  {
    id: "2.2.7",
    title: "Tambur Rulman Yatağı",
    equipmentSlugs: ["drumBearingHousing"],
    description: "Seçilen tambur rulmanına uyumlu SKF SNL/SE iki parçalı yatak gövdesi; silindirik yataklama için katalogdan seçilir.",
    inputKeys: [],
    selectionKeys: [
      "bearingHousingBrand",
      "bearingHousingCode",
      "bearingHousingSeries",
      "bearingHousingCompatibleBearing",
      "bearingHousingBoreMm",
      "bearingHousingWidthMm",
      "bearingHousingSeatType",
    ],
    rows: [],
    checkSuffixes: [],
  },
  {
    id: "2.3",
    title: "Redüktör",
    equipmentSlugs: ["gearbox"],
    description: "Tambur torku, gerekli çevrim oranı ve redüktör seçimi.",
    inputKeys: ["drumCount", "gearboxServiceFactor", "reducerStages", "stageEfficiency"],
    selectionKeys: ["gearboxModel", "gearboxRatio", "gearboxNominalTorqueKnm", "gearboxInputShaftMm", "gearboxOutputShaftMm", "gearboxAllowedRadialKn"],
    rows: [
      {
        key: "drum.torque", label: "Tambur Torku", formula: "M_t = r · n_tah · F_kN",
        subst: (x) => `${n(num(x.c["drum.radius"]), 3)} · ${n(x.inp.drivenFalls)} · ${n(num(x.c["rope.loadKn"]), 3)}`,
        unit: "kNm", digits: 3,
      },
      {
        key: "gearbox.requiredTorque", label: "Gerekli Redüktör Torku", formula: "M_g = k_e · M_t",
        subst: (x) => `${n(x.inp.gearboxServiceFactor)} · ${n(num(x.c["drum.torquePerDrum"]), 3)}`,
        unit: "kNm", digits: 3,
      },
      {
        key: "gearbox.requiredRatio", label: "Gerekli Çevrim Oranı",
        formula: "i_g = n_motor / n_tambur",
        subst: (x) => `${n(x.sel.motorRpm)} / ${n(num(x.c["drum.rpm"]))}`,
      },
      {
        key: "gearbox.ratioDeviation", label: "Oran Sapması",
        formula: "Δi = 100 · (i_seç − i_g) / i_g",
        subst: (x) => `100 · (${n(x.sel.gearboxRatio)} − ${n(num(x.c["gearbox.requiredRatio"]))}) / ${n(num(x.c["gearbox.requiredRatio"]))}`,
        unit: "%",
      },
      {
        key: "gearbox.actualLiftSpeed", label: "Gerçekleşen Kaldırma Hızı",
        formula: "v = (n_m / i) · π · D / i_donanım",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.drumDiaMm / 1000, 3)} / ${n(num(x.c["reeving.mechanicalAdvantage"]))}`,
        unit: "m/dak",
      },
      {
        key: "gearbox.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_nominal / M_t",
        subst: (x) => `${n(x.sel.gearboxNominalTorqueKnm)} / ${n(num(x.c["drum.torquePerDrum"]), 3)}`,
      },
      {
        key: "gearbox.radialLoad", label: "Redüktöre Gelen Radyal Yük",
        formula: "F_rad = R_a · 9,81 / 1000",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · 9,81 / 1000`, unit: "kN",
      },
      {
        key: "gearbox.efficiency", label: "Redüktör Verimi", formula: "η_r = η_kademe^s",
        subst: (x) => `${n(x.inp.stageEfficiency)}^${n(x.inp.reducerStages)}`, digits: 4,
      },
    ],
    checkSuffixes: ["gearbox.torque", "gearbox.ratio", "gearbox.radial"],
  },
  {
    id: "2.4",
    title: "Motor",
    equipmentSlugs: ["motor"],
    description: "Motor giriş torku ve gerekli güç (CMAA 70).",
    inputKeys: ["tempFactor", "motorDivisor"],
    selectionKeys: ["motorBrand", "motorModel", "motorPowerKw", "motorRpm", "motorShaftMm", "motorCount"],
    rows: [
      {
        key: "gearbox.outputTorque", label: "Redüktör Çıkış Torku", formula: "M_ç = M_t · 1000",
        subst: (x) => `${n(num(x.c["drum.torquePerDrum"]), 3)} · 1000`, unit: "Nm",
      },
      {
        key: "motor.inputTorque", label: "Motor Giriş Torku", formula: "M_m = M_ç / (i · η_r)",
        subst: (x) => `${n(num(x.c["gearbox.outputTorque"]))} / (${n(x.sel.gearboxRatio)} · ${n(num(x.c["gearbox.efficiency"]), 4)})`,
        unit: "Nm",
      },
      {
        key: "motor.requiredPower", label: "Gerekli Güç", formula: "P = M_m · n_m / 9550",
        subst: (x) => `${n(num(x.c["motor.inputTorque"]))} · ${n(x.sel.motorRpm)} / 9550`, unit: "kW",
      },
      {
        key: "motor.adjustedPower", label: "Sıcaklık Düzeltmeli Güç", formula: "P' = k_t · P",
        subst: (x) => `${n(x.inp.tempFactor)} · ${n(num(x.c["motor.requiredPower"]))}`, unit: "kW",
      },
      {
        key: "motor.installedPower", label: "Kurulu Güç", formula: "P_kurulu = P_motor · adet",
        subst: (x) => `${n(x.sel.motorPowerKw)} · ${n(x.sel.motorCount)}`, unit: "kW",
      },
    ],
    checkSuffixes: ["motor.power"],
  },
  {
    id: "2.5",
    title: "Fren",
    equipmentSlugs: ["brake"],
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeModel", "brakeTorqueNm", "brakeWheelDiaMm", "brakeQty"],
    rows: [
      {
        key: "motor.shaftTorque", label: "Fren Miline Gelen Tork", formula: "M_f = M_m / adet",
        subst: (x) => `${n(num(x.c["motor.inputTorque"]))} / ${n(x.sel.motorCount)}`, unit: "Nm",
      },
      {
        key: "brake.requiredTorque", label: "Gerekli Fren Torku", formula: "M_f,g = M_f · k_f",
        subst: (x) => `${n(num(x.c["motor.shaftTorque"]))} · ${n(x.inp.brakeServiceFactor)}`, unit: "Nm",
      },
      {
        key: "brake.actualSafety", label: "Gerçekleşen Emniyet", formula: "n = M_fren / M_f",
        subst: (x) => `${n(x.sel.brakeTorqueNm)} / ${n(num(x.c["motor.shaftTorque"]))}`,
      },
      {
        key: "brake.combinedSafety", label: "Toplam Fren Emniyeti (Tüm Frenler)",
        formula: "n_top = adet · n",
        subst: (x) => `${n(x.sel.brakeQty)} · ${n(num(x.c["brake.actualSafety"]))}`,
      },
    ],
    checkSuffixes: ["brake.torque"],
  },
  {
    id: "2.6",
    title: "Motor — Redüktör Kaplini",
    equipmentSlugs: ["motorCoupling"],
    inputKeys: ["motorCouplingServiceFactor"],
    selectionKeys: ["motorCouplingBrand", "motorCouplingModel", "motorCouplingWheelDiaMm", "motorCouplingTorqueNm", "motorCouplingDmaxMm"],
    rows: [
      {
        key: "motorCoupling.requiredTorque", label: "Gerekli Kaplin Kapasitesi",
        formula: "M_k = M_m · k",
        subst: (x) => `${n(num(x.c["motor.shaftTorque"]))} · ${n(x.inp.motorCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "motorCoupling.shaftDia", label: "Bağlanacak En Büyük Mil", diameter: true,
        formula: "d = maks(d_motor, d_redüktör)",
        subst: (x) => `maks(${n(x.sel.motorShaftMm)}, ${n(x.sel.gearboxInputShaftMm)})`, unit: "mm",
      },
      {
        key: "motorCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_kaplin / M_m",
        subst: (x) => `${n(x.sel.motorCouplingTorqueNm)} / ${n(num(x.c["motor.shaftTorque"]))}`,
      },
    ],
    checkSuffixes: ["motorCoupling.torque", "motorCoupling.bore"],
  },
  {
    id: "2.7",
    title: "Tambur Kaplini",
    equipmentSlugs: ["drumCoupling"],
    inputKeys: ["drumCouplingServiceFactor"],
    selectionKeys: ["drumCouplingBrand", "drumCouplingModel", "drumCouplingTorqueNm", "drumCouplingRadialN", "drumCouplingDmaxMm"],
    rows: [
      {
        key: "drumCoupling.requiredTorque", label: "Gerekli Kaplin Kapasitesi",
        formula: "M_k = M_t,tasarım · k",
        subst: (x) => `${n(num(x.c["drumCoupling.designTorque"]))} · ${n(x.inp.drumCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "drumCoupling.requiredRadial", label: "Gerekli Radyal Yük Kapasitesi",
        formula: "F_rad = R_a · 9,81",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · 9,81`, unit: "N",
      },
      {
        key: "drumCoupling.shaftDia", label: "Bağlanacak Mil Çapı", diameter: true,
        formula: "d = d_redüktör çıkış mili",
        subst: (x) => `${n(x.sel.gearboxOutputShaftMm)}`, unit: "mm",
      },
      {
        key: "drumCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_kaplin / M_t,tasarım",
        subst: (x) => `${n(x.sel.drumCouplingTorqueNm)} / ${n(num(x.c["drumCoupling.designTorque"]))}`,
      },
    ],
    checkSuffixes: ["drumCoupling.torque", "drumCoupling.radial", "drumCoupling.bore"],
  },
  {
    id: "2.8",
    title: "Emniyet Freni",
    description:
      "Emniyet freni tamburun flanşını disk olarak kullanan kaliper frendir. " +
      "Motor mili üzerindeki servis freni ile tambur arasındaki aktarma organları " +
      "(kaplin, redüktör, mil) koparsa yükü tutan tek eleman odur; bu yüzden " +
      "frenleme momenti redüktör öncesinde değil doğrudan TAMBURDA istenir. " +
      "Kaliper flanşın iki yüzünü FA sıkma kuvvetiyle kavrar: " +
      "M_fren = 2 · FA · µ · (d_flanş/2 − x). Sıkma kuvveti ayarlanan hava " +
      "aralığına (c) göre katalogdan okunur; x kaliper baskı merkezinin flanş " +
      "dış kenarından içeri mesafesidir. Flanş dış çapı hem katalogun en küçük " +
      "disk çapını hem de tambur çapı + radyal payı sağlamalıdır.",
    visible: (specs, which) => hasSafetyBrake(specs, which),
    inputKeys: ["safetyBrakeServiceFactor", "safetyBrakeFlangeClearanceMm"],
    selectionKeys: [
      "safetyBrakeModel", "safetyBrakeAirGapMm", "safetyBrakeArrangement",
      "safetyBrakeFlangeDiaMm", "safetyBrakeFlangeThicknessMm",
      "safetyBrakeHydraulicUnit",
    ],
    rows: [
      {
        key: "safety.requiredTorque", label: "Tamburda Gereken Frenleme Momenti",
        formula: "M_gerekli = M_tambur · 1000",
        subst: (x) => `${n(num(x.c["drum.torquePerDrum"]), 3)} · 1000`,
        unit: "Nm",
      },
      {
        key: "safety.demandTorque", label: "İstenen Frenleme Momenti (Emniyetli)",
        formula: "M_istenen = k · M_gerekli",
        subst: (x) => `${n(x.inp.safetyBrakeServiceFactor)} · ${n(num(x.c["safety.requiredTorque"]))}`,
        unit: "Nm",
      },
      {
        key: "safety.clampForce", label: "Sıkma Kuvveti FA",
        formula: "FA = f(model, fren boşluğu c)   [SIBRE katalog]",
        subst: (x) => `${x.sel.safetyBrakeModel} · c = ${n(x.sel.safetyBrakeAirGapMm)} mm`,
        unit: "N",
      },
      {
        key: "safety.leverX", label: "Kaliper Baskı Ölçüsü x",
        formula: "x = f(model)   [SIBRE katalog]",
        subst: (x) => `${x.sel.safetyBrakeModel}`, unit: "mm",
      },
      {
        key: "safety.minFlangeDia", label: "Minimum Flanş Dış Çapı", diameter: true,
        formula: "d_min = maks(d_katalog ; D_tambur + Δ) + pay",
        subst: (x) =>
          `maks(katalog ; ${n(x.sel.drumDiaMm)} + Δ) + ${n(x.inp.safetyBrakeFlangeClearanceMm)}`,
        unit: "mm",
      },
      {
        key: "safety.brakeCount", label: "Kaliper Adedi",
        formula: "z = f(yerleşim)",
        subst: (x) => `${x.sel.safetyBrakeArrangement}`,
      },
      {
        key: "safety.torqueEach", label: "Bir Kaliperin Frenleme Momenti",
        formula: "M_fren = 2 · FA · µ · (d_flanş/2 − x)",
        subst: (x) =>
          `2 · ${n(num(x.c["safety.clampForce"]))} · 0,4 · (${n(x.sel.safetyBrakeFlangeDiaMm)}/2 − ${n(num(x.c["safety.leverX"]))}) / 1000`,
        unit: "Nm",
      },
      {
        key: "safety.totalTorque", label: "Toplam Frenleme Momenti",
        formula: "M_toplam = z · M_fren",
        subst: (x) => `${n(num(x.c["safety.brakeCount"]), 0)} · ${n(num(x.c["safety.torqueEach"]))}`,
        unit: "Nm",
      },
      {
        key: "safety.achievedFactor", label: "Sağlanan Emniyet Katsayısı",
        formula: "n = M_toplam / M_gerekli",
        subst: (x) => `${n(num(x.c["safety.totalTorque"]))} / ${n(num(x.c["safety.requiredTorque"]))}`,
        digits: 3,
      },
      {
        key: "safety.minDiscThickness", label: "Minimum Flanş Kalınlığı b",
        formula: "b = f(model)   [SIBRE katalog]",
        subst: (x) => `${x.sel.safetyBrakeModel}`, unit: "mm", digits: 0,
      },
      {
        key: "safety.flangeThickness", label: "Seçilen Flanş Kalınlığı",
        formula: "b_seçilen ≥ b",
        subst: (x) =>
          `${n(x.sel.safetyBrakeFlangeThicknessMm, 0)} ≥ ${n(num(x.c["safety.minDiscThickness"]), 0)}`,
        unit: "mm", digits: 0,
      },
      // --- Hidrolik güç ünitesi ------------------------------------------
      // Kaliper YAYLA KAPANIR, hidrolikle AÇILIR: ünite basıncı kesildiği anda
      // fren devreye girer. Ünite açma basıncını sağlamalı, emniyet valfi ayarı
      // frenin azami basıncını aşmamalıdır.
      {
        key: "safety.releasePressure", label: "Frenin Açma Basıncı PL",
        formula: "PL = f(model)   [SIBRE katalog]",
        subst: (x) => `${x.sel.safetyBrakeModel}`, unit: "bar", digits: 0,
      },
      {
        key: "safety.maxPressure", label: "Frenin Azami Basıncı Pmax",
        formula: "Pmax = f(model)   [SIBRE katalog]",
        subst: (x) => `${x.sel.safetyBrakeModel}`, unit: "bar", digits: 0,
      },
      {
        key: "safety.oilVolume", label: "Açma Yağ Hacmi",
        formula: "V = z · Vmax(c = 2 mm)",
        subst: (x) =>
          `${n(num(x.c["safety.brakeCount"]), 0)} · ${n(num(x.c["safety.oilVolume"]) / Math.max(1, num(x.c["safety.brakeCount"])), 3)}`,
        unit: "litre", digits: 3,
      },
      {
        key: "safety.unitCode", label: "Hidrolik Güç Ünitesi",
        formula: "HPU = f(fren tipi ; kaliper adedi)   [SIBRE seçim tablosu]",
        subst: (x) =>
          `${x.sel.safetyBrakeModel} · ${n(num(x.c["safety.brakeCount"]), 0)} kaliper → ${x.c["safety.unitSeries"]}`,
      },
      {
        key: "safety.unitPressure", label: "Ünitenin Açma Basıncı",
        formula: "p_ünite ≥ PL",
        subst: (x) =>
          `${n(num(x.c["safety.unitPressure"]), 0)} ≥ ${n(num(x.c["safety.releasePressure"]), 0)}`,
        unit: "bar", digits: 0,
      },
      {
        key: "safety.unitRelief", label: "Emniyet Valfi Ayarı",
        formula: "p_valf ≤ Pmax",
        subst: (x) =>
          `${n(num(x.c["safety.unitRelief"]), 0)} ≤ ${n(num(x.c["safety.maxPressure"]), 0)}`,
        unit: "bar", digits: 0,
      },
      {
        key: "safety.unitPump", label: "Pompa Debisi",
        formula: "Q = f(ünite)   [SIBRE katalog]",
        subst: (x) => `${x.c["safety.unitCode"]}`, unit: "l/dak",
      },
      {
        key: "safety.unitMotor", label: "Ünite Motor Gücü",
        formula: "P = f(ünite)   [SIBRE katalog]",
        subst: (x) => `${x.c["safety.unitCode"]}`, unit: "kW",
      },
      {
        key: "safety.unitTank", label: "Depo Hacmi",
        formula: "V_depo = f(ünite)   [SIBRE katalog]",
        subst: (x) => `${x.c["safety.unitCode"]}`, unit: "litre", digits: 0,
      },
    ],
    checkSuffixes: [
      "safety.torque", "safety.flange", "safety.flangeThickness",
      "safety.airGap", "safety.hydraulic",
    ],
  },
];
