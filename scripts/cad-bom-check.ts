import ExcelJS from "exceljs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSheet } from "../src/lib/drawings/excel";
import { parseBomFileName } from "../src/lib/drawings/file-name";

async function main() {
  const [file, raw] = process.argv.slice(2);
  const original = JSON.parse(fs.readFileSync(raw, "utf8"));
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(file);
  assert.equal(book.worksheets.length, 1);
  const rows: string[][] = [];
  book.worksheets[0].eachRow(row => {
    const values: string[] = [];
    for (let n = 1; n <= row.cellCount; n++) values.push(row.getCell(n).text);
    rows.push(values);
  });
  const parsed = readSheet({ fileRelPath: "CAD_MALZEME.xlsx", sheetName: "BOM", rows }, parseBomFileName("CAD_MALZEME.xlsx").kind);
  assert.equal(parsed.rows.length, original.malzeme.length);
  const value = (v: unknown) => v == null ? "" : String(v).trim();
  for (let n = 0; n < parsed.rows.length; n++) {
    const row = parsed.rows[n], source = original.malzeme[n];
    assert.equal(row.partNumber, value(source.resim_no));
    assert.equal(row.description, value(source.tanim));
    assert.equal(row.materialRaw, value(source.malzeme));
    assert.equal(row.itemQtyRaw, value(source.adet));
    assert.equal(row.massRaw, value(source.birim_agirlik));
    assert.equal(row.extra["Kaynak Pafta"] ?? "", value(source.pafta));
  }
  console.log(JSON.stringify({ passed: true, rows: parsed.rows.length, mapping: parsed.mapping, quantitiesUnchanged: true, weightsUnchanged: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
