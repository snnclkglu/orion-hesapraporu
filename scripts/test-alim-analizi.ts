// ALIM ANALİZİ — CANLI veritabanıyla duman testi.
//
// `test-hammadde-pool.ts`in kardeşi ve aynı gerekçeyle var: ekranın gösterdiği
// matrisin GERÇEK veriyle ne söylediği ancak burada görünür. Çıktı, kullanıcının
// kendi Excel'inin "Özet" sayfasıyla YAN YANA konup karşılaştırılmak içindir.
//
//   npx tsx scripts/test-alim-analizi.ts
//
// Jeton `.env.admin`dendir (gitignore'lu); betik SALT OKUNURDUR.

import { readFileSync } from "node:fs";
import {
  alimToplami,
  aylikOrtalamaKg,
  aylikSeri,
  kalemOzetleri,
  tedarikciOzetleri,
  yilKategoriMatrisi,
  type AlimSatiri,
} from "../src/lib/purchasing/hammadde/alim-analizi";
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
  const ham = await sql<{
    id: string;
    purchased_at: string;
    supplier: string;
    category: string;
    description: string;
    match_key: string;
    quality: string;
    qty_kg: string;
    total_try: string;
    total_usd: string | null;
    total_eur: string | null;
  }>(
    `select id, purchased_at, supplier, category, description, match_key, quality,
            qty_kg, total_try, total_usd, total_eur
       from purchase_raw_purchases order by purchased_at`
  );

  const satirlar: AlimSatiri[] = ham.map((r) => ({
    id: r.id,
    kaynak: "devralinan",
    gun: String(r.purchased_at).slice(0, 10),
    tedarikci: r.supplier,
    kategori: r.category,
    tanim: r.description,
    key: r.match_key,
    kalite: r.quality,
    kg: Number(r.qty_kg),
    tutarTry: Number(r.total_try),
    tutarUsd: r.total_usd == null ? null : Number(r.total_usd),
    tutarEur: r.total_eur == null ? null : Number(r.total_eur),
  }));

  console.log(`SATIR: ${satirlar.length}`);
  const t = alimToplami(satirlar, "EUR");
  console.log(
    `TOPLAM: ${formatNum(Math.round(t.kg))} kg · ${formatNum(Math.round(t.tutar))} € · ` +
      `ortalama ${formatNum(t.ortalama ?? 0, 6)} €/kg`
  );

  console.log("\nYIL × KATEGORİ (Excel “Özet” sayfasıyla karşılaştırın)");
  console.log("  Yıl  Kategori     Miktar (kg)     Ort. $/kg    Toplam $     Ort. €/kg    Toplam €");
  const usd = new Map(
    yilKategoriMatrisi(satirlar, "USD").map((r) => [`${r.yil}|${r.kategori}`, r.toplam])
  );
  for (const r of yilKategoriMatrisi(satirlar, "EUR")) {
    const u = usd.get(`${r.yil}|${r.kategori}`);
    console.log(
      `  ${r.yil} ${r.kategori.padEnd(8)} ${formatNum(r.toplam.kg, 2).padStart(14)} ` +
        `${formatNum(u?.ortalama ?? 0, 6).padStart(13)} ${formatNum(u?.tutar ?? 0, 2).padStart(12)} ` +
        `${formatNum(r.toplam.ortalama ?? 0, 6).padStart(13)} ${formatNum(r.toplam.tutar, 2).padStart(12)}`
    );
  }

  console.log("\nKATEGORİ TOPLAMLARI");
  for (const k of ["SAC", "PROFIL", "RAY"]) {
    const g = alimToplami(satirlar.filter((s) => s.kategori === k), "EUR");
    console.log(`  ${k.padEnd(8)} ${formatNum(g.kg, 2).padStart(14)} kg`);
  }

  const o = aylikOrtalamaKg(satirlar);
  if (o) {
    console.log(
      `\nAYLIK ORTALAMA ALIM: ${formatNum(Math.round(o.kgAylik))} kg/ay ` +
        `(${o.ilkGun} → ${o.sonGun}, ${o.gun} gün / ${formatNum(o.ay, 2)} ay)`
    );
  }

  const seri = aylikSeri(satirlar, "EUR");
  const dolu = seri.filter((n) => n.ortalama != null);
  console.log(
    `\nAYLIK SERİ: ${seri.length} ay (${dolu.length} ayda alım var, ${seri.length - dolu.length} ay boş)`
  );
  console.log("  Son 6 ay:");
  for (const n of seri.slice(-6)) {
    console.log(
      `    ${n.ay}  ${formatNum(Math.round(n.kg)).padStart(9)} kg  ` +
        `${n.ortalama == null ? "     —   " : `${formatNum(n.ortalama, 4).padStart(9)}`} €/kg`
    );
  }

  console.log("\nEN ÇOK PARA GİDEN 10 KALEM");
  for (const k of kalemOzetleri(satirlar, "EUR").slice(0, 10)) {
    const d = k.degisimOran == null ? "—" : `${k.degisimOran > 0 ? "+" : ""}%${formatNum(k.degisimOran * 100, 1)}`;
    console.log(
      `  ${k.tanim.slice(0, 34).padEnd(34)} ${formatNum(Math.round(k.toplam.kg)).padStart(8)} kg  ` +
        `${formatNum(Math.round(k.toplam.tutar)).padStart(8)} €  ort ${formatNum(k.toplam.ortalama ?? 0, 3)}  ` +
        `ilk ${formatNum(k.ilkBirim ?? 0, 3)} → son ${formatNum(k.sonBirim ?? 0, 3)}  ${d}`
    );
  }

  console.log("\nTEDARİKÇİLER");
  for (const f of tedarikciOzetleri(satirlar, "EUR")) {
    console.log(
      `  ${f.tedarikci.slice(0, 30).padEnd(30)} ${formatNum(Math.round(f.toplam.kg)).padStart(9)} kg  ` +
        `${formatNum(Math.round(f.toplam.tutar)).padStart(8)} €  ort ${formatNum(f.toplam.ortalama ?? 0, 3)}  ` +
        `${formatNum(f.kalemSayisi)} kalem`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
