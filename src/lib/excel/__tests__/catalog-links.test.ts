import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import {
  buildCatalogSheetUrls,
  buildEquipmentGroups,
  catalogIdentityOf,
  dsKey,
  rowDatasheetUrl,
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
    expect(pages[0].images).toHaveLength(2);
  }, 120_000);

  it("0063 Halat Alternatif 1'de eski katalog kimliğini taşımayıp iki doğru sayfayı toplar", async () => {
    const input = structuredClone(V5_TEMPLATE);
    const selections = input.mainHoist!.selections;
    // Canlı 0063/V0 kaydındaki durum: seçenek 18x7 NUFLEX'e geçmiş, fakat
    // alternatiflerin eski şeması yüzünden önceki 6x36 katalog modeli kalmış.
    selections.ropeBrand = "İzmit A.Ş.";
    selections.ropeDiaMm = 22;
    selections.ropeConstruction = "18x7 NUFLEX";
    selections.ropeCore = "Çelik Öz (IWRC)";
    selections.ropeWireStrength = 200;
    selections.ropeCatalogModel = "Ø22 6x36 WS IWRC 1960 MPa";

    const groups = buildEquipmentGroups(input);
    const rope = groups.flatMap((group) => group.rows)
      .find((row) => row.rowKey === "main:rope")!;
    expect(catalogIdentityOf(rope)?.model).toBe("Ø22 18x7 NUFLEX IWRC 1960 MPa");

    const pages = await collectCatalogSheetPages([
      { name: "Ana Kaldırma", rows: [rope] },
    ]);
    expect(pages).toHaveLength(1);
    expect(pages[0].images).toHaveLength(2);
    expect(pages[0].source).toContain("IZMIT-A.S.-18x7-NUFLEX-urun.pdf");
  }, 120_000);

  it("üretici föyünü GÖRÜNEN modelle değil katalog kimliğiyle bulur", () => {
    // Föy sözlüğü `cat_equipment` satırlarından kurulur, dolayısıyla anahtardaki
    // model KATALOG modelidir. Halat satırında GÖRÜNEN model ise satın almanın
    // istediği tanımdır ("6X36 WS SAĞ HELİS") ve ikisi hiçbir zaman eşleşmez;
    // arama görünen modelle yapıldığı sürece halat, redüktör ve yürütme freni
    // satırlarının hiçbiri föy bulamıyordu.
    const input = structuredClone(V5_TEMPLATE);
    const groups = buildEquipmentGroups(input);
    const rope = groups.flatMap((group) => group.rows)
      .find((row) => row.rowKey === "main:rope")!;

    const catalogModel = catalogIdentityOf(rope)!.model;
    expect(rope.model).not.toBe(catalogModel); // görünen ≠ katalog kimliği

    const foy = "https://uretici.example/halat.pdf";
    const urls = new Map([[dsKey(rope.kind!, rope.brand, catalogModel), foy]]);

    expect(rowDatasheetUrl(rope, urls)).toBe(foy);
    // Görünen modelle kurulan anahtar hiçbir zaman tutmaz — koruma budur.
    expect(rowDatasheetUrl(rope, new Map([
      [dsKey(rope.kind!, rope.brand, rope.model), foy],
    ]))).toBeUndefined();
  });

  it("klima satırında üretici websitesi müşteri çıktısına bağlanmaz", () => {
    // `canLinkEquipmentModel` kuralı föy yolunda da geçerlidir; kural iki
    // yüzeyde ayrı ayrı yazılırsa biri gün gelip diğerinden ayrışır.
    const row = {
      kind: "air_conditioner" as const, brand: "TMS", model: "VKS-VS",
    };
    const urls = new Map([[dsKey("air_conditioner", "TMS", "VKS-VS"), "https://tms.example"]]);
    expect(rowDatasheetUrl(row, urls)).toBeUndefined();
  });
});
