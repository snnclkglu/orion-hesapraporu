// Personel ve Maaş Excel çıktısı — devralınan çalışma kitabının karşılığı.
//
// ÜÇ SAYFA:
//   1. "Maaş Listesi" — satır satır ham veri (kullanıcı kendi pivotunu burada
//                       kurar; asıl sayfa budur)
//   2. "Özet"         — ay ay toplamlar, PERSONEL ve YÖNETİM ayrı sütun grupları
//   3. "Personel"     — künye defteri
//
// Saf fonksiyondur (DB/HTTP bağımlılığı yok): route handler veriyi çeker,
// burası çalışma kitabını kurar. Marka bandı `excel/brand.ts`ten gelir.
//
// TOPLAM SATIRI EXCEL FORMÜLÜYLE DEĞİL HESAPLANMIŞ DEĞERLE yazılır: dosya bir
// FOTOĞRAFTIR. Formül yazılsaydı kullanıcı bir satırı süzdüğünde ya da sildiğinde
// toplam sessizce değişir ve dosya artık o günün kaydı olmaktan çıkardı.
//
// AVRO KARŞILIĞI DÖNEMİN KENDİ KURUYLA hesaplanır; kuru girilmemiş ay için
// hücre BOŞ bırakılır — sıfır yazmak "o ay hiç ödeme yok" demek olurdu.

import ExcelJS from "exceljs";
import {
  MODULE_PREFIX,
  TOTAL_FILL,
  autoWidth,
  styleHeaderRow,
  writeTitleBlock,
} from "@/lib/excel/brand";
import {
  aylikOdeme,
  donemOzeti,
  hizmetGunu,
  netCalismaSaati,
  periodLabel,
  type PayrollRowLike,
} from "@/lib/personnel/payroll";
import {
  CONTRACT_TYPE_LABELS,
  WORK_MODE_LABELS,
  categoryLabel,
  yonetimMi,
  type ContractType,
  type WorkMode,
} from "@/lib/personnel/employee";

export interface PayrollExportEmployee {
  id: string;
  fullName: string;
  employeeNo: string;
  category: string;
  title: string;
  department: string;
  nationalId: string | null;
  birthDate: string | null;
  phone: string;
  email: string;
  contractType: string;
  workMode: string;
  iban: string;
  bankName: string;
  currentStart: string | null;
  lastEnd: string | null;
  active: boolean;
  serviceDays: number;
}

export interface PayrollExportRow {
  employeeId: string;
  period: string;
  netSalary: number;
  overtimeHours50: number;
  overtimeHours100: number;
  overtimeAmount: number;
  bonus: number;
  perDiem: number;
  advance: number;
  deduction: number;
  paidOn: string | null;
  note: string;
}

export interface PayrollExportPeriod {
  period: string;
  eurTryRate: number | null;
  leaveHours: number;
  reportHours: number;
}

export interface PayrollExportMeta {
  /** Süzgecin insan okunur özeti ("Ağustos 2026" ya da "tüm dönemler") */
  filterText: string;
  generatedAt: string;
  preparedBy: string;
}

const PARA = "#,##0.00";
const SAAT = "#,##0.##";
const TARIH = "dd.mm.yyyy";

function band(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: PayrollExportMeta,
  colCount: number
): number {
  return writeTitleBlock(ws, title, colCount, {
    prefix: MODULE_PREFIX.personnel,
    meta: [meta.filterText, meta.generatedAt, meta.preparedBy],
  });
}

function tarihHucresi(row: ExcelJS.Row, col: number, iso: string | null | undefined): void {
  const c = row.getCell(col);
  if (!iso) {
    c.value = "";
    return;
  }
  // GERÇEK tarih olarak yazılır — Excel'de süzme ve gruplama ancak böyle
  // çalışır; metin yazılsaydı kullanıcının kendi pivotu kurulamazdı.
  c.value = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  c.numFmt = TARIH;
}

function paraHucresi(row: ExcelJS.Row, col: number, v: number | null): void {
  const c = row.getCell(col);
  // BOŞ ≠ SIFIR: kuru girilmemiş ayın avro karşılığı yoktur, sıfır değildir.
  c.value = v === null || !Number.isFinite(v) ? "" : v;
  c.numFmt = PARA;
  c.alignment = { horizontal: "right" };
}

