import { notFound } from "next/navigation";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import { buildNameplateSvg } from "@/lib/product-portal/nameplate";
import type { CustomerPortalDto, ProductIdentityValues } from "@/lib/product-portal/types";

const identity: ProductIdentityValues = {
  manufacturer: "ORION CRANES",
  product: "80/20 TON ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
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
  preview: true,
  files: [
    { id: "11111111-1111-4111-8111-111111111111", folderKey: "proje-belgeleri", folderTitle: "Proje Belgeleri", folderSort: 10, fileSort: 10, title: "Hesap Raporu · V3", fileName: "hesap-raporu.pdf", revisionLabel: "V3", accessMode: "view_watermarked", sizeBytes: 4_850_000, pageCount: 86 },
    { id: "22222222-2222-4222-8222-222222222222", folderKey: "proje-belgeleri", folderTitle: "Proje Belgeleri", folderSort: 10, fileSort: 20, title: "İşletme ve Bakım El Kitabı · V2", fileName: "el-kitabi.pdf", revisionLabel: "V2", accessMode: "download", sizeBytes: 13_200_000, pageCount: 142 },
    { id: "33333333-3333-4333-8333-333333333333", folderKey: "ekipman", folderTitle: "Ekipman Listeleri", folderSort: 20, fileSort: 10, title: "Ekipman Listesi · V3", fileName: "ekipman.pdf", revisionLabel: "V3", accessMode: "view_watermarked", sizeBytes: 1_100_000, pageCount: 18 },
    { id: "44444444-4444-4444-8444-444444444444", folderKey: "elektrik", folderTitle: "Elektrik Belgeleri", folderSort: 30, fileSort: 10, title: "Elektrik Projesi · R02", fileName: "elektrik.pdf", revisionLabel: "R02", accessMode: "view_watermarked", sizeBytes: 8_420_000, pageCount: 34 },
  ],
};

export default function ProductPortalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const svg = buildNameplateSvg({
    widthMm: 240,
    heightMm: 160,
    serialNo: portal.serialNo,
    publicUrl: "https://orioncranes.com/paylas/vinc/23456789ABCDEFGH",
    identity,
    logoDataUrl: "/brand/orion-logo-white.svg",
  });
  return (
    <main className="min-h-dvh bg-muted/40 p-3 sm:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-6">
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
