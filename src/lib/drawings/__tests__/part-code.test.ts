// Parça kodu — ağacın omurgası.
//
// DXF'lerin içinde parçayı tanıtan hiçbir metin yok; kimlik yalnız koddadır.
// Bu yüzden buradaki her kural ayrıca dondurulur.

import { describe, expect, it } from "vitest";
import {
  ancestorCodes,
  compareItemPaths,
  comparePartCodes,
  findPartCode,
  itemNoOf,
  jobRootOf,
  parseItemPath,
  parentCode,
  parentItemPath,
  parsePartCode,
} from "../part-code";

describe("parsePartCode", () => {
  it("üç segmentli kod", () => {
    expect(parsePartCode("0057-00-0500")).toMatchObject({
      code: "0057-00-0500",
      job: "0057",
      suffix: "00",
      itemNo: "0057-00",
      segments: ["0500"],
      level: 1,
      normalized: false,
    });
  });

  it("altı segmentli kod", () => {
    expect(parsePartCode("0043-00-0802-00-02-06")).toMatchObject({
      itemNo: "0043-00",
      segments: ["0802", "00", "02", "06"],
      level: 4,
    });
  });

  it("beş haneli iş öneki dörde indirilir ve işaretlenir", () => {
    // 174 dosyanın içinde tek bir fazladan sıfır vardı. Reddetmek o parçayı
    // kesim listesinden düşürürdü.
    expect(parsePartCode("00057-00-0700-02")).toMatchObject({
      code: "0057-00-0700-02",
      job: "0057",
      normalized: true,
    });
  });

  it("kalem numarasının kendisi geçerli bir koddur ama seviyesi 0'dır", () => {
    expect(parsePartCode("0057-00")).toMatchObject({ itemNo: "0057-00", level: 0 });
  });

  it("kod olmayan girdi temiz null döner, fırlatmaz", () => {
    for (const kotu of ["", "MONORAY", "31.07.2026", "0057", "abc-de-fghi", "  "]) {
      expect(() => parsePartCode(kotu)).not.toThrow();
      expect(parsePartCode(kotu)).toBeNull();
    }
  });
});

describe("findPartCode — serbest metin içinde", () => {
  it("Excel dosya adından kodu bulur", () => {
    expect(findPartCode("2.0057-00-0500_DEPO_31.07.2026")?.code).toBe("0057-00-0500");
  });

  it("tarih kod sanılmaz", () => {
    expect(findPartCode("DEPO_31.07.2026")).toBeNull();
  });

  it("kalem numarası tek başına parça kodu SAYILMAZ", () => {
    // En az bir alt segment şarttır; yoksa "1.0043" gibi bir revizyon öneki
    // kod sanılırdı.
    expect(findPartCode("iş 0057-00 kapsamı")).toBeNull();
  });
});

describe("üst zinciri", () => {
  it("son segment atılarak bulunur", () => {
    expect(parentCode("0057-00-0600-00-01-03")).toBe("0057-00-0600-00-01");
    expect(parentCode("0057-00-0600-00-01")).toBe("0057-00-0600-00");
    expect(parentCode("0057-00-0600-00")).toBe("0057-00-0600");
  });

  it("birinci düzeyin üstü PAKET KÖKÜDÜR, parça değil", () => {
    // Kökü parça sanmak, defterde var olmayan bir satıra bağlanmak olurdu.
    expect(parentCode("0057-00-0600")).toBe("");
  });

  it("tam zincir kökten yaprağa sıralıdır", () => {
    expect(ancestorCodes("0057-00-0600-00-01-03")).toEqual([
      "0057-00-0600",
      "0057-00-0600-00",
      "0057-00-0600-00-01",
    ]);
  });
});

describe("kalem ve iş kökü", () => {
  it("koddan kalem numarası", () => {
    expect(itemNoOf("0043-00-0802-00-02-06")).toBe("0043-00");
  });

  it("kalemden iş kökü", () => {
    expect(jobRootOf("0043-00")).toBe("0043");
  });

  it("iş kökü beş haneli girdide de dört hane döner", () => {
    // `slice(0,4)` bunu sessizce "0005" yapardı.
    expect(jobRootOf("00043-00")).toBe("0043");
  });
});

describe("sıralama", () => {
  it("kodlar segment segment SAYISAL sıralanır", () => {
    const kodlar = ["0057-00-0700-10", "0057-00-0700-2", "0057-00-0700-1"];
    expect([...kodlar].sort(comparePartCodes)).toEqual([
      "0057-00-0700-1",
      "0057-00-0700-2",
      "0057-00-0700-10",
    ]);
  });

  it("kısa kod uzun kodun önünde gelir (üst önce)", () => {
    expect([...["0057-00-0700-01", "0057-00-0700"]].sort(comparePartCodes)).toEqual([
      "0057-00-0700",
      "0057-00-0700-01",
    ]);
  });
});

describe("ÜRÜN AĞACI item_path", () => {
  it("noktalı hiyerarşi çözülür", () => {
    expect(parseItemPath("6.9.1.1")).toEqual([6, 9, 1, 1]);
    expect(parseItemPath("1")).toEqual([1]);
  });

  it("geçersiz değer null döner", () => {
    expect(parseItemPath("1.a")).toBeNull();
    expect(parseItemPath("")).toBeNull();
  });

  it("üst yol", () => {
    expect(parentItemPath("6.9.1.1")).toBe("6.9.1");
    expect(parentItemPath("6")).toBe("");
  });

  it("sıralama sayısaldır — düz metin 1.10'u 1.2'den önce koyardı", () => {
    expect([...["1.10", "1.2", "1.1"]].sort(compareItemPaths)).toEqual(["1.1", "1.2", "1.10"]);
  });
});
