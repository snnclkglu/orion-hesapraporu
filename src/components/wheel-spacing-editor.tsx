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

import { useEffect, useId, useRef, useState } from "react";
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
  const positions = spacings.reduce<number[]>(
    (all, gap) => [...all, all[all.length - 1] + gap],
    [0]
  );
  // Masaüstü şemasında ilk–son teker ekseni kullanılabilir alanın tam %80'ini
  // kaplar. Ara tekerler gerçek kümülatif ölçülerine göre yerleşir; toplam
  // mesafe sıfırsa şema çökmek yerine tekerleri eşit aralıklı gösterir.
  const positionPcts = positions.map((position, index) =>
    wheelbase > 0
      ? (position / wheelbase) * 100
      : codes.length > 1
        ? (index / (codes.length - 1)) * 100
        : 50
  );

  // Mobil liste ile grafik yerleşim AYNI ANDA DOM'dadır (biri CSS ile
  // gizlidir); id'ler yinelenmesin diye düzen öneki taşır.
  const uid = useId();
  const gapId = (layout: string, index: number) => `${uid}-${layout}-gap-${index}`;

  const clearDraft = (index: number) =>
    setDraft((d) =>
      Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== index))
    );

  /**
   * Ölçü kutusu. Eski hâli ham bir `<input>` ile `h-7 w-24 text-xs` idi: 28px
   * yükseklik ve 12px yazı iOS'ta odaklanma zumunu KESİN tetikliyor, zaten
   * kat kat kaydırılan bir düzende zum geri alınamıyordu.
   */
  const gapInput = (index: number, layout: string, extra: string) => (
    <input
      id={gapId(layout, index)}
      inputMode="decimal"
      disabled={disabled}
      value={draft[index] ?? fmt(spacings[index])}
      onChange={(e) => commit(index, e.target.value)}
      // Odak çıkınca taslak temizlenir; alan yeniden çözülmüş (geçerli)
      // değeri gösterir.
      onBlur={() => clearDraft(index)}
      className={cn(
        "h-9 border bg-background px-2 text-center font-mono text-base tabular-nums",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "pointer-coarse:h-10 pointer-fine:text-xs",
        disabled && "opacity-60",
        extra
      )}
    />
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="oc-kicker text-muted-foreground">Teker Düzeni</h3>
        <span className="text-xs text-muted-foreground">
          {totalWheels} teker · her köşede {perCorner} · her rayda {perSide}
        </span>
      </div>

      {/*
        MOBİL DÜZEN — `sm:` altında grafik yerleşim KULLANILAMAZ.
        Grafik yerleşim sabit piksel sütunludur: teker 64px, ölçü 112px. 12
        tekerli bir rayda 12×64 + 11×112 = 2000px eder; 375px'lik bir telefonda
        5,3 kat kaydırma demektir ve hiçbir anda teker kodu ile ait olduğu ölçü
        kutusu BİRLİKTE görünmez. Mobilde ölçü zinciri dikey listeye düşer:
        her satır kendi etiketini taşır, yatay kaydırma kalmaz.
      */}
      <div className="grid gap-1.5 border bg-card/40 p-3 sm:hidden">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>yürüme yönü</span>
          <span aria-hidden className="font-mono">
            →
          </span>
        </div>
        {spacings.map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
          >
            <label
              htmlFor={gapId("m", i)}
              className={cn(
                "font-mono text-xs font-semibold",
                i < perCorner ? "text-primary" : "text-foreground"
              )}
            >
              {codes[i]}–{codes[i + 1]}
            </label>
            <span className="flex shrink-0 items-center gap-1.5">
              {gapInput(i, "m", "w-28")}
              <span className="font-mono text-[11px] text-muted-foreground">mm</span>
            </span>
          </div>
        ))}
      </div>

      {/*
        GRAFİK YERLEŞİM — `sm:` ve üstü.

        İlk ve son teker ekseni, kartın ortasındaki %80 genişlikli şemanın iki
        ucudur. Sabit piksel sütunlar kullanılmaz: ara tekerin konumu 6.1'deki
        gerçek kümülatif mesafenin toplam dingil mesafesine oranıdır.
      */}
      <div className="hidden border bg-card/40 sm:block">
        <div className="py-4">
          {/* Toplam dingil mesafesi kart genişliğinin %80'i; mx-auto ortalar. */}
          <div className="mx-auto w-4/5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>yürüme yönü</span>
              <span aria-hidden className="font-mono">→</span>
            </div>

            <div className="relative h-28">
              {/* Ölçü kutuları, ait oldukları iki teker ekseninin tam ortası. */}
              {spacings.map((_, i) => {
                const left = (positionPcts[i] + positionPcts[i + 1]) / 2;
                const gapPct = Math.max(0, positionPcts[i + 1] - positionPcts[i]);
                return (
                  <div
                    key={`gap-${i}`}
                    className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
                    style={{
                      left: `${left}%`,
                      // Geniş aralıkta eski 96px sınırı korunur; dar aralıkta
                      // kutu 56px'in altına düşmez ve yazılabilir kalır.
                      width: `clamp(3.5rem, calc(${gapPct}% - 0.5rem), 6rem)`,
                    }}
                  >
                    <label className="sr-only" htmlFor={gapId("d", i)}>
                      {codes[i]} – {codes[i + 1]} mesafesi
                    </label>
                    {gapInput(i, "d", "w-full")}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {codes[i]}–{codes[i + 1]}
                    </span>
                  </div>
                );
              })}

              {/* Rayın iki ucu ilk ve son teker eksenidir. */}
              <div className="absolute inset-x-0 bottom-1 h-px bg-foreground/50" />

              {codes.map((code, i) => (
                <div
                  key={code}
                  className="absolute top-[3.75rem] flex -translate-x-1/2 flex-col items-center gap-1"
                  style={{ left: `${positionPcts[i]}%` }}
                >
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
                  <div className="h-3 w-px bg-foreground/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Düzenleyicinin tek özet çıktısı. Eskiden `min-w-max` çiziminin
          İÇİNDEYDİ, yani 2000px'lik şemanın ta sağında kalıyor ve telefonda
          hiç görülmüyordu. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>RAY 1 — karşı ray (RAY 2) aynıdır</span>
        <span className="font-mono">
          dingil mesafesi = {wheelbase.toLocaleString("tr-TR")} mm
        </span>
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
