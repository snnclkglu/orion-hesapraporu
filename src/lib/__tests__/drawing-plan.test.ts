// Teknik Resim Takibi çekirdeği — bant kuralı, kod havuzu ve numara kurulumu.
//
// Buradaki kurallar FİRMANINDIR (köprü < 1500, araba 1500–3000, ekstra 3000+)
// ve resim antedine basılan numarayı belirler; bir sapma sessiz kalırsa ressam
// yanlış bandın numarasını çizer.

import { describe, expect, it } from "vitest";
import {
  DRAWING_BANDS,
  DRAWING_GROUP_PRESETS,
  bandOfCode,
  codesOfBand,
  formatDrawingCode,
  fullDrawingNo,
  groupDrawingPlan,
  isDrawingCode,
  nextFreeCode,
} from "@/lib/drawing-plan";

describe("kod biçimi", () => {
  it("dört haneye tamamlar", () => {
    expect(formatDrawingCode(100)).toBe("0100");
    expect(formatDrawingCode(1500)).toBe("1500");
    expect(formatDrawingCode(950)).toBe("0950");
  });

  it("yalnız dört rakamı geçerli sayar", () => {
    expect(isDrawingCode("0100")).toBe(true);
    expect(isDrawingCode("100")).toBe(false);
    expect(isDrawingCode("01000")).toBe(false);
    expect(isDrawingCode("01A0")).toBe(false);
  });
});

describe("bant kuralı", () => {
  it("gerçek projelerin numaralarını doğru banda koyar", () => {
    // 0055 ve 0019 iş emirlerinin resim antedlerinden
    expect(bandOfCode("0100")).toBe("kopru"); // KÖPRÜ YÜRÜTME GRUBU
    expect(bandOfCode("0200")).toBe("kopru"); // ANAKİRİŞ
    expect(bandOfCode("0950")).toBe("kopru"); // ELEKTRİK GRUBU (ara numara)
    expect(bandOfCode("1400")).toBe("kopru");
    expect(bandOfCode("1500")).toBe("araba"); // ARABA KOMPLE
    expect(bandOfCode("2000")).toBe("araba"); // ANA ARABA KOMPLESİ
    expect(bandOfCode("2950")).toBe("araba");
    expect(bandOfCode("3000")).toBe("ekstra"); // MEKANİK KEPÇE
  });

  it("bandın dışındaki kodu bir banda ZORLAMAZ", () => {
    // "En yakın bandı" seçmek numarayı yanlış grubun altında gösterirdi.
    expect(bandOfCode("0050")).toBeNull();
    expect(bandOfCode("9999")).toBeNull();
    expect(bandOfCode("abcd")).toBeNull();
  });

  it("bantlar örtüşmez ve sınırları firma kuralıyla aynıdır", () => {
    const [kopru, araba, ekstra] = DRAWING_BANDS;
    expect(kopru.last).toBeLessThan(1500);
    expect(araba.first).toBe(1500);
    expect(araba.last).toBeLessThan(3000);
    expect(ekstra.first).toBe(3000);
  });
});

describe("kod havuzu", () => {
  it("bandın kodlarını 50 adımla üretir", () => {
    const kodlar = codesOfBand("kopru");
    expect(kodlar[0]).toBe("0100");
    expect(kodlar[1]).toBe("0150");
    expect(kodlar).toContain("0950"); // gerçekte kullanılan ara numara
    expect(kodlar.at(-1)).toBe("1450");
  });

  it("ilk boş kodu verir, kullanılanları atlar", () => {
    expect(nextFreeCode("kopru", [])).toBe("0100");
    expect(nextFreeCode("kopru", ["0100", "0150"])).toBe("0200");
    expect(nextFreeCode("araba", [])).toBe("1500");
    expect(nextFreeCode("ekstra", ["3000"])).toBe("3050");
  });

  it("bant dolduysa uydurmaz", () => {
    expect(nextFreeCode("ekstra", codesOfBand("ekstra"))).toBeNull();
  });
});

describe("tam numara", () => {
  it("kalem numarası + grup kodu", () => {
    expect(fullDrawingNo("0055-00", "0100")).toBe("0055-00-0100");
    expect(fullDrawingNo("0019-00", "2000")).toBe("0019-00-2000");
  });

  it("kalem numarası yoksa yalnız kodu döner (kök UYDURMAZ)", () => {
    expect(fullDrawingNo("", "0100")).toBe("0100");
    expect(fullDrawingNo(null, "0100")).toBe("0100");
    expect(fullDrawingNo(undefined, "0100")).toBe("0100");
  });
});

describe("gruplama", () => {
  const satir = (code: string, name = "GRUP") => ({
    id: code,
    code,
    name,
    drawn: false,
    note: "",
  });

  it("köprü ve araba alt alta, her biri kod sırasında", () => {
    const gruplar = groupDrawingPlan([
      satir("1500", "ARABA KOMPLE"),
      satir("0200", "ANAKİRİŞ"),
      satir("0100", "KÖPRÜ YÜRÜTME GRUBU"),
      satir("1600", "ARABA YÜRÜTME GRUBU"),
    ]);
    expect(gruplar.map((g) => g.label)).toEqual(["Köprü Grubu", "Araba Grubu"]);
    expect(gruplar[0].rows.map((r) => r.code)).toEqual(["0100", "0200"]);
    expect(gruplar[1].rows.map((r) => r.code)).toEqual(["1500", "1600"]);
  });

  it("boş bant başlık üretmez", () => {
    expect(groupDrawingPlan([]).length).toBe(0);
    expect(groupDrawingPlan([satir("0100")]).map((g) => g.label)).toEqual(["Köprü Grubu"]);
  });

  it("bandı çözülemeyen satırı DÜŞÜRMEZ, sona alır", () => {
    const gruplar = groupDrawingPlan([satir("9999", "ELDE YAZILMIŞ"), satir("0100")]);
    expect(gruplar.at(-1)?.label).toBe("Bant Dışı");
    expect(gruplar.at(-1)?.rows[0].code).toBe("9999");
  });
});

describe("ad önerileri", () => {
  it("her bandın kendi listesi vardır ve boş değildir", () => {
    for (const b of DRAWING_BANDS) {
      expect(DRAWING_GROUP_PRESETS[b.band].length).toBeGreaterThan(0);
    }
  });

  it("gerçek antedlerdeki ana gruplar listede vardır", () => {
    expect(DRAWING_GROUP_PRESETS.kopru).toContain("KÖPRÜ YÜRÜTME GRUBU");
    expect(DRAWING_GROUP_PRESETS.araba).toContain("TAMBUR TAHRİK GRUBU");
    expect(DRAWING_GROUP_PRESETS.ekstra).toContain("MEKANİK KEPÇE");
  });
});
