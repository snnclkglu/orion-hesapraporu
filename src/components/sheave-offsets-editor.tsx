"use client";

// Kanca bloğu mili — makara ekseni ölçü düzenleyicisi.
//
// Mil, iki askı sacı arasında simetrik bir kirişti; makaralar merkezin iki
// yanına eşit dağılır (sağ ve sol AYNADIR). Eskiden bütün eksenler tek bir
// serbest metin kutusuna ("75; 175; 275") noktalı virgülle yazılıyordu:
// makara adedi kutuya girilen ölçü sayısından fazlaysa, ölçüsü olmayan makara
// sessizce MERKEZE (offset 0) düşüyor ve mil şeması yanlış çiziliyordu.
//
// Bu düzenleyici, bir taraftaki makara adedince ADLI kutu (M1…Mn) çizer:
// makara sayısı arttıkça kutu sayısı da artar, her makaranın kendi ölçü yeri
// olur. M1 merkeze en yakın, Mn en dıştaki makaradır. Değer, modülün
// `shaftSheaveOffsetsText` girdisine küçükten büyüğe noktalı virgülle yazılır
// (hesap motoru aynı biçimi okur).

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SheaveOffsetsEditorProps {
  /** Kanca bloğundaki ETKİN toplam makara adedi (hesaptan; otomatik/elle). */
  sheaveCount: number;
  /** Mevcut değer — merkezden bir taraftaki eksenler, ";" ayrımlı [mm]. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const fmt = (v: number): string =>
  Number.isFinite(v) && v > 0 ? String(Math.round(v)) : "";

/**
 * Ham metni bir taraftaki `sideCount` yuvaya konumsal olarak açar. Sıralamaz:
 * kutular yazım sırasında yerinden oynamasın (hesap motoru kendi tarafında
 * küçükten büyüğe sıralar). Eksik yuva boş kalır.
 */
function slotsFromText(text: string, sideCount: number): number[] {
  const parts = String(text ?? "")
    .split(/[;|]+/)
    .map((p) => Number(p.trim().replace(",", ".")));
  return Array.from({ length: sideCount }, (_, i) =>
    Number.isFinite(parts[i]) && parts[i] > 0 ? parts[i] : NaN
  );
}

export function SheaveOffsetsEditor({
  sheaveCount,
  value,
  onChange,
  disabled,
}: SheaveOffsetsEditorProps) {
  const total = Math.max(1, Math.round(Number.isFinite(sheaveCount) ? sheaveCount : 1));
  // Bir tarafta floor(n/2) makara vardır; tek sayıda makarada biri merkezde
  // durur ve ölçü GEREKTİRMEZ (offset sıfır) — o yüzden kutusu yoktur.
  const sideCount = Math.floor(total / 2);
  const hasCenter = total % 2 === 1;
  const slots = slotsFromText(value, sideCount);

  // Yazım sırasındaki ham metin yerelde tutulur; state'e yalnız geçerli sayı
  // yazılır (WheelSpacingEditor ile aynı ilke — kutuyu boşaltmak değeri
  // sessizce sıfırlamasın).
  const [draft, setDraft] = useState<Record<number, string>>({});
  const lastSent = useRef(value);
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setDraft({});
    }
  }, [value]);

  const commit = (index: number, raw: string) => {
    setDraft((d) => ({ ...d, [index]: raw }));
    const next = [...slots];
    const n = Number(raw.trim().replace(",", "."));
    next[index] = Number.isFinite(n) && n > 0 ? n : NaN;
    // Yalnız GEÇERLİ (girilmiş) ölçüler yazılır; boş kutular metinden düşer.
    const text = next.filter((v) => Number.isFinite(v) && v > 0).map(fmt).join("; ");
    lastSent.current = text;
    onChange(text);
  };

  const clearDraft = (index: number) =>
    setDraft((d) =>
      Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== index))
    );

  const filled = slots.filter((v) => Number.isFinite(v) && v > 0).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="oc-kicker text-muted-foreground">Makara Ekseni Ölçüleri</h3>
        <span className="text-xs text-muted-foreground">
          {total} makara · bir tarafta {sideCount}
          {hasCenter ? " + merkezde 1" : ""} · karşı taraf aynadır
        </span>
      </div>

      {sideCount === 0 ? (
        <p className="border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Tek makara merkezdedir; eksen ölçüsü gerekmez.
        </p>
      ) : (
        <div className="grid gap-2 border bg-card/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slotValue, i) => {
            const fieldId = `sheave-offset-${i}`;
            return (
              <div key={i} className="flex items-center justify-between gap-2 sm:justify-start">
                <label
                  htmlFor={fieldId}
                  className={cn(
                    "flex min-w-0 flex-col leading-tight",
                    "text-xs text-muted-foreground"
                  )}
                >
                  <span className="font-mono text-sm font-semibold text-foreground">
                    M{i + 1}
                  </span>
                  <span>merkez → eksen</span>
                </label>
                <span className="flex shrink-0 items-center gap-1.5">
                  <input
                    id={fieldId}
                    inputMode="decimal"
                    disabled={disabled}
                    value={draft[i] ?? fmt(slotValue)}
                    placeholder="—"
                    onChange={(e) => commit(i, e.target.value)}
                    onBlur={() => clearDraft(i)}
                    className={cn(
                      "h-9 w-24 border bg-background px-2 text-center font-mono text-base tabular-nums",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "pointer-coarse:h-10 pointer-fine:text-sm",
                      disabled && "opacity-60"
                    )}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">mm</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Her ölçü, mil MERKEZİNDEN o makara eksenine olan uzaklıktır (
        <span className="font-mono">M1</span> merkeze en yakın,{" "}
        <span className="font-mono">M{Math.max(1, sideCount)}</span> en dıştaki
        makara). Sağ ve sol taraf simetrik aynalanır; yalnız bir taraf girilir.
        Makara adedi <span className="font-mono">Makaralar</span> bölümünden
        değişir — {filled}/{sideCount} ölçü girildi.
      </p>
    </div>
  );
}
