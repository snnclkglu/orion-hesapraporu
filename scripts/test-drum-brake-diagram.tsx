// Kasnak freni ölçü resmi — defterdeki her fren boyu için SVG üretir.
//
//   npx tsx scripts/test-drum-brake-diagram.tsx
//
// Amaç: ölçü zincirinin (A · E · G · C · L · N · H) GERÇEKTEN birbirine
// bağlı çizildiğini ve en küçük (TE 200) ile en büyük (TE 710) boyda
// yazıların üst üste binmediğini gözle doğrulamak. Çıktı .test-output/ altına.

import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DRUM_BRAKES, drumBrakeSpec } from "@/lib/calc/drum-brake";
import { drumBrakeDiagram } from "@/lib/diagrams/drumBrake";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";

/** Şemayı uygulamanın KENDİ bileşeniyle çizer — ayrı bir çizici yazılmaz. */
function toSvg(diagram: Diagram): string {
  return renderToStaticMarkup(createElement(DiagramSvg, { diagram }));
}

const OUT_DIR = path.resolve(__dirname, "..", ".test-output");

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Her kasnak çapından BİR örnek (ilk itici) + iticiye bağlı ölçülerin
  // değiştiğini gösteren TE 315'in dört varyantı.
  const seen = new Set<number>();
  const picked = DRUM_BRAKES.filter((b) => {
    if (b.drumDiaMm === 315) return true;
    if (seen.has(b.drumDiaMm)) return false;
    seen.add(b.drumDiaMm);
    return true;
  });

  for (const spec of picked) {
    const diagram = drumBrakeDiagram({
      spec, qty: 2, brand: "SIBRE", selectedWheelDiaMm: spec.drumDiaMm,
    });
    const file = path.join(OUT_DIR, `kasnak-freni-${spec.model.replace(/\//g, "-")}.svg`);
    fs.writeFileSync(file, toSvg(diagram), "utf8");
    console.log(
      `${spec.model} · Ø${spec.drumDiaMm} · ${spec.thruster} · ` +
        `${spec.brakeWeightKg}+${spec.thrusterWeightKg}=${spec.totalWeightKg} kg → ` +
        `${path.basename(file)}  (${diagram.width}×${diagram.height})`
    );
  }

  // Model kodunun üç yazımı da aynı ürüne düşmeli.
  for (const yazim of ["TE315/50/6", "TE 315 Ed 50/6", "SIBRE TE315 50/6"]) {
    const spec = drumBrakeSpec(yazim);
    if (spec?.model !== "TE315/50/6") {
      throw new Error(`Model kodu çözülemedi: "${yazim}" → ${spec?.model ?? "yok"}`);
    }
  }
  // Ölçüsü defterde olmayan fren şema üretmez.
  for (const yok of ["TE160/23/5", "SHI 105", "", "DYF08"]) {
    if (drumBrakeSpec(yok) !== null) throw new Error(`Beklenmedik ölçü kaydı: "${yok}"`);
  }

  console.log("Kasnak freni ölçü resmi duman testi BAŞARILI.");
}

main();
