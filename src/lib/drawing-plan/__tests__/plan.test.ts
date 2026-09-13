import { describe, expect, it } from "vitest";
import {
  NEW_WORK_TEMPLATE,
  NEW_WORK_DISABLED_MODULES,
} from "../../calc/defaults";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
} from "../../revision-load";
import { deriveDrawingPlan } from "../derive";
import { reconcileDrawingPlan } from "../reconcile";
import { orderedDrawingPlan, moveDrawingRow } from "../presentation";
import { renumberDrawingPlan } from "../numbering";
import type { DrawingPlanRow } from "../../drawing-plan";

function derive(
  specs: Record<string, unknown> = {},
  disabled: string[] = [...NEW_WORK_DISABLED_MODULES],
) {
  const raw = {
    specs: { ...NEW_WORK_TEMPLATE.specs, ...specs },
    disabledModules: disabled,
  } as RevisionInputsJson;
  return deriveDrawingPlan(calcInputFromRevision(raw, null), raw);
}
const keys = (result: ReturnType<typeof derive>) =>
  result.candidates.filter((c) => !c.optional).map((c) => c.key);
const row = (id: string, code: string): DrawingPlanRow => ({
  id,
  code,
  name: id,
  status: "bekliyor",
  drawnBy: null,
  drawnByName: "",
  note: "",
});

describe("hesaptan resim kapsamı", () => {
  it("ortak arabada iki kaldırma tek şasi/yürütme üretir", () => {
    const result = derive({ auxTrolleyMode: "shared" }, []);
    expect(keys(result).filter((k) => k.endsWith(":frame"))).toEqual([
      "trolley:frame",
    ]);
    expect(
      result.candidates.find((c) => c.key === "hoist:aux:drum")?.parentKey,
    ).toBe("trolley:assembly");
    expect(keys(result)).not.toContain("auxTrolley:assembly");
  });
  it("ayrı arabada ayrı montaj; yardımcı kapalıysa hayali araba yok", () => {
    expect(keys(derive({ auxTrolleyMode: "separate" }, []))).toContain(
      "auxTrolley:frame",
    );
    expect(keys(derive({ auxTrolleyMode: "separate" }, ["aux"]))).not.toContain(
      "auxTrolley:assembly",
    );
  });
  it("kabin ve oda açık beyandan, klima adı kendi seçiminden gelir", () => {
    const result = derive(
      {
        hasOperatorCabin: "yes",
        electricalAccommodationType: "room",
        electricalRoomHasAirConditioner: "no",
      },
      ["cabin"],
    );
    expect(keys(result)).toContain("cabin:operator");
    expect(result.candidates.find((c) => c.key === "cabin:room")?.name).toBe(
      "ELEKTRİK ODASI",
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      keys(derive({ electricalAccommodationType: "panel" })),
    ).not.toContain("cabin:room");
  });
  it("sabit düzen araba, köprü ve enerji ekseni üretmez", () => {
    const result = derive(
      {
        travelArrangement: "fixed",
        trolleyPowerSupply: "festoon",
        bridgePowerSupply: "festoon",
      },
      [],
    );
    expect(keys(result)).toContain("fixed:assembly");
    expect(keys(result).some((k) => /trolley|bridge|supply/i.test(k))).toBe(
      false,
    );
  });
  it("kablo zincirine feston demez; ortak arabada besleme tek", () => {
    const result = derive(
      {
        auxTrolleyMode: "shared",
        trolleyPowerSupply: "cableChain",
        auxTrolleyPowerSupply: "festoon",
      },
      [],
    );
    expect(
      result.candidates.find((c) => c.key === "trolley:supply")?.name,
    ).toContain("KABLO ZİNCİRİ");
    expect(keys(result)).not.toContain("auxTrolley:supply");
  });
  it("çift tambur yeni araba üretmez ve kaldırma kirişi ayrı çözülür", () => {
    const result = derive({
      mainHoistEquipmentArrangement: "doubleDrum",
      mainDoubleDrumHookSystem: "liftingBeam",
    });
    expect(keys(result).filter((k) => k.endsWith(":assembly"))).toHaveLength(1);
    expect(
      result.candidates.find((c) => c.key === "hoist:main:hook")?.name,
    ).toContain("KALDIRMA KİRİŞİ");
  });
  it("monoray kompleleri özel imalat varsaymaz", () => {
    const result = derive({ monorailCount: 2 }, []);
    expect(keys(result)).toContain("mono2Trolley:assembly");
    expect(keys(result)).not.toContain("hoist:mono1:drum");
  });
  it("platform ve yaşam hattı yalnız öneridir", () => {
    const result = derive();
    expect(keys(result)).not.toContain("bridge:lifeline");
    expect(
      result.candidates.find((c) => c.key === "bridge:lifeline")?.optional,
    ).toBe(true);
  });
});

