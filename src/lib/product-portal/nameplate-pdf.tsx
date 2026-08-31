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
import { mm } from "@/lib/pdf/palette";
import {
  createNameplateLayout,
  type NameplateInput,
  type NameplateLayout,
  type TrackedGlyph,
} from "./nameplate";
import { PLATE_FONT_FILES, PLATE_LOGO_RASTER_URL } from "./plate-assets";

/*
 * ÇİZİM MODELİ SVG İLE ORTAKTIR — burada tek bir koordinat hesaplanmaz.
 *
 * Önceki sürümde iki çizici ayrı sabitler taşıyordu ve sessizce ayrışıyorlardı:
 * ORION logosu SVG'de sola dayalıyken PDF'te ortalanıyordu, harf aralığı SVG'de
 * uygulanıp PDF'te düşüyordu (@react-pdf `letterSpacing`i okumaz). Artık ikisi de
 * `createNameplateLayout`ın ürettiği mm koordinatlarını basar; aralıklı yazılar
 * karakter karakter konumlanmış olarak gelir.
 */
export interface NameplatePdfAssets {
  archivoBold: string;
  archivoExtraBold: string;
  plexSemiBold: string;
  logoRaster: string;
}

/**
 * Tarayıcıda varsayılan: aynı kökendeki statik dosyalar.
 *
 * Node'da (vitest, `scripts/render-nameplate-pdf-preview.tsx`) göreli adres
 * çözülemez; oralar `data:` URL geçer. Bu ayrımın kendisi bir uyarıdır: Node
 * testi GEOMETRİYİ sınar, tarayıcının varlık yükleme yolunu SINAMAZ.
 */
const BROWSER_ASSETS: NameplatePdfAssets = {
  archivoBold: PLATE_FONT_FILES.archivoBold,
  archivoExtraBold: PLATE_FONT_FILES.archivoExtraBold,
  plexSemiBold: PLATE_FONT_FILES.plexSemiBold,
  logoRaster: PLATE_LOGO_RASTER_URL,
};

let registeredKey = "";

function registerFonts(assets: NameplatePdfAssets) {
  const key = `${assets.archivoBold}|${assets.archivoExtraBold}|${assets.plexSemiBold}`;
  if (registeredKey === key) return;
  Font.register({
    family: "PlateArchivo",
    fonts: [
      { src: assets.archivoBold, fontWeight: 700 },
      { src: assets.archivoExtraBold, fontWeight: 800 },
    ],
  });
  Font.register({ family: "PlatePlex", src: assets.plexSemiBold, fontWeight: 600 });
  registeredKey = key;
}

function GlyphRun({
  glyphs,
  y,
  size,
  fill,
}: {
  glyphs: readonly TrackedGlyph[];
  y: number;
  size: number;
  fill: string;
}) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <Text
          key={`${index}-${glyph.char}`}
          x={glyph.x}
          y={y}
          fill={fill}
          style={{ fontFamily: "PlatePlex", fontSize: size, fontWeight: 600 }}
        >
          {glyph.char}
        </Text>
      ))}
    </>
  );
}

