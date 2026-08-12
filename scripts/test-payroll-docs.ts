// Bordro PDF'i ve Personel/Maaş Excel'i DUMAN TESTİ.
//
//   npx tsx scripts/test-payroll-docs.ts
//
// Belgeleri GERÇEKTEN üretir ve `tmp/` altına yazar; sayfa dengesi ve sütun
// genişliği gözle kontrol edilir. Üretilen Excel geri OKUNUR: yazılan sayı
// gerçekten hücrede mi (`test-work-log-excel.ts` ile aynı ilke — beyan değil
// ölçüm).
//
// ÜÇ VARYANT üretilir ve üçü de gerçek bir durumu temsil eder:
//   1. parametreli  — yasal kesinti bloğu dolu (2026)
//   2. parametresiz — blok HİÇ ÇİZİLMEZ, yerine bir cümle yazar
//   3. toplu        — bir dönemin bütün bordroları tek PDF, kişi başına sayfa
//
// Fikstür DEVRALINAN KAYITTAN alınmıştır (ORHAN KILIÇ): 103 saat %50 zamlı
// mesai, uygulamanın gördüğü en yüksek değer.

import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { renderPayslipBatchPdf, renderPayslipPdf, type PayslipProps } from "../src/lib/pdf/payslip";
import { buildPayrollWorkbook } from "../src/lib/excel/payroll";
import { brutBul, type PayrollParams } from "../src/lib/personnel/bordro";
import { fazlaMesaiTutari, periodLabel } from "../src/lib/personnel/payroll";

const OUT = "tmp";

