// HAMMADDE ÇÖZÜCÜSÜ — imalat tanımından malzeme ihtiyacı.
//
// ═════════════════════════════════════════════════ NEDEN AYRI BİR ÇÖZÜCÜ
//
// `drawings/normalize.ts`teki `tanimOlculeri` BİLEREK TUTUCUDUR: yalnız Ø
// taşıyan tanımları okur ve "SAC 15x240x285" için hiçbir şey yazmaz. O kural
// doğrudur ve DEĞİŞMEZ — satın alma ekranının "İç Çap / Dış Çap" sütunlarına
// bir sac kalınlığı yazmak sayıyı anlamsız yapardı.
//
// Hammadde ise tam olarak o okunmayan yeri ister. İki sözleşmeyi tek fonksiyona
// sığdırmak `tanimOlculeri`nin kapsamını sessizce genişletirdi; `firmaKabulleri`
// ayrı bir kapı olarak durduğu gerekçenin (md. 21) aynısıyla bu da ayrı bir
// dosyadır.
//
// ═════════════════════════════════════════════════════════ TANIMA SIRASI
//
//   0. Parantezli SATIN ALMA PAYI ayıklanır  (TAMBUR BORUSU Ø405 ( Ø415)…)
//   1. Kapsam dışı satırlar elenir           (montaj · komple · hazır · kodsuz)
//   2. PROFİL önek sözlüğü                   (NPU·NPI·NPL·IPE·HEA…·kutu·lama)
//   3. RAY                                   (RAY … · KARE DEMİR …)
//   4. SAC                                   (üç ölçü + sac adı ya da kesim kategorisi)
//   5. BORU                                  (iki Ø · ya da BORU adı + Ø×et)
//   6. DOLU                                  (tek Ø)
//   7. DİĞER
//
// Sıra bir zevk değil bir ÖNCELİKtir: `NPL 120x120x10 L=2150` üç ölçü taşır ve
// önek okunmasaydı bir sac gibi görünebilirdi; `KARE DEMİR 60x40x17456` de öyle.
//
// ══════════════════════════════════════════════════════════════ İLKELER
//
// EMİN OLUNAMAYAN ÖLÇÜ BOŞ KALIR (md. 21). "AVARE KASNAK Ø250"in boyu yoktur;
// uydurulmuş bir boy, boş bir boydan çok daha pahalıdır. Satır yine de havuza
// girer ve `eksikler` alanında neyi okuyamadığını SÖYLER.
//
// ÇEKİRDEK SAFTIR: DB/HTTP/dosya sistemi importu yok.

import { trKatla, trSayi } from "@/lib/drawings/tr-text";
import { PROFIL_KESITLERI, type ProfilKesiti } from "./profil-kesitleri";
import {
  CELIK_OZKUTLE_KG_MM3,
  kaliteAyikla,
  ozkutleBul,
  payliOlcu,
  type HammaddeSinifi,
} from "./siniflar";

// ═══════════════════════════════════════════════════════════════ TİPLER

export interface HammaddeOlcusu {
  /** SAC kalınlığı · BORU et kalınlığı. */
  kalinlikMm: number | null;
  /** SAC genişliği · RAY/kutu profil kesit genişliği. */
  enMm: number | null;
  /** Kesim boyu / parça uzunluğu. */
  boyMm: number | null;
  disCapMm: number | null;
  icCapMm: number | null;
}

const BOS_OLCU: HammaddeOlcusu = {
  kalinlikMm: null,
  enMm: null,
  boyMm: null,
  disCapMm: null,
  icCapMm: null,
};

export type AgirlikKaynagi = "tablo" | "geometri" | "yok";

/**
 * PAYIN KAYNAĞI — üç hâl ve üçü de ekranda görünür.
 *
 * `ressam`  — parantez içinde verilmiş, olduğu gibi kullanılır (otoriter).
 * `otomatik`— firma kuralı: dolu ve işlenecek boruda %5, en az 2 mm.
 * `yok`     — sac, profil, ray ve STANDART BORU; kesilir, işlenmez.
 */
export type PayKaynagi = "ressam" | "otomatik" | "yok";

export interface HammaddeCozumu {
  sinif: HammaddeSinifi;
  /**
   * SATIN ALINACAK STOK KALEMİNİN ADI — BÜYÜK HARF, kalıba dizilmiş.
   *
   * Havuzun birleştirme birimi budur: `SAC 15 MM S355JR` altında yüzlerce
   * parça toplanır ve satınalmacı tek bir plaka siparişi verir.
   */
  stokTanimi: string;
  /** `trKatla(stokTanimi)` — teklif · sipariş · fiyat arşivi aynı anahtarı taşır. */
  stokAnahtari: string;
  /** Profil/ray kesit kodu: "UPN 100" · "L 50x50x5" · "A65" · "KARE 60x40". */
  kesitKodu: string;
  /** Gerçek çelik kalitesi; "Steel, Mild" gibi yer tutucular BOŞ döner. */
  kalite: string;
  /** SATIN ALINACAK ölçü — pay uygulanmış hâli. */
  olcu: HammaddeOlcusu;
  /**
   * RESİMDEKİ ölçü — ressamın yazdığı hâl.
   *
   * Pay yokken `olcu` ile aynıdır. Varken İKİSİ DE gösterilir: satınalmacı
   * "neden Ø95 sipariş ediyorum, resimde Ø90 yazıyor" sorusunu ekranda
   * cevaplayabilmelidir (kullanıcı isteği: *"verilen paylar satın almaya
   * gösterilmeli"*).
   */
  resimOlcusu: HammaddeOlcusu;
  payKaynagi: PayKaynagi;
  /** Metre ağırlığı [kg/m] — sac dışındaki sınıflarda anlamlıdır. */
  kgPerM: number | null;
  /** BİR adet parçanın ağırlığı [kg]; ölçü eksikse null. */
  birimAgirlikKg: number | null;
  agirlikKaynagi: AgirlikKaynagi;
  /** Kullanılan özkütle [kg/mm³] ve çelik varsayılıp varsayılmadığı. */
  ozkutleKgMm3: number;
  celikVarsayildi: boolean;
  /** Ressamın parantez içinde verdiği satın alma payı uygulandı mı? */
  payUygulandi: boolean;
  /** Okunamayanlar — ekran bunları uyarı olarak basar, sessizce yutmaz. */
  eksikler: string[];
}

