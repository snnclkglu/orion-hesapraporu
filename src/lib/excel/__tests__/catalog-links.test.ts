import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import {
  buildCatalogSheetUrls,
  buildEquipmentGroups,
  catalogIdentityOf,
  rowSheetUrl,
} from "@/lib/excel/equipment";
import { collectCatalogSheetPages } from "@/lib/pdf/catalog-sheet-images";

describe("ekipman listesi katalog bağlantıları", () => {
  it("eski halat seçimini gerçek katalog modeline bağlar ve H n1 anahtarını ekranda korur", () => {
    const input = structuredClone(V5_TEMPLATE);
    const selections = input.mainHoist!.selections;
    // Eski revizyon biçimi: ürünün birebir DB modeli henüz saklanmıyordu;
    // konstrüksiyon ve öz etiketleri de 2026 kataloğundaki kısa koddan farklı.
    selections.ropeCatalogModel = undefined;
    selections.ropeBrand = "Hasçelik";
    selections.ropeDiaMm = 18;
    selections.ropeConstruction = "6x36";
    selections.ropeCore = "Çelik Öz";
    selections.ropeWireStrength = 200;
    selections.gearboxCatalogInputRpm = 900;

    const groups = buildEquipmentGroups(input);
    const rows = groups.flatMap((group) => group.rows);
    const rope = rows.find((row) => row.rowKey === "main:rope")!;
    const auxiliaryRope = rows.find((row) => row.rowKey === "aux:rope")!;
    const gearbox = rows.find((row) => row.kind === "gearbox")!;
    const urls = buildCatalogSheetUrls(groups, "https://orion.example");

    expect(catalogIdentityOf(rope)?.model).toBe("Ø18 6x36 WS IWRC 1960 MPa");
    expect(catalogIdentityOf(auxiliaryRope)?.model).toBe("Ø12 6x36 WS IWRC 1960 MPa");
    const mainRopeUrl = rowSheetUrl(rope, urls)!;
    const auxiliaryRopeUrl = rowSheetUrl(auxiliaryRope, urls)!;
    expect(mainRopeUrl).toContain("tur=rope");
    expect(new URL(mainRopeUrl).searchParams.get("model")).toContain("Ø18");
    expect(new URL(auxiliaryRopeUrl).searchParams.get("model")).toContain("Ø12");
    expect(auxiliaryRopeUrl).not.toBe(mainRopeUrl);
    expect(rowSheetUrl(gearbox, Object.fromEntries(urls))).toContain("n1=900");
  });

  it("detaylı PDF kataloglarını ekipman listesindeki sırayla toplar", async () => {
    const input = structuredClone(V5_TEMPLATE);
    input.mainHoist!.selections.gearboxCatalogInputRpm = 900;
    const main = buildEquipmentGroups(input).find((group) => group.name === "Ana Kaldırma")!;
    const rope = main.rows.find((row) => row.kind === "rope")!;
    const bearing = main.rows.find((row) => row.kind === "bearing" && row.rowKey === "main:drumBearing")!;
    const gearbox = main.rows.find((row) => row.kind === "gearbox")!;

    const pages = await collectCatalogSheetPages([
      { name: main.name, rows: [rope, bearing, gearbox] },
    ]);

    expect(pages.map((page) => page.model)).toEqual([
      rope.model,
      bearing.model,
      gearbox.model,
    ]);
    expect(pages[0].source).toContain("Hasçelik 6x36 WS");
  }, 120_000);
});
