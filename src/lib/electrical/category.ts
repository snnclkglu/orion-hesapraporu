// ELEKTRİK MALZEME KATEGORİSİ — saf ve türetilmiş.
//
// Kategori PDF'den gelen serbest bir alan değildir; tanım, tip, tedarikçi ve
// malzeme kodunun birlikte okunmasıyla türetilir. Böylece veritabanı restore
// edildiğinde veya PDF yeniden okunduğunda sınıflar kaybolmaz. Kural sırası
// önemlidir: sensörlü bir pano lambası önce AYDINLATMA, motor PTC'si önce
// MOTOR, 3RV ise genel şalterden önce MOTOR KORUMA olarak tanınır.

import { trKatla } from "@/lib/drawings/tr-text";

export const ELECTRICAL_CATEGORIES = [
  "Sürücüler ve Güç Elektroniği",
  "Motorlar",
  "Fren Sistemleri",
  "PLC ve Uzak I/O",
  "HMI ve Operatör Panelleri",
  "Endüstriyel Haberleşme",
  "Kamera ve Görüntüleme",
  "Güç Kaynakları ve Trafolar",
  "Şalterler ve Devre Kesiciler",
  "Sigortalar ve Sigorta Yuvaları",
  "Kontaktörler",
  "Motor Koruma ve Termik Röleler",
  "Kumanda ve Güvenlik Röleleri",
  "Ölçüm ve Enstrümantasyon",
  "Sensörler",
  "Enkoder ve Geri Besleme",
  "Limit Şalterleri",
  "Kumanda Elemanları",
  "Sinyal ve İkaz Elemanları",
  "Aydınlatma",
  "Pano İklimlendirme",
  "Pano, Muhafaza ve Etiketleme",
  "Kablolar",
  "Fiş, Priz, Klemens ve Bağlantı",
  "Diğer",
] as const;

export type ElectricalCategory = (typeof ELECTRICAL_CATEGORIES)[number];

export interface ElectricalCategorySource {
  designation: string;
  typeNo: string;
  supplier: string;
  partNo: string;
}

function kategoriMetni(item: ElectricalCategorySource): string {
  return trKatla(`${item.designation} | ${item.typeNo} | ${item.supplier} | ${item.partNo}`);
}

function biriVar(metin: string, ...ifadeler: string[]): boolean {
  return ifadeler.some((ifade) => metin.includes(ifade));
}

/**
 * Malzemeyi tek ve kararlı bir kategoriye indirir.
 *
 * Yalnız açık ürün ailesi işaretleri kullanılır. Çelişkide daha özgül kural
 * öndedir; hiçbir açık işaret yoksa “Diğer” kalır. Bu son sınıf kalite kontrol
 * kuyruğudur ve bilinmeyeni tahmin edilmiş bir doğrulukla gizlemez.
 */
