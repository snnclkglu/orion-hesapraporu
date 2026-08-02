// Parametrik diyagram üreticileri — duman + kırpılma testleri.
// Üreticiler saf fonksiyonlardır: girdi değişince çıktı (etiketler/geometri)
// değişmeli, geçersiz girdide hesap düşmeden uyarı metni dönmelidir.
//
// KIRPILMA REGRESYONU: bir diyagramın son etiketi viewBox'ın altında kalırsa
// ekranda ve PDF'te sessizce kaybolur (moment diyagramındaki "Mmaks" böyle
// kaybolmuştu). `fitDiagram` yüksekliği içerikten hesaplar; aşağıdaki ortak
// test bunu her üretici için doğrular.

import { describe, expect, it } from "vitest";
import { girderSectionDiagram } from "@/lib/diagrams/girderSection";
import { wheelShaftDiagram } from "@/lib/diagrams/wheelShaft";
import { reevingDiagram } from "@/lib/diagrams/reeving";
import { drumDiagram } from "@/lib/diagrams/drum";
import { deflectionDiagram } from "@/lib/diagrams/deflection";
import { girderLoadDiagram } from "@/lib/diagrams/girderLoad";
import { girderStressDiagram } from "@/lib/diagrams/girderStress";
import { diagramForSection } from "@/lib/diagrams/select";
import type { Diagram, DiagramEl } from "@/lib/diagrams/model";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";

const texts = (d: { els: { kind: string }[] }) =>
  d.els
    .filter((e): e is { kind: "text"; text: string } => e.kind === "text")
    .map((e) => e.text)
    .join(" | ");

/**
 * Bir elemanın alt sınırı — `model.ts`teki hesaptan BAĞIMSIZ yazılmıştır ki
 * test, doğruladığı kodun aynısını çağırmasın. Yay (`A`/`a`) içeren path'ler
 * atlanır: bu testin hedefi kırpılan METİN etiketleridir.
 */
function bottomOf(el: DiagramEl): number | undefined {
  switch (el.kind) {
    case "line": return Math.max(el.y1, el.y2);
    case "rect": return el.y + Math.max(0, el.h);
    case "circle": return el.cy + el.r;
    case "polygon": return Math.max(...el.points.map((p) => p[1]));
    case "text": return el.y;
    case "path": {
      if (/[aA]/.test(el.d)) return undefined;      // yay — atlanır
      const nums = el.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      let max = -Infinity;
      for (let i = 1; i < nums.length; i += 2) max = Math.max(max, nums[i]);
      return Number.isFinite(max) ? max : undefined;
    }
  }
}

function assertFits(name: string, d: Diagram) {
  for (const el of d.els) {
    const b = bottomOf(el);
    if (b === undefined) continue;
    expect(
      b,
      `${name}: "${el.kind === "text" ? el.text : el.kind}" elemanı y=${b}, ` +
        `diyagram yüksekliği ${d.height} — viewBox dışında kalıyor`
    ).toBeLessThanOrEqual(d.height);
  }
  expect(d.width, `${name}: genişlik pozitif olmalı`).toBeGreaterThan(0);
  expect(d.height, `${name}: yükseklik pozitif olmalı`).toBeGreaterThan(0);
}

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

describe("deflectionDiagram", () => {
  it("açıklık, sehim (mm) ve L/δ oranını basar", () => {
    const t = texts(
      deflectionDiagram({ spanM: 17.5, deflectionMm: 4.55, deflectionRatio: 3844, limitRatio: 750 })
    );
    expect(t).toMatch(/L = 17,5 m/);
    expect(t).toMatch(/δ = 4,55 mm/);
    expect(t).toMatch(/L\/δ = 3\.844/);
    expect(t).toContain("✓");
  });
});

describe("girderLoadDiagram", () => {
  it("açıklık, araba yükleri ve momenti basar", () => {
    const t = texts(
      girderLoadDiagram({
        spanM: 17.5, wheelSpacingMm: 3000, wheelLoadKg: 4200,
        selfWeightKg: 8000, liveLoadKg: 10000, momentKgCm: 500000,
      })
    );
    expect(t).toMatch(/L = 17,5 m/);
    expect(t).toContain("ARABA");
    expect(t).toMatch(/Mmaks =/);
    expect(t).toMatch(/R_A/);
  });
});

