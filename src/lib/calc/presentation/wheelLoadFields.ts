// Teker yükleri bölümünün form alanı metadata'sı — UI formları bu tanımlardan
// üretilir. key'ler WheelLoadInputs / WheelLoadSelections alan adlarıyla
// birebir aynıdır.
//
// Bu bölümün girdileri BİLEREK azdır: ağırlıklar, hızlar, ivme, teker adedi,
// tahrikli teker sayısı, ray ve tampon verileri teknik özelliklerden ve köprü
// yürütme bölümünden otomatik gelir. Burada yalnız yol kirişi geometrisine ve
// kılavuzlamaya ait, başka hiçbir yerde sorulmayan büyüklükler istenir.

import type { FieldDef } from "../fields";
import type { WheelLoadInputs, WheelLoadSelections } from "../modules/wheelLoads";

export const HOISTING_CLASS_OPTIONS = ["HC1", "HC2", "HC3", "HC4"] as const;

// Seçenek etiketleri KISA tutulur: uzun etiket dropdown'ı ızgara sütununun
// dışına taşırıyor ve komşu alanın üstüne biniyordu. Ayrıntı `hint` metnindedir.
export const HOISTING_CLASS_LABELS: Record<string, string> = {
  HC1: "HC1 — Hassas",
  HC2: "HC2 — Normal",
  HC3: "HC3 — Sert",
  HC4: "HC4 — Çok sert",
};

export const HOIST_DRIVE_CLASS_OPTIONS = ["HD1", "HD2", "HD3", "HD4", "HD5"] as const;

export const HOIST_DRIVE_CLASS_LABELS: Record<string, string> = {
  HD1: "HD1 — Sürünme yok",
  HD2: "HD2 — Operatör seçer",
  HD3: "HD3 — Zorunlu sürünme",
  HD4: "HD4 — Kademesiz",
  HD5: "HD5 — Ön germeli",
};

export const WHEEL_PAIR_MODE_OPTIONS = ["CFF", "IFF", "CFM", "IFM"] as const;

export const WHEEL_PAIR_MODE_LABELS: Record<string, string> = {
  CFF: "CFF — Bağlı · F/F",
  IFF: "IFF — Bağımsız · F/F",
  CFM: "CFM — Bağlı · F/M",
  IFM: "IFM — Bağımsız · F/M",
};

export const GUIDE_MEANS_OPTIONS = ["flange", "roller"] as const;

export const GUIDE_MEANS_LABELS: Record<string, string> = {
  flange: "Teker Flanşı",
  roller: "Kılavuz Teker",
};

/** Otomatik doldurulan 6.2 girdi alanları: değer → girdilerdeki anahtar. */
export const WHEELLOAD_AUTO_FIELDS: Record<string, keyof WheelLoadInputs & string> = {
  guideSpacingMm: "guideSpacingAuto",
  guideClearanceMm: "guideClearanceAuto",
  coupledPairCount: "coupledPairAuto",
  creepSpeedMpm: "creepSpeedAuto",
};

/** Otomatik 6.2 seçim alanları; anahtar yine girdi nesnesinde tutulur. */
export const WHEELLOAD_AUTO_SELECTION_FIELDS: Record<
  string,
  keyof WheelLoadInputs & string
> = {
  hoistingClass: "hoistingClassAuto",
};

