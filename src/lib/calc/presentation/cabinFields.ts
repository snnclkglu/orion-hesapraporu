// Kabin ve elektrik odası bölümünün form alanları.
// Hesap `modules/cabin.ts`tedir; burası yalnız alan metadata'sıdır.

import type { FieldDef } from "../fields";
import { ISINIM_NOTU, KABIN_CIHAZ_ISISI_NOTU } from "./cabinNotes";
import {
  AIR_CONDITIONING_REDUNDANCY_LABELS,
  AIR_CONDITIONING_REDUNDANCY_OPTIONS,
  ELECTRICAL_PANEL_IP_CLASSES,
  ROOM_INSULATION_LABELS,
  ROOM_INSULATION_OPTIONS,
} from "../fields";
import {
  CABIN_INDOOR_TEMP_OPTIONS_C,
  ROOM_DOOR_SIZE_OPTIONS,
  ROOM_INDOOR_TEMP_OPTIONS_C,
  ROOM_PANEL_DEPTH_OPTIONS_MM,
  ROOM_PANEL_HEIGHT_OPTIONS_MM,
  type CabinInputs,
  type CabinSelections,
} from "../modules/cabin";

/** Cam tipi seçenekleri — değerler `GlazingKind` ile birebir. */
export const GLAZING_KINDS = [
  "single", "double", "reflective", "ballistic", "ballisticInsulated",
] as const;
export const GLAZING_KIND_LABELS: Record<string, string> = {
  single: "Tek Cam",
  double: "Çift Cam (Isıcam)",
  reflective: "Isıcam + Reflektif",
  ballistic: "Kurşungeçirmez Lamine (EN 1063 BR4)",
  ballisticInsulated: "Kurşungeçirmez + Isıcam (BR4-NS)",
};

/**
 * Cam tipi bilgi notu — U ve g değerlerinin NEREDEN geldiği.
 *
 * Kullanıcı isteği (02.09.2026, md. 10): *"Cam tipi bilgi notuna bu tiplerin
 * ısı geçiş katsayılarını ne aldığımızı yazalım."* Sayılar 02.09.2026'da
 * üretici föyleriyle tek tek doğrulandı.
 */
const CAM_TIPI_NOTU =
  "Isı geçirgenliği U [W/m²K] ve güneş geçirgenliği g, EN 673 / EN 410 ile " +
  "yayımlanmış üretici değerleridir:\n" +
  "· Tek Cam (5–6 mm) — U 5,7 · g 0,87 (Pilkington Glass Handbook)\n" +
  "· Çift Cam 4-12-4 kaplamasız — U 2,8 · g 0,77\n" +
  "· Isıcam + Reflektif (solar-kontrol Low-E, hava dolgu) — U 1,6 · g 0,35\n" +
  "· Kurşungeçirmez Lamine BR4 (35 mm) — U 4,5 · g 0,66 · 80 kg/m²\n" +
  "· Kurşungeçirmez + Isıcam BR4-NS (58 mm) — U 1,3 · g 0,47 · 115 kg/m²\n\n" +
  "TEMPERLİ ve LAMİNE cam AYRI SEÇENEK DEĞİLDİR: EN 673'e göre U yalnız " +
  "kalınlığa, camın öz direncine ve yüzey yayınımına bağlıdır — ısıl işlem " +
  "bunları değiştirmez. Temperleme bir emniyet (EN 12600) kalemidir.\n\n" +
  "KURŞUNGEÇİRMEZ CAMDA İKİ SEÇENEK ARASINDAKİ FARK 3,5 KATTIR: tek katmanlı " +
  "balistik lamine tek camdan yalnız biraz iyidir; ısı yalıtımı ancak " +
  "balistik lamine + Low-E ısıcam birleşiminde sağlanır. Ağırlıkları da " +
  "uçtur (normal ısıcam ≈ 20 kg/m²), kabin ağırlığında ayrıca sayılmalıdır.";

