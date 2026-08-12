// Döviz kuru kaynağı DUMAN TESTİ — gerçek servise gider.
//
//   npx tsx scripts/test-fx-source.ts [gün]
//
// Neyi sınar:
//   1. TCMB bülteni bugünden geriye kaç günde okunuyor, hangi günler tatil.
//   2. ECB (Frankfurter) yedeği aynı aralığı veriyor mu.
//   3. İKİ KAYNAK BİRBİRİNİ TUTUYOR MU — aylık ortalama farkı %0,3'ü geçerse
//      biri bozulmuş demektir ve bu SESSİZ bir hatadır: ekran yine bir sayı
//      basar, yalnız yanlış olanı.
//
// Uygulama kodunu değiştirmez, veritabanına dokunmaz.

import {
  aylikOrtalama,
  gunAraligi,
  haftaSonu,
  type FxDaily,
} from "../src/lib/fx/rates";
import { cekGunlukKurlar, ecbAralik } from "../src/lib/fx/source";

const GUN = Number(process.argv[2] ?? 30);

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function n(v: number, basamak = 4): string {
  return v.toLocaleString("tr-TR", {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  });
}

async function main() {
  const bugun = new Date();
  const bas = new Date(bugun.getTime() - GUN * 86_400_000);
  const from = iso(bas);
  const to = iso(bugun);

  const isGunu = gunAraligi(from, to).filter((g) => !haftaSonu(g));
  console.log(`Aralık: ${from} → ${to}  (${isGunu.length} iş günü)\n`);

  // ————————————————————————————————————————————————————————————— TCMB
  const t0 = Date.now();
  const tcmb = await cekGunlukKurlar(from, to);
  const sure = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`TCMB — ${tcmb.rows.length} gün okundu (${sure} sn)`);
  console.log(`  bülten yok (tatil/hafta sonu dışı): ${tcmb.yayinYokGunler.length}` +
    (tcmb.yayinYokGunler.length ? `  → ${tcmb.yayinYokGunler.join(", ")}` : ""));
  if (tcmb.yedekKullanildi) console.log(`  ECB yedeğinden tamamlanan: ${tcmb.yedekKullanildi}`);
  if (tcmb.hatalar.length) {
    console.log(`  HATA (${tcmb.hatalar.length}):`);
    for (const h of tcmb.hatalar) console.log(`    · ${h}`);
  }

  const son = tcmb.rows[tcmb.rows.length - 1];
  if (son) {
    console.log(
      `  son gün ${son.date}: USD ${n(son.usdTry)} / ${n(son.usdTrySelling ?? 0)}` +
        `  ·  EUR ${n(son.eurTry)} / ${n(son.eurTrySelling ?? 0)}`
    );
  }

  // —————————————————————————————————————————————————————————————— ECB
  const ecb = await ecbAralik(from, to);
  const ecbRows: FxDaily[] = "veri" in ecb ? ecb.veri : [];
  if ("hata" in ecb) console.log(`\nECB — HATA: ${ecb.hata}`);
  else console.log(`\nECB — ${ecbRows.length} gün okundu`);

  // ————————————————————————————————————————— iki kaynak birbirini tutuyor mu
  const aT = aylikOrtalama(tcmb.rows);
  const aE = aylikOrtalama(ecbRows);
  console.log("\nAylık ortalama karşılaştırması (sapma eşiği %0,3):");
  console.log("  dönem    | TCMB EUR/TRY | ECB EUR/TRY  | fark   | TCMB USD/TRY | ECB USD/TRY  | fark");
  let kirmizi = 0;
  for (const t of aT) {
    const e = aE.find((x) => x.period === t.period);
    if (!e) {
      console.log(`  ${t.period}  | ${n(t.eurTry).padStart(12)} | ${"—".padStart(12)} |`);
      continue;
    }
    const fEur = ((t.eurTry - e.eurTry) / e.eurTry) * 100;
    const fUsd = ((t.usdTry - e.usdTry) / e.usdTry) * 100;
    const isaret = Math.abs(fEur) > 0.3 || Math.abs(fUsd) > 0.3 ? " ← SAPMA" : "";
    if (isaret) kirmizi++;
    console.log(
      `  ${t.period}  | ${n(t.eurTry).padStart(12)} | ${n(e.eurTry).padStart(12)} | ` +
        `${fEur.toFixed(3).padStart(6)}% | ${n(t.usdTry).padStart(12)} | ` +
        `${n(e.usdTry).padStart(12)} | ${fUsd.toFixed(3).padStart(6)}%${isaret}`
    );
  }

  // ————————————————————————————————— parite: gün gün mü, ortalamaların oranı mı
  const ay = aT[aT.length - 1];
  if (ay) {
    const yanlis = ay.eurTry / ay.usdTry;
    console.log(
      `\nParite kontrolü (${ay.period}, ${ay.dayCount} gün):\n` +
        `  DOĞRU  avg(EUR/USD)            = ${n(ay.eurUsd, 6)}\n` +
        `  YANLIŞ avg(EUR/TRY)/avg(USD/TRY) = ${n(yanlis, 6)}\n` +
        `  fark = ${(((ay.eurUsd - yanlis) / yanlis) * 100).toFixed(4)}%  (sıfır OLMAMALI)`
    );
  }

  const sorun = tcmb.hatalar.length + kirmizi;
  console.log(sorun === 0 ? "\n✓ Kaynaklar tutarlı." : `\n✗ ${sorun} sorun var.`);
  process.exitCode = sorun === 0 ? 0 : 1;
}

main();
