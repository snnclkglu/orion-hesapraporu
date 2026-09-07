// ÖLÇÜ AYIKLAMA PLANI — hangi ürün, hangi belgeden, hangi öncelikle.
//
// PANO-17: tip numarasının bir sayfada geçmesi ölçünün ona ait olduğu anlamına
// gelmez; ayıklama marka marka ve gözle doğrulanarak yürür. Bu betik o turun
// İŞ LİSTESİNİ üretir — kendi başına hiçbir ölçü okumaz, hiçbir şey yazmaz.
//
// İki kaynağı birleştirir:
//   1. Projelerin malzeme satırları → hangi ürünün ölçüsü eksik (PANO-18 sırası)
//   2. `Elektrik Katalogları/**` içindeki EŞLEŞME defterleri → o ürünü hangi
//      üretici PDF'i kapsıyor
//
//   npx tsx scripts/switchboard-dimension-plan.ts <parts.json> <katalog-kökü> [--out plan.json]

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ElectricalPart } from "@/lib/electrical/types";
import { buildBook, bookSourceBucket, type BookRow } from "@/lib/switchboard/book";
import { catalogIdentityPart } from "@/lib/electrical/catalogs";

/** Eşleşme defterlerinin adı bu ön ekle başlar. */
const INDEKS_ONEKI = "00 - ";

interface Aday {
  /** Katalog kökünden göreli PDF yolu. */
  file: string;
  /** Bu eşlemenin geldiği defter (izlenebilirlik). */
  index: string;
}

/**
 * Eşleşme defterlerini okur ve TİP NUMARASI → ADAY PDF haritası kurar.
 *
 * İki biçim birden taranır ve BİRLEŞTİRİLİR:
 *   · `*Kapsadığı tipler:* A, B, C`  — belge başına tip listesi
 *   · `| A | tanım | adet | X.pdf<br>Y.pdf |` — tip başına belge listesi
 * İkisi de tek başına eksiktir: birincisi ana katalogları, ikincisi tek ürünlük
 * teknik föyleri daha iyi yakalar.
 */
