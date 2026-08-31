import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import type { ProductPortalWorkspace } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import { buildNameplateSvg } from "@/lib/product-portal/nameplate";
import { PLATE_LOGO_URL, SCREEN_FONT_CSS } from "@/lib/product-portal/plate-assets";
import { ProductPortalCard } from "@/app/(app)/projects/[id]/product-portal/product-portal-card";
import {
  PRODUCT_IDENTITY_FIELDS,
  type CustomerPortalDto,
  type PortalDocumentSelection,
  type ProductIdentityValues,
} from "@/lib/product-portal/types";

const identity: ProductIdentityValues = {
  manufacturer: "ORION CRANES",
  manufacturerAddress: "Organize Sanayi Bölgesi, Ankara · TÜRKİYE",
  machineModel: "ORION DGK-100/1485",
  mass: "48,5 t",
  product: "100 T x 14,85 m kapasiteli çift kirişli gezer köprülü vinç",
  craneType: "Çift Kirişli Gezer Köprülü Vinç",
  projectCode: "0057-01",
  productionYear: "2026",
  capacity: "80 t / 20 t",
  span: "24 m",
  liftHeight: "18 m",
  dutyClass: "FEM 3m / ISO M6",
  supplyVoltage: "400 VAC",
  controlVoltage: "24 VDC",
  frequency: "50 Hz",
  customer: "Müşteri Fabrikası A.Ş.",
  site: "Ankara Üretim Tesisi",
};

const portal: CustomerPortalDto = {
  company: "ORION CRANES",
  portalTitle: "Teknik Dokümanlar",
  note: "Bu sayfa, vincin onaylı teslim dokümanlarına güvenli erişim sağlar. Belgelerin güncel sürümleri paket revizyonu ile birlikte yayımlanır.",
  supportEmail: "servis@orioncranes.com",
  product: identity.product,
  craneType: identity.craneType,
  serialNo: "0057-01-A",
  productionYear: "2026",
  projectCode: "0057-01",
  revisionLabel: "R01",
  publishedAt: "2026-08-29T12:00:00.000Z",
  publicCode: "23456789ABCDEFGH",
  customerName: identity.customer,
  customerLogoDataUrl: null,
  preview: true,
  files: [
    { id: "11111111-1111-4111-8111-111111111111", folderKey: "hesap-raporlari", folderTitle: "Hesap Raporları", folderSort: 10, fileSort: 10, title: "Hesap Raporu · Detaylı · V3", fileName: "hesap-raporu.pdf", revisionLabel: "V3", accessMode: "view_watermarked", sizeBytes: 4_850_000, pageCount: 86 },
    { id: "22222222-2222-4222-8222-222222222222", folderKey: "isletme-bakim", folderTitle: "İşletme ve Bakım", folderSort: 30, fileSort: 20, title: "İşletme ve Bakım El Kitabı · V2", fileName: "el-kitabi.pdf", revisionLabel: "V2", accessMode: "download", sizeBytes: 13_200_000, pageCount: 142 },
    { id: "33333333-3333-4333-8333-333333333333", folderKey: "ekipman-listeleri", folderTitle: "Ekipman Listeleri", folderSort: 20, fileSort: 10, title: "Ekipman Listesi · Standart · V3", fileName: "ekipman.pdf", revisionLabel: "V3", accessMode: "view_watermarked", sizeBytes: 1_100_000, pageCount: 18 },
    { id: "44444444-4444-4444-8444-444444444444", folderKey: "elektrik-projeleri", folderTitle: "Elektrik Projeleri", folderSort: 40, fileSort: 10, title: "Elektrik Projesi · R02", fileName: "elektrik.pdf", revisionLabel: "R02", accessMode: "view_watermarked", sizeBytes: 8_420_000, pageCount: 34 },
  ],
};

const documents: PortalDocumentSelection[] = [
  { id: "auto:report", sourceKind: "report", sourceId: "30000000-0000-4000-8000-000000000001", sourceLabel: "Yayımlanmış hesap raporu arşivi", sourceRevisionLabel: "V3", reportLevel: "detayli", title: "Hesap Raporu · Detaylı · V3", folderKey: "hesap-raporlari", folderTitle: "Hesap Raporları", folderSort: 10, fileSort: 10, accessMode: "view_watermarked", included: true, automatic: true, ready: true },
  { id: "auto:equipment", sourceKind: "equipment", sourceId: "30000000-0000-4000-8000-000000000001", sourceLabel: "Hesap raporu revizyonundan otomatik üretilir", sourceRevisionLabel: "V3", equipmentDetail: "standart", title: "Ekipman Listesi · Standart · V3", folderKey: "ekipman-listeleri", folderTitle: "Ekipman Listeleri", folderSort: 20, fileSort: 10, accessMode: "view_watermarked", included: true, automatic: true, ready: true },
  { id: "auto:manual", sourceKind: "manual", sourceId: "40000000-0000-4000-8000-000000000001", sourceLabel: "Yayımlanmış işletme ve bakım el kitabı", sourceRevisionLabel: "V2", title: "İşletme ve Bakım El Kitabı · V2", folderKey: "isletme-bakim", folderTitle: "İşletme ve Bakım", folderSort: 30, fileSort: 20, accessMode: "download", included: true, automatic: true, ready: true },
  { id: "auto:electrical", sourceKind: "electrical", sourceId: "50000000-0000-4000-8000-000000000001", sourceLabel: "Güncel olarak işaretlenmiş elektrik projesi", sourceRevisionLabel: "R02", title: "Elektrik Projesi · R02", folderKey: "elektrik-projeleri", folderTitle: "Elektrik Projeleri", folderSort: 40, fileSort: 10, accessMode: "view_watermarked", included: true, automatic: true, ready: true },
];

