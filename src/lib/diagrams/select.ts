// Bölüm → diyagram eşlemesi: hangi sihirbaz/PDF bölümünün başında hangi
// parametrik diyagramın çizileceğini tek yerden belirler. Web bileşeni
// (SectionDiagram) ve PDF (report.tsx) aynı fonksiyonu kullanır.
//
// Eşleme (ham bölüm id'leri; yardımcı 3.x ve köprü 6.x ham 2.x/5.x id taşır):
//   girder 7.1          → ana kiriş kutu kesiti
//   yürütme 5.2         → teker mili (tüm arabalar ve köprü)
//   kaldırma 2.1        → halat donanımı (ana / yardımcı / monoray)
//   kaldırma 2.2.3      → tambur mili yükleme şeması (A…G ölçü zinciri)
//   kanca bloğu 4.4     → kanca bloğu mili (makara sayısına göre dinamik)
//   teker yükleri 10.2   → önden görünüş (Pmaks / Pmin, teker adedine göre)
//   teker yükleri 10.3   → savrulma plan şeması (kayma kutbu + kuvvet okları)
//   teker yükleri 10.5   → yük özeti (bütün kuvvet bileşenleri iki görünüşte)
//
// Dallanma AİLE YÜKLEMLERİYLE yapılır (isHoistKey/isHookBlockKey/isTravelKey);
// yeni bir kaldırma grubu eklendiğinde burada değişiklik gerekmez.

import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import {
  HOIST_FIELD,
  moduleResult as moduleResultOf,
} from "@/lib/calc/presentation/module-access";
import {
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type HoistKey,
  type ModuleKey,
  type TravelKey,
} from "@/lib/calc/presentation/module-family";
import { camberProfile } from "@/lib/calc/camber";
import {
  GIRDER_ELASTIC_MODULUS_KG_CM2,
  type GirderValues,
} from "@/lib/calc/modules/mainGirder";
import type { HoistValues } from "@/lib/calc/modules/hoistGroup";
import type { TravelValues } from "@/lib/calc/modules/travelGroup";
import type { Diagram } from "./model";
import { girderSectionDiagram } from "./girderSection";
import { wheelShaftDiagram } from "./wheelShaft";
import { reevingDiagram } from "./reeving";
import { drumDiagram } from "./drum";
import { drumShaftDiagram } from "./drumShaft";
import { hookBlockShaftDiagram } from "./hookBlockShaft";
import { safetyBrakeDiagram } from "./safetyBrake";
import { deflectionDiagram } from "./deflection";
import { camberStripDiagram } from "./camberStrip";
import { girderLoadDiagram } from "./girderLoad";
import { girderStressDiagram } from "./girderStress";
import {
  loadSummaryDiagram,
  skewPlanDiagram,
  wheelLoadElevationDiagram,
} from "./wheelLoads";

