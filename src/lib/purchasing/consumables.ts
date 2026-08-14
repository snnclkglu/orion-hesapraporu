// Sarf gideri analizinin saf hesaplama katmanı.
//
// Buradaki fonksiyonlar veritabanı satırını, para birimini veya React'i bilmez.
// Çağıran katman her kaydı işlem günündeki kurla EUR'a çevirdikten sonra
// `amountEur` olarak verir. Böylece kayıt tablosu, matris ve grafik aynı toplamı
// üretir; kur bulunmayan bir kayıt da sessizce sıfır sayılmaz.

export const CONSUMABLE_MONTH_LABELS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

export const CONSUMABLE_SPIKE_RATIO = 1.5;
export const CONSUMABLE_STRONG_SPIKE_RATIO = 2;
export const CONSUMABLE_MIN_BASELINE_MONTHS = 3;

export type ConsumableSpikeLevel = "none" | "spike" | "strong";

/** Analize girecek, EUR karşılığı önceden hesaplanmış tek sarf gideri kaydı. */
export interface ConsumableExpenseAnalyticsRow {
  expenseDate: string;
  /** Kur karşılığı bulunamıyorsa `null`; bu kayıt EUR toplamına girmez. */
  amountEur: number | null;
  groupKey: string;
  groupLabel?: string | null;
  supplierKey: string;
  supplierLabel?: string | null;
  materialKey?: string | null;
  materialLabel?: string | null;
}

export interface ConsumableMonthlyEurPoint {
  monthKey: string;
  year: number;
  /** 1–12. */
  month: number;
  monthLabel: string;
  amountEur: number;
  /** Yalnız geçerli, sonlu EUR karşılığı olan kayıtların sayısı. */
  recordCount: number;
}

export interface ConsumableSelectedYearMonthPoint extends ConsumableMonthlyEurPoint {
  /** Seçili ay, `asOfDate` ayından sonra mı? */
  isFuture: boolean;
}

export interface ConsumableSpikeResult {
  level: ConsumableSpikeLevel;
  baselineAverageEur: number | null;
  baselineMonthCount: number;
  ratioToBaseline: number | null;
}

export interface ConsumableGroupMonthCell extends ConsumableSelectedYearMonthPoint {
  anomaly: ConsumableSpikeLevel;
  /** Bu hücre HARİÇ, pozitif ve gelecek olmayan baz ayların ortalaması. */
  baselineAverageEur: number | null;
  baselineMonthCount: number;
  ratioToBaseline: number | null;
}

export interface ConsumableGroupMatrixRow {
  groupKey: string;
  groupLabel: string;
  cells: ConsumableGroupMonthCell[];
  totalEur: number;
  recordCount: number;
  /** Gelecek olmayan takvim aylarına göre ortalama; gelecek yıl için `null`. */
  averageEur: number | null;
}

export interface ConsumableSelectedYearGroupMatrix {
  year: number;
  months: ConsumableSelectedYearMonthPoint[];
  rows: ConsumableGroupMatrixRow[];
  totalEur: number;
  recordCount: number;
  /** Gelecek olmayan takvim aylarına göre ortalama; gelecek yıl için `null`. */
  averageEur: number | null;
}

export interface ConsumableMonthRange {
  /** Dahil, `YYYY-MM`. Verilmezse verinin ilk ayı. */
  fromMonth?: string;
  /** Dahil, `YYYY-MM`. Verilmezse verinin son ayı. */
  toMonth?: string;
}

export interface ConsumableYearRange {
  /** Dahil. Verilmezse verinin ilk yılı. */
  fromYear?: number;
  /** Dahil. Verilmezse verinin son yılı. */
  toYear?: number;
}

export interface ConsumableAnnualEurPoint {
  year: number;
  amountEur: number;
  recordCount: number;
}

export interface ConsumableAnnualGroupRow {
  groupKey: string;
  groupLabel: string;
  cells: ConsumableAnnualEurPoint[];
  totalEur: number;
  recordCount: number;
  averageEur: number | null;
}

