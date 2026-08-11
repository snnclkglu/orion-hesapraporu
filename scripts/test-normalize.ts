// Tanım normalizasyonu duman testi — GERÇEK depo Excel'leri üzerinde.
//
// Birim testi el ile seçilmiş satırları sınar; bu betik iki teslim klasörünün
// TAMAMINI geçirir ve üç soruyu cevaplar:
//   1. Kaç tanım değişti, hangi kural çalıştı?
//   2. Değişmeyen (yani sözlüğün tanımadığı) tanımlar neler?
//   3. İki ayrı yazım aynı anahtara geldi mi — yani kaç kalem BİRLEŞTİ?
//
// Kural eklerken önce burayı koştur: yanlış birleşme (iki farklı ürünün tek
// kaleme düşmesi) buradaki "BİRLEŞENLER" listesinde görünür.
//
//   npx tsx scripts/test-normalize.ts

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { normalizeTanim, grupAdlariCikar, anaGrupKodu } from "../src/lib/drawings/normalize";

const KOK = "C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD";

const DOSYALAR = [
  {
    ad: "MONORAY (1 TON) — DEPO",
    yol: `${KOK}/0057-00-0500 - MONORAY (1 TON)/EXCEL/2.0057-00-0500_DEPO_31.07.2026.xlsx`,
  },
  {
    ad: "MTC PASLANMAZ — DEPO",
    yol: `${KOK}/0043-00-0000_MTC PASLANMAZ/EXCEL/1.0043-01-0000_DEPO_25.02.2026.xlsx`,
  },
  {
    ad: "MTC PASLANMAZ — ÜRÜN AĞACI",
    yol: `${KOK}/0043-00-0000_MTC PASLANMAZ/EXCEL/1.0043-01-0000_URUN AGACI_25.02.2026.xlsx`,
  },
];

interface HamSatir {
  partCode: string;
  description: string;
  assemblyTitle: string;
  name: string;
}

async function oku(yol: string): Promise<HamSatir[]> {
  const wb = new ExcelJS.Workbook();
  // `readFileSync` Node 24'te `NonSharedBuffer` döner; exceljs eski `Buffer`
  // tipini bekler. Baytlar aynı — yalnız tip bildirimleri ayrışmış.
  await wb.xlsx.load(readFileSync(yol) as never);
  const ws = wb.worksheets.find((w) => w.name === "BOM") ?? wb.worksheets[0];
  if (!ws) return [];

  // Başlık sözlüğü — sabit sütun sırası VARSAYILMAZ (`excel.ts` ile aynı ilke).
  const basliklar = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    basliklar.set(String(cell.value ?? "").trim().toLowerCase(), col);
  });
  const kolon = (ad: string) => basliklar.get(ad) ?? 0;
  const pn = kolon("part number");
  const desc = kolon("description");
  const title = kolon("title");

  const satirlar: HamSatir[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const oku1 = (c: number) => (c ? String(row.getCell(c).value ?? "").trim() : "");
    const d = oku1(desc);
    if (!d) continue;
    satirlar.push({
      partCode: oku1(pn),
      description: d,
      assemblyTitle: oku1(title),
      name: "",
    });
  }
  return satirlar;
}

function baslik(s: string) {
  console.log(`\n${"═".repeat(78)}\n${s}\n${"═".repeat(78)}`);
}

async function main() {
  const tumSatirlar: HamSatir[] = [];

  for (const d of DOSYALAR) {
    const satirlar = await oku(d.yol);
    tumSatirlar.push(...satirlar);
    baslik(`${d.ad} — ${satirlar.length} satır`);

    const degisen: string[] = [];
    const kuralSayaci = new Map<string, number>();
    for (const s of satirlar) {
      const n = normalizeTanim(s.description);
      for (const k of n.kurallar) kuralSayaci.set(k, (kuralSayaci.get(k) ?? 0) + 1);
      if (n.tanim !== n.ham) degisen.push(`  ${n.ham}\n    → ${n.tanim}   [${n.kurallar.join(",")}]`);
    }

    console.log(`\nDEĞİŞEN: ${degisen.length}/${satirlar.length}`);
    console.log(
      "KURAL DAĞILIMI: " +
        [...kuralSayaci.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ")
    );

    // Aile kuralı çalışanlar en ilginç olanlar — hepsini bas.
    const aileli = satirlar
      .map((s) => normalizeTanim(s.description))
      .filter((n) => n.kurallar.includes("AILE") || n.kurallar.includes("TERIM"));
    console.log(`\nTERİM/AİLE KURALI ÇALIŞAN ${aileli.length} SATIR:`);
    for (const n of [...new Set(aileli.map((a) => `  ${a.ham}\n    → ${a.tanim}`))].slice(0, 60)) {
      console.log(n);
    }

    // Ana grup adları
    const adlar = grupAdlariCikar(satirlar);
    console.log(`\nANA GRUP ADLARI (${adlar.length}):`);
    for (const a of adlar) console.log(`  ${a.groupCode}  ${a.name}   [${a.kaynak}]`);

    const bilinen = new Set(adlar.map((a) => a.groupCode));
    const gruplu = satirlar.filter((s) => s.partCode && anaGrupKodu(s.partCode, bilinen)).length;
    const kodlu = satirlar.filter((s) => s.partCode).length;
    console.log(`\nGRUBA BAĞLANAN: ${gruplu}/${kodlu} kodlu satır`);
  }

  // ——————————————————————————————————— birleşme kontrolü (yanlış eşleşme avı)
  baslik("BİRLEŞENLER — farklı ham yazım, AYNI anahtar");
  const anahtarlar = new Map<string, Set<string>>();
  for (const s of tumSatirlar) {
    const n = normalizeTanim(s.description);
    if (!n.key) continue;
    const küme = anahtarlar.get(n.key) ?? new Set<string>();
    küme.add(n.ham);
    anahtarlar.set(n.key, küme);
  }
  let birlesen = 0;
  for (const [key, hamlar] of anahtarlar) {
    if (hamlar.size < 2) continue;
    birlesen++;
    console.log(`\n  ${key}`);
    for (const h of hamlar) console.log(`    ← ${h}`);
  }
  console.log(`\nTOPLAM ${birlesen} anahtar birden çok ham yazımı topladı.`);
  console.log(
    `Benzersiz anahtar: ${anahtarlar.size} · ham tanım: ${new Set(tumSatirlar.map((s) => s.description)).size}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
