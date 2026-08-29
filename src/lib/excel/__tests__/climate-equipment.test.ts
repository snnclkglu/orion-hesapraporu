import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import {
  buildEquipmentGroups,
  buildEquipmentWorkbook,
  buildSummarySections,
  canLinkEquipmentModel,
  dsKey,
} from "@/lib/excel/equipment";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { SPEC_FIELDS } from "@/lib/calc/fields";

/**
 * Kabin, elektrik odası ve panolar artık 11. hesap bölümüdür: teknik
 * özelliklerde yalnız VARLIK (kabin var mı, klima var mı) sorulur; ölçüler ve
 * ürünün kendisi modül girdisi / katalog seçimidir.
 */
describe("kabin ve elektrik odası", () => {
  const CABIN = NEW_WORK_TEMPLATE.cabin!;

  function withCabinAndRoom(): CalcInput {
    return {
      ...NEW_WORK_TEMPLATE,
      specs: {
        ...NEW_WORK_TEMPLATE.specs,
        hasOperatorCabin: "yes",
        operatorCabinHasAirConditioner: "yes",
        electricalAccommodationType: "room",
        electricalRoomHasAirConditioner: "yes",
      },
      cabin: {
        inputs: {
          ...CABIN.inputs,
          cabinWidthM: 2.2, cabinLengthM: 2.8, cabinHeightM: 2.4,
          roomWidthM: 3, roomLengthM: 5, roomHeightM: 2.6,
          panelCount: 3, roomPanelWidthsText: "400; 600; 800",
          roomPanelHeightMm: 1800, roomPanelDepthMm: 600,
          roomDoorWidthMm: 800, roomDoorHeightMm: 2000,
          roomAcRedundancy: "nPlusOne",
        },
        selections: {
          ...CABIN.selections,
          cabinAcBrand: "TMS", cabinAcModel: "VKS-VS", cabinAcSeries: "VKS Serisi",
          cabinAcApplication: "heavy_industrial",
          cabinAcCoolingKwMin: 2.5, cabinAcCoolingKwMax: 48, cabinAcAmbientMaxC: 95,
          roomAcBrand: "TMS", roomAcModel: "WMU", roomAcSeries: "WMU Serisi",
          roomAcApplication: "industrial",
          roomAcCoolingKwMin: 8, roomAcCoolingKwMax: 100,
        },
      },
    };
  }

  it("kabin, oda ve klimalarını 1+1 yedekle ekipman listesine taşır", () => {
    const input = withCabinAndRoom();
    const rows = buildEquipmentGroups(input).flatMap((group) => group.rows);

    expect(rows.find((r) => r.rowKey === "cabin:operator-cabin")).toMatchObject({
      // Model hücresi ürün KİMLİĞİDİR: başlık düzeninden değil BÜYÜK HARF
      // kuralından geçer (12.08.2026 kararı, `kimlikBuyuk`).
      model: "İZOLE OPERATÖR KABİNİ",
    });
    expect(rows.find((r) => r.rowKey === "cabin:cabinAc")).toMatchObject({
      kind: "air_conditioner", brand: "TMS", model: "VKS-VS", qty: 1,
    });
    const roomAc = rows.find((r) => r.rowKey === "cabin:roomAc");
    expect(roomAc).toMatchObject({ brand: "TMS", model: "WMU", qty: "2 (1+1)" });
    // Kullanım grubu Türkçeleştirilerek yazılır; ham katalog kodu görünmez.
    expect(roomAc?.spec).toContain("Endüstriyel");
    expect(roomAc?.spec).not.toContain("industrial");
    // Ortam sıcaklığı sınırı yayımlanmayan üründe bu açıkça belirtilir.
    expect(roomAc?.spec).toContain("Yayımlanmamış");
    const room = rows.find((r) => r.rowKey === "cabin:electrical-room");
    expect(room?.spec).toContain("3 Pano (P1 400, P2 600, P3 800)");
    expect(room?.spec).toContain("200 mm Baza");
    expect(room?.spec).toContain("Kapı 800 × 2000 mm");
    expect(room?.spec).toContain("Pano Önü Geçiş 2400 mm");

    const summary = buildSummarySections(input, runCalc(input));
    expect(summary.map((section) => section.name)).toEqual(
      expect.arrayContaining(["Operatör Kabini", "Elektrik Odası"])
    );
    const roomSummary = summary.find((section) => section.name === "Elektrik Odası")!;
    expect(roomSummary.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Pano adedi", value: 3 }),
      expect.objectContaining({ label: "Pano önü yürüme mesafesi", value: 2400 }),
    ]));
  });

  it("ortam sıcaklığı sınırı yetersiz klimayı engelleyici kontrolle düşürür", () => {
    const input = withCabinAndRoom();
    // Proje ortamı 40 °C; katalog sınırı 35 °C olan bir ürün seçilirse kontrol
    // sağlanmamalıdır.
    input.specs = { ...input.specs, ambientTempMaxC: 40 };
    input.cabin = {
      inputs: input.cabin!.inputs,
      selections: { ...input.cabin!.selections, cabinAcAmbientMaxC: 35 },
    };
    const check = runCalc(input).cabin?.checks.find((c) => c.id === "cabin.cabinAc.ambient");
    expect(check?.pass).toBe(false);
    expect(check?.kind).toBe("uretici");
    expect(check?.severity).toBe("engelleyici");
  });

  it("klima var denip katalogdan ürün seçilmediğinde uyarır", () => {
    const input = withCabinAndRoom();
    input.cabin = {
      inputs: input.cabin!.inputs,
      selections: { ...input.cabin!.selections, cabinAcModel: "" },
    };
    const check = runCalc(input).cabin?.checks.find((c) => c.id === "cabin.cabinAc.selected");
    expect(check?.pass).toBe(false);
    expect(check?.severity).toBe("engelleyici");
  });

  it("pano tipinde oda izolasyonu yerine pano IP sınıfını listeler", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      specs: {
        ...NEW_WORK_TEMPLATE.specs,
        electricalAccommodationType: "panel",
        electricalPanelHasAirConditioner: "yes",
      },
      cabin: {
        inputs: {
          ...CABIN.inputs,
          panelCount: 3, panelIpClass: "IP55", panelAcRedundancy: "nPlusOne",
        },
        selections: {
          ...CABIN.selections,
          panelAcBrand: "TMS", panelAcModel: "PKS-PO", panelAcApplication: "panel",
          panelAcCoolingKwMin: 2, panelAcCoolingKwMax: 4, panelAcAmbientMaxC: 80,
        },
      },
    };
    const rows = buildEquipmentGroups(input).flatMap((group) => group.rows);
    const panel = rows.find((r) => r.rowKey === "cabin:electrical-panel");

    expect(panel).toMatchObject({ qty: 3 });
    expect(panel?.spec).toContain("IP55");
    expect(panel?.spec).toContain("Oda İzolasyonu Uygulanmaz");
    expect(panel?.spec).not.toContain("Taş Yünü");
    // 3 pano × 1+1 → 6 ünite.
    expect(rows.find((r) => r.rowKey === "cabin:panelAc")).toMatchObject({
      model: "PKS-PO", qty: "6 (1+1)",
    });
  });

  it("teknik özelliklerde yalnız VARLIK sorulur", () => {
    const keys = SPEC_FIELDS.map((f) => f.key);
    // Ölçü / izolasyon / pano adedi / ürün alanları 11. bölüme taşındı.
    for (const removed of [
      "operatorCabinWidthM", "operatorCabinInsulation", "operatorCabinAirConditioning",
      "operatorCabinAirConditionerModel", "electricalRoomWidthM", "electricalRoomInsulation",
      "electricalRoomAirConditioningRedundancy", "electricalPanelCount", "electricalPanelIpClass",
    ]) {
      expect(keys, `${removed} teknik özelliklerde kalmamalı`).not.toContain(removed);
    }

    const cabinAc = SPEC_FIELDS.find((f) => f.key === "operatorCabinHasAirConditioner");
    const roomAc = SPEC_FIELDS.find((f) => f.key === "electricalRoomHasAirConditioner");
    const panelAc = SPEC_FIELDS.find((f) => f.key === "electricalPanelHasAirConditioner");
    expect(cabinAc?.options).toEqual(["yes", "no"]);

    const roomSpecs = { ...NEW_WORK_TEMPLATE.specs, electricalAccommodationType: "room" as const };
    const panelSpecs = { ...NEW_WORK_TEMPLATE.specs, electricalAccommodationType: "panel" as const };
    expect(roomAc?.visible?.(roomSpecs)).toBe(true);
    expect(roomAc?.visible?.(panelSpecs)).toBe(false);
    expect(panelAc?.visible?.(panelSpecs)).toBe(true);
    expect(panelAc?.visible?.(roomSpecs)).toBe(false);
    expect(cabinAc?.visible?.({ ...NEW_WORK_TEMPLATE.specs, hasOperatorCabin: "no" })).toBe(false);
  });

  it("klima modelini Excel'de website bağlantısı olmadan düz metin yazar", () => {
    const input = withCabinAndRoom();
    const workbook = buildEquipmentWorkbook(input, runCalc(input), {
      docNo: "EQ-01", projectName: "Test", customer: "Test", revLabel: "V0", revNo: 0,
      date: "07.08.2026",
    }, {
      datasheetUrls: new Map([
        [dsKey("air_conditioner", "TMS", "VKS-VS"), "https://example.test/tms"],
      ]),
      scope: "customer",
    });
    const sheet = workbook.getWorksheet("Ekipman Listesi");
    const climateCell = sheet?.getColumn(4).values.find((value) => value === "VKS-VS");

    expect(climateCell).toBe("VKS-VS");
    expect(canLinkEquipmentModel("air_conditioner")).toBe(false);
    expect(canLinkEquipmentModel("motor")).toBe(true);
  });
});
