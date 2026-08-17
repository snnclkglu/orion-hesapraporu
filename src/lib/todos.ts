// KİŞİSEL YAPILACAKLAR — saf çekirdek (veritabanı bilmez, "bugün" çağırandan
// gelir; lib/panel.ts ile aynı gerekçe: sunucuda ve istemcide aynı girdi aynı
// çıktıyı vermelidir).

import { gunFarki, type PanelDate } from "@/lib/panel";

export interface TodoRow {
  id: string;
  title: string;
  note: string;
  /** "YYYY-MM-DD" ya da null (tarihsiz) */
  dueDate: string | null;
  /** ISO zaman damgası — durum budur, ayrıca bir enum yoktur */
  doneAt: string | null;
  sort: number;
}

const TARIHSIZ = "9999-12-31";

/**
 * AÇIK maddelerin sırası: tarihliler tarih sırasıyla önce (geciken doğal
 * olarak en üstte — dünün tarihi bugünden küçüktür), tarihsizler `sort`
 * sırasıyla sonda. Bir puanlama değil ÜÇ BASAMAKLI bir kural: tarih → sort →
 * ad (kararlılık için).
 */
export function todoSirala(rows: readonly TodoRow[]): TodoRow[] {
  return rows
    .filter((r) => !r.doneAt)
    .sort(
      (a, b) =>
        (a.dueDate ?? TARIHSIZ).localeCompare(b.dueDate ?? TARIHSIZ) ||
        a.sort - b.sort ||
        a.title.localeCompare(b.title, "tr")
    );
}

/**
 * Son `gunSayisi` günde TAMAMLANANLAR, yeniden eskiye. Varsayılan yedi gün:
 * "dün bitirdiğimi yanlışlıkla mı kapattım" sorusuna yetecek kadar geriye
 * bakılır; arşiv tutulmaz (madde kişiseldir, defter değildir).
 */
export function todoTamamlanan(
  rows: readonly TodoRow[],
  bugun: string,
  gunSayisi = 7
): TodoRow[] {
  return rows
    .filter((r) => {
      if (!r.doneAt) return false;
      const fark = gunFarki(bugun, r.doneAt.slice(0, 10));
      return Number.isFinite(fark) && fark >= -gunSayisi && fark <= 0;
    })
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
}

/**
 * Vadeli AÇIK maddeler ajanda diline çevrilir (Faz 5 — birleşik ajanda).
 * `href` panele döner: madde panelin kendi bölümünde yaşar, ayrı sayfası
 * yoktur.
 */
export function todoAjandaTarihleri(rows: readonly TodoRow[]): PanelDate[] {
  return rows
    .filter((r) => !r.doneAt && !!r.dueDate)
    .map((r) => ({
      date: r.dueDate as string,
      kind: "Yapılacak",
      label: r.title,
      href: "/",
    }));
}
