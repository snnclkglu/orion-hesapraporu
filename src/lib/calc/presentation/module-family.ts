// Modül anahtarı ↔ sunum ailesi.
//
// Ana/yardımcı kaldırma aynı sunum tanımlarını (hoistSections) paylaşır; araba
// ve köprü yürütme de öyle (travelSections). Sunum tarafındaki haritalar
// (kontrol bağlantıları, standart bağlamı) modül başına değil AİLE başına
// tanımlanır. Bu dosya, motor/UI katmanlarına bağımlı olmayan ortak eşlemedir.

export type ModuleKey =
  | "main"
  | "aux"
  | "hookBlock"
  | "trolley"
  | "bridge"
  | "girder"
  | "buckling"
  | "endCarriage";

export type ModuleFamily =
  | "hoist"
  | "hookBlock"
  | "travel"
  | "girder"
  | "buckling"
  | "endCarriage";

const FAMILY: Record<ModuleKey, ModuleFamily> = {
  main: "hoist",
  aux: "hoist",
  hookBlock: "hookBlock",
  trolley: "travel",
  bridge: "travel",
  girder: "girder",
  buckling: "buckling",
  endCarriage: "endCarriage",
};

export function moduleFamily(key: ModuleKey): ModuleFamily {
  return FAMILY[key];
}
