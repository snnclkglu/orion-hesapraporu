// Teknik Resim Takibi çekirdeği — bant kuralı, kod havuzu, numara kurulumu ve
// tamamlanma yüzdesi.
//
// Buradaki kurallar FİRMANINDIR (köprü < 1500, ana araba 1500–2200, yardımcı
// araba 2300–2900, ekstra 3000+) ve resim antedine basılan numarayı belirler;
// bir sapma sessiz kalırsa ressam yanlış bandın numarasını çizer.

import { describe, expect, it } from "vitest";
import {
  DRAWING_BANDS,
  DRAWING_GROUP_PRESETS,
  DRAWING_PLAN_STATUSES,
  bandOfCode,
  codesOfBand,
  drawingPlanProgress,
  drawingStatusWeight,
  formatDrawingCode,
  fullDrawingNo,
  groupDrawingPlan,
  isDrawingCode,
  nextFreeCode,
  toDrawingStatus,
  type DrawingPlanStatus,
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
    expect(bandOfCode("0200")).toBe("kopru"); // ANA KİRİŞ
    expect(bandOfCode("0950")).toBe("kopru"); // ELEKTRİK GRUBU (devralınan ara numara)
    expect(bandOfCode("1400")).toBe("kopru");
    expect(bandOfCode("1500")).toBe("anaAraba"); // ARABA KOMPLE
    expect(bandOfCode("2000")).toBe("anaAraba"); // ANA ARABA KOMPLESİ
    expect(bandOfCode("2200")).toBe("anaAraba");
    expect(bandOfCode("2300")).toBe("yardimciAraba");
    expect(bandOfCode("2900")).toBe("yardimciAraba");
    expect(bandOfCode("3000")).toBe("ekstra"); // MEKANİK KEPÇE
  });

  it("iki araba AYRI bantlardır", () => {
    // Vinçte iki araba olabilir; ikisinin resim takımı ressam için ayrıdır.
    expect(bandOfCode("1500")).not.toBe(bandOfCode("2300"));
  });

  it("bandın dışındaki kodu bir banda ZORLAMAZ", () => {
    // "En yakın bandı" seçmek numarayı yanlış grubun altında gösterirdi.
    expect(bandOfCode("0050")).toBeNull();
    expect(bandOfCode("9999")).toBeNull();
    expect(bandOfCode("abcd")).toBeNull();
    // İki araba bandı arasındaki boşluk BİLİNÇLİDİR.
    expect(bandOfCode("2250")).toBeNull();
  });

  it("bantlar örtüşmez ve sınırları firma kuralıyla aynıdır", () => {
    const [kopru, ana, yardimci, ekstra] = DRAWING_BANDS;
    expect(kopru.last).toBeLessThan(1500);
    expect(ana.first).toBe(1500);
    expect(ana.last).toBeLessThan(yardimci.first);
    expect(yardimci.last).toBeLessThan(3000);
    expect(ekstra.first).toBe(3000);
  });
});

