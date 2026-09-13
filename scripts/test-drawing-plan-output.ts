// Uygulamanın gerçek çıktı üreticileriyle 120 satır ve uzun ad kabul testi.
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  NEW_WORK_TEMPLATE,
  NEW_WORK_DISABLED_MODULES,
} from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
} from "../src/lib/revision-load";
import { deriveDrawingPlan } from "../src/lib/drawing-plan/derive";
import { reconcileDrawingPlan } from "../src/lib/drawing-plan/reconcile";
import { orderedDrawingPlan } from "../src/lib/drawing-plan/presentation";
import {
  buildEquipmentWorkbook,
  buildSummarySections,
  buildEquipmentGroups,
} from "../src/lib/excel/equipment";
import { renderEquipmentPdf } from "../src/lib/pdf/equipment-report";

async function main() {
  const raw = {
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      hasOperatorCabin: "yes",
      electricalAccommodationType: "room",
    },
    disabledModules: NEW_WORK_DISABLED_MODULES,
  } as RevisionInputsJson;
  const input = calcInputFromRevision(raw, null),
    result = runCalc(input);
  const rows = reconcileDrawingPlan(
    [],
    deriveDrawingPlan(input, raw).candidates,
  ).rows;
  const parentId = rows.find((r) => r.sourceKey === "trolley:assembly")!.id;
  while (rows.length < 120) {
    const i = rows.length;
    rows.push({
      id: `test-${i}`,
      code: String(5000 + i * 10),
      name: `TEST GRUBU ${i} · KALDIRMA MEKANİZMASI BAKIM PLATFORMU VE KORKULUK BAĞLANTI DETAYLARI`,
      parentId,
      sortOrder: i + 100,
      status: "bekliyor",
      drawnBy: null,
      drawnByName: "",
      note: "",
      origin: "manual",
    });
  }
  const drawingPlan = { itemNo: "0045-00", rows };
  const meta = {
    docNo: "0045-00",
    projectName: "TEKNİK RESİM ÇIKTI KONTROLÜ · TEST VERİSİ",
    customer: "TEST",
    revNo: 0,
    revLabel: "TEST",
    date: "12.09.2026",
    preparedBy: "",
    checkedBy: "",
  };
  const note = "TEST NOTU: NUMARALANDIRMA BU NOTTAN SONRA GELİR.";
  const summary = buildSummarySections(input, result, drawingPlan, note);
  assert.equal(summary.at(-1)?.kind, "drawingPlan");
  const book = buildEquipmentWorkbook(input, result, meta, {
    drawingPlan,
    drawingNote: note,
  });
  mkdirSync(".test-output", { recursive: true });
  await book.xlsx.writeFile(".test-output/drawing-plan-120.xlsx");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.readFile(".test-output/drawing-plan-120.xlsx");
  const worksheet = reopened.getWorksheet("Teknik Ressam Özeti")!;
  const values: string[] = [];
  let noteRow = 0,
    planRow = 0;
  worksheet.eachRow((row, index) =>
    row.eachCell((cell) => {
      if (cell.isMerged && cell.master.address !== cell.address) return;
      if (typeof cell.value === "string" && /^0045-00-\d{4}$/.test(cell.value))
        values.push(cell.value);
      if (
        String(cell.value ?? "")
          .toLocaleUpperCase("tr-TR")
          .includes("TEST NOTU")
      )
        noteRow = index;
      if (
        String(cell.value ?? "")
          .toLocaleUpperCase("tr-TR")
          .includes("TEKNİK RESİM NUMARALANDIRMASI")
      )
        planRow = index;
    }),
  );
  assert.deepEqual(
    values,
    orderedDrawingPlan(rows).map(({ row }) => `0045-00-${row.code}`),
  );
  assert.ok(noteRow > 0 && planRow > noteRow);
  const customer = buildEquipmentWorkbook(input, result, meta, {
    drawingPlan,
    scope: "customer",
  });
  assert.equal(customer.worksheets.length, 1);
  writeFileSync(
    ".test-output/drawing-plan-120.pdf",
    await renderEquipmentPdf({
      groups: buildEquipmentGroups(input),
      summary,
      meta,
    }),
  );
  writeFileSync(
    ".test-output/drawing-plan-expected.json",
    JSON.stringify(values),
  );
  console.log(
    "120 resim numarası, ağaç sırası, sıfırlar, not sırası ve müşteri kapsamı doğrulandı. PDF görsel kontrol için üretildi.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
