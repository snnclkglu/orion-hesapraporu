// İş Takibi sözlüğü ve toplama çekirdeği.
//
// BİR KAYIT = BİR GÜN × BİR İŞ KALEMİ × BİR PARÇA × BİR İMALAT TÜRÜ.
// Ölçülen büyüklük ADAM·SAAT'tir (kişi sayısı × saat). Bu dosya DB ve UI
// bağımlılığı taşımaz: sayfalar veriyi çeker, buradaki saf fonksiyonlar
// kırılımı üretir, testler aynı fonksiyonları çağırır.
//
// TEK ORTAK BÜYÜKLÜK ADAM·SAATTİR. Kayıt sayısı ("kaç satır girilmiş")
// yanıltıcıdır — bir satır 1 kişi × 2 saat de olabilir, 100 kişi × 8 saat de.
// Sıralama, pay ve karşılaştırmaların tamamı adam·saat üzerinden yapılır;
// kayıt sayısı yalnız yanında bilgi olarak gösterilir.

import { hueFromText } from "@/lib/tags";

// ------------------------------------------------------------------- tipler

/** Tek bir çalışma kaydı — sayfaların ortak satır biçimi. */
export interface WorkLogRow {
  id: string;
  /** ISO tarih (yyyy-mm-dd) — saat dilimi taşımaz, gün kaydıdır */
  date: string;
  /** Kalem numarası metni; bağlantı kurulamasa da her zaman doludur */
  itemNo: string;
  jobId: string | null;
  jobItemId: string | null;
  /** İş numarası (0025) — eşleşme yoksa boş */
  jobNo: string;
  jobTitle: string;
  customer: string;
  customerShort: string | null;
  customerHue: number | null;
  /** İş kaleminin ürün adı — eşleşme yoksa boş */
  productName: string;
  partId: string;
  partName: string;
  categoryId: string;
  categoryName: string;
  /** İmalat türünün OKLCH ton açısı (0–359) */
  categoryHue: number;
  /** Çizim grubu kodu ("0200") — işe göredir, evrensel değildir */
  partCode: string;
  people: number;
  hours: number;
  manHours: number;
  note: string;
}

export interface WorkPart {
  id: string;
  name: string;
  sort: number;
  active: boolean;
}

export interface WorkCategory {
  id: string;
  name: string;
  colorHue: number;
  sort: number;
  active: boolean;
}

/** Günlük girişte ve süzgeçlerde seçilebilen iş kalemi. */
export interface WorkJobOption {
  /** job_items.id — sistemde karşılığı olmayan numaralarda null */
  jobItemId: string | null;
  jobId: string | null;
  itemNo: string;
  jobNo: string;
  productName: string;
  customer: string;
  customerShort: string | null;
  customerHue: number | null;
  /** İş kalemi defterde yok; yalnız kayıtlardaki metinden biliniyor */
  orphan: boolean;
}

// ------------------------------------------------------------------ kırılım

/** Analizde kullanılabilen kırılım eksenleri. */
export const WORK_DIMENSIONS = [
  "item",
  "job",
  "customer",
  "part",
  "category",
  "partCode",
] as const;

export type WorkDimension = (typeof WORK_DIMENSIONS)[number];

export const WORK_DIMENSION_LABELS: Record<WorkDimension, string> = {
  item: "İş Kalemi",
  job: "İş",
  customer: "Müşteri",
  part: "Parça",
  category: "İmalat Türü",
  partCode: "Grup Kodu",
};

/** Kırılım anahtarının hem kimliğini hem ekrandaki adını verir. */
interface DimensionValue {
  key: string;
  label: string;
  /** Etiket rengi (OKLCH ton açısı); yoksa metinden türetilir */
  hue: number;
  /** İkinci satırda gösterilen açıklama (ürün adı, müşteri…) */
  hint: string;
}

const UNMATCHED = "—";

