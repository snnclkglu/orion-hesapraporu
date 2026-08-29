"use client";

import {
  Circle,
  Document,
  Font,
  G,
  Image,
  Line,
  Page,
  Path,
  Rect,
  Svg,
  Text,
  pdf,
} from "@react-pdf/renderer";
import { BRAND, mm, trUpper } from "@/lib/pdf/palette";
import { createNameplateLayout, type NameplateInput } from "./nameplate";

export interface NameplatePdfAssets {
  logoPaperDataUrl: string;
  archivoBoldDataUrl: string;
  archivoExtraBoldDataUrl: string;
  plexDataUrl: string;
}

let registeredFontKey = "";

function registerFonts(assets: NameplatePdfAssets) {
  const key = `${assets.archivoBoldDataUrl.length}:${assets.archivoExtraBoldDataUrl.length}:${assets.plexDataUrl.length}`;
  if (registeredFontKey === key) return;
  Font.register({
    family: "PlateArchivo",
    fonts: [
      { src: assets.archivoBoldDataUrl, fontWeight: 700 },
      { src: assets.archivoExtraBoldDataUrl, fontWeight: 800 },
    ],
  });
  Font.register({ family: "PlatePlex", src: assets.plexDataUrl, fontWeight: 600 });
  registeredFontKey = key;
}

