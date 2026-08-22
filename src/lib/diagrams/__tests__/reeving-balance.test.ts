import { describe, expect, it } from "vitest";
import { reevingDiagram } from "../reeving";

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
    expect(textValues("equalizerBeam")).toContain("Denge traversi · sabit uçlar");
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
