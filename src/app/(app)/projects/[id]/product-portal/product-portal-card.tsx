"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  FilePlus2,
  History,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildNameplateSvg,
  createNameplateLayout,
  NAMEPLATE_TOGGLE_FIELDS,
  productPortalUrl,
  type NameplateInput,
} from "@/lib/product-portal/nameplate";
import {
  PORTAL_FOLDER_OPTIONS,
  type CraneUnitRow,
  type CustomerPortalDto,
  type PortalDocumentSelection,
  type PortalEquipmentDetail,
  type PortalReportLevel,
  type ProductIdentityField,
} from "@/lib/product-portal/types";
import type { ProductPortalWorkspace } from "@/lib/product-portal/data-server";
import {
  activateProductPortalRevision,
  createNextProductPortalRevision,
  deleteCustomPortalDocument,
  issueProductPortalRevision,
  refreshProductPortalSources,
  rotateCraneUnitPassword,
  saveProductPortalDraft,
  setCraneUnitPortalEnabled,
  setupProductPortal,
  uploadCustomPortalDocument,
  withdrawProductPortal,
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

const REPORT_LEVEL_LABELS: Record<PortalReportLevel, string> = {
  ozet: "Özet",
  standart: "Standart",
  detayli: "Detaylı",
  teker_yukleri: "Teker Yükleri",
};

const EQUIPMENT_DETAIL_LABELS: Record<PortalEquipmentDetail, string> = {
  standart: "Standart",
  detayli: "Detaylı · katalog ekleriyle",
};

const PLATE_TOGGLE_SET = new Set<ProductIdentityField>(NAMEPLATE_TOGGLE_FIELDS);

function DraftToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="oc-tap inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs has-disabled:cursor-not-allowed has-disabled:opacity-50">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

function safePlateName(serialNo: string, revNo: number, extension: "svg" | "pdf") {
  const safeSerial = serialNo
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90) || "vinc";
  return `${safeSerial}-ORION-VINC-KIMLIK-PLAKASI-R${String(revNo).padStart(2, "0")}.${extension}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function revisionDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("tr-TR");
}

export function ProductPortalCard({
  projectId,
  canEdit,
  workspace,
  portalOrigin,
  logoDataUrl,
  logoPaperDataUrl,
  customerLogoDataUrl,
  archivoBoldDataUrl,
  archivoExtraBoldDataUrl,
  plexDataUrl,
  embeddedFontsCss,
  draftPreview,
  publishedPreview,
}: {
  projectId: string;
  canEdit: boolean;
  workspace: ProductPortalWorkspace | null;
  portalOrigin: string;
  logoDataUrl: string;
  logoPaperDataUrl: string;
  customerLogoDataUrl: string | null;
  archivoBoldDataUrl: string;
  archivoExtraBoldDataUrl: string;
  plexDataUrl: string;
  embeddedFontsCss: string;
  draftPreview: CustomerPortalDto | null;
  publishedPreview: CustomerPortalDto | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pdfPending, setPdfPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const displayRevision = workspace?.editableRevision
    ?? workspace?.revisions.find((revision) => revision.id === workspace.currentRevisionId)
    ?? workspace?.revisions[0]
    ?? null;
  const [payload, setPayload] = useState(displayRevision?.payload ?? null);
  const [units, setUnits] = useState<CraneUnitRow[]>(workspace?.units ?? []);
  const [selectedUnitId, setSelectedUnitId] = useState(workspace?.units[0]?.id ?? "");
  const [previewMode, setPreviewMode] = useState<"draft" | "published">(
    workspace?.editableRevision ? "draft" : "published"
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shownPassword, setShownPassword] = useState<{ unitId: string; value: string } | null>(null);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? units[0];
  const hasIssuedRevision = Boolean(workspace?.revisions.some((revision) => revision.status === "issued"));

  const effectiveIdentity = useMemo(() => {
    if (!workspace || !payload) return null;
    return Object.fromEntries(workspace.identityFields.map((field) => [
      field.key,
      Object.prototype.hasOwnProperty.call(payload.overrides, field.key)
        ? String(payload.overrides[field.key] ?? "")
        : field.autoValue,
    ])) as typeof workspace.identity;
  }, [payload, workspace]);

  const portalUrl = selectedUnit
    ? productPortalUrl(portalOrigin, selectedUnit.publicCode)
    : "";
  const nameplateInput = useMemo<NameplateInput | null>(() => {
    if (!payload || !selectedUnit || !effectiveIdentity) return null;
    return {
      widthMm: payload.plate.widthMm,
      heightMm: payload.plate.heightMm,
      serialNo: selectedUnit.serialNo,
      publicUrl: productPortalUrl(portalOrigin, selectedUnit.publicCode),
      identity: effectiveIdentity,
      hiddenFields: payload.hiddenFields,
      logoDataUrl,
      customerLogoDataUrl,
      embeddedFontsCss,
      holeDiameterMm: payload.plate.holeDiameterMm,
      holeInsetMm: payload.plate.holeInsetMm,
    };
  }, [customerLogoDataUrl, effectiveIdentity, embeddedFontsCss, logoDataUrl, payload, portalOrigin, selectedUnit]);
  const nameplateSvg = useMemo(() => nameplateInput ? buildNameplateSvg(nameplateInput) : "", [nameplateInput]);
  const nameplateLayout = useMemo(() => nameplateInput ? createNameplateLayout(nameplateInput) : null, [nameplateInput]);

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

  function run(
    action: () => Promise<{ error?: string; warning?: string; ok?: boolean; password?: string }>,
    success: string,
    afterSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      toast.success(success);
      afterSuccess?.();
    });
  }

  if (!workspace || !payload || !displayRevision) {
    return (
      <section className="overflow-hidden border bg-card">
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
          <div className="border-l-8 border-primary bg-[#262626] p-5 text-[#F4F1EF]">
            <Image src="/brand/orion-logo-white.svg" alt="ORION CRANES" width={788} height={96} className="h-auto w-[210px] max-w-full" />
            <div className="mt-7 font-mono text-[10px] tracking-[0.18em] text-white/60">VİNÇ KİMLİK PLAKASI</div>
            <div className="mt-2 font-mono text-3xl font-semibold">240 × 160 mm</div>
            <p className="mt-4 text-xs leading-5 text-white/70">ORION kömür–kâğıt–kırmızı kimliği · müşteri logosu · şifreli QR · SVG ve PDF</p>
          </div>
        </div>
      </section>
    );
  }

  const activeWorkspace = workspace;
  const activePayload = payload;
  const activeRevision = displayRevision;

  function setOverride(key: ProductIdentityField, value: string) {
    setPayload((current) => current ? ({ ...current, overrides: { ...current.overrides, [key]: value } }) : current);
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

  function setFolder(documentId: string, folderKey: string) {
    const folder = PORTAL_FOLDER_OPTIONS.find((entry) => entry.key === folderKey);
    if (!folder) return;
    setDocument(documentId, {
      folderKey: folder.key,
      folderTitle: folder.title,
      folderSort: folder.sort,
    });
  }

  function documentTitle(document: PortalDocumentSelection, optionLabel: string) {
    const base = document.sourceKind === "report" ? "Hesap Raporu" : "Ekipman Listesi";
    return `${base} · ${optionLabel}${document.sourceRevisionLabel ? ` · ${document.sourceRevisionLabel}` : ""}`;
  }

  function save() {
    if (!activeWorkspace.editableRevision) return;
    run(() => saveProductPortalDraft({
      projectId,
      revisionId: activeWorkspace.editableRevision!.id,
      serialBase: activePayload.serialBase,
      plate: activePayload.plate,
      overrides: activePayload.overrides as Record<ProductIdentityField, string>,
      hiddenFields: activePayload.hiddenFields,
      portal: activePayload.portal,
      documents: activePayload.documents,
      units: units.map((unit) => ({ id: unit.id, serialNo: unit.serialNo })),
    }), "Taslak kaydedildi.");
  }

  function downloadNameplateSvg() {
    if (!nameplateSvg || !selectedUnit) return;
    downloadBlob(
      new Blob([nameplateSvg], { type: "image/svg+xml;charset=utf-8" }),
      safePlateName(selectedUnit.serialNo, activeRevision.revNo, "svg")
    );
  }

  async function downloadNameplatePdf() {
    if (!nameplateInput || !selectedUnit) return;
    setPdfPending(true);
    try {
      const { renderNameplatePdf } = await import("@/lib/product-portal/nameplate-pdf");
      const blob = await renderNameplatePdf(nameplateInput, {
        logoPaperDataUrl,
        archivoBoldDataUrl,
        archivoExtraBoldDataUrl,
        plexDataUrl,
      });
      downloadBlob(blob, safePlateName(selectedUnit.serialNo, activeRevision.revNo, "pdf"));
      toast.success("Baskı PDF'i hazırlandı.");
    } catch {
      toast.error("Baskı PDF'i oluşturulamadı.");
    } finally {
      setPdfPending(false);
    }
  }

  const preview = previewMode === "published" ? publishedPreview : liveDraftPreview;
  const readiness = [
    { label: "Portal adresi", ok: /^https:\/\//i.test(portalOrigin) || portalOrigin.startsWith("http://localhost") },
    { label: "Paket yayında", ok: Boolean(workspace.currentRevisionId) },
    { label: "Parola hazır", ok: Boolean(selectedUnit?.hasPassword) },
    { label: "Erişim açık", ok: Boolean(selectedUnit?.portalEnabled) },
  ];
  const qrReady = readiness.every((entry) => entry.ok);

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Tag className="size-4 text-primary" /> Vinç Kimliği</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">ORTAK PAKET {`R${String(displayRevision.revNo).padStart(2, "0")}`} · {units.length} FİZİKSEL ÜNİTE</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setHistoryOpen(true)}><History className="size-4" /> Sürümler</Button>
            <Button variant="outline" className="min-h-11" onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Müşteri Önizlemesi</Button>
            {workspace.editableRevision && canEdit ? (
              <>
                <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => refreshProductPortalSources(projectId, displayRevision.id), "Kaynak önerileri yenilendi.")}><RefreshCw className="size-4" /> Kaynakları Yenile</Button>
                <Button variant="outline" className="min-h-11" disabled={pending} onClick={save}><Save className="size-4" /> Taslağı Kaydet</Button>
                <Button className="min-h-11" disabled={pending} onClick={() => run(() => issueProductPortalRevision(projectId, displayRevision.id), "Paket yayımlandı; QR erişimi için parola ve erişim durumunu kontrol edin.")}><Send className="size-4" /> Yayımla</Button>
              </>
            ) : canEdit ? (
              <Button className="min-h-11" disabled={pending} onClick={() => run(() => createNextProductPortalRevision(projectId), "Yeni portal sürümü açıldı.")}><Plus className="size-4" /> Yeni Sürüm</Button>
            ) : null}
          </div>
        </header>

        <div className="grid gap-5 p-3 sm:p-4 2xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.82fr)]">
          <div className="min-w-0 space-y-5">
            <section className="overflow-hidden border">
              <header className="border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Fiziksel Üniteler · A/B/C</span></header>
              <div className="grid gap-3 p-3">
                <div className="flex flex-wrap gap-2">
                  {units.map((unit) => (
                    <button key={unit.id} type="button" onClick={() => setSelectedUnitId(unit.id)} className={`oc-tap min-h-11 border px-3 font-mono text-sm ${unit.id === selectedUnit?.id ? "border-primary bg-primary/[0.08] text-primary" : "bg-background"}`}>
                      {unit.suffix || "TEK"} · {unit.serialNo}
                    </button>
                  ))}
                </div>
                {selectedUnit && (
                  <div className="grid items-end gap-3 border-t pt-3 lg:grid-cols-[100px_minmax(180px,1fr)_auto]">
                    <div><Label>Ünite</Label><div className="mt-2 font-mono font-semibold">{selectedUnit.suffix || "Tek"}</div></div>
                    <div>
                      <Label htmlFor={`serial-${selectedUnit.id}`}>Seri Numarası</Label>
                      <Input id={`serial-${selectedUnit.id}`} className="mt-1 font-mono" value={selectedUnit.serialNo} disabled={!workspace.editableRevision || !canEdit || hasIssuedRevision} onChange={(event) => setUnits((current) => current.map((row) => row.id === selectedUnit.id ? { ...row, serialNo: event.target.value } : row))} />
                      {hasIssuedRevision && <p className="mt-1 text-[10px] text-muted-foreground">İlk yayından sonra fiziksel seri numarası kilitlenir.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="min-h-11" disabled={!canEdit || pending} onClick={() => startTransition(async () => {
                        const result = await rotateCraneUnitPassword(projectId, selectedUnit.id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        if (result.password) setShownPassword({ unitId: selectedUnit.id, value: result.password });
                        toast.success("Yeni parola üretildi; yalnız şimdi gösteriliyor.");
                      })}><KeyRound className="size-4" /> {selectedUnit.hasPassword ? "Parolayı Yenile" : "Parola Oluştur"}</Button>
                      <Button type="button" variant={selectedUnit.portalEnabled ? "destructive" : "outline"} className="min-h-11" disabled={!canEdit || pending} onClick={() => run(() => setCraneUnitPortalEnabled(projectId, selectedUnit.id, !selectedUnit.portalEnabled), selectedUnit.portalEnabled ? "Müşteri erişimi durduruldu." : "Müşteri erişimi açıldı.")}>
                        {selectedUnit.portalEnabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {selectedUnit.portalEnabled ? "Erişimi Kapat" : "Erişimi Aç"}
                      </Button>
                    </div>
                    {shownPassword?.unitId === selectedUnit.id && (
                      <div className="border border-primary/35 bg-primary/[0.06] p-3 lg:col-span-3">
                        <div className="oc-kicker text-primary">Yalnız Bir Kez Gösterilir</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><code className="border bg-background px-3 py-2 text-base font-semibold">{shownPassword.value}</code><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(shownPassword.value)}><Clipboard className="size-4" /> Kopyala</Button></div>
                        <p className="mt-2 text-xs text-muted-foreground">Açık parola saklanmaz. Kaybedilirse mevcut parola görüntülenmez; yenisi üretilir ve eski oturumlar kapanır.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Otomatik Kimlik Alanları</span><Badge variant="outline">Kaynak + Elle Düzenleme</Badge></header>
              <div className="divide-y">
                {workspace.identityFields.map((field) => {
                  const overridden = Object.prototype.hasOwnProperty.call(payload.overrides, field.key);
                  const value = overridden ? String(payload.overrides[field.key] ?? "") : field.autoValue;
                  const plateToggle = PLATE_TOGGLE_SET.has(field.key);
                  return (
                    <div key={field.key} className="grid min-w-0 items-center gap-2 px-3 py-2 lg:grid-cols-[160px_minmax(180px,1fr)_170px_100px]">
                      <div className="min-w-0">
                        <Label htmlFor={`field-${field.key}`}>{FIELD_LABELS[field.key]}</Label>
                        <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground" title={overridden ? "Elle düzenlendi" : field.source.label}>{overridden ? "ELLE DÜZENLENDİ" : field.source.label}</div>
                      </div>
                      <Input id={`field-${field.key}`} className="h-9 min-w-0" value={value} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setOverride(field.key, event.target.value)} />
                      <div>{overridden ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-primary" onClick={() => resetOverride(field.key)}><RotateCcw className="size-3.5" /> Otomatiğe Dön</Button> : <span className="font-mono text-[10px] text-muted-foreground">OTOMATİK</span>}</div>
                      <div>{plateToggle ? <DraftToggle checked={!payload.hiddenFields.includes(field.key)} disabled={!workspace.editableRevision || !canEdit} label="Plakada" onChange={(visible) => setPayload((current) => current ? ({ ...current, hiddenFields: visible ? current.hiddenFields.filter((key) => key !== field.key) : [...new Set([...current.hiddenFields, field.key])] }) : current)} /> : <span className="text-xs text-muted-foreground">Künye</span>}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden border">
              <header className="border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Müşteri Portalı Metinleri</span></header>
              <div className="grid gap-3 p-3 lg:grid-cols-2">
                <div><Label htmlFor="portal-title">Başlık</Label><Input id="portal-title" className="mt-1" value={payload.portal.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, title: event.target.value } })} /></div>
                <div><Label htmlFor="support-email">Şifre / Belge Destek E-postası</Label><Input id="support-email" type="email" className="mt-1" value={payload.portal.supportEmail} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, supportEmail: event.target.value } })} /></div>
                <div className="lg:col-span-2"><Label htmlFor="portal-note">Müşteriye Not</Label><Textarea id="portal-note" className="mt-1 min-h-20" value={payload.portal.note} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, note: event.target.value } })} /></div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:self-start">
            <section className="overflow-hidden border bg-muted/20">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-3 py-3">
                <div><div className="oc-kicker text-muted-foreground">Baskı Önizlemesi</div><div className="mt-1 font-mono text-xs">{payload.plate.widthMm} × {payload.plate.heightMm} mm · SVG / PDF</div></div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-11 border-primary text-primary hover:text-primary" disabled={!selectedUnit} onClick={downloadNameplateSvg}><Download className="size-4" /> SVG</Button>
                  <Button type="button" variant="outline" className="min-h-11 border-primary text-primary hover:text-primary" disabled={!selectedUnit || pdfPending} onClick={downloadNameplatePdf}><FileDown className="size-4" /> {pdfPending ? "Hazırlanıyor" : "Baskı PDF"}</Button>
                </div>
              </header>
              <div className="bg-white p-2 sm:p-3">
                <div className="overflow-hidden border bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: nameplateSvg }} />
              </div>
              <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
                <div><Label>Genişlik (mm)</Label><Input type="number" min={120} value={payload.plate.widthMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, plate: { ...payload.plate, widthMm: Number(event.target.value) } })} /></div>
                <div><Label>Yükseklik (mm)</Label><Input type="number" min={80} value={payload.plate.heightMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, plate: { ...payload.plate, heightMm: Number(event.target.value) } })} /></div>
              </div>
              <div className="border-t p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="oc-kicker text-muted-foreground">QR Hazırlık Kontrolü</span>
                  <Badge variant={qrReady ? "outline" : "destructive"}>{qrReady ? <CheckCircle2 className="size-3" /> : <TriangleAlert className="size-3" />}{qrReady ? "Müşteriye Hazır" : "Kurulum Eksik"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {readiness.map((entry) => <div key={entry.label} className="flex items-center gap-2 text-xs">{entry.ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <TriangleAlert className="size-3.5 text-destructive" />} {entry.label}</div>)}
                </div>
                <div className="mt-3 grid gap-1 font-mono text-[10px] text-muted-foreground">
                  <span>{customerLogoDataUrl ? "MÜŞTERİ LOGOSU · HAZIR" : "MÜŞTERİ LOGOSU · KAYITTA YOK"}</span>
                  <span>{nameplateLayout?.title.lines.length === 2 ? "ÜRÜN ADI · İKİ SATIRA YERLEŞTİRİLDİ" : "ÜRÜN ADI · TEK SATIR"}</span>
                  <span>QR MODÜLÜ · {nameplateLayout ? `${nameplateLayout.qr.moduleMm.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mm` : "—"}</span>
                </div>
                {nameplateLayout?.title.overflow && <p className="mt-3 border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">Ürün adı iki satırlık baskı alanına sığmıyor; daha kısa bir plaka adı girin.</p>}
                {selectedUnit && (
                  <div className="mt-3 flex min-w-0 items-center gap-2 border-t pt-3">
                    <span className="min-w-0 flex-1 break-all font-mono text-[10px] text-muted-foreground">{portalUrl}</span>
                    <Button asChild size="icon" variant="outline" className="size-11 shrink-0"><a href={portalUrl} target="_blank" rel="noreferrer" aria-label="Müşteri bağlantısını test et"><ExternalLink className="size-4" /></a></Button>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="overflow-hidden border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><FilePlus2 className="size-4 text-primary" /> Müşteriye Açılacak Dokümanlar</div><p className="mt-1 text-xs text-muted-foreground">Kaynaklar otomatik bulunur; çıktı türü, klasör ve erişim biçimi sizin onayınızdır.</p></div>
          {workspace.editableRevision && canEdit && <div><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const form = new FormData(); form.set("file", file); run(() => uploadCustomPortalDocument(projectId, displayRevision.id, form), "Özel PDF eklendi."); event.target.value = ""; }} /><Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-4" /> PDF Ekle</Button></div>}
        </header>
        <div className="divide-y">
          {payload.documents.map((document) => (
            <div key={document.id} className="grid min-w-0 gap-3 px-4 py-4 lg:grid-cols-[auto_minmax(220px,1fr)_minmax(430px,1.35fr)_auto] lg:items-center">
              <DraftToggle checked={document.included} disabled={!workspace.editableRevision || !canEdit} label="Dahil" onChange={(included) => setDocument(document.id, { included })} />
              <div className="min-w-0"><Label>Belge Adı</Label><Input className="mt-1 min-w-0" value={document.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setDocument(document.id, { title: event.target.value })} /><div className="mt-1 break-words font-mono text-[10px] text-muted-foreground">{document.sourceLabel}{document.sourceRevisionLabel ? ` · ${document.sourceRevisionLabel}` : ""}</div></div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <Label>Belge Türü</Label>
                  {document.sourceKind === "report" ? (
                    <Select value={document.reportLevel ?? "detayli"} disabled={!workspace.editableRevision || !canEdit} onValueChange={(value) => { const level = value as PortalReportLevel; setDocument(document.id, { reportLevel: level, title: documentTitle(document, REPORT_LEVEL_LABELS[level]) }); }}><SelectTrigger className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REPORT_LEVEL_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                  ) : document.sourceKind === "equipment" ? (
                    <Select value={document.equipmentDetail ?? "standart"} disabled={!workspace.editableRevision || !canEdit} onValueChange={(value) => { const detail = value as PortalEquipmentDetail; setDocument(document.id, { equipmentDetail: detail, title: documentTitle(document, detail === "detayli" ? "Detaylı" : "Standart") }); }}><SelectTrigger className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EQUIPMENT_DETAIL_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                  ) : <div className="mt-1 flex h-11 items-center border bg-muted/30 px-3 text-xs text-muted-foreground">Kaynak dosya</div>}
                </div>
                <div className="min-w-0"><Label>Klasör</Label><Select value={document.folderKey} disabled={!workspace.editableRevision || !canEdit} onValueChange={(value) => setFolder(document.id, value)}><SelectTrigger className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{PORTAL_FOLDER_OPTIONS.map((folder) => <SelectItem key={folder.key} value={folder.key}>{folder.title}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0"><Label>Erişim</Label><Select value={document.accessMode} disabled={!workspace.editableRevision || !canEdit} onValueChange={(value) => setDocument(document.id, { accessMode: value as PortalDocumentSelection["accessMode"] })}><SelectTrigger className="mt-1 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view_watermarked">Filigranlı görüntüle</SelectItem><SelectItem value="download">İndirmeye izin ver</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex items-center gap-2">{document.ready ? <Badge variant="outline"><Check className="size-3" /> Hazır</Badge> : <Badge variant="destructive">Eksik</Badge>}{document.sourceKind === "custom" && workspace.editableRevision && canEdit && <Button size="icon" variant="ghost" className="size-11 text-destructive" onClick={() => run(() => deleteCustomPortalDocument(projectId, displayRevision.id, document.id), "Özel belge silindi.")}><Trash2 className="size-4" /></Button>}</div>
            </div>
          ))}
          {payload.documents.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Henüz yayıma hazır kaynak bulunamadı. Hesap raporu veya diğer kaynak yayımlandıktan sonra “Kaynakları Yenile”yi kullanın.</div>}
        </div>
      </section>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[92dvh] max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[min(1480px,calc(100vw-2rem))] sm:gap-0 sm:p-0">
          <DialogHeader className="border-b bg-muted/40 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div><DialogTitle>Müşteri Ne Görüyor?</DialogTitle><DialogDescription className="mt-1">Dış portalın gerçek sunum bileşeni; iç uygulama kabuğu bu görünümde yoktur.</DialogDescription></div>
              <div className="flex gap-2"><Button variant={previewMode === "draft" ? "default" : "outline"} onClick={() => setPreviewMode("draft")} disabled={!liveDraftPreview}>Taslak</Button><Button variant={previewMode === "published" ? "default" : "outline"} onClick={() => setPreviewMode("published")} disabled={!publishedPreview}>Yayındaki</Button></div>
            </div>
          </DialogHeader>
          <div className="min-h-0 overflow-auto">
            {preview ? <CustomerPortalView dto={{ ...preview, preview: true, serialNo: selectedUnit?.serialNo ?? preview.serialNo, publicCode: selectedUnit?.publicCode ?? preview.publicCode }} /> : <div className="grid h-full place-items-center p-10 text-center text-sm text-muted-foreground"><div><LockKeyhole className="mx-auto mb-3 size-6" /> Henüz bu kipte müşteri önizlemesi yok.</div></div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Portal Sürümleri</DialogTitle><DialogDescription>Yayımlanmış paketler değişmez. Yanlış yayımı kaldırabilir veya eski bir paketi yeniden aktif edebilirsiniz.</DialogDescription></DialogHeader>
          <div className="divide-y border">
            {workspace.revisions.map((revision) => {
              const current = revision.id === workspace.currentRevisionId;
              return (
                <div key={revision.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono font-semibold">R{String(revision.revNo).padStart(2, "0")}</span><Badge variant={current ? "default" : "outline"}>{current ? "Yayında" : revision.status === "draft" ? "Taslak" : "Arşiv"}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{revision.status === "issued" ? `Yayım: ${revisionDate(revision.issuedAt)}` : `Oluşturma: ${revisionDate(revision.createdAt)}`}</div></div>
                  {canEdit && current ? <Button variant="destructive" disabled={pending} onClick={() => { if (!window.confirm("Müşteri paketi yayından kaldırılsın mı? Ünite erişimleri kapanacak ve aktif oturumlar sonlandırılacak.")) return; run(() => withdrawProductPortal(projectId), "Müşteri paketi yayından kaldırıldı.", () => setHistoryOpen(false)); }}><EyeOff className="size-4" /> Yayından Kaldır</Button> : null}
                  {canEdit && revision.status === "issued" && !current ? <Button variant="outline" disabled={pending} onClick={() => { if (!window.confirm(`R${String(revision.revNo).padStart(2, "0")} yeniden yayına alınsın mı?`)) return; run(() => activateProductPortalRevision(projectId, revision.id), `R${String(revision.revNo).padStart(2, "0")} yeniden yayına alındı.`, () => setHistoryOpen(false)); }}><RotateCcw className="size-4" /> Bu Sürüme Dön</Button> : null}
                </div>
              );
            })}
          </div>
          {!workspace.currentRevisionId && <div className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Şu anda müşteriye açık bir paket yok. Arşivdeki bir sürümü yeniden yayına alabilir veya yeni sürüm oluşturabilirsiniz.</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
