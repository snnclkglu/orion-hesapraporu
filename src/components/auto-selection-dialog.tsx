"use client";

import { useEffect, useRef, useState } from "react";
import { WandSparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoSelectionDecisions } from "@/components/auto-selection-decisions";
import { activeBrandKeys, availableBrands, normalizedBrands, type CatalogFamily } from "@/lib/auto-selection/brands";
import { loadCatalogManifest, loadSelectionCatalog } from "@/lib/auto-selection/catalog-client";
import { selectionCatalogFilter } from "@/lib/auto-selection/catalog-scope";
import { selectionScopeIssues } from "@/lib/auto-selection/scope";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND_LABELS, type Brands, type EquipmentRow, type SelectionProgress, type SelectionProposal, type SelectionRequest } from "@/lib/auto-selection/types";
import { MODULE_LABELS, isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";

type Props = {
  revisionId: string;
  request: Omit<SelectionRequest, "brands" | "locks" | "sizeDesigns" | "speedTolerancePct" | "enableStructuralChecks">;
  onApply: (proposal: SelectionProposal) => string | undefined;
  /** Geliştirme önizlemesi aynı bileşeni sabit katalogla çalıştırır. */
  previewRows?: EquipmentRow[];
};
export function AutoSelectionDialog({ revisionId, request, onApply, previewRows }: Props) {
  const [open, setOpen] = useState(false);
  const [families, setFamilies] = useState<CatalogFamily[] | null>(previewRows ?? null);
  const [brands, setBrands] = useState<Brands>({});
  const [locks, setLocks] = useState<string[]>([]);
  const [sizeDesigns, setSizeDesigns] = useState(true);
  const [enableStructuralChecks, setEnableStructuralChecks] = useState(true);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<SelectionProgress | null>(null);
  const [result, setResult] = useState<SelectionProposal | null>(null);
  const worker = useRef<Worker | null>(null);
  const catalogVersion = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const applyRef = useRef(onApply);
  useEffect(() => { applyRef.current = onApply; }, [onApply]);
  useEffect(() => () => { worker.current?.terminate(); controller.current?.abort(); }, []);
  function cancel() { worker.current?.terminate(); worker.current = null; controller.current?.abort(); setRunning(false); setLoading(false); setProgress(null); }
  async function show() {
    setOpen(true); setError(""); setResult(null);
    try { const saved: unknown = JSON.parse(localStorage.getItem("orion.auto-selection.brands.v1") ?? "{}"); if (saved && typeof saved === "object") setBrands(normalizedBrands(Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in BRAND_LABELS && typeof v === "string")))); } catch { /* Depolama kapalıyken de çalışır. */ }
    if (previewRows) return;
    const abort = new AbortController(); controller.current = abort; setLoading(true);
    try {
      const manifest = await loadCatalogManifest(revisionId, abort.signal);
      if (!abort.signal.aborted) { catalogVersion.current = manifest.version; setFamilies(manifest.families); }
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Katalog okunamadı."); }
    finally { if (!abort.signal.aborted) { setLoading(false); setProgress(null); } }
  }
  async function start() {
    if (!families || running) return;
    setError(""); setResult(null); setRunning(true); setProgress({ stage: "Bağlı hesaplar ve katalog adayları değerlendiriliyor", completed: 0, total: 1, evaluations: 0 });
    try { localStorage.setItem("orion.auto-selection.brands.v1", JSON.stringify(brands)); } catch { /* Tercih kaydı zorunlu değil. */ }
    const abort = new AbortController(); controller.current = abort;
    try {
      const rows = previewRows ?? await loadSelectionCatalog(revisionId, catalogVersion.current!, selectionCatalogFilter({ ...request, brands }), abort.signal, setProgress);
      if (abort.signal.aborted) return;
    const current = new Worker(new URL("../lib/auto-selection/selection.worker.ts", import.meta.url));
    worker.current = current;
    current.onmessage = event => {
      if (worker.current !== current) return;
      if (event.data.type === "progress") setProgress(event.data.progress);
      else if (event.data.type === "error") { setError(event.data.message); cancel(); }
      else if (event.data.type === "result") {
        const proposal = event.data.proposal as SelectionProposal;
        const failure = applyRef.current(proposal);
        if (failure) setError(failure); else setResult(proposal);
        cancel();
      }
    };
    current.onerror = () => { if (worker.current === current) { setError("Seçim işlemi tamamlanamadı. Rapor değiştirilmedi."); cancel(); } };
    current.postMessage({ request: { ...request, brands, locks, sizeDesigns, enableStructuralChecks, speedTolerancePct: 5 }, rows });
    } catch (cause) { if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "Seçim başlatılamadı."); cancel(); } }
  }
  const brandKeys = activeBrandKeys(request);
  const scopeIssues = selectionScopeIssues({ ...request, brands, locks, sizeDesigns, speedTolerancePct: 5 }).filter(issue => issue.state === "unsupported" || issue.code.startsWith("scope.topology") || issue.code === "scope.combinedHoists");
  return <>
    <Button type="button" variant="outline" size="sm" className="oc-tap ml-auto gap-2" onClick={show}><WandSparkles className="size-4" />Hızlı otomatik seçim</Button>
    <Dialog open={open} onOpenChange={value => { if (!value) cancel(); setOpen(value); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Hızlı otomatik seçim</DialogTitle><DialogDescription>Teknik özelliklere göre ekipmanları birlikte seçer ve düzenlenebilir hesap taslağına uygular. Sonuç ve kalan kontroller aynı raporda görünür.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">{error}</p>}
        {loading || running ? <div className="space-y-3" role="status" aria-live="polite"><p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{progress?.stage ?? "Katalog hazırlanıyor"}</p><progress className="h-2 w-full" value={progress?.completed ?? 0} max={progress?.total || 1} /><Button variant="outline" className="oc-tap" onClick={cancel}>İptal et</Button></div> : result ? <div className="space-y-4">
          <p className="font-medium">{result.trace.decisions.length} ekipman seçimi taslağa uygulandı.</p>
          <p className="text-sm text-muted-foreground">{result.trace.status === "incomplete" ? "Hesapta tamamlanması gereken seçim veya veriler var. Aşağıdaki maddeleri raporda düzenleyebilirsiniz." : "Sayısal seçim tamamlandı; tasarım ve üretici kontrolleri incelenmeli."} Rapor henüz kaydedilmedi.</p>
          <AutoSelectionDecisions decisions={result.trace.decisions} />
          <details open><summary className="oc-tap cursor-pointer font-medium">Kalan kontroller ({result.trace.issues.length})</summary><ul className="max-h-60 space-y-2 overflow-y-auto pt-2">{result.trace.issues.map(issue => <li key={issue.code} className="text-sm">{issue.module ? `${MODULE_LABELS[issue.module]} · ` : ""}{issue.message}</li>)}</ul></details>
          <Button className="oc-tap w-full" onClick={() => setOpen(false)}>Raporda düzenlemeye devam et</Button>
        </div> : <>
          {scopeIssues.length > 0 && <details className="rounded-md border bg-muted/30 p-3"><summary className="oc-tap cursor-pointer text-sm font-medium">Bu taslakta ayrı doğrulanacak koşullar ({scopeIssues.length})</summary><ul className="space-y-2 pt-2 text-sm">{scopeIssues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul></details>}
          <div className="grid gap-3 sm:grid-cols-2">{brandKeys.map(key => {
            const available = availableBrands(families ?? [], key, request);
            return <label className="space-y-1 text-sm" key={key}><span>{BRAND_LABELS[key]}</span><select className="oc-tap w-full rounded-md border bg-background px-3 py-2 text-base" value={brands[key] ?? ""} onChange={event => setBrands({ ...brands, [key]: event.target.value })}><option value="">Uygun markalar arasından seç</option>{brands[key] && !available.includes(brands[key]!) && <option value={brands[key]}>Katalogda yok: {brands[key]}</option>}{available.map(brand => <option key={brand}>{brand}</option>)}</select></label>;
          })}</div>
          <label className="oc-tap flex items-center gap-3 text-sm"><input type="checkbox" checked={sizeDesigns} onChange={event => setSizeDesigns(event.target.checked)} />Tambur, mil ve kesit ölçüleri için hesapla uygun aday öner</label>
          {request.active.includes("girder") && <label className="oc-tap flex items-center gap-3 text-sm"><input type="checkbox" checked={enableStructuralChecks} onChange={event => setEnableStructuralChecks(event.target.checked)} />Buruşma ve başkiriş bölümlerini açıp taşıyıcı yapıyı birlikte değerlendir</label>}
          <details><summary className="oc-tap cursor-pointer text-sm font-medium">Korunacak bölümler</summary><div className="grid gap-2 pt-2 sm:grid-cols-2">{request.active.map(key => <label key={key} className="oc-tap flex items-center gap-2 text-sm"><input type="checkbox" checked={locks.includes(key)} onChange={event => setLocks(event.target.checked ? [...locks, key] : locks.filter(lock => lock !== key))} />{MODULE_LABELS[key]} seçimlerini koru</label>)}</div></details>
          <details><summary className="oc-tap cursor-pointer text-sm font-medium">Ekipman ve ölçü kilitleri</summary><div className="max-h-60 space-y-3 overflow-y-auto pt-2">{request.active.filter(key => isHoistKey(key) || isTravelKey(key)).map(key => {
            const hoist = isHoistKey(key);
            const choices = hoist ? [["2.1", "Halat"], ["2.4", "Motor"], ["2.3", "Redüktör"], ["2.5", "Fren"], ["2.6", "Motor kaplini"], ["2.7", "Tambur kaplini"], ["selections.drumDiaMm", "Tambur çapı"], ["inputs.shaftD2Mm", "Tambur rulman mili"]] : [["5.1", "Teker"], ["5.4", "Motor"], ["5.5", "Redüktör"], ["5.5b", "Fren"], ["inputs.shaftDiaMm", "Teker mili"]];
            return <fieldset key={key}><legend className="text-sm font-medium">{MODULE_LABELS[key]}</legend><div className="grid grid-cols-2 gap-1">{choices.map(([section, label]) => { const id = `${key}.${section}`; return <label key={id} className="oc-tap flex items-center gap-2 text-sm"><input type="checkbox" checked={locks.includes(id) || locks.includes(key)} disabled={locks.includes(key)} onChange={event => setLocks(event.target.checked ? [...locks, id] : locks.filter(lock => lock !== id))} />{label}</label>; })}</div></fieldset>;
          })}</div></details>
          <p className="text-xs text-muted-foreground">Gerçek hız hedefi: ±%5 firma toleransı. Fiziksel adetler ve ölçü teyitleri korunur. Seçimler sınırlı aday aramasıyla belirlenir; eksik veriler sonuçta listelenir.</p>
          <Button className="oc-tap w-full gap-2" disabled={!families} onClick={start}><WandSparkles className="size-4" />Hesap raporunu oluştur</Button>
          {error && <Button variant="outline" className="oc-tap" onClick={show}>Kataloğu tekrar yükle</Button>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
