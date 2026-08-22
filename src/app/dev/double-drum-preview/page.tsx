// Sadece development: çift tambur şemalarını uygulama temasıyla görsel test etmek için.

import { notFound } from "next/navigation";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { drumShaftDiagram } from "@/lib/diagrams/drumShaft";
import { reevingDiagram } from "@/lib/diagrams/reeving";

const reeving = reevingDiagram({
  drivenFalls: 4,
  totalFalls: 16,
  drumDiaMm: 480,
  loadKg: 70_700,
  capacityT: 64,
  ropeBalancingType: "equalizerBeam",
  equipmentArrangement: "doubleDrum",
  doubleDrumHookSystem: "doubleHookBlock",
});

const liftingBeamReeving = reevingDiagram({
  drivenFalls: 4,
  totalFalls: 16,
  drumDiaMm: 480,
  loadKg: 70_700,
  capacityT: 64,
  ropeBalancingType: "equalizerBeam",
  equipmentArrangement: "doubleDrum",
  doubleDrumHookSystem: "liftingBeam",
});

const shaft = drumShaftDiagram({
  aMm: 60,
  bMm: 50,
  cMm: 924,
  dMm: 640,
  eMm: 924,
  fMm: 50,
  gMm: 60,
  d1Mm: 60,
  d2Mm: 60,
  drumDiaMm: 480,
  ropeLoadKg: 4_038.8,
  drumWeightKg: 810,
  ropePositionsMm: [984, 1_624],
  weightArmMm: 1_304,
  reactionGearboxKg: 4_721.9,
  reactionBearingKg: 4_721.9,
  momentGearboxKgCm: 283_314,
  momentBearingKgCm: 283_314,
  doubleDrum: true,
});

export default function DoubleDrumPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1500px] gap-8 p-8">
      <header>
        <h1 className="text-xl font-semibold">Çift Tambur Şema Önizlemesi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          64 ton · 4/16 donanım · iki adet 2/8 kanca bloğu · ortada ortak redüktör
        </p>
      </header>
      {[
        { title: "Halat Donanımı — Çift Kanca Bloğu", diagram: reeving },
        { title: "Halat Donanımı — Kaldırma Kirişi", diagram: liftingBeamReeving },
        { title: "Tambur Mili — Tek Simetrik Tambur", diagram: shaft },
      ].map(({ title, diagram }) => (
        <section key={title} className="grid gap-3">
          <h2 className="text-sm font-medium">{title}</h2>
          <div className="oc-diagram-theme overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
            <DiagramSvg diagram={diagram} className="mx-auto" themeAware />
          </div>
        </section>
      ))}
    </main>
  );
}
