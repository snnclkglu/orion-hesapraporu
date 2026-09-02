import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcInputFromRevision } from "@/lib/revision-load";
import { mechanismClassText } from "@/lib/calc/mechanism-class";
import { loadCurrentElectricalDoc } from "@/lib/electrical/data";
import { loadManual, loadManualRevisions } from "@/lib/manual/data";
import { loadCurrentSpec } from "@/lib/project-specs";
import { getReportSettings } from "@/lib/settings";
import { loadSelfCompany } from "@/lib/customers/company-server";
import {
  frequencyFromSupplyVoltage,
  identityValues,
  resolveIdentityFields,
  withProductPortalDefaults,
} from "./identity";
import { PORTAL_FOLDER_OPTIONS } from "./types";
import type {
  CraneUnitRow,
  IdentitySource,
  PortalDocumentSelection,
  ProductIdentityField,
  ProductIdentityValues,
  ProductPortalFileDto,
  ProductPortalPayload,
  ProductPortalRevisionRow,
  ResolvedIdentityField,
} from "./types";

export const CUSTOMER_PORTAL_BUCKET = "customer-portal";

function portalFolder(key: (typeof PORTAL_FOLDER_OPTIONS)[number]["key"]) {
  const folder = PORTAL_FOLDER_OPTIONS.find((entry) => entry.key === key);
  if (!folder) throw new Error(`Portal klasörü tanımlı değil: ${key}`);
  return {
    folderKey: folder.key,
    folderTitle: folder.title,
    folderSort: folder.sort,
  };
}

export interface ProductPortalWorkspace {
  portalId: string;
  projectId: string;
  currentRevisionId: string | null;
  revisions: ProductPortalRevisionRow[];
  editableRevision: ProductPortalRevisionRow | null;
  units: CraneUnitRow[];
  identityFields: ResolvedIdentityField[];
  identity: ProductIdentityValues;
  publishedFiles: ProductPortalFileDto[];
}

const EMPTY_VALUES: ProductIdentityValues = {
  manufacturer: "",
  manufacturerAddress: "",
  product: "",
  craneType: "",
  machineModel: "",
  projectCode: "",
  productionYear: "",
  capacity: "",
  span: "",
  liftHeight: "",
  mass: "",
  dutyClass: "",
  supplyVoltage: "",
  controlVoltage: "",
  frequency: "",
  customer: "",
  site: "",
  mainHoistSummary: "",
  trolleyTravelSummary: "",
  bridgeTravelSummary: "",
};

function source(
  kind: IdentitySource["kind"],
  label: string,
  sourceId?: string,
  revisionLabel?: string
): IdentitySource {
  return { kind, label, ...(sourceId ? { sourceId } : {}), ...(revisionLabel ? { revisionLabel } : {}) };
}