describe("numara ve mühendis kararları", () => {
  it("1500/2500 başlar; aynı kayıtta çoğalmaz", () => {
    const candidates = derive({ auxTrolleyMode: "separate" }, []).candidates;
    const first = reconcileDrawingPlan([], candidates).rows;
    expect(first.find((r) => r.sourceKey === "trolley:assembly")?.code).toBe(
      "1500",
    );
    expect(first.find((r) => r.sourceKey === "auxTrolley:assembly")?.code).toBe(
      "2500",
    );
    expect(reconcileDrawingPlan(first, candidates).rows).toEqual(first);
    expect(new Set(first.map((r) => r.code)).size).toBe(first.length);
  });
  it("elle ad/numara/not/durum ve silme kararı korunur", () => {
    const candidates = derive().candidates;
    const first = reconcileDrawingPlan([], candidates).rows;
    first[0] = {
      ...first[0],
      name: "ÖZEL GRUP",
      code: "0950",
      note: "Not",
      status: "cizildi",
      overrides: ["name", "code"],
    };
    first[1].suppressed = true;
    const next = reconcileDrawingPlan(first, candidates, undefined, {
      applyChanges: true,
    }).rows;
    expect(next[0]).toMatchObject({
      name: "ÖZEL GRUP",
      code: "0950",
      note: "Not",
      status: "cizildi",
    });
    expect(orderedDrawingPlan(next).some((r) => r.row.id === first[1].id)).toBe(
      false,
    );
  });
  it("eski manuel deftere otomatik ekleme yapmaz", () => {
    const old = [row("old", "0950")];
    expect(reconcileDrawingPlan(old, derive().candidates).rows).toEqual(old);
  });
  it("ortak/ayrı topoloji farkı otomatik taşınmaz", () => {
    const shared = derive({ auxTrolleyMode: "shared" }, []).candidates;
    const separate = derive({ auxTrolleyMode: "separate" }, []).candidates;
    const old = reconcileDrawingPlan([], shared, {
      main: 1500,
      auxiliary: 4000,
    }).rows;
    const next = reconcileDrawingPlan(old, separate, {
      main: 1500,
      auxiliary: 4000,
    });
    expect(next.rows).toEqual(old);
    expect(next.changes.some((c) => c.kind === "move")).toBe(true);
    const applied = reconcileDrawingPlan(
      old,
      separate,
      { main: 1500, auxiliary: 4000 },
      { applyChanges: true },
    ).rows;
    expect(applied.find((r) => r.sourceKey === "hoist:aux:drum")?.id).toBe(
      old.find((r) => r.sourceKey === "hoist:aux:drum")?.id,
    );
    expect(
      applied.find((r) => r.sourceKey === "hoist:aux:drum")?.parentId,
    ).toBe(applied.find((r) => r.sourceKey === "auxTrolley:assembly")?.id);
  });
  it("yer dolduğunda 2500 ikinci araba numarasını çalmaz", () => {
    const result = reconcileDrawingPlan(
      [],
      derive({ auxTrolleyMode: "shared" }, []).candidates,
    );
    expect(result.changes.some((c) => c.kind === "space")).toBe(true);
    expect(
      result.rows.filter((r) => r.parentId).every((r) => Number(r.code) < 2500),
    ).toBe(true);
  });
  it("2300 ana arabanın çocuğu olabilir; sıra değişince numara değişmez", () => {
    const rows = [
      { ...row("main", "1500"), sortOrder: 0 },
      { ...row("hook", "2300"), parentId: "main", sortOrder: 0 },
      { ...row("drum", "1800"), parentId: "main", sortOrder: 1 },
    ];
    const moved = moveDrawingRow(rows, "drum", -1);
    expect(orderedDrawingPlan(moved).map((r) => r.row.code)).toEqual([
      "1500",
      "1800",
      "2300",
    ]);
    expect(orderedDrawingPlan(moved)[2].depth).toBe(1);
  });
  it("numara önizlemesinde hata eski defteri korur", () => {
    const candidates = derive().candidates;
    const rows = reconcileDrawingPlan([], candidates).rows;
    expect(
      renumberDrawingPlan(rows, candidates, { main: 1500, auxiliary: 1500 }),
    ).toMatchObject({ rows, error: expect.any(String) });
  });
});