describe("kod havuzu", () => {
  it("bandın kodlarını 100 adımla üretir", () => {
    const kodlar = codesOfBand("kopru");
    expect(kodlar[0]).toBe("0100");
    expect(kodlar[1]).toBe("0200");
    expect(kodlar).not.toContain("0150");
    expect(kodlar.at(-1)).toBe("1400");
  });

  it("hiçbir bantta 50'lik ara numara ÖNERMEZ", () => {
    for (const b of DRAWING_BANDS) {
      for (const kod of codesOfBand(b.band)) {
        expect(Number(kod) % 100).toBe(0);
      }
    }
  });

  it("araba bantları kendi kodlarını üretir", () => {
    expect(codesOfBand("anaAraba")[0]).toBe("1500");
    expect(codesOfBand("anaAraba").at(-1)).toBe("2200");
    expect(codesOfBand("yardimciAraba")[0]).toBe("2300");
    expect(codesOfBand("yardimciAraba").at(-1)).toBe("2900");
  });

  it("ilk boş kodu verir, kullanılanları atlar", () => {
    expect(nextFreeCode("kopru", [])).toBe("0100");
    expect(nextFreeCode("kopru", ["0100", "0200"])).toBe("0300");
    expect(nextFreeCode("anaAraba", [])).toBe("1500");
    expect(nextFreeCode("yardimciAraba", [])).toBe("2300");
    expect(nextFreeCode("ekstra", ["3000"])).toBe("3100");
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

describe("durum defteri", () => {
  it("tanınmayan değeri düşürmez, Bekliyor'a çeker", () => {
    expect(toDrawingStatus("cizildi")).toBe("cizildi");
    expect(toDrawingStatus("")).toBe("bekliyor");
    expect(toDrawingStatus(null)).toBe("bekliyor");
    expect(toDrawingStatus("uydurma")).toBe("bekliyor");
  });

  it("ağırlıklar 0 ile 100 arasında TAM SAYIDIR ve sıralaması anlamlıdır", () => {
    for (const s of DRAWING_PLAN_STATUSES) {
      expect(Number.isInteger(s.weight)).toBe(true);
      expect(s.weight).toBeGreaterThanOrEqual(0);
      expect(s.weight).toBeLessThanOrEqual(100);
    }
    expect(drawingStatusWeight("bekliyor")).toBe(0);
    expect(drawingStatusWeight("cizildi")).toBe(100);
    // Revize bir kez çizilmiştir → çiziliyordan ileri, kontrolden geri.
    expect(drawingStatusWeight("revize")).toBeGreaterThan(drawingStatusWeight("ciziliyor"));
    expect(drawingStatusWeight("revize")).toBeLessThan(drawingStatusWeight("kontrol"));
  });
});

describe("tamamlanma yüzdesi", () => {
  const satir = (status: DrawingPlanStatus) => ({ status });

  it("boş defterde sıfırdır (bölme yapmaz)", () => {
    expect(drawingPlanProgress([])).toEqual({ percent: 0, done: 0, total: 0 });
  });

  it("tamamı çizildiyse 100, hiçbiri başlamadıysa 0", () => {
    expect(drawingPlanProgress([satir("cizildi"), satir("cizildi")]).percent).toBe(100);
    expect(drawingPlanProgress([satir("bekliyor"), satir("bekliyor")]).percent).toBe(0);
  });

  it("ara durumları ağırlıklarıyla sayar", () => {
    // (100 + 80 + 50 + 0) / 4 = 57,5 → %58
    const p = drawingPlanProgress([
      satir("cizildi"),
      satir("kontrol"),
      satir("ciziliyor"),
      satir("bekliyor"),
    ]);
    expect(p.percent).toBe(58);
    expect(p.done).toBe(1);
    expect(p.total).toBe(4);
  });

  it("yeni grup eklemek oranı DÜŞÜRÜR", () => {
    const once = drawingPlanProgress([satir("cizildi")]).percent;
    const sonra = drawingPlanProgress([satir("cizildi"), satir("bekliyor")]).percent;
    expect(sonra).toBeLessThan(once);
  });

  it("yalnız her satır çizildiğinde 100 olur", () => {
    // 50 çizildi + 1 kontrol = %99,6; yuvarlama %100 gösterip bitmemiş bir işi
    // bitmiş gibi okutmamalıdır.
    const p = drawingPlanProgress([...Array(50).fill(satir("cizildi")), satir("kontrol")]);
    expect(p.percent).toBe(99);
    expect(p.done).toBe(50);
  });
});

describe("gruplama", () => {
  const satir = (code: string, name = "GRUP") => ({
    id: code,
    code,
    name,
    status: "bekliyor" as DrawingPlanStatus,
    // Gruplama ÇİZENE bakmaz — bant koddan türer. Alanlar yalnız tipi
    // karşılamak için burada; bir değer taşısalardı testin konusu
    // bulanıklaşırdı.
    drawnBy: null,
    drawnByName: "",
    note: "",
  });

  it("köprü, ana araba ve yardımcı araba alt alta, her biri kod sırasında", () => {
    const gruplar = groupDrawingPlan([
      satir("1500", "ANA ARABA KOMPLESİ"),
      satir("0200", "ANA KİRİŞ"),
      satir("2300", "YARDIMCI ARABA KOMPLESİ"),
      satir("0100", "KÖPRÜ YÜRÜTME GRUBU"),
      satir("1600", "ARABA YÜRÜTME GRUBU"),
    ]);
    expect(gruplar.map((g) => g.label)).toEqual([
      "Köprü Grubu",
      "Ana Araba Grubu",
      "Yardımcı Araba Grubu",
    ]);
    expect(gruplar[0].rows.map((r) => r.code)).toEqual(["0100", "0200"]);
    expect(gruplar[1].rows.map((r) => r.code)).toEqual(["1500", "1600"]);
    expect(gruplar[2].rows.map((r) => r.code)).toEqual(["2300"]);
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

  it("devralınan 50'lik numarayı gizlemez", () => {
    // "0150" artık ÖNERİLMEZ ama yazılmış olanı kendi bandında kalmalıdır.
    const gruplar = groupDrawingPlan([satir("0150", "ESKİ NUMARA")]);
    expect(gruplar[0].label).toBe("Köprü Grubu");
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
    expect(DRAWING_GROUP_PRESETS.anaAraba).toContain("TAMBUR TAHRİK GRUBU");
    expect(DRAWING_GROUP_PRESETS.yardimciAraba).toContain("YARDIMCI ARABA KOMPLESİ");
    expect(DRAWING_GROUP_PRESETS.ekstra).toContain("MEKANİK KEPÇE");
  });
});
