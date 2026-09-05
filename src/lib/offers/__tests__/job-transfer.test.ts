import { describe, expect, it } from "vitest";
import { emptyItem, emptyPayload } from "../payload";
import type { OfferItem, OfferPriceLine, OfferRow } from "../types";
import {
  buildJobDraftFromOffer,
  engineeringSpecsPatch,
} from "../job-transfer";

function row(item: OfferItem, groupKey: string, rowKey: string): OfferRow {
  const found = item.groups
    .find((group) => group.key === groupKey)
    ?.rows.find((entry) => entry.key === rowKey);
  if (!found) throw new Error(`${groupKey}.${rowKey} test satırı bulunamadı`);
  return found;
}

function setPart(
  item: OfferItem,
  groupKey: string,
  rowKey: string,
  partKey: string,
  value: string
) {
  const target = row(item, groupKey, rowKey);
  target.parts = { ...target.parts, [partKey]: value };
}

function priceLine(
  id: string,
  itemId: string | null,
  qty: number | null,
  extra: Partial<OfferPriceLine> = {}
): OfferPriceLine {
  return {
    id,
    itemId,
    description: "FİYAT SATIRI",
    qty,
    unit: "Adet",
    unitPrice: 987_654,
    manualCost: 123_456,
    inTotal: true,
    ...extra,
  };
}

function craneItem(id = "vinç-1") {
  const item = emptyItem("20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ", [
    "general",
    "mainHoist",
    "trolley",
    "bridge",
    "electrical",
  ]);
  item.id = id;
  item.craneType = "Çift Kiriş Gezer Köprülü Vinç";
  item.capacityT = 20;
  item.spanM = 18.5;
  setPart(item, "general", "liftHeight", "value", "9");
  setPart(item, "general", "runway", "value", "42");
  setPart(item, "mainHoist", "liftSpeed", "range", "5");
  setPart(item, "trolley", "travelSpeed", "range", "20");
  setPart(item, "bridge", "travelSpeed", "range", "40");
  row(item, "general", "craneClass").value = "FEM A5";
  row(item, "electrical", "supplyVoltage").value = "400 V / 50 Hz";
  row(item, "electrical", "controlVoltage").value = "48 V";
  return item;
}

describe("kazanılan teklif → iş emri teknik ayıklaması", () => {
  it("kanonik teknik alanları taşır; fiyat ve maliyeti mühendislik aktarımına sokmaz", () => {
    const payload = emptyPayload();
    const item = craneItem();
    payload.items = [item];
    payload.pricing.lines = [
      priceLine("fiyat-1", item.id, 2),
      priceLine("serbest-1", null, 1, {
        description: "NAKLİYE",
        leadTime: "3",
      }),
    ];

    const draft = buildJobDraftFromOffer(payload);
    const technical = draft.candidates[0];
    const standalone = draft.candidates[1];

    expect(technical).toMatchObject({
      sourceType: "technicalItem",
      included: true,
      quantity: "2 Adet",
      eligibility: "eligible",
      technicalFacts: {
        mainCapacityT: 20,
        spanM: 18.5,
        mainLiftHeightM: 9,
        runwayLengthM: 42,
        mainLiftSpeedMpm: 5,
        trolleySpeedMpm: 20,
        bridgeSpeedMpm: 40,
        structureClass: "A5",
        supplyVoltage: "400 V / 50 Hz",
        controlVoltage: "48 V",
      },
    });
    expect(standalone).toMatchObject({
      sourceType: "standalonePriceLine",
      included: false,
      eligibility: "not_applicable",
    });

    const handoffJson = JSON.stringify(
      draft.candidates.map((candidate) => candidate.technicalSnapshot)
    );
    expect(handoffJson).not.toContain("unitPrice");
    expect(handoffJson).not.toContain("manualCost");
    expect(handoffJson).not.toContain("discountPercent");
    expect(handoffJson).not.toContain("987654");
    expect(handoffJson).not.toContain("123456");
  });

  it("çelişen adetleri uydurmaz ve kullanıcı kontrolüne bırakır", () => {
    const payload = emptyPayload();
    const item = craneItem();
    payload.items = [item];
    payload.pricing.lines = [
      priceLine("fiyat-1", item.id, 1),
      priceLine("fiyat-2", item.id, 2),
    ];

    const candidate = buildJobDraftFromOffer(payload).candidates[0];
    expect(candidate.quantity).toBe("");
    expect(candidate.warnings.join(" ")).toContain("çelişiyor");
  });

  it("çift/aralık hızını tek hıza indirgemez", () => {
    const payload = emptyPayload();
    const item = craneItem();
    setPart(item, "mainHoist", "liftSpeed", "range", "0,8 / 5");
    payload.items = [item];
    payload.pricing.lines = [priceLine("fiyat-1", item.id, 1)];

    const candidate = buildJobDraftFromOffer(payload).candidates[0];
    expect(candidate.technicalFacts.mainLiftSpeedMpm).toBeUndefined();
    expect(candidate.warnings.join(" ")).toContain("tek değere indirgenemedi");
  });

  it("gizli kalemi çıkarır; opsiyonel kalemi varsayılan seçmez", () => {
    const payload = emptyPayload();
    const visible = craneItem("vinç-a");
    const hidden = { ...craneItem("vinç-b"), hidden: true };
    payload.items = [visible, hidden];
    payload.pricing.lines = [
      priceLine("fiyat-a", visible.id, 1, { optional: true }),
      priceLine("fiyat-b", hidden.id, 1),
    ];

    const draft = buildJobDraftFromOffer(payload);
    expect(draft.candidates).toHaveLength(1);
    expect(draft.candidates[0]).toMatchObject({ sourceId: "vinç-a", included: false });
  });
});

describe("teknik aktarım beyaz listesi", () => {
  it("yalnız teknik özellikleri geçirir; ekipman seçimi/serbest anahtar geçirmez", () => {
    expect(
      engineeringSpecsPatch({
        mainCapacityT: 32,
        spanM: -1,
        structureClass: "A6",
        installationEnvironment: "outdoor",
        supplyVoltage: " 400 V ",
        ropeDiameter: 18,
        gearboxId: "red-1",
        unitPrice: 42,
      })
    ).toEqual({
      mainCapacityT: 32,
      structureClass: "A6",
      installationEnvironment: "outdoor",
      supplyVoltage: "400 V",
    });
  });
});
