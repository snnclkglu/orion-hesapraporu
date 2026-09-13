// KOMŞUYA BAĞLI SABİTLEME (PANO-38) — sıra bir komşuluktur, indeks değil.
//
// Ölçülmüş kusur (0026-01, 12.09.2026): ekran indeksi ÇİZİM sırasından, çözücü
// kendi sırasından sayıyordu; first-fit ikisini ayırınca kullanıcının bir
// şalterin yanına bıraktığı sürücü giriş bandının ortasına düştü ve orada
// yeni bir plaka rayı açıp panoyu taşırdı. Burada üç şey çivilenir:
//
//   1. Bırakılan komşuluk ÇÖZÜMDE aynen görünür.
//   2. Tür sınırı (DIN ↔ plaka) aşılamaz; aşan sabitleme uyarıyla düşer.
//   3. Bölgesi boş aygıt sıralamada öne geçmez (T4).

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { birakmaHedefi } from "@/lib/diagrams/panoLayout";
import { auditLineup } from "../audit";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import type { DeviceModel, PlacementOverride } from "../types";

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
    page: 1,
    ...over,
  };
}

function bagla(deviceKey: string, komsu: string, yon: "once" | "sonra"): PlacementOverride {
  return {
    deviceKey,
    panelCode: null,
    mountType: null,
    zone: null,
    railIndex: null,
    orderInRail: null,
    anchorDeviceKey: komsu,
    anchorSide: yon,
    widthMm: null,
    heightMm: null,
    depthMm: null,
    pinned: true,
    note: "",
  };
}

const salterler = Array.from({ length: 6 }, (_, i) =>
  parca({ device: `F${i + 1}`, deviceTag: `=T1+P1-F${i + 1}` })
);

describe("bırakma hedefi (saf)", () => {
  const sira = ["A", "B", "C", "D"];
  it("sola bırakılan komşunun ÖNÜNE, sağa bırakılan ARKASINA gider", () => {
    expect(birakmaHedefi(sira, "D", "B", true)).toEqual({ komsu: "B", yon: "once" });
    expect(birakmaHedefi(sira, "D", "B", false)).toEqual({ komsu: "B", yon: "sonra" });
  });
  it("zaten bitişikse karar üretmez — gereksiz sabitleme yazılmaz", () => {
    expect(birakmaHedefi(sira, "A", "B", true)).toBeNull();
    expect(birakmaHedefi(sira, "C", "B", false)).toBeNull();
  });
  it("kendi üstüne bırakmak ve tanınmayan komşu karar değildir", () => {
    expect(birakmaHedefi(sira, "A", "A", true)).toBeNull();
    expect(birakmaHedefi(sira, "A", "Z", true)).toBeNull();
  });
});

describe("komşuluk ÇÖZÜMDE korunur", () => {
  const etiketler = (o: PlacementOverride[]) =>
    computeSwitchboardLayout({ parts: salterler, placementOverrides: o }).room[0].placements.map(
      (p) => p.label
    );

  it("F1, F4'ün SONRASINA", () => {
    expect(etiketler([bagla("T1|P1|F1", "T1|P1|F4", "sonra")])).toEqual([
      "F2", "F3", "F4", "F1", "F5", "F6",
    ]);
  });
  it("F6, F1'in ÖNÜNE", () => {
    expect(etiketler([bagla("T1|P1|F6", "T1|P1|F1", "once")])).toEqual([
      "F6", "F1", "F2", "F3", "F4", "F5",
    ]);
  });
  it("zincir: F1 F4'ün sonrasına, F2 F1'in sonrasına", () => {
    expect(
      etiketler([bagla("T1|P1|F1", "T1|P1|F4", "sonra"), bagla("T1|P1|F2", "T1|P1|F1", "sonra")])
    ).toEqual(["F3", "F4", "F1", "F2", "F5", "F6"]);
  });
  it("çözücünün `order` listesi çizimle AYNI sırayı taşır", () => {
    const r = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [bagla("T1|P1|F1", "T1|P1|F4", "sonra")],
    });
    const p = r.room[0];
    expect(p.order.map((k) => k.split("|").pop())).toEqual(["F2", "F3", "F4", "F1", "F5", "F6"]);
  });
  it("sabitlenen aygıt rozet taşır ve parmak izi değişir", () => {
    const a = computeSwitchboardLayout({ parts: salterler });
    const b = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [bagla("T1|P1|F1", "T1|P1|F4", "sonra")],
    });
    expect(b.room[0].placements.find((p) => p.label === "F1")?.pinned).toBe(true);
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });
  it("taşıma denetimi bozmaz", () => {
    const r = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [bagla("T1|P1|F6", "T1|P1|F1", "once")],
    });
    for (const a of auditLineup(r.room, resolveSettings({}), r.devices)) {
      expect(a.result.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual([]);
    }
  });
  it("komşusu panoda olmayan sabitleme UYARIYLA düşer, sessizce değil", () => {
    const r = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [bagla("T1|P1|F1", "T1|P1|HAYALET", "sonra")],
    });
    expect(r.room[0].placements.map((p) => p.label)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(r.room[0].warnings.some((w) => w.includes("F1 sabitlemesi uygulanamadı"))).toBe(true);
  });
});

