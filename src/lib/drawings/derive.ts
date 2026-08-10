// Türev çıktılar — bir teknik resim klasörünün VAR OLUŞ SEBEBİ olan üç liste:
// satın alma, kesim (sac + profil) ve imalat.
//
// SAFTIR: DB, HTTP, dosya sistemi yok. Girdisi parça defteri ve dosya listesi,
// çıktısı sayılardır. Route handler veriyi çeker, Excel katmanı biçimler;
// burada yalnız HESAP vardır ve iki gerçek pakete karşı test edilir.
//
// ————————————————————————————————————————————————— ÜÇ TEMEL KARAR
//
// 1. HİÇBİR SATIR SESSİZCE DÜŞMEZ. Ölçüsü çıkarılamayan bir sac parçası
//    listeden atılsaydı MTC'de S355JR 60 mm ve 70 mm grupları TAMAMEN yok
//    olurdu (üç parça: iki makara, bir kare demir). Ölçüsü bilinmeyen parça
//    grubuna girer, alanı sıfır sayılmaz, `olcusuzParca` sayacıyla görünür.
//    Aynı ilke satın almada "Diğer" sınıfı için de geçerlidir.
//
// 2. ÇARPMA YAPILMAZ. Testere satırlarında `cutLengthMm` BİRİM boy değil
//    TOPLAM boydur ve defterdeki adetle sık sık çelişir (MONORAY 6 satırın
//    3'ü, MTC 23 satırın 6'sı). Sebep gerçek: adet DEPO sayfasından, toplam
//    boy ÜRÜN AĞACI'ndan gelir ve ikisi kaynağında tutarsızdır
//    (`0043-00-0100-13`: DEPO "4 adet / 94000 mm", ürün ağacı "2 adet /
//    47000 mm"). `adet × birim boy` basmak da tek başına `toplam boy` basmak
//    da yanlış olabilir; üç sayı da basılır ve uyuşmazlık İŞARETLENİR.
//
// 3. AĞIRLIK ÜST ÜSTE EKLENMEZ. Inventor'ın `Mass` sütununda montaj satırının
//    ağırlığı çocuklarının toplamına EŞİTTİR (0043-00-0100: kendi 1498,457 ×
//    2 = 2996,914 kg, 24 çocuğun toplamı 2996,920 kg). Bütün defteri toplamak
//    MTC'de 21 209 kg gibi uydurma bir sayı üretir. Toplam YALNIZ YAPRAK
//    satırlardan alınır; grup ara toplamı kökün KENDİ ağırlığındandır.
//
// 4. SATIN ALMA KİMLİĞİ TEK YERDEN GELİR — `progress.ts`ten. Bu dosya bir süre
//    kendi tekilleştirmesini `registerKey` üzerinden yapmaya çalıştı; ama
//    `register_key` kodsuz satırlarda KONUMSALDIR (`SATIR:n`) ve her satırda
//    zaten tekildir, yani o süzgeç hiçbir şeyi birleştirmiyordu. Sonuç ölçüldü:
//    aynı paket için satın alma Excel'i MTC'de 90 satır, üretim tahtası 68
//    kalem söylüyordu. `SOMUN M16 DIN934` defterde DÖRT satırdı (2 + 4 + 4 + 51)
//    ve dosyada bu dördü toplayan hiçbir hücre yoktu — satınalmacı 61'i elle
//    toplamak zorundaydı. Artık anahtar `progressKeyOf`tur (kodlu parçada kod,
//    kodsuzda `SATINALMA:<katlanmış tanım>`) ve iki belge AYNI kalemi sayar.
//    Anahtar dizgisi burada ÜÇÜNCÜ bir kez yazılmaz; ayrışırsa çatlak geri gelir.

import { isPurchaseKey, progressKeyOf } from "./progress";
import { trKatla } from "./tr-text";
import type { FileLifecycle, FileRole, PartKind } from "./types";

// —————————————————————————————————————————————————————————— girdi tipleri
//
// Girdi arayüzleri DAR tutulur ve `RegisterPart` / `ParsedFile` bunları
// YAPISAL olarak karşılar: `reconcile()` çıktısı doğrudan geçirilebilir, DB
// satırı ise route katmanında eşlenir. Çekirdeğin `reconcile.ts`e bağımlı
// olmaması, kural sürümü değişince türev hesapların da kırılmasını önler.

export interface TurevParca {
  registerKey: string;
  partCode: string;
  parentCode: string;
  itemPath: string;
  level: number;
  kind: PartKind;
  name: string;
  description: string;
  assemblyTitle: string;
  material: string;
  category: string;
  qty: number | null;
  cutLengthMm: number | null;
  thicknessMm: number | null;
  weightKg: number | null;
  hasModel: boolean;
  hasSheet: boolean;
  hasCut: boolean;
  has3d: boolean;
  sort: number;
  /** DXF extents — Faz V2 doldurur. Bugün boş gelir ve ölçü tanımdan çıkar. */
  extentsXMm?: number | null;
  extentsYMm?: number | null;
  /** Satırın hangi Excel'den geldiği; satın alma sayfasının "Kaynak" sütunu. */
  bomRef?: { file: string; sheet: string; rowNo: number } | null;
}

export interface KesimDosyasi {
  relPath: string;
  fileName: string;
  role: FileRole;
  lifecycle: FileLifecycle;
  partCode: string;
  material: string;
  thicknessMm: number | null;
  qty: number | null;
  size: number;
}

// ————————————————————————————————————————————————————— ortak yardımcılar

/** Malzemesi yazılmamış satırın grup etiketi. Boş dizge grup anahtarı olamaz. */
export const MALZEME_BILINMIYOR = "Belirtilmemiş";

function tanimOf(p: TurevParca): string {
  return p.description || p.name || p.assemblyTitle || "";
}

function malzemeOf(p: TurevParca): string {
  return p.material.trim() || MALZEME_BILINMIYOR;
}

function adetOf(p: TurevParca): number {
  return p.qty != null && Number.isFinite(p.qty) && p.qty > 0 ? p.qty : 1;
}

/**
 * Tanımdaki üçlü ölçü: "SAC 15x240x285" → 15 · 240 · 285.
 *
 * BAŞ SÖZCÜĞE bağlanmaz: `KİLİT SACI 5x10x55` iki sözcüklü bir addır ve
 * `reconcile`ın tek sözcüklü kalınlık okuyucusu onu kaçırır. Buradaki tek iş
 * EN × BOY bulmaktır; kalınlık defterin kendi alanından (`thicknessMm`)
 * okunur, çünkü o değer DXF dosya adından da gelebilir ve iki gerçek pakette
 * tanımla HİÇ çelişmedi.
 */
