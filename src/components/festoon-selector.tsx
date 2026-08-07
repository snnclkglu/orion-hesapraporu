"use client";

import { Badge } from "@/components/ui/badge";
import { FestoonSchematic } from "@/components/festoon-schematic";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_FESTOON_SPEC,
  FESTOON_CABLE_FORMS,
  FESTOON_CABLE_FORM_LABELS,
  FESTOON_SERIES_LABELS,
  FESTOON_SERIES_OPTIONS,
  festoonSeriesLabel,
  selectFestoon,
} from "@/lib/calc/festoon";
import type { FestoonSpec } from "@/lib/calc/types";
import { cn } from "@/lib/utils";

function fmt(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export function FestoonSelector({
  title,
  travelDistanceM,
  travelSpeedMpm,
  value,
  onChange,
  disabled,
}: {
  title: string;
  travelDistanceM: number | undefined;
  travelSpeedMpm: number | undefined;
  value: FestoonSpec | undefined;
  onChange: (next: FestoonSpec) => void;
  disabled?: boolean;
}) {
  const spec = { ...DEFAULT_FESTOON_SPEC, ...value };
  const selection = selectFestoon(spec, travelDistanceM, travelSpeedMpm);
  const update = (next: Partial<FestoonSpec>) => onChange({ ...spec, ...next });
  const selectedLabel = selection.complete
    ? festoonSeriesLabel(selection.selected)
    : "Kablo paketi yükünü giriniz";

  return (
    <section className="grid gap-3 border border-dashed bg-muted/20 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold tracking-tight">{title} · Feston Ön Seçimi</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hareket mesafesi <span className="font-mono">{fmt(selection.travelDistanceM)} m</span>
            {" · "}hız <span className="font-mono">{fmt(selection.travelSpeedMpm)} m/dak</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "font-normal",
            selection.pass === true && "border-success/30 bg-success/10 text-success",
            selection.pass === false && "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {selection.pass === true ? "Katalog sınırları uygun" : selection.pass === false ? "Katalog sınırı aşıldı" : "Bilgi bekleniyor"}
        </Badge>
      </div>

      <FestoonSchematic
        title={title}
        travelDistanceM={selection.travelDistanceM}
        trolleyCount={spec.trolleyCount}
        loopHeightM={spec.loopHeightM}
      />

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1.5 text-xs font-medium">
          Feston Tipi
          <Select
            value={spec.series}
            disabled={disabled}
            onValueChange={(series) => update({ series: series as FestoonSpec["series"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FESTOON_SERIES_OPTIONS.map((series) => (
                <SelectItem key={series} value={series}>{FESTOON_SERIES_LABELS[series]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Kablo Formu
          <Select
            value={spec.cableForm}
            disabled={disabled}
            onValueChange={(cableForm) => update({ cableForm: cableForm as FestoonSpec["cableForm"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FESTOON_CABLE_FORMS.map((form) => (
                <SelectItem key={form} value={form}>{FESTOON_CABLE_FORM_LABELS[form]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Kablo Taşıyıcı Adedi
          <Input
            type="number"
            min={1}
            step={1}
            value={spec.trolleyCount || ""}
            disabled={disabled}
            onChange={(event) => update({ trolleyCount: Number(event.target.value) || 0 })}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Hareketli Kablo Paketi
          <span className="relative">
            <Input
              className="pr-9"
              type="number"
              min={0}
              step={0.1}
              value={spec.cablePackageWeightKg || ""}
              disabled={disabled}
              onChange={(event) => update({ cablePackageWeightKg: Number(event.target.value) || 0 })}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">kg</span>
          </span>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Maksimum Loop Yüksekliği
          <span className="relative">
            <Input
              className="pr-8"
              type="number"
              min={0.1}
              step={0.1}
              value={spec.loopHeightM || ""}
              disabled={disabled}
              onChange={(event) => update({ loopHeightM: Number(event.target.value) || 0 })}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">m</span>
          </span>
        </label>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <p>Ön seçilen seri: <span className="font-mono text-foreground">{selectedLabel}</span></p>
        <p>Taşıyıcı başına yük: <span className="font-mono text-foreground">{fmt(selection.loadPerTrolleyKg)} kg</span></p>
        <p>Katalog kapasitesi: <span className="font-mono text-foreground">{selection.selected ? `${selection.selected.maxTrolleyLoadKg} kg · ${selection.selected.maxSpeedMpm} m/dak` : "—"}</span></p>
      </div>
      <p className="border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Şemadaki hareket mesafesi, taşıyıcı adedi ve loop yüksekliği canlı güncellenir. Bu ekran seri/adet ön seçimini hız ve taşıyıcı başına yükle doğrular. Kesin katalog parça kodu için I-kiriş flanş genişliği, kablo paketinin genişlik/yüksekliği ve minimum bükülme çapı teklif/imalat aşamasında doğrulanmalıdır.
      </p>
    </section>
  );
}
