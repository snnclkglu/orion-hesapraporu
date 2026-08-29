// 240 × 160 mm VİNÇ KİMLİK PLAKASI — saf baskı geometrisi.
//
// SVG önizleme/indirme ve PDF çizicisi aynı `createNameplateLayout` sonucunu
// kullanır. Başlık hiçbir zaman üç noktayla kesilmez; gerçek baskı alanına
// göre kelime sınırında en fazla iki satıra ayrılır.

import QRCode from "qrcode";
import { BRAND, trUpper } from "@/lib/pdf/palette";
import type { ProductIdentityField, ProductIdentityValues } from "./types";

export const NAMEPLATE_TOGGLE_FIELDS = [
  "product",
  "craneType",
  "projectCode",
  "productionYear",
  "capacity",
  "span",
  "liftHeight",
  "dutyClass",
  "supplyVoltage",
  "controlVoltage",
  "frequency",
  "customer",
] as const satisfies readonly ProductIdentityField[];

export interface NameplateInput {
  widthMm: number;
  heightMm: number;
  serialNo: string;
  publicUrl: string;
  identity: ProductIdentityValues;
  hiddenFields?: readonly ProductIdentityField[];
  logoDataUrl: string;
  customerLogoDataUrl?: string | null;
  holeDiameterMm?: number;
  holeInsetMm?: number;
  embeddedFontsCss?: string;
}

export interface NameplateLayout {
  widthMm: number;
  heightMm: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  title: { lines: string[]; fontSize: number; overflow: boolean };
  rows: Array<{ label: string; value: string; valueFontSize: number }>;
  qr: { path: string; x: number; y: number; size: number; moduleMm: number };
  customerName: string;
  customerLogoDataUrl: string | null;
}