function olcuUclusu(text: string): { t: number; en: number; boy: number } | null {
  const m = text.match(
    /(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)/
  );
  if (!m) return null;
  const say = (s: string) => Number(s.replace(",", "."));
  const [t, en, boy] = [say(m[1]), say(m[2]), say(m[3])];
  if (![t, en, boy].every((n) => Number.isFinite(n) && n > 0)) return null;
  return { t, en, boy };
}

/**
 * Metni sözcüklerine ayırır — KATLANMIŞ hâlde.
 *
 * `trKatla` i ailesini tek harfe indirdiği ve aksanları ASCII'ye düşürdüğü
 * için sonuçta yalnız `A-Z0-9` ve simgeler kalır; ayraç olarak harf/rakam
 * dışındaki her şey kullanılabilir. Ø, parantez ve tire böylece sözcük
 * sınırıdır: "DELİK SEGMANI Ø68 DIN472" → DELIK · SEGMANI · 68 · DIN472.
 */
function sozcukler(text: string): string[] {
  return trKatla(text)
    .split(/[^0-9A-Z]+/)
    .filter(Boolean);
}

// ————————————————————————————————————————————————————— 1. Satın alma

export const SATIN_ALMA_SINIFLARI = [
  "Bağlantı Elemanı",
  "Rulman",
  "Satın Alma Ünitesi",
  "Diğer",
] as const;
export type SatinAlmaSinifi = (typeof SATIN_ALMA_SINIFLARI)[number];

/**
 * Sınıf anahtarları — SÖZCÜK ÖN EKİ olarak aranır, harf dizisi içinde DEĞİL.
 *
 * "Tanımın BAŞ SÖZCÜĞÜ" kuralı gerçek veride çöküyor: MTC'nin 90 satın alma
 * satırının 44'ü "Diğer"e düşüyordu, çünkü tanımlar "YAYLI RONDELA" (17 satır),
 * "DÜZ RONDELA", "İMBUS CİVATA", "DELİK SEGMANI Ø68 DIN472" (6 satır) gibi
 * NİTELEYİCİ ile başlıyor. Her sözcüğe bakınca "Diğer" 18'e iniyor.
 *
 * Eşleşme TAM değil ÖN EK'tir: Türkçe iyelik eki sözcüğü değiştirir
 * ("SEGMAN" → "SEGMANI"). Harf dizisi içinde arama YAPILMAZ — "PUL" bir başka
 * sözcüğün ortasına denk gelebilirdi.
 */
const BAGLANTI_ANAHTARLARI = [
  // Temel liste — iki paketin ortak çekirdeği.
  "CIVATA", "SOMUN", "RONDELA", "SEGMAN", "PUL", "GİJON", "KAMA",
  // Fikstür kanıtlı ek; listeye ancak GERÇEK bir satır gösterebilirse girer:
  "GUPİLYA", // MTC "GUPİLYA 8x63 DIN94"
];

const RULMAN_ANAHTARLARI = ["RULMAN"];

const UNITE_ANAHTARLARI = [
  // Temel liste.
  "MOTOR", "REDUKTOR", "HALAT", "LOADCELL", "PANO", "KAPLİN", "LİMİT",
  // Fikstür kanıtlı ekler:
  "TAMPON", // MONORAY "KAUÇUK TAMPON ∅30x20" · MTC "KAUÇUK TAMPON Ø50x40"
  "ARABACIK", // MTC "ARABACIK VS1028T3-86-4 (HAREKETLİ)" — feston arabası
];

/** Katlanmış anahtar listeleri — karşılaştırma her zaman katlanmış yapılır. */
const SINIF_KURALLARI: { sinif: SatinAlmaSinifi; anahtarlar: string[] }[] = [
  // SIRA ÖNCELİKTİR: "RULMAN YATAĞI SOMUNU" bir rulman kalemidir.
  { sinif: "Rulman", anahtarlar: RULMAN_ANAHTARLARI.map(trKatla) },
  { sinif: "Satın Alma Ünitesi", anahtarlar: UNITE_ANAHTARLARI.map(trKatla) },
  { sinif: "Bağlantı Elemanı", anahtarlar: BAGLANTI_ANAHTARLARI.map(trKatla) },
];

/** Tanımdan satın alma sınıfı. Hiçbir anahtar tutmazsa "Diğer" — satır DÜŞMEZ. */
export function satinAlmaSinifi(tanim: string): SatinAlmaSinifi {
  const kelimeler = sozcukler(tanim);
  for (const kural of SINIF_KURALLARI) {
    for (const k of kelimeler) {
      if (kural.anahtarlar.some((a) => k.startsWith(a))) return kural.sinif;
    }
  }
  return "Diğer";
}

/**
 * Satın alma kaleminin BİR kaynak satırı.
 *
 * Birleştirme sessiz bir kayıp olmamalıdır: `SOMUN M16` dört ayrı montajda
 * geçiyor ve satınalmacı "61 adet nereden çıktı" diye sorduğunda cevabın
 * dosyanın içinde olması gerekir. Yapısal iz satırda durur; Excel onu tek bir
 * hücreye özetler (`kaynak`).
 */
export interface SatinAlmaKaynagi {
  /** Defter anahtarı: kodlu parçada kod, kodsuzda `SATIR:n` (konumsaldır). */
  registerKey: string;
  /** Ürün ağacındaki yol: "3.14". Depo sayfasından gelen satırda boştur. */
  itemPath: string;
  /** Satırın bağlı olduğu montajın kodu; çözülemezse "" */
  montajKodu: string;
  /** Montajın adı ("KÖPRÜ YÜRÜTME GRUBU"); çözülemezse "" */
  montajAdi: string;
  /** Excel izi. DB yolunda BUGÜN BOŞ GELİR — `bomRef` sorguya girmiyor. */
  bomRef: { file: string; sheet: string; rowNo: number } | null;
  /** O satırdaki adet — birleşik adedin nasıl oluştuğu ancak böyle okunur. */
  adet: number | null;
}

