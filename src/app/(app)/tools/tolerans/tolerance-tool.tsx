"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateFit, type HoleToleranceCode, type ShaftToleranceCode } from "@/lib/engineering-tools/tolerances";
import { NumberField, parseMetricNumber } from "../number-field";

const HOLES: readonly HoleToleranceCode[] = ["H6", "H7", "H8", "H9", "H10"];
const SHAFTS: readonly ShaftToleranceCode[] = ["h5", "h6", "h7", "h8", "h9", "js5", "js6", "js7"];
const mm = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
const micro = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

function signed(value: number): string { return `${value > 0 ? "+" : ""}${micro.format(value)}`; }

export function ToleranceTool() {
  const [nominal, setNominal] = useState("");
  const [hole, setHole] = useState<HoleToleranceCode>("H7");
  const [shaft, setShaft] = useState<ShaftToleranceCode>("h6");
  const size = parseMetricNumber(nominal);
  const calculation = useMemo(() => {
    if (size === undefined) return { result: null, error: null };
    try { return { result: calculateFit(size, hole, shaft), error: null }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "Tolerans hesaplanamadı." }; }
  }, [hole, shaft, size]);

  return (
    <main className="grid gap-5">
      <section className="grid gap-4 border bg-card p-4 sm:p-5">
        <header className="grid gap-1"><p className="oc-kicker text-muted-foreground">JIS B 0401:1999 kaynak tablosu</p><h2 className="text-lg font-semibold">Geçme toleransı</h2><p className="text-sm text-muted-foreground">Anma ölçüsü mm, sapmalar µm, sınır ölçüleri mm olarak gösterilir.</p></header>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="fit-nominal" label="Anma ölçüsü" value={nominal} onChange={setNominal} />
          <CodeSelect label="Delik toleransı" value={hole} values={HOLES} onChange={(value) => setHole(value as HoleToleranceCode)} />
          <CodeSelect label="Mil toleransı" value={shaft} values={SHAFTS} onChange={(value) => setShaft(value as ShaftToleranceCode)} />
        </div>
      </section>

      {calculation.result ? <section aria-live="polite" className="grid gap-4 lg:grid-cols-3">
        <ToleranceCard title={`Delik ${calculation.result.hole.code}`} lower={calculation.result.hole.lowerMicrometre} upper={calculation.result.hole.upperMicrometre} min={calculation.result.hole.minSizeMm} max={calculation.result.hole.maxSizeMm} />
        <ToleranceCard title={`Mil ${calculation.result.shaft.code}`} lower={calculation.result.shaft.lowerMicrometre} upper={calculation.result.shaft.upperMicrometre} min={calculation.result.shaft.minSizeMm} max={calculation.result.shaft.maxSizeMm} />
        <div className="border-l-4 border-primary bg-primary/[0.05] p-4"><span className="oc-kicker text-muted-foreground">Geçme sonucu</span><strong className="mt-1 block text-xl text-primary">{calculation.result.kind === "bosluklu" ? "Boşluklu geçme" : calculation.result.kind === "gecis" ? "Geçiş geçmesi" : "Sıkı geçme"}</strong><dl className="mt-4 grid gap-2 text-sm"><Row label="En az boşluk" value={`${signed(calculation.result.minClearanceMicrometre)} µm`} /><Row label="En çok boşluk" value={`${signed(calculation.result.maxClearanceMicrometre)} µm`} /></dl></div>
      </section> : <section aria-live="polite" className="border p-5 text-sm text-muted-foreground">{calculation.error ?? "Sonucu görmek için 0–500 mm arasında bir anma ölçüsü girin."}</section>}

      <section className="grid gap-3 border bg-card p-4">
        <h3 className="font-semibold">Kapsam ve kullanım notu</h3>
        <p className="text-sm leading-6 text-muted-foreground">Bu ilk sürüm, verilen belgeden doğrulanan H6–H10 delik ve h5–h9 / js5–js7 mil sınıflarını kapsar. K, M, N, P gibi sıkı geçme bölgeleri kaynak tablodan tam ve çift kontrollü aktarılmadan eklenmemiştir. Sonuçlar tasarım ve ön seçim içindir; imalat resmi yayımlanmadan önce geçerli standart ve proses şartları ayrıca doğrulanmalıdır.</p>
      </section>
    </main>
  );
}

function CodeSelect({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <div className="grid gap-1.5"><label className="text-[12px] text-muted-foreground">{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger className="w-full font-mono"><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>;
}

function ToleranceCard({ title, lower, upper, min, max }: { title: string; lower: number; upper: number; min: number; max: number }) {
  return <div className="border bg-card p-4"><span className="oc-kicker text-muted-foreground">Tolerans bölgesi</span><h3 className="mt-1 font-mono text-xl font-semibold">{title}</h3><dl className="mt-4 grid gap-2 text-sm"><Row label="Alt sapma" value={`${signed(lower)} µm`} /><Row label="Üst sapma" value={`${signed(upper)} µm`} /><Row label="En küçük ölçü" value={`${mm.format(min)} mm`} /><Row label="En büyük ölçü" value={`${mm.format(max)} mm`} /></dl></div>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-baseline justify-between gap-3 border-b pb-1"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono font-medium">{value}</dd></div>; }
