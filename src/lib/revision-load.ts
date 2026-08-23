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
import {
  DISABLEABLE_MODULE_KEYS,
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type ModuleKey,
} from "@/lib/calc/presentation/module-family";
import {
  hoistReeving,
  hoistSpecView,
  ropeLengthPlan,
  type HoistInputs,
  type HoistSelections,
} from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import { deriveReeving } from "@/lib/calc/reeving";
import { railFamilyOf } from "@/lib/calc/tables";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import type { CabinInputs, CabinSelections } from "@/lib/calc/modules/cabin";
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
  girder2?: GirderInputs | null;
  buckling?: BucklingInputs | null;
  endCarriage?: EndCarriageInputs | null;
  cabin?: CabinInputs | null;
  /** Kullanıcının kapattığı hesap bölümleri (hesaba ve rapora girmez) */
  disabledModules?: string[] | null;
  /**
   * Kullanıcının GİZLEDİĞİ alt bölümler (`${moduleKey}-${sectionRawId}`,
   * ör. "trolley-5.7"). Kapatılan MODÜLDEN farkı: gizlenen alt bölüm hesaba
   * GİRMEYE devam eder (motor bölüm sınırı bilmez), yalnız sunumdan düşer —
   * editör soluk gösterir, PDF raporu, kontrol özetleri ve ekipman listesi
   * hiç basmaz. Girdiler korunur; kutucuk geri açılınca bölüm aynen döner.
   */
  hiddenSections?: string[] | null;
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
  girder2?: GirderSelections | null;
  endCarriage?: EndCarriageSelections | null;
  cabin?: CabinSelections | null;
  alts?: RevisionAlts;
  /** Hesap alt bölümlerine bağlı mühendis notları. */
  sectionNotes?: RevisionSectionNotes;
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

/** Anahtar: `${moduleKey}-${section.rawId}`; değer serbest mühendis notu. */
export type RevisionSectionNotes = Record<string, string>;

/** Hesap alt bölümünün not anahtarı (editör ve PDF aynı kimliği kullanır). */
export function sectionNoteKeyFor(moduleKey: string, sectionRawId: string): string {
  return `${moduleKey}-${sectionRawId}`;
}

/**
 * Gizlenen alt bölümün anahtarı — not ve alternatif anahtarlarıyla AYNI uzay
 * (`${moduleKey}-${sectionRawId}`). Üç kayıt da aynı bölümü işaret eder;
 * üç ayrı anahtar biçimi "hangisi hangi bölüm" sorusunu doğururdu.
 */
export function sectionHideKeyFor(moduleKey: string, sectionRawId: string): string {
  return `${moduleKey}-${sectionRawId}`;
}

/**
 * JSONB snapshot'tan gizli alt bölüm listesini güvenle okur. Bozuk/yinelenen
 * girdiler atlanır; anahtar biçimi (`modul-rawId`) tutmayan değerler düşer —
 * serbest biçimli JSONB'ye güvenilmez (altsFromRevision ile aynı ilke).
 */
export function hiddenSectionsFromRevision(
  inputs: RevisionInputsJson | null | undefined
): string[] {
  const raw = (inputs as { hiddenSections?: unknown } | null | undefined)?.hiddenSections;
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const dash = v.indexOf("-");
    if (dash <= 0 || dash === v.length - 1) continue;
    out.add(v);
  }
  return [...out];
}

/** JSONB snapshot'tan güvenli not haritası okur; boş/bozuk girdileri atlar. */
export function sectionNotesFromRevision(
  selections: RevisionSelectionsJson | null | undefined
): RevisionSectionNotes {
  const raw = (selections as { sectionNotes?: unknown } | null | undefined)?.sectionNotes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RevisionSectionNotes = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const note = value.trim();
    if (note) out[key] = note;
  }
  return out;
}

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