export function dimensionValue(row: WorkLogRow, dim: WorkDimension): DimensionValue {
  switch (dim) {
    case "item":
      return {
        key: row.itemNo || UNMATCHED,
        label: row.itemNo || UNMATCHED,
        hue: hueFromText(row.itemNo),
        hint: row.productName,
      };
    case "job":
      return {
        key: row.jobNo || UNMATCHED,
        label: row.jobNo || UNMATCHED,
        hue: hueFromText(row.jobNo),
        hint: row.jobTitle,
      };
    case "customer":
      return {
        key: row.customer || UNMATCHED,
        label: row.customerShort || row.customer || UNMATCHED,
        hue: row.customerHue ?? hueFromText(row.customer),
        hint: row.customer,
      };
    case "part":
      return {
        key: row.partId || row.partName,
        label: row.partName,
        hue: hueFromText(row.partName),
        hint: "",
      };
    case "category":
      return {
        key: row.categoryId || row.categoryName,
        label: row.categoryName,
        hue: row.categoryHue,
        hint: "",
      };
    case "partCode":
      return {
        key: row.partCode || UNMATCHED,
        label: row.partCode || UNMATCHED,
        hue: hueFromText(row.partCode),
        hint: "",
      };
  }
}

/** Bir kırılım satırı. */
export interface Bucket {
  key: string;
  label: string;
  hue: number;
  hint: string;
  manHours: number;
  records: number;
  /** Süzgeçten geçen toplama oranı (0–1) */
  share: number;
}

/**
 * Verilen eksende toplar ve adam·saate göre BÜYÜKTEN KÜÇÜĞE sıralar.
 * Eşitlikte ad sırası (tr) belirler — aynı veri her açılışta aynı sırayı verir.
 */
export function breakdown(rows: readonly WorkLogRow[], dim: WorkDimension): Bucket[] {
  const map = new Map<string, Bucket>();
  let total = 0;
  for (const row of rows) {
    const dv = dimensionValue(row, dim);
    const cur =
      map.get(dv.key) ??
      ({ ...dv, manHours: 0, records: 0, share: 0 } satisfies Bucket);
    cur.manHours += row.manHours;
    cur.records += 1;
    // İpucu ilk dolu değerde sabitlenir: aynı kalemin bazı satırlarında
    // ürün adı boş olabilir (eşleşmemiş kayıt) ve boş olan kazanmamalıdır.
    if (!cur.hint && dv.hint) cur.hint = dv.hint;
    map.set(dv.key, cur);
    total += row.manHours;
  }
  const out = [...map.values()];
  for (const b of out) b.share = total > 0 ? b.manHours / total : 0;
  return out.sort((a, b) => b.manHours - a.manHours || a.label.localeCompare(b.label, "tr"));
}

// -------------------------------------------------------------- zaman ekseni

export const TIME_BUCKETS = ["day", "week", "month"] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  day: "Günlük",
  week: "Haftalık",
  month: "Aylık",
};

const MONTHS_TR = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/**
 * ISO haftasının pazartesi tarihi.
 *
 * Türkiye'de hafta PAZARTESİ başlar; `getDay()` pazarı 0 verdiği için pazar
 * günü bir önceki haftaya yazılır. Tarih aritmetiği UTC'de yapılır — yerel
 * saat diliminde `new Date("2026-03-29")` gibi bir gün, yaz saati geçişinde
 * bir önceki güne kayabilir.
 */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // pazartesi = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Kaydın zaman kovası anahtarı — sıralanabilir olması için ISO tabanlıdır. */
export function bucketKey(iso: string, bucket: TimeBucket): string {
  if (bucket === "month") return iso.slice(0, 7);
  if (bucket === "week") return weekStart(iso);
  return iso;
}

/** Kova anahtarının ekrandaki kısa adı. */
export function bucketLabel(key: string, bucket: TimeBucket): string {
  if (bucket === "month") {
    const [y, m] = key.split("-");
    return `${MONTHS_TR[Number(m) - 1] ?? m} ${y.slice(2)}`;
  }
  const [y, m, d] = key.split("-");
  if (bucket === "week") return `${d}.${m}`;
  return `${d}.${m}.${y.slice(2)}`;
}

/** Zaman serisinin bir sütunu: toplam + seri (ör. imalat türü) kırılımı. */
export interface TimePoint {
  key: string;
  label: string;
  total: number;
  records: number;
  /** Seri anahtarı → adam·saat */
  parts: Record<string, number>;
}

