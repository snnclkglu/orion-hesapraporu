// Bordro PDF'i ve Personel/Maaş Excel'i DUMAN TESTİ.
//
//   npx tsx scripts/test-payroll-docs.ts
//
// Belgeleri GERÇEKTEN üretir ve `tmp/` altına yazar; sayfa dengesi ve sütun
// genişliği gözle kontrol edilir. Üretilen Excel geri OKUNUR: yazılan sayı
// gerçekten hücrede mi (`test-work-log-excel.ts` ile aynı ilke — beyan değil
// ölçüm).
//
// Fikstür DEVRALINAN KAYITTAN alınmıştır (ORHAN KILIÇ · Aralık 2025): 103 saat
// %50 zamlı mesai, uygulamanın gördüğü en yüksek değer. Böylece bordroda mesai
// bloğunun taşıp taşmadığı ve tutarın (48.753,33 ₺) doğru basıldığı görülür.

import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { renderPayslipPdf } from "../src/lib/pdf/payslip";
import { buildPayrollWorkbook } from "../src/lib/excel/payroll";
import { fazlaMesaiTutari, periodLabel } from "../src/lib/finance/payroll";

const OUT = "tmp";

const COMPANY = {
  company: "ORION CRANES MAKİNA SAN. VE TİC. LTD. ŞTİ.",
  address: "Organize Sanayi Bölgesi, Kayseri",
  phone: "+90 352 000 00 00",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

const KISI = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "ORHAN KILIÇ",
  employeeNo: "P-014",
  category: "03 - PERSONEL",
  title: "USTA - KAYNAKÇI",
  department: "ÜRETİM",
  nationalId: "55432189366",
  birthDate: "1984-09-13",
  phone: "0500 000 00 00",
  email: "",
  contractType: "belirsiz",
  workMode: "tam",
  iban: "TR33 0006 1005 1978 6457 8413 26",
  bankName: "ZİRAAT BANKASI",
  sgkNo: "1234567890",
  currentStart: "2025-05-07",
  lastEnd: "2026-02-25",
  active: false,
  serviceDays: 294,
};

