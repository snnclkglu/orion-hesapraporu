// Teknik Resimler — ekranların paylaştığı etiketler ve biçimleyiciler.
//
// Sunum katmanında durur, çekirdeğe girmez: `reconcile.ts` saf kalmalı ve
// hiçbir Türkçe etiket bilmemeli.

import type { DwgPackageStatus } from "./types";
import { FINDING_KIND_LABELS, type FindingKind } from "./types";

export const PACKAGE_STATUS_LABELS: Record<DwgPackageStatus, string> = {
  yukleniyor: "Yükleniyor",
  yuklendi: "Yüklendi",
  aktif: "Aktif",
  superse: "Süperse",
};

/** Bulgu düzeyinin rapordaki bölüm başlığı ve sırası. */
export const FINDING_SECTIONS: { kind: FindingKind; title: string; hint: string }[] = [
  {
    kind: "eksik",
    title: "Eksikler",
    hint: "Bir şey yok ve muhtemelen olmalıydı — insanın bakması gereken yer burası.",
  },
  {
    kind: "celiski",
    title: "Çelişkiler",
    hint: "İki kaynak farklı söylüyor. Hangisinin esas alındığı her satırda yazıyor.",
  },
  {
    kind: "bilgi",
    title: "Bilgi",
    hint: "Sistem böyle yorumladı. Sorun değil, kayda geçsin diye duruyor.",
  },
];

export { FINDING_KIND_LABELS };

/** Bulgu düzeyinin çip rengi — kırmızı YALNIZ eksikte; çelişki uyarı tonudur. */
export function findingChipClass(kind: FindingKind): string {
  if (kind === "eksik") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (kind === "celiski") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-border bg-muted text-muted-foreground";
}

/** 200000000 → "191 MB" */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const birimler = ["B", "KB", "MB", "GB"];
  const i = Math.min(birimler.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const deger = bytes / 1024 ** i;
  return `${deger.toLocaleString("tr-TR", { maximumFractionDigits: deger < 10 && i > 0 ? 1 : 0 })} ${birimler[i]}`;
}

/** tr-TR sayı; null ise tire. */
export function formatNum(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

/**
 * Tanıma oranının rengi.
 *
 * Kırmızı YOKTUR ve bu bilinçlidir: düşük tanıma oranı ressamın hatası değil
 * sistemin sınırıdır. En kötü hâlde "sarı" olur — "kırmızı" bir suçlamadır ve
 * bu modülde suçlama yoktur.
 */
export function recognitionClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 95) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 75) return "text-foreground";
  return "text-amber-600 dark:text-amber-400";
}
