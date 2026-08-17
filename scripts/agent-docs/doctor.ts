/**
 * AJAN DOKÜMANLARI DENETÇİSİ — `npx tsx scripts/agent-docs/doctor.ts`
 *
 * Bu sistemin ölüm sebebi doküman çürümesidir: bir dosya taşınır, doküman
 * eski yolu göstermeye devam eder ve ajan olmayan bir dosyayı arayarak
 * token yakar — üstelik yanlış olduğunu hiçbir şey söylemez. Denetçi beş
 * şeyi ÖLÇER:
 *
 *   1. Kök `AGENTS.md` boyut tavanını aşmadı mı (her oturumun sabit bedeli)
 *   2. Dokümanlarda geçen her dosya yolu gerçekten var mı
 *   3. Kural dosyalarındaki `paths:` kapsamları gerçekten dosya eşliyor mu
 *   4. Her `ÖNEK-N` atfı gerçek bir maddeye denk geliyor mu
 *   5. Haritadaki her satırın dosyası var mı, her alan dosyası haritada mı
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ALANLAR } from "./manifest";

const KOK = process.cwd();
// `--prova`: bölme uygulanmadan önce `.tmp-agent-docs` çıktısını denetler.
// Kod ve depo listesi yine gerçek kökten okunur — denetlenen şey ÜRETİLEN
// dokümanın gerçek kodla tutup tutmadığıdır.
const PROVA = process.argv.includes("--prova");
const BELGE_KOK = PROVA ? join(KOK, ".tmp-agent-docs") : KOK;
const AGENT_DIR = join(BELGE_KOK, "docs", "agent");
const KURAL_DIR = join(BELGE_KOK, ".claude", "rules");
const KOK_MD = join(BELGE_KOK, "AGENTS.md");

/** Kök dosya tavanı — Anthropic 200 satırı öneriyor, biz baytla ölçüyoruz. */
const KOK_TAVAN_BAYT = 12_000;

const hatalar: string[] = [];
const uyarilar: string[] = [];

if (!existsSync(AGENT_DIR)) {
  console.log("docs/agent/ yok — bölme henüz uygulanmamış. `split.ts --uygula` koştur.");
  process.exit(0);
}

/**
 * Depo dosyaları — TAKİP EDİLMEYENLER DE DÂHİL (`--others --exclude-standard`).
 *
 * Yalnız `ls-files` sorulduğunda henüz commit'lenmemiş yeni dosyalar "yok"
 * görünüyor ve doküman onlara atıf verdiği anda denetçi yalancı uyarı basıyor
 * (ölçüldü: panel turunun yedi yeni dosyası). Bir kural yeni yazılmış dosyayı
 * anlatıyorsa bu normaldir — kuralın kendisi kodla aynı turda yazılır.
 * `--exclude-standard` gitignore'daki üretilmiş dosyaları yine dışarıda tutar.
 */
const depoDosyalari = new Set(
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: KOK,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean),
);
const dizinler = new Set<string>();
for (const f of depoDosyalari) {
  const p = f.split("/");
  for (let i = 1; i < p.length; i++) dizinler.add(p.slice(0, i).join("/"));
}

// ── 1. kök boyutu
const kokBayt = Buffer.byteLength(readFileSync(KOK_MD, "utf8"), "utf8");
if (kokBayt > KOK_TAVAN_BAYT) {
  hatalar.push(
    `AGENTS.md ${kokBayt} B — tavan ${KOK_TAVAN_BAYT} B. Yeni kuralı alan dosyasına taşı; ` +
      `bu dosya her oturumda ve her alt-ajanda bütünüyle yüklenir.`,
  );
}

// ── 2. dokümanlardaki yollar
const dokumanlar = [
  KOK_MD,
  ...readdirSync(AGENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(AGENT_DIR, f)),
];