export interface SatinAlmaSatiri {
  /** İlerleme anahtarı — `progress.ts` ile AYNI. İki ekran aynı kalemi sayar. */
  key: string;
  sinif: SatinAlmaSinifi;
  tanim: string;
  /** İlk dolu malzeme — `trackedParts` ile aynı davranış. */
  malzeme: string;
  /**
   * Birleşen satırlarda geçen FARKLI malzemeler; çelişki varsa uzunluk > 1.
   *
   * Aynı tanımın iki malzemeyle geçmesi gerçek bir çelişkidir ve sessizce
   * yutulmaz — Excel hücresi "S235JR / S355JR" yazar. ÖLÇÜLDÜ: iki gerçek
   * pakette de sıfır kez tetikleniyor (MONORAY 54 kalem, MTC 72 kalem), yani
   * yeni bir yanlış alarm kaynağı değil.
   */
  malzemeler: string[];
  /** Birleşen satırların adetleri TOPLANIR. */
  adet: number | null;
  /** Birleşen satırların birim ağırlığı ayrışıyorsa `null` — tek sayı yoktur. */
  birimAgirlikKg: number | null;
  /** Satır satır toplanır; birim × birleşik adet ile YENİDEN HESAPLANMAZ. */
  toplamAgirlikKg: number | null;
  parcaKodu: string;
  /** Kaç defter satırından birleşti. 1 = tekrar etmeyen kalem. */
  sourceRows: number;
  izler: SatinAlmaKaynagi[];
  /** İzlerin insan okunur özeti — Excel'in "Kaynak" sütunu. Boş olabilir. */
  kaynak: string;
}

export interface SatinAlmaSonucu {
  satirlar: SatinAlmaSatiri[];
  /** Sınıf dağılımı — künyede ve sayfa dibinde görünür. */
  siniflar: { sinif: SatinAlmaSinifi; satirSayisi: number; adet: number }[];
  toplamAdet: number;
  /** Hiçbir satırda ağırlık yoksa `null` — 0 yazmak "sıfır kilo" derdi. */
  toplamAgirlikKg: number | null;
  agirligiBilinen: number;
  malzemesiBilinen: number;
  /** Birleşmeden ÖNCEKİ defter satırı sayısı (Σ sourceRows). */
  kaynakSatiri: number;
  /** Birden çok satırdan birleşen kalem sayısı. */
  birlesenKalem: number;
  /** Parça numarası olmayan (kodsuz) kalem sayısı. */
  kodsuzKalem: number;
  /** Aynı kalemin satırlarında FARKLI malzeme geçen kalem sayısı. */
  malzemeCeliskisi: number;
}

/**
 * Satın alma kaleminin tanımı — `progress.ts`teki `label` kuralının AYNISI.
 *
 * `tanimOf` üçüncü yedek olarak `assemblyTitle` kullanır; `progress.ts`
 * kullanmaz. Bu ayrım kimlik için ölümcüldür: tanımı boş bir satır burada
 * montaj başlığıyla, tahtada `SATINALMA:?` ile anahtarlanır ve aynı kalem iki
 * ekranda iki ayrı adla — hatta iki ayrı kalem olarak — görünürdü. Montaj
 * başlığı yalnız KODLU satırda yedektir (orada anahtar zaten koddur, kimliği
 * bozmaz); kodsuz satırda yedek YOKTUR.
 */
function satinAlmaTanimi(p: TurevParca): string {
  const tanim = (p.description || p.name || "").trim();
  if (tanim) return tanim;
  return p.partCode ? p.assemblyTitle.trim() || p.partCode : "";
}

/** Ürün ağacı yolu → parça. Kaynak izindeki montaj bundan çözülür. */
function itemPathHaritasi(parts: readonly TurevParca[]): Map<string, TurevParca> {
  const harita = new Map<string, TurevParca>();
  for (const p of parts) if (p.itemPath && p.partCode) harita.set(p.itemPath, p);
  return harita;
}

/**
 * Satırın bağlı olduğu montaj — ürün ağacı yolunun üstünden yukarı doğru.
 *
 * ÖLÇÜLDÜ: MTC'nin 90 satın alma satırının 89'unda ürün ağacı yolu var ve
 * 83'ü bir montaja bağlanıyor; bağlanmayan 6'sı yolu NOKTASIZ olan (yani ürün
 * ağacının en üst düzeyindeki) satırlardır ve gerçekten bir montajın altında
 * değildir — `SOMUN M16`ın 51 adetlik dördüncü satırı bunlardan biridir.
 * MONORAY'da ürün ağacı hiç yok, orada iz Excel satırına düşer.
 *
 * DOĞRUDAN ÜST BULUNAMAZSA YUKARI TIRMANILIR. İki fikstürde de tırmanmaya
 * gerek kalmadı (çözülen 83 izin hepsi ilk adımda çözüldü); tırmanma ara
 * montajın defterde satırı olmadığı hâl içindir ve yanlış bilgi üretemez —
 * ata yine atadır. Orada durmak izi tamamen silerdi.
 */
function ustMontaj(itemPath: string, yollar: Map<string, TurevParca>): TurevParca | null {
  let yol = itemPath;
  while (yol.includes(".")) {
    yol = yol.slice(0, yol.lastIndexOf("."));
    const ust = yollar.get(yol);
    if (ust) return ust;
  }
  return null;
}

function kaynakIzi(p: TurevParca, yollar: Map<string, TurevParca>): SatinAlmaKaynagi {
  const montaj = ustMontaj(p.itemPath, yollar);
  return {
    registerKey: p.registerKey,
    itemPath: p.itemPath,
    montajKodu: montaj?.partCode ?? "",
    montajAdi: montaj
      ? (montaj.description || montaj.assemblyTitle || montaj.name || "").trim()
      : "",
    bomRef: p.bomRef ?? null,
    adet: p.qty != null && Number.isFinite(p.qty) ? p.qty : null,
  };
}

/**
 * İzlerin tek hücrelik özeti.
 *
 * MONTAJ VARSA O YAZILIR, Excel adı değil: satınalmacının sorusu "hangi
 * montajın cıvatası" olur, "hangi dosyanın 54. satırı" değil. Montaj
 * çözülemediğinde defterdeki Excel izine düşülür ve aynı sayfadan gelen
 * satırlar TEK ize toplanır — dosya adını dört kez yazmak hücreyi okunmaz
 * yapardı. Birleşme varsa her izin adedi de yazılır: "61 adet" sayısının
 * 2 + 4 + 4 + 51 olduğu ancak böyle görünür.
 */
