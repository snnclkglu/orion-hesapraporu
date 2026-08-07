// Bölüm → diyagram eşlemesi: hangi sihirbaz/PDF bölümünün başında hangi
// parametrik diyagramın çizileceğini tek yerden belirler. Web bileşeni
// (SectionDiagram) ve PDF (report.tsx) aynı fonksiyonu kullanır.
//
// Eşleme (ham bölüm id'leri; yardımcı 3.x ve köprü 6.x ham 2.x/5.x id taşır):
//   girder 7.1          → ana kiriş kutu kesiti
//   yürütme 5.2         → teker mili (tüm arabalar ve köprü)
//   yürütme 5.8         → tampon enerji/kuvvet–strok grafikleri (5.8 · 6.9)
//   kaldırma 2.1        → halat donanımı (ana / yardımcı / monoray)
//   kaldırma 2.2.3      → tambur mili yükleme şeması (A…G ölçü zinciri)
//   kaldırma 2.2.5      → mil kaynağı kesiti (namlu · yanak · göbek · G kolu)
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
import { HYDRAULIC_DAMPING_EFFICIENCY } from "@/lib/calc/buffer";
import {
  GIRDER_ELASTIC_MODULUS_KG_CM2,
  type GirderValues,
} from "@/lib/calc/modules/mainGirder";
import type { BucklingValues } from "@/lib/calc/modules/buckling";
import { BUCKLING_CASE_LABEL, LOAD_CASE_LABEL } from "@/lib/calc/plate-buckling";
import { cmToMm, mmToCm } from "@/lib/calc/modules/hoistGroup";
import type { HoistValues } from "@/lib/calc/modules/hoistGroup";
import type { TravelValues } from "@/lib/calc/modules/travelGroup";
import type { Diagram } from "./model";
import { girderSectionDiagram } from "./girderSection";
import {
  bucklingFactorChart,
  bucklingInteractionChart,
  bucklingPanelLayoutDiagram,
  panelStressDiagram,
  rhoReductionChart,
  rhoPoint,
  rhoShearPoint,
} from "./buckling";
import { bufferDiagram } from "./buffer";
import { wheelShaftDiagram } from "./wheelShaft";
import { reevingDiagram } from "./reeving";
import { drumDiagram } from "./drum";
import { drumShaftDiagram } from "./drumShaft";
import { shaftWeldDiagram } from "./shaftWeld";
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

    if (isTravelKey(moduleKey as ModuleKey) && rawSectionId === "5.8") {
      const travelKey = moduleKey as TravelKey;
      const st = input[travelKey];
      const v = result[travelKey]?.values as TravelValues | undefined;
      if (!st || !v) return null;
      if (v.bufferType === "yok") return null;
      return bufferDiagram({
        type: v.bufferType,
        model: st.selections.bufferModel,
        strokeMm: st.selections.bufferStrokeMm,
        strokeUsedMm: v.bufferStrokeUsedMm,
        totalEnergyKj: v.totalEnergyKj,
        catalogEnergyKj: st.selections.bufferEnergyKj,
        reactionForceKn: v.bufferForceKn,
        catalogMaxForceKn: st.selections.bufferLoadKn,
        energyCurve: st.selections.bufferEnergyCurve,
        forceCurve: st.selections.bufferForceCurve,
        maxCompressionPct: st.selections.bufferMaxCompressionPct,
        compressionPct: v.bufferCompressionPct,
        dampingEfficiency: HYDRAULIC_DAMPING_EFFICIENCY,
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
        loadBandCm: v?.shaftLoadBandCm,
        loadIntensityKgPerCm: v?.shaftLoadIntensityKgPerCm,
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
      // Ölçüler girdide mm; motorun cm çıktıları (halat konumları, ağırlık
      // merkezi) tek yardımcıyla (`cmToMm`) mm'ye çevrilir — şema mm çizer.
      return drumShaftDiagram({
        aMm: i.drumSpanAMm, bMm: i.drumSpanBMm, cMm: i.drumSpanCMm, dMm: i.drumSpanDMm,
        eMm: i.drumSpanEMm, fMm: i.drumSpanFMm, gMm: i.drumSpanGMm,
        d1Mm: i.shaftD1Mm, d2Mm: i.shaftD2Mm,
        drumDiaMm: st.selections.drumDiaMm,
        ropeLoadKg: v?.ropeLoadPerPointKg,
        drumWeightKg: i.drumWeightKg,
        ropePositionsMm: v?.ropeLoadPositionsCm?.map(cmToMm),
        weightArmMm: v?.drumWeightArmCm === undefined ? undefined : cmToMm(v.drumWeightArmCm),
        reactionGearboxKg: v?.reactionGearboxKg,
        reactionBearingKg: v?.reactionBearingKg,
        momentGearboxKgCm: v?.momentGearboxKgCm,
        momentBearingKgCm: v?.momentBearingKgCm,
        positionLabel: i.ropeLoadPosition,
      });
    }

    // 2.2.5 — mil kaynağı kesiti: yükün flanşa uzaklığı (G ölçüsü) ve dikişte
    // doğan eğilme momenti görsel olarak gösterilir.
    if (isHoistKey(moduleKey as ModuleKey) && rawSectionId === "2.2.5") {
      const st = input[HOIST_FIELD[moduleKey as HoistKey]];
      const c = moduleResultOf(result, moduleKey as HoistKey)?.cells;
      if (!st || !c) return null;
      const armCm = numOf(c["shaftWeld.arm"]);
      const momentKgCm = numOf(c["shaftWeld.bendingMoment"]);
      return shaftWeldDiagram({
        drumDiaMm: st.selections.drumDiaMm,
        hubDiaMm: st.inputs.shaftD1Mm,
        shaftDiaMm: st.inputs.shaftD2Mm,
        weldThroatMm: st.inputs.shaftWeldThicknessMm,
        armMm: cmToMm(armCm),
        // Kol hangi mesnetten geliyorsa ölçünün adı da odur (G ya da A).
        // Karşılaştırma motorun kendi dönüşümüyle (mmToCm) yapılır ki
        // hücredeki cm değeriyle birebir aynı sayı elde edilsin.
        armLabel: armCm === mmToCm(st.inputs.drumSpanAMm) ? "A" : "G",
        reactionKg: armCm > 0 ? momentKgCm / armCm : undefined,
        momentKgCm,
        bendingStress: numOf(c["shaftWeld.bendingStress"]),
        shearStress: numOf(c["shaftWeld.shearStress"]),
        combinedStress: numOf(c["shaftWeld.combinedStress"]),
        allowableMPa: numOf(c["shaftWeld.allowable"]),
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
        capacityT: v?.capacityT,
      });
    }
  } catch {
    // Diyagram hiçbir zaman hesabı/raporu düşürmez
    return null;
  }
  return null;
}

