import { describe, expect, it } from "vitest";
import {
  buildNameplateSvg,
  createNameplateLayout,
  layoutNameplateTitle,
  productPortalUrl,
} from "../nameplate";
import type { ProductIdentityValues } from "../types";

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
  customer: "Müşteri",
  site: "Ankara",
};

describe("baskı isim plakası", () => {
  it("mm ölçüsünü, kalıcı portal URL'sini ve Q hata düzeltmeli QR geometrisini üretir", () => {
    const url = productPortalUrl("https://portal.orioncranes.com/", "23456789ABCDEFGH");
    const svg = buildNameplateSvg({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01-A",
      publicUrl: url,
      identity,
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      customerLogoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(url).toBe("https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH");
    expect(svg).toContain('width="240mm" height="160mm"');
    expect(svg).toContain("0057-01-A");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain("#A41E1E");
    expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("uzun vinç adını kesmeden iki dengeli satıra yerleştirir", () => {
    const title = layoutNameplateTitle("100 T x 14,85 m kapasiteli çift kirişli gezer köprülü vinç");
    expect(title.lines).toHaveLength(2);
    expect(title.lines.join(" ")).toBe("100 T X 14,85 M KAPASİTELİ ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ");
    expect(title.overflow).toBe(false);

    const layout = createNameplateLayout({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity: { ...identity, product: title.lines.join(" ") },
      logoDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    expect(layout.qr.moduleMm).toBeGreaterThanOrEqual(0.5);
  });

  it("montaj deliğini ancak ölçüler açıkça verildiğinde çizer", () => {
    const base = {
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: "/brand/orion-logo-white.svg",
    };
    expect(buildNameplateSvg(base).match(/<circle/g)).toBeNull();
    expect(buildNameplateSvg({ ...base, holeDiameterMm: 6, holeInsetMm: 9 }).match(/<circle/g)).toHaveLength(4);
  });
});
