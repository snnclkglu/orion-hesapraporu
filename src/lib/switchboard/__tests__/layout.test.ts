// YERLEŞTİRİCİ — pay modeli, en araması, bölme, determinizm, denetçi.
//
// Fikstürler elle yazılmış küçük satırlardır; gerçek 157 sayfalık belge üzerinde
// ne çıktığını `scripts/test-switchboard-layout.ts` gösterir.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { auditLineup, auditPanel } from "../audit";
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
    expect(sonuc.roomSize.heightMm).toBe(1400);
  });

  it("sıkışan iş küçük gövdeye TIKIŞTIRILMAZ", () => {
    // Doluluk payı korunmuyorsa bir üst boya çıkılır; öncelikli gövde 1800'dür.
    const sonuc = computeSwitchboardLayout({ parts: salterler(120) });
    expect(sonuc.roomSize.heightMm).toBeGreaterThanOrEqual(1800);
  });

  it("küçük gövde panoyu BÖLÜYORSA seçilmez", () => {
    // Yükseklikten kazanılan, EN'den iki kat geri verilirdi.
    const sonuc = computeSwitchboardLayout({ parts: salterler(900) });
    const kaynaklar = new Set(sonuc.room.map((p) => p.splitOf ?? p.code));
    expect(kaynaklar.size).toBe(1);
    expect(sonuc.roomSize.heightMm).toBeGreaterThanOrEqual(1800);
  });

  it("kullanıcının verdiği yükseklik EŞİK ARANMADAN uygulanır", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(6),
      settings: { room: { heightMm: 2000 } },
    });
    expect(sonuc.roomSize.heightMm).toBe(2000);
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

