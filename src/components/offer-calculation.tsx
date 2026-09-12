"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RevisionEditor } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { loadOfferItemCalculation, openOfferItemCalculation } from "@/app/(app)/offers/calculation-actions";
import { applyReportToOfferItem } from "@/lib/auto-selection/offer-bridge";
import { readSelectionTrace } from "@/lib/auto-selection/trace";
import { weightBreakdownFromRevision } from "@/lib/revision-load";
import type { OfferItem } from "@/lib/offers/types";

type Report = NonNullable<Awaited<ReturnType<typeof loadOfferItemCalculation>>["report"]>;
export function OfferCalculation({ item, offerRevisionId, beforeOpen, onChange }: { item: OfferItem; offerRevisionId: string; beforeOpen: () => Promise<boolean>; onChange: (item: OfferItem) => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportDirty, setReportDirty] = useState(false);
  const latest = useRef({ item, onChange, reportDirty });
  useEffect(() => { latest.current = { item, onChange, reportDirty }; }, [item, onChange, reportDirty]);
  useEffect(() => {
    function change(event: Event) { const detail = (event as CustomEvent).detail; if (detail?.revisionId === report?.revisionId) setReportDirty(!!detail.dirty); }
    window.addEventListener("orion:revision-dirty", change); return () => window.removeEventListener("orion:revision-dirty", change);
  }, [report?.revisionId]);
  const [preserved, setPreserved] = useState<string[]>([]);
  const [syncNotice, setSyncNotice] = useState<string>();
  async function show() {
    setBusy(true);
    try {
      if (!await beforeOpen()) return;
      const response = await openOfferItemCalculation(offerRevisionId, item.id);
      if (!("report" in response) || !response.report) { toast.error(response.error ?? "Hesap açılamadı."); return; }
      setSyncNotice("syncNotice" in response ? response.syncNotice : undefined);
      setReportDirty(false); setReport(response.report); setOpen(true);
    } catch { toast.error("Hesap raporu açılamadı; bağlantıyı kontrol edin."); }
    finally { setBusy(false); }
  }
  async function importReport() {
    if (reportDirty) { toast.error("Önce hesap raporundaki değişiklikleri kaydedin."); return; }
    setBusy(true);
    try {
      const response = await loadOfferItemCalculation(offerRevisionId, item.id);
      if (response.error || !response.report) { toast.error(response.error ?? "Hesap okunamadı."); return; }
      if (latest.current.item.id !== item.id || latest.current.reportDirty) { toast.error("Teklif kalemi veya hesap değişti. Kaydettikten sonra yeniden aktarın."); return; }
      const value = response.report;
      const applied = applyReportToOfferItem(latest.current.item, { projectId: value.projectId, revisionId: value.revisionId, revisionNo: value.revisionNo, input: value.input, craneType: value.craneType }, readSelectionTrace(value.inputs.autoSelection));
      latest.current.onChange(applied.item); setPreserved(applied.preserved); setOpen(false);
      toast.success("Kaydedilmiş hesap seçimleri teklif teknik tablosuna aktarıldı.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Hesap bilgileri aktarılamadı."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-md border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center gap-2"><Button type="button" className="oc-tap gap-2" variant="outline" disabled={busy} onClick={show}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}Hızlı hesap raporu</Button>
      {item.calculationSource && <><Button type="button" className="oc-tap" variant="outline" disabled={busy || reportDirty} onClick={importReport}>Hesaptan teknik bilgileri güncelle</Button><Link className="oc-tap inline-flex items-center text-sm underline" href={`/offers/hesap-raporlari/${item.calculationSource.projectId}/revisions/${item.calculationSource.revisionId}`}>Kaynak hesap · V{item.calculationSource.revisionNo}</Link></>}
    </div>
    {preserved.length > 0 && <p className="text-sm text-muted-foreground">Elle düzenlenen veya müşteri kapsamındaki satırlar korundu: {preserved.join(", ")}</p>}
    {item.calculationSource?.pending?.length ? <p className="text-sm text-muted-foreground">Ön hesapta {item.calculationSource.pending.length} kontrol bekliyor. Seçimi tamamlanmayan teknik satırlar aktarılmaz.</p> : null}
    <Dialog open={open} onOpenChange={value => { if (!value && reportDirty) { toast.error("Hesapta kaydedilmemiş değişiklikler var."); return; } setOpen(value); }}><DialogContent className="flex h-[92dvh] max-w-[98vw] flex-col gap-2 p-3 sm:max-w-[98vw] sm:p-3">
      <DialogHeader><DialogTitle>Teklif ön hesabı</DialogTitle><DialogDescription>Teknik özellikleri kontrol edin, hızlı seçimle markaları belirleyin. Düzenlemelerinizi Kaydet ile sakladıktan sonra teklif tablosuna aktarın.</DialogDescription></DialogHeader>
      {syncNotice && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{syncNotice}</p>}
      {report && <div className="min-h-0 flex-1 overflow-y-auto"><RevisionEditor bottomBar={false} key={`${report.revisionId}:${report.updatedAt}`} projectId={report.projectId} revisionId={report.revisionId}
        initial={report.full} initialDisabled={report.inputs.disabledModules ?? undefined} initialHidden={report.inputs.hiddenSections ?? undefined}
        initialHiddenDiagrams={report.inputs.hiddenDiagrams ?? undefined} initialAlts={report.selections.alts ?? undefined} initialSectionNotes={report.selections.sectionNotes ?? undefined}
        initialWeightBreakdown={weightBreakdownFromRevision(report.inputs)} initialSourceWarnings={report.inputs.offerTechnicalSource?.warnings}
        initialAutoSelection={readSelectionTrace(report.inputs.autoSelection)} initialUpdatedAt={report.updatedAt} readOnly={report.status === "issued"} craneType={item.craneType} /></div>}
      {reportDirty && <Button type="button" variant="outline" className="oc-tap" onClick={() => { setReportDirty(false); setOpen(false); }}>Hesaptaki kaydedilmemiş değişiklikleri bırak ve kapat</Button>}
      <Button type="button" className="oc-tap w-full shrink-0" disabled={busy || reportDirty} onClick={importReport}>Kaydedilmiş seçimleri teklif tablosuna aktar</Button>
    </DialogContent></Dialog>
  </div>;
}
