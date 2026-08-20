// İş Emri (FR.11.02) — kalem numaralandırma kuralı + PDF sayfa dengesi.
//
// İki şey korunur:
//   1. Firma numaralandırma kuralı: TEK kalemli işte kalem `-00`, ÇOK kalemli
//      işte `-01`den başlar (ikinci kalem eklendiğinde ilk kalem de kayar).
//   2. Sayfa dengesi: tek kalemli emir tek sayfa olmalı ve o sayfa boş
//      görünmemeli; kalem listesi uzadıkça tablo sıkışmalı, taşma olduğunda
//      ikinci sayfaya YALNIZ imza bloğu düşmemeli.

import { describe, expect, it } from "vitest";
import { autoItemNos, autoQuantityText } from "@/app/(app)/jobs/schema";
import { renderWorkOrderPdf, type WorkOrderData } from "../work-order";

describe("iş kalemi numaralandırma", () => {
  it("tek kalemli işte numara -00'dır", () => {
    expect(autoItemNos("0075", 1)).toEqual(["0075-00"]);
  });

  it("çok kalemli işte numaralar -01'den başlar", () => {
    expect(autoItemNos("0075", 3)).toEqual(["0075-01", "0075-02", "0075-03"]);
  });

  it("ikinci kalem eklenince ilk kalem de -00'dan -01'e kayar", () => {
    expect(autoItemNos("0075", 1)[0]).toBe("0075-00");
    expect(autoItemNos("0075", 2)[0]).toBe("0075-01");
  });

  it("iş no zaten son ekliyse kök alınır (eski kayıtlar)", () => {
    expect(autoItemNos("0057-00", 2)).toEqual(["0057-01", "0057-02"]);
  });

  it("iş no boşsa numara üretilmez", () => {
    expect(autoItemNos("", 2)).toEqual(["", ""]);
  });

  it("dokuzuncu kalemden sonra iki hane korunur", () => {
    const nos = autoItemNos("0075", 12);
    expect(nos[8]).toBe("0075-09");
    expect(nos[9]).toBe("0075-10");
  });
});

describe("adet toplamı", () => {
  it("kalem adetlerini toplar", () => {
    expect(autoQuantityText([{ quantity: "1" }, { quantity: "2" }, { quantity: "3" }])).toBe("6");
  });

  it("metin ekli adetlerde baştaki sayıyı okur", () => {
    expect(autoQuantityText([{ quantity: "3 Adet" }, { quantity: "2 adet" }])).toBe("5");
  });

  it("hiçbir kalemde sayı yoksa BOŞ döner — 0 yazıp yanlış kesinlik iddia etmez", () => {
    expect(autoQuantityText([{ quantity: "Muhtelif" }, { quantity: "" }])).toBe("");
  });

  it("sayısız kalemler toplamı bozmaz", () => {
    expect(autoQuantityText([{ quantity: "2" }, { quantity: "Muhtelif" }])).toBe("2");
  });
});

// ------------------------------------------------------------------ PDF

const BASE: Omit<WorkOrderData, "items"> = {
  job_no: "0055",
  title: "İsdemir Amonyum Sülfat Tesisi 2m³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci",
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
  project_manager: "Salih Ergüven",
  scope: { proje: true, imalat: true, nakliye: true, devreyeAlma: true },
  prepared_by_name: "Salih Ergüven",
  prepared_by_title: "Genel Müdür",
  notes: "SAT-SAS No: 410034613",
};

function itemsFor(count: number): WorkOrderData["items"] {
  return Array.from({ length: count }, (_, i) => ({
    item_no: count === 1 ? "0055-00" : `0055-${String(i + 1).padStart(2, "0")}`,
    product_name: `${10 + i} t x ${14 + i} m Kapasiteli Çift Kirişli Köprülü Tavan Vinci`,
    quantity: String((i % 3) + 1),
  }));
}

/** PDF'teki sayfa nesnesi sayısı */
function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("iş emri PDF sayfa dengesi", () => {
  it("gerçekçi kalem sayılarının tamamı TEK sayfaya sığar (1…12)", async () => {
    for (const count of [1, 2, 5, 8, 10, 12]) {
      const buffer = await renderWorkOrderPdf({ ...BASE, items: itemsFor(count) });
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(pageCount(buffer), `${count} kalem`).toBe(1);
    }
  }, 60_000);

  it("çok uzun listede ikinci sayfa açılır", async () => {
    const buffer = await renderWorkOrderPdf({ ...BASE, items: itemsFor(20) });
    expect(pageCount(buffer)).toBeGreaterThan(1);
  }, 30_000);

  it("kalem yoksa da geçerli tek sayfa üretir", async () => {
    const buffer = await renderWorkOrderPdf({ ...BASE, items: [] });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageCount(buffer)).toBe(1);
  }, 30_000);
});