export interface ConsumableAnnualGroupMatrix {
  years: number[];
  totals: ConsumableAnnualEurPoint[];
  rows: ConsumableAnnualGroupRow[];
  totalEur: number;
  recordCount: number;
}

export interface ConsumableBreakdownRow {
  key: string;
  label: string;
  amountEur: number;
  recordCount: number;
  /** 0–1 arası pay; toplam sıfırsa oran tanımsızdır. */
  shareOfTotal: number | null;
}

export interface ConsumableSupplierDrilldown {
  supplierKey: string;
  supplierLabel: string;
  totalEur: number;
  recordCount: number;
  firstExpenseDate: string;
  lastExpenseDate: string;
  averageMonthlyEur: number;
  monthly: ConsumableMonthlyEurPoint[];
  annual: ConsumableAnnualEurPoint[];
  groups: ConsumableBreakdownRow[];
  materials: ConsumableBreakdownRow[];
}

interface ParsedIsoDate {
  year: number;
  month: number;
  day: number;
  monthKey: string;
}

interface NormalizedAnalyticsRow {
  source: ConsumableExpenseAnalyticsRow;
  date: ParsedIsoDate;
  amountEur: number;
  groupKey: string;
  groupLabel: string;
  supplierKey: string;
  supplierLabel: string;
  materialKey: string;
  materialLabel: string;
}

interface MutableDimensionAggregate {
  key: string;
  label: string;
  labelDate: string;
  amounts: number[];
  counts: number[];
}

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_PER_MONTH[month - 1] ?? 0;
}

function parseIsoDate(value: string): ParsedIsoDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day, monthKey: `${match[1]}-${match[2]}` };
}

function parseMonthKey(value: string): { year: number; month: number; index: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || month < 1 || month > 12) return null;
  return { year, month, index: monthIndex(year, month) };
}

function assertYear(year: number, field: string): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError(`${field} 1–9999 arasında tam sayı olmalıdır.`);
  }
}

function requireIsoDate(value: string, field: string): ParsedIsoDate {
  const parsed = parseIsoDate(value);
  if (!parsed) throw new RangeError(`${field} geçerli bir YYYY-MM-DD tarihi olmalıdır.`);
  return parsed;
}

