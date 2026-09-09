"use client";

import { useMemo, useState } from "react";
import { ElectricalModuleEditor } from "@/components/electrical-module-editor";
import { NEW_WORK_SPECS } from "@/lib/calc/defaults";
import {
  DEFAULT_ELECTRICAL_INPUTS,
  DEFAULT_ELECTRICAL_SELECTIONS,
  computeElectrical,
  type ElectricalInputs,
  type ElectricalSelections,
} from "@/lib/calc/modules/electrical";

const deps = {
  motors: [
    { key: "main" as const, label: "Ana Kaldırma", motorPowerKw: 75, motorCount: 1, ratedCurrentA: 142, efficiencyPct: 95.4, powerFactor: 0.88, catalogSource: "INNOMOTICS 1LE1 75 kW" },
    { key: "trolley" as const, label: "Ana Araba Yürütme", motorPowerKw: 5.5, motorCount: 2, ratedCurrentA: 11.4, efficiencyPct: 89.6, powerFactor: 0.82, catalogSource: "SEW DRN 5,5 kW" },
    { key: "bridge" as const, label: "Köprü Yürütme", motorPowerKw: 5.5, motorCount: 4, ratedCurrentA: 11.4, efficiencyPct: 89.6, powerFactor: 0.82, catalogSource: "SEW DRN 5,5 kW" },
  ],
  festoon: { circuitKeys: ["main" as const, "trolley" as const], loopHeightM: 1.5, trolleyCount: 8, sourceLabel: "Ana araba yürütme · feston sistemi" },
};

export function ElectricalPreviewClient() {
  const [inputs, setInputs] = useState<ElectricalInputs>({
    ...DEFAULT_ELECTRICAL_INPUTS,
    festoonCircuitKeys: ["main", "trolley"],
    festoonCircuitKeysAuto: true,
  });
  const [selections, setSelections] = useState<ElectricalSelections>(DEFAULT_ELECTRICAL_SELECTIONS);
  const result = useMemo(() => computeElectrical(
    { ...NEW_WORK_SPECS, hasElectricalCalculation: "yes", ambientTempMaxC: 40, trolleyPowerSupply: "festoon" },
    inputs,
    selections,
    deps,
  ), [inputs, selections]);
  return (
    <main className="min-h-dvh bg-background p-3 text-foreground sm:p-5">
      <div className="mx-auto grid max-w-[1680px] gap-8">
        <header className="border-b pb-3">
          <h1 className="text-lg font-semibold">Elektrik Hesap Raporu · 0026 Benzeri Geliştirme Önizlemesi</h1>
          <p className="mt-1 text-xs text-muted-foreground">40 °C · kayıt yapılmaz · motor katalog akımı, VDE düzeltme izi ve tek/çift kat feston şeması birlikte sınanır.</p>
        </header>
        {(["drives", "cables", "festoon"] as const).map((mode, index) => (
          <section key={mode} className="grid gap-3">
            <h2 className="font-mono text-sm font-semibold text-primary">12.{index + 1} · {mode === "drives" ? "Sürücü Ön Seçimi" : mode === "cables" ? "Motor ve Ana Besleme Kabloları" : "Feston Kablo Yerleşimi"}</h2>
            <ElectricalModuleEditor mode={mode} inputs={inputs} selections={selections} values={result.values} onInputsChange={setInputs} onSelectionsChange={setSelections} />
          </section>
        ))}
      </div>
    </main>
  );
}
