import { describe, expect, it } from "vitest";
import { customerDrawingPathOf } from "@/lib/equipment-customer-link";

const TOKEN = "A".repeat(43);

describe("ekipman listesi müşteri ana pafta bağlantısı", () => {
  it("mutlak ve göreli müşteri linkinden yalnız uygulama yolunu saklar", () => {
    const path = `/paylas/resim/${TOKEN}`;
    expect(customerDrawingPathOf(path)).toBe(path);
    expect(customerDrawingPathOf(`https://orion.example${path}?izleme=1`)).toBe(path);
  });

  it("boş değer bağlantıyı kaldırır; başka adresleri kabul etmez", () => {
    expect(customerDrawingPathOf("  ")).toBe("");
    expect(customerDrawingPathOf("https://example.com/dosya.pdf")).toBeNull();
    expect(customerDrawingPathOf("/paylas/resim/kisa")).toBeNull();
    expect(customerDrawingPathOf(`/drawing-viewer/${TOKEN}`)).toBeNull();
  });
});
