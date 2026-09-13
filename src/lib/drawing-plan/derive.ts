// Hesapta tanımlanmış montajlardan resim kapsamı çıkarır; ağırlık tahmini kullanmaz.
import type { CalcInput } from "../calc/engine";
import { activeModules } from "../calc/engine";
import {
  MODULE_ORDER,
  isHoistKey,
  HOOKBLOCK_OF,
  MODULE_LABELS,
} from "../calc/presentation/module-family";
import { moduleState } from "../calc/presentation/module-access";
import {
  doubleDrumHookSystem,
  hasSafetyBrake,
  hoistEquipmentArrangement,
  travelArrangement,
} from "../calc/types";
import { hoistReeving, type HoistInputs } from "../calc/modules/hoistGroup";
import { deriveReeving, validateReeving } from "../calc/reeving";
import { hoistTrolleyKey } from "../weights/defter";
import type { RevisionInputsJson } from "../revision-load";
import { adBuyuk } from "../tr-text";
import {
  DRAWING_PLAN_VERSION,
  type DrawingCandidate,
  type DrawingDerivation,
} from "./types";

export function deriveDrawingPlan(
  input: CalcInput,
  raw?: RevisionInputsJson,
  craneType = "",
): DrawingDerivation {
  const specs = input.specs;
  const declared = raw?.specs ?? specs;
  const active = activeModules(specs, raw?.disabledModules ?? []);
  const candidates: DrawingCandidate[] = [];
  const warnings: string[] = [];
  const add = (
    key: string,
    name: string,
    reason: string,
    block: DrawingCandidate["block"] = "general",
    parentKey: string | null = null,
    assembly = false,
    optional = false,
  ) => {
    candidates.push({
      key,
      name: adBuyuk(name),
      reason,
      block,
      parentKey,
      assembly,
      optional,
    });
  };
  const fixed = travelArrangement(specs) === "fixed";
  if (active.has("bridge"))
    add(
      "bridge:travel",
      "KÖPRÜ YÜRÜTME GRUBU",
      "Köprü yürütme hesap kapsamında.",
    );
  if (["girder", "girder2", "endCarriage"].some((key) => active.has(key))) {
    add(
      "bridge:structure",
      "VİNÇ ÇELİK YAPI",
      "Taşıyıcı yapı hesap kapsamında.",
    );
    add(
      "bridge:platform",
      "PLATFORM VE KORKULUK",
      "Bağımsız platform resmi gerekiyorsa ekleyin.",
      "general",
      null,
      false,
      true,
    );
    add(
      "bridge:lifeline",
      "SABİT YAŞAM HATTI",
      "Yaşam hattının kapsamını mühendis belirler.",
      "general",
      null,
      false,
      true,
    );
    if (/portal/i.test(craneType))
      add(
        "bridge:legs",
        "AYAKLAR VE PORTAL YAPISI",
        "Proje tipi portal; resim kapsamını doğrulayın.",
        "general",
        null,
        false,
        true,
      );
  }
  if (declared.hasOperatorCabin === "yes")
    add(
      "cabin:operator",
      "OPERATÖR KABİNİ",
      "Teknik özelliklerde operatör kabini var.",
    );
  if (declared.electricalAccommodationType === "room")
    add(
      "cabin:room",
      declared.electricalRoomHasAirConditioner === "yes"
        ? "ELEKTRİK ODASI & KLİMALAR"
        : "ELEKTRİK ODASI",
      "Elektrik yerleşimi oda olarak tanımlı.",
    );
  if (declared.electricalAccommodationType === "panel")
    add(
      "cabin:panels",
      "ELEKTRİK PANOLARI",
      "Elektrik yerleşimi pano olarak tanımlı.",
    );
  if (
    (declared.hasOperatorCabin === "yes" ||
      ["room", "panel"].includes(declared.electricalAccommodationType ?? "")) &&
    !active.has("cabin")
  )
    warnings.push(
      "Kabin/elektrik mahalli tanımlı; ilgili hesap bölümü kapalı. Fiziksel mahaller planda korundu.",
    );
  const supplies = {
    trolley: declared.trolleyPowerSupply,
    auxTrolley: declared.auxTrolleyPowerSupply,
    mono1Trolley: declared.mono1TrolleyPowerSupply,
    mono2Trolley: declared.mono2TrolleyPowerSupply,
    bridge: declared.bridgePowerSupply,
  };
  const supplyNames = {
    festoon: "FESTON HATTI",
    cableChain: "KABLO ZİNCİRİ GRUBU",
    conductorBar: "BARA HATTI",
    cableReel: "KABLO TAMBURU",
  };
  for (const [axis, supply] of Object.entries(supplies)) {
    if (!fixed && active.has(axis) && supply)
      add(
        `${axis}:supply`,
        `${MODULE_LABELS[axis as keyof typeof MODULE_LABELS].replace(" Yürütme", "")} ${supplyNames[supply]}`,
        "Hareket ekseninin enerji besleme seçimi.",
      );
  }
  if (fixed)
    add(
      "fixed:assembly",
      "SABİT KALDIRMA DÜZENİ",
      "Yürütmesiz kaldırma düzeni.",
      "main",
      null,
      true,
    );
  const assemblies = new Set<string>();
  for (const hoist of MODULE_ORDER.filter(isHoistKey)) {
    if (!active.has(hoist)) continue;
    const mono = hoist === "mono1" || hoist === "mono2";
    const axis = hoistTrolleyKey(specs, hoist);
    const block = mono ? hoist : axis === "auxTrolley" ? "auxiliary" : "main";
    const parent = fixed ? "fixed:assembly" : `${axis}:assembly`;
    if (!fixed && !assemblies.has(parent)) {
      assemblies.add(parent);
      add(
        parent,
        mono
          ? `${MODULE_LABELS[hoist]} KOMPLESİ`
          : axis === "auxTrolley"
            ? "İKİNCİ ARABA KOMPLESİ"
            : "ANA ARABA KOMPLESİ",
        "Kaldırmanın fiziksel taşıyıcı grubu.",
        block,
        null,
        true,
      );
      if (!mono) {
        add(
          `${axis}:travel`,
          "ARABA YÜRÜTME GRUBU",
          "Bu arabanın ortak yürütme grubu.",
          block,
          parent,
        );
        add(
          `${axis}:frame`,
          "ARABA ŞASİ",
          "Kaldırmaları taşıyan ortak şasi.",
          block,
          parent,
        );
      }
      add(
        `${axis}:platform`,
        "ARABA BAKIM PLATFORMU",
        "Bağımsız platform resmi gerekiyorsa ekleyin.",
        block,
        parent,
        false,
        true,
      );
      add(
        `${axis}:panels`,
        "ARABA ELEKTRİK PANOSU",
        "Araba üzerinde ayrı pano varsa ekleyin.",
        block,
        parent,
        false,
        true,
      );
    }
    if (mono) {
      warnings.push(
        `${MODULE_LABELS[hoist]}: hazır komple donanımın alt imalat resimlerini gerekirse elle ekleyin.`,
      );
      continue;
    }
    const prefix = MODULE_LABELS[hoist];
    const arrangement = hoistEquipmentArrangement(specs, hoist);
    const reason =
      arrangement === "standard"
        ? "Aktif kaldırma mekanizması."
        : `${arrangement === "twin" ? "İkiz" : "Çift tambur"} düzen; fiziksel tekrar tek başına farklı resim değildir.`;
    add(`hoist:${hoist}:drum`, `${prefix} TAMBUR GRUBU`, reason, block, parent);
    add(
      `hoist:${hoist}:drive`,
      `${prefix} TAHRİK GRUBU`,
      reason,
      block,
      parent,
    );
    const inputs = moduleState(input, hoist)?.inputs as HoistInputs | undefined;
    if (inputs) {
      const rig = hoistReeving(inputs);
      if (validateReeving(rig).length === 0) {
        if (deriveReeving(rig).topSheaveCount > 0)
          add(
            `hoist:${hoist}:upper`,
            `${prefix} ÜST MAKARA GRUBU`,
            "Halat donanımında üst makara bulunuyor.",
            block,
            parent,
          );
      } else
        warnings.push(
          `${prefix}: halat donanımını doğrulayın; üst makara grubu kesinleştirilemedi.`,
        );
      if (inputs.ropeBalancingType !== "none" && inputs.ropeBalancingType)
        add(
          `hoist:${hoist}:balance`,
          `${prefix} ${inputs.ropeBalancingType === "equalizerBeam" ? "DENGE TRAVERSİ" : "DENGE MAKARASI GRUBU"}`,
          "Halat dengeleme seçimi.",
          block,
          parent,
        );
    }
    if (hasSafetyBrake(specs, hoist))
      add(
        `hoist:${hoist}:safety`,
        `${prefix} EMNİYET FRENİ GRUBU`,
        "Bu kaldırmada emniyet freni tanımlı.",
        block,
        parent,
      );
    if (active.has(HOOKBLOCK_OF[hoist])) {
      const beam =
        arrangement === "doubleDrum" &&
        doubleDrumHookSystem(specs, hoist) === "liftingBeam";
      add(
        `hoist:${hoist}:hook`,
        `${prefix} ${beam ? "KALDIRMA KİRİŞİ" : "KANCA BLOĞU"}`,
        "Seçili alt yük taşıma düzeni.",
        block,
        parent,
      );
    }
  }
  // Yalnız planı değiştiren değerler izlenir; motor markası değiştirmek planı yenilemez.
  return {
    candidates,
    warnings,
    fingerprint: JSON.stringify([DRAWING_PLAN_VERSION, candidates, warnings]),
  };
}