/**
 * 8.1 / 8.2 — buruşma görsel seti.
 *
 * Panelin sayıları MOTORUN kendi `values`'ından okunur; diyagram hiçbir fiziği
 * yeniden hesaplamaz. Panel yerleşim şeması yalnız 8.1'de basılır — iki paneli
 * birden gösterdiği için 8.2'de tekrarı raporu gereksiz şişirir.
 *
 * ETKİLEŞİM DİYAGRAMININ MATEMATİĞİ: FEM A-3.4 bağıntısı x = σ/σvcr,ind ve
 * y = τ/τvcr,ind cinsinden yazıldığında kontrol tam olarak
 *   D(x,y) = (1+ψ)/4·x + √([0,25·(3−ψ)·x]² + y²) ≤ ρc/νv
 * koşuluna indirgenir ve kullanım oranı = νv·D/ρc olur. Diyagram bu iki eğriyi
 * (kritik: D = 1, izin verilen: D = ρc/νv) ve çalışma noktasını çizer.
 */
function bucklingDiagrams(
  rawSectionId: string,
  input: CalcInput,
  result: CalcResult
): Diagram[] {
  const st = input.buckling;
  const mr = result.buckling;
  if (!st || !mr) return [];
  const isSide = rawSectionId === "8.1";
  if (!isSide && rawSectionId !== "8.2") return [];

  const v = mr.values as BucklingValues;
  const pv = isSide ? v.side : v.top;
  const gi = input.girder?.inputs;
  const out: Diagram[] = [];

  // 1 — Panel yerleşimi (yalnız 8.1; kesit ana kirişten gelir)
  if (isSide && gi) {
    out.push(
      bucklingPanelLayoutDiagram({
        railHeightMm: gi.railHeightMm,
        t1Mm: gi.t1Mm, b1Mm: gi.b1Mm, t2Mm: gi.t2Mm, b2Mm: gi.b2Mm,
        t3Mm: gi.t3Mm, h3Mm: gi.h3Mm, t4Mm: gi.t4Mm,
        t5Mm: gi.t5Mm, b5Mm: gi.b5Mm, t6Mm: gi.t6Mm, b6Mm: gi.b6Mm,
        aMm: gi.aMm, xMm: gi.xMm,
        sideWidthMm: v.side.panelWidthMm,
        sideLengthMm: v.side.panelLengthMm,
        topWidthMm: v.top.panelWidthMm,
        topLengthMm: v.top.panelLengthMm,
      })
    );
  }

  // 2 — Kenar gerilme dağılımı ve FEM durumu
  out.push(
    panelStressDiagram({
      title: `BURUŞMA — ${isSide ? "YAN SAC" : "ÜST SAC"} PANELİ`,
      sigma1: pv.sigma1,
      sigma2: pv.sigma2,
      tau: pv.case1.tau,
      psi: pv.psi,
      widthMm: pv.panelWidthMm,
      lengthMm: pv.panelLengthMm,
      alpha: pv.alpha,
      caseNo: pv.caseNo,
    })
  );

  // 3 — Kσ / Kτ eğrileri
  out.push(
    bucklingFactorChart({
      alpha: pv.alpha, psi: pv.psi, kSigma: pv.kSigma, kTau: pv.kTau,
    })
  );

  // 4 — Etkileşim diyagramı (eksenler İNDİRGENMİŞ kritik gerilmelerle)
  out.push(
    bucklingInteractionChart({
      sigmaRatio: pv.sigmaVcr > 0 ? pv.case1.sigma / pv.sigmaVcr : NaN,
      tauRatio: pv.tauVcr > 0 ? Math.abs(pv.case1.tau) / pv.tauVcr : 0,
      psi: pv.psiClamped,
      safety: pv.case1.safetyVv,
      rho: pv.case1.rhoCombined,
      utilization: pv.case1.utilization,
      caseLabel: `${BUCKLING_CASE_LABEL[pv.caseNo]} · ${LOAD_CASE_LABEL[1]}`,
    })
  );

  // 5 — ρ indirgemesi: yalnız gerçekten uygulandıysa
  if (pv.reductionApplied || pv.case1.rhoCombined < 1) {
    out.push(
      rhoReductionChart({
        steel: pv.steel,
        points: [
          rhoPoint("σvcr", pv.sigmaVcrElastic, pv.steel),
          rhoShearPoint("τvcr", pv.tauVcrElastic, pv.steel),
          ...(pv.case1.rhoCombined < 1
            ? [rhoPoint("σvcr.c", pv.case1.sigmaVcrCElastic, pv.steel)]
            : []),
        ],
      })
    );
  }
  return out;
}

/**
 * Bölümün TÜM diyagramları, çizim sırasıyla. Çoğu bölüm tek diyagram döndürür;
 * buruşma gibi bölümler bir set döndürür (yerleşim → gerilme → katsayı →
 * etkileşim → indirgeme).
 */
export function diagramsForSection(
  moduleKey: string,
  rawSectionId: string,
  input: CalcInput,
  result: CalcResult
): Diagram[] {
  try {
    if (moduleKey === "buckling") return bucklingDiagrams(rawSectionId, input, result);
  } catch {
    // Diyagram hiçbir zaman hesabı/raporu düşürmez
    return [];
  }
  const one = diagramForSection(moduleKey, rawSectionId, input, result);
  return one ? [one] : [];
}
