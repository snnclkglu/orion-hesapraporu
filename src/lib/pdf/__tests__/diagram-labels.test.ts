// Diyagram etiketlerinin ÜST ÜSTE BİNMEDİĞİNİ ölçen test (madde 32).
//
// Yerleşim kararı `fitDiagram` içindeki genel çakışma çözücüde verilir
// (model.ts `resolveTextOverlaps`). Burada raporun ÜRETTİĞİ bütün diyagramlar
// gerçek girdilerle kurulur ve her diyagramda metin kutuları karşılaştırılır.
// Tek bir grafiğe özel değil, ne kadar diyagram varsa hepsi taranır: buruşma
// panel yerleşimi ve etkileşim diyagramı, Kσ–Kτ eğrileri, ρ indirgemesi, sehim,
// moment, teker yükleri, tambur/mil şematikleri…

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { MODULE_ADAPTERS } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { diagramsForSection } from "@/lib/diagrams/select";
import { resolveTextOverlaps, textBounds, type Diagram, type TextEl } from "@/lib/diagrams/model";
import { reevingDiagram } from "@/lib/diagrams/reeving";

const input = V5_TEMPLATE;
const result = runCalc(input);

/** Raporun bastığı bütün diyagramlar, geldikleri bölümün adıyla birlikte. */
function allDiagrams(): { name: string; diagram: Diagram }[] {
  const out: { name: string; diagram: Diagram }[] = [];
  for (const adapter of MODULE_ADAPTERS) {
    for (const section of adapter.sections) {
      if (section.visible && !section.visible(input.specs)) continue;
      const ds = diagramsForSection(adapter.key, section.rawId, input, result);
      ds.forEach((d, i) =>
        out.push({ name: `${adapter.key}/${section.rawId}#${i + 1}`, diagram: d })
      );
    }
  }
  return out;
}

type Box = [number, number, number, number];

function overlapRatio(a: Box, b: Box): number {
  const dx = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const dy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (dx <= 0 || dy <= 0) return 0;
  const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
  return small > 0 ? (dx * dy) / small : 0;
}

/**
 * Kesişen etiket çiftleri. Eşik `resolveTextOverlaps`in kendi eşiğinden (0,08)
 * biraz gevşektir: çözücünün "bilerek bıraktığı" teğetler hata sayılmaz, gerçek
 * üst üste binmeler yakalanır.
 */
function collisions(diagram: Diagram, limit = 0.12): string[] {
  const texts = diagram.els.filter((e): e is TextEl => e.kind === "text" && e.text.trim() !== "");
  const boxes = texts.map(textBounds);
  const out: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const r = overlapRatio(boxes[i], boxes[j]);
      if (r > limit) {
        out.push(`«${texts[i].text}» ↔ «${texts[j].text}» (%${Math.round(r * 100)})`);
      }
    }
  }
  return out;
}

describe("diyagram etiketleri", () => {
  const diagrams = allDiagrams();

  it("rapor gerçekten diyagram üretiyor (test boşa dönmesin)", () => {
    expect(diagrams.length).toBeGreaterThan(10);
    const labels = diagrams.reduce(
      (n, d) => n + d.diagram.els.filter((e) => e.kind === "text").length,
      0
    );
    expect(labels).toBeGreaterThan(200);
  });

  it("hiçbir diyagramda metin kutuları kesişmez", () => {
    const bad: string[] = [];
    for (const { name, diagram } of diagrams) {
      for (const c of collisions(diagram)) bad.push(`${name}: ${c}`);
    }
    expect(bad).toEqual([]);
  });

  it("çözücü sabit (fixed) etiketleri kaydırmaz — tik değeri tikin altında kalır", () => {
    const els = [
      { kind: "text", x: 0, y: 0, text: "1.250", size: 8, anchor: "middle", fixed: true },
      { kind: "text", x: 0, y: 0, text: "hesaplanan σvcr", size: 9, anchor: "middle" },
    ] as TextEl[];
    resolveTextOverlaps(els);
    expect(els[0].y).toBe(0);
    expect(els[1].y).not.toBe(0);
  });

  it("halat donanımı şeması Türkçe baş harf düzenini korur", () => {
    const labels = reevingDiagram({ drivenFalls: 2, totalFalls: 2 }).els
      .filter((element): element is TextEl => element.kind === "text")
      .map((element) => element.text);
    expect(labels).toContain("Tambur · Makara · Kanca Bloğu");
  });

  it("kaçan etiket için bağlantı çizgisi çizilir (leaderTo verilmişse)", () => {
    const els = [
      { kind: "text", x: 0, y: 0, text: "σvcr: 322", size: 8.5, fixed: true },
      { kind: "text", x: 0, y: 0, text: "σvcr.c: 318", size: 8.5, leaderTo: [0, 0] },
    ] as TextEl[];
    const before = els.length;
    const moved = resolveTextOverlaps(els);
    expect(moved).toBe(1);
    expect(els.length).toBeGreaterThan(before);
    expect(els[els.length - 1].kind).toBe("line");
  });
});
