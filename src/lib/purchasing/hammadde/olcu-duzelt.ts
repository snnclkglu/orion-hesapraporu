// PARÇA ÖLÇÜSÜ DÜZELTMESİ — saf çekirdek.
//
// Kullanıcı kararı (15.08.2026): *"Hammadde havuzuna düşen kalemlerin en boy
// uzunluk ölçülerini düzenleyebilmek istiyorum. Bazen yanlışlık yapılmış
// olabilir projede veya son anda değişiklik istenebilir. Bu esnekliği sunalım.
// Hem parça ismi değişsin böylece. Tabi değiştirdiğim kırmızı renkli olsun,
// değiştirildi gibi göze çarpsın çünkü parçayı değiştirmiş oluyoruz."*
//
// ══════════════════════════════════════════ NEDEN "SAYI" DEĞİL "TANIM" SAKLANIR
//
// Düzeltme, ölçü alanlarını ayrı ayrı saklayıp okuma sırasında çözümün üstüne
// yazmak olarak da kurulabilirdi. Yapılmadı: bu modülde ölçünün TEK KAYNAĞI
// TANIM METNİDİR (`cozumle.ts` her şeyi ondan çıkarır — sınıf, kesit kodu, stok
// kalemi adı, metre ağırlığı). Sayıyı ayrıca saklamak ikinci bir gerçek üretir
// ve "parça ismi değişsin" isteğini de karşılamaz: ad hâlâ eski ölçüyü yazardı.
//
// Bu yüzden düzeltme TANIMIN KENDİSİNİ yeniden yazar ve çözücü onu bir daha
// okur. Sonuç kendiliğinden tutarlıdır: ad, stok kalemi, ağırlık, plaka
// yerleşimi ve kesim listesi tek bir metinden türer.
//
// ══════════════════════════════════════════════════ DEĞİŞTİRİLEN JETON HANGİSİ
//
// Metinde `375` yazan bir sayıyı bulup `400` yapmak, "üçüncü sayıyı değiştir"
// demekten daha güvenlidir: yazım biçimleri birbirine benzemez
// (`SAC 15x375x1500`, `KAPAK-1 30x190x190`, `NPL 120x120x10 L=2150`) ve sıraya
// güvenen bir kural ilkinde doğru, üçüncüsünde yanlış çalışırdı.
//
// Jetonlar SOLDAN SAĞA ve alanlar YAZIM SIRASINDA tüketilir; bir jeton iki kez
// kullanılmaz. `SAC 10x100x100` gibi iki alanı aynı sayıyı taşıyan bir tanımda
// bu kural en ile boyu doğru ayırır.
//
// BOY AYRICALIKLIDIR: `L=` yazımı varsa önce ORADAKİ jeton denenir. `L 120x120x10
// L=120` gibi bir tanımda boy jetonunu değere göre aramak kesit ölçüsünü
// değiştirirdi.

import { trKatla } from "@/lib/drawings/tr-text";
import type { HammaddeOlcusu } from "./cozumle";
import type { HammaddeSinifi } from "./siniflar";

export type OlcuAlani = "kalinlikMm" | "enMm" | "boyMm" | "disCapMm" | "icCapMm";

export const OLCU_ETIKETLERI: Record<OlcuAlani, string> = {
  kalinlikMm: "Kalınlık (mm)",
  enMm: "En (mm)",
  boyMm: "Boy (mm)",
  disCapMm: "Ø Dış (mm)",
  icCapMm: "Ø İç (mm)",
};

/**
 * Sınıfa göre YAZIM SIRASI — jeton tüketimi bu sırayı izler.
 *
 * Sıra tanımda göründükleri sıradır, ekranda görünmeleri gereken sıra değil:
 * `SAC 15x375x1500` kalınlık → en → boy, `BORU Ø140/Ø90x300` dış → iç → boy.
 */
const YAZIM_SIRASI: Record<HammaddeSinifi, OlcuAlani[]> = {
  SAC: ["kalinlikMm", "enMm", "boyMm"],
  PROFIL: ["enMm", "kalinlikMm", "boyMm"],
  RAY: ["enMm", "kalinlikMm", "boyMm"],
  DOLU: ["disCapMm", "boyMm"],
  BORU: ["disCapMm", "icCapMm", "kalinlikMm", "boyMm"],
  DIGER: ["kalinlikMm", "enMm", "disCapMm", "icCapMm", "boyMm"],
};

/**
 * DÜZENLENEBİLEN ALAN = TANIMDA KARŞILIĞI OLAN ALAN.
 *
 * Boş bir ölçü düzenlenemez ve bu bir eksiklik değil bir dürüstlüktür: metinde
 * karşılığı olmayan bir sayıyı "düzeltmek", tanıma yeni bir sayı UYDURMAK
 * olurdu (SATIN-21'in "uydurma veri girmeyeceğiz" kuralı). Ölçüsü hiç okunamayan
 * satırın yolu Ad alanını elle düzeltmektir.
 *
 * PROFİL VE RAYDA YALNIZ BOY AÇIKTIR: en ve kalınlık KESİT KODUNDAN gelir
 * (`UPN 100`, `L 50x50x5`) ve onları değiştirmek profili başka bir profil
 * yapardı — o karar "Türe Taşı"nın ya da ad düzeltmesinin işidir.
 */
export function duzenlenebilirOlculer(
  sinif: HammaddeSinifi,
  olcu: HammaddeOlcusu
): OlcuAlani[] {
  const kilitli: OlcuAlani[] =
    sinif === "PROFIL" || sinif === "RAY" ? ["enMm", "kalinlikMm"] : [];
  return YAZIM_SIRASI[sinif].filter((a) => olcu[a] != null && !kilitli.includes(a));
}

