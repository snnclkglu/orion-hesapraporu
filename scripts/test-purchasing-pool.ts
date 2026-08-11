// Talep havuzu duman testi — GERÇEK veritabanı satırlarıyla.
//
// `loadHavuz` bir Supabase istemcisi ister ve RLS oturum gerektirir; bu betik
// aynı sorguları Management API üzerinden koşturup çekirdeği (`talepHavuzu`)
// gerçek veriyle besler. Amaç ekranı değil ÇEKİRDEĞİN ÇIKTISINI görmektir:
// birleşme doğru mu, çarpan doğru mu, ana grup adları oturmuş mu.
//
//   npx tsx scripts/test-purchasing-pool.ts
//
// Jeton `.env.admin`dendir (gitignore'lu) — bu betik salt-okunur çalışır.

import { readFileSync } from "node:fs";
import { anaGrupKodu, normalizeTanim } from "../src/lib/drawings/normalize";
import { progressKeyOf } from "../src/lib/drawings/progress";
import {
  drawingCarpani,
  talepHavuzu,
  type HavuzPaketi,
  type HavuzSatiri,
  type KalemAdedi,
} from "../src/lib/purchasing/demand";
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
    (await sql<{ group_code: string; name: string }>(
      `select group_code, name from drawing_group_names`
    )).map((g) => [g.group_code, g.name])
  );
  const bilinenGruplar = new Set(grupAdlari.keys());

  const ham = await sql<{
    package_id: string;
    part_code: string;
    kind: string;
    name: string;
    description: string;
    assembly_title: string;
    material: string;
    qty: number | null;
    weight_kg: number | null;
  }>(`
    select dp.package_id, dp.part_code, dp.kind::text as kind, dp.name, dp.description,
           dp.assembly_title, dp.material, dp.qty, dp.weight_kg
    from drawing_parts dp
    join drawing_packages p on p.id = dp.package_id
    where p.status in ('aktif','yuklendi')
      and (dp.kind = 'satinalma' or dp.part_code = '')
  `);

  const havuzPaketleri: HavuzPaketi[] = paketler.map((p) => {
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

  const satirlar: HavuzSatiri[] = ham.map((r) => {
    const groupCode = anaGrupKodu(r.part_code ?? "", bilinenGruplar);
    return {
      packageId: r.package_id,
      partKey: progressKeyOf({
        partCode: r.part_code ?? "",
        description: r.description ?? "",
        name: r.name ?? "",
        kind: r.kind as never,
      }),
      partCode: r.part_code ?? "",
      tanim: (r.description || r.name || "").trim(),
      material: r.material ?? "",
      qty: r.qty,
      weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
      groupCode,
      // `data.ts` ile AYNI kural: defter adı öncelikli, yoksa montaj başlığı.
      groupName:
        (groupCode ? grupAdlari.get(groupCode) : undefined) ??
        (r.assembly_title ? normalizeTanim(r.assembly_title).tanim : ""),
    };
  });

  const h = talepHavuzu(havuzPaketleri, satirlar);

  console.log(`\n${"═".repeat(78)}\nTALEP HAVUZU — GERÇEK VERİ\n${"═".repeat(78)}`);
  console.log(`Paket        : ${havuzPaketleri.length}`);
  for (const p of havuzPaketleri) {
    console.log(
      `  ${p.itemNo.padEnd(12)} ×${String(p.carpan).padStart(2)}${p.carpanBelirsiz ? " (belirsiz)" : ""}  ${p.label}`
    );
  }
  console.log(`\nHam satır    : ${satirlar.length}`);
  console.log(`Kalem        : ${h.toplamKalem}`);
  console.log(`Toplam adet  : ${formatNum(h.toplamAdet)}`);
  console.log(`Çok projeli  : ${h.cokIsliKalem}`);
  console.log(`Adedi belirsiz: ${h.belirsizKalem}`);

  console.log(`\nKATEGORİ DAĞILIMI`);
  for (const s of h.siniflar) {
    console.log(`  ${s.sinif.padEnd(24)} ${String(s.satirSayisi).padStart(3)} kalem · ${formatNum(s.adet)} adet`);
  }

  const cokProjeli = h.satirlar.filter((s) => s.isSayisi > 1);
  console.log(`\nÇOK PROJELİ KALEMLER (${cokProjeli.length}) — havuzun asıl kazancı`);
  for (const s of cokProjeli.slice(0, 25)) {
    console.log(`  ${s.tanim}`);
    console.log(
      `     toplam ${formatNum(s.adet ?? 0)} = ${s.paylar
        .map((p) => `${p.itemNo || "?"}:${p.birimAdet ?? "?"}×${p.carpan}`)
        .join(" + ")}`
    );
  }

  const birlesenYazim = h.satirlar.filter((s) => s.hamTanimlar.length > 1);
  console.log(`\nFARKLI YAZIMDAN BİRLEŞENLER (${birlesenYazim.length})`);
  for (const s of birlesenYazim.slice(0, 20)) {
    console.log(`  ${s.tanim}`);
    for (const t of s.hamTanimlar) console.log(`     ← ${t}`);
  }

  const gruplu = h.satirlar.filter((s) => s.anaGruplar.length > 0);
  console.log(`\nANA GRUBU ÇÖZÜLEN KALEM: ${gruplu.length}/${h.toplamKalem}`);
  for (const s of gruplu.slice(0, 10)) {
    console.log(`  ${s.tanim.padEnd(46)} ${s.anaGruplar.join(" · ")}`);
  }

  console.log(`\nİLK 20 KALEM`);
  for (const s of h.satirlar.slice(0, 20)) {
    console.log(
      `  ${s.sinif.padEnd(20)} ${String(s.adet ?? "—").padStart(6)}  ${s.tanim}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
