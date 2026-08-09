// Festoon ön seçimi için parametrik şematik.
// Katalog çizimini kopyalamaz; seçilen hareket mesafesi, taşıyıcı adedi ve
// loop yüksekliğini anlaşılır bir uygulama diyagramına dönüştürür.

import { useId } from "react";

const VIEW_W = 960;
const VIEW_H = 320;
const RAIL_X = 70;
const RAIL_W = 820;
const RAIL_Y = 105;
const RAIL_H = 18;
const MAX_DRAWN_TROLLEYS = 8;

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : fallback;
}

function fmt(value: number, digits = 2): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export interface FestoonSchematicMetrics {
  travelDistanceM: number;
  trolleyCount: number;
  drawnTrolleyCount: number;
  loopHeightM: number;
  averagePitchM: number;
}

/** Şema metinleri ve konumları için tek kaynak — bileşen testi de bunu kullanır. */
export function festoonSchematicMetrics(
  travelDistanceM: number | undefined,
  trolleyCount: number | undefined,
  loopHeightM: number | undefined
): FestoonSchematicMetrics {
  const travel = finite(travelDistanceM, 1);
  const count = Math.max(1, Math.floor(finite(trolleyCount, 1)));
  return {
    travelDistanceM: travel,
    trolleyCount: count,
    drawnTrolleyCount: Math.min(count, MAX_DRAWN_TROLLEYS),
    loopHeightM: finite(loopHeightM, 1.5),
    averagePitchM: travel / (count + 1),
  };
}

function DimArrow({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g className="fill-muted-foreground stroke-muted-foreground" strokeWidth="1">
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <path d={`M ${x1} ${y} l 6 -3 M ${x1} ${y} l 6 3 M ${x2} ${y} l -6 -3 M ${x2} ${y} l -6 3`} fill="none" />
      <text x={mid} y={y - 5} textAnchor="middle" className="fill-foreground font-mono text-[12px]">
        {label}
      </text>
    </g>
  );
}

function VerticalDimArrow({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  return (
    <g className="fill-muted-foreground stroke-muted-foreground" strokeWidth="1">
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <path d={`M ${x} ${y1} l -3 6 M ${x} ${y1} l 3 6 M ${x} ${y2} l -3 -6 M ${x} ${y2} l 3 -6`} fill="none" />
      <text x={x - 7} y={(y1 + y2) / 2 - 3} textAnchor="end" className="fill-foreground font-mono text-[11px]">
        {label}
      </text>
    </g>
  );
}

function Carrier({ x, bottomY }: { x: number; bottomY: number }) {
  const y = RAIL_Y + RAIL_H + 7;
  const cableX = x + 9;
  return (
    <g>
      <g className="fill-background stroke-foreground" strokeWidth="1.5">
        <circle cx={x} cy={RAIL_Y + 3} r={4} />
        <path d={`M ${x - 8} ${y} Q ${x} ${y - 9} ${x + 8} ${y} L ${x + 6} ${y + 20} Q ${x} ${y + 26} ${x - 6} ${y + 20} Z`} />
        <circle cx={x} cy={y + 8} r={2.6} className="fill-muted" />
      </g>
      <path
        d={`M ${cableX} ${y + 18} C ${cableX + 4} ${bottomY - 12}, ${cableX + 15} ${bottomY}, ${cableX + 29} ${bottomY} C ${cableX + 42} ${bottomY}, ${cableX + 49} ${y + 35}, ${cableX + 54} ${y + 22}`}
        className="fill-none stroke-primary"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cableX + 29} cy={bottomY} r={2.5} className="fill-primary" />
    </g>
  );
}