function indeksleriOku(kok: string): Map<string, Aday[]> {
  const harita = new Map<string, Aday[]>();
  const ekle = (tip: string, aday: Aday) => {
    const anahtar = catalogIdentityPart(tip);
    if (!anahtar || anahtar.length < 3) return;
    const liste = harita.get(anahtar) ?? [];
    if (!liste.some((a) => a.file === aday.file)) liste.push(aday);
    harita.set(anahtar, liste);
  };

  const defterler: { yol: string; alt: string }[] = [];
  for (const giris of readdirSync(kok, { withFileTypes: true })) {
    if (giris.isFile() && giris.name.startsWith(INDEKS_ONEKI) && giris.name.endsWith(".md")) {
      defterler.push({ yol: join(kok, giris.name), alt: "" });
    }
    if (giris.isDirectory()) {
      const altKok = join(kok, giris.name);
      for (const ad of readdirSync(altKok)) {
        if (ad.startsWith(INDEKS_ONEKI) && ad.endsWith(".md")) {
          defterler.push({ yol: join(altKok, ad), alt: giris.name });
        }
      }
    }
  }

  for (const defter of defterler) {
    const metin = readFileSync(defter.yol, "utf8");
    const satirlar = metin.split(/\r?\n/);
    let sonBelge = "";

    for (const satir of satirlar) {
      // Belge başlığı: `- **MARKA - Ad (EN).pdf**`
      const belge = /^\s*-\s+\*\*(.+\.pdf)\*\*/i.exec(satir);
      if (belge) {
        sonBelge = defter.alt ? `${defter.alt}/${belge[1]}` : belge[1];
        continue;
      }
      // Belge başına tip listesi.
      const kapsam = /\*Kapsadığı tipler:\*\s*(.+)$/i.exec(satir);
      if (kapsam && sonBelge) {
        for (const parca of kapsam[1].split(/[,;]/)) {
          const tip = parca.replace(/\(.*?\)/g, "").trim();
          if (tip) ekle(tip, { file: sonBelge, index: defter.yol });
        }
        continue;
      }
      // Tip başına belge listesi (tablo satırı).
      const tablo = /^\|\s*`?([^`|]+?)`?\s*\|(.*)\|\s*$/.exec(satir);
      if (tablo) {
        const tip = tablo[1].trim();
        if (!tip || /^tip\b/i.test(tip) || /^-+$/.test(tip)) continue;
        const dosyalar = tablo[2].match(/[^|<>]+\.pdf/gi) ?? [];
        for (const d of dosyalar) {
          const temiz = d.trim();
          ekle(tip, {
            file: temiz.includes("/") || !defter.alt ? temiz : `${defter.alt}/${temiz}`,
            index: defter.yol,
          });
        }
      }
    }
  }
  return harita;
}

/** Katalog kökündeki bütün PDF'lerin göreli yolu — aday doğrulaması için. */
function pdfListesi(kok: string): Set<string> {
  const out = new Set<string>();
  for (const giris of readdirSync(kok, { withFileTypes: true })) {
    if (giris.isFile() && giris.name.toLowerCase().endsWith(".pdf")) out.add(giris.name);
    if (giris.isDirectory()) {
      for (const ad of readdirSync(join(kok, giris.name))) {
        if (ad.toLowerCase().endsWith(".pdf")) out.add(`${giris.name}/${ad}`);
      }
    }
  }
  return out;
}

/**
 * Ürünü bir AİLEYE indirir — ayıklama turu aile aile yürür.
 *
 * Aynı ailenin ürünleri aynı katalogda ve çoğu zaman AYNI TABLODA durur; bir
 * ajan tek açılışta hepsini okur. Aile, sipariş numarasının anlamlı ön ekidir
 * (Siemens `3RV`, Schneider `GV2`); tanınmayan üründe markanın kendisidir.
 */
function aile(supplier: string, typeNo: string): string {
  const t = catalogIdentityPart(typeNo);
  const desenler = [
    /^(6SL3\d{3})/, // SINAMICS
    /^(6ES7\d{3})/, // SIMATIC
    /^(6EP\d)/, // SITOP
    /^(6AV\d)/, // HMI
    /^(6GK\d)/, // SCALANCE
    /^(3RV\d|3RU\d|3RN\d)/, // motor koruma
    /^(3RT\d)/, // kontaktör
    /^(3SU\d|3SK\d)/, // kumanda / güvenlik
    /^(5S[LY]\d)/, // otomat
    /^(3VA\d|3WL\d)/, // MCCB / ACB
    /^(GV\d)/, // TeSys GV
    /^(LC\d|LR\d)/, // TeSys kontaktör
    /^(RX[GM]|RGZ|RSB)/, // Harmony röle
    /^(G\d{2}F|G\d{2}[A-Z])/, // GoPact MCCB
    /^(XB\d)/, // Harmony kumanda
    /^(PT|UT|UK|ST)\d/, // Phoenix klemens
    /^(G2R|G3R)/, // Omron röle
    /^(BC\d|BK\d|BB\d)/, // BEMIS
  ];
  for (const d of desenler) {
    const m = d.exec(t);
    if (m) return `${supplier} ${m[1]}`;
  }
  return supplier || "(marka yok)";
}

function main() {
  const [partsYolu, katalogKok] = process.argv.slice(2);
  if (!partsYolu || !katalogKok) {
    console.error(
      "Kullanım: npx tsx scripts/switchboard-dimension-plan.ts <parts.json> <katalog-kökü> [--out plan.json]"
    );
    process.exit(1);
  }
  if (!existsSync(katalogKok)) {
    console.error(`Katalog kökü bulunamadı: ${katalogKok}`);
    process.exit(1);
  }

  const ham = JSON.parse(readFileSync(partsYolu, "utf8")) as Record<string, unknown>[];
  const parts: ElectricalPart[] = ham.map((r) => ({
    deviceTag: String(r.device_tag ?? ""),
    installation: String(r.installation ?? ""),
    location: String(r.location ?? ""),
    device: String(r.device ?? ""),
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
    designation: String(r.designation ?? ""),
    typeNo: String(r.type_no ?? ""),
    supplier: String(r.supplier ?? ""),
    partNo: String(r.part_no ?? ""),
    page: Number(r.page ?? 0),
  }));

  const rows = buildBook({ parts, models: [] }).filter((r) => r.needsDimensions);
  const indeks = indeksleriOku(katalogKok);
  const pdfler = pdfListesi(katalogKok);

  const gorevler = new Map<
    string,
    {
      family: string;
      supplier: string;
      products: {
        typeNo: string;
        designation: string;
        category: string;
        need: string;
        deviceCount: number;
        unitCount: number;
        railMm: number;
        candidates: string[];
      }[];
      /** Ailenin bütün adaylarının birleşimi — ajan hangi PDF'i açacağını buradan görür. */
      candidates: string[];
      priority: number;
    }
  >();

  let adaysiz = 0;
  for (const r of rows) {
    const kova = bookSourceBucket(r);
    const anahtar = aile(r.supplier, r.typeNo);
    const adaylar = (indeks.get(catalogIdentityPart(r.typeNo)) ?? [])
      .map((a) => a.file)
      .filter((f) => pdfler.has(f));
    if (adaylar.length === 0) adaysiz++;

    const gorev =
      gorevler.get(anahtar) ??
      ({ family: anahtar, supplier: r.supplier, products: [], candidates: [], priority: 0 } as never);
    gorev.products.push({
      typeNo: r.typeNo,
      designation: r.designation,
      category: r.category,
      need: kova,
      deviceCount: r.deviceCount,
      unitCount: r.unitCount,
      railMm: Math.round(r.railMm),
      candidates: adaylar,
    });
    for (const a of adaylar) if (!gorev.candidates.includes(a)) gorev.candidates.push(a);
    // ÖNCELİK: eksik ürün tahminden ağır basar, sonra belirlenen ray uzunluğu.
    gorev.priority += (kova === "eksik" ? 5000 : 0) + Math.round(r.railMm);
    gorevler.set(anahtar, gorev);
  }

  const plan = [...gorevler.values()].sort((a, b) => b.priority - a.priority);

  console.log(`Ölçü gereken ürün: ${rows.length} · aile: ${plan.length}`);
  console.log(`Eşleşme defterinden aday PDF bulunamayan ürün: ${adaysiz}`);
  console.log(`Katalog kökündeki PDF: ${pdfler.size}\n`);
  for (const g of plan) {
    const eksik = g.products.filter((p) => p.need === "eksik").length;
    console.log(
      `  ${String(g.priority).padStart(6)}  ${g.family.padEnd(26)} ` +
        `ürün=${String(g.products.length).padStart(2)} eksik=${String(eksik).padStart(2)} ` +
        `aday PDF=${String(g.candidates.length).padStart(2)}`
    );
  }

  const outIdx = process.argv.indexOf("--out");
  if (outIdx > 0) {
    const yol = process.argv[outIdx + 1] ?? "plan.json";
    writeFileSync(yol, JSON.stringify(plan, null, 2), "utf8");
    console.log(`\nPlan yazıldı: ${yol}`);
  }
}

main();
