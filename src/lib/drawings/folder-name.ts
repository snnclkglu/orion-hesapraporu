// Klasör adı çözümleme — paketin ve alt bölümlerin kimliği.
//
// Dört tanıyıcı ve bir içerikten çıkarım. Hiçbiri tutmazsa paket YİNE AÇILIR:
// adı olduğu gibi görünür, kalem numarasını sihirbaz sorar. Klasörünü doğru
// adlandırmamış olmak, dosyalarını sisteme koyamamak anlamına gelmez.

import { parsePartCode, type PartCode } from "./part-code";
import { recognize, type Recognized, type Recognizer } from "./recognize";
import { trBuyuk, trKatla } from "./tr-text";

export interface FolderName {
  /** Normalize tam kod: "0057-00-0500". Çözülemediyse "" */
  code: string;
  job: string;
  suffix: string;
  /** Kalem numarası: "0057-00" */
  itemNo: string;
  /** Kalemden sonraki segmentler birleşik: "0500" / "0802-00" */
  group: string;
  /** "MONORAY" · "MTC PASLANMAZ" · "BARA AKIM ALMA KOLU" */
  description: string;
  /** Parantez içi kapasite: "1 TON". Yoksa "" */
  capacity: string;
  /** Ad sonundaki üretim durumu ipucu: "KESİLDİ". Yoksa "" */
  statusHint: string;
}

/**
 * Ressamın klasör adına yazdığı üretim durumları.
 *
 * `DXF\0043-00-0100 - ANA KIRIS - KESİLDİ\` gerçek bir klasördür: atölye
 * durumu bir yere yazma ihtiyacı duyuyor ve elindeki tek yer klasör adı. Bunu
 * "standart dışı" sayıp uyarı basmak yanlış olurdu — bu bir ihtiyacın
 * kanıtıdır. Sistem okur, kaydeder ve Faz 5'te durum defterini ön-doldurmak
 * için kullanır.
 */
const DURUM_SOZCUKLERI = new Set(
  // Katlanmış olarak tutulur: noktalı/noktasız ve aksanlı/aksansız yazımların
  // hepsi tek girdiye iner, listeyi iki katına çıkarmaya gerek kalmaz.
  ["KESİLDİ", "YAPILDI", "BİTTİ", "TAMAM", "TAMAMLANDI", "İMAL EDİLDİ", "BÜKÜLDÜ"].map(trKatla)
);

/** Sondaki "(1 TON)" gibi parantezi ayırır. */
function kapasiteAyir(text: string): { rest: string; capacity: string } {
  const m = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return { rest: text.trim(), capacity: "" };
  return { rest: m[1].trim(), capacity: m[2].trim() };
}

/** Sondaki " - KESİLDİ" gibi durum ipucunu ayırır. */
function durumAyir(text: string): { rest: string; statusHint: string } {
  const parcalar = text.split(/\s+-\s+/);
  if (parcalar.length < 2) return { rest: text.trim(), statusHint: "" };
  const son = parcalar[parcalar.length - 1];
  if (!DURUM_SOZCUKLERI.has(trKatla(son))) return { rest: text.trim(), statusHint: "" };
  // Karşılaştırma KATLANMIŞ, saklanan değer ise ressamın YAZDIĞI hâldir:
  // ekranda "KESILDI" değil "KESİLDİ" görünmeli.
  return { rest: parcalar.slice(0, -1).join(" - ").trim(), statusHint: trBuyuk(son.trim()) };
}

function kur(kod: PartCode, kuyruk: string): FolderName {
  const { rest: durumsuz, statusHint } = durumAyir(kuyruk);
  const { rest, capacity } = kapasiteAyir(durumsuz);
  return {
    code: kod.code,
    job: kod.job,
    suffix: kod.suffix,
    itemNo: kod.itemNo,
    group: kod.segments.join("-"),
    description: rest,
    capacity,
    statusHint,
  };
}

/**
 * Kod ile ad arasındaki ayraç desenleri.
 *
 * Sıra ÖNEMLİ: en bilgilendirici ayraç (" - ") önce denenir. Alt çizgi ondan
 * sonra gelir çünkü kod içinde tire zaten var ve gevşek bir tire kuralı
 * `0057-00-0500`ün kendisini kod+ad diye bölerdi.
 */
const AYRACLAR: { id: string; sep: RegExp }[] = [
  { id: "klasor.tireli", sep: /^(\S+)\s+-\s+(.+)$/ },
  { id: "klasor.altcizgili", sep: /^([^\s_]+)_(.+)$/ },
  { id: "klasor.bosluklu", sep: /^(\S+)\s+(.+)$/ },
];

const TANIYICILAR: Recognizer<string, FolderName>[] = [
  ...AYRACLAR.map(({ id, sep }) => ({
    id,
    try(raw: string): FolderName | null {
      const m = raw.trim().match(sep);
      if (!m) return null;
      const kod = parsePartCode(m[1]);
      return kod ? kur(kod, m[2]) : null;
    },
  })),
  {
    // Yalnız kod: "0057-00-0500". Ad yok, sorun değil.
    id: "klasor.yalnizkod",
    try(raw: string): FolderName | null {
      const kod = parsePartCode(raw.trim());
      return kod ? kur(kod, "") : null;
    },
  },
];

/** Klasör adını çözer. Tutan tanıyıcının kimliği `by`de döner. */
export function parseFolderName(raw: string): Recognized<FolderName> {
  return recognize(TANIYICILAR, raw.normalize("NFC"));
}