const BASE_WIDTH = 240;
const BASE_HEIGHT = 160;
const TITLE_MAX_WIDTH = 137;
const VALUE_MAX_WIDTH = 78;

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Archivo/Plex için baskı öncesi muhafazakâr glif genişliği tahmini. */
export function estimatedTextWidth(value: string, fontSize: number, mono = false): number {
  if (mono) return normalized(value).length * fontSize * 0.61;
  let units = 0;
  for (const character of normalized(value)) {
    if (/[MW@%&]/.test(character)) units += 0.94;
    else if (/[IİJ1|.,:;!'`]/.test(character)) units += 0.34;
    else if (/\s/.test(character)) units += 0.31;
    else if (/[ÇĞÖŞÜQO0]/.test(character)) units += 0.69;
    else units += 0.59;
  }
  return units * fontSize;
}

function balancedTitleLines(value: string, fontSize: number): string[] | null {
  const text = trUpper(normalized(value));
  if (!text) return [];
  if (estimatedTextWidth(text, fontSize) <= TITLE_MAX_WIDTH) return [text];
  const words = text.split(" ");
  let best: { lines: string[]; score: number } | null = null;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const firstWidth = estimatedTextWidth(first, fontSize);
    const secondWidth = estimatedTextWidth(second, fontSize);
    if (firstWidth > TITLE_MAX_WIDTH || secondWidth > TITLE_MAX_WIDTH) continue;
    const score = Math.max(firstWidth, secondWidth) + Math.abs(firstWidth - secondWidth) * 0.35;
    if (!best || score < best.score) best = { lines: [first, second], score };
  }
  return best?.lines ?? null;
}

export function layoutNameplateTitle(value: string): NameplateLayout["title"] {
  for (const fontSize of [6.2, 5.8, 5.4, 5.0, 4.7]) {
    const lines = balancedTitleLines(value, fontSize);
    if (lines) return { lines, fontSize, overflow: false };
  }
  return {
    lines: [trUpper(normalized(value))],
    fontSize: 4.7,
    overflow: true,
  };
}

function fitMonoSize(value: string): number {
  for (const size of [4.2, 3.9, 3.6, 3.3, 3.0, 2.7]) {
    if (estimatedTextWidth(value, size, true) <= VALUE_MAX_WIDTH) return size;
  }
  return 2.7;
}

function qrGeometry(value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "Q" });
  const quiet = 4;
  const cells = qr.modules.size + quiet * 2;
  const cell = size / cells;
  let path = "";
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      const px = x + (col + quiet) * cell;
      const py = y + (row + quiet) * cell;
      path += `M${px.toFixed(3)} ${py.toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
    }
  }
  return { path, x, y, size, moduleMm: cell };
}

function visibleValue(
  identity: ProductIdentityValues,
  hidden: Set<ProductIdentityField>,
  field: ProductIdentityField
): string {
  return hidden.has(field) ? "" : normalized(identity[field]);
}

export function createNameplateLayout(input: NameplateInput): NameplateLayout {
  const widthMm = Math.max(120, input.widthMm);
  const heightMm = Math.max(80, input.heightMm);
  const scale = Math.min(widthMm / BASE_WIDTH, heightMm / BASE_HEIGHT);
  const offsetX = (widthMm - BASE_WIDTH * scale) / 2;
  const offsetY = (heightMm - BASE_HEIGHT * scale) / 2;
  const hidden = new Set(input.hiddenFields ?? []);
  const product = visibleValue(input.identity, hidden, "product");
  const craneType = visibleValue(input.identity, hidden, "craneType");
  const title = layoutNameplateTitle(product || craneType || "VİNÇ");
  const titleIncludesType = product && craneType
    ? trUpper(product).includes(trUpper(craneType))
    : true;
  const supply = [
    visibleValue(input.identity, hidden, "supplyVoltage"),
    visibleValue(input.identity, hidden, "frequency"),
  ].filter(Boolean).join(" · ");
  const candidates: Array<[string, string]> = [
    ["SERİ NUMARASI", normalized(input.serialNo)],
    ...(!titleIncludesType && craneType ? [["VİNÇ TİPİ", craneType] as [string, string]] : []),
    ["PROJE / ÜRÜN KODU", visibleValue(input.identity, hidden, "projectCode")],
    ["ÜRETİM YILI", visibleValue(input.identity, hidden, "productionYear")],
    ["KALDIRMA KAPASİTESİ", visibleValue(input.identity, hidden, "capacity")],
    ["AÇIKLIK", visibleValue(input.identity, hidden, "span")],
    ["KALDIRMA YÜKSEKLİĞİ", visibleValue(input.identity, hidden, "liftHeight")],
    ["ÇALIŞMA SINIFI", visibleValue(input.identity, hidden, "dutyClass")],
    ["BESLEME", supply],
    ["KUMANDA GERİLİMİ", visibleValue(input.identity, hidden, "controlVoltage")],
  ];
  const rows = candidates
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({ label, value, valueFontSize: fitMonoSize(value) }));
  const customerName = visibleValue(input.identity, hidden, "customer");
  return {
    widthMm,
    heightMm,
    scale,
    offsetX,
    offsetY,
    title,
    rows,
    qr: qrGeometry(input.publicUrl, 168, 52, 58),
    customerName,
    customerLogoDataUrl: hidden.has("customer") ? null : input.customerLogoDataUrl ?? null,
  };
}

export function productPortalUrl(origin: string, publicCode: string): string {
  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  return `${normalizedOrigin}/paylas/vinc/${encodeURIComponent(publicCode)}`;
}

function holeMarkup(input: NameplateInput, layout: NameplateLayout): string {
  const diameter = Number(input.holeDiameterMm);
  const inset = Number(input.holeInsetMm);
  if (!(diameter > 0 && inset > diameter / 2)) return "";
  const radius = diameter / 2;
  const positions = [
    [inset, inset],
    [layout.widthMm - inset, inset],
    [inset, layout.heightMm - inset],
    [layout.widthMm - inset, layout.heightMm - inset],
  ];
  return positions.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${BRAND.paper100}" stroke="${BRAND.ink}" stroke-width="0.8"/>`
  ).join("");
}