/**
 * DÜZELTME DEFTERİNİN ANAHTARI — `(iş kalemi no, parça kodu)`.
 *
 * `drawing_part_progress`in anahtarıyla aynı ruhta ve aynı sebeple METİNDİR:
 * `drawing_parts` her eşleştirmede silinip yeniden kurulur, bir satır kimliğine
 * bağlanan düzeltme ilk yeni yüklemede yetim kalırdı.
 */
export function parcaOlcuAnahtari(itemNo: string, partCode: string): string {
  return trKatla(`${(itemNo ?? "").trim()}|${(partCode ?? "").trim()}`);
}

/** Ondalıklı ölçüyü tanımda göründüğü gibi yazar: 3,25 · 100 (tr-TR). */
function olcuYaz(v: number): string {
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}

interface Jeton {
  bas: number;
  son: number;
  deger: number;
}

const SAYI = /\d+(?:[.,]\d+)?/g;
/** `cozumle.ts`teki `BOY_KALIBI`nın aynısı — iki yerde iki kural olamaz. */
const BOY_KALIBI = /(?:^|[^\p{L}\p{N}])L\s*=?\s*(\d+(?:[.,]\d+)?)/u;

function jetonlar(t: string): Jeton[] {
  const out: Jeton[] = [];
  for (const m of t.matchAll(SAYI)) {
    const deger = Number.parseFloat(m[0].replace(",", "."));
    if (Number.isFinite(deger)) {
      out.push({ bas: m.index ?? 0, son: (m.index ?? 0) + m[0].length, deger });
    }
  }
  return out;
}

/** İki ölçü aynı sayıyı mı gösteriyor? (kayan nokta toleransı) */
function ayni(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

export interface OlcuYazimSonucu {
  tanim: string;
  /** Metinde karşılığı BULUNAMAYAN alanlar — çağıran kullanıcıya söyler. */
  yazilamayan: OlcuAlani[];
}

/**
 * Tanımdaki ölçüleri yenisiyle değiştirir ve YENİ TANIMI döndürür.
 *
 * `eski` RESİM ölçüsüdür (`HammaddeCozumu.resimOlcusu`), satın alma ölçüsü
 * DEĞİL: metinde yazan sayı odur. Otomatik pay (dolu/boru %5) tanıma hiç
 * yazılmaz — çözücü onu her okumada yeniden uygular, yani düzeltilmiş bir Ø90
 * yine Ø95 olarak sipariş edilir.
 */
export function tanimiOlcuyleYaz(
  tanim: string,
  sinif: HammaddeSinifi,
  eski: HammaddeOlcusu,
  yeni: Partial<Record<OlcuAlani, number | null>>
): OlcuYazimSonucu {
  const liste = jetonlar(tanim);
  const kullanilan = new Set<number>();
  const degisiklikler: { bas: number; son: number; metin: string }[] = [];
  const yazilamayan: OlcuAlani[] = [];

  // BOY JETONU ÖNCE İŞARETLENİR: `L=` yazımı varsa boy odur, değere göre
  // aranan bir jeton kesit ölçüsüne düşebilirdi.
  const boyEsleme = tanim.match(BOY_KALIBI);
  let boyJetonu = -1;
  if (boyEsleme?.index != null) {
    const bas = tanim.indexOf(boyEsleme[1], boyEsleme.index);
    boyJetonu = liste.findIndex((j) => j.bas === bas);
  }

  // DEĞİŞMEYEN ALANIN JETONU DA TÜKETİLİR — ve bu, testin yakaladığı gerçek
  // bir hatanın karşılığıdır: `SAC 10x100x100` tanımında yalnız BOY
  // değiştirildiğinde, atlanan "en" alanı jetonunu bırakıyor ve boy soldan
  // sağa ilk 100'ü, yani ENİ değiştiriyordu. Sıra ancak bütün alanlar sırayla
  // tüketilirse korunur.
  for (const alan of YAZIM_SIRASI[sinif]) {
    const oncesi = eski[alan];
    if (oncesi == null) continue;
    const sonrasi = yeni[alan];
    const degisiyor = sonrasi != null && sonrasi > 0 && !ayni(oncesi, sonrasi);

    let i = -1;
    if (alan === "boyMm" && boyJetonu >= 0 && ayni(liste[boyJetonu].deger, oncesi)) {
      i = boyJetonu;
    } else {
      i = liste.findIndex(
        (j, idx) => !kullanilan.has(idx) && idx !== boyJetonu && ayni(j.deger, oncesi)
      );
      // Boy jetonu son çare olarak yine denenir: `L=` yazımı olmayan
      // tanımlarda (`MİL Ø75x235`) boy sıradan bir sayıdır.
      if (i < 0) {
        i = liste.findIndex((j, idx) => !kullanilan.has(idx) && ayni(j.deger, oncesi));
      }
    }

    if (i < 0) {
      if (degisiyor) yazilamayan.push(alan);
      continue;
    }
    kullanilan.add(i);
    if (degisiyor) {
      degisiklikler.push({ bas: liste[i].bas, son: liste[i].son, metin: olcuYaz(sonrasi!) });
    }
  }

  // SONDAN BAŞA UYGULANIR: baştan uygulamak sonraki jetonların yerini kaydırır.
  let metin = tanim;
  for (const d of [...degisiklikler].sort((a, b) => b.bas - a.bas)) {
    metin = metin.slice(0, d.bas) + d.metin + metin.slice(d.son);
  }
  return { tanim: metin.replace(/\s+/g, " ").trim(), yazilamayan };
}