/**
 * Kapatılabilen bölümler — TANIM ÇEKİRDEKTEDİR (`DISABLEABLE_MODULE_KEYS`).
 *
 * Burada elle yazılmış ikinci bir liste vardı ve editörünkiyle (
 * `OPTIONAL_MODULE_KEYS`) AYRIŞMIŞTI: "Teker Yükleri" kutucuğu ekranda
 * kapanıyor, `disabledModules` listesine yazılıyor, ama sayfa yenilenince
 * aşağıdaki süzgeç anahtarı tanımadığı için sessizce düşürüyor ve bölüm
 * kendiliğinden geri açılıyordu (aynı boşluk `girder2` ve `cabin` için de
 * vardı). Artık üç kapı da tek listeden okur.
 */
export const DISABLEABLE_MODULES: readonly ModuleKey[] = DISABLEABLE_MODULE_KEYS;

/**
 * "Alanı hiç yok / null → bölüm KAPALI" kuralının geçerli olduğu bölümler.
 *
 * Bu liste `DISABLEABLE_MODULES`tan AYRIDIR ve DONDURULMUŞTUR. Kural eski
 * kayıtlar içindir: yeni bir bölüm eklendiğinde, o bölüm daha yokken
 * kaydedilmiş revizyonlarda alan hiç bulunmaz ve bölüm şablon değerleriyle
 * kendiliğinden AÇILIR — teslim edilmiş bir rapora sonradan bölüm eklemek
 * demektir bu. Listeye YENİ bir anahtar eklemek ise tersini yapar: o bölümü
 * taşımayan her eski revizyonda bölüm sessizce KAPANIR, yani geçmişteki bir
 * raporun içeriği değişir. Bugünün kayıtları zaten bütün alanları yazıyor
 * (`saveRevision`/`moduleJson`), o yüzden listenin büyümesine gerek yok.
 */
