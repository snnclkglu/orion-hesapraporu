// ŞEMA OKUNURLUK KORUMASI — bütün diyagramlar, bütün bölümler.
//
// Neden: yerleşim hatası koddan okunmuyor, yalnız BASILMIŞ şekilde görülüyor.
// "Üst üste binen yazı" bu projede tekrar tekrar geri bildirim olarak geldi
// (mahal şeması, ana kiriş yük şeması) ve her seferinde ancak ekran görüntüsüyle
// fark edildi. Bu test aynı soruyu ÖLÇEREK sorar:
//
//   1. İki etiket birbirinin üstüne biniyor mu?
//   2. Bir etiketin ÜSTÜNE sonradan dolu bir şekil çiziliyor mu (yazı görünmez
//      olur — SVG boyama sırası belge sırasıdır)?
//
// Kapsam V5 şablonunun ÜRETTİĞİ tüm bölümlerdir; yeni bir diyagram eklendiğinde
// kendiliğinden kapsama girer, ayrıca bir yere yazılması gerekmez.

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import type { CabinInputs, CabinSelections } from "@/lib/calc/modules/cabin";
import { runCalc } from "@/lib/calc/engine";
import { diagramsForSection } from "@/lib/diagrams/select";
import { textBounds, type Diagram, type DiagramEl, type TextEl } from "@/lib/diagrams/model";
import { MODULE_ADAPTERS } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

type Box = [number, number, number, number];

function ratio(a: Box, b: Box): number {
  const dx = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const dy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (dx <= 0 || dy <= 0) return 0;
  const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
  return small > 0 ? (dx * dy) / small : 0;
}

/** Yazının üstünü örtebilecek DOLU şekil mi? Çizgi ve şeffaf dolgu örtmez. */
function opaqueBox(el: DiagramEl): Box | null {
  if (el.kind === "rect" && el.fill && el.fill !== "none") {
    return [el.x, el.y, el.x + Math.max(0, el.w), el.y + Math.max(0, el.h)];
  }
  if (el.kind === "polygon" && el.fill && el.fill !== "none") {
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return null;
}

/**
 * Şekil zeminine yazılması SERBEST olan renkler: kağıt ve beyaz dolgular
 * şemanın kendi zeminidir (kesit dolgusu, kutu zemini), üstlerine yazmak
 * kasıtlıdır. Koyu/renkli dolgular ise yazıyı yutar.
 */
const BACKDROP = new Set(["#FFFFFF", "#F1EEEC", "#FAF8F7", "#F5E6E6", "#DCEAF2", "#FBEDEC"]);

function fillOf(el: DiagramEl): string {
  return (el.kind === "rect" || el.kind === "polygon" ? el.fill : undefined) ?? "";
}

function hiddenTexts(d: Diagram): string[] {
  const out: string[] = [];
  d.els.forEach((el, i) => {
    if (el.kind !== "text") return;
    const tb = textBounds(el);
    for (let j = i + 1; j < d.els.length; j++) {
      const later = d.els[j];
      const box = opaqueBox(later);
      if (!box) continue;
      if (BACKDROP.has(fillOf(later).toUpperCase())) continue;
      if (ratio(tb, box) > 0.3) out.push(`"${el.text}" üstüne ${later.kind} çiziliyor`);
    }
  });
  return out;
}

function textCollisions(d: Diagram): string[] {
  const texts = d.els.filter((e): e is TextEl => e.kind === "text");
  const out: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      // Çözücünün toleransıyla AYNI eşik (%8): burada daha katı bir ölçü
      // kullanmak, çözücünün kabul ettiği teğetleri hata sayardı.
      if (ratio(textBounds(texts[i]), textBounds(texts[j])) > 0.08) {
        out.push(`"${texts[i].text}" ↔ "${texts[j].text}"`);
      }
    }
  }
  return out;
}

/**
 * İKİ FİKSTÜR gerekir. V5 şablonunda kabin de elektrik mahali de KAPALIDIR
 * (`electricalAccommodationType: "none"`), dolayısıyla 11.x mahal şemaları hiç
 * üretilmez — kapsam sessizce o üç diyagramı atlıyordu. İkinci fikstür kabini
 * ve pano yerleşimini açar; ayrı bir "elektrik odası" fikstürü de eklenir çünkü
 * oda ile pano AYRI dallardır (`hasElectricalRoom` / `hasElectricalPanels`).
 */
