// Revizyon snapshot'ından (inputs/selections jsonb) CalcInput kurar.
// Boş alanlar yeni iş şablonuyla doldurulur — editör, PDF ve Excel çıktıları
// aynı yükleyiciyi kullanır.
//
// Kapatılmış hesap bölümleri: kullanıcı bir bölümü (ör. başkiriş) kapattığında
// o bölüm hesaba ve rapora GİRMEZ, ama girdileri KORUNUR — bölüm yeniden
// açıldığında elle ayarlanmış değerler geri gelir. Kapalı bölümlerin listesi
// `inputs.disabledModules` içinde tutulur.
//
// Vincin konfigürasyonu (ayrı yardımcı araba, monoray adedi) hangi bölümlerin
// hiç var olamayacağını belirler; bunlar kapalı listesinden bağımsız olarak
// hesaba girmez.

import { NEW_WORK_TEMPLATE, NEW_WORK_DISABLED_MODULES } from "@/lib/calc/defaults";
import { activeModules, type CalcInput } from "@/lib/calc/engine";
import { MODULE_ORDER, isHoistKey, type ModuleKey } from "@/lib/calc/presentation/module-family";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import type { TechnicalSpecs } from "@/lib/calc/types";

export interface RevisionInputsJson {
  specs?: TechnicalSpecs;
  mainHoist?: HoistInputs | null;
  auxHoist?: HoistInputs | null;
  mono1Hoist?: HoistInputs | null;
  mono2Hoist?: HoistInputs | null;
  hookBlock?: HookBlockInputs | null;
  auxHookBlock?: HookBlockInputs | null;
  mono1HookBlock?: HookBlockInputs | null;
  mono2HookBlock?: HookBlockInputs | null;
  trolley?: TravelInputs | null;
  auxTrolley?: TravelInputs | null;
  mono1Trolley?: TravelInputs | null;
  mono2Trolley?: TravelInputs | null;
  bridge?: TravelInputs | null;
  girder?: GirderInputs | null;
  buckling?: BucklingInputs | null;
  endCarriage?: EndCarriageInputs | null;
  /** Kullanıcının kapattığı hesap bölümleri (hesaba ve rapora girmez) */
  disabledModules?: string[] | null;
}

export interface RevisionSelectionsJson {
  mainHoist?: HoistSelections | null;
  auxHoist?: HoistSelections | null;
  mono1Hoist?: HoistSelections | null;
  mono2Hoist?: HoistSelections | null;
  hookBlock?: HookBlockSelections | null;
  auxHookBlock?: HookBlockSelections | null;
  mono1HookBlock?: HookBlockSelections | null;
  mono2HookBlock?: HookBlockSelections | null;
  trolley?: TravelSelections | null;
  auxTrolley?: TravelSelections | null;
  mono1Trolley?: TravelSelections | null;
  mono2Trolley?: TravelSelections | null;
  bridge?: TravelSelections | null;
  girder?: GirderSelections | null;
  endCarriage?: EndCarriageSelections | null;
  alts?: RevisionAlts;
}

/**
 * Alternatif (seçenekli) ekipman durumu — TEK KAYNAK.
 *
 * Seçim alanı olan her modül bölümü için 3'e kadar seçenek saklanır. `active`
 * olan canlı hesaba girer; diğerleri kaydedilmiş seçim kümeleridir ve raporda
 * (PDF "SEÇENEKLER" bloğu) ile ekipman listesinde ("Seçenek n" satırları)
 * görünür. Editör bu tipi kendi `AltState`/`AltsMap` adlarıyla yeniden
 * dışa verir; tanım burada durur ki editör, PDF ve Excel aynı şekli okusun.
 */
export interface RevisionAltState {
  /** Canlı hesapta kullanılan seçeneğin `options` içindeki sırası */
  active: number;
  /** Her seçenek, bölümün SEÇİM alanlarının (selectionKeys) bir alt kümesidir */
  options: Record<string, unknown>[];
}

/** Anahtar: `${moduleKey}-${section.rawId}` — ör. "main-2.1" */
export type RevisionAlts = Record<string, RevisionAltState>;

/**
 * Revizyon snapshot'ından alternatif haritasını güvenle okur.
 *
 * JSONB serbest biçimlidir: bozuk/eksik kayıt raporu düşürmemeli. Seçenek
 * dizisi olmayan, boş ya da nesne olmayan girdiler ATLANIR; `active` dizinin
 * sınırlarına kelepçelenir. Alternatifi olmayan revizyonda sonuç boş
 * nesnedir ve çıktılar bugünkü hâlini birebir korur.
 */