export const WHEELLOAD_INPUT_FIELDS: FieldDef<WheelLoadInputs>[] = [
  // `wheelSpacingsText` görsel teker düzeni düzenleyicisinden yazılır
  // (bkz. WheelSpacingEditor); burada ayrıca bir metin kutusu gösterilmez.
  {
    key: "guideSpacingMm",
    label: "Araba Ekseni",
    unit: "mm",
    type: "number",
    hint:
      "Vincin bir ray üzerindeki öndeki ve arkadaki yanal kılavuz noktaları " +
      "arasındaki boyuna mesafedir. Teker flanşı kılavuzsa ilk ve son kılavuz " +
      "teker ekseni arası; ayrı kılavuz teker varsa ön ve arka kılavuz teker " +
      "merkezleri arası ölçülür. Otomatikte teker düzeninin ilk–son eksen " +
      "mesafesi kullanılır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.5: wb, kılavuz " +
      "elemanları arasındaki yürüyüş yönü mesafesidir; raylar arası açıklık " +
      "değildir. αg = sg/wb ve αw = 0,1·b/wb bağıntılarının paydasına girer.\n\n" +
      "Kod kullanımı — Otomatik açıkken bir raydaki ilk ve son teker ekseni " +
      "arasındaki toplam ölçü alınır. Ayrı kılavuz tekerleri bu eksenlerle " +
      "çakışmıyorsa otomatik kapatılıp kılavuz teker merkezleri arası gerçek wb girilir.",
    standardRef: "FEM 1.001 9.4.1.5",
  },
  {
    key: "guideClearanceMm",
    label: "Kılavuz Boşluğu (Tek Taraf)",
    unit: "mm",
    type: "number",
    hint: "Köprü teker çapından otomatik gelir; değer flanş ile ray başı arasındaki tek taraf boşluktur.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.5 toplam kılavuz " +
      "boşluğunu sg ile tanımlar ve αg = sg/wb kullanır.\n\n" +
      "Kod kullanımı — Otomatikte köprü teker çapına göre 0–200: 5; 250–315: " +
      "7,5; 400–630: 10; 710–800: 12,5; 900 mm ve üzeri: 15 mm alınır. " +
      "Bu kutu ölçüm kolaylığı için TEK TARAF boşluğunu ister; " +
      "hesap sg = 2 × kutu değeri yapar. Bu nedenle teknik resimdeki toplam " +
      "flanş–ray boşluğu doğrudan bu kutuya yazılmaz.",
  },
  {
    key: "coupledPairCount",
    label: "Bağlı Teker Çifti Adedi p",
    type: "number",
    hint: "Karşılıklı teker çiftlerinden mekanik mil veya gerçek elektriksel senkronizasyonla bağlı olanların adedidir; varsayılan 0'dır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.3'te p, iki ray " +
      "tarafı mekanik mil veya elektriksel senkronizasyonla bağlı teker " +
      "çiftlerinin adedidir ve kayma kutbu hesabına girer.\n\n" +
      "Teker çifti, vincin enine doğrultusunda karşılıklı duran iki tekerdir. " +
      "Örneğin iki rayda dörder teker varsa çiftler A1–B1, A2–B2, A3–B3 ve " +
      "A4–B4'tür; n = 4 teker çifti, p ise bunlardan bağlı olanların adedidir. " +
      "Hiçbiri bağlı değilse p = 0, ikisi bağlıysa p = 2, tamamı bağlıysa p = 4 alınır.\n\n" +
      "Bağlılık, karşılıklı tekerlerin ortak transmisyon miliyle veya gerçek " +
      "elektriksel senkronizasyonla ilişkilendirilmesidir. Aynı şaseye bağlı " +
      "olmaları, aynı raydaki iki tekerin bağlantısı ya da motorların yalnız " +
      "aynı hız komutunu alması FEM anlamında bağlı çift oluşturmaz. Bağımsız " +
      "tekil tahriklerde genel kabul p = 0'dır; IFF/IFM düzende hesap p'yi " +
      "tanım gereği sıfıra zorlar.",
    standardRef: "FEM 1.001 9.4.1.3",
  },
  {
    key: "creepSpeedMpm",
    label: "Kaldırma Sürünme Hızı",
    unit: "m/dak",
    type: "number",
    hint: "Otomatikte ana kaldırma hızının %10'udur; HD2 ve HD3'te φ2 bu hızla hesaplanır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 Tablo T.9.3.b, Yükleme " +
      "Durumu I/II için HD2 ve HD3 sınıflarında kaldırma dinamik katsayısına " +
      "girecek hızın sürünme hızı olduğunu belirtir.\n\n" +
      "Kod kullanımı — Otomatik açıkken ana kaldırma hızının %10'u alınır. " +
      "Değer m/dak girilir, m/s'ye çevrilir ve " +
      "φ2 = φ2,min + β2·vh bağıntısında kullanılır. HD1 azami hızı, HD4 azami " +
      "hızın yarısını, HD5 sıfırı kullandığı için bu kutu o sınıflarda sonucu değiştirmez.",
    standardRef: "FEM 1.001 T.9.3.b",
  },
];

