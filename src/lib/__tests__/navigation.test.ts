import { describe, expect, it } from "vitest";
import { parentPagePath } from "@/lib/navigation";

describe("bir üst sayfaya dönüş adresi", () => {
  it("kök sayfada geri adresi üretmez", () => {
    expect(parentPagePath("/")).toBeUndefined();
  });

  it("ana bölümü panele bağlar", () => {
    expect(parentPagePath("/projects")).toBe("/");
  });

  it("sayfa içi gezinmede yalnız son parçayı çıkarır", () => {
    expect(parentPagePath("/personnel/123")).toBe("/personnel");
    expect(parentPagePath("/jobs/123/akis")).toBe("/jobs/123");
  });

  it("fazladan eğik çizgileri yoksayar", () => {
    expect(parentPagePath("/purchasing//hammadde/")).toBe("/purchasing");
  });
});
