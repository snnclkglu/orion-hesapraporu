// Emniyet freni şeması — altı yerleşim düzenini SVG olarak üretir.
//
//   npx tsx scripts/test-safety-brake-diagram.ts
//
// Amaç: yerleşim değiştiğinde kaliper konumlarının GERÇEKTEN değiştiğini ve
// yazıların üst üste binmediğini gözle doğrulamak. Çıktı .test-output/ altına.

import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAKE_ARRANGEMENT_DEFS, recommendHydraulicUnit, safetyBrakeByCode } from "@/lib/calc/safety-brake";
import { safetyBrakeDiagram } from "@/lib/diagrams/safetyBrake";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";

/** Şemayı uygulamanın KENDİ bileşeniyle çizer — ayrı bir çizici yazılmaz. */
function toSvg(diagram: Diagram): string {
  return renderToStaticMarkup(createElement(DiagramSvg, { diagram }));
}

const OUT_DIR = path.resolve(__dirname, "..", ".test-output");

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const brake = safetyBrakeByCode("SHI 105")!;

  for (const arr of BRAKE_ARRANGEMENT_DEFS) {
    const unit = recommendHydraulicUnit(brake, arr.angles.length);
    const diagram = safetyBrakeDiagram({
      flangeDiaMm: 900,
      minFlangeDiaMm: 820,
      drumDiaMm: 400,
      brakeCount: arr.angles.length,
      arrangement: arr.label,
      model: brake.code,
      minThicknessMm: brake.minDiscThicknessMm,
      thicknessMm: 25,
      torqueEachNm: 24024,
      totalTorqueNm: 24024 * arr.angles.length,
      demandTorqueNm: 30542,
      hydraulicUnit: unit?.code,
      hydraulicPressureBar: unit?.releasePressureBar,
    });
    const file = path.join(OUT_DIR, `emniyet-freni-${arr.code}.svg`);
    fs.writeFileSync(file, toSvg(diagram), "utf8");
    console.log(
      `${arr.code} · ${arr.angles.length} kaliper · açılar ${arr.angles.join("/")}° → ` +
        `${path.basename(file)}  (${diagram.width}×${diagram.height})`
    );
  }
  console.log("Emniyet freni şeması duman testi BAŞARILI.");
}

main();
