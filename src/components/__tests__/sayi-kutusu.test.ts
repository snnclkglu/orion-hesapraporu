import { describe, expect, it } from "vitest";
import {
  kutuGosterimi,
  kutuMetni,
  sayiVeyaNull,
  taslakDusmeli,
} from "@/components/sayi-kutusu";

describe("sayı kutusu — kanonik yazım", () => {
  it("ondalık ayracı virgüldür, boş değer boş metindir", () => {
    expect(kutuMetni(304000)).toBe("304000");
    expect(kutuMetni(19.5)).toBe("19,5");
    expect(kutuMetni(null)).toBe("");
    expect(kutuMetni(undefined)).toBe("");
    expect(kutuMetni(Number.NaN)).toBe("");
  });
});

describe("sayı kutusu — görünen metin", () => {
  it("odak dışında binlik ayıraç basar", () => {
    expect(kutuGosterimi(304000, { binlik: true })).toBe("304.000");
    expect(kutuGosterimi(1234567.5, { binlik: true })).toBe("1.234.567,5");
  });

  it("binlik istenmezse ayıraç basılmaz (adet ve yüzde kutuları)", () => {
    expect(kutuGosterimi(304000)).toBe("304000");
    expect(kutuGosterimi(30, { binlik: false })).toBe("30");
  });

  // GRUPLU METNE YAZMAK ÇÖP ÜRETİR: "304.000" gösterilen kutuya sona '5'
  // yazılırsa metin "304.0005" olur ve `parseNum` onu 304,0005 okur.
  it("odaktayken ayıraç düşer — gruplu metnin içine yazılmaz", () => {
    expect(kutuGosterimi(304000, { binlik: true, odakta: true })).toBe("304000");
  });

  it("taslak varsa yazılan aynen görünür (yarım yazım hayatta kalır)", () => {
    expect(kutuGosterimi(0, { taslak: "0,", odakta: true, binlik: true })).toBe("0,");
    expect(kutuGosterimi(304, { taslak: "304.0", odakta: true, binlik: true })).toBe("304.0");
    // Kutunun tamamen silinmesi de bir taslaktır ve değeri maskelemelidir.
    expect(kutuGosterimi(40, { taslak: "", odakta: true })).toBe("");
  });
});

describe("sayı kutusu — taslağın düşmesi", () => {
  it("dışarıdan gelen yeni değer taslağı düşürür", () => {
    // İskonto birim fiyatlara yansıtıldığında kutu 55900 → 52000 olur.
    expect(taslakDusmeli("55900", 52000)).toBe(true);
  });

  it("aynı sayıyı anlatan taslak korunur", () => {
    expect(taslakDusmeli("0,", 0)).toBe(false);
    expect(taslakDusmeli("304.000", 304000)).toBe(false);
  });

  it("boş taslak korunur — kutu silinip yeniden yazılabilsin", () => {
    expect(taslakDusmeli("", 40)).toBe(false);
    expect(taslakDusmeli("   ", 40)).toBe(false);
  });

  it("taslak yoksa düşecek bir şey de yoktur", () => {
    expect(taslakDusmeli(null, 40)).toBe(false);
  });
});

describe("sayı kutusu — çözümleme", () => {
  it("boş kutu null üretir, sıfır DEĞİL", () => {
    expect(sayiVeyaNull("")).toBeNull();
    expect(sayiVeyaNull("   ")).toBeNull();
  });

  it("yapıştırılan gruplu metni okur", () => {
    expect(sayiVeyaNull("1.234.567")).toBe(1234567);
    expect(sayiVeyaNull("1.234,50")).toBe(1234.5);
  });

  // TEKLIF-37: nokta ancak ardında TAM ÜÇ hane varsa binliktir.
  it("noktayı her zaman binlik saymaz", () => {
    expect(sayiVeyaNull("12.44")).toBe(12.44);
  });
});
