// MONTAJ TİPİ, BÖLGE ve RENK GRUBU — kategoriden türetilir (PANO-6 · PANO-7).
//
// Yeni bir sınıflandırma sözlüğü AÇILMAZ: kaynak, satın almanın ve bakımın
// zaten kullandığı 25'li `ELECTRICAL_CATEGORIES` taksonomisidir
// (`lib/electrical/category.ts`, ELEKTRIK-13). Burada yapılan tek şey o işlev
// ailesini üç fiziksel soruya çevirmektir: cihaz panoda NEREYE takılır, hangi
// BÖLGEYE düşer, şemada hangi RENGİ alır.
//
// `Diğer` kategorisi montaj tipi ÜRETMEZ. Bilinmeyeni tahmin edilmiş bir
// doğrulukla bir yere koymak, ELEKTRIK-13'ün açıkça yasakladığı şeydir —
// o cihaz "sınıflanmamış" kuyruğunda görünür ve panoya girmez.

import { trKatla } from "@/lib/drawings/tr-text";
import type { ColorGroup, MountType, Zone } from "./types";

export interface MountRule {
  mountType: MountType | null;
  zone: Zone | null;
  colorGroup: ColorGroup;
}

/**
 * BÖLGE SIRASI — yukarıdan aşağı. Sıralamanın gerekçesi PANO-7'dedir:
 * kalın besleme iletkeni kısalır, ince kumanda kablosu uzar.
 *
 * `giris` bandında yalnız ana şalter değil DAĞITIM ŞALTER BANKASI da vardır —
 * gerçek panoda ana şalterin hemen altındaki sıra budur.
 */
export const ZONE_ORDER: readonly Zone[] = ["giris", "guc", "motor", "kumanda", "klemens"];

export const ZONE_LABEL: Record<Zone, string> = {
  giris: "Giriş ve Dağıtım",
  guc: "Güç ve Sürücü",
  motor: "Motor Anahtarlama",
  kumanda: "Kumanda ve Otomasyon",
  klemens: "Klemens",
};

export const MOUNT_LABEL: Record<MountType, string> = {
  din: "Ray",
  plaka: "Montaj plakası",
  kapak: "Kapak",
  govde: "Gövde gereci",
  saha: "Pano dışı (saha)",
};

export const COLOR_GROUP_LABEL: Record<ColorGroup, string> = {
  giris: "Giriş ve koruma",
  surucu: "Sürücü ve güç elektroniği",
  anahtarlama: "Anahtarlama ve motor koruma",
  kumanda: "Kumanda",
  otomasyon: "Otomasyon",
  besleme: "Besleme",
  klemens: "Klemens ve bağlantı",
  iklim: "İklimlendirme ve gövde",
  diger: "Sınıflanmamış / pano dışı",
};

/**
 * Kategori → montaj tipi · bölge · renk.
 *
 * Anahtar `ELECTRICAL_CATEGORIES` üyeleridir; sözlük orayla eşitlenmiş
 * olmalıdır ve bir test bunu sabitler (değişmez md. 8). Değeri `null` olan
 * montaj tipi "panoya yerleşmez" demektir, "bilinmiyor" değil.
 */
const KATEGORI_KURALI: Record<string, MountRule> = {
  // ── Panoya raya oturanlar ────────────────────────────────────────────────
  "Şalterler ve Devre Kesiciler": { mountType: "din", zone: "giris", colorGroup: "giris" },
  "Sigortalar ve Sigorta Yuvaları": { mountType: "din", zone: "giris", colorGroup: "giris" },
  Kontaktörler: { mountType: "din", zone: "motor", colorGroup: "anahtarlama" },
  "Motor Koruma ve Termik Röleler": {
    mountType: "din",
    zone: "motor",
    colorGroup: "anahtarlama",
  },
  "Kumanda ve Güvenlik Röleleri": { mountType: "din", zone: "kumanda", colorGroup: "kumanda" },
  "Ölçüm ve Enstrümantasyon": { mountType: "din", zone: "kumanda", colorGroup: "kumanda" },
  "PLC ve Uzak I/O": { mountType: "din", zone: "kumanda", colorGroup: "otomasyon" },
  "Endüstriyel Haberleşme": { mountType: "din", zone: "kumanda", colorGroup: "otomasyon" },
  "Güç Kaynakları ve Trafolar": { mountType: "din", zone: "kumanda", colorGroup: "besleme" },
  "Fiş, Priz, Klemens ve Bağlantı": {
    mountType: "din",
    zone: "klemens",
    colorGroup: "klemens",
  },

  // ── Doğrudan montaj plakasına vidalananlar ───────────────────────────────
  "Sürücüler ve Güç Elektroniği": { mountType: "plaka", zone: "guc", colorGroup: "surucu" },

  // ── Kapak üstü ───────────────────────────────────────────────────────────
  "HMI ve Operatör Panelleri": { mountType: "kapak", zone: "kumanda", colorGroup: "otomasyon" },
  "Kumanda Elemanları": { mountType: "kapak", zone: "kumanda", colorGroup: "kumanda" },
  "Sinyal ve İkaz Elemanları": { mountType: "kapak", zone: "kumanda", colorGroup: "kumanda" },

  // ── Gövde gereci: yerleşimi çizilmez, listede durur ──────────────────────
  "Pano İklimlendirme": { mountType: "govde", zone: null, colorGroup: "iklim" },
  Aydınlatma: { mountType: "govde", zone: null, colorGroup: "iklim" },
  "Pano, Muhafaza ve Etiketleme": { mountType: "govde", zone: null, colorGroup: "iklim" },

  // ── Panonun DIŞINDA ──────────────────────────────────────────────────────
  Motorlar: { mountType: "saha", zone: null, colorGroup: "diger" },
  "Fren Sistemleri": { mountType: "saha", zone: null, colorGroup: "diger" },
  Sensörler: { mountType: "saha", zone: null, colorGroup: "diger" },
  "Enkoder ve Geri Besleme": { mountType: "saha", zone: null, colorGroup: "diger" },
  "Limit Şalterleri": { mountType: "saha", zone: null, colorGroup: "diger" },
  "Kamera ve Görüntüleme": { mountType: "saha", zone: null, colorGroup: "diger" },
  Kablolar: { mountType: "saha", zone: null, colorGroup: "diger" },

  // ── Sınıflanmamış: tahmin edilmez ────────────────────────────────────────
  Diğer: { mountType: null, zone: null, colorGroup: "diger" },
};

