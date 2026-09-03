import { describe, expect, it } from "vitest";
import { ropeCatalogModelOf } from "@/lib/equipment-list";
import { findCatalogSheet } from "@/lib/catalog-sheets";

describe("halat katalog kimliği", () => {
  it("editörde görünen İzmit alanlarından tam NUFLEX modelini kurar", () => {
    const selection = {
      ropeBrand: "İzmit A.Ş.",
      ropeDiaMm: 22,
      ropeConstruction: "18x7 NUFLEX",
      ropeCore: "Çelik Öz (IWRC)",
      ropeWireStrength: 180,
    };

    const model = ropeCatalogModelOf(selection as never);
    expect(model).toBe("Ø22 18x7 NUFLEX IWRC 1770 MPa");
    expect(findCatalogSheet("rope", selection.ropeBrand, model)?.id)
      .toBe("rope/zmit-a-18x7-nuflex");
  });
});
