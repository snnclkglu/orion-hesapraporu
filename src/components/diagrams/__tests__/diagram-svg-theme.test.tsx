import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiagramSvg, diagramWebPaint } from "../diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";

const diagram: Diagram = {
  width: 100,
  height: 60,
  els: [
    { kind: "rect", x: 0, y: 0, w: 100, h: 60, fill: "#FFFFFF", stroke: "#DCD9D7" },
    { kind: "line", x1: 5, y1: 20, x2: 95, y2: 20, stroke: "#262626", strokeWidth: 1 },
    { kind: "text", x: 50, y: 40, text: "Şema", size: 10, fill: "#8A8480" },
  ],
};

describe("uygulama içi diyagram teması", () => {
  it("tema duyarlı çizimde baskı hex'lerini semantik CSS boyalarına çevirir", () => {
    const html = renderToStaticMarkup(<DiagramSvg diagram={diagram} themeAware />);
    expect(html).toContain("var(--oc-diagram-canvas)");
    expect(html).toContain("var(--oc-diagram-line)");
    expect(html).toContain("var(--oc-diagram-ink)");
    expect(html).toContain("var(--oc-diagram-muted)");
  });

  it("varsayılan çizimde PDF/teknik hex paletini değiştirmez", () => {
    const html = renderToStaticMarkup(<DiagramSvg diagram={diagram} />);
    expect(html).toContain("#FFFFFF");
    expect(html).toContain("#262626");
    expect(diagramWebPaint("#A41E1E", false)).toBe("#A41E1E");
  });
});
