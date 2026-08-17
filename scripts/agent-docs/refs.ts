/**
 * `md. N` ATIFLARINI ALAN ÖNEKİNE ÇEVİRİR — `md. 15` → `ROL-15`.
 *
 *   npx tsx scripts/agent-docs/refs.ts          → prova (rapor basar, dosyaya dokunmaz)
 *   npx tsx scripts/agent-docs/refs.ts --uygula → gerçekten yazar
 *
 * Sorun ölçülmüştür: kodda 441 `md. N` atfı var ve %76'sı BELİRSİZ, çünkü
 * numaralar bölümden bölüme tekrar ediyor (`md. 15` = feston · roller ·
 * telefonda ana tablo). Ajan atfı okuyunca üç yere birden bakmak zorunda
 * kalıyor; önek bunu bitirir.
 *
 * ÇÖZÜM MERDİVENİ — her adım bir öncekinden daha zayıf kanıta dayanır ve
 * kanıt biterse atıf DEĞİŞTİRİLMEZ. Yanlış bir önek, önek olmamasından
 * pahalıdır: okuyanı emin adımlarla yanlış maddeye götürür.
 *   1. Metinde ayırıcı sözcük var mı ("dokunmatik md. 14", "dar ekran md. 7")
 *   2. Numara zaten tek bir alanda mı geçiyor (18…25 böyledir)
 *   3. Dosyanın KENDİ alanında o numara var mı (`manifest.yollar` ile)
 *   4. Yoksa: dokunma, rapora yaz.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ALANLAR } from "./manifest";

const KOK = process.cwd();
const UYGULA = process.argv.includes("--uygula");
type Kayit = { id: string; alan: string; no: string; baslik: string; jetonlar: Set<string> };

/** Ayırt edici jetonlar: 5+ harf, tr-küçük, noktalama sökülmüş. */
function jetonla(satirlar: string[]): Set<string> {
  return new Set(
    satirlar
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .split(/[^0-9a-zçğıöşü_]+/)
      .filter((w) => w.length >= 5),
  );
}

/**
 * Madde defteri BÖLÜNMÜŞ ALAN DOSYALARINDAN kurulur.
 *
 * Bölmeden sonra maddeler `AGENTS.md`te değil `docs/agent/*.md`tedir; defteri
 * hâlâ kökten okumak boş bir defter üretir ve hiçbir atıf çözülmez. Kaynak
 * dosyaların KENDİSİ okunur, `kimlikler.json` değil: puanlama gövde metnini
 * ister ve iki kaynak tutmak ayrışma riskidir.
 */
const AGENT_DIR = join(KOK, "docs", "agent");
if (!existsSync(AGENT_DIR)) {
  throw new Error("docs/agent/ yok — önce `npm run agent:split -- --uygula` koştur");
}
const alaninDosyasi = new Map(ALANLAR.map((a) => [a.dosya, a]));
const defter: Kayit[] = [];

for (const dosya of readdirSync(AGENT_DIR).filter((f) => f.endsWith(".md"))) {
  const alan = alaninDosyasi.get(dosya.replace(/\.md$/, ""));
  if (!alan?.onek) continue;
  const satirlar = readFileSync(join(AGENT_DIR, dosya), "utf8").replace(/\r\n/g, "\n").split("\n");

  let acik: { id: string; no: string; baslik: string; govde: string[] } | null = null;
  const kapat = () => {
    if (!acik) return;
    defter.push({
      id: acik.id,
      alan: alan.dosya,
      no: acik.no,
      baslik: acik.baslik,
      jetonlar: jetonla(acik.govde),
    });
    acik = null;
  };
  for (const s of satirlar) {
    const m = /^##\s+([A-ZÇĞİÖŞÜ]+)-(\d+[a-z]?)\s+—\s+(.*)$/.exec(s);
    if (m) {
      kapat();
      acik = { id: `${m[1]}-${m[2]}`, no: m[2], baslik: m[3], govde: [m[3]] };
    } else if (acik) {
      acik.govde.push(s);
    }
  }
  kapat();
}
if (!defter.length) throw new Error("alan dosyalarında hiç madde bulunamadı");