const FIXTURES: { name: string; input: typeof V5_TEMPLATE }[] = [
  { name: "V5", input: V5_TEMPLATE },
  {
    name: "çift tambur",
    input: {
      ...V5_TEMPLATE,
      specs: {
        ...V5_TEMPLATE.specs,
        mainHoistEquipmentArrangement: "doubleDrum",
        mainDoubleDrumHookSystem: "doubleHookBlock",
      },
    },
  },
  {
    name: "kabin+pano",
    input: {
      ...V5_TEMPLATE,
      specs: {
        ...V5_TEMPLATE.specs,
        hasOperatorCabin: "yes",
        operatorCabinHasAirConditioner: "yes",
        electricalAccommodationType: "panel",
        electricalPanelHasAirConditioner: "yes",
      },
      // Şablonun varsayılanı TEK pano ve TEK operatördür; kesitte tek bir dar
      // dolap hiçbir yerleşim sorununu ortaya çıkarmaz. Fikstür gerçek bir
      // kurulumu taklit eder — dolu bir oda, iki kişilik kabin.
      cabin: {
        selections: (V5_TEMPLATE.cabin?.selections ?? {}) as CabinSelections,
        inputs: {
          ...(V5_TEMPLATE.cabin?.inputs as CabinInputs),
          panelCount: 6,
          cabinOccupantCount: 2,
        },
      },
    },
  },
  {
    name: "elektrik odası",
    input: {
      ...V5_TEMPLATE,
      specs: {
        ...V5_TEMPLATE.specs,
        hasOperatorCabin: "yes",
        operatorCabinHasAirConditioner: "yes",
        electricalAccommodationType: "room",
        electricalRoomHasAirConditioner: "yes",
      },
      cabin: {
        selections: (V5_TEMPLATE.cabin?.selections ?? {}) as CabinSelections,
        inputs: {
          ...(V5_TEMPLATE.cabin?.inputs as CabinInputs),
          panelCount: 8,
          roomLengthM: 6,
          cabinOccupantCount: 2,
        },
      },
    },
  },
];

/** Fikstürlerin ürettiği bütün (modül, bölüm, diyagram) üçlüleri. */
const ALL: { where: string; diagram: Diagram }[] = [];
for (const { name, input } of FIXTURES) {
  const result = runCalc(input);
  for (const adapter of MODULE_ADAPTERS) {
    for (const section of adapter.sections) {
      for (const [i, diagram] of diagramsForSection(
        adapter.key as string, section.rawId, input, result
      ).entries()) {
        ALL.push({
          where: `[${name}] ${adapter.key} ${section.rawId} (${section.title}) #${i + 1}`,
          diagram,
        });
      }
    }
  }
}

/** Mahal şemalarının gerçekten kapsama girdiğinin kanıtı. */
const CLIMATE = ALL.filter((x) => x.where.includes("cabin 11."));

describe("şema okunurluğu", () => {
  it("kapsam boş değil ve MAHAL ŞEMALARINI da içeriyor", () => {
    // Kapsam sessizce daralırsa test hiçbir şeyi korumaz. Mahal şemaları ayrıca
    // sayılır: V5 şablonunda kabin kapalı olduğu için tam da onlar kapsam
    // dışında kalıp gözden kaçmıştı.
    expect(ALL.length).toBeGreaterThan(50);
    expect(CLIMATE.length, "mahal şeması üretilmedi").toBeGreaterThanOrEqual(3);
  });

  it("hiçbir etiket başka bir etiketin üstüne binmiyor", () => {
    const sorunlu = ALL.flatMap(({ where, diagram }) =>
      textCollisions(diagram).map((m) => `${where}: ${m}`)
    );
    expect(sorunlu, sorunlu.join("\n")).toEqual([]);
  });

  it("hiçbir etiketin üstüne sonradan dolu şekil çizilmiyor", () => {
    const sorunlu = ALL.flatMap(({ where, diagram }) =>
      hiddenTexts(diagram).map((m) => `${where}: ${m}`)
    );
    expect(sorunlu, sorunlu.join("\n")).toEqual([]);
  });

  it("her diyagram kendi içeriğini kapsayan bir çerçeve döner", () => {
    // Kırpılan etiket de "görünmeyen etiket"tir: fitDiagram viewBox'ı içerikten
    // hesaplar, bu yüzden hiçbir metin çerçevenin dışında kalmamalı.
    const tasan: string[] = [];
    for (const { where, diagram } of ALL) {
      const x0 = diagram.x0 ?? 0;
      const y0 = diagram.y0 ?? 0;
      for (const el of diagram.els) {
        if (el.kind !== "text") continue;
        const [a, b, c, dd] = textBounds(el);
        if (a < x0 - 0.5 || b < y0 - 0.5 || c > x0 + diagram.width + 0.5 || dd > y0 + diagram.height + 0.5) {
          tasan.push(`${where}: "${el.text}" çerçeve dışında`);
        }
      }
    }
    expect(tasan, tasan.join("\n")).toEqual([]);
  });
});