function kaynakOzeti(izler: readonly SatinAlmaKaynagi[]): string {
  const birlesik = izler.length > 1;
  const parcalar: string[] = [];
  const sayfalar = new Map<string, string[]>();

  for (const iz of izler) {
    const adetEki = birlesik && iz.adet != null ? ` ×${iz.adet}` : "";
    if (iz.montajKodu) {
      parcalar.push(`${iz.montajKodu}${iz.itemPath ? ` (${iz.itemPath})` : ""}${adetEki}`);
    } else if (iz.itemPath) {
      parcalar.push(`ürün ağacı ${iz.itemPath}${adetEki}`);
    } else if (iz.bomRef) {
      const sayfa = `${iz.bomRef.file} · ${iz.bomRef.sheet}`;
      const satir = `${iz.bomRef.rowNo}${adetEki}`;
      const liste = sayfalar.get(sayfa);
      if (liste) liste.push(satir);
      else sayfalar.set(sayfa, [satir]);
    }
  }

  for (const [sayfa, satirlar] of sayfalar) parcalar.push(`${sayfa} · ${satirlar.join(", ")}`);
  return parcalar.join(" · ");
}

/**
 * Satın alınacaklar listesi.
 *
 * İki kaynak birleşir: `Purchased` yapısındaki satırlar ve PARÇA NUMARASI
 * OLMAYAN satırlar. İkincisi listenin büyük kısmıdır (defter satırı olarak
 * MONORAY 50/55, MTC 86/90) — cıvata, segman, rulman gibi kalemlerin kodu
 * yoktur ve onları düşürmek modülün var oluş sebebini yok ederdi.
 *
 * TEKRARLAR TEK KALEMDE BİRLEŞİR ve adetler TOPLANIR (bkz. dosya başlığı,
 * karar 4). Sipariş kararı satır başına değil KALEM başınadır. Ölçüldü:
 * MONORAY 55 satır → 54 kalem (1 birleşme), MTC 90 satır → 72 kalem
 * (11 birleşme). Toplam adet İKİSİNDE DE DEĞİŞMEZ (323 · 595): birleştirme bir
 * kayıp değil, o güne kadar yapılmamış bir toplamadır.
 *
 * AĞIRLIK SATIR SATIR TOPLANIR, birim × birleşik adet ile yeniden
 * HESAPLANMAZ: MTC'nin 90 satın alma satırının 89'unda ağırlık, yalnız
 * 24'ünde malzeme yazılı — eksik bir birim ağırlıktan geri çarpmak sessiz
 * sapma üretirdi. Ağırlığı yazılmamış satır toplama sıfır katkı yapar;
 * o kalemde artık tek bir birim ağırlık da YOKTUR ve hücre tire gösterir.
 *
 * TEDARİKÇİ VE FİYAT SÜTUNU YOKTUR. Kaynak Excel'de bu bilgi hiç geçmiyor;
 * boş bir sütun koymak dosyayı "eksik doldurulmuş" gösterirdi, uydurmak ise
 * satınalmaya yalan söylemek olurdu.
 */
export function satinAlmaListesi(parts: readonly TurevParca[]): SatinAlmaSonucu {
  const yollar = itemPathHaritasi(parts);
  const kalemler = new Map<string, SatinAlmaSatiri>();
  // Birim ağırlıklar kalem başına AYRI izlenir: satırda tek bir sayı ancak
  // BÜTÜN kaynak satırlar aynı değeri söylüyorsa yazılabilir. Satırlardan
  // birinin ağırlığı hiç yoksa da tek bir birim ağırlık yoktur — toplam o
  // satırı saymadan çıkar ve "birim × adet" ile tutmaz.
  const birimler = new Map<string, { degerler: Set<number>; satir: number }>();

  for (const p of parts) {
    if (p.kind !== "satinalma" && p.partCode) continue;

    const key = progressKeyOf(p);
    const adet = p.qty != null && Number.isFinite(p.qty) ? p.qty : null;
    const birim = p.weightKg != null && Number.isFinite(p.weightKg) ? p.weightKg : null;
    const satirAgirligi = birim == null ? null : birim * (adet ?? 1);
    const malzeme = p.material.trim();
    const iz = kaynakIzi(p, yollar);

    const varOlan = kalemler.get(key);
    if (varOlan) {
      varOlan.sourceRows += 1;
      varOlan.izler.push(iz);
      if (adet != null) varOlan.adet = (varOlan.adet ?? 0) + adet;
      if (satirAgirligi != null) {
        varOlan.toplamAgirlikKg = (varOlan.toplamAgirlikKg ?? 0) + satirAgirligi;
      }
      const izleyici = birimler.get(key);
      if (izleyici && birim != null) {
        izleyici.degerler.add(birim);
        izleyici.satir += 1;
      }
      // MALZEME İLK DOLU DEĞERDEN gelir; sonrakiler yutulmaz, listeye yazılır.
      if (malzeme && !varOlan.malzemeler.includes(malzeme)) varOlan.malzemeler.push(malzeme);
      if (!varOlan.malzeme) varOlan.malzeme = malzeme;
      continue;
    }

    const tanim = satinAlmaTanimi(p);
    birimler.set(key, {
      degerler: new Set(birim == null ? [] : [birim]),
      satir: birim == null ? 0 : 1,
    });
    kalemler.set(key, {
      key,
      sinif: satinAlmaSinifi(tanim),
      tanim,
      malzeme,
      malzemeler: malzeme ? [malzeme] : [],
      adet,
      birimAgirlikKg: birim,
      toplamAgirlikKg: satirAgirligi,
      parcaKodu: p.partCode,
      sourceRows: 1,
      izler: [iz],
      kaynak: "",
    });
  }

  const satirlar = [...kalemler.values()];
  for (const s of satirlar) {
    s.kaynak = kaynakOzeti(s.izler);
    const b = birimler.get(s.key);
    // Birim ağırlıklar ayrışıyorsa ya da bir satırın ağırlığı hiç yoksa TEK BİR
    // SAYI YOKTUR: hücre tire gösterir ve kimse toplamı geri çarpmaya çalışmaz.
    // Toplam yine satır satır toplamdır.
    s.birimAgirlikKg =
      b && b.degerler.size === 1 && b.satir === s.sourceRows ? [...b.degerler][0] : null;
  }

  const siniflar = SATIN_ALMA_SINIFLARI.map((sinif) => {
    const grup = satirlar.filter((s) => s.sinif === sinif);
    return {
      sinif,
      satirSayisi: grup.length,
      adet: grup.reduce((t, s) => t + (s.adet ?? 0), 0),
    };
  });

  const agirlikli = satirlar.filter((s) => s.toplamAgirlikKg != null);
  return {
    satirlar,
    siniflar,
    toplamAdet: satirlar.reduce((t, s) => t + (s.adet ?? 0), 0),
    toplamAgirlikKg: agirlikli.length
      ? agirlikli.reduce((t, s) => t + (s.toplamAgirlikKg ?? 0), 0)
      : null,
    agirligiBilinen: agirlikli.length,
    malzemesiBilinen: satirlar.filter((s) => s.malzeme).length,
    kaynakSatiri: satirlar.reduce((t, s) => t + s.sourceRows, 0),
    birlesenKalem: satirlar.filter((s) => s.sourceRows > 1).length,
    // "Kodsuz" sorusu artık anahtardan sorulur — `!parcaKodu` ile aynı cevabı
    // verir ama tahtayla AYNI kelimeyi kullanır.
    kodsuzKalem: satirlar.filter((s) => isPurchaseKey(s.key)).length,
    malzemeCeliskisi: satirlar.filter((s) => s.malzemeler.length > 1).length,
  };
}

