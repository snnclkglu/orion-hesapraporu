"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CABLE_BRANDS,
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
import { kimlikBuyuk } from "@/lib/tr-text";
import {
  CABLE_INSTALLATION_LABELS,
  type CableInstallationMode,
} from "@/lib/calc/electrical-ampacity";

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

function InfoButton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title} bilgi notu`}
          title="Bilgi notunu aç"
          className="oc-tap-square inline-flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          i
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[min(70dvh,34rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto">
        <div className="mb-2 text-xs font-semibold text-foreground">{title} · Bilgi Notu</div>
        <div className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function AutoToggle(props: {
  on: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onToggle(!props.on)}
      title={props.title ?? (props.on ? "Otomatik hesap açık — elle değiştirmek için kapatın" : "Otomatik hesapla")}
      className={cn(
        "oc-tap ml-auto inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[10px] transition-colors",
        props.on ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
        props.disabled && "pointer-events-none opacity-70"
      )}
    >
      <span aria-hidden>{props.on ? "●" : "○"}</span> OTOMATİK
    </button>
  );
}

function FieldLabel(props: {
  children: React.ReactNode;
  info?: React.ReactNode;
  auto?: { on: boolean; onToggle: (next: boolean) => void; disabled?: boolean; title?: string };
}) {
  return (
    <span className="flex min-h-5 w-full flex-wrap items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="min-w-0 flex-1">{props.children}</span>
      {props.info && <InfoButton title={typeof props.children === "string" ? props.children : "Alan"}>{props.info}</InfoButton>}
      {props.auto && <AutoToggle {...props.auto} />}
    </span>
  );
}

function TableHelp({ title, children }: { title: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{title}<InfoButton title={title}>{children}</InfoButton></span>;
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
              <th className="px-3 py-2 font-medium"><TableHelp title="Mekanizma / Motor">Motor gücü ve adedi hesap raporundaki seçilmiş mekanik katalog motorundan otomatik gelir; elektrik ekipman listesi oluşturulmaz.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Motor Akımı">Otomatikte I = P/(√3·U·cosφ·η) kullanılır. Motor etiket akımı mevcutsa otomatiği kapatıp gerçek etiket değerini girin.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Marka">Otomatik seçim varsayılan olarak Schneider Electric ailesinden en küçük uygun ağır hizmet sürücüsünü arar. Manuel modda ABB veya Siemens seçilebilir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Seri">Seri seçimi ürün ailesini sınırlar. Ağır hizmet akımı, motor gücü ve uygulamaya göre ATV320/340/930, ACS880-01 veya SINAMICS S120 seçilir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Model">Modelin katalog motor gücü ve sürekli çıkış akımı, hesaplanan/etiket motor akımının ikisini de karşılamalıdır.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Seçim Sonucu">Güç ve akım ayrı denetlenir. Yeşil iki sonuç ön seçim uygunluğunu; kırmızı sonuç daha büyük model veya farklı seri gereğini gösterir.</TableHelp></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {values.drives.map((row) => {
              const key = row.circuit.key;
              const pick = selections.drives[key] ?? {};
              const brand = kimlikBuyuk(pick.brand ?? row.drive?.brand ?? "SCHNEIDER ELECTRIC");
              const series = pick.series ?? row.drive?.series ?? driveSeriesFor(brand)[0] ?? "";
              const model = pick.model ?? row.drive?.model ?? "";
              const circuitInput = inputs.circuits[key] ?? {};
              const updateCircuit = (patch: Partial<typeof circuitInput>) => onInputsChange({
                ...inputs,
                circuits: { ...inputs.circuits, [key]: { ...circuitInput, ...patch } },
              });
              return (
                <tr key={key} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.circuit.label}</div>
                    <div className="mt-1 text-muted-foreground">
                      {fmt(row.circuit.motorPowerKw)} kW × {row.circuit.motorCount}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="mb-1 flex justify-end">
                      <AutoToggle
                        on={row.ratedCurrentAutomatic}
                        disabled={disabled}
                        onToggle={(on) => updateCircuit({
                          ratedCurrentAuto: on,
                          ratedCurrentA: on ? undefined : row.designCurrentA,
                        })}
                      />
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={row.ratedCurrentAutomatic ? row.designCurrentA : (circuitInput.ratedCurrentA ?? row.designCurrentA)}
                      disabled={disabled || row.ratedCurrentAutomatic}
                      onChange={(event) => {
                        const raw = event.target.value;
                        updateCircuit({ ratedCurrentAuto: false, ratedCurrentA: raw === "" ? undefined : numberValue(raw, row.designCurrentA) });
                      }}
                      className="w-28"
                    />
                    <div className="mt-1 max-w-64 text-[10px] leading-relaxed text-muted-foreground">{row.sourceNote}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">η %{fmt(row.resolvedEfficiencyPct, 1)} · cosφ {fmt(row.resolvedPowerFactor, 3)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="mb-1 flex justify-end">
                      <AutoToggle
                        on={row.automatic}
                        disabled={disabled}
                        onToggle={(on) => {
                          updateCircuit({ driveAuto: on });
                          if (!on && row.drive) updatePick(key, { brand: row.drive.brand, series: row.drive.series, model: row.drive.model });
                        }}
                      />
                    </div>
                    <select
                      className={cn(selectClass, "w-44")}
                      value={brand}
                      disabled={disabled || row.automatic}
                      onChange={(event) => {
                        const nextBrand = event.target.value;
                        const nextSeries = driveSeriesFor(nextBrand)[0] ?? "";
                        const nextModel = fittingModel(nextBrand, nextSeries, row.circuit.motorPowerKw, row.designCurrentA);
                        updatePick(key, {
                          brand: nextBrand,
                          series: nextSeries,
                          model: nextModel?.model,
                        });
                        updateCircuit({ driveAuto: false });
                      }}
                    >
                      {DRIVE_BRANDS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={cn(selectClass, "w-48")}
                      value={series}
                      disabled={disabled || row.automatic}
                      onChange={(event) => {
                        const nextSeries = event.target.value;
                        const nextModel = fittingModel(brand, nextSeries, row.circuit.motorPowerKw, row.designCurrentA);
                        updatePick(key, { series: nextSeries, model: nextModel?.model });
                        updateCircuit({ driveAuto: false });
                      }}
                    >
                      {driveSeriesFor(brand).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={cn(selectClass, "w-56 font-mono")}
                      value={model}
                      disabled={disabled || row.automatic}
                      onChange={(event) => {
                        const found = driveModelsFor(brand, series).find((x) => x.model === event.target.value);
                        updatePick(key, {
                          brand: found?.brand ?? brand,
                          series: found?.series ?? series,
                          model: event.target.value,
                        });
                        updateCircuit({ driveAuto: false });
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
  effectiveValue?: number;
  suffix?: string;
  step?: string;
  min?: number;
  disabled?: boolean;
  info?: React.ReactNode;
  auto?: { on: boolean; onToggle: (next: boolean) => void; title?: string };
  onChange: (value: number) => void;
}) {
  const locked = props.disabled || props.auto?.on;
  return (
    <label className="grid gap-1">
      <FieldLabel
        info={props.info}
        auto={props.auto ? { ...props.auto, disabled: props.disabled } : undefined}
      >{props.label}</FieldLabel>
      <span className="flex items-center gap-1">
        <Input
          type="number"
          min={props.min ?? 0}
          step={props.step ?? "0.1"}
          value={props.auto?.on ? (props.effectiveValue ?? props.value) : props.value}
          disabled={locked}
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
  requiredSectionMm2?: number;
  onChange: (articleNo: string) => void;
}) {
  const selected = cableByArticle(props.value) ?? powerCables[0];
  const brand = selected?.brand ?? CABLE_BRANDS[0];
  const brandList = powerCables.filter((x) => x.brand === brand);
  const shape = selected?.shape ?? brandList[0]?.shape ?? "round";
  const list = brandList.filter((x) => x.shape === shape);
  const chooseClosest = (candidates: typeof powerCables) => {
    const required = props.requiredSectionMm2 ?? selected?.sectionMm2 ?? 0;
    return [...candidates].sort((a, b) => {
      const aShort = (a.sectionMm2 ?? 0) < required ? 1 : 0;
      const bShort = (b.sectionMm2 ?? 0) < required ? 1 : 0;
      return aShort - bShort || Math.abs((a.sectionMm2 ?? 0) - required) - Math.abs((b.sectionMm2 ?? 0) - required);
    })[0];
  };
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <select
          aria-label="Kablo markası"
          className={selectClass}
          value={brand}
          disabled={props.disabled}
          onChange={(e) => {
            const candidates = powerCables.filter((x) => x.brand === e.target.value);
            const next = chooseClosest(candidates.filter((x) => x.shape === shape))?.articleNo
              ?? chooseClosest(candidates)?.articleNo;
            if (next) props.onChange(next);
          }}
        >
          {CABLE_BRANDS.filter((x) => powerCables.some((c) => c.brand === x)).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select
          aria-label="Kablo biçimi"
          className={selectClass}
          value={shape}
          disabled={props.disabled}
          onChange={(e) => {
            const next = chooseClosest(brandList.filter((x) => x.shape === e.target.value))?.articleNo;
            if (next) props.onChange(next);
          }}
        >
          {(["round", "flat"] as const).filter((value) => brandList.some((x) => x.shape === value)).map((value) => (
            <option key={value} value={value}>{value === "round" ? "Yuvarlak" : "Yassı"}</option>
          ))}
        </select>
      </div>
      <select
        aria-label="Kablo kataloğu ürünü"
        className={cn(selectClass, "w-full font-mono")}
        value={selected?.articleNo ?? ""}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {list.map((cable) => (
          <option key={cable.articleNo} value={cable.articleNo}>
            {cable.family} · {cable.construction} · {cable.shape === "round" ? `Ø${cable.widthMm}` : `${cable.widthMm}×${cable.heightMm}`} mm · {cable.weightKgPerM} kg/m{cable.shielded ? " · ekranlı" : ""}
          </option>
        ))}
      </select>
      {selected && (
        <span className="text-[10px] text-muted-foreground">
          {selected.brand} · katalog no {selected.articleNo} · {selected.festoonSuitable ? "hareketli/feston uygun" : "sabit tesis ürünü"}
        </span>
      )}
    </div>
  );
}

function CablesEditor(props: ElectricalModuleEditorProps) {
  const { inputs, selections, values, onInputsChange, onSelectionsChange, disabled } = props;
  if (!values) return null;
  const settings: Array<{
    label: string;
    key: keyof ElectricalInputs;
    effective: number;
    suffix?: string;
    step?: string;
    autoKey?: keyof ElectricalInputs;
    info: string;
  }> = [
    { label: "Hat gerilimi", key: "lineVoltageV", effective: values.settings.lineVoltageV, suffix: "V", step: "1", autoKey: "lineVoltageAuto", info: "Otomatikte Teknik Özellikler > Besleme Gerilimi metnindeki 380/400/415… V değeri okunur. Bu değer motor akımı ve gerilim düşümü hesabının paydasındadır." },
    { label: "Güç katsayısı", key: "powerFactor", effective: values.settings.powerFactor, step: "0.01", autoKey: "powerFactorAuto", info: "Motor etiket cosφ değeri bilinmiyorsa ön boyutlandırma için 0,85 kullanılır. Motor akımı hesabında düşük cosφ daha yüksek akım üretir." },
    { label: "Katalog verisi yoksa motor verimi", key: "motorEfficiencyPct", effective: values.settings.motorEfficiencyPct, suffix: "%", step: "0.1", autoKey: "motorEfficiencyAuto", info: "Bu %90 değeri yalnız seçilmiş motor katalog satırında anma akımı veya gerçek η/cosφ bulunmuyorsa geri dönüş kabulüdür. Normal durumda elektrik hesabı motor seçimi ekranındaki katalog anma akımını, ardından katalog η ve cosφ değerini kullanır; IEC verim sınıfı gerçek η yerine geçmez." },
    { label: "İzinli gerilim düşümü", key: "voltageDropLimitPct", effective: values.settings.voltageDropLimitPct, suffix: "%", step: "0.1", autoKey: "voltageDropLimitAuto", info: "Seçilen kabloda hesaplanan üç faz gerilim düşümünün üst sınırıdır. Otomatik ön kabul %3'tür; müşteri şartnamesi daha düşük bir sınır isteyebilir." },
    { label: "Ek akım düzeltme katsayısı", key: "currentDeratingFactor", effective: values.settings.currentDeratingFactor, step: "0.01", info: "Ortam sıcaklığı düzeltmesine ek olarak demetleme, döşeme veya şirket tasarım payını uygular. 1,00 ek azaltma yoktur; örneğin 0,85 kapasiteyi %15 azaltır." },
    { label: "Ana besleme yük katsayısı", key: "mainDemandFactor", effective: values.settings.mainDemandFactor, step: "0.01", autoKey: "mainDemandFactorAuto", info: "Otomatikte katsayı 1,00'dır ve en olumsuz senaryo olarak bütün seçili motorların akımları adetleriyle toplanır. M5–M8 sınıfı eşzamanlılık katsayısına çevrilmez. Yalnız tesisin kilitlemelerle tanımlanmış gerçek çalışma senaryosu varsa otomatiği kapatıp mühendis onaylı katsayı girin; raporda manuel olduğu görünür." },
    { label: "Varsayılan motor kablo boyu", key: "defaultMotorCableLengthM", effective: values.settings.defaultMotorCableLengthM, suffix: "m", step: "1", autoKey: "defaultMotorCableLengthAuto", info: "Devreye özel boy girilmemişse sürücü-motor arasındaki tek yön elektriksel uzunluk olarak kullanılır. Otomatik ön kabul 30 m'dir." },
    { label: "Ana besleme kablo boyu", key: "mainCableLengthM", effective: values.settings.mainCableLengthM, suffix: "m", step: "1", autoKey: "mainCableLengthAuto", info: "Besleme noktasından ana panoya kadar tek yön uzunluktur. Otomatik ön kabul 50 m'dir; güzergâh ölçüldüğünde manuel gerçek değer girilmelidir." },
  ];
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 border bg-muted/15 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {settings.map((setting) => {
          const autoOn = setting.autoKey ? Boolean(inputs[setting.autoKey]) : false;
          return (
          <NumericSetting
            key={setting.key}
            label={setting.label}
            value={inputs[setting.key] as number}
            effectiveValue={setting.effective}
            suffix={setting.suffix}
            step={setting.step}
            info={setting.info}
            auto={setting.autoKey ? {
              on: autoOn,
              onToggle: (on) => onInputsChange({
                ...inputs,
                [setting.key]: on ? inputs[setting.key] : setting.effective,
                [setting.autoKey as string]: on,
              }),
            } : undefined}
            disabled={disabled}
            onChange={(value) => onInputsChange({ ...inputs, [setting.key]: value })}
          />
          );
        })}
      </div>
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium"><TableHelp title="Devre">Hesap raporundaki her seçilmiş motor ayrı elektrik devresi olarak gelir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Akım / Boy">Akım motor gücünden, kablo boyu genel kabulden otomatik gelir. Etiket akımı ve gerçek güzergâh biliniyorsa ayrı ayrı manuel yapılabilir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Kablo Kataloğu">Önce marka, sonra yuvarlak/yassı biçim ve son olarak o gruptaki ürün seçilir. Fiziksel ölçü ile kg/m üretici katalog satırından gelir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Paralel">Aynı faz için paralel kablo koşusu adedidir. Otomatik hesap önce tek koşuyu, katalog sınırı yetmezse 2–4 koşuyu dener.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Gereken">Akım taşıma ve izinli gerilim düşümünü birlikte sağlayan en küçük kesit/koşu birleşimidir.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Dış Ölçü / Ağırlık">Yuvarlakta dış çap; yassıda en × kalınlık gösterilir. Ağırlık feston araba yükünde 2·loop yüksekliği ile çarpılır.</TableHelp></th>
              <th className="px-3 py-2 font-medium"><TableHelp title="Kontrol">Düzeltilmiş akım kapasitesi tasarım akımından büyük/eşit, gerilim düşümü izinli sınırdan küçük/eşit olmalıdır.</TableHelp></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {values.motorCables.map((row) => {
              const key = row.circuit.key;
              const circuit = inputs.circuits[key] ?? {};
              const pick = selections.motorCables[key] ?? {};
              const articleNo = pick.articleNo ?? row.selectedCable?.articleNo ?? powerCables[0]?.articleNo ?? "";
              const updateCircuit = (patch: Partial<typeof circuit>) => onInputsChange({
                ...inputs,
                circuits: { ...inputs.circuits, [key]: { ...circuit, ...patch } },
              });
              return (
                <tr key={key} className="align-top">
                  <td className="px-3 py-3 font-medium">{row.circuit.label}</td>
                  <td className="px-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1">
                        <span className="flex items-center text-[10px] text-muted-foreground">Akım [A]<AutoToggle on={row.ratedCurrentAutomatic} disabled={disabled} onToggle={(on) => updateCircuit({ ratedCurrentAuto: on, ratedCurrentA: on ? undefined : row.designCurrentA })} /></span>
                        <Input
                          type="number" min={0} step="0.1" className="w-28"
                          value={row.ratedCurrentAutomatic ? row.designCurrentA : (circuit.ratedCurrentA ?? row.designCurrentA)} disabled={disabled || row.ratedCurrentAutomatic}
                          onChange={(e) => updateCircuit({ ratedCurrentAuto: false, ratedCurrentA: numberValue(e.target.value, row.designCurrentA) })}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="flex items-center text-[10px] text-muted-foreground">Boy [m]<AutoToggle on={row.lengthAutomatic} disabled={disabled} onToggle={(on) => updateCircuit({ cableLengthAuto: on, cableLengthM: on ? undefined : row.lengthM })} /></span>
                        <Input
                          type="number" min={0} step="1" className="w-28"
                          value={row.lengthAutomatic ? row.lengthM : (circuit.cableLengthM ?? row.lengthM)} disabled={disabled || row.lengthAutomatic}
                          onChange={(e) => updateCircuit({ cableLengthAuto: false, cableLengthM: numberValue(e.target.value, row.lengthM) })}
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="mb-1 flex justify-end">
                      <AutoToggle
                        on={row.automatic}
                        disabled={disabled}
                        onToggle={(on) => {
                          updateCircuit({ cableAuto: on });
                          if (!on && row.selectedCable) onSelectionsChange({
                            ...selections,
                            motorCables: {
                              ...selections.motorCables,
                              [key]: { articleNo: row.selectedCable.articleNo, parallelRuns: row.selectedRuns },
                            },
                          });
                        }}
                      />
                    </div>
                    <CableSelect
                      value={articleNo} requiredSectionMm2={row.requiredSectionMm2} disabled={disabled || row.automatic}
                      onChange={(next) => {
                        onSelectionsChange({
                          ...selections,
                          motorCables: { ...selections.motorCables, [key]: { ...pick, articleNo: next } },
                        });
                        updateCircuit({ cableAuto: false });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number" min={1} max={4} step="1" className="w-20"
                      value={row.automatic ? row.selectedRuns : (pick.parallelRuns ?? row.selectedRuns)} disabled={disabled || row.automatic}
                      onChange={(e) => {
                        onSelectionsChange({
                          ...selections,
                          motorCables: {
                            ...selections.motorCables,
                            [key]: { ...pick, articleNo, parallelRuns: Math.max(1, Math.round(numberValue(e.target.value, 1))) },
                          },
                        });
                        updateCircuit({ cableAuto: false });
                      }}
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
                      <Status pass={row.voltageDropPct <= values.settings.voltageDropLimitPct}>ΔU %{fmt(row.voltageDropPct)}</Status>
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
                    <div className="mb-1 flex justify-end">
                      <AutoToggle
                        on={row.automatic}
                        disabled={disabled}
                        onToggle={(on) => {
                          onInputsChange({ ...inputs, mainCableAuto: on });
                          if (!on && row.selectedCable) onSelectionsChange({
                            ...selections,
                            mainCable: { articleNo: row.selectedCable.articleNo, parallelRuns: row.selectedRuns },
                          });
                        }}
                      />
                    </div>
                    <CableSelect
                      value={articleNo}
                      requiredSectionMm2={row.requiredSectionMm2}
                      disabled={disabled || row.automatic}
                      onChange={(next) => {
                        onSelectionsChange({ ...selections, mainCable: { ...pick, articleNo: next } });
                        onInputsChange({ ...inputs, mainCableAuto: false });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number" min={1} max={4} step="1" className="w-20"
                      value={row.automatic ? row.selectedRuns : (pick.parallelRuns ?? row.selectedRuns)} disabled={disabled || row.automatic}
                      onChange={(e) => {
                        onSelectionsChange({ ...selections, mainCable: { ...pick, articleNo, parallelRuns: Math.max(1, Math.round(numberValue(e.target.value, 1))) } });
                        onInputsChange({ ...inputs, mainCableAuto: false });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3 font-mono">{row.recommendedRuns} × {fmt(row.requiredSectionMm2, 1)} mm²</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.selectedCable ? <>{row.selectedCable.shape === "round" ? `Ø${fmt(row.selectedCable.widthMm, 1)}` : `${fmt(row.selectedCable.widthMm, 1)} × ${fmt(row.selectedCable.heightMm, 1)}`} mm<br />{fmt(row.selectedCable.weightKgPerM, 3)} kg/m</> : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Status pass={row.ampacityA >= row.designCurrentA}>I {fmt(row.ampacityA)} A</Status>
                      <Status pass={row.voltageDropPct <= values.settings.voltageDropLimitPct}>ΔU %{fmt(row.voltageDropPct)}</Status>
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-xs font-semibold">VDE akım taşıma düzeltmeleri ve hesap izi</h4>
          <InfoButton title="VDE akım taşıma hesabı">
            Ham kapasite, kullanıcı ekindeki VDE 0298 Part 4 özet tablosundan seçilir. Ek dokümanda baskı tarihi belirtilmemiştir; değerler 30 °C, 3 yüklü damar + PE ve sürekli çalışma temelindedir. Her katsayı ayrı gösterilir. Ara sıcaklık ve damar adedinde ihtiyatlı üst tablo satırı kullanılır. Kesintili çalışma artışı, görev çevrimi girilmedikçe uygulanmaz.
          </InfoButton>
        </div>
        {[...values.motorCables.map((row) => ({ kind: "motor" as const, row })), { kind: "main" as const, row: values.mainCable }].map((entry) => {
          const isMain = entry.kind === "main";
          const label = isMain ? "Ana Besleme" : entry.row.circuit.label;
          const motorCount = isMain ? 1 : entry.row.circuit.motorCount;
          const physicalCount = motorCount * entry.row.selectedRuns;
          const trace = entry.row.ampacityTrace;
          const circuit = isMain ? undefined : inputs.circuits[entry.row.circuit.key] ?? {};
          const updateCircuit = (patch: Record<string, unknown>) => {
            if (isMain) onInputsChange({ ...inputs, ...patch });
            else onInputsChange({
              ...inputs,
              circuits: { ...inputs.circuits, [entry.row.circuit.key]: { ...circuit, ...patch } },
            });
          };
          const installationAuto = isMain
            ? inputs.mainInstallationModeAuto
            : circuit?.installationModeAuto !== false;
          const installationMode = isMain
            ? inputs.mainInstallationMode
            : circuit?.installationMode ?? trace.installationMode;
          return (
            <article key={isMain ? "main-supply" : entry.row.circuit.key} className={cn("grid min-w-0 gap-3 border p-3", isMain && "border-primary/40 bg-primary/[0.03]")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h5 className="text-sm font-semibold">{label}</h5>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.row.selectedRuns} × {fmt(entry.row.selectedCable?.sectionMm2 ?? 0, 1)} mm² · {fmt(entry.row.lengthM, 1)} m · {isMain ? fmt(entry.row.designCurrentA) : fmt(entry.row.designCurrentA)} A
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Status pass={entry.row.ampacityA >= entry.row.designCurrentA}>Iz {fmt(entry.row.ampacityA)} A</Status>
                  <Status pass={entry.row.voltageDropPct <= values.settings.voltageDropLimitPct}>ΔU %{fmt(entry.row.voltageDropPct)}</Status>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: physicalCount }, (_, index) => {
                  const motorNo = Math.floor(index / entry.row.selectedRuns) + 1;
                  const runNo = index % entry.row.selectedRuns + 1;
                  return <Badge key={index} variant="outline" className="font-mono text-[10px]">{label}{motorCount > 1 ? ` M${motorNo}` : ""}{entry.row.selectedRuns > 1 ? ` P${runNo}` : ""} · {fmt(entry.row.designCurrentA / entry.row.selectedRuns)} A · Iz {fmt(entry.row.ampacityA / entry.row.selectedRuns)} A</Badge>;
                })}
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <label className="grid min-w-0 gap-1 sm:col-span-2">
                  <FieldLabel auto={{ on: installationAuto, disabled, onToggle: (on) => updateCircuit(isMain ? { mainInstallationModeAuto: on } : { installationModeAuto: on }) }} info="Otomatikte feston paketindeki motor devreleri 'havada serbest asılı', diğer motor devreleri ve ana besleme 'tek kablo, zemin üzerinde' tablosunu kullanır. Gerçek güzergâh farklıysa otomatiği kapatın.">Yerleşim biçimi</FieldLabel>
                  <select className={selectClass} value={trace.installationMode} disabled={disabled || installationAuto} onChange={(event) => updateCircuit(isMain ? { mainInstallationMode: event.target.value as CableInstallationMode, mainInstallationModeAuto: false } : { installationMode: event.target.value as CableInstallationMode, installationModeAuto: false })}>
                    {Object.entries(CABLE_INSTALLATION_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  {!installationAuto && installationMode !== trace.installationMode && <span className="text-[10px] text-destructive">Seçim yeniden hesaplanıyor…</span>}
                </label>
                <NumericSetting label="Yüklü damar" value={isMain ? inputs.mainLoadedConductors : circuit?.loadedConductors ?? 3} step="1" min={1} disabled={disabled} info="Aynı çok damarlı kabloda akım taşıyan damar adedidir. 3 damara kadar k=1,00; daha çok yüklü damarda ek tablodaki azaltma uygulanır." onChange={(value) => updateCircuit(isMain ? { mainLoadedConductors: value } : { loadedConductors: value })} />
                <NumericSetting label="Demet katsayısı" value={isMain ? inputs.mainGroupingFactor : circuit?.groupingFactor ?? 1} step="0.01" min={0.01} disabled={disabled} info="Aynı güzergâhtaki kabloların karşılıklı ısıl etkisi için proje girdisidir. Üretici/döşeme düzeni hesabından gelmelidir; bilinmiyorsa 1,00 gizli azaltma uygulamaz." onChange={(value) => updateCircuit(isMain ? { mainGroupingFactor: value } : { groupingFactor: value })} />
                <label className="grid gap-1">
                  <FieldLabel info="Boş bırakıldığında sürekli çalışma kabulü k=1,00'dır. Yalnız gerçek görev çevrimi doğrulanmışsa %15, 20, 25, 40 veya 60 tablosundan artış uygulanır; M sınıfından otomatik türetilmez.">Kesintili görev [%]</FieldLabel>
                  <Input type="number" min={15} max={100} step="1" value={(isMain ? inputs.mainDutyCyclePct : circuit?.dutyCyclePct) ?? ""} disabled={disabled} placeholder="Sürekli" onChange={(event) => updateCircuit(isMain ? { mainDutyCyclePct: event.target.value === "" ? undefined : numberValue(event.target.value, 100) } : { dutyCyclePct: event.target.value === "" ? undefined : numberValue(event.target.value, 100) })} />
                </label>
              </div>
              <div className="grid gap-1 bg-muted/30 p-2 font-mono text-[11px] leading-relaxed sm:grid-cols-[auto_1fr]">
                <span className="text-muted-foreground">Ham tablo:</span><span>{fmt(trace.rawAmpacityA)} A · {trace.installationLabel}</span>
                <span className="text-muted-foreground">Düzeltme:</span><span>{fmt(trace.rawAmpacityA)} × {fmt(trace.ambientFactor, 3)} (sıcaklık) × {fmt(trace.loadedConductorFactor, 3)} (damar) × {fmt(trace.groupingFactor, 3)} (demet) × {fmt(trace.projectFactor, 3)} (proje) × {fmt(trace.intermittentFactor, 3)} (görev) × {trace.parallelRuns} (paralel)</span>
                <span className="text-muted-foreground">Sonuç:</span><span className="font-semibold">{fmt(trace.correctedAmpacityA)} A</span>
                <span className="text-muted-foreground">Kaynak:</span><span>{trace.source}</span>
              </div>
              {trace.notes.length > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-300">Not: {trace.notes.join("; ")}</p>}
            </article>
          );
        })}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ana besleme otomatikte tüm seçili motorların aynı anda çalıştığı en olumsuz senaryo üzerinden hesaplanır; düzeltilmiş kapasite hiçbir eşzamanlılık katsayısıyla çarpılmaz. Katsayı yalnız manuel moda alınırsa yük akımını etkiler. Harmonikler, kısa devre termik dayanımı, PE kesiti ve koruma cihazı koordinasyonu nihai elektrik projesinde doğrulanmalıdır.
      </p>
    </div>
  );
}

function FestoonLayoutSvg({ values }: { values: ElectricalValues }) {
  const layout = values.festoon;
  const usableW = Math.max(1, layout.usableWidthMm);
  const rows = Array.from({ length: layout.rowCount }, (_, row) => layout.placements.filter((p) => p.row === row));
  const frontLeft = 252;
  const frontWidth = 150;
  const frontCenter = frontLeft + frontWidth / 2;
  const scale = Math.min(1.25, 132 / usableW);
  const supportLeft = frontCenter - usableW * scale / 2;
  const supportRight = frontCenter + usableW * scale / 2;
  const cogX = frontCenter + layout.centerOffsetMm * scale;
  const cableNode = (p: typeof layout.placements[number], rowIndex: number) => {
    const x = frontCenter + (p.xMm - usableW / 2) * scale;
    const rowTop = 111 + rowIndex * 36;
    const width = Math.max(4, p.widthMm * scale);
    const height = Math.max(4, p.heightMm * scale);
    return p.widthMm === p.heightMm
      ? <circle key={p.id} cx={x} cy={rowTop + height / 2} r={width / 2} fill={p.color} fillOpacity="0.82" stroke="#262626" strokeWidth="0.8"><title>{`${p.label} · ${p.family} ${p.construction}`}</title></circle>
      : <rect key={p.id} x={x - width / 2} y={rowTop} width={width} height={height} rx="1.5" fill={p.color} fillOpacity="0.82" stroke="#262626" strokeWidth="0.8"><title>{`${p.label} · ${p.family} ${p.construction}`}</title></rect>;
  };
  return (
    <div className="border bg-[#fbfaf8] p-2 dark:bg-neutral-950">
      <svg viewBox="0 0 440 214" className="h-auto max-h-[520px] w-full" role="img" aria-label="Feston kablo arabası yan görünüşü ve A-A kablo kesiti">
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E7E5E4" /><stop offset="1" stopColor="#A8A29E" /></linearGradient>
          <marker id="dimArrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M0,0 L5,2.5 L0,5 Z" fill="#78716C" /></marker>
        </defs>
        <text x="108" y="14" fontSize="8" fontWeight="700" textAnchor="middle" fill="#292524">YAN GÖRÜNÜŞ</text>
        <rect x="28" y="23" width="160" height="7" fill="#57534E" />
        {[68, 98, 128, 158].map((x) => <g key={x}><circle cx={x} cy="40" r="11" fill="url(#steel)" stroke="#292524" strokeWidth="1.4" /><circle cx={x} cy="40" r="3.5" fill="#57534E" /></g>)}
        <path d="M46 53 H170 L155 79 L130 95 H86 L61 79 Z" fill="url(#steel)" stroke="#292524" strokeWidth="1.4" />
        <rect x="103" y="55" width="11" height="48" fill="#A8A29E" stroke="#292524" />
        <path d="M45 118 Q108 91 171 118" fill="none" stroke="#57534E" strokeWidth="9" strokeLinecap="round" />
        <path d="M45 118 Q108 96 171 118" fill="none" stroke="#F5F5F4" strokeWidth="5" strokeLinecap="round" />
        {[[-34, "#D94A3A"], [-17, "#2F6FEB"], [0, "#0F9D8A"], [17, "#D94A3A"], [34, "#D94A3A"]].map(([offset, color], i) => (
          <path key={i} d={`M${108 + Number(offset)} 112 Q${108 + Number(offset)} 170 ${78 + Number(offset) * 0.25} 193`} fill="none" stroke={String(color)} strokeWidth="4" strokeLinecap="round" />
        ))}
        <rect x="42" y="121" width="132" height="10" rx="2" fill="url(#steel)" stroke="#292524" />
        <text x="108" y="207" fontSize="6.5" textAnchor="middle" fill="#57534E">Kablolar bombeli mesnedin altından loop oluşturur</text>

        <line x1="220" y1="8" x2="220" y2="204" stroke="#D6D3D1" />
        <text x="327" y="14" fontSize="8" fontWeight="700" textAnchor="middle" fill="#292524">A–A KESİTİ · {layout.rowCount === 1 ? "TEK KAT" : "ÇİFT KAT"}</text>
        <rect x="246" y="23" width="162" height="7" fill="#57534E" />
        {[278, 306, 348, 376].map((x) => <g key={x}><circle cx={x} cy="40" r="11" fill="url(#steel)" stroke="#292524" strokeWidth="1.4" /><circle cx={x} cy="40" r="3.5" fill="#57534E" /></g>)}
        <path d="M256 53 H398 L382 78 L354 92 H300 L272 78 Z" fill="url(#steel)" stroke="#292524" strokeWidth="1.4" />
        <rect x="322" y="55" width="10" height="36" fill="#A8A29E" stroke="#292524" />
        {/* Referans çizimindeki sıra: üst mesnet → kablolar → sıkma plakası. */}
        <path d={`M${supportLeft} 103 Q${frontCenter} 88 ${supportRight} 103`} fill="none" stroke="#57534E" strokeWidth="8" strokeLinecap="round" />
        <path d={`M${supportLeft} 103 Q${frontCenter} 93 ${supportRight} 103`} fill="none" stroke="#F5F5F4" strokeWidth="4" strokeLinecap="round" />
        {rows[0].map((p) => cableNode(p, 0))}
        <rect x={supportLeft} y="132" width={supportRight - supportLeft} height="9" rx="2" fill="url(#steel)" stroke="#292524" />
        {layout.rowCount === 2 && <>
          {rows[1].map((p) => cableNode(p, 1))}
          <rect x={supportLeft} y="168" width={supportRight - supportLeft} height="9" rx="2" fill="url(#steel)" stroke="#292524" />
        </>}
        <line x1={cogX} y1="96" x2={cogX} y2={layout.rowCount === 2 ? 181 : 146} stroke="#991B1B" strokeWidth="1.4" strokeDasharray="4 3" />
        <text x={cogX} y="91" fontSize="6" fontWeight="600" textAnchor="middle" fill="#991B1B">AG {fmt(Math.abs(layout.centerOffsetMm), 1)} mm</text>
        <line x1={supportLeft} y1="190" x2={supportRight} y2="190" stroke="#78716C" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
        <text x={frontCenter} y="201" fontSize="6" textAnchor="middle" fill="#57534E">b2 = {fmt(layout.usableWidthMm, 0)} mm · D = {fmt(layout.supportDiameterMm, 0)} mm</text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 bg-[#D94A3A]" />Güç</span>
        <span><i className="mr-1 inline-block size-2 bg-[#2F6FEB]" />Kumanda</span>
        <span><i className="mr-1 inline-block size-2 bg-[#0F9D8A]" />Sinyal</span>
        <span><i className="mr-1 inline-block h-3 w-px bg-black" />Ağırlık merkezi</span>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{kimlikBuyuk(layout.trolleyBrand)} · {layout.trolleyModel} · şema sıra sayısı ve seçilen fiziksel kablolarla dinamik güncellenir.</p>
    </div>
  );
}

const extraCableOptions = ELECTRICAL_CABLE_MODELS.filter((x) => x.purpose !== "power");

function ExtraCableCatalogSelect(props: { value: string; disabled?: boolean; onChange: (articleNo: string) => void }) {
  const selected = cableByArticle(props.value) ?? extraCableOptions[0];
  const brand = selected?.brand ?? CABLE_BRANDS[0];
  const brandList = extraCableOptions.filter((x) => x.brand === brand);
  const shape = selected?.shape ?? brandList[0]?.shape ?? "round";
  const list = brandList.filter((x) => x.shape === shape);
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <select aria-label="Ek kablo markası" className={selectClass} value={brand} disabled={props.disabled} onChange={(e) => {
          const next = extraCableOptions.find((x) => x.brand === e.target.value && x.shape === shape)
            ?? extraCableOptions.find((x) => x.brand === e.target.value);
          if (next) props.onChange(next.articleNo);
        }}>
          {CABLE_BRANDS.filter((x) => extraCableOptions.some((c) => c.brand === x)).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select aria-label="Ek kablo biçimi" className={selectClass} value={shape} disabled={props.disabled} onChange={(e) => {
          const next = brandList.find((x) => x.shape === e.target.value);
          if (next) props.onChange(next.articleNo);
        }}>
          {(["round", "flat"] as const).filter((value) => brandList.some((x) => x.shape === value)).map((value) => <option key={value} value={value}>{value === "round" ? "Yuvarlak" : "Yassı"}</option>)}
        </select>
      </div>
      <select aria-label="Ek kablo ürünü" className={selectClass} value={selected?.articleNo ?? ""} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
        {list.map((x) => <option key={x.articleNo} value={x.articleNo}>{x.family} · {x.construction} · {x.shape === "round" ? `Ø${x.widthMm}` : `${x.widthMm}×${x.heightMm}`} mm · {x.weightKgPerM} kg/m</option>)}
      </select>
    </div>
  );
}

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
      trolleyPresetAuto: false,
    });
  };
  const allCircuits = values.motorCables.map((x) => x.circuit);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <div className="grid content-start gap-4">
          <section className="grid gap-3 border bg-muted/15 p-3">
            <label className="grid gap-1">
              <FieldLabel
                info="Otomatik seçim önce tek sırayı ve kablo paketi genişlik/yüksekliği, minimum bükülme çapı ile loop kablo yükünü karşılayan en küçük katalog arabasını dener; gerekirse çift sıraya ve daha büyük arabaya geçer."
                auto={{
                  on: layout.trolleyAutomatic,
                  disabled,
                  onToggle: (on) => onInputsChange({
                    ...inputs,
                    trolleyPresetAuto: on,
                    ...(on ? {} : {
                      trolleyPresetId: layout.trolleyPresetId,
                      trolleyBrand: layout.trolleyBrand,
                      trolleyModel: layout.trolleyModel,
                      trolleyWidthMm: layout.trolleyWidthMm,
                      usableWidthMm: layout.usableWidthMm,
                      usableHeightMm: layout.usableHeightMm,
                      supportDiameterMm: layout.supportDiameterMm,
                      maxCableLoadKg: layout.maxCableLoadKg,
                    }),
                  }),
                }}
              >Feston arabası kataloğu</FieldLabel>
              <select className={selectClass} value={layout.trolleyAutomatic ? layout.trolleyPresetId : inputs.trolleyPresetId} disabled={disabled || layout.trolleyAutomatic} onChange={(e) => changePreset(e.target.value)}>
                {FESTOON_TROLLEY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{kimlikBuyuk(preset.brand)} · {preset.model}</option>
                ))}
                {inputs.trolleyPresetId === "custom" && <option value="custom">Özel · Elle girilen ölçüler</option>}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumericSetting label="Kullanılabilir en b2" value={layout.trolleyAutomatic ? layout.usableWidthMm : inputs.usableWidthMm} suffix="mm" step="1" disabled={disabled || layout.trolleyAutomatic} info="Kablo destek yüzeyinin iki yan sınırı arasındaki gerçek kullanılabilir genişliktir; Vasel çizimindeki b1 dış plaka genişliği değil b2 değeri kullanılır." onChange={(value) => onInputsChange({ ...inputs, usableWidthMm: value, trolleyPresetAuto: false, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Kullanılabilir yükseklik s" value={layout.trolleyAutomatic ? layout.usableHeightMm : inputs.usableHeightMm} suffix="mm" step="1" disabled={disabled || layout.trolleyAutomatic} info="Kablo paketinin sıkıştırılmadan yerleşebildiği düşey açıklıktır. Çift sırada iki sıra yüksekliği ve aradaki boşluk birlikte bu sınırı aşmamalıdır." onChange={(value) => onInputsChange({ ...inputs, usableHeightMm: value, trolleyPresetAuto: false, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Taşıyıcı çapı D" value={layout.trolleyAutomatic ? layout.supportDiameterMm : inputs.supportDiameterMm} suffix="mm" step="1" disabled={disabled || layout.trolleyAutomatic} info="Kablonun üzerine oturduğu bombeli mesnedin çapıdır. Kontrolde D, paketteki en büyük üretici minimum hareketli bükülme çapından küçük olamaz." onChange={(value) => onInputsChange({ ...inputs, supportDiameterMm: value, trolleyPresetAuto: false, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Azami kablo yükü" value={layout.trolleyAutomatic ? layout.maxCableLoadKg : inputs.maxCableLoadKg} suffix="kg" step="1" disabled={disabled || layout.trolleyAutomatic} info="Tek bir ara arabanın taşıyabileceği kablo yüküdür. Hesap paket kg/m değerini yaklaşık 2 × loop yüksekliği ile çarpar; araba gövde ağırlığı bu sınıra eklenmez." onChange={(value) => onInputsChange({ ...inputs, maxCableLoadKg: value, trolleyPresetAuto: false, trolleyPresetId: "custom", trolleyBrand: "Özel", trolleyModel: "Elle girilen ölçüler" })} />
              <NumericSetting label="Loop yüksekliği" value={inputs.loopHeightM} effectiveValue={layout.loopHeightM} suffix="m" step="0.1" disabled={disabled} info="Ardışık iki araba arasındaki asılı kablo halkasının yaklaşık düşey yüksekliğidir. Otomatikte Ana Araba Yürütme > Feston girdisindeki loop yüksekliğinden gelir." auto={{ on: layout.loopHeightAutomatic, onToggle: (on) => onInputsChange({ ...inputs, loopHeightAuto: on, loopHeightM: on ? inputs.loopHeightM : layout.loopHeightM }) }} onChange={(value) => onInputsChange({ ...inputs, loopHeightM: value, loopHeightAuto: false })} />
              <NumericSetting label="Kablo aralığı" value={inputs.cableGapMm} effectiveValue={layout.cableGapMm} suffix="mm" step="0.5" disabled={disabled} info="Komşu kablolar arasında çizim ve paketleme için bırakılan yatay/düşey boşluktur. Otomatik ön kabul 2 mm'dir; kelepçe üreticisinin şartı daha büyükse manuel girin." auto={{ on: layout.cableGapAutomatic, onToggle: (on) => onInputsChange({ ...inputs, cableGapAuto: on, cableGapMm: on ? inputs.cableGapMm : layout.cableGapMm }) }} onChange={(value) => onInputsChange({ ...inputs, cableGapMm: value, cableGapAuto: false })} />
            </div>
            <label className="grid gap-1">
              <FieldLabel info="Otomatikte önce tek sıra denenir; hiçbir katalog arabasında tüm kontroller sağlanmıyorsa çift sıra denenir. Manuel seçimde sıra sayısı sabit tutulur." auto={{ on: layout.rowCountAutomatic, disabled, onToggle: (on) => onInputsChange({ ...inputs, rowCountAuto: on, rowCount: on ? inputs.rowCount : layout.rowCount }) }}>Yerleşim sırası</FieldLabel>
              <select className={selectClass} value={layout.rowCountAutomatic ? layout.rowCount : inputs.rowCount} disabled={disabled || layout.rowCountAutomatic} onChange={(e) => onInputsChange({ ...inputs, rowCount: e.target.value === "2" ? 2 : 1, rowCountAuto: false })}>
                <option value={1}>Tek sıra</option>
                <option value={2}>Çift sıra</option>
              </select>
            </label>
          </section>

          <section className="grid gap-2 border p-3">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-semibold">Feston paketine giren motor devreleri</h4>
              <InfoButton title="Feston motor devreleri">Otomatikte teknik özellikte ana araba enerji beslemesi “Feston” seçilmişse ana kaldırma, yardımcı kaldırma ve ana araba yürütme devreleri mevcut motorlara göre pakete alınır. İşin gerçek kablo güzergâhı farklıysa otomatiği kapatıp kutuları değiştirin.</InfoButton>
              <AutoToggle on={layout.circuitKeysAutomatic} disabled={disabled} onToggle={(on) => onInputsChange({ ...inputs, festoonCircuitKeysAuto: on, festoonCircuitKeys: on ? inputs.festoonCircuitKeys : layout.circuitKeys })} />
            </div>
            {allCircuits.map((circuit) => (
              <label key={circuit.key} className="oc-tap flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={(layout.circuitKeysAutomatic ? layout.circuitKeys : inputs.festoonCircuitKeys).includes(circuit.key)}
                  disabled={disabled || layout.circuitKeysAutomatic}
                  onChange={(e) => onInputsChange({
                    ...inputs, festoonCircuitKeysAuto: false,
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

        <div className="order-first grid content-start gap-3">
          <FestoonLayoutSvg values={values} />
          <div className="flex flex-wrap gap-2">
            <Status pass={layout.fitsWidth}>En {fmt(layout.packageWidthMm, 1)} / {fmt(layout.usableWidthMm, 1)} mm</Status>
            <Status pass={layout.fitsHeight}>Yükseklik {fmt(layout.packageHeightMm, 1)} / {fmt(layout.usableHeightMm, 1)} mm</Status>
            <Status pass={layout.fitsBend}>D {fmt(layout.supportDiameterMm, 0)} / min. {fmt(layout.minimumSupportDiameterMm, 0)} mm</Status>
            <Status pass={layout.fitsLoad}>Yük {fmt(layout.trolleyCableLoadKg, 2)} / {fmt(layout.maxCableLoadKg, 0)} kg</Status>
            <Status pass={layout.fitsCableApplication}>{layout.fitsCableApplication ? "Hareketli kablo" : `${layout.unsuitableCableLabels.length} sabit tesis kablosu`}</Status>
            <Status pass={Math.abs(layout.centerOffsetMm) <= Math.max(2, layout.usableWidthMm * 0.05)}>AG sapması {fmt(Math.abs(layout.centerOffsetMm), 1)} mm</Status>
          </div>
          <p className="text-xs text-muted-foreground">
            Paket {fmt(layout.packageWeightKgPerM, 3)} kg/m. Otomatik yerleşim kabloların enine ağırlık merkezini araba orta eksenine yaklaştırır; kablo renkleri elektriksel görevi gösterir.
          </p>
          {!layout.fitsCableApplication && (
            <p className="border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              Festonda kullanıma açıkça uygun olmayan seçim: {layout.unsuitableCableLabels.join("; ")}. Hareketli/feston katalog ailesi seçin.
            </p>
          )}
        </div>
      </div>

      <section className="grid gap-3 border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-semibold">Ek kumanda ve sinyal kabloları</h4>
              <InfoButton title="Ek kumanda ve sinyal kabloları">Motor güç kablolarına ek olarak joystick, kontaktör kumandası, enkoder, haberleşme veya emniyet devrelerinin kablolarını ekleyin. Her adet paketin enini, ağırlığını, bükülme çapını ve ağırlık merkezini etkiler.</InfoButton>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">HELUKABEL ve ÜNTEL üretici satırlarından ölçü, ağırlık ve hareketli bükülme değeri okunur.</p>
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
                  articleNo: extraCableOptions.find((cable) => cable.festoonSuitable)?.articleNo ?? "19104",
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
                <div key={extra.id} className="grid gap-2 border bg-muted/10 p-2 sm:grid-cols-[1fr_2fr_8rem_6rem_auto] sm:items-end">
                  <label className="grid gap-1">
                    <FieldLabel info="Şemada ve müşteri raporunda görünecek devre adıdır; örneğin vinç kumandası, enkoder veya Profinet.">Devre adı</FieldLabel>
                    <Input value={extra.label} disabled={disabled} onChange={(e) => update({ label: e.target.value })} placeholder="Devre adı" />
                  </label>
                  <div className="grid gap-1">
                    <FieldLabel info="Marka ve biçim seçildiğinde yalnız o gruptaki üretici satırları listelenir. Ölçü, ağırlık ve bükülme yarıçapı seçilen satırdan alınır.">Kablo kataloğu</FieldLabel>
                    <ExtraCableCatalogSelect value={extra.articleNo} disabled={disabled} onChange={(articleNo) => {
                      const selected = cableByArticle(articleNo);
                      update({ articleNo, purpose: selected?.purpose ?? extra.purpose });
                    }} />
                  </div>
                  <label className="grid gap-1">
                    <FieldLabel info="Yalnız şemadaki renk ve rapor sınıflandırmasıdır: kumanda mavi, sinyal/haberleşme yeşil gösterilir.">İşlev</FieldLabel>
                    <select className={selectClass} value={extra.purpose} disabled={disabled} onChange={(e) => update({ purpose: e.target.value as CablePurpose })}>
                      <option value="control">Kumanda</option>
                      <option value="signal">Sinyal</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel info="Aynı tip kablodan pakete giren fiziksel adet. Her adet genişlik, kg/m ve ağırlık merkezi hesabına ayrı eklenir.">Adet</FieldLabel>
                    <Input type="number" min={1} step="1" value={extra.quantity} disabled={disabled} onChange={(e) => update({ quantity: Math.max(1, Math.round(numberValue(e.target.value, 1))) })} />
                  </label>
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