export interface HammaddeGirdisi {
  tanim: string;
  malzeme?: string | null;
  /** Excel'in `Category` sütunu: Plazma · Lazer · Testere · Talaşlı İmalat… */
  kategori?: string | null;
  /** `drawing_parts.kind` — montaj · imalat · satinalma · bilinmiyor. */
  kind?: string | null;
  partCode?: string | null;
}

// ═══════════════════════════════════════════════════════════ YARDIMCILAR

/** Çap simgesinin dört yazımı da tek karaktere iner. */
const CAP_SIMGELERI = /[Ø∅ø⌀]/g;

function hazirla(raw: string): string {
  return raw
    .replace(CAP_SIMGELERI, "Ø")
    .replace(/[   ﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

/**
 * BOY OKUMA — `L` harfinin önündeki karakter sorulur.
 *
 * `\bL` YETMEZ ve bu gerçek bir tuzaktır: JavaScript'te `\w` yalnız ASCII'dir,
 * yani `PROFİL`in sonundaki `L` ile `İ` arasında bir SÖZCÜK SINIRI vardır.
 * "DİKDÖRTGEN KUTU PROFİL 50x30x3 L=10500" tanımında `\bL\s*=?\s*(\d+)` önce
 * `PROFİL 50`i yakalar ve boyu 50 sanır. Kapı bu yüzden "önündeki karakter
 * HARF YA DA RAKAM OLMAYACAK" biçiminde yazılır.
 *
 * İki yazım da okunur: `L=3800` ve `L3800` (canlı veride ikisi de var).
 */
const BOY_KALIBI = /(?:^|[^\p{L}\p{N}])L\s*=?\s*(\d+(?:[.,]\d+)?)/u;

function boyOku(t: string): number | null {
  const m = t.match(BOY_KALIBI);
  return m ? trSayi(m[1]) : null;
}

interface SayiJetonu {
  /** Önünde Ø var mı? */
  cap: boolean;
  deger: number;
}

/** Tanımdaki bütün sayılar, çap işareti bilgisiyle birlikte. */
function sayilar(t: string): SayiJetonu[] {
  const out: SayiJetonu[] = [];
  for (const m of t.matchAll(/(Ø)?\s*(\d+(?:[.,]\d+)?)/g)) {
    const v = trSayi(m[2]);
    if (v != null && v > 0) out.push({ cap: !!m[1], deger: v });
  }
  return out;
}

/**
 * PARANTEZ İÇİ ÖLÇÜ SATIN ALMAYA GİDEN ÖLÇÜDÜR — kullanıcı kararı.
 *
 * *"TAMBUR BORUSU Ø405 ( Ø415)/ Ø358x1870 (1900) … 405 dış çap 358 iç çap 1870
 * mm boyunda malzeme ama buna teknik ressam pay vermiş 415 dış çap, Ø358 iç çap
 * ve 1900 mm olarak satın al demek istiyor yani parantez içlerini kullan diyor
 * satın almaya."*
 *
 * Kural: bir parantez İÇİNDE TEK BİR SAYI varsa, o sayı KENDİNDEN ÖNCEKİ
 * sayının yerine geçer. Parantez metinden düşürülür ve yerine değiştirdiği
 * sayı yazılır; böylece bundan sonraki bütün kalıplar (Ø sayımı, boy okuma)
 * doğrudan SATIN ALMA ölçüsünü görür.
 *
 * Ham tanım kaybolmaz — havuz satırı `hamTanimlar` listesinde ressamın yazdığı
 * hâli taşımaya devam eder ve `payUygulandi` bayrağı ekranda görünür.
 */
function paylariUygula(t: string): { metin: string; uygulandi: boolean } {
  let uygulandi = false;
  const metin = t.replace(
    /(Ø?\s*)(\d+(?:[.,]\d+)?)(\s*(?:MM)?\s*)\(\s*(Ø?\s*)(\d+(?:[.,]\d+)?)\s*(?:MM)?\s*\)/g,
    (_tam, capOnek: string, _eski: string, ara: string, capIc: string, yeni: string) => {
      uygulandi = true;
      // Çap işareti ÖNCEKİNDEN korunur: "Ø405 ( Ø415)" ile "1870 (1900)" aynı
      // kuralla yürür ve ikincisine Ø eklemek onu bir çap sanmaya yol açardı.
      const onek = capOnek.trim() || capIc.trim() ? "Ø" : "";
      return `${onek}${yeni}${ara.trimEnd() ? " " : ""}`;
    }
  );
  return { metin: metin.replace(/\s+/g, " ").trim(), uygulandi };
}

function yuvarla(v: number, basamak = 3): number {
  const k = 10 ** basamak;
  return Math.round(v * k) / k;
}

/** Ondalıklı ölçüyü tanımda göründüğü gibi yazar: 3,25 · 100 (tr-TR). */
function olcuYaz(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}

// ══════════════════════════════════════════════════════════ KAPSAM KAPISI

/** Excel'in `Category` sütununda MONTAJ anlamına gelen değerler. */
const MONTAJ_KATEGORILERI = new Set(["KOMPLE", "HAZIR"]);

/** Parçanın PLAKADAN kesildiğini söyleyen imalat kategorileri. */
const KESIM_KATEGORILERI = new Set(["PLAZMA", "LAZER", "MAKAS", "SU JETI", "SUJETI"]);

/**
 * HAMMADDE OLMAYAN BAŞ SÖZCÜKLER.
 *
 * Liste kanıta dayanır ve KISADIR (`derive.ts` sözlüğünün kuralı). Bugün tek
 * girdisi kauçuk ray altı lastiğidir: `RAYALTI LASTİĞİ, 8x220x12000mm DKP
 * SACLI` üç ölçü taşır, kategorisi `Makas`tır ve adında `SACLI` geçer — üç
 * sinyalin üçü de onu sac sanmaya yeter. Kauçuk bir şerittir; sac plakası
 * yerleşimine girmesi yerleşimi bozar.
 *
 * Satır ATILMAZ, DİĞER'e düşer: kullanıcı onu oradan görebilir ve isterse
 * başka bir gruba taşır.
 */
const HAMMADDE_DISI_BAS = [/^RAYALTI\b/, /^LAST[İI]K\b/];

interface KapsamKarari {
  disarida: boolean;
  sinif?: HammaddeSinifi;
}

function kapsam(t: string, g: HammaddeGirdisi): KapsamKarari {
  // ARTIKSIZ BÖLME (md. 18): satın alma satırı EKİPMAN havuzundadır ve iki
  // ekranda birden görünemez. Kural `isPurchaseRow` ile birebir aynı olmalı;
  // ayrışmayı bir koruma testi engeller.
  if ((g.kind ?? "") === "satinalma") return { disarida: true };
  if (!(g.partCode ?? "").trim()) return { disarida: true };
  if ((g.kind ?? "") === "montaj") return { disarida: true };

  const kat = trKatla(g.kategori ?? "");
  if (MONTAJ_KATEGORILERI.has(kat)) return { disarida: true };

  if (HAMMADDE_DISI_BAS.some((r) => r.test(t))) return { disarida: false, sinif: "DIGER" };

  // ADI OLAN AMA ÖLÇÜSÜ DE MALZEMESİ DE OLMAYAN SATIR BİR MONTAJDIR.
  // "ARABA ŞASİ", "SPREADER BEAM", "GENEL KOMPLE" — `kind` bazen boş geliyor
  // (ürün ağacı olmayan paketlerde) ve tek ayırt edici işaret budur.
  const olcuVar = /\d/.test(t);
  if (!olcuVar && !kaliteAyikla(g.malzeme)) return { disarida: true };

  return { disarida: false };
}

// ═══════════════════════════════════════════════════════════════ PROFİL

interface ProfilEslesme {
  /** Kanonik kesit kodu — Profiller.xls'teki yazımla. */
  kod: string;
  /** Ekranda görünen kısa ad. */
  etiket: string;
  /** Tabloda yoksa geometriden metre ağırlığı [kg/m]; yoksa null. */
  geometriKgPerM?: number | null;
  enMm?: number | null;
  kalinlikMm?: number | null;
}

/**
 * NPI ≡ IPN, NPU ≡ UPN, NPL ≡ L — kullanıcı kararı.
 *
 * *"Biz NPI veya IPN kullanabiliriz aynı profil. NPU ve UPN kullanabiliriz
 * aynı profil bizim için."* Atölye Alman kısaltmasını (Normalprofil I/U/L)
 * yazıyor, standart tablosu Avrupa kodunu (IPN/UPN/L) taşıyor. Tek anahtar
 * uzayı olmasaydı aynı profil havuzda iki satır olurdu.
 */
const PROFIL_KALIPLARI: {
  re: RegExp;
  coz: (m: RegExpMatchArray) => ProfilEslesme;
}[] = [
  {
    re: /^(?:NPU|UPN)\s*(\d+)\b/,
    coz: (m) => ({ kod: `UPN ${m[1]}`, etiket: `UPN ${m[1]}` }),
  },
  {
    re: /^(?:NPI|IPN)\s*(\d+)\b/,
    coz: (m) => ({ kod: `IPN ${m[1]}`, etiket: `IPN ${m[1]}` }),
  },
  {
    re: /^UAP\s*(\d+)\b/,
    coz: (m) => ({ kod: `UAP ${m[1]}`, etiket: `UAP ${m[1]}` }),
  },
  {
    re: /^IPE\s*([AO])?\s*(\d+)\b/,
    coz: (m) => {
      const kod = m[1] ? `IPE ${m[1]} ${m[2]}` : `IPE ${m[2]}`;
      return { kod, etiket: kod };
    },
  },
  // HEA 300 · HEB 300 · HEM 300 → tablodaki yazım "HE 300 A"
  {
    re: /^HE([ABM])\s*(\d+)\b/,
    coz: (m) => ({ kod: `HE ${m[2]} ${m[1]}`, etiket: `HE${m[1]} ${m[2]}` }),
  },
  // HE 300 A · HE 100 AA — kaynak tablonun kendi yazımı
  {
    re: /^HE\s*(\d+)\s*(AA|A|B|M)\b/,
    coz: (m) => ({ kod: `HE ${m[1]} ${m[2]}`, etiket: `HE ${m[1]} ${m[2]}` }),
  },
  {
    re: /^(?:NPL|L|K[ÖO][ŞS]EBENT)\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\b/,
    coz: (m) => {
      const a = trSayi(m[1]) ?? 0;
      const b = trSayi(m[2]) ?? 0;
      const t = trSayi(m[3]) ?? 0;
      return {
        kod: `L ${olcuYaz(a)} x ${olcuYaz(b)} x ${olcuYaz(t)}`,
        etiket: `L ${olcuYaz(a)}x${olcuYaz(b)}x${olcuYaz(t)}`,
        // KÖŞEBENT ALANI YAKLAŞIKTIR: köşe yarıçapları kesit alanına katkı
        // verir ve bu yaklaşım L 50x50x5'te %1 düşük kalır. Tabloda karşılığı
        // olan boylarda ANMA değeri kazanır; bu yalnız tablonun kapsamadığı
        // küçük köşebentler için bir yedektir.
        geometriKgPerM: t > 0 ? (t * (a + b - t)) * CELIK_OZKUTLE_KG_MM3 * 1000 : null,
        enMm: a,
        kalinlikMm: t,
      };
    },
  },
  {
    re: /^KARE\s+KUTU\s+PROF[İI]L\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\b/,
    coz: (m) => kutuProfil(trSayi(m[1]), trSayi(m[2]), trSayi(m[3]), "KARE KUTU"),
  },
  {
    re: /^D[İI]KD[ÖO]RTGEN\s+KUTU\s+PROF[İI]L\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\b/,
    coz: (m) => kutuProfil(trSayi(m[1]), trSayi(m[2]), trSayi(m[3]), "KUTU"),
  },
  // LAMA ve SİLME aynı üründür (yassı çubuk); atölye ikisini de yazıyor.
  //
  // SAYININ ARDINDAKİ `MM` ATLANIR: canlı veride `LAMA 30 MMX10 MM L=1335 MM`
  // yazımı var ve birimi şart koşmayan bir kalıp onu kaçırıyordu (satır
  // DİĞER'e düşüyordu). Birim yazmak bir hata değil, bir alışkanlıktır.
  {
    re: /^(?:LAMA|S[İI]LME)\s*(\d+(?:[.,]\d+)?)\s*(?:MM)?\s*[X*]\s*(\d+(?:[.,]\d+)?)\b/,
    coz: (m) => {
      const a = trSayi(m[1]) ?? 0;
      const t = trSayi(m[2]) ?? 0;
      return {
        kod: `LAMA ${olcuYaz(a)}x${olcuYaz(t)}`,
        etiket: `LAMA ${olcuYaz(a)}x${olcuYaz(t)}`,
        geometriKgPerM: a > 0 && t > 0 ? a * t * CELIK_OZKUTLE_KG_MM3 * 1000 : null,
        enMm: a,
        kalinlikMm: t,
      };
    },
  },
];

/** Kutu profilin metre ağırlığı: (dış alan − iç alan) × özkütle. */
function kutuProfil(
  a: number | null,
  b: number | null,
  t: number | null,
  onek: string
): ProfilEslesme {
  const kod = `${onek} ${olcuYaz(a ?? 0)}x${olcuYaz(b ?? 0)}x${olcuYaz(t ?? 0)}`;
  let kgPerM: number | null = null;
  if (a && b && t && a > 2 * t && b > 2 * t) {
    const alan = a * b - (a - 2 * t) * (b - 2 * t);
    kgPerM = alan * CELIK_OZKUTLE_KG_MM3 * 1000;
  }
  return { kod, etiket: kod, geometriKgPerM: kgPerM, enMm: a, kalinlikMm: t };
}

/**
 * KÜÇÜK KESİTLER — `Profiller.xls`in KAPSAMADIĞI boylar.
 *
 * Kaynak tablo bir ÇELİK YAPI kataloğudur ve UPN'de 100'den, IPN'de 120'den
 * başlar. Atölye ise korkuluk ve konsolda UPN 60·65·80 ile IPN 80·100
 * kullanıyor (canlı veride ölçüldü: MONORAY paketinde dört ayrı satır) ve o
 * satırlar metre ağırlığı olmadan geliyordu — ekranda boş bir "kg" sütunu.
 *
 * Değerler **DIN 1026-1** (U profil) ve **DIN 1025-1** (I profil) anma
 * kütleleridir; geometriden HESAPLANAMAZLAR çünkü gövde/flanş kalınlıkları ve
 * flanş eğimi tanımın içinde yazmaz. Bu, `lib/calc/tables.ts`teki `RAILS`
 * defterinin yaptığı işin aynısıdır: standardın basılı değeri koda girer.
 *
 * Kesişim NOKTASI BİR SINAMADIR — UPN 100 ve IPN 120 iki kaynakta da var ve
 * ikisi de aynı sayıyı söylüyor (10,6 ve 11,1). Ayrışmayı bir test korur.
 */
const KUCUK_KESITLER: readonly ProfilKesiti[] = [
  { kod: "UPN 30", aile: "UPN", kgPerM: 1.74, h: 30, b: 15 },
  { kod: "UPN 30 x 33", aile: "UPN", kgPerM: 4.27, h: 30, b: 33 },
  { kod: "UPN 40 x 20", aile: "UPN", kgPerM: 2.87, h: 40, b: 20 },
  { kod: "UPN 40", aile: "UPN", kgPerM: 4.87, h: 40, b: 35 },
  { kod: "UPN 50 x 25", aile: "UPN", kgPerM: 3.86, h: 50, b: 25 },
  { kod: "UPN 50", aile: "UPN", kgPerM: 5.59, h: 50, b: 38 },
  { kod: "UPN 60", aile: "UPN", kgPerM: 5.07, h: 60, b: 30 },
  { kod: "UPN 65", aile: "UPN", kgPerM: 7.09, h: 65, b: 42 },
  { kod: "UPN 80", aile: "UPN", kgPerM: 8.64, h: 80, b: 45 },
  { kod: "IPN 80", aile: "IPN", kgPerM: 5.94, h: 80, b: 42 },
  { kod: "IPN 100", aile: "IPN", kgPerM: 8.34, h: 100, b: 50 },
];

/** Kanonik koda göre tablo araması — boşluk ve büyük/küçük harf duyarsız. */
const KESIT_DIZINI = new Map<string, ProfilKesiti>(
  // ÜRETİLMİŞ TABLO ÖNCE YAZILIR, EK SONRA GELİR ama ÇAKIŞMAZ: `set` ikinciyi
  // kazandırırdı, o yüzden ek yalnız tabloda OLMAYAN kodları doldurur.
  PROFIL_KESITLERI.map((k) => [trKatla(k.kod).replace(/\s+/g, ""), k])
);
for (const k of KUCUK_KESITLER) {
  const anahtar = trKatla(k.kod).replace(/\s+/g, "");
  if (!KESIT_DIZINI.has(anahtar)) KESIT_DIZINI.set(anahtar, k);
}

function kesitBul(kod: string): ProfilKesiti | undefined {
  return KESIT_DIZINI.get(trKatla(kod).replace(/\s+/g, ""));
}

// ══════════════════════════════════════════════════════════════════ RAY

/**
 * VİNÇ RAYI METRE AĞIRLIĞI — DIN 536-1 Form A anma kütleleri.
 *
 * Tablo `lib/calc/tables.ts`teki `RAILS`in ta kendisidir ve ORAYA BAĞLANMAZ:
 * hesap motoru saf bir mühendislik katmanıdır, satın alma ondan veri çekmeye
 * başlarsa iki modül birbirine kilitlenir. Değerler AYNIDIR ve ayrışmalarını
 * bir test engeller (`__tests__/cozumle.test.ts`).
 */
const RAY_KG_PER_M: Record<string, number> = {
  A45: 22.1,
  A55: 31.8,
  A65: 43.1,
  A75: 56.2,
  A100: 74.3,
  A120: 100.0,
  A150: 150.2,
};

// ═══════════════════════════════════════════════════════════ ANA FONKSİYON

export function hammaddeCozumle(girdi: HammaddeGirdisi): HammaddeCozumu | null {
  const ham = hazirla(girdi.tanim ?? "");
  if (!ham) return null;

  const karar = kapsam(ham, girdi);
  if (karar.disarida) return null;

  const { metin: t, uygulandi: payUygulandi } = paylariUygula(ham);
  const kalite = kaliteAyikla(girdi.malzeme);
  const ozkutle = ozkutleBul(girdi.malzeme);
  const kat = trKatla(girdi.kategori ?? "");
  const eksikler: string[] = [];

  const bitir = (
    sinif: HammaddeSinifi,
    parcalar: {
      kesitKodu?: string;
      olcu?: Partial<HammaddeOlcusu>;
      /**
       * Metre ağırlığı — sabit ya da ÖLÇÜDEN üretilen.
       *
       * Pay alan sınıflarda fonksiyon verilir: sipariş edilen çubuk Ø95'tir,
       * ağırlığı Ø90'dan hesaplamak %11 eksik bir tonaj yazdırırdı.
       */
      kgPerM?: number | null | ((o: HammaddeOlcusu) => number | null);
      agirlikKaynagi?: AgirlikKaynagi;
      /** Stok kaleminin kalite HARİÇ adı; sabit ya da ölçüden üretilen. */
      govde: string | ((o: HammaddeOlcusu) => string);
      /**
       * Kesit kodu — sabit ya da ölçüden üretilen.
       *
       * Pay alan sınıflarda SATIN ALMA ölçüsünden üretilir: havuz bir satın
       * alma ekranıdır ve "Ölçü" sütunuyla stok adının farklı bir çap
       * göstermesi (Ø22 ile Ø24) okuyanı hangisinin sipariş edileceği
       * konusunda tereddüde düşürürdü. Resimdeki ölçü açılır ayrıntıda,
       * kendi sütununda durur.
       */
      kesitKoduUret?: (o: HammaddeOlcusu) => string;
      /**
       * TALAŞLI İMALAT PAYI UYGULANSIN MI?
       *
       * Yalnız DOLU ve İŞLENECEK BORU (iki çaplı burç/bilezik) için açılır.
       * Sac, profil, ray ve STANDART BORU kesilir, işlenmez — onlarda pay
       * fireyi büyütmekten başka bir işe yaramaz.
       *
       * Ressam kendi payını verdiyse (`payUygulandi`) ÜSTÜNE EKLENMEZ: onun
       * sayısı bir karardır, bizimki bir kuraldır ve karar kuralı yener.
       */
      otomatikPay?: boolean;
    }
  ): HammaddeCozumu => {
    const resimOlcusu: HammaddeOlcusu = { ...BOS_OLCU, ...(parcalar.olcu ?? {}) };

    // PAY YALNIZ DIŞ ÇAPA VE BOYA UYGULANIR, İÇ ÇAPA DEĞİL.
    // Kanıt ressamın kendi yazımıdır: `Ø405 ( Ø415)/ Ø358x1870 (1900)` —
    // dış çap ve boy büyümüş, iç çap AYNI kalmış. Deliği büyütmek onu
    // küçültmek kadar yanlış olurdu; iç çap işlemede zaten açılır.
    const otomatik = Boolean(parcalar.otomatikPay) && !payUygulandi;
    const olcu: HammaddeOlcusu = otomatik
      ? {
          ...resimOlcusu,
          disCapMm: payliOlcu(resimOlcusu.disCapMm) ?? resimOlcusu.disCapMm,
          boyMm: payliOlcu(resimOlcusu.boyMm) ?? resimOlcusu.boyMm,
        }
      : resimOlcusu;

    const payKaynagi: PayKaynagi = payUygulandi ? "ressam" : otomatik ? "otomatik" : "yok";

    const kgPerM =
      typeof parcalar.kgPerM === "function" ? parcalar.kgPerM(olcu) : (parcalar.kgPerM ?? null);
    let birimAgirlikKg: number | null = null;
    if (sinif === "SAC") {
      if (olcu.kalinlikMm && olcu.enMm && olcu.boyMm) {
        birimAgirlikKg = yuvarla(olcu.kalinlikMm * olcu.enMm * olcu.boyMm * ozkutle.kgMm3);
      }
    } else if (kgPerM != null && olcu.boyMm) {
      // kgPerM ÇELİK tablosundandır; başka bir malzemede oran düzeltilir.
      const oran = ozkutle.kgMm3 / CELIK_OZKUTLE_KG_MM3;
      birimAgirlikKg = yuvarla((kgPerM * oran * olcu.boyMm) / 1000);
    }

    const govde = typeof parcalar.govde === "function" ? parcalar.govde(olcu) : parcalar.govde;
    const stokTanimi = [govde, kalite].filter(Boolean).join(" ");
    if (!kalite && sinif !== "DIGER") eksikler.push("kalite yazılmamış");

    return {
      sinif,
      stokTanimi,
      stokAnahtari: trKatla(stokTanimi),
      kesitKodu: parcalar.kesitKoduUret ? parcalar.kesitKoduUret(olcu) : (parcalar.kesitKodu ?? ""),
      kalite,
      olcu,
      resimOlcusu,
      payKaynagi,
      kgPerM,
      birimAgirlikKg,
      agirlikKaynagi: parcalar.agirlikKaynagi ?? (kgPerM == null ? "yok" : "geometri"),
      ozkutleKgMm3: ozkutle.kgMm3,
      celikVarsayildi: ozkutle.celikVarsayildi,
      payUygulandi: payKaynagi !== "yok",
      eksikler,
    };
  };

  if (karar.sinif === "DIGER") {
    return bitir("DIGER", { govde: t, agirlikKaynagi: "yok" });
  }

  const jetonlar = sayilar(t);
  const caplar = jetonlar.filter((j) => j.cap).map((j) => j.deger);
  const boy = boyOku(t);

  // ───────────────────────────────────────────────────── 2. PROFİL
  for (const kalip of PROFIL_KALIPLARI) {
    const m = t.match(kalip.re);
    if (!m) continue;
    const p = kalip.coz(m);
    const tablo = kesitBul(p.kod);
    const kgPerM = tablo?.kgPerM ?? p.geometriKgPerM ?? null;
    const kaynak: AgirlikKaynagi = tablo ? "tablo" : kgPerM != null ? "geometri" : "yok";
    if (kgPerM == null) eksikler.push("metre ağırlığı bulunamadı");
    const kesimBoyu = boy ?? sonSayi(t, m[0]);
    if (kesimBoyu == null) eksikler.push("kesim boyu okunamadı");
    return bitir("PROFIL", {
      kesitKodu: p.etiket,
      govde: p.etiket,
      kgPerM,
      agirlikKaynagi: kaynak,
      olcu: {
        boyMm: kesimBoyu,
        enMm: p.enMm ?? tablo?.h ?? null,
        kalinlikMm: p.kalinlikMm ?? null,
      },
    });
  }

  // ───────────────────────────────────────────────────────── 3. RAY
  if (/^RAY\b/.test(t)) {
    // "RAY - A65 - DIN536 GRADE 70 L=12000" → kesit kodu A serisi rayıdır.
    const seri = t.match(/\bA\s?(45|55|65|75|100|120|150)\b/);
    const kod = seri ? `A${seri[1]}` : "";
    const kgPerM = kod ? (RAY_KG_PER_M[kod] ?? null) : null;
    if (!kod) eksikler.push("ray kesiti okunamadı");
    return bitir("RAY", {
      kesitKodu: kod,
      govde: kod ? `RAY ${kod}` : t,
      kgPerM,
      agirlikKaynagi: kgPerM == null ? "yok" : "tablo",
      olcu: { boyMm: boy ?? sonSayi(t, "RAY") },
    });
  }
  if (/^KARE\s+DEM[İI]R\b/.test(t)) {
    // "KARE DEMİR 60x40x17456" → kesit 60x40, boy 17456.
    // "KARE DEMİR 130x130 L=214" → kesit 130x130, boy 214.
    const kesit = t.match(/(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)/);
    const a = kesit ? trSayi(kesit[1]) : null;
    const b = kesit ? trSayi(kesit[2]) : null;
    const ucuncu = t.match(
      /(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)/
    );
    const kesimBoyu = boy ?? (ucuncu ? trSayi(ucuncu[3]) : null);
    const kgPerM = a && b ? yuvarla(a * b * CELIK_OZKUTLE_KG_MM3 * 1000) : null;
    if (kgPerM == null) eksikler.push("ray kesiti okunamadı");
    if (kesimBoyu == null) eksikler.push("kesim boyu okunamadı");
    return bitir("RAY", {
      kesitKodu: a && b ? `KARE ${olcuYaz(a)}x${olcuYaz(b)}` : "",
      govde: a && b ? `RAY KARE ${olcuYaz(a)}x${olcuYaz(b)}` : t,
      kgPerM,
      agirlikKaynagi: kgPerM == null ? "yok" : "geometri",
      olcu: { enMm: a, kalinlikMm: b, boyMm: kesimBoyu },
    });
  }

  // ────────────────────────────────────────────────────────── 4. SAC
  //
  // ADI "SAC" OLMAYAN SAC PARÇASI ÇOKTUR ve bunlar kaybolmamalı: `KAPAK-1
  // 30x190x190`, `EMNIYET PULU 8x50x50`, `RULMAN YATAĞI 40x240x240`. Üçünün de
  // kategorisi `Plazma`dır — yani KESİM YÖNTEMİ, parçanın plakadan çıktığını
  // adından daha güvenilir söyler. İki tanık: ad ya da kategori.
  const ucOlcu = t.match(
    /(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)\s*(?:MM)?\s*$/
  );
  const sacAdi = /(?:^|\s)(SAC|LEVHA|PL)(?:\s|$)/.test(t) || /^B[ÜU]K[ÜU]ML[ÜU]\s+SAC\b/.test(t);
  if (caplar.length === 0 && ucOlcu && (sacAdi || KESIM_KATEGORILERI.has(kat))) {
    const kalinlik = trSayi(ucOlcu[1]);
    const en = trSayi(ucOlcu[2]);
    const uzun = trSayi(ucOlcu[3]);
    return bitir("SAC", {
      govde: kalinlik != null ? `SAC ${olcuYaz(kalinlik)} MM` : "SAC",
      kesitKodu: kalinlik != null ? `${olcuYaz(kalinlik)} mm` : "",
      agirlikKaynagi: "geometri",
      olcu: { kalinlikMm: kalinlik, enMm: en, boyMm: uzun },
    });
  }
  // İki ölçülü sac: kalınlık YOKTUR ve uydurulmaz — satır DİĞER'e düşer ve
  // nedenini söyler. Plaka siparişi kalınlıksız verilemez.
  if (caplar.length === 0 && sacAdi && !ucOlcu) {
    eksikler.push("sac kalınlığı okunamadı");
    return bitir("DIGER", { govde: t, agirlikKaynagi: "yok" });
  }

  // ───────────────────────────────────────────────────────── 5. BORU
  if (caplar.length >= 2) {
    // İKİ Ø = İÇİ BOŞ. Küçük olan iç, büyük olan dış çaptır (kullanıcı kuralı
    // ve `tanimOlculeri` ile aynı) — sıraya güvenilmez: canlı veride hem
    // "Ø140xØ90" hem "Ø8xØ10" yazımı var.
    //
    // BU FORM İŞLENİR: burç, bilezik, tambur borusu — tornaya bağlanacak bir
    // parçadır ve talaşlı imalat payı alır.
    const dis = Math.max(...caplar);
    const ic = Math.min(...caplar);
    const kesimBoyu = boy ?? sonCaptanSonra(t);
    if (kesimBoyu == null) eksikler.push("boy okunamadı");
    const kgPerM =
      dis > ic ? yuvarla(((Math.PI / 4) * (dis * dis - ic * ic) * CELIK_OZKUTLE_KG_MM3 * 1000)) : null;
    return bitir("BORU", {
      kesitKoduUret: (o) => `Ø${olcuYaz(o.disCapMm ?? dis)}/Ø${olcuYaz(o.icCapMm ?? ic)}`,
      govde: (o) => `BORU Ø${olcuYaz(o.disCapMm ?? dis)}/Ø${olcuYaz(o.icCapMm ?? ic)}`,
      kgPerM: (o) => {
        const D = o.disCapMm ?? dis;
        const d = o.icCapMm ?? ic;
        return D > d ? yuvarla((Math.PI / 4) * (D * D - d * d) * CELIK_OZKUTLE_KG_MM3 * 1000) : null;
      },
      agirlikKaynagi: kgPerM == null ? "yok" : "geometri",
      olcu: { disCapMm: dis, icCapMm: ic, boyMm: kesimBoyu },
      otomatikPay: true,
    });
  }
  if (/^(?:D[İI]K[İI][ŞS]L[İI]|D[İI]K[İI][ŞS]S[İI]Z)?\s*BORU\b/.test(t) && caplar.length === 1) {
    // "DİKİŞLİ BORU Ø33,7x3,25 L=13774" → dış çap × ET KALINLIĞI.
    //
    // BU FORMA PAY VERİLMEZ (kullanıcı kararı): *"DİKİŞLİ BORU Ø33 bu korkuluk
    // borusu buna pay vermeye gerek yok."* Ayrım YAPISALDIR, ad araması değil:
    // dış çap × et kalınlığı yazımı STANDART BİR BORU PROFİLİDİR — katalogdan
    // olduğu gibi alınır ve boyuna kesilir, tornaya bağlanmaz. İki çaplı yazım
    // (burç, bilezik) ise işlenecek bir parçadır ve pay alır.
    const m = t.match(/Ø\s*(\d+(?:[.,]\d+)?)\s*[X*]\s*(\d+(?:[.,]\d+)?)/);
    if (m) {
      const dis = trSayi(m[1]) ?? 0;
      const et = trSayi(m[2]) ?? 0;
      const ic = dis - 2 * et;
      const kesimBoyu = boy ?? sonSayi(t, m[0]);
      if (kesimBoyu == null) eksikler.push("boy okunamadı");
      const kgPerM =
        ic > 0
          ? yuvarla((Math.PI / 4) * (dis * dis - ic * ic) * CELIK_OZKUTLE_KG_MM3 * 1000)
          : null;
      return bitir("BORU", {
        kesitKodu: `Ø${olcuYaz(dis)}x${olcuYaz(et)}`,
        govde: `BORU Ø${olcuYaz(dis)}x${olcuYaz(et)}`,
        kgPerM,
        agirlikKaynagi: kgPerM == null ? "yok" : "geometri",
        olcu: { disCapMm: dis, icCapMm: ic > 0 ? ic : null, kalinlikMm: et, boyMm: kesimBoyu },
      });
    }
  }

  // ───────────────────────────────────────────────────────── 6. DOLU
  if (caplar.length === 1) {
    const cap = caplar[0];
    const kesimBoyu = boy ?? sonCaptanSonra(t);
    if (kesimBoyu == null) eksikler.push("boy okunamadı");
    // METRE AĞIRLIĞI PAYLI ÇAPTAN hesaplanır (`bitir` içinde): sipariş edilen
    // çubuk odur. Burada verilen değer resim çapına göredir ve pay varsa
    // aşağıda yeniden kurulur.
    return bitir("DOLU", {
      kesitKoduUret: (o) => `Ø${olcuYaz(o.disCapMm ?? cap)}`,
      govde: (o) => `DOLU Ø${olcuYaz(o.disCapMm ?? cap)}`,
      kgPerM: (o) => {
        const D = o.disCapMm ?? cap;
        return yuvarla((Math.PI / 4) * D * D * CELIK_OZKUTLE_KG_MM3 * 1000);
      },
      agirlikKaynagi: "geometri",
      olcu: { disCapMm: cap, boyMm: kesimBoyu },
      otomatikPay: true,
    });
  }

  // ───────────────────────────────────────────────────────── 7. DİĞER
  return bitir("DIGER", { govde: t, agirlikKaynagi: "yok" });
}

/**
 * TEK ÇAPLI YAZIMDA BOY: son çaptan sonra gelen ilk sayı ("MİL Ø75x235").
 *
 * ÇİFT ÇAPLI YAZIMDA DA GEÇERLİDİR ama orada son sayı çoğu zaman boydur
 * ("İÇ BİLEZİK Ø80xØ65x35" → 35). İkisini ayıran şey `Ø`nun SON geçtiği yerdir:
 * ondan sonrası artık çap değildir.
 */
function sonCaptanSonra(t: string): number | null {
  const i = t.lastIndexOf("Ø");
  if (i < 0) return null;
  const kalan = t.slice(i);
  const m = kalan.match(/Ø\s*\d+(?:[.,]\d+)?\s*(?:MM)?\s*[X*/]\s*(\d+(?:[.,]\d+)?)/);
  return m ? trSayi(m[1]) : null;
}

/** Bir önekten SONRA gelen son sayı — profil/ray kesim boyunun yedeği. */
function sonSayi(t: string, onek: string): number | null {
  const i = t.indexOf(onek);
  const kalan = i < 0 ? t : t.slice(i + onek.length);
  const hepsi = [...kalan.matchAll(/(\d+(?:[.,]\d+)?)/g)];
  if (hepsi.length === 0) return null;
  return trSayi(hepsi[hepsi.length - 1][1]);
}
