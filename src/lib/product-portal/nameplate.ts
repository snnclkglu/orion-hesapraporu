// 240 × 160 mm VİNÇ KİMLİK PLAKASI — saf SVG geometrisi.
//
// Ekran önizlemesi ile baskıya giden dosya AYNI fonksiyondan çıkar. QR modülü
// siyah/beyaz ve dört modül sessiz alanlıdır; logo onaylı SVG varlığının veri
// adresidir, metinle yeniden dizilmez. Delikler üretim kararı olduğundan ancak
// ölçüsü açıkça verilirse çizilir.

import QRCode from "qrcode";
import { BRAND } from "@/lib/pdf/palette";
import type { ProductIdentityField, ProductIdentityValues } from "./types";

export interface NameplateInput {
  widthMm: number;
  heightMm: number;
  serialNo: string;
  publicUrl: string;
  identity: ProductIdentityValues;
  hiddenFields?: readonly ProductIdentityField[];
  logoDataUrl: string;
  holeDiameterMm?: number;
  holeInsetMm?: number;
  embeddedFontsCss?: string;
}

const LABELS: Partial<Record<ProductIdentityField, string>> = {
  projectCode: "PROJE / ÜRÜN KODU",
  productionYear: "ÜRETİM YILI",
  capacity: "KALDIRMA KAPASİTESİ",
  span: "AÇIKLIK",
  liftHeight: "KALDIRMA YÜKSEKLİĞİ",
  dutyClass: "ÇALIŞMA SINIFI",
  supplyVoltage: "BESLEME GERİLİMİ",
  controlVoltage: "KUMANDA GERİLİMİ",
  frequency: "FREKANS",
};

const DATA_FIELDS: ProductIdentityField[] = [
  "projectCode",
  "productionYear",
  "capacity",
  "span",
  "liftHeight",
  "dutyClass",
  "supplyVoltage",
  "controlVoltage",
  "frequency",
];

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function compact(value: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}…`;
}

export function productPortalUrl(origin: string, publicCode: string): string {
  const normalized = origin.trim().replace(/\/+$/, "");
  return `${normalized}/paylas/vinc/${encodeURIComponent(publicCode)}`;
}

function qrPath(value: string, x: number, y: number, size: number): string {
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
  return path;
}

function holeMarkup(input: NameplateInput): string {
  const diameter = Number(input.holeDiameterMm);
  const inset = Number(input.holeInsetMm);
  if (!(diameter > 0 && inset > diameter / 2)) return "";
  const r = diameter / 2;
  const positions = [
    [inset, inset],
    [input.widthMm - inset, inset],
    [inset, input.heightMm - inset],
    [input.widthMm - inset, input.heightMm - inset],
  ];
  return positions.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BRAND.paper100}" stroke="${BRAND.ink}" stroke-width="0.8"/>`
  ).join("");
}

export function buildNameplateSvg(input: NameplateInput): string {
  const width = Math.max(80, input.widthMm);
  const height = Math.max(80, input.heightMm);
  // İç geometri orantılı ölçeklenir; özellikle QR hiçbir ölçüde dikdörtgene
  // dönüşmez. Farklı en-boy oranında artan alan arduvaz güvenli boşluktur.
  const scale = Math.min(width / 240, height / 160);
  const offsetX = (width - 240 * scale) / 2;
  const offsetY = (height - 160 * scale) / 2;
  const hidden = new Set(input.hiddenFields ?? []);
  const dataRows: Array<[string, string]> = DATA_FIELDS
      .filter((key) => !hidden.has(key) && input.identity[key].trim())
      .map((key) => [LABELS[key] ?? key, input.identity[key]] as [string, string]);
  const rows = ([
    ["SERİ NUMARASI", input.serialNo],
    ...dataRows,
  ] as Array<[string, string]>).slice(0, 9);
  const rowHeight = Math.min(10.3, 91 / Math.max(rows.length, 1));
  const startY = 51;
  const qrX = 166;
  const qrY = 55;
  const qrSize = 62;
  const qr = qrPath(input.publicUrl, qrX, qrY, qrSize);
  const fontStyle = input.embeddedFontsCss ?? "";
  const product = compact(input.identity.product || input.identity.craneType, 48);
  const craneType = input.identity.product && input.identity.craneType
    ? compact(input.identity.craneType, 54)
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(input.serialNo)} vinç kimlik plakası">
  <style>
    ${fontStyle}
    .sans{font-family:Archivo,Arial,sans-serif}.mono{font-family:PlexMono,"IBM Plex Mono",monospace}
    .label{font-size:3.1px;font-weight:600;letter-spacing:.11em}.value{font-size:4.5px;font-weight:600}
  </style>
  <rect width="${width}" height="${height}" fill="${BRAND.slate}"/>
  <rect x="1.4" y="1.4" width="${width - 2.8}" height="${height - 2.8}" fill="none" stroke="${BRAND.paper100}" stroke-width="0.55"/>
  <g transform="translate(${offsetX.toFixed(3)} ${offsetY.toFixed(3)}) scale(${scale.toFixed(6)})">
    <rect x="10" y="8" width="220" height="22" fill="${BRAND.ink}"/>
    <image href="${xml(input.logoDataUrl)}" x="14" y="13.8" width="92" height="11.2" preserveAspectRatio="xMinYMid meet"/>
    <text x="226" y="18.1" text-anchor="end" class="mono" fill="${BRAND.paper100}" font-size="3.2" font-weight="600" letter-spacing=".18em">VİNÇ KİMLİK PLAKASI</text>
    <text x="12" y="39" class="sans" fill="${BRAND.paper100}" font-size="6.2" font-weight="800">${xml(product)}</text>
    ${craneType ? `<text x="12" y="45" class="sans" fill="${BRAND.paper100}" font-size="3.5" font-weight="500">${xml(craneType)}</text>` : ""}
    <line x1="158" y1="38" x2="158" y2="147" stroke="${BRAND.paper100}" stroke-width=".45" opacity=".7"/>
    ${rows.map(([label, value], index) => {
      const y = startY + index * rowHeight;
      return `<g>
        <line x1="12" y1="${(y + 3.4).toFixed(2)}" x2="151" y2="${(y + 3.4).toFixed(2)}" stroke="${BRAND.paper100}" stroke-width=".28" opacity=".48"/>
        <text x="12" y="${y.toFixed(2)}" class="mono label" fill="${BRAND.paper100}" opacity=".78">${xml(label)}</text>
        <text x="70" y="${y.toFixed(2)}" class="mono value" fill="${BRAND.paper100}">${xml(compact(value, 29))}</text>
      </g>`;
    }).join("")}
    <text x="197" y="43.5" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="3.2" font-weight="600" letter-spacing=".1em">TEKNİK DOKÜMANLAR</text>
    <rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="#FFFFFF"/>
    <path d="${qr}" fill="#000000" shape-rendering="crispEdges"/>
    <text x="197" y="124" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="3.2" font-weight="600">QR KODU TARAYIN</text>
    <text x="197" y="130" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="2.6">${xml(compact(input.serialNo, 26))}</text>
    <text x="197" y="138" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="2.25">ŞİFRELİ MÜŞTERİ ERİŞİMİ</text>
    <line x1="166" y1="143" x2="228" y2="143" stroke="${BRAND.paper100}" stroke-width=".35" opacity=".7"/>
    <text x="197" y="148" text-anchor="middle" class="mono" fill="${BRAND.paper100}" font-size="2.1">ORIONCRANES.COM</text>
  </g>
  ${holeMarkup(input)}
</svg>`;
}
