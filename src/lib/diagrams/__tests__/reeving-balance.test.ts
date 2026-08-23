import { describe, expect, it } from "vitest";
import { reevingDiagram } from "../reeving";
import { drumShaftDiagram } from "../drumShaft";

const textValues = (type: "equalizerBeam" | "equalizerSheave") =>
  reevingDiagram({
    drivenFalls: 2,
    totalFalls: 8,
    ropeBalancingType: type,
  }).els.flatMap((el) => (el.kind === "text" ? [el.text] : []));

describe("halat donanımı denge şeması", () => {
  it("denge traversinde orta makarayı sabit uç sembolleriyle değiştirir", () => {
    const diagram = reevingDiagram({
      drivenFalls: 2,
      totalFalls: 8,
      ropeBalancingType: "equalizerBeam",
    });
    const anchors = diagram.els.filter(
      (el) => el.kind === "polygon" && el.points[0]?.[1] === 106
    );
    const upperSheaves = diagram.els.filter(
      (el) => el.kind === "circle" && el.cy === 106 && el.r > 2.2
    );

    expect(anchors).toHaveLength(2);
    expect(upperSheaves).toHaveLength(2);
    expect(textValues("equalizerBeam")).toContain("Denge Traversi · Sabit Uçlar");
  });

  it("denge makaralı eski şemada sabit uç göstermez ve orta makarayı korur", () => {
    const diagram = reevingDiagram({
      drivenFalls: 2,
      totalFalls: 8,
      ropeBalancingType: "equalizerSheave",
    });
    const anchors = diagram.els.filter(
      (el) => el.kind === "polygon" && el.points[0]?.[1] === 106
    );
    const upperSheaves = diagram.els.filter(
      (el) => el.kind === "circle" && el.cy === 106 && el.r > 2.2
    );

    expect(anchors).toHaveLength(0);
    expect(upperSheaves).toHaveLength(3);
    expect(textValues("equalizerSheave")).not.toContain("Denge traversi · sabit uçlar");
  });
});

describe("çift tambur halat şeması", () => {
  const labels = (hookSystem: "doubleHookBlock" | "liftingBeam") =>
    reevingDiagram({
      drivenFalls: 4,
      totalFalls: 16,
      capacityT: 64,
      equipmentArrangement: "doubleDrum",
      doubleDrumHookSystem: hookSystem,
    }).els.flatMap((el) => (el.kind === "text" ? [el.text] : []));

  it("4/16 donanımı iki adet 2/8 gruba ve ortak redüktöre böler", () => {
    const text = labels("doubleHookBlock");
    expect(text).toContain("HALAT DONANIMI · 4/16 → SOL 2/8 + SAĞ 2/8");
    expect(text.filter((item) => item === "REDÜKTÖR")).toHaveLength(1);
    expect(text.filter((item) => item === "Q/2 = 32 t")).toHaveLength(2);
  });

  it("kaldırma kirişi seçiminde tek kiriş ve tek toplam yük gösterir", () => {
    const text = labels("liftingBeam");
    expect(text.filter((item) => item === "TEK KALDIRMA KİRİŞİ")).toHaveLength(1);
    expect(text.filter((item) => item === "YÜK Q = 64 t")).toHaveLength(1);
    expect(text.some((item) => item.startsWith("Q/2"))).toBe(false);
  });

  it("tambur mili şemasında tek simetrik tamburu adlandırır ve eski alt başlığı kaldırır", () => {
    const text = drumShaftDiagram({
      aMm: 60, bMm: 50, cMm: 924, dMm: 640,
      eMm: 924, fMm: 50, gMm: 60,
      d1Mm: 60, d2Mm: 60, doubleDrum: true,
    }).els.flatMap((el) => (el.kind === "text" ? [el.text] : []));
    expect(text).toContain("TAMBUR MİLİ — TEK TAMBUR (SAĞ / SOL SİMETRİK)");
    expect(text.some((item) => item.includes("iki mesnetli kiriş"))).toBe(false);
  });
});
