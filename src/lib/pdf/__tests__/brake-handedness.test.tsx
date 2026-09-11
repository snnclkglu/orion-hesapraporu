import { expect, it } from "vitest";
import fs from "node:fs";
import { HOIST_SELECTION_FIELDS } from "@/lib/calc/fields";
import { selectionDefsForReport, renderReportPdf } from "../report";
import { requestFixture } from "@/lib/auto-selection/__tests__/fixtures";
import { selectionCalcInput } from "@/lib/auto-selection/solver";
import { withDerivedHoist } from "@/lib/calc/state";
import { runCalc } from "@/lib/calc/engine";

it("fren yönü PDF seçimlerine girer; manyetik frenin çıktısına girmez", async () => {
  const request = requestFixture(); request.specs.hoistBrakeType = "Eldro Fren";
  request.modules.main = withDerivedHoist({ ...request.modules.main, selections: { ...request.modules.main.selections, brakeQty: 4, brakeHandedness: "4 sol" } }, request.specs, "main");
  const fields = HOIST_SELECTION_FIELDS.filter(f => f.key === "brakeHandedness");
  expect(selectionDefsForReport(fields, { brakeQty: 4, brakeHandedness: "4 sol" }, request.specs)).toHaveLength(1);
  expect(selectionDefsForReport(fields, { brakeQty: 1, brakeHandedness: "" }, request.specs)).toHaveLength(0);
  expect(selectionDefsForReport(fields, { brakeQty: 4, brakeHandedness: "4 sol" }, { ...request.specs, hoistBrakeType: "Manyetik Fren" })).toHaveLength(0);
  const input = selectionCalcInput(request, request.modules);
  const pdf = await renderReportPdf({ project: { doc_no: "TEHR-11092026-1", name: "FREN DÜZENİ KONTROLÜ", customer: "ORION", crane_type: "Çift Kirişli Gezer Köprülü Vinç" }, revision: { rev_no: 0, label: "V0", issued_at: null }, preparedBy: "ORION", input, result: runCalc(input) });
  fs.mkdirSync(".smoke", { recursive: true }); fs.writeFileSync(".smoke/brake-handedness.pdf", pdf);
  expect(pdf.length).toBeGreaterThan(10000);
}, 60000);
