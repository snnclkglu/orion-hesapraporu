"use client";

// Satın Alma panolarının ORTAK sunum parçaları.
//
// Üç ekran (Siparişler · Teslim Takvimi · Ödeme Takvimi) aynı üç kabuğu
// kullanıyor: grafik kartı, ay/hafta seçici ve dönem bandı. Üç yerde ayrı
// yazılsaydı biri er geç farklı bir kenar rengi ya da farklı bir başlık
// hizası taşırdı — pano ekranlarında tutarsızlık, veriye duyulan güveni
// doğrudan düşürür.

import { cn } from "@/lib/utils";
import type { Kip } from "@/lib/purchasing/summary";

/** Grafik kartı — başlık + sağda özet + isteğe bağlı denetim. */
export function PanoKabugu({
  baslik,
  alt,
  eylem,
  className,
  children,
}: {
  baslik: string;
  alt?: string;
  eylem?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 border bg-card", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h2 className="text-sm font-medium">{baslik}</h2>
        <span className="flex items-center gap-2">
          {alt && <span className="font-mono text-[11px] text-muted-foreground">{alt}</span>}
          {eylem}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Aylık / haftalık kipi — üç ekranda aynı düğme çifti. */
export function KipSecici({ kip, onChange }: { kip: Kip; onChange: (k: Kip) => void }) {
  return (
    <span className="flex items-center gap-1">
      <KipDugmesi etkin={kip === "ay"} onClick={() => onChange("ay")}>
        Aylık
      </KipDugmesi>
      <KipDugmesi etkin={kip === "hafta"} onClick={() => onChange("hafta")}>
        Haftalık
      </KipDugmesi>
    </span>
  );
}

export function KipDugmesi({
  etkin,
  onClick,
  children,
}: {
  etkin: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={etkin}
      className={cn(
        "min-h-8 border px-2 text-[12px] transition-colors pointer-coarse:min-h-10",
        etkin
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Dönem bandı — ay/hafta kutusu ya da "gecikmiş" / "tarihsiz" uyarı bandı.
 *
 * ÜÇ RENK, ÜÇ ANLAM: kırmızı GEÇMİŞ (bugünün sorunu), sarı BELİRSİZ (girilmemiş
 * tarih), nötr PLANLI. Renk bir durum ölçüsüdür; her bandı renklendirmek rengi
 * anlamsız yapardı.
 */
export function Bant({
  baslik,
  alt,
  renk = "normal",
  children,
}: {
  baslik: string;
  alt: string;
  renk?: "normal" | "kirmizi" | "sari";
  children: React.ReactNode;
}) {
  const kenar =
    renk === "kirmizi"
      ? "border-destructive/40"
      : renk === "sari"
        ? "border-amber-500/40"
        : "border-border";
  const zemin =
    renk === "kirmizi"
      ? "bg-destructive/[0.06]"
      : renk === "sari"
        ? "bg-amber-500/[0.08]"
        : "bg-muted/50";
  return (
    <section className={cn("border bg-card", kenar)}>
      <div className={cn("flex flex-wrap items-baseline justify-between gap-2 px-3 py-2", zemin)}>
        <h2 className="text-sm font-medium">{baslik}</h2>
        <p className="font-mono text-[11px] text-muted-foreground">{alt}</p>
      </div>
      <ul>{children}</ul>
    </section>
  );
}
