import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mm } from "@/lib/pdf/palette";
import { renderNameplatePdf } from "../nameplate-pdf";
import type { ProductIdentityValues } from "../types";

async function dataUrl(relativePath: string, mime: string): Promise<string> {
  const bytes = await fs.readFile(path.join(process.cwd(), relativePath));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

const identity: ProductIdentityValues = {
  manufacturer: "ORION CRANES",
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
};

describe("baskı plaka PDF'i", () => {
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
      logoPaperDataUrl,
      archivoBoldDataUrl,
      archivoExtraBoldDataUrl,
      plexDataUrl,
    });
    expect(blob.type).toBe("application/pdf");
    const document = await PDFDocument.load(await blob.arrayBuffer());
    expect(document.getPageCount()).toBe(1);
    const page = document.getPage(0);
    expect(page.getWidth()).toBeCloseTo(mm(240), 2);
    expect(page.getHeight()).toBeCloseTo(mm(160), 2);
  }, 20_000);
});
