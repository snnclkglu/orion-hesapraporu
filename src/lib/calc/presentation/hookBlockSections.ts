// Kanca bloğu sunum katmanı: bölüm yapısı (§4.1 … §4.6) ve her hesap satırının
// SEMBOLİK FORMÜLÜ ile SAYILARIN YERİNE KONMUŞ hali.
//
// Hesabın kendisi `modules/hookBlock.ts`tedir; burası yalnız gösterimdir ve
// PDF raporun formül satırlarını da bu katman üretir.
//
// Satırlar motorun SEMANTİK ANAHTARLARIYLA (`<blok>.<büyüklük>`) adreslenir:
// `key` hem satırın kimliği hem de değerin okunacağı anahtardır. Motorun hücre
// haritasında karşılığı olmayan (girdi/bağımlılık yankısı olan) satırlar
// değerini `valueFrom` ile doğrudan bağlamdan okur.

import { din15407Label, din15407Row, type Din15407Row } from "../hook-standards";
import {
  SHEAVE_DIA_TOLERANCE_PCT,
  type HookBlockDeps,
  type HookBlockInputs,
  type HookBlockSelections,
  type HookBlockValues,
} from "../modules/hookBlock";
import {
  doubleDrumHookSystem,
  hoistEquipmentArrangement,
  type TechnicalSpecs,
} from "../types";
import { HOIST_OF_HOOKBLOCK, type HookBlockKey } from "./module-family";

export interface HookBlockCtx {
  c: Record<string, number | string>; // semantik anahtar → değer (motor çıktısı)
  v: HookBlockValues;                 // isimli değerler
  inp: HookBlockInputs;
  sel: HookBlockSelections;
  deps: HookBlockDeps;
  specs: TechnicalSpecs;
}

export interface HookBlockRowDef {
  /**
   * Motorun semantik anahtarı (`<blok>.<büyüklük>`) ve satırın kararlı kimliği.
   * `valueFrom` verilmemişse değer bu anahtarla hücre haritasından okunur;
   * kontrol ↔ satır bağlantı haritası (check-anchors.ts) de bunu kullanır.
   */
  key: string;
  /** Değer motorun haritasında değilse (girdi/bağımlılık yankısı) okuma yolu */
  valueFrom?: (ctx: HookBlockCtx) => number | string;
  label: string;
  formula?: string;                      // sembolik formül
  subst?: (ctx: HookBlockCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /** Ölçü bir ÇAPTIR — değerin başına "Ø" konur (arayüz + PDF, `withDiameterSign`) */
  diameter?: true;
  /**
   * Satır yalnız bu koşul sağlandığında basılır (arayüz + PDF ortak).
   * DIN 15407 lamel kancanın on bir ölçü satırı, dövme kanca seçili bir raporda
   * "—" dolu bir blok olurdu.
   */
  visible?: (ctx: HookBlockCtx) => boolean;
}

export interface HookBlockSectionDef {
  id: string;                         // "4.1"
  title: string;
  description?: string;
  inputKeys: (keyof HookBlockInputs & string)[];
  selectionKeys: (keyof HookBlockSelections & string)[];
  rows: HookBlockRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "sheave.dia") */
  checkSuffixes: string[];
  /**
   * Bu bölümün ekipman listesindeki satır slug'ları (`EqRow.rowKey`in
   * `<modulKey>:` sonrası). Bölüm GİZLENDİĞİNDE bu satırlar da listeden düşer
   * (ekran + Excel + PDF); bağ koruma testiyle ölçülür
   * (`hidden-sections-equipment.test.ts`).
   */
  equipmentSlugs?: readonly string[];
  /** Kanca sistemine göre bu hesap alt bölümünün uygulama ve rapor görünürlüğü. */
  visible?: (specs: TechnicalSpecs, which: HookBlockKey) => boolean;
  /**
   * Bölümün girdi ızgarasından önce çizilecek özel düzenleyici. `sheaveOffsets`:
   * mil üzerindeki makara eksenlerini merkezden, makara adedince ADLI kutuyla
   * (M1…Mn) girer — makara sayısı arttıkça kutu sayısı da artar; serbest metin
   * alanının aksine ölçüsü girilmeyen makara "otomatik ortaya" düşmez.
   */
  editor?: "sheaveOffsets";
}

/** Standart/ikiz düzende tarihsel davranış korunur; çift tamburda kullanıcı seçer. */
function liftingBeamSectionVisible(specs: TechnicalSpecs, which: HookBlockKey): boolean {
  const hoist = HOIST_OF_HOOKBLOCK[which];
  return hoistEquipmentArrangement(specs, hoist) !== "doubleDrum" ||
    doubleDrumHookSystem(specs, hoist) === "liftingBeam";
}

/** Kaldırma kirişi seçiminde kanca ve kanca rulmanı fiziksel olarak yoktur. */
function hookSectionVisible(specs: TechnicalSpecs, which: HookBlockKey): boolean {
  const hoist = HOIST_OF_HOOKBLOCK[which];
  return hoistEquipmentArrangement(specs, hoist) !== "doubleDrum" ||
    doubleDrumHookSystem(specs, hoist) !== "liftingBeam";
}

// Sayı biçimleyici (formül substitüsyonu için, TR yerel)
const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

/** "63x150" → "63 × 150" (tabloda yoksa anahtarın kendisi). */
function lamellaLabel(key: string): string {
  const row = din15407Row(key);
  return row ? din15407Label(row) : key;
}