describe("iki dizi ayrı çözülür (PANO-2)", () => {
  // Ölçüldü (07.09.2026): sonuç nesnesi ÇÖZÜLMÜŞ yüksekliği tek alanda
  // taşıyordu ve o alana hep ODA dizisinin sonucu yazılıyordu. Yalnız saha
  // panosu olan bir projede ekran ve İMALATÇIYA GİDEN PDF, boş oda dizisinin
  // aramasından dönen 1400 mm'yi basıyordu — hiç var olmayan bir panonun
  // ölçüsünü. Sipariş tablosu doğruydu, özet kutusu yanlıştı: belge kendi
  // içinde çelişiyordu.

  it("yalnız saha panosu varsa ODA ölçÜSÜ null'dur", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(6, "TB1"),
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    expect(sonuc.room).toHaveLength(0);
    expect(sonuc.field.length).toBeGreaterThan(0);

    // Boş diziye ölçü ATFEDİLMEZ.
    expect(sonuc.roomSize.panelCount).toBe(0);
    expect(sonuc.roomSize.heightMm).toBeNull();
    expect(sonuc.roomSize.depthMm).toBeNull();

    // Saha dizisi KENDİ ölçüsünü taşır ve panolarla tutarlıdır.
    expect(sonuc.fieldSize.panelCount).toBe(sonuc.field.length);
    expect(sonuc.fieldSize.heightMm).toBe(sonuc.field[0].heightMm);
    expect(sonuc.fieldSize.depthMm).toBe(sonuc.field[0].depthMm);
  });

  it("ortak derinlik dizinin MAKSİMUMUDUR ve her panoya işlenir", () => {
    // Bir panoya derin bir cihaz, ötekine sığ bir cihaz; ikisi de aynı
    // derinlikte gövde ister (PANO-2).
    const surucu = parca({
      location: "P1",
      device: "T1",
      deviceTag: "=T1+P1-T1",
      designation: "SINAMICS S120 MOTOR MODULE",
      typeNo: "6SL3120-1TE23-0AC0",
      supplier: "Siemens",
      partNo: "SIE.6SL3120",
    });
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(3, "P2"), surucu],
      models: [
        {
            lookupKey: "SIEMENS|6SL31201TE230AC0",
            supplier: "Siemens",
            typeNo: "6SL3120-1TE23-0AC0",
            widthMm: 50,
            heightMm: 380,
            depthMm: 270,
            moduleUnits: null,
            mountType: "plaka" as const,
            zone: "guc" as const,
            clearanceTopMm: null,
            clearanceBottomMm: null,
            heatW: null,
            source: "katalog" as const,
            note: "",
        },
      ],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    expect(sonuc.room.length).toBe(2);
    const derinlikler = new Set(sonuc.room.map((p) => p.depthMm));
    expect(derinlikler.size).toBe(1);
    // 270 mm cihaz + 40 mm arka pay = 310 → ızgarada 400.
    expect(sonuc.roomSize.depthMm).toBe(400);
    expect([...derinlikler][0]).toBe(400);
  });

  it("iki dizi FARKLI yükseklik/derinlik çözebilir", () => {
    // Oda dizisinde derin bir sürücü, saha dizisinde yalnız birkaç şalter.
    const surucu = parca({
      location: "LVD1",
      device: "T1",
      deviceTag: "=T1+LVD1-T1",
      designation: "SINAMICS S120 MOTOR MODULE",
      typeNo: "6SL3120-1TE23-0AC0",
      supplier: "Siemens",
      partNo: "SIE.6SL3120",
    });
    const sonuc = computeSwitchboardLayout({
      parts: [surucu, ...salterler(4, "TB1")],
      models: [
        {
            lookupKey: "SIEMENS|6SL31201TE230AC0",
            supplier: "Siemens",
            typeNo: "6SL3120-1TE23-0AC0",
            widthMm: 50,
            heightMm: 380,
            depthMm: 270,
            moduleUnits: null,
            mountType: "plaka" as const,
            zone: "guc" as const,
            clearanceTopMm: null,
            clearanceBottomMm: null,
            heatW: null,
            source: "katalog" as const,
            note: "",
        },
      ],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    expect(sonuc.roomSize.panelCount).toBe(1);
    expect(sonuc.fieldSize.panelCount).toBe(1);
    // Oda derin cihaz yüzünden 400; saha yalnız şalter taşıyor ve daha sığ.
    expect(sonuc.roomSize.depthMm).toBe(400);
    expect(sonuc.fieldSize.depthMm).toBeLessThan(sonuc.roomSize.depthMm!);
  });

  it("KULLANICI AYARI ezilmez — `settings` istek, `roomSize` sonuçtur", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(4),
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });
    // Kullanıcı bir şey seçmedi: istek boş kalır.
    expect(sonuc.settings.room.heightMm).toBeNull();
    expect(sonuc.settings.room.depthMm).toBeNull();
    expect(sonuc.settings.field.heightMm).toBeNull();
    expect(sonuc.settings.field.depthMm).toBeNull();
    // Sonuç ise dolu.
    expect(sonuc.roomSize.heightMm).not.toBeNull();
    expect(sonuc.roomSize.depthMm).not.toBeNull();
  });
});

describe("pano başına kilit dizinin TABANIDIR (PANO-2)", () => {
  // Ölçüldü (07.09.2026): `savePanel` yükseklik/derinlik kilidini yazıyor,
  // `loadPanelOverrides` okuyor, `PanelLayout`e kopyalanıyordu — ama çözücü
  // yalnız `widthLocked`e bakıyor ve derinliği koşulsuz ortak derinlikle
  // eziyordu. Ekranda "kilitledim" diyen bir seçim sessizce yok sayılıyordu.

  function pano(code: string, over: Record<string, unknown>) {
    return {
      code,
      name: code,
      kind: null,
      widthMm: null,
      heightMm: null,
      depthMm: null,
      baseMm: null,
      doorConfig: null,
      orderIndex: null,
      widthLocked: false,
      heightLocked: false,
      depthLocked: false,
      note: "",
      ...over,
    };
  }

  it("kilitli DERİNLİK ortak derinliği yukarı çeker", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(3, "P1"), ...salterler(3, "P2")],
      models: [],
      placementOverrides: [],
      panelOverrides: [pano("P1", { depthMm: 600, depthLocked: true })],
      settings: resolveSettings({}),
    });
    // Yalnız şalter taşıyan bir dizi normalde çok daha sığ çıkar.
    expect(sonuc.roomSize.depthMm).toBe(600);
    // ORTAK ölçüdür: kilitlenmeyen pano da 600 olur (PANO-2).
    for (const p of sonuc.room) expect(p.depthMm).toBe(600);
  });

  it("kilitli YÜKSEKLİK dizinin tabanı olur", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [...salterler(3, "P1"), ...salterler(3, "P2")],
      models: [],
      placementOverrides: [],
      panelOverrides: [pano("P2", { heightMm: 2000, heightLocked: true })],
      settings: resolveSettings({}),
    });
    expect(sonuc.roomSize.heightMm).toBe(2000);
    for (const p of sonuc.room) expect(p.heightMm).toBe(2000);
  });

  it("kilit YOKSA arama serbesttir", () => {
    const sonuc = computeSwitchboardLayout({
      parts: salterler(3, "P1"),
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });
    expect(sonuc.roomSize.heightMm).toBeLessThan(2000);
  });
});

