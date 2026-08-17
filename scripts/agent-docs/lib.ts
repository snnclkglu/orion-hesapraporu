/**
 * AGENTS.md ÇÖZÜMLEYİCİSİ — belgeyi bloklara ayırır.
 *
 * Belge iki düzeyden oluşur: `## ` başlıkları (BÖLÜM) ve onların altındaki
 * `N. **Başlık**` maddeleri (MADDE). Numaralar bölümden bölüme TEKRAR EDER
 * (`md. 15` üç ayrı maddedir), o yüzden bir maddenin kimliği numarası DEĞİL
 * **başlığının ilk harfleridir**. Bölme planı da maddeleri başlıktan tanır;
 * numara sonradan önek alır ama kimlik değişmez.
 *
 * Çözümleyici SATIR NUMARASI EZBERLEMEZ: belge her gün büyüyor ve satır
 * numarasına dayanan bir plan ikinci koşuda sessizce yanlış yeri keser.
 */

import { readFileSync } from "node:fs";

/** Bir `## ` bölümü ya da onun altındaki bir `N. **…**` maddesi. */
export type Blok = {
  /** `bolum` = `## ` başlığı ve altındaki numarasız gövde; `madde` = `N. **…**`. */
  tur: "bolum" | "madde";
  /** İçinde bulunduğu `## ` başlığı (bölüm bloğunda kendi adı). */
  bolum: string;
  /** `12`, `8b` gibi; bölüm bloğunda boş. */
  no: string;
  /** Kalın başlığın metni — maddenin KİMLİĞİ budur. */
  baslik: string;
  /** Ham satırlar (başlık satırı dâhil). */
  satirlar: string[];
  /** 1'den başlayan kaynak satır numarası — yalnız raporlama için. */
  satirNo: number;
};

export type Belge = {
  /** `# ` başlığından önceki her şey (nextjs-agent-rules bloğu vb.). */
  onsoz: string[];
  /** `# ORION Cranes …` başlığı ve `## ` gelene kadarki gövde. */
  giris: string[];
  bloklar: Blok[];
  /**
   * Kaynağın satır sonu — `\r\n` ya da `\n`.
   *
   * AGENTS.md bugün CRLF'tir. Çözümleyici `\r`i SÖKER (JavaScript'te `.`
   * bir satır sonlandırıcı olan `\r`i eşlemez, yani `^## (.+)$` CRLF'li bir
   * dosyada HİÇBİR başlığı bulamaz — ölçüldü) ama yazan taraf aynı sonu geri
   * koymalıdır; yoksa bölme, içerik değişmemiş dosyaları da baştan sona
   * değişmiş gösterir.
   */
  satirSonu: "\r\n" | "\n";
};

const BOLUM_RE = /^## (.+)$/;
const MADDE_RE = /^(\d+[a-z]?)\. \*\*(.*)$/;

/** Kalın başlıktan kimlik anahtarı üretir: ilk 40 karakter, sadeleştirilmiş. */
export function kimlik(baslik: string): string {
  return baslik
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .toLocaleLowerCase("tr-TR");
}

export function coz(dosya: string): Belge {
  const ham = readFileSync(dosya, "utf8");
  const satirSonu: "\r\n" | "\n" = ham.includes("\r\n") ? "\r\n" : "\n";
  const satirlar = ham.replace(/\r\n/g, "\n").split("\n");

  const onsoz: string[] = [];
  const giris: string[] = [];
  const bloklar: Blok[] = [];

  let bolumAdi = "";
  let acik: Blok | null = null;
  let asama: "onsoz" | "giris" | "govde" = "onsoz";

  const kapat = () => {
    if (acik) bloklar.push(acik);
    acik = null;
  };

  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];

    if (asama === "onsoz") {
      if (s.startsWith("# ")) {
        asama = "giris";
        giris.push(s);
      } else {
        onsoz.push(s);
      }
      continue;
    }

    const bolum = BOLUM_RE.exec(s);
    if (bolum) {
      kapat();
      asama = "govde";
      bolumAdi = bolum[1].trim();
      acik = {
        tur: "bolum",
        bolum: bolumAdi,
        no: "",
        baslik: bolumAdi,
        satirlar: [s],
        satirNo: i + 1,
      };
      continue;
    }

    const madde = MADDE_RE.exec(s);
    if (madde && asama === "govde") {
      kapat();
      acik = {
        tur: "madde",
        bolum: bolumAdi,
        no: madde[1],
        baslik: madde[2].replace(/\*\*.*$/, "").trim(),
        satirlar: [s],
        satirNo: i + 1,
      };
      continue;
    }

    if (asama === "giris") {
      giris.push(s);
      continue;
    }
    if (acik) acik.satirlar.push(s);
  }
  kapat();

  return { onsoz, giris, bloklar, satirSonu };
}

/** Bir bloğun bayt boyu (UTF-8, LF sayılır — karşılaştırma için tutarlı olsun). */
export function bayt(satirlar: string[]): number {
  return Buffer.byteLength(satirlar.join("\n") + "\n", "utf8");
}

/** Sondaki boş satırları kırpar — bloklar birleşirken boşluk yığılmasın. */
export function kirp(satirlar: string[]): string[] {
  const k = [...satirlar];
  while (k.length && k[k.length - 1].trim() === "") k.pop();
  return k;
}
