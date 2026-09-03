import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("çok sayfalı katalog PDF indirmesi", () => {
  it("İzmit ürün tanımı ve teknik tabloyu tek iki sayfalı PDF'te verir", async () => {
    const query = new URLSearchParams({
      tur: "rope",
      marka: "İzmit A.Ş.",
      model: "Ø8 6x36 WS FC 1770 MPa",
    });
    const response = await GET(new Request(`http://orion.test/api/catalog-sheet/download?${query}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPageCount()).toBe(2);
  });

  it("bilinmeyen üründe dosya üretmez", async () => {
    const response = await GET(new Request(
      "http://orion.test/api/catalog-sheet/download?tur=rope&marka=X&model=Y"
    ));
    expect(response.status).toBe(404);
  });
});