/** Kapaktaki gibi: gereksiz sıfır basmadan, Türkçe ondalık ayracıyla. */
function num(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * KÜTLE = KÖPRÜ + ARABA(LAR). Kaynak etiketinde bu AÇIKÇA yazar.
 *
 * md. 1.7.3 kaldırılan/taşınan parçalar için kütle işaretlemesi ister. Uygulama
 * tek bir "toplam vinç ağırlığı" tutmaz; `bridgeWeightT` (ana kirişler +
 * başkirişler) ile araba ağırlıkları toplanır. Bu bir TÜRETMEDİR, uydurma
 * değildir — ama neyin toplandığı kullanıcıya söylenmeden bırakılamaz, o yüzden
 * kaynak etiketi "köprü + araba ağırlığı" der ve değer elle düzeltilebilir.
 */
function craneMass(specs: { bridgeWeightT?: unknown; mainTrolleyWeightT?: unknown; auxTrolleyWeightT?: unknown } | null): string {
  if (!specs) return "";
  const parts = [specs.bridgeWeightT, specs.mainTrolleyWeightT, specs.auxTrolleyWeightT]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (parts.length === 0) return "";
  const total = parts.reduce((sum, value) => sum + value, 0);
  return `${num(total)} t`;
}

/**
 * Plaka alanlarının tek otomatik çözücüsü. Bilinmeyen değer boş kalır; her
 * alan kaynağını da taşır ki kullanıcı hangi bölümden geldiğini görsün.
 */
export async function resolveAutomaticProductIdentity(
  supabase: SupabaseClient,
  projectId: string,
  payload: ProductPortalPayload
): Promise<{ fields: ResolvedIdentityField[]; values: ProductIdentityValues }> {
  /*
   * KİMLİK HESAP GİRDİSİNDEN OKUNUR — EL KİTABININ BASILI SATIRLARINDAN DEĞİL.
   *
   * Önceki çözücü `buildManualSourceData` çağırıyor ve dönen tablolarda
   * /^KAPASİTE$/, /frekans/ gibi ETİKET DESENLERİ arıyordu. İki bedeli vardı:
   *
   *   1. KIRILGANDI. Etiket metni el kitabı için değişirse kimlik sessizce
   *      boşalır — plakaya kazınan bir değer için kabul edilemez bir bağ.
   *   2. PAHALIYDI. O fonksiyon `runCalc`ı, ekipman gruplarını ve BÜTÜN
   *      elektrik malzeme tablosunu (1000'er satır sayfalanarak) çalıştırır;
   *      yedi metin alanı için her proje sayfası açılışında. Üstelik
   *      `pdf/report.tsx` üzerinden @react-pdf'i de proje sayfası paketine
   *      taşıyordu — `materialize-server.ts`in başındaki uyarının aynısı.
   *
   * Artık revizyonun kendi `inputs`/`selections` JSONB'si okunur ve değerler
   * doğrudan `calcInput.specs`ten alınır. `runCalc` ÇAĞRILMAZ: motorun türettiği
   * sınıf ve hız alanları zaten kaydedilirken `specs`e geri işlenmiştir.
   */
  const [{ data: project }, { data: items }, { data: revisions }, { data: job }, settings, kendiFirma] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, doc_no, name, customer, crane_type, crane_location")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("job_items")
        .select("id, item_no, product_name, quantity, job_id")
        .eq("project_id", projectId)
        .order("sort", { ascending: true })
        .limit(1),
      supabase
        .from("revisions")
        .select("id, rev_no, status, inputs, selections")
        .eq("project_id", projectId)
        .order("rev_no", { ascending: false }),
      supabase
        .from("job_items")
        .select("jobs!inner(workshop_exit_date, delivery_date)")
        .eq("project_id", projectId)
        .order("sort", { ascending: true })
        .limit(1)
        .maybeSingle(),
      getReportSettings(supabase),
      /*
       * ÜRETİCİ KÜNYESİ MÜŞTERİ DEFTERİNDEN (kullanıcı kararı, 01.09.2026:
       * *"Müşteriler kısmına ORION Vinç olarak kendimiz varız zaten… kendi
       * bilgilerimizi de buradan çeksin"*).
       *
       * `app_settings.report` yalnız `company` ve `city` taşıyor; `address`
       * seed'lenmemiş ve md. 1.7.3'ün istediği TAM ADRES orada yok — plaka
       * "İmalatçı adresi boş" uyarısını bu yüzden kalıcı gösteriyordu.
       * Defterdeki kayıt sokak adresi, vergi dairesi ve vergi numarasını
       * birlikte taşır. Kayıt yoksa ayarlara düşülür; uydurulmaz.
       */
      loadSelfCompany(supabase).catch(() => null),
    ]);

  const item = items?.[0] ?? null;
  const report = (revisions ?? []).find((entry) => entry.status === "issued") ?? revisions?.[0] ?? null;
  const reportLabel = report ? `Hesap Raporu · V${report.rev_no}` : "Hesap Raporu";

  const calc = report
    ? calcInputFromRevision(
        report.inputs as Parameters<typeof calcInputFromRevision>[0],
        report.selections as Parameters<typeof calcInputFromRevision>[1]
      )
    : null;
  const specs = calc?.specs ?? null;
  const capacity = specs && Number.isFinite(specs.mainCapacityT)
    ? `${num(specs.mainCapacityT)} t${
        calc?.auxHoist && Number.isFinite(specs.auxCapacityT) ? ` / ${num(specs.auxCapacityT)} t` : ""
      }`
    : "";

  /*
   * ÜRETİM YILI = İMALATIN TAMAMLANDIĞI YIL (2006/42/AT Ek I md. 1.7.3).
   *
   * Önceki değer `new Date().getFullYear()` idi, yani KİMLİĞİN OLUŞTURULDUĞU
   * yıl — yıl dönümünde sessizce kayar ve plakaya YANLIŞ bir yıl kazınırdı.
   * Kaynak iş emrinin atölye çıkış tarihidir; yoksa teslim tarihi. İkisi de
   * yoksa alan BOŞ kalır (değişmez md. 4: uydurma veri girilmez) ve kullanıcı
   * elle yazar — plakadaki bir yılı tahmin etmek, boş bırakmaktan kötüdür.
   */
  const jobDates = (job?.jobs ?? null) as { workshop_exit_date?: string | null; delivery_date?: string | null } | null;
  const productionDate = jobDates?.workshop_exit_date ?? jobDates?.delivery_date ?? "";
  const productionYear = /^\d{4}/.test(String(productionDate)) ? String(productionDate).slice(0, 4) : "";

  /*
   * MEKANİZMA ÖZETLERİ (md. 20) — veri ZATEN kapsamda, yalnız okunmuyordu.
   *
   * `calcInputFromRevision` bütün AKTİF modülleri döndürür; zemine sabit bir
   * vinçte `trolley`/`bridge` hiç gelmez ve satır da basılmaz (değişmez md. 4:
   * olmayan bir eksenin hızı uydurulmaz). Yeni sorgu ya da migration gerekmez.
   */
  const motor = (sel: { motorPowerKw?: number; motorCount?: number } | undefined): string => {
    const kw = sel?.motorPowerKw;
    const adet = sel?.motorCount;
    if (!Number.isFinite(kw) || (kw ?? 0) <= 0) return "";
    const n = Number.isFinite(adet) && (adet ?? 0) > 0 ? Math.round(adet as number) : 1;
    return `${n} × ${num(kw as number)} kW`;
  };
  const teker = (
    sel: { wheelDiaMm?: number } | undefined,
    inp: { wheelCount?: number } | undefined
  ): string => {
    const cap = sel?.wheelDiaMm;
    const adet = inp?.wheelCount;
    if (!Number.isFinite(cap) || (cap ?? 0) <= 0 || !Number.isFinite(adet) || (adet ?? 0) <= 0) {
      return "";
    }
    return `Ø${num(cap as number)} × ${Math.round(adet as number)}`;
  };
  const hiz = (v: unknown): string =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? `${num(v)} m/dak` : "";
  const ozet = (...parcalar: string[]): string => parcalar.filter(Boolean).join(" · ");

  const supplyVoltage = String(specs?.supplyVoltage ?? "").trim();
  const automatic: ProductIdentityValues = {
    ...EMPTY_VALUES,
    manufacturer: kendiFirma?.name || settings.company.trim(),
    // md. 1.7.3 TAM ADRES ister; defterdeki kayıt sokak adresini ve vergi
    // künyesini taşır, ayarlar yalnız şehir satırını.
    manufacturerAddress: kendiFirma
      ? [kendiFirma.address, [kendiFirma.taxOffice, kendiFirma.taxNo].filter(Boolean).join(" · ")]
          .filter(Boolean)
          .join(" · ")
      : [settings.address, settings.city].map((part) => String(part ?? "").trim()).filter(Boolean).join(" · "),
    product: String(item?.product_name ?? project?.name ?? "").trim(),
    craneType: String(project?.crane_type ?? "").trim(),
    /*
     * SERİ / TİP TANIMLAMASININ OTOMATİK KAYNAĞI YOKTUR.
     *
     * Uygulamada bir "model kodu" alanı yok ve uydurmak yasak (değişmez md. 4).
     * Alan boş gelir, kullanıcı yazar; yerleşim boşluğu bir UYARI olarak
     * bildirir (`layout.issues`), sessizce geçmez.
     */
    machineModel: "",
    projectCode: String(item?.item_no ?? project?.doc_no ?? "").trim(),
    productionYear,
    capacity,
    span: specs && Number.isFinite(specs.spanM) ? `${num(specs.spanM)} m` : "",
    liftHeight: specs && Number.isFinite(specs.mainLiftHeightM) ? `${num(specs.mainLiftHeightM)} m` : "",
    mass: craneMass(specs),
    dutyClass: [
      specs ? mechanismClassText(String(specs.hoistMechanismClass ?? "")) : "",
      specs ? String(specs.structureClass ?? "").trim() : "",
    ].filter(Boolean).join(" · "),
    supplyVoltage,
    controlVoltage: String(specs?.controlVoltage ?? "").trim(),
    frequency: frequencyFromSupplyVoltage(supplyVoltage),
    customer: String(project?.customer ?? "").trim(),
    site: String(project?.crane_location ?? "").trim(),
    mainHoistSummary: calc?.mainHoist
      ? ozet(hiz(specs?.mainLiftSpeedMpm), motor(calc.mainHoist.selections))
      : "",
    trolleyTravelSummary: calc?.trolley
      ? ozet(
          hiz(specs?.trolleySpeedMpm),
          teker(calc.trolley.selections, calc.trolley.inputs),
          motor(calc.trolley.selections)
        )
      : "",
    bridgeTravelSummary: calc?.bridge
      ? ozet(
          hiz(specs?.bridgeSpeedMpm),
          teker(calc.bridge.selections, calc.bridge.inputs),
          motor(calc.bridge.selections)
        )
      : "",
  };

  const projectSource = source("project", "Proje künyesi", String(project?.id ?? ""));
  const itemSource = source("job_item", "İş emri kalemi", String(item?.id ?? ""));
  const reportSource = source(
    "report",
    reportLabel,
    report ? String(report.id) : undefined,
    report ? `V${report.rev_no}` : undefined
  );
  const sources: Record<ProductIdentityField, IdentitySource> = {
    manufacturer: kendiFirma
      ? source("customer", "Müşteri defteri · kendi firmamız", kendiFirma.id)
      : source("settings", "Rapor / firma ayarları"),
    manufacturerAddress: kendiFirma
      ? source("customer", "Müşteri defteri · kendi firmamız", kendiFirma.id)
      : source("settings", "Rapor / firma ayarları"),
    product: item ? itemSource : projectSource,
    craneType: projectSource,
    machineModel: source("system", "Elle girilir · otomatik kaynağı yok"),
    projectCode: item ? itemSource : projectSource,
    productionYear: source("job_item", "İş emri atölye çıkış / teslim tarihi", String(item?.id ?? "")),
    capacity: reportSource,
    span: reportSource,
    liftHeight: reportSource,
    mass: source("report", `${reportLabel} · köprü + araba ağırlığı`, report ? String(report.id) : undefined),
    dutyClass: reportSource,
    supplyVoltage: reportSource,
    controlVoltage: reportSource,
    frequency: reportSource,
    customer: projectSource,
    site: projectSource,
    mainHoistSummary: reportSource,
    trolleyTravelSummary: reportSource,
    bridgeTravelSummary: reportSource,
  };
  const fields = resolveIdentityFields(automatic, sources, payload.overrides);
  return { fields, values: identityValues(fields) };
}

