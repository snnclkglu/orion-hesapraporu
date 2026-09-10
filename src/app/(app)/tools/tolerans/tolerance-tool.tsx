"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateFit, type HoleToleranceCode, type ShaftToleranceCode } from "@/lib/engineering-tools/tolerances";
import { NumberField, parseMetricNumber } from "../number-field";

const HOLES: readonly HoleToleranceCode[] = ["H6", "H7", "H8", "H9", "H10"];
const SHAFTS: readonly ShaftToleranceCode[] = ["h5", "h6", "h7", "h8", "h9", "js5", "js6", "js7", "p6"];
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
        <div className="border-l-4 border-primary bg-primary/[0.05] p-4"><span className="oc-kicker text-muted-foreground">Geçme sonucu</span><strong className="mt-1 block text-xl text-primary">{calculation.result.kind === "bosluklu" ? "Boşluklu geçme" : calculation.result.kind === "gecis" ? "Geçiş geçmesi" : "Sıkı geçme"}</strong><span className="mt-1 block text-sm font-medium">{calculation.result.behavior}</span><dl className="mt-4 grid gap-2 text-sm"><Row label="En az boşluk" value={`${signed(calculation.result.minClearanceMicrometre)} µm`} /><Row label="En çok boşluk" value={`${signed(calculation.result.maxClearanceMicrometre)} µm`} /></dl></div>
      </section> : <section aria-live="polite" className="border p-5 text-sm text-muted-foreground">{calculation.error ?? "Sonucu görmek için 0–500 mm arasında bir anma ölçüsü girin."}</section>}

      {calculation.result && <FitDiagram result={calculation.result} />}

      <section className="grid gap-3 border bg-card p-4">
        <h3 className="font-semibold">Kapsam ve kullanım notu</h3>
        <div className="grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-3"><p><strong className="text-foreground">Boşluklu:</strong> En büyük mil bile en küçük delikten küçüktür. Serbest çalışma ve kayma gereken yerlerde kullanılır.</p><p><strong className="text-foreground">Geçişli:</strong> Üretim sapmalarına göre küçük boşluk veya küçük sıkılık oluşabilir. Hassas konumlamaya uygundur.</p><p><strong className="text-foreground">Sıkı:</strong> Mil tolerans bölgesi deliğin üzerindedir. Montaj pres, ısıtma veya soğutma gerektirebilir.</p></div>
        <p className="border-t pt-3 text-[12px] text-muted-foreground">H, h ve js sınıfları kullanıcı belgesinden; H7/p6 yaygın pres geçmesi satırları ISO 286 limit sapma tablosundan aktarılmıştır. Sonuç tasarım ön seçimidir. Yük, sıcaklık, yüzey, yağlama ve montaj yöntemi ayrıca doğrulanır.</p>
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

function FitDiagram({ result }: { result: NonNullable<ReturnType<typeof calculateFit>> }) {
  const min = Math.min(result.hole.lowerMicrometre, result.shaft.lowerMicrometre, 0);
  const max = Math.max(result.hole.upperMicrometre, result.shaft.upperMicrometre, 0);
  const span = Math.max(1, max - min);
  const x = (value: number) => 72 + ((value - min) / span) * 516;
  return <section className="border bg-card p-4"><h3 className="font-semibold">Tolerans bölgeleri</h3><p className="mt-1 text-[12px] text-muted-foreground">Sıfır çizgisine göre delik ve mil sapmalarının şematik konumu</p><div className="oc-scrollx mt-3 overflow-x-auto"><svg viewBox="0 0 660 180" className="min-w-[620px]" role="img" aria-label={`${result.hole.code} delik ve ${result.shaft.code} mil tolerans bölgeleri`}><line x1={x(0)} x2={x(0)} y1="24" y2="150" className="stroke-foreground" strokeWidth="2"/><text x={x(0)+5} y="20" className="fill-foreground" fontSize="11">0 µm</text><rect x={x(result.hole.lowerMicrometre)} y="46" width={Math.max(3,x(result.hole.upperMicrometre)-x(result.hole.lowerMicrometre))} height="36" className="fill-primary/30 stroke-primary"/><rect x={x(result.shaft.lowerMicrometre)} y="108" width={Math.max(3,x(result.shaft.upperMicrometre)-x(result.shaft.lowerMicrometre))} height="36" className="fill-muted stroke-foreground"/><text x="8" y="69" className="fill-foreground" fontSize="12">DELİK</text><text x="8" y="131" className="fill-foreground" fontSize="12">MİL</text><text x="72" y="170" className="fill-muted-foreground" fontSize="11">{signed(min)} µm</text><text x="548" y="170" className="fill-muted-foreground" fontSize="11">{signed(max)} µm</text></svg></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{result.behaviorNote}</p></section>;
}