/**
 * Zaman serisi. Kayıt bulunmayan aralıklar da üretilir (`fill`): boş ayı
 * atlamak grafikte iki kayıtlı ayı yan yana getirir ve duraklamayı gizler.
 */
export function timeSeries(
  rows: readonly WorkLogRow[],
  bucket: TimeBucket,
  series: WorkDimension | null = "category",
  fill = true
): TimePoint[] {
  const map = new Map<string, TimePoint>();
  for (const row of rows) {
    const key = bucketKey(row.date, bucket);
    const cur =
      map.get(key) ??
      ({ key, label: bucketLabel(key, bucket), total: 0, records: 0, parts: {} } satisfies TimePoint);
    cur.total += row.manHours;
    cur.records += 1;
    if (series) {
      const sk = dimensionValue(row, series).key;
      cur.parts[sk] = (cur.parts[sk] ?? 0) + row.manHours;
    }
    map.set(key, cur);
  }
  const out = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  if (!fill || out.length < 2) return out;
  return fillGaps(out, bucket);
}

function fillGaps(points: TimePoint[], bucket: TimeBucket): TimePoint[] {
  const out: TimePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    out.push(points[i]);
    const next = points[i + 1];
    if (!next) break;
    let cursor = points[i].key;
    // Emniyet tavanı: bozuk bir tarih sonsuz döngü kurmasın.
    for (let guard = 0; guard < 400; guard++) {
      cursor = stepBucket(cursor, bucket);
      if (cursor >= next.key) break;
      out.push({
        key: cursor,
        label: bucketLabel(cursor, bucket),
        total: 0,
        records: 0,
        parts: {},
      });
    }
  }
  return out;
}

