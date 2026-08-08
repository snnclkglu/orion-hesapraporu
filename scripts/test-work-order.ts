// İş Emri PDF duman testi — kalem sayısına göre sayfa dengesini görsel
// kontrol için 1 / 2 / 5 / 12 kalemli dört çıktı üretir.
//
//   npx tsx scripts/test-work-order.ts
//
// Çıktılar .test-output/ altına yazılır (gitignore'da).

import * as fs from "node:fs";
import * as path from "node:path";
import { renderWorkOrderPdf, type WorkOrderData } from "@/lib/pdf/work-order";

const OUT_DIR = path.resolve(__dirname, "..", ".test-output");

const BASE: Omit<WorkOrderData, "items"> = {
  job_no: "0055",
  title: "İsdemir Amonyum Sülfat Tesisi 2m³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci",
  form_code: "FR.11.02",
  work_order_date: "2026-05-11",
  customer: "İSKENDERUN DEMİR VE ÇELİK A.Ş.",
  customer_address: "Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay",
  customer_tax_office: "HATAY - Akdeniz Vergi Dairesi Müdürlüğü",
  customer_tax_no: "8790009670",
  customer_phone: "+90 (326) 758 40 40",
  customer_fax: "+90 (326) 758 38 38",
  contract_exists: true,
  contract_date: "2026-05-11",
  workshop_exit_date: "2027-02-01",
  delivery_date: "2027-03-01",
  quantity_text: "1",
  job_leader: "Sinan Çolakoğlu",
  scope: { proje: true, imalat: true, montaj: false, nakliye: true, malzeme: false, devreyeAlma: true },
  prepared_by_name: "Salih Ergüven",
  prepared_by_title: "Genel Müdür",
  notes: "SAT-SAS No: 410034613\nSözleşme No: 2026-30",
};

const PRODUCTS = [
  "İsdemir Amonyum Sülfat Tesisi 2m³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci",
  "10 t x 20 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci",
  "5 t x 14 m Tek Kirişli Köprülü Vinç",
  "3 t x 6 m Monoray Vinç",
  "20 t Kaldırma Kirişi (Spreader Beam)",
  "2 x 15 t Portal Vinç — Araba Komplesi",
  "1 t Pergel Vinç",
  "35 t Tambur ve Kanca Yedek Grubu",
  "İsdemir SD-10 Vinci Operatör Kabini",
  "40 t x 16,7 m Kapasiteli Portal Vinç",
  "75 t Kapasiteli Kaldırma Kirişi",
  "100 t x 15,50 m Çift Kirişli Köprülü Tavan Vinci",
];

function itemsFor(count: number): WorkOrderData["items"] {
  return Array.from({ length: count }, (_, i) => ({
    // Firma kuralı: tek kalemde -00, çok kalemde -01'den başlar.
    item_no: count === 1 ? "0055-00" : `0055-${String(i + 1).padStart(2, "0")}`,
    product_name: PRODUCTS[i % PRODUCTS.length],
    quantity: String((i % 3) + 1),
  }));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const count of [1, 2, 5, 8, 10, 12, 16]) {
    const data: WorkOrderData = { ...BASE, items: itemsFor(count) };
    const buffer = await renderWorkOrderPdf(data);
    const file = path.join(OUT_DIR, `is-emri-${String(count).padStart(2, "0")}-kalem.pdf`);
    fs.writeFileSync(file, buffer);
    const header = buffer.subarray(0, 5).toString("latin1");
    const pages = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    console.log(
      `${String(count).padStart(2, " ")} kalem → ${path.basename(file)}  ` +
        `${header === "%PDF-" ? "OK" : "BOZUK"}  ${(buffer.length / 1024).toFixed(1)} KB  ${pages} sayfa`
    );
  }
  console.log("İş Emri PDF duman testi BAŞARILI.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
