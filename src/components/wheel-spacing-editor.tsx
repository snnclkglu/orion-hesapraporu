"use client";

// Teker düzeni görsel düzenleyicisi.
//
// Vinç DÖRT KÖŞESİNDE eşit sayıda tekerle yürür: toplam teker adedi dördün
// katıdır, bir rayda toplam/2, bir köşede toplam/4 teker bulunur. İki ray
// birbirinin aynısıdır — bu yüzden geometri BİR RAY için girilir.
//
// Düzenleyici, rayı üstten gösterir: tekerler kodlarıyla (A1…Ak, B1…Bk) çizilir,
// ardışık iki teker arasına o mesafenin sayı kutusu konur. Teknik resimdeki
// ölçü zincirinin birebir karşılığıdır; mühendis kotları resimden okuyup
// doğrudan buraya yazar.
//
// Değer, modülün `wheelSpacingsText` girdisine virgülle ayrılmış olarak yazılır.

import { useEffect, useRef, useState } from "react";
import {
  resolveWheelSpacings,
  wheelCodes,
} from "@/lib/calc/modules/wheelLoads";
import { cn } from "@/lib/utils";

export interface WheelSpacingEditorProps {
  /** Vincin toplam teker adedi (köprü yürütme bölümünden) */
  totalWheels: number;
  /** Mevcut değer — virgülle ayrılmış mesafeler [mm] */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const fmt = (v: number): string =>
  Number.isFinite(v) ? String(Math.round(v)) : "";

export function WheelSpacingEditor({
  totalWheels,
  value,
  onChange,
  disabled,
}: WheelSpacingEditorProps) {
  const perSide = Math.max(1, Math.round(totalWheels / 2));
  const perCorner = Math.max(1, Math.round(totalWheels / 4));
  const codes = wheelCodes(perSide);
  const spacings = resolveWheelSpacings(value, perSide);

  // Yazım sırasındaki ham metin yerelde tutulur; state'e yalnız geçerli sayı
  // yazılır. Böylece kutuyu boşaltmak değeri sessizce 0 yapmaz.
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
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const next = [...spacings];
    next[index] = n;
    const text = next.map(fmt).join(", ");
    lastSent.current = text;
    onChange(text);
  };

  const wheelbase = spacings.reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="oc-kicker text-muted-foreground">Teker Düzeni</h3>
        <span className="text-xs text-muted-foreground">
          {totalWheels} teker · her köşede {perCorner} · her rayda {perSide}
        </span>
      </div>

      <div className="overflow-x-auto border bg-card/40 p-4">
        <div className="min-w-max">
          {/* Yürüme yönü */}
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>yürüme yönü</span>
            <span aria-hidden className="font-mono">
              →
            </span>
          </div>

          {/* Teker sırası + aralarındaki ölçü kutuları */}
          <div className="flex items-end">
            {codes.map((code, i) => (
              <div key={code} className="flex items-end">
                <div className="flex w-16 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background font-mono text-[11px] font-semibold",
                      i < perCorner
                        ? "border-primary/60 text-primary"
                        : "border-foreground/50 text-foreground"
                    )}
                  >
                    {code}
                  </div>
                  {/* Ray ekseni tiki */}
                  <div className="h-3 w-px bg-foreground/40" />
                </div>
                {i < codes.length - 1 && (
                  <div className="flex w-28 flex-col items-center gap-1 pb-4">
                    <label className="sr-only" htmlFor={`gap-${i}`}>
                      {code} – {codes[i + 1]} mesafesi
                    </label>
                    <input
                      id={`gap-${i}`}
                      inputMode="decimal"
                      disabled={disabled}
                      value={draft[i] ?? fmt(spacings[i])}
                      onChange={(e) => commit(i, e.target.value)}
                      onBlur={() =>
                        // Odak çıkınca taslak temizlenir; alan yeniden çözülmüş
                        // (geçerli) değeri gösterir.
                        setDraft((d) =>
                          Object.fromEntries(
                            Object.entries(d).filter(([k]) => Number(k) !== i)
                          )
                        )
                      }
                      className={cn(
                        "h-7 w-24 border bg-background px-2 text-center font-mono text-xs tabular-nums",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        disabled && "opacity-60"
                      )}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {code}–{codes[i + 1]}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ray çizgisi */}
          <div className="relative -mt-4 mb-1 h-px bg-foreground/50" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>RAY 1 — karşı ray (RAY 2) aynıdır</span>
            <span className="font-mono">
              dingil mesafesi = {wheelbase.toLocaleString("tr-TR")} mm
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Ölçüler ardışık teker eksenleri arasıdır ve teknik resimdeki ölçü
        zinciriyle aynıdır. Ön köşe tekerleri <span className="font-mono">A</span>,
        arka köşe tekerleri <span className="font-mono">B</span> kodunu taşır;
        savrulma hesabındaki d<sub>i</sub> uzaklıkları{" "}
        <span className="font-mono">{codes[0]}</span> ekseninden ölçülür. Teker
        adedi Köprü Yürütme bölümünden değiştirilir.
      </p>
    </div>
  );
}
