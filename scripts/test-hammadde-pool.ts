// Hammadde havuzu duman testi — GERÇEK veritabanı satırlarıyla.
//
// `test-purchasing-pool.ts`in kardeşi ve aynı gerekçeyle var: `loadHammaddeHavuzu`
// bir Supabase istemcisi ve RLS oturumu ister, betikte oturum yoktur. Aynı
// sorgular Management API üzerinden koşturulur ve saf çekirdek (`hammaddeHavuzu`)
// GERÇEK veriyle beslenir. Amaç ekranı değil ÇEKİRDEĞİN ÇIKTISINI görmektir.
//
// Fikstür testi bu modülde YETMEZ (SATIN-21'in dersi): satın alma havuzunda üç
// gerçek hata yalnız canlı veriyle görüldü. Burada da bakılacak şeyler:
// bölünme artıksız mı (ekipman + hammadde = defter), sınıf dağılımı makul mü,
// DİĞER'e ne düşüyor.
//
//   npx tsx scripts/test-hammadde-pool.ts
//
// Jeton `.env.admin`dendir (gitignore'lu); betik SALT OKUNURDUR.

import { readFileSync } from "node:fs";
import {
  anaGrupAdaylari,
  anaGrupKodu,
  genelKompleMu,
  normalizeTanim,
} from "../src/lib/drawings/normalize";
import { drawingCarpani, type KalemAdedi } from "../src/lib/purchasing/demand";
import {
  hammaddeHavuzu,
  type HammaddeKaynagi,
  type HammaddePaketi,
} from "../src/lib/purchasing/hammadde/havuz";
import { HAMMADDE_ADLARI, HAMMADDE_SINIFLARI } from "../src/lib/purchasing/hammadde/siniflar";
import { formatNum } from "../src/lib/drawings/labels";

