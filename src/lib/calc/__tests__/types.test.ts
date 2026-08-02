import { describe, it, expect } from "vitest";
import {
  checkComputedSide,
  checkDisplay,
  checkKind,
  checkSeverity,
  isBlocking,
  blockingFailures,
  parseHoistLoadClass,
  type AnyCheck,
  type Check,
  type RangeCheck,
} from "../types";

/** Test kolaylığı için varsayılan bir kontrol üretir. */
function mkCheck(over: Partial<Check> = {}): Check {
  return {
    id: "rope.load",
    label: "Halat yükü",
    required: 100,
    provided: 120,
    unit: "kg",
    op: ">=",
    computedSide: "provided",
    pass: true,
    ...over,
  };
}

/** Aralık tipli kontrol üretir. */
function mkRange(over: Partial<RangeCheck> = {}): RangeCheck {
  return {
    id: "gearbox.ratioDeviation",
    label: "Redüktör oran sapması",
    provided: 0.02,
    unit: "-",
    op: "range",
    min: -0.1,
    max: 0.05,
    pass: true,
    ...over,
  };
}

describe("checkKind", () => {
  it("alan yoksa 'standart' varsayar", () => {
    expect(checkKind(mkCheck())).toBe("standart");
    expect(checkKind(mkRange())).toBe("standart");
  });

  it("tanımlı dayanağı aynen döndürür", () => {
    expect(checkKind(mkCheck({ kind: "uretici" }))).toBe("uretici");
    expect(checkKind(mkCheck({ kind: "firma" }))).toBe("firma");
    expect(checkKind(mkCheck({ kind: "bilgi" }))).toBe("bilgi");
    expect(checkKind(mkRange({ kind: "firma" }))).toBe("firma");
  });

  it("eski anlık görüntülerden gelen geçersiz değeri varsayılana düşürür", () => {
    // Eski revizyon snapshot'ı tip güvencesi olmadan JSONB'den gelir.
    const eski = { ...mkCheck(), kind: "excel" } as unknown as AnyCheck;
    expect(checkKind(eski)).toBe("standart");
  });
});

describe("checkSeverity", () => {
  it("alan yoksa 'engelleyici' varsayar", () => {
    expect(checkSeverity(mkCheck())).toBe("engelleyici");
    expect(checkSeverity(mkRange())).toBe("engelleyici");
  });

  it("tanımlı etkiyi aynen döndürür", () => {
    expect(checkSeverity(mkCheck({ severity: "uyari" }))).toBe("uyari");
    expect(checkSeverity(mkCheck({ severity: "engelleyici" }))).toBe("engelleyici");
  });

  it("geçersiz değeri en muhafazakâr varsayıma düşürür", () => {
    const bozuk = { ...mkCheck(), severity: "kritik" } as unknown as AnyCheck;
    expect(checkSeverity(bozuk)).toBe("engelleyici");
  });
});

describe("isBlocking", () => {
  it("geçen kontrol hiçbir zaman engelleyici değildir", () => {
    expect(isBlocking(mkCheck({ pass: true }))).toBe(false);
    expect(isBlocking(mkCheck({ pass: true, severity: "engelleyici" }))).toBe(false);
  });

  it("etkisi belirtilmemiş başarısız kontrol engelleyicidir", () => {
    expect(isBlocking(mkCheck({ pass: false }))).toBe(true);
  });

  it("uyarı seviyesindeki başarısız kontrol engellemez", () => {
    expect(isBlocking(mkCheck({ pass: false, severity: "uyari" }))).toBe(false);
  });

  it("bilgi amaçlı ama engelleyici işaretli kontrol yine engeller", () => {
    // kind ile severity birbirinden bağımsızdır.
    expect(isBlocking(mkCheck({ pass: false, kind: "bilgi" }))).toBe(true);
    expect(isBlocking(mkCheck({ pass: false, kind: "bilgi", severity: "uyari" }))).toBe(false);
  });

  it("aralık kontrolünde de çalışır", () => {
    expect(isBlocking(mkRange({ pass: false }))).toBe(true);
    expect(isBlocking(mkRange({ pass: false, severity: "uyari" }))).toBe(false);
  });
});

describe("blockingFailures", () => {
  it("yalnız engelleyici başarısızlıkları, sırasını koruyarak döndürür", () => {
    const a = mkCheck({ id: "rope.load", pass: false });
    const b = mkCheck({ id: "drum.minDia", pass: true });
    const c = mkCheck({ id: "fatigue.combined", pass: false, severity: "uyari" });
    const d = mkRange({ id: "gearbox.requiredTorque", pass: false, severity: "engelleyici" });

    const sonuc = blockingFailures([a, b, c, d]);
    expect(sonuc.map((x) => x.id)).toEqual(["rope.load", "gearbox.requiredTorque"]);
  });

  it("boş liste boş döner", () => {
    expect(blockingFailures([])).toEqual([]);
  });

  it("hepsi geçtiğinde boş döner", () => {
    expect(blockingFailures([mkCheck(), mkRange()])).toEqual([]);
  });

  it("girdi dizisini değiştirmez", () => {
    const girdi: AnyCheck[] = [mkCheck({ pass: false }), mkCheck()];
    const kopya = [...girdi];
    blockingFailures(girdi);
    expect(girdi).toEqual(kopya);
  });
});