/** cells hücresi sayı ise değeri, değilse NaN — diyagram girdilerini korur. */
const numOf = (v: number | string | undefined): number =>
  typeof v === "number" ? v : NaN;

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

    if (moduleKey === "girder" && rawSectionId === "7.2") {
      const st = input.girder;
      const mr = result.girder;
      if (!st || !mr) return null;
      const c = (mr.cells ?? {}) as Record<string, number>;
      return girderLoadDiagram({
        spanM: input.specs.spanM,
        wheelSpacingMm: st.inputs.trolleyAxleSpacingM * 1000,
        wheelLoadKg: (c["load.trolleyWheelLoad"] ?? 0) + (c["load.hoistWheelLoad"] ?? 0),
        selfWeightKg: c["load.bridgeDeadWeight"],
        liveLoadKg: c["load.hoistLoad"],
        momentKgCm: c["moment.verticalTotal"],
      });
    }

    if (moduleKey === "girder" && rawSectionId === "7.4") {
      const st = input.girder;
      const mr = result.girder;
      if (!st || !mr) return null;
      const c = (mr.cells ?? {}) as Record<string, number>;
      const v = mr.values as GirderValues | undefined;
      const i = st.inputs;
      return girderStressDiagram({
        railHeightMm: i.railHeightMm,
        t1Mm: i.t1Mm, b1Mm: i.b1Mm,
        t2Mm: i.t2Mm, b2Mm: i.b2Mm,
        t3Mm: i.t3Mm, h3Mm: i.h3Mm, t4Mm: i.t4Mm,
        t5Mm: i.t5Mm, b5Mm: i.b5Mm,
        t6Mm: i.t6Mm, b6Mm: i.b6Mm,
        aMm: i.aMm, xMm: i.xMm,
        czMm: v?.czMm, cyMm: v?.cyMm,
        sigma1SelfWeight: c["stress.sigmaXSelfWeightBottom"],
        sigma2Trolley: c["stress.sigmaXTrolleyBottom"],
        sigma3Hoist: c["stress.sigmaXHoistBottom"],
        sigma4BridgeLateral: c["stress.sigmaXLateralBridgeBottom"],
        sigma5TrolleyLateral: c["stress.sigmaXLateralTrolleyBottom"],
        sigma6RailLever: c["stress.sigmaXRailLeverBottom"],
        sigma7SecondaryTrolley: c["stress.sigmaXSecondaryTrolleyBottom"],
        sigma8SecondaryHoist: c["stress.sigmaXSecondaryHoistBottom"],
        sigma9WheelTrolley: c["stress.sigmaZTrolley"],
        sigma10WheelHoist: c["stress.sigmaZHoist"],
        tau1TorsionTrolley: c["stress.torsionTrolley"],
        tau2TorsionHoist: c["stress.torsionHoist"],
        tau3ShearSelfWeight: c["stress.shearMainSelfWeight"],
        tau4ShearTrolley: c["stress.shearMainTrolley"],
        tau5ShearHoist: c["stress.shearMainHoist"],
        sigmaXBottom: v?.sigmaXBottomCase1,
        sigmaXTop: v?.sigmaXTopCase1,
        sigmaZ: v?.sigmaZCase1,
        tauMain: v?.shearMainCase1,
        tauSecondary: v?.shearSecondaryCase1,
        // Kontrol edilen değerle AYNI kabul: elverişsiz gövde sacının bileşiği
        sigmaComb: v?.sigmaCombBottomCase1,
        allowable: v?.allowableCase1,
      });
    }

    // 10.2 / 10.3 — teker yükleri: önden görünüş ve savrulma plan şeması.
    // İkisi de gerçek teker adedine ve konumlarına göre kendini çizer.
    if (moduleKey === "wheelLoads") {
      const st = input.wheelLoads;
      const v = result.wheelLoads?.values;
      if (!st || !v) return null;
      if (rawSectionId === "10.2") {
        return wheelLoadElevationDiagram({
          spanM: input.specs.spanM,
          minApproachM: input.bridge?.inputs.minApproachM ?? 0,
          wheelsPerSide: v.wheelsPerSide,
          maxWheelLoadKg: v.maxWheelLoadKg,
          minWheelLoadKg: v.minWheelLoadKg,
          designWheelLoadKg: v.designWheelLoadKg,
          hoistLoadKg: v.hoistLoadKg,
          wheelbaseMm: v.wheelbaseMm,
        });
      }
      if (rawSectionId === "10.3") {
        return skewPlanDiagram({
          spanM: input.specs.spanM,
          wheels: v.wheels,
          alphaRad: v.alphaRad,
          poleDistanceM: v.poleDistanceM,
          mu: v.mu,
          guideForceN: v.guideForceN,
          guideMeans: st.selections.guideMeans,
          applicable: v.skewApplicable,
        });
      }
      if (rawSectionId === "10.5") {
        return loadSummaryDiagram({
          maxWheelLoadKg: v.maxWheelLoadKg,
          designWheelLoadKg: v.designWheelLoadKg,
          minWheelLoadKg: v.minWheelLoadKg,
          lateralNearN: v.maxLateralNearN,
          lateralFarN: v.maxLateralFarN,
          guideForceN: v.guideForceN,
          skewLongitudinalN: v.longitudinalSkewPerWheelN,
          driveLongitudinalN: v.longitudinalPerDrivenWheelN,
          bufferForceKn: v.bufferForceKn,
          phi2: v.phi2,
          totalWheels: v.totalWheels,
          wheelsPerCorner: v.wheelsPerCorner,
          wheelsPerSide: v.wheelsPerSide,
          spanM: input.specs.spanM,
          positionsM: v.positionsM,
        });
      }
      return null;
    }

    if (moduleKey === "girder" && rawSectionId === "7.6") {
      const st = input.girder;
      if (!st) return null;
      const v = result.girder?.values as GirderValues | undefined;
      return deflectionDiagram({
        spanM: input.specs.spanM,
        deflectionMm: v?.deflectionMm ?? 0,
        deflectionRatio: v?.deflectionRatio,
        limitRatio: st.inputs.deflectionLimitRatio,
      });
    }

    // 7.7 — atölye kamber şeridi: kotlar hesap satırlarıyla AYNI saf
    // fonksiyondan (camberProfile) üretilir, ikinci bir yöntem yazılmaz.
    if (moduleKey === "girder" && rawSectionId === "7.7") {
      const st = input.girder;
      const c = result.girder?.cells;
      const v = result.girder?.values as GirderValues | undefined;
      if (!st || !c || !v) return null;
      const spanCm = numOf(c["deflection.span"]);
      const inertia = numOf(c["section.inertiaY"]);
      const wheelLoad = numOf(c["deflection.wheelLoad"]);
      if (!(spanCm > 0) || !(inertia > 0)) return null;
      const profile = camberProfile(
        {
          spanCm,
          deadLoadPerCm: v.camberDeadLoadKgPerM / 100,
          wheelLoadKg: wheelLoad,
          wheelSpacingCm: st.inputs.trolleyAxleSpacingM * 100,
          elasticModulus: GIRDER_ELASTIC_MODULUS_KG_CM2,
          inertiaCm4: inertia,
        },
        st.inputs.diaphragmSpacingMm
      );
      return camberStripDiagram({
        spanMm: spanCm * 10,
        stations: profile.stations,
        spacingMm: profile.spacingUsedMm,
        thinned: profile.thinned,
      });
    }

    // 2.8 — emniyet freni montaj ve ölçü şeması (yalnız freni olan grupta)
    if (isHoistKey(moduleKey as ModuleKey) && rawSectionId === "2.8") {
      const hoistKey = moduleKey as HoistKey;
      const st = input[HOIST_FIELD[hoistKey]];
      const c = moduleResultOf(result, hoistKey)?.cells;
      if (!st || !c) return null;
      return safetyBrakeDiagram({
        flangeDiaMm: st.selections.safetyBrakeFlangeDiaMm,
        minFlangeDiaMm: numOf(c["safety.minFlangeDia"]),
        drumDiaMm: st.selections.drumDiaMm,
        brakeCount: numOf(c["safety.brakeCount"]),
        arrangement: st.selections.safetyBrakeArrangement,
        model: st.selections.safetyBrakeModel,
        minThicknessMm: numOf(c["safety.minDiscThickness"]),
        torqueEachNm: numOf(c["safety.torqueEach"]),
        totalTorqueNm: numOf(c["safety.totalTorque"]),
        demandTorqueNm: numOf(c["safety.demandTorque"]),
      });
    }

    if (isTravelKey(moduleKey as ModuleKey) && rawSectionId === "5.2") {
      const travelKey = moduleKey as TravelKey;
      const st = input[travelKey];
      if (!st) return null;
      const v = result[moduleKey as TravelKey]?.values as
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

    if (isHoistKey(moduleKey as ModuleKey) && rawSectionId === "2.2.1") {
      const st = input[HOIST_FIELD[moduleKey as HoistKey]];
      if (!st) return null;
      const mr = result[HOIST_FIELD[moduleKey as HoistKey]];
      const cells = (mr?.cells ?? {}) as Record<string, number>;
      return drumDiagram({
        drumDiaMm: st.selections.drumDiaMm,
        ropeDiaMm: st.selections.ropeDiaMm,
        wallThicknessMm: st.inputs.drumWallThicknessMm,
        groovePitchMm: cells["drum.groovePitch"],
        minDiaMm: cells["drum.minDia"],
        material: st.selections.drumMaterial,
      });
    }

    if (isHookBlockKey(moduleKey as ModuleKey) && rawSectionId === "4.4") {
      const st = input.hookBlock;
      const v = result.hookBlock?.values;
      if (!st || !v) return null;
      const i = st.inputs;
      return hookBlockShaftDiagram({
        positionsCm: v.sheavePositionsCm,
        spanCm: v.shaftSpanCm,
        edgeGapCm: i.shaftEdgeGapCm,
        pitchCm: i.shaftSheavePitchCm,
        centerGapCm: i.shaftCenterGapCm,
        d1Cm: i.shaftD1Cm,
        sheaveDiaMm: st.selections.sheaveDiaMm,
        ropeLoadKg: v.ropeLoadKg,
        reactionAKg: v.reactionAKg,
        reactionBKg: v.reactionBKg,
        maxMomentKgCm: v.shaftMomentKgCm,
        bearingCode: st.selections.sheaveBearingCode,
      });
    }

    if (isHoistKey(moduleKey as ModuleKey) && rawSectionId === "2.2.3") {
      const st = input[HOIST_FIELD[moduleKey as HoistKey]];
      if (!st) return null;
      const v = result[HOIST_FIELD[moduleKey as HoistKey]]?.values as
        | HoistValues
        | undefined;
      const i = st.inputs;
      return drumShaftDiagram({
        aCm: i.drumSpanACm, bCm: i.drumSpanBCm, cCm: i.drumSpanCCm, dCm: i.drumSpanDCm,
        eCm: i.drumSpanECm, fCm: i.drumSpanFCm, gCm: i.drumSpanGCm,
        d1Cm: i.shaftD1Cm, d2Cm: i.shaftD2Cm,
        drumDiaMm: st.selections.drumDiaMm,
        ropeLoadKg: v?.ropeLoadPerPointKg,
        drumWeightKg: i.drumWeightKg,
        ropePositionsCm: v?.ropeLoadPositionsCm,
        weightArmCm: v?.drumWeightArmCm,
        reactionGearboxKg: v?.reactionGearboxKg,
        reactionBearingKg: v?.reactionBearingKg,
        momentGearboxKgCm: v?.momentGearboxKgCm,
        momentBearingKgCm: v?.momentBearingKgCm,
        positionLabel: i.ropeLoadPosition,
      });
    }

    if (isHoistKey(moduleKey as ModuleKey) && rawSectionId === "2.1") {
      const st = input[HOIST_FIELD[moduleKey as HoistKey]];
      if (!st) return null;
      const v = result[HOIST_FIELD[moduleKey as HoistKey]]?.values as
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
