// KABİN VE ELEKTRİK ODASI GİRDİLERİ — 02.09.2026 turu (md. 2, 3, 7, 9, 10, 11).
//
// Sayılar değil DAVRANIŞ sınanır: hangi girdi hangi hesap kalemini oynatıyor,
// eski bir kayıt yeni alan yüzünden sessizce değişiyor mu, bir cam tipi
// eklendiğinde hesap doğru U ile mi koşuyor.

import { describe, expect, it } from "vitest";
import { DEFAULT_CABIN_INPUTS, NEW_WORK_TEMPLATE } from "../defaults";
import {
  DEFAULT_CABIN_INDOOR_TEMP_C,
  DEFAULT_ROOM_INDOOR_TEMP_C,
  camAlaniEtkin,
  camAlaniTahmini,
  computeCabin,
  parseRoomDoorSize,
  roomPanelLayout,
  type CabinDeps,
  type CabinInputs,
} from "../modules/cabin";
import { GLAZING, computeClimateLoad, ROOM_DESIGN_TEMP_C } from "../climate-load";
import { GLAZING_KINDS } from "../presentation/cabinFields";
import { migrateCabin } from "@/lib/revision-load";
import type { TechnicalSpecs } from "../types";

const SPECS: TechnicalSpecs = {
  ...NEW_WORK_TEMPLATE.specs,
  hasOperatorCabin: "yes",
  electricalAccommodationType: "room",
  ambientTempMaxC: 50,
};

const DEPS: CabinDeps = {
  panelHeatKw: 1.1,
  installedDrivePowerKw: 50,
  inverterLossKw: 0.8,
  auxiliaryLossKw: 0.64,
  beforeDiversityKw: 1.44,
  diversityFactor: 0.6,
  driveHeatItems: [],
};

function cabinFor(patch: Partial<CabinInputs>) {
  const inp: CabinInputs = { ...DEFAULT_CABIN_INPUTS, ...patch };
  return computeCabin(SPECS, inp, NEW_WORK_TEMPLATE.cabin!.selections, DEPS);
}

describe("iç sıcaklık artık GİRDİ (md. 2)", () => {
  it("mahal başına AYRIDIR ve varsayılanları farklıdır", () => {
    const r = cabinFor({});
    expect(r.values!.roomDesignTempC).toBe(DEFAULT_ROOM_INDOOR_TEMP_C);
    expect(r.values!.cabinDesignTempC).toBe(DEFAULT_CABIN_INDOOR_TEMP_C);
    expect(DEFAULT_ROOM_INDOOR_TEMP_C).not.toBe(DEFAULT_CABIN_INDOOR_TEMP_C);
  });

  it("bir derece DÜŞÜRMEK yükü BÜYÜTÜR — bütün ΔT'ler ondan kurulur", () => {
    const sicak = cabinFor({ roomIndoorTempC: 25 }).values!.roomLoad!.totalKw;
    const soguk = cabinFor({ roomIndoorTempC: 23 }).values!.roomLoad!.totalKw;
    expect(soguk).toBeGreaterThan(sicak);
  });

  it("çekirdek YEDEĞİ korur: `roomTempC` verilmezse eski sabit kullanılır", () => {
    const ortak = {
      widthM: 3, lengthM: 4, heightM: 2.6,
      insulation: "rockWool100" as const,
      doorCount: 1,
      ambientTempC: 50, ambientRhPct: 50,
      environment: "indoor" as const,
      deviceHeatKw: 1, radiationKw: 0, safetyFactorPct: 15,
    };
    expect(computeClimateLoad(ortak).totalKw).toBeCloseTo(
      computeClimateLoad({ ...ortak, roomTempC: ROOM_DESIGN_TEMP_C }).totalKw,
      9
    );
  });
});

describe("kapı ölçüsü TEK KUTU (md. 3)", () => {
  it("«800x2000» biçimi çözülür, tanınmayan metin `null` döner", () => {
    expect(parseRoomDoorSize("800x2000")).toEqual({ widthMm: 800, heightMm: 2000 });
    expect(parseRoomDoorSize("700x1900")).toEqual({ widthMm: 700, heightMm: 1900 });
    expect(parseRoomDoorSize("kapı")).toBeNull();
    expect(parseRoomDoorSize(undefined)).toBeNull();
  });

  it("tek kutu ÖNCE okunur, eski iki alan YEDEKTİR", () => {
    const yeni = roomPanelLayout({
      ...DEFAULT_CABIN_INPUTS,
      roomDoorSize: "700x2100",
      roomDoorWidthMm: 800,
      roomDoorHeightMm: 2000,
    });
    expect(yeni.doorWidthMm).toBe(700);
    expect(yeni.doorHeightMm).toBe(2100);

    const eski = roomPanelLayout({
      ...DEFAULT_CABIN_INPUTS,
      roomDoorSize: undefined,
      roomDoorWidthMm: 900,
      roomDoorHeightMm: 2200,
    });
    expect(eski.doorWidthMm).toBe(900);
    expect(eski.doorHeightMm).toBe(2200);
  });

  it("ESKİ KAYIT SESSİZCE DEĞİŞMEZ: göç tek kutuyu iki sayıdan kurar", () => {
    // Şablonun varsayılanı "800x2000"dir; kayıtta alan yoksa `withDefaults`
    // onu miras verir ve mühendisin yazdığı 700 × 2.100 kaybolurdu.
    const merged = { inputs: { ...DEFAULT_CABIN_INPUTS, roomDoorWidthMm: 700, roomDoorHeightMm: 2100 } };
    const gocmus = migrateCabin(SPECS, merged, { roomDoorWidthMm: 700, roomDoorHeightMm: 2100 });
    const inputs = gocmus.inputs as CabinInputs;
    expect(inputs.roomDoorSize).toBe("700x2100");
    expect(roomPanelLayout(inputs).doorWidthMm).toBe(700);
  });
});

