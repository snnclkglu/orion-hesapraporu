// Yalnız development: Sarf Girişi · Kayıtlar · Analiz ekranlarını auth ve DB
// olmadan gerçek ölçekli, deterministik veriyle görsel doğrulamak için.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExpenseEntry } from "@/app/(app)/purchasing/sarf/expense-entry";
import { RecentExpenses } from "@/app/(app)/purchasing/sarf/recent-expenses";
import { ConsumableRecordsView } from "@/app/(app)/purchasing/sarf/kayitlar/records-view";
import { ConsumableAnalysisView } from "@/app/(app)/purchasing/sarf/analiz/analysis-view";
import type {
  ConsumableExpenseRow,
  ConsumableItemOption,
  ConsumableRecordFilters,
  ConsumableSupplierOption,
} from "@/app/(app)/purchasing/sarf/data";
import {
  selectedYearGroupMatrix,
  supplierDrilldownAggregate,
  type ConsumableExpenseAnalyticsRow,
} from "@/lib/purchasing/consumables";
import { cn } from "@/lib/utils";

const ITEMS: ConsumableItemOption[] = [
  ["SM0001", "KARIŞIM GAZI HB212", "Sarf Gider-Atölye", "M³", true],
  ["SM0148", "ŞERİT TESTERE BIÇAĞI 34X1,10MM 3/4 (4,86 METRE) AMADA PROTECTOR", "Sarf Gider-Atölye", "Metre", true],
  ["SM0274", "HİDROLİK YAĞ 46 NUMARA (16 LİTRE)", "Sarf Gider-Atölye", "Litre", true],
  ["SM0512", "A4 FOTOKOPİ KAĞIDI 80 GR 500'LÜ", "Sarf Gider-Ofis", "KOLİ", true],
  ["SM0618", "LOGITECH SIGNATURE K650 TAM BOYUTLU KABLOSUZ TÜRKÇE Q KLAVYE", "Sarf Gider-Ofis", "Adet", true],
  ["SM0751", "ŞOK EMİCİ ÇİFT KOLLU HALAT LANYARD", "Sarf Gider-Atölye", "Adet", false],
].map(([code, name, groupName, defaultUnit, active], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  code: String(code),
  name: String(name),
  groupName: String(groupName),
  defaultUnit: String(defaultUnit),
  active: Boolean(active),
}));

const SUPPLIERS: ConsumableSupplierOption[] = [
  ["TD0007", "HABAŞ SINAİ VE TIBBİ GAZLAR ÜRETİM VE TİCARET ANONİM ŞİRKETİ"],
  ["TD0041", "VİZYON KESİCİ TAKIMLAR SANAYİ VE TİCARET LİMİTED ŞİRKETİ"],
  ["TD0088", "AKEL GENEL GÜVENLİK SİSTEMLERİ"],
  ["TD0097", "CANKARDEŞ KIRTASİYE"],
].map(([code, name], index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  code,
  name,
  active: true,
}));

const DEPARTMENTS = [
  "Ana Kiriş",
  "Borverk Tezgahı",
  "Kalite Kontrol",
  "Kiriş Sehpası",
  "Kompresör Odası",
  "MONTAJ",
  "MURAT ASLAN",
  "OFİS",
  "RADYAL MATKAP",
  "RESİMHANE",
  "Silindir (Düzeltme Makinesi)",
  "Spot Tezgahı",
  "TALAŞLI İMALAT - TORNA SN 71",
  "TOPLANTI ODASI",
  "Tüp Odası ve Atık Yeri",
  "YEMEKHANE",
];