function requireMonthKey(
  value: string,
  field: string
): { year: number; month: number; index: number } {
  const parsed = parseMonthKey(value);
  if (!parsed) throw new RangeError(`${field} geçerli bir YYYY-MM ayı olmalıdır.`);
  return parsed;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

function monthFromIndex(index: number): { year: number; month: number } {
  const year = Math.floor(index / 12);
  return { year, month: index - year * 12 + 1 };
}

function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${CONSUMABLE_MONTH_LABELS_TR[month - 1]} ${year}`;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeRows(
  rows: readonly ConsumableExpenseAnalyticsRow[]
): NormalizedAnalyticsRow[] {
  const normalized: NormalizedAnalyticsRow[] = [];
  for (const source of rows) {
    const date = parseIsoDate(source.expenseDate);
    if (!date || source.amountEur === null || !Number.isFinite(source.amountEur)) continue;

    const groupKey = clean(source.groupKey);
    const supplierKey = clean(source.supplierKey);
    const materialKey = clean(source.materialKey);
    normalized.push({
      source,
      date,
      amountEur: source.amountEur,
      groupKey,
      groupLabel: clean(source.groupLabel) || groupKey,
      supplierKey,
      supplierLabel: clean(source.supplierLabel) || supplierKey,
      materialKey,
      materialLabel: clean(source.materialLabel) || materialKey,
    });
  }
  return normalized;
}

function sortByTotalThenLabel<T extends { amountEur: number; label: string; key: string }>(
  a: T,
  b: T
): number {
  return b.amountEur - a.amountEur || a.label.localeCompare(b.label, "tr") || a.key.localeCompare(b.key);
}

function shouldReplaceLabel(
  currentDate: string,
  currentLabel: string,
  candidateDate: string,
  candidateLabel: string
): boolean {
  return (
    candidateDate > currentDate ||
    (candidateDate === currentDate && candidateLabel.localeCompare(currentLabel, "tr") > 0)
  );
}

function emptyMonthlyPoint(year: number, month: number): ConsumableMonthlyEurPoint {
  return {
    monthKey: monthKey(year, month),
    year,
    month,
    monthLabel: monthLabel(year, month),
    amountEur: 0,
    recordCount: 0,
  };
}

/**
 * Bir ayı, kendisi HARİÇ diğer pozitif baz ayların ortalamasına göre sınıflar.
 * Tam 1,5× ve 2× eşik değildir; kullanıcı kuralındaki “çok yüksek” değerler
 * sırasıyla `> 1.5×` ve `> 2×` olmalıdır.
 */
export function classifyConsumableSpike(
  currentAmountEur: number,
  otherMonthlyAmountsEur: readonly number[]
): ConsumableSpikeResult {
  const baseline = otherMonthlyAmountsEur.filter(
    (amount) => Number.isFinite(amount) && amount > 0
  );
  if (baseline.length < CONSUMABLE_MIN_BASELINE_MONTHS) {
    return {
      level: "none",
      baselineAverageEur: null,
      baselineMonthCount: baseline.length,
      ratioToBaseline: null,
    };
  }

  const baselineAverageEur = baseline.reduce((sum, amount) => sum + amount, 0) / baseline.length;
  const ratioToBaseline = Number.isFinite(currentAmountEur)
    ? currentAmountEur / baselineAverageEur
    : null;
  let level: ConsumableSpikeLevel = "none";
  if (currentAmountEur > 0 && ratioToBaseline !== null) {
    if (ratioToBaseline > CONSUMABLE_STRONG_SPIKE_RATIO) level = "strong";
    else if (ratioToBaseline > CONSUMABLE_SPIKE_RATIO) level = "spike";
  }

  return {
    level,
    baselineAverageEur,
    baselineMonthCount: baseline.length,
    ratioToBaseline,
  };
}

/** Seçili yılın Ocak–Aralık arasındaki, boş ayları sıfırlanmış EUR serisi. */
export function selectedYearMonthlyEurSeries(
  rows: readonly ConsumableExpenseAnalyticsRow[],
  year: number,
  asOfDate: string
): ConsumableSelectedYearMonthPoint[] {
  assertYear(year, "year");
  const asOf = requireIsoDate(asOfDate, "asOfDate");
  const asOfMonthIndex = monthIndex(asOf.year, asOf.month);
  const months: ConsumableSelectedYearMonthPoint[] = Array.from({ length: 12 }, (_, index) => {
    const point = emptyMonthlyPoint(year, index + 1);
    return { ...point, isFuture: monthIndex(year, index + 1) > asOfMonthIndex };
  });

  for (const row of normalizeRows(rows)) {
    if (row.date.year !== year) continue;
    const point = months[row.date.month - 1];
    point.amountEur += row.amountEur;
    point.recordCount += 1;
  }
  return months;
}

/**
 * Grup × 12 ay matrisi. Her hücrenin anomali bazı AYNI grubun, o hücre dışında
 * kalan pozitif ve gelecek olmayan aylarıdır; üç baz aydan azsa renk üretilmez.
 */
export function selectedYearGroupMatrix(
  rows: readonly ConsumableExpenseAnalyticsRow[],
  year: number,
  asOfDate: string
): ConsumableSelectedYearGroupMatrix {
  const months = selectedYearMonthlyEurSeries(rows, year, asOfDate);
  const groups = new Map<string, MutableDimensionAggregate>();

  for (const row of normalizeRows(rows)) {
    if (row.date.year !== year || !row.groupKey) continue;
    let group = groups.get(row.groupKey);
    if (!group) {
      group = {
        key: row.groupKey,
        label: row.groupLabel,
        labelDate: row.source.expenseDate,
        amounts: Array<number>(12).fill(0),
        counts: Array<number>(12).fill(0),
      };
      groups.set(row.groupKey, group);
    } else if (
      shouldReplaceLabel(group.labelDate, group.label, row.source.expenseDate, row.groupLabel)
    ) {
      group.label = row.groupLabel;
      group.labelDate = row.source.expenseDate;
    }
    group.amounts[row.date.month - 1] += row.amountEur;
    group.counts[row.date.month - 1] += 1;
  }

  const matrixRows: ConsumableGroupMatrixRow[] = [];
  for (const group of groups.values()) {
    const cells = months.map<ConsumableGroupMonthCell>((month, index) => {
      const spike = month.isFuture
        ? {
            level: "none" as const,
            baselineAverageEur: null,
            baselineMonthCount: 0,
            ratioToBaseline: null,
          }
        : classifyConsumableSpike(
            group.amounts[index],
            group.amounts.filter((_, otherIndex) => otherIndex !== index && !months[otherIndex].isFuture)
          );
      return {
        ...month,
        amountEur: group.amounts[index],
        recordCount: group.counts[index],
        anomaly: spike.level,
        baselineAverageEur: spike.baselineAverageEur,
        baselineMonthCount: spike.baselineMonthCount,
        ratioToBaseline: spike.ratioToBaseline,
      };
    });
    const totalEur = group.amounts.reduce((sum, amount) => sum + amount, 0);
    const recordCount = group.counts.reduce((sum, count) => sum + count, 0);
    const elapsedCells = cells.filter((cell) => !cell.isFuture);
    matrixRows.push({
      groupKey: group.key,
      groupLabel: group.label,
      cells,
      totalEur,
      recordCount,
      averageEur:
        elapsedCells.length === 0
          ? null
          : elapsedCells.reduce((sum, cell) => sum + cell.amountEur, 0) / elapsedCells.length,
    });
  }
  matrixRows.sort(
    (a, b) =>
      b.totalEur - a.totalEur ||
      a.groupLabel.localeCompare(b.groupLabel, "tr") ||
      a.groupKey.localeCompare(b.groupKey)
  );

  const totalEur = months.reduce((sum, month) => sum + month.amountEur, 0);
  const recordCount = months.reduce((sum, month) => sum + month.recordCount, 0);
  const elapsedMonths = months.filter((month) => !month.isFuture);
  return {
    year,
    months,
    rows: matrixRows,
    totalEur,
    recordCount,
    averageEur:
      elapsedMonths.length === 0
        ? null
        : elapsedMonths.reduce((sum, month) => sum + month.amountEur, 0) / elapsedMonths.length,
  };
}

/**
 * İlk ve son ay arasındaki bütün ayları üretir. `fromMonth`/`toMonth` verilirse
 * aralık sabitlenir; arada hiç kayıt olmayan aylar yine sıfır olarak döner.
 */
export function denseMonthlyEurRange(
  rows: readonly ConsumableExpenseAnalyticsRow[],
  range: ConsumableMonthRange = {}
): ConsumableMonthlyEurPoint[] {
  const normalized = normalizeRows(rows);
  const dataIndexes = normalized.map((row) => monthIndex(row.date.year, row.date.month));
  const explicitFrom = range.fromMonth
    ? requireMonthKey(range.fromMonth, "fromMonth").index
    : undefined;
  const explicitTo = range.toMonth ? requireMonthKey(range.toMonth, "toMonth").index : undefined;

  const from = explicitFrom ?? (dataIndexes.length > 0 ? Math.min(...dataIndexes) : explicitTo);
  const to = explicitTo ?? (dataIndexes.length > 0 ? Math.max(...dataIndexes) : explicitFrom);
  if (from === undefined || to === undefined) return [];
  if (from > to) throw new RangeError("fromMonth, toMonth değerinden sonra olamaz.");

  const points: ConsumableMonthlyEurPoint[] = [];
  const pointByIndex = new Map<number, ConsumableMonthlyEurPoint>();
  for (let index = from; index <= to; index += 1) {
    const value = monthFromIndex(index);
    const point = emptyMonthlyPoint(value.year, value.month);
    points.push(point);
    pointByIndex.set(index, point);
  }
  for (const row of normalized) {
    const index = monthIndex(row.date.year, row.date.month);
    const point = pointByIndex.get(index);
    if (!point) continue;
    point.amountEur += row.amountEur;
    point.recordCount += 1;
  }
  return points;
}

/**
 * Grup × yıl matrisi. İlk ve son veri yılı arasındaki eksik yıllar da sütun
 * olarak kalır; “tüm yıllar” görünümü boş bir yılı yanlışlıkla atlamaz.
 */
export function annualGroupMatrix(
  rows: readonly ConsumableExpenseAnalyticsRow[],
  range: ConsumableYearRange = {}
): ConsumableAnnualGroupMatrix {
  if (range.fromYear !== undefined) assertYear(range.fromYear, "fromYear");
  if (range.toYear !== undefined) assertYear(range.toYear, "toYear");

  const normalized = normalizeRows(rows).filter((row) => row.groupKey);
  const dataYears = normalized.map((row) => row.date.year);
  const from = range.fromYear ?? (dataYears.length > 0 ? Math.min(...dataYears) : range.toYear);
  const to = range.toYear ?? (dataYears.length > 0 ? Math.max(...dataYears) : range.fromYear);
  if (from === undefined || to === undefined) {
    return { years: [], totals: [], rows: [], totalEur: 0, recordCount: 0 };
  }
  if (from > to) throw new RangeError("fromYear, toYear değerinden sonra olamaz.");

  const years = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  const yearIndexes = new Map(years.map((year, index) => [year, index] as const));
  const totalAmounts = Array<number>(years.length).fill(0);
  const totalCounts = Array<number>(years.length).fill(0);
  const groups = new Map<string, MutableDimensionAggregate>();

  for (const row of normalized) {
    const yearIndex = yearIndexes.get(row.date.year);
    if (yearIndex === undefined) continue;
    totalAmounts[yearIndex] += row.amountEur;
    totalCounts[yearIndex] += 1;

    let group = groups.get(row.groupKey);
    if (!group) {
      group = {
        key: row.groupKey,
        label: row.groupLabel,
        labelDate: row.source.expenseDate,
        amounts: Array<number>(years.length).fill(0),
        counts: Array<number>(years.length).fill(0),
      };
      groups.set(row.groupKey, group);
    } else if (
      shouldReplaceLabel(group.labelDate, group.label, row.source.expenseDate, row.groupLabel)
    ) {
      group.label = row.groupLabel;
      group.labelDate = row.source.expenseDate;
    }
    group.amounts[yearIndex] += row.amountEur;
    group.counts[yearIndex] += 1;
  }

  const matrixRows: ConsumableAnnualGroupRow[] = [...groups.values()]
    .map((group) => {
      const totalEur = group.amounts.reduce((sum, amount) => sum + amount, 0);
      return {
        groupKey: group.key,
        groupLabel: group.label,
        cells: years.map((year, index) => ({
          year,
          amountEur: group.amounts[index],
          recordCount: group.counts[index],
        })),
        totalEur,
        recordCount: group.counts.reduce((sum, count) => sum + count, 0),
        averageEur: years.length === 0 ? null : totalEur / years.length,
      };
    })
    .sort(
      (a, b) =>
        b.totalEur - a.totalEur ||
        a.groupLabel.localeCompare(b.groupLabel, "tr") ||
        a.groupKey.localeCompare(b.groupKey)
    );

  return {
    years,
    totals: years.map((year, index) => ({
      year,
      amountEur: totalAmounts[index],
      recordCount: totalCounts[index],
    })),
    rows: matrixRows,
    totalEur: totalAmounts.reduce((sum, amount) => sum + amount, 0),
    recordCount: totalCounts.reduce((sum, count) => sum + count, 0),
  };
}

function breakdown(
  rows: readonly NormalizedAnalyticsRow[],
  totalEur: number,
  dimension: (row: NormalizedAnalyticsRow) => { key: string; label: string }
): ConsumableBreakdownRow[] {
  const aggregates = new Map<
    string,
    { key: string; label: string; labelDate: string; amountEur: number; recordCount: number }
  >();
  for (const row of rows) {
    const value = dimension(row);
    if (!value.key) continue;
    const current = aggregates.get(value.key);
    if (!current) {
      aggregates.set(value.key, {
        ...value,
        labelDate: row.source.expenseDate,
        amountEur: row.amountEur,
        recordCount: 1,
      });
      continue;
    }
    current.amountEur += row.amountEur;
    current.recordCount += 1;
    if (shouldReplaceLabel(current.labelDate, current.label, row.source.expenseDate, value.label)) {
      current.label = value.label;
      current.labelDate = row.source.expenseDate;
    }
  }

  return [...aggregates.values()]
    .map(({ key, label, amountEur, recordCount }) => ({
      key,
      label,
      amountEur,
      recordCount,
      shareOfTotal: totalEur === 0 ? null : amountEur / totalEur,
    }))
    .sort(sortByTotalThenLabel);
}

/**
 * Tek tedarikçinin tüm EUR geçmişini; dense aylık seri, yıllık toplam ve grup /
 * malzeme kırılımlarıyla döndürür. Geçerli EUR kaydı yoksa `null` döner.
 */
export function supplierDrilldownAggregate(
  rows: readonly ConsumableExpenseAnalyticsRow[],
  supplierKey: string
): ConsumableSupplierDrilldown | null {
  const normalizedSupplierKey = clean(supplierKey);
  if (!normalizedSupplierKey) return null;
  const matching = normalizeRows(rows).filter((row) => row.supplierKey === normalizedSupplierKey);
  if (matching.length === 0) return null;

  const totalEur = matching.reduce((sum, row) => sum + row.amountEur, 0);
  const monthly = denseMonthlyEurRange(matching.map((row) => row.source));
  const annualByYear = new Map<number, { amountEur: number; recordCount: number }>();
  for (const month of monthly) {
    const annual = annualByYear.get(month.year) ?? { amountEur: 0, recordCount: 0 };
    annual.amountEur += month.amountEur;
    annual.recordCount += month.recordCount;
    annualByYear.set(month.year, annual);
  }

  const orderedByDate = [...matching].sort((a, b) =>
    a.source.expenseDate.localeCompare(b.source.expenseDate)
  );
  let supplierLabel = normalizedSupplierKey;
  let supplierLabelDate = "";
  for (const row of matching) {
    if (
      shouldReplaceLabel(
        supplierLabelDate,
        supplierLabel,
        row.source.expenseDate,
        row.supplierLabel
      )
    ) {
      supplierLabel = row.supplierLabel;
      supplierLabelDate = row.source.expenseDate;
    }
  }

  return {
    supplierKey: normalizedSupplierKey,
    supplierLabel,
    totalEur,
    recordCount: matching.length,
    firstExpenseDate: orderedByDate[0].source.expenseDate,
    lastExpenseDate: orderedByDate[orderedByDate.length - 1].source.expenseDate,
    averageMonthlyEur: monthly.length === 0 ? 0 : totalEur / monthly.length,
    monthly,
    annual: [...annualByYear.entries()].map(([year, value]) => ({ year, ...value })),
    groups: breakdown(matching, totalEur, (row) => ({
      key: row.groupKey,
      label: row.groupLabel,
    })),
    materials: breakdown(matching, totalEur, (row) => ({
      key: row.materialKey,
      label: row.materialLabel,
    })),
  };
}
