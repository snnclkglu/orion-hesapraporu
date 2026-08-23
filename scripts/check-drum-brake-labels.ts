// Kasnak freni şeması — ETİKET ÇAKIŞMA ÖLÇÜMÜ.
//
//   npx tsx scripts/check-drum-brake-labels.ts
//
// `legibility.guard.test.ts` yazı-yazı çakışmasını ve yazının üstüne çizilen
// dolu şekli sayar; yazının ÇİZGİ üstüne binmesini GÖREMEZ. Bu betik defterdeki
// bütün fren boylarını üretip üçünü birden ölçer ve çakışan her etiketi
// dosya/ölçü adıyla yazar. Sıfır satır beklenir.

import {
  textBounds, type Diagram, type DiagramEl, type TextEl,
} from "@/lib/diagrams/model";
import { DRUM_BRAKES } from "@/lib/calc/drum-brake";
import { drumBrakeDiagram } from "@/lib/diagrams/drumBrake";

type Box = [number, number, number, number];

function ratio(a: Box, b: Box): number {
  const dx = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const dy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (dx <= 0 || dy <= 0) return 0;
  const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
  return small > 0 ? (dx * dy) / small : 0;
}

/** Doğru parçası kutuyu kesiyor mu? (Liang–Barsky) */
function segmentHitsBox(
  x1: number, y1: number, x2: number, y2: number, b: Box
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const tests: [number, number][] = [
    [-dx, x1 - b[0]], [dx, b[2] - x1],
    [-dy, y1 - b[1]], [dy, b[3] - y1],
  ];
  for (const [pp, qq] of tests) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t0 <= t1;
}

/** Yazının kutusunu daraltır: harflerin arasındaki boşluk çakışma sayılmasın. */
function tight(el: TextEl): Box {
  const [a, b, c, d] = textBounds(el);
  const padY = (d - b) * 0.18;
  return [a + 1, b + padY, c - 1, d - padY];
}

function report(where: string, diagram: Diagram): string[] {
  const out: string[] = [];
  const texts = diagram.els.filter((e): e is TextEl => e.kind === "text");

  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      if (ratio(tight(texts[i]), tight(texts[j])) > 0.02) {
        out.push(`${where}: YAZI↔YAZI  "${texts[i].text}" ↔ "${texts[j].text}"`);
      }
    }
  }

  // Z-SIRASI ÖNEMLİDİR: SVG boyama sırası belge sırasıdır. Yazının hemen
  // ÖNÜNDE, kutusunu örten bir kâğıt şerit varsa (`clearLabel`) ondan ÖNCE
  // çizilmiş her çizgi zaten görünmez; yalnız şeritten SONRA gelenler yazının
  // üstüne biner. Şerit yoksa bütün çizgiler sayılır.
  const backdrops = new Set(["#F1EEEC", "#FFFFFF", "#FAF8F7"]);
  for (const el of texts) {
    const box = tight(el);
    const kendiIndeksi = diagram.els.indexOf(el);
    let ortuldu = -1;
    diagram.els.forEach((other, i) => {
      if (i >= kendiIndeksi || other.kind !== "rect") return;
      if (!other.fill || !backdrops.has(other.fill.toUpperCase())) return;
      const rb: Box = [other.x, other.y, other.x + other.w, other.y + other.h];
      // Şerit yazının TAMAMINI örtmeli; kısmi örtü çakışmayı gizlemez.
      if (rb[0] <= box[0] && rb[1] <= box[1] && rb[2] >= box[2] && rb[3] >= box[3]) {
        ortuldu = Math.max(ortuldu, i);
      }
    });
    diagram.els.forEach((other, i) => {
      if (other.kind !== "line" || i <= ortuldu) return;
      if (backdrops.has(other.stroke.toUpperCase())) return;
      if (segmentHitsBox(other.x1, other.y1, other.x2, other.y2, box)) {
        out.push(
          `${where}: YAZI↔ÇİZGİ "${el.text}" ← ` +
            `(${other.x1.toFixed(0)},${other.y1.toFixed(0)})→` +
            `(${other.x2.toFixed(0)},${other.y2.toFixed(0)}) ${other.stroke}`
        );
      }
    });
  }
  return out;
}

const sorunlu: string[] = [];
for (const spec of DRUM_BRAKES) {
  for (const qty of [0, 2]) {
    const diagram = drumBrakeDiagram({
      spec, qty, brand: "SIBRE",
      // Uyuşmazlık uyarısı da kapsama girsin (en uzun özet sütunu odur).
      selectedWheelDiaMm: qty === 0 ? spec.drumDiaMm + 100 : spec.drumDiaMm,
    });
    sorunlu.push(...report(`${spec.model} (adet ${qty})`, diagram));
  }
}

if (sorunlu.length > 0) {
  console.error(sorunlu.join("\n"));
  console.error(`\n${sorunlu.length} çakışma.`);
  process.exit(1);
}
console.log(`Etiket çakışması YOK — ${DRUM_BRAKES.length} fren boyu × 2 durum ölçüldü.`);
