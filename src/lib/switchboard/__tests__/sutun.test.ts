// SÜTUNLU YERLEŞİM (PANO-39) — uzun plaka cihazının yanındaki cep DIN rayı alır.
//
// Ölçüldü (0026-01, 12.09.2026): 922 mm'lik sürücü tam enli bir satır
// açıyordu; yanındaki üç 546 mm'lik sürücünün altında 0,28 m² ölü alan
// kalıyor ve bütün kumanda rayları o boşluğa sığarken pano ikiye bölünüp
// fazladan 400 mm'lik bir göz açılıyordu. Burada dört şey çivilenir:
//
//   1. Cep rayı gerçekten cebe açılır, toplam yükseklik bandı aşmaz.
//   2. Dar cepte (sütun payı düşülünce `minRailMm` altı) ray açılmaz.
//   3. Anahtar kapalıyken eski raf modeli BİT-AYNI çıkar.
//   4. Denetçi cep rayı ile bandın cihazlarının 2B çakışmasını yakalar.
//   5. Kilitli en sığmazsa EN BÜYÜK boy seçilir (PANO-41, T3).

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { auditPanel } from "../audit";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import { plateCapacityHeightMm } from "../sizes";
import type { DeviceModel, PanelOverride } from "../types";

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

function surucu(tip: string, enMm: number, boyMm: number): DeviceModel {
  return {
    lookupKey: `SCHNEIDERELECTRIC|${tip.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`,
    supplier: "Schneider Electric",
    typeNo: tip,
    widthMm: enMm,
    heightMm: boyMm,
    depthMm: 300,
    moduleUnits: null,
    mountType: "plaka",
    zone: "guc",
    clearanceTopMm: 100,
    clearanceBottomMm: 100,
    heatW: null,
    source: "elle",
    note: "",
  };
}

function surucuSatiri(kod: string, tip: string): ElectricalPart {
  return parca({
    device: kod,
    deviceTag: `=T1+P1-${kod}`,
    designation: "ATV930 drive",
    typeNo: tip,
    supplier: "Schneider Electric",
    partNo: `SE.${tip}`,
  });
}

/** Bir uzun, üç kısa sürücü + 20 röle — 0026'nın küçültülmüş hâli. */
const modeller = [surucu("ATV930D90N4", 290, 922), surucu("ATV930D15N4", 211, 546)];
const parcalar: ElectricalPart[] = [
  surucuSatiri("U20", "ATV930D90N4"),
  surucuSatiri("U30", "ATV930D15N4"),
  surucuSatiri("U40", "ATV930D15N4"),
  surucuSatiri("U50", "ATV930D15N4"),
  ...Array.from({ length: 20 }, (_, i) =>
    parca({
      device: `K${i + 1}`,
      deviceTag: `=T1+P1-K${i + 1}`,
      designation: "INTERFACE RELAY 24VDC 6A",
      typeNo: "RXG22BD",
      supplier: "Schneider Electric",
      partNo: "SE.RXG22BD",
    })
  ),
];

