// SIKI PAKETLEME (PANO-37) — bölge ray açmaz, boşluklar doldurulur.
//
// Kullanıcının cümlesi (09.09.2026): *"gruplandırmaya gerek yok, yan yana
// koyulabilir; mümkün olduğunca sığdırmaya çalışacağız."*
//
// Eski kural bölge değişince yeni ray açıyordu ve her rayın sağında metrelerce
// boşluk kalıyordu; yığın plakayı aşınca da cihazlar plakanın DIŞINA taşıyor,
// ama şemada "sığmış gibi" görünüyordu.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import { plateCapacityHeightMm, railCapacityMm } from "../sizes";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+LVD1-F1",
    installation: "T1",
    location: "LVD1",
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

/** Her bölgeden BİRER cihaz — eski kuralda beş ray, her biri neredeyse boş. */
const beserBolge: ElectricalPart[] = [
  parca({ device: "Q1", deviceTag: "=T1+LVD1-Q1" }),
  parca({
    device: "K1",
    deviceTag: "=T1+LVD1-K1",
    designation: "CONTACTOR AC-3 4KW/400V 1NO+1NC AC230V",
    typeNo: "3RT2023-1AP00",
    partNo: "SIE.3RT2023",
  }),
  parca({
    device: "A1",
    deviceTag: "=T1+LVD1-A1",
    designation: "POWER SUPPLY 24VDC 10A",
    typeNo: "6EP1334-3BA10",
    partNo: "SIE.6EP1334",
  }),
  parca({
    device: "X1",
    deviceTag: "=T1+LVD1-X1",
    designation: "Feed-through terminal block UT 2,5",
    typeNo: "UT 2,5",
    supplier: "Phoenix Contact",
    partNo: "PXC.3044076",
    qty: 6,
  }),
];

describe("bölge ray açmaz", () => {
  const r = computeSwitchboardLayout({ parts: beserBolge });
  const p = r.room[0];

  it("dört bölgenin cihazı TEK raya sığar", () => {
    expect(p.rails).toHaveLength(1);
    expect(new Set(p.placements.map((y) => y.zone)).size).toBeGreaterThan(1);
  });

  it("DIN ile PLAKA yine ayrı raylardadır — bu fizik", () => {
    const surucu = computeSwitchboardLayout({
      parts: [
        ...beserBolge,
        parca({
          device: "U1",
          deviceTag: "=T1+LVD1-U1",
          designation: "ATV930 - 15kW - 400/480V",
          typeNo: "ATV930D15N4",
          supplier: "Schneider Electric",
          partNo: "SE.ATV930D15N4",
        }),
      ],
      models: [
        {
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
        },
      ],
    });
    const pano = surucu.room[0];
    for (const ray of pano.rails) {
      const oRayin = pano.placements.filter((y) => y.railIndex === ray.index);
      expect(new Set(oRayin.map((y) => y.mountType)).size).toBeLessThanOrEqual(1);
    }
    // Sürücü kendi (plaka) rayını açar ve EN ÜSTTEDİR (PANO-37 · 3. madde).
    expect(pano.rails[0].kind).toBe("plaka");
  });

  it("BOŞ RAY KALMAZ — her rayda en az bir cihaz var", () => {
    for (const ray of p.rails) {
      expect(p.placements.some((y) => y.railIndex === ray.index)).toBe(true);
      expect(ray.usedMm).toBeGreaterThan(0);
    }
  });
});

describe("önceki rayın boşluğu doldurulur (first-fit)", () => {
  // Bir rayı DOLDURACAK kadar klemens, sonra tek bir küçük şalter. Eski kural
  // şalteri yeni bir raya atıyordu; şimdi klemenslerin arkasındaki boşluğa
  // giriyorsa aynı raydadır, girmiyorsa yeni ray açılır — ikisi de doğrudur.
  // Ölçülen ŞART: hiçbir ray, sığabilecek bir cihaz varken boş kalmaz.
  const s = resolveSettings();

  it("cihazlar ray kapasitesini AŞMAZ ve raylar sırayla dolar", () => {
    const r = computeSwitchboardLayout({
      parts: [
        ...Array.from({ length: 30 }, (_, i) =>
          parca({ device: `F${i + 1}`, deviceTag: `=T1+LVD1-F${i + 1}` })
        ),
        parca({
          device: "X1",
          deviceTag: "=T1+LVD1-X1",
          designation: "Feed-through terminal block UT 2,5",
          typeNo: "UT 2,5",
          supplier: "Phoenix Contact",
          partNo: "PXC.3044076",
          qty: 40,
        }),
      ],
    });
    const p = r.room[0];
    const kapasite = railCapacityMm(p.widthMm, s);
    for (const ray of p.rails) {
      const oRayin = p.placements.filter((y) => y.railIndex === ray.index);
      const sag = Math.max(...oRayin.map((y) => y.xMm + y.widthMm));
      expect(sag).toBeLessThanOrEqual(kapasite + 0.001);
    }
    // SON RAY DIŞINDA hiçbir ray yarıdan az dolu olamaz: aksi hâlde birinci
    // geçiş bir boşluğu görmezden gelmiş demektir.
    const doluluk = p.rails.map((ray) => ray.usedMm / ray.capacityMm);
    for (const d of doluluk.slice(0, -1)) expect(d).toBeGreaterThan(0.5);
  });
});

describe("plakaya sığma", () => {
  it("çözüm sığdığını söylüyorsa ray yığını plakayı AŞMAZ", () => {
    // 8. maddenin kökü: kullanıcı "dışarda duruyor ama sığmış gibi görünüyor"
    // dedi. Sığan bir panoda yığın kapasiteyi aşamaz — aşarsa çizim doğru
    // ama plan yanlıştır.
    const r = computeSwitchboardLayout({
      parts: Array.from({ length: 120 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=T1+LVD1-F${i + 1}` })
      ),
    });
    for (const p of r.room) {
      const yigin = p.rails.reduce((t, ray) => t + ray.heightMm, 0);
      const kapasite = plateCapacityHeightMm(p.heightMm, r.settings);
      const uyariVar = p.warnings.some((w) => w.includes("plakada"));
      if (!uyariVar) expect(yigin).toBeLessThanOrEqual(kapasite + 0.001);
    }
  });
});