// ————————————————————————————————————————————————————— 2. Sac ihtiyacı

/**
 * Yerleşim payı — TAHMİN DEĞİL GİRDİDİR.
 *
 * Net kesim alanı geometrinin kendisidir ve hesaplanabilir; sacın ne kadarının
 * fireye gideceği ise nesting yazılımının, sac boyutunun ve parça karışımının
 * işidir. Uygulama bunu bilemez. Varsayılan bir başlangıç değeridir, sayfada
 * AÇIKÇA yazar ve kullanıcı değiştirebilir.
 */
export const VARSAYILAN_YERLESIM_PAYI = 1.25;

/** Kesim yöntemi olan kategoriler — bunlardan sac kesimi beklenir. */
const KESIM_KATEGORILERI = new Set(["PLAZMA", "LAZER"]);

export interface SacParcasi {
  parcaKodu: string;
  tanim: string;
  adet: number;
  enMm: number | null;
  boyMm: number | null;
  /** en × boy × adet; ölçü çıkmadıysa 0 (ve `olculu` false). */
  alanMm2: number;
  olculu: boolean;
  /** Ölçü nereden geldi: DXF extents mi, tanım mı? */
  olcuKaynagi: "extents" | "tanim" | "";
}

export interface SacGrubu {
  malzeme: string;
  kalinlikMm: number;
  parcalar: SacParcasi[];
  parcaSayisi: number;
  adet: number;
  netAlanMm2: number;
  brutAlanMm2: number;
  olcusuzParca: number;
}

export interface SacSonucu {
  gruplar: SacGrubu[];
  yerlesimPayi: number;
  /** Payın nereden geldiği — belgede "tahmin" sanılmasın diye taşınır. */
  payKaynagi: "girdi";
  adaySayisi: number;
  olculuSayisi: number;
  olcusuzSayisi: number;
  netAlanMm2: number;
  brutAlanMm2: number;
}

/** Sac adayı mı? Montaj ve satın alma dışında, kalınlığı bilinen kesim parçası. */
function sacAdayi(p: TurevParca): boolean {
  if (p.kind === "montaj" || p.kind === "satinalma") return false;
  if (p.thicknessMm == null || !(p.thicknessMm > 0)) return false;
  return p.hasCut || KESIM_KATEGORILERI.has(trKatla(p.category));
}

/**
 * Sac ihtiyacı — malzeme × kalınlık grubu, net ve brüt alan.
 *
 * Ölçü önce DXF extents'ten (Faz V2 doldurur), yoksa tanımdaki üçlüden okunur.
 * İkisi de yoksa parça GRUBA GİRER ama alanı 0 sayılır ve `olcusuzParca`
 * sayacına yazılır: MTC'de bu üç parçayı atmak S355JR 60 mm ve 70 mm
 * gruplarını listeden tamamen silerdi.
 */
export function sacIhtiyaci(
  parts: readonly TurevParca[],
  secenekler: { yerlesimPayi?: number } = {}
): SacSonucu {
  const pay =
    secenekler.yerlesimPayi != null && Number.isFinite(secenekler.yerlesimPayi)
      ? secenekler.yerlesimPayi
      : VARSAYILAN_YERLESIM_PAYI;

  const gruplar = new Map<string, SacGrubu>();
  let adaySayisi = 0;

  for (const p of parts) {
    if (!sacAdayi(p)) continue;
    adaySayisi += 1;

    const tanim = tanimOf(p);
    const adet = adetOf(p);
    const kalinlik = p.thicknessMm as number;
    const malzeme = malzemeOf(p);

    let enMm: number | null = null;
    let boyMm: number | null = null;
    let kaynak: SacParcasi["olcuKaynagi"] = "";
    if (p.extentsXMm != null && p.extentsYMm != null && p.extentsXMm > 0 && p.extentsYMm > 0) {
      enMm = p.extentsXMm;
      boyMm = p.extentsYMm;
      kaynak = "extents";
    } else {
      const olcu = olcuUclusu(tanim);
      if (olcu) {
        enMm = olcu.en;
        boyMm = olcu.boy;
        kaynak = "tanim";
      }
    }

    const olculu = enMm != null && boyMm != null;
    const parca: SacParcasi = {
      parcaKodu: p.partCode,
      tanim,
      adet,
      enMm,
      boyMm,
      alanMm2: olculu ? (enMm as number) * (boyMm as number) * adet : 0,
      olculu,
      olcuKaynagi: kaynak,
    };

    const anahtar = `${trKatla(malzeme)}|${kalinlik}`;
    const grup = gruplar.get(anahtar) ?? {
      malzeme,
      kalinlikMm: kalinlik,
      parcalar: [],
      parcaSayisi: 0,
      adet: 0,
      netAlanMm2: 0,
      brutAlanMm2: 0,
      olcusuzParca: 0,
    };
    grup.parcalar.push(parca);
    grup.parcaSayisi += 1;
    grup.adet += adet;
    grup.netAlanMm2 += parca.alanMm2;
    if (!olculu) grup.olcusuzParca += 1;
    gruplar.set(anahtar, grup);
  }

  const sirali = [...gruplar.values()].sort(
    (a, b) => a.malzeme.localeCompare(b.malzeme, "tr") || a.kalinlikMm - b.kalinlikMm
  );
  for (const g of sirali) g.brutAlanMm2 = g.netAlanMm2 * pay;

  const net = sirali.reduce((t, g) => t + g.netAlanMm2, 0);
  const olculu = sirali.reduce(
    (t, g) => t + g.parcalar.filter((x) => x.olculu).length,
    0
  );
  return {
    gruplar: sirali,
    yerlesimPayi: pay,
    payKaynagi: "girdi",
    adaySayisi,
    olculuSayisi: olculu,
    olcusuzSayisi: adaySayisi - olculu,
    netAlanMm2: net,
    brutAlanMm2: net * pay,
  };
}