/**
 * Backtick içindeki bir dizge DOSYA YOLU mu?
 *
 * YANLIŞ ALARM BU DENETÇİNİN EN BÜYÜK DÜŞMANIDIR (RESIM-18/3'ün aynı kuralı):
 * her koşuda otuz sahte uyarı basan bir denetçi okunmaz olur ve gerçek bir
 * çürüme o gürültüde kaybolur. Üç sınıf bilerek dışarıda:
 *   · `/dev/panel-preview`, `/admin/access` — uygulama ADRESİ, dosya değil
 *   · `-translate-y-1/2`, `md:max-w-[16rem]` — CSS sınıfı
 *   · `1/2`, `9/16` — oran
 */
const yolaBenziyor = (s: string) =>
  /^[a-z0-9_.@][a-z0-9_.@/-]*\/[a-z0-9_.*/-]*$/i.test(s) &&
  !s.startsWith("http") &&
  !/^\d/.test(s) &&
  !/^(sm|md|lg|xl|2xl|hover|focus|dark|pointer-\w+):/.test(s);

/**
 * Yol var mı?
 *
 * SONDAN EŞLEŞME kabul edilir: dokümanlar yolu çoğu zaman kısaltarak yazıyor
 * (`pdf/brand.tsx`, `lib/calc`, `modules/`) çünkü okuyan mühendis için bağlam
 * zaten belli. Bunları "yok" saymak, dokümanın kendi diliyle kavga etmektir.
 */
