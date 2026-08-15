// Kaldırma kirişi şemaları — üç çizimi (görünüş · moment · kesitler) SVG ve
// PNG olarak üretir.
//
//   npx tsx scripts/test-lifting-beam-diagram.tsx
//
// Amaç: ölçü zinciri değiştiğinde şemanın GERÇEKTEN değiştiğini ve yazıların
// üst üste binmediğini gözle doğrulamak. İki fikstür basılır: SİMETRİK askı
// (referans işin geometrisi) ve ASİMETRİK askı — ikincisi olmadan "Kesit 1'in
// kesmesi sıfır değildir" hâli hiç görülmez.
//
// Çıktı .test-output/ altına.

import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { diagramsForSection } from "@/lib/diagrams/select";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";

/** Şemayı uygulamanın KENDİ bileşeniyle çizer — ayrı bir çizici yazılmaz. */
function toSvg(diagram: Diagram): string {
  return renderToStaticMarkup(createElement(DiagramSvg, { diagram }));
}

const OUT_DIR = path.resolve(__dirname, "..", ".test-output");

const FIKSTURLER: { ad: string; x: number; y: number; z: number }[] = [
  { ad: "simetrik", x: 550, y: 3700, z: 550 },
  { ad: "asimetrik", x: 900, y: 2600, z: 400 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const f of FIKSTURLER) {
    const input: CalcInput = {
      ...V5_TEMPLATE,
      hookBlock: {
        inputs: {
          ...V5_TEMPLATE.hookBlock!.inputs,
          beamXMm: f.x, beamYMm: f.y, beamZMm: f.z,
        },
        selections: V5_TEMPLATE.hookBlock!.selections,
      },
    };
    const result = runCalc(input);
    const diagrams = diagramsForSection("hookBlock", "4.6", input, result);
    if (diagrams.length !== 3) {
      throw new Error(`${f.ad}: 3 diyagram bekleniyordu, ${diagrams.length} geldi`);
    }
    const v = result.hookBlock!.values;
    console.log(
      `${f.ad.padEnd(10)} L = ${v.beam.spanCm * 10} mm · R_A = ${v.beamReactionAKg.toFixed(0)} kg · ` +
        `R_B = ${v.beamReactionBKg.toFixed(0)} kg · M_maks = ${v.maxMomentKgCm.toFixed(0)} kg·cm · ` +
        `V_maks = ${v.beamShearMaxKg.toFixed(0)} kg · V₁ = ${v.beamShearSection1Kg.toFixed(0)} kg`
    );

    const adlar = ["gorunus", "moment", "kesitler"];
    for (let i = 0; i < diagrams.length; i++) {
      const svg = toSvg(diagrams[i]);
      const base = path.join(OUT_DIR, `kaldirma-kirisi-${f.ad}-${adlar[i]}`);
      fs.writeFileSync(`${base}.svg`, svg, "utf8");
      // PNG de üretilir: SVG'yi gözle kontrol etmek için bir tarayıcı gerekir,
      // PNG doğrudan açılır.
      await sharp(Buffer.from(svg)).png().toFile(`${base}.png`);
      console.log(
        `   ${adlar[i].padEnd(9)} ${diagrams[i].width}×${diagrams[i].height} → ${path.basename(base)}.png`
      );
    }
  }
  console.log("Kaldırma kirişi şeması duman testi BAŞARILI.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
