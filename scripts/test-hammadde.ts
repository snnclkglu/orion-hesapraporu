// HAMMADDE ÇÖZÜCÜSÜ DUMAN TESTİ — GERÇEK teslim Excel'lerine karşı.
//
// Fikstür testi bu modülde YETMEZ (SATIN-21'in dersi): tanıma dilbilgisi ancak
// ressamın gerçekten yazdığı 900 tanıma karşı koşturulunca ölçülebilir. Betik
// üç şeyi basar:
//
//   1. sınıf dağılımı — beş grubun her birine kaç tanım düştü,
//   2. DİĞER'e düşen HER tanım — burası büyüyorsa dilbilgisi eksiktir,
//   3. ölçüsü okunamayan satırlar — "boş kalsın" kuralının kaç kez işlediği.
//
//   npx tsx scripts/test-hammadde.ts [ek-excel-yolu ...]
//
// Varsayılan kaynaklar workspace'teki iki gerçek teslim klasörüdür; yol
// verilirse onlar da eklenir. Betik SALT OKUNURDUR, veritabanına dokunmaz.

import { existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { hammaddeCozumle, type HammaddeCozumu } from "../src/lib/purchasing/hammadde/cozumle";
import { HAMMADDE_ADLARI, HAMMADDE_SINIFLARI } from "../src/lib/purchasing/hammadde/siniflar";
import { hammaddeHavuzu, type HammaddeKaynagi } from "../src/lib/purchasing/hammadde/havuz";

const WS = join(process.cwd(), "..");

const VARSAYILAN = [
  "0043-00-0000_MTC PASLANMAZ/EXCEL/1.0043-01-0000_DEPO_25.02.2026.xlsx",
  "0043-00-0000_MTC PASLANMAZ/EXCEL/1.0043-01-0000_URUN AGACI_25.02.2026.xlsx",
  "0043-00-0000_MTC PASLANMAZ/0043-00-0050 - BARA AKIM ALMA KOLU/EXCEL/1.0043-00-0050_DEPO_04,06,2026.xlsx",
  "0043-00-0000_MTC PASLANMAZ/HALAT KLAVUZU (Ø325)/EXCEL/1.0043-00-0850_DEPO_25.02.2026.xlsx",
  "0057-00-0500 - MONORAY (1 TON)/EXCEL/2.0057-00-0500_DEPO_31.07.2026.xlsx",
].map((p) => join(WS, p));

interface HamSatir {
  tanim: string;
  malzeme: string;
  kategori: string;
  yapi: string;
  partCode: string;
  adet: number | null;
  kaynak: string;
}

function hucre(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text) return o.text;
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(v);
}

async function excelOku(dosya: string): Promise<HamSatir[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(dosya);
  const ad = dosya.split(/[\\/]/).pop() ?? dosya;
  const out: HamSatir[] = [];
  for (const ws of wb.worksheets) {
    let map: Record<string, number> | null = null;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(hucre(row.getCell(c).value).trim());
      if (!map) {
        const i = vals.findIndex((v) => /^description$/i.test(v));
        if (i >= 0) {
          map = {
            d: i,
            yapi: vals.findIndex((v) => /^bom structure$/i.test(v)),
            kat: vals.findIndex((v) => /^category$/i.test(v)),
            mal: vals.findIndex((v) => /^material$/i.test(v)),
            pn: vals.findIndex((v) => /^part number$/i.test(v)),
            adet: vals.findIndex((v) => /^item qty$/i.test(v)),
          };
        }
        return;
      }
      const m = map;
      const tanim = vals[m.d] ?? "";
      if (!tanim) return;
      const adetHam = m.adet >= 0 ? Number.parseInt(vals[m.adet] ?? "", 10) : Number.NaN;
      out.push({
        tanim,
        malzeme: m.mal >= 0 ? (vals[m.mal] ?? "") : "",
        kategori: m.kat >= 0 ? (vals[m.kat] ?? "") : "",
        yapi: m.yapi >= 0 ? (vals[m.yapi] ?? "") : "",
        partCode: m.pn >= 0 ? (vals[m.pn] ?? "") : "",
        adet: Number.isFinite(adetHam) ? adetHam : null,
        kaynak: ad,
      });
    });
  }
  return out;
}

/** Excel'in `BOM Structure` sütunu → `drawing_parts.kind` karşılığı. */
function kindCoz(yapi: string, partCode: string): string {
  const y = yapi.trim().toLocaleUpperCase("tr-TR");
  if (y === "PURCHASED") return "satinalma";
  if (!partCode.trim()) return "satinalma";
  return "imalat";
}