function yolVar(y: string): boolean {
  const temiz = y.replace(/^\.\//, "").replace(/\/$/, "");
  if (!temiz) return true;

  // Glob: kalıbı GERÇEKTEN eşleştir. Yıldıza kadarki ön eki dizin sanmak
  // `src/components/catalog-*.tsx` gibi kalıpları haksız yere düşürüyordu —
  // dosyalar var, "catalog-" diye bir dizin yok (ölçüldü).
  if (/[*?{]/.test(temiz)) {
    const re = globRe(temiz);
    for (const f of depoDosyalari) if (re.test(f) || re.test(f.replace(/^.*?\//, ""))) return true;
    for (const d of dizinler) if (re.test(d)) return true;
    return false;
  }

  if (depoDosyalari.has(temiz) || dizinler.has(temiz)) return true;
  if (existsSync(join(KOK, temiz))) return true;
  const sonek = `/${temiz}`;
  for (const f of depoDosyalari) if (f.endsWith(sonek)) return true;
  for (const d of dizinler) if (d.endsWith(sonek)) return true;
  // Uzantısız kısaltma (`lib/panel` → `src/lib/panel.ts`)
  if (!/\.[a-z0-9]+$/i.test(temiz)) {
    for (const f of depoDosyalari) if (f.replace(/\.[^./]+$/, "").endsWith(sonek)) return true;
  }
  return false;
}

/** `src/**\/*.tsx` gibi bir kalıbı düzenli ifadeye çevirir (refs.ts ile aynı kural). */
function globRe(kalip: string): RegExp {
  let out = "";
  for (let i = 0; i < kalip.length; i++) {
    const c = kalip[i];
    if (c === "*") {
      if (kalip[i + 1] === "*") {
        i++;
        if (kalip[i + 1] === "/") {
          i++;
          out += "(?:[^/]+/)*";
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

let bakilanYol = 0;
for (const d of dokumanlar) {
  const ad = d.replace(BELGE_KOK + "\\", "").replace(BELGE_KOK + "/", "").replace(/\\/g, "/");
  const metin = readFileSync(d, "utf8");
  const gorulen = new Set<string>();
  for (const m of metin.matchAll(/`([^`\n]+)`/g)) {
    const y = m[1].trim();
    if (!yolaBenziyor(y) || gorulen.has(y)) continue;
    gorulen.add(y);
    bakilanYol++;
    if (yolVar(y) || existsSync(join(BELGE_KOK, y))) continue;
    uyarilar.push(`${ad}: \`${y}\` — böyle bir yol yok`);
  }
}

// ── 3. kural dosyalarının kapsamları
let bakilanKapsam = 0;
if (existsSync(KURAL_DIR)) {
  for (const f of readdirSync(KURAL_DIR).filter((x) => x.endsWith(".md"))) {
    // CRLF normalize edilir: AGENTS.md CRLF olduğu için üretilen kural
    // dosyaları da CRLF'tir ve `^---\n` onları hiç yakalamıyordu (ölçüldü).
    const metin = readFileSync(join(KURAL_DIR, f), "utf8").replace(/\r\n/g, "\n");
    const on = /^---\n([\s\S]*?)\n---/.exec(metin);
    if (!on) {
      hatalar.push(`.claude/rules/${f}: \`paths:\` frontmatter'ı yok — kural HER oturumda yüklenir`);
      continue;
    }
    for (const m of on[1].matchAll(/^\s*-\s*"(.+)"\s*$/gm)) {
      const y = m[1];
      if (y.startsWith("orion-hesapraporu/")) continue; // ikiz biçim
      bakilanKapsam++;
      if (!yolVar(y)) uyarilar.push(`.claude/rules/${f}: \`${y}\` — hiçbir dosya eşlemiyor`);
    }
  }
  const beklenen = new Set(ALANLAR.filter((a) => a.yollar.length).map((a) => `${a.dosya}.md`));
  const olan = new Set(readdirSync(KURAL_DIR).filter((x) => x.endsWith(".md")));
  for (const b of beklenen) {
    if (!olan.has(b)) hatalar.push(`.claude/rules/${b} eksik — \`split.ts --uygula\` koştur`);
  }
}

// ── 4. kimlik atıfları
const kimlikler = new Set<string>();
for (const d of dokumanlar) {
  const metin = readFileSync(d, "utf8").replace(/\r\n/g, "\n");
  for (const m of metin.matchAll(/^##\s+([A-ZÇĞİÖŞÜ]+-\d+[a-z]?)\s+—/gm)) {
    kimlikler.add(m[1]);
  }
}
const onekler = ALANLAR.filter((a) => a.onek).map((a) => a.onek);
const onekRe = new RegExp(`\\b(${onekler.join("|")})-(\\d+[a-z]?)\\b`, "g");

let bakilanAtif = 0;
const olu = new Map<string, number>();
for (const yol of depoDosyalari) {
  if (!/\.(ts|tsx|md|sql|py)$/.test(yol)) continue;
  const tam = join(KOK, yol);
  if (!existsSync(tam)) continue;
  const metin = readFileSync(tam, "utf8");
  for (const m of metin.matchAll(onekRe)) {
    bakilanAtif++;
    if (!kimlikler.has(m[0])) olu.set(m[0], (olu.get(m[0]) ?? 0) + 1);
  }
}
for (const [id, n] of olu) hatalar.push(`${id} — böyle bir madde yok (${n} atıf)`);

// ── 5. harita ↔ alan dosyaları
const kok = readFileSync(KOK_MD, "utf8");
for (const a of ALANLAR) {
  const yol = `docs/agent/${a.dosya}.md`;
  if (!existsSync(join(BELGE_KOK, yol))) hatalar.push(`${yol} yok ama planda var`);
  if (!kok.includes(yol)) hatalar.push(`${yol} haritada geçmiyor`);
}
for (const f of readdirSync(AGENT_DIR).filter((x) => x.endsWith(".md"))) {
  if (!ALANLAR.some((a) => `${a.dosya}.md` === f)) {
    uyarilar.push(`docs/agent/${f} planda YOK — elle mi eklendi?`);
  }
}

// ── rapor
console.log(`\nAGENTS.md      ${kokBayt} B / ${KOK_TAVAN_BAYT} B tavan`);
console.log(`alan dosyası   ${ALANLAR.length}`);
console.log(`madde kimliği  ${kimlikler.size}`);
console.log(`denetlenen     ${bakilanYol} yol · ${bakilanKapsam} kural kapsamı · ${bakilanAtif} atıf\n`);

for (const u of uyarilar) console.log(`  uyarı  ${u}`);
for (const h of hatalar) console.error(`  HATA   ${h}`);

if (hatalar.length) {
  console.error(`\n✗ ${hatalar.length} hata${uyarilar.length ? `, ${uyarilar.length} uyarı` : ""}\n`);
  process.exit(1);
}
console.log(uyarilar.length ? `\n${uyarilar.length} uyarı, hata yok\n` : "\n✓ temiz\n");
