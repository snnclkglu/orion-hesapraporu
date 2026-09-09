// SAHA IZGARASI ve KUTU BAŞINA ÖLÇÜ (PANO-33).
//
// Kullanıcının verdiği ızgara (09.09.2026): yükseklik 300…1400, en 400…800,
// derinlik 200…400. Bunlar odanınkinden BAĞIMSIZDIR ve saha kutuları ortak boy
// PAYLAŞMAZ — her kutu ayrı bir duvara asılır.
//
// Kaldırılan kusur ölçülmüştü: bütün saha kutuları odanın en küçük boyunu
// (1400 mm) alıyordu ve %18…%53 doluydu; 0019'un `TBW`sinde 1250 mm'lik
// plakada 220 mm ray vardı.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "../compute";
import { FIELD_GRID, PANEL_HEIGHTS_MM, ROOM_GRID } from "../sizes";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+TB1-F1",
    installation: "T1",
    location: "TB1",
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

function kutu(konum: string, n: number): ElectricalPart[] {
  return Array.from({ length: n }, (_, i) =>
    parca({ location: konum, device: `F${i + 1}`, deviceTag: `=T1+${konum}-F${i + 1}` })
  );
}

describe("saha ızgarası", () => {
  it("kullanıcının verdiği ölçüleri taşır ve odanınkinden AYRIDIR", () => {
    expect([...FIELD_GRID.heights]).toEqual([
      300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400,
    ]);
    expect([...FIELD_GRID.widths]).toEqual([400, 500, 600, 700, 800]);
    expect([...FIELD_GRID.depths]).toEqual([200, 250, 300, 350, 400]);

    // 350 mm derinlik YALNIZ sahadadır; 1600/1800/2000 yalnız odada.
    expect(ROOM_GRID.depths).not.toContain(350);
    for (const h of [1600, 1800, 2000]) expect(FIELD_GRID.heights).not.toContain(h);
    expect([...PANEL_HEIGHTS_MM]).toEqual([...ROOM_GRID.heights]);
  });

  it("saha kutusuna 1800 EŞİĞİ uygulanmaz; oda eşiğini korur", () => {
    expect(FIELD_GRID.preferredHeightMm).toBeNull();
    expect(ROOM_GRID.preferredHeightMm).toBe(1800);
    expect(FIELD_GRID.sharedHeight).toBe(false);
    expect(ROOM_GRID.sharedHeight).toBe(true);
  });
});

describe("kutu başına ölçü", () => {
  // Üç saha kutusu, ÇOK FARKLI dolulukta: biri tek şalter, biri kırk.
  const parcalar = [...kutu("TB1", 1), ...kutu("TB2", 12), ...kutu("TB3", 40)];

  it("her saha kutusu KENDİ boyunu alır", () => {
    const r = computeSwitchboardLayout({ parts: parcalar });
    const boylar = r.field.map((p) => p.heightMm);
    expect(r.field.length).toBeGreaterThanOrEqual(3);
    // Tek şalterli kutu, kırk şalterlininkiyle aynı boyda OLMAMALI.
    expect(new Set(boylar).size).toBeGreaterThan(1);
    for (const h of boylar) expect(FIELD_GRID.heights).toContain(h);
    expect(r.fieldSize.sharedHeight).toBe(false);
  });

  it("tek şalterli kutu 1400 değil, ızgaranın küçük ucundan bir boy alır", () => {
    const r = computeSwitchboardLayout({ parts: kutu("TBW", 1) });
    expect(r.field).toHaveLength(1);
    expect(r.field[0].heightMm).toBeLessThanOrEqual(600);
    expect(r.field[0].widthMm).toBe(400);
  });

  it("ORTAK DERİNLİK korunur — kullanıcıya sorulan yalnız yükseklikti (PANO-2)", () => {
    const r = computeSwitchboardLayout({ parts: parcalar });
    const derinlikler = new Set(r.field.map((p) => p.depthMm));
    expect(derinlikler.size).toBe(1);
    expect(FIELD_GRID.depths).toContain([...derinlikler][0]);
  });

  it("BAZA korunur — kullanıcı 'oda gibi baza olsun' dedi (09.09.2026)", () => {
    const r = computeSwitchboardLayout({ parts: parcalar });
    for (const p of r.field) expect(p.baseMm).toBeGreaterThan(0);
  });

  it("odada boy ORTAKTIR; saha kutusu odayı etkilemez", () => {
    const oda = [
      ...kutu("LVD1", 1).map((p) => ({ ...p, location: "LVD1", deviceTag: "=T1+LVD1-F1" })),
      ...kutu("LVD2", 40).map((p, i) => ({
        ...p,
        location: "LVD2",
        deviceTag: `=T1+LVD2-F${i + 1}`,
      })),
    ];
    const r = computeSwitchboardLayout({ parts: [...oda, ...kutu("TB9", 1)] });
    expect(new Set(r.room.map((p) => p.heightMm)).size).toBe(1);
    expect(r.roomSize.sharedHeight).toBe(true);
    expect(ROOM_GRID.heights).toContain(r.room[0].heightMm);
  });

  it("kullanıcının verdiği saha yüksekliği aramayı ezer", () => {
    const r = computeSwitchboardLayout({
      parts: parcalar,
      settings: { field: { heightMm: 1200 } },
    });
    for (const p of r.field) expect(p.heightMm).toBe(1200);
  });
});

describe("kilit", () => {
  it("tek kutuda kilitli boy TABAN değil KİLİTTİR", () => {
    // Dizide (oda) kilit "bundan alçak olamaz" der, çünkü gözler aynı boyu
    // paylaşmak zorundadır. Saha kutusunda böyle bir zorunluluk yok: kullanıcı
    // 600 dediyse 600 alır.
    const r = computeSwitchboardLayout({
      parts: kutu("TB7", 3),
      panelOverrides: [
        {
          code: "TB7",
          name: "",
          kind: "saha",
          widthMm: null,
          heightMm: 1200,
          depthMm: null,
          baseMm: null,
          doorConfig: null,
          widthLocked: false,
          heightLocked: true,
          depthLocked: false,
          orderIndex: null,
          note: "",
        },
      ],
    });
    expect(r.field).toHaveLength(1);
    expect(r.field[0].heightMm).toBe(1200);
  });
});

describe("en küçük ön yüz", () => {
  it("alçak ama GENİŞ kutu yerine dar ve yüksek olanı seçer", () => {
    // Üç cihaz tek satıra sığar ama o satır 800 mm ister; iki satıra bölünürse
    // 400 mm yeter. Ölçüldü (0019 `TB3`): eski kural 800 x 500 seçiyordu.
    const r = computeSwitchboardLayout({ parts: kutu("TB5", 6) });
    expect(r.field).toHaveLength(1);
    const p = r.field[0];
    expect(p.widthMm * p.heightMm).toBeLessThanOrEqual(800 * 500);
  });
});
