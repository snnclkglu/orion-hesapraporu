// VİNÇ ARABASI RAPORU — PDF (yapısal ölçüm).
//
// Yalnız arabanın yenilendiği işte köprü tarafı rapora hiç girmez. PDF metni
// gömülü font alt kümeleriyle yazıldığı için başlıklar aranmaz; bölümlerin
// varlığı PageProbe/SectionProbe ÇAPALARINDAN ölçülür.
//
// Kilitlenen üç şey — üçü de "müşteri gizlendiğini anlamasın" şartıdır:
//   1. Kapalı bölümün çapası hiç oluşmaz (sayfası basılmaz, içindekilerde yer
//      almaz).
//   2. Basılan bölümlerin numaraları BOŞLUKSUZDUR: rapordan düşen bölüm
//      kendinden sonrakileri bir öne çeker.
//   3. Teknik özellik tablosu köprüye ait alanları taşımaz ve toplam ağırlık
//      BASILAN satırlardan türer (aritmetikten sızıntı olmaz).

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { moduleDisplayNumbers } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { TROLLEY_ONLY_DISABLED_MODULES } from "@/lib/crane-types";
import { ReportDocument, summarySpecsForReport, type ReportProps } from "@/lib/pdf/report";

const SPECS = NEW_WORK_TEMPLATE.specs;

function calcFor(disabled: readonly string[]): CalcInput {
  const src = NEW_WORK_TEMPLATE as unknown as Record<string, unknown>;
  const active = activeModules(SPECS, disabled);
  const out: Record<string, unknown> = { specs: SPECS };
  for (const key of MODULE_ORDER) {
    if (!active.has(key)) continue;
    out[CALC_FIELD[key]] = src[CALC_FIELD[key]];
  }
  return out as unknown as CalcInput;
}

const input = calcFor([...TROLLEY_ONLY_DISABLED_MODULES]);
const result = runCalc(input);
const props: ReportProps = {
  project: {
    doc_no: "0061-01",
    name: "Vinç Arabası Yenileme",
    customer: "Örnek Müşteri",
    crane_type: "Vinç Arabası",
  },
  revision: { rev_no: 0, label: "V0", issued_at: null },
  preparedBy: "Sinan Çolakoğlu",
  input,
  result,
};

describe("vinç arabası raporu — PDF", () => {
  it("köprü tarafının hiçbir bölümü basılmaz, kalanlar basılır", async () => {
    const collected = new Set<string>();
    await renderToBuffer(
      <ReportDocument {...props} collect={(anchor) => collected.add(anchor)} />
    );

    for (const key of TROLLEY_ONLY_DISABLED_MODULES) {
      expect(collected.has(`bolum-${key}`), key).toBe(false);
    }
    expect(collected.has("bolum-main")).toBe(true);
    expect(collected.has("bolum-hookBlock")).toBe(true);
    expect(collected.has("bolum-trolley")).toBe(true);
    // Araba bölümünün alt bölümleri yerinde (köprüdeki eşleri yok).
    expect(collected.has("sec-trolley-5.1")).toBe(true);
    expect(collected.has("sec-bridge-5.1")).toBe(false);
  }, 240_000);

  it("bölüm numaraları boşluksuzdur", () => {
    // PDF'in kullandığı yüklemin aynısı: girdisi VE sonucu olan bölümler.
    const present = (k: (typeof MODULE_ORDER)[number]) =>
      (input as unknown as Record<string, unknown>)[CALC_FIELD[k]] !== undefined &&
      (result as unknown as Record<string, unknown>)[CALC_FIELD[k]] !== undefined;
    const seri = Object.values(moduleDisplayNumbers(present)).sort((a, b) => a - b);
    expect(seri.length).toBeGreaterThan(0);
    seri.forEach((n, i) => expect(n).toBe(i + 2));
  });

  it("teknik özellik tablosu köprü alanlarını taşımaz", () => {
    const { defs } = summarySpecsForReport(input);
    const anahtarlar = defs.map((f) => f.key);
    for (const k of [
      "bridgeSpeedMpm",
      "bridgeMechanismClass",
      "bridgeUsageClass",
      "bridgePowerSupply",
      "bridgeBufferType",
      "bridgeWeightT",
      "runwayLengthM",
    ]) {
      expect(anahtarlar, k).not.toContain(k);
    }
    // Arabanın kendi alanları ve açıklık yerinde.
    expect(anahtarlar).toContain("trolleySpeedMpm");
    expect(anahtarlar).toContain("mainTrolleyWeightT");
    expect(anahtarlar).toContain("spanM");
  });

  it("toplam ağırlık BASILAN satırlardan türer ve adı kapsamı söyler", () => {
    const { defs, source } = summarySpecsForReport(input);
    const toplam = defs.find((f) => f.key === "summaryCraneTotalWeightT")!;
    // Köprü ağırlığı basılmıyor → toplamın adı da "vinç" demez.
    expect(toplam.label).toBe("Toplam Ağırlık");
    const beklenen =
      (SPECS.mainTrolleyWeightT ?? 0) +
      (input.mainHoist!.inputs.hookBlockWeightKg ?? 0) / 1000;
    expect(source.summaryCraneTotalWeightT).toBeCloseTo(beklenen, 6);

    // Karşılaştırma: köprü açıkken hem ad hem toplam köprüyü içerir.
    const tam = calcFor([]);
    const { defs: tamDefs, source: tamSource } = summarySpecsForReport(tam);
    expect(tamDefs.find((f) => f.key === "summaryCraneTotalWeightT")!.label).toBe(
      "Vinç Toplam Ağırlığı"
    );
    expect(tamSource.summaryCraneTotalWeightT).toBeCloseTo(
      beklenen + (SPECS.bridgeWeightT ?? 0),
      6
    );
  });

  it("ek ağırlık satırları ağırlık öbeğinin SONUNDA durur", () => {
    // Yerleşim çapası tek bir alana bağlı olsaydı (köprü ağırlığı), o alan
    // düştüğünde iki satır tablonun en dibine kayardı.
    const { defs } = summarySpecsForReport(input);
    const i = defs.findIndex((f) => f.key === "summaryAttachmentWeightT");
    expect(i).toBeGreaterThan(0);
    expect(defs[i - 1].group).toBe("weights");
    expect(defs[i + 1].key).toBe("summaryCraneTotalWeightT");
  });
});
