import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";
import { drawingViewerMark, protectDrawingPdf } from "../drawing-viewer";

describe("korumalı teknik resim görüntüleme kopyası", () => {
  it("her sayfaya oturum kimliği ve zamanı basar", async () => {
    const source = await PDFDocument.create();
    source.addPage([600, 400]);
    source.addPage([840, 594]);
    const input = await source.save();
    const viewedAt = new Date("2026-08-20T10:35:00.000Z");

    const output = await protectDrawingPdf(input, "muhendis@orioncranes.com", viewedAt);
    const loaded = await PDFDocument.load(output);
    // PDF.js giriş tamponunu aktarırken ayırabilir; çıktı boyunu ölçen asıl
    // dizi korunur, geri okuma kendi kopyasıyla yapılır.
    const text = await extractText(output.slice(), { mergePages: true });

    expect(loaded.getPageCount()).toBe(2);
    expect(text.text).toContain(
      drawingViewerMark("muhendis@orioncranes.com", viewedAt)
    );
    expect(output.byteLength).toBeGreaterThan(input.byteLength);
  });

  it("Helvetica'nın taşıyamadığı kimlik karakterlerini güvenle sadeleştirir", () => {
    expect(drawingViewerMark("İş Mühendisi", new Date("2026-08-20T00:00:00Z"))).toBe(
      "ORION | Is Muhendisi | 2026-08-20 00:00 UTC"
    );
  });
});