export function FestoonSchematic({
  title,
  travelDistanceM,
  trolleyCount,
  loopHeightM,
}: {
  title: string;
  travelDistanceM: number | undefined;
  trolleyCount: number | undefined;
  loopHeightM: number | undefined;
}) {
  // Araba ve köprü festonu AYNI sayfada basılır: sabit id'ler DOM'da
  // yineleniyor ve iki şemanın `aria-labelledby`i de ilk başlığa çözülüyordu.
  const uid = useId();
  const titleId = `${uid}-festoon-title`;
  const descId = `${uid}-festoon-desc`;
  const metrics = festoonSchematicMetrics(travelDistanceM, trolleyCount, loopHeightM);
  const leftClearance = RAIL_W * 0.11;
  const rightClearance = RAIL_W * 0.11;
  const travelStart = RAIL_X + leftClearance;
  const travelEnd = RAIL_X + RAIL_W - rightClearance;
  const carriageArea = travelEnd - travelStart;
  const loopDepth = Math.min(104, Math.max(54, 44 + metrics.loopHeightM * 28));
  const bottomY = RAIL_Y + RAIL_H + loopDepth;
  const legendY = Math.max(bottomY + 66, 274);
  const shownPositions = Array.from({ length: metrics.drawnTrolleyCount }, (_, index) =>
    travelStart + ((index + 0.5) / metrics.drawnTrolleyCount) * carriageArea
  );
  const firstCarrier = shownPositions[0] ?? travelStart + carriageArea / 2;
  const lastCarrier = shownPositions.at(-1) ?? firstCarrier;

  return (
    // Kaydırılabilirliğin tek ipucu kenar gölgesidir; mobil tarayıcı kaydırma
    // çubuğu çizmez. Zemin figürün kendi rengidir.
    <figure
      className="oc-scrollx overflow-x-auto overscroll-x-contain border bg-background px-2 py-2.5 [--oc-scroll-bg:var(--background)]"
      aria-label={`${title} feston şeması`}
    >
      {/* 960'lık viewBox 640px'e sıkıştırılınca ölçek 0,667'ye düşüyor ve
          şemanın 13/12/11/10px'lik etiketleri ekranda 8,7…6,7px'e iniyordu —
          okunmuyorlardı. Kaydırma zaten var; küçültmenin faydası yok. */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto min-w-[960px] w-full text-foreground"
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{title} feston yerleşim şeması</title>
        <desc id={descId}>
          {`${fmt(metrics.travelDistanceM)} metre hareket mesafesinde ${metrics.trolleyCount} kablo taşıyıcı ve ${fmt(metrics.loopHeightM)} metre loop yüksekliği.`}
        </desc>

        <text x={RAIL_X} y="19" className="fill-foreground text-[13px] font-semibold">
          {title} · FESTON YERLEŞİM ŞEMASI
        </text>
        <text x={RAIL_X} y="35" className="fill-muted-foreground text-[10px]">
          Ölçek şematiktir · taşıyıcı yerleşimi girilen adet ve hareket mesafesine göre güncellenir
        </text>

        <line x1={RAIL_X} x2={RAIL_X} y1="49" y2={RAIL_Y - 8} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={RAIL_X + RAIL_W} x2={RAIL_X + RAIL_W} y1="49" y2={RAIL_Y - 8} className="stroke-muted-foreground" strokeWidth="1" />
        <DimArrow x1={RAIL_X} x2={RAIL_X + RAIL_W} y={49} label={`L = ${fmt(metrics.travelDistanceM)} m`} />

        <line x1={travelStart} x2={travelStart} y1="72" y2={RAIL_Y - 5} className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={travelEnd} x2={travelEnd} y1="72" y2={RAIL_Y - 5} className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="3 3" />
        <DimArrow x1={travelStart} x2={travelEnd} y={72} label="Feston hareket alanı" />

        <g className="fill-muted stroke-foreground" strokeWidth="1.25">
          <rect x={RAIL_X} y={RAIL_Y} width={RAIL_W} height={RAIL_H} rx="1.5" />
          <line x1={RAIL_X} x2={RAIL_X + RAIL_W} y1={RAIL_Y + 5} y2={RAIL_Y + 5} className="stroke-muted-foreground" />
          <line x1={RAIL_X} x2={RAIL_X + RAIL_W} y1={RAIL_Y + RAIL_H + 5} y2={RAIL_Y + RAIL_H + 5} className="stroke-foreground" />
        </g>

        <g className="stroke-primary" strokeWidth="2" fill="none">
          <path d={`M ${RAIL_X + 14} ${RAIL_Y + RAIL_H + 5} C ${RAIL_X + 42} ${RAIL_Y + RAIL_H + 5}, ${travelStart - 32} ${RAIL_Y + RAIL_H + 12}, ${travelStart - 12} ${RAIL_Y + RAIL_H + 26}`} />
          <path d={`M ${travelEnd + 15} ${RAIL_Y + RAIL_H + 26} C ${travelEnd + 40} ${RAIL_Y + RAIL_H + 10}, ${RAIL_X + RAIL_W - 35} ${RAIL_Y + RAIL_H + 5}, ${RAIL_X + RAIL_W - 12} ${RAIL_Y + RAIL_H + 5}`} />
        </g>
        <text x={RAIL_X + 9} y={RAIL_Y + RAIL_H + 45} className="fill-primary text-[10px]">Sabit besleme</text>
        <text x={RAIL_X + RAIL_W - 76} y={RAIL_Y + RAIL_H + 45} className="fill-primary text-[10px]">Hareketli uç</text>

        {shownPositions.map((x, index) => (
          <Carrier key={index} x={x} bottomY={bottomY} />
        ))}

        <line x1={firstCarrier} x2={firstCarrier} y1={RAIL_Y + RAIL_H + 34} y2={bottomY} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={firstCarrier - 42} x2={firstCarrier - 42} y1={RAIL_Y + RAIL_H + 34} y2={bottomY} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={firstCarrier - 42} x2={firstCarrier - 14} y1={RAIL_Y + RAIL_H + 34} y2={RAIL_Y + RAIL_H + 34} className="stroke-muted-foreground" strokeWidth="1" />
        <line x1={firstCarrier - 42} x2={firstCarrier - 14} y1={bottomY} y2={bottomY} className="stroke-muted-foreground" strokeWidth="1" />
        <VerticalDimArrow x={firstCarrier - 42} y1={RAIL_Y + RAIL_H + 34} y2={bottomY} label={`h = ${fmt(metrics.loopHeightM)} m`} />

        {metrics.drawnTrolleyCount > 1 && (
          <>
            <line x1={firstCarrier} x2={lastCarrier} y1={bottomY + 34} y2={bottomY + 34} className="stroke-muted-foreground" strokeWidth="1" />
            <text x={(firstCarrier + lastCarrier) / 2} y={bottomY + 50} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              a ≈ {fmt(metrics.averagePitchM)} m · ortalama taşıyıcı aralığı
            </text>
          </>
        )}

        <text x={RAIL_X} y={legendY} className="fill-muted-foreground text-[10px]">
          {metrics.trolleyCount === metrics.drawnTrolleyCount
            ? `N = ${metrics.trolleyCount} kablo taşıyıcı`
            : `N = ${metrics.trolleyCount} kablo taşıyıcı · şemada ilk ${metrics.drawnTrolleyCount} taşıyıcı gösterilir`}
        </text>
      </svg>
      <figcaption className="sr-only">
        {`${title}: ${fmt(metrics.travelDistanceM)} m hareket, ${metrics.trolleyCount} taşıyıcı, ${fmt(metrics.loopHeightM)} m loop yüksekliği.`}
      </figcaption>
    </figure>
  );
}
