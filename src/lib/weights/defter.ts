// AĞIRLIK DÖKÜMÜNÜN DEFTERİ — bant → grup → kalem taksonomisi.
//
// Sıra KULLANICININ KENDİ ÇİZELGESİNİN sırasıdır (14 sütunlu eski Excel):
// köprüde yürütme grubu · anakiriş · başkiriş · platform · feston · elektrik;
// arabada yürütme grubu · şasi · tambur · tahrik grubu · kanca bloğu · denge
// traversi · üst makara bloğu · araba platformu. Alfabetik ya da modül sırası
// değil, MÜHENDİSİN OKUMA SIRASI: dıştan içe, taşıyandan taşınana.
//
// KABİN VE ELEKTRİK ODASI KÖPRÜ BANDININ İÇİNDEDİR, ayrı bant değildir.
// Köprünün üzerinde dururlar; `bridgeWeightT`e yazılan sayı onları İÇERMEK
// ZORUNDADIR, çünkü ana kirişin ölü yükü ve teker yükleri onları taşır. Ayrı
// bir bant, teknik özelliğe eksik bir toplam yazdırırdı.

import {
  HOIST_OF_HOOKBLOCK,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type HoistKey,
  type ModuleKey,
  type TravelKey,
} from "@/lib/calc/presentation/module-family";
import { hasSeparateAuxTrolley, type TechnicalSpecs } from "@/lib/calc/types";

export interface AgirlikGrupTanimi {
  key: string;
  label: string;
}

/** KÖPRÜ bandının grupları. */
export const KOPRU_GRUPLARI: readonly AgirlikGrupTanimi[] = [
  { key: "bridgeTravel", label: "Köprü Yürütme Grubu" },
  { key: "girder", label: "Ana Kiriş" },
  { key: "endCarriage", label: "Başkiriş" },
  { key: "platform", label: "Platform ve Korkuluk" },
  { key: "festoon", label: "Feston Hattı" },
  { key: "electric", label: "Köprü Elektrik Tesisatı" },
  { key: "cabin", label: "Operatör Kabini" },
  { key: "electricalRoom", label: "Elektrik Odası ve Panolar" },
];

/** Bir ARABA bandının grupları — her araba kendi bandını kurar. */
export const ARABA_GRUPLARI: readonly AgirlikGrupTanimi[] = [
  { key: "travel", label: "Araba Yürütme Grubu" },
  { key: "frame", label: "Şasi" },
  { key: "drum", label: "Tambur" },
  { key: "hoistDrive", label: "Tahrik Grubu" },
  { key: "rope", label: "Halat" },
  { key: "hookBlock", label: "Kanca Bloğu" },
  { key: "balance", label: "Denge Traversi / Makarası" },
  { key: "topSheave", label: "Üst Makara Bloğu" },
  { key: "platform", label: "Araba Platformu" },
  { key: "festoon", label: "Feston Hattı" },
];

/**
 * EKİPMAN SATIRI SLUG'I → GRUP.
 *
 * Anahtar `rowSlug`tur: gizleme süzgeci, notlar, ekler ve ağırlık hep aynı slug
 * uzayını kullanır. Defterde karşılığı olmayan bir slug SESSİZCE DÜŞMEZ — iki
 * yönlü koruma testi (`dokum.guard.test.ts`) hem ekipman listesinin ürettiği
 * her slug'ın bir grubu olduğunu, hem defterdeki her slug'ın gerçekten
 * üretildiğini ölçer. Yeni bir ekipman satırı eklendiğinde test kırılır.
 */
const YURUTME_SLUG_GRUBU: Readonly<Record<string, string>> = {
  wheel: "travel",
  wheelBearing: "travel",
  motor: "travel",
  gearbox: "travel",
  brake: "travel",
  motorCoupling: "travel",
  wheelCoupling: "travel",
  buffer: "travel",
  festoon: "festoon",
};

const KALDIRMA_SLUG_GRUBU: Readonly<Record<string, string>> = {
  rope: "rope",
  ropeLeft: "rope",
  drum: "drum",
  drumBearing: "drum",
  drumBearingHousing: "drum",
  motor: "hoistDrive",
  gearbox: "hoistDrive",
  brake: "hoistDrive",
  motorCoupling: "hoistDrive",
  drumCoupling: "hoistDrive",
  safetyBrake: "hoistDrive",
  balanceSocket: "balance",
  balanceSheave: "balance",
  balanceLoadcell: "balance",
  balanceBearing: "balance",
};

const KANCA_SLUG_GRUBU: Readonly<Record<string, string>> = {
  hook: "hookBlock",
  sheave: "hookBlock",
  sheaveBearing: "hookBlock",
  hookBearing: "hookBlock",
  shaft: "hookBlock",
  liftingBeam: "hookBlock",
};

