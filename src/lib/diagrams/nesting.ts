// SAC PLAKA YERLEŞİM ÇİZİMİ — bir plakanın kesim planı.
//
// ═══════════════════════════════════════════════ NEDEN `charts.tsx` DEĞİL
//
// Pano grafikleri (`components/charts.tsx`) HTML kutularıdır ve PDF'e HİÇ
// basılamaz. Kesim planı ATÖLYEYE KAĞITLA gider; `lib/diagrams` modeli tek
// yazımla iki hedefe basar (web `DiagramSvg`, PDF `report.tsx:PdfDiagram`).
// Üstelik burada okunacak şey kategorik bir eksen değil ÖLÇÜLÜ bir yerleşimdir
// — mm cinsinden koordinat, plaka kenarı, fire alanı.
//
// ═══════════════════════════════════════════════ ETİKET SORUNU VE ÇÖZÜMÜ
//
// 12.000 mm'lik bir plaka çizim tuvalinde ~1000 birime iner: ölçek 1/12'dir ve
// 50 mm'lik bir parça 4 birim eder. O parçanın ÜSTÜNE yazı yazmak imkânsızdır.
//
// Çözüm parçayı NUMARALANDIRMAKTIR: çizimde yalnız sığan numaralar görünür,
// numaranın karşılığı ekrandaki listede durur. Gerçek nesting yazılımları da
// böyle yapar ve sebebi aynıdır — resim yerleşimi, liste kimliği anlatır.
//
// Sığmayan numara ÇİZİLMEZ (uydurulmuş bir yazı okunmaz bir yazıdan iyidir);
// parça yine de dolgusuyla görünür ve listede satırı vardır.

import {
  DCOL,
  dimH,
  dimV,
  fitDiagram,
  fmtN,
  txt,
  type Diagram,
  type DiagramEl,
} from "./model";
import type { Plaka } from "@/lib/purchasing/hammadde/nesting";

/** Tuvalin plakaya ayrılan genişliği [çizim birimi]. */
const TUVAL_EN = 1000;
/** Kenar boşluğu — ölçü okları ve etiketler için. */
const KENAR = 46;
/** Numaranın çizilebilmesi için parçanın en az bu kadar birim olması gerekir. */
const EN_KUCUK_ETIKET = 16;

export interface YerlesimCizimGirdisi {
  plaka: Plaka;
  /** Parça anahtarı → çizimde görünecek numara. Listeyle ORTAK olmalıdır. */
  numaralar: ReadonlyMap<string, number>;
  /** Başlık satırı: "SAC 15 MM S355JR · Plaka 2/5". */
  baslik: string;
  /** Alt not: doluluk, fire, ağırlık. */
  altNot?: string;
}

/**
 * Bir plakanın yerleşim çizimi.
 *
 * Ölçek plakanın ENİNDEN değil BOYUNDAN kurulur: 1500×12000'lik bir plaka
 * enine sığdırılsaydı yükseklik 8000 birim olur ve ekranda bir şerit gibi
 * görünürdü. Uzun kenar yatay çizilir — kağıtta ve ekranda okunan yön budur.
 */
export function yerlesimDiyagrami(g: YerlesimCizimGirdisi): Diagram {
  const els: DiagramEl[] = [];
  const p = g.plaka;

  // UZUN KENAR YATAY: plaka her zaman yatık çizilir.
  const uzun = Math.max(p.enMm, p.boyMm);
  const kisa = Math.min(p.enMm, p.boyMm);
  const dondur = p.boyMm >= p.enMm; // veri (x=en, y=boy) → çizim (x=boy, y=en)

  const s = TUVAL_EN / uzun; // ölçek [birim/mm]
  const W = uzun * s;
  const H = kisa * s;
  const x0 = KENAR;
  const y0 = 26;

  els.push(txt(x0, y0 - 12, g.baslik, 11, { bold: true, fill: DCOL.accent, fixed: true }));

  // Plaka gövdesi — FİRE ALANI budur; parçalar üstüne çizilir.
  els.push({
    kind: "rect",
    x: x0,
    y: y0,
    w: W,
    h: H,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.4,
  });

  for (const parca of p.parcalar) {
    // Veri koordinatı: x = plaka eni boyunca, y = plaka boyu boyunca.
    const px = dondur ? parca.y : parca.x;
    const py = dondur ? parca.x : parca.y;
    const pw = dondur ? parca.boyMm : parca.enMm;
    const ph = dondur ? parca.enMm : parca.boyMm;

    const rx = x0 + px * s;
    const ry = y0 + py * s;
    const rw = pw * s;
    const rh = ph * s;

    els.push({
      kind: "rect",
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 0.7,
    });

    const no = g.numaralar.get(parca.id);
    if (no != null && rw >= EN_KUCUK_ETIKET && rh >= 9) {
      els.push(
        txt(rx + rw / 2, ry + rh / 2 + 3, String(no), Math.min(9, Math.max(6, rh / 2)), {
          anchor: "middle",
          fill: DCOL.muted,
          fixed: true,
        })
      );
    }
  }

  // Plaka ölçüleri — kenarda, parçaların dışında.
  dimH(els, x0, x0 + W, y0 + H + 16, `${fmtN(uzun)} mm`);
  dimV(els, y0, y0 + H, x0 - 16, `${fmtN(kisa)} mm`);

  if (g.altNot) {
    els.push(txt(x0, y0 + H + 38, g.altNot, 8.5, { fill: DCOL.muted, fixed: true }));
  }

  return fitDiagram(els, TUVAL_EN + KENAR * 2, H + 90);
}

/**
 * Çizimdeki numaralarla listedeki numaraların TEK KAYNAĞI.
 *
 * İki yerde ayrı üretilselerdi resimdeki "7" ile listedeki "7" bir gün farklı
 * parçayı gösterirdi — ve bu, atölyede yanlış sacın kesilmesi demektir.
 * Sıra parçanın İLK GÖRÜLDÜĞÜ plakadaki sırasıdır: okuyan gözle aynı yönde.
 */
export function parcaNumaralari(plakalar: readonly Plaka[]): Map<string, number> {
  const m = new Map<string, number>();
  let n = 0;
  for (const p of plakalar) {
    for (const parca of p.parcalar) {
      if (!m.has(parca.id)) m.set(parca.id, ++n);
    }
  }
  return m;
}
