// YERLEŞTİRİCİ — pay modeli, en araması, bölme, determinizm, denetçi.
//
// Fikstürler elle yazılmış küçük satırlardır; gerçek 157 sayfalık belge üzerinde
// ne çıktığını `scripts/test-switchboard-layout.ts` gösterir.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { auditPanel } from "../audit";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import { deviceKeyOf, naturalCompare } from "../panels";
import { plateWidthMm, railCapacityMm, sideDuctCount } from "../sizes";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+P1-F1",
    installation: "T1",
    location: "P1",
    device: "F1",
    qty: 1,
    designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
    typeNo: "5SL6310-7",
    supplier: "Siemens",
    partNo: "SIE.5SL6310-7",
    page: 145,
    ...over,
  };
}

function salterler(n: number, konum = "P1"): ElectricalPart[] {
  return Array.from({ length: n }, (_, i) =>
    parca({ location: konum, device: `F${i + 1}`, deviceTag: `=T1+${konum}-F${i + 1}` })
  );
}

describe("aygıt anahtarı", () => {
  it("tesis|konum|aygıt biçimindedir", () => {
    expect(deviceKeyOf({ installation: "185T", location: "LVD01", device: "F31" })).toBe(
      "185T|LVD01|F31"
    );
  });

  it("aygıt parçası boşsa anahtar ÜRETİLMEZ", () => {
    // Yarısı doğru bir ayrıştırma, düzeltmeyi yanlış aygıta yapıştırırdı.
    expect(deviceKeyOf({ installation: "185T", location: "LVD01", device: "" })).toBeNull();
  });

  it("yazım farkları anahtarı değiştirmez", () => {
    expect(deviceKeyOf({ installation: "185T", location: "lvd 01", device: "f-31" })).toBe(
      deviceKeyOf({ installation: "185T", location: "LVD01", device: "F31" })
    );
  });
});

describe("doğal sıralama", () => {
  it("F2, F10'dan önce gelir", () => {
    expect(["F10", "F2", "F1"].sort(naturalCompare)).toEqual(["F1", "F2", "F10"]);
  });
});

describe("pay modeli", () => {
  it("kenar payı İKİ YÖNDE düşülür", () => {
    const s = resolveSettings();
    // 800 gövde → plaka 740 → iki dikey kanal (2×40) → kenar payı 2×25
    expect(plateWidthMm(800, s)).toBe(740);
    expect(sideDuctCount(800, s)).toBe(2);
    expect(railCapacityMm(800, s)).toBe(740 - 2 * 40 - 2 * 25);
  });

  it("dar gövdede dikey kanal TEK tanedir", () => {
    // 400 gövdede iki kanal raya 170 mm bırakıyordu — panonun yarısı.
    const s = resolveSettings();
    expect(sideDuctCount(400, s)).toBe(1);
    expect(railCapacityMm(400, s)).toBe(340 - 40 - 2 * 25);
  });

  it("hiçbir cihaz ray kapasitesini aşmaz", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(40) });
    const pano = sonuc.room[0];
    const kapasite = railCapacityMm(pano.widthMm, sonuc.settings);
    for (const y of pano.placements) {
      expect(y.xMm + y.widthMm).toBeLessThanOrEqual(kapasite + 0.01);
    }
  });
});

describe("yükseklik seçimi", () => {
  it("küçük işte GEREKSİZ BÜYÜK gövde seçilmez", () => {
    // Kullanıcı kararı (06.09.2026): on şalterlik bir iş 1800'lük gövde
    // istemez; 1400 rahatça yetiyorsa 1400 alınır.
    const sonuc = computeSwitchboardLayout({ parts: salterler(6) });
    expect(sonuc.settings.heightMm).toBe(1400);
  });

  it("sıkışan iş küçük gövdeye TIKIŞTIRILMAZ", () => {
    // Doluluk payı korunmuyorsa bir üst boya çıkılır; öncelikli gövde 1800'dür.
    const sonuc = computeSwitchboardLayout({ parts: salterler(120) });
    expect(sonuc.settings.heightMm).toBeGreaterThanOrEqual(1800);
  });

  it("küçük gövde panoyu BÖLÜYORSA seçilmez", () => {
    // Yükseklikten kazanılan, EN'den iki kat geri verilirdi.
    const sonuc = computeSwitchboardLayout({ parts: salterler(900) });
    const kaynaklar = new Set(sonuc.room.map((p) => p.splitOf ?? p.code));
    expect(kaynaklar.size).toBe(1);
    expect(sonuc.settings.heightMm).toBeGreaterThanOrEqual(1800);
  });

  it("kullanıcının verdiği yükseklik EŞİK ARANMADAN uygulanır", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(6),
      settings: { heightMm: 2000 },
    });
    expect(sonuc.settings.heightMm).toBe(2000);
  });
});

describe("en araması", () => {
  it("az cihazda EN KÜÇÜK gövdeyi seçer", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(3) });
    expect(sonuc.room[0].widthMm).toBe(400);
  });

  it("cihaz arttıkça gövde büyür", () => {
    const kucuk = computeSwitchboardLayout({ parts: salterler(4) }).room[0].widthMm;
    const buyuk = computeSwitchboardLayout({ parts: salterler(200) }).room[0].widthMm;
    expect(buyuk).toBeGreaterThan(kucuk);
  });

  it("kullanıcı enini kilitlediyse arama yapılmaz", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(3),
      panelOverrides: [
        {
          code: "P1",
          name: "",
          kind: null,
          widthMm: 1000,
          heightMm: null,
          depthMm: null,
          baseMm: null,
          doorConfig: null,
          orderIndex: null,
          widthLocked: true,
          heightLocked: false,
          depthLocked: false,
          note: "",
        },
      ],
    });
    expect(sonuc.room[0].widthMm).toBe(1000);
    expect(sonuc.room[0].widthLocked).toBe(true);
  });
});