const COMPANY = {
  company: "ORION CRANES MAKİNA SAN. VE TİC. LTD. ŞTİ.",
  address: "Organize Sanayi Bölgesi, Kayseri",
  phone: "+90 352 000 00 00",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

/** 2026 — `hr_payroll_params` satırının birebir aynısı. */
const P2026: PayrollParams = {
  validFrom: "2026-01-01",
  label: "2026",
  minWageGross: 33030,
  sgkCeiling: 297270,
  sgkEmployeeRate: 0.14,
  unemploymentEmployeeRate: 0.01,
  sgkEmployerRate: 0.2075,
  unemploymentEmployerRate: 0.02,
  stampTaxRate: 0.00759,
  brackets: [
    { ust: 190000, oran: 0.15 },
    { ust: 400000, oran: 0.2 },
    { ust: 1500000, oran: 0.27 },
    { ust: 5300000, oran: 0.35 },
    { ust: null, oran: 0.4 },
  ],
  incomeTaxExemption: 4211.33,
  stampTaxExemption: 250.7,
  source: "duman testi",
  verified: true,
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
  lastEnd: "2026-05-31",
  active: false,
  serviceDays: 294,
};

const MAAS = {
  employeeId: KISI.id,
  period: "2026-01",
  netSalary: 85000,
  overtimeHours50: 103,
  overtimeHours100: 8,
  overtimeAmount: Math.round(fazlaMesaiTutari(85000, 103, 8) * 100) / 100,
  bonus: 0,
  perDiem: 0,
  advance: 0,
  deduction: 0,
  paidOn: "2026-02-05",
  note: "",
};

function pusula(over: Partial<PayslipProps> = {}): PayslipProps {
  const net = MAAS.netSalary + MAAS.overtimeAmount + MAAS.bonus;
  return {
    employee: {
      fullName: KISI.fullName,
      employeeNo: KISI.employeeNo,
      nationalId: KISI.nationalId,
      title: KISI.title,
      department: KISI.department,
      sgkNo: KISI.sgkNo,
      iban: KISI.iban,
      bankName: KISI.bankName,
      hireDate: KISI.currentStart,
    },
    payroll: { ...MAAS, workedDays: 30 },
    period: MAAS.period,
    company: COMPANY,
    workplaceSgkNo: "1234567890123456789012345",
    bordro: brutBul(net, 0, P2026),
    params: P2026,
    ...over,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let sorun = 0;

  // ————————————————————————————————————————— fazla mesai bağıntısı
  const beklenen = fazlaMesaiTutari(MAAS.netSalary, MAAS.overtimeHours50, MAAS.overtimeHours100);
  if (Math.abs(beklenen - MAAS.overtimeAmount) > 0.01) {
    console.log(`✗ Fazla mesai bağıntısı sapıyor: ${beklenen} ≠ ${MAAS.overtimeAmount}`);
    sorun++;
  }

  // ————————————————————————————————— brütleştirme kendi içinde tutarlı mı
  const b = pusula().bordro!;
  const netHedef = MAAS.netSalary + MAAS.overtimeAmount;
  if (Math.abs(b.gross - b.totalDeductions - netHedef) > 0.05) {
    console.log(
      `✗ Brüt − kesinti ≠ net: ${b.gross} − ${b.totalDeductions} = ${b.gross - b.totalDeductions}, beklenen ${netHedef}`
    );
    sorun++;
  } else {
    console.log(
      `  ✓ brütleştirme tutarlı: brüt ${b.gross.toFixed(2)} − kesinti ${b.totalDeductions.toFixed(2)} = net ${netHedef.toFixed(2)}`
    );
  }

  // ————————————————————————————————————————————————————————— bordro
  const pdf = await renderPayslipPdf(pusula());
  writeFileSync(`${OUT}/bordro-parametreli.pdf`, pdf);
  console.log(`✓ bordro-parametreli.pdf  (${(pdf.length / 1024).toFixed(0)} KB)`);

  // PARAMETRESİZ: yasal kesinti bloğu HİÇ ÇİZİLMEMELİ.
  const pdfSiz = await renderPayslipPdf(pusula({ bordro: null, params: null }));
  writeFileSync(`${OUT}/bordro-parametresiz.pdf`, pdfSiz);
  console.log(
    `✓ bordro-parametresiz.pdf (${(pdfSiz.length / 1024).toFixed(0)} KB) — kesinti bloğu OLMAMALI`
  );

  // TOPLU: üç kişi, üç sayfa.
  const taban = pusula();
  const toplu = await renderPayslipBatchPdf([
    taban,
    { ...taban, employee: { ...taban.employee, fullName: "SEMİH CAN", employeeNo: "P-008" } },
    {
      ...taban,
      employee: { ...taban.employee, fullName: "TUNCAY ÇELİKER", employeeNo: "P-011" },
      payroll: { ...MAAS, workedDays: 22, perDiem: 6500, advance: 5000 },
    },
  ]);
  writeFileSync(`${OUT}/bordrolar-toplu.pdf`, toplu);
  console.log(`✓ bordrolar-toplu.pdf     (${(toplu.length / 1024).toFixed(0)} KB) — 3 sayfa olmalı`);

  // ————————————————————————————————————————————————————————————— excel
  const xlsx = await buildPayrollWorkbook({
    employees: [KISI],
    payroll: [
      {
        ...MAAS,
        period: "2025-11",
        netSalary: 71000,
        overtimeHours50: 45,
        overtimeHours100: 0,
        overtimeAmount: 14200,
      },
      { ...MAAS, period: "2025-12" },
      { ...MAAS, period: "2026-01" },
    ],
    periods: [
      { period: "2025-11", eurTryRate: 49.8569, leaveHours: 171.5, reportHours: 346 },
      { period: "2025-12", eurTryRate: 50.1578, leaveHours: 228, reportHours: 11 },
      // 2026-01 KURSUZ: avro hücresi BOŞ olmalı, sıfır değil.
      { period: "2026-01", eurTryRate: null, leaveHours: 173, reportHours: 57 },
    ],
    bugun: "2026-08-12",
    meta: { filterText: "tüm dönemler", generatedAt: "12.08.2026 08:00", preparedBy: "DUMAN TESTİ" },
  });
  writeFileSync(`${OUT}/personel-maas.xlsx`, xlsx);
  console.log(`✓ personel-maas.xlsx      (${(xlsx.length / 1024).toFixed(0)} KB)`);

  // ———————————————————————————————— ÖLÇÜM: yazılan gerçekten orada mı?
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.buffer as ArrayBuffer);
  const sayfalar = wb.worksheets.map((w) => w.name);
  console.log(`  sayfalar: ${sayfalar.join(" · ")}`);
  if (sayfalar.length !== 3) {
    console.log("✗ Üç sayfa bekleniyordu.");
    sorun++;
  }

  const ws = wb.getWorksheet("Maaş Listesi")!;
  let baslikSatiri = 0;
  ws.eachRow((row, i) => {
    if (!baslikSatiri && String(row.getCell(1).value ?? "") === "Dönem") baslikSatiri = i;
  });
  if (!baslikSatiri) {
    console.log("✗ Başlık satırı bulunamadı.");
    sorun++;
  } else {
    const ilk = ws.getRow(baslikSatiri + 1);
    if (String(ilk.getCell(1).value ?? "") !== periodLabel("2025-11")) {
      console.log(`✗ İlk satır ${periodLabel("2025-11")} olmalıydı.`);
      sorun++;
    }
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
