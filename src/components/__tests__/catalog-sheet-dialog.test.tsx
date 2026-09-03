import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogSheetButton } from "@/components/catalog-sheet-dialog";

describe("Katalog Sayfası düğmesi", () => {
  it("İzmit 18x7 NUFLEX seçiminde pasif kalmaz", () => {
    const html = renderToStaticMarkup(
      <CatalogSheetButton
        kind="rope"
        brand="İzmit A.Ş."
        model="Ø22 18x7 NUFLEX IWRC 1770 MPa"
      />
    );

    expect(html).toContain("Katalog Sayfası");
    expect(html).not.toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
  });

  it("ürün seçilmeden düğmeyi pasif tutar", () => {
    const html = renderToStaticMarkup(
      <CatalogSheetButton kind="rope" />
    );

    expect(html).toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
  });
});