const payload = withProductPortalDefaults({
  serialBase: "0057-01",
  plate: { widthMm: 240, heightMm: 160 },
  overrides: {},
  hiddenFields: ["site"],
  portal: { title: portal.portalTitle, note: portal.note, supportEmail: portal.supportEmail },
  documents,
});

const workspace: ProductPortalWorkspace = {
  portalId: "10000000-0000-4000-8000-000000000001",
  projectId: "10000000-0000-4000-8000-000000000002",
  currentRevisionId: "20000000-0000-4000-8000-000000000002",
  revisions: [
    { id: "20000000-0000-4000-8000-000000000003", revNo: 2, status: "draft", payload, createdAt: "2026-08-30T10:00:00.000Z", issuedAt: null },
    { id: "20000000-0000-4000-8000-000000000002", revNo: 1, status: "issued", payload: { ...payload, issuedIdentity: identity }, createdAt: "2026-08-29T10:00:00.000Z", issuedAt: portal.publishedAt },
  ],
  editableRevision: { id: "20000000-0000-4000-8000-000000000003", revNo: 2, status: "draft", payload, createdAt: "2026-08-30T10:00:00.000Z", issuedAt: null },
  units: [
    { id: "60000000-0000-4000-8000-000000000001", ordinal: 1, suffix: "A", serialNo: "0057-01-A", publicCode: "23456789ABCDEFGH", hasPassword: true, passwordVersion: 1, portalEnabled: true },
    { id: "60000000-0000-4000-8000-000000000002", ordinal: 2, suffix: "B", serialNo: "0057-01-B", publicCode: "ABCDEFGH23456789", hasPassword: true, passwordVersion: 1, portalEnabled: true },
  ],
  identityFields: PRODUCT_IDENTITY_FIELDS.map((key) => ({ key, autoValue: identity[key], source: { kind: key === "manufacturer" ? "settings" : "project", label: key === "manufacturer" ? "Rapor / firma ayarları" : "Proje ve yayımlanmış kaynaklar" }, overridden: false, effectiveValue: identity[key] })),
  identity,
  publishedFiles: portal.files,
};

function dataUrl(filePath: string, mime: string): string {
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

export default function ProductPortalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const root = process.cwd();
  // Fontlar ve ORION logosu artık prop DEĞİL: önizleme de gerçek kart gibi
  // `/fonts/...` ve `/brand/...` adreslerini okur (bkz. `plate-assets.ts`).
  // Burada yalnız MÜŞTERİ logosu gömülür; o Supabase'ten gelen bir veridir.
  const customerLogoDataUrl = dataUrl(path.join(root, "public", "brand", "orion-symbol-ink.png"), "image/png");
  const svg = buildNameplateSvg({
    embeddedFontsCss: SCREEN_FONT_CSS,
    widthMm: 240,
    heightMm: 160,
    serialNo: portal.serialNo,
    publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
    identity,
    logoDataUrl: PLATE_LOGO_URL,
    customerLogoDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><rect width="400" height="100" fill="#fff"/><text x="200" y="64" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#262626">MÜŞTERİ A.Ş.</text></svg>')}`,
  });
  return (
    <main className="min-h-dvh bg-muted/40 p-3 sm:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-6">
        <ProductPortalCard
          projectId={workspace.projectId}
          canEdit
          workspace={workspace}
          portalOrigin="https://portal.orioncranes.com"
          // Önizleme KALICI adres taşır: amaç plaka çizimini denemektir,
          // adres kapısını değil (o kapı gerçek kartta `readiness` ile sınanır).
          portalOriginPermanent
          customerLogoDataUrl={customerLogoDataUrl}
          draftPreview={portal}
          publishedPreview={portal}
        />
        <section className="border bg-card p-4 sm:p-6">
          <div className="oc-kicker text-muted-foreground">Development Preview · Baskı</div>
          <div className="mt-4 mx-auto max-w-[960px] overflow-hidden border bg-white p-3 [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </section>
        <section className="overflow-hidden border bg-card">
          <CustomerPortalView dto={portal} />
        </section>
      </div>
    </main>
  );
}
