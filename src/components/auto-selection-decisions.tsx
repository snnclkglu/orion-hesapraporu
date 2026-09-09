import type { SelectionDecision, SelectionEvidence } from "@/lib/auto-selection/types";
import { MODULE_LABELS } from "@/lib/calc/presentation/module-family";

const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
function comparison(check: SelectionEvidence) {
  return check.operator === "…"
    ? `${number(check.computed)} ${check.unit} · İzin verilen ${number(check.min)} … ${number(check.max)} ${check.unit}`
    : `${number(check.computed)} ${check.operator} ${number(check.limit)} ${check.unit}`;
}

/** Kayıtlı seçim anının gerekçesi; canlı rapor kontrollerinin yerini almaz. */
export function AutoSelectionDecisions({ decisions }: { decisions: SelectionDecision[] }) {
  return <details><summary className="oc-tap cursor-pointer font-medium">Seçilen ekipmanlar ve hesap dayanakları ({decisions.length})</summary>
    <p className="py-2 text-xs text-muted-foreground">Seçim tamamlandığı andaki bağlı hesap değerleridir. Sonraki düzenlemelerin güncel sonuçları rapor bölümlerinde görünür.</p>
    <ul className="max-h-80 space-y-2 overflow-y-auto">{decisions.map(decision => <li key={`${decision.module}.${decision.section}`}>
      <details className="rounded-md border p-2"><summary className="oc-tap cursor-pointer break-words text-sm">
        <span className="text-muted-foreground">{MODULE_LABELS[decision.module]} · {decision.label}: </span>{decision.row.brand} {decision.row.model}
      </summary>
        {decision.evidence?.length ? <ul className="space-y-2 pt-2">{decision.evidence.map(check => <li key={check.id} className="text-xs">
          <p className={check.pass ? "" : "text-destructive"}>{check.label} · {check.pass ? "Uygun" : "Kontrol gerekli"}</p>
          <p className="break-words tabular-nums">{comparison(check)}</p>
          {check.standard && <p className="text-muted-foreground">{check.standard}</p>}
        </li>)}</ul> : <p className="text-xs text-muted-foreground">Ayrıntılı kontroller ilgili hesap bölümündedir.</p>}
      </details>
    </li>)}</ul>
  </details>;
}
