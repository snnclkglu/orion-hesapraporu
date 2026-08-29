import { describe, expect, it } from "vitest";
import { runCalc } from "@/lib/calc/engine";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import type { ElectricalMaterialRow } from "@/lib/electrical/types";
import {
  buildElectricalCatalogUrls,
  buildElectricalEquipmentGroups,
  electricalEquipmentRowKey,
  equipmentListTitle,
  equipmentSections,
  sectionsForPart,
  UNKNOWN_QTY,
} from "@/lib/equipment-sections";
import { buildEquipmentWorkbook, rowCatalogSheetKey } from "@/lib/excel/equipment";

const META = {
  docNo: "0055",
  projectName: "Bölümlü Ekipman Testi",
  customer: "ORION",
  revLabel: "V0",
  revNo: 0,
  date: "29.08.2026",
};

const MATERIALS: ElectricalMaterialRow[] = [
  {
    key: "SIE.5SL6210-7",
    partNo: "SIE.5SL6210-7",
    typeNo: "5SL6210-7",
    supplier: "Siemens",
    designation: "CIRCUIT BREAKER 400V 6KA, 2POLE, C, 10A",
    category: "Şalterler ve Devre Kesiciler",
    qty: 9,
    locations: ["LVD01"],
  },
  {
    key: "SE.NML0100121",
    partNo: "SE.NML0100121",
    typeNo: "NML0100121",
    supplier: "Schneider Electric",
    designation: "Humidifiers-switch 1 pole ON/OFF-complete product",
    category: "Pano İklimlendirme",
    qty: null,
    locations: ["CB2"],
  },
];

describe("mekanik + elektrik ekipman bölümleri", () => {
  it("boş elektrik bölümünü hiç üretmez ve tek bölümü mekanik adlandırır", () => {
    const sections = equipmentSections({
      mechanical: [{ name: "Ana Kaldırma", rows: [{ component: "Motor", brand: "GAMAK", model: "M1", spec: "", qty: 1 }] }],
      electrical: [],
    });

    expect(sections.map((section) => section.key)).toEqual(["mechanical"]);
    expect(equipmentListTitle(sections)).toBe("Mekanik Ekipman Listesi");
    expect(sectionsForPart(sections, "elektrik")).toEqual([]);
  });

  it("elektrik malzemelerini kategoriye ayırır ve okunamayan adedi sıfır yapmaz", () => {
    const groups = buildElectricalEquipmentGroups(MATERIALS);
    const rows = groups.flatMap((group) => group.rows);

    expect(groups.map((group) => group.name)).toEqual([
      "Şalterler ve Devre Kesiciler",
      "Pano İklimlendirme",
    ]);
    expect(rows[1].qty).toBe(UNKNOWN_QTY);
    expect(rows[0].spec).toContain("Pano: +LVD01");
    expect(rows[0].rowKey).toMatch(/^electrical:[a-f0-9]{16}$/);
  });

  it("elektrik satır anahtarını yeniden okumalar arasında güvenli ve kararlı tutar", () => {
    const first = electricalEquipmentRowKey("SIE.5SL6210-7");
    expect(first).toBe(electricalEquipmentRowKey("sie.5sl6210-7"));
    expect(first).not.toBe(electricalEquipmentRowKey("SIE.5SL6325-7"));
    expect(first.length).toBeLessThan(120);
  });

  it("teknik föyü ekipman adına, tam kataloğu model hücresine bağlar", () => {
    const groups = buildElectricalEquipmentGroups(MATERIALS.slice(0, 1));
    const urls = buildElectricalCatalogUrls(groups, MATERIALS.slice(0, 1), [
      {
        materialKey: MATERIALS[0].key,
        productId: "urun-1",
        technicalDocumentId: "foy-1",
        catalogDocumentId: "katalog-1",
      },
    ], "https://orion.example");
    const key = rowCatalogSheetKey(groups[0].rows[0])!;

    expect(urls.sheetUrls.get(key)).toBe("https://orion.example/api/electrical-catalog/foy-1");
    expect(urls.datasheetUrls.get(key)).toBe("https://orion.example/api/electrical-catalog/katalog-1");
  });

  it("Excel'de iki bölüm bandını basar, bilinmeyen adet hücresini boş bırakır", () => {
    const input = structuredClone(V5_TEMPLATE);
    const electrical = buildElectricalEquipmentGroups(MATERIALS);
    const sections = equipmentSections({
      mechanical: [{ name: "Ana Kaldırma", rows: [{ component: "Motor", brand: "GAMAK", model: "M1", spec: "15 kW", qty: 1 }] }],
      electrical,
    });
    const electricalUrls = buildElectricalCatalogUrls(electrical, MATERIALS, [
      {
        materialKey: MATERIALS[0].key,
        productId: "urun-1",
        technicalDocumentId: "foy-1",
        catalogDocumentId: "katalog-1",
      },
    ], "https://orion.example");
    const workbook = buildEquipmentWorkbook(input, runCalc(input), META, {
      scope: "customer",
      sections,
      sheetTitle: equipmentListTitle(sections),
      sheetUrls: electricalUrls.sheetUrls,
      datasheetUrls: electricalUrls.datasheetUrls,
    });
    const sheet = workbook.getWorksheet("Tüm Ekipman Listesi")!;
    const values = sheet.getColumn(1).values.map(String);

    expect(values).toContain("MEKANİK EKİPMANLAR");
    expect(values).toContain("ELEKTRİK EKİPMANLARI");
    let unknownQty: unknown = "satır bulunamadı";
    let technicalHref: unknown;
    let catalogHref: unknown;
    sheet.eachRow((row) => {
      const component = row.getCell(1).value;
      if (
        typeof component === "object" && component !== null && "text" in component &&
        component.text === MATERIALS[0].designation
      ) {
        technicalHref = (component as { hyperlink?: string }).hyperlink;
        catalogHref = (row.getCell(3).value as { hyperlink?: string }).hyperlink;
      }
      if (row.getCell(1).value === MATERIALS[1].designation) {
        unknownQty = row.getCell(7).value;
      }
    });
    expect(technicalHref).toBe("https://orion.example/api/electrical-catalog/foy-1");
    expect(catalogHref).toBe("https://orion.example/api/electrical-catalog/katalog-1");
    expect(unknownQty).toBeNull();
  });
});
