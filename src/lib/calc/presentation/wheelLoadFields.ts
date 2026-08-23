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
  roller: "Kılavuz Makarası",
};

export const WHEELLOAD_INPUT_FIELDS: FieldDef<WheelLoadInputs>[] = [
  // `wheelSpacingsText` görsel teker düzeni düzenleyicisinden yazılır
  // (bkz. WheelSpacingEditor); burada ayrıca bir metin kutusu gösterilmez.
  {
    key: "guideSpacingMm",
    label: "Kılavuz Elemanları Arası wb",
    unit: "mm",
    type: "number",
    hint:
      "Vincin bir ray üzerindeki öndeki ve arkadaki yanal kılavuz noktaları " +
      "arasındaki boyuna mesafedir. Teker flanşı kılavuzsa ilk ve son kılavuz " +
      "teker ekseni arası; ayrı kılavuz makarası varsa ön ve arka makara " +
      "merkezleri arası ölçülür. Otomatikte teker düzeninin ilk–son eksen " +
      "mesafesi kullanılır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.5: wb, kılavuz " +
      "elemanları arasındaki yürüyüş yönü mesafesidir; raylar arası açıklık " +
      "değildir. αg = sg/wb ve αw = 0,1·b/wb bağıntılarının paydasına girer.\n\n" +
      "Kod kullanımı — Otomatik açıkken bir raydaki ilk ve son teker ekseni " +
      "arasındaki toplam ölçü alınır. Ayrı kılavuz makaraları bu eksenlerle " +
      "çakışmıyorsa otomatik kapatılıp makara merkezleri arası gerçek wb girilir.",
    standardRef: "FEM 1.001 9.4.1.5",
  },
  {
    key: "guideClearanceMm",
    label: "Kılavuz Boşluğu (Tek Taraf)",
    unit: "mm",
    type: "number",
    hint: "Flanş ile ray başı arasındaki tek taraf boşluk. FEM'in sg değeri bunun iki katıdır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.5 toplam kılavuz " +
      "boşluğunu sg ile tanımlar ve αg = sg/wb kullanır.\n\n" +
      "Kod kullanımı — Bu kutu ölçüm kolaylığı için TEK TARAF boşluğunu ister; " +
      "hesap sg = 2 × kutu değeri yapar. Bu nedenle teknik resimdeki toplam " +
      "flanş–ray boşluğu doğrudan bu kutuya yazılmaz.",
  },
  {
    key: "coupledPairCount",
    label: "Bağlı Teker Çifti Adedi p",
    type: "number",
    hint: "İki rayın tekerlerini birbirine bağlayan (mil ya da elektriksel senkron) çift adedi. Otomatikte tahrikli teker çiftlerinden okunur.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 md. 9.4.1.3'te p, iki ray " +
      "tarafı mekanik mil veya elektriksel senkronizasyonla bağlı teker " +
      "çiftlerinin adedidir ve kayma kutbu hesabına girer.\n\n" +
      "Kod kullanımı — Otomatikte p = tahrikli teker adedi / 2 alınır ve ray " +
      "başına teker sayısıyla sınırlandırılır. IFF/IFM bağımsız düzende p tanım " +
      "gereği sıfıra zorlanır; elle yazılmış değer düzenle çelişemez.",
    standardRef: "FEM 1.001 9.4.1.3",
  },
  {
    key: "creepSpeedMpm",
    label: "Kaldırma Sürünme Hızı",
    unit: "m/dak",
    type: "number",
    hint: "HD2 ve HD3 tahrik sınıflarında φ2 bu hızla hesaplanır.",
    info:
      "Standart dayanağı — FEM 1.001 Kitapçık 9 Tablo T.9.3.b, Yükleme " +
      "Durumu I/II için HD2 ve HD3 sınıflarında kaldırma dinamik katsayısına " +
      "girecek hızın sürünme hızı olduğunu belirtir.\n\n" +
      "Kod kullanımı — Değer m/dak girilir, m/s'ye çevrilir ve " +
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
      "Kod kullanımı — Seçilen tablodan β2 ve φ2,min okunur; tasarım teker " +
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
      "belirtir. Ayrı kılavuz makarası seçimi fiziksel düzeni rapora taşır.\n\n" +
      "Kod kullanımı — Bu seçim tek başına sayısal wb'yi değiştirmez. Makara " +
      "merkezleri ilk/son teker ekseninden farklıysa wb otomatiği kapatılıp " +
      "gerçek makara merkezleri arası mesafe girilmelidir.",
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
      "Kod kullanımı — I düzeninde raya paralel ξ kuvveti ve bağlı çift adedi " +
      "sıfırdır. F/M düzende hareketli tarafta enine teker kuvveti ν2i = 0 " +
      "alınır; seçim savrulma kuvvetlerinin dağılımını doğrudan değiştirir.",
  },
];
