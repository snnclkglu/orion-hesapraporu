"use client";

// "Yeni Hesap Raporu" — Mühendislik ve Teklif Hesap Raporları aynı pencereyi
// kullanır. Mühendislikte rapor istenirse iş emri kalemine bağlanır; teklif
// bağlamında iş seçimi hiç açılmaz ve kayıt ayrı teklif arşivine gider.
// Akış: İş seçilir → o işin kalemleri (ürün + iş no) listelenir → kalem
// seçilince doküman no ve rapor adı otomatik dolar.
//
// DOKÜMAN NO = İŞ KALEMİ NUMARASI (firma kuralı). Rapor işe değil KALEME
// bağlıdır; `0055-01` ve `0055-02` iki ayrı rapordur ve doküman kodları
// `ORC-HR-0055-01-R01` / `ORC-HR-0055-02-R01` olur. Kural alanı serbest
// bırakıldığında üç ayrı yazım birden dolaşıyordu (`0055`, `0055-01`,
// `0055-HR-001`); `0055` yazılan bir işe ikinci kalem eklendiğinde ikinci rapor
// benzersizlik kısıtına takılıyor, kod da hangi kaleme ait olduğunu
// söylemiyordu. Kalem seçiliyken alan artık SALT-OKUNURDUR.

import { useId, useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileJson2, FilePenLine, Files } from "lucide-react";
import { toast } from "sonner";
import {
  createEngineeringProjectV0,
  createOfferProjectFromFile,
  createProject,
} from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Saf yardımcı (dosya sistemi/PDF bağımlılığı yok) — kod önizlemesi ile basılan
// belge AYNI fonksiyondan çıksın diye buradan okunur.
import { docCode } from "@/lib/pdf/doc-naming";
// Vinç tipi listesi TEK YERDEDİR (`lib/crane-types.ts`): aynı liste yönetim
// panelinde, proje düzenleme penceresinde ve burada görünür.
import {
  DEFAULT_CRANE_TYPE,
  craneTypeOptions,
  offerCraneTypeOptions,
} from "@/lib/crane-types";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import {
  ENGINEERING_REPORT_CONTEXT,
  OFFER_REPORT_CONTEXT,
  type ReportContext,
} from "@/lib/report-context";
import type { EngineeringHandoffOption } from "./handoff-options";

export interface JobItemOption {
  /** job_items.id — kalem bağlantısı bu kimlikle güncellenir */
  id: string;
  item_no: string;
  product_name: string;
  quantity: string | null;
  /** Kaleme bağlı hesap raporu zaten varsa (tekrar bağlanmasın diye uyarı) */
  project_id: string | null;
  /** Tekliften açılmış işlerdeki fiyatsız teknik aktarım. */
  handoff?: EngineeringHandoffOption | null;
}

export interface JobOption {
  id: string;
  job_no: string;
  title: string;
  customer: string;
  customer_id?: string | null;
  items?: JobItemOption[];
}

export interface CustomerOption {
  id: string;
  name: string;
  short_name?: string | null;
  has_logo: boolean;
}

/** Seçim kutularında "seçilmedi" anlamına gelen sabitler (boş değer kabul edilmez) */
export const NO_JOB = "__none__";
export const NO_ITEM = "__no_item__";
export const NO_CUSTOMER = "__no_customer__";

type EngineeringCreationMode = "manual" | "from_offer";

const FACT_LABELS: Record<string, string> = {
  mainCapacityT: "Ana kapasite",
  auxCapacityT: "Yardımcı kapasite",
  spanM: "Açıklık",
  mainLiftHeightM: "Kaldırma yüksekliği",
  mainLiftSpeedMpm: "Ana kaldırma hızı",
  auxLiftSpeedMpm: "Yardımcı kaldırma hızı",
  structureClass: "Yapı sınıfı",
  bridgeSpeedMpm: "Köprü hızı",
  trolleySpeedMpm: "Araba hızı",
  ambientTempMinC: "En düşük sıcaklık",
  ambientTempMaxC: "En yüksek sıcaklık",
  installationEnvironment: "Çalışma ortamı",
  supplyVoltage: "Besleme gerilimi",
  controlVoltage: "Kumanda gerilimi",
  runwayLengthM: "Yürüme yolu",
};

