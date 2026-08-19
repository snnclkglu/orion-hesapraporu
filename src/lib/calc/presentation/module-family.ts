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
  | "girder2"
  | "buckling"
  | "endCarriage"
  | "cabin";

export type ModuleFamily =
  | "hoist"
  | "hookBlock"
  | "travel"
  | "wheelLoads"
  | "girder"
  | "buckling"
  | "endCarriage"
  | "cabin";

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
  // İkinci ana kiriş takımı AYNI aileyi kullanır: aynı hesap, aynı sunum
  // tanımları, aynı kontrol bağlantı haritası.
  girder2: "girder",
  buckling: "buckling",
  endCarriage: "endCarriage",
  cabin: "cabin",
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
  "girder2",
  "buckling",
  "endCarriage",
  // Kabin ve elektrik odası en sonda: hesabın hiçbir bölümünü beslemez,
  // teknik özelliklerdeki yerleşim seçimlerini ve klima katalogunu toplar.
  "cabin",
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

// ------------------------------------------------- Kapatılabilirlik ve bağlılık

/**
 * KAPATILAMAYAN bölümler — hesabın geri kalanı onların girdilerinden türer.
 *
 * Ana kaldırma bütün yük zincirinin başıdır (kanca bloğu, araba, kiriş hep
 * ondan besleniyor); ana araba ise kaldırmanın taşındığı yerdir ve köprü de
 * ana kiriş de araba tekerlerinden gelen yükü okur. **Köprü yürütme artık bu
 * listede DEĞİLDİR** (kullanıcı kararı, 19.08.2026): müşteri bazen yalnız
 * mevcut vincin arabasını yeniler ve o raporda köprü diye bir hesap yoktur.
 */
export const REQUIRED_MODULE_KEYS: readonly ModuleKey[] = ["main", "trolley"];

/**
 * Kapatılabilen bölümler — `MODULE_ORDER` eksi `REQUIRED_MODULE_KEYS`.
 *
 * TEK KAYNAKTIR: editördeki kutucuk ızgarası (`OPTIONAL_MODULE_KEYS`), kayda
 * giden liste (`DISABLEABLE_MODULES`, revision-load) ve motorun süzgeci
 * (`activeModules`) hep buradan okur. Üç ayrı elle yazılmış liste, bir bölümün
 * ekranda kapanıp kayıtta geri açılmasının en kısa yoluydu — teker yükleri,
 * kabin ve ikinci ana kiriş bölümlerinde tam olarak bu oluyordu.
 */
export const DISABLEABLE_MODULE_KEYS: readonly ModuleKey[] = MODULE_ORDER.filter(
  (k) => !REQUIRED_MODULE_KEYS.includes(k)
);

export function isRequiredModule(key: ModuleKey): boolean {
  return REQUIRED_MODULE_KEYS.includes(key);
}

/**
 * Bölümün ÜST bölümü — üst kapalıysa alt bölüm de hesaba giremez.
 *
 * Ölçüt tek bir sorudur: **bu bölümün hesabı üst bölüm olmadan koşabiliyor
 * mu?** Koşamıyorsa bağ buraya yazılır, aksi hâlde bölüm bağımsızdır ve
 * kullanıcı ikisini ayrı ayrı kapatabilir.
 *
 * - `hookBlock`/`auxHookBlock`/`mono*HookBlock` → kendi kaldırma grubu
 * - `auxTrolley`/`mono*Trolley` → taşıdığı kaldırma grubu
 * - `girder2` → `girder` (ikisi aynı köprünün iki takımıdır)
 * - `girder` ve `wheelLoads` → `bridge`. İkisi de köprü yürütmenin SONUCUNU
 *   okur (`girderDepsFor` köprü teker adedi/hızı/ivmelenmesi olmadan
 *   `undefined` döner, `wheelLoads` köprü sonucu olmadan hiç hesaplanmaz).
 *   Bağ yazılmasaydı köprüsü kapatılmış bir raporda "Ana Kiriş" bölümü
 *   numarasını harcayıp BOŞ basılırdı — müşteriye giden belgede eksik sayfa
 *   izlenimi bırakan tam da budur.
 *
 * `endCarriage` ve `buckling` BİLEREK bağsızdır: başkiriş yalnız ana kaldırma
 * yükünü ve köprü ağırlığını okur, buruşma da ana kiriş kapalıyken elle
 * girilen panel ölçüleriyle koşar. İkisini köprüye bağlamak, hesabı gerçekte
 * çalışan bir bölümü kullanıcının elinden alırdı.
 */
export const MODULE_PARENT: Partial<Record<ModuleKey, ModuleKey>> = {
  hookBlock: "main",
  auxHookBlock: "aux",
  auxTrolley: "aux",
  mono1HookBlock: "mono1",
  mono1Trolley: "mono1",
  mono2HookBlock: "mono2",
  mono2Trolley: "mono2",
  wheelLoads: "bridge",
  girder: "bridge",
  girder2: "girder",
};

/**
 * KÖPRÜ AĞIRLIĞINI okuyan bölümler — tek küme, iki okuyucu.
 *
 * Teknik özellik kutusunun görünürlüğü (`SPEC_FIELDS.bridgeWeightT`
 * `requiresAnyModule`) ve ekipman listesi özetindeki "Köprü ağırlığı" satırı
 * AYNI soruyu sorar: bu sayıyı hâlâ okuyan bir hesap var mı? İki yerde iki
 * liste yazılsaydı, biri kutuyu gizlerken öteki satırı basmaya devam ederdi.
 */
export const BRIDGE_WEIGHT_READER_KEYS: readonly ModuleKey[] = [
  "bridge",
  "wheelLoads",
  "girder",
  "girder2",
  "endCarriage",
];