function buildRows(): ConsumableExpenseRow[] {
  const rows: ConsumableExpenseRow[] = [];
  let sequence = 0;
  for (let year = 2024; year <= 2026; year += 1) {
    const lastMonth = year === 2026 ? 8 : 12;
    for (let month = 1; month <= lastMonth; month += 1) {
      for (let copy = 0; copy < 6; copy += 1) {
        sequence += 1;
        const office = copy >= 4;
        const item = office ? ITEMS[3 + (copy % 2)] : ITEMS[(month + copy) % 3];
        const supplier = SUPPLIERS[(month + copy) % SUPPLIERS.length];
        const spike = year === 2026 && month === 6 && !office ? 4.8 : 1;
        const amountEur = (office ? 90 + month * 7 : 420 + month * 28 + copy * 35) * spike;
        const currency = (["TRY", "USD", "EUR"] as const)[sequence % 3];
        const fxRate = currency === "TRY" ? 34 + (year - 2024) * 8 + month * 0.5 : currency === "USD" ? 1.08 : 1;
        const quantity = item.defaultUnit === "M³" ? 72.3 : item.defaultUnit === "Metre" ? 14.58 : 1 + (copy % 4);
        const amount = amountEur * fxRate;
        const day = String(3 + copy * 3).padStart(2, "0");
        const date = `${year}-${String(month).padStart(2, "0")}-${day}`;
        rows.push({
          id: `20000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
          expenseDate: date,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          groupName: item.groupName,
          supplierId: supplier.id,
          supplierName: supplier.name,
          documentNo: sequence % 11 === 0 ? "" : `FTR-${year}-${String(sequence).padStart(5, "0")}`,
          department: office ? "İdari İşler" : sequence % 5 === 0 ? "Torna" : "Atölye",
          quantity,
          unit: item.defaultUnit,
          unitPrice: amount / quantity,
          amount,
          currency,
          fxRate,
          fxRateDate: currency === "EUR" ? null : date,
          fxSource: sequence % 9 === 0 ? "manual" : "daily",
          amountEur,
          note: sequence % 7 === 0 ? "Uzun açıklama: periyodik bakım ve genel fabrika ihtiyacı için alınmıştır." : "",
          source: sequence % 4 === 0 ? "app" : "excel-consumables-2026-08",
          sourceRef: sequence % 4 === 0 ? "" : `SARF GİDERLER ESKİ VERİ!${sequence + 1}`,
          qualityFlags: sequence % 53 === 0 ? ["duplicate_candidate"] : [],
          createdAt: `${date}T09:00:00.000Z`,
        });
      }
    }
  }
  return rows.sort(
    (left, right) =>
      right.expenseDate.localeCompare(left.expenseDate) || right.id.localeCompare(left.id)
  );
}

const ROWS = buildRows();
const ANALYTICS: ConsumableExpenseAnalyticsRow[] = ROWS.map((row) => ({
  expenseDate: row.expenseDate,
  amountEur: row.amountEur,
  groupKey: row.groupName,
  groupLabel: row.groupName,
  supplierKey: row.supplierId ?? "",
  supplierLabel: row.supplierName,
  materialKey: row.itemId,
  materialLabel: row.itemName,
}));

function value(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function ConsumablesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const view = value(params.gorunum) || "analiz";
  const selectedSupplier = SUPPLIERS[0].id;
  const selectedRows = ANALYTICS.filter((row) => row.expenseDate.startsWith("2026-"));
  const matrix = selectedYearGroupMatrix(selectedRows, 2026, "2026-08-14");
  const drilldown = supplierDrilldownAggregate(selectedRows, selectedSupplier);

  const filters: ConsumableRecordFilters = {
    q: "",
    year: "",
    group: "",
    supplierId: "",
    currency: "",
    source: "",
    sort: "date",
    desc: true,
    page: 1,
  };

  return (
    <main className="mx-auto grid w-full max-w-[100rem] gap-4 p-3 sm:p-4">
      <div className="border bg-card p-3">
        <p className="oc-kicker text-muted-foreground">Development Preview</p>
        <h1 className="text-xl font-semibold tracking-tight">Sarf Giderleri</h1>
        <p className="text-sm text-muted-foreground">
          {ROWS.length} deterministik kayıt · uzun adlar · üç para birimi · legacy kalite işareti · kırmızı Haziran sıçraması
        </p>
      </div>
      <nav className="oc-scrollx flex gap-1 overflow-x-auto border-b" aria-label="Önizleme görünümü">
        {[
          ["giris", "Sarf Girişi"],
          ["kayitlar", "Sarf Kayıtları"],
          ["analiz", "Sarf Analizi"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`?gorunum=${key}`}
            className={cn(
              "shrink-0 px-3 py-2 text-sm",
              view === key
                ? "font-medium shadow-[inset_0_-2px_0_var(--primary)]"
                : "text-muted-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "giris" && (
        <div className="grid gap-5">
          <ExpenseEntry
            initialItems={ITEMS}
            initialSuppliers={SUPPLIERS}
            groups={["Sarf Gider-Atölye", "Sarf Gider-Ofis"]}
            initialDepartments={DEPARTMENTS}
          />
          <RecentExpenses rows={ROWS.slice(0, 12)} />
        </div>
      )}
      {view === "kayitlar" && (
        <ConsumableRecordsView
          result={{ rows: ROWS.slice(0, 100), total: ROWS.length, page: 1, pageSize: 100 }}
          filters={filters}
          years={[2026, 2025, 2024]}
          groups={["Sarf Gider-Atölye", "Sarf Gider-Ofis"]}
          items={ITEMS}
          suppliers={SUPPLIERS}
          canEdit
        />
      )}
      {view === "analiz" && (
        <ConsumableAnalysisView
          currentYear={2026}
          selectedYear={2026}
          availableYears={[2026, 2025, 2024]}
          monthlySeries={matrix.months}
          matrix={{ kind: "monthly", value: matrix }}
          supplierCount={SUPPLIERS.length}
          suppliers={SUPPLIERS}
          selectedSupplierId={selectedSupplier}
          drilldown={drilldown}
          supplierHistory={ROWS.filter((row) => row.supplierId === selectedSupplier && row.expenseDate.startsWith("2026-")).slice(0, 100)}
        />
      )}
    </main>
  );
}
