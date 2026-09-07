// ÖLÇÜ DEFTERİ BOŞLUK RAPORU — hangi ürünün ölçüsü ne kadar yer belirliyor?
//
// Ölçü defterini (PANO-12) doldurmak 247 ürünlük bir iştir ve hepsi eşit
// değildir: 970 adet geçen bir klemensin 1 mm'lik hatası panoyu bir metre
// büyütür, tek adet geçen bir sinyal lambasının 10 mm'si hiçbir şeyi
// değiştirmez. Bu betik sırayı ETKİYE göre kurar — kaç mm ray o ürünün
// ölçüsüne bağlı.
//
// Üç kova sayılır:
//   ölçüldü  — defterden geldi (`katalog` / `elle`)
//   tahmin   — kural tabanlı; sipariş edilebilir DEĞİL (PANO-12)
//   eksik    — hiçbir kaynak veremedi; cihaz panoya hiç girmiyor
//
//   npx tsx scripts/switchboard-dimension-gap.ts <pdf|json> [--marka SIEMENS]
//
// JSON girdisi `electrical_parts` satırlarının snake_case dökümüdür (Management
// API sorgusunun çıktısı); PDF girdisi belgeyi okuyup aynı boruya sokar.

import { readFileSync } from "node:fs";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";
import { readPartsDump } from "./switchboard-parts-dump";
import type { ElectricalPart } from "@/lib/electrical/types";
import { electricalCategory } from "@/lib/electrical/category";
import { materialCatalogIdentity } from "@/lib/electrical/catalogs";
import { footprintFor } from "@/lib/switchboard/footprint";
import { mountRuleFor } from "@/lib/switchboard/mount";
import { deviceModelLookup } from "@/lib/switchboard/registry";
import type { DeviceModel } from "@/lib/switchboard/types";

interface Satir {
  key: string;
  supplier: string;
  typeNo: string;
  partNo: string;
  designation: string;
  category: string;
  mount: string;
  /** Kaç aygıt (etiket) bu üründen. */
  aygit: number;
  /** Toplam birim adedi — klemenste şerit uzunluğunu bu belirler. */
  adet: number;
  enMm: number | null;
  /** Bu ürünün belirlediği toplam ray uzunluğu [mm]. */
  rayMm: number;
  kaynak: string;
  projeler: Set<string>;
}

function sayi(v: number): string {
  return Math.round(v).toLocaleString("tr-TR");
}

