"use client";
import { useState } from "react";
import type { CalcInput } from "@/lib/calc/engine";
import type { ExternalReviewEvidence, SelectionTrace } from "@/lib/auto-selection/types";
import { externalReviewIssues, externalReviewRequirement, selectionReviewComplete, selectionReviewHash } from "@/lib/auto-selection/trace";
import { Button } from "@/components/ui/button";

export function AutoSelectionReview({ trace, input, readOnly, onChange }: { trace: SelectionTrace; input: CalcInput; readOnly: boolean; onChange: (trace: SelectionTrace) => void }) {
  const [notes, setNotes] = useState(trace.review?.notes ?? {});
  const [evidence, setEvidence] = useState<Record<string, ExternalReviewEvidence>>(trace.review?.evidence ?? {});
  const issues = externalReviewIssues(trace);
  if (!issues.length) return null;
  const complete = selectionReviewComplete(trace, input);
  const draft: SelectionTrace = { ...trace, review: { inputHash: selectionReviewHash(input), notes, evidence, reviewedAt: new Date().toISOString() } };
  return <details><summary className="oc-tap cursor-pointer">Üretici ve imalat kontrol notları ({issues.length}){complete ? " · Kaydedildi" : " · Bekliyor"}</summary>
    <p className="py-2 text-muted-foreground">Eksik veriyi raporda tamamlayın. Kontrolün belgesini, sayfa/model veya hesap revizyonunu ve sonucunu ayrı kaydedin. Sayısal hatalar bu kayıtla geçerli olmaz; rapor değişirse yeniden kontrol gerekir.</p>
    <div className="max-h-96 space-y-4 overflow-y-auto">{issues.map(issue => {
      const proof = evidence[issue.code] ?? { source: "", reference: "", method: "manufacturer" as const };
      const metric = externalReviewRequirement(issue, input);
      const change = (patch: Partial<ExternalReviewEvidence>) => setEvidence({ ...evidence, [issue.code]: { ...proof, ...patch } });
      return <fieldset key={issue.code} className="space-y-2 rounded-md border p-3"><legend className="px-1 text-sm font-medium">{issue.message}</legend>
        {trace.version !== "1.0.0" && <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Kontrol türü<select className="oc-tap w-full rounded-md border bg-background p-2 text-base" value={proof.method} disabled={readOnly} onChange={event => change({ method: event.target.value as ExternalReviewEvidence["method"] })}><option value="manufacturer">Üretici belgesi</option><option value="calculation">Ayrı hesap</option><option value="measurement">Ölçüm / imalat kaydı</option></select></label>
          <label className="text-sm">Belge / kaynak<input className="oc-tap w-full rounded-md border bg-background p-2 text-base" value={proof.source} readOnly={readOnly} maxLength={4000} onChange={event => change({ source: event.target.value })} /></label>
          <label className="text-sm">Sayfa, model ve revizyon<input className="oc-tap w-full rounded-md border bg-background p-2 text-base" value={proof.reference} readOnly={readOnly} maxLength={4000} onChange={event => change({ reference: event.target.value })} /></label>
          {metric && <label className="text-sm">Doğrulanan sınır ({metric.unit}) · en az {metric.required.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}<input type="number" step="any" min={metric.required} className="oc-tap w-full rounded-md border bg-background p-2 text-base" value={proof.value ?? ""} readOnly={readOnly} onChange={event => change({ value: event.target.value === "" ? undefined : Number(event.target.value), unit: metric.unit })} /></label>}
        </div>}
        <label className="block text-sm">Kontrol sonucu ve uygulama koşulları<textarea className="w-full rounded-md border bg-background p-2 text-base" rows={2} value={notes[issue.code] ?? ""} maxLength={4000} readOnly={readOnly} onChange={event => setNotes({ ...notes, [issue.code]: event.target.value })} /></label>
      </fieldset>;
    })}</div>
    {!readOnly && <Button type="button" variant="outline" className="oc-tap mt-3" disabled={!selectionReviewComplete(draft, input)} onClick={() => onChange(draft)}>Kontrol belgelerini bu hesapla ilişkilendir</Button>}
  </details>;
}
