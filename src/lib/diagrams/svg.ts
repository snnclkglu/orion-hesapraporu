// DİYAGRAM → SVG METNİ — saf, React'siz, indirilebilir dosya için.
//
// ═══════════════════════════════════════════════ NEDEN ÜÇÜNCÜ BİR ÇİZİCİ
//
// `Diagram` modelini bugün iki çizici basıyor: `components/diagrams/diagram-svg.tsx`
// (React, ekran) ve `lib/pdf/diagram.tsx` (@react-pdf, kâğıt). Kullanıcı şemayı
// DOSYA olarak indirmek istiyor ve ikisi de bunu veremez: birincisi bir React
// ağacıdır, ikincisi PDF.
//
// `pdf/diagram.tsx`in başındaki uyarı ölçülmüş bir tuzağı anlatıyor: ikinci bir
// çevirici yazıldığında `circle`, `bold` ve `strokeLinecap` SESSİZCE düşmüştü.
// Bu dosya o tuzağı DERLEME ZAMANINDA kapatır — `switch` tüketicidir ve
// `default` dalında `const _tam: never = el` durur. `DiagramEl`e yeni bir tür
// eklendiğinde bu dosya derlenmez ve kimse eksik bir SVG indiremez.
//
// TEMA DEĞİŞKENİ YAZILMAZ. İndirilen dosya pano imalatçısına gider ve orada
// `var(--oc-diagram-ink)` diye bir şey yoktur; model renkleri BASKI hex'idir ve
// dosyaya olduğu gibi girer (`product-portal/nameplate.ts` ile aynı ilke:
// indirilen belge KENDİ BAŞINA YETER).

import type { Diagram, DiagramEl } from "./model";

/** Ekrandaki `DiagramSvg` ile aynı yazı ailesi; kâğıtta DejaVu'ya düşer. */
const MONO = "'IBM Plex Mono','DejaVu Sans Mono',ui-monospace,monospace";