/** numara → o numarayı taşıyan alanlar */
const numaraSahipleri = new Map<string, Kayit[]>();
for (const k of defter) {
  const liste = numaraSahipleri.get(k.no) ?? [];
  liste.push(k);
  numaraSahipleri.set(k.no, liste);
}

/**
 * `src/app/(app)/purchasing/**` gibi bir kalıbı düzenli ifadeye çevirir.
 * Jeton jeton yürünür: yol adlarında `(` `)` geçiyor ve toplu `replace`
 * zinciriyle hem onları kaçırmak hem `**`i tek `*`ten ayırmak mümkün değil.
 */
function globRe(kalip: string): RegExp {
  let out = "";
  for (let i = 0; i < kalip.length; i++) {
    const c = kalip[i];
    if (c === "*") {
      if (kalip[i + 1] === "*") {
        i++;
        if (kalip[i + 1] === "/") {
          i++;
          out += "(?:[^/]+/)*"; // `**/` — sıfır ya da daha çok dizin
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else {
      out += ".+^${}()|[]".includes(c) ? "\\" + c : c;
    }
  }
  return new RegExp(`^${out}$`);
}
const alanKaliplari = ALANLAR.filter((a) => a.onek).map((a) => ({
  alan: a,
  re: a.yollar.map(globRe),
}));

/** Dosya hangi alana ait? (kural `paths:` kapsamlarıyla aynı kalıplar) */
function dosyaninAlani(yol: string): string | null {
  const d = yol.replace(/\\/g, "/");
  for (const { alan, re } of alanKaliplari) if (re.some((r) => r.test(d))) return alan.dosya;
  return null;
}

const AYIRICI: [RegExp, string][] = [
  [/dokunmatik\s*$/i, "arayuz"],
  [/dar\s+ekran\s*$/i, "arayuz"],
  [/mobil\s*$/i, "arayuz"],
];

type Sonuc = { yol: string; satir: number; eski: string; yeni: string | null; gerekce: string };
const sonuclar: Sonuc[] = [];

/**
 * İÇERİK PUANI — atfın çevresindeki yorumu adayların gövdeleriyle karşılaştırır.
 *
 * Bu adım gerekli çünkü numara tek başına konuşmuyor: `demand.ts`teki
 * `md. 17` ile `climate-load` yanındaki `md. 17` aynı numara, ayrı maddeler.
 * Ama YORUM konuşuyor — satın alma yorumunda "kalem", "numara", "eşleştirme"
 * geçer ve bunlar İş Takibi maddesinin gövdesindedir. Puan, komşu satırlardan
 * derlenen bağlamla adayın gövdesinin ORTAK ayırt edici sözcük sayısıdır.
 *
 * KAZANMAK YETMEZ, AÇIK ARA KAZANMAK gerekir (en az 3 fark): berabere kalan
 * bir tahmin, atfı hiç çevirmemekten kötüdür — okuyanı emin adımlarla yanlış
 * maddeye götürür.
 */
const PUAN_FARKI = 3;

/**
 * Kazananın MUTLAK puanı da yetmeli.
 *
 * Ölçüldü: bazı atıflar hiçbir adayı göstermiyor — belge zamanla yeniden
 * numaralandı ve yorum eski numarada kaldı. `demand.ts:21`deki "ADETLER İŞ
 * KALEMİ ADEDİYLE ÇARPILIR (md. 6)" kuralı bugün SATIN-21'dedir; ne HESAP-6
 * ne MOBIL-6 onu içerir. Böyle bir atıfta en yüksek puan da düşüktür ve
 * "en az kötü" adayı seçmek, bozuk bir atfı DOĞRU GÖRÜNEN bir atfa çevirir —
 * yani hatayı gizler. Taban altında kalan atıf ÇEVRİLMEZ, rapora düşer.
 */
const PUAN_TABANI = 4;

function icerikPuani(baglam: Set<string>, aday: Kayit): number {
  let n = 0;
  for (const w of baglam) if (aday.jetonlar.has(w)) n++;
  return n;
}

function isle(yol: string, ham: string): string {
  const alanim = dosyaninAlani(yol);
  const satirlar = ham.split("\n");
  for (let i = 0; i < satirlar.length; i++) {
    // Bağlam: atfın satırı ± dört satır. Yorum blokları bu genişliktedir.
    const baglam = jetonla(satirlar.slice(Math.max(0, i - 4), i + 5));

    // BİLEŞİK ATIF: `md. 17/18`, `md. 21 + 24`, `md. 18/3` tek bir atıftır ve
    // numaraların HEPSİ çevrilmeli. Yalnız ilkini çevirmek `WORKLOG-17/18`
    // gibi yarısı çevrilmiş, okuyanı yanıltan bir dizge bırakır (ölçüldü).
    // NOKTALI NUMARA BİR STANDART MADDESİDİR, AGENTS maddesi değil.
    // `(?!\.\d)` yapısal kelepçedir ve sözcük aramasından güçlüdür: satırın
    // başındaki "CMAA 70" ikinci atıfa yetişmiyordu ve
    // `(md. 3.4.4.2 asal gerilme sınırı)` → `(HESAP-3.4.4.2 …)` oluyordu
    // (ölçüldü, hoistGroup.ts:102). AGENTS maddeleri `12` ya da `8b`dir,
    // hiçbir zaman `3.4.1` değil.
    satirlar[i] = satirlar[i].replace(
      /(.{0,24})\bmd\.\s*(\d+[a-z]?(?:\s*[/+]\s*\d+[a-z]?)*)(?!\.\d)\b/g,
      (tam, once: string, grup: string) => {
        const numaralar = grup.split(/\s*[/+]\s*/);
        const ayirici = AYIRICI.find(([re]) => re.test(once));
        const cozulen: (string | null)[] = [];

        for (const no of numaralar) {
          const eski = `md. ${no}`;
          const kaydet = (yeni: string | null, gerekce: string) => {
            sonuclar.push({ yol, satir: i + 1, eski, yeni, gerekce });
            cozulen.push(yeni);
          };

          // Standart maddesi ("FEM md. 9.3") bir AGENTS maddesi değildir.
          if (/FEM|DIN|CMAA|EN\s|ASHRAE|4857|6331|GVK/i.test(once)) {
            kaydet(null, "standart maddesi — dokunulmadı");
            continue;
          }
          const sahipler = numaraSahipleri.get(no);
          if (!sahipler?.length) {
            kaydet(null, `ESKİMİŞ: ${no} numaralı madde artık yok`);
            continue;
          }
          if (ayirici) {
            const eslesen = sahipler.find((s) => s.alan === ayirici[1]);
            if (eslesen) {
              kaydet(eslesen.id, `ayırıcı sözcük → ${ayirici[1]}`);
              continue;
            }
          }
          if (sahipler.length === 1) {
            kaydet(sahipler[0].id, "numara zaten benzersiz");
            continue;
          }

          const puanli = sahipler
            .map((s) => ({ s, p: icerikPuani(baglam, s) }))
            .sort((a, b) => b.p - a.p);
          if (puanli[0].p >= PUAN_TABANI && puanli[0].p - puanli[1].p >= PUAN_FARKI) {
            kaydet(puanli[0].s.id, `içerik puanı (${puanli[0].p} ↔ ${puanli[1].p})`);
            continue;
          }
          if (alanim) {
            const kendi = sahipler.find((s) => s.alan === alanim);
            if (kendi) {
              kaydet(kendi.id, `dosyanın kendi alanı (${alanim})`);
              continue;
            }
          }
          kaydet(
            null,
            puanli[0].p < PUAN_TABANI
              ? `ŞÜPHELİ: hiçbir aday tutmuyor (${puanli.map((x) => `${x.s.id}:${x.p}`).join(" ")})`
              : `BELİRSİZ: ${puanli.map((x) => `${x.s.id}:${x.p}`).join(" / ")}`,
          );
        }

        // Hepsi çözülmediyse atfa HİÇ dokunma: yarısı çevrilmiş bir bileşik
        // atıf, hiç çevrilmemiş olandan daha yanıltıcıdır.
        if (cozulen.some((c) => c === null)) return tam;
        return `${once}${cozulen.join(" / ")}`;
      },
    );
  }
  return satirlar.join("\n");
}

// ─────────────────────────────────────────────────────────── koş

const dosyalar = execFileSync(
  "git",
  ["ls-files", "src", "docs", "scripts", "supabase", "AGENTS.md"],
  { cwd: KOK, encoding: "utf8" },
)
  .split("\n")
  .filter((f) => /\.(ts|tsx|md|sql|py)$/.test(f));

let degisen = 0;
for (const yol of dosyalar) {
  const tam = join(KOK, yol);
  if (!existsSync(tam)) continue;
  const ham = readFileSync(tam, "utf8");
  if (!/\bmd\.\s*\d/.test(ham)) continue;
  const yeni = isle(yol, ham);
  if (yeni !== ham) {
    degisen++;
    if (UYGULA) writeFileSync(tam, yeni, "utf8");
  }
}

const cevrilen = sonuclar.filter((s) => s.yeni);
const kategori = (s: Sonuc) => s.gerekce.split(":")[0];
const belirsiz = sonuclar.filter((s) => !s.yeni && kategori(s) === "BELİRSİZ");
const supheli = sonuclar.filter((s) => !s.yeni && kategori(s) === "ŞÜPHELİ");
const eskimis = sonuclar.filter((s) => !s.yeni && kategori(s) === "ESKİMİŞ");
const atlanan = sonuclar.filter(
  (s) => !s.yeni && !["BELİRSİZ", "ŞÜPHELİ", "ESKİMİŞ"].includes(kategori(s)),
);

console.log(`\n${UYGULA ? "UYGULANDI" : "PROVA — dosyalara dokunulmadı"}\n`);
console.log(`toplam atıf     ${sonuclar.length}`);
console.log(`çevrildi        ${cevrilen.length}  (${degisen} dosya)`);
console.log(`atlandı         ${atlanan.length}   (standart maddesi — FEM/DIN/CMAA)`);
console.log(`BELİRSİZ        ${belirsiz.length}   (iki aday da tutuyor)`);
console.log(`ŞÜPHELİ         ${supheli.length}   (hiçbir aday tutmuyor — atıf bozuk olabilir)`);
console.log(`ESKİMİŞ         ${eskimis.length}   (o numarada madde YOK)\n`);

const gerekceSayaci = new Map<string, number>();
for (const s of cevrilen) gerekceSayaci.set(s.gerekce, (gerekceSayaci.get(s.gerekce) ?? 0) + 1);
console.log("çözüm gerekçeleri:");
for (const [g, n] of [...gerekceSayaci].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${g}`);
}

for (const [ad, liste] of [
  ["BELİRSİZ", belirsiz],
  ["ŞÜPHELİ / ESKİMİŞ (atıf bugün yanlış yeri gösteriyor olabilir)", [...supheli, ...eskimis]],
] as const) {
  if (!liste.length) continue;
  console.log(`\n${ad} — ${liste.length} atıf, elle karara bağlanır:`);
  for (const s of liste) console.log(`  ${s.yol}:${s.satir}  ${s.eski}  →  ${s.gerekce}`);
}
console.log();