const MAHAL_SLUG_GRUBU: Readonly<Record<string, string>> = {
  "operator-cabin": "cabin",
  cabinAc: "cabin",
  "electrical-room": "electricalRoom",
  roomAc: "electricalRoom",
  "electrical-panel": "electricalRoom",
  panelAc: "electricalRoom",
};

/** Koruma testinin okuduğu tek kaynak — aile başına slug defteri. */
export const SLUG_GRUP_DEFTERI = {
  yurutme: YURUTME_SLUG_GRUBU,
  kaldirma: KALDIRMA_SLUG_GRUBU,
  kanca: KANCA_SLUG_GRUBU,
  mahal: MAHAL_SLUG_GRUBU,
} as const;

/**
 * Bir ekipman satırının grubu.
 *
 * Köprü yürütmesi ARABA yürütmesiyle aynı slug'ları taşır ama KÖPRÜ bandının
 * kendi grup anahtarına düşer (`bridgeTravel`): iki bant aynı grup anahtarını
 * paylaşsaydı, tek bir grup anahtarına bakan her kod yanlış bandı seçerdi
 * (MALIYET-17'nin ölçtüğü tekillik tuzağı).
 */
export function kalemGrubu(moduleKey: ModuleKey, slug: string): string | undefined {
  if (moduleKey === "bridge") {
    const grup = YURUTME_SLUG_GRUBU[slug];
    return grup === "travel" ? "bridgeTravel" : grup;
  }
  if (isTravelKey(moduleKey)) return YURUTME_SLUG_GRUBU[slug];
  if (isHoistKey(moduleKey)) return KALDIRMA_SLUG_GRUBU[slug];
  if (isHookBlockKey(moduleKey)) return KANCA_SLUG_GRUBU[slug];
  if (moduleKey === "cabin") return MAHAL_SLUG_GRUBU[slug];
  return undefined;
}

/**
 * KALDIRMA GRUBU HANGİ ARABAYA BİNER.
 *
 * `HOIST_OF_TRAVEL` (engine.ts) bunun TERSİDİR ve `bridge → main` der — köprü
 * yürütme motorunu hangi kaldırmanın yüküyle boyutlandıracağını söyler. Burada
 * sorulan başka bir sorudur: bu tamburun kilosu hangi arabanın toplamına girer.
 *
 * Yardımcı kaldırma paylaşımlı düzende (`auxTrolleyMode !== "separate"`) ANA
 * arabanın üzerindedir; ayrı arabası varsa kendi bandına gider.
 */
export function hoistTrolleyKey(specs: TechnicalSpecs, hoist: HoistKey): TravelKey {
  if (hoist === "main") return "trolley";
  if (hoist === "aux") return hasSeparateAuxTrolley(specs) ? "auxTrolley" : "trolley";
  if (hoist === "mono1") return "mono1Trolley";
  return "mono2Trolley";
}

/** KÖPRÜ bandına giren modüller — yapı ve mahaller köprünün üzerindedir. */
const KOPRU_MODULLERI: readonly ModuleKey[] = [
  "bridge",
  "girder",
  "girder2",
  "endCarriage",
  "cabin",
];

/**
 * Bir modülün satırları hangi banda girer.
 *
 * `undefined` dönen modül dökümde YER ALMAZ (buruşma ve teker yükleri birer
 * kontrol bölümüdür, vincin üzerinde bir parçaları yoktur).
 */
export function kalemBandi(specs: TechnicalSpecs, moduleKey: ModuleKey): string | undefined {
  if (KOPRU_MODULLERI.includes(moduleKey)) return "bridge";
  if (isTravelKey(moduleKey)) return moduleKey;
  if (isHoistKey(moduleKey)) return hoistTrolleyKey(specs, moduleKey);
  if (isHookBlockKey(moduleKey)) {
    return hoistTrolleyKey(specs, HOIST_OF_HOOKBLOCK[moduleKey]);
  }
  return undefined;
}

/**
 * TEKNİK ÖZELLİK KUTUSU → BANT.
 *
 * Beş ağırlık kutusunun beşi de AYNI pencereyi açar (kullanıcı kararı,
 * 01.09.2026); basılan kutu yalnız hangi bandın öne geleceğini söyler. Eşleme
 * `topla.ts`teki bant → kutu haritasının tersidir ve ikisi de tek yerde durur.
 */
export const AGIRLIK_BANT_ANAHTARI: Readonly<Record<string, string>> = {
  bridgeWeightT: "bridge",
  mainTrolleyWeightT: "trolley",
  auxTrolleyWeightT: "auxTrolley",
  mono1TrolleyWeightT: "mono1Trolley",
  mono2TrolleyWeightT: "mono2Trolley",
};

/** Bandın grup listesi — köprü ve araba ayrı defterlerden okur. */
export function bandinGruplari(bandKey: string): readonly AgirlikGrupTanimi[] {
  return bandKey === "bridge" ? KOPRU_GRUPLARI : ARABA_GRUPLARI;
}