async function main() {
  const ekler = process.argv.slice(2);
  const dosyalar = [...VARSAYILAN.filter((d) => existsSync(d)), ...ekler];
  if (dosyalar.length === 0) {
    console.error("Okunacak Excel bulunamadı.");
    process.exit(1);
  }

  const satirlar: HamSatir[] = [];
  for (const d of dosyalar) {
    const s = await excelOku(d);
    console.log(`${s.length.toString().padStart(4)} satır  ${d.replace(WS, "…")}`);
    satirlar.push(...s);
  }

  // Aynı tanım birden çok dosyada geçiyor; dilbilgisi ölçümü FARKLI tanımlar
  // üzerinden yapılır, yoksa çok geçen bir kalıp sonucu şişirir.
  const tekil = new Map<string, HamSatir>();
  for (const s of satirlar) if (!tekil.has(s.tanim)) tekil.set(s.tanim, s);

  const cozumler = new Map<string, HammaddeCozumu>();
  let disarida = 0;
  for (const [tanim, s] of tekil) {
    const c = hammaddeCozumle({
      tanim,
      malzeme: s.malzeme,
      kategori: s.kategori,
      kind: kindCoz(s.yapi, s.partCode),
      partCode: s.partCode,
    });
    if (!c) {
      disarida++;
      continue;
    }
    cozumler.set(tanim, c);
  }

  console.log(`\n${tekil.size} farklı tanım · ${disarida} kapsam dışı (ekipman/montaj)`);
  console.log(`${cozumler.size} hammadde adayı\n`);

  const say = new Map<string, number>();
  for (const c of cozumler.values()) say.set(c.sinif, (say.get(c.sinif) ?? 0) + 1);
  for (const s of HAMMADDE_SINIFLARI) {
    const n = say.get(s) ?? 0;
    const pay = cozumler.size > 0 ? ((n / cozumler.size) * 100).toFixed(1) : "0";
    console.log(`  ${HAMMADDE_ADLARI[s].padEnd(8)} ${String(n).padStart(4)}  %${pay}`);
  }

  console.log("\n═══ DİĞER'e düşenler (dilbilgisi eksiği buradan okunur) ═══");
  const digerler = [...cozumler.entries()].filter(([, c]) => c.sinif === "DIGER");
  for (const [tanim, c] of digerler.sort((a, b) => a[0].localeCompare(b[0], "tr"))) {
    console.log(`  ${tanim}${c.eksikler.length ? "   ← " + c.eksikler.join(", ") : ""}`);
  }

  console.log("\n═══ Ölçüsü eksik kalan satırlar ═══");
  const eksikli = [...cozumler.entries()].filter(
    ([, c]) => c.sinif !== "DIGER" && c.eksikler.some((e) => e !== "kalite yazılmamış")
  );
  for (const [tanim, c] of eksikli.sort((a, b) => a[0].localeCompare(b[0], "tr"))) {
    console.log(`  ${tanim}   ← ${c.eksikler.join(", ")}`);
  }
  if (eksikli.length === 0) console.log("  (yok)");

  console.log("\n═══ Örnek çözümler ═══");
  for (const s of HAMMADDE_SINIFLARI) {
    if (s === "DIGER") continue;
    console.log(`\n— ${HAMMADDE_ADLARI[s]}`);
    [...cozumler.entries()]
      .filter(([, c]) => c.sinif === s)
      .slice(0, 10)
      .forEach(([tanim, c]) =>
        console.log(
          `  ${tanim.padEnd(46)} → ${c.stokTanimi.padEnd(26)} ` +
            `${c.kgPerM != null ? c.kgPerM.toFixed(2) + " kg/m" : "—".padEnd(10)} ` +
            `${c.birimAgirlikKg != null ? c.birimAgirlikKg.toFixed(2) + " kg" : ""} ` +
            `[${c.agirlikKaynagi}]${c.payUygulandi ? " PAY" : ""}`
        )
      );
  }

  // ─────────────────────────────────────────── havuz (adetlerle birlikte)
  const kaynaklar: HammaddeKaynagi[] = [];
  for (const s of satirlar) {
    kaynaklar.push({
      packageId: s.kaynak,
      partKey: s.partCode || s.tanim,
      partCode: s.partCode,
      tanim: s.tanim,
      malzeme: s.malzeme,
      kategori: s.kategori,
      kind: kindCoz(s.yapi, s.partCode),
      qty: s.adet,
      groupCode: "",
      groupName: "",
    });
  }
  const havuz = hammaddeHavuzu(
    [
      ...new Set(kaynaklar.map((k) => k.packageId)),
    ].map((id) => ({
      packageId: id,
      label: id,
      itemNo: "0000-00",
      jobNo: "0000",
      jobTitle: "DUMAN TESTİ",
      customer: "—",
      carpan: 1,
      carpanBelirsiz: false,
    })),
    kaynaklar
  );

  console.log(`\n═══ HAVUZ: ${havuz.satirlar.length} stok kalemi ═══`);
  for (const s of HAMMADDE_SINIFLARI) {
    const grup = havuz.satirlar.filter((r) => r.sinif === s);
    if (grup.length === 0) continue;
    console.log(`\n— ${HAMMADDE_ADLARI[s]} (${grup.length} kalem)`);
    grup
      .slice(0, 12)
      .forEach((r) =>
        console.log(
          `  ${r.tanim.padEnd(30)} ${String(r.parcaAdedi).padStart(5)} parça  ` +
            `${r.toplamBoyMm != null ? (r.toplamBoyMm / 1000).toFixed(1) + " m" : "".padEnd(8)}` +
            `${r.boyAdedi != null ? "  " + r.boyAdedi + " boy" : ""}` +
            `${r.toplamAgirlikKg != null ? "  " + Math.round(r.toplamAgirlikKg) + " kg" : ""}`
        )
      );
  }
  console.log(
    `\nTOPLAM AĞIRLIK: ${Math.round(
      havuz.satirlar.reduce((t, r) => t + (r.toplamAgirlikKg ?? 0), 0)
    ).toLocaleString("tr-TR")} kg`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
