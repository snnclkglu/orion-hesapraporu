import { describe, expect, it } from "vitest";
import { consumableMatchKey } from "../consumable-key";

describe("consumableMatchKey", () => {
  it("Türkçe harfleri koruyup kip ve noktalama farklarını katlar", () => {
    expect(consumableMatchKey("  iş Eldiveni (Nitril)  ")).toBe("İŞ ELDİVENİ NİTRİL");
    expect(consumableMatchKey("İŞ ELDİVENİ-NİTRİL")).toBe("İŞ ELDİVENİ NİTRİL");
  });

  it("ampersand ve VE yazımlarını aynı anahtara getirir", () => {
    expect(consumableMatchKey("Temizlik & Bakım")).toBe(consumableMatchKey("TEMİZLİK VE BAKIM"));
  });

  it("opsiyonel çap işaretini malzeme kimliğine katmaz", () => {
    expect(consumableMatchKey("SARI HORTUM GÖVDE Ø8MM")).toBe(
      consumableMatchKey("SARI HORTUM GÖVDE 8MM")
    );
  });

  it("boş adı boş bırakır; sunum adı uydurmaz", () => {
    expect(consumableMatchKey("  ")).toBe("");
    expect(consumableMatchKey(null)).toBe("");
  });
});
