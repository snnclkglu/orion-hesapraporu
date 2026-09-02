// TAHMİN DEFTERİ — hesaptan ve katalogtan gelmeyen kalemlerin ağırlığı.
//
// Bu defter bir HESAP DEĞİLDİR ve bir kesit onaylamaz (HESAP-35). Sorulan soru
// "bu vinç FEM'e göre yeterli mi" değil, "bu parça kaç kilo gelir"dir;
// ikincisinin kaynağı ancak FİRMANIN KENDİ İMALAT GEÇMİŞİdir. Bu, AGENTS.md
// md. 1'in ("Excel'e bakarak kod yazma") istisnası değil KAPSAMI DIŞIDIR —
// gerekçenin tamamı `offers/cost/params.ts`in başındadır.
//
// HER SATIR KAYNAĞINI SÖYLER: buradan çıkan kalem ekranda `Tahmin` rozetiyle
// durur ve formülü adının yanında yazar. Bir bandın içinde tahmin varsa
// "Teknik özelliğe yaz" düğmesi bunu ayrıca bildirir.
//
// KATSAYILAR KODDA YAŞAR, revizyonda değil. MALIYET-6'nın gerekçesi
// "yayımlanmış BELGENİN sayısı değişmemeli"dir; döküm basılmaz (kullanıcı
// kararı, 01.09.2026) ve donan tek sayı zaten `inputs.specs`teki kutudur.
// Vince özel ayar bir KATSAYI ezmesiyle değil bir SATIR ezmesiyle yapılır:
// katsayı ezmesi görünmezdir (5.400'ü görürsün, nedenini göremezsin), satır
// ezmesi görünür ve notunu taşır.

import type { TechnicalSpecs } from "@/lib/calc/types";
import type { CabinInputs } from "@/lib/calc/modules/cabin";
import { CLASS_WEIGHT, FRAME_TABLE, interpolate, paramOf } from "./firma-tablolari";

/** Bir tahminin sonucu — kilo bilinmiyorsa `null` ve SEBEBİ yazılır. */
export interface TahminSonucu {
  kg: number | null;
  /** Adın yanında görünen kısa formül metni. */
  formul: string;
  /** Boşsa NEDEN boş; doluysa hangi kabul (MALIYET-13'ün cümlesi). */
  gerekce?: string;
}

/**
 * DEFTERİN KENDİ KATSAYILARI.
 *
 * Firma defterinde (`offers/cost/params.ts`) karşılığı OLMAYANLAR buradadır;
 * ortak olanlar (platform kg/m, feston kg/m, köprü elektrik, denge traversi,
 * üst makara oranı, araba platformu oranı) oradan okunur ve KOPYALANMAZ.
 *
 * Biçim `CostParamDef`in aynısıdır ki türetme açılırı katsayıyı adı ve
 * değeriyle basabilsin.
 */
export const AGIRLIK_KATSAYI_TANIMLARI: readonly {
  key: string;
  label: string;
  unit: string;
  value: number;
  hint: string;
}[] = [
  {
    key: "cabinKgPerM2",
    label: "Kabin Zarf Birim Ağırlığı",
    unit: "kg/m²",
    value: 100,
    // Firmanın kendi defteri kabini DÜZ 1.800 kg sayar (`cabinKg`). Tipik bir
    // 1,5 × 1,5 × 2,2 m kabinin zarf alanı 17,7 m²'dir; 1.800 / 17,7 ≈ 102.
    // Katsayı o sayıya OTURTULMUŞTUR — uydurulmadı, yalnız ölçüye bağlandı ki
    // büyük bir kabin küçüğüyle aynı kiloyu almasın.
    hint: "Sandviç panel + karkas + zemin + cam. Firma defterindeki 1.800 kg'lık tipik kabine oturtuldu.",
  },
  {
    key: "roomEnvelopeKgPerM2",
    label: "Elektrik Odası Zarf Birim Ağırlığı",
    unit: "kg/m²",
    value: 65,
    // Aynı yöntem: firma defteri odayı düz 6.000 kg sayar. Tipik 3 × 5 × 2,5 m
    // odanın zarfı 70 m²; panolar (6 × 300 = 1.800 kg) düşüldüğünde kalan
    // 4.200 kg → 60 kg/m² mertebesinde. Kabinden hafiftir: cam yok, paneller
    // büyük ve düz.
    hint: "Panolar HARİÇ zarf. Firma defterindeki 6.000 kg'lık tipik odaya oturtuldu.",
  },
  {
    key: "panelKgEach",
    label: "Donanımlı Pano Ağırlığı",
    unit: "kg/adet",
    value: 300,
    hint: "800 × 2000 × 600 mm mertebesinde, içi donanımlı bir pano.",
  },
  {
    key: "endCarriageOverhangFactor",
    label: "Başkiriş Konsol Payı",
    unit: "× teker çapı",
    value: 1.2,
    hint: "Başkiriş boyu = teker aralığı + 2 × (bu katsayı × teker çapı).",
  },
];