// ———————————————————————————————————————————— 3. Profil / testere kesim

export interface TestereSatiri {
  parcaKodu: string;
  tanim: string;
  malzeme: string;
  /** Tanımın boy kuyruğu atılmış hâli: "NPL 50x50x5". Sipariş anahtarı budur. */
  kesit: string;
  adet: number | null;
  birimBoyMm: number | null;
  /** Defterin kendi beyanı — kirli QTY sütunundan çözülmüş TOPLAM boy. */
  toplamBoyMm: number;
  /** adet × birim boy. Karşılaştırılamıyorsa `null`. */
  beklenenToplamMm: number | null;
  /** `null` = karşılaştıracak veri yok; `false` = iki kaynak çelişiyor. */
  tutarli: boolean | null;
}

export interface TestereKesiti {
  malzeme: string;
  kesit: string;
  satirSayisi: number;
  toplamBoyMm: number;
}

export interface TestereSonucu {
  satirlar: TestereSatiri[];
  kesitler: TestereKesiti[];
  toplamBoyMm: number;
  uyusmazlik: number;
}

/**
 * Tanımdan kesit + birim boy.
 *
 * İki yazım gerçek: `NPL 50x50x5 L=23500` (açık `L=`) ve
 * `KARE DEMİR 30x40x24000` (boy, ölçü zincirinin sonuncusu). İkincisinde son
 * sayının boy olduğunu, önünde en az iki ölçü daha bulunmasından anlarız —
 * `LAMA 120x10` gibi iki sayılı bir kesitte son sayı boy DEĞİLDİR.
 */
function kesitVeBoy(tanim: string): { kesit: string; birimBoyMm: number | null } {
  const l = tanim.match(/\s*[Ll]\s*=\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*$/i);
  if (l) {
    return {
      kesit: tanim.slice(0, l.index).trim(),
      birimBoyMm: Number(l[1].replace(",", ".")),
    };
  }
  // Üç ya da daha çok ölçülü zincirin SONU boydur: "30x40x24000".
  const zincir = tanim.match(
    /(\d+(?:[.,]\d+)?(?:\s*[xX×]\s*\d+(?:[.,]\d+)?){2,})\s*(?:mm)?\s*$/
  );
  if (zincir) {
    const sayilar = zincir[1].split(/\s*[xX×]\s*/);
    const son = Number(sayilar[sayilar.length - 1].replace(",", "."));
    const kesitKuyrugu = sayilar.slice(0, -1).join("x");
    const bas = tanim.slice(0, zincir.index).trim();
    if (Number.isFinite(son)) {
      return { kesit: `${bas} ${kesitKuyrugu}`.trim(), birimBoyMm: son };
    }
  }
  return { kesit: tanim.trim(), birimBoyMm: null };
}

/**
 * Testere ile boya kesilecek profiller.
 *
 * `cutLengthMm` kaynak Excel'de GÖRÜNMEYEN bir bilgidir: adet sütununa
 * "23500 mm" yazılmıştır ve ham değeri sayıya zorlayan bir okuyucu onu sessizce
 * yok ederdi. Doğrudan satınalmaya giden metrajın kaynağı budur.
 *
 * ÇARPMA YAPILMAZ (bkz. dosya başlığı, karar 2): satır hem `adet × birim boy`u
 * hem defterin kendi toplamını taşır, uyuşmayan satır işaretlenir. Kesit
 * özetinin toplamı DEFTERİN BEYANINDAN alınır — kaynağın kendi sayısıdır.
 */
export function testereKesim(parts: readonly TurevParca[]): TestereSonucu {
  const satirlar: TestereSatiri[] = [];

  for (const p of parts) {
    if (p.cutLengthMm == null || !Number.isFinite(p.cutLengthMm)) continue;
    const tanim = tanimOf(p);
    const { kesit, birimBoyMm } = kesitVeBoy(tanim);
    const adet = p.qty != null && Number.isFinite(p.qty) ? p.qty : null;
    const toplam = p.cutLengthMm;
    const beklenen = adet != null && birimBoyMm != null ? adet * birimBoyMm : null;
    // Tolerans: ondalık yuvarlamalar (169,3 mm) çelişki sayılmamalı.
    const tutarli =
      beklenen == null ? null : Math.abs(beklenen - toplam) <= Math.max(1, toplam * 0.001);

    satirlar.push({
      parcaKodu: p.partCode,
      tanim,
      malzeme: p.material.trim(),
      kesit,
      adet,
      birimBoyMm,
      toplamBoyMm: toplam,
      beklenenToplamMm: beklenen,
      tutarli,
    });
  }

  const kesitler = new Map<string, TestereKesiti>();
  for (const s of satirlar) {
    const malzeme = s.malzeme || MALZEME_BILINMIYOR;
    const anahtar = `${trKatla(malzeme)}|${trKatla(s.kesit)}`;
    const k = kesitler.get(anahtar) ?? {
      malzeme,
      kesit: s.kesit,
      satirSayisi: 0,
      toplamBoyMm: 0,
    };
    k.satirSayisi += 1;
    k.toplamBoyMm += s.toplamBoyMm;
    kesitler.set(anahtar, k);
  }

  return {
    satirlar,
    kesitler: [...kesitler.values()].sort(
      (a, b) => a.malzeme.localeCompare(b.malzeme, "tr") || a.kesit.localeCompare(b.kesit, "tr")
    ),
    toplamBoyMm: satirlar.reduce((t, s) => t + s.toplamBoyMm, 0),
    uyusmazlik: satirlar.filter((s) => s.tutarli === false).length,
  };
}

// ————————————————————————————————————————————————————— 4. Kesim listesi

export interface KesimDosyaSatiri {
  relPath: string;
  fileName: string;
  parcaKodu: string;
  tanim: string;
  adet: number | null;
  boyutBayt: number;
}