export const CABIN_INPUT_FIELDS: FieldDef<CabinInputs>[] = [
  // --- Operatör kabini
  { key: "cabinWidthM", label: "Kabin Genişliği", unit: "m", type: "number" },
  { key: "cabinLengthM", label: "Kabin Uzunluğu", unit: "m", type: "number" },
  { key: "cabinHeightM", label: "Kabin Yüksekliği", unit: "m", type: "number" },
  {
    key: "cabinInsulation", label: "Kabin İzolasyonu", type: "select",
    options: ROOM_INSULATION_OPTIONS, optionLabels: ROOM_INSULATION_LABELS,
  },
  {
    key: "cabinDoorCount", label: "Kapı Adedi", unit: "adet", type: "number",
    hint: "Hem zarf ısı geçişine hem basınçlandırma sızıntısına girer.",
  },
  {
    // OPERATÖR BU SAYIYA DÂHİL DEĞİLDİR. Metin 02.09.2026'ya kadar "…ve
    // operatör" diyordu; kod ise operatörü AYRICA `occupantKw` olarak topluyor.
    // Yardım metnine uyan bir mühendis 0,3 kW'ın içine operatörü de katarsa
    // 130 W ÇİFT SAYILIRDI (ölçülen kabinde toplamın %11'i).
    key: "cabinDeviceHeatKw", label: "Kabin İçi Isı", unit: "kW", type: "number",
    hint: "Kumanda masası, ekranlar, aydınlatma ve kabin donanımı. OPERATÖRÜ EKLEMEYİN — o ayrı bir kalemdir ve toplama zaten girer.",
    info: KABIN_CIHAZ_ISISI_NOTU,
  },
  {
    key: "cabinRadiationKw", label: "Çevre Işınım Yükü", unit: "kW", type: "number",
    hint: "Kabin kızgın yükü DOĞRUDAN görüyorsa girin. Arada ısı kalkanı ya da platform varsa boş bırakın; ışınım görüş hattı ister.",
    info: ISINIM_NOTU,
  },
  {
    // ADET BİR LİSTEDEN SEÇİLİR (md. 11): kabinde üçten fazla operatör
    // bulunmaz ve serbest sayı kutusu "0" ya da "10" gibi anlamsız değerlere
    // açıktı.
    key: "cabinOccupantCount", label: "Operatör Adedi", unit: "kişi",
    type: "select", numeric: true,
    options: ["1", "2", "3"],
    optionLabels: { "1": "1 kişi", "2": "2 kişi", "3": "3 kişi" },
    hint: "Kişi başına 75 W duyulur + 55 W gizli ısı ve 5 L/s temiz hava (ASHRAE Fundamentals — oturur, hafif iş). Temiz hava gereği basınçlandırma sızıntısını aşarsa taze hava yükünü o belirler.",
  },
  {
    key: "cabinGlazingAreaM2", label: "Cam Alanı", unit: "m²", type: "number",
    hint:
      "OTOMATİK: ön yüz tamamen, iki yan yüzün yarısı cam kabul edilir ve " +
      "çerçeve payı için %80'i alınır —\n" +
      "    A = 0,80 × yükseklik × (genişlik + uzunluk)\n" +
      "Anahtarı kapatıp kendi ölçünüzü yazabilirsiniz. Cam, duvar alanından " +
      "düşülür ve kendi U değeriyle hesaplanır; kabini elektrik odasından " +
      "ayıran kalem budur.",
  },
  {
    key: "cabinGlazingKind", label: "Cam Tipi", type: "select",
    options: GLAZING_KINDS, optionLabels: GLAZING_KIND_LABELS,
    info: CAM_TIPI_NOTU,
    hint: "Açık havada güneşin camdan geçen kısmı kabinin en büyük yüküdür; reflektif kaplama bunu belirgin düşürür.",
  },
  {
    key: "cabinIndoorTempC", label: "Kabin İç Sıcaklığı", unit: "°C",
    type: "select", numeric: true,
    options: CABIN_INDOOR_TEMP_OPTIONS_C.map(String),
    hint: "Hesabın tasarım noktası: bütün ΔT'ler bu değere göre kurulur. Operatör konforu için 23 °C tipiktir; her derece yükün her kalemini birden oynatır.",
  },
  // --- Elektrik odası
  { key: "roomWidthM", label: "Oda Genişliği", unit: "m", type: "number" },
  { key: "roomLengthM", label: "Oda Uzunluğu", unit: "m", type: "number" },
  { key: "roomHeightM", label: "Oda Yüksekliği", unit: "m", type: "number" },
  {
    key: "roomInsulation", label: "Oda İzolasyonu", type: "select",
    options: ROOM_INSULATION_OPTIONS, optionLabels: ROOM_INSULATION_LABELS,
  },
  {
    key: "roomAcRedundancy", label: "Klima Yedeği", type: "select",
    options: AIR_CONDITIONING_REDUNDANCY_OPTIONS,
    optionLabels: AIR_CONDITIONING_REDUNDANCY_LABELS,
    hint: "1+1 seçilirse odaya iki ünite takılır; biri kurulu yedektir. Kapasite kontrolü tek üniteye göre yapılır.",
  },
  {
    key: "roomDoorCount", label: "Kapı Adedi", unit: "adet", type: "number",
    hint: "Hem zarf ısı geçişine hem basınçlandırma sızıntısına girer.",
  },
  {
    // TEK KUTU (md. 3): genişlik ve yükseklik ayrı sorulduğunda imal
    // edilmeyen birleşimler yazılabiliyordu. Kapı bir üründür, boyu defterli.
    key: "roomDoorSize", label: "Kapı Ölçüsü (G × Y)", unit: "mm", type: "select",
    options: ROOM_DOOR_SIZE_OPTIONS,
    optionLabels: Object.fromEntries(
      ROOM_DOOR_SIZE_OPTIONS.map((o) => [o, o.replace("x", " × ")])
    ),
    hint: "Net kapı boşluğu. Isı geçiş alanına girer; elektrik odası şemasında çizilmez.",
  },
  {
    key: "roomIndoorTempC", label: "Oda İç Sıcaklığı", unit: "°C",
    type: "select", numeric: true,
    options: ROOM_INDOOR_TEMP_OPTIONS_C.map(String),
    hint: "Hesabın tasarım noktası: bütün ΔT'ler bu değere göre kurulur. Elektronik için 24 °C tipiktir.",
  },
  // ESKİ İKİ KAPI ALANI TANIMDA KALIR: yayımlanmış eski revizyonlar onları
  // taşıyor ve `roomPanelLayout` tek kutu boşken yine onlardan okuyor. Izgarada
  // görünmezler (bölüm `inputKeys`inde yoklar).
  {
    key: "roomDoorWidthMm", label: "Kapı Genişliği", unit: "mm", type: "number",
    hint: "Devralınan alan; ölçü artık «Kapı Ölçüsü» kutusundan seçilir.",
  },
  {
    key: "roomDoorHeightMm", label: "Kapı Yüksekliği", unit: "mm", type: "number",
    hint: "Devralınan alan; ölçü artık «Kapı Ölçüsü» kutusundan seçilir.",
  },
  { key: "panelCount", label: "Pano Adedi", unit: "adet", type: "number" },
  {
    key: "roomPanelHeightMm", label: "Ortak Pano Yüksekliği", unit: "mm",
    type: "select", numeric: true,
    options: ROOM_PANEL_HEIGHT_OPTIONS_MM.map(String),
    hint: "İlk pano satırından seçilir; bütün panolarda ortaktır ve her panonun altında ayrıca 200 mm baza çizilir.",
  },
  {
    key: "roomPanelDepthMm", label: "Ortak Pano Derinliği", unit: "mm",
    type: "select", numeric: true,
    options: ROOM_PANEL_DEPTH_OPTIONS_MM.map(String),
    hint: "Bütün panolar için ortaktır; yan görünüşte kalan yürüme mesafesini belirler.",
  },
  {
    key: "roomDeviceHeatKw", label: "Pano Kayıp Gücü", unit: "kW", type: "number",
    hint: "Otomatikken seçilmiş motor güçlerinden türetilir (ABB ACS880 katalog kayıpları, ağır hizmet seçimi + yardımcı ekipman + eşzamanlılık).",
  },
  {
    key: "roomRadiationKw", label: "Çevre Işınım Yükü", unit: "kW", type: "number",
    hint: "Oda kızgın yükü DOĞRUDAN görüyorsa girin. Platform ya da ısı kalkanı varsa boş bırakın.",
    info: ISINIM_NOTU,
  },
  // --- Pano tipi yerleşim
  {
    key: "panelIpClass", label: "Pano Koruma Sınıfı", type: "select",
    options: ELECTRICAL_PANEL_IP_CLASSES,
    hint: "Pano tipi yerleşimde oda izolasyonu yerine panonun kendi IP koruması kullanılır.",
  },
  {
    key: "panelAcRedundancy", label: "Klima Yedeği", type: "select",
    options: AIR_CONDITIONING_REDUNDANCY_OPTIONS,
    optionLabels: AIR_CONDITIONING_REDUNDANCY_LABELS,
    hint: "1+1 seçilirse pano BAŞINA iki ünite hesaplanır.",
  },
  {
    key: "panelDeviceHeatKw", label: "Pano Kayıp Gücü", unit: "kW", type: "number",
    hint: "Otomatikken seçilmiş motor güçlerinden türetilir; panolara eşit dağıtılır.",
  },
  {
    key: "panelRadiationKw", label: "Çevre Işınım Yükü", unit: "kW", type: "number",
    hint: "Panolar kızgın yükü DOĞRUDAN görüyorsa girin; ısı kalkanı varsa boş bırakın.",
    info: ISINIM_NOTU,
  },
];