const ABSENCE_MEANS_DISABLED = [
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
  girder2: "girder2",
  buckling: "buckling",
  endCarriage: "endCarriage",
  cabin: "cabin",
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
 *      Kapsamı `ABSENCE_MEANS_DISABLED`tir ve DONDURULMUŞTUR.
 *   3. Eski kayıt kuralı: alan var ama değeri `null`.
 *
 * **HENÜZ KAYDEDİLMEMİŞ revizyonda 2. ve 3. kural çalışmaz.** Ölçüt
 * `disabledModules` anahtarının varlığı DEĞİL, snapshot'ta bir MODÜL ALANININ
 * bulunup bulunmadığıdır: yeni revizyon `{}` ile de doğabilir, vinç tipinin
 * tohumladığı `{ disabledModules: [...] }` ile de (`craneTypePresetInputs`).
 * Ölçüt "nesne boş mu" olsaydı tohumlanmış revizyonda hiçbir modül alanı
 * bulunamaz ve BÜTÜN bölümler kapalı sayılırdı — tohum, kapatmayı istemediği
 * bölümleri de kapatırdı.
 */
function disabledSet(inputs: RevisionInputsJson | null): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  const allowed = new Set<string>(DISABLEABLE_MODULES);
  const stored = (inputs ?? {}) as unknown as Record<string, unknown>;

  const list = inputs?.disabledModules;
  if (Array.isArray(list)) {
    for (const k of list) {
      if (allowed.has(k)) out.add(k as ModuleKey);
    }
  }

  const kaydedilmis = MODULE_ORDER.some((k) => CALC_FIELD[k] in stored);
  if (!kaydedilmis) {
    for (const k of NEW_WORK_DISABLED_MODULES) {
      if (allowed.has(k)) out.add(k as ModuleKey);
    }
    return out;
  }

  for (const k of ABSENCE_MEANS_DISABLED) {
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
  "ropeOrderLengthAuto",
  "drumWeightAuto",
  "drumGrooveSpanAuto",
  "gearboxServiceFactorAuto",
  "drumCouplingServiceFactorAuto",
  // Kanca bloğu
  "hookDesignationAuto",
  "sheaveCountAuto",
  // Yürütme grubu
  "travelApplicationClassAuto",
  "serviceFactorKsAuto",
  "accelTorqueFactorKtAuto",
  // İvme ve tahvil oranı otomatikleri YENİDİR: eski revizyonlarda anahtar
  // yoktur, o kayıtlarda değer ELLE girilmiştir ve türetme onu ezmemelidir.
  // (Tahvil oranında bu ayrıca yayınlanmış bir raporu "uygun değil"e
  // düşürmemeyi de sağlar.)
  "accelerationAuto",
  "motorCountAuto",
  "gearboxRatioAuto",
  // Ana kiriş (7.2 yükler / 7.3 yükleme durumları)
  "psiHAAuto",
  "psiHKAuto",
  "amplifyYcAuto",
  "hookTopPositionAuto",
  "bridgeAxleSpacingAuto",
  "wheelContactTAuto",
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
 * RAY AİLESİ ESKİ KAYITTA YOKTUR — koddan çıkarılır.
 *
 * Ray seçimi iki kutuya ayrıldığında (23.08.2026) aile ayrı bir alan oldu.
 * Eski revizyonlarda yalnız kod saklıdır; şablonun ailesi ("bar") miras
 * bırakılırsa A ya da S serisi bir rayda ikinci kutu boş bir listeyle açılırdı.
 * Aile, kaydın KENDİ kodundan çözülür (`railFamilyOf`).
 */
export function migrateRailFamily<T extends object>(
  stored: object | null | undefined,
  merged: T
): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  if (typeof rec.railFamily === "string" && rec.railFamily.trim() !== "") return merged;
  return { ...merged, railFamily: railFamilyOf(rec.railCode as string | undefined) } as T;
}

/**
 * Denge düzeni alanı eklenmeden önce bütün şemalar denge makaralıydı. Yeni iş
 * şablonu denge traversli gelir; fakat eski bir revizyona şablon değeri
 * miras bırakmak, teslim edilmiş halat adedi ve şemasını değiştirirdi.
 */
export function migrateRopeBalancingType<T extends object>(
  stored: object | null | undefined,
  merged: T
): T {
  if (!stored || typeof stored !== "object") return merged;
  if ("ropeBalancingType" in (stored as Record<string, unknown>)) return merged;
  return { ...merged, ropeBalancingType: "equalizerSheave" } as T;
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
 * Kullanıcıdan istenen tüm doğrusal ölçüler eskiden bazı bölümlerde cm'ydi.
 * Artık teknik resimle aynı birimde, mm sorulur ve saklanır.
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
const LEGACY_CM_TO_MM: ReadonlyArray<readonly [legacyCm: string, mm: string]> = [
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
  ["shaftEdgeGapCm", "shaftEdgeGapMm"],
  ["shaftSheavePitchCm", "shaftSheavePitchMm"],
  ["shaftCenterGapCm", "shaftCenterGapMm"],
  ["shaftSpanACm", "shaftSpanAMm"],
  ["shaftSpanBCm", "shaftSpanBMm"],
  ["shaftDiaCm", "shaftDiaMm"],
];

export function migrateDrumShaftUnits<T extends object>(
  stored: object | null | undefined,
  merged: T
): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  const out = { ...merged } as Record<string, unknown>;
  let changed = false;
  for (const [legacyCm, mm] of LEGACY_CM_TO_MM) {
    if (mm in rec) continue;                 // yeni biçim: kayıt zaten mm taşıyor
    const v = rec[legacyCm];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[mm] = v * 10;
    changed = true;
  }
  return changed ? (out as T) : merged;
}

/**
 * Kaldırma kirişi geometrisi ESKİDEN İKİ SAYIYDI: `girderSpanMm` (açıklık a) ve
 * `loadOffsetMm` (yükün mesnede uzaklığı b). Yeni model teknik resmin ölçü
 * zincirini kullanır (x · y · z) ve asimetrik askıyı da modelleyebilir.
 *
 * `withDefaults` AD BAZLI çalışır: eski kayıttaki a/b alanlarını tanımaz ve yeni
 * x/y/z alanlarını ŞABLON DEĞERİNE düşürür — mühendisin girdiği kiriş sessizce
 * başka bir kiriş olurdu. Göç bu yüzden ZORUNLUDUR ve eski modelin SİMETRİK
 * karşılığını yazar:
 *
 *     x = z = b        y = a − 2b   (negatifse 0)
 *
 * Bu dönüşüm sonuçları değiştirmez: simetrik askıda M = F·b ve V = F, yani eski
 * formüllerin verdiği sayıların ta kendisi.
 *
 * Göç yalnız kayıtta `beamXMm` YOKKEN ve eski alanlardan biri VARKEN uygulanır;
 * yeni kayıtlar dokunulmadan geçer.
 */
export function migrateLiftingBeam<T extends object>(
  stored: object | null | undefined,
  merged: T
): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  if ("beamXMm" in rec) return merged;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  const span = num(rec.girderSpanMm);
  const offset = num(rec.loadOffsetMm);
  if (span === undefined && offset === undefined) return merged;
  const b = offset ?? 0;
  const a = span ?? 0;
  return {
    ...merged,
    beamXMm: b,
    beamYMm: Math.max(0, a - 2 * b),
    beamZMm: b,
  } as T;
}

