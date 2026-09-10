"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateWeight, STEEL_DENSITY_G_CM3, type WeightResult, type WeightShape } from "@/lib/engineering-tools/weight";
import { NumberField, parseMetricNumber } from "../number-field";
import { WeightDiagram } from "./weight-diagram";

const SHAPES: readonly { value: WeightShape; label: string }[] = [
  { value: "plate", label: "Dikdörtgen sac / lama" },
  { value: "disc", label: "Dairesel sac / disk" },
  { value: "ring", label: "Halka sac" },
  { value: "roundBar", label: "Dolu mil" },
  { value: "pipe", label: "Boru" },
  { value: "rectTube", label: "Kare / dikdörtgen kutu profil" },
];

const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });

interface FormState {
  width: string;
  height: string;
  thickness: string;
  length: string;
  outer: string;
  inner: string;
  density: string;
  quantity: string;
}
interface SavedRow { id: number; label: string; totalKg: number }

const EMPTY: FormState = {
  width: "", height: "", thickness: "", length: "", outer: "", inner: "",
  density: String(STEEL_DENSITY_G_CM3).replace(".", ","), quantity: "1",
};

export function WeightCalculator() {
  const [shape, setShape] = useState<WeightShape>("plate");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<SavedRow[]>([]);

  const set = (key: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const calculation = useMemo<{ result: WeightResult | null; error: string | null }>(() => {
    try {
      return {
        result: calculateWeight({
          shape,
          dimensions: {
            widthMm: parseMetricNumber(form.width),
            heightMm: parseMetricNumber(form.height),
            thicknessMm: parseMetricNumber(form.thickness),
            lengthMm: parseMetricNumber(form.length),
            outerDiameterMm: parseMetricNumber(form.outer),
            innerDiameterMm: parseMetricNumber(form.inner),
          },
          densityGcm3: parseMetricNumber(form.density),
          quantity: parseMetricNumber(form.quantity),
        }),
        error: null,
      };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Ölçüler hesaplanamadı." };
    }
  }, [form, shape]);

  const total = saved.reduce((sum, row) => sum + row.totalKg, 0);
  const fields = (() => {
    switch (shape) {
      case "plate": return [<NumberField key="w" id="weight-width" label="En" value={form.width} onChange={set("width")} />, <NumberField key="t" id="weight-thickness" label="Kalınlık" value={form.thickness} onChange={set("thickness")} />, <NumberField key="l" id="weight-length" label="Boy" value={form.length} onChange={set("length")} />];
      case "disc": return [<NumberField key="o" id="weight-outer" label="Çap" value={form.outer} onChange={set("outer")} />, <NumberField key="t" id="weight-thickness" label="Kalınlık" value={form.thickness} onChange={set("thickness")} />];
      case "ring": return [<NumberField key="o" id="weight-outer" label="Dış çap" value={form.outer} onChange={set("outer")} />, <NumberField key="i" id="weight-inner" label="İç çap" value={form.inner} onChange={set("inner")} />, <NumberField key="t" id="weight-thickness" label="Kalınlık" value={form.thickness} onChange={set("thickness")} />];
      case "roundBar": return [<NumberField key="o" id="weight-outer" label="Çap" value={form.outer} onChange={set("outer")} />, <NumberField key="l" id="weight-length" label="Boy" value={form.length} onChange={set("length")} />];
      case "pipe": return [<NumberField key="o" id="weight-outer" label="Dış çap" value={form.outer} onChange={set("outer")} />, <NumberField key="t" id="weight-thickness" label="Et kalınlığı" value={form.thickness} onChange={set("thickness")} />, <NumberField key="l" id="weight-length" label="Boy" value={form.length} onChange={set("length")} />];
      case "rectTube": return [<NumberField key="w" id="weight-width" label="En" value={form.width} onChange={set("width")} />, <NumberField key="h" id="weight-height" label="Yükseklik" value={form.height} onChange={set("height")} />, <NumberField key="t" id="weight-thickness" label="Et kalınlığı" value={form.thickness} onChange={set("thickness")} />, <NumberField key="l" id="weight-length" label="Boy" value={form.length} onChange={set("length")} />];
    }
  })();

  return (
    <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="grid gap-5 border bg-card p-4 sm:p-5">
        <header className="grid gap-1">
          <p className="oc-kicker text-muted-foreground">Parça geometrisi</p>
          <h2 className="text-lg font-semibold">Ağırlık hesabı</h2>
        </header>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-[12px] text-muted-foreground">Şekil</label>
              <Select value={shape} onValueChange={(value) => setShape(value as WeightShape)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SHAPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields}</div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="weight-density" label="Özkütle" unit="g/cm³" value={form.density} onChange={set("density")} />
              <NumberField id="weight-quantity" label="Adet" unit="adet" value={form.quantity} onChange={set("quantity")} />
            </div>
          </div>
          <div className="grid place-items-center border bg-muted/25 p-3"><WeightDiagram shape={shape} /></div>
        </div>

        <div aria-live="polite" className="border-l-4 border-primary bg-primary/[0.05] p-4">
          {calculation.result ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Kesit alanı" value={`${numberFormat.format(calculation.result.crossSectionMm2)} mm²`} />
                <Metric label="Tek parça" value={`${numberFormat.format(calculation.result.unitKg)} kg`} />
                <Metric label="Toplam" value={`${numberFormat.format(calculation.result.totalKg)} kg`} strong />
                <Metric label="Metre ağırlığı" value={calculation.result.kgPerM === null ? "—" : `${numberFormat.format(calculation.result.kgPerM)} kg/m`} />
              </div>
              <p className="text-[12px] text-muted-foreground">{calculation.result.formula}</p>
              <Button className="w-fit" onClick={() => setSaved((rows) => [...rows, { id: Date.now(), label: SHAPES.find((item) => item.value === shape)?.label ?? shape, totalKg: calculation.result!.totalKg }])}>
                <Plus className="size-4" /> Listeye ekle
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{calculation.error}</p>
          )}
        </div>
      </section>

      <aside className="h-fit border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Hesap listesi</h2><p className="text-[12px] text-muted-foreground">Bu oturumdaki parçalar</p></div>
        {saved.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Henüz parça eklenmedi.</p> : <ul>{saved.map((row) => <li key={row.id} className="flex min-h-12 items-center gap-2 border-b px-4 py-2"><span className="min-w-0 flex-1 truncate text-sm">{row.label}</span><span className="font-mono text-sm">{numberFormat.format(row.totalKg)} kg</span><button type="button" className="oc-tap-square grid size-8 place-items-center text-muted-foreground hover:text-destructive" aria-label="Parçayı listeden çıkar" onClick={() => setSaved((rows) => rows.filter((item) => item.id !== row.id))}><Trash2 className="size-4" /></button></li>)}</ul>}
        <div className="flex items-baseline justify-between gap-3 bg-muted/30 px-4 py-4"><span className="text-sm font-medium">Genel toplam</span><strong className="font-mono text-lg">{numberFormat.format(total)} kg</strong></div>
      </aside>
    </main>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0"><span className="block text-[11px] text-muted-foreground">{label}</span><span className={strong ? "block truncate font-mono text-lg font-semibold text-primary" : "block truncate font-mono text-sm font-medium"}>{value}</span></div>;
}