describe("ölçüsü bilinmeyen cihaz", () => {
  it("SIFIR sayılmaz; yerleşmez ve sebebiyle kuyruğa girer", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [
        parca({
          device: "T1",
          deviceTag: "=T1+P1-T1",
          designation: "SINAMICS S120 MOTOR MODULE",
          typeNo: "6SL3120-1TE23-0AC0",
          supplier: "Siemens",
          partNo: "SIE.6SL3120",
        }),
        ...salterler(3),
      ],
    });
    const olcusuz = sonuc.unplaced.filter((u) => u.reason === "olcusuz");
    expect(olcusuz).toHaveLength(1);
    expect(olcusuz[0].device.typeNo).toBe("6SL3120-1TE23-0AC0");
    // Ve pano bunu SÖYLER: eksik hesaplanmış bir gövdeyi sipariş ettirmemek için.
    expect(sonuc.room[0].warnings.join(" ")).toContain("ölçüsü bilinmiyor");
  });
});

describe("klemens şeridi", () => {
  it("adet ENDİR ve şerit alt raya devam eder", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [
        parca({
          device: "X1",
          deviceTag: "=T1+P1-X1",
          qty: 300,
          designation: "TERMINAL BLOCK 2,5MM2",
          typeNo: "UT 2,5",
          supplier: "Phoenix Contact",
          partNo: "PXC.3044076",
        }),
      ],
    });
    const pano = sonuc.room[0];
    const dilimler = pano.placements.filter((p) => p.deviceKey.endsWith("|X1"));
    // 300 x 5,2 = 1560 mm; hiçbir ray bu kadar uzun değil.
    expect(dilimler.length).toBeGreaterThan(1);
    expect(dilimler.reduce((t, d) => t + d.unitCount, 0)).toBe(300);
  });

  it("klemens dışındaki ailede adet gövdeyi BÜYÜTMEZ", () => {
    const tek = computeSwitchboardLayout({ parts: [parca({ qty: 1 })] });
    const cok = computeSwitchboardLayout({ parts: [parca({ qty: 12 })] });
    expect(cok.room[0].placements[0].widthMm).toBe(tek.room[0].placements[0].widthMm);
  });
});

describe("saha panoları ayrı dizidir", () => {
  it("TB ön eki saha dizisine düşer", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(3, "LVD01"), ...salterler(3, "TB1")],
    });
    expect(sonuc.room.map((p) => p.code)).toEqual(["LVD01"]);
    expect(sonuc.field.map((p) => p.code)).toEqual(["TB1"]);
  });
});

describe("bölme", () => {
  it("en büyük gövdeye sığmayan pano gözlere ayrılır ve harflenir", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(900) });
    expect(sonuc.room.length).toBeGreaterThan(1);
    for (const p of sonuc.room) {
      expect(p.splitOf).toBe("P1");
      expect(p.code).toMatch(/^P1-[A-Z]$/);
    }
  });
});

describe("determinizm", () => {
  it("aynı girdi iki kez yerleştirilince aynı plan çıkar", () => {
    const girdi = { parts: [...salterler(60), ...salterler(20, "TB1")] };
    const a = computeSwitchboardLayout(girdi);
    const b = computeSwitchboardLayout(girdi);
    expect(JSON.stringify(a.room)).toBe(JSON.stringify(b.room));
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("girdi değişince parmak izi değişir", () => {
    const a = computeSwitchboardLayout({ parts: salterler(5) });
    const b = computeSwitchboardLayout({ parts: salterler(6) });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe("denetçi sonucu ölçer", () => {
  it("sağlam yerleşim bütün denetimlerden geçer", () => {
    const sonuc = computeSwitchboardLayout({ parts: salterler(40) });
    for (const p of [...sonuc.room, ...sonuc.field]) {
      const d = auditPanel(p, sonuc.settings);
      expect(d.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([]);
    }
  });

  it("elle bozulmuş bir yerleşimi YAKALAR", () => {
    // `nesting.ts`in denetçisiyle aynı gerekçe: yerleştiricideki bir işaret
    // hatası sessizdir ve ancak atölyede görünürdü.
    const sonuc = computeSwitchboardLayout({ parts: salterler(10) });
    const pano = sonuc.room[0];
    const bozuk = {
      ...pano,
      placements: pano.placements.map((p, i) => (i === 1 ? { ...p, xMm: 0 } : p)),
    };
    const d = auditPanel(bozuk, sonuc.settings);
    expect(d.ok).toBe(false);
    expect(d.checks.find((c) => c.key === "cakisma")?.ok).toBe(false);
  });

  it("her aygıt tam bir kez yerleşir", () => {
    const parts = salterler(30);
    const sonuc = computeSwitchboardLayout({ parts });
    const anahtarlar = new Set(sonuc.room[0].placements.map((p) => p.deviceKey));
    expect(anahtarlar.size).toBe(30);
  });
});

describe("boş konum pano açmaz", () => {
  it("yerleşecek aygıtı olmayan kod dizide görünmez", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [
        ...salterler(3, "LVD01"),
        parca({
          location: "LVD05",
          device: "M1",
          deviceTag: "=T1+LVD05-M1",
          designation: "ASYNCHRONOUS MOTOR 15KW",
          typeNo: "1LE1001",
          supplier: "Siemens",
          partNo: "SIE.1LE1001",
        }),
      ],
    });
    expect(sonuc.room.map((p) => p.code)).toEqual(["LVD01"]);
    expect(sonuc.excluded.map((e) => e.code)).toContain("LVD05");
  });
});