describe("bölge sırası çıktıda korunur (PANO-7)", () => {
  // Denetim (07.09.2026): bölge sırasının ÇIKTIDA gerçekten
  // giriş → güç → motor → kumanda → klemens olduğu hiç sınanmıyordu. Sıra bir
  // estetik tercih değil: kalın besleme iletkeni en kısa yolu görsün diye
  // güç girişin hemen altında, klemens ise kablo girişine yakın en altta durur.

  function aygit(konum: string, kod: string, over: Partial<ElectricalPart>) {
    return parca({ location: konum, device: kod, deviceTag: `=T1+${konum}-${kod}`, ...over });
  }

  const karisik = [
    // Bilerek TERS sırada verildi: sıralamayı yerleştirici kurmalı.
    aygit("P1", "X1", {
      designation: "Feed-through terminal block UT 2,5",
      typeNo: "UT 2,5",
      supplier: "Phoenix Contact",
      partNo: "PXC.3044076",
      qty: 10,
    }),
    aygit("P1", "K1", {
      designation: "CONTACTOR AC-3 4KW/400V 1NO+1NC AC230V",
      typeNo: "3RT2023-1AP00",
      supplier: "Siemens",
      partNo: "SIE.3RT2023",
    }),
    aygit("P1", "A1", {
      designation: "POWER SUPPLY 24VDC 10A",
      typeNo: "6EP1334-3BA10",
      supplier: "Siemens",
      partNo: "SIE.6EP1334",
    }),
    aygit("P1", "Q1", {
      designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
      typeNo: "5SL6310-7",
      supplier: "Siemens",
      partNo: "SIE.5SL6310-7",
    }),
  ];

  const sonuc = computeSwitchboardLayout({
    parts: karisik,
    models: [],
    placementOverrides: [],
    panelOverrides: [],
    settings: resolveSettings({}),
  });
  const pano = sonuc.room[0];

  it("raylar bölge sırasına göre YUKARIDAN AŞAĞIYA dizilir", () => {
    const sira = ["giris", "guc", "motor", "kumanda", "klemens"];
    const gorulen = pano.rails.map((r) => r.zone);
    // Aynı bölgenin ardışık rayları teke indirilir.
    const benzersiz = gorulen.filter((z, i) => i === 0 || gorulen[i - 1] !== z);
    const beklenenSira = benzersiz.map((z) => sira.indexOf(z));
    expect(beklenenSira).toEqual([...beklenenSira].sort((a, b) => a - b));
    // Şalter giriş bandında, klemens en altta.
    expect(benzersiz[0]).toBe("giris");
    expect(benzersiz[benzersiz.length - 1]).toBe("klemens");
  });

  it("bölge değişince YENİ RAY açılır — iki bölge aynı raya karışmaz", () => {
    for (const ray of pano.rails) {
      const oRayin = pano.placements.filter((y) => y.railIndex === ray.index);
      const bolgeler = new Set(oRayin.map((y) => y.zone));
      expect(bolgeler.size).toBeLessThanOrEqual(1);
    }
  });

  it("y koordinatı bölge sırasıyla ARTAR", () => {
    const sira = ["giris", "guc", "motor", "kumanda", "klemens"];
    const enUst = new Map<string, number>();
    for (const y of pano.placements) {
      const m = enUst.get(y.zone);
      if (m === undefined || y.yMm < m) enUst.set(y.zone, y.yMm);
    }
    const noktalar = [...enUst.entries()]
      .sort((a, b) => sira.indexOf(a[0]) - sira.indexOf(b[0]))
      .map(([, y]) => y);
    expect(noktalar).toEqual([...noktalar].sort((a, b) => a - b));
  });
});