/**
 * Adında kod olmayan klasörün kodunu İÇERİĞİNDEN çıkarır.
 *
 * `HALAT KLAVUZU (Ø325)` gerçek bir klasördür ve adında hiç kod yoktur — ama
 * içindeki yedi dosyanın hepsi `0043-00-0850…` der. Klasörü "tanınmadı"
 * saymak, elimizdeki cevaba bakmamak olurdu.
 *
 * Kural: bütün kodlar aynı kaleme aitse ve ORTAK bir segment öneki varsa o
 * önek klasörün kodudur. Ortak önek yoksa `null` döner — `İSLEME RESİMLERİ`
 * gibi ENİNE bir klasör tek bir gruba ait değildir ve ona zorla bir grup
 * atamak yanlış bir ağaç kurardı.
 */
export function folderCodeFromContents(fileNames: readonly string[]): string | null {
  const kodlar = fileNames
    .map((ad) => parsePartCode(ad.replace(/\.[^.]+$/, "").trim()))
    .filter((k): k is PartCode => k != null && k.segments.length > 0);

  if (kodlar.length === 0) return null;

  const itemNo = kodlar[0].itemNo;
  if (kodlar.some((k) => k.itemNo !== itemNo)) return null;

  const ortak: string[] = [];
  const enKisa = Math.min(...kodlar.map((k) => k.segments.length));
  for (let i = 0; i < enKisa; i++) {
    const s = kodlar[0].segments[i];
    if (kodlar.every((k) => k.segments[i] === s)) ortak.push(s);
    else break;
  }

  return ortak.length > 0 ? `${itemNo}-${ortak.join("-")}` : null;
}

/**
 * Sonradan eklenen bir dosya PAKETİN NERESİNE düşmeli?
 *
 * Ressam sonradan tek bir resim çiziyor ya da bir resmin yeni sürümünü
 * veriyor. Bugüne kadar tek yol bütün klasörü (200 MB) yeniden yüklemekti ve o
 * da ikinci bir paket açıyordu.
 *
 * HEDEF TAHMİN EDİLİR, SORULMAZ — ama değiştirilebilir. Öneri paketin GERÇEK
 * klasör ağacından kurulur; uydurma bir yol AÇILMAZ. Ressamın kurduğu düzen
 * sistemin uydurduğu bir düzene çevrilmez (dosya gezgininin var oluş
 * gerekçesiyle aynı ilke) — bu yüzden aday listesi yalnız var olan
 * klasörlerdir ve hiçbiri uymazsa `""` döner, yani kullanıcı seçer.
 *
 * Sıralama en özelden en genele:
 *   1. malzeme + kalınlık ikisi birden geçen klasör  (`DXF/S235JR-8MM`)
 *   2. yalnız malzeme geçen klasör
 *   3. aynı ROLDEN dosyaların EN ÇOK bulunduğu klasör (`DWG/` resimler için)
 */
export function suggestFolder(
  file: { role: string; material: string; thicknessMm: number | null },
  folders: readonly { folder: string; role: string }[]
): string {
  const adlar = [...new Set(folders.map((f) => f.folder))].filter((f) => f !== "");
  if (adlar.length === 0) return "";

  const malzeme = trKatla(file.material).replace(/\s+/g, "");
  const kalinlik = file.thicknessMm == null ? "" : String(file.thicknessMm).replace(/\.0+$/, "");

  if (malzeme) {
    const katlanmis = adlar.map((a) => ({ ad: a, k: trKatla(a).replace(/\s+/g, "") }));
    if (kalinlik) {
      const tam = katlanmis.find((a) => a.k.includes(malzeme) && a.k.includes(`${kalinlik}MM`));
      if (tam) return tam.ad;
    }
    const yalnizMalzeme = katlanmis.find((a) => a.k.includes(malzeme));
    if (yalnizMalzeme) return yalnizMalzeme.ad;
  }

  // Aynı rolden dosyaların en yoğun olduğu klasör. Rol tek başına zayıf bir
  // ipucudur ama "hangi klasörde resim duruyor" sorusunun cevabı budur.
  const sayac = new Map<string, number>();
  for (const f of folders) {
    if (f.role !== file.role || f.folder === "") continue;
    sayac.set(f.folder, (sayac.get(f.folder) ?? 0) + 1);
  }
  let enCok = "";
  let enCokSayi = 0;
  for (const [ad, n] of sayac) {
    if (n > enCokSayi) {
      enCokSayi = n;
      enCok = ad;
    }
  }
  return enCok;
}

/** İçerikten çıkarılan kodu bir `FolderName`e çevirir (ad klasörün adıdır). */
export function folderNameFromContents(
  raw: string,
  fileNames: readonly string[]
): Recognized<FolderName> {
  const kodMetni = folderCodeFromContents(fileNames);
  const kod = kodMetni ? parsePartCode(kodMetni) : null;
  if (!kod) return { value: null, by: "" };
  const { rest, capacity } = kapasiteAyir(raw.normalize("NFC").trim());
  return {
    value: {
      code: kod.code,
      job: kod.job,
      suffix: kod.suffix,
      itemNo: kod.itemNo,
      group: kod.segments.join("-"),
      description: rest,
      capacity,
      statusHint: "",
    },
    by: "klasor.icerikten",
  };
}
