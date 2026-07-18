"use client";

// Revizyon editörü: girdiler + seçimler solda, canlı hesap sonuçları ve
// ✓/✗ kontrolleri sağda. Excel'deki döngünün web karşılığı:
// girdiler talebi üretir -> mühendis bileşen seçer -> kontroller yeşil/kırmızı.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import {
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  SPEC_FIELDS,
  type FieldDef,
} from "@/lib/calc/fields";
import type { AnyCheck } from "@/lib/calc/types";
import type { HoistValues } from "@/lib/calc/modules/hoistGroup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveRevision } from "./actions";

function fmt(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

// ---------------------------------------------------------------- FieldGrid
function FieldGrid<T extends object>({
  fields, value, onChange, disabled,
}: {
  fields: FieldDef<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const v = (value as Record<string, unknown>)[f.key];
        const id = `f-${f.key}`;
        return (
          <div key={f.key} className="grid gap-1">
            <Label htmlFor={id} className="text-xs text-muted-foreground">
              {f.label}
              {f.unit ? ` [${f.unit}]` : ""}
            </Label>
            {f.type === "select" ? (
              <Select
                value={String(v)}
                onValueChange={(nv) => onChange({ ...value, [f.key]: nv })}
                disabled={disabled}
              >
                <SelectTrigger id={id} className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                className="h-8"
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={String(v ?? "")}
                disabled={disabled}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (f.type === "number") {
                    const n = parseFloat(raw.replace(",", "."));
                    onChange({ ...value, [f.key]: Number.isFinite(n) ? n : 0 });
                  } else {
                    onChange({ ...value, [f.key]: raw });
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Checks
function CheckRow({ check }: { check: AnyCheck }) {
  const range = check.op === "range";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">
          {check.label}
          {check.nonExcel && (
            <span className="ml-1 text-[10px] text-muted-foreground align-middle">(ek kontrol)</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {range
            ? `${fmt(check.provided)} ${check.unit} · izin: ${(check as { min: number }).min}…${(check as { max: number }).max}`
            : `gereken ${fmt((check as { required: number }).required)} · sağlanan ${fmt(check.provided)} ${check.unit}`}
          {check.standard ? ` · ${check.standard}` : ""}
        </div>
      </div>
      <Badge variant={check.pass ? "default" : "destructive"} className="shrink-0">
        {check.pass ? "✓ UYGUN" : "✗ UYGUN DEĞİL"}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------- Results
const RESULT_ROWS: { key: keyof HoistValues; label: string; unit: string; digits?: number }[] = [
  { key: "totalLoadKg", label: "Toplam yük", unit: "kg" },
  { key: "ropeLoadKg", label: "Halat yükü", unit: "kg" },
  { key: "requiredRopeSafety", label: "Gerekli halat emniyeti (Zp)", unit: "-" },
  { key: "actualRopeSafety", label: "Gerçekleşen halat emniyeti", unit: "-" },
  { key: "minDrumDiaMm", label: "Min tambur çapı (H·d)", unit: "mm" },
  { key: "drumCombinedStress", label: "Tambur bileşik gerilmesi", unit: "kg/cm²" },
  { key: "requiredGrooveLengthMm", label: "Gerekli oluk boyu", unit: "mm", digits: 1 },
  { key: "shaftCombinedStress", label: "Mil bileşik gerilmesi", unit: "kg/cm²" },
  { key: "drumWeldCombinedStress", label: "Tambur kaynağı gerilmesi", unit: "kg/cm²" },
  { key: "bearingLifeHours", label: "Rulman ömrü", unit: "saat", digits: 0 },
  { key: "drumRpm", label: "Tambur devri", unit: "d/dak" },
  { key: "drumTorqueKnm", label: "Tambur torku", unit: "kNm" },
  { key: "requiredGearboxTorqueKnm", label: "Gerekli redüktör torku", unit: "kNm" },
  { key: "requiredRatio", label: "Gerekli çevrim oranı", unit: "-" },
  { key: "ratioDeviationPct", label: "Oran sapması", unit: "%" },
  { key: "actualLiftSpeedMpm", label: "Gerçekleşen kaldırma hızı", unit: "m/dak" },
  { key: "motorInputTorqueNm", label: "Motor giriş torku", unit: "Nm" },
  { key: "requiredPowerAdjustedKw", label: "Gerekli motor gücü", unit: "kW" },
  { key: "requiredBrakeTorqueNm", label: "Gerekli fren torku", unit: "Nm" },
  { key: "requiredMotorCouplingTorqueNm", label: "Gerekli motor kaplini kapasitesi", unit: "Nm" },
  { key: "requiredDrumCouplingTorqueNm", label: "Gerekli tambur kaplini kapasitesi", unit: "Nm" },
];

function HoistResults({ values, checks }: { values: HoistValues; checks: AnyCheck[] }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hesap Sonuçları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1 text-sm">
            {RESULT_ROWS.map((r) => (
              <div key={r.key} className="flex justify-between border-b border-dashed py-1 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono tabular-nums">
                  {fmt(values[r.key] as number, r.digits ?? 2)} {r.unit !== "-" ? r.unit : ""}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kontroller</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {checks.map((c) => <CheckRow key={c.id} check={c} />)}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Editor
export function RevisionEditor({
  projectId, revisionId, readOnly, initial,
}: {
  projectId: string;
  revisionId: string;
  readOnly: boolean;
  initial: CalcInput;
}) {
  const [specs, setSpecs] = useState(initial.specs);
  const [mainInputs, setMainInputs] = useState(initial.mainHoist!.inputs);
  const [mainSel, setMainSel] = useState(initial.mainHoist!.selections);
  const [auxInputs, setAuxInputs] = useState(initial.auxHoist!.inputs);
  const [auxSel, setAuxSel] = useState(initial.auxHoist!.selections);
  const [pending, startTransition] = useTransition();

  const calcInput: CalcInput = useMemo(
    () => ({
      specs,
      mainHoist: { inputs: mainInputs, selections: mainSel },
      auxHoist: { inputs: auxInputs, selections: auxSel },
    }),
    [specs, mainInputs, mainSel, auxInputs, auxSel]
  );

  const result = useMemo(() => runCalc(calcInput), [calcInput]);

  const failCount = result.allChecks.filter((c) => !c.pass).length;

  function handleSave() {
    startTransition(async () => {
      const res = await saveRevision(projectId, revisionId, calcInput);
      if (res.error) toast.error(res.error);
      else toast.success("Revizyon kaydedildi.");
    });
  }

  function hoistTab(
    which: "main" | "aux",
    inputs: typeof mainInputs,
    setInputs: typeof setMainInputs,
    sel: typeof mainSel,
    setSel: typeof setMainSel
  ) {
    const moduleResult = which === "main" ? result.mainHoist! : result.auxHoist!;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Girdiler / Tasarım Kabulleri</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGrid fields={HOIST_INPUT_FIELDS} value={inputs} onChange={setInputs} disabled={readOnly} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Katalog Seçimleri</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGrid fields={HOIST_SELECTION_FIELDS} value={sel} onChange={setSel} disabled={readOnly} />
            </CardContent>
          </Card>
        </div>
        <HoistResults values={moduleResult.values} checks={moduleResult.checks} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
        <div className="text-sm">
          {failCount === 0 ? (
            <span className="text-green-700 dark:text-green-400 font-medium">
              ✓ Tüm kontroller uygun ({result.allChecks.length})
            </span>
          ) : (
            <span className="text-destructive font-medium">
              ✗ {failCount} kontrol uygun değil ({result.allChecks.length} kontrol)
            </span>
          )}
          <span className="ml-3 font-mono text-xs text-muted-foreground">motor v{result.engineVersion}</span>
        </div>
        {!readOnly && (
          <Button onClick={handleSave} disabled={pending} size="sm">
            {pending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="specs">
        <TabsList>
          <TabsTrigger value="specs">01 · Teknik Özellikler</TabsTrigger>
          <TabsTrigger value="main">02 · Ana Kaldırma</TabsTrigger>
          <TabsTrigger value="aux">03 · Yrd Kaldırma</TabsTrigger>
          <TabsTrigger value="checks">Kontrol Panosu</TabsTrigger>
        </TabsList>

        <TabsContent value="specs">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Teknik Özellikler</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGrid fields={SPEC_FIELDS} value={specs} onChange={setSpecs} disabled={readOnly} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="main">
          {hoistTab("main", mainInputs, setMainInputs, mainSel, setMainSel)}
        </TabsContent>

        <TabsContent value="aux">
          {hoistTab("aux", auxInputs, setAuxInputs, auxSel, setAuxSel)}
        </TabsContent>

        <TabsContent value="checks">
          <div className="grid gap-2">
            {result.allChecks.map((c) => <CheckRow key={c.id} check={c} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