const BILINMEYEN: MountRule = { mountType: null, zone: null, colorGroup: "diger" };

export interface MountSource {
  category: string;
  designation: string;
  typeNo: string;
}

/**
 * Cihazın montaj tipini, bölgesini ve renk grubunu verir.
 *
 * ÖZGÜL KURAL GENELDEN ÖNCE GELİR (ELEKTRIK-13 ile aynı ilke): kategori
 * doğru aileyi söyler ama aile içinde fiziksel montaj ayrışabilir. Ölçülen iki
 * durum:
 *
 *  · TRAFO VE REAKTÖR RAYA OTURMAZ. "Güç Kaynakları ve Trafolar" ailesinin
 *    anahtarlamalı güç kaynağı (SITOP, S8VK) DIN rayındadır; aynı ailedeki
 *    kontrol trafosu ve şebeke reaktörü onlarca kilo gelir ve doğrudan
 *    plakaya vidalanır. İkisini aynı raya koymak rayı koparır.
 *  · YÜK AYIRICI VE ANA ŞALTER GİRİŞTEDİR. "Şalterler" ailesi zaten `giris`
 *    bandındadır, ama kapak kolu ile kumanda edilen ayırıcı (SIRCO, OS,
 *    "rotary handle") bandın EN BAŞINDA durmalıdır; bu, sıralamada öne alınır.
 */
export function mountRuleFor(item: MountSource): MountRule {
  const temel = KATEGORI_KURALI[item.category] ?? BILINMEYEN;
  const metin = trKatla(`${item.designation} | ${item.typeNo}`);

  if (temel.colorGroup === "besleme" && agirBeslemeMi(metin)) {
    return { mountType: "plaka", zone: "guc", colorGroup: "besleme" };
  }

  // ÖLÇÜM AİLESİ İKİYE AYRILIR ve bu ölçülmüş bir hatadır (06.09.2026):
  // "Ölçüm ve Enstrümantasyon" hem PANO GÖSTERGESİNİ (96 × 96 kesitli
  // ampermetre, tarayıcı alarm cihazı) hem SAHA ELEMANINI (PT100 probu, yük
  // hücresi, basınç vericisi) taşıyor. İkisi de pano göstergesi sayılınca
  // 0019 + 0026'da 52 PT100 probu + 20 rezistans termometresi + 5 yük hücresi
  // panoya girip 7,4 METRE ray yiyordu — hiçbiri panoda değil, motorun ve
  // redüktörün üstünde.
  if (temel.colorGroup === "kumanda" && item.category === "Ölçüm ve Enstrümantasyon") {
    if (sahaElemaniMi(metin)) {
      return { mountType: "saha", zone: null, colorGroup: "diger" };
    }
  }

  return temel;
}

/**
 * Ölçüm ailesindeki SAHA elemanı mı (panoya girmez)?
 *
 * İşaretler süreç bağlantısı ve prob gövdesidir: `NPT`/`BSP` bir boru
 * dişidir ve pano kapağında işi yoktur; `PROB`, `LOAD CELL`, `TERMOMETRE`
 * doğrudan ölçülen yerin üstündedir.
 */
function sahaElemaniMi(metin: string): boolean {
  return [
    "PROB",
    "PT100",
    "PT 100",
    "THERMOCOUPLE",
    "TERMOKUPL",
    "RESISTANCE THERMOMETER",
    "REZISTANS TERMOMETRE",
    "LOAD CELL",
    "YUK HUCRESI",
    "TRANSMITTER",
    "TRANSDUCER",
    "NPT",
    "SICAKLIK SENSOR",
    "TEMPERATURE SENSOR",
  ].some((isaret) => metin.includes(isaret));
}

/** Trafo · reaktör · filtre: raya değil plakaya. */
function agirBeslemeMi(metin: string): boolean {
  return [
    "TRANSFORMER",
    "TRAFO",
    "REACTOR",
    "REAKTOR",
    "DROSSEL",
    "CHOKE",
    "LINE FILTER",
    "SEBEKE FILTRE",
  ].some((isaret) => metin.includes(isaret));
}

/**
 * Giriş bandında EN ÖNE alınacak aygıt mı (ana şalter / yük ayırıcı)?
 *
 * Sıralama kıstasıdır, ayrı bir bölge değil: ana şalterin altındaki dağıtım
 * bankası da `giris` bandındadır ve ikisi ayrılırsa bara yolu uzar.
 */
export function isMainSwitch(item: MountSource): boolean {
  const metin = trKatla(`${item.designation} | ${item.typeNo}`);
  return [
    "MAIN SWITCH",
    "ANA SALTER",
    "LOAD BREAK",
    "YUK AYIRICI",
    "DISCONNECT",
    "SIRCO",
    "ROTARY HANDLE",
    "SWITCH DISCONNECTOR",
  ].some((isaret) => metin.includes(isaret));
}

/** Sözlükte tanımlı kategoriler — testin taksonomiyle eşitlemesi için. */
export function mappedCategories(): string[] {
  return Object.keys(KATEGORI_KURALI);
}