/**
 * DIN 15407 Tablo 1'in ana ölçü satırları.
 *
 * Sütun adları standardın kendi sembolleridir; etiketler o sembolle BAŞLAR
 * (`a₂ · Ağız Genişliği`) — mühendis raporu standardın sayfasıyla yan yana
 * okur ve sembol sütunu tek bakışta taranır (alan öbeği kuralının aynısı).
 */
function din15407Rows(): HookBlockRowDef[] {
  const dims: {
    key: string;
    label: string;
    unit?: string;
    diameter?: true;
    pick: (r: Din15407Row) => number;
  }[] = [
    { key: "hook.a1", label: "a₁ · Ağız Yarıçapı", unit: "mm", pick: (r) => r.a1 },
    { key: "hook.a2", label: "a₂ · Ağız Genişliği", unit: "mm", pick: (r) => r.a2 },
    { key: "hook.b1", label: "b₁ · Lamel Paketi Kalınlığı", unit: "mm", pick: (r) => r.b1 },
    { key: "hook.b2", label: "b₂ · Paketin Dış Genişliği", unit: "mm", pick: (r) => r.b2 },
    { key: "hook.d1", label: "d₁ · Askı Deliği Çapı (E9)", unit: "mm", diameter: true, pick: (r) => r.d1 },
    { key: "hook.g1", label: "g₁ · Üst Lamel Genişliği", unit: "mm", pick: (r) => r.g1 },
    { key: "hook.l1", label: "l₁ · Toplam Boy", unit: "mm", pick: (r) => r.l1 },
    { key: "hook.l2", label: "l₂ · Üst Delik Ekseninden Boy", unit: "mm", pick: (r) => r.l2 },
    { key: "hook.s1", label: "s₁ · Tek Lamel Kalınlığı", unit: "mm", pick: (r) => r.s1 },
    { key: "hook.plateCount", label: "Ana Lamel Adedi", pick: (r) => r.plateCount },
  ];
  const rows: HookBlockRowDef[] = dims.map((d) => ({
    key: d.key,
    label: d.label,
    unit: d.unit,
    diameter: d.diameter,
    formula: "DIN 15407 Tablo 1",
    valueFrom: (x) => (x.v.lamellaRow ? d.pick(x.v.lamellaRow) : "—"),
    subst: (x) => `${x.v.hookDesignationText}`,
    standard: "DIN 15407",
    visible: (x) => x.v.lamellaRow !== undefined,
  }));
  rows.push({
    key: "hook.craneCapacity",
    // Standardın son sütunu: bu kanca HANGİ vincin kancasıdır. Kancanın kendi
    // kapasitesiyle KARIŞTIRILMAZ — pota iki kancaya asılır, o yüzden vincin
    // kapasitesi kancanınkinin iki katıdır.
    label: "Bağlı Olduğu Döküm Vincinin Kapasitesi",
    unit: "kg",
    formula: "DIN 15407 Tablo 1 (Tragfähigkeit der zugeordneten Gießkrane)",
    valueFrom: (x) => (x.v.lamellaRow ? x.v.lamellaRow.craneCapacityT * 1000 : "—"),
    subst: (x) =>
      x.v.lamellaRow
        ? `${n(x.v.lamellaRow.capacityT)} t kanca → ${n(x.v.lamellaRow.craneCapacityT)} t vinç`
        : "—",
    standard: "DIN 15407",
    visible: (x) => x.v.lamellaRow !== undefined,
  });
  return rows;
}

const HOOKBLOCK_SECTION_ORDER = ["4.1", "4.2", "4.4", "4.3", "4.5", "4.6", "4.7"];

