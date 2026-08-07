"use client";

import { Badge } from "@/components/ui/badge";
import { FestoonSchematic } from "@/components/festoon-schematic";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_FESTOON_SPEC,
  FESTOON_BRAND_LABELS,
  FESTOON_BRANDS,
  FESTOON_CABLE_FORMS,
  FESTOON_CABLE_FORM_LABELS,
  festoonProductCodeSummary,
  festoonSeriesLabel,
  festoonSeriesOptionLabel,
  festoonSeriesOptions,
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
  const spec = {
    ...DEFAULT_FESTOON_SPEC,
    ...value,
    // Eski revizyonlarda marka alanı yoktur; Conductix-Wampfler seçimi korunur.
    brand: value?.brand ?? DEFAULT_FESTOON_SPEC.brand!,
  };
  const selection = selectFestoon(spec, travelDistanceM, travelSpeedMpm);
  const seriesOptions = festoonSeriesOptions(spec.brand, spec.cableForm);
  const productCodes = festoonProductCodeSummary(selection.selected, spec.cableForm);
  const update = (next: Partial<FestoonSpec>) => onChange({ ...spec, ...next });
  const selectedLabel = selection.complete
    ? festoonSeriesLabel(selection.selected)
    : "Kablo paketi yükünü giriniz";

  return (
    <section className="grid min-w-0 gap-3 border border-dashed bg-muted/20 p-3.5">
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
          {selection.pass === false
            ? "Katalog sınırı aşıldı"
            : selection.pass === true && selection.speedPass === null
              ? "Yük uygun · hız teyidi gerekli"
              : selection.pass === true
                ? "Katalog sınırları uygun"
                : "Bilgi bekleniyor"}
        </Badge>
      </div>

      <FestoonSchematic
        title={title}
        travelDistanceM={selection.travelDistanceM}
        trolleyCount={spec.trolleyCount}
        loopHeightM={spec.loopHeightM}
      />

      <div className="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
          Feston Markası
          <Select
            value={spec.brand}
            disabled={disabled}
            onValueChange={(brand) => update({
              brand: brand as NonNullable<FestoonSpec["brand"]>,
              series: "auto",
            })}
          >
            <SelectTrigger className="w-full min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FESTOON_BRANDS.map((brand) => (
                <SelectItem key={brand} value={brand}>{FESTOON_BRAND_LABELS[brand]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
          Feston Serisi
          <Select
            value={spec.series}
            disabled={disabled}
            onValueChange={(series) => update({ series: series as FestoonSpec["series"] })}
          >
            <SelectTrigger className="w-full min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent>
              {seriesOptions.map((series) => (
                <SelectItem key={series} value={series}>{festoonSeriesOptionLabel(spec.brand, series, spec.cableForm)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
          Kablo Formu
          <Select
            value={spec.cableForm}
            disabled={disabled}
            onValueChange={(cableForm) => update({
              cableForm: cableForm as FestoonSpec["cableForm"],
              series: "auto",
            })}
          >
            <SelectTrigger className="w-full min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FESTOON_CABLE_FORMS.map((form) => (
                <SelectItem key={form} value={form}>{FESTOON_CABLE_FORM_LABELS[form]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
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
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
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
        <label className="grid min-w-0 gap-1.5 text-xs font-medium">
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
        <p>Katalog kapasitesi: <span className="font-mono text-foreground">{selection.selected ? `${selection.trolleyLoadLimitKg} kg · ${selection.selected.maxSpeedMpm ? `${selection.selected.maxSpeedMpm} m/dak` : "hız teyidi"}` : "—"}</span></p>
      </div>
      {productCodes ? (
        <p className="text-[11px] text-muted-foreground">
          Vasel kod şablonu: <span className="font-mono text-foreground">{productCodes}</span>
        </p>
      ) : null}
      <p className="border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Şemadaki hareket mesafesi, taşıyıcı adedi ve loop yüksekliği canlı güncellenir. Bu ekran seri/adet ön seçimini hız ve taşıyıcı başına yükle doğrular. Kesin katalog parça kodu için I-kiriş flanş genişliği, kablo paketinin genişlik/yüksekliği ve minimum bükülme çapı teklif/imalat aşamasında doğrulanmalıdır. Vasel serilerinde katalogda hız limiti belirtilmemişse hız, üreticiyle ayrıca teyit edilir.
      </p>
    </section>
  );
}