export const WHEELLOAD_SELECTION_FIELDS: FieldDef<WheelLoadSelections>[] = [
  {
    key: "hoistingClass",
    label: "Kaldırma Sınıfı (HC)",
    type: "select",
    options: HOISTING_CLASS_OPTIONS,
    optionLabels: HOISTING_CLASS_LABELS,
    standardRef: "FEM 1.001 T.9.3.a",
    hint: "HC1 hassas · HC2 genel amaçlı kancalı vinç · HC3 kepçe/mıknatıs · HC4 ağır hizmet. Sınıf sertleştikçe φ2 büyür.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 Tablo T.9.3.a, HC1…HC4 " +
      "için β2 ve φ2,min çiftlerini verir. Sınıf, yükün yerden alınışındaki " +
      "dinamik davranışı temsil eder.\n\n" +
      "Kod kullanımı — Otomatikte ana kaldırma mekanizma sınıfı M1–M5 için " +
      "HC1, M6 için HC2, M7 için HC3 ve M8 için HC4 alınır. Seçilen tablodan " +
      "β2 ve φ2,min okunur; tasarım teker " +
      "yükünde yalnız kaldırılan yük φ2 ile büyütülür, araba ve köprü öz " +
      "ağırlıkları büyütülmez.",
  },
  {
    key: "hoistDriveClass",
    label: "Kaldırma Tahrik Sınıfı (HD)",
    type: "select",
    options: HOIST_DRIVE_CLASS_OPTIONS,
    optionLabels: HOIST_DRIVE_CLASS_LABELS,
    standardRef: "FEM 1.001 T.9.3.b",
    hint: "HD1 sürünme hızı yok · HD2 operatör seçer · HD3 yük yerden kalkana kadar sürünme zorunlu · HD4 kademesiz, operatör kumandalı · HD5 ön germeli otomatik.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 Tablo T.9.3.b, φ2 hesabında " +
      "hangi kaldırma hızının kullanılacağını tahrik/kumanda biçimine göre " +
      "HD1…HD5 olarak sınıflandırır.\n\n" +
      "Kod kullanımı — HD1: azami hız; HD2/HD3: bu bölümdeki sürünme hızı; " +
      "HD4: azami hızın yarısı; HD5: sıfır hız alınır. Bu seçim motor sınıfı " +
      "değil, dinamik katsayı için işletme davranışıdır.",
  },
  {
    key: "guideMeans",
    label: "Yanal Kılavuzlama",
    type: "select",
    options: GUIDE_MEANS_OPTIONS,
    optionLabels: GUIDE_MEANS_LABELS,
    hint: "Teker flanşıyla kılavuzlamada kılavuz elemanlar arası mesafe dingil mesafesine eşittir.",
    info:
      "Standart/kod ayrımı — FEM 1.001 md. 9.4.1.5, teker flanşıyla " +
      "kılavuzlamada wb'nin kılavuz tekerlerin dingil mesafesine eşit olduğunu " +
      "belirtir. Ayrı kılavuz teker seçimi fiziksel düzeni rapora taşır.\n\n" +
      "Kod kullanımı — Bu seçim tek başına sayısal wb'yi değiştirmez. Kılavuz " +
      "teker merkezleri ilk/son teker ekseninden farklıysa wb otomatiği kapatılıp " +
      "gerçek kılavuz teker merkezleri arası mesafe girilmelidir.",
  },
  {
    key: "wheelPairMode",
    label: "Teker Çifti Düzeni",
    type: "select",
    options: WHEEL_PAIR_MODE_OPTIONS,
    optionLabels: WHEEL_PAIR_MODE_LABELS,
    standardRef: "FEM 1.001 T.9.4",
    hint: "C: iki rayın tekerleri bağlı (mil ya da elektriksel senkron) · I: bağımsız. F/F iki taraf yanal sabit · F/M bir taraf yanal hareketli (mafsallı ayak).",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 Tablo T.9.4: C bağlı, I " +
      "bağımsız teker çiftini; F yanal sabit, M yanal hareketli ray tarafını " +
      "gösterir. Tablo ξ ve ν teker kuvveti katsayılarını bu dört düzene göre verir.\n\n" +
      "C (Coupled): karşılıklı tekerler mekanik mil veya elektronik " +
      "senkronizasyonla bağlıdır. I (Independent): karşılıklı tekerler bağımsız " +
      "çalışır. F/F iki ray tarafının da enine sabit, F/M bir tarafın sabit ve " +
      "diğer tarafın mafsallı/enine hareketli olduğunu gösterir.\n\n" +
      "CFF: bağlı ve iki taraf rijit; uzun transmisyon milli eski tip köprülü " +
      "vinç örneğidir. IFF: bağımsız ve iki taraf rijit; her iki tarafta ayrı " +
      "motor-redüktör bulunan modern köprülü vinç örneğidir. CFM: bağlı, bir " +
      "ayak rijit diğer ayak mafsallı portal vinçtir. IFM: bağımsız tahrikli, " +
      "bir ayak rijit diğer ayak mafsallı portal vinçtir. I düzeninde raya " +
      "paralel ξ kuvveti ve bağlı çift adedi sıfırdır; F/M düzende hareketli " +
      "tarafta enine teker kuvveti ν2i = 0 alınır.",
  },
];
