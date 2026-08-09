// İş Takibi sunucu tarafı veri okumaları — üç sayfanın ortak yükleyicileri.
//
// Sayfalar Server Component'tir ve süzme İSTEMCİDE yapılır (liste ekranlarının
// deseni). Kayıt sayısı binlerle ölçülür; bu yüzden tek fark şudur: Analiz ve
// Kayıtlar sayfası TARİH ARALIĞINI sunucuda keser, gerisini istemciye bırakır.
// Böylece "son 3 ay" birkaç yüz satır indirir, "tüm zamanlar" hepsini.
//
// PostgREST'in `max_rows` ayarı bu projede 1000'dir ve istemci `.limit()`
// bunu AŞAMAZ (katalog seçicisinde canlıda ölçülmüştü). Bu yüzden kayıt
// okumaları `range()` ile SAYFALANIR — 1751 satırlık devralınan veri tek
// istekte sessizce kırpılırdı.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkCategory, WorkJobOption, WorkLogRow, WorkPart } from "@/lib/work-log";

/** Supabase gömülü ilişkiyi tekil ya da dizi dönebilir; ikisini de karşıla. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** numeric sütunlar PostgREST'ten metin gelebilir. */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const PAGE = 1000;

interface CustomerJoin {
  short_name: string | null;
  color_hue: number | null;
}

interface JobJoin {
  id: string;
  job_no: string;
  title: string;
  customer: string | null;
  customers: CustomerJoin | CustomerJoin[] | null;
}

interface ItemJoin {
  id: string;
  item_no: string;
  product_name: string;
}

interface LogRecord {
  id: string;
  work_date: string;
  item_no: string;
  part_code: string;
  people: number;
  hours: number | string;
  man_hours: number | string;
  note: string;
  job_id: string | null;
  job_item_id: string | null;
  work_parts: { id: string; name: string } | { id: string; name: string }[] | null;
  work_categories:
    | { id: string; name: string; color_hue: number }
    | { id: string; name: string; color_hue: number }[]
    | null;
  jobs: JobJoin | JobJoin[] | null;
  job_items: ItemJoin | ItemJoin[] | null;
}

// Sorgu metni TEK PARÇA şablon dizgisi olmalıdır — birleştirilmiş dizgide
// Supabase tip çıkarımı çalışmaz ve satırlar `GenericStringError` olur.
const LOG_SELECT = `id, work_date, item_no, part_code, people, hours, man_hours, note,
   job_id, job_item_id,
   work_parts(id, name),
   work_categories(id, name, color_hue),
   jobs(id, job_no, title, customer, customers(short_name, color_hue)),
   job_items(id, item_no, product_name)`;

function toRow(r: LogRecord): WorkLogRow {
  const part = one(r.work_parts);
  const cat = one(r.work_categories);
  const job = one<JobJoin>(r.jobs);
  const item = one<ItemJoin>(r.job_items);
  const book = one<CustomerJoin>(job?.customers);
  return {
    id: r.id,
    date: r.work_date,
    itemNo: r.item_no ?? "",
    jobId: r.job_id,
    jobItemId: r.job_item_id,
    jobNo: job?.job_no ?? "",
    jobTitle: job?.title ?? "",
    customer: job?.customer ?? "",
    customerShort: book?.short_name ?? null,
    customerHue: book?.color_hue ?? null,
    productName: item?.product_name ?? "",
    partId: part?.id ?? "",
    partName: part?.name ?? "",
    categoryId: cat?.id ?? "",
    categoryName: cat?.name ?? "",
    categoryHue: cat?.color_hue ?? 0,
    partCode: r.part_code ?? "",
    people: Number(r.people) || 0,
    hours: num(r.hours),
    manHours: num(r.man_hours),
    note: r.note ?? "",
  };
}

/**
 * Kayıtları okur. `from`/`to` boşsa sınır uygulanmaz.
 * Sayfalama kısa sayfa gelene kadar sürer; 40.000 satırlık emniyet tavanı
 * bir yapılandırma hatasında tarayıcıyı kilitlemeyi önler.
 */