const HOOKBLOCK_SECTIONS_RAW: HookBlockSectionDef[] = [
  {
    id: "4.1",
    title: "Kanca",
    visible: hookSectionVisible,
    description:
      "Kanca tanımı ve seçimi. Dövme kancada (DIN 15401 tek ağızlı, DIN 15402 " +
      "çift ağızlı) taşıma kapasitesi DIN 15400 Tablo 3'ten kanca numarası + " +
      "malzeme mukavemet sınıfı + mekanizma grubu üçlüsüyle okunur. LAMEL " +
      "KANCADA (DIN 15407 tek ağızlı, DIN 15408 çift ağızlı) kapasite " +
      "standardın kendi satırındadır ve mukavemet sınıfına bağlı değildir; " +
      "DIN 15407'nin ana ölçüleri de aşağıda listelenir.",
    equipmentSlugs: ["hook"],
    inputKeys: [],
    selectionKeys: [
      "hookStandard", "hookDesignation", "hookNumber", "hookStrengthClass",
    ],
    rows: [
      {
        key: "hook.load",
        label: "Kancaya Gelen Yük", formula: "Q = kaldırılan yük",
        valueFrom: (x) => x.deps.loadKg,
        subst: (x) => `${n(x.deps.loadKg)}`, unit: "kg",
      },
      {
        key: "hook.standard",
        label: "Kanca Tanımı",
        formula: "standart + boy",
        // Satır standardın ADINI zaten yazıyor; ayrıca sabit bir rozet koymak
        // seçim değiştiğinde YANLIŞ tabloya bağlanırdı (rozet dinamik değildir).
        valueFrom: (x) => x.v.hookDesignationText,
      },
      {
        key: "hook.dinGroup",
        label: "Mekanizma Grubu (DIN 15020 Karşılığı)",
        formula: "grup = f(FEM sınıfı)",
        valueFrom: (x) => `${x.specs.hoistMechanismClass} → ${x.v.hookDinGroup}`,
        standard: "DIN 15400",
        // Lamel kancanın kapasitesi çalışma grubuna bağlı değildir; satırı
        // basmak "bu sayı kapasiteyi belirledi" izlenimi verirdi.
        visible: (x) => !x.v.hookIsLamella,
      },
      {
        key: "hook.capacity",
        label: "Kanca Taşıma Kapasitesi",
        formula: "Q_kanca = f(kanca tanımı, kanca no)",
        subst: (x) =>
          !x.v.hookCapacityFromTable
            ? `${x.v.hookDesignationText} → standart kapasite bulunamadı`
            : x.v.lamellaRow
              ? `${x.v.hookDesignationText} → ${n(x.v.lamellaRow.capacityT)} t`
              : `Nr ${x.sel.hookNumber} / ${x.sel.hookStrengthClass} / ${x.v.hookDinGroup} → ${n(x.v.hookCapacityKg)}`,
        // Rozet SABİT olduğu için burada verilmez: kapasite dövme kancada
        // DIN 15400'den, lamel kancada DIN 15407'den okunur ve satır hangisi
        // olduğunu değerinde yazar. Doğru standardı kontrolün kendi rozeti
        // (dinamik) ve aşağıdaki ölçü satırları taşır.
        unit: "kg",
      },
      {
        // Kapasite hangi defterden okundu — bir kontrol değil bir KÜNYE.
        key: "hook.capacitySource",
        label: "Kapasitenin Kaynağı",
        formula: "seçilen standardın kapasite tablosu",
        valueFrom: (x) =>
          !x.v.hookCapacityFromTable
            ? "Standart kapasite satırı bulunamadı — seçim uygun değil"
            : x.v.hookIsLamella
              ? "DIN 15407 Tablo 1"
              : "DIN 15400 Tablo 3",
      },
      {
        key: "hook.suggestedNumber",
        label: "Bu Yükü Taşıyan En Küçük Kanca",
        formula: "en küçük boy (standardın tablosu)",
        // Öneri LAMEL kancada standardın adlandırmasıyla yazılır ("63 × 150");
        // ham anahtar ("63x150") sipariş yazışmasına giren bir ad değildir.
        // Koşul seçili SATIRA değil kancanın TÜRÜNE bakar: numara henüz
        // seçilmemişken de öneri lamel boyudur.
        valueFrom: (x) =>
          x.v.suggestedHookNumber
            ? (x.v.hookIsLamella ? lamellaLabel(x.v.suggestedHookNumber) : x.v.suggestedHookNumber)
            : "—",
      },
      // --- DIN 15407 ana ölçüleri (standardın Tablo 1 satırı) ----------------
      // Ölçüler HESABA GİRMEZ; imalat resmine ve ekipman listesine giderler ve
      // mühendisin kancayı sipariş ederken okuduğu sayılardır. Satırlar yalnız
      // tabloda karşılığı bulunan bir lamel kanca seçiliyken basılır.
      ...din15407Rows(),
    ],
    checkSuffixes: ["hook.capacity"],
  },
  {
    id: "4.2",
    title: "Makaralar",
    description:
      "Minimum makara çapı (FEM H katsayısı) ve makara seçimi. Makara, tambur " +
      "ile AYNI standart çap serisinden seçilir; FEM'in istediği D_min = H·d " +
      "yuvarlak çıkmadığı için serinin bir alt basamağı D_min'in %" +
      `${SHEAVE_DIA_TOLERANCE_PCT}` +
      "'sinden az aşağıdaysa kabul edilir (firma kabulü) ve tolerans " +
      "kullanıldığında rapor bunu ayrıca yazar.",
    equipmentSlugs: ["sheave"],
    inputKeys: [],
    selectionKeys: [
      "sheaveDiaMm", "sheaveEnclosure", "sheaveSealCode", "sheaveCount", "sheaveBearingClosure",
    ],
    rows: [
      {
        key: "sheave.coefficient", label: "Makaralar İçin Mekanizma Katsayısı",
        formula: "H = f(mekanizma sınıfı)",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(num(x.c["sheave.coefficient"]))}`,
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        key: "sheave.ropeDia", label: "Halat Çapı",
        formula: "d = kaldırma grubundan seçilen halat çapı",
        valueFrom: (x) => x.deps.ropeDiaMm,
        subst: (x) => `${n(x.deps.ropeDiaMm)}`, unit: "mm",
      },
      {
        key: "sheave.minDia", label: "Minimum Makara Çapı", formula: "D_min = H · d",
        subst: (x) => `${n(num(x.c["sheave.coefficient"]))} · ${n(x.deps.ropeDiaMm)}`,
        unit: "mm", diameter: true, standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        key: "sheave.count", label: "Kanca Bloğu Makara Adedi",
        formula: "n_makara = n_toplam / 2  (otomatik; kullanıcı düzeltilebilir)",
        valueFrom: (x) => x.v.sheaveCount,
        subst: (x) => `${n(x.v.sheaveCount)}`,
      },
      {
        // Standart çap serisine oturmayı mümkün kılan alt sınır. Satır HER
        // ZAMAN basılır (tolerans kullanılmasa da): kontrolün karşılaştırdığı
        // sayının nereden geldiği raporda görünmeden okunamaz.
        key: "sheave.minDiaAccepted",
        label: `Kabul Edilen En Küçük Çap (%${SHEAVE_DIA_TOLERANCE_PCT} Standart Çap Toleransı)`,
        formula: `D_kabul = D_min · (1 − ${SHEAVE_DIA_TOLERANCE_PCT} / 100)`,
        subst: (x) =>
          `${n(num(x.c["sheave.minDia"]))} · ${n(1 - SHEAVE_DIA_TOLERANCE_PCT / 100)}`,
        unit: "mm", diameter: true,
      },
      {
        key: "sheave.diaShortfall",
        label: "Seçilen Çapın FEM Sınırından Eksikliği",
        formula: "Δ = (D_min − D_seçilen) / D_min",
        valueFrom: (x) => x.v.sheaveDiaShortfallPct,
        subst: (x) =>
          `(${n(x.v.minSheaveDiaMm)} − ${n(x.sel.sheaveDiaMm)}) / ${n(x.v.minSheaveDiaMm)}`,
        unit: "%", digits: 2,
        // Yalnız tolerans GERÇEKTEN kullanıldığında basılır: FEM sınırının
        // üstünde seçilmiş bir makarada "eksiklik −%9" satırı gürültüdür.
        visible: (x) => x.v.sheaveDiaToleranceUsed,
      },
    ],
    checkSuffixes: ["sheave.dia"],
  },
  {
    id: "4.3",
    title: "Makara Rulmanları",
    equipmentSlugs: ["sheaveBearing"],
    description:
      "Eşdeğer yükler ve ISO 281 nominal ömrü (bilyalı rulman). Gerekli ömür " +
      "FEM 1.001 T.2.1.3.2 kullanım sınıfı bandından okunur.",
    inputKeys: [],
    selectionKeys: [
      "sheaveBearingType", "sheaveBearingCode", "sheaveBearingBoreMm",
      "sheaveBearingDynCKn", "sheaveBearingStatC0Kn",
    ],
    rows: [
      {
        key: "sheaveBearing.radialLoad", label: "Rulman Radyal Yükü",
        formula: "F_r = T · 9,81 / 1000",
        subst: (x) => `${n(x.deps.ropeLoadKg)} · 0,00981`, unit: "kN",
      },
      {
        key: "sheaveBearing.axialLoad", label: "Rulman Eksenel Yükü",
        formula: "F_a = 0,05 · F_r",
        subst: (x) => `0,05 · ${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.equivalentStatic", label: "Eşdeğer Statik Yük",
        formula: "P₀ = F_r  (saf radyal yük: X = 1, Y = 0)",
        subst: (x) => `${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.equivalentDynamic", label: "Eşdeğer Dinamik Yük",
        formula: "P = F_r  (saf radyal yük: X = 1, Y = 0)",
        subst: (x) => `${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.rpm", label: "Rulman Devri",
        formula: "n = n_tambur · (D_tambur / D_makara)",
        subst: (x) => `${n(x.deps.drumRpm)} · (${n(x.deps.drumDiaMm)} / ${n(x.sel.sheaveDiaMm)})`,
        unit: "d/dak",
      },
      {
        key: "sheaveBearing.lifeHours", label: "Rulman Ömrü (L₁₀)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)³",
        subst: (x) =>
          `(10⁶ / (60·${n(num(x.c["sheaveBearing.rpm"]))})) · (${n(x.sel.sheaveBearingDynCKn)}/${n(num(x.c["sheaveBearing.equivalentDynamic"]))})³`,
        unit: "saat", digits: 0, standard: "ISO 281",
      },
      {
        key: "sheaveBearing.requiredLifeMin", label: "Gerekli Minimum Ömür",
        formula: "L_min = f(kullanım sınıfı)",
        subst: (x) => `${x.specs.hoistUsageClass} → ${n(num(x.c["sheaveBearing.requiredLifeMin"]), 0)}`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        key: "sheaveBearing.bore",
        label: "Rulman İç Çapı (Mil Çapı D1'e Oturur)",
        formula: "d_rulman = D1",
        valueFrom: (x) => x.sel.sheaveBearingBoreMm ?? 0,
        subst: (x) =>
          `mil D1 = ${n(x.inp.shaftD1Mm)} mm`,
        unit: "mm",
      },
    ],
    checkSuffixes: ["sheaveBearing.life", "sheaveBearing.static", "sheaveBearing.bore"],
  },
  {
    id: "4.4",
    title: "Kanca Bloğu Mili",
    equipmentSlugs: ["shaft"],
    description:
      "Mil, iki askı sacı (mesnet) arasında basit kiriştir. Kanca bloğundaki " +
      "makara adedi halat donanımından gelir (n = n_toplam / 2) ve HER MAKARA " +
      "2T yükü taşır. Askı sacı makaraların dışında, içinde veya iki makara arasında " +
      "olabilir. Askı sacı ve makara eksenleri merkezden, yalnız bir taraf için " +
      "girilir; karşı taraf simetrik aynalanır. Konsol kalan makaralar gerçek mesnet " +
      "konumlarıyla çözülür. Eğilme ve kesme gerilmeleri D1 " +
      "mil çapında hesaplanır; makara rulmanı da bu çapa oturur. Bileşik gerilme " +
      "CMAA 70 4.11.4.1'e göre √(σ² + 3τ²), kesme gerilmesi ortalama (τ = V/A) " +
      "kabulüyle alınır.",
    // `shaftSheaveOffsetsText` bilerek ızgarada DEĞİL: değeri, makara adedine
    // göre çoğalan adlı kutulardan (M1…Mn) yazan `SheaveOffsetsEditor`
    // düzenler (bkz. editor: "sheaveOffsets"). Serbest metin kutusu ölçü
    // girilmeyen makarayı sessizce merkeze atıyordu.
    inputKeys: [
      "shaftSupportOffsetMm", "shaftD1Mm",
    ],
    editor: "sheaveOffsets",
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "shaft.ropeLoad", label: "Halat Yükü (T)",
        formula: "T = bir halat kolundaki yük",
        valueFrom: (x) => x.deps.ropeLoadKg,
        subst: (x) => `${n(x.deps.ropeLoadKg)}`, unit: "kg",
      },
      {
        key: "shaft.sheaveCount", label: "Kanca Bloğu Makara Adedi",
        formula: "n = seçilen makara adedi  (otomatikte n_toplam / 2)",
        subst: (x) => `${n(x.v.sheaveCount)}`,
      },
      {
        key: "shaft.sheaveLoad", label: "Makara Başına Yük", formula: "P = 2T",
        subst: (x) => `2 · ${n(x.deps.ropeLoadKg)}`, unit: "kg",
      },
      {
        key: "shaft.span", label: "Askı Sacları Arası Açıklık (L)",
        formula: "L = 2 · e_askı",
        subst: (x) =>
          `2 · ${n(x.inp.shaftSupportOffsetMm)} → ${n(num(x.c["shaft.span"]))}`,
        unit: "mm",
      },
      {
        key: "shaft.length", label: "Toplam Mil Yükleme Boyu",
        formula: "L_mil = 2 · maks(e_askı, e_makara,maks)",
        subst: (x) => `${n(x.v.shaftLengthCm * 10)}`,
        unit: "mm",
      },
      {
        key: "shaft.reactionA", label: "Mesnet Reaksiyonu Ra (Sol Askı Sacı)",
        formula: "R_a = Σ P·(L − x_i) / L",
        subst: (x) =>
          `${n(x.v.sheaveCount)} × ${n(num(x.c["shaft.sheaveLoad"]))} yük · konumlar [${x.v.sheavePositionsCm.map((p) => n(p * 10)).join("; ")}] mm`,
        unit: "kg",
      },
      {
        key: "shaft.reactionB", label: "Mesnet Reaksiyonu Rb (Sağ Askı Sacı)",
        formula: "R_b = n · P − R_a",
        subst: (x) =>
          `${n(x.v.sheaveCount)} · ${n(num(x.c["shaft.sheaveLoad"]))} − ${n(num(x.c["shaft.reactionA"]))}`,
        unit: "kg",
      },
      {
        key: "shaft.moment", label: "Maksimum Eğilme Momenti",
        formula: "M_maks = maks[ R_a·x − Σ P·(x − x_i) ]",
        subst: (x) => `${n(num(x.c["shaft.reactionA"]))} · konum − yük katkıları`,
        unit: "kg·cm",
      },
      {
        key: "shaft.sectionModulus", label: "Kesit Modülü (D1)",
        formula: "W = π · D1³ / 32",
        subst: (x) => `π · (${n(x.inp.shaftD1Mm)} / 10)³ / 32`, unit: "cm³",
      },
      {
        key: "shaft.bendingStress", label: "Eğilme Gerilmesi", formula: "σ = M_maks / W",
        subst: (x) => `${n(num(x.c["shaft.moment"]))} / ${n(num(x.c["shaft.sectionModulus"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.shearStress", label: "Kesme Gerilmesi (Ortalama)",
        formula: "τ = V / (π · D1² / 4)",
        subst: (x) =>
          `${n(num(x.c["shaft.shear"]))} / (π · (${n(x.inp.shaftD1Mm)} / 10)² / 4)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.combinedStress", label: "Bileşik Gerilme", formula: "σ_bil = √(σ² + 3τ²)",
        subst: (x) =>
          `√(${n(num(x.c["shaft.bendingStress"]))}² + 3·${n(num(x.c["shaft.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableBending", label: "İzin Verilen Eğilme Gerilmesi",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableBending"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableShear", label: "İzin Verilen Kesme Gerilmesi",
        formula: "τ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableShear"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableCombined", label: "İzin Verilen Bileşik Gerilme",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableCombined"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
    ],
    checkSuffixes: ["shaft.bending", "shaft.shear", "shaft.stress"],
  },
  {
    id: "4.5",
    title: "Kanca Rulmanı",
    visible: hookSectionVisible,
    description: "Eksenel rulman statik kontrolü.",
    equipmentSlugs: ["hookBearing"],
    inputKeys: [],
    selectionKeys: ["hookBearingType", "hookBearingCode", "hookBearingStatC0Kn"],
    rows: [
      {
        key: "hookBearing.axialLoad", label: "Rulman Eksenel Yükü",
        formula: "F_a = Q · 9,81 / 1000",
        subst: (x) => `${n(x.deps.loadKg)} · 9,81 / 1000`, unit: "kN",
      },
      {
        key: "hookBearing.staticSafety", label: "Statik Emniyet Katsayısı",
        formula: "S₀ = C₀ / F_a",
        subst: (x) => `${n(x.sel.hookBearingStatC0Kn)} / ${n(num(x.c["hookBearing.axialLoad"]))}`,
      },
    ],
    checkSuffixes: ["hookBearing.static"],
  },
  {
    id: "4.6",
    title: "Kaldırma Kirişi",
    visible: liftingBeamSectionVisible,
    equipmentSlugs: ["liftingBeam"],
    description:
      "Kanca bloğunun kaldırma kirişi. Kiriş İKİ UÇTAN askıdadır ve İKİ " +
      "NOKTADAN yüklüdür; geometri teknik resimdeki x · y · z ölçü zinciriyle " +
      "verilir ve açıklık L = x + y + z olarak türetilir. İki kesit hesaplanır: " +
      "KESİT 1 açıklık ortasıdır (eğilme momenti tepe yapar), KESİT 2 mesnet " +
      "ile yük noktası arasıdır (kesme kuvveti tepe yapar). Statik gerilmeler " +
      "DIN 15018 Tablo 2 dinamik katsayısı ψ ile büyütülür; ψ'nin k ve l " +
      "terimleri serbest sayı değildir, teknik özelliklerdeki kaldırma " +
      "sınıfının (H1…H4) Tablo 2 satırıdır. Yorulma kontrolü ayrı bölümdedir.",
    inputKeys: [
      "beamXMm", "beamYMm", "beamZMm",
      "midTopPlateThkMm", "midTopPlateWidthMm", "midWebPlateThkMm", "midWebPlateHeightMm",
      "midBottomPlateThkMm", "midBottomPlateWidthMm",
      "thickTopPlateThkMm", "thickTopPlateWidthMm", "thickWebPlateThkMm", "thickWebPlateHeightMm",
      "thickBottomPlateThkMm", "thickBottomPlateWidthMm",
      "fatigueMaterial",
      "dynamicFactorKOverride", "dynamicFactorLOverride",
    ],
    selectionKeys: [],
    rows: [
      {
        key: "girder.span", label: "Kiriş Açıklığı L", formula: "L = x + y + z",
        subst: (x) => `${n(x.inp.beamXMm)} + ${n(x.inp.beamYMm)} + ${n(x.inp.beamZMm)}`,
        unit: "mm",
      },
      {
        key: "girder.forceMax", label: "Askı Başına Maksimum Kuvvet", formula: "F_max = G_toplam / 2",
        subst: (x) => `${n(x.deps.beamTotalLoadKg ?? x.deps.totalLoadKg)} / 2`, unit: "kg",
      },
      {
        key: "girder.forceMin", label: "Askı Başına Minimum Kuvvet",
        formula: "F_min = (G_blok + G_halat) / 2",
        subst: (x) => `(${n(x.deps.beamHookBlockWeightKg ?? x.deps.hookBlockWeightKg)} + ${n(x.deps.beamRopeWeightKg ?? x.deps.ropeWeightKg)}) / 2`,
        unit: "kg",
      },
      {
        key: "girder.reactionA", label: "Mesnet Tepkisi R_A (Sol Askı)",
        formula: "R_A = ΣF·(L − x_i) / L",
        subst: (x) =>
          `2 × ${n(num(x.c["girder.forceMax"]))} kg · konumlar [${n(x.inp.beamXMm)}; ${n(x.inp.beamXMm + x.inp.beamYMm)}] mm`,
        unit: "kg",
      },
      {
        key: "girder.reactionB", label: "Mesnet Tepkisi R_B (Sağ Askı)",
        formula: "R_B = 2·F_max − R_A",
        subst: (x) =>
          `2 · ${n(num(x.c["girder.forceMax"]))} − ${n(num(x.c["girder.reactionA"]))}`,
        unit: "kg",
      },
      {
        key: "girder.momentMax", label: "Maksimum Moment (Kesit 1)",
        formula: "M_maks = maks[ R_A·x − ΣF·(x − x_i) ]",
        subst: (x) =>
          `R_A = ${n(num(x.c["girder.reactionA"]))} kg · L = ${n(num(x.c["girder.span"]))} mm`,
        unit: "kg·cm",
      },
      {
        key: "girder.momentSection2", label: "Yük Noktasındaki Moment (Kesit 2)",
        formula: "M_2 = M(x_yük)",
        subst: (x) => `x = ${n(x.inp.beamXMm)} mm  ·  z = ${n(x.inp.beamZMm)} mm`,
        unit: "kg·cm",
      },
      {
        key: "girder.shearMax", label: "Maksimum Kesme Kuvveti (Kesit 2)",
        formula: "V_maks = maks(R_A ; R_B)",
        subst: (x) =>
          `maks(${n(num(x.c["girder.reactionA"]))} ; ${n(num(x.c["girder.reactionB"]))})`,
        unit: "kg",
      },
      {
        key: "girder.shearSection1", label: "Askılar Arası Kesme (Kesit 1)",
        formula: "V_1 = |R_A − F_max|   (simetrik askıda 0)",
        subst: (x) =>
          `|${n(num(x.c["girder.reactionA"]))} − ${n(num(x.c["girder.forceMax"]))}|`,
        unit: "kg",
      },
      {
        key: "girder.momentMin", label: "Minimum Moment (Boş Kiriş)",
        formula: "M_min = aynı geometri, F_min ile",
        subst: (x) => `F_min = ${n(num(x.c["girder.forceMin"]))} kg`,
        unit: "kg·cm",
      },
      {
        key: "girder.midUnitWeight", label: "Birim Ağırlık (Kesit 1)",
        formula: "G = ΣA_sac · 7,85 / 10³",
        subst: (x) => `((${n(x.inp.midTopPlateThkMm)}·${n(x.inp.midTopPlateWidthMm)}) + 2·(${n(x.inp.midWebPlateThkMm)}·${n(x.inp.midWebPlateHeightMm)}) + (${n(x.inp.midBottomPlateThkMm)}·${n(x.inp.midBottomPlateWidthMm)})) · 7,85 / 10³`,
        unit: "kg/m",
      },
      {
        key: "girder.midInertia", label: "Atalet Momenti (Kesit 1)",
        formula: "I = Σ(I₀ + A·y²)",
        subst: (x) => `2·(${n(x.inp.midWebPlateThkMm / 10)}·${n(x.inp.midWebPlateHeightMm / 10)}³/12) + başlık sacları (Steiner)`,
        unit: "cm⁴",
      },
      {
        key: "girder.midSectionModulus", label: "Kesit Modülü (Kesit 1)",
        formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c["girder.midInertia"]))} / ${n(x.inp.midWebPlateHeightMm / 20)}`,
        unit: "cm³",
      },
      {
        key: "girder.midArea", label: "Kesit Alanı (Kesit 1)", formula: "A = ΣA_sac",
        subst: (x) => `${n(num(x.c["girder.midArea"]))}`, unit: "cm²",
      },
      {
        key: "girder.midWebArea", label: "Yan Sacların Alanı (Kesit 1)",
        formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.midWebPlateThkMm / 10)} · ${n(x.inp.midWebPlateHeightMm / 10)}`,
        unit: "cm²",
      },
      {
        key: "girder.thickSectionModulus", label: "Kesit Modülü (Kesit 2)",
        formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c["girder.thickInertia"]))} / ${n(x.inp.thickWebPlateHeightMm / 20)}`,
        unit: "cm³",
      },
      {
        key: "girder.thickWebArea", label: "Yan Sacların Alanı (Kesit 2)",
        formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.thickWebPlateThkMm / 10)} · ${n(x.inp.thickWebPlateHeightMm / 10)}`,
        unit: "cm²",
      },
      {
        key: "girder.dynamicFactor", label: "Dinamik Katsayı ψ",
        formula: "ψ = k + l · v_kaldırma   (k, l = Tablo 2 kaldırma sınıfı satırı)",
        subst: (x) =>
          `${x.v.hoistClassUsed}${x.v.dynamicFactorOverridden ? " (elle ezildi)" : ""} → ` +
          `${n(x.v.dynamicFactorK)} + ${n(x.v.dynamicFactorL, 4)} · ${n(x.specs.mainLiftSpeedMpm)}`,
        digits: 3, standard: "DIN 15018 Tablo 2",
      },
      {
        key: "girder.bendingStress", label: "Eğilme Gerilmesi (Kesit 1)",
        formula: "σ₁ = M_maks · ψ / w₁",
        subst: (x) => `${n(num(x.c["girder.momentMax"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.section1ShearStress", label: "Kesme Gerilmesi (Kesit 1)",
        formula: "τ₁ = V₁ · ψ / A_y1",
        subst: (x) => `${n(num(x.c["girder.shearSection1"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.midWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.section1CombinedStress", label: "Bileşik Gerilme (Kesit 1)",
        formula: "σ_bil,1 = √(σ₁² + 3τ₁²)",
        subst: (x) => `√(${n(num(x.c["girder.bendingStress"]))}² + 3·${n(num(x.c["girder.section1ShearStress"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "girder.section2BendingStress", label: "Eğilme Gerilmesi (Kesit 2)",
        formula: "σ₂ = M₂ · ψ / w₂",
        subst: (x) => `${n(num(x.c["girder.momentSection2"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.thickSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.shearStress", label: "Kesme Gerilmesi (Kesit 2)",
        formula: "τ₂ = V_maks · ψ / A_y2",
        subst: (x) => `${n(num(x.c["girder.shearMax"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.thickWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.section2CombinedStress", label: "Bileşik Gerilme (Kesit 2)",
        formula: "σ_bil,2 = √(σ₂² + 3τ₂²)",
        subst: (x) => `√(${n(num(x.c["girder.section2BendingStress"]))}² + 3·${n(num(x.c["girder.shearStress"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "girder.combinedStress", label: "Kontrol Edilen Bileşik Gerilme (Zarf)",
        // Zarf: en büyük eğilme ile en büyük kesme aynı kesitte olmasa da bir
        // arada değerlendirilir — bilinçli olarak muhafazakârdır ve iki kesitin
        // kendi bileşik gerilmelerinden küçük olamaz.
        formula: "σ_bil = maks[ √(σ₁² + 3τ₂²) ; σ_bil,1 ; σ_bil,2 ]",
        subst: (x) => `√(${n(num(x.c["girder.bendingStress"]))}² + 3·${n(num(x.c["girder.shearStress"]))}²) ile karşılaştırılır`,
        unit: "kg/cm²",
      },
      {
        key: "girder.allowableStress",
        label: "İzin Verilen Gerilme", formula: "σ_em = f(malzeme)",
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.allowableStaticStress)}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.1.1",
      },
    ],
    checkSuffixes: ["girder.static"],
  },
  {
    id: "4.7",
    title: "Kaldırma Kirişi Yorulma",
    visible: liftingBeamSectionVisible,
    description:
      "Kaldırma kirişinin DIN 15018 yorulma kontrolü — Kesit 1 (açıklık ortası) " +
      "üzerinden. Gerilme genliği tam yüklü (maks) ve boş (min) hâllerin " +
      "oranından çıkar. İzin verilen gerilmeler Tablo 17'den (malzeme × çentik " +
      "sınıfı × yük grubu), gerilme oranına göre düzeltme Tablo 18'den alınır. " +
      "Statik gerilmelerin aksine YORULMADA ψ KULLANILMAZ: dinamik katsayı bir " +
      "tepe yük büyütmesidir, gerilme kolektifi değildir.",
    inputKeys: ["loadGroup", "notchClass"],
    selectionKeys: [],
    rows: [
      {
        key: "fatigue.sigmaMax", label: "σmax", formula: "σ_max = M_maks / w",
        subst: (x) => `${n(num(x.c["girder.momentMax"]))} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.tauMax", label: "τmax", formula: "τ_max = V_maks / A_y",
        subst: (x) => `${n(num(x.c["girder.shearMax"]))} / ${n(num(x.c["girder.midWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combinedMax", label: "Bileşik Maksimum Gerilme",
        formula: "σ_bil,max = √(σ_max² + 3τ_max²)",
        subst: (x) => `√(${n(num(x.c["fatigue.sigmaMax"]))}² + 3·${n(num(x.c["fatigue.tauMax"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.sigmaMin", label: "σmin", formula: "σ_min = M_min / w",
        subst: (x) => `${n(num(x.c["girder.momentMin"]))} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.tauMin", label: "τmin", formula: "τ_min = V_min / A_y",
        subst: (x) => `${n(num(x.c["girder.forceMin"]))} / ${n(num(x.c["girder.midWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combinedMin", label: "Bileşik Minimum Gerilme",
        formula: "σ_bil,min = √(σ_min² + 3τ_min²)",
        subst: (x) => `√(${n(num(x.c["fatigue.sigmaMin"]))}² + 3·${n(num(x.c["fatigue.tauMin"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.stressRatio", label: "Gerilme Oranı",
        formula: "x = σ_bil,min / σ_bil,max",
        subst: (x) => `${n(num(x.c["fatigue.combinedMin"]))} / ${n(num(x.c["fatigue.combinedMax"]))}`,
        digits: 3,
      },
      {
        key: "fatigue.sigmaD1",
        label: "zul σ D(-1)", formula: "T17(malzeme, çentik sınıfı, yük grubu)",
        subst: (x) => `${x.inp.fatigueMaterial} / ${x.inp.notchClass} / ${x.inp.loadGroup} → ${n(x.v.fatigueSigmaD1Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.sigmaD1KgCm2",
        label: "zul σ D(-1)", formula: "zul σ D(-1) · 100 / 9,81",
        subst: (x) => `${n(x.v.fatigueSigmaD1Nmm2)} · 100 / 9,81`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.sigmaDz0",
        label: "zul σ Dz(0)", formula: "zul σ Dz(0) = zul σ D(-1) · 5/3",
        subst: (x) => `${n(x.v.fatigueSigmaD1KgCm2)} · 5/3`,
        unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },
      {
        key: "fatigue.ultimateStrength",
        label: "Malzeme Kopma Dayanımı σB", formula: "σ_B = f(malzeme)",
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.ultimateStrengthKgCm2)}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.allowableSigma",
        label: "zul σ Dz(x)",
        formula: "zul σ Dz(x) = zulσDz(0) / (1 − (1 − zulσDz(0)/(0,75·σB)) · x)",
        subst: (x) => `${n(x.v.fatigueSigmaDz0KgCm2)} / (1 − (1 − ${n(x.v.fatigueSigmaDz0KgCm2)}/(0,75·${n(x.v.ultimateStrengthKgCm2)})) · ${n(x.v.kappa, 3)})`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.tauW0",
        label: "zul σ Dz(x) — W0 Çentik Sınıfı", formula: "T17(malzeme, W0, yük grubu)",
        subst: (x) => `${x.inp.fatigueMaterial} / W0 / ${x.inp.loadGroup} → ${n(x.v.fatigueTauW0Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableTau",
        label: "zul τ D(x)", formula: "zul τ D(x) = zul σ Dz(x)|W0 · (100/9,81) / √3",
        subst: (x) => `${n(x.v.fatigueTauW0KgCm2)} / √3`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combined",
        label: "Bileşik Yorulma Oranı",
        formula: "(σ_max/zulσ)² + (τ_max/zulτ)² ≤ 1,1",
        subst: (x) => `(${n(x.v.sigmaMax)}/${n(x.v.fatigueAllowableSigmaKgCm2)})² + (${n(x.v.tauMax)}/${n(x.v.fatigueAllowableTauKgCm2)})²`,
        digits: 4, standard: "DIN 15018 Bölüm 7.4.5",
      },
    ],
    checkSuffixes: ["fatigue.sigma", "fatigue.tau", "fatigue.combined"],
  },
];

export const HOOKBLOCK_SECTIONS: HookBlockSectionDef[] = HOOKBLOCK_SECTIONS_RAW.sort(
  (a, b) => HOOKBLOCK_SECTION_ORDER.indexOf(a.id) - HOOKBLOCK_SECTION_ORDER.indexOf(b.id)
);