export interface KesimGrubu {
  malzeme: string;
  /** Kalınlığı bilinmeyen DXF'ler için `null` — grup yine oluşur. */
  kalinlikMm: number | null;
  dosyalar: KesimDosyaSatiri[];
  adet: number;
  boyutBayt: number;
  /** Hiçbir parça koduna bağlanamamış DXF'lerin grubu mu? */
  bagsiz: boolean;
}

export interface KesimSonucu {
  gruplar: KesimGrubu[];
  dosyaSayisi: number;
  boyutBayt: number;
  bagsizDosya: number;
}

/**
 * Kesimciye giden DXF listesi — malzeme × kalınlık gruplu.
 *
 * SAC İHTİYACI İLE AYNI ŞEY DEĞİLDİR ve grupları da tutmaz: biri defterin
 * (BOM) belgesi, bu ise DOSYALARIN belgesi. MONORAY'da `S355JR 35 mm` yalnız
 * burada görünür — `0057-00-0700-02` (KARE DEMİR 80x80 L=96) hem testere
 * kalemi hem DXF'lidir. İki listeyi birleştirmek, kesimciye teslim edilecek
 * dosya sayısını defterin yorumuna bağımlı kılardı.
 */
export function kesimListesi(
  parts: readonly TurevParca[],
  files: readonly KesimDosyasi[]
): KesimSonucu {
  const parcaMap = new Map<string, TurevParca>();
  for (const p of parts) if (p.partCode) parcaMap.set(p.partCode, p);

  const gruplar = new Map<string, KesimGrubu>();
  let dosyaSayisi = 0;
  let boyutBayt = 0;
  let bagsizDosya = 0;

  for (const f of files) {
    if (f.role !== "kesim" || f.lifecycle !== "canli") continue;
    dosyaSayisi += 1;
    boyutBayt += f.size;

    const p = f.partCode ? parcaMap.get(f.partCode) : undefined;
    const bagsiz = !f.partCode;
    if (bagsiz) bagsizDosya += 1;

    const malzeme = (f.material.trim() || p?.material.trim() || MALZEME_BILINMIYOR).trim();
    const kalinlik = f.thicknessMm ?? p?.thicknessMm ?? null;
    const adet = f.qty ?? p?.qty ?? null;

    const anahtar = bagsiz ? "BAGSIZ" : `${trKatla(malzeme)}|${kalinlik ?? "?"}`;
    const grup = gruplar.get(anahtar) ?? {
      malzeme: bagsiz ? MALZEME_BILINMIYOR : malzeme,
      kalinlikMm: bagsiz ? null : kalinlik,
      dosyalar: [],
      adet: 0,
      boyutBayt: 0,
      bagsiz,
    };
    grup.dosyalar.push({
      relPath: f.relPath,
      fileName: f.fileName,
      parcaKodu: f.partCode,
      tanim: p ? tanimOf(p) : "",
      adet,
      boyutBayt: f.size,
    });
    grup.adet += adet ?? 0;
    grup.boyutBayt += f.size;
    gruplar.set(anahtar, grup);
  }

  const sirali = [...gruplar.values()].sort((a, b) => {
    // Bağsız grup her zaman SONDA: kesimcinin işi önce tanınan gruplardır.
    if (a.bagsiz !== b.bagsiz) return a.bagsiz ? 1 : -1;
    return (
      a.malzeme.localeCompare(b.malzeme, "tr") || (a.kalinlikMm ?? 0) - (b.kalinlikMm ?? 0)
    );
  });
  for (const g of sirali) {
    g.dosyalar.sort((a, b) => a.fileName.localeCompare(b.fileName, "tr"));
  }

  return { gruplar: sirali, dosyaSayisi, boyutBayt, bagsizDosya };
}

// ————————————————————————————————————————————————————— 5. İmalat listesi

/** İmalat listesinde "bütün orman" seçeneğinin anahtarı. */
export const IMALAT_TUMU = "";

export interface ImalatKoku {
  partCode: string;
  /** `description` → `assemblyTitle` → `name` → kod. MONORAY'da üçü de boştur. */
  etiket: string;
  adet: number | null;
  agirlikKg: number | null;
  parcaSayisi: number;
  /** Kalem numarası paketinkiyle uyuşmuyorsa true — gizlenmez, işaretlenir. */
  baskaKalem: boolean;
  /** Üstü defterde YOK — kopmuş bir dal. Kök sayılmasaydı tamamen kaybolurdu. */
  kopuk: boolean;
}

export interface ImalatSatiri {
  partCode: string;
  duzey: number;
  tanim: string;
  malzeme: string;
  kind: PartKind;
  adet: number | null;
  birimAgirlikKg: number | null;
  toplamAgirlikKg: number | null;
  yaprak: boolean;
  hasSheet: boolean;
  hasCut: boolean;
  hasModel: boolean;
}

export interface ImalatSonucu {
  kokKod: string;
  satirlar: ImalatSatiri[];
  /** Yalnız YAPRAK satırlardan; hiç ağırlık yoksa `null`. */
  yaprakAgirlikKg: number | null;
  /** Seçili köklerin KENDİ beyan ağırlıkları; hiç yoksa `null`. */
  kokAgirlikKg: number | null;
  resimliSatir: number;
  resimsizSatir: number;
}

/** Kod → defterdeki çocukları. Ağaç `parentCode` üzerinden kurulur. */
function cocukHaritasi(parts: readonly TurevParca[]): Map<string, TurevParca[]> {
  const harita = new Map<string, TurevParca[]>();
  for (const p of parts) {
    if (!p.partCode || !p.parentCode) continue;
    const g = harita.get(p.parentCode);
    if (g) g.push(p);
    else harita.set(p.parentCode, [p]);
  }
  return harita;
}

/** Kod → parça. Ağaç yürüyüşleri bunu kullanır; `find` ile aramak karesel olurdu. */
function kodHaritasi(parts: readonly TurevParca[]): Map<string, TurevParca> {
  const harita = new Map<string, TurevParca>();
  for (const p of parts) if (p.partCode) harita.set(p.partCode, p);
  return harita;
}

/**
 * Ormanın kökleri: üstü OLMAYAN ya da üstü DEFTERDE OLMAYAN parçalar.
 *
 * İkinci koşul sessiz bir kayıp yüzünden var. MONORAY'da `0057-00-0600-00-01`
 * ürün ağacında `0057-00-0600-00`ın altındadır ama o ara montajın defterde
 * satırı yoktur; yalnız "üstü boş olan" kökleri saysaydık bu dal ve dört
 * çocuğu — beş parça — hiçbir kök seçiminde GÖRÜNMEZDİ. Kopmuş dal da bir
 * köktür; işaretlenir ama gizlenmez.
 */
