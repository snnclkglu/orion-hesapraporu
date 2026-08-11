// Güncel İş Listesi — müşteriye giden referans belgesinin koruma testleri.
//
// EN ÖNEMLİ MADDE FİYATSIZLIKTIR ve o, belgenin var oluş sebebidir: liste
// teklif ekinde rakip firmalara da ulaşabilecek bir belgedir. Tip tanımı
// ticari alan taşımaz, üretilen PDF'in metin katmanında da para birimi
// simgesi ya da tutar geçmemelidir — burada ikisi birden sınanır.

import { describe, expect, it } from "vitest";
import {
  JobListDocument,
  jobListYear,
  renderJobListPdf,
  type JobListRow,
} from "../job-list";
import { jobListDocCode, jobListPeriod } from "../doc-naming";

const COMPANY = {
  company: "ORION CRANES",
  address: "Başkent OSB 1. Cadde No:20, Ankara",
  web: "orioncranes.com",
};

/** Gerçek listeden alınmış üç satır (fiyat alanları YOK). */
const ROWS: JobListRow[] = [
  {
    itemNo: "0002-00",
    productName:
      "100/50 t x 21,00 m Kapasiteli Dört Kirişli Köprülü Tavan Vinci (Cüruf Pota Tumba Tesisi)",
    customer: "KARÇEL",
    scope: "Hazır Ekipmanlar ve Elektrik Hariç",
    quantity: 2,
    unit: "Adet",
    totalWeightKg: 368000,
    contractDate: "2024-03-11",
    dueDate: "2025-02-04",
    shipmentDate: "2025-01-06",
    shipmentPlace: "TÜRKİYE",
  },
  {
    itemNo: "0055-00",
    productName: "İsdemir Amonyum Sülfat Tesisi 2M³ Kapasiteli Kepçeli Vinç",
    customer: "İSDEMİR",
    scope: "Komple İmalat",
    quantity: 1,
    unit: "Adet",
    totalWeightKg: 20000,
    contractDate: "2026-05-11",
    dueDate: "2027-03-01",
    shipmentDate: null,
    shipmentPlace: "TÜRKİYE",
  },
  {
    itemNo: "0099-00",
    productName: "Sözleşme tarihi girilmemiş kalem",
    customer: "MTC",
    scope: "",
    quantity: null,
    unit: "Adet",
    totalWeightKg: null,
    contractDate: null,
    dueDate: null,
    shipmentDate: null,
    shipmentPlace: "",
  },
];

const META = {
  periodLabel: jobListPeriod(new Date(2026, 7, 11)),
  docCode: jobListDocCode(new Date(2026, 7, 11)),
  generatedAt: "11.08.2026",
};

/**
 * Belgenin GERÇEKTEN OKUNAN metni.
 *
 * Ham baytları taramak yanıltıcıdır: içerik akışları sıkıştırılmıştır ve
 * rastgele bayt dizileri "$" gibi karakterleri kendiliğinden üretir. Metin
 * `unpdf` ile çözülür — kullanıcının belgede göreceği neyse o.
 */
async function pdfMetni(): Promise<string> {
  const buf = await renderJobListPdf({ rows: ROWS, meta: META, company: COMPANY });
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join(" ") : text;
}

describe("belge kimliği", () => {
  it("dönem aydan gelir, revizyon numarası yoktur", () => {
    expect(jobListPeriod(new Date(2026, 7, 11))).toBe("Ağustos 2026");
    expect(jobListDocCode(new Date(2026, 7, 11))).toBe("ORC-IL-2026-08");
    expect(jobListDocCode(new Date(2027, 0, 3))).toBe("ORC-IL-2027-01");
  });
});

describe("yıl gruplaması", () => {
  it("yıl SÖZLEŞME tarihinden okunur", () => {
    expect(jobListYear(ROWS[0])).toBe("2024");
    expect(jobListYear(ROWS[1])).toBe("2026");
  });

  it("sözleşme tarihi olmayan satır DÜŞMEZ, yılsız kalır", () => {
    // Satır listeden atılsaydı "eksik iş" sessizce kaybolurdu; belge onu
    // "TARİHSİZ" bandında en sona koyar ve kullanıcı fark eder.
    expect(jobListYear(ROWS[2])).toBe("");
  });
});

describe("fiyat sızıntısı", () => {
  it("tip tanımı ticari alan kabul etmez", () => {
    // Derleme zamanı koruması: aşağıdaki nesne fazladan alan taşıdığı için
    // `JobListRow` olarak atanamaz. `@ts-expect-error` YOKSA test kırılır —
    // yani birisi tipe fiyat eklerse bu satır hatayı bildirir.
    // @ts-expect-error unit_price alanı JobListRow'da YOKTUR ve olmamalıdır
    const kacak: JobListRow = { ...ROWS[0], unit_price: 787500 };
    expect(kacak.itemNo).toBe("0002-00");
  });

  it("üretilen belgede para simgesi ve tutar geçmez", async () => {
    const metin = await pdfMetni();
    for (const simge of ["€", "₺", "$", "787500", "787.500"]) {
      expect(metin.includes(simge)).toBe(false);
    }
  });
});

describe("belge", () => {
  it("çizelge + kapanış sayfası birlikte üretilir", async () => {
    const buf = await renderJobListPdf({ rows: ROWS, meta: META, company: COMPANY });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    // Çizelge sayfası + müşteri referansları sayfası = en az iki sayfa.
    const sayfa = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(sayfa).toBeGreaterThanOrEqual(2);
  });

  it("boş listede de belge üretilir (çöküş yok)", async () => {
    const buf = await renderJobListPdf({ rows: [], meta: META, company: COMPANY });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("bileşen doğrudan çağrılabilir — şablon saf kalır", () => {
    const el = JobListDocument({ rows: ROWS, meta: META, company: COMPANY });
    expect(el).toBeTruthy();
  });
});