describe("cep rayı", () => {
  const acik = computeSwitchboardLayout({ parts: parcalar, models: modeller });
  const p = acik.room[0];

  it("röleler sürücülerin yanındaki cebe girer ve pano TEK gövdede kalır", () => {
    expect(acik.room).toHaveLength(1);
    const band = p.rails.find((r) => r.kind === "plaka")!;
    const cepRaylari = p.rails.filter((r) => r.pocketOf === band.index);
    expect(cepRaylari.length).toBeGreaterThan(0);
    for (const r of cepRaylari) {
      // Cep rayı bandın İÇİNDE durur.
      expect(r.yMm).toBeGreaterThanOrEqual(band.yMm);
      expect(r.yMm + r.heightMm).toBeLessThanOrEqual(band.yMm + band.heightMm + 0.01);
      // Sütun payı: rayın solu uzun sürücünün sağından uzaktadır.
      const u20 = p.placements.find((y) => y.label === "U20")!;
      expect(r.xMm).toBeGreaterThanOrEqual(u20.xMm + u20.widthMm + acik.settings.columnGapMm - 0.01);
    }
    // Yığın bandı aşmaz: en alt ray bandın altıdır.
    const enAlt = Math.max(...p.rails.map((r) => r.yMm + r.heightMm));
    expect(enAlt).toBeLessThanOrEqual(band.yMm + band.heightMm + 0.01);
  });

  it("uzun sürücü SOLDA, kısalar sağında", () => {
    const x = (kod: string) => p.placements.find((y) => y.label === kod)!.xMm;
    expect(x("U20")).toBeLessThan(x("U30"));
    expect(x("U30")).toBeLessThan(x("U40"));
  });

  it("denetim geçer — cep rayı bandın dikdörtgeniyle kesişir ama cihazlarıyla değil", () => {
    const d = auditPanel(p, acik.settings, acik.devices);
    expect(d.checks.filter((c) => !c.ok).map((c) => `${c.key}: ${c.detail}`)).toEqual([]);
  });

  it("anahtar KAPALIYKEN raf modeli: DIN rayı bandın ALTINDA, tam enli", () => {
    const kapali = computeSwitchboardLayout({
      parts: parcalar,
      models: modeller,
      settings: { columnsEnabled: false },
    });
    const q = kapali.room[0];
    expect(q.rails.every((r) => r.pocketOf === null && r.xMm === 0)).toBe(true);
    const band = q.rails.find((r) => r.kind === "plaka")!;
    for (const r of q.rails.filter((r) => r.kind === "din")) {
      expect(r.yMm).toBeGreaterThanOrEqual(band.yMm + band.heightMm - 0.01);
    }
    // Sütunlu yerleşim yığını KÜÇÜLTÜR.
    const yigin = (x: typeof q) => Math.max(...x.rails.map((r) => r.yMm + r.heightMm));
    expect(yigin(p)).toBeLessThan(yigin(q));
  });

  it("dar cepte ray açılmaz", () => {
    // İki sürücü 290 + 211: cep 211 mm, sütun payı düşülünce 161 < 200.
    const dar = computeSwitchboardLayout({
      parts: [surucuSatiri("U20", "ATV930D90N4"), surucuSatiri("U30", "ATV930D15N4"), ...parcalar.slice(4, 8)],
      models: modeller,
      panelOverrides: [kilit("P1", 600)],
    });
    const q = dar.room[0];
    expect(q.rails.every((r) => r.pocketOf === null)).toBe(true);
  });
});

function kilit(code: string, widthMm: number): PanelOverride {
  return {
    code,
    name: "",
    kind: null,
    widthMm,
    heightMm: null,
    depthMm: null,
    baseMm: null,
    doorConfig: null,
    orderIndex: null,
    widthLocked: true,
    heightLocked: false,
    depthLocked: false,
    note: "",
  };
}

describe("denetçi 2B çakışmayı yakalar", () => {
  it("cep rayındaki cihaz sürücünün üstüne KAYDIRILIRSA çakışma raporlanır", () => {
    const r = computeSwitchboardLayout({ parts: parcalar, models: modeller });
    const p = JSON.parse(JSON.stringify(r.room[0])) as typeof r.room[0];
    const u20 = p.placements.find((y) => y.label === "U20")!;
    const k1 = p.placements.find((y) => y.label === "K1")!;
    k1.xMm = u20.xMm + 10;
    k1.yMm = u20.yMm + 10;
    const d = auditPanel(p, r.settings);
    expect(d.checks.find((c) => c.key === "cakisma")!.ok).toBe(false);
  });
});

describe("kilitli en sığmazsa EN BÜYÜK boy (PANO-41)", () => {
  it("400 mm kilidiyle 120 şalter: 2000 seçilir ve taşma en küçük olur", () => {
    const cok = Array.from({ length: 120 }, (_, i) =>
      parca({ device: `F${i + 1}`, deviceTag: `=T1+P1-F${i + 1}` })
    );
    const r = computeSwitchboardLayout({ parts: cok, panelOverrides: [kilit("P1", 400)] });
    expect(r.room).toHaveLength(1);
    expect(r.room[0].widthMm).toBe(400);
    expect(r.roomSize.heightMm).toBe(2000);
    expect(r.room[0].warnings.some((w) => w.includes("kilitli"))).toBe(true);
    // Taşma sayısı raporlanır, gizlenmez.
    const kapasite = plateCapacityHeightMm(2000, resolveSettings({}));
    const enAlt = Math.max(...r.room[0].rails.map((x) => x.yMm + x.heightMm));
    expect(enAlt).toBeGreaterThan(kapasite);
  });
});
