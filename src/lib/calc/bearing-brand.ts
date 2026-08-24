// Rulman markası — bütün rulman kutuları TEK bir ortak markayı paylaşır.
//
// Bir vinçte rulman markası bölüm bölüm verilen bir karar DEĞİLDİR: atölye
// hangi markayı kabul ediyorsa tambur, denge, makara, kanca ve teker
// rulmanlarının hepsi onu kullanır. Kutular bu yüzden `*BrandAuto` anahtarıyla
// birbirine bağlıdır: anahtarı açık olan her kutu ORTAK markayı gösterir,
// bunlardan birinde marka değiştiğinde hepsi birden değişir. Bir kutunun
// anahtarı kapatılırsa o kutu bağdan çıkar ve kendi markasını tutar
// (ör. yalnız kanca rulmanı için ikinci bir marka kabul ediliyorsa).
//
// Anahtar GİRDİLERDE, marka SEÇİMLERDE durur — uygulamanın `*Auto` deseni
// (bkz. `HOIST_AUTO_SELECTION_FIELDS`): `revision-load.ts`teki AUTO_FLAGS
// koruması yalnız girdi nesnesine bakar.
//
// Bu dosya SAFTIR: yalnız hangi alanın hangi anahtara bağlı olduğunu ve
// yayılımın kuralını bilir; state'i editör yazar.

import { moduleFamily, type ModuleKey } from "./presentation/module-family";

/** Bir rulman markası kutusu: değeri tutan seçim alanı + otomatik anahtarı. */
export interface BearingBrandField {
  /** Markanın yazıldığı SEÇİM alanı */
  selection: string;
  /** Otomatik anahtarının durduğu GİRDİ alanı */
  flag: string;
}

/** Kaldırma grubu: tambur rulmanı + denge rulmanı. */
export const HOIST_BEARING_BRAND_FIELDS: readonly BearingBrandField[] = [
  { selection: "bearingBrand", flag: "bearingBrandAuto" },
  { selection: "balanceBearingBrand", flag: "balanceBearingBrandAuto" },
];

/** Kanca bloğu: makara rulmanı + kanca (eksenel) rulmanı. */
export const HOOKBLOCK_BEARING_BRAND_FIELDS: readonly BearingBrandField[] = [
  { selection: "sheaveBearingBrand", flag: "sheaveBearingBrandAuto" },
  { selection: "hookBearingBrand", flag: "hookBearingBrandAuto" },
];

/** Yürütme grubu: teker rulmanı. */
export const TRAVEL_BEARING_BRAND_FIELDS: readonly BearingBrandField[] = [
  { selection: "bearingBrand", flag: "bearingBrandAuto" },
];

const NONE: readonly BearingBrandField[] = [];

/** Bir bölümün rulman markası kutuları (yoksa boş liste). */
export function bearingBrandFields(key: ModuleKey): readonly BearingBrandField[] {
  switch (moduleFamily(key)) {
    case "hoist": return HOIST_BEARING_BRAND_FIELDS;
    case "hookBlock": return HOOKBLOCK_BEARING_BRAND_FIELDS;
    case "travel": return TRAVEL_BEARING_BRAND_FIELDS;
    default: return NONE;
  }
}

/** Bu seçim alanı, bu bölümde bir rulman markası kutusu mu? */
export function bearingBrandFieldOf(
  key: ModuleKey,
  selectionKey: string
): BearingBrandField | undefined {
  return bearingBrandFields(key).find((f) => f.selection === selectionKey);
}

/** Otomatik anahtarları da dahil bütün rulman markası anahtarlarının listesi. */
export const BEARING_BRAND_AUTO_FLAGS: readonly string[] = Array.from(
  new Set(
    [
      ...HOIST_BEARING_BRAND_FIELDS,
      ...HOOKBLOCK_BEARING_BRAND_FIELDS,
      ...TRAVEL_BEARING_BRAND_FIELDS,
    ].map((f) => f.flag)
  )
);

/** Bir bölümün yayılıma girecek durumu (girdiler + seçimler). */
export interface BearingBrandModuleState {
  inputs: object;
  selections: object;
}

/**
 * ORTAK MARKAYI bütün otomatik kutulara yazar.
 *
 * Yalnız anahtarı AÇIK olan kutulara dokunulur; kapalı kutu kendi markasını
 * korur. Değeri zaten doğru olan bölüm AYNI NESNE olarak döner — gereksiz bir
 * yeniden hesap turu açılmasın.
 *
 * DEĞİŞİKLİĞİ BAŞLATAN BÖLÜM DE TARANIR. Bir bölümde birden çok rulman kutusu
 * olabilir (kaldırma grubunda tambur + denge rulmanı): başlatan bölümü
 * atlamak, aynı bölümdeki İKİNCİ kutuyu bağın dışında bırakırdı. Başlatan
 * kutunun kendisi zaten aranan markadadır ve dokunulmadan geçilir.
 */
export function applyBearingBrand<T extends Record<string, BearingBrandModuleState>>(
  modules: T,
  brand: string
): T {
  let out: T | undefined;
  for (const key of Object.keys(modules) as (keyof T & string)[]) {
    const fields = bearingBrandFields(key as ModuleKey);
    if (fields.length === 0) continue;
    const state = modules[key];
    if (!state) continue;
    const inputs = state.inputs as Record<string, unknown>;
    const selections = state.selections as Record<string, unknown>;
    let next: Record<string, unknown> | undefined;
    for (const f of fields) {
      if (inputs[f.flag] !== true) continue;
      if ((next ?? selections)[f.selection] === brand) continue;
      next = { ...(next ?? selections), [f.selection]: brand };
    }
    if (!next) continue;
    out = { ...(out ?? modules), [key]: { ...state, selections: next } };
  }
  return out ?? modules;
}