import { removeDrawingGroup } from "../presentation";
import { readFileSync } from "node:fs";
import { numberingError } from "../numbering";

describe("karar ve sınır kontrolleri", () => {
  it("elle korunan kaynak grubu rapordan kalksa da yeniden önerilmez", () => {
    const result = reconcileDrawingPlan([], derive().candidates).rows;
    const kept = { ...result[0], origin: "manual" as const };
    expect(reconcileDrawingPlan([kept], []).changes).toEqual([]);
  });
  it("kaldırılan montajın çocukları güncellemeyle geri getirilmez", () => {
    const candidates = derive().candidates;
    const original = reconcileDrawingPlan([], candidates).rows;
    const parent = original.find((r) => r.sourceKey === "trolley:assembly")!;
    const removed = removeDrawingGroup(original, parent.id, false);
    const next = reconcileDrawingPlan(removed, candidates, undefined, {
      applyChanges: true,
    });
    expect(
      next.rows
        .filter((r) => !r.suppressed)
        .some((r) => r.parentId === parent.id),
    ).toBe(false);
    expect(next.changes.some((c) => c.kind === "move")).toBe(false);
  });
  it("manuel ebeveyn silinince otomatik çocuğun silme tercihi yetim kalmaz", () => {
    const parent = row("manual", "1500");
    const child = {
      ...row("auto", "1600"),
      parentId: parent.id,
      sourceKey: "known",
    };
    const result = removeDrawingGroup([parent, child], parent.id, false);
    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].parentId).toBeNull();
  });
  it("2300 kancası ana arabada kalır, alt sıra değişimi kodu değiştirmez", () => {
    const parent = row("main", "1500"),
      other = row("aux", "4000");
    const hook = { ...row("hook", "2300"), parentId: parent.id, sortOrder: 1 };
    const frame = {
      ...row("frame", "1700"),
      parentId: parent.id,
      sortOrder: 0,
    };
    const list = [parent, other, frame, hook];
    expect(
      orderedDrawingPlan(moveDrawingRow(list, hook.id, -1)).map(
        (x) => x.row.code,
      ),
    ).toEqual(["1500", "2300", "1700", "4000"]);
  });
  it("başlangıç ve satır sınırının SQL karşılığı ayrışmaz", () => {
    const sql = readFileSync(
      "supabase/migrations/20260912233000_drawing_plan_automation.sql",
      "utf8",
    );
    expect(sql).toContain("jsonb_array_length(p_rows)>120");
    expect(sql).toContain("between 200 and 9000");
    expect(sql).toContain("% 100 <> 0");
    expect(numberingError({ main: 1500, auxiliary: 2500 })).toBeNull();
    expect(numberingError({ main: 1550, auxiliary: 2500 })).toBeTruthy();
  });
});