export function altsFromRevision(
  selections: RevisionSelectionsJson | null | undefined
): RevisionAlts {
  const raw = (selections as { alts?: unknown } | null | undefined)?.alts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RevisionAlts = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const st = value as { active?: unknown; options?: unknown };
    if (!Array.isArray(st.options)) continue;
    const options = st.options.filter(
      (o): o is Record<string, unknown> => Boolean(o) && typeof o === "object" && !Array.isArray(o)
    );
    if (options.length === 0) continue;
    const active =
      typeof st.active === "number" && Number.isInteger(st.active)
        ? Math.min(Math.max(st.active, 0), options.length - 1)
        : 0;
    out[key] = { active, options };
  }
  return out;
}

/** Bölümün alternatif anahtarı (editör, PDF ve Excel aynı biçimi kullanır). */
export function altKeyFor(moduleKey: string, sectionRawId: string): string {
  return `${moduleKey}-${sectionRawId}`;
}

/**
 * Alternatif anahtarını modül anahtarı + bölüm ham id'sine ayırır.
 * Modül anahtarları tire içermez; ilk tire ayraçtır.
 */
export function splitAltKey(key: string): { moduleKey: string; sectionRawId: string } | null {
  const dash = key.indexOf("-");
  if (dash <= 0 || dash === key.length - 1) return null;
  return { moduleKey: key.slice(0, dash), sectionRawId: key.slice(dash + 1) };
}

/** Kapatılabilen bölümler — ana kaldırma/ana araba/köprü diğerlerini besler. */
export const DISABLEABLE_MODULES = [
  "hookBlock",
  "aux",
  "auxHookBlock",
  "auxTrolley",
  "mono1",
  "mono1HookBlock",
  "mono1Trolley",
  "mono2",
  "mono2HookBlock",
  "mono2Trolley",
  "girder",
  "buckling",
  "endCarriage",
] as const satisfies readonly ModuleKey[];

/** Modül anahtarı → CalcInput/JSON alan adı. */
export const CALC_FIELD: Record<ModuleKey, keyof CalcInput> = {
  main: "mainHoist",
  hookBlock: "hookBlock",
  aux: "auxHoist",
  auxHookBlock: "auxHookBlock",
  trolley: "trolley",
  auxTrolley: "auxTrolley",
  mono1: "mono1Hoist",
  mono1HookBlock: "mono1HookBlock",
  mono1Trolley: "mono1Trolley",
  mono2: "mono2Hoist",
  mono2HookBlock: "mono2HookBlock",
  mono2Trolley: "mono2Trolley",
  bridge: "bridge",
  wheelLoads: "wheelLoads",
  girder: "girder",
  buckling: "buckling",
  endCarriage: "endCarriage",
};

export interface LoadedRevision {
  /** Hesaba giren girdi seti — kapalı bölümler yoktur */
  input: CalcInput;
  /** Tüm bölümlerin verisi — editör kapalı bölümü tekrar açabilsin diye */
  full: CalcInput;
  /** Kapalı bölümler */
  disabled: ModuleKey[];
}

/**
 * Bir bölüm kapalı mı.
 *
 * Üç kaynak birleştirilir:
 *   1. Açık liste (`disabledModules`) — yeni kayıtların taşıdığı kural.
 *   2. Kayıtta HİÇ GEÇMEYEN bölüm. Yeni kayıtlar tüm bölüm alanlarını yazar
 *      (bkz. `saveRevision`/`moduleJson`); bir alan hiç yoksa o revizyon bu
 *      bölüm daha var olmadan kaydedilmiştir → kapalı sayılır. Bu kural
 *      olmadan eski revizyonlarda yardımcı kanca bloğu, yardımcı araba ve
 *      monoraylar kendiliğinden AÇILIR ve şablon değerleriyle rapora girer.
 *   3. Eski kayıt kuralı: alan var ama değeri `null`.
 *
 * Hiç kayıt yoksa (yeni revizyon) yeni iş şablonunun kapalı listesi geçerlidir.
 */
function disabledSet(inputs: RevisionInputsJson | null): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  const allowed = DISABLEABLE_MODULES as readonly ModuleKey[];

  if (!inputs || Object.keys(inputs).length === 0) {
    for (const k of NEW_WORK_DISABLED_MODULES) {
      if ((allowed as readonly string[]).includes(k)) out.add(k as ModuleKey);
    }
    return out;
  }

  const list = inputs.disabledModules;
  if (Array.isArray(list)) {
    for (const k of list) {
      if ((allowed as readonly string[]).includes(k)) out.add(k as ModuleKey);
    }
  }

  const stored = inputs as unknown as Record<string, unknown>;
  for (const k of allowed) {
    const field = CALC_FIELD[k];
    // Alan hiç yok → bölüm o revizyon kaydedilirken mevcut değildi.
    // Alan var ama null → kullanıcı kapatmıştı (eski kayıt kuralı).
    if (!(field in stored) || stored[field] === null) out.add(k);
  }
  return out;
}

