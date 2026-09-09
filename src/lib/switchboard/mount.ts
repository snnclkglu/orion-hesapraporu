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
  yan: "Pano yanı",
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

  // İKAZ VE AYDINLATMA AİLESİ DE İKİYE AYRILIR (kullanıcı kararı, 08.09.2026).
  // Ölçüldü (0026): 108 dB'lik bir siren, boru korna, üç katlı ikaz kolonu ve
  // 160 W'lık dört projektör pano KAPAĞINA 30 x 30 mm delik olarak çiziliyordu
  // — hiçbiri panonun kapağında değil, vincin üstünde ya da panonun yanında.
  // Projektörler ise `govde` sayıldığı için çizimde de listede de kuyrukta da
  // GÖRÜNMÜYORDU; bir aygıtın sessizce yok olması en kötü sonuçtur (PANO-10).
  if (item.category === "Sinyal ve İkaz Elemanları" || item.category === "Aydınlatma") {
    if (panoYaniMi(metin)) {
      return { mountType: "yan", zone: null, colorGroup: "kumanda" };
    }
  }

  // FREN DİRENCİ SÜRÜCÜ AİLESİNDEDİR AMA PANOYA GİRMEZ (kullanıcı kararı,
  // 08.09.2026). 0026'da 75 kW'lık bir direnç var; kendi havalandırmalı
  // kafesinde, panonun dışında durur. Aile doğru, montaj ayrı — PT100
  // ayrımının aynı deseni.
  if (item.category === "Sürücüler ve Güç Elektroniği" && frenDirenciMi(metin)) {
    return { mountType: "saha", zone: null, colorGroup: "diger" };
  }

  // MAKİNE PRİZİ RAYA OTURMAZ. Eğik makine prizi pano sacına/kapağına gömülür;
  // "Fiş, Priz, Klemens" ailesinin klemens tarafı raydadır, priz tarafı değil.
  // Defterde `BC1-3504-7420` zaten `kapak` yazıyor — kural onu doğruluyor,
  // kardeşi `BC1-1403-7420` defterde olmasa da aynı yere gitsin.
  if (item.category === "Fiş, Priz, Klemens ve Bağlantı" && makinePriziMi(metin)) {
    return { mountType: "kapak", zone: "kumanda", colorGroup: "klemens" };
  }

  return temel;
}

/**
 * AKSESUAR AYGITIN ENİNİ BÜYÜTÜR MÜ? (PANO-26)
 *
 * Aynı aygıt etiketinin ikinci satırı çoğu zaman bir aksesuardır ve gövdeyi
 * BÜYÜTMEZ — bir kontaktörün yardımcı kontağı önden takılır, bir rölenin
 * soketi zaten takımın kendisidir. Ama YANDAN takılan aksesuar toplam eni
 * gerçekten büyütür ve bunu görmezden gelmek panoyu dar hesaplatır.
 *
 * KARAR KATALOĞUN SÖZÜDÜR, tahmin değil. Ölçüldü (0026-01 katalogları):
 *
 *  · `A9A26904` (Acti9 iOF): montaj kuralları sayfası "à esquerda" (sola)
 *    diyor — takım enine 9 mm EKLENİR.
 *  · `GVAE11` (GV2/GV3): "Front mounting add-on contact blocks" — 0 ekler.
 *
 * Liste DAR tutulur: `AUXILIARY CONTACT` gibi geniş bir işaret önden takılan
 * blokları da yakalar ve panoyu gereksizce genişletirdi. Kanıtı olmayan
 * aksesuar `null` döner ve eni değiştirmez (değişmez md. 4).
 */
export type AksesuarYonu = "yan" | "on";

export function aksesuarYonu(item: MountSource): AksesuarYonu | null {
  const metin = trKatla(`${item.designation} | ${item.typeNo}`);
  // Acti9 yardımcı/sinyal kontağı: yandan takılır, en ekler.
  if (metin.includes("A9A") || metin.includes("IOF") || metin.includes("ISD")) return "yan";
  // GV2/GV3 önden takılan blok: en eklemez.
  if (metin.includes("GVAE")) return "on";
  return null;
}

/**
 * Pano YANINA / vince asılan ikaz ve aydınlatma mı?
 *
 * ÇIPLAK `HORN` YAZILMAZ: aydınlatma markası THORN'un içinde geçer ve o markanın
 * bir pano armatürünü sessizce panonun yanına asardı. Gerçek veride geçen yazım
 * "1 Layer Pipe Horns" — o yüzden korna işareti PARÇALI değil TAM yazılır.
 */
function panoYaniMi(metin: string): boolean {
  return [
    "SIREN",
    "SIGNAL HORN",
    "PIPE HORN",
    "KORNA",
    "BUZZER",
    "LIGHT COLUMN",
    "SIGNAL COLUMN",
    "STACK LIGHT",
    "FLOOR LIGHT",
    "IKAZ KOLONU",
    "BEACON",
    "FLOODLIGHT",
    "PROJEKTOR",
    "SAFETY SPOT",
    "LINE LIGHT",
  ].some((isaret) => metin.includes(isaret));
}

/** Sürücü ailesindeki fren direnci mi (pano dışı)? */
function frenDirenciMi(metin: string): boolean {
  return ["BRAKING RESISTOR", "BRAKE RESISTOR", "FREN DIRENC"].some((i) => metin.includes(i));
}

/** Pano sacına gömülen makine prizi mi (klemens değil)? */
function makinePriziMi(metin: string): boolean {
  return ["MACHINE PLUG", "MACHINE SOCKET", "MAKINE PRIZ", "PLUG-SOCKET"].some((i) =>
    metin.includes(i)
  );
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
    // YÜK PİMİ HALATIN/KANCANIN ÜSTÜNDEDİR. Ölçüldü: 0026'nın `TBM` panosunda
    // `LPW1` ("Crane Loadpin"), 0019'da `LPW1-65MM` — ikisi de 96 x 96 mm'lik
    // pano göstergesi sayılıp panoya giriyordu. `LOAD CELL` biliniyordu ama
    // aynı ailenin pim biçimi bilinmiyordu.
    "LOADPIN",
    "LOAD PIN",
    "YUK PIMI",
    "TRANSMITTER",
    "TRANSDUCER",
    "NPT",
    "SICAKLIK SENSOR",
    "TEMPERATURE SENSOR",
  ].some((isaret) => metin.includes(isaret));
}

/**
 * Trafo · reaktör · filtre: raya değil plakaya.
 *
 * `KVA` BİR İŞARETTİR: yalnız trafo ve UPS kVA ile anılır, anahtarlamalı güç
 * kaynağı W ile. Ölçüldü (0026): `MATIS 4000`ün tanımı yalnız "400-230V ,
 * 4kVA" diyor — ne "trafo" ne "transformer" geçiyor — ve 4 kVA'lık bir
 * kontrol trafosu DIN rayına oturuyor görünüyordu.
 */
function agirBeslemeMi(metin: string): boolean {
  return [
    "TRANSFORMER",
    "TRAFO",
    "KVA",
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
