"use client";

// MALİYET EDİTÖRÜNÜN ORTAK PARÇALARI.
//
// Teklif editöründeki `Bolum`, `MiniDugme` ve `sayiVeyaNull` ile aynı işi
// yapan kardeşleri burada durur. Ortak bir dosyaya çekilmediler çünkü
// teklifinkiler o dosyanın YEREL parçaları; buraya taşımak teklif editöründe
// bir düzenleme yaparken maliyet ekranını da kırma riski demekti. Aynı şekil,
// ayrı sahip.

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Boş kutu `null` üretir, `0` DEĞİL (SATIS-16). */
export function sayiVeyaNull(raw: string): number | null {
  const s = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Sayıyı kutuya yazarken tr-TR ondalık ayracı korunur ("19,5"). */
export function kutuMetni(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(v).replace(".", ",");
}

export function Bolum({
  baslik,
  aciklama,
  sag,
  children,
}: {
  baslik: string;
  aciklama?: string;
  /** Başlığın sağındaki eylem ya da özet. */
  sag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-wide">{baslik}</h2>
          {aciklama ? <p className="text-xs text-muted-foreground">{aciklama}</p> : null}
        </div>
        {sag}
      </header>
      {children}
    </section>
  );
}

export function MiniDugme({
  children,
  baslik,
  aktif,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  baslik: string;
  aktif?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={baslik}
      aria-label={baslik}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "oc-tap-square inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        aktif && "bg-muted font-medium text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** Etiketli sayı kutusu — girdi bölümlerinin tek şekli. */
export function SayiAlani({
  etiket,
  birim,
  value,
  onChange,
  ipucu,
  genislik = "9rem",
}: {
  etiket: string;
  birim?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  ipucu?: string;
  genislik?: string;
}) {
  const id = `alan-${etiket.replace(/\s+/g, "-")}`;
  return (
    <div className="grid gap-1.5" style={{ width: genislik }}>
      <Label htmlFor={id} className="text-xs">
        {etiket}
        {birim ? <span className="ml-1 text-muted-foreground">[{birim}]</span> : null}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={kutuMetni(value)}
        onChange={(e) => onChange(sayiVeyaNull(e.target.value))}
        className="h-9 text-base pointer-fine:text-sm"
      />
      {ipucu ? <p className="text-[11px] text-muted-foreground">{ipucu}</p> : null}
    </div>
  );
}

/** Açık/kapalı seçici — kabin, elektrik odası gibi VAR/YOK kararları. */
export function Anahtar({
  etiket,
  value,
  onChange,
}: {
  etiket: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "oc-tap inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        value ? "border-primary bg-muted font-medium" : "text-muted-foreground hover:bg-muted"
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", value ? "bg-primary" : "bg-muted-foreground/40")}
      />
      {etiket}
    </button>
  );
}
