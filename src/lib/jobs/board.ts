// Pano gruplaması — SAF çekirdek.
//
// Pano yeni bir "aşama" alanı AÇMAZ (kullanıcı kararı, 16.08.2026): sütun
// boyutu var olan alanlardan türetilir. Sürükleme yalnız DURUM
// gruplamasında anlamlıdır — öteki boyutlarda kartın sütunu bir olgunun
// (müşteri, lider, yıl) sonucudur ve sürükleyerek değiştirilemez.

import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  jobStatusOf,
} from "@/lib/job-status";
import { customerTag } from "@/lib/tags";
import { jobYear, type JobListRow } from "./filter";
import type { JobGroup } from "./view-state";

export interface BoardRowLike extends JobListRow {
  id: string;
  jobLeader?: string | null;
}

export interface BoardColumn<T extends BoardRowLike> {
  key: string;
  label: string;
  rows: T[];
}

const ATANMAMIS = "Atanmamış";

/**
 * Satırları sütunlara böler.
 *
 * DURUM: dört sütun ENUM SIRASIYLA her zaman görünür — boş "Pasif" sütunu
 * bir bilgi taşır (oraya kart bırakılabilir). Öteki boyutlarda boş grup
 * DÜŞER (sıfır sayan sinyal kuralı) ve sürükleme kapalıdır.
 */
export function boardGroups<T extends BoardRowLike>(
  rows: readonly T[],
  grup: JobGroup
): BoardColumn<T>[] {
  if (grup === "durum") {
    return JOB_STATUSES.map((s) => ({
      key: s,
      label: JOB_STATUS_LABELS[s],
      rows: rows.filter((r) => jobStatusOf(r.status) === s),
    }));
  }

  const kova = new Map<string, { label: string; rows: T[] }>();
  for (const r of rows) {
    let key: string;
    let label: string;
    if (grup === "musteri") {
      label = customerTag({ name: r.customer, shortName: r.customerShort }).short;
      key = r.customer.trim() || label;
    } else if (grup === "lider") {
      label = (r.jobLeader ?? "").trim() || ATANMAMIS;
      key = label;
    } else {
      label = jobYear(r) || "Tarihsiz";
      key = label;
    }
    const mevcut = kova.get(key);
    if (mevcut) mevcut.rows.push(r);
    else kova.set(key, { label, rows: [r] });
  }

  const out = [...kova.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    rows: v.rows,
  }));
  // Yıl büyükten küçüğe (en yeni solda), diğerleri ada göre; "Atanmamış" ve
  // "Tarihsiz" torbaları her zaman EN SONDA — adsızlık bir sıra kazanmaz.
  out.sort((a, b) => {
    const aTorba = a.label === ATANMAMIS || a.label === "Tarihsiz";
    const bTorba = b.label === ATANMAMIS || b.label === "Tarihsiz";
    if (aTorba !== bTorba) return aTorba ? 1 : -1;
    return grup === "yil"
      ? b.label.localeCompare(a.label, "tr", { numeric: true })
      : a.label.localeCompare(b.label, "tr");
  });
  return out;
}

/** Sürükleme yalnız durum panosunda: bırakma = setJobStatus. */
export function isDragEnabled(grup: JobGroup): boolean {
  return grup === "durum";
}