const KENDI_KATSAYILARI: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(AGIRLIK_KATSAYI_TANIMLARI.map((p) => [p.key, p.value]))
);

/**
 * Katsayının değeri — önce KENDİ defteri, sonra FİRMA defteri.
 *
 * Sıra bilinçlidir: ortak bir katsayıyı burada gölgelemek iki tanım demektir
 * ve ilk gölgeleme sessizce ayrışmanın başlangıcı olurdu.
 */
export function katsayi(key: string): number {
  const kendi = KENDI_KATSAYILARI[key];
  return kendi !== undefined ? kendi : paramOf(undefined, key);
}

// ————————————————————————————————————————————————————————— yardımcılar

function pozitif(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** 10 kg'a yuvarlar — tahmin defterinin çözünürlüğü bu. */
function on(v: number): number {
  return Math.round(v / 10) * 10;
}

/** 50 kg'a YUKARI yuvarlar (platform gibi kalemlerde firma defterinin düzeni). */
function elli(v: number): number {
  return Math.ceil(v / 50) * 50;
}

/** Mekanizma sınıfının ağırlık çarpanı; M1–M2 defterde yok, M3 gibi okunur. */
function sinifCarpani(specs: TechnicalSpecs): number {
  const sinif = specs.hoistMechanismClass;
  if (sinif === "M1" || sinif === "M2") return CLASS_WEIGHT.M3;
  return CLASS_WEIGHT[sinif] ?? 1;
}

/** Dikdörtgen prizmanın zarf alanı [m²] — altı yüz. */
function zarfAlaniM2(enM: number, boyM: number, yukM: number): number {
  return 2 * (enM * boyM + enM * yukM + boyM * yukM);
}

// ————————————————————————————————————————————————————————— köprü

export function platformTahmini(specs: TechnicalSpecs): TahminSonucu {
  const L = pozitif(specs.spanM);
  const kgPerM = katsayi("platformKgPerM");
  return {
    kg: L === null ? null : elli(L * kgPerM),
    formul: `açıklık × ${kgPerM} kg/m`,
    gerekce:
      L === null
        ? "Açıklık girilmeden platform ağırlığı türetilemez."
        : "Çift taraflı yürüme yolu + korkuluk + ızgara (firma kabulü).",
  };
}

export function kopruElektrikTahmini(specs: TechnicalSpecs): TahminSonucu {
  const Q = pozitif(specs.mainCapacityT);
  const taban = katsayi("bridgeElectricBaseKg");
  const kgPerT = katsayi("bridgeElectricKgPerT");
  return {
    kg: Q === null ? null : on(taban + Q * kgPerT),
    formul: `${taban} kg + kapasite × ${kgPerT} kg/t`,
    gerekce:
      Q === null
        ? "Kaldırma kapasitesi girilmeden elektrik tesisatı türetilemez."
        : "Pano dışı kablo, kanal ve tava (firma kabulü).",
  };
}

/**
 * Feston hattı — RAY + TAŞIYICILAR + KABLO PAKETİ.
 *
 * Katalog satırı (kablo arabası) ağırlık taşımaz: Conductix ve Vasel föyleri
 * araba kilosunu yayımlamaz. Bu kalem HATTIN TAMAMINI kapsar, o yüzden katalog
 * satırı da "kapsandı" işaretiyle eksik sayılmaz.
 *
 * Mesafe eksene göre değişir (`travelFestoonDistanceM` ile aynı kural): arabada
 * açıklık, köprüde yürüme yolu uzunluğu.
 */
export function festonTahmini(
  mesafeM: number | null | undefined,
  kabloPaketiKg: number | null | undefined
): TahminSonucu {
  const L = pozitif(mesafeM);
  const paket = pozitif(kabloPaketiKg) ?? 0;
  const kgPerM = katsayi("festoonKgPerM");
  return {
    kg: L === null ? null : on(L * kgPerM + paket),
    formul: `mesafe × ${kgPerM} kg/m${paket > 0 ? " + kablo paketi" : ""}`,
    gerekce:
      L === null
        ? "Hareket mesafesi (açıklık ya da yürüme yolu) girilmemiş."
        : paket > 0
          ? "Ray ve taşıyıcılar firma kabulü; kablo paketi 5.9 girdisinden."
          : "Ray, taşıyıcılar ve kablo (firma kabulü). Kablo paketi 5.9'da boş.",
  };
}

/**
 * KÖŞE YÜKÜ [t] — bir köşedeki tekerlere binen toplam ağırlık.
 *
 * Başkirişin/bojinin ve portal ayağının kilosu firma defterinde köşe yüküne
 * bağlıdır: taşınan yük büyüdükçe kesit büyür. Formül firma defterinin kendi
 * düzenidir (`cornerSelfWeightFactor` payı, dörde bölüm) — maliyet MODELİ
 * okunmaz (MALIYET-3), yalnız KATSAYI paylaşılır.
 *
 * `yapiKg` KENDİSİNİ İÇERMEZ: başkiriş de ayak da köşe yükünden türetildiği
 * için, girdiye kendi kilolarını katmak döngü olurdu. Çağıran, köprünün
 * TAŞINAN kısmını (kirişler, platform, elektrik, kabin, oda) ve araba(lar)ı
 * verir.
 */
export function koseYukuTahmini(
  specs: TechnicalSpecs,
  yapiKg: number | null,
  arabaKg: number | null
): { koseYukuT: number | null; formul: string; gerekce: string } {
  const Q = pozitif(specs.mainCapacityT);
  const pay = katsayi("cornerSelfWeightFactor");
  const formul = `${pay} × (köprü yapısı + arabalar + kapasite) / 4`;
  if (yapiKg === null || Q === null) {
    return {
      koseYukuT: null,
      formul,
      gerekce: "Köşe yükü için köprü yapı ağırlığı ve kaldırma kapasitesi gerekir.",
    };
  }
  const toplamKg = yapiKg + (arabaKg ?? 0) + Q * 1000;
  return {
    koseYukuT: (pay * toplamKg) / 4 / 1000,
    formul,
    gerekce:
      arabaKg === null
        ? "Araba ağırlığı dökümden çıkmadığı için köşe yükü YALNIZ yapı ve yükle kuruldu."
        : "Firma defterinin köşe yükü düzeni.",
  };
}

/**
 * BAŞKİRİŞ / BOJİ — bölüm KAPALIYKEN köşe yükünden.
 *
 * Bölüm açıkken ağırlık kesitin kendi metre ağırlığından gelir (`topla.ts`) ve
 * bu fonksiyon çağrılmaz. Kapalıyken satırın hiç çıkmaması, `bridgeWeightT`
 * ipucunun sözünü ("Ana kirişler ve başkirişler dâhil") tutamayan bir bant
 * toplamı üretiyordu — yeni işler başkiriş bölümü KAPALI açılır.
 */
export function baskirisTahmini(koseYukuT: number | null, adet: number): TahminSonucu {
  const kgPerT = katsayi("endCarriageKgPerT");
  const formul = `köşe yükü × ${kgPerT} kg/t × ${adet} adet`;
  if (koseYukuT === null) {
    return {
      kg: null,
      formul,
      gerekce:
        "«09 · Başkiriş» bölümü kapalı ve köşe yükü türetilemedi; bölümü açın " +
        "ya da ağırlığı elle girin.",
    };
  }
  return {
    kg: on(koseYukuT * kgPerT * adet),
    formul,
    gerekce:
      "«09 · Başkiriş» bölümü kapalı; kesit yerine firma defterinin köşe yükü " +
      "katsayısı kullanıldı. Bölüm açılırsa ağırlık HESAPTAN gelir.",
  };
}

// ————————————————————————————————————————————————————————— portal

/**
 * PORTAL AYAKLARI — birim ağırlık köşe yüküyle büyür.
 *
 * `ayakSayisi` künyeden gelir (`gantryLegCount`): portalde dört, yarı portalde
 * iki. Ayak yüksekliği hiçbir hesap bölümünde sorulmuyor; döküm penceresinden
 * elle girilir (`AgirlikDokumuDurumu.ayakYuksekligiM`) ve girilmediğinde satır
 * `null` + gerekçeyle durur — uydurma bir yükseklik, dürüst bir boşluktan
 * kötüdür (değişmez md. 4).
 */
export function ayakTahmini(
  koseYukuT: number | null,
  yukseklikM: number | null | undefined,
  ayakSayisi: number
): TahminSonucu {
  const taban = katsayi("legBaseKgPerM");
  const yukKats = katsayi("legLoadKgPerMPerT");
  const H = pozitif(yukseklikM);
  const formul = `${ayakSayisi} × yükseklik × (${taban} + ${yukKats} × köşe yükü) kg/m`;
  if (koseYukuT === null) {
    return { kg: null, formul, gerekce: "Köşe yükü türetilemeden ayak kesiti bilinmez." };
  }
  if (H === null) {
    return {
      kg: null,
      formul,
      gerekce:
        "Ayak yüksekliği girilmedi — pencerenin «Ayaklar ve Portal Yapısı» " +
        "başlığındaki kutuya yazın (hesap bölümlerinde sorulmuyor).",
    };
  }
  return {
    kg: on(ayakSayisi * H * (taban + yukKats * koseYukuT)),
    formul,
    gerekce: "Firma defterinin portal ayak birim ağırlığı.",
  };
}

/**
 * ÜST UÇ BAĞLANTI — portalde ana kirişi ayağa bağlayan parça.
 *
 * Gezer köprülü vinçte bu işi başkiriş görür; portalde ayrı bir imalattır ve
 * başkiriş (boji) ayağın ALTINDA, rayın üstünde kalır. İkisi ayrı satırlardır
 * ve ikisi de sayılır.
 */
export function ustUcBaglantiTahmini(koseYukuT: number | null): TahminSonucu {
  const kgPerT = katsayi("topEndKgPerT");
  const formul = `köşe yükü × ${kgPerT} kg/t`;
  return {
    kg: koseYukuT === null ? null : on(koseYukuT * kgPerT),
    formul,
    gerekce:
      koseYukuT === null
        ? "Köşe yükü türetilemedi."
        : "Portalde ana kirişi ayağa bağlayan parça (firma kabulü).",
  };
}

/** Portal çaprazları — ana kiriş ve ayakların toplamına oranla. */
export function portalTakviyeTahmini(
  anaKirisKg: number | null,
  ayaklarKg: number | null
): TahminSonucu {
  const oran = katsayi("gantryBracingRatio");
  const formul = `(ana kiriş + ayaklar) × ${oran}`;
  if (anaKirisKg === null) {
    return { kg: null, formul, gerekce: "Ana kiriş ağırlığı bilinmeden takviye türetilemez." };
  }
  return {
    kg: on((anaKirisKg + (ayaklarKg ?? 0)) * oran),
    formul,
    gerekce:
      ayaklarKg === null
        ? "Ayak ağırlığı bilinmediği için takviye YALNIZ ana kirişten kuruldu."
        : "Çapraz bağlantılar ve alın sacları (firma kabulü).",
  };
}

/** Ayak merdiveni ve sahanlıkları — her ayak ÇİFTİNE bir merdiven. */
export function ayakMerdiveniTahmini(
  yukseklikM: number | null | undefined,
  ayakSayisi: number
): TahminSonucu {
  const kgPerM = katsayi("legLadderKgPerM");
  const adet = Math.max(1, Math.round(ayakSayisi / 2));
  const H = pozitif(yukseklikM);
  const formul = `yükseklik × ${kgPerM} kg/m × ${adet} merdiven`;
  return {
    kg: H === null ? null : on(H * kgPerM * adet),
    formul,
    gerekce:
      H === null
        ? "Ayak yüksekliği girilmedi."
        : "Kafesli merdiven ve sahanlık (firma kabulü).",
  };
}

export function kabinTahmini(cabin: CabinInputs | undefined): TahminSonucu {
  const kgPerM2 = katsayi("cabinKgPerM2");
  const en = pozitif(cabin?.cabinWidthM);
  const boy = pozitif(cabin?.cabinLengthM);
  const yuk = pozitif(cabin?.cabinHeightM);
  if (en === null || boy === null || yuk === null) {
    return {
      kg: null,
      formul: `zarf alanı × ${kgPerM2} kg/m²`,
      gerekce: "Kabin ölçüleri 11.1 bölümünde girilmeden ağırlık türetilemez.",
    };
  }
  return {
    kg: on(zarfAlaniM2(en, boy, yuk) * kgPerM2),
    formul: `zarf alanı × ${kgPerM2} kg/m²`,
    gerekce:
      "Sandviç panel, karkas, zemin ve cam (firma kabulü). Kabinin KENDİ " +
      "yürütme mekanizması dâhil DEĞİLDİR; varsa elle eklenir.",
  };
}

export function odaTahmini(cabin: CabinInputs | undefined): TahminSonucu {
  const kgPerM2 = katsayi("roomEnvelopeKgPerM2");
  const en = pozitif(cabin?.roomWidthM);
  const boy = pozitif(cabin?.roomLengthM);
  const yuk = pozitif(cabin?.roomHeightM);
  if (en === null || boy === null || yuk === null) {
    return {
      kg: null,
      formul: `zarf alanı × ${kgPerM2} kg/m²`,
      gerekce: "Oda ölçüleri 11.2 bölümünde girilmeden ağırlık türetilemez.",
    };
  }
  return {
    kg: on(zarfAlaniM2(en, boy, yuk) * kgPerM2),
    formul: `zarf alanı × ${kgPerM2} kg/m²`,
    gerekce: "Panolar HARİÇ zarf: panel, karkas, zemin ve kapı (firma kabulü).",
  };
}

export function panoTahmini(adet: number | null): TahminSonucu {
  const kgEach = katsayi("panelKgEach");
  const n = pozitif(adet);
  return {
    kg: n === null ? null : on(n * kgEach),
    formul: `pano adedi × ${kgEach} kg`,
    gerekce:
      n === null
        ? "Pano adedi girilmemiş."
        : "İçi donanımlı pano (firma kabulü); gerçek ağırlık panoya göre değişir.",
  };
}

// ————————————————————————————————————————————————————————— araba

/**
 * Araba şasisi — kapasite tablosundan, kaldırma yüksekliği payıyla.
 *
 * Firma defterinin düzeni aynen izlenir: 10 m'lik taban ağırlık + her 10 m
 * fazlalık için ek + yardımcı kaldırma varsa oransal ek, hepsi sınıf
 * çarpanıyla.
 */
export function sasiTahmini(specs: TechnicalSpecs): TahminSonucu {
  const Q = pozitif(specs.mainCapacityT);
  const H = pozitif(specs.mainLiftHeightM);
  const formul = "kapasite tablosu + yükseklik payı, × sınıf";
  if (Q === null || H === null) {
    return { kg: null, formul, gerekce: "Kapasite ve kaldırma yüksekliği gerekir." };
  }
  const taban = interpolate(FRAME_TABLE, Q, (r) => r.capT, (r) => r.kg10);
  const ek = interpolate(FRAME_TABLE, Q, (r) => r.capT, (r) => r.addPer10m);
  if (taban === null || ek === null) {
    return { kg: null, formul, gerekce: "Kapasite firma tablosunun dışında." };
  }
  const yardimci = pozitif(specs.auxCapacityT) !== null ? katsayi("auxFrameRatio") * taban : 0;
  return {
    kg: on((taban + (Math.max(0, H - 10) / 10) * ek + yardimci) * sinifCarpani(specs)),
    formul,
    gerekce: "Firma imalat geçmişinden şasi tablosu.",
  };
}

/**
 * Üst makara bloğu — YALNIZ EŞİĞİN ÜSTÜNDEKİ kapasitelerde vardır.
 *
 * Eşiğin altında blok YOKTUR; kalem `0` değil HİÇ ÇIKMAZ (çağıran `null`
 * gördüğünde satırı açmaz) — "0 kg'lık bir üst makara bloğu" diye bir şey yok.
 */
export function ustMakaraTahmini(
  specs: TechnicalSpecs,
  kancaBloguKg: number | null
): TahminSonucu | null {
  const Q = pozitif(specs.mainCapacityT);
  const esik = katsayi("topSheaveThresholdT");
  if (Q === null || Q < esik) return null;
  const oran = katsayi("topSheaveRatio");
  return {
    kg: kancaBloguKg === null ? null : on(kancaBloguKg * oran),
    formul: `kanca bloğu × ${oran}`,
    gerekce:
      kancaBloguKg === null
        ? "Kanca bloğu ağırlığı bilinmeden üst makara bloğu türetilemez."
        : `${esik} t üstü kapasitelerde bulunur (firma kabulü).`,
  };
}

export function arabaPlatformuTahmini(sasiKg: number | null): TahminSonucu {
  const oran = katsayi("trolleyPlatformRatio");
  return {
    kg: sasiKg === null ? null : on(sasiKg * oran),
    formul: `şasi × ${oran}`,
    gerekce:
      sasiKg === null
        ? "Şasi ağırlığı bilinmeden araba platformu türetilemez."
        : "Platform ve korkuluk, şasiye oranla (firma kabulü).",
  };
}

/**
 * BAŞKİRİŞ BOYU — motora girdi olarak EKLENMEZ, burada türetilir.
 *
 * `EndCarriageInputs`e bir `lengthMm` koymak her eski revizyona şablon
 * varsayılanını sessizce verirdi ve hiçbir kontrolün okumadığı bir sayı
 * yapısal bir girdi gibi görünürdü. Gerçek, çizilmiş bir boy istenirse o kendi
 * şemasıyla ayrı bir karardır.
 *
 * `L = teker aralığı + 2 × (katsayı × teker çapı)`
 */
export interface BoyTahmini {
  boyM: number | null;
  formul: string;
  gerekce: string;
}

export function baskirisBoyuTahmini(
  tekerAraligiMm: number | null | undefined,
  tekerCapiMm: number | null | undefined
): BoyTahmini {
  const a = pozitif(tekerAraligiMm);
  const d = pozitif(tekerCapiMm);
  const k = katsayi("endCarriageOverhangFactor");
  const formul = `teker aralığı + 2 × ${k} × teker çapı`;
  if (a === null || d === null) {
    return {
      boyM: null,
      formul,
      gerekce:
        "Başkiriş boyu için teker aralığı (9.x) ve köprü teker çapı (5.1) gerekir.",
    };
  }
  return {
    boyM: (a + 2 * k * d) / 1000,
    formul,
    gerekce: "Konsol payı firma kabulüdür; gerçek boy resimden elle girilebilir.",
  };
}