export function NewProjectDialog({
  defaultCraneType = DEFAULT_CRANE_TYPE,
  jobs,
  customers = [],
  reportContext = ENGINEERING_REPORT_CONTEXT,
  fixedJobId,
}: {
  defaultCraneType?: string;
  /** Opsiyonel iş seçimi için aktif iş listesi (kalemleriyle birlikte). */
  jobs?: JobOption[];
  /** Yönetim > Müşteriler kayıtları; kapak logoları bu listeden seçilir. */
  customers?: CustomerOption[];
  reportContext?: ReportContext;
  /** İşin doküman sayfasında rapor başka bir işe/bağımsıza açılamaz. */
  fixedJobId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [filePending, startFileTransition] = useTransition();
  const fileInputId = useId();
  const offerContext = reportContext === OFFER_REPORT_CONTEXT;
  const [creationMode, setCreationMode] = useState<EngineeringCreationMode>("manual");
  const craneTypes = offerContext
    ? offerCraneTypeOptions(defaultCraneType)
    : craneTypeOptions(defaultCraneType);
  const [craneType, setCraneType] = useState(defaultCraneType);

  const fixedJob = !offerContext
    ? jobs?.find((job) => job.id === fixedJobId)
    : undefined;
  const availableJobs = useMemo(() => {
    if (offerContext) return [];
    const source = fixedJob ? [fixedJob] : jobs ?? [];
    if (creationMode === "manual") {
      return source.filter((job) => (job.items ?? []).some((item) => !item.project_id));
    }
    return source.filter((job) =>
      (job.items ?? []).some(
        (item) =>
          !item.project_id &&
          item.handoff &&
          item.handoff.eligibility !== "not_applicable"
      )
    );
  }, [creationMode, fixedJob, jobs, offerContext]);
  const showJobSelect = !offerContext && !fixedJob;
  const [selectedJobId, setSelectedJobId] = useState<string>(fixedJob?.id ?? NO_JOB);
  const selectedJob = useMemo(
    () => availableJobs.find((j) => j.id === selectedJobId),
    [availableJobs, selectedJobId]
  );

  const items = (selectedJob?.items ?? []).filter(
    (item) =>
      !item.project_id &&
      (creationMode === "manual" ||
        (item.handoff && item.handoff.eligibility !== "not_applicable"))
  );
  const [selectedItemId, setSelectedItemId] = useState<string>(NO_ITEM);
  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedHandoff = selectedItem?.handoff ?? null;

  // Doküman no / rapor adı / müşteri: iş ve kalem seçilince ön-doldurulur
  const [docNo, setDocNo] = useState(() => {
    if (!fixedJob || (fixedJob.items?.length ?? 0) > 0) return "";
    const base = fixedJob.job_no.split("-")[0];
    return base ? `${base}-01` : "";
  });
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState(() => adBuyuk(fixedJob?.customer ?? ""));
  const [craneLocation, setCraneLocation] = useState("");
  const [endCustomerId, setEndCustomerId] = useState(
    fixedJob?.customer_id || NO_CUSTOMER
  );
  const [reportBrandCustomerId, setReportBrandCustomerId] = useState(NO_CUSTOMER);

  function onPickJob(id: string) {
    setSelectedJobId(id);
    setSelectedItemId(NO_ITEM);
    const job = availableJobs.find((j) => j.id === id);
    if (job) {
      // Ön-doldurulan değer de kuraldan geçer: iş emri eski bir kayıtsa küçük
      // harfli gelebilir ve alan "otomatik doldu" diye kuralın dışında kalamaz.
      setCustomer(adBuyuk(job.customer));
      setEndCustomerId(job.customer_id || NO_CUSTOMER);
      // Kalemi OLAN işte doküman no kalem seçilince dolar. Körlemesine
      // "0055-01" önermek, o numaranın gerçek kalemine açılacak raporla
      // çakışırdı; öneri yalnız hiç kalemi olmayan işlerde yapılır.
      const base = job.job_no.split("-")[0];
      if (!docNo && base && (job.items?.length ?? 0) === 0) setDocNo(`${base}-01`);
    }
  }

  function onPickItem(itemId: string) {
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      if (item.item_no) setDocNo(item.item_no);
      if (item.product_name) setName(adBuyuk(item.product_name));
      if (creationMode === "from_offer" && item.handoff?.craneType) {
        setCraneType(item.handoff.craneType);
      }
    }
  }

  function onCreationModeChange(value: string) {
    const mode = value === "from_offer" ? "from_offer" : "manual";
    setCreationMode(mode);
    setSelectedItemId(NO_ITEM);
    setDocNo("");
    setName("");
    if (!fixedJob) {
      setSelectedJobId(NO_JOB);
      setCustomer("");
      setEndCustomerId(NO_CUSTOMER);
    }
    setCraneType(defaultCraneType);
  }

  const effectiveJobId = selectedJobId !== NO_JOB ? selectedJobId : "";

  function onPickEndCustomer(id: string) {
    setEndCustomerId(id);
    const selected = customers.find((entry) => entry.id === id);
    if (selected) setCustomer(adBuyuk(selected.name));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!offerContext && selectedJobId === NO_JOB) {
      toast.error("Önce bir iş emri seçin.");
      return;
    }
    if (!offerContext && selectedItemId === NO_ITEM) {
      toast.error("Hesap raporu için bir iş kalemi seçin.");
      return;
    }
    if (!offerContext && creationMode === "from_offer" && !selectedHandoff) {
      toast.error("Bu iş kaleminde teklif teknik aktarımı bulunmuyor.");
      return;
    }
    startTransition(async () => {
      const result = offerContext
        ? await createProject(formData)
        : await createEngineeringProjectV0(formData);
      if (result?.error) toast.error(result.error);
      // Başarıda action redirect eder.
    });
  }

  function handleFileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startFileTransition(async () => {
      const result = await createOfferProjectFromFile(formData);
      if (result?.error) toast.error(result.error);
      // Başarıda action yeni V0 editörüne redirect eder.
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Yeni Hesap Raporu</Button>
      </DialogTrigger>
      <DialogContent className="overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Hesap Raporu</DialogTitle>
          <DialogDescription>
            {offerContext
              ? "Teklif aşamasındaki hesabı hemen açın. Aynı mühendislik motoru kullanılır; kayıt Mühendislik arşivine karışmaz."
              : fixedJob
                ? `${fixedJob.job_no} numaralı işin kalemlerinden biri için yeni bir hesap raporu oluşturun.`
              : "Oluşturma yöntemini seçin ve raporu aktif bir iş emri kalemine bağlayın."}
          </DialogDescription>
        </DialogHeader>
        {!offerContext ? (
          <Tabs value={creationMode} onValueChange={onCreationModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">
                <FilePenLine className="size-4" /> Manuel
              </TabsTrigger>
              <TabsTrigger value="from_offer">
                <Files className="size-4" /> Tekliften
              </TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              {creationMode === "manual"
                ? "İş emri kalemini seçin; V0 güncel mühendislik şablonuyla açılır."
                : "Yalnız tekliften açılmış ve fiyatsız teknik aktarımı bulunan iş kalemleri gösterilir."}
            </p>
          </Tabs>
        ) : null}
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* İş bağlantısı */}
          <input type="hidden" name="report_context" value={reportContext} />
          <input type="hidden" name="job_id" value={effectiveJobId} />
          <input type="hidden" name="source_mode" value={creationMode} />
          <input type="hidden" name="handoff_id" value={selectedHandoff?.id ?? ""} />
          <input
            type="hidden"
            name="job_item_id"
            value={selectedItemId === NO_ITEM ? "" : selectedItemId}
          />
          <input
            type="hidden"
            name="end_customer_id"
            value={endCustomerId === NO_CUSTOMER ? "" : endCustomerId}
          />
          <input
            type="hidden"
            name="report_brand_customer_id"
            value={reportBrandCustomerId === NO_CUSTOMER ? "" : reportBrandCustomerId}
          />
          {fixedJob && (
            <div className="grid min-w-0 gap-2">
              <Label>İş Emri</Label>
              <div className="min-w-0 rounded-md border bg-muted/35 px-3 py-2">
                <span className="block truncate text-sm font-medium" title={`${fixedJob.job_no} · ${fixedJob.title}`}>
                  <span className="font-mono text-primary">{fixedJob.job_no}</span>
                  {" · "}
                  {fixedJob.title}
                </span>
              </div>
            </div>
          )}
          {showJobSelect && (
            <div className="grid min-w-0 gap-2">
              <Label>İş Emri</Label>
              <Select value={selectedJobId} onValueChange={onPickJob}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_JOB}>İş Emri Seçin</SelectItem>
                  {availableJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="max-w-[calc(100vw-3rem)]">
                      <span className="block truncate" title={`${j.job_no} · ${j.title}`}>
                        {j.job_no} · {j.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {creationMode === "from_offer"
                    ? "Teknik aktarımı bulunan, raporsuz aktif iş kalemi yok. Önce kazanılan tekliften iş emri oluşturun."
                    : "Rapor bağlanabilecek aktif bir iş kalemi yok. Önce iş emri ve iş kalemi oluşturun."}
                </p>
              ) : null}
            </div>
          )}

          {/* İş kalemi — doküman no + rapor adını doldurur */}
          {items.length > 0 && (
            <div className="grid gap-2">
              <Label>İş Kalemi</Label>
              <Select value={selectedItemId} onValueChange={onPickItem}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ITEM}>İş Kalemi Seçin</SelectItem>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.item_no ? `${it.item_no} · ` : ""}
                      {it.product_name}
                      {it.quantity ? ` (${it.quantity})` : ""}
                      {it.project_id ? " — Raporu Var" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem?.project_id && (
                <p className="text-xs text-destructive">
                  Bu kalemin zaten bir hesap raporu var; yine de yeni bir rapor
                  oluşturabilirsiniz (ör. farklı revizyon hattı).
                </p>
              )}
            </div>
          )}

          {!offerContext && creationMode === "from_offer" && selectedHandoff ? (
            <section className="grid gap-2 rounded-md border border-primary/25 bg-primary/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Teknik Aktarım Özeti</p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selectedHandoff.sourceOfferNo} · R{selectedHandoff.sourceRevisionNo}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedHandoff.technicalFacts).map(([key, value]) => (
                  <span key={key} className="rounded-full border bg-background px-2 py-1 text-[11px]">
                    {FACT_LABELS[key] ?? key}: {String(value)}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bu bilgiler V0 teknik özelliklerine yazılır. Halat, motor,
                redüktör, teker ve kiriş seçimleri otomatik değiştirilmez.
              </p>
              {selectedHandoff.eligibility === "review" ? (
                <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Bu kalemin
                  rapora uygunluğu ve aktarılan değerleri mühendis kontrol etmelidir.
                </p>
              ) : null}
              {selectedHandoff.warnings.map((warning) => (
                <p key={warning} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {warning}
                </p>
              ))}
            </section>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="doc_no">Doküman No</Label>
            <Input
              id="doc_no"
              name="doc_no"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              readOnly={!!selectedItem}
              className={cn(selectedItem && "bg-muted text-muted-foreground")}
              title={
                selectedItem
                  ? "İş kalemi numarasından gelir — elle yazmak için \"Kalem Seçilmedi\"yi seçin"
                  : undefined
              }
              required
            />
            {/* Doküman kodunun canlı önizlemesi: kuralın ne ürettiği alanın
                altında görünsün, PDF açılana kadar beklenmesin. */}
            <p className="text-[11px] text-muted-foreground">
              {offerContext ? (
                <>Teklif çalışmasına ait benzersiz doküman no; rapor kodu bundan türer → </>
              ) : (
                <>
                  Doküman no <span className="font-medium">iş kalemi numarasıdır</span>; rapor
                  kodu bundan türer →{" "}
                </>
              )}
              <span className="font-mono">{docCode("HR", docNo || "0055-01", 1)}</span>
            </p>
          </div>
          {/* AD ALANLARI YAZILIRKEN BÜYÜR (firma kuralı, `adBuyuk`). Dönüşüm
              yalnız kaydetmede yapılsaydı kullanıcı yazdığı hâli görüp
              kaydettikten sonra başka bir metinle karşılaşırdı; sunucu tarafı
              (`projectSchema`) yine de son sözü söyler. */}
          <div className="grid gap-2">
            <Label htmlFor="name">Rapor / Vinç Adı</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(adBuyuk(e.target.value))}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer">Müşteri</Label>
            <Input
              id="customer"
              name="customer"
              value={customer}
              onChange={(e) => setCustomer(adBuyuk(e.target.value))}
              required
            />
          </div>
          {customers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label>Son Kullanıcı (Logo)</Label>
                <Select value={endCustomerId} onValueChange={onPickEndCustomer}>
                  <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>Logo Gösterme</SelectItem>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.short_name || entry.name}{entry.has_logo ? "" : " · Logo Yok"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Rapor Firması</Label>
                <Select value={reportBrandCustomerId} onValueChange={setReportBrandCustomerId}>
                  <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>Rapor Firması Yok</SelectItem>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.short_name || entry.name}{entry.has_logo ? "" : " · Logo Yok"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="crane_location">Vinç Yeri (Opsiyonel)</Label>
            <Input
              id="crane_location"
              name="crane_location"
              value={craneLocation}
              onChange={(e) => setCraneLocation(adBuyuk(e.target.value))}
              maxLength={240}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crane_type">Vinç Tipi</Label>
            <Select value={craneType} onValueChange={setCraneType}>
              <SelectTrigger id="crane_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {craneTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="crane_type" value={craneType} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || filePending}>
              {pending
                ? "Oluşturuluyor..."
                : offerContext
                  ? "Oluştur"
                  : "Oluştur ve V0'ı Aç"}
            </Button>
          </DialogFooter>
        </form>
        {offerContext && (
          <section className="grid gap-3 border-t pt-4" aria-labelledby={`${fileInputId}-title`}>
            <div className="grid gap-1">
              <h3 id={`${fileInputId}-title`} className="flex items-center gap-2 text-sm font-semibold">
                <FileJson2 className="size-4 text-muted-foreground" />
                Dosya ile Oluştur
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Bir teklif hesap raporundan indirilen ve yeni şartnameye göre AI
                agent tarafından doldurulan JSON dosyasını yükleyin. Proje künyesi
                (son kullanıcı, rapor firması, kontrol eden) ve V0 taslağı birlikte
                oluşturulur; hesap sonuçları yeniden hesaplanır. Defterde
                bulunmayan son kullanıcı yeni müşteri olarak açılır.
              </p>
            </div>
            <form onSubmit={handleFileSubmit} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor={fileInputId}>AI Girdi Dosyası</Label>
                <Input
                  id={fileInputId}
                  name="file"
                  type="file"
                  accept=".json,application/json"
                  required
                  disabled={pending || filePending}
                  className="min-w-0 file:mr-2 file:border-0 file:bg-transparent file:font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Yalnız ORION JSON biçimi · en fazla 900 KB
                </p>
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={pending || filePending}
                className="w-full sm:w-auto"
              >
                {filePending ? "Dosya İşleniyor..." : "Dosyadan Oluştur"}
              </Button>
            </form>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
