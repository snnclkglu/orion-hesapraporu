import { describe, expect, it } from "vitest";
import { shaftWeldDiagram } from "../shaftWeld";

describe("tambur mili kaynağı şeması", () => {
  it("mil çapı ile yük kolunu aynı ölçekte çizer ve sade etiketleri kullanır", () => {
    const diagram = shaftWeldDiagram({
      drumDiaMm: 400,
      hubDiaMm: 90,
      shaftDiaMm: 100,
      weldThroatMm: 10,
      armMm: 60,
      armLabel: "A",
      reactionKg: 4_924.4,
    });
    const texts = diagram.els
      .filter((el) => el.kind === "text")
      .map((el) => el.text);

    expect(texts).toContain("ØD2 = 100 mm");
    expect(texts).toContain("A = 60 mm");
    expect(texts.join(" ")).not.toContain("yükün flanşa uzaklığı");
    expect(texts.join(" ")).not.toContain("namlu · yanak sacı · göbek");
    expect(texts.join(" ")).not.toContain("DESTEK GUSSETİ");

    const shaft = diagram.els.find(
      (el) => el.kind === "rect" && el.fill === "#FFFFFF" && el.h > 40
    );
    expect(shaft?.kind).toBe("rect");
    if (!shaft || shaft.kind !== "rect") return;

    const armDimension = diagram.els.find(
      (el) =>
        el.kind === "line" &&
        el.y1 === el.y2 &&
        Math.abs(el.x1 - 296) < 0.001 &&
        el.x2 > el.x1
    );
    expect(armDimension?.kind).toBe("line");
    if (!armDimension || armDimension.kind !== "line") return;

    expect((armDimension.x2 - armDimension.x1) / shaft.h).toBeCloseTo(60 / 100, 5);
  });
});
