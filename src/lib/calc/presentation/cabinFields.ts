// Kabin ve elektrik odası bölümünün form alanları.
// Hesap `modules/cabin.ts`tedir; burası yalnız alan metadata'sıdır.

import type { FieldDef } from "../fields";
import {
  AIR_CONDITIONING_REDUNDANCY_LABELS,
  AIR_CONDITIONING_REDUNDANCY_OPTIONS,
  ELECTRICAL_PANEL_IP_CLASSES,
  ROOM_INSULATION_LABELS,
  ROOM_INSULATION_OPTIONS,
} from "../fields";
import {
  ROOM_PANEL_DEPTH_OPTIONS_MM,
  ROOM_PANEL_HEIGHT_OPTIONS_MM,
  type CabinInputs,
  type CabinSelections,
} from "../modules/cabin";

/** Cam tipi seçenekleri — değerler `GlazingKind` ile birebir. */
export const GLAZING_KINDS = ["single", "double", "reflective"] as const;
export const GLAZING_KIND_LABELS: Record<string, string> = {
  single: "Tek Cam",
  double: "Çift Cam (Isıcam)",
  reflective: "Isıcam + Reflektif",
};

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
    key: "cabinDeviceHeatKw", label: "Kabin İçi Isı", unit: "kW", type: "number",
    hint: "Kumanda masası, ekranlar, aydınlatma ve operatör.",
  },
  {
    key: "cabinRadiationKw", label: "Çevre Işınım Yükü", unit: "kW", type: "number",
    hint: "Kabin kızgın yükü DOĞRUDAN görüyorsa girin. Arada ısı kalkanı ya da platform varsa boş bırakın; ışınım görüş hattı ister.",
  },
  {
    key: "cabinOccupantCount", label: "Operatör Adedi", unit: "kişi", type: "number",
    hint: "Kişi başına 75 W duyulur + 55 W gizli ısı ve 5 L/s temiz hava. Temiz hava gereği basınçlandırma sızıntısını aşarsa taze hava yükünü o belirler.",
  },
  {
    key: "cabinGlazingAreaM2", label: "Cam Alanı", unit: "m²", type: "number",
    hint: "Kabini elektrik odasından ayıran kalem. Cam duvar alanından düşülür ve kendi U değeriyle hesaplanır.",
  },
  {
    key: "cabinGlazingKind", label: "Cam Tipi", type: "select",
    options: GLAZING_KINDS, optionLabels: GLAZING_KIND_LABELS,
    hint: "Açık havada güneşin camdan geçen kısmı kabinin en büyük yüküdür; reflektif kaplama bunu belirgin düşürür.",
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
    key: "roomDoorWidthMm", label: "Kapı Genişliği", unit: "mm", type: "number",
    hint: "Kapı ısı geçiş alanına girer; elektrik odası şemasında çizilmez.",
  },
  {
    key: "roomDoorHeightMm", label: "Kapı Yüksekliği", unit: "mm", type: "number",
    hint: "Kapı ısı geçiş alanına girer; elektrik odası şemasında çizilmez.",
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