function kokParcalar(parts: readonly TurevParca[]): TurevParca[] {
  const kodlar = kodHaritasi(parts);
  return parts.filter((p) => p.partCode && (!p.parentCode || !kodlar.has(p.parentCode)));
}

/**
 * İmalat listesinin kök seçenekleri.
 *
 * AĞAÇ TEK KÖKLÜ DEĞİL ORMANDIR: MONORAY'da 8, MTC'de 21 birinci düzey kök
 * var. `0057-00-0500` ve `0043-00-0000` genel görünüş resimleridir ve "paketin
 * tamamı" ANLAMINA GELMEZ — bu yüzden çağıran taraf ayrıca "Tümü" seçeneği
 * sunmalıdır.
 *
 * `paketKalemNo` verilirse kalem numarası uyuşmayan kök işaretlenir (MTC'de
 * `0043-01-0000` yanlış adlandırılmış bir Excel'den gelir). Gizlenmez: veriyi
 * saklamak, onu yok saymaktır.
 */
export function imalatKokleri(
  parts: readonly TurevParca[],
  paketKalemNo = ""
): ImalatKoku[] {
  const cocuklar = cocukHaritasi(parts);
  const kodlar = kodHaritasi(parts);

  return kokParcalar(parts).map((p) => {
    const kalem = p.partCode.split("-").slice(0, 2).join("-");
    return {
      partCode: p.partCode,
      etiket: p.description || p.assemblyTitle || p.name || p.partCode,
      adet: p.qty,
      agirlikKg: p.weightKg,
      parcaSayisi: altAgacKodlari(p.partCode, cocuklar).size,
      baskaKalem: Boolean(paketKalemNo) && kalem !== paketKalemNo,
      kopuk: Boolean(p.parentCode) && !kodlar.has(p.parentCode),
    };
  });
}

/** Kökün kendisi + bütün alt düğümleri (kod kümesi). */
function altAgacKodlari(kok: string, cocuklar: Map<string, TurevParca[]>): Set<string> {
  const kume = new Set<string>([kok]);
  const yigin = [kok];
  while (yigin.length) {
    const k = yigin.pop() as string;
    for (const c of cocuklar.get(k) ?? []) {
      if (c.partCode && !kume.has(c.partCode)) {
        kume.add(c.partCode);
        yigin.push(c.partCode);
      }
    }
  }
  return kume;
}

/**
 * İmalat listesi — seçilen alt ağacın AĞAÇ SIRALI resim listesi.
 *
 * Sıralama `p.sort`tur ve yeniden hesaplanmaz: `reconcile` onu ürün ağacı
 * varsa `item_path`e, yoksa parça koduna göre zaten vermiştir. Burada ikinci
 * bir sıralama yazmak, ekrandaki ağaç ile dosyanın sessizce ayrışması demekti.
 *
 * AĞIRLIK TOPLAMI YALNIZ YAPRAKLARDAN (bkz. dosya başlığı, karar 3).
 */
export function imalatListesi(
  parts: readonly TurevParca[],
  kokKod: string = IMALAT_TUMU
): ImalatSonucu {
  const cocuklar = cocukHaritasi(parts);
  const kodlar = kodHaritasi(parts);
  const kodlular = parts.filter((p) => p.partCode);

  const secili =
    kokKod && trKatla(kokKod) !== "TUMU"
      ? altAgacKodlari(kokKod, cocuklar)
      : new Set(kodlular.map((p) => p.partCode));

  // Düzey defterin kendi zincirinden sayılır: `level` kod segmentlerinden
  // gelir ve ürün ağacı araya düzey koymadığında (MTC `-00-` boşlukları)
  // gerçek derinliği söylemez. Üstü defterde olmayan parça 1. düzeydedir —
  // olmayan bir satıra basamak saymak listeyi bir kademe kaydırırdı.
  const derinlik = new Map<string, number>();
  const derinligiBul = (kod: string, gorulen = new Set<string>()): number => {
    const hazir = derinlik.get(kod);
    if (hazir != null) return hazir;
    if (gorulen.has(kod)) return 1; // döngüye karşı sigorta
    gorulen.add(kod);
    const p = kodlar.get(kod);
    const ust = p?.parentCode ? kodlar.get(p.parentCode) : undefined;
    const d = ust ? derinligiBul(ust.partCode, gorulen) + 1 : 1;
    derinlik.set(kod, d);
    return d;
  };

  const kokDerinligi = kokKod && secili.has(kokKod) ? derinligiBul(kokKod) - 1 : 0;

  const satirlar: ImalatSatiri[] = [];
  for (const p of [...kodlular].sort((a, b) => a.sort - b.sort)) {
    if (!secili.has(p.partCode)) continue;
    const yaprak = (cocuklar.get(p.partCode) ?? []).length === 0;
    const adet = p.qty != null && Number.isFinite(p.qty) ? p.qty : null;
    const birim = p.weightKg != null && Number.isFinite(p.weightKg) ? p.weightKg : null;
    satirlar.push({
      partCode: p.partCode,
      duzey: Math.max(1, derinligiBul(p.partCode) - kokDerinligi),
      tanim: tanimOf(p),
      malzeme: p.material.trim(),
      kind: p.kind,
      adet,
      birimAgirlikKg: birim,
      toplamAgirlikKg: birim == null ? null : birim * (adet ?? 1),
      yaprak,
      hasSheet: p.hasSheet,
      hasCut: p.hasCut,
      hasModel: p.hasModel,
    });
  }

  const yapraklar = satirlar.filter((s) => s.yaprak && s.toplamAgirlikKg != null);
  const kokSatirlari = satirlar.filter(
    (s) => s.duzey === 1 && s.toplamAgirlikKg != null
  );

  return {
    kokKod,
    satirlar,
    yaprakAgirlikKg: yapraklar.length
      ? yapraklar.reduce((t, s) => t + (s.toplamAgirlikKg ?? 0), 0)
      : null,
    kokAgirlikKg: kokSatirlari.length
      ? kokSatirlari.reduce((t, s) => t + (s.toplamAgirlikKg ?? 0), 0)
      : null,
    resimliSatir: satirlar.filter((s) => s.hasSheet).length,
    resimsizSatir: satirlar.filter((s) => !s.hasSheet).length,
  };
}
