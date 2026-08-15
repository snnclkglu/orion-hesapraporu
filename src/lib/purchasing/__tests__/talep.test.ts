import { describe, expect, it } from "vitest";
import { talepBasligi, talepImzasi, teklifMiktari } from "../talep";

describe("talepImzasi", () => {
  it("sıra ve tekrar imzayı değiştirmez", () => {
    const a = talepImzasi(["SAC 12 X 1500 X 3000 S235JR", "RAY A65 S235JR"]);
    const b = talepImzasi(["RAY A65 S235JR", "SAC 12 X 1500 X 3000 S235JR", "RAY A65 S235JR"]);
    expect(a).toBe(b);
  });

  it("FARKLI kalem kümesi FARKLI imzadır — iki plaka teklifi tek talebe düşmez", () => {
    expect(talepImzasi(["SAC 12 X 1500 X 3000 S235JR"])).not.toBe(
      talepImzasi(["SAC 5 X 2000 X 12000 BDS"])
    );
  });

  it("boş ve boşluklu anahtarlar elenir", () => {
    expect(talepImzasi([" ", "", "A"])).toBe("A");
    expect(talepImzasi([" A "])).toBe("A");
  });

  it("ayraç satır sonudur — anahtarın içindeki noktalama imzayı bölmez", () => {
    // `trKatla` boşluğu katlar ama noktalamayı taşır; virgül ayraç olsaydı
    // "A, B" tek anahtarı iki anahtar gibi görünürdü.
    expect(talepImzasi(["A, B"])).toBe("A, B");
    expect(talepImzasi(["A", "B"])).toBe("A\nB");
  });
});

describe("talepBasligi", () => {
  it("tek kalemde kalemin adıdır", () => {
    expect(talepBasligi(["SAC 12 X 1500 X 3000 S235JR"])).toBe("SAC 12 X 1500 X 3000 S235JR");
  });

  it("çok kalemde ilk kalem + sayı", () => {
    expect(talepBasligi(["HEA 120", "HEA 200", "HEA 240"])).toBe("HEA 120 + 2 kalem");
  });

  it("kalem yoksa uydurmaz", () => {
    expect(talepBasligi([])).toBe("Teklif");
    expect(talepBasligi(["  "])).toBe("Teklif");
  });
});

describe("teklifMiktari", () => {
  it("havuz konuşuyorsa havuz kazanır — parça değiştikçe o değişir", () => {
    expect(teklifMiktari(6530, 360)).toBe(6530);
  });

  it("havuz susuyorsa teklifle donmuş miktar okunur (plaka)", () => {
    expect(teklifMiktari(null, 3537)).toBe(3537);
  });

  it("ikisi de yoksa UYDURULMAZ", () => {
    expect(teklifMiktari(null, null)).toBeNull();
    expect(teklifMiktari(0, 0)).toBeNull();
  });
});