describe("girderStressDiagram", () => {
  it("numaralı bileşenleri gerçek kesit üzerinde MPa ile etiketler", () => {
    const t = texts(
      girderStressDiagram({
        ...GIRDER,
        sigma1SelfWeight: 120, sigma2Trolley: 40, sigma3Hoist: 220,
        sigma4BridgeLateral: 15, sigma5TrolleyLateral: 12, sigma6RailLever: 9,
        sigma7SecondaryTrolley: 6, sigma8SecondaryHoist: 18,
        sigma9WheelTrolley: -13, sigma10WheelHoist: -39,
        tau1TorsionTrolley: 5, tau2TorsionHoist: 14,
        tau3ShearSelfWeight: 26, tau4ShearTrolley: 8, tau5ShearHoist: 24,
        sigmaXBottom: 548, sigmaXTop: -450, sigmaZ: -58,
        tauMain: 78, tauSecondary: 96, sigmaComb: 600, allowable: 2450,
      })
    );
    // Numaralandırma ve lejant
    for (const no of ["σ1", "σ5", "σ10", "τ1", "τ5"]) expect(t).toContain(no);
    expect(t).toContain("ALT LİF");
    expect(t).toContain("ÜST LİF");
    expect(t).toContain("ray ekseni");
    expect(t).toMatch(/MPa/);
    // Toplama giren bileşenler görünür
    expect(t).toContain("σz = σ9 + ψσ10");
  });

  it("geçersiz kesitte uyarı döner, istisna atmaz", () => {
    const t = texts(
      girderStressDiagram({ ...GIRDER, t1Mm: 0, t2Mm: 0, h3Mm: 0, t5Mm: 0, t6Mm: 0 })
    );
    expect(t).toContain("eksik");
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

  /** Şablonun ürettiği tüm diyagramlar (bölüm eşlemesiyle). */
  const pairs: [string, string][] = [
    ["girder", "7.1"], ["girder", "7.2"], ["girder", "7.4"], ["girder", "7.6"],
    ["trolley", "5.2"], ["bridge", "5.2"],
    ["main", "2.1"], ["aux", "2.1"],
    ["main", "2.2.1"], ["main", "2.2.3"],
    ["hookBlock", "4.4"],
  ];

  it("ilgili bölümlere diyagram, diğerlerine null döner", () => {
    expect(diagramForSection("girder", "7.1", input, result)).not.toBeNull();
    expect(diagramForSection("girder", "7.2", input, result)).not.toBeNull(); // yükler
    expect(diagramForSection("girder", "7.4", input, result)).not.toBeNull(); // gerilme şeması
    expect(diagramForSection("girder", "7.6", input, result)).not.toBeNull(); // sehim
    expect(diagramForSection("trolley", "5.2", input, result)).not.toBeNull();
    expect(diagramForSection("bridge", "5.2", input, result)).not.toBeNull();
    expect(diagramForSection("main", "2.1", input, result)).not.toBeNull();
    expect(diagramForSection("aux", "2.1", input, result)).not.toBeNull();
    expect(diagramForSection("girder", "7.3", input, result)).toBeNull();
    expect(diagramForSection("buckling", "8.1", input, result)).toBeNull();
  });

  it("kesit diyagramı hesaplanan tarafsız ekseni içerir", () => {
    const d = diagramForSection("girder", "7.1", input, result)!;
    expect(texts(d)).toMatch(/Cz = [\d.,]+ mm/);
  });

  it("ana kiriş yükleme diyagramı GERÇEK sonuçtan Mmaks üretir", () => {
    // Ölü Excel adresleri (D172/D191/D199/I192) yerine semantik anahtarlar
    const d = diagramForSection("girder", "7.2", input, result)!;
    const t = texts(d);
    expect(t).toMatch(/Mmaks = [\d.,]+ (kNm|Nm)/);
    expect(t).toMatch(/P ≈ [\d.,]+ kg \/ teker/);
    expect(t).toMatch(/W1 = [\d.,]+ kg/);
  });

  it("gerçek sonuçtan üretilen hiçbir diyagram kırpılmaz", () => {
    for (const [mod, sec] of pairs) {
      const d = diagramForSection(mod, sec, input, result);
      if (!d) continue;
      assertFits(`${mod} ${sec}`, d);
    }
  });

  it("doğrudan üretilen diyagramlar da kırpılmaz", () => {
    assertFits("girderSection", girderSectionDiagram(GIRDER));
    assertFits("girderStress", girderStressDiagram({ ...GIRDER, sigmaXBottom: 548 }));
    assertFits("girderLoad", girderLoadDiagram({
      spanM: 17.5, wheelSpacingMm: 3000, wheelLoadKg: 4200,
      selfWeightKg: 8000, liveLoadKg: 10000, momentKgCm: 500000,
    }));
    assertFits("deflection", deflectionDiagram({
      spanM: 17.5, deflectionMm: 4.55, deflectionRatio: 3844, limitRatio: 750,
    }));
    assertFits("drum", drumDiagram({
      drumDiaMm: 900, ropeDiaMm: 22, wallThicknessMm: 25,
      groovePitchMm: 25, minDiaMm: 506, material: "St52",
    }));
    assertFits("wheelShaft", wheelShaftDiagram({
      spanACm: 11, spanBCm: 11, shaftDiaCm: 9,
      wheelLoadKg: 9270, reactionAKg: 4635, reactionBKg: 4635, maxMomentKgCm: 50985,
    }));
    assertFits("reeving", reevingDiagram({
      drivenFalls: 2, totalFalls: 4, drumDiaMm: 400, loadKg: 7500,
    }));
  });
});