async function parcalariOku(yol: string): Promise<{ parts: ElectricalPart[]; proje: string[] }> {
  if (yol.toLowerCase().endsWith(".json")) {
    // ORTAK OKUYUCU: ham döküm UYGULAMANIN GÖRDÜĞÜ hâle getirilir
    // (`cleanElectricalPart`, ELEKTRIK-14). Temizlemeden okumak, uygulamanın
    // hiç görmediği bir tip numarasıyla çalışmak demektir.
    const d = readPartsDump(yol);
    if (d.cleaned || d.dropped) {
      console.log(`Antet temizliği: ${d.cleaned} satır düzeltildi, ${d.dropped} satır düşürüldü.`);
    }
    return { parts: d.parts, proje: d.projects };
  }
  const okuma = await readElectricalPdf(new Uint8Array(readFileSync(yol)));
  return { parts: okuma.parts, proje: [okuma.titleBlock.jobNumber || "?"] };
}

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/switchboard-dimension-gap.ts <pdf|json> [--marka X]");
    process.exit(1);
  }
  const markaIdx = process.argv.indexOf("--marka");
  const markaSuzgeci = markaIdx > 0 ? (process.argv[markaIdx + 1] ?? "").toUpperCase() : "";

  const { parts, proje } = await parcalariOku(yol);
  console.log(`Kaynak: ${parts.length} aygıt satırı · proje: ${proje.join(", ")}`);

  // DEFTER OKUNUR: rapor "bugün ne eksik" sorusunu cevaplar ve defter
  // doldukça aynı betik İLERLEMEYİ ölçer (PANO-18). `--defter <json>`
  // verilmezse defter boş varsayılır ve rapor başlangıç durumunu gösterir.
  const defterIdx = process.argv.indexOf("--defter");
  const defter = new Map<string, DeviceModel>();
  if (defterIdx > 0) {
    const ham = JSON.parse(readFileSync(process.argv[defterIdx + 1], "utf8")) as Record<
      string,
      unknown
    >[];
    for (const r of ham) {
      const sayi = (v: unknown): number | null =>
        v === null || v === undefined ? null : Number(v);
      defter.set(String(r.lookup_key), {
        lookupKey: String(r.lookup_key),
        supplier: String(r.supplier ?? ""),
        typeNo: String(r.type_no ?? ""),
        widthMm: sayi(r.width_mm),
        heightMm: sayi(r.height_mm),
        depthMm: sayi(r.depth_mm),
        moduleUnits: sayi(r.module_units),
        mountType: (r.mount_type ?? null) as DeviceModel["mountType"],
        zone: (r.zone ?? null) as DeviceModel["zone"],
        clearanceTopMm: sayi(r.clearance_top_mm),
        clearanceBottomMm: sayi(r.clearance_bottom_mm),
        heatW: sayi(r.heat_w),
        source: (r.source === "elle" ? "elle" : "katalog") as DeviceModel["source"],
        note: String(r.note ?? ""),
      });
    }
    console.log(`Defter: ${defter.size} ürün okundu.`);
  }

  // Defterde arama TEK TANIMDIR (`registry.ts`) — ekran ve yerleşimle aynı.
  const defterBul = deviceModelLookup(defter.values());

  const urunler = new Map<string, Satir>();
  const gorulen = new Set<string>();

  for (const p of parts) {
    // Bir aygıt etiketi bir fiziksel kutudur; aynı etiketin ikinci satırı
    // sayılmaz (`panels.ts` ile aynı kural).
    const etiket = `${p.installation}|${p.location}|${p.device}`;
    if (p.device && gorulen.has(etiket)) continue;
    if (p.device) gorulen.add(etiket);

    const category = electricalCategory(p);
    const kural = mountRuleFor({ category, designation: p.designation, typeNo: p.typeNo });
    const kimlik = materialCatalogIdentity(p);
    const olcu = footprintFor(
      {
        category,
        designation: p.designation,
        typeNo: p.typeNo,
        supplier: p.supplier,
        partNo: p.partNo,
      },
      defterBul(kimlik.lookupKey),
      null
    );

    // Panoya girmeyen (saha) ve gövde gereci ürünler ölçü DEFTERİ İSTEMEZ.
    const yerlesir =
      kural.mountType === "din" || kural.mountType === "plaka" || kural.mountType === "kapak";
    if (!yerlesir) continue;

    const seritMi = category === "Fiş, Priz, Klemens ve Bağlantı";
    const adet = seritMi && typeof p.qty === "number" && p.qty > 0 ? Math.round(p.qty) : 1;

    const anahtar = kimlik.lookupKey;
    const mevcut = urunler.get(anahtar);
    const rayMm = (olcu.widthMm ?? 0) * adet;
    if (mevcut) {
      mevcut.aygit += 1;
      mevcut.adet += adet;
      mevcut.rayMm += rayMm;
    } else {
      urunler.set(anahtar, {
        key: anahtar,
        supplier: kimlik.supplier || "(boş)",
        typeNo: kimlik.typeNo,
        partNo: p.partNo,
        designation: p.designation,
        category,
        mount: kural.mountType ?? "—",
        aygit: 1,
        adet,
        enMm: olcu.widthMm,
        rayMm,
        kaynak: olcu.source ?? "eksik",
        projeler: new Set(proje),
      });
    }
  }

  const liste = [...urunler.values()].filter(
    (u) => !markaSuzgeci || u.supplier.toUpperCase().includes(markaSuzgeci)
  );

  const kovalar = { katalog: 0, elle: 0, tahmin: 0, eksik: 0 } as Record<string, number>;
  let toplamRay = 0;
  let bilinmeyenAdet = 0;
  for (const u of liste) {
    kovalar[u.kaynak] = (kovalar[u.kaynak] ?? 0) + 1;
    toplamRay += u.rayMm;
    if (u.kaynak === "eksik") bilinmeyenAdet += u.adet;
  }

  console.log(
    `\nPanoya giren ürün: ${liste.length} · ölçüldü ${kovalar.katalog + kovalar.elle} · ` +
      `tahmin ${kovalar.tahmin} · EKSİK ${kovalar.eksik}`
  );
  console.log(
    `Ölçüsü bilinen ürünlerin belirlediği ray: ${sayi(toplamRay)} mm · ` +
      `ölçüsüz ${bilinmeyenAdet} birim hiç yerleşemiyor`
  );

  // ── ÖNCELİK: en çok ray uzunluğunu belirleyen ürünler ────────────────────
  const oncelik = [...liste].sort((a, b) => b.rayMm - a.rayMm || b.adet - a.adet);
  console.log("\n── ETKİYE GÖRE İLK 20 (ray mm · adet · kaynak) ──");
  for (const u of oncelik.slice(0, 20)) {
    console.log(
      `  ${sayi(u.rayMm).padStart(6)} mm  ${String(u.adet).padStart(4)}×  ${u.kaynak.padEnd(7)} ` +
        `${u.supplier.slice(0, 18).padEnd(18)} ${u.typeNo.slice(0, 28).padEnd(28)} ${u.category.slice(0, 26)}`
    );
  }

  // ── EKSİKLER: hiç yerleşemeyenler, adete göre ───────────────────────────
  const eksikler = liste.filter((u) => u.kaynak === "eksik").sort((a, b) => b.adet - a.adet);
  console.log(`\n── ÖLÇÜSÜ HİÇ OLMAYAN ${eksikler.length} ÜRÜN (adet · aygıt) ──`);
  for (const u of eksikler) {
    console.log(
      `  ${String(u.adet).padStart(4)}× ${String(u.aygit).padStart(3)}a  ` +
        `${u.supplier.slice(0, 20).padEnd(20)} ${u.typeNo.slice(0, 30).padEnd(30)} ` +
        `${u.category.slice(0, 24).padEnd(24)} ${u.designation.slice(0, 46)}`
    );
  }

  // ── MARKA DÖKÜMÜ: ayıklama turu marka marka yürür (PANO-17) ─────────────
  const marka = new Map<string, { urun: number; eksik: number; tahmin: number }>();
  for (const u of liste) {
    const m = marka.get(u.supplier) ?? { urun: 0, eksik: 0, tahmin: 0 };
    m.urun += 1;
    if (u.kaynak === "eksik") m.eksik += 1;
    if (u.kaynak === "tahmin") m.tahmin += 1;
    marka.set(u.supplier, m);
  }
  console.log("\n── MARKA DÖKÜMÜ (ürün · eksik · tahmin) ──");
  for (const [ad, m] of [...marka.entries()].sort((a, b) => b[1].urun - a[1].urun)) {
    console.log(`  ${String(m.urun).padStart(3)} ${String(m.eksik).padStart(3)} ${String(m.tahmin).padStart(3)}  ${ad}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