describe("cam alanı OTOMATİK (md. 9)", () => {
  it("ön yüz + iki yanın yarısı, %80 çerçeve payıyla ve BİR ONDALIK", () => {
    // A = 0,80 × Y × (G + U) = 0,80 × 2,4 × (2 + 2,5) = 8,64 → 8,6
    expect(camAlaniTahmini({ ...DEFAULT_CABIN_INPUTS })).toBe(8.6);
  });

  it("ölçü eksikse türetilmez ve kutudaki değer kullanılır (md. 4)", () => {
    const eksik = { ...DEFAULT_CABIN_INPUTS, cabinHeightM: 0 };
    expect(camAlaniTahmini(eksik)).toBeNull();
    expect(camAlaniEtkin(eksik)).toBe(DEFAULT_CABIN_INPUTS.cabinGlazingAreaM2);
  });

  it("anahtar KAPALIYKEN mühendisin değeri geçerlidir", () => {
    const elle = { ...DEFAULT_CABIN_INPUTS, cabinGlazingAreaAuto: false, cabinGlazingAreaM2: 1.2 };
    expect(camAlaniEtkin(elle)).toBe(1.2);
  });
});

describe("cam tipi defteri (md. 10)", () => {
  it("kurşungeçirmez iki seçenek de tanımlıdır ve U değerleri AYRILIR", () => {
    expect(GLAZING.ballistic.uValue).toBe(4.5);
    expect(GLAZING.ballisticInsulated.uValue).toBe(1.3);
    // Fark 3,5 kattır; "kurşungeçirmez" tek bir ısı davranışı DEĞİLDİR.
    expect(GLAZING.ballistic.uValue / GLAZING.ballisticInsulated.uValue).toBeGreaterThan(3);
  });

  it("SEÇENEK LİSTESİ İLE DEFTER AYRIŞMAZ", () => {
    // Eski `glazingKind()` beyaz listeydi: listeye eklenen ama oraya
    // eklenmeyen bir tip hesapta SESSİZCE "double" ile koşuyordu.
    for (const kind of GLAZING_KINDS) expect(GLAZING).toHaveProperty(kind);
  });

  it("yeni tip hesapta GERÇEKTEN kullanılır — «double»a düşmez", () => {
    const balistik = cabinFor({ cabinGlazingKind: "ballistic" }).values!.cabinLoad!;
    const isicam = cabinFor({ cabinGlazingKind: "ballisticInsulated" }).values!.cabinLoad!;
    expect(balistik.transmissionKw).toBeGreaterThan(isicam.transmissionKw);
  });
});

describe("operatör adedi listeden seçilir (md. 11)", () => {
  it("her seçenek hesaba SAYI olarak girer", () => {
    const bir = cabinFor({ cabinOccupantCount: 1 }).values!.cabinLoad!.occupantKw;
    const uc = cabinFor({ cabinOccupantCount: 3 }).values!.cabinLoad!.occupantKw;
    expect(uc).toBeCloseTo(bir * 3, 6);
  });
});

describe("pano dizisinden sonra BOYDA kalan mesafe (md. 4 · şema)", () => {
  it("oda boyu − Σ pano eni; NEGATİF olabilir ve mutlak değere çevrilmez", () => {
    const sigan = roomPanelLayout({
      ...DEFAULT_CABIN_INPUTS,
      roomLengthM: 4,
      panelCount: 1,
      roomPanelWidthsText: "800",
    });
    expect(sigan.remainingLengthMm).toBe(3200);

    const sigmayan = roomPanelLayout({
      ...DEFAULT_CABIN_INPUTS,
      roomLengthM: 4,
      panelCount: 6,
      roomPanelWidthsText: "600; 800; 800; 800; 800; 600",
    });
    expect(sigmayan.remainingLengthMm).toBe(-400);
  });
});
