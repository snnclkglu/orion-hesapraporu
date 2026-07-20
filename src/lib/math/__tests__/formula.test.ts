import { describe, expect, it } from "vitest";
import { parseFormula, type MathNode } from "../formula";

function kinds(n: MathNode): string[] {
  const acc: string[] = [n.t === "text" ? n.kind : n.t];
  if (n.t === "row") n.items.forEach((c) => acc.push(...kinds(c)));
  else if (n.t === "frac") { acc.push(...kinds(n.num), ...kinds(n.den)); }
  else if (n.t === "sup") { acc.push(...kinds(n.base), ...kinds(n.exp)); }
  else if (n.t === "sub") { acc.push(...kinds(n.base), ...kinds(n.sub)); }
  else if (n.t === "sqrt") acc.push(...kinds(n.inner));
  else if (n.t === "paren") acc.push(...kinds(n.inner));
  return acc;
}

describe("parseFormula", () => {
  it("bölmeyi kesire çevirir", () => {
    const n = parseFormula("M_m = M_ç / (i · η_r)");
    expect(n).not.toBeNull();
    expect(kinds(n!)).toContain("frac");
    expect(kinds(n!)).toContain("rel"); // '='
  });

  it("kök ve üs işler", () => {
    const n = parseFormula("σcomb = √(σx² + σz²)");
    expect(n).not.toBeNull();
    const k = kinds(n!);
    expect(k).toContain("sqrt");
    expect(k).toContain("sup");
  });

  it("soldan birleşen ·/ zinciri: L·W/80 → (L·W)/80", () => {
    const n = parseFormula("My = L · W / 80");
    expect(n?.t).toBe("row");
    // sağ tarafta bir frac olmalı
    expect(kinds(n!).filter((x) => x === "frac").length).toBe(1);
  });

  it("tanımsal/koşullu formül null döner (düz metne düşer)", () => {
    expect(parseFormula("H = f(mekanizma sınıfı)  [FEM tablosu]")).toBeNull();
    expect(parseFormula("Kτ = α>1 → 5,34 + 4/α²; aksi 4 + 5,34/α²")).toBeNull();
    expect(parseFormula("T = 02!L19")).toBeNull();
  });

  it("boş/space güvenli", () => {
    expect(parseFormula("")).toBeNull();
    expect(parseFormula("   ")).toBeNull();
  });
});