export async function loadWorkLogs(
  supabase: SupabaseClient,
  range: { from?: string; to?: string } = {}
): Promise<WorkLogRow[]> {
  const out: WorkLogRow[] = [];
  for (let page = 0; page < 40; page++) {
    let q = supabase
      .from("work_logs")
      .select(LOG_SELECT)
      .order("work_date", { ascending: false })
      .order("item_no", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (range.from) q = q.gte("work_date", range.from);
    if (range.to) q = q.lte("work_date", range.to);

    const { data, error } = await q;
    if (error || !data) break;
    out.push(...(data as unknown as LogRecord[]).map(toRow));
    if (data.length < PAGE) break;
  }
  return out;
}

/** Tek bir günün kayıtları — günlük giriş ekranının yükü. */
export async function loadWorkDay(
  supabase: SupabaseClient,
  date: string
): Promise<WorkLogRow[]> {
  const { data } = await supabase
    .from("work_logs")
    .select(LOG_SELECT)
    .eq("work_date", date)
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as LogRecord[]).map(toRow);
}

/**
 * "Dünü kopyala" kaynağı: verilen günden ÖNCEKİ, kaydı olan EN SON gün.
 *
 * Takvimdeki bir önceki gün değil — hafta sonu ve tatiller araya girer ve
 * kullanıcı pazartesi sabahı boş bir cumartesiyi kopyalamak istemez.
 */
export async function loadPreviousWorkDay(
  supabase: SupabaseClient,
  date: string
): Promise<{ date: string; rows: WorkLogRow[] } | null> {
  const { data: last } = await supabase
    .from("work_logs")
    .select("work_date")
    .lt("work_date", date)
    .order("work_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = (last as { work_date: string } | null)?.work_date;
  if (!prev) return null;
  return { date: prev, rows: await loadWorkDay(supabase, prev) };
}

export async function loadParts(supabase: SupabaseClient): Promise<WorkPart[]> {
  const { data } = await supabase
    .from("work_parts")
    .select("id, name, sort, active")
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  return ((data ?? []) as { id: string; name: string; sort: number; active: boolean }[]).map(
    (p) => ({ id: p.id, name: p.name, sort: p.sort, active: p.active })
  );
}

export async function loadCategories(supabase: SupabaseClient): Promise<WorkCategory[]> {
  const { data } = await supabase
    .from("work_categories")
    .select("id, name, color_hue, sort, active")
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  return (
    (data ?? []) as { id: string; name: string; color_hue: number; sort: number; active: boolean }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    colorHue: c.color_hue,
    sort: c.sort,
    active: c.active,
  }));
}

/**
 * Seçilebilir iş kalemleri.
 *
 * Defterdeki kalemlere ek olarak KAYITLARDA GEÇEN ama defterde karşılığı
 * olmayan numaralar da listelenir (`orphan`). Aksi hâlde 0020-00'a saat yazan
 * kullanıcı ertesi gün aynı numarayı seçemez, elle yazmak zorunda kalırdı —
 * ve elle yazılan her numara yeni bir yazım hatası riskidir.
 */
export async function loadJobOptions(supabase: SupabaseClient): Promise<WorkJobOption[]> {
  const [{ data: items }, { data: orphanRows }] = await Promise.all([
    supabase
      .from("job_items")
      .select(
        `id, item_no, product_name,
         jobs!inner(id, job_no, customer, customers(short_name, color_hue))`
      )
      .order("item_no", { ascending: false }),
    supabase.from("work_logs").select("item_no").is("job_item_id", null),
  ]);

  const options: WorkJobOption[] = (
    (items ?? []) as unknown as {
      id: string;
      item_no: string;
      product_name: string;
      jobs: JobJoin | JobJoin[] | null;
    }[]
  ).map((it) => {
    const job = one<JobJoin>(it.jobs);
    const book = one<CustomerJoin>(job?.customers);
    return {
      jobItemId: it.id,
      jobId: job?.id ?? null,
      itemNo: it.item_no || "",
      jobNo: job?.job_no ?? "",
      productName: it.product_name || "",
      customer: job?.customer ?? "",
      customerShort: book?.short_name ?? null,
      customerHue: book?.color_hue ?? null,
      orphan: false,
    };
  });

  const known = new Set(options.map((o) => o.itemNo));
  const orphans = new Set<string>();
  for (const r of (orphanRows ?? []) as { item_no: string }[]) {
    const no = (r.item_no ?? "").trim();
    if (no && !known.has(no)) orphans.add(no);
  }
  for (const no of [...orphans].sort((a, b) => b.localeCompare(a, "tr", { numeric: true }))) {
    options.push({
      jobItemId: null,
      jobId: null,
      itemNo: no,
      jobNo: no.slice(0, 4),
      productName: "",
      customer: "",
      customerShort: null,
      customerHue: null,
      orphan: true,
    });
  }
  return options;
}

