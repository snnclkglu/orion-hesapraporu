// Sadece development: elektrik odası / operatör kabini ısı yükü şemasını
// uygulama temasıyla görsel test etmek için. Production'da 404 döner.
//
// NEDEN VAR (değişmez md. 11): şema üç bölümü birden besliyor (11.1 kabin,
// 11.2 elektrik odası, 11.3 panolar) ve tek görülebildiği yer auth arkasındaki
// sihirbazdı. Etiket çakışması ve görünüş ölçeği gibi hatalar ancak GÖZLE
// yakalanır; dört varyantı yan yana koymak, bir ölçüde düzelen bir yerleşimin
// ötekinde bozulduğunu tek bakışta gösterir.

import { notFound } from "next/navigation";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { climateRoomDiagram, type ClimateRoomParams } from "@/lib/diagrams/climateRoom";

/** Elektrik odası tabanı — varyantlar bunun üstüne yazar. */
const ODA: ClimateRoomParams = {
  title: "Elektrik Odası",
  widthM: 3,
  lengthM: 4,
  heightM: 2.6,
  insulationMm: 50,
  doorCount: 1,
  doorWidthMm: 800,
  doorHeightMm: 2000,
  ambientTempC: 50,
  ambientRhPct: 50,
  roomTempC: 24,
  roomRhPct: 50,
  outdoor: false,
  transmissionKw: 0.92,
  solarKw: 0,
  radiationKw: 0,
  deviceHeatKw: 1.1,
  occupantKw: 0,
  freshAirKw: 0.3,
  totalKw: 2.71,
  freshAirM3h: 9.7,
  airFlowM3h: 1023,
  glazingAreaM2: 0,
  occupantCount: 0,
  deviceCount: 1,
  deviceLabel: "Pano",
  panelWidthsMm: [800],
  panelHeightMm: 1800,
  panelDepthMm: 600,
  panelBaseHeightMm: 200,
};

const KABIN: ClimateRoomParams = {
  title: "Operatör Kabini",
  widthM: 2.5,
  lengthM: 2,
  heightM: 2.4,
  insulationMm: 50,
  doorCount: 1,
  doorWidthMm: 700,
  doorHeightMm: 1900,
  ambientTempC: 50,
  ambientRhPct: 50,
  roomTempC: 23,
  roomRhPct: 50,
  outdoor: false,
  transmissionKw: 0.81,
  solarKw: 0,
  radiationKw: 0,
  deviceHeatKw: 0.3,
  occupantKw: 0.13,
  freshAirKw: 0.62,
  totalKw: 2.14,
  freshAirM3h: 18,
  airFlowM3h: 809,
  glazingAreaM2: 2.5,
  occupantCount: 1,
  deviceCount: 1,
  deviceLabel: "Cihazlar",
};

const VARYANTLAR: { ad: string; not: string; p: ClimateRoomParams }[] = [
  { ad: "Elektrik Odası · 1 pano", not: "Varsayılan oda; boyda 3.200 mm boş kalır.", p: ODA },
  {
    ad: "Elektrik Odası · 3 pano",
    not: "Test fikstürü (3 × 2,6 × 2,8 m).",
    p: { ...ODA, widthM: 2.6, lengthM: 3, heightM: 2.8, deviceCount: 3, panelWidthsMm: [400, 600, 800] },
  },
  {
    ad: "Elektrik Odası · 6 pano (SIĞMIYOR)",
    not: "Toplam 4.400 mm > 4.000 mm boy — panolar ölçeklenerek çizilir, kalan mesafe NEGATİF.",
    p: { ...ODA, deviceCount: 6, panelWidthsMm: [600, 800, 800, 800, 800, 600] },
  },
  { ad: "Operatör Kabini", not: "Alt etiket şeridi burada sıkışıyor.", p: KABIN },
];

/**
 * Kalan mesafe gerçekte HESAPTAN gelir (`roomPanelLayout.remainingLengthMm`);
 * önizlemede aynı formül tekrarlanır ki fikstürler tek yerde kalsın.
 */
function ileKalan(p: ClimateRoomParams): ClimateRoomParams {
  if (!p.panelWidthsMm?.length) return p;
  const toplam = p.panelWidthsMm.reduce((t, w) => t + w, 0);
  return { ...p, remainingLengthMm: p.lengthM * 1000 - toplam };
}

export default async function ClimateRoomPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="grid gap-6 p-6">
      <h1 className="text-lg font-semibold">İklimlendirme Şeması Önizleme (dev)</h1>
      {VARYANTLAR.map((v) => (
        <section key={v.ad} className="grid gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="oc-kicker text-foreground/80">{v.ad}</h2>
            <span className="text-xs text-muted-foreground">{v.not}</span>
          </div>
          <div className="oc-diagram-theme overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
            <DiagramSvg diagram={climateRoomDiagram(ileKalan(v.p))} themeAware />
          </div>
        </section>
      ))}
    </main>
  );
}
