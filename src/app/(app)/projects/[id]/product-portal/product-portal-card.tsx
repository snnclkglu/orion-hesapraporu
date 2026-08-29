"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildNameplateSvg, productPortalUrl } from "@/lib/product-portal/nameplate";
import type {
  CraneUnitRow,
  CustomerPortalDto,
  PortalDocumentSelection,
  ProductIdentityField,
} from "@/lib/product-portal/types";
import type { ProductPortalWorkspace } from "@/lib/product-portal/data-server";
import {
  createNextProductPortalRevision,
  deleteCustomPortalDocument,
  issueProductPortalRevision,
  refreshProductPortalSources,
  rotateCraneUnitPassword,
  saveProductPortalDraft,
  setCraneUnitPortalEnabled,
  setupProductPortal,
  uploadCustomPortalDocument,
} from "./actions";

const FIELD_LABELS: Record<ProductIdentityField, string> = {
  manufacturer: "Üretici",
  product: "Ürün Adı",
  craneType: "Vinç Tipi",
  projectCode: "Proje / Ürün Kodu",
  productionYear: "Üretim Yılı",
  capacity: "Kaldırma Kapasitesi",
  span: "Açıklık",
  liftHeight: "Kaldırma Yüksekliği",
  dutyClass: "Çalışma Sınıfı",
  supplyVoltage: "Besleme Gerilimi",
  controlVoltage: "Kumanda Gerilimi",
  frequency: "Frekans",
  customer: "Müşteri",
  site: "Saha / Konum",
};

function DraftToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="oc-tap inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export function ProductPortalCard({
  projectId,
  canEdit,
  workspace,
  portalOrigin,
  logoDataUrl,
  embeddedFontsCss,
  draftPreview,
  publishedPreview,
}: {
  projectId: string;
  canEdit: boolean;
  workspace: ProductPortalWorkspace | null;
  portalOrigin: string;
  logoDataUrl: string;
  embeddedFontsCss: string;
  draftPreview: CustomerPortalDto | null;
  publishedPreview: CustomerPortalDto | null;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const displayRevision = workspace?.editableRevision ?? workspace?.revisions[0] ?? null;
  const [payload, setPayload] = useState(displayRevision?.payload ?? null);
  const [units, setUnits] = useState<CraneUnitRow[]>(workspace?.units ?? []);
  const [selectedUnitId, setSelectedUnitId] = useState(workspace?.units[0]?.id ?? "");
  const [previewMode, setPreviewMode] = useState<"draft" | "published">(
    workspace?.editableRevision ? "draft" : "published"
  );
  const [shownPassword, setShownPassword] = useState<{ unitId: string; value: string } | null>(null);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? units[0];

  const effectiveIdentity = useMemo(() => {
    if (!workspace || !payload) return null;
    return Object.fromEntries(workspace.identityFields.map((field) => [
      field.key,
      Object.prototype.hasOwnProperty.call(payload.overrides, field.key)
        ? String(payload.overrides[field.key] ?? "")
        : field.autoValue,
    ])) as typeof workspace.identity;
  }, [payload, workspace]);
  const nameplateSvg = useMemo(() => {
    if (!payload || !selectedUnit || !effectiveIdentity) return "";
    return buildNameplateSvg({
      widthMm: payload.plate.widthMm,
      heightMm: payload.plate.heightMm,
      serialNo: selectedUnit.serialNo,
      publicUrl: productPortalUrl(portalOrigin, selectedUnit.publicCode),
      identity: effectiveIdentity,
      hiddenFields: payload.hiddenFields,
      logoDataUrl,
      embeddedFontsCss,
      holeDiameterMm: payload.plate.holeDiameterMm,
      holeInsetMm: payload.plate.holeInsetMm,
    });
  }, [effectiveIdentity, embeddedFontsCss, logoDataUrl, payload, portalOrigin, selectedUnit]);
  const liveDraftPreview = useMemo<CustomerPortalDto | null>(() => {
    if (!draftPreview || !payload || !effectiveIdentity) return draftPreview;
    return {
      ...draftPreview,
      company: effectiveIdentity.manufacturer || draftPreview.company,
      portalTitle: payload.portal.title,
      note: payload.portal.note,
      supportEmail: payload.portal.supportEmail,
      product: effectiveIdentity.product,
      craneType: effectiveIdentity.craneType,
      productionYear: effectiveIdentity.productionYear,
      projectCode: effectiveIdentity.projectCode,
      files: payload.documents
        .filter((document) => document.included && document.ready)
        .map((document) => ({
          id: document.id,
          folderKey: document.folderKey,
          folderTitle: document.folderTitle,
          folderSort: document.folderSort,
          fileSort: document.fileSort,
          title: document.title,
          fileName: `${document.title}.pdf`,
          revisionLabel: document.sourceRevisionLabel,
          accessMode: document.accessMode,
          sizeBytes: 0,
          pageCount: 0,
        })),
    };
  }, [draftPreview, effectiveIdentity, payload]);

  function run(action: () => Promise<{ error?: string; warning?: string; ok?: boolean; password?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      toast.success(success);
    });
  }

  if (!workspace || !payload || !displayRevision) {
    return (
      <section className="border bg-card">
        <header className="border-b bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Tag className="size-4 text-primary" /> Vinç Kimliği</div>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_360px] lg:p-6">
          <div>
            <div className="oc-kicker text-muted-foreground">Otomatik Başlangıç</div>
            <h2 className="mt-3 text-xl font-bold">Projeden tek hamlede vinç kimliğini kurun</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              İş kalemi adedi, kalem numarası, proje künyesi, son hesap raporu, elektrik projesi ve yayımlanmış el kitabı okunur. Adet birden fazlaysa seri numaraları A/B/C olarak ayrılır; doküman paketi ortak kalır.
            </p>
            {canEdit && (
              <Button className="mt-5 min-h-11" disabled={pending} onClick={() => run(() => setupProductPortal(projectId), "Vinç kimliği oluşturuldu.")}>
                <Plus className="size-4" /> Kimliği Otomatik Oluştur
              </Button>
            )}
          </div>
          <div className="border bg-[#37474F] p-5 text-[#F4F1EF]">
            <Image src="/brand/orion-logo-white.svg" alt="ORION CRANES" width={788} height={96} className="h-auto w-[210px] max-w-full" />
            <div className="mt-7 font-mono text-[10px] tracking-[0.18em] text-white/60">BAŞLANGIÇ PLAKASI</div>
            <div className="mt-2 font-mono text-3xl font-semibold">240 × 160 mm</div>
            <p className="mt-4 text-xs leading-5 text-white/70">Koyu arduvaz · beyaz vektör logo · siyah/beyaz QR · baskı SVG çıktısı</p>
          </div>
        </div>
      </section>
    );
  }

  function setOverride(key: ProductIdentityField, value: string) {
    setPayload((current) => current ? ({
      ...current,
      overrides: { ...current.overrides, [key]: value },
    }) : current);
  }

  function resetOverride(key: ProductIdentityField) {
    setPayload((current) => {
      if (!current) return current;
      const overrides = { ...current.overrides };
      delete overrides[key];
      return { ...current, overrides };
    });
  }

  function setDocument(id: string, patch: Partial<PortalDocumentSelection>) {
    setPayload((current) => current ? ({
      ...current,
      documents: current.documents.map((document) => document.id === id ? { ...document, ...patch } : document),
    }) : current);
  }

  function save() {
    if (!payload || !workspace?.editableRevision) return;
    const revisionId = workspace.editableRevision.id;
    run(() => saveProductPortalDraft({
      projectId,
      revisionId,
      serialBase: payload.serialBase,
      plate: payload.plate,
      overrides: payload.overrides as Record<ProductIdentityField, string>,
      hiddenFields: payload.hiddenFields,
      portal: payload.portal,
      documents: payload.documents,
      units: units.map((unit) => ({ id: unit.id, serialNo: unit.serialNo })),
    }), "Taslak kaydedildi.");
  }

  function downloadNameplate() {
    if (!nameplateSvg || !selectedUnit) return;
    const safeSerial = selectedUnit.serialNo
      .replace(/[^A-Za-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90) || "vinc";
    const fileName = `${safeSerial}-ORION-VINC-KIMLIK-PLAKASI-${displayRevision?.revNo ?? 1}.svg`;
    const url = URL.createObjectURL(new Blob([nameplateSvg], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const preview = previewMode === "published" ? publishedPreview : liveDraftPreview;

  return (
    <div className="grid gap-4">
      <section className="border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Tag className="size-4 text-primary" /> Vinç Kimliği</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">ORTAK PAKET {`R${String(displayRevision.revNo).padStart(2, "0")}`} · {units.length} FİZİKSEL ÜNİTE</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.editableRevision && canEdit ? (
              <>
                <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => refreshProductPortalSources(projectId, displayRevision.id), "Kaynak önerileri yenilendi.")}><RefreshCw className="size-4" /> Kaynakları Yenile</Button>
                <Button variant="outline" className="min-h-11" disabled={pending} onClick={save}><Save className="size-4" /> Taslağı Kaydet</Button>
                <Button className="min-h-11" disabled={pending} onClick={() => run(() => issueProductPortalRevision(projectId, displayRevision.id), "Müşteri paketi yayımlandı.")}><Send className="size-4" /> Yayımla</Button>
              </>
            ) : canEdit ? (
              <Button className="min-h-11" disabled={pending} onClick={() => run(() => createNextProductPortalRevision(projectId), "Yeni portal sürümü açıldı.")}><Plus className="size-4" /> Yeni Sürüm</Button>
            ) : null}
          </div>
        </header>

        <div className="grid gap-5 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <div className="min-w-0 space-y-5">
            <section className="border">
              <header className="border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Fiziksel Üniteler · A/B/C</span></header>
              <div className="grid gap-3 p-3">
                <div className="flex flex-wrap gap-2">
                  {units.map((unit) => (
                    <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} className={`oc-tap min-h-11 border px-3 font-mono text-sm ${unit.id === selectedUnit?.id ? "border-primary bg-primary/[0.08] text-primary" : "bg-background"}`}>
                      {unit.suffix || "TEK"} · {unit.serialNo}
                    </button>
                  ))}
                </div>
                {units.map((unit) => (
                  <div key={unit.id} className="grid items-end gap-2 border-t pt-3 sm:grid-cols-[80px_minmax(0,1fr)_auto]">
                    <div><Label>Ünite</Label><div className="mt-2 font-mono font-semibold">{unit.suffix || "Tek"}</div></div>
                    <div><Label htmlFor={`serial-${unit.id}`}>Seri Numarası</Label><Input id={`serial-${unit.id}`} className="mt-1 font-mono" value={unit.serialNo} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setUnits((current) => current.map((row) => row.id === unit.id ? { ...row, serialNo: event.target.value } : row))} /></div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="min-h-11" disabled={!canEdit || pending} onClick={() => startTransition(async () => {
                        const result = await rotateCraneUnitPassword(projectId, unit.id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        if (result.password) setShownPassword({ unitId: unit.id, value: result.password });
                        toast.success("Yeni parola üretildi; yalnız şimdi gösteriliyor.");
                      })}><KeyRound className="size-4" /> {unit.hasPassword ? "Parolayı Yenile" : "Parola Oluştur"}</Button>
                      <Button type="button" variant={unit.portalEnabled ? "destructive" : "outline"} className="min-h-11" disabled={!canEdit || pending} onClick={() => run(() => setCraneUnitPortalEnabled(projectId, unit.id, !unit.portalEnabled), unit.portalEnabled ? "Müşteri erişimi durduruldu." : "Müşteri erişimi açıldı.")}>
                        {unit.portalEnabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {unit.portalEnabled ? "Erişimi Kapat" : "Erişimi Aç"}
                      </Button>
                    </div>
                    {shownPassword?.unitId === unit.id && (
                      <div className="sm:col-span-3 border border-primary/35 bg-primary/[0.06] p-3">
                        <div className="oc-kicker text-primary">Yalnız Bir Kez Gösterilir</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><code className="border bg-background px-3 py-2 text-base font-semibold">{shownPassword.value}</code><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(shownPassword.value)}><Clipboard className="size-4" /> Kopyala</Button></div>
                        <p className="mt-2 text-xs text-muted-foreground">Açık parola saklanmaz. Kaybedilirse mevcut parola görüntülenmez; yenisi üretilir ve eski oturumlar kapanır.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Otomatik Kimlik Alanları</span><Badge variant="outline">Kaynak + Elle Override</Badge></header>
              <div className="grid gap-3 p-3 sm:grid-cols-2">
                {workspace.identityFields.map((field) => {
                  const overridden = Object.prototype.hasOwnProperty.call(payload.overrides, field.key);
                  const value = overridden ? String(payload.overrides[field.key] ?? "") : field.autoValue;
                  return (
                    <div key={field.key} className="border p-3">
                      <div className="flex items-center justify-between gap-2"><Label htmlFor={`field-${field.key}`}>{FIELD_LABELS[field.key]}</Label>{overridden && <button type="button" className="oc-tap inline-flex min-h-11 items-center gap-1 text-xs text-primary" onClick={() => resetOverride(field.key)}><RotateCcw className="size-3.5" /> Otomatiğe dön</button>}</div>
                      <Input id={`field-${field.key}`} className="mt-1" value={value} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setOverride(field.key, event.target.value)} />
                      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground"><span className="break-words">{overridden ? "ELLE DÜZENLENDİ" : field.source.label}</span><DraftToggle checked={!payload.hiddenFields.includes(field.key)} label="Plakada" onChange={(visible) => setPayload((current) => current ? ({ ...current, hiddenFields: visible ? current.hiddenFields.filter((key) => key !== field.key) : [...new Set([...current.hiddenFields, field.key])] }) : current)} /></div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border">
              <header className="border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Müşteri Portalı Metinleri</span></header>
              <div className="grid gap-3 p-3">
                <div><Label htmlFor="portal-title">Başlık</Label><Input id="portal-title" className="mt-1" value={payload.portal.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, title: event.target.value } })} /></div>
                <div><Label htmlFor="portal-note">Müşteriye Not</Label><Textarea id="portal-note" className="mt-1 min-h-24" value={payload.portal.note} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, note: event.target.value } })} /></div>
                <div><Label htmlFor="support-email">Şifre / Belge Destek E-postası</Label><Input id="support-email" type="email" className="mt-1" value={payload.portal.supportEmail} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, supportEmail: event.target.value } })} /></div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="oc-kicker text-muted-foreground">Baskı Önizlemesi</div><div className="mt-1 font-mono text-xs">{payload.plate.widthMm} × {payload.plate.heightMm} mm · SVG</div></div>{selectedUnit && <Button type="button" variant="outline" className="min-h-11 border-primary text-primary hover:text-primary" onClick={downloadNameplate}><Download className="size-4" /> Baskı SVG</Button>}</div>
              <div className="mt-3 overflow-hidden border bg-white p-2 [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: nameplateSvg }} />
              <div className="mt-3 grid grid-cols-2 gap-2"><div><Label>Genişlik (mm)</Label><Input type="number" min={120} value={payload.plate.widthMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, plate: { ...payload.plate, widthMm: Number(event.target.value) } })} /></div><div><Label>Yükseklik (mm)</Label><Input type="number" min={80} value={payload.plate.heightMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, plate: { ...payload.plate, heightMm: Number(event.target.value) } })} /></div></div>
              {selectedUnit && <p className="mt-3 break-all font-mono text-[10px] leading-5 text-muted-foreground">{productPortalUrl(portalOrigin, selectedUnit.publicCode)}</p>}
            </section>
          </aside>
        </div>
      </section>

      <section className="border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><FilePlus2 className="size-4 text-primary" /> Müşteriye Açılacak Dokümanlar</div><p className="mt-1 text-xs text-muted-foreground">Kaynaklar otomatik bulunur; son seçim, klasör ve erişim biçimi sizindir.</p></div>{workspace.editableRevision && canEdit && <div><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const form = new FormData(); form.set("file", file); run(() => uploadCustomPortalDocument(projectId, displayRevision.id, form), "Özel PDF eklendi."); event.target.value = ""; }} /><Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-4" /> PDF Ekle</Button></div>}</header>
        <div className="divide-y">
          {payload.documents.map((document) => (
            <div key={document.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[auto_minmax(220px,1fr)_180px_180px_auto] lg:items-center">
              <DraftToggle checked={document.included} label="Dahil" onChange={(included) => setDocument(document.id, { included })} />
              <div className="min-w-0"><Input value={document.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setDocument(document.id, { title: event.target.value })} /><div className="mt-1 break-words font-mono text-[10px] text-muted-foreground">{document.sourceLabel}{document.sourceRevisionLabel ? ` · ${document.sourceRevisionLabel}` : ""}</div></div>
              <div><Label>Klasör</Label><Input className="mt-1" value={document.folderTitle} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setDocument(document.id, { folderTitle: event.target.value })} /></div>
              <div><Label>Erişim</Label><select className="mt-1 min-h-11 w-full border bg-background px-2 text-sm" value={document.accessMode} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setDocument(document.id, { accessMode: event.target.value as PortalDocumentSelection["accessMode"] })}><option value="view_watermarked">Filigranlı görüntüle</option><option value="download">İndirmeye izin ver</option></select></div>
              <div className="flex items-center gap-2">{document.ready ? <Badge variant="outline"><Check className="size-3" /> Hazır</Badge> : <Badge variant="destructive">Eksik</Badge>}{document.sourceKind === "custom" && workspace.editableRevision && canEdit && <Button size="icon" variant="ghost" className="size-11 text-destructive" onClick={() => run(() => deleteCustomPortalDocument(projectId, displayRevision.id, document.id), "Özel belge silindi.")}><Trash2 className="size-4" /></Button>}</div>
            </div>
          ))}
          {payload.documents.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Henüz yayıma hazır kaynak bulunamadı.</div>}
        </div>
      </section>

      <section className="border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" /> Müşteri Ne Görüyor?</div><p className="mt-1 text-xs text-muted-foreground">Dış portalın gerçek sunum bileşeni; iç uygulama menüsü bu yüzün hiçbir yerinde yoktur.</p></div><div className="flex gap-2"><Button variant={previewMode === "draft" ? "default" : "outline"} onClick={() => setPreviewMode("draft")} disabled={!draftPreview}>Taslak</Button><Button variant={previewMode === "published" ? "default" : "outline"} onClick={() => setPreviewMode("published")} disabled={!publishedPreview}>Yayındaki</Button></div></header>
        {preview ? <div className="max-h-[850px] overflow-auto border-t"><CustomerPortalView dto={{ ...preview, preview: true, serialNo: selectedUnit?.serialNo ?? preview.serialNo, publicCode: selectedUnit?.publicCode ?? preview.publicCode }} /></div> : <div className="p-10 text-center text-sm text-muted-foreground"><LockKeyhole className="mx-auto mb-3 size-6" /> Henüz müşteri önizlemesi yok.</div>}
      </section>
    </div>
  );
}