function env(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const token = env(".env.admin").SUPABASE_ACCESS_TOKEN;
const ref = env(".env.frankfurt").SUPABASE_PROJECT_REF;

async function sql<T>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function main() {
  const paketler = await sql<{
    id: string;
    item_no: string;
    job_item_id: string | null;
    group_code: string;
    description: string;
    folder_name: string;
    job_no: string | null;
    job_title: string | null;
    customer: string | null;
  }>(`
    select p.id, p.item_no, p.job_item_id, p.group_code, p.description, p.folder_name,
           j.job_no, j.title as job_title, coalesce(c.short_name, j.customer) as customer
    from drawing_packages p
    left join jobs j on j.id = p.job_id
    left join customers c on c.id = j.customer_id
    where p.status in ('aktif','yuklendi')
    order by p.item_no
  `);

  const kalemler = await sql<KalemAdedi & Record<string, unknown>>(`
    select id, item_no as "itemNo", qty, shares_drawings_with as "sharesWith" from job_items
  `);

  const grupAdlari = new Map(
    (
      await sql<{ group_code: string; name: string }>(
        `select group_code, name from drawing_group_names`
      )
    ).map((g) => [g.group_code, g.name])
  );
  const bilinenGruplar = new Set(grupAdlari.keys());

  // BÖLÜNMENİN İKİ YARISI DA SAYILIR: ekran kuralı ile SQL kuralı ayrışırsa
  // toplamlar tutmaz ve bu, hiçbir fikstür testinin yakalayamayacağı bir hata.
  const [sayim] = await sql<{
    toplam: number;
    ekipman: number;
    imalat: number;
    montaj: number;
  }>(`
    select
      count(*)::int as toplam,
      count(*) filter (where dp.kind = 'satinalma' or dp.part_code = '')::int as ekipman,
      count(*) filter (where dp.kind in ('imalat','bilinmiyor') and dp.part_code <> '')::int as imalat,
      count(*) filter (where dp.kind = 'montaj' and dp.part_code <> '')::int as montaj
    from drawing_parts dp
    join drawing_packages p on p.id = dp.package_id
    where p.status in ('aktif','yuklendi')
  `);

  const ham = await sql<{
    package_id: string;
    part_code: string;
    parent_code: string;
    kind: string;
    name: string;
    description: string;
    assembly_title: string;
    material: string;
    category: string;
    qty: number | null;
    cut_length_mm: number | string | null;
  }>(`
    select dp.package_id, dp.part_code, dp.parent_code, dp.kind::text as kind, dp.name,
           dp.description, dp.assembly_title, dp.material, dp.category, dp.qty,
           dp.cut_length_mm
    from drawing_parts dp
    join drawing_packages p on p.id = dp.package_id
    where p.status in ('aktif','yuklendi')
      and dp.kind in ('imalat','bilinmiyor')
      and dp.part_code <> ''
    order by dp.id
  `);

  const havuzPaketleri: HammaddePaketi[] = paketler.map((p) => {
    const c = drawingCarpani(p.job_item_id, p.item_no, kalemler);
    return {
      packageId: p.id,
      label: [p.group_code, p.description].filter(Boolean).join(" · ") || p.folder_name,
      itemNo: p.item_no,
      jobNo: p.job_no ?? "",
      jobTitle: p.job_title ?? "",
      customer: p.customer ?? "",
      carpan: c.carpan,
      carpanBelirsiz: c.belirsiz,
    };
  });

  const grupCoz = (kod: string): string => {
    const k = (kod ?? "").trim();
    if (!k) return "";
    if (bilinenGruplar.has(k)) return k;
    if (genelKompleMu(k)) return k;
    return anaGrupKodu(k, bilinenGruplar) || anaGrupAdaylari(k).find(genelKompleMu) || "";
  };

  const kaynaklar: HammaddeKaynagi[] = ham.map((r) => {
    const groupCode = grupCoz(r.part_code) || grupCoz(r.parent_code);
    return {
      packageId: r.package_id,
      partKey: r.part_code,
      partCode: r.part_code,
      tanim: (r.description || r.name || "").trim(),
      malzeme: r.material ?? "",
      kategori: r.category ?? "",
      kind: r.kind,
      qty: r.qty,
      kesimBoyuMm: r.cut_length_mm == null ? null : Number(r.cut_length_mm),
      groupCode,
      groupName:
        grupAdlari.get(groupCode) ??
        (r.assembly_title ? normalizeTanim(r.assembly_title).tanim : ""),
    };
  });

  const havuz = hammaddeHavuzu(havuzPaketleri, kaynaklar);

  console.log(`Canlı paket: ${paketler.length}`);
  // BÖLÜNME ÜÇ KÜMEDİR, İKİ DEĞİL: montaj satırlarının kendi hammaddesi
  // yoktur (çocuklarınınki vardır) ve hiçbir havuza girmez.
  const kapsanan = sayim.ekipman + sayim.imalat + sayim.montaj;
  console.log(
    `Defter: ${sayim.toplam} satır — ekipman ${sayim.ekipman} + imalat ${sayim.imalat} + ` +
      `montaj ${sayim.montaj} = ${kapsanan} ` +
      `${kapsanan === sayim.toplam ? "✓ artıksız" : "✗ ARTIK VAR"}`
  );
  console.log(`Hammadde adayı: ${kaynaklar.length} → ${havuz.kaynakSatiri} çözüldü`);
  console.log(`Stok kalemi: ${havuz.toplamKalem} · ${formatNum(Math.round(havuz.toplamAgirlikKg))} kg\n`);

  for (const s of HAMMADDE_SINIFLARI) {
    const g = havuz.siniflar.find((x) => x.sinif === s);
    console.log(
      `  ${HAMMADDE_ADLARI[s].padEnd(8)} ${String(g?.satirSayisi ?? 0).padStart(4)} kalem  ` +
        `${formatNum(Math.round(g?.agirlikKg ?? 0)).padStart(10)} kg`
    );
  }

  console.log("\n═══ DİĞER'e düşenler ═══");
  const diger = havuz.satirlar.filter((s) => s.sinif === "DIGER");
  if (diger.length === 0) console.log("  (yok)");
  for (const s of diger) {
    console.log(`  ${s.tanim}${s.eksikler.length ? "   ← " + s.eksikler.join(", ") : ""}`);
  }

  console.log("\n═══ En ağır 20 stok kalemi ═══");
  for (const s of havuz.satirlar.slice(0, 20)) {
    console.log(
      `  ${HAMMADDE_ADLARI[s.sinif].padEnd(7)} ${s.tanim.padEnd(32)} ` +
        `${String(s.parcaAdedi).padStart(5)} parça  ` +
        `${(s.toplamBoyMm != null ? (s.toplamBoyMm / 1000).toFixed(1) + " m" : "").padStart(10)}  ` +
        `${(s.boyAdedi != null ? s.boyAdedi + " boy" : "").padStart(8)}  ` +
        `${formatNum(Math.round(s.toplamAgirlikKg ?? 0)).padStart(9)} kg` +
        `${s.eksikler.length ? "  ← " + s.eksikler.join(", ") : ""}`
    );
  }

  const olcusuz = havuz.satirlar.filter((s) =>
    s.eksikler.some((e) => e !== "kalite yazılmamış")
  );
  console.log(`\nÖlçüsü eksik kalem: ${olcusuz.length}`);
  for (const s of olcusuz.slice(0, 15)) console.log(`  ${s.tanim} ← ${s.eksikler.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
