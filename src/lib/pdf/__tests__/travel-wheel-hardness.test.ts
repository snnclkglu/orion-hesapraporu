import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import { selectionDefsForReport } from "@/lib/pdf/report";
import { MODULE_ADAPTERS } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

const wheelSection = MODULE_ADAPTERS.find((a) => a.key === "trolley")!
  .sections.find((s) => s.rawId === "5.1")!;

function withHardness(wheelHardness: string): CalcInput {
  return {
    ...NEW_WORK_TEMPLATE,
    trolley: {
      ...NEW_WORK_TEMPLATE.trolley!,
      selections: {
        ...NEW_WORK_TEMPLATE.trolley!.selections,
        wheelHardness,
      },
    },
  };
}

function trolleyWheelSpec(input: CalcInput): string {
  return buildEquipmentGroups(input)
    .flatMap((group) => group.rows)
    .find((row) => row.rowKey === "trolley:wheel")!.spec;
}

describe("yürütme tekeri sertliği — rapor çıktıları", () => {
  it("varsayılan sertliği hesap raporunun seçim tablosunda gösterir", () => {
    const selections = NEW_WORK_TEMPLATE.trolley!.selections as unknown as Record<string, unknown>;
    const keys = selectionDefsForReport(wheelSection.selectionDefs, selections).map((f) => f.key);
    expect(keys).toContain("wheelHardness");
  });

  it("Yok seçildiğinde hesap raporundaki sertlik satırını tamamen düşürür", () => {
    const selections = {
      ...NEW_WORK_TEMPLATE.trolley!.selections,
      wheelHardness: "Yok",
    } as unknown as Record<string, unknown>;
    const keys = selectionDefsForReport(wheelSection.selectionDefs, selections).map((f) => f.key);
    expect(keys).not.toContain("wheelHardness");
  });

  it("ekipman satırına yalnız seçilmiş bir sertlik değerini yazar", () => {
    expect(trolleyWheelSpec(withHardness("32-35 HRC")).toLocaleLowerCase("tr-TR"))
      .toContain("sertlik 32-35 hrc");
    const without = trolleyWheelSpec(withHardness("Yok")).toLocaleLowerCase("tr-TR");
    expect(without).not.toContain("sertlik");
    expect(without).not.toContain("HRC");
  });
});
