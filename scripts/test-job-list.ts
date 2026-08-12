// Güncel İş Listesi PDF duman testi.
// Çalıştırma: npx tsx scripts/test-job-list.ts [çıktı-dizini]
//
// ÜÇ BELGE üretir:
//   1) GERÇEK LİSTE — `job-list-fixture.json` (ORİON-İş Listesi, 88 kalem,
//      FİYATSIZ). Müşteriye giden belgenin bugünkü hâli budur.
//   2) BÜYÜME SINAMASI — aynı satırlar beş katına çıkarılır (440 kalem).
//      Amaç sayfa davranışını görmek: başlık satırı her sayfada tekrar ediyor
//      mu, yıl bandı sayfa dibinde yalnız kalıyor mu, satır ikiye bölünüyor mu.
//      "Gelecekte çok daha fazla işimiz olabilir" isteği bir tasarım şartıdır
//      ve sınanmadan doğru sayılamaz.

import fs from "node:fs";
import path from "node:path";
import { renderJobListPdf, type JobListRow } from "../src/lib/pdf/job-list";
import { jobListDocCode, jobListPeriod } from "../src/lib/pdf/doc-naming";

const outDir = process.argv[2] ?? path.join(process.cwd(), "tmp");
fs.mkdirSync(outDir, { recursive: true });

const fixture: JobListRow[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts", "job-list-fixture.json"), "utf8")
);

const company = {
  company: "ORION CRANES",
  address: "Başkent OSB 1. Cadde No:20, Malıköy · Sincan / ANKARA",
  phone: "+90 312 511 48 06",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

/** PDF'in sayfa adedi — `/Type /Page` sayımı (test-pdf.ts ile aynı yöntem). */
function sayfaAdedi(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/** Büyüme sınaması için satırları çoğaltır; numaralar benzersiz kalır. */
function cogalt(rows: JobListRow[], kat: number): JobListRow[] {
  const out: JobListRow[] = [];
  for (let k = 0; k < kat; k++) {
    for (const r of rows) {
      out.push(
        k === 0
          ? r
          : {
              ...r,
              itemNo: `${String(Number(r.itemNo.slice(0, 4)) + k * 100).padStart(4, "0")}-${r.itemNo.slice(5)}`,
            }
      );
    }
  }
  return out;
}

async function uret(ad: string, rows: JobListRow[]) {
  const bugun = new Date();
  const t0 = Date.now();
  const buf = await renderJobListPdf({
    rows,
    meta: {
      periodLabel: jobListPeriod(bugun),
      docCode: jobListDocCode(bugun),
      generatedAt: bugun.toLocaleDateString("tr-TR"),
    },
    company,
  });
  const dosya = path.join(outDir, ad);
  fs.writeFileSync(dosya, buf);
  const basliyor = buf.subarray(0, 4).toString() === "%PDF";
  console.log(
    `${basliyor ? "✓" : "✗"} ${ad}  ${rows.length} satır · ` +
      `${sayfaAdedi(buf)} sayfa · ${(buf.length / 1024).toFixed(0)} KB · ` +
      `${Date.now() - t0} ms`
  );
  if (!basliyor) process.exitCode = 1;
  return buf;
}

async function main() {
  console.log(`Çıktı: ${outDir}\n`);
  await uret("is-listesi.pdf", fixture);
  await uret("is-listesi-buyume.pdf", cogalt(fixture, 5));

  // Yıl süzgeci uygulanmış hâl — açılır listedeki "yalnız bir yıl" seçeneği.
  const y2026 = fixture.filter((r) => (r.contractDate ?? "").startsWith("2026"));
  await uret("is-listesi-2026.pdf", y2026);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