/**
 * Eski A/B/D kanca mili ölçü zincirini yeni simetrik merkez modeline taşır.
 * Makara adedi bağlı kaldırma grubunun donanımından gelir; böylece eski hesabın
 * açıklığı ve yük konumları birebir korunur.
 */
export function migrateHookShaftCenter<T extends object>(
  stored: object | null | undefined,
  merged: T,
  sheaveCount: number
): T {
  if (!stored || typeof stored !== "object") return merged;
  const rec = stored as Record<string, unknown>;
  const current = merged as Record<string, unknown>;
  if ("shaftSupportOffsetMm" in rec || "shaftSheaveOffsetsText" in rec) return merged;
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const edge = number(rec.shaftEdgeGapMm) ?? number(current.shaftEdgeGapMm);
  const pitch = number(rec.shaftSheavePitchMm) ?? number(current.shaftSheavePitchMm);
  const gap = number(rec.shaftCenterGapMm) ?? number(current.shaftCenterGapMm);
  if (edge === undefined && pitch === undefined && gap === undefined) return merged;
  const a = edge ?? 0;
  const b = pitch ?? 0;
  const d = gap ?? 0;
  const count = Math.max(1, Math.round(Number.isFinite(sheaveCount) ? sheaveCount : 1));
  const positions: number[] = [];
  if (count === 1) {
    positions.push(a);
  } else {
    const left = Math.ceil(count / 2);
    const right = count - left;
    for (let i = 0; i < left; i++) positions.push(a + i * b);
    const start = a + (left - 1) * b + d;
    for (let i = 0; i < right; i++) positions.push(start + i * b);
  }
  const span = positions[positions.length - 1] + a;
  const center = span / 2;
  const offsets = [...new Set(
    positions.map((position) => Math.abs(position - center)).filter((offset) => offset > 1e-9)
  )].sort((x, y) => x - y);
  return {
    ...merged,
    shaftSupportOffsetMm: center,
    shaftSheaveOffsetsText: offsets.map((offset) => Number(offset.toFixed(3))).join("; "),
  } as T;
}

/** Tüm bölümleri (kapalılar dâhil) şablonla tamamlanmış olarak kurar. */
/**
 * Feston, teknik özellikte tutulan bir "ön seçim kartı" iken yürütme grubunun
 * KATALOG bölümü oldu (5.9): seri artık katalogdan seçilir, taşıyıcı adedi ve
 * kablo paketi modül girdisidir, taşıyıcı yükü/hız kontrolleri motorda koşar.
 *
 * Eski revizyonlarda veri `specs.<eksen>Festoon` altındadır. `withDefaults` AD
 * BAZLI çalıştığı için o veriyi tanımaz ve mühendisin girdiği taşıyıcı adedi /
 * kablo paketi SESSİZCE şablon değerine düşerdi. Göç bu yüzden zorunludur:
 * değerler bir kez ilgili yürütme bölümünün girdi ve seçimlerine taşınır.
 *
 * Yalnız modülde feston alanı BOŞKEN uygulanır; yeni kayıtlar dokunulmadan
 * geçer. Katalog seri kodları eski listede olduğu gibi taşınır ("0320",
 * "VS2020"); marka adı da katalogdaki yazımına çevrilir ki katalog satırıyla
 * eşleşsin.
 */
const LEGACY_FESTOON_SPEC_KEY: Record<string, string> = {
  trolley: "trolleyFestoon",
  auxTrolley: "auxTrolleyFestoon",
  mono1Trolley: "mono1TrolleyFestoon",
  mono2Trolley: "mono2TrolleyFestoon",
  bridge: "bridgeFestoon",
};

