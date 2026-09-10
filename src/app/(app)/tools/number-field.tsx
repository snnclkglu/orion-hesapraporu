import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NumberField({
  id,
  label,
  value,
  onChange,
  unit = "mm",
  min = "0",
  step = "any",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-unit`}
          className="pr-14 font-mono tabular-nums"
          data-min={min}
          data-step={step}
        />
        <span id={`${id}-unit`} className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-[11px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
export function parseMetricNumber(value: string): number | undefined {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}
