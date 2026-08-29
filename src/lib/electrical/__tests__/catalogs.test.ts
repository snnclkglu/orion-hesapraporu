import { describe, expect, it } from "vitest";
import {
  catalogIdentityPart,
  catalogReferencesByMaterial,
  canonicalElectricalCatalogSupplier,
  electricalCatalogLookupKey,
  helukabelArticleNumber,
  materialCatalogIdentity,
  materialCatalogLookupKey,
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

  it("EPLAN tedarikçi kısaltmalarını denetlenmiş üretici adına katlar", () => {
    expect(canonicalElectricalCatalogSupplier("SE")).toBe("Schneider Electric");
    expect(canonicalElectricalCatalogSupplier("SIE")).toBe("Siemens");
    expect(canonicalElectricalCatalogSupplier("OMR")).toBe("Omron");
    expect(canonicalElectricalCatalogSupplier("ELFA")).toBe("Elfatek");
    expect(canonicalElectricalCatalogSupplier("ADM")).toBe("Adımsan");
    expect(canonicalElectricalCatalogSupplier("Bilinmeyen Marka")).toBe("Bilinmeyen Marka");

    expect(
      materialCatalogLookupKey({ supplier: "SE", typeNo: "A9F74210", partNo: "SE.A9F74210" })
    ).toBe(electricalCatalogLookupKey("Schneider Electric", "A9F74210"));
  });

  it("HELUKABEL ürününü aile adına değil proje kodundaki makale numarasına bağlar", () => {
    expect(helukabelArticleNumber("HELU.10721")).toBe("10721");
    expect(helukabelArticleNumber("SIE.5SL6210-7")).toBeNull();

    const material = {
      supplier: "",
      typeNo: "JZ-600 / OZ-600",
      partNo: "HELU.10721",
    };
    expect(materialCatalogIdentity(material)).toEqual({
      supplier: "HELUKABEL",
      typeNo: "10721",
      lookupKey: "HELUKABEL|10721",
    });
    expect(materialCatalogLookupKey(material)).toBe("HELUKABEL|10721");
  });

  it("HELUKABEL dışındaki üretici + tip no kimliğini değiştirmez", () => {
    expect(
      materialCatalogIdentity({
        supplier: "Siemens",
        typeNo: "5SL6210-7",
        partNo: "SIE.5SL6210-7",
      })
    ).toMatchObject({ supplier: "Siemens", typeNo: "5SL6210-7" });
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