// ─────────────────────────────────────────────────────────── 1. Maaş Listesi

const MAAS_SUTUNLARI = [
  "Dönem", "Ad Soyad", "Kategori", "Görev", "İşe Giriş",
  "Net Maaş (₺)", "FM %50 (saat)", "FM %100 (saat)", "FM Tutarı (₺)",
  "Prim (₺)", "Harcirah (₺)", "Avans (₺)", "Kesinti (₺)",
  "Toplam (₺)", "Kur (₺/€)", "Toplam (€)", "Ödeme Tarihi", "Not",
];

function writeMaasSheet(
  ws: ExcelJS.Worksheet,
  rows: readonly PayrollExportRow[],
  kisiler: ReadonlyMap<string, PayrollExportEmployee>,
  kurlar: ReadonlyMap<string, number | null>,
  meta: PayrollExportMeta
): void {
  const headerRow = band(ws, "Maaş Listesi", meta, MAAS_SUTUNLARI.length);
  const head = ws.getRow(headerRow);
  MAAS_SUTUNLARI.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, MAAS_SUTUNLARI.length);

  // Dönem ARTAN, sonra ad — dosya bir defterdir, defter baştan okunur.
  const sirali = [...rows].sort(
    (a, b) =>
      a.period.localeCompare(b.period) ||
      (kisiler.get(a.employeeId)?.fullName ?? "").localeCompare(
        kisiler.get(b.employeeId)?.fullName ?? "",
        "tr"
      )
  );

  let toplamTl = 0;
  let toplamEur = 0;
  let kursuz = 0;

  sirali.forEach((r, i) => {
    const row = ws.getRow(headerRow + 1 + i);
    const k = kisiler.get(r.employeeId);
    const kur = kurlar.get(r.period) ?? null;
    const toplam = aylikOdeme(r);
    toplamTl += toplam;
    if (kur && kur > 0) toplamEur += toplam / kur;
    else kursuz++;

    row.getCell(1).value = periodLabel(r.period);
    row.getCell(2).value = k?.fullName ?? "";
    row.getCell(3).value = categoryLabel(k?.category);
    row.getCell(4).value = k?.title ?? "";
    tarihHucresi(row, 5, k?.currentStart);
    paraHucresi(row, 6, r.netSalary);
    row.getCell(7).value = r.overtimeHours50 || "";
    row.getCell(8).value = r.overtimeHours100 || "";
    for (const c of [7, 8]) {
      row.getCell(c).numFmt = SAAT;
      row.getCell(c).alignment = { horizontal: "right" };
    }
    paraHucresi(row, 9, r.overtimeAmount);
    paraHucresi(row, 10, r.bonus || null);
    paraHucresi(row, 11, r.perDiem || null);
    paraHucresi(row, 12, r.advance || null);
    paraHucresi(row, 13, r.deduction || null);
    paraHucresi(row, 14, toplam);
    const kurH = row.getCell(15);
    kurH.value = kur && kur > 0 ? kur : "";
    kurH.numFmt = "#,##0.0000";
    kurH.alignment = { horizontal: "right" };
    paraHucresi(row, 16, kur && kur > 0 ? toplam / kur : null);
    tarihHucresi(row, 17, r.paidOn);
    row.getCell(18).value = r.note || "";
  });

  // TOPLAM SATIRI — hesaplanmış değer, formül değil.
  const toplamSatiri = ws.getRow(headerRow + 1 + sirali.length);
  toplamSatiri.getCell(1).value = "TOPLAM";
  toplamSatiri.getCell(1).font = { bold: true };
  paraHucresi(toplamSatiri, 14, toplamTl);
  paraHucresi(toplamSatiri, 16, toplamEur);
  toplamSatiri.getCell(14).font = { bold: true };
  toplamSatiri.getCell(16).font = { bold: true };
  if (kursuz > 0) {
    // Eksiklik GİZLENMEZ: avro toplamı kaç satırı kapsamıyor, orada yazar.
    toplamSatiri.getCell(18).value = `${kursuz} satırın dönem kuru girilmemiş; avro toplamı onları içermez.`;
  }
  for (let c = 1; c <= MAAS_SUTUNLARI.length; c++) {
    toplamSatiri.getCell(c).fill = TOTAL_FILL;
  }

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + sirali.length, column: MAAS_SUTUNLARI.length },
  };
  autoWidth(ws);
}