export function electricalCategory(item: ElectricalCategorySource): ElectricalCategory {
  const metin = kategoriMetni(item);

  // Sensörlü pano lambası ve pilot light, “sensor/light” sözcükleri taşısa da
  // işlev olarak aydınlatma/ikazdır; genel sensör kuralından önce gelir.
  if (
    biriVar(
      metin,
      "PANEL LIGHT",
      "PANO LAMB",
      "FLOODLIGHT",
      "PROJEKTOR",
      "AYDINLATMA",
      "LIGHTING FIXTURE",
      "LED ARMATUR",
      "EAE.51041",
      "PELSAN.113319",
      "NIKI LED",
      "LED SAFETY SPOT",
      "LINE LIGHT"
    )
  ) {
    return "Aydınlatma";
  }

  if (
    biriVar(
      metin,
      "MOTOR PTC",
      "ASYNCHRONOUS MOTOR",
      "ASENKRON MOTOR",
      "ELEKTRIK MOTORU",
      "VEM MOTORS",
      "INNOMOTICS",
      "SIMOTICS",
      "1LE"
    )
  ) {
    return "Motorlar";
  }

  if (
    biriVar(
      metin,
      "ELECTROMAGNETIC BRAKE",
      "EMERGENCY BRAKE",
      "ELDRO BRAKE",
      "FREN",
      "SIBRE.ED",
      "SIBRE ED",
      "HKA-A-"
    )
  ) {
    return "Fren Sistemleri";
  }

  // Haberleşme adaptörleri sürücüye takılsa da bakım/satın alma ailesi ağdır.
  if (
    biriVar(
      metin,
      "PROFINET",
      "PROFIBUS",
      "FIELD BUS",
      "FIELDBUS",
      "ETHERNET",
      "SCALANCE",
      "COMMUNICATION MODULE",
      "INTERCOMMUNICATION",
      "INTERCOM",
      "HABERLESME MODUL",
      "FPNO-",
      "FENA-",
      "6GK",
      "TG-R4",
      "BST01"
    )
  ) {
    return "Endüstriyel Haberleşme";
  }

  if (
    biriVar(metin, "SIMATIC HMI", "OPERATOR PANEL", "TOUCH PANEL", "BEDIENFELD", "AOP30", "6AV")
  ) {
    return "HMI ve Operatör Panelleri";
  }

  if (
    biriVar(
      metin,
      "NETWORK CAMERA",
      "IP CAMERA",
      "BULLET CAMERA",
      "VIDEO CAMERA",
      "VIDEO RECORDER",
      " NVR",
      " DVR",
      "HIKVISION",
      "DS-2CD",
      "DS-71"
    )
  ) {
    return "Kamera ve Görüntüleme";
  }

  if (
    biriVar(
      metin,
      "SIMATIC ET 200",
      "SIMATIC ET200",
      "SIMATIC S7",
      "PLC ",
      "REMOTE I/O",
      "DIGITAL INPUT",
      "DIGITAL OUTPUT",
      "ANALOG INPUT",
      "ANALOG OUTPUT",
      "6ES7",
      "6ES5"
    )
  ) {
    return "PLC ve Uzak I/O";
  }

  if (
    biriVar(
      metin,
      "ENCODER",
      "PULSE ENCODER",
      "ABSOLUTE ENCODER",
      "ENKODER",
      "ENCODER INTERFACE",
      "SENSOR MODULE CABINET",
      "FEN-31",
      "SMC30",
      "GV210",
      "FGHJ"
    )
  ) {
    return "Enkoder ve Geri Besleme";
  }

  if (
    biriVar(
      metin,
      "INVERTER",
      "FREQUENCY CONVERTER",
      "FREKANS KONVERTOR",
      "DIODE SUPPLY",
      "IGBT SUPPLY",
      "DRIVE CONTROL UNIT",
      "CONTROL UNIT /2_CH",
      "CHARGING RESISTOR",
      "BRAKE CHOPPER",
      "DRIVE FILTER",
      "FILTER UNIT | BLCL",
      "ACS880",
      "SINAMICS",
      "6SL",
      "BCU-02",
      "ZCU-14",
      "FSO-12",
      "NOCH",
      "BOCH",
      "CBH165"
    )
  ) {
    return "Sürücüler ve Güç Elektroniği";
  }

  if (
    biriVar(
      metin,
      "POWER SUPPLY",
      "GUC KAYNAGI",
      "TRANSFORMER",
      "TRAFO",
      "SITOP",
      "24VDC POWER",
      "230VAC/24VDC",
      "CONTINUOUS CURRENT SUPPLY",
      "MATIS "
    )
  ) {
    return "Güç Kaynakları ve Trafolar";
  }

  if (
    biriVar(
      metin,
      "MOTOR PROTECTION",
      "MOTOR KORUMA",
      "OVERLOAD RELAY",
      "THERMISTOR RELAY",
      "TERMISTOR ROLE",
      "THERMAL OVERLOAD",
      "3RV",
      "3RU",
      "3RN"
    )
  ) {
    return "Motor Koruma ve Termik Röleler";
  }

  if (
    biriVar(
      metin,
      "CONTACTOR",
      "KONTAKTOR",
      "AUX. SWITCH BLOCK",
      "AUX.SWITCH BLOCK",
      "3RT",
      "3TF",
      "3RH",
      "AF30-",
      "AF SERIES CONTACTOR"
    )
  ) {
    return "Kontaktörler";
  }

  if (
    biriVar(
      metin,
      "FUSE BASE",
      "FUSE LINK",
      "FUSE HOLDER",
      "FUSE ",
      "SIGORTA",
      "SIGORTA YUVA",
      "SIGORTA ALT",
      "HRC FUSE",
      "CYLINDRICAL FUSE",
      "OS160",
      "OFAA",
      "170M",
      "US27"
    )
  ) {
    return "Sigortalar ve Sigorta Yuvaları";
  }

  if (
    biriVar(
      metin,
      "CIRCUIT BREAKER",
      "DEVRE KESICI",
      "MOLDED CASE",
      "MOULDED CASE",
      "MCCB",
      "MINIATURE CIRCUIT",
      "TRANSFER SWITCH",
      "LOAD BREAK SWITCH",
      "DISCONNECTOR",
      "3VA",
      "5SL",
      "ATYS",
      "5ST3010"
    ) ||
    biriVar(metin, "SIRCO", "SIRCOVER") ||
    (metin.includes("SOCOMEC") && metin.includes("AUXILIARY BLOCK"))
  ) {
    return "Şalterler ve Devre Kesiciler";
  }

  if (
    biriVar(
      metin,
      "SAFETY RELAY",
      "MONITORING RELAY",
      "COUPLING RELAY",
      "INTERFACE RELAY",
      "TIME RELAY",
      "AUXILIARY RELAY",
      "RELAY",
      "KUMANDA ROLESI",
      "EMNIYET ROLESI",
      "G2RV",
      "LZS:",
      "LZS.",
      "3SK",
      "3UG",
      "5TT"
    )
  ) {
    return "Kumanda ve Güvenlik Röleleri";
  }

  if (
    biriVar(
      metin,
      "PT100",
      "RESISTANCE THERMOMETER",
      "TEMPERATURE SCANNER",
      "TEMPERATURE CONTROLLER",
      "LOAD CELL",
      "OVERLOAD INDICATOR",
      "WEIGHING",
      "TARTIM",
      "YUK HUCRESI",
      "YUK GOSTERGESI",
      "KOBASTAR",
      "LPW1-",
      "E690-"
    )
  ) {
    return "Ölçüm ve Enstrümantasyon";
  }

  if (
    biriVar(
      metin,
      "LIMIT SWITCH",
      "SINIR SALTER",
      "ROTARY LIMIT",
      "GEAR LIMIT",
      "CLS02",
      "XCK",
      "STROMAG 51-",
      "STROMAG.51-",
      "51-67-"
    )
  ) {
    return "Limit Şalterleri";
  }

  if (
    biriVar(
      metin,
      "INDUCTIVE SENSOR",
      "INDUCTIVE PROXIMITY SWITCH",
      "PROXIMITY SENSOR",
      "PROXIMITY SWITCH",
      "RADAR SENSOR",
      "TEMPERATURE SENSOR",
      "SICAKLIK SENSOR",
      "NTC SENSOR",
      "NTC PROBE",
      "SENSOR HEAD",
      "SENSOR",
      "PHOTOELECTRIC",
      "REFLECTOR",
      "XS1M",
      "T30R"
    )
  ) {
    return "Sensörler";
  }

  if (
    biriVar(
      metin,
      "EMERGENCY STOP",
      "ACIL STOP",
      "PUSHBUTTON",
      "PUSH BUTTON",
      "BAS BUTON",
      "SELECTOR SWITCH",
      "MASTER SWITCH",
      "FOOT SWITCH",
      "PALM SWITCH",
      "JOYSTICK",
      "HARMONY STIL 4",
      "HARMONY STIL 5",
      "XB4BA",
      "XB4BS",
      "XB4BW",
      "XB5AA",
      "XPE"
    )
  ) {
    return "Kumanda Elemanları";
  }

  if (
    biriVar(
      metin,
      "SIGNAL LIGHT",
      "PILOT LIGHT",
      "STACK LIGHT",
      "SIGNAL COLUMN",
      "IKAZ LAMB",
      "SIGNAL HORN",
      "HORN",
      "BUZZER",
      "SIREN"
    )
  ) {
    return "Sinyal ve İkaz Elemanları";
  }

  if (
    biriVar(
      metin,
      "FILTER FAN",
      "FAN FILTER",
      "PANEL FAN",
      "PANO FANI",
      "THERMOSTAT",
      "HYGROSTAT",
      "HUMIDITY-SWITCH",
      "HUMIDIFIER",
      "HEAT CONTROLLER",
      "PANEL HEATER",
      "QFF",
      "EPT-M",
      "ET2412"
    )
  ) {
    return "Pano İklimlendirme";
  }

  if (
    biriVar(
      metin,
      "PLASTIC ENCLOSURE",
      "ENCLOSURE",
      "PANO KUTU",
      "JUNCTION BOX",
      "LABEL HOLDER",
      "MARKING PLATE",
      "BB1-",
      "BB3-",
      "ZBZ33"
    )
  ) {
    return "Pano, Muhafaza ve Etiketleme";
  }

  if (
    biriVar(
      metin,
      "HELU.",
      "HELUKABEL",
      "IGUS.CF",
      "CONTROL CABLE",
      "FLAT CABLE",
      "CONNECTION CABLE",
      "TOPFLEX",
      "TOPSERV",
      "TOPGEBER",
      "ROBOFLEX",
      "TRONIC-CY"
    )
  ) {
    return "Kablolar";
  }

  if (
    biriVar(
      metin,
      "PLUG",
      "SOCKET",
      "TERMINAL BLOCK",
      "TERMINAL ",
      "KLEMENS",
      "CONNECTOR",
      "COVERING HOOD",
      "CONNECTOR HOOD",
      "HC-RBO",
      "BC1-",
      "BK1-"
    )
  ) {
    return "Fiş, Priz, Klemens ve Bağlantı";
  }

  return "Diğer";
}