function NameplatePdfDocument({ input, assets }: { input: NameplateInput; assets: NameplatePdfAssets }) {
  const layout = createNameplateLayout(input);
  const rowHeight = Math.min(8.1, 73 / Math.max(layout.rows.length, 1));
  const titleStartY = layout.title.lines.length > 1 ? 50 : 54;
  const transformed = (x: number, y: number, width: number, height: number) => ({
    left: mm(layout.offsetX + x * layout.scale),
    top: mm(layout.offsetY + y * layout.scale),
    width: mm(width * layout.scale),
    height: mm(height * layout.scale),
  });
  const diameter = Number(input.holeDiameterMm);
  const inset = Number(input.holeInsetMm);
  const holes = diameter > 0 && inset > diameter / 2
    ? [
        [inset, inset],
        [layout.widthMm - inset, inset],
        [inset, layout.heightMm - inset],
        [layout.widthMm - inset, layout.heightMm - inset],
      ]
    : [];

  return (
    <Document
      title={`${input.serialNo} · ORION Vinç Kimlik Plakası`}
      author="ORION CRANES"
      subject="Baskıya uygun vinç kimlik plakası"
      creator="ORION CRANES İş Yönetim Sistemi"
    >
      <Page size={[mm(layout.widthMm), mm(layout.heightMm)]} style={{ backgroundColor: BRAND.paper100 }}>
        <Svg
          viewBox={`0 0 ${layout.widthMm} ${layout.heightMm}`}
          style={{ position: "absolute", left: 0, top: 0, width: mm(layout.widthMm), height: mm(layout.heightMm) }}
        >
          <Rect width={layout.widthMm} height={layout.heightMm} fill={BRAND.paper100} />
          <Rect x={1.4} y={1.4} width={layout.widthMm - 2.8} height={layout.heightMm - 2.8} fill="none" stroke={BRAND.ink} strokeWidth={0.7} />
          <G transform={`translate(${layout.offsetX} ${layout.offsetY}) scale(${layout.scale})`}>
            <Rect x={0} y={0} width={8} height={160} fill={BRAND.red} />
            <Rect x={8} y={8} width={222} height={24} fill={BRAND.ink} />
            {layout.customerLogoDataUrl ? <Rect x={169} y={11} width={57} height={18} fill={BRAND.white} /> : null}
            <Rect x={8} y={32} width={222} height={2} fill={BRAND.red} />
            <Text x={18} y={42} fill={BRAND.red} style={{ fontFamily: "PlatePlex", fontSize: 3.1, fontWeight: 600, letterSpacing: 0.5 }}>VİNÇ KİMLİK PLAKASI</Text>
            {layout.title.lines.map((line, index) => (
              <Text key={`${index}-${line}`} x={18} y={titleStartY + index * 7} fill={BRAND.ink} style={{ fontFamily: "PlateArchivo", fontSize: layout.title.fontSize, fontWeight: 800 }}>{line}</Text>
            ))}
            <Line x1={160} y1={39} x2={160} y2={151} stroke={BRAND.red} strokeWidth={0.65} />
            {layout.rows.map((row, index) => {
              const y = 70 + index * rowHeight;
              return (
                <G key={`${row.label}-${index}`}>
                  <Line x1={18} y1={y + 3} x2={153} y2={y + 3} stroke={BRAND.line350} strokeWidth={0.32} />
                  <Text x={18} y={y} fill={BRAND.gray700} style={{ fontFamily: "PlatePlex", fontSize: 2.75, fontWeight: 600, letterSpacing: 0.18 }}>{row.label}</Text>
                  <Text x={74} y={y} fill={BRAND.ink} style={{ fontFamily: "PlatePlex", fontSize: row.valueFontSize, fontWeight: 600 }}>{row.value}</Text>
                </G>
              );
            })}
            <Text x={197} y={44} textAnchor="middle" fill={BRAND.red} style={{ fontFamily: "PlatePlex", fontSize: 3, fontWeight: 600, letterSpacing: 0.33 }}>TEKNİK DOKÜMANLAR</Text>
            <Rect x={layout.qr.x} y={layout.qr.y} width={layout.qr.size} height={layout.qr.size} fill={BRAND.white} stroke={BRAND.line350} strokeWidth={0.35} />
            <Path d={layout.qr.path} fill="#000000" />
            <Text x={197} y={117} textAnchor="middle" fill={BRAND.gray700} style={{ fontFamily: "PlatePlex", fontSize: 2.65, fontWeight: 600 }}>QR KODU TARAYIN</Text>
            <Rect x={169} y={122} width={56} height={16} fill={BRAND.ink} />
            <Text x={197} y={127} textAnchor="middle" fill={BRAND.gray400} style={{ fontFamily: "PlatePlex", fontSize: 2.25, fontWeight: 600, letterSpacing: 0.23 }}>SERİ NUMARASI</Text>
            <Text x={197} y={134} textAnchor="middle" fill={BRAND.paper100} style={{ fontFamily: "PlatePlex", fontSize: 4.1, fontWeight: 600 }}>{input.serialNo.trim()}</Text>
            <Text x={197} y={144} textAnchor="middle" fill={BRAND.gray700} style={{ fontFamily: "PlatePlex", fontSize: 2.2, fontWeight: 600 }}>ŞİFRELİ MÜŞTERİ ERİŞİMİ</Text>
            <Line x1={169} y1={148} x2={225} y2={148} stroke={BRAND.red} strokeWidth={0.45} />
            <Text x={197} y={152} textAnchor="middle" fill={BRAND.ink} style={{ fontFamily: "PlatePlex", fontSize: 2.05, fontWeight: 600 }}>ORION PORTAL</Text>
            {!layout.customerLogoDataUrl && layout.customerName ? (
              <Text x={224} y={20.8} textAnchor="end" fill={BRAND.paper100} style={{ fontFamily: "PlateArchivo", fontSize: 3.4, fontWeight: 700 }}>{trUpper(layout.customerName)}</Text>
            ) : null}
          </G>
          {holes.map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={diameter / 2} fill={BRAND.paper100} stroke={BRAND.ink} strokeWidth={0.8} />
          ))}
        </Svg>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image is not a DOM img. */}
        <Image src={assets.logoPaperDataUrl} style={{ position: "absolute", objectFit: "contain", ...transformed(15, 14, 92, 10) }} />
        {layout.customerLogoDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image is not a DOM img.
          <Image src={layout.customerLogoDataUrl} style={{ position: "absolute", objectFit: "contain", ...transformed(173, 14, 49, 12) }} />
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderNameplatePdf(
  input: NameplateInput,
  assets: NameplatePdfAssets
): Promise<Blob> {
  registerFonts(assets);
  return pdf(<NameplatePdfDocument input={input} assets={assets} />).toBlob();
}