// ───────────────────────────────────────────────────────────────── 2. Özet

const OZET_SUTUNLARI = [
  "Dönem",
  "Personel Kişi", "Personel Çalışma Saati", "Personel Net (₺)", "Personel Net (€)",
  "Personel Kişi Başı Ort. (₺)", "Personel FM Saati", "Personel FM Ödemesi (₺)",
  "Personel FM Saat Maliyeti (₺)",
  "Yönetim Kişi", "Yönetim Çalışma Saati", "Yönetim Net (₺)", "Yönetim Net (€)",
  "Toplam Ödeme (₺)", "Toplam Ödeme (€)",
  "İzin (saat)", "Rapor (saat)", "Net Çalışma Saati",
];

function writeOzetSheet(
  ws: ExcelJS.Worksheet,
  rows: readonly PayrollExportRow[],
  kisiler: ReadonlyMap<string, PayrollExportEmployee>,
  donemler: readonly PayrollExportPeriod[],
  meta: PayrollExportMeta
): void {
  const headerRow = band(ws, "Aylık Özet", meta, OZET_SUTUNLARI.length);
  const head = ws.getRow(headerRow);
  OZET_SUTUNLARI.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, OZET_SUTUNLARI.length);

  const gruplar = new Map<string, PayrollExportRow[]>();
  for (const r of rows) {
    const liste = gruplar.get(r.period) ?? [];
    liste.push(r);
    gruplar.set(r.period, liste);
  }
  const donemHarita = new Map(donemler.map((d) => [d.period, d]));
  const aylar = [...gruplar.keys()].sort();

  aylar.forEach((period, i) => {
    const liste = gruplar.get(period) ?? [];
    const ile = (f: (r: PayrollExportRow) => boolean): PayrollRowLike[] =>
      liste.filter(f).map((r) => ({ ...r, category: kisiler.get(r.employeeId)?.category ?? "" }));
    const p = donemOzeti(ile((r) => !yonetimMi(kisiler.get(r.employeeId)?.category)));
    const y = donemOzeti(ile((r) => yonetimMi(kisiler.get(r.employeeId)?.category)));
    const t = donemOzeti(ile(() => true));
    const d = donemHarita.get(period);
    const kur = d?.eurTryRate ?? null;
    const cevir = (v: number) => (kur && kur > 0 ? v / kur : null);

    const row = ws.getRow(headerRow + 1 + i);
    row.getCell(1).value = periodLabel(period);
    row.getCell(2).value = p.count;
    row.getCell(3).value = p.normalHours;
    paraHucresi(row, 4, p.netTotal);
    paraHucresi(row, 5, cevir(p.netTotal));
    paraHucresi(row, 6, p.netAverage);
    row.getCell(7).value = p.overtimeHours;
    paraHucresi(row, 8, p.overtimeTotal);
    paraHucresi(row, 9, p.overtimeHours > 0 ? p.overtimeHourCost : null);
    row.getCell(10).value = y.count;
    row.getCell(11).value = y.normalHours;
    paraHucresi(row, 12, y.netTotal);
    paraHucresi(row, 13, cevir(y.netTotal));
    paraHucresi(row, 14, t.grandTotal);
    paraHucresi(row, 15, cevir(t.grandTotal));
    row.getCell(16).value = d?.leaveHours || "";
    row.getCell(17).value = d?.reportHours || "";
    row.getCell(18).value = netCalismaSaati(
      t.normalHours,
      t.overtimeHours,
      d?.leaveHours ?? 0,
      d?.reportHours ?? 0
    );
    for (const c of [3, 7, 11, 16, 17, 18]) {
      row.getCell(c).numFmt = SAAT;
      row.getCell(c).alignment = { horizontal: "right" };
    }
  });

  ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 1 }];
  autoWidth(ws);
}

