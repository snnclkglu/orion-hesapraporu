"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DRIVE_BRANDS,
  ELECTRICAL_CABLE_MODELS,
  cableByArticle,
  driveModelsFor,
  driveSeriesFor,
  type CablePurpose,
} from "@/lib/calc/electrical-catalog";
import {
  FESTOON_TROLLEY_PRESETS,
  type ElectricalCircuitKey,
  type ElectricalInputs,
  type ElectricalSelections,
  type ElectricalValues,
} from "@/lib/calc/modules/electrical";
import { cn } from "@/lib/utils";

type Mode = "drives" | "cables" | "festoon";

export interface ElectricalModuleEditorProps {
  mode: Mode;
  inputs: ElectricalInputs;
  selections: ElectricalSelections;
  values?: ElectricalValues;
  onInputsChange: (next: ElectricalInputs) => void;
  onSelectionsChange: (next: ElectricalSelections) => void;
  disabled?: boolean;
}

const selectClass =
  "oc-tap h-10 min-w-0 border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function numberValue(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function fmt(value: number, digits = 2): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function Status({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 border px-2 py-1 text-xs",
      pass ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
    )}>
      {pass ? "✓" : "✕"} {children}
    </span>
  );
}

function DrivesEditor(props: ElectricalModuleEditorProps) {
  const { inputs, selections, values, onInputsChange, onSelectionsChange, disabled } = props;
  if (!values || values.drives.length === 0) {
    return <p className="border border-dashed p-3 text-sm text-muted-foreground">Hesaba giren seçilmiş motor bulunamadı.</p>;
  }
  const updatePick = (key: ElectricalCircuitKey, patch: Record<string, string | undefined>) => {
    onSelectionsChange({
      ...selections,
      drives: {
        ...selections.drives,
        [key]: { ...selections.drives[key], ...patch },
      },
    });
  };
  const fittingModel = (brand: string, series: string, powerKw: number, currentA: number) => {
    const models = driveModelsFor(brand, series);
    return models.find((x) => x.motorPowerKw >= powerKw && x.outputCurrentA >= currentA)
      ?? models.at(-1);
  };
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                "Mekanizma / Motor", "Etiket Akımı", "Marka", "Seri", "Model",
                "Seçim Sonucu",
              ].map((head) => <th key={head} className="px-3 py-2 font-medium">{head}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {values.drives.map((row) => {
              const key = row.circuit.key;
              const pick = selections.drives[key] ?? {};
              const brand = pick.brand ?? row.drive?.brand ?? "Schneider Electric";
              const series = pick.series ?? row.drive?.series ?? driveSeriesFor(brand)[0] ?? "";
              const model = pick.model ?? row.drive?.model ?? "";
              const circuitInput = inputs.circuits[key] ?? {};
              return (
                <tr key={key} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.circuit.label}</div>
                    <div className="mt-1 text-muted-foreground">
                      {fmt(row.circuit.motorPowerKw)} kW × {row.circuit.motorCount}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={circuitInput.ratedCurrentA ?? ""}
                      placeholder={fmt(row.designCurrentA)}
                      disabled={disabled}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const circuits = { ...inputs.circuits };
                        circuits[key] = {
                          ...circuits[key],
                          ratedCurrentA: raw === "" ? undefined : numberValue(raw, row.designCurrentA),
                        };
                        onInputsChange({ ...inputs, circuits });
                      }}
                      className="w-28"
                    />
                    <div className="mt-1 text-[10px] text-muted-foreground">Boşsa motor gücünden hesaplanır.</div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={cn(selectClass, "w-44")}
                      value={brand}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextBrand = event.target.value;
                        const nextSeries = driveSeriesFor(nextBrand)[0] ?? "";
                        const nextModel = fittingModel(nextBrand, nextSeries, row.circuit.motorPowerKw, row.designCurrentA);
                        updatePick(key, {
                          brand: nextBrand,
                          series: nextSeries,
                          model: nextModel?.model,
                        });
                      }}
                    >
                      {DRIVE_BRANDS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={cn(selectClass, "w-48")}
                      value={series}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextSeries = event.target.value;
                        const nextModel = fittingModel(brand, nextSeries, row.circuit.motorPowerKw, row.designCurrentA);
                        updatePick(key, { series: nextSeries, model: nextModel?.model });
                      }}
                    >
                      {driveSeriesFor(brand).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={cn(selectClass, "w-56 font-mono")}
                      value={model}
                      disabled={disabled}
                      onChange={(event) => {
                        const found = driveModelsFor(brand, series).find((x) => x.model === event.target.value);
                        updatePick(key, {
                          brand: found?.brand ?? brand,
                          series: found?.series ?? series,
                          model: event.target.value,
                        });
                      }}
                    >
                      {driveModelsFor(brand, series).map((x) => (
                        <option key={x.model} value={x.model}>
                          {x.model} · {fmt(x.motorPowerKw)} kW · {fmt(x.outputCurrentA)} A
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{row.automatic ? "Otomatik" : "Elle seçildi"}</Badge>
                      {row.drive ? (
                        <>
                          <Status pass={row.drive.motorPowerKw >= row.circuit.motorPowerKw}>Güç</Status>
                          <Status pass={row.drive.outputCurrentA >= row.designCurrentA}>Akım</Status>
                        </>
                      ) : <Status pass={false}>Model yok</Status>}
                    </div>
                    {row.drive?.projectReference && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {row.drive.projectReference} tamamlanmış işinde kullanıldı.
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ön seçim ağır hizmet/anma sütununa göredir. Motor etiket akımı, frenleme direnci veya rejeneratif besleme,
        çevrim süresi, EMC ve izin verilen motor kablosu boyu nihai elektrik projesinde üretici aracından doğrulanmalıdır.
      </p>
    </div>
  );
}

const powerCables = ELECTRICAL_CABLE_MODELS.filter((x) => x.purpose === "power" && x.sectionMm2);

function NumericSetting(props: {
  label: string;
  value: number;
  suffix?: string;
  step?: string;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <FieldLabel>{props.label}</FieldLabel>
      <span className="flex items-center gap-1">
        <Input
          type="number"
          min={props.min ?? 0}
          step={props.step ?? "0.1"}
          value={props.value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(numberValue(event.target.value, props.value))}
        />
        {props.suffix && <span className="shrink-0 text-xs text-muted-foreground">{props.suffix}</span>}
      </span>
    </label>
  );
}

function CableSelect(props: {
  value: string;
  disabled?: boolean;
  family?: "motor" | "main";
  onChange: (articleNo: string) => void;
}) {
  const list = props.family === "motor"
    ? powerCables.filter((x) => x.family === "TOPFLEX 611-C-PUR" || x.family === "PVC Flat")
    : powerCables.filter((x) => x.family === "JZ-600" || x.family === "PVC Flat");
  return (
    <select className={cn(selectClass, "w-full min-w-72 font-mono")} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
      {list.map((cable) => (
        <option key={cable.articleNo} value={cable.articleNo}>
          {cable.articleNo} · {cable.family} {cable.construction} · {cable.shape === "round" ? `Ø${cable.widthMm}` : `${cable.widthMm}×${cable.heightMm}`} mm · {cable.weightKgPerM} kg/m
        </option>
      ))}
    </select>
  );
}

function CablesEditor(props: ElectricalModuleEditorProps) {
  const { inputs, selections, values, onInputsChange, onSelectionsChange, disabled } = props;
  if (!values) return null;
  const settings: Array<[string, keyof ElectricalInputs, string | undefined, string | undefined]> = [
    ["Hat gerilimi", "lineVoltageV", "V", "1"],
    ["Güç katsayısı", "powerFactor", undefined, "0.01"],
    ["Motor verimi", "motorEfficiencyPct", "%", "0.1"],
    ["İzinli gerilim düşümü", "voltageDropLimitPct", "%", "0.1"],
    ["Ek akım düzeltme katsayısı", "currentDeratingFactor", undefined, "0.01"],
    ["Ana besleme eşzamanlılık", "mainDemandFactor", undefined, "0.01"],
    ["Varsayılan motor kablo boyu", "defaultMotorCableLengthM", "m", "1"],
    ["Ana besleme kablo boyu", "mainCableLengthM", "m", "1"],
  ];
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 border bg-muted/15 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {settings.map(([label, key, suffix, step]) => (
          <NumericSetting
            key={key}
            label={label}
            value={inputs[key] as number}
            suffix={suffix}
            step={step}
            disabled={disabled}
            onChange={(value) => onInputsChange({ ...inputs, [key]: value })}
          />
        ))}
      </div>
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                "Devre", "Akım / Boy", "Kablo", "Paralel", "Gereken", "Dış Ölçü / Ağırlık", "Kontrol",
              ].map((head) => <th key={head} className="px-3 py-2 font-medium">{head}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {values.motorCables.map((row) => {
              const key = row.circuit.key;
              const circuit = inputs.circuits[key] ?? {};
              const pick = selections.motorCables[key] ?? {};
              const articleNo = pick.articleNo ?? row.selectedCable?.articleNo ?? powerCables[0]?.articleNo ?? "";
              return (
                <tr key={key} className="align-top">
                  <td className="px-3 py-3 font-medium">{row.circuit.label}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Input
                        type="number" min={0} step="0.1" className="w-24"
                        value={circuit.ratedCurrentA ?? ""} placeholder={fmt(row.designCurrentA)} disabled={disabled}
                        onChange={(e) => onInputsChange({
                          ...inputs,
                          circuits: {
                            ...inputs.circuits,
                            [key]: { ...circuit, ratedCurrentA: e.target.value === "" ? undefined : numberValue(e.target.value, row.designCurrentA) },
                          },
                        })}
                      />
                      <Input
                        type="number" min={0} step="1" className="w-24"
                        value={circuit.cableLengthM ?? ""} placeholder={fmt(row.lengthM, 0)} disabled={disabled}
                        onChange={(e) => onInputsChange({
                          ...inputs,
                          circuits: {
                            ...inputs.circuits,
                            [key]: { ...circuit, cableLengthM: e.target.value === "" ? undefined : numberValue(e.target.value, row.lengthM) },
                          },
                        })}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">A · m</div>
                  </td>
                  <td className="px-3 py-3">
                    <CableSelect
                      family="motor" value={articleNo} disabled={disabled}
                      onChange={(next) => onSelectionsChange({
                        ...selections,
                        motorCables: { ...selections.motorCables, [key]: { ...pick, articleNo: next } },
                      })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number" min={1} max={4} step="1" className="w-20"
                      value={pick.parallelRuns ?? row.selectedRuns} disabled={disabled}
                      onChange={(e) => onSelectionsChange({
                        ...selections,
                        motorCables: {
                          ...selections.motorCables,
                          [key]: { ...pick, articleNo, parallelRuns: Math.max(1, Math.round(numberValue(e.target.value, 1))) },
                        },
                      })}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono">{row.recommendedRuns} × {fmt(row.requiredSectionMm2, 1)} mm²</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.selectedCable ? (
                      <>{row.selectedCable.shape === "round" ? `Ø${fmt(row.selectedCable.widthMm, 1)}` : `${fmt(row.selectedCable.widthMm, 1)} × ${fmt(row.selectedCable.heightMm, 1)}`} mm<br />{fmt(row.selectedCable.weightKgPerM, 3)} kg/m</>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Status pass={row.ampacityA >= row.designCurrentA}>I {fmt(row.ampacityA)} A</Status>
                      <Status pass={row.voltageDropPct <= inputs.voltageDropLimitPct}>ΔU %{fmt(row.voltageDropPct)}</Status>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(() => {
              const row = values.mainCable;
              const pick = selections.mainCable;
              const articleNo = pick.articleNo ?? row.selectedCable?.articleNo ?? "";
              return (
                <tr className="bg-primary/[0.03] align-top">
                  <td className="px-3 py-3 font-semibold">Ana Besleme</td>
                  <td className="px-3 py-3">{fmt(row.designCurrentA)} A<br />{fmt(row.lengthM, 0)} m</td>
                  <td className="px-3 py-3">
                    <CableSelect family="main" value={articleNo} disabled={disabled} onChange={(next) => onSelectionsChange({ ...selections, mainCable: { ...pick, articleNo: next } })} />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number" min={1} max={4} step="1" className="w-20"
                      value={pick.parallelRuns ?? row.selectedRuns} disabled={disabled}
                      onChange={(e) => onSelectionsChange({ ...selections, mainCable: { ...pick, articleNo, parallelRuns: Math.max(1, Math.round(numberValue(e.target.value, 1))) } })}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono">{row.recommendedRuns} × {fmt(row.requiredSectionMm2, 1)} mm²</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.selectedCable ? <>{row.selectedCable.shape === "round" ? `Ø${fmt(row.selectedCable.widthMm, 1)}` : `${fmt(row.selectedCable.widthMm, 1)} × ${fmt(row.selectedCable.heightMm, 1)}`} mm<br />{fmt(row.selectedCable.weightKgPerM, 3)} kg/m</> : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Status pass={row.ampacityA >= row.designCurrentA}>I {fmt(row.ampacityA)} A</Status>
                      <Status pass={row.voltageDropPct <= inputs.voltageDropLimitPct}>ΔU %{fmt(row.voltageDropPct)}</Status>
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Bu tablo ön boyutlandırmadır. Kablo döşeme biçimi, aynı tava/demet düzeltmesi, ortam sıcaklığı, harmonikler,
        kısa devre termik dayanımı, PE kesiti ve koruma cihazı koordinasyonu elektrik projesinin sorumluluğunda kalır.
      </p>
    </div>
  );
}

function FestoonLayoutSvg({ inputs, values }: { inputs: ElectricalInputs; values: ElectricalValues }) {
  const layout = values.festoon;
  const vbW = 180;
  const vbH = 116;
  const plotLeft = 20;
  const plotTop = 28;
  const plotW = 140;
  const plotH = 62;
  const usableW = Math.max(1, inputs.usableWidthMm);
  const usableH = Math.max(1, inputs.usableHeightMm);
  const worldCenterX = usableW / 2;
  const halfW = Math.max(usableW / 2, ...layout.placements.map((p) => Math.abs(p.xMm - worldCenterX) + p.widthMm / 2));
  const halfH = Math.max(usableH / 2, ...layout.placements.map((p) => Math.abs(p.yMm) + p.heightMm / 2));
  const scale = Math.min(plotW / (2 * halfW), plotH / (2 * halfH)) * 0.9;
  const centerX = vbW / 2;
  const centerY = plotTop + plotH / 2;
  const capacityW = usableW * scale;
  const capacityH = usableH * scale;
  const left = centerX - capacityW / 2;
  const top = centerY - capacityH / 2;
  const cogX = centerX + layout.centerOffsetMm * scale;
  return (
    <div className="border bg-white p-2 dark:bg-neutral-950">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-auto max-h-[360px] w-full" role="img" aria-label="Feston kablo arabası enine kablo yerleşimi">
        <rect x={plotLeft} y={plotTop} width={plotW} height={plotH} fill="none" stroke="#A8A29E" strokeWidth="0.5" />
        <rect x={left} y={top} width={capacityW} height={capacityH} fill="#F7F5F3" stroke="#262626" strokeWidth="1" />
        <line x1={centerX} y1={plotTop - 9} x2={centerX} y2={plotTop + plotH + 5} stroke="#A41E1E" strokeWidth="0.8" strokeDasharray="3 2" />
        {layout.placements.map((p) => {
          const x = centerX + (p.xMm - worldCenterX) * scale - p.widthMm * scale / 2;
          const y = centerY + p.yMm * scale - p.heightMm * scale / 2;
          return p.widthMm === p.heightMm ? (
            <g key={p.id}>
              <circle cx={x + p.widthMm * scale / 2} cy={y + p.heightMm * scale / 2} r={p.widthMm * scale / 2} fill={p.color} fillOpacity="0.8" stroke="#262626" strokeWidth="0.5" />
              <title>{p.label} · {p.family} {p.construction} · {p.weightKgPerM} kg/m</title>
            </g>
          ) : (
            <g key={p.id}>
              <rect x={x} y={y} width={p.widthMm * scale} height={p.heightMm * scale} rx="0.8" fill={p.color} fillOpacity="0.8" stroke="#262626" strokeWidth="0.5" />
              <title>{p.label} · {p.family} {p.construction} · {p.weightKgPerM} kg/m</title>
            </g>
          );
        })}
        <line x1={cogX} y1={plotTop - 4} x2={cogX} y2={plotTop + plotH + 2} stroke="#111827" strokeWidth="1.5" />
        <polygon points={`${cogX - 2.5},${plotTop - 5} ${cogX + 2.5},${plotTop - 5} ${cogX},${plotTop + 1}`} fill="#111827" />
        <text x={cogX} y={plotTop - 8} fontSize="4" textAnchor="middle" fill="#111827">AG</text>
        <text x={vbW / 2} y={106} fontSize="4" textAnchor="middle" fill="#57534E">
          b2={fmt(inputs.usableWidthMm, 0)} mm · s={fmt(inputs.usableHeightMm, 0)} mm · D={fmt(inputs.supportDiameterMm, 0)} mm
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 bg-[#D94A3A]" />Güç</span>
        <span><i className="mr-1 inline-block size-2 bg-[#2F6FEB]" />Kumanda</span>
        <span><i className="mr-1 inline-block size-2 bg-[#0F9D8A]" />Sinyal</span>
        <span><i className="mr-1 inline-block h-3 w-px bg-black" />Ağırlık merkezi</span>
      </div>
    </div>
  );
}

const extraCableOptions = ELECTRICAL_CABLE_MODELS.filter((x) => x.purpose !== "power");

function FestoonEditor(props: ElectricalModuleEditorProps) {
  const { inputs, values, onInputsChange, disabled } = props;
  if (!values) return null;
  const layout = values.festoon;
  const changePreset = (id: string) => {
    const preset = FESTOON_TROLLEY_PRESETS.find((x) => x.id === id);
    if (!preset) return;
    onInputsChange({
      ...inputs,
      trolleyPresetId: preset.id,
      trolleyBrand: preset.brand,
      trolleyModel: preset.model,
      trolleyWidthMm: preset.trolleyWidthMm,
      usableWidthMm: preset.usableWidthMm,
      usableHeightMm: preset.usableHeightMm,
      supportDiameterMm: preset.supportDiameterMm,
      maxCableLoadKg: preset.maxCableLoadKg,
    });
  };
  const allCircuits = values.motorCables.map((x) => x.circuit);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div className="grid content-start gap-4">
          <section className="grid gap-3 border bg-muted/15 p-3">
            <label className="grid gap-1">
              <FieldLabel>Feston arabası kataloğu</FieldLabel>
              <select className={selectClass} value={inputs.trolleyPresetId} disabled={disabled} onChange={(e) => changePreset(e.target.value)}>
                {FESTOON_TROLLEY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.brand} · {preset.model}</option>
                ))}
                {inputs.trolleyPresetId === "custom" && <option value="custom">Özel · Elle girilen ölçüler</option>}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumericSetting label="Kullanılabilir en b2" value={inputs.usableWidthMm} suffix="mm" step="1" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, usableWidthMm: value, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Kullanılabilir yükseklik s" value={inputs.usableHeightMm} suffix="mm" step="1" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, usableHeightMm: value, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Taşıyıcı çapı D" value={inputs.supportDiameterMm} suffix="mm" step="1" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, supportDiameterMm: value, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Azami kablo yükü" value={inputs.maxCableLoadKg} suffix="kg" step="1" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, maxCableLoadKg: value, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Loop yüksekliği" value={inputs.loopHeightM} suffix="m" step="0.1" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, loopHeightM: value })} />
              <NumericSetting label="Kablo aralığı" value={inputs.cableGapMm} suffix="mm" step="0.5" disabled={disabled} onChange={(value) => onInputsChange({ ...inputs, cableGapMm: value })} />
            </div>
            <label className="grid gap-1">
              <FieldLabel>Yerleşim sırası</FieldLabel>
              <select className={selectClass} value={inputs.rowCount} disabled={disabled} onChange={(e) => onInputsChange({ ...inputs, rowCount: e.target.value === "2" ? 2 : 1 })}>
                <option value={1}>Tek sıra</option>
                <option value={2}>Çift sıra</option>
              </select>
            </label>
          </section>

          <section className="grid gap-2 border p-3">
            <h4 className="text-xs font-semibold">Feston paketine giren motor devreleri</h4>
            {allCircuits.map((circuit) => (
              <label key={circuit.key} className="oc-tap flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={inputs.festoonCircuitKeys.includes(circuit.key)}
                  disabled={disabled}
                  onChange={(e) => onInputsChange({
                    ...inputs,
                    festoonCircuitKeys: e.target.checked
                      ? [...new Set([...inputs.festoonCircuitKeys, circuit.key])]
                      : inputs.festoonCircuitKeys.filter((x) => x !== circuit.key),
                  })}
                />
                {circuit.label} · {fmt(circuit.motorPowerKw)} kW × {circuit.motorCount}
              </label>
            ))}
          </section>
        </div>

        <div className="grid content-start gap-3">
          <FestoonLayoutSvg inputs={inputs} values={values} />
          <div className="flex flex-wrap gap-2">
            <Status pass={layout.fitsWidth}>En {fmt(layout.packageWidthMm, 1)} / {fmt(inputs.usableWidthMm, 1)} mm</Status>
            <Status pass={layout.fitsHeight}>Yükseklik {fmt(layout.packageHeightMm, 1)} / {fmt(inputs.usableHeightMm, 1)} mm</Status>
            <Status pass={layout.fitsBend}>D {fmt(inputs.supportDiameterMm, 0)} / min. {fmt(layout.minimumSupportDiameterMm, 0)} mm</Status>
            <Status pass={layout.fitsLoad}>Yük {fmt(layout.trolleyCableLoadKg, 2)} / {fmt(inputs.maxCableLoadKg, 0)} kg</Status>
            <Status pass={Math.abs(layout.centerOffsetMm) <= Math.max(2, inputs.usableWidthMm * 0.05)}>AG sapması {fmt(Math.abs(layout.centerOffsetMm), 1)} mm</Status>
          </div>
          <p className="text-xs text-muted-foreground">
            Paket {fmt(layout.packageWeightKgPerM, 3)} kg/m. Otomatik yerleşim kabloların enine ağırlık merkezini araba orta eksenine yaklaştırır; kablo renkleri elektriksel görevi gösterir.
          </p>
        </div>
      </div>

      <section className="grid gap-3 border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold">Ek kumanda ve sinyal kabloları</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">0019 yerel HELUKABEL satırlarından çap, ağırlık ve hareketli bükülme değeri okunur.</p>
          </div>
          <Button
            type="button" variant="outline" size="sm" disabled={disabled}
            onClick={() => onInputsChange({
              ...inputs,
              extraCables: [
                ...inputs.extraCables,
                {
                  id: `extra-${Date.now()}`,
                  label: "Kumanda Kablosu",
                  articleNo: extraCableOptions[0]?.articleNo ?? "10365",
                  quantity: 1,
                  purpose: "control",
                },
              ],
            })}
          >
            + Kablo Ekle
          </Button>
        </div>
        {inputs.extraCables.length === 0 ? (
          <p className="border border-dashed p-3 text-xs text-muted-foreground">Ek kumanda/sinyal kablosu seçilmedi.</p>
        ) : (
          <div className="grid gap-2">
            {inputs.extraCables.map((extra, index) => {
              const cable = cableByArticle(extra.articleNo);
              const update = (patch: Partial<typeof extra>) => {
                const next = [...inputs.extraCables];
                next[index] = { ...extra, ...patch };
                onInputsChange({ ...inputs, extraCables: next });
              };
              return (
                <div key={extra.id} className="grid gap-2 border bg-muted/10 p-2 sm:grid-cols-[1fr_2fr_8rem_6rem_auto] sm:items-center">
                  <Input value={extra.label} disabled={disabled} onChange={(e) => update({ label: e.target.value })} placeholder="Devre adı" />
                  <select className={selectClass} value={extra.articleNo} disabled={disabled} onChange={(e) => {
                    const selected = cableByArticle(e.target.value);
                    update({ articleNo: e.target.value, purpose: selected?.purpose ?? extra.purpose });
                  }}>
                    {extraCableOptions.map((x) => <option key={x.articleNo} value={x.articleNo}>{x.articleNo} · {x.family} {x.construction} · Ø{x.widthMm} mm · {x.weightKgPerM} kg/m</option>)}
                  </select>
                  <select className={selectClass} value={extra.purpose} disabled={disabled} onChange={(e) => update({ purpose: e.target.value as CablePurpose })}>
                    <option value="control">Kumanda</option>
                    <option value="signal">Sinyal</option>
                  </select>
                  <Input type="number" min={1} step="1" value={extra.quantity} disabled={disabled} onChange={(e) => update({ quantity: Math.max(1, Math.round(numberValue(e.target.value, 1))) })} />
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onInputsChange({ ...inputs, extraCables: inputs.extraCables.filter((_, i) => i !== index) })}>Sil</Button>
                  {cable && <p className="text-[10px] text-muted-foreground sm:col-span-5">Ø{fmt(cable.widthMm, 1)} mm · {fmt(cable.weightKgPerM, 3)} kg/m · hareketli min. bükülme çapı {fmt(cable.bendRadiusFactor * cable.heightMm * 2, 1)} mm</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function ElectricalModuleEditor(props: ElectricalModuleEditorProps) {
  if (props.mode === "drives") return <DrivesEditor {...props} />;
  if (props.mode === "cables") return <CablesEditor {...props} />;
  return <FestoonEditor {...props} />;
}