function stepBucket(key: string, bucket: TimeBucket): string {
  if (bucket === "month") {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (bucket === "week" ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------- pivot

/** İki eksenli çapraz tablo. */
export interface Pivot {
  rows: Bucket[];
  cols: Bucket[];
  /** `${rowKey} ${colKey}` → adam·saat */
  cells: Map<string, number>;
  total: number;
}

export function cellKey(rowKey: string, colKey: string): string {
  return `${rowKey} ${colKey}`;
}

/**
 * Satır ve sütun eksenlerinin kesişimi. Satırlar ve sütunlar kendi
 * toplamlarına göre sıralıdır; boş kesişim haritada YOKTUR (tabloda tire).
 */
export function pivot(
  data: readonly WorkLogRow[],
  rowDim: WorkDimension,
  colDim: WorkDimension
): Pivot {
  const cells = new Map<string, number>();
  let total = 0;
  for (const row of data) {
    const r = dimensionValue(row, rowDim).key;
    const c = dimensionValue(row, colDim).key;
    const k = cellKey(r, c);
    cells.set(k, (cells.get(k) ?? 0) + row.manHours);
    total += row.manHours;
  }
  return { rows: breakdown(data, rowDim), cols: breakdown(data, colDim), cells, total };
}

// ------------------------------------------------------------------- dönemler

export const PERIOD_PRESETS = [
  "thisMonth",
  "lastMonth",
  "last3",
  "last6",
  "thisYear",
  "lastYear",
  "all",
  "custom",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  thisMonth: "Bu ay",
  lastMonth: "Geçen ay",
  last3: "Son 3 ay",
  last6: "Son 6 ay",
  thisYear: "Bu yıl",
  lastYear: "Geçen yıl",
  all: "Tüm zamanlar",
  custom: "Özel aralık",
};

export interface Period {
  /** ISO başlangıç (dâhil); boş = sınırsız */
  from: string;
  /** ISO bitiş (dâhil); boş = sınırsız */
  to: string;
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Ön tanımlı dönemi tarihe çevirir. `today` DIŞARIDAN verilir: fonksiyon saf
 * kalır ve testler bir güne sabitlenebilir.
 */
export function periodRange(preset: PeriodPreset, today: string): Period {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (preset) {
    case "thisMonth":
      return { from: isoOf(y, m, 1), to: isoOf(y, m, lastDayOfMonth(y, m)) };
    case "lastMonth": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: isoOf(py, pm, 1), to: isoOf(py, pm, lastDayOfMonth(py, pm)) };
    }
    case "last3":
    case "last6": {
      const back = preset === "last3" ? 2 : 5;
      const total = (y * 12 + (m - 1)) - back;
      const sy = Math.floor(total / 12);
      const sm = (total % 12) + 1;
      return { from: isoOf(sy, sm, 1), to: isoOf(y, m, lastDayOfMonth(y, m)) };
    }
    case "thisYear":
      return { from: isoOf(y, 1, 1), to: isoOf(y, 12, 31) };
    case "lastYear":
      return { from: isoOf(y - 1, 1, 1), to: isoOf(y - 1, 12, 31) };
    case "all":
    case "custom":
      return { from: "", to: "" };
  }
}

/**
 * Karşılaştırma için ÖNCEKİ eşit uzunluktaki dönem. "Bu ay geçen aya göre
 * nasıl?" sorusunun cevabı buradan çıkar; sınırsız dönemde karşılığı yoktur.
 */
export function previousPeriod(period: Period): Period | null {
  if (!period.from || !period.to) return null;
  const from = new Date(`${period.from}T00:00:00Z`);
  const to = new Date(`${period.to}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days <= 0) return null;
  const prevTo = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export function inPeriod(iso: string, period: Period): boolean {
  if (period.from && iso < period.from) return false;
  if (period.to && iso > period.to) return false;
  return true;
}

// ----------------------------------------------------------------- özetleme

export interface WorkSummary {
  manHours: number;
  records: number;
  /** Kayıt bulunan farklı gün sayısı */
  days: number;
  /** En yoğun günün adam·saati */
  peakManHours: number;
  peakDate: string;
  /** Çalışılan gün başına ortalama adam·saat */
  dailyAverage: number;
  /** Kalem numarası sistemde bir işe bağlanamamış kayıt sayısı */
  unmatched: number;
  items: number;
  parts: number;
}

export function summarize(rows: readonly WorkLogRow[]): WorkSummary {
  const perDay = new Map<string, number>();
  const items = new Set<string>();
  const parts = new Set<string>();
  let manHours = 0;
  let unmatched = 0;
  for (const r of rows) {
    manHours += r.manHours;
    perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.manHours);
    if (r.itemNo) items.add(r.itemNo);
    parts.add(r.partId || r.partName);
    if (!r.jobId) unmatched += 1;
  }
  let peakManHours = 0;
  let peakDate = "";
  for (const [date, v] of perDay) {
    if (v > peakManHours) {
      peakManHours = v;
      peakDate = date;
    }
  }
  const days = perDay.size;
  return {
    manHours,
    records: rows.length,
    days,
    peakManHours,
    peakDate,
    dailyAverage: days > 0 ? manHours / days : 0,
    unmatched,
    items: items.size,
    parts: parts.size,
  };
}

// ------------------------------------------------------------------ biçimleme

const HOURS_FMT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Adam·saat — yarım saatlik girişler olabildiği için tek ondalık. */
export function fmtManHours(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return HOURS_FMT.format(v);
}

/** Kart başlıklarında kısaltılmış adam·saat: 18.162 → "18,2 B". */
export function fmtCompactHours(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return `${HOURS_FMT.format(v / 1000)} B`;
  return HOURS_FMT.format(v);
}

/** ISO tarihi tr-TR gösterimi ("2026-08-09" → "09.08.2026"). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** "09.08.2026 · Pazar" — tarih gezinme başlığı. */
export function fmtDateLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = DAYS_TR[d.getUTCDay()] ?? "";
  return `${fmtDate(iso)} · ${day}`;
}

/** Bugünün ISO tarihi — YEREL takvim gününe göre (UTC kaymasız). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Bir günü ileri/geri alır. */
export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hafta sonu mu? Girişte "hafta sonu" uyarısı için. */
export function isWeekend(iso: string): boolean {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * İndirilen dosyanın adı — İSTENEN BİÇİM: ad + tarih + saat.
 * "ORION İş Takibi 09.08.2026 14-32.xlsx" (saatte iki nokta dosya adında
 * kullanılamaz, tire ile yazılır).
 */
export function downloadName(base: string, ext: string, now: Date = new Date()): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}` +
    ` ${p2(now.getHours())}-${p2(now.getMinutes())}`;
  return `${base} ${stamp}.${ext}`;
}