// ─────────────────────────────────────────────────────────────── 3. Personel

const KUNYE_SUTUNLARI = [
  "Ad Soyad", "Sicil No", "Kategori", "Görev", "Departman", "TC Kimlik No",
  "Doğum Tarihi", "İşe Giriş", "Çıkış", "Durum", "Kıdem (gün)",
  "Telefon", "E-posta", "Sözleşme", "Çalışma Şekli", "Banka", "IBAN",
];

function writeKunyeSheet(
  ws: ExcelJS.Worksheet,
  kisiler: readonly PayrollExportEmployee[],
  bugun: string,
  meta: PayrollExportMeta
): void {
  const headerRow = band(ws, "Personel Künyesi", meta, KUNYE_SUTUNLARI.length);
  const head = ws.getRow(headerRow);
  KUNYE_SUTUNLARI.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, KUNYE_SUTUNLARI.length);

  const sirali = [...kisiler].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "tr") || a.fullName.localeCompare(b.fullName, "tr")
  );

  sirali.forEach((k, i) => {
    const row = ws.getRow(headerRow + 1 + i);
    row.getCell(1).value = k.fullName;
    row.getCell(2).value = k.employeeNo || "";
    row.getCell(3).value = categoryLabel(k.category);
    row.getCell(4).value = k.title || "";
    row.getCell(5).value = k.department || "";
    // TC no METİN olarak yazılır: sayıya çevrilirse baştaki basamak korunsa
    // bile Excel onu bilimsel gösterime düşürebilir.
    row.getCell(6).value = k.nationalId ?? "";
    row.getCell(6).alignment = { horizontal: "left" };
    tarihHucresi(row, 7, k.birthDate);
    tarihHucresi(row, 8, k.currentStart);
    tarihHucresi(row, 9, k.lastEnd);
    row.getCell(10).value = k.active ? "Aktif" : "Ayrıldı";
    // Kıdem BÜTÜN dönemlerin toplamıdır (`serviceDays` onu taşır); açık dönem
    // bugüne kadar sayılır.
    row.getCell(11).value = k.serviceDays || hizmetGunu(k.currentStart, k.lastEnd, bugun);
    row.getCell(11).alignment = { horizontal: "right" };
    row.getCell(12).value = k.phone || "";
    row.getCell(13).value = k.email || "";
    row.getCell(14).value = CONTRACT_TYPE_LABELS[k.contractType as ContractType] ?? k.contractType;
    row.getCell(15).value = WORK_MODE_LABELS[k.workMode as WorkMode] ?? k.workMode;
    row.getCell(16).value = k.bankName || "";
    row.getCell(17).value = k.iban || "";
  });

  ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 1 }];
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + sirali.length, column: KUNYE_SUTUNLARI.length },
  };
  autoWidth(ws);
}

// ──────────────────────────────────────────────────────────────── kitap

export async function buildPayrollWorkbook(input: {
  employees: readonly PayrollExportEmployee[];
  payroll: readonly PayrollExportRow[];
  periods: readonly PayrollExportPeriod[];
  bugun: string;
  meta: PayrollExportMeta;
}): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Cranes";
  wb.created = new Date();

  const kisiHarita = new Map(input.employees.map((e) => [e.id, e]));
  const kurHarita = new Map(input.periods.map((p) => [p.period, p.eurTryRate]));

  writeMaasSheet(wb.addWorksheet("Maaş Listesi"), input.payroll, kisiHarita, kurHarita, input.meta);
  writeOzetSheet(wb.addWorksheet("Özet"), input.payroll, kisiHarita, input.periods, input.meta);
  writeKunyeSheet(wb.addWorksheet("Personel"), input.employees, input.bugun, input.meta);

  // `writeBuffer` ortama göre `ArrayBuffer` ya da `Buffer` döner; çağıran
  // taraf `Response` gövdesi olarak kullanacağı için tek bir görünüme
  // indirgenir (TS 5.7'den beri `BodyInit` yalnız `ArrayBuffer` tabanlı
  // görünümleri kabul ediyor).
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