const LEGACY_FESTOON_BRAND: Record<string, string> = {
  conductixWampfler: "Conductix-Wampfler",
  vasel: "Vasel",
};

const LEGACY_FESTOON_CABLE_FORM: Record<string, string> = {
  flat: "Yassı",
  round: "Yuvarlak",
};

export function migrateFestoon(
  moduleKey: string,
  specs: TechnicalSpecs,
  merged: { inputs: object; selections?: object }
): { inputs: object; selections?: object } {
  const specKey = LEGACY_FESTOON_SPEC_KEY[moduleKey];
  if (!specKey) return merged;
  const legacy = (specs as unknown as Record<string, unknown>)[specKey] as
    | Record<string, unknown>
    | undefined;
  if (!legacy || typeof legacy !== "object") return merged;

  const inputs = merged.inputs as Record<string, unknown>;
  const selections = (merged.selections ?? {}) as Record<string, unknown>;
  // Modülde zaten feston verisi varsa (yeni kayıt) dokunulmaz.
  if (selections.festoonSeries || inputs.festoonCablePackageWeightKg) return merged;

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const nextInputs: Record<string, unknown> = { ...inputs };
  const nextSelections: Record<string, unknown> = { ...selections };

  const trolleyCount = num(legacy.trolleyCount);
  if (trolleyCount !== undefined) nextInputs.festoonTrolleyCount = trolleyCount;
  const packageKg = num(legacy.cablePackageWeightKg);
  if (packageKg !== undefined) nextInputs.festoonCablePackageWeightKg = packageKg;
  const loopHeight = num(legacy.loopHeightM);
  if (loopHeight !== undefined) nextInputs.festoonLoopHeightM = loopHeight;

  const brand = typeof legacy.brand === "string" ? LEGACY_FESTOON_BRAND[legacy.brand] : undefined;
  if (brand) nextSelections.festoonBrand = brand;
  // "auto" bir seri DEĞİLDİR — eski kayıtta seri seçilmemiş demektir; katalog
  // satırı yerine boş bırakılır ki mühendis bilinçli olarak seçsin.
  if (typeof legacy.series === "string" && legacy.series !== "auto") {
    nextSelections.festoonSeries = legacy.series;
  }
  const form = typeof legacy.cableForm === "string"
    ? LEGACY_FESTOON_CABLE_FORM[legacy.cableForm]
    : undefined;
  if (form) nextSelections.festoonCableForm = form;

  return { inputs: nextInputs, selections: merged.selections ? nextSelections : merged.selections };
}

/**
 * Kabin ve elektrik odası, teknik özelliklerin bir grubuyken kendi hesap
 * bölümü oldu (11.x): ölçüler, izolasyon, pano adedi ve kurulu yedek düzeni
 * artık MODÜL GİRDİSİDİR, klima da katalogdan seçilen bir üründür.
 *
 * Eski revizyonlar bu verinin tamamını `specs` altında taşıyor. `withDefaults`
 * AD BAZLI çalıştığı için modül girdileri şablon değerine düşer ve mühendisin
 * girdiği kabin ölçüleri SESSİZCE değişirdi. Göç bu yüzden zorunludur.
 *
 * Klimanın KENDİSİ taşınmaz: eski kayıt yalnız bir sınıf ("industrial") ve
 * serbest metin bir TMS tipi tutuyordu; bunlar katalog satırına karşılık
 * gelmez. Bunun yerine "o mahalde klima vardı" bilgisi korunur ve ürün seçimi
 * kontrolü mühendisi katalogdan seçim yapmaya yönlendirir.
 */
