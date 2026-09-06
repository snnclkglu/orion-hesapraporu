// SVG SERİLEŞTİRİCİ — her `DiagramEl` türü çıktıya girer.
//
// `pdf/diagram.tsx`in başındaki uyarı ölçülmüş bir tuzağı anlatıyor: ikinci bir
// çevirici yazıldığında `circle`, `bold` ve `strokeLinecap` sessizce düşmüştü.
// Tüketici `switch` bunu derleme zamanında yakalar; bu test ise ÇIKTIDA
// gerçekten göründüklerini sabitler.

import { describe, expect, it } from "vitest";
import { diagramToSvg, diagramsToSvg } from "../svg";
import type { Diagram, DiagramEl } from "../model";

const HER_TUR: DiagramEl[] = [
  { kind: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#262626", strokeWidth: 1, dash: "2 3", cap: "round" },
  { kind: "rect", x: 1, y: 2, w: 3, h: 4, fill: "#F1EEEC", stroke: "#262626", strokeWidth: 0.5, rx: 1 },
  { kind: "circle", cx: 5, cy: 5, r: 2, fill: "#A41E1E", stroke: "#262626", strokeWidth: 0.4 },
  { kind: "path", d: "M0 0 L10 10", fill: "none", stroke: "#8A8480", strokeWidth: 0.8, cap: "butt" },
  { kind: "polygon", points: [[0, 0], [3, 0], [1.5, 4]], fill: "#8A8480" },
  { kind: "text", x: 4, y: 9, text: "F31 & <ölçü>", size: 7, anchor: "middle", fill: "#262626", bold: true },
];

const SEMA: Diagram = { width: 100, height: 50, els: HER_TUR };

describe("diagramToSvg", () => {
  const svg = diagramToSvg(SEMA, { baslik: "Pano" });

  it("geçerli bir SVG belgesi üretir", () => {
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("her eleman türünü basar", () => {
    for (const etiket of ["<line", "<rect", "<circle", "<path", "<polygon", "<text"]) {
      expect(svg, etiket).toContain(etiket);
    }
  });

  it("sessizce düşmüş nitelikleri taşır", () => {
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('font-weight="600"');
    expect(svg).toContain('stroke-dasharray="2 3"');
    expect(svg).toContain('rx="1"');
  });

  it("metni KAÇIRIR — `&` ve `<` belgeyi bozardı", () => {
    expect(svg).toContain("F31 &amp; &lt;ölçü&gt;");
  });

  it("TEMA DEĞİŞKENİ DEĞİL baskı hex'i yazar", () => {
    // İndirilen dosya pano imalatçısına gider; orada CSS değişkeni yoktur.
    expect(svg).toContain("#A41E1E");
    expect(svg).not.toContain("var(--");
  });

  it("viewBox negatif köşeyi korur", () => {
    const kaydirilmis = diagramToSvg({ ...SEMA, x0: -12, y0: -4 });
    expect(kaydirilmis).toContain('viewBox="-12 -4 100 50"');
  });
});

describe("diagramsToSvg", () => {
  it("çizimleri alt alta birleştirir ve hepsini taşır", () => {
    const birlesik = diagramsToSvg([SEMA, { ...SEMA, height: 30 }]);
    expect((birlesik.match(/<g transform=/g) ?? []).length).toBe(2);
    expect((birlesik.match(/<circle/g) ?? []).length).toBe(2);
    // 50 + 28 ara + 30 = 108
    expect(birlesik).toContain('height="108"');
  });

  it("tek çizimde sarmalayıcı `g` açmaz", () => {
    expect(diagramsToSvg([SEMA])).not.toContain("<g transform=");
  });
});