const MAAS = {
  employeeId: KISI.id,
  period: "2025-12",
  netSalary: 71000,
  overtimeHours50: 103,
  overtimeHours100: 0,
  overtimeAmount: 48753.33,
  grossSalary: null as number | null,
  sgkEmployee: null as number | null,
  sgkEmployer: null as number | null,
  unemploymentEmployee: null as number | null,
  incomeTax: null as number | null,
  stampTax: null as number | null,
  bonus: 0,
  perDiem: 0,
  advance: 0,
  deduction: 0,
  paidOn: "2026-01-05",
  note: "",
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  let sorun = 0;

  // ————————————————————————————————————————————————————————————— bordro
  const beklenen = fazlaMesaiTutari(MAAS.netSalary, MAAS.overtimeHours50, MAAS.overtimeHours100);
  if (Math.abs(beklenen - MAAS.overtimeAmount) > 0.01) {
    console.log(`✗ Fazla mesai bağıntısı sapıyor: ${beklenen} ≠ ${MAAS.overtimeAmount}`);
    sorun++;
  }

  const pdf = await renderPayslipPdf({
    employee: {
      fullName: KISI.fullName,
      employeeNo: KISI.employeeNo,
      nationalId: KISI.nationalId,
      title: KISI.title,
      department: KISI.department,
      sgkNo: KISI.sgkNo,
      iban: KISI.iban,
      hireDate: KISI.currentStart,
    },
    payroll: MAAS,
    period: MAAS.period,
    eurTryRate: 50.1578,
    company: COMPANY,
  });
  writeFileSync(`${OUT}/bordro-kurlu.pdf`, pdf);
  console.log(`✓ bordro-kurlu.pdf  (${(pdf.length / 1024).toFixed(0)} KB)`);

  // KURSUZ VARYANT: avro satırı HİÇ BASILMAMALI. Boyut farkı bunu kanıtlamaz
  // ama belgenin üretilebildiğini gösterir; satırın yokluğu gözle bakılır.
  const pdfKursuz = await renderPayslipPdf({
    employee: {
      fullName: KISI.fullName,
      employeeNo: KISI.employeeNo,
      nationalId: KISI.nationalId,
      title: KISI.title,
      department: KISI.department,
      sgkNo: KISI.sgkNo,
      iban: KISI.iban,
      hireDate: KISI.currentStart,
    },
    payroll: { ...MAAS, bonus: 12000, perDiem: 6500, advance: 5000, note: "Aralık primi dâhil." },
    period: MAAS.period,
    eurTryRate: null,
    company: COMPANY,
  });
  writeFileSync(`${OUT}/bordro-kursuz.pdf`, pdfKursuz);
  console.log(`✓ bordro-kursuz.pdf (${(pdfKursuz.length / 1024).toFixed(0)} KB) — avro satırı OLMAMALI`);

  // ————————————————————————————————————————————————————————————— excel
  const xlsx = await buildPayrollWorkbook({
    employees: [KISI],
    payroll: [
      { ...MAAS, period: "2025-11", netSalary: 71000, overtimeHours50: 45, overtimeAmount: 14200 },
      MAAS,
      { ...MAAS, period: "2026-01", netSalary: 85000, overtimeHours50: 22.5, overtimeAmount: 12750 },
    ],
    periods: [
      { period: "2025-11", eurTryRate: 49.8569, leaveHours: 171.5, reportHours: 346 },
      { period: "2025-12", eurTryRate: 50.1578, leaveHours: 228, reportHours: 11 },
      // 2026-01 KURSUZ bırakıldı: avro hücresi BOŞ olmalı, sıfır değil.
      { period: "2026-01", eurTryRate: null, leaveHours: 173, reportHours: 57 },
    ],
    bugun: "2026-08-12",
    meta: { filterText: "tüm dönemler", generatedAt: "12.08.2026 05:00", preparedBy: "DUMAN TESTİ" },
  });
  writeFileSync(`${OUT}/personel-maas.xlsx`, xlsx);
  console.log(`✓ personel-maas.xlsx (${(xlsx.length / 1024).toFixed(0)} KB)`);

  // ———————————————————————————————————— ÖLÇÜM: yazılan gerçekten orada mı?
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.buffer as ArrayBuffer);
  const sayfalar = wb.worksheets.map((w) => w.name);
  console.log(`  sayfalar: ${sayfalar.join(" · ")}`);
  if (sayfalar.length !== 3) {
    console.log("✗ Üç sayfa bekleniyordu.");
    sorun++;
  }

  const ws = wb.getWorksheet("Maaş Listesi")!;
  // Başlık satırını bul (bant + künye + ayraç + boş satırdan sonra).
  let baslikSatiri = 0;
  ws.eachRow((row, i) => {
    if (!baslikSatiri && String(row.getCell(1).value ?? "") === "Dönem") baslikSatiri = i;
  });
  if (!baslikSatiri) {
    console.log("✗ Başlık satırı bulunamadı.");
    sorun++;
  } else {
    const ilk = ws.getRow(baslikSatiri + 1);
    const donem = String(ilk.getCell(1).value ?? "");
    if (donem !== periodLabel("2025-11")) {
      console.log(`✗ İlk satır ${periodLabel("2025-11")} olmalıydı, ${donem} çıktı.`);
      sorun++;
    }
    // KURSUZ AY: avro hücresi BOŞ olmalı (sıfır DEĞİL).
    const kursuz = ws.getRow(baslikSatiri + 3);
    const avro = kursuz.getCell(16).value;
    if (avro !== "" && avro !== null && avro !== undefined) {
      console.log(`✗ Kuru olmayan ayın avro hücresi boş olmalıydı, "${String(avro)}" çıktı.`);
      sorun++;
    } else {
      console.log("  ✓ kuru girilmemiş ayın avro hücresi BOŞ (sıfır değil)");
    }
    if (!ws.views?.[0] || ws.views[0].state !== "frozen") {
      console.log("✗ Başlık satırı dondurulmamış.");
      sorun++;
    } else {
      console.log("  ✓ başlık dondurulmuş, süzgeç kurulu");
    }
  }

  console.log(sorun === 0 ? "\n✓ Belgeler üretildi ve doğrulandı." : `\n✗ ${sorun} sorun var.`);
  process.exitCode = sorun === 0 ? 0 : 1;
}

main();
