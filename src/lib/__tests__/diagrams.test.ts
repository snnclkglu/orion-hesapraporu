// Parametrik diyagram üreticileri — duman testleri.
// Üreticiler saf fonksiyonlardır: girdi değişince çıktı (etiketler/geometri)
// değişmeli, geçersiz girdide hesap düşmeden uyarı metni dönmelidir.

import { describe, expect, it } from "vitest";
import { girderSectionDiagram } from "@/lib/diagrams/girderSection";
import { wheelShaftDiagram } from "@/lib/diagrams/wheelShaft";
import { reevingDiagram } from "@/lib/diagrams/reeving";
import { drumDiagram } from "@/lib/diagrams/drum";
import { diagramForSection } from "@/lib/diagrams/select";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";

const texts = (d: { els: { kind: string }[] }) =>
  d.els
    .filter((e): e is { kind: "text"; text: string } => e.kind === "text")
    .map((e) => e.text)
    .join(" | ");

const GIRDER = {
  railHeightMm: 55,
  t1Mm: 10, b1Mm: 400, t2Mm: 8, b2Mm: 500,
  t3Mm: 6, h3Mm: 1200, t4Mm: 6,
  t5Mm: 10, b5Mm: 400, t6Mm: 8, b6Mm: 300,
  aMm: 388, xMm: 50,
  czMm: 620, cyMm: 250,
};

describe("girderSectionDiagram", () => {
  it("plaka etiketlerini ve tarafsız ekseni basar", () => {
    const t = texts(girderSectionDiagram(GIRDER));
    expect(t).toContain("t1 = 10");
    expect(t).toContain("t6 = 8");
    expect(t).toContain("h = 1.236");
    expect(t).toContain("Cz = 620 mm");
  });

  it("plaka girdisi değişince çıktı değişir", () => {
    const a = texts(girderSectionDiagram(GIRDER));
    const b = texts(girderSectionDiagram({ ...GIRDER, t1Mm: 25 }));
    expect(a).not.toEqual(b);
    expect(b).toContain("t1 = 25");
  });

  it("geçersiz kesitte uyarı döner, istisna atmaz", () => {
    const t = texts(girderSectionDiagram({ ...GIRDER, t1Mm: 0, t2Mm: 0, h3Mm: 0, t5Mm: 0, t6Mm: 0 }));
    expect(t).toContain("eksik");
  });
});

describe("wheelShaftDiagram", () => {
  it("mesnet ölçüleri ve Mmaks etiketini basar", () => {
    const t = texts(
      wheelShaftDiagram({
        spanACm: 11, spanBCm: 11, shaftDiaCm: 9,
        wheelLoadKg: 9270, reactionAKg: 4635, reactionBKg: 4635, maxMomentKgCm: 50985,
      })
    );
    expect(t).toContain("a = 11 cm");
    expect(t).toContain("Pmaks = 9.270 kg");
    // Moment Nm cinsinden gösterilir (50.985 kg·cm ≈ 5.000 Nm)
    expect(t).toMatch(/Mmaks = [\d.,]+ Nm/);
  });
});

describe("drumDiagram", () => {
  it("tambur çapı ve min çap etiketlerini basar", () => {
    const t = texts(
      drumDiagram({
        drumDiaMm: 900, ropeDiaMm: 22, wallThicknessMm: 25,
        groovePitchMm: 25, minDiaMm: 506, material: "St52",
      })
    );
    expect(t).toMatch(/D_d = 900 mm/);
    expect(t).toContain("halat Ø22 mm");
    expect(t).toMatch(/D_min/);
    expect(t).toContain("D_d ≥ D_min ✓");
  });

  it("çap seçilmediğinde uyarı basar", () => {
    const t = texts(drumDiagram({ drumDiaMm: 0, ropeDiaMm: 20 }));
    expect(t).toContain("Tambur çapı seçilmedi");
  });
});

describe("reevingDiagram", () => {
  it("donanım etiketini ve tamburu basar", () => {
    const t = texts(reevingDiagram({ drivenFalls: 2, totalFalls: 4, drumDiaMm: 400, loadKg: 7500 }));
    expect(t).toContain("2/4");
    expect(t).toContain("Tambur ØD = 400 mm");
    expect(t).toContain("Makara");
  });

  it("2/2 donanımda üst makara yoktur", () => {
    const t = texts(reevingDiagram({ drivenFalls: 2, totalFalls: 2 }));
    expect(t).not.toContain("Makara |");
    expect(t).toContain("2/2");
  });
});

describe("diagramForSection", () => {
  const input = V5_TEMPLATE;
  const result = runCalc(input);

  it("7.1 / 5.2 / 2.1 bölümlerine diyagram, diğerlerine null döner", () => {
    expect(diagramForSection("girder", "7.1", input, result)).not.toBeNull();
    expect(diagramForSection("trolley", "5.2", input, result)).not.toBeNull();
    expect(diagramForSection("bridge", "5.2", input, result)).not.toBeNull();
    expect(diagramForSection("main", "2.1", input, result)).not.toBeNull();
    expect(diagramForSection("aux", "2.1", input, result)).not.toBeNull();
    expect(diagramForSection("girder", "7.2", input, result)).toBeNull();
    expect(diagramForSection("buckling", "8.1", input, result)).toBeNull();
  });

  it("kesit diyagramı hesaplanan tarafsız ekseni içerir", () => {
    const d = diagramForSection("girder", "7.1", input, result)!;
    expect(texts(d)).toMatch(/Cz = [\d.,]+ mm/);
  });
});