describe("parseHoistLoadClass", () => {
  it("standart biçimi ayrıştırır", () => {
    expect(parseHoistLoadClass("H3/B4")).toEqual({ hoistClass: "H3", loadGroup: "B4" });
    expect(parseHoistLoadClass("H1/B1")).toEqual({ hoistClass: "H1", loadGroup: "B1" });
    expect(parseHoistLoadClass("H4/B6")).toEqual({ hoistClass: "H4", loadGroup: "B6" });
  });

  it("küçük harf ve fazladan boşlukları tolere eder", () => {
    expect(parseHoistLoadClass(" h3 / b4 ")).toEqual({ hoistClass: "H3", loadGroup: "B4" });
    expect(parseHoistLoadClass("h3-b4")).toEqual({ hoistClass: "H3", loadGroup: "B4" });
    expect(parseHoistLoadClass("H3 B4")).toEqual({ hoistClass: "H3", loadGroup: "B4" });
  });

  it("parçaların sırası önemli değildir", () => {
    expect(parseHoistLoadClass("B4/H3")).toEqual({ hoistClass: "H3", loadGroup: "B4" });
  });

  it("tek parça verildiğinde diğeri undefined kalır", () => {
    expect(parseHoistLoadClass("H3")).toEqual({ hoistClass: "H3" });
    expect(parseHoistLoadClass("B4")).toEqual({ loadGroup: "B4" });
  });

  it("bozuk veya bilinmeyen girdide alanlar undefined olur", () => {
    expect(parseHoistLoadClass("")).toEqual({});
    expect(parseHoistLoadClass("   ")).toEqual({});
    expect(parseHoistLoadClass("///")).toEqual({});
    expect(parseHoistLoadClass("X9/Y2")).toEqual({});
    expect(parseHoistLoadClass("H9/B9")).toEqual({});
    expect(parseHoistLoadClass("H33/B44")).toEqual({});
    expect(parseHoistLoadClass("belirsiz")).toEqual({});
  });

  it("kısmen geçerli girdide yalnız tanınan parçayı döndürür", () => {
    expect(parseHoistLoadClass("H3/B9")).toEqual({ hoistClass: "H3" });
    expect(parseHoistLoadClass("H9/B4")).toEqual({ loadGroup: "B4" });
  });

  it("aynı türden iki parçada ilk geçerli eşleşme kazanır", () => {
    expect(parseHoistLoadClass("H3/H4")).toEqual({ hoistClass: "H3" });
    expect(parseHoistLoadClass("B2/B5")).toEqual({ loadGroup: "B2" });
  });

  it("çalışma zamanında string olmayan girdide hata atmaz", () => {
    expect(parseHoistLoadClass(undefined as unknown as string)).toEqual({});
    expect(parseHoistLoadClass(null as unknown as string)).toEqual({});
    expect(parseHoistLoadClass(42 as unknown as string)).toEqual({});
  });

  it("dönen nesne yalnız tanınan alanları içerir", () => {
    expect(Object.keys(parseHoistLoadClass("H3"))).toEqual(["hoistClass"]);
    expect(Object.keys(parseHoistLoadClass(""))).toEqual([]);
  });
});

describe("checkDisplay — hesaplanan / izin verilen", () => {
  it("hesaplanan `provided` iken bağıntı olduğu gibi okunur", () => {
    // Gerçekleşen halat emniyet katsayısı (hesap) ≥ gerekli en küçük (sınır)
    const d = checkDisplay(
      mkCheck({ required: 5.6, provided: 4.17, op: ">=", computedSide: "provided" })
    );
    expect(d.computed).toBe(4.17);
    expect(d.limit).toBe(5.6);
    expect(d.operator).toBe("≥");
  });

  it("hesaplanan `required` iken bağıntı TERS çevrilir", () => {
    // Hesaplanan gerilme (talep) ≤ izin verilen gerilme (kapasite)
    const d = checkDisplay(
      mkCheck({ required: 616, provided: 2450, op: ">=", computedSide: "required" })
    );
    expect(d.computed).toBe(616);
    expect(d.limit).toBe(2450);
    // provided ≥ required  ⟺  required ≤ provided
    expect(d.operator).toBe("≤");
  });

  it("bağıntı her iki okumada da aynı gerçeği söyler", () => {
    const c = mkCheck({ required: 616, provided: 2450, op: ">=", computedSide: "required" });
    const d = checkDisplay(c);
    // Gösterilen bağıntı gerçekten sağlanıyor mu?
    expect(d.operator === "≤" ? d.computed <= d.limit! : d.computed >= d.limit!).toBe(c.pass);
  });

  it("aralık kontrolünde hesaplanan daima `provided`", () => {
    const r: RangeCheck = {
      id: "gearbox.ratio",
      label: "Çevrim Oranı Sapması",
      provided: -7.4,
      min: -10,
      max: 5,
      unit: "%",
      op: "range",
      pass: true,
    };
    const d = checkDisplay(r);
    expect(d.computed).toBe(-7.4);
    expect(d.min).toBe(-10);
    expect(d.max).toBe(5);
    expect(d.operator).toBe("…");
  });

  it("eski anlık görüntülerde alan yoksa `provided` varsayılır", () => {
    const eski = { ...mkCheck() } as Partial<Check>;
    delete eski.computedSide;
    expect(checkComputedSide(eski as AnyCheck)).toBe("provided");
  });
});
