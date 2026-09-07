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
    <span className="flex min-h-5 items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="min-w-0">{props.children}</span>
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
              const brand = pick.brand ?? row.drive?.brand ?? "Schneider Electric";
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
                    <div className="mt-1 text-[10px] text-muted-foreground">{row.ratedCurrentAutomatic ? "Motor gücü ve sistem kabullerinden hesaplandı." : "Manuel motor etiket akımı."}</div>
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
    <div className="grid min-w-[24rem] gap-1.5">
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
    { label: "Motor verimi", key: "motorEfficiencyPct", effective: values.settings.motorEfficiencyPct, suffix: "%", step: "0.1", autoKey: "motorEfficiencyAuto", info: "Şebekeden çekilen elektrik gücünü mil gücüne bağlar. Otomatik ön kabul %90'dır; katalog/etiket verimi varsa otomatiği kapatıp girin." },
    { label: "İzinli gerilim düşümü", key: "voltageDropLimitPct", effective: values.settings.voltageDropLimitPct, suffix: "%", step: "0.1", autoKey: "voltageDropLimitAuto", info: "Seçilen kabloda hesaplanan üç faz gerilim düşümünün üst sınırıdır. Otomatik ön kabul %3'tür; müşteri şartnamesi daha düşük bir sınır isteyebilir." },
    { label: "Ek akım düzeltme katsayısı", key: "currentDeratingFactor", effective: values.settings.currentDeratingFactor, step: "0.01", info: "Ortam sıcaklığı düzeltmesine ek olarak demetleme, döşeme veya şirket tasarım payını uygular. 1,00 ek azaltma yoktur; örneğin 0,85 kapasiteyi %15 azaltır." },
    { label: "Ana besleme eşzamanlılık", key: "mainDemandFactor", effective: values.settings.mainDemandFactor, step: "0.01", autoKey: "mainDemandFactorAuto", info: "Bütün motorların aynı anda tam yükte çalışmadığı kabulünü ana giriş akımına uygular. Otomatik ön kabul 0,75'tir; çalışma senaryosu gerektiriyorsa elle değiştirin." },
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        Bu tablo ön boyutlandırmadır. Kablo döşeme biçimi, aynı tava/demet düzeltmesi, ortam sıcaklığı, harmonikler,
        kısa devre termik dayanımı, PE kesiti ve koruma cihazı koordinasyonu elektrik projesinin sorumluluğunda kalır.
      </p>
    </div>
  );
}

function FestoonLayoutSvg({ values }: { values: ElectricalValues }) {
  const layout = values.festoon;
  const vbW = 220;
  const vbH = 184;
  const usableW = Math.max(1, layout.usableWidthMm);
  const usableH = Math.max(1, layout.usableHeightMm);
  const worldCenterX = usableW / 2;
  const halfW = Math.max(usableW / 2, ...layout.placements.map((p) => Math.abs(p.xMm - worldCenterX) + p.widthMm / 2));
  const halfH = Math.max(usableH / 2, ...layout.placements.map((p) => Math.abs(p.yMm) + p.heightMm / 2));
  const scale = Math.min(116 / (2 * halfW), 30 / (2 * halfH)) * 0.94;
  const centerX = 110;
  const centerY = 126;
  const cogX = centerX + layout.centerOffsetMm * scale;
  const dimensionLeft = centerX - usableW * scale / 2;
  const dimensionRight = centerX + usableW * scale / 2;
  return (
    <div className="border bg-[#fbfaf8] p-2 dark:bg-neutral-950">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-auto max-h-[470px] w-full" role="img" aria-label="Feston kablo arabası ve enine kablo yerleşimi">
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E7E5E4" /><stop offset="1" stopColor="#A8A29E" /></linearGradient>
          <marker id="dimArrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M0,0 L5,2.5 L0,5 Z" fill="#78716C" /></marker>
        </defs>
        {/* I profil ve dört tekerli taşıyıcının önden görünüşü. */}
        <rect x="34" y="10" width="152" height="5" rx="1" fill="#57534E" />
        <rect x="105" y="15" width="10" height="12" fill="#78716C" />
        <rect x="52" y="24" width="116" height="4" rx="1" fill="#44403C" />
        {[72, 92, 128, 148].map((x) => (
          <g key={x}>
            <circle cx={x} cy="31" r="9" fill="url(#steel)" stroke="#292524" strokeWidth="1.2" />
            <circle cx={x} cy="31" r="3" fill="#57534E" stroke="#1C1917" strokeWidth="0.7" />
          </g>
        ))}
        <polygon points="56,39 164,39 151,65 128,83 92,83 69,65" fill="url(#steel)" stroke="#292524" strokeWidth="1.2" />
        <rect x="102" y="43" width="16" height="31" rx="7" fill="#D6D3D1" stroke="#292524" strokeWidth="1" />
        <circle cx="110" cy="51" r="4" fill="#F5F5F4" stroke="#292524" strokeWidth="1" />
        <circle cx="110" cy="70" r="4" fill="#F5F5F4" stroke="#292524" strokeWidth="1" />
        <rect x="106" y="82" width="8" height="30" fill="#A8A29E" stroke="#292524" strokeWidth="1" />
        <polygon points="87,111 133,111 121,99 99,99" fill="#D6D3D1" stroke="#292524" strokeWidth="1" />
        {/* D çaplı bombeli kablo mesnedi ve delikli alt sıkma plakası. */}
        <path d="M43 132 Q110 101 177 132" fill="none" stroke="#57534E" strokeWidth="6" strokeLinecap="round" />
        <path d="M43 132 Q110 105 177 132" fill="none" stroke="#F5F5F4" strokeWidth="3.5" strokeLinecap="round" />
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
        <rect x="42" y="137" width="136" height="14" rx="2" fill="url(#steel)" stroke="#292524" strokeWidth="1.2" />
        {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={51 + i * 9} cy="144" r="1.4" fill="#57534E" />)}
        <line x1={cogX} y1="103" x2={cogX} y2="153" stroke="#991B1B" strokeWidth="1.5" strokeDasharray="3 2" />
        <polygon points={`${cogX - 3},103 ${cogX + 3},103 ${cogX},109`} fill="#991B1B" />
        <text x={cogX} y="99" fontSize="5" fontWeight="600" textAnchor="middle" fill="#991B1B">AG · {fmt(Math.abs(layout.centerOffsetMm), 1)} mm</text>
        <line x1={dimensionLeft} y1="158" x2={dimensionRight} y2="158" stroke="#78716C" strokeWidth="0.7" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)" />
        <line x1={dimensionLeft} y1="153" x2={dimensionLeft} y2="162" stroke="#78716C" strokeWidth="0.6" />
        <line x1={dimensionRight} y1="153" x2={dimensionRight} y2="162" stroke="#78716C" strokeWidth="0.6" />
        <text x={centerX} y="166" fontSize="5" textAnchor="middle" fill="#57534E">b2 = {fmt(layout.usableWidthMm, 0)} mm</text>
        <text x="184" y="128" fontSize="5" fill="#57534E">D = {fmt(layout.supportDiameterMm, 0)} mm</text>
        <text x="184" y="139" fontSize="5" fill="#57534E">s = {fmt(layout.usableHeightMm, 0)} mm</text>
        <text x={vbW / 2} y="178" fontSize="5.5" fontWeight="600" textAnchor="middle" fill="#292524">
          {layout.trolleyBrand} · {layout.trolleyModel} · {layout.rowCount} sıra
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
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
                  <option key={preset.id} value={preset.id}>{preset.brand} · {preset.model}</option>
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

        <div className="grid content-start gap-3">
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
