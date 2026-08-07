import { writeFileSync } from "node:fs";
import { it } from "vitest";

const out: string[] = [];
import {
  V5_AUX_HOIST_INPUTS,
  V5_AUX_HOIST_SELECTIONS,
  V5_MAIN_HOIST_INPUTS,
  V5_MAIN_HOIST_SELECTIONS,
  V5_SPECS,
} from "../defaults";
import { computeHoistGroup } from "../modules/hoistGroup";

it("dump", () => {
  for (const which of ["main", "aux"] as const) {
    const r = computeHoistGroup(
      V5_SPECS,
      which,
      which === "main" ? V5_MAIN_HOIST_INPUTS : V5_AUX_HOIST_INPUTS,
      which === "main" ? V5_MAIN_HOIST_SELECTIONS : V5_AUX_HOIST_SELECTIONS
    );
    const keys = Object.keys(r.cells).filter(
      (k) => k.startsWith("drumWeld.") || k.startsWith("shaftWeld.") || k.startsWith("drumShaft.")
    );
    out.push("=== " + which);
    for (const k of keys.sort()) out.push(`${k} = ${r.cells[k]}`);
  }
  writeFileSync("scratch-dump.txt", out.join("\n"), "utf8");
});