export function buildNameplateSvg(input: NameplateInput): string {
  const layout = createNameplateLayout(input);
  const rowHeight = Math.min(8.1, 73 / Math.max(layout.rows.length, 1));
  const startY = 70;
  const titleStartY = layout.title.lines.length > 1 ? 50 : 54;
  const customer = layout.customerLogoDataUrl
    ? `<rect x="169" y="11" width="57" height="18" fill="#FFFFFF"/>
       <image href="${xml(layout.customerLogoDataUrl)}" x="173" y="14" width="49" height="12" preserveAspectRatio="xMidYMid meet"/>`
    : layout.customerName
      ? `<text x="224" y="20.8" text-anchor="end" class="sans" fill="${BRAND.paper100}" font-size="3.4" font-weight="700">${xml(trUpper(layout.customerName))}</text>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.widthMm}mm" height="${layout.heightMm}mm" viewBox="0 0 ${layout.widthMm} ${layout.heightMm}" role="img" aria-label="${xml(input.serialNo)} vinç kimlik plakası">
  <style>
    ${input.embeddedFontsCss ?? ""}
    .sans{font-family:Archivo,Arial,sans-serif}.mono{font-family:PlexMono,"IBM Plex Mono",monospace}
  </style>
  <rect width="${layout.widthMm}" height="${layout.heightMm}" fill="${BRAND.paper100}"/>
  <rect x="1.4" y="1.4" width="${layout.widthMm - 2.8}" height="${layout.heightMm - 2.8}" fill="none" stroke="${BRAND.ink}" stroke-width="0.7"/>
  <g transform="translate(${layout.offsetX.toFixed(3)} ${layout.offsetY.toFixed(3)}) scale(${layout.scale.toFixed(6)})">
    <rect x="0" y="0" width="8" height="160" fill="${BRAND.red}"/>
    <rect x="8" y="8" width="222" height="24" fill="${BRAND.ink}"/>
    <image href="${xml(input.logoDataUrl)}" x="15" y="14" width="92" height="10" preserveAspectRatio="xMinYMid meet"/>
    ${customer}
    <rect x="8" y="32" width="222" height="2" fill="${BRAND.red}"/>
    <text x="18" y="42" class="mono" fill="${BRAND.red}" font-size="3.1" font-weight="700" letter-spacing=".16em">VİNÇ KİMLİK PLAKASI</text>
    ${layout.title.lines.map((line, index) => `<text data-nameplate-title-line="${index + 1}" x="18" y="${(titleStartY + index * 7).toFixed(1)}" class="sans" fill="${BRAND.ink}" font-size="${layout.title.fontSize}" font-weight="800">${xml(line)}</text>`).join("")}
    <line x1="160" y1="39" x2="160" y2="151" stroke="${BRAND.red}" stroke-width=".65"/>
    ${layout.rows.map((row, index) => {
      const y = startY + index * rowHeight;
      return `<g>
        <line x1="18" y1="${(y + 3).toFixed(2)}" x2="153" y2="${(y + 3).toFixed(2)}" stroke="${BRAND.line350}" stroke-width=".32"/>
        <text x="18" y="${y.toFixed(2)}" class="mono" fill="${BRAND.gray700}" font-size="2.75" font-weight="600" letter-spacing=".06em">${xml(row.label)}</text>
        <text x="74" y="${y.toFixed(2)}" class="mono" fill="${BRAND.ink}" font-size="${row.valueFontSize}" font-weight="700">${xml(row.value)}</text>
      </g>`;
    }).join("")}
    <text x="197" y="44" text-anchor="middle" class="mono" fill="${BRAND.red}" font-size="3" font-weight="700" letter-spacing=".11em">TEKNİK DOKÜMANLAR</text>
    <rect x="${layout.qr.x}" y="${layout.qr.y}" width="${layout.qr.size}" height="${layout.qr.size}" fill="#FFFFFF" stroke="${BRAND.line350}" stroke-width=".35"/>
    <path d="${layout.qr.path}" fill="#000000" shape-rendering="crispEdges"/>
    <text x="197" y="117" text-anchor="middle" class="mono" fill="${BRAND.gray700}" font-size="2.65" font-weight="600">QR KODU TARAYIN</text>
    <rect x="169" y="122" width="56" height="16" fill="${BRAND.ink}"/>
    <text x="197" y="127" text-anchor="middle" class="mono" fill="${BRAND.gray400}" font-size="2.25" letter-spacing=".1em">SERİ NUMARASI</text>
    <text x="197" y="134" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="4.1" font-weight="700">${xml(normalized(input.serialNo))}</text>
    <text x="197" y="144" text-anchor="middle" class="mono" fill="${BRAND.gray700}" font-size="2.2">ŞİFRELİ MÜŞTERİ ERİŞİMİ</text>
    <line x1="169" y1="148" x2="225" y2="148" stroke="${BRAND.red}" stroke-width=".45"/>
    <text x="197" y="152" text-anchor="middle" class="mono" fill="${BRAND.ink}" font-size="2.05">ORION PORTAL</text>
  </g>
  ${holeMarkup(input, layout)}
</svg>`;
}