function NameplatePdfDocument({
  input,
  layout,
  assets,
}: {
  input: NameplateInput;
  layout: NameplateLayout;
  assets: NameplatePdfAssets;
}) {
  const l = layout;
  const p = l.palette;
  const bandX = l.accent.width;
  const bandW = l.widthMm - l.accent.width - l.header.y;
  // @react-pdf `Image` SVG içine girmez; sayfa üstünde mutlak konumlanır ve
  // mm → pt çevrimi burada yapılır.
  const box = (x: number, y: number, width: number, height: number) => ({
    left: mm(x),
    top: mm(y),
    width: mm(width),
    height: mm(height),
  });

  return (
    <Document
      title={`${input.serialNo} · ORION Vinç Kimlik Plakası`}
      author="ORION CRANES"
      subject="Baskıya uygun vinç kimlik plakası"
      creator="ORION CRANES İş Yönetim Sistemi"
    >
      <Page size={[mm(l.widthMm), mm(l.heightMm)]} style={{ backgroundColor: p.paper }}>
        <Svg
          viewBox={`0 0 ${l.widthMm} ${l.heightMm}`}
          style={{ position: "absolute", left: 0, top: 0, width: mm(l.widthMm), height: mm(l.heightMm) }}
        >
          <Rect width={l.widthMm} height={l.heightMm} fill={p.paper} />
          <Rect
            x={l.frameInset}
            y={l.frameInset}
            width={l.widthMm - l.frameInset * 2}
            height={l.heightMm - l.frameInset * 2}
            fill="none"
            stroke={p.ink}
            strokeWidth={l.frameInset * 0.5}
          />
          <Rect x={0} y={0} width={l.accent.width} height={l.heightMm} fill={p.accent} />
          <Rect x={bandX} y={l.header.y} width={bandW} height={l.header.height} fill={p.band} />
          {l.header.customerLogo ? (
            <Rect
              x={l.header.customerLogo.x - 2}
              y={l.header.customerLogo.y - 1.5}
              width={l.header.customerLogo.width + 4}
              height={l.header.customerLogo.height + 3}
              fill={p.paper}
            />
          ) : null}
          {!l.header.customerLogo && l.header.customerName ? (
            <Text
              x={l.header.customerNameX}
              y={l.header.customerNameY}
              textAnchor="end"
              fill={p.bandText}
              style={{ fontFamily: "PlateArchivo", fontSize: l.header.customerNameSize, fontWeight: 700 }}
            >
              {l.header.customerName.toLocaleUpperCase("tr-TR")}
            </Text>
          ) : null}
          <Rect x={bandX} y={l.header.rule.y} width={bandW} height={l.header.rule.height} fill={p.accent} />

          <GlyphRun glyphs={l.kicker.glyphs} y={l.kicker.y} size={l.kicker.size} fill={p.accent} />

          {l.title.lines.map((line, index) => (
            <Text
              key={`${index}-${line}`}
              x={l.title.x}
              y={l.title.y + index * l.title.lineHeight}
              fill={p.ink}
              style={{ fontFamily: "PlateArchivo", fontSize: l.title.size, fontWeight: 800 }}
            >
              {line}
            </Text>
          ))}

          {l.capacity ? (
            <G>
              <Rect
                x={l.capacity.x}
                y={l.capacity.y}
                width={l.capacity.width}
                height={l.capacity.height}
                fill="none"
                stroke={p.accent}
                strokeWidth={l.frameInset * 0.45}
              />
              <Text
                x={l.capacity.x + l.capacity.height * 0.24}
                y={l.capacity.y + l.capacity.height * 0.38}
                fill={p.accent}
                style={{ fontFamily: "PlatePlex", fontSize: l.capacity.labelSize, fontWeight: 600 }}
              >
                {l.capacity.label}
              </Text>
              <Text
                x={l.capacity.x + l.capacity.height * 0.24}
                y={l.capacity.y + l.capacity.height * 0.88}
                fill={p.ink}
                style={{ fontFamily: "PlatePlex", fontSize: l.capacity.valueSize, fontWeight: 600 }}
              >
                {l.capacity.value}
              </Text>
            </G>
          ) : null}

          {l.divider ? (
            <Line
              x1={l.divider.x}
              y1={l.divider.y1}
              x2={l.divider.x}
              y2={l.divider.y2}
              stroke={p.accent}
              strokeWidth={l.frameInset * 0.45}
            />
          ) : null}

          {l.rows.map((row, index) => (
            <G key={`${row.label}-${index}`}>
              <Line
                x1={l.labelX}
                y1={row.y + row.labelSize * 0.9}
                x2={l.rowRuleX2}
                y2={row.y + row.labelSize * 0.9}
                stroke={p.hairline}
                strokeWidth={0.32}
              />
              <Text x={l.labelX} y={row.y} fill={p.muted} style={{ fontFamily: "PlatePlex", fontSize: row.labelSize, fontWeight: 600 }}>
                {row.label}
              </Text>
              <Text x={l.valueX} y={row.y} fill={p.ink} style={{ fontFamily: "PlatePlex", fontSize: row.valueSize, fontWeight: 600 }}>
                {row.value}
              </Text>
            </G>
          ))}

          <GlyphRun glyphs={l.qrCaption.glyphs} y={l.qrCaption.y} size={l.qrCaption.size} fill={p.accent} />
          <Rect x={l.qr.x} y={l.qr.y} width={l.qr.size} height={l.qr.size} fill="#FFFFFF" stroke={p.hairline} strokeWidth={0.35} />
          <Path d={l.qr.path} fill="#000000" />
          <Text
            x={l.fallback.x}
            y={l.fallback.codeY}
            textAnchor="middle"
            fill={p.ink}
            style={{ fontFamily: "PlatePlex", fontSize: l.fallback.codeSize, fontWeight: 600 }}
          >
            {l.fallback.code}
          </Text>
          <Text
            x={l.fallback.x}
            y={l.fallback.urlY}
            textAnchor="middle"
            fill={p.muted}
            style={{ fontFamily: "PlatePlex", fontSize: l.fallback.urlSize, fontWeight: 600 }}
          >
            {l.fallback.url}
          </Text>

          {l.serialBox ? (
            <G>
              <Rect x={l.serialBox.x} y={l.serialBox.y} width={l.serialBox.width} height={l.serialBox.height} fill={p.band} />
              <Text
                x={l.serialBox.centerX}
                y={l.serialBox.labelY}
                textAnchor="middle"
                fill={p.paper}
                style={{ fontFamily: "PlatePlex", fontSize: l.serialBox.labelSize, fontWeight: 600 }}
              >
                {l.serialBox.label}
              </Text>
              <Text
                x={l.serialBox.centerX}
                y={l.serialBox.valueY}
                textAnchor="middle"
                fill={p.bandText}
                style={{ fontFamily: "PlatePlex", fontSize: l.serialBox.valueSize, fontWeight: 600 }}
              >
                {l.serialBox.value}
              </Text>
            </G>
          ) : null}

          <Line
            x1={l.accent.width}
            y1={l.legal.rule.y}
            x2={l.widthMm - l.header.y}
            y2={l.legal.rule.y}
            stroke={p.hairline}
            strokeWidth={0.35}
          />
          {l.legal.ce ? <Path d={l.legal.ce.path} fill={p.ink} /> : null}
          {l.legal.lines.map((line, index) => (
            <Text
              key={`${index}-${line.text}`}
              x={l.legal.x}
              y={line.y}
              fill={p.ink}
              style={{ fontFamily: "PlateArchivo", fontSize: line.size, fontWeight: 700 }}
            >
              {line.text}
            </Text>
          ))}

          {l.holes.map((hole) => (
            <Circle key={`${hole.cx}-${hole.cy}`} cx={hole.cx} cy={hole.cy} r={hole.r} fill={p.paper} stroke={p.ink} strokeWidth={0.8} />
          ))}
        </Svg>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image is not a DOM img. */}
        <Image
          src={assets.logoRaster}
          style={{
            position: "absolute",
            objectFit: "contain",
            objectPositionX: "0%",
            ...box(l.header.logo.x, l.header.logo.y, l.header.logo.width, l.header.logo.height),
          }}
        />
        {l.customerLogoDataUrl && l.header.customerLogo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image is not a DOM img.
          <Image
            src={l.customerLogoDataUrl}
            style={{
              position: "absolute",
              objectFit: "contain",
              ...box(
                l.header.customerLogo.x,
                l.header.customerLogo.y,
                l.header.customerLogo.width,
                l.header.customerLogo.height
              ),
            }}
          />
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderNameplatePdf(
  input: NameplateInput,
  assets: NameplatePdfAssets = BROWSER_ASSETS
): Promise<Blob> {
  registerFonts(assets);
  const layout = createNameplateLayout(input);
  return pdf(<NameplatePdfDocument input={input} layout={layout} assets={assets} />).toBlob();
}
