// Bölüm → diyagram eşlemesi: hangi sihirbaz/PDF bölümünün başında hangi
// parametrik diyagramın çizileceğini tek yerden belirler. Web bileşeni
// (SectionDiagram) ve PDF (report.tsx) aynı fonksiyonu kullanır.
//
// Eşleme (ham bölüm id'leri; yardımcı 3.x ve köprü 6.x ham 2.x/5.x id taşır):
//   girder 7.1          → ana kiriş kutu kesiti
//   trolley/bridge 5.2  → teker mili (5.2 araba / 6.2 köprü)
//   main/aux 2.1        → halat donanımı (2.1 ana / 3.1 yardımcı)

import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import type { GirderValues } from "@/lib/calc/modules/mainGirder";
import type { HoistValues } from "@/lib/calc/modules/hoistGroup";
import type { TravelValues } from "@/lib/calc/modules/travelGroup";
import type { Diagram } from "./model";
import { girderSectionDiagram } from "./girderSection";
import { wheelShaftDiagram } from "./wheelShaft";
import { reevingDiagram } from "./reeving";
import { drumDiagram } from "./drum";

export function diagramForSection(
  moduleKey: string,
  rawSectionId: string,
  input: CalcInput,
  result: CalcResult
): Diagram | null {
  try {
    if (moduleKey === "girder" && rawSectionId === "7.1") {
      const st = input.girder;
      if (!st) return null;
      const v = result.girder?.values as GirderValues | undefined;
      const i = st.inputs;
      return girderSectionDiagram({
        railHeightMm: i.railHeightMm,
        t1Mm: i.t1Mm, b1Mm: i.b1Mm,
        t2Mm: i.t2Mm, b2Mm: i.b2Mm,
        t3Mm: i.t3Mm, h3Mm: i.h3Mm, t4Mm: i.t4Mm,
        t5Mm: i.t5Mm, b5Mm: i.b5Mm,
        t6Mm: i.t6Mm, b6Mm: i.b6Mm,
        aMm: i.aMm, xMm: i.xMm,
        czMm: v?.czMm, cyMm: v?.cyMm,
      });
    }

    if ((moduleKey === "trolley" || moduleKey === "bridge") && rawSectionId === "5.2") {
      const st = moduleKey === "trolley" ? input.trolley : input.bridge;
      if (!st) return null;
      const v = (moduleKey === "trolley" ? result.trolley : result.bridge)?.values as
        | TravelValues
        | undefined;
      return wheelShaftDiagram({
        spanACm: st.inputs.shaftSpanACm,
        spanBCm: st.inputs.shaftSpanBCm,
        shaftDiaCm: st.inputs.shaftDiaCm,
        wheelLoadKg: v?.maxWheelLoadKg,
        reactionAKg: v?.reactionAKg,
        reactionBKg: v?.reactionBKg,
        maxMomentKgCm: v?.maxMomentKgCm,
      });
    }

    if ((moduleKey === "main" || moduleKey === "aux") && rawSectionId === "2.2.1") {
      const st = moduleKey === "main" ? input.mainHoist : input.auxHoist;
      if (!st) return null;
      const mr = moduleKey === "main" ? result.mainHoist : result.auxHoist;
      const cells = (mr?.cells ?? {}) as Record<string, number>;
      return drumDiagram({
        drumDiaMm: st.selections.drumDiaMm,
        ropeDiaMm: st.selections.ropeDiaMm,
        wallThicknessMm: st.inputs.drumWallThicknessMm,
        groovePitchMm: cells.L41,
        minDiaMm: cells.L38,
        material: st.selections.drumMaterial,
      });
    }

    if ((moduleKey === "main" || moduleKey === "aux") && rawSectionId === "2.1") {
      const st = moduleKey === "main" ? input.mainHoist : input.auxHoist;
      if (!st) return null;
      const v = (moduleKey === "main" ? result.mainHoist : result.auxHoist)?.values as
        | HoistValues
        | undefined;
      return reevingDiagram({
        drivenFalls: st.inputs.drivenFalls,
        totalFalls: st.inputs.totalFalls,
        drumDiaMm: st.selections.drumDiaMm,
        loadKg: v?.totalLoadKg,
      });
    }
  } catch {
    // Diyagram hiçbir zaman hesabı/raporu düşürmez
    return null;
  }
  return null;
}