function documentCandidate(
  input: Omit<PortalDocumentSelection, "included" | "automatic" | "ready"> &
    Partial<Pick<PortalDocumentSelection, "included" | "automatic" | "ready">>
): PortalDocumentSelection {
  return {
    ...input,
    included: input.included ?? true,
    automatic: input.automatic ?? true,
    ready: input.ready ?? true,
  };
}

/**
 * ATLANAN KAYNAK İZ BIRAKIR — sessizce yok sayılmaz.
 *
 * `ready: false` ve `unavailableReason` tipte ve şemada tanımlıydı ama HİÇBİR
 * YERDE üretilmiyordu: `documentCandidate` her zaman `ready: true` veriyordu,
 * yani karttaki "Eksik" rozeti erişilemez koddu. Sonuç, kullanıcının bildirdiği
 * kafa karışıklığıydı: sekmede "İşletme ve Bakım El Kitabı 1" yazarken portal
 * listesinde el kitabı GÖRÜNMÜYORDU ve neden görünmediği hiçbir yerde yazmıyordu
 * (sekme rozeti TASLAKLARI da sayar, portal yalnız YAYIMLANMIŞ sürümü alır).
 *
 * Artık kaynak var ama yayıma uygun değilse aday yine listelenir: dahil edilmez,
 * "Eksik" rozetiyle görünür ve gerekçesini taşır. Kaynak hiç yoksa satır da
 * yoktur — olmayan bir belgeye yer açmak, boş çerçeve göstermek olurdu.
 */