/**
 * Son N günde kullanılmış (kalem · parça · tür) üçlüleri — günlük girişteki
 * "tek tıkla ekle" şeridinin kaynağı.
 *
 * Devralınan veride bir günün satırlarının %87'si bir önceki iş gününden
 * DEVAM EDİYOR; kullanıcının yaptığı iş aslında "aynı satırları tekrar yaz"
 * oluyordu. Bu liste o tekrarı tek tıka indirir ve son kullanılan kişi/saat
 * değerlerini de taşır.
 */
export interface RecentCombo {
  itemNo: string;
  jobItemId: string | null;
  jobId: string | null;
  partId: string;
  partName: string;
  categoryId: string;
  categoryName: string;
  categoryHue: number;
  partCode: string;
  people: number;
  hours: number;
  lastDate: string;
  uses: number;
}

export async function loadRecentCombos(
  supabase: SupabaseClient,
  since: string,
  limit = 14
): Promise<RecentCombo[]> {
  const { data } = await supabase
    .from("work_logs")
    .select(
      `work_date, item_no, part_code, people, hours, job_id, job_item_id,
       work_parts(id, name),
       work_categories(id, name, color_hue)`
    )
    .gte("work_date", since)
    .order("work_date", { ascending: false })
    .limit(PAGE);

  const map = new Map<string, RecentCombo>();
  for (const r of (data ?? []) as unknown as LogRecord[]) {
    const part = one(r.work_parts);
    const cat = one(r.work_categories);
    if (!part || !cat) continue;
    const key = `${r.item_no}|${part.id}|${cat.id}`;
    const cur = map.get(key);
    if (cur) {
      cur.uses += 1;
      continue;
    }
    // İlk görülen kayıt EN YENİsidir (sorgu tarihe göre azalan): kişi ve saat
    // değerleri oradan alınır, kullanıcı çoğu gün aynısını girer.
    map.set(key, {
      itemNo: r.item_no ?? "",
      jobItemId: r.job_item_id,
      jobId: r.job_id,
      partId: part.id,
      partName: part.name,
      categoryId: cat.id,
      categoryName: cat.name,
      categoryHue: cat.color_hue,
      partCode: r.part_code ?? "",
      people: Number(r.people) || 1,
      hours: num(r.hours) || 8,
      lastDate: r.work_date,
      uses: 1,
    });
  }
  return [...map.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.uses - a.uses)
    .slice(0, limit);
}

/**
 * (kalem · parça) → en son kullanılan grup kodu.
 *
 * Grup kodu işe göre değişen bir çizim kodudur; kullanıcı her satırda yeniden
 * hatırlamak zorunda kalmamalı. Aynı kalem ve parça daha önce hangi kodla
 * yazıldıysa yeni satıra o kod ÖNERİLİR (değiştirilebilir).
 */
export async function loadCodeHints(
  supabase: SupabaseClient
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let page = 0; page < 40; page++) {
    const { data, error } = await supabase
      .from("work_logs")
      .select("item_no, part_id, part_code, work_date")
      .neq("part_code", "")
      .order("work_date", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    for (const r of data as { item_no: string; part_id: string; part_code: string }[]) {
      const key = `${r.item_no}|${r.part_id}`;
      // Sorgu tarihe göre azalan: ilk görülen EN YENİ kullanımdır.
      if (!(key in out)) out[key] = r.part_code;
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/** Gün başına adam·saat — giriş ekranındaki "son günler" şeridi. */
export async function loadDailyTotals(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("work_logs")
    .select("work_date, man_hours")
    .gte("work_date", from)
    .lte("work_date", to)
    .limit(PAGE);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { work_date: string; man_hours: number | string }[]) {
    out[r.work_date] = (out[r.work_date] ?? 0) + num(r.man_hours);
  }
  return out;
}

/** Kayıt bulunan en eski ve en yeni gün — süzgeç sınırları ve boş durum için. */
export async function loadDateBounds(
  supabase: SupabaseClient
): Promise<{ first: string; last: string } | null> {
  const [{ data: firstRow }, { data: lastRow }] = await Promise.all([
    supabase.from("work_logs").select("work_date").order("work_date").limit(1).maybeSingle(),
    supabase
      .from("work_logs")
      .select("work_date")
      .order("work_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const first = (firstRow as { work_date: string } | null)?.work_date;
  const last = (lastRow as { work_date: string } | null)?.work_date;
  return first && last ? { first, last } : null;
}
