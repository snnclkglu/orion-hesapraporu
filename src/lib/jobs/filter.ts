// İşler süzgeci — ekran ile Excel çıktısının ORTAK saf çekirdeği.
//
// İş Takibi'nin dersi (worklog/filters.ts): süzgeç iki yerde ayrı yazılırsa
// indirilen dosya ile ekrandaki tablo sessizce ayrışır. Tablo bileşeni ve
// /jobs/export ucu bu dosyadaki AYNI fonksiyonları çağırır.
//
// EŞLEŞME `trKatla` İLEDİR, `toLowerCase` DEĞİL (açılış panosu kuralı):
// adlar BÜYÜK saklanır, kullanıcı küçük yazar ve düz küçültme Türkçe'nin
// noktalı/noktasız i ayrımını çözemez — "isdemir" yazan "İSDEMİR"i bulmalı.
// Sorgu boşluklardan bölünür ve HER parça satırın birleşik metninde geçmek
// zorundadır ("astor pergel" iki alandan birleşerek bulunur).

import { trKatla } from "@/lib/drawings/tr-text";
import { JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";
import { customerTag } from "@/lib/tags";
import type { JobSort, JobSortKey } from "./view-state";

/** Liste satırının süzgeç/sıralama/çıktı için gereken çekirdeği. */
export interface JobListRow {
  job_no: string;
  title: string;
  /** İş emrindeki resmî unvan (basıldığı andaki fotoğraf). */
  customer: string;
  /** Müşteri defterindeki kısaltma — listelerde bu görünür. */
  customerShort?: string | null;
  status: string;
  work_order_date: string | null;
  created_at: string;
  itemCount: number;
  craneCount: number;
}

/** İşin ait olduğu yıl: iş emri tarihi varsa o, yoksa kayıt tarihi. */
export function jobYear(
  job: Pick<JobListRow, "work_order_date" | "created_at">
): string {
  const src = job.work_order_date || job.created_at;
  return /^(\d{4})/.exec(src ?? "")?.[1] ?? "";
}

/** ISO tarih → "gg.aa.yyyy"; boş değer "—". Tablo ve Excel aynı biçimi basar. */
export function fmtJobDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export interface JobFilterInput {
  /** ÇÖZÜLMÜŞ yıl: "tumu" ya da "2026" (`resolveYear`dan geçmiş hâli). */
  yil: string;
  musteri: readonly string[];
  durum: readonly string[];
  q: string;
}

export function matchesJobFilters(job: JobListRow, f: JobFilterInput): boolean {
  if (f.yil !== "tumu" && jobYear(job) !== f.yil) return false;
  if (f.musteri.length > 0 && !f.musteri.includes(job.customer.trim()))
    return false;
  if (f.durum.length > 0 && !f.durum.includes(jobStatusOf(job.status)))
    return false;
  const query = f.q.trim();
  if (query) {
    // Arama hem kısaltmayı hem tam unvanı tarar: kullanıcı ekranda gördüğü
    // "İSDEMİR"i de defterdeki resmî adı da yazabilmelidir.
    const hay = trKatla(
      [job.job_no, job.title, job.customer, job.customerShort ?? ""].join(" ")
    );
    for (const token of trKatla(query).split(/\s+/)) {
      if (!hay.includes(token)) return false;
    }
  }
  return true;
}

/**
 * Sıralama anahtarları. Sayısal alanlar SAYI, metinler tr-TR sıralamasıyla
 * karşılaştırılır ("İ" ve "ı" doğru yere düşsün diye `localeCompare`).
 * Müşteri GÖRÜNEN ada göre sıralanır: sütun kısaltmayı gösterirken tam
 * unvana göre sıralamak listeyi rastgele dizilmiş gibi gösterirdi.
 */
const SORT_VALUE: Record<JobSortKey, (j: JobListRow) => string | number> = {
  job_no: (j) => j.job_no,
  title: (j) => j.title,
  customer: (j) =>
    customerTag({ name: j.customer, shortName: j.customerShort }).short,
  itemCount: (j) => j.itemCount,
  craneCount: (j) => j.craneCount,
  date: (j) => j.work_order_date || j.created_at,
  status: (j) => JOB_STATUS_LABELS[jobStatusOf(j.status)],
};

export function compareJobs(
  a: JobListRow,
  b: JobListRow,
  key: JobSortKey
): number {
  const va = SORT_VALUE[key](a);
  const vb = SORT_VALUE[key](b);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb), "tr", { numeric: true });
}

export function sortJobs<T extends JobListRow>(
  rows: readonly T[],
  sort: JobSort
): T[] {
  const sign = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => sign * compareJobs(a, b, sort.key));
}

/**
 * Sütunun DOĞAL ilk yönü: numara/tarih/sayı büyükten küçüğe, metin A'dan
 * Z'ye. Her sütunda "önce artan" davranışı tarih listelerinde ters
 * hissettiriyordu.
 */
export function naturalDesc(key: JobSortKey): boolean {
  return !(key === "title" || key === "customer" || key === "status");
}

/** Excel künyesine basılan süzgeç özeti — dosya neyin dökümü, ada bakan bilsin. */
export function describeJobFilters(f: JobFilterInput): string {
  const parts: string[] = [f.yil === "tumu" ? "Tüm Yıllar" : f.yil];
  if (f.musteri.length > 0) parts.push(f.musteri.join(", "));
  if (f.durum.length > 0)
    parts.push(f.durum.map((s) => JOB_STATUS_LABELS[jobStatusOf(s)]).join(", "));
  if (f.q.trim()) parts.push(`Arama: "${f.q.trim()}"`);
  return parts.join(" · ");
}
