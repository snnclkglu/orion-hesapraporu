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
import { SON_12_AY, type JobSort, type JobSortKey } from "./view-state";

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

/** İşin tarihi (`YYYY-MM-DD`): iş emri tarihi, yoksa kayıt tarihi. */
export function jobDate(
  job: Pick<JobListRow, "work_order_date" | "created_at">
): string {
  return (job.work_order_date || job.created_at || "").slice(0, 10);
}

/**
 * KAYAN 12 AYLIK PENCERENİN alt sınırı: bugünden tam 12 ay öncesi.
 *
 * Hesap UTC'dedir ve ayın sonuna kelepçelenir (`tarihEkle` ile aynı gerekçe):
 * 31 Mart'ta pencere 31 Şubat'tan değil 28/29 Şubat'tan başlar.
 *
 * ÜST SINIR YOKTUR ve bu bilinçlidir: iş emri tarihi ileri bir güne yazılmış
 * bir kayıt (peşin açılan iş) pencereden düşmemelidir — "geçmiş 12 ay" bir
 * BAŞLANGIÇ noktasıdır, bir hapis değil.
 */
export function son12AyBaslangici(bugun: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bugun ?? "");
  if (!m) return "";
  const yil = Number(m[1]) - 1;
  const ay = Number(m[2]) - 1;
  const gun = Number(m[3]);
  const sonGun = new Date(Date.UTC(yil, ay + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(yil, ay, Math.min(gun, sonGun)));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** ISO tarih → "gg.aa.yyyy"; boş değer "—". Tablo ve Excel aynı biçimi basar. */
export function fmtJobDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export interface JobFilterInput {
  /** ÇÖZÜLMÜŞ dönem: "tumu" · "son12" · "2026" (`resolveYear`dan geçmiş hâli). */
  yil: string;
  musteri: readonly string[];
  durum: readonly string[];
  q: string;
  /**
   * "Bugün" (`YYYY-MM-DD`) — YALNIZ `son12` penceresi için gerekir.
   *
   * Parametredir, `new Date()` DEĞİL: çekirdek saftır (md. 7) ve ekran ile
   * Excel ucu aynı günü kullanmak zorundadır. Verilmezse `son12` süzmez —
   * sessizce boş liste üretmektense hepsini göstermek doğrudur.
   */
  bugun?: string;
}

export function matchesJobFilters(job: JobListRow, f: JobFilterInput): boolean {
  if (f.yil === SON_12_AY) {
    const alt = f.bugun ? son12AyBaslangici(f.bugun) : "";
    const t = jobDate(job);
    if (alt && (!t || t < alt)) return false;
  } else if (f.yil !== "tumu" && jobYear(job) !== f.yil) return false;
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

/** Dönem jetonunun ekran adı — süzgeç, Excel künyesi ve başlık aynı sözü söyler. */
export function donemAdi(yil: string): string {
  if (yil === "tumu") return "Tüm Yıllar";
  if (yil === SON_12_AY) return "Son 12 Ay";
  return yil;
}

/** Excel künyesine basılan süzgeç özeti — dosya neyin dökümü, ada bakan bilsin. */
export function describeJobFilters(f: JobFilterInput): string {
  const parts: string[] = [donemAdi(f.yil)];
  if (f.musteri.length > 0) parts.push(f.musteri.join(", "));
  if (f.durum.length > 0)
    parts.push(f.durum.map((s) => JOB_STATUS_LABELS[jobStatusOf(s)]).join(", "));
  if (f.q.trim()) parts.push(`Arama: "${f.q.trim()}"`);
  return parts.join(" · ");
}