function unavailableCandidate(
  input: Parameters<typeof documentCandidate>[0],
  reason: string
): PortalDocumentSelection {
  return documentCandidate({ ...input, included: false, ready: false, unavailableReason: reason });
}

/** İç bölümlerden bulunan teslim edilebilir PDF'ler; henüz müşteri yayını değildir. */
export async function discoverPortalDocuments(
  supabase: SupabaseClient,
  projectId: string
): Promise<PortalDocumentSelection[]> {
  const [{ data: project }, { data: revisions }, { data: allRevisions }, manual, electrical, spec, { data: itemRows }] =
    await Promise.all([
      supabase.from("projects").select("doc_no, name").eq("id", projectId).maybeSingle(),
      supabase
        .from("revisions")
        .select("id, rev_no, label, status")
        .eq("project_id", projectId)
        .eq("status", "issued")
        .order("rev_no", { ascending: false }),
      // Yayımlanmamış revizyonları da SAYARIZ: hiç rapor yoksa satır basmayız,
      // varsa ama yayımlanmamışsa gerekçeyi yazarız.
      supabase
        .from("revisions")
        .select("id, rev_no")
        .eq("project_id", projectId)
        .order("rev_no", { ascending: false })
        .limit(1),
      loadManual(supabase, projectId),
      loadCurrentElectricalDoc(supabase, projectId),
      loadCurrentSpec(supabase, projectId),
      supabase.from("job_items").select("id, item_no").eq("project_id", projectId),
    ]);

  const output: PortalDocumentSelection[] = [];
  const report = revisions?.[0] ?? null;
  if (report) {
    output.push(documentCandidate({
      id: "auto:report",
      sourceKind: "report",
      sourceId: String(report.id),
      sourceLabel: "Yayımlanmış hesap raporu arşivi",
      sourceRevisionLabel: `V${report.rev_no}`,
      reportLevel: "detayli",
      title: `Hesap Raporu · Detaylı · V${report.rev_no}`,
      ...portalFolder("hesap-raporlari"),
      fileSort: 10,
      accessMode: "view_watermarked",
    }));
    output.push(documentCandidate({
      id: "auto:equipment",
      sourceKind: "equipment",
      sourceId: String(report.id),
      sourceLabel: "Hesap raporu revizyonundan otomatik üretilir",
      sourceRevisionLabel: `V${report.rev_no}`,
      equipmentDetail: "standart",
      title: `Ekipman Listesi · Standart · V${report.rev_no}`,
      ...portalFolder("ekipman-listeleri"),
      fileSort: 10,
      accessMode: "view_watermarked",
    }));
  } else if ((allRevisions ?? []).length > 0) {
    // Rapor VAR ama hiçbiri yayımlanmamış. Sessizce atlamak, kullanıcının
    // "hesap raporum var, neden listede yok?" sorusunu cevapsız bırakıyordu.
    const reason = "Hesap raporunun yayımlanmış revizyonu yok; müşteri paketi taslak revizyondan üretilmez.";
    output.push(unavailableCandidate({
      id: "auto:report",
      sourceKind: "report",
      sourceId: String(allRevisions![0].id),
      sourceLabel: "Yayımlanmış hesap raporu arşivi",
      sourceRevisionLabel: "",
      reportLevel: "detayli",
      title: "Hesap Raporu · Detaylı",
      ...portalFolder("hesap-raporlari"),
      fileSort: 10,
      accessMode: "view_watermarked",
    }, reason));
    output.push(unavailableCandidate({
      id: "auto:equipment",
      sourceKind: "equipment",
      sourceId: String(allRevisions![0].id),
      sourceLabel: "Hesap raporu revizyonundan otomatik üretilir",
      sourceRevisionLabel: "",
      equipmentDetail: "standart",
      title: "Ekipman Listesi · Standart",
      ...portalFolder("ekipman-listeleri"),
      fileSort: 10,
      accessMode: "view_watermarked",
    }, reason));
  }

  if (manual) {
    const manualRevisions = await loadManualRevisions(supabase, manual.id);
    const issued = manualRevisions.find((entry) => entry.status === "issued");
    const base = {
      id: "auto:manual",
      sourceKind: "manual" as const,
      sourceId: issued?.id ?? manual.id,
      sourceLabel: "Yayımlanmış işletme ve bakım el kitabı",
      sourceRevisionLabel: issued ? `V${issued.revNo}` : "",
      title: `İşletme ve Bakım El Kitabı${issued ? ` · V${issued.revNo}` : ""}`,
      ...portalFolder("isletme-bakim"),
      fileSort: 20,
      // Dijital kullanım talimatı müşterinin kaydedip yazdırabilmesi için indirilir.
      accessMode: "download" as const,
    };
    output.push(issued
      ? documentCandidate(base)
      : unavailableCandidate(
          base,
          manualRevisions.length > 0
            ? "El kitabının yayımlanmış sürümü yok; taslak müşteriye açılamaz. Önce el kitabını yayımlayın."
            : "El kitabı henüz oluşturulmuş ama hiç sürümü yok."
        ));
  }

  if (electrical) output.push(documentCandidate({
    id: "auto:electrical",
    sourceKind: "electrical",
    sourceId: electrical.id,
    sourceLabel: "Güncel olarak işaretlenmiş elektrik projesi",
    sourceRevisionLabel: electrical.revision,
    title: `Elektrik Projesi${electrical.revision ? ` · ${electrical.revision}` : ""}`,
    ...portalFolder("elektrik-projeleri"),
    fileSort: 10,
    accessMode: "view_watermarked",
  }));

  if (spec) {
    const specBase = {
      id: "auto:specification",
      sourceKind: "specification" as const,
      sourceId: spec.id,
      sourceLabel: "Güncel teknik şartname",
      sourceRevisionLabel: spec.revision,
      title: `Teknik Şartname${spec.revision ? ` · ${spec.revision}` : ""}`,
      ...portalFolder("proje-belgeleri"),
      fileSort: 30,
      accessMode: "download" as const,
    };
    output.push(spec.contentType === "application/pdf"
      ? documentCandidate(specBase)
      : unavailableCandidate(
          specBase,
          // Word/Excel şartname müşteri paketine giremez: paket yalnız PDF taşır.
          `Şartname PDF değil (${spec.contentType || "bilinmeyen tür"}); müşteri paketi yalnız PDF taşır.`
        ));
  }

  const itemIds = (itemRows ?? []).map((entry) => String(entry.id));
  const itemNos = (itemRows ?? []).map((entry) => String(entry.item_no ?? "")).filter(Boolean);
  if (itemIds.length > 0 || itemNos.length > 0) {
    const filters: string[] = [];
    if (itemIds.length > 0) filters.push(`job_item_id.in.(${itemIds.join(",")})`);
    if (itemNos.length > 0) filters.push(`item_no.in.(${itemNos.map((no) => `"${no.replaceAll('"', "")}"`).join(",")})`);
    const { data: packages } = await supabase
      .from("drawing_packages")
      .select("id, folder_name, rev_no, status")
      .or(filters.join(","))
      .neq("status", "superse")
      .order("rev_no", { ascending: false });
    const packageIds = (packages ?? []).map((entry) => String(entry.id));
    if (packageIds.length > 0) {
      const { data: files } = await supabase
        .from("drawing_files")
        .select("id, package_id, file_name, storage_path, stored")
        .in("package_id", packageIds)
        .eq("stored", true)
        .eq("lifecycle", "canli")
        .ilike("file_name", "%.pdf")
        .order("file_name", { ascending: true });
      for (const [index, file] of (files ?? []).entries()) {
        const pack = (packages ?? []).find((entry) => entry.id === file.package_id);
        output.push(documentCandidate({
          id: `drawing:${file.id}`,
          sourceKind: "drawing",
          sourceId: String(file.id),
          sourceLabel: String(pack?.folder_name ?? "Teknik resim paketi"),
          sourceRevisionLabel: pack ? `R${String(pack.rev_no).padStart(2, "0")}` : "",
          title: String(file.file_name).replace(/\.pdf$/i, ""),
          ...portalFolder("teknik-resimler"),
          fileSort: index + 1,
          accessMode: "view_watermarked",
          // Yüzlerce imalat paftasını fark edilmeden yayımlamamak için bulunur
          // ama ilk kez insan seçimi bekler.
          included: false,
        }));
      }
    }
  }

  void project;
  return output;
}

/** Yeni bulunan kaynakları kullanıcı seçimini bozmadan taslağa ekler. */
export function mergeDiscoveredDocuments(
  existing: readonly PortalDocumentSelection[],
  discovered: readonly PortalDocumentSelection[]
): PortalDocumentSelection[] {
  const byId = new Map(discovered.map((entry) => [entry.id, entry]));
  const singletonKinds = new Set<PortalDocumentSelection["sourceKind"]>([
    "report",
    "equipment",
    "manual",
    "electrical",
    "specification",
  ]);
  const merged = existing.flatMap((entry) => {
    const semanticId = entry.automatic && singletonKinds.has(entry.sourceKind)
      ? `auto:${entry.sourceKind}`
      : entry.id;
    const fresh = byId.get(semanticId);
    if (!fresh || entry.sourceKind === "custom") return entry;
    byId.delete(semanticId);
    const reportLevel = entry.reportLevel ?? fresh.reportLevel;
    const equipmentDetail = entry.equipmentDetail ?? fresh.equipmentDetail;
    const generatedTitle = (() => {
      if (entry.sourceKind === "report") {
        const label = reportLevel === "ozet"
          ? "Özet"
          : reportLevel === "standart"
            ? "Standart"
            : reportLevel === "teker_yukleri"
              ? "Teker Yükleri"
              : "Detaylı";
        return `Hesap Raporu · ${label}${fresh.sourceRevisionLabel ? ` · ${fresh.sourceRevisionLabel}` : ""}`;
      }
      if (entry.sourceKind === "equipment") {
        const label = equipmentDetail === "detayli" ? "Detaylı" : "Standart";
        return `Ekipman Listesi · ${label}${fresh.sourceRevisionLabel ? ` · ${fresh.sourceRevisionLabel}` : ""}`;
      }
      return fresh.title;
    })();
    const hadGeneratedTitle = entry.automatic && (
      entry.sourceKind === "report"
        ? /^Hesap Raporu(?: · (?:Özet|Standart|Detaylı|Teker Yükleri))?(?: · V\d+)?$/u.test(entry.title)
        : entry.sourceKind === "equipment"
          ? /^Ekipman Listesi(?: · (?:Standart|Detaylı))?(?: · V\d+)?$/u.test(entry.title)
          : entry.title === fresh.title
            || entry.title.startsWith(`${fresh.title.split(" · ")[0]} · `)
    );
    return {
      ...fresh,
      title: hadGeneratedTitle ? generatedTitle : entry.title,
      folderKey: entry.folderKey,
      folderTitle: entry.folderTitle,
      folderSort: entry.folderSort,
      fileSort: entry.fileSort,
      accessMode: entry.accessMode,
      /*
       * KAYNAK YAYIMA UYGUN DEĞİLSE KULLANICININ ESKİ "DAHİL" SEÇİMİ TAŞINMAZ.
       *
       * Aksi hâlde bir belge (ör. el kitabı yeni bir taslağa döndüğünde)
       * yayıma uygunluğunu kaybeder ama işaretli kalır; yayım o belgeyi
       * atlar ve müşteriye eksik paket gider. Uygunluk geri geldiğinde
       * kullanıcı yeniden işaretler — sessiz bir eksik teslimden iyidir.
       */
      included: fresh.ready ? entry.included : false,
      ...(reportLevel ? { reportLevel } : {}),
      ...(equipmentDetail ? { equipmentDetail } : {}),
    };
  });
  return [...merged, ...byId.values()].sort(
    (a, b) => a.folderSort - b.folderSort || a.fileSort - b.fileSort || a.title.localeCompare(b.title, "tr")
  );
}

function revisionRow(raw: Record<string, unknown>): ProductPortalRevisionRow {
  return {
    id: String(raw.id),
    revNo: Number(raw.rev_no),
    status: raw.status === "issued" ? "issued" : "draft",
    payload: withProductPortalDefaults(raw.payload),
    createdAt: String(raw.created_at ?? ""),
    issuedAt: raw.issued_at ? String(raw.issued_at) : null,
  };
}

export async function loadProductPortalWorkspace(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProductPortalWorkspace | null> {
  const { data: portal } = await supabase
    .from("product_portals")
    .select("id, project_id, current_revision_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!portal) return null;

  const [{ data: revisionData }, { data: unitData }] = await Promise.all([
    supabase
      .from("product_portal_revisions")
      .select("id, rev_no, status, payload, created_at, issued_at")
      .eq("portal_id", portal.id)
      .order("rev_no", { ascending: false }),
    supabase
      .from("crane_units")
      .select("id, ordinal, suffix, serial_no, public_code, has_password, password_version, portal_enabled")
      .eq("portal_id", portal.id)
      .order("ordinal", { ascending: true }),
  ]);
  const revisions = ((revisionData ?? []) as Record<string, unknown>[]).map(revisionRow);
  const editableRevision = revisions.find((entry) => entry.status === "draft") ?? null;
  const displayRevision = editableRevision ?? revisions.find((entry) => entry.id === portal.current_revision_id) ?? revisions[0] ?? null;
  if (!displayRevision) return null;

  const payload = displayRevision.payload;
  const automatic = payload.issuedIdentity
    ? {
        fields: resolveIdentityFields(
          payload.issuedIdentity,
          Object.fromEntries(Object.keys(payload.issuedIdentity).map((key) => [
            key,
            source("system", "Yayımlanmış kimlik snapshotı"),
          ])) as Record<ProductIdentityField, IdentitySource>,
          {}
        ),
        values: payload.issuedIdentity,
      }
    : await resolveAutomaticProductIdentity(supabase, projectId, payload);

  let publishedFiles: ProductPortalFileDto[] = [];
  if (portal.current_revision_id) {
    const { data } = await supabase
      .from("product_portal_files")
      .select("id, folder_key, folder_title, folder_sort, file_sort, display_name, file_name, source_revision_label, access_mode, size_bytes, page_count")
      .eq("revision_id", portal.current_revision_id)
      .order("folder_sort", { ascending: true })
      .order("file_sort", { ascending: true });
    publishedFiles = ((data ?? []) as Record<string, unknown>[]).map((file) => ({
      id: String(file.id),
      folderKey: String(file.folder_key),
      folderTitle: String(file.folder_title),
      folderSort: Number(file.folder_sort),
      fileSort: Number(file.file_sort),
      title: String(file.display_name),
      fileName: String(file.file_name),
      revisionLabel: String(file.source_revision_label ?? ""),
      accessMode: file.access_mode === "download" ? "download" : "view_watermarked",
      sizeBytes: Number(file.size_bytes),
      pageCount: Number(file.page_count),
    }));
  }

  return {
    portalId: String(portal.id),
    projectId,
    currentRevisionId: portal.current_revision_id ? String(portal.current_revision_id) : null,
    revisions,
    editableRevision,
    units: ((unitData ?? []) as Record<string, unknown>[]).map((unit) => ({
      id: String(unit.id),
      ordinal: Number(unit.ordinal),
      suffix: String(unit.suffix ?? ""),
      serialNo: String(unit.serial_no),
      publicCode: String(unit.public_code),
      hasPassword: unit.has_password === true,
      passwordVersion: Number(unit.password_version ?? 0),
      portalEnabled: unit.portal_enabled === true,
    })),
    identityFields: automatic.fields,
    identity: automatic.values,
    publishedFiles,
  };
}