/**
 * Bir bölümün "otomatik" anahtarları. Şablonda AÇIK gelirler; ancak kayıtlı bir
 * revizyonda bu anahtar hiç yoksa mühendis o değeri ELLE girmiş demektir ve
 * türetme onu ezmemelidir. Bu yüzden şablondan miras alınmaz, kapalıya çekilir.
 *
 * Liste bölüm ailelerinden BAĞIMSIZDIR: her modülün girdi nesnesine aynı
 * süzgeç uygulanır, o modülde olmayan anahtar zaten hiç görünmez.
 * **Yeni bir `*Auto` anahtarı eklerken buraya da eklenmelidir** — yoksa
 * şablondaki `true` miras kalır ve mühendisin elle girdiği değer ilk açılışta
 * sessizce ezilir.
 */
const AUTO_FLAGS = [
  // Kaldırma grubu
  "ropeWeightAuto",
  "hookBlockWeightAuto",
  "sheaveEfficiencyAuto",
  "tempFactorAuto",
  "drumGrooveLengthAuto",
  "drumWeightAuto",
  // Yürütme grubu
  "travelApplicationClassAuto",
  "serviceFactorKsAuto",
  "accelTorqueFactorKtAuto",
  // Ana kiriş (7.2 yükler / 7.3 yükleme durumları)
  "psiHAAuto",
  "psiHKAuto",
  "amplifyYcAuto",
] as const;

function keepManualValues<T extends object>(stored: T | null | undefined, merged: T): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  const out = { ...merged } as Record<string, unknown>;
  let changed = false;
  for (const flag of AUTO_FLAGS) {
    if (!(flag in rec) && out[flag] === true) {
      out[flag] = false;
      changed = true;
    }
  }
  return changed ? (out as T) : merged;
}

/**
 * Kayıtta olmayan alanları şablondan tamamlar (şema evrimi güvenliği).
 * Motora yeni bir girdi eklendiğinde eski revizyonlar `undefined` yerine
 * şablon değerini görür — hesap NaN'a düşmez.
 *
 * Birleştirme İKİ SEVİYELİDİR: şablondaki bir alan düz nesneyse (buruşmanın
 * `side` / `top` panelleri gibi) o nesnenin İÇİ de tamamlanır. Sığ birleştirme
 * yapılsaydı iç içe bir yapıya yeni alan eklendiğinde eski revizyonlarda o
 * alan `undefined` kalır ve hesap sessizce NaN üretirdi. Diziler ve `null`
 * OLDUĞU GİBİ korunur — onlar veri, tamamlanacak şema değil.
 */
function withDefaults<T extends object>(stored: T | null | undefined, template: T): T {
  if (!stored || typeof stored !== "object") return template;
  const tpl = template as unknown as Record<string, unknown>;
  const src = stored as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...tpl, ...src };
  for (const key of Object.keys(tpl)) {
    const t = tpl[key];
    const v = src[key];
    if (
      t !== null && typeof t === "object" && !Array.isArray(t) &&
      v !== null && typeof v === "object" && !Array.isArray(v)
    ) {
      out[key] = { ...(t as object), ...(v as object) };
    }
  }
  return out as T;
}

/**
 * Ağırlık alanları eskiden yürütme modülü girdisiydi; artık teknik özelliktir.
 * Eski bir revizyonda `specs` bu alanları taşımaz — o zaman değerler kayıtlı
 * araba/köprü girdilerinden taşınır. Aksi hâlde şablon varsayılanı devreye
 * girer ve mühendisin girdiği ağırlıklar SESSİZCE değişirdi.
 *
 * Eski köprü girdisi ağırlığı ikiye ayırıyordu (ana kirişler + diğer); yeni
 * model tek toplam tuttuğu için ikisi toplanır.
 */
function migrateWeights(
  specs: TechnicalSpecs,
  inputs: RevisionInputsJson | null
): TechnicalSpecs {
  if (!inputs) return specs;
  const stored = inputs as unknown as Record<string, Record<string, unknown> | null>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const out = { ...specs };

  if (num((inputs.specs as Record<string, unknown> | undefined)?.mainTrolleyWeightT) === undefined) {
    const legacy = num(stored.trolley?.trolleyWeightT);
    if (legacy !== undefined) out.mainTrolleyWeightT = legacy;
  }
  if (num((inputs.specs as Record<string, unknown> | undefined)?.bridgeWeightT) === undefined) {
    const girders = num(stored.bridge?.bridgeWeightT);
    const others = num(stored.bridge?.otherWeightsT) ?? 0;
    if (girders !== undefined) out.bridgeWeightT = girders + others;
  }
  return out;
}