describe("bölme ve harfleme (PANO-10)", () => {
  // Denetim (07.09.2026): tek bölgede orta noktadan bölme — 0019'un LVD10
  // durumu, dokümanın en çok vurguladığı senaryo — ve `LVD1`/`LVD10`
  // en-uzun-kaynak eşleşmesi hiç sınanmıyordu. İkincisi ince ve kırılgan bir
  // mantık: `LVD1` ile `LVD10` aynı ön eki paylaşır.

  /**
   * TEK BÖLGEDEN oluşan büyük bir pano — 0019'un LVD10'unun şekli.
   *
   * Gerçek belgede bu bir dev şerit DEĞİL, onlarca ayrı klemens etiketidir
   * (`-X1`, `-X2`, …). Bölme aygıt LİSTESİNİ böler; tek bir aygıtı ikiye
   * ayırmaz. Fikstür bu yüzden çok etiketli kurulur.
   */
  function klemensBankasi(konum: string, etiket: number, adet: number): ElectricalPart[] {
    return Array.from({ length: etiket }, (_, i) =>
      parca({
        location: konum,
        device: `X${i + 1}`,
        deviceTag: `=T1+${konum}-X${i + 1}`,
        designation: "Feed-through terminal block UT 2,5",
        typeNo: "UT 2,5",
        supplier: "Phoenix Contact",
        partNo: "PXC.3044076",
        qty: adet,
      })
    );
  }

  it("TEK BÖLGEDEN oluşan dev bir pano yine bölünür", () => {
    // 60 etiket × 200 klemens = 12.000 klemens ≈ 62 metre şerit: en büyük
    // gövdeye bile sığmaz ve bölgeler arasında kesilecek bir sınır YOKTUR
    // (hepsi `klemens` bandında) — bölme bölge İÇİNDEN yapılmalı.
    const sonuc = computeSwitchboardLayout({
      parts: klemensBankasi("LVD10", 60, 200),
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    expect(sonuc.room.length).toBeGreaterThan(1);
    for (const p of sonuc.room) expect(p.splitOf).toBe("LVD10");
    // Sessizce düşen aygıt YOK.
    const eksik = sonuc.unplaced.filter((u) => u.reason === "sigmadi");
    expect(eksik).toHaveLength(0);
    // Dizi geneli eksiksizlik denetimi geçmeli (PANO-11).
    const dizi = sonuc.audits.find((a) => a.code === "Dizi geneli");
    expect(dizi?.result.ok).toBe(true);
  });

  it("bölünen göz SIRAYLA harflenir ve adı kaynağı gösterir", () => {
    const sonuc = computeSwitchboardLayout({
      parts: klemensBankasi("LVD10", 60, 200),
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });
    const kodlar = sonuc.room.map((p) => p.code);
    expect(kodlar[0]).toBe("LVD10-A");
    expect(kodlar[1]).toBe("LVD10-B");
    expect(sonuc.room[0].name).toContain("LVD10");
  });

  it("LVD1 ile LVD10 KARIŞMAZ — en uzun kaynak eşleşmesi", () => {
    // İki pano birden bölünürse harfleme kaynağı doğru bulmalı: `LVD10-A`nın
    // kaynağı `LVD1` değil `LVD10`dur.
    const sonuc = computeSwitchboardLayout({
      parts: [...klemensBankasi("LVD1", 60, 200), ...klemensBankasi("LVD10", 60, 200)],
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    const lvd1 = sonuc.room.filter((p) => p.splitOf === "LVD1");
    const lvd10 = sonuc.room.filter((p) => p.splitOf === "LVD10");
    expect(lvd1.length).toBeGreaterThan(1);
    expect(lvd10.length).toBeGreaterThan(1);
    // Hiçbir LVD10 gözü LVD1'in çocuğu sayılmamalı.
    for (const p of lvd10) expect(p.code.startsWith("LVD10-")).toBe(true);
    for (const p of lvd1) expect(p.code.startsWith("LVD1-")).toBe(true);
    expect(lvd1.some((p) => p.code.startsWith("LVD10"))).toBe(false);
  });

  it("kilitli en BÖLÜNMEZ — kullanıcı kararı ezilmez", () => {
    const sonuc = computeSwitchboardLayout({
      parts: klemensBankasi("P1", 60, 200),
      models: [],
      placementOverrides: [],
      panelOverrides: [
        {
          code: "P1",
          name: "P1",
          kind: null,
          widthMm: 400,
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
      settings: resolveSettings({}),
    });
    expect(sonuc.room).toHaveLength(1);
    expect(sonuc.room[0].widthMm).toBe(400);
    // Sığmayan uyarıyla GÖRÜNÜR olur, sessizce bölünmez.
    expect(sonuc.room[0].warnings.length).toBeGreaterThan(0);
  });
});

describe("denetçi GERÇEKTEN hata yakalıyor mu (PANO-11)", () => {
  // Denetim (07.09.2026): sekiz denetimden yalnız üçü fiilen sınanıyordu;
  // `kanal`, `yuz-ayrimi`, `derinlik`, `ray-dizilimi`, `negatif-koordinat`
  // için NEGATİF VAKA yoktu — yani bir hatayı gerçekten yakalayıp
  // yakalamadıkları bilinmiyordu. Denetçinin değeri tam olarak budur:
  // yerleştiricinin sessiz bir işaret hatası ancak burada görünür.

  const temel = computeSwitchboardLayout({
    parts: salterler(6),
    models: [],
    placementOverrides: [],
    panelOverrides: [],
    settings: resolveSettings({}),
  });
  const saglam = temel.room[0];
  const ayar = temel.settings;

  function boz(degistir: (p: typeof saglam) => typeof saglam) {
    return auditPanel(degistir(JSON.parse(JSON.stringify(saglam))), ayar);
  }

  function kontrol(sonuc: ReturnType<typeof auditPanel>, anahtar: string) {
    const c = sonuc.checks.find((x) => x.key === anahtar);
    expect(c, `denetim bulunamadı: ${anahtar}`).toBeDefined();
    return c!;
  }

  it("sağlam yerleşim BÜTÜN denetimleri geçer", () => {
    const d = auditPanel(saglam, ayar);
    expect(d.ok).toBe(true);
    // Sekiz denetimin yedisi `expected` olmadan koşar.
    expect(d.checks.length).toBeGreaterThanOrEqual(7);
  });

  it("negatif koordinat YAKALANIR", () => {
    const d = boz((p) => {
      p.placements[0].xMm = -5;
      return p;
    });
    expect(kontrol(d, "negatif-koordinat").ok).toBe(false);
    expect(d.ok).toBe(false);
  });

  it("çakışma YAKALANIR", () => {
    const d = boz((p) => {
      // İkinci cihazı birincinin üstüne oturt.
      p.placements[1].xMm = p.placements[0].xMm;
      p.placements[1].yMm = p.placements[0].yMm;
      return p;
    });
    expect(kontrol(d, "cakisma").ok).toBe(false);
  });

  it("kanal payının yenmesi YAKALANIR", () => {
    const d = boz((p) => {
      p.rails[0].ductMm = 0;
      return p;
    });
    expect(kontrol(d, "kanal").ok).toBe(false);
  });

  it("yüz ayrımının bozulması YAKALANIR", () => {
    const d = boz((p) => {
      p.placements[0].mountType = "kapak";
      return p;
    });
    expect(kontrol(d, "yuz-ayrimi").ok).toBe(false);
  });

  it("gövdeden derin cihaz YAKALANIR", () => {
    const d = boz((p) => {
      p.placements[0].depthMm = p.depthMm + 100;
      return p;
    });
    expect(kontrol(d, "derinlik").ok).toBe(false);
  });

  it("ray dizilimindeki binme YAKALANIR", () => {
    const d = boz((p) => {
      if (p.rails.length > 1) p.rails[1].yMm = p.rails[0].yMm;
      else p.rails[0].yMm = -10;
      return p;
    });
    expect(kontrol(d, "ray-dizilimi").ok).toBe(false);
  });

  it("plakaya sığmama YAKALANIR", () => {
    const d = boz((p) => {
      p.rails[0].heightMm = 5000;
      return p;
    });
    expect(kontrol(d, "plaka-yuksekligi").ok).toBe(false);
  });

  it("auditLineup DİZİ GENELİ satırını ekler ve eksik aygıtı yakalar", () => {
    const beklenen = temel.room.flatMap((p) =>
      p.placements.map((y) => ({
        key: y.deviceKey,
        mountType: y.mountType,
      }))
    ) as never[];

    // Sağlam: dizi geneli geçer.
    const iyi = auditLineup(temel.room, ayar, beklenen);
    const dizi = iyi.find((a) => a.code === "Dizi geneli");
    expect(dizi).toBeDefined();
    expect(dizi!.result.ok).toBe(true);

    // Bir aygıt sessizce düşerse yakalanır.
    const eksikli = auditLineup(temel.room, ayar, [
      ...beklenen,
      { key: "HAYALET|AYGIT", mountType: "din" } as never,
    ]);
    const dizi2 = eksikli.find((a) => a.code === "Dizi geneli");
    expect(dizi2!.result.ok).toBe(false);
    expect(dizi2!.result.checks.find((c) => c.key === "eksiksizlik")!.detail).toContain("eksik 1");
  });

  it("beklenen verilmezse DİZİ GENELİ satırı EKLENMEZ", () => {
    const d = auditLineup(temel.room, ayar);
    expect(d.some((a) => a.code === "Dizi geneli")).toBe(false);
  });
});

describe("parmak izi girdinin TAMAMINI kapsar (PANO-14)", () => {
  // Plan saklanmadığı için "neyi onayladım" sorusunun tek cevabı parmak izidir.
  // Denetim (07.09.2026): izin YALNIZ malzeme satırı değişince değiştiği
  // sınanıyordu; ayar, pano kararı ve aygıt düzeltmesi sınanmıyordu. Biri
  // kapsam dışında kalsaydı, kullanıcı bir ölçüyü değiştirip onayı taze
  // sanarak eski bir belgeye göre sipariş verirdi.

  const temelGirdi = {
    parts: salterler(4),
    models: [],
    placementOverrides: [],
    panelOverrides: [],
    settings: resolveSettings({}),
  };
  const temel = computeSwitchboardLayout(temelGirdi).fingerprint;

  it("malzeme satırı değişince iz DEĞİŞİR", () => {
    const f = computeSwitchboardLayout({ ...temelGirdi, parts: salterler(5) }).fingerprint;
    expect(f).not.toBe(temel);
  });

  it("AYAR değişince iz DEĞİŞİR", () => {
    const f = computeSwitchboardLayout({
      ...temelGirdi,
      settings: resolveSettings({ room: { baseMm: 300 } }),
    }).fingerprint;
    expect(f).not.toBe(temel);
  });

  it("PANO KARARI değişince iz DEĞİŞİR", () => {
    const f = computeSwitchboardLayout({
      ...temelGirdi,
      panelOverrides: [
        {
          code: "P1",
          name: "P1",
          kind: null,
          widthMm: 800,
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
    }).fingerprint;
    expect(f).not.toBe(temel);
  });

  it("AYGIT DÜZELTMESİ değişince iz DEĞİŞİR", () => {
    const f = computeSwitchboardLayout({
      ...temelGirdi,
      placementOverrides: [
        {
          deviceKey: "T1|P1|F1",
          panelCode: null,
          mountType: null,
          zone: null,
          railIndex: null,
          orderInRail: null,
          widthMm: 60,
          heightMm: null,
          depthMm: null,
          pinned: false,
          note: "",
        },
      ],
    }).fingerprint;
    expect(f).not.toBe(temel);
  });

  it("aynı girdi AYNI izi verir — sıra bağımsızdır", () => {
    const ters = computeSwitchboardLayout({
      ...temelGirdi,
      parts: [...salterler(4)].reverse(),
    }).fingerprint;
    expect(ters).toBe(temel);
  });
});

describe("boş göz sipariş edilmez", () => {
  // Ölçüldü (0019, 08.09.2026): bölme aygıt listesini ikiye ayırıyor ama bir
  // yarının bütün aygıtları PANO DIŞI (motor, enkoder, limit şalteri)
  // çıkabiliyordu. Geriye plakasında, kapağında ve gövdesinde hiçbir şey
  // olmayan bir gövde kalıyordu; gerçek belgede DÖRT böyle göz vardı ve her
  // biri 400 x 2000 x 600 mm'lik bir pano olarak imalatçıya gidiyordu.
  // Düzeltmeden sonra 26 göz 22'ye, toplam en 13.400 mm'den 11.800 mm'ye indi.

  function saha(konum: string, kod: string): ElectricalPart {
    return parca({
      location: konum,
      device: kod,
      deviceTag: `=T1+${konum}-${kod}`,
      designation: "ASYNCHRONOUS MOTOR 15KW",
      typeNo: "1LE1001",
      supplier: "Siemens",
      partNo: "SIE.1LE1001",
    });
  }

  it("yalnız saha aygıtı taşıyan konum PANO AÇMAZ", () => {
    const sonuc = computeSwitchboardLayout({
      parts: [saha("P9", "M1"), saha("P9", "M2")],
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });
    expect(sonuc.room).toHaveLength(0);
    // AYGITLAR KAYBOLMAZ: ya kuyrukta ya "pano sayılmayan konum" listesinde
    // görünürler. Hangi yoldan göründüğü bir uygulama ayrıntısıdır; görünmesi
    // ise şarttır (PANO-10: sessizce düşmez).
    const kuyrukta = sonuc.unplaced.filter((u) => u.device.panelCode === "P9").length;
    const haricte = sonuc.excluded
      .filter((e) => e.code === "P9")
      .reduce((t, e) => t + e.devices, 0);
    expect(kuyrukta + haricte).toBe(2);
  });

  it("KAPAK cihazı taşıyan pano boş SAYILMAZ", () => {
    // Plakası boş ama kapağında buton olan bir pano gerçek bir panodur
    // (0019'un CB1'i böyledir: sekiz kapak cihazı, sıfır plaka cihazı).
    const buton = parca({
      location: "CB1",
      device: "S1",
      deviceTag: "=T1+CB1-S1",
      designation: "Harmony XB4 Metal - Red pushbutton",
      typeNo: "XB4BA42",
      supplier: "Schneider Electric",
      partNo: "SE.XB4BA42",
    });
    const sonuc = computeSwitchboardLayout({
      parts: [buton],
      models: [],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });
    expect(sonuc.room).toHaveLength(1);
    expect(sonuc.room[0].placements).toHaveLength(0);
    expect(sonuc.room[0].doorPlacements.length).toBeGreaterThan(0);
  });

  it("bölünen dizide boş göz KALMAZ", () => {
    // Üç ağır plaka cihazı + saha aygıtları: bölme sırasında bir yarı yalnız
    // saha aygıtı alabilir ve o göz düşmelidir.
    const surucu = (kod: string) =>
      parca({
        location: "LVD9",
        device: kod,
        deviceTag: `=T1+LVD9-${kod}`,
        designation: "SINAMICS S120 MOTOR MODULE",
        typeNo: "6SL3320-1TE37-5AA3",
        supplier: "Siemens",
        partNo: "SIE.6SL3320",
      });
    const sonuc = computeSwitchboardLayout({
      parts: [surucu("T1"), surucu("T2"), surucu("T3"), saha("LVD9", "M1"), saha("LVD9", "M2")],
      models: [
        {
          lookupKey: "SIEMENS|6SL33201TE375AA3",
          supplier: "Siemens",
          typeNo: "6SL3320-1TE37-5AA3",
          widthMm: 503,
          heightMm: 1475,
          depthMm: 547,
          moduleUnits: null,
          mountType: "plaka" as const,
          zone: "guc" as const,
          clearanceTopMm: null,
          clearanceBottomMm: null,
          heatW: null,
          source: "katalog" as const,
          note: "",
        },
      ],
      placementOverrides: [],
      panelOverrides: [],
      settings: resolveSettings({}),
    });

    for (const p of sonuc.room) {
      const dolu =
        p.placements.length > 0 || p.doorPlacements.length > 0 || p.bodyDevices.length > 0;
      expect(dolu, `boş göz üretildi: ${p.code}`).toBe(true);
    }
  });
});

describe("sabitleme SIRAYI korur, koordinatı değil (PANO-23)", () => {
  // Şemada bir aygıtı taşımak onu o KOMŞULUĞA taşımaktır. Koordinat her
  // yerleştirmede yeniden hesaplanır: komşu bir cihazın eni değişince bu
  // cihazın yeri de değişmelidir. Donmuş bir koordinat bir sonraki turda
  // çakışma üretirdi — denetçi de onu yakalardı.

  function duzeltme(deviceKey: string, order: number) {
    return {
      deviceKey,
      panelCode: null,
      mountType: null,
      zone: null,
      railIndex: 0,
      orderInRail: order,
      widthMm: null,
      heightMm: null,
      depthMm: null,
      pinned: true,
      note: "",
    };
  }

  function coz(overrides: ReturnType<typeof duzeltme>[]) {
    return computeSwitchboardLayout({
      parts: salterler(6),
      models: [],
      placementOverrides: overrides,
      panelOverrides: [],
      settings: resolveSettings({}),
    });
  }

  it("düzeltme yoksa sıra doğal koddur", () => {
    const p = coz([]).room[0].placements;
    expect(p.map((x) => x.label)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
  });

  it("sabitlenen aygıt İSTEDİĞİ sıraya oturur", () => {
    // F6'yı başa al.
    const p = coz([duzeltme("T1|P1|F6", 0)]).room[0].placements;
    expect(p[0].label).toBe("F6");
    // Gerisi doğal sırasını korur.
    expect(p.slice(1).map((x) => x.label)).toEqual(["F1", "F2", "F3", "F4", "F5"]);
  });

  it("iki aygıt sabitlenebilir ve ikisi de yerine oturur", () => {
    const p = coz([duzeltme("T1|P1|F6", 0), duzeltme("T1|P1|F5", 1)]).room[0].placements;
    expect(p[0].label).toBe("F6");
    expect(p[1].label).toBe("F5");
  });

  it("sabitlenen aygıt ROZET taşır — ekran onu gösterebilsin", () => {
    const p = coz([duzeltme("T1|P1|F6", 0)]).room[0].placements;
    expect(p.find((x) => x.label === "F6")!.pinned).toBe(true);
    expect(p.find((x) => x.label === "F1")!.pinned).toBe(false);
  });

  it("KOORDİNAT DONMAZ: komşunun eni değişince sabitlenen de kayar", () => {
    const dar = coz([duzeltme("T1|P1|F6", 1)]).room[0].placements;
    const darX = dar.find((x) => x.label === "F6")!.xMm;

    // İlk cihaza elle daha geniş bir ölçü ver; sabitlenen aygıt SAĞA kaymalı.
    const genis = computeSwitchboardLayout({
      parts: salterler(6),
      models: [],
      placementOverrides: [
        duzeltme("T1|P1|F6", 1),
        {
          deviceKey: "T1|P1|F1",
          panelCode: null,
          mountType: null,
          zone: null,
          railIndex: null,
          orderInRail: null,
          widthMm: 120,
          heightMm: null,
          depthMm: null,
          pinned: false,
          note: "",
        },
      ],
      panelOverrides: [],
      settings: resolveSettings({}),
    }).room[0].placements;
    const genisX = genis.find((x) => x.label === "F6")!.xMm;

    expect(genisX).toBeGreaterThan(darX);
    // Sıra yine korunmuş olmalı: F6 ikinci sırada.
    expect(genis[1].label).toBe("F6");
  });

  it("sabitleme DETERMİNİSTİKTİR", () => {
    const a = coz([duzeltme("T1|P1|F4", 0), duzeltme("T1|P1|F2", 0)]);
    const b = coz([duzeltme("T1|P1|F4", 0), duzeltme("T1|P1|F2", 0)]);
    expect(JSON.stringify(a.room)).toBe(JSON.stringify(b.room));
  });
});