export function migrateCabin(
  specs: TechnicalSpecs,
  merged: { inputs: object; selections?: object }
): { inputs: object; selections?: object } {
  const legacy = specs as unknown as Record<string, unknown>;
  const inputs = merged.inputs as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const text = (v: unknown): string | undefined =>
    typeof v === "string" && v !== "" ? v : undefined;

  const next: Record<string, unknown> = { ...inputs };
  const carryNum = (from: string, to: string) => {
    const v = num(legacy[from]);
    if (v !== undefined) next[to] = v;
  };
  const carryText = (from: string, to: string) => {
    const v = text(legacy[from]);
    if (v !== undefined) next[to] = v;
  };

  carryNum("operatorCabinWidthM", "cabinWidthM");
  carryNum("operatorCabinLengthM", "cabinLengthM");
  carryNum("operatorCabinHeightM", "cabinHeightM");
  carryText("operatorCabinInsulation", "cabinInsulation");
  carryNum("electricalRoomWidthM", "roomWidthM");
  carryNum("electricalRoomLengthM", "roomLengthM");
  carryNum("electricalRoomHeightM", "roomHeightM");
  carryText("electricalRoomInsulation", "roomInsulation");
  carryText("electricalRoomAirConditioningRedundancy", "roomAcRedundancy");
  carryNum("electricalPanelCount", "panelCount");
  carryText("electricalPanelIpClass", "panelIpClass");
  carryText("electricalPanelAirConditioningRedundancy", "panelAcRedundancy");

  return { ...merged, inputs: next };
}

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
        migrateLiftingBeam(
          storedModuleInputs,
          migrateDrumShaftUnits(
            storedModuleInputs,
            isHoistKey(key)
              ? migrateRopeBalancingType(
                  storedModuleInputs,
                  withDefaults(storedModuleInputs, tpl.inputs)
                )
              : withDefaults(storedModuleInputs, tpl.inputs)
          )
        )
      ),
    };
    let derivedBlockSheaveCount: number | undefined;
    if (isHookBlockKey(key)) {
      const hoistState = target[CALC_FIELD[HOIST_OF_HOOKBLOCK[key]]];
      const hoistInputs = hoistState?.inputs as HoistInputs | undefined;
      const sheaveCount = hoistInputs
        ? deriveReeving(hoistReeving(hoistInputs)).blockSheaveCount
        : 1;
      derivedBlockSheaveCount = sheaveCount;
      merged.inputs = migrateHookShaftCenter(storedModuleInputs, merged.inputs, sheaveCount);
    }
    if (tpl.selections) {
      const storedModuleSelections = storedSelections[field] as object | null | undefined;
      merged.selections = withDefaults(
        storedModuleSelections,
        tpl.selections
      );
      if (isTravelKey(key)) {
        merged.selections = migrateRailFamily(storedModuleSelections, merged.selections);
      }
      // Makara adedi yeni bir kullanıcı alanıdır; fakat eski hesapta zaten
      // donanımdan otomatik geliyordu. Eski seçim nesnesinde alan yoksa o
      // davranış korunur ve doğru donanım değeri doğrudan snapshot'a taşınır.
      if (
        isHookBlockKey(key) &&
        derivedBlockSheaveCount !== undefined &&
        (!storedModuleSelections || !("sheaveCount" in storedModuleSelections))
      ) {
        merged.selections = {
          ...merged.selections,
          sheaveCount: derivedBlockSheaveCount,
        };
        merged.inputs = { ...merged.inputs, sheaveCountAuto: true };
      }
      // Halat sipariş boyu ilk kez ayrı ve düzenlenebilir bir seçim alanına
      // taşındı. Eski revizyonda alan yoksa mevcut denge/donanım düzeninden
      // otomatik tam metre değeri üretilir; bundan sonraki elle seçim korunur.
      if (
        isHoistKey(key) &&
        (!storedModuleSelections || !("ropeOrderLengthM" in storedModuleSelections))
      ) {
        const hoistInputs = {
          ...(merged.inputs as HoistInputs),
          ropeOrderLengthAuto: true,
        };
        const hoistSelections = merged.selections as HoistSelections;
        const plan = ropeLengthPlan(
          hoistInputs,
          hoistSelections,
          hoistSpecView(out.specs, key).liftHeightM
        );
        merged.inputs = hoistInputs;
        merged.selections = {
          ...hoistSelections,
          ropeOrderLengthM: plan.automaticTotalLengthM,
        };
      }
    }
    target[field] = key === "cabin"
      ? migrateCabin(out.specs, merged)
      : migrateFestoon(key, out.specs, merged);
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
