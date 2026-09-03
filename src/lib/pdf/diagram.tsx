// Saf `Diagram` modelinin react-pdf karşılığı — TEK ÇEVİRİCİ.
//
// Aynı çeviri bir süre İKİ YERDE yazılıydı (`report.tsx` ve `nesting-plan.tsx`)
// ve ikinci kopya sessizce eksikti: `circle` dalı hiç yoktu (`default → null`),
// yani halat kesiti, makara ve grafiklerdeki çalışma noktası KAYBOLUYORDU;
// `bold` ve `strokeLinecap` da yok sayılıyordu. Bir çizim modelinin iki
// çevirisi olmaz — üçüncü bir tüketici (ekipman listesi PDF'i) gelince kopya
// kalıcılaşacaktı.
//
// Bağımlılık YÜZEYİ BİLEREK DARDIR: yalnız `@react-pdf/renderer` + diyagram
// modeli + marka renkleri. `report.tsx`ten import etmek font kaydını,
// `node:path`i ve bütün modül adaptör zincirini her tüketiciye taşırdı.
// "DejaVu" ailesi `brand.tsx` yüklendiğinde zaten kayıtlıdır.

import {
  Circle, Line, Path, Polygon, Rect, Svg, Text, View,
} from "@react-pdf/renderer";
import type { Diagram, DiagramEl } from "@/lib/diagrams/model";
import { BRAND } from "./brand";

/** `DiagramEl` → react-pdf SVG ilkesi. */
export function pdfDiagramEl(el: DiagramEl, i: number) {
  switch (el.kind) {
    case "line":
      return (
        <Line
          key={i}
          x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
          stroke={el.stroke} strokeWidth={el.strokeWidth}
          strokeDasharray={el.dash} strokeLinecap={el.cap}
        />
      );
    case "rect":
      return (
        <Rect
          key={i}
          x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx}
          fill={el.fill ?? "none"} stroke={el.stroke} strokeWidth={el.strokeWidth}
        />
      );
    case "circle":
      return (
        <Circle
          key={i}
          cx={el.cx} cy={el.cy} r={el.r}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
        />
      );
    case "path":
      return (
        <Path
          key={i}
          d={el.d}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
          strokeLinecap={el.cap}
        />
      );
    case "polygon":
      return (
        <Polygon
          key={i}
          points={el.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={el.fill ?? "none"} stroke={el.stroke} strokeWidth={el.strokeWidth}
        />
      );
    case "text":
      return (
        <Text
          key={i}
          x={el.x} y={el.y}
          fill={el.fill}
          textAnchor={el.anchor}
          style={{
            // Diyagram metinleri DejaVu kalır: teknik semboller (Ø, ölçü okları,
            // Yunan harfleri) mono/Archivo kapsamı dışında olabilir.
            fontFamily: "DejaVu",
            fontSize: el.size,
            fontWeight: el.bold ? "bold" : undefined,
          }}
        >
          {el.text}
        </Text>
      );
  }
}

/** `PdfDiagram` çerçevesiz de basılabilir (kesim planı gibi kendi kabı olan yerler). */
export interface PdfDiagramProps {
  diagram: Diagram;
  /** Kullanılabilir en — varsayılan A4 DİKEY içerik genişliği. */
  maxWidth?: number;
  /**
   * Kullanılabilir boy. Verilirse çizim İKİ YÖNDEN kelepçelenir.
   *
   * Yalnız genişlik verilirse kareye yakın bir çizim sayfayı taşırır ve
   * `wrap={false}` kutusu bir sonraki yaprağa atlayıp orada da taşar
   * (kesim planında ölçülmüş bir hatadır, 15.08.2026).
   */
  maxHeight?: number;
  /** Çerçeve + beyaz zemin. Kendi kabı olan çağıranlar kapatır. */
  framed?: boolean;
}

export function PdfDiagram({
  diagram,
  maxWidth = 468,
  maxHeight,
  framed = true,
}: PdfDiagramProps) {
  const oran = diagram.height / diagram.width;
  const w = maxHeight ? Math.min(maxWidth, maxHeight / oran) : maxWidth;
  const h = w * oran;
  {/* viewBox köşesi diyagramdan gelir: içerik 0'ın soluna taşarsa (uzun sol
      etiketler) kırpılmasın diye kutu o yöne büyütülmüştür. */}
  const svg = (
    <Svg
      width={w}
      height={h}
      viewBox={`${diagram.x0 ?? 0} ${diagram.y0 ?? 0} ${diagram.width} ${diagram.height}`}
    >
      {diagram.els.map(pdfDiagramEl)}
    </Svg>
  );
  if (!framed) return svg;
  return (
    <View
      wrap={false}
      style={{
        marginTop: 5,
        marginBottom: 5,
        borderWidth: 0.75,
        borderColor: BRAND.line300,
        backgroundColor: BRAND.white,
        paddingVertical: 5,
        alignItems: "center",
      }}
    >
      {svg}
    </View>
  );
}
