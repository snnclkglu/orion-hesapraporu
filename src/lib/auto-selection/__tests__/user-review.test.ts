import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { availableSeries, defaultSeries } from "../brands";
import { selectionCatalogFilter } from "../catalog-scope";
import { girderPlateRatioValid } from "../design-profile";
import { requestFixture } from "./fixtures";
import { withDerivedHoist, withDerivedTravel } from "@/lib/calc/state";
import { brakeHandednessOptions, resolvedBrakeHandedness } from "@/lib/calc/brake-handedness";
import { buildEquipmentGroups } from "@/lib/equipment-list";
import { selectionCalcInput } from "../solver";
import { defaultOfferFilter, matchesOfferFilters, type OfferListRow } from "@/lib/offers/filter";
import { loadRevision } from "@/lib/revision-load";

describe("11 Eylül kullanıcı kararları", () => {
  it("açılışta yalnız kazanılan ve bütçesel gizlenir; kapatınca geri gelir", () => {
    const filter = defaultOfferFilter("2026-09-11");
    const base: OfferListRow = { id: "1", offer_no: "TE", subject: "", customer_name: "", status: "sent", issue_date: "2026-09-11", issuedOn: null, currency: "EUR", latestTotal: null, latestRevNo: 0, craneTypes: [], capacities: [], itemCount: 0 };
    for (const status of ["won", "budgetary", "sent", "draft", "lost", "cancelled"]) {
      expect(matchesOfferFilters({ ...base, status }, filter)).toBe(!["won", "budgetary"].includes(status));
      expect(matchesOfferFilters({ ...base, status }, { ...filter, openOnly: false })).toBe(true);
    }
  });
  it("halatın konstrüksiyonu hem pencerede hem indirme filtresinde korunur", () => {
    const request = requestFixture(); request.brands = { rope: "HAŞÇELİK" }; request.series = { rope: "6x36 WS" };
    expect(defaultSeries("rope", "Haşçelik")).toBe("6x36 WS");
    expect(defaultSeries("rope", "İzmit A.Ş.")).toBe("6x36 WS");
    expect(availableSeries([{ kind: "rope", brand: "HAŞÇELİK", attrs: { construction: "6x36 WS", typical_application: "vinç" } }], "rope", "HAŞÇELİK", request)).toEqual(["6x36 WS"]);
    expect(selectionCatalogFilter(request)).toContainEqual({ kind: "rope", brands: ["HAŞÇELİK"], series: "6x36 WS" });
    const sql = readFileSync("supabase/migrations/20260911000005_catalog_series_and_radial_review.sql", "utf8");
    expect(sql).toContain("when e.kind='rope' then e.attrs->>'construction'");
  });
  it("Flender H kademeleri tek aile olur, B ailesi karışmaz", () => {
    const request = requestFixture();
    const rows = ["H1", "H2", "H3", "H4", "B3"].map(series => ({ kind: "gearbox", brand: "FLENDER", attrs: { series, application: "kaldirma" } }));
    expect(availableSeries(rows, "hoistGearbox", "FLENDER", request)).toEqual(["B3", "H"]);
  });
  it.each([[500,750,true], [500,1500,true], [500,749,false], [500,1501,false], [1000,1500,true], [1000,3000,true], [1000,3001,false], [0,1000,false]])("üst sac %s ve yan sac %s sınırı", (b2Mm,h3Mm,expected) => {
    expect(girderPlateRatioValid({ b2Mm,h3Mm })).toBe(expected);
  });
  it("fren adedi değişince geçersiz yön düzeni yeni adedin varsayılanına döner", () => {
    const request = requestFixture(); request.specs.hoistBrakeType = "Eldro Fren";
    const initial = request.modules.main;
    const select = (brakeQty: number, brakeHandedness?: string) => withDerivedHoist({ ...initial, selections: { ...initial.selections, brakeQty, brakeHandedness } }, request.specs, "main").selections as { brakeHandedness: string };
    expect(select(1).brakeHandedness).toBe("");
    expect(select(1,"Sol").brakeHandedness).toBe("Sol");
    expect(select(2).brakeHandedness).toBe("1 sağ 1 sol");
    expect(select(2,"2 sağ").brakeHandedness).toBe("2 sağ");
    expect(select(4,"2 sağ").brakeHandedness).toBe("2 sağ 2 sol");
    expect(select(1,"4 sol").brakeHandedness).toBe("");
    expect(brakeHandednessOptions(4)).toEqual(["2 sağ 2 sol", "4 sağ", "4 sol"]);
    expect(resolvedBrakeHandedness(4,"4 sol")).toBe("4 sol");
  });
  it("yürütme freni tahrik adedini izler ve ekipman çıktısına yönü taşır", () => {
    const request = requestFixture(); request.active = ["main", "trolley"]; request.specs.travelBrakeType = "Disk Fren"; request.specs.hoistBrakeType = "Eldro Fren";
    request.modules.main = withDerivedHoist({ ...request.modules.main, selections: { ...request.modules.main.selections, brakeQty: 2, brakeHandedness: "2 sol" } }, request.specs, "main");
    request.modules.trolley = withDerivedTravel({ ...request.modules.trolley, inputs: { ...request.modules.trolley.inputs, driveCount: 4, motorCountAuto: true }, selections: { ...request.modules.trolley.selections, brakeHandedness: "4 sağ", brakeTorqueNm: 100 } }, request.specs, "trolley");
    const rows = buildEquipmentGroups(selectionCalcInput(request, request.modules)).flatMap(g => g.rows);
    expect(rows.find(r => r.rowKey === "main:brake")?.spec.toLocaleLowerCase("tr-TR")).toContain("2 sol");
    expect(rows.find(r => r.rowKey === "trolley:brake")?.spec.toLocaleLowerCase("tr-TR")).toContain("4 sağ");
  });
  it("kayıt yüklenince kullanıcının sağ/sol seçimi korunur", () => {
    const request = requestFixture(); request.specs.hoistBrakeType = "Disk Fren";
    const loaded = loadRevision({ specs: request.specs }, { mainHoist: { ...request.modules.main.selections, brakeQty: 4, brakeHandedness: "4 sol" } } as never);
    expect(loaded.full.mainHoist?.selections.brakeHandedness).toBe("4 sol");
  });
});