const SURUCU: DeviceModel = {
  lookupKey: "SCHNEIDERELECTRIC|ATV930D15N4",
  supplier: "Schneider Electric",
  typeNo: "ATV930D15N4",
  widthMm: 155,
  heightMm: 330,
  depthMm: 232,
  moduleUnits: null,
  mountType: "plaka",
  zone: "guc",
  clearanceTopMm: 100,
  clearanceBottomMm: 100,
  heatW: null,
  source: "elle",
  note: "",
};

describe("tür sınırı aşılamaz", () => {
  const karisik = [
    ...salterler.slice(0, 3),
    parca({
      device: "U1",
      deviceTag: "=T1+P1-U1",
      designation: "ATV930 - 15kW - 400/480V",
      typeNo: "ATV930D15N4",
      supplier: "Schneider Electric",
      partNo: "SE.ATV930D15N4",
    }),
  ];

  it("DIN şalteri sürücünün yanına sabitlenirse uygulanmaz ve sebebi yazılır", () => {
    const r = computeSwitchboardLayout({
      parts: karisik,
      models: [SURUCU],
      placementOverrides: [bagla("T1|P1|F2", "T1|P1|U1", "sonra")],
    });
    const p = r.room[0];
    // Sürücü kendi plaka rayında, şalterler DIN rayında — karışmadı.
    for (const ray of p.rails) {
      const oRayin = p.placements.filter((y) => y.railIndex === ray.index);
      expect(new Set(oRayin.map((y) => y.mountType)).size).toBe(1);
    }
    expect(p.warnings.some((w) => w.includes("F2 sabitlemesi uygulanamadı"))).toBe(true);
  });
});

describe("bölgesi boş aygıt öne geçmez (T4)", () => {
  it("bölgesiz termostat sürücünün ÜSTÜNE çıkmaz", () => {
    // 0026'nın `S162`si: defterde `din`, bölge boş. Eski sıralama `indexOf(null)
    // = -1` ile onu en öne alıyor ve ilk DIN rayını en üstte açıyordu.
    const r = computeSwitchboardLayout({
      parts: [
        parca({
          device: "S162",
          deviceTag: "=T1+P1-S162",
          designation: "THERMOSTAT",
          typeNo: "EG-ET-01",
          supplier: "Elektral",
          partNo: "EG-ET-01",
        }),
        parca({
          device: "U1",
          deviceTag: "=T1+P1-U1",
          designation: "ATV930 - 15kW - 400/480V",
          typeNo: "ATV930D15N4",
          supplier: "Schneider Electric",
          partNo: "SE.ATV930D15N4",
        }),
        salterler[0],
      ],
      models: [
        SURUCU,
        {
          ...SURUCU,
          lookupKey: "ELEKTRAL|EGET01",
          supplier: "Elektral",
          typeNo: "EG-ET-01",
          widthMm: 33,
          heightMm: 60,
          depthMm: 43,
          mountType: "din",
          zone: null,
          clearanceTopMm: null,
          clearanceBottomMm: null,
        },
      ],
    });
    const p = r.room[0];
    const y = (kod: string) => p.placements.find((x) => x.label === kod)?.yMm ?? -1;
    expect(y("U1")).toBeGreaterThanOrEqual(0);
    expect(y("S162")).toBeGreaterThan(y("U1"));
    expect(p.order[0].endsWith("U1")).toBe(true);
  });
});