/**
 * Tambur mili ölçüleri eskiden cm'ydi (`drumSpanACm`, `shaftD1Cm`,
 * `drumWeldThicknessCm` …); artık teknik resimle aynı birimde, mm sorulur ve
 * saklanır (`drumSpanAMm`, `shaftD1Mm` …).
 *
 * `withDefaults` AD BAZLI çalışır: eski kayıttaki `*Cm` alanlarını tanımaz ve
 * yeni `*Mm` alanlarını ŞABLON DEĞERİNE düşürür — mühendisin girdiği ölçüler
 * sessizce kaybolur, hesap başka bir tamburu çözer. Bu yüzden göç ZORUNLUDUR:
 * eski `*Cm` değeri ×10 ile yeni `*Mm` alanına taşınır.
 *
 * Göç yalnız kayıtta `*Mm` YOKKEN ve `*Cm` VARKEN uygulanır; yeni kayıtlar
 * dokunulmadan geçer. `null`/sayı olmayan değerler atlanır (şablon devreye
 * girer).
 */
const DRUM_SHAFT_CM_TO_MM: ReadonlyArray<readonly [legacyCm: string, mm: string]> = [
  ["drumSpanACm", "drumSpanAMm"],
  ["drumSpanBCm", "drumSpanBMm"],
  ["drumSpanCCm", "drumSpanCMm"],
  ["drumSpanDCm", "drumSpanDMm"],
  ["drumSpanECm", "drumSpanEMm"],
  ["drumSpanFCm", "drumSpanFMm"],
  ["drumSpanGCm", "drumSpanGMm"],
  ["shaftD1Cm", "shaftD1Mm"],
  ["shaftD2Cm", "shaftD2Mm"],
  ["drumWeldThicknessCm", "drumWeldThicknessMm"],
  ["shaftWeldThicknessCm", "shaftWeldThicknessMm"],
];

export function migrateDrumShaftUnits<T extends object>(
  stored: object | null | undefined,
  merged: T
): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  const out = { ...merged } as Record<string, unknown>;
  let changed = false;
  for (const [legacyCm, mm] of DRUM_SHAFT_CM_TO_MM) {
    if (mm in rec) continue;                 // yeni biçim: kayıt zaten mm taşıyor
    const v = rec[legacyCm];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[mm] = v * 10;
    changed = true;
  }
  return changed ? (out as T) : merged;
}

/** Tüm bölümleri (kapalılar dâhil) şablonla tamamlanmış olarak kurar. */
function fullInput(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): CalcInput {
  const out: CalcInput = {
    specs: migrateWeights(withDefaults(inputs?.specs, NEW_WORK_TEMPLATE.specs), inputs),
  };
  const storedInputs = (inputs ?? {}) as Record<string, unknown>;
  const storedSelections = (selections ?? {}) as Record<string, unknown>;
  const template = NEW_WORK_TEMPLATE as unknown as Record<
    string,
    { inputs: object; selections?: object } | undefined
  >;
  const target = out as unknown as Record<string, { inputs: object; selections?: object }>;

  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    const tpl = template[field];
    if (!tpl) continue;
    const storedModuleInputs = storedInputs[field] as object | null | undefined;
    const merged: { inputs: object; selections?: object } = {
      // Otomatik anahtarlar şablondan MİRAS ALINMAZ: kayıtlı revizyonda anahtar
      // yoksa değer elle girilmiştir ve türetme onu ezmemelidir.
      inputs: keepManualValues(
        storedModuleInputs,
        // Tambur mili ölçüsü cm → mm göçü YALNIZ kaldırma gruplarına uygulanır:
        // kanca bloğunun `shaftD1Cm` alanı cm olarak KALIR (ayrı bölüm, ayrı tip).
        isHoistKey(key)
          ? migrateDrumShaftUnits(
              storedModuleInputs,
              withDefaults(storedModuleInputs, tpl.inputs)
            )
          : withDefaults(storedModuleInputs, tpl.inputs)
      ),
    };
    if (tpl.selections) {
      merged.selections = withDefaults(
        storedSelections[field] as object | null | undefined,
        tpl.selections
      );
    }
    target[field] = merged;
  }
  return out;
}

export function loadRevision(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): LoadedRevision {
  const full = fullInput(inputs, selections);
  const disabled = [...disabledSet(inputs)];
  // Vinç konfigürasyonu (monoray adedi, yardımcı araba) topolojik olarak
  // olmayan bölümleri de eler.
  const active = activeModules(full.specs, disabled);
  const input: CalcInput = { ...full };
  for (const key of MODULE_ORDER) {
    if (active.has(key)) continue;
    delete (input as unknown as Record<string, unknown>)[CALC_FIELD[key]];
  }
  return { input, full, disabled };
}

/** Hesaba giren girdi seti (kapalı bölümler hariç). */
export function calcInputFromRevision(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): CalcInput {
  return loadRevision(inputs, selections).input;
}
