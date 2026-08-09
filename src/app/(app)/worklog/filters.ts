// İş Takibi süzgeçleri — TEK TANIM, üç yerde kullanılır.
//
// Analiz ekranı, Kayıtlar ekranı ve Excel indirme ucu aynı süzgeç kümesini
// kullanır. Üçünde ayrı ayrı yazılsaydı indirilen dosya ile ekrandaki tablo
// sessizce ayrışırdı — kullanıcının fark etmesi güç, güveni bozan bir hata.
// Süzgeç adresi de buradan üretilir: filtreli bir ekran paylaşılabilir.

import { inPeriod, type Period, type WorkLogRow } from "@/lib/work-log";

/** "Tümü" seçeneği — Select bileşeni boş string değere izin vermez. */
export const ALL = "__all__";

export interface WorkFilters {
  /** ISO başlangıç (dâhil); boş = sınırsız */
  from: string;
  /** ISO bitiş (dâhil); boş = sınırsız */
  to: string;
  /** Müşteri tam unvanı */
  customer: string;
  /** İş numarası (0025) */
  job: string;
  /** Kalem numarası (0025-00) */
  item: string;
  /** Parça adı */
  part: string;
  /** İmalat türü adı */
  category: string;
  /** Serbest metin araması */
  query: string;
}

export const EMPTY_FILTERS: WorkFilters = {
  from: "",
  to: "",
  customer: ALL,
  job: ALL,
  item: ALL,
  part: ALL,
  category: ALL,
  query: "",
};

export function periodOf(f: WorkFilters): Period {
  return { from: f.from, to: f.to };
}

export function matchesFilters(row: WorkLogRow, f: WorkFilters): boolean {
  if (!inPeriod(row.date, periodOf(f))) return false;
  if (f.customer !== ALL && (row.customer || "") !== f.customer) return false;
  if (f.job !== ALL && (row.jobNo || "") !== f.job) return false;
  if (f.item !== ALL && (row.itemNo || "") !== f.item) return false;
  if (f.part !== ALL && row.partName !== f.part) return false;
  if (f.category !== ALL && row.categoryName !== f.category) return false;
  const q = f.query.trim().toLocaleLowerCase("tr");
  if (q) {
    const hay = [
      row.itemNo,
      row.jobNo,
      row.jobTitle,
      row.customer,
      row.customerShort ?? "",
      row.productName,
      row.partName,
      row.categoryName,
      row.partCode,
      row.note,
    ]
      .join(" ")
      .toLocaleLowerCase("tr");
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Kaç süzgeç etkin — "Temizle" düğmesinin görünürlüğü buna bağlıdır. */
export function activeFilterCount(f: WorkFilters): number {
  return (
    (f.from || f.to ? 1 : 0) +
    (f.customer !== ALL ? 1 : 0) +
    (f.job !== ALL ? 1 : 0) +
    (f.item !== ALL ? 1 : 0) +
    (f.part !== ALL ? 1 : 0) +
    (f.category !== ALL ? 1 : 0) +
    (f.query.trim() ? 1 : 0)
  );
}

const KEYS: (keyof WorkFilters)[] = [
  "from",
  "to",
  "customer",
  "job",
  "item",
  "part",
  "category",
  "query",
];

export function filtersToQuery(f: WorkFilters): string {
  const sp = new URLSearchParams();
  for (const k of KEYS) {
    const v = f[k];
    if (v && v !== ALL) sp.set(k, v);
  }
  return sp.toString();
}

export function filtersFromQuery(sp: URLSearchParams | Record<string, string | undefined>): WorkFilters {
  const get = (k: string): string =>
    sp instanceof URLSearchParams ? (sp.get(k) ?? "") : (sp[k] ?? "");
  const out = { ...EMPTY_FILTERS };
  for (const k of KEYS) {
    const v = get(k);
    if (!v) continue;
    out[k] = v;
  }
  return out;
}

/** Süzgeçlerin insan okunur özeti — indirilen Excel'in başlığına yazılır. */
export function describeFilters(f: WorkFilters): string {
  const parts: string[] = [];
  if (f.from || f.to) {
    const d = (iso: string) => (iso ? `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "…");
    parts.push(`${d(f.from)} – ${d(f.to)}`);
  }
  if (f.customer !== ALL) parts.push(f.customer);
  if (f.job !== ALL) parts.push(`İş ${f.job}`);
  if (f.item !== ALL) parts.push(`Kalem ${f.item}`);
  if (f.part !== ALL) parts.push(f.part);
  if (f.category !== ALL) parts.push(f.category);
  if (f.query.trim()) parts.push(`"${f.query.trim()}"`);
  return parts.length > 0 ? parts.join(" · ") : "Tüm kayıtlar";
}
