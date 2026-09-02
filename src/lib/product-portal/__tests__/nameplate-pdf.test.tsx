import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mm } from "@/lib/pdf/palette";
import { renderNameplatePdf } from "../nameplate-pdf";
import { NAMEPLATE_SIZE_PRESETS } from "../nameplate";
import type { ProductIdentityValues } from "../types";

async function dataUrl(relativePath: string, mime: string): Promise<string> {
  const bytes = await fs.readFile(path.join(process.cwd(), relativePath));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

const identity: ProductIdentityValues = {
  manufacturer: "ORION CRANES",
  manufacturerAddress: "Organize Sanayi Bölgesi, Ankara · TÜRKİYE",
  machineModel: "ORION DGK-100/1485",
  mass: "48,5 t",
  product: "100 T x 14,85 m kapasiteli çift kirişli gezer köprülü vinç",
  craneType: "Çift Kirişli Gezer Köprülü Vinç",
  projectCode: "0057-01",
  productionYear: "2026",
  capacity: "100 t",
  span: "14,85 m",
  liftHeight: "8,8 m",
  dutyClass: "FEM 2m / ISO M5 · A5",
  supplyVoltage: "380 VAC",
  controlVoltage: "24 VDC",
  frequency: "50 Hz",
  customer: "Müşteri Fabrikası A.Ş.",
  site: "Ankara",
  mainHoistSummary: "12 m/dak · 2 × 30 kW",
  trolleyTravelSummary: "35 m/dak · Ø400 × 4 · 2 × 3 kW",
  bridgeTravelSummary: "50 m/dak · Ø500 × 4 · 2 × 5,5 kW",
};

describe("baskı plaka PDF'i", () => {
  /*
   * HAZIR ÖLÇÜLERİN ÜÇÜ DE SINANIR (02.09.2026, md. 15).
   *
   * Eski test yalnız 240 × 160'ı ölçüyordu ve o ölçü TESADÜFEN geçiyordu:
   * `<Svg>` sayfa bölünemez bir düğümdür ve yüksekliği float32'de YUKARI
   * yuvarlanan ölçülerde (200 × 140, 160 × 110) sayfayı bir kıl payı aşıp
   * ikinci bir sayfa doğuruyordu. Tek ölçü sınamak, hatayı iki hafta boyunca
   * sessiz bıraktı.
   */
  it.each(NAMEPLATE_SIZE_PRESETS.map((preset) => [preset.label, preset] as const))(
    "%s ölçüsünü TEK sayfa ve tam ölçüde üretir",
    async (_label, preset) => {
      const [logoPaperDataUrl, archivoBoldDataUrl, archivoExtraBoldDataUrl, plexDataUrl] =
        await Promise.all([
          dataUrl("public/brand/orion-logo-paper.png", "image/png"),
          dataUrl("src/assets/fonts/Archivo-Bold.ttf", "font/ttf"),
          dataUrl("src/assets/fonts/Archivo-ExtraBold.ttf", "font/ttf"),
          dataUrl("src/assets/fonts/IBMPlexMono-SemiBold.ttf", "font/ttf"),
        ]);
      const blob = await renderNameplatePdf({
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        serialNo: "0057-01-A",
        publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
        identity,
        logoDataUrl: logoPaperDataUrl,
      }, {
        archivoBold: archivoBoldDataUrl,
        archivoExtraBold: archivoExtraBoldDataUrl,
        plexSemiBold: plexDataUrl,
        logoRaster: logoPaperDataUrl,
      });
      const document = await PDFDocument.load(await blob.arrayBuffer());
      expect(document.getPageCount()).toBe(1);
      const page = document.getPage(0);
      expect(page.getWidth()).toBeCloseTo(mm(preset.widthMm), 2);
      expect(page.getHeight()).toBeCloseTo(mm(preset.heightMm), 2);
    },
    30_000
  );

  it("tek vektör sayfayı tam 240 × 160 mm üretir", async () => {
    const [logoPaperDataUrl, customerLogoDataUrl, archivoBoldDataUrl, archivoExtraBoldDataUrl, plexDataUrl] = await Promise.all([
      dataUrl("public/brand/orion-logo-paper.png", "image/png"),
      dataUrl("public/brand/orion-symbol-ink.png", "image/png"),
      dataUrl("src/assets/fonts/Archivo-Bold.ttf", "font/ttf"),
      dataUrl("src/assets/fonts/Archivo-ExtraBold.ttf", "font/ttf"),
      dataUrl("src/assets/fonts/IBMPlexMono-SemiBold.ttf", "font/ttf"),
    ]);
    const blob = await renderNameplatePdf({
      widthMm: 240,
      heightMm: 160,
      serialNo: "0057-01-A",
      publicUrl: "https://portal.orioncranes.com/paylas/vinc/23456789ABCDEFGH",
      identity,
      logoDataUrl: logoPaperDataUrl,
      customerLogoDataUrl,
    }, {
      // Node'da göreli adres çözülemez; bu test GEOMETRİYİ sınar. Tarayıcının
      // statik varlık yolu ancak gerçek tarayıcıda doğrulanır.
      archivoBold: archivoBoldDataUrl,
      archivoExtraBold: archivoExtraBoldDataUrl,
      plexSemiBold: plexDataUrl,
      logoRaster: logoPaperDataUrl,
    });
    expect(blob.type).toBe("application/pdf");
    const document = await PDFDocument.load(await blob.arrayBuffer());
    expect(document.getPageCount()).toBe(1);
    const page = document.getPage(0);
    expect(page.getWidth()).toBeCloseTo(mm(240), 2);
    expect(page.getHeight()).toBeCloseTo(mm(160), 2);
  }, 20_000);
});