function kacir(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function n(v: number): string {
  // Ondalık gürültü dosyayı üç katına çıkarır ve hiçbir şey anlatmaz.
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

function oz(ad: string, deger: string | number | undefined): string {
  if (deger === undefined || deger === null || deger === "") return "";
  return ` ${ad}="${typeof deger === "number" ? n(deger) : kacir(deger)}"`;
}

function elemanSvg(el: DiagramEl): string {
  switch (el.kind) {
    case "line":
      return (
        `<line${oz("x1", el.x1)}${oz("y1", el.y1)}${oz("x2", el.x2)}${oz("y2", el.y2)}` +
        `${oz("stroke", el.stroke)}${oz("stroke-width", el.strokeWidth)}` +
        `${oz("stroke-dasharray", el.dash)}${oz("stroke-linecap", el.cap)}/>`
      );
    case "rect":
      return (
        `<rect${oz("x", el.x)}${oz("y", el.y)}${oz("width", el.w)}${oz("height", el.h)}` +
        `${oz("rx", el.rx)}${oz("fill", el.fill ?? "none")}${oz("stroke", el.stroke)}` +
        `${oz("stroke-width", el.strokeWidth)}/>`
      );
    case "circle":
      return (
        `<circle${oz("cx", el.cx)}${oz("cy", el.cy)}${oz("r", el.r)}` +
        `${oz("fill", el.fill ?? "none")}${oz("stroke", el.stroke)}` +
        `${oz("stroke-width", el.strokeWidth)}${oz("stroke-dasharray", el.dash)}/>`
      );
    case "path":
      return (
        `<path${oz("d", el.d)}${oz("fill", el.fill ?? "none")}${oz("stroke", el.stroke)}` +
        `${oz("stroke-width", el.strokeWidth)}${oz("stroke-dasharray", el.dash)}` +
        `${oz("stroke-linecap", el.cap)}/>`
      );
    case "polygon":
      return (
        `<polygon${oz("points", el.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" "))}` +
        `${oz("fill", el.fill ?? "none")}${oz("stroke", el.stroke)}` +
        `${oz("stroke-width", el.strokeWidth)}/>`
      );
    case "text":
      return (
        `<text${oz("x", el.x)}${oz("y", el.y)}${oz("font-size", el.size)}` +
        `${oz("text-anchor", el.anchor)}${oz("fill", el.fill)}` +
        `${oz("font-family", MONO)}${oz("font-weight", el.bold ? 600 : 400)}` +
        `>${kacir(el.text)}</text>`
      );
    default: {
      // TÜKETİCİ SWITCH: yeni bir `DiagramEl` türü eklendiğinde burası derlenmez
      // ve eksik çevirici YAYINLANAMAZ.
      const _tam: never = el;
      return _tam;
    }
  }
}

export interface SvgSecenekleri {
  /** `<title>` — ekran okuyucular ve dosya yöneticisi için. */
  baslik?: string;
  /** `<desc>` üstverisi — dosya yöneticisinde ve ekran okuyucuda görünür. */
  aciklama?: string;
  /**
   * ÇİZİMİN ALTINA GÖRÜNÜR MÜREKKEPLE yazılan altbilgi.
   *
   * Ölçüldü (07.09.2026): tarih ve parmak izi yalnız `<desc>` üstverisindeydi.
   * İmalatçı dosyayı bir görüntüleyicide açtığında ya da BASTIĞINDA onu
   * göremiyordu — oysa PDF'in altbilgisinde her sayfada görünüyor. Aynı belge
   * iki biçimde iki farklı şey söylüyordu (PANO-15).
   */
  altbilgi?: string;
}

/** Görünür altbilgi şeridinin yüksekliği [çizim birimi]. */
const ALTBILGI_BOY = 18;

/**
 * SVG parçalarını ayıran satır sonu.
 *
 * Kaçış dizisi yerine kod noktasıyla yazılır: bu dosyaya kabuk/betik yoluyla
 * yapılan bir düzenlemede `"\n"` bir kez GERÇEK satır sonuna dönüştü ve dosya
 * derlenmez oldu (PANO-19'un aynı tuzağı, bu kez ters yönde).
 */
const SATIR_SONU = String.fromCharCode(10);

function altbilgiSvg(metin: string, en: number, x0: number, y: number): string {
  return [
    `<line x1="${n(x0)}" y1="${n(y)}" x2="${n(x0 + en)}" y2="${n(y)}" stroke="#DCD9D7" stroke-width="0.6"/>`,
    `<text x="${n(x0 + 2)}" y="${n(y + 11)}" font-family="DejaVu Sans, Arial, sans-serif" ` +
      `font-size="7.5" fill="#8A8480">${kacir(metin)}</text>`,
  ].join(SATIR_SONU);
}

/**
 * `Diagram`ı kendi başına yeten bir SVG belgesine çevirir.
 *
 * `width`/`height` MİLİMETRE değil piksel verilir: bu bir teknik resim
 * dosyası değil bir ŞEMADIR ve ölçüler çizimin kendi ölçü zincirlerindedir.
 * mm vermek, açan programın çizimi kâğıda ölçekli basacağı yanılgısını
 * doğururdu.
 */
export function diagramToSvg(diagram: Diagram, secenek?: SvgSecenekleri): string {
  const x0 = diagram.x0 ?? 0;
  const y0 = diagram.y0 ?? 0;
  const parcalar: string[] = [];

  const altBoy = secenek?.altbilgi ? ALTBILGI_BOY : 0;
  parcalar.push('<?xml version="1.0" encoding="UTF-8"?>');
  parcalar.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(diagram.width)}" height="${n(
      diagram.height + altBoy
    )}" viewBox="${n(x0)} ${n(y0)} ${n(diagram.width)} ${n(diagram.height + altBoy)}">`
  );
  if (secenek?.baslik) parcalar.push(`<title>${kacir(secenek.baslik)}</title>`);
  if (secenek?.aciklama) parcalar.push(`<desc>${kacir(secenek.aciklama)}</desc>`);
  // Beyaz zemin: indirilen dosya koyu bir görüntüleyicide de okunmalı.
  parcalar.push(
    `<rect x="${n(x0)}" y="${n(y0)}" width="${n(diagram.width)}" height="${n(
      diagram.height + altBoy
    )}" fill="#FFFFFF"/>`
  );
  for (const el of diagram.els) parcalar.push(elemanSvg(el));
  if (secenek?.altbilgi) {
    parcalar.push(altbilgiSvg(secenek.altbilgi, diagram.width, x0, y0 + diagram.height));
  }
  parcalar.push("</svg>");
  return parcalar.join("\n");
}

/** Birden çok çizimi alt alta tek dosyada birleştirir. */
export function diagramsToSvg(
  diagrams: readonly Diagram[],
  secenek?: SvgSecenekleri
): string {
  if (diagrams.length === 0) return diagramToSvg({ width: 10, height: 10, els: [] }, secenek);
  if (diagrams.length === 1) return diagramToSvg(diagrams[0], secenek);

  const ARA = 28;
  const altBoy = secenek?.altbilgi ? ALTBILGI_BOY : 0;
  const en = Math.max(...diagrams.map((d) => d.width));
  const boy =
    diagrams.reduce((t, d) => t + d.height, 0) + ARA * (diagrams.length - 1) + altBoy;

  const parcalar: string[] = [];
  parcalar.push('<?xml version="1.0" encoding="UTF-8"?>');
  parcalar.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(en)}" height="${n(
      boy
    )}" viewBox="0 0 ${n(en)} ${n(boy)}">`
  );
  if (secenek?.baslik) parcalar.push(`<title>${kacir(secenek.baslik)}</title>`);
  if (secenek?.aciklama) parcalar.push(`<desc>${kacir(secenek.aciklama)}</desc>`);
  parcalar.push(`<rect x="0" y="0" width="${n(en)}" height="${n(boy)}" fill="#FFFFFF"/>`);

  let y = 0;
  for (const d of diagrams) {
    const x0 = d.x0 ?? 0;
    const y0 = d.y0 ?? 0;
    parcalar.push(`<g transform="translate(${n(-x0)} ${n(y - y0)})">`);
    for (const el of d.els) parcalar.push(elemanSvg(el));
    parcalar.push("</g>");
    y += d.height + ARA;
  }
  if (secenek?.altbilgi) parcalar.push(altbilgiSvg(secenek.altbilgi, en, 0, boy - altBoy + 4));
  parcalar.push("</svg>");
  return parcalar.join("\n");
}
