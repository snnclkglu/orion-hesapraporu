// İş Takibi Excel çıktısı duman testi.
//
//   npx tsx scripts/test-work-log-excel.ts
//
// Sahte kayıtlarla çalışma kitabını üretir, `tmp/` altına yazar ve sayfa
// adlarını + satır sayılarını basar. Amaç exceljs kullanımını (birleştirme,
// dolgu, otomatik süzgeç, dondurulmuş başlık) gerçek bir dosya üzerinde
// doğrulamaktır — bu katman birim testiyle yakalanamaz.

import { mkdirSync, writeFileSync } from "node:fs";
import { buildWorkLogWorkbook } from "../src/lib/excel/work-log";
import { downloadName, type WorkLogRow } from "../src/lib/work-log";

const CATS = [
  { id: "c1", name: "Çelik İmalat", hue: 25 },
  { id: "c2", name: "Talaşlı İmalat", hue: 235 },
  { id: "c3", name: "Montaj", hue: 155 },
];
const PARTS = ["Ana Kiriş", "Baş Kiriş", "Kabin", "Boji", "Tambur 185T"];
const JOBS = [
  { itemNo: "0025-00", jobNo: "0025", customer: "İZMİR DEMİR ÇELİK SANAYİ A.Ş.", product: "20 t x 30 m Vinç" },
  { itemNo: "0026-01", jobNo: "0026", customer: "ASTOR A.Ş.", product: "100 t x 15,5 m Vinç" },
  { itemNo: "0020-00", jobNo: "", customer: "", product: "" },
];

const rows: WorkLogRow[] = [];
for (let d = 0; d < 120; d++) {
  const date = new Date(Date.UTC(2025, 9, 1) + d * 86_400_000).toISOString().slice(0, 10);
  for (let i = 0; i < 3; i++) {
    const job = JOBS[(d + i) % JOBS.length];
    const cat = CATS[(d + i) % CATS.length];
    const people = 1 + ((d + i) % 5);
    const hours = 8;
    rows.push({
      id: `${d}-${i}`,
      date,
      itemNo: job.itemNo,
      jobId: job.jobNo ? `job-${job.jobNo}` : null,
      jobItemId: job.jobNo ? `item-${job.itemNo}` : null,
      jobNo: job.jobNo,
      jobTitle: job.product,
      customer: job.customer,
      customerShort: null,
      customerHue: null,
      productName: job.product,
      partId: `p${(d + i) % PARTS.length}`,
      partName: PARTS[(d + i) % PARTS.length],
      categoryId: cat.id,
      categoryName: cat.name,
      categoryHue: cat.hue,
      partCode: ["0100", "0200", "1000"][(d + i) % 3],
      people,
      hours,
      manHours: people * hours,
      note: i === 0 && d % 20 === 0 ? "Akşam mesaisi" : "",
    });
  }
}

const now = new Date();
const wb = buildWorkLogWorkbook(rows, {
  filterText: "01.10.2025 – 28.01.2026 · Tüm kayıtlar",
  generatedAt: now.toLocaleString("tr-TR"),
  preparedBy: "Duman Testi",
});

// tsx betikleri CJS'e derlendiği için üst düzey `await` kullanılamaz.
async function main(): Promise<void> {
  mkdirSync("tmp", { recursive: true });
  const name = downloadName("ORION İş Takibi", "xlsx", now);
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(`tmp/${name}`, Buffer.from(buf as ArrayBuffer));

  console.log(`Kayıt: ${rows.length}`);
  console.log(`Toplam adam·saat: ${rows.reduce((s, r) => s + r.manHours, 0)}`);
  for (const ws of wb.worksheets) {
    console.log(`  · ${ws.name.padEnd(18)} ${ws.rowCount} satır × ${ws.columnCount} sütun`);
  }
  console.log(`Yazıldı: tmp/${name}`);
}

void main();
