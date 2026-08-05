// Modül anahtarı ↔ sunum ailesi.
//
// Bir vinçte aynı fizik birden çok kez geçer: ana kaldırma, yardımcı kaldırma
// ve monoray kaldırma grupları AYNI hesabı (hoistSections) paylaşır; ana araba,
// yardımcı araba, monoray arabaları ve köprü AYNI yürütme hesabını kullanır;
// her kaldırma grubunun kendi kanca bloğu vardır. Sunum tarafındaki haritalar
// (kontrol bağlantıları, standart bağlamı) bu yüzden modül başına değil AİLE
// başına tanımlanır. Bu dosya, motor/UI katmanlarına bağımlı olmayan ortak
// eşlemedir.

/**
 * Hesap bölümü anahtarı. Sıra aynı zamanda sihirbaz/rapor sırasıdır:
 * her kaldırma grubunu kendi kanca bloğu izler, ardından arabalar, en sonda
 * köprü ve taşıyıcı yapı bölümleri gelir.
 */
export type ModuleKey =
  | "main"
  | "hookBlock"
  | "aux"
  | "auxHookBlock"
  | "trolley"
  | "auxTrolley"
  | "mono1"
  | "mono1HookBlock"
  | "mono1Trolley"
  | "mono2"
  | "mono2HookBlock"
  | "mono2Trolley"
  | "bridge"
  | "wheelLoads"
  | "girder"
  | "buckling"
  | "endCarriage";

export type ModuleFamily =
  | "hoist"
  | "hookBlock"
  | "travel"
  | "wheelLoads"
  | "girder"
  | "buckling"
  | "endCarriage";

const FAMILY: Record<ModuleKey, ModuleFamily> = {
  main: "hoist",
  hookBlock: "hookBlock",
  aux: "hoist",
  auxHookBlock: "hookBlock",
  trolley: "travel",
  auxTrolley: "travel",
  mono1: "hoist",
  mono1HookBlock: "hookBlock",
  mono1Trolley: "travel",
  mono2: "hoist",
  mono2HookBlock: "hookBlock",
  mono2Trolley: "travel",
  bridge: "travel",
  wheelLoads: "wheelLoads",
  girder: "girder",
  buckling: "buckling",
  endCarriage: "endCarriage",
};

export function moduleFamily(key: ModuleKey): ModuleFamily {
  return FAMILY[key];
}

/** Sihirbaz/rapor sırası — tek gerçek kaynak. */
export const MODULE_ORDER: readonly ModuleKey[] = [
  "main",
  "hookBlock",
  "aux",
  "auxHookBlock",
  "trolley",
  "auxTrolley",
  "mono1",
  "mono1HookBlock",
  "mono1Trolley",
  "mono2",
  "mono2HookBlock",
  "mono2Trolley",
  "bridge",
  // Teker yükleri, köprü yürütmenin hemen ardından gelir: girdilerini oradan
  // alır ve yol kirişine aktarılan kuvvetleri raporun taşıyıcı yapı
  // bölümlerinden önce verir.
  "wheelLoads",
  "girder",
  "buckling",
  "endCarriage",
];

// ------------------------------------------------------------ Kaldırma grupları

/** Kaldırma grubu anahtarı — hoistGroup ailesinin varyantları. */
export type HoistKey = "main" | "aux" | "mono1" | "mono2";

/** Yürütme grubu anahtarı — travelGroup ailesinin varyantları. */
export type TravelKey = "trolley" | "auxTrolley" | "mono1Trolley" | "mono2Trolley" | "bridge";

/** Kanca bloğu anahtarı — her kaldırma grubunun bir bloğu olabilir. */
export type HookBlockKey = "hookBlock" | "auxHookBlock" | "mono1HookBlock" | "mono2HookBlock";

const HOIST_KEYS: readonly HoistKey[] = ["main", "aux", "mono1", "mono2"];
const TRAVEL_KEYS: readonly TravelKey[] = [
  "trolley", "auxTrolley", "mono1Trolley", "mono2Trolley", "bridge",
];
const HOOKBLOCK_KEYS: readonly HookBlockKey[] = [
  "hookBlock", "auxHookBlock", "mono1HookBlock", "mono2HookBlock",
];

export function isHoistKey(k: ModuleKey): k is HoistKey {
  return (HOIST_KEYS as readonly string[]).includes(k);
}
export function isTravelKey(k: ModuleKey): k is TravelKey {
  return (TRAVEL_KEYS as readonly string[]).includes(k);
}
export function isHookBlockKey(k: ModuleKey): k is HookBlockKey {
  return (HOOKBLOCK_KEYS as readonly string[]).includes(k);
}

/** Kaldırma grubu → ona bağlı kanca bloğu bölümü. */
export const HOOKBLOCK_OF: Record<HoistKey, HookBlockKey> = {
  main: "hookBlock",
  aux: "auxHookBlock",
  mono1: "mono1HookBlock",
  mono2: "mono2HookBlock",
};

/** Kanca bloğu → beslendiği kaldırma grubu. */
export const HOIST_OF_HOOKBLOCK: Record<HookBlockKey, HoistKey> = {
  hookBlock: "main",
  auxHookBlock: "aux",
  mono1HookBlock: "mono1",
  mono2HookBlock: "mono2",
};

/** Monoray kaldırma grubu → kendi araba yürütme bölümü. */
export const TROLLEY_OF: Partial<Record<HoistKey, TravelKey>> = {
  main: "trolley",
  aux: "auxTrolley",
  mono1: "mono1Trolley",
  mono2: "mono2Trolley",
};
