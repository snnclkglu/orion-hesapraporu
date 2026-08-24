// Redüktör mil yönleri — çıkış özelliği + yön kodundan türetilen sade model.
// Şema (diagrams/gearboxShaft.ts) ve etiketler bu tek kaynaktan okur.

/** Çıkış özelliği kodundan (00…08, 0S) mil/flanş biçimi. */
export interface GearboxShaftShape {
  /** Çıkış mili delik mi (hollow) yoksa dolu mu (solid) */
  hollow: boolean;
  /** Flanş var mı */
  flanged: boolean;
  /** Çift flanş */
  doubleFlange: boolean;
  /** Çift çıkış mili */
  doubleOutput: boolean;
  /** Sıkma bilezik (shrink disk) */
  shrinkDisk: boolean;
}

export function gearboxOutputShape(feature: string | undefined | null): GearboxShaftShape {
  const f = typeof feature === "string" ? feature.trim() : "";
  switch (f) {
    case "00": return { hollow: true, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false };
    case "01": return { hollow: false, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false };
    case "02": return { hollow: false, flanged: true, doubleFlange: false, doubleOutput: false, shrinkDisk: false };
    case "03": return { hollow: true, flanged: true, doubleFlange: false, doubleOutput: false, shrinkDisk: false };
    case "04": return { hollow: false, flanged: false, doubleFlange: false, doubleOutput: true, shrinkDisk: false };
    case "05": return { hollow: false, flanged: true, doubleFlange: false, doubleOutput: true, shrinkDisk: false };
    case "08": return { hollow: true, flanged: true, doubleFlange: true, doubleOutput: false, shrinkDisk: false };
    case "0S": return { hollow: true, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: true };
    default: return { hollow: false, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false };
  }
}

/** Yön kodundan (R1/L1/…/V2) yön harfi ve giriş mili adedi. */
export function gearboxShaftDir(code: string | undefined | null): {
  dir: "R" | "L" | "U" | "V";
  inputCount: 1 | 2;
} {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  const dir = (["R", "L", "U", "V"] as const).find((d) => c.startsWith(d)) ?? "R";
  const inputCount = c.endsWith("2") ? 2 : 1;
  return { dir, inputCount };
}

/** Çıkış özelliğinde bu yön geçerli mi (00 ve 04: yalnız R/L). */
export function gearboxDirValid(feature: string | undefined | null, dir: "R" | "L" | "U" | "V"): boolean {
  const f = typeof feature === "string" ? feature.trim() : "";
  if ((f === "00" || f === "04") && (dir === "U" || dir === "V")) return false;
  return true;
}