/**
 * Klima seçim alanları — üç mahal de aynı katalogtan (TMS, `air_conditioner`)
 * beslenir; alan adları yalnız mahal önekiyle ayrışır.
 */
export const CABIN_SELECTION_FIELDS: FieldDef<CabinSelections>[] = [
  { key: "cabinAcBrand", label: "Klima Markası", type: "text" },
  { key: "cabinAcModel", label: "Klima Modeli", type: "text" },
  { key: "cabinAcSeries", label: "Klima Serisi", type: "text" },
  { key: "cabinAcApplication", label: "Kullanım Grubu", type: "text" },
  { key: "cabinAcCoolingKwMin", label: "Soğutma Kapasitesi (Min)", unit: "kW", type: "number" },
  { key: "cabinAcCoolingKwMax", label: "Soğutma Kapasitesi (Maks)", unit: "kW", type: "number" },
  { key: "cabinAcAmbientMaxC", label: "Ortam Sıcaklığı Üst Sınırı", unit: "°C", type: "number" },

  { key: "roomAcBrand", label: "Klima Markası", type: "text" },
  { key: "roomAcModel", label: "Klima Modeli", type: "text" },
  { key: "roomAcSeries", label: "Klima Serisi", type: "text" },
  { key: "roomAcApplication", label: "Kullanım Grubu", type: "text" },
  { key: "roomAcCoolingKwMin", label: "Soğutma Kapasitesi (Min)", unit: "kW", type: "number" },
  { key: "roomAcCoolingKwMax", label: "Soğutma Kapasitesi (Maks)", unit: "kW", type: "number" },
  { key: "roomAcAmbientMaxC", label: "Ortam Sıcaklığı Üst Sınırı", unit: "°C", type: "number" },

  { key: "panelAcBrand", label: "Klima Markası", type: "text" },
  { key: "panelAcModel", label: "Klima Modeli", type: "text" },
  { key: "panelAcSeries", label: "Klima Serisi", type: "text" },
  { key: "panelAcApplication", label: "Kullanım Grubu", type: "text" },
  { key: "panelAcCoolingKwMin", label: "Soğutma Kapasitesi (Min)", unit: "kW", type: "number" },
  { key: "panelAcCoolingKwMax", label: "Soğutma Kapasitesi (Maks)", unit: "kW", type: "number" },
  { key: "panelAcAmbientMaxC", label: "Ortam Sıcaklığı Üst Sınırı", unit: "°C", type: "number" },
];
