import { describe, expect, it } from "vitest";
import {
  catalogIdentityPart,
  catalogReferencesByMaterial,
  electricalCatalogLookupKey,
} from "../catalogs";

describe("elektrik katalog kimliği", () => {
  it("kaynaklardaki tire/eğik çizgi/boşluk farkını katlar", () => {
    expect(catalogIdentityPart("DS-7104NI-Q1/4P/M")).toBe("DS7104NIQ14PM");
    expect(catalogIdentityPart("DS-7104NI-Q1-4P-M")).toBe("DS7104NIQ14PM");
  });

  it("Türkçe üretici yazımını yerel kuralla kararlı anahtara çevirir", () => {
    expect(electricalCatalogLookupKey("Siemens", "5SL6210-7")).toBe(
      electricalCatalogLookupKey("SIEMENS", "5SL6210 7")
    );
    expect(catalogIdentityPart("Niki Elektronik")).toBe("NIKIELEKTRONIK");
  });

  it("malzeme anahtarına göre teknik föy ile tam kataloğu ayrı tutar", () => {
    const map = catalogReferencesByMaterial([
      {
        materialKey: "SIE.5SL6210-7",
        productId: "p1",
        technicalDocumentId: "teknik",
        catalogDocumentId: "katalog",
      },
    ]);
    expect(map.get("SIE.5SL6210-7")).toMatchObject({
      technicalDocumentId: "teknik",
      catalogDocumentId: "katalog",
    });
  });
});
