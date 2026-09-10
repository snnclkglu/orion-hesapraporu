import { RAILS, railMassKgPerM, railNominalHeadWidthMm } from "@/lib/calc/tables";

export interface RailPad {
  code: string;
  massKgPerM: number;
  totalWidthMm: number;
  thicknessMm: readonly [number, number];
  supportWidthMm: number;
  railCodes: readonly string[];
}

export const RAIL_PADS: readonly RailPad[] = [
  { code: "RP100", massKgPerM: 1.3, totalWidthMm: 100, thicknessMm: [6, 7], supportWidthMm: 70, railCodes: ["S30", "S33"] },
  { code: "RP120", massKgPerM: 1.5, totalWidthMm: 120, thicknessMm: [6, 7], supportWidthMm: 80, railCodes: ["A45", "S49"] },
  { code: "RP135", massKgPerM: 1.7, totalWidthMm: 135, thicknessMm: [6, 7], supportWidthMm: 100, railCodes: ["CR73"] },
  { code: "RP145", massKgPerM: 1.85, totalWidthMm: 145, thicknessMm: [6, 7], supportWidthMm: 100, railCodes: ["A55", "CR100"] },
  { code: "RP170", massKgPerM: 2.1, totalWidthMm: 170, thicknessMm: [6, 7], supportWidthMm: 130, railCodes: ["A65"] },
  { code: "RP195", massKgPerM: 2.35, totalWidthMm: 195, thicknessMm: [6, 7], supportWidthMm: 155, railCodes: ["A75", "A100"] },
  { code: "RP215", massKgPerM: 2.7, totalWidthMm: 215, thicknessMm: [6, 7], supportWidthMm: 170, railCodes: ["A120", "A150"] },
];

export interface RailClamp {
  model: "CRAPEX 400" | "CRAPEX 600" | "CRAPEX 800" | "CRAPEX 1000";
  bolt: string;
  boltCount: number;
  padded: boolean;
  unpadded: boolean;
  railCodes: readonly string[];
}

export const RAIL_CLAMPS: readonly RailClamp[] = [
  { model: "CRAPEX 400", bolt: "M16", boltCount: 1, padded: true, unpadded: true, railCodes: ["A45", "A55", "A65", "S24", "S30", "S41", "S46", "S49"] },
  { model: "CRAPEX 600", bolt: "M20", boltCount: 1, padded: true, unpadded: true, railCodes: ["A75", "A100", "A120", "A150", "S49"] },
  { model: "CRAPEX 800", bolt: "M16", boltCount: 2, padded: true, unpadded: true, railCodes: ["A45", "A55", "A65", "A75", "A100", "A120", "S24", "S30", "S41", "S46", "S49"] },
  { model: "CRAPEX 1000", bolt: "M20", boltCount: 2, padded: true, unpadded: false, railCodes: ["A75", "A100", "A120", "A150", "S49"] },
];

export interface RailReference {
  code: string;
  family: "A tipi" | "S tipi" | "Kare / dikdörtgen";
  heightMm: number;
  nominalHeadWidthMm: number;
  effectiveHeadWidthMm: number;
  massKgPerM: number;
}

export const RAIL_REFERENCES: readonly RailReference[] = Object.entries(RAILS).map(([code, row]) => ({
  code,
  family: row.family === "a" ? "A tipi" : row.family === "s" ? "S tipi" : "Kare / dikdörtgen",
  heightMm: row.heightMm,
  nominalHeadWidthMm: railNominalHeadWidthMm(code),
  effectiveHeadWidthMm: row.headWidth,
  massKgPerM: railMassKgPerM(code, 0.00785) ?? Number.NaN,
}));

export function railAccessories(code: string) {
  return {
    pads: RAIL_PADS.filter((item) => item.railCodes.includes(code)),
    clamps: RAIL_CLAMPS.filter((item) => item.railCodes.includes(code)),
  };
}
