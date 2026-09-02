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
import { MobileSectionGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";
import { BolumRayi, type BolumOgesi } from "@/components/bolum-rayi";
import { capaKimligi, capayaGit, useAktifCapa } from "@/lib/bolum-capa";
import { useIsDesktop } from "@/lib/use-breakpoint";

/*
 * DAR EKRANDA KART BEŞ BÖLÜMDÜR (BELGE-13).
 *
 * Yönetim kartı tek sayfada 17 kimlik alanı, 10 onay kutusu, plaka
 * önizlemesi, üç portal metni ve belge listesini taşıyor: telefonda bu
 * metrelerce bir kaydırma demek. Bölümler `MobileSectionGrid` ile
 * değiştirilir (MOBIL-21: gezinme açılır listenin arkasına saklanmaz).
 *
 * MARKUP ÇOĞALTILMAZ (MOBIL-7/15): aynı düğümler `lg` üstünde hepsi birden
 * görünür, altında yalnız seçili olan. İkinci bir mobil ağaç yazmak, bir gün
 * yalnız birinde düzeltilen bir etiket demekti.
 */
type PortalBolum = "uniteler" | "kimlik" | "plaka" | "dokumanlar" | "portal";

const PORTAL_BOLUMLERI: readonly { value: PortalBolum; label: string }[] = [
  { value: "uniteler", label: "Üniteler" },
  { value: "kimlik", label: "Kimlik" },
  { value: "plaka", label: "Plaka" },
  { value: "dokumanlar", label: "Belgeler" },
  { value: "portal", label: "Portal" },
];

/** Çıpa kancasının bağımlılığı — dizi her boyamada yeniden üretilmesin. */
const PORTAL_KIMLIKLERI = PORTAL_BOLUMLERI.map((b) => b.value);
import {
  NAMEPLATE_SIZE_PRESETS,
  NAMEPLATE_TOGGLE_FIELDS,
  buildNameplateSvg,
  createNameplateLayout,
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
  PLATE_LOGO_URL,
  SCREEN_FONT_CSS,
  embeddedPlateAssets,
} from "@/lib/product-portal/plate-assets";
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

/**
 * PLAKA TİKİ — kimlik satırındaki kompakt açık/kapalı işareti.
 *
 * `DraftToggle` YERİNE geçmez, ONA DOKUNULMAZ: o bileşen plaka seçenekleri ve
 * belge listesinde de kullanılıyor ve orada yazı DOĞRU YERDEDİR (tek başına
 * duran, bağlamsız anahtarlar). Buradaki tik ise on yedi kez tekrarlanır ve
 * anlamını SÜTUN BAŞLIĞINDAN alır; yazıyı her satırda tekrarlamak, kullanıcının
 * "satıra genişlik sığmıyor" dediği şeyin ta kendisiydi.
 *
 * Sınıf dizisi projedeki kompakt tik deseninin aynısıdır (teklif tanımları ve
 * görev şablonları ekranları).
 */
function PlakaTiki({
  gorunur,
  alanAdi,
  disabled,
  onChange,
}: {
  gorunur: boolean;
  alanAdi: string;
  disabled?: boolean;
  onChange: (gorunur: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={gorunur}
      aria-label={`${alanAdi} — plakada göster`}
      title={gorunur
        ? "Plakada gösteriliyor — tıklayınca gizlenir"
        : "Plakadan gizli — tıklayınca gösterilir"}
      onClick={() => onChange(!gorunur)}
      className={cn(
        "oc-tap-square grid size-5 shrink-0 place-items-center border transition-colors",
        gorunur
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-transparent hover:border-primary",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <Check className="size-3.5" />
    </button>
  );
}

const FIELD_LABELS: Record<ProductIdentityField, string> = {
  manufacturer: "Üretici",
  manufacturerAddress: "Üretici Adresi",
  product: "Ürün Adı",
  craneType: "Vinç Tipi",
  machineModel: "Tip / Model",
  projectCode: "Proje / Ürün Kodu",
  productionYear: "Üretim Yılı",
  capacity: "Kaldırma Kapasitesi",
  span: "Açıklık",
  liftHeight: "Kaldırma Yüksekliği",
  mass: "Ağırlık",
  dutyClass: "Çalışma Sınıfı",
  supplyVoltage: "Besleme Gerilimi",
  controlVoltage: "Kumanda Gerilimi",
  frequency: "Frekans",
  customer: "Müşteri",
  site: "Saha / Konum",
  mainHoistSummary: "Ana Kaldırma (hız · motor)",
  trolleyTravelSummary: "Araba Yürütme (hız · teker · motor)",
  bridgeTravelSummary: "Köprü Yürütme (hız · teker · motor)",
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
  portalOriginPermanent,
  customerLogoDataUrl,
  draftPreview,
  publishedPreview,
}: {
  projectId: string;
  canEdit: boolean;
  workspace: ProductPortalWorkspace | null;
  portalOrigin: string;
  /** QR'a kazınacak adres KALICI mı; değilse plaka indirilemez. */
  portalOriginPermanent: boolean;
  customerLogoDataUrl: string | null;
  draftPreview: CustomerPortalDto | null;
  publishedPreview: CustomerPortalDto | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pdfPending, setPdfPending] = useState(false);
  const [svgPending, setSvgPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const displayRevision = workspace?.editableRevision
    ?? workspace?.revisions.find((revision) => revision.id === workspace.currentRevisionId)
    ?? workspace?.revisions[0]
    ?? null;
  const serverPayload = displayRevision?.payload ?? null;
  const serverUnits = useMemo(() => workspace?.units ?? [], [workspace]);
  const [payload, setPayload] = useState(serverPayload);
  const [units, setUnits] = useState<CraneUnitRow[]>(serverUnits);
  const [selectedUnitId, setSelectedUnitId] = useState(workspace?.units[0]?.id ?? "");

  /*
   * SUNUCU TAZELEMESİNİ İÇERİ AL — AMA KAYDEDİLMEMİŞ DÜZENLEMEYİ EZME.
   *
   * Bölüm bileşeni kartı artık payload'a göre yeniden monte ETMİYOR (bkz.
   * `product-portal-section.tsx`: anahtar yalnız sürüm kimliğidir), çünkü yeniden
   * montaj "Parolayı Yenile"nin bir kez gösterilen ham parolasını yok ediyordu.
   * Bunun karşılığında taze veriyi burada uzlaştırmak gerekir: "Kaynakları Yenile"
   * veya "PDF Ekle" sunucuda payload'ı değiştirdiğinde kart bunu görmelidir.
   *
   * Kural basittir: kullanıcının kaydedilmemiş bir düzenlemesi YOKSA taze sunucu
   * hâli alınır; VARSA dokunulmaz ve kart kirli işaretlenir. Karşılaştırma referansla
   * değil İÇERİKLE yapılır — sunucu bileşeni her render'da yeni nesne üretir, referans
   * karşılaştırması her seferinde "değişti" derdi.
   */
  const serverSignature = JSON.stringify({ p: serverPayload, u: serverUnits });
  const localSignature = JSON.stringify({ p: payload, u: units });
  const [baseSignature, setBaseSignature] = useState(serverSignature);
  if (serverSignature !== baseSignature) {
    const hadLocalEdits = localSignature !== baseSignature;
    setBaseSignature(serverSignature);
    if (!hadLocalEdits) {
      setPayload(serverPayload);
      setUnits(serverUnits);
    }
  }
  const dirty = localSignature !== baseSignature;
  const [previewMode, setPreviewMode] = useState<"draft" | "published">(
    workspace?.editableRevision ? "draft" : "published"
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shownPassword, setShownPassword] = useState<{ unitId: string; value: string } | null>(null);
  const [bolum, setBolum] = useState<PortalBolum>("uniteler");
  /** `lg` altında yalnız seçili bölüm görünür; üstünde hepsi. */
  const bolumSinifi = (deger: PortalBolum) => (bolum === deger ? "" : "hidden lg:block");
  /**
   * BÖLÜM RAYI BU SAYFADA İKİ KİPLİDİR (BELGE-20) ve sebebi yukarıdaki
   * satırdır: `lg` ALTINDA yalnız seçili bölüm DOM'dadır, yani "bölüme
   * git" bir DURUM değişimidir; `lg` ÜSTÜNDE beşi birden basılır ve aynı
   * eylem gerçek bir KAYDIRMA olur. Tek bir sayfada rayın her iki kipi de
   * gerekiyor.
   */
  const genisMi = useIsDesktop();
  const [okunanBolum, bolumIsaretle] = useAktifCapa(PORTAL_KIMLIKLERI);
  const rayOgeleri: BolumOgesi[] = PORTAL_BOLUMLERI.map((b) => ({
    id: b.value,
    baslik: b.label,
  }));
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
      logoDataUrl: PLATE_LOGO_URL,
      customerLogoDataUrl,
      embeddedFontsCss: SCREEN_FONT_CSS,
      holeDiameterMm: payload.plate.holeDiameterMm,
      holeInsetMm: payload.plate.holeInsetMm,
      ceMark: payload.plate.ceMark,
      monochrome: payload.plate.monochrome,
    };
  }, [customerLogoDataUrl, effectiveIdentity, payload, portalOrigin, selectedUnit]);
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
      <section className="relative overflow-hidden border bg-card">
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

  /**
   * SAYIYA ÇEVRİLEMEYEN GİRİŞ YAZILMAZ.
   *
   * Önceki hâl `Number(event.target.value)` idi; alan boşaltıldığında ya da
   * virgüllü yazıldığında `NaN` payload'a giriyor, `createNameplateLayout`
   * NaN ile hesaplamaya başlıyor ve önizleme komple kayboluyordu. Boş giriş
   * ALANI SİLER (delik ölçüleri isteğe bağlıdır), geçerli sayı sınırına çekilir.
   */
  function setPlate(key: "widthMm" | "heightMm" | "holeDiameterMm" | "holeInsetMm", raw: string, min: number, max: number) {
    setPayload((current) => {
      if (!current) return current;
      const text = raw.trim().replace(",", ".");
      const plate = { ...current.plate };
      if (!text) {
        if (key === "widthMm" || key === "heightMm") return current;
        delete plate[key];
        return { ...current, plate };
      }
      const value = Number(text);
      if (!Number.isFinite(value)) return current;
      plate[key] = Math.min(max, Math.max(min, value));
      return { ...current, plate };
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

  function saveDraft() {
    if (!activeWorkspace.editableRevision) {
      return Promise.resolve({ error: "Düzenlenebilir bir taslak yok; yeni sürüm açın." });
    }
    return saveProductPortalDraft({
      projectId,
      revisionId: activeWorkspace.editableRevision.id,
      serialBase: activePayload.serialBase,
      plate: activePayload.plate,
      overrides: activePayload.overrides,
      hiddenFields: activePayload.hiddenFields,
      portal: activePayload.portal,
      documents: activePayload.documents,
      units: units.map((unit) => ({ id: unit.id, serialNo: unit.serialNo })),
    });
  }

  function save() {
    run(saveDraft, "Taslak kaydedildi.");
  }

  /*
   * İNDİRİLEN SVG KENDİ KENDİNE YETER — EKRANDAKİ YETMEZ.
   *
   * Ekrandaki önizleme fontu ve logoyu `/fonts/...`, `/brand/...` adreslerinden
   * okur; bu doğrudur ve proje sayfasına tek bayt bindirmez. Ama indirilen dosya
   * MATBAAYA gider: orada bizim sunucumuz yoktur. Bu yüzden yalnız indirme
   * anında fontlar ve logo çekilip base64 olarak GÖMÜLÜR.
   */
  /*
   * PLAKA ANCAK KALICI ADRESLE BASILIR.
   *
   * QR baskı anında gömülür ve plaka metale kazınır; `localhost` ya da bir
   * önizleme dağıtımının geçici adresi kazındığında geri dönüş YOKTUR. Kapı
   * burada durur: kart uyarıyı gösterir, düğmeler kapanır.
   */
  const plateBlocked = !portalOriginPermanent;

  async function downloadNameplateSvg() {
    if (!nameplateInput || !selectedUnit || plateBlocked) return;
    setSvgPending(true);
    try {
      const assets = await embeddedPlateAssets();
      const svg = buildNameplateSvg({
        ...nameplateInput,
        logoDataUrl: assets.logoDataUrl,
        embeddedFontsCss: assets.fontsCss,
      });
      downloadBlob(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        safePlateName(selectedUnit.serialNo, activeRevision.revNo, "svg")
      );
      toast.success("Baskı SVG'si hazırlandı; fontlar dosyaya gömüldü.");
    } catch (error) {
      console.error("[vinç kimliği] baskı SVG'si üretilemedi", error);
      toast.error("Baskı SVG'si oluşturulamadı — plaka varlıkları okunamadı.");
    } finally {
      setSvgPending(false);
    }
  }

  /*
   * ZAMAN AŞIMI ŞART — BU ÜRETİM ASILI KALABİLİR, REDDEDİLMEZ.
   *
   * @react-pdf tarayıcıda hem WASM (yoga) hem blob worker (fflate) kullanır. Bunlardan
   * biri Content-Security-Policy tarafından engellenirse promise NE ÇÖZÜLÜR NE
   * REDDEDİLİR: `catch` hiç çalışmaz, `finally` hiç çalışmaz ve düğme sonsuza kadar
   * "Hazırlanıyor"da kalır — kullanıcının 30.08.2026'da bildirdiği hata tam olarak
   * budur. `next.config.ts` o iki direktifi artık veriyor, ama bir sonraki politika
   * değişikliğinde aynı sessizliğe düşmemek için süre sınırı burada durur.
   */
  const PDF_TIMEOUT_MS = 20_000;

  async function downloadNameplatePdf() {
    if (!nameplateInput || !selectedUnit || plateBlocked) return;
    setPdfPending(true);
    let timer: number | undefined;
    try {
      const { renderNameplatePdf } = await import("@/lib/product-portal/nameplate-pdf");
      const blob = await Promise.race([
        renderNameplatePdf(nameplateInput),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("PDF üretimi zaman aşımına uğradı; tarayıcı konsolunu kontrol edin.")),
            PDF_TIMEOUT_MS
          );
        }),
      ]);
      downloadBlob(blob, safePlateName(selectedUnit.serialNo, activeRevision.revNo, "pdf"));
      toast.success("Baskı PDF'i hazırlandı.");
    } catch (error) {
      // Gerçek sebep konsola ETİKETLİ yazılır; toast tek satırda okunur kalır.
      console.error("[vinç kimliği] baskı PDF'i üretilemedi", error);
      toast.error(
        error instanceof Error && error.message
          ? `Baskı PDF'i oluşturulamadı — ${error.message}`
          : "Baskı PDF'i oluşturulamadı."
      );
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
      setPdfPending(false);
    }
  }

  const preview = previewMode === "published" ? publishedPreview : liveDraftPreview;
  const readiness = [
    /*
     * LOCALHOST "HAZIR" DEĞİLDİR.
     *
     * Önceki kontrol `http://localhost` adresini geçerli sayıyordu ve plaka
     * indirmesi bu kontrole HİÇ bağlı değildi: geliştirme makinesinden basılan
     * bir plaka, QR'ında `localhost:3000` ile fabrikaya gidebilirdi. Adres
     * kalıcı değilse plaka basılamaz.
     */
    {
      label: portalOriginPermanent ? "Kalıcı portal adresi" : "Kalıcı portal adresi tanımlı değil",
      ok: portalOriginPermanent && /^https:\/\//i.test(portalOrigin),
    },
    { label: "Paket yayında", ok: Boolean(workspace.currentRevisionId) },
    { label: "Parola hazır", ok: Boolean(selectedUnit?.hasPassword) },
    { label: "Erişim açık", ok: Boolean(selectedUnit?.portalEnabled) },
  ];
  const qrReady = readiness.every((entry) => entry.ok);

  return (
    // RAY + KART. Ray kartın KÖKÜNÜN yanına konur, ana ızgaranın içine
    // DEĞİL: `dokumanlar` bölümü o ızgaranın dışında duruyor ve ızgaranın
    // sarmalayıcısı `relative overflow-hidden` — ray oraya konsaydı hem
    // beşinci bölümü kapsamaz hem de kırpılırdı.
    //
    // `items-start` YAZILMAZ (MOBIL-31): yapışkan kutunun yapışacak yolu
    // sarmalayıcının boyudur.
    <div className="flex min-w-0 gap-2 lg:gap-4">
      <BolumRayi
        etiket="Vinç Kimliği bölümleri"
        depoAnahtari="orion.kimlik.ray.daraltildi"
        ogeler={rayOgeleri}
        aktifId={genisMi ? okunanBolum : bolum}
        onSec={(id) => {
          const deger = id as PortalBolum;
          // Dar ekranda bölüm SEÇİLİR (öteki dördü DOM'da yok);
          // geniş ekranda hepsi basılı olduğu için ayrıca KAYDIRILIR.
          setBolum(deger);
          if (genisMi) {
            bolumIsaretle(deger);
            capayaGit(deger);
          }
        }}
      />
      <div className="grid min-w-0 flex-1 gap-4">
      <section className="relative overflow-hidden border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Tag className="size-4 text-primary" /> Vinç Kimliği</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">ORTAK PAKET {`R${String(displayRevision.revNo).padStart(2, "0")}`} · {units.length} FİZİKSEL ÜNİTE</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setHistoryOpen(true)}><History className="size-4" /> Sürümler</Button>
            <Button variant="outline" className="min-h-11" onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Müşteri Önizlemesi</Button>
            {workspace.editableRevision && canEdit ? (
              <>
                <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => refreshProductPortalSources(projectId, displayRevision.id), "Kaynak önerileri yenilendi.")}><RefreshCw className="size-4" /> Kaynakları Yenile</Button>
                {dirty && <Badge variant="outline" className="self-center border-primary/40 text-primary">Kaydedilmemiş değişiklik</Badge>}
                <Button variant={dirty ? "default" : "outline"} className="min-h-11" disabled={pending} onClick={save}><Save className="size-4" /> Taslağı Kaydet</Button>
                {/*
                  * YAYIM VERİTABANINDAKİ TASLAĞI ALIR, EKRANDAKİNİ DEĞİL.
                  *
                  * `issueProductPortalRevision` payload'ı sunucudan okur. Kaydedilmemiş
                  * bir düzenlemeyle "Yayımla"ya basmak, kullanıcının ekranda GÖRDÜĞÜNDEN
                  * başka bir paketi müşteriye açar — ve yayımlanan sürüm değişmezdir,
                  * geri alınamaz. O yüzden önce kaydedilir; kullanıcı onaylar.
                  */}
                <Button className="min-h-11" disabled={pending} onClick={() => {
                  if (dirty) {
                    if (!window.confirm("Kaydedilmemiş değişiklikleriniz var. Önce kaydedilip sonra yayımlansın mı?")) return;
                    startTransition(async () => {
                      const saved = await saveDraft();
                      if (saved.error) {
                        toast.error(saved.error);
                        return;
                      }
                      const issued = await issueProductPortalRevision(projectId, displayRevision.id);
                      if (issued.error) {
                        toast.error(issued.error);
                        return;
                      }
                      toast.success("Taslak kaydedildi ve paket yayımlandı; parola ve erişim durumunu kontrol edin.");
                    });
                    return;
                  }
                  run(() => issueProductPortalRevision(projectId, displayRevision.id), "Paket yayımlandı; QR erişimi için parola ve erişim durumunu kontrol edin.");
                }}><Send className="size-4" /> Yayımla</Button>
              </>
            ) : canEdit ? (
              <Button className="min-h-11" disabled={pending} onClick={() => run(() => createNextProductPortalRevision(projectId), "Yeni portal sürümü açıldı.")}><Plus className="size-4" /> Yeni Sürüm</Button>
            ) : null}
          </div>
        </header>

        <div className="border-b px-3 py-3 lg:hidden">
          <MobileSectionGrid<PortalBolum>
            value={bolum}
            onValueChange={setBolum}
            label="Vinç Kimliği bölümleri"
            options={PORTAL_BOLUMLERI}
          />
        </div>

        <div
          className={cn(
            /*
             * SAYFA GEÇ BÖLÜNÜR (kullanıcı isteği, 02.09.2026, md. 21: *"bu
             * bölümde sayfayı ikiye bölmeyelim, yazılar yarım kalıyor"*).
             *
             * Bölme `xl` (1280 px) idi ve plaka önizlemesinin 420 px'lik TABANI
             * sabitti, yani sıkışmanın tamamını SOL sütun yiyordu. Ölçüldü:
             * 1440–1520 px'te bölüm rayı da sabit sütuna geçince sol sütun
             * 382 px'e iniyor ve kimlik satırları kırpılıyordu. Eşik 1600 px'e
             * alındı; altında plaka önizlemesi kimlik bölümünün ALTINA yığılır
             * ve tam genişlikte, daha okunur görünür.
             */
            "gap-5 p-3 sm:p-4 min-[1600px]:grid-cols-[minmax(0,1fr)_minmax(400px,0.75fr)]",
            bolum === "dokumanlar" ? "hidden lg:grid" : "grid"
          )}
        >
          <div className="min-w-0 space-y-5">
            <section id={capaKimligi("uniteler")} className={cn("oc-capa", "relative overflow-hidden border", bolumSinifi("uniteler"))}>
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
                  /*
                   * `items-end` DEĞİL `items-start`: hücreler farklı yükseklikte.
                   * Seri numarası hücresi etiket + alan + açıklama satırı taşır, "Ünite"
                   * hücresi yalnız etiket + değer. Alt hizalamada "Ünite" etiketi "Seri
                   * Numarası"ndan 31 px AŞAĞIDA duruyordu (ölçüldü) ve iki etiket ayrı
                   * satırlarmış gibi okunuyordu. Üstten hizalanınca etiket satırı ortaktır.
                   */
                  <div className="grid items-start gap-3 border-t pt-3 lg:grid-cols-[100px_minmax(180px,1fr)_auto]">
                    <div><Label>Ünite</Label><div className="mt-1 flex h-11 items-center font-mono font-semibold">{selectedUnit.suffix || "Tek"}</div></div>
                    <div>
                      <Label htmlFor={`serial-${selectedUnit.id}`}>Seri Numarası</Label>
                      <Input id={`serial-${selectedUnit.id}`} className="mt-1 font-mono" value={selectedUnit.serialNo} disabled={!workspace.editableRevision || !canEdit || hasIssuedRevision} onChange={(event) => setUnits((current) => current.map((row) => row.id === selectedUnit.id ? { ...row, serialNo: event.target.value } : row))} />
                      {hasIssuedRevision && <p className="mt-1 text-[11px] text-muted-foreground">İlk yayından sonra fiziksel seri numarası kilitlenir.</p>}
                    </div>
                    {/* Etiket satırı kadar boşluk: düğmeler seri numarası ALANIYLA hizalanır. */}
                    <div className="flex flex-wrap gap-2 lg:mt-6">
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

            <section id={capaKimligi("kimlik")} className={cn("oc-capa", "relative overflow-hidden border", bolumSinifi("kimlik"))}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Otomatik Kimlik Alanları</span><Badge variant="outline">Kaynak + Elle Düzenleme</Badge></header>
              {/* İKİ DENETİM SÜTUNUNUN BAŞLIĞI — metin düğmelerden çıkınca
                  anlamın gideceği yer burasıdır. `title` tek taşıyıcı sayılmaz
                  (dokunmatikte hiç görünmez); sütun başlığı kalıcı bir işarettir. */}
              <div className="flex items-center justify-end border-b px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {/* TEK ŞERİT, İKİ AD: sütunlar 32 ve 20 px'tir, "PLAKA" oraya
                    sığmaz ve iki satıra kırılıyordu. Sıra soldan sağa okunur. */}
                <span className="whitespace-nowrap">Oto · Plaka</span>
              </div>
              <div className="divide-y">
                {workspace.identityFields.map((field) => {
                  const overridden = Object.prototype.hasOwnProperty.call(payload.overrides, field.key);
                  const value = overridden ? String(payload.overrides[field.key] ?? "") : field.autoValue;
                  const plateToggle = PLATE_TOGGLE_SET.has(field.key);
                  const yazilabilir = workspace.editableRevision && canEdit;
                  return (
                    /*
                     * SATIR ÜÇ SÜTUNDUR VE TEK ŞEMASI VARDIR (02.09.2026, md. 21).
                     *
                     * Kullanıcı bildirimi: "Otomatik butonu çok yer kaplıyor,
                     * yazıya gerek yok; satıra genişlik sığmıyor." Ölçüldü ve
                     * şikâyetin altında İKİ ayrı hata vardı: (1) 1440 px ve
                     * üstünde bölüm rayı sabit sütuna geçince sol sütun 382 px'e
                     * iniyor, `auto` izler 0 px'e ÇÖKÜYOR ve `overflow-hidden`
                     * altında hem düğme hem tik TAMAMEN kırpılıyordu (satır
                     * 324 px, içerik 508 px) — yani kullanıcı bir alanı plakadan
                     * çıkaramıyordu; (2) 1024–1279 arasında `lg` şeması ÜÇ iz
                     * tanımlarken satırda DÖRT çocuk vardı, "Plakada" örtük bir
                     * alt satıra düşüp etiket sütununa hizalanıyor ve satır
                     * 61 px yerine 113 px oluyordu.
                     *
                     * İkisini birden bitiren şey sütun SAYISINI düşürmektir: iki
                     * denetim tek hücrede ve ikisi de İKON. Tek şema olduğu için
                     * kırılma noktasında iz sayısı da değişmez.
                     *
                     * ——— eski gerekçe (01.09.2026) ———
                     * SATIR DÖRT SÜTUNDU VE HİÇBİRİ SABİT GENİŞLİKTE DEĞİLDİ.
                     *
                     * Eski şema `160px_minmax(180px,1fr)_170px_100px` idi: en az
                     * 634 px isterken proje sayfasının sol sütunu 610 px veriyor,
                     * bölüm de `overflow-hidden` taşıdığı için son sütun ("Plakada"
                     * anahtarı) SESSİZCE kırpılıyordu — yani kullanıcı bir alanı
                     * plakadan çıkaramıyordu (ölçüldü: 1152 px içerikte 38 px taşma,
                     * 976 px'te anahtar tamamen kayboluyor). `lg` şeması ise iki iz
                     * tanımlarken satırda dört çocuk vardı ve son ikisi örtük bir
                     * alt satıra düşüp etiketle hizalanıyordu.
                     *
                     * Yeni şema: durum ve kapsam hücreleri `auto`dur, girdi kalanı
                     * alır. Dar ekranda satır tek sütuna iner.
                     */
                    <div
                      key={field.key}
                      className="grid min-w-0 items-center gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[minmax(110px,1fr)_minmax(150px,2fr)_auto]"
                    >
                      <div className="min-w-0">
                        <Label htmlFor={`field-${field.key}`}>{FIELD_LABELS[field.key]}</Label>
                        <div
                          className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                          title={overridden ? `Elle düzenlendi · kaynak: ${field.source.label}` : field.source.label}
                        >
                          {field.source.label}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Input
                          id={`field-${field.key}`}
                          className="min-w-0"
                          value={value}
                          disabled={!yazilabilir}
                          onChange={(event) => setOverride(field.key, event.target.value)}
                        />
                        {/* ELLE DÜZENLENEN ALANDA KAYNAĞIN NE DEDİĞİ GÖRÜNÜR KALIR.
                            Eskiden otomatik değer tamamen kayboluyordu ve kullanıcı
                            "Otomatiğe Dön"ün ne getireceğini bilmeden basıyordu. */}
                        {overridden && field.autoValue.trim() && field.autoValue !== value ? (
                          <div className="mt-1 truncate text-[11px] text-muted-foreground" title={field.autoValue}>
                            Kaynak: {field.autoValue}
                          </div>
                        ) : null}
                      </div>
                      {/* İKİ DENETİM TEK HÜCREDE VE İKON OLARAK.
                          OTOMATİK BİR DURUM DEĞİL BİR DÜĞMEDİR (01.09.2026):
                          basmak override'ı siler, alan kaynağın güncel değerine
                          döner. Metin kalktı; anlam `title` + `aria-label` +
                          `aria-pressed` ve SÜTUN BAŞLIĞINDA durur.
                          `oc-tap-square` dokunma hedefini görünmez bir ::after
                          ile 44 px'e tamamlar; iki hedef üst üste binmesin diye
                          aralarında 8 px (`gap-2`) vardır. */}
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant={overridden ? "outline" : "secondary"}
                          size="icon-sm"
                          disabled={!yazilabilir || !overridden}
                          aria-pressed={!overridden}
                          aria-label={overridden
                            ? `${FIELD_LABELS[field.key]} — kaynağın güncel değerine dön`
                            : `${FIELD_LABELS[field.key]} — kaynaktan otomatik doluyor`}
                          title={overridden
                            ? "Elle düzenlendi — kaynağın güncel değerine dön"
                            : "Alan kaynaktan otomatik doluyor"}
                          onClick={() => resetOverride(field.key)}
                        >
                          <RotateCcw className={cn("size-4", overridden ? "text-primary" : "opacity-50")} />
                        </Button>
                        {plateToggle ? (
                          <PlakaTiki
                            gorunur={!payload.hiddenFields.includes(field.key)}
                            alanAdi={FIELD_LABELS[field.key]}
                            disabled={!yazilabilir}
                            onChange={(gorunur) => setPayload((current) => current ? ({ ...current, hiddenFields: gorunur ? current.hiddenFields.filter((key) => key !== field.key) : [...new Set([...current.hiddenFields, field.key])] }) : current)}
                          />
                        ) : (
                          <span
                            className="grid size-5 shrink-0 place-items-center"
                            title="Yasal zorunlu alan; plakadan gizlenemez (BELGE-2)"
                          >
                            <LockKeyhole className="size-3.5 text-muted-foreground" aria-hidden />
                            <span className="sr-only">Yasal zorunlu alan; plakadan gizlenemez</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section id={capaKimligi("portal")} className={cn("oc-capa", "relative overflow-hidden border", bolumSinifi("portal"))}>
              <header className="border-b bg-muted/40 px-4 py-2.5"><span className="oc-kicker text-muted-foreground">Müşteri Portalı Metinleri</span></header>
              <div className="grid gap-3 p-3 lg:grid-cols-2">
                <div><Label htmlFor="portal-title">Başlık</Label><Input id="portal-title" className="mt-1" value={payload.portal.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, title: event.target.value } })} /></div>
                <div><Label htmlFor="support-email">Şifre / Belge Destek E-postası</Label><Input id="support-email" type="email" className="mt-1" value={payload.portal.supportEmail} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, supportEmail: event.target.value } })} /></div>
                <div className="lg:col-span-2"><Label htmlFor="portal-note">Müşteriye Not</Label><Textarea id="portal-note" className="mt-1 min-h-20" value={payload.portal.note} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPayload({ ...payload, portal: { ...payload.portal, note: event.target.value } })} /></div>
              </div>
            </section>
          </div>

          <aside id={capaKimligi("plaka")} className={cn("oc-capa", "min-w-0 min-[1600px]:sticky min-[1600px]:top-4 min-[1600px]:self-start", bolumSinifi("plaka"))}>
            <section className="relative overflow-hidden border bg-muted/20">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-3 py-3">
                <div><div className="oc-kicker text-muted-foreground">Baskı Önizlemesi</div><div className="mt-1 font-mono text-xs">{payload.plate.widthMm} × {payload.plate.heightMm} mm · SVG / PDF</div></div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-11 border-primary text-primary hover:text-primary" disabled={!selectedUnit || svgPending || plateBlocked} onClick={downloadNameplateSvg}><Download className="size-4" /> {svgPending ? "Hazırlanıyor" : "SVG"}</Button>
                  <Button type="button" variant="outline" className="min-h-11 border-primary text-primary hover:text-primary" disabled={!selectedUnit || pdfPending || plateBlocked} onClick={downloadNameplatePdf}><FileDown className="size-4" /> {pdfPending ? "Hazırlanıyor" : "Baskı PDF"}</Button>
                </div>
              </header>
              {plateBlocked && (
                <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5 text-destructive">
                  <span className="font-semibold">Plaka indirilemez.</span> QR&apos;a gömülecek adres bu ortamda
                  geçici: <span className="font-mono">{portalOrigin}</span>. Adres plakaya kazınır ve bir daha
                  değiştirilemez. Kalıcı adresi <span className="font-mono">CUSTOMER_PORTAL_ORIGIN</span>
                  ortam değişkeniyle tanımlayın.
                </div>
              )}
              <div className="bg-white p-2 sm:p-3">
                <div className="relative overflow-hidden border bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: nameplateSvg }} />
              </div>
              <div className="grid gap-3 border-t p-3">
                <div>
                  <Label>Hazır Ölçü</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {NAMEPLATE_SIZE_PRESETS.map((preset) => {
                      const active = payload.plate.widthMm === preset.widthMm && payload.plate.heightMm === preset.heightMm;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={!workspace.editableRevision || !canEdit}
                          onClick={() => setPayload({ ...payload, plate: { ...payload.plate, widthMm: preset.widthMm, heightMm: preset.heightMm } })}
                          className={`oc-tap min-h-11 border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-primary bg-primary/[0.08] text-primary" : "bg-background"}`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/*
                  * Boş veya virgüllü giriş `Number("")` ile NaN üretip bütün
                  * çizimi düşürüyordu; `plateNumber` sayıya çevrilemeyen değeri
                  * hiç yazmaz, geçerli olanı ise sınırlarına çeker.
                  */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Genişlik (mm)</Label><Input type="number" min={120} max={1000} className="mt-1" value={payload.plate.widthMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPlate("widthMm", event.target.value, 120, 1000)} /></div>
                  <div><Label>Yükseklik (mm)</Label><Input type="number" min={80} max={1000} className="mt-1" value={payload.plate.heightMm} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPlate("heightMm", event.target.value, 80, 1000)} /></div>
                  <div><Label>Delik Çapı (mm)</Label><Input type="number" min={0} max={50} step="0.5" className="mt-1" placeholder="" value={payload.plate.holeDiameterMm ?? ""} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPlate("holeDiameterMm", event.target.value, 0, 50)} /></div>
                  <div><Label>Delik Payı (mm)</Label><Input type="number" min={0} max={100} step="0.5" className="mt-1" value={payload.plate.holeInsetMm ?? ""} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setPlate("holeInsetMm", event.target.value, 0, 100)} /></div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {/*
                    * CE bir BEYANDIR: yalnız uygunluk değerlendirmesi tamamlanmış
                    * ve AT Uygunluk Beyanı düzenlenmiş makineye iliştirilir.
                    */}
                  <DraftToggle
                    checked={payload.plate.ceMark !== false}
                    disabled={!workspace.editableRevision || !canEdit}
                    label="CE işareti bas"
                    onChange={(checked) => setPayload({ ...payload, plate: { ...payload.plate, ceMark: checked } })}
                  />
                  <DraftToggle
                    checked={payload.plate.monochrome === true}
                    disabled={!workspace.editableRevision || !canEdit}
                    label="Tek renk (kazıma)"
                    onChange={(checked) => setPayload({ ...payload, plate: { ...payload.plate, monochrome: checked } })}
                  />
                </div>
              </div>
              <div className="border-t p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="oc-kicker text-muted-foreground">QR Hazırlık Kontrolü</span>
                  <Badge variant={qrReady ? "outline" : "destructive"}>{qrReady ? <CheckCircle2 className="size-3" /> : <TriangleAlert className="size-3" />}{qrReady ? "Müşteriye Hazır" : "Kurulum Eksik"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {readiness.map((entry) => <div key={entry.label} className="flex items-center gap-2 text-xs">{entry.ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <TriangleAlert className="size-3.5 text-destructive" />} {entry.label}</div>)}
                </div>
                <div className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground">
                  <span>{customerLogoDataUrl ? "MÜŞTERİ LOGOSU · HAZIR" : "MÜŞTERİ LOGOSU · KAYITTA YOK"}</span>
                  <span>{nameplateLayout?.title.lines.length === 2 ? "ÜRÜN ADI · İKİ SATIRA YERLEŞTİRİLDİ" : "ÜRÜN ADI · TEK SATIR"}</span>
                  <span>QR MODÜLÜ · {nameplateLayout ? `${nameplateLayout.qr.moduleMm.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} mm` : "—"}</span>
                </div>
                {/*
                  * BASKI DENETİMİ — yerleşim ne bulduysa onu söyler.
                  *
                  * Eksik CE yüksekliği, boş imalatçı adresi, sığmayan başlık,
                  * okunmayacak kadar küçük yazı ve yazı alanına giren delik
                  * aynı listede toplanır. Plakanın kendisi bunu bilir; kartın
                  * işi yalnız göstermektir (`nameplate.ts:issues`).
                  */}
                {nameplateLayout && nameplateLayout.issues.length > 0 && (
                  <div className="mt-3 border border-destructive/30 bg-destructive/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive"><TriangleAlert className="size-3.5" /> Baskı denetimi · {nameplateLayout.issues.length} uyarı</div>
                    <ul className="mt-1.5 grid gap-1 text-[11px] leading-4 text-destructive">
                      {nameplateLayout.issues.map((issue) => <li key={issue}>· {issue}</li>)}
                    </ul>
                  </div>
                )}
                {selectedUnit && (
                  <div className="mt-3 flex min-w-0 items-center gap-2 border-t pt-3">
                    <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">{portalUrl}</span>
                    <Button asChild size="icon" variant="outline" className="size-11 shrink-0"><a href={portalUrl} target="_blank" rel="noreferrer" aria-label="Müşteri bağlantısını test et"><ExternalLink className="size-4" /></a></Button>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section id={capaKimligi("dokumanlar")} className={cn("oc-capa", "relative overflow-hidden border bg-card", bolumSinifi("dokumanlar"))}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><FilePlus2 className="size-4 text-primary" /> Müşteriye Açılacak Dokümanlar</div><p className="mt-1 text-xs text-muted-foreground">Kaynaklar otomatik bulunur; çıktı türü, klasör ve erişim biçimi sizin onayınızdır.</p></div>
          {workspace.editableRevision && canEdit && <div><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const form = new FormData(); form.set("file", file); run(() => uploadCustomPortalDocument(projectId, displayRevision.id, form), "Özel PDF eklendi."); event.target.value = ""; }} /><Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-4" /> PDF Ekle</Button></div>}
        </header>
        <div className="divide-y">
          {payload.documents.map((document) => (
            <div key={document.id} className="grid min-w-0 gap-3 px-4 py-4 lg:grid-cols-[auto_minmax(140px,1fr)_minmax(210px,1fr)_auto] lg:items-center xl:grid-cols-[auto_minmax(220px,1fr)_minmax(380px,1.35fr)_auto]">
              {/* Hazır olmayan kaynak İŞARETLENEMEZ: yayım onu zaten atlar, işaretli
                  bırakmak müşteriye eksik paket gideceğini gizlerdi. */}
              <DraftToggle checked={document.included} disabled={!workspace.editableRevision || !canEdit || !document.ready} label="Dahil" onChange={(included) => setDocument(document.id, { included })} />
              <div className="min-w-0">
                <Label>Belge Adı</Label>
                <Input className="mt-1 min-w-0" value={document.title} disabled={!workspace.editableRevision || !canEdit} onChange={(event) => setDocument(document.id, { title: event.target.value })} />
                <div className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{document.sourceLabel}{document.sourceRevisionLabel ? ` · ${document.sourceRevisionLabel}` : ""}</div>
                {/* Neden yayımlanamadığı SATIRIN KENDİSİNDE yazar; kullanıcı
                    "belgem var ama listede yok" sorusuyla baş başa kalmaz. */}
                {!document.ready && document.unavailableReason && (
                  <p className="mt-1.5 border-l-2 border-destructive/50 pl-2 text-[11px] leading-4 text-destructive">{document.unavailableReason}</p>
                )}
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
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
        <DialogContent className="h-[92dvh] max-h-[92dvh] relative grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[min(1480px,calc(100vw-2rem))] sm:gap-0 sm:p-0">
          <DialogHeader className="border-b bg-muted/40 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div><DialogTitle>Müşteri Ne Görüyor?</DialogTitle><DialogDescription className="mt-1">Dış portalın gerçek sunum bileşeni; iç uygulama kabuğu bu görünümde yoktur.</DialogDescription></div>
              <div className="flex gap-2"><Button variant={previewMode === "draft" ? "default" : "outline"} onClick={() => setPreviewMode("draft")} disabled={!liveDraftPreview}>Taslak</Button><Button variant={previewMode === "published" ? "default" : "outline"} onClick={() => setPreviewMode("published")} disabled={!publishedPreview}>Yayındaki</Button></div>
            </div>
          </DialogHeader>
          <div className="relative min-h-0 overflow-auto">
            {preview ? <CustomerPortalView dto={{ ...preview, preview: true, serialNo: selectedUnit?.serialNo ?? preview.serialNo, publicCode: selectedUnit?.publicCode ?? preview.publicCode }} /> : <div className="grid h-full place-items-center p-10 text-center text-sm text-muted-foreground"><div><LockKeyhole className="mx-auto mb-3 size-6" /> Henüz bu kipte müşteri önizlemesi yok.</div></div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[min(42rem,calc(100%-2rem))]">
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
    </div>
  );
}
