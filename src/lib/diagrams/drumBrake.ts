// Kasnak (tambur) freni — DIN 15435 ölçü resmi: üç görünüş + ağırlık özeti.
//
// Katalog yaprağının kendi düzeni korunur, çünkü mühendis o yaprağı zaten
// tanıyor: solda ÖN GÖRÜNÜŞ (A · E · H · L · N · G · C · Ø d · Ø D), sağında
// YANDAN GÖRÜNÜŞ (B · R · M), altında PABUÇ TAKIMININ PLANI (F · J · K · K ·
// P · Q). Harfler standardın harfleridir; sayılar seçilen frenin katalog
// satırından gelir (`calc/drum-brake.ts`).
//
// ŞEMA ÖLÇEKLİ DEĞİLDİR ama ORANLIDIR: ölçüler birbirine katalogdaki gibi
// bağlıdır ve resim onlardan çizilir —
//   · E ve G KASNAK EKSENİNE kadardır (E takımın sol ucundan, G taban
//     plakasının sol kenarından); ikisinin farkı kolun plakadan taşan payıdır,
//   · taban plakası (E − G) noktasında başlar, boyu C, kalınlığı N,
//   · kasnak ekseni plaka ÜSTÜNDEN L kadar yukarıdadır, çapı Ø D,
//   · pabuç mafsalları eksenin iki yanında K uzaklıktadır (plan görünüşündeki
//     iki K ölçüsü),
//   · toplam boy A, toplam yükseklik H.
// Planda genişlikler İÇ İÇEDİR: F (dış konsol) > P > Q > J (delik aralığı);
// yandan görünüşte R taban plakası genişliği, M ise orta düzlemden dışarı
// çıkan mil ucuna kadardır.
//
// ETİKET ÇAKIŞMASI: ölçü yazıları BİRBİRİNE de ÇİZGİYE de girmez. Yazı-yazı
// çakışmasını `resolveTextOverlaps` çözer ve `legibility.guard.test.ts` ölçer;
// yazının ÇİZGİ üstüne binmesini çözücü GÖREMEZ, o yüzden çizgi üstüne düşen
// her etiket burada `clearLabel` ile kendi kâğıt şeridini taşır ve ölçü
// katmanları (A/E · G/C · R/M) birbirinden en az bir satır boyu ayrı durur.
//
// Kasnak frenleri DIN tasarımı olduğu için bu resim MARKADAN BAĞIMSIZDIR:
// aynı kasnak çapı ve itici boyunda hangi üretici seçilirse seçilsin ölçüler
// aynıdır. Ölçüsü defterde bulunmayan bir fren için şema ÇİZİLMEZ (bkz.
// `drumBrakeSpec`) — yanlış ölçü resmi, hiç resim olmamasından kötüdür.

import type { DrumBrakeSpec } from "../calc/drum-brake";
import { drumBrakeWeightText } from "../calc/drum-brake";
import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, caption, dimH, dimV, fitDiagram, fmtN, ln, txt,
} from "./model";

export interface DrumBrakeParams {
  spec: DrumBrakeSpec;
  /** Bölümde girilen fren adedi — toplam ağırlık bununla çarpılır */
  qty?: number;
  /** Seçilen fren markası (özet satırında görünür) */
  brand?: string;
  /**
   * Seçim ızgarasındaki kasnak çapı. Model kodundakinden FARKLIYSA şema bunu
   * söyler: TE 200 freninin kasnağı tanım gereği Ø200'dür, seçimde Ø315
   * yazıyorsa iki alandan biri yanlıştır ve bu sessiz kalmamalıdır.
   */
  selectedWheelDiaMm?: number;
}

const W = 1000;

/** Ön görünüşün kutusu */
const FRONT_X = 56;
const FRONT_W = 348;
/**
 * Çizimin ÜST kenarı. Taban çizgisi buradan ve gerçek yükseklikten hesaplanır
 * (`BASE_Y = DRAW_TOP + H·s`) — sabit bir taban verildiğinde takımın tepesi
 * A/E ölçü bandının İÇİNE giriyordu ve etiketler çizginin üstüne biniyordu.
 */
const DRAW_TOP = 112;
/** Görünüş başlıkları ve üstteki ölçü katmanları */
const TITLE_Y = 48;
const DIM_TOP_Y = 76;
const DIM_TOP2_Y = 96;
/** Yandan görünüşün orta ekseni */
const SIDE_CX = 566;
/** Plan görünüşünün kutusu */
const PLAN_X = 96;
const PLAN_W = 330;
/** Sağdaki özet sütunu */
const SUM_X = 690;
const SUM_R = W - 16;

/** Kâğıt zemin — üstüne yazı gelmesi serbest olan dolgular (bkz. koruma testi). */
const FILL_BODY = "#FAF8F7";
const FILL_VOID = "#FFFFFF";

/** Halka dilimi (pabuç · astar) yolu — açılar derece, SVG'de y aşağı büyür. */
function ringSector(
  cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number
): string {
  const pt = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [x1, y1] = pt(rOut, a0);
  const [x2, y2] = pt(rOut, a1);
  const [x3, y3] = pt(rIn, a1);
  const [x4, y4] = pt(rIn, a0);
  return (
    `M ${x1} ${y1} A ${rOut} ${rOut} 0 0 0 ${x2} ${y2} ` +
    `L ${x3} ${y3} A ${rIn} ${rIn} 0 0 1 ${x4} ${y4} Z`
  );
}

/** Mafsal pimi: çember + artı işareti (teknik resimdeki eksen işareti). */
function pin(els: DiagramEl[], cx: number, cy: number, r: number) {
  els.push({ kind: "circle", cx, cy, r, fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 1.1 });
  els.push(ln(cx - r * 1.5, cy, cx + r * 1.5, cy, DCOL.muted, 0.6));
  els.push(ln(cx, cy - r * 1.5, cx, cy + r * 1.5, DCOL.muted, 0.6));
}

/** İki kuvvetli bağlantı kolu: kalın gövde + içi boş profil + iki uçta pim. */
function linkBar(
  els: DiagramEl[], pts: [number, number][], width: number, withPins = true
) {
  for (const [color, wdt] of [[DCOL.ink, width], [DCOL.paper, width - 2.2]] as const) {
    for (let i = 1; i < pts.length; i += 1) {
      els.push(ln(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], color, Math.max(0.6, wdt)));
    }
  }
  if (withPins) {
    pin(els, pts[0][0], pts[0][1], Math.max(2.6, width * 0.28));
    pin(els, pts[pts.length - 1][0], pts[pts.length - 1][1], Math.max(2.6, width * 0.28));
  }
}

/** Kesit taraması — kutunun içine 45° ince çizgiler. */
function hatch(els: DiagramEl[], x: number, y: number, w: number, h: number, step = 6) {
  for (let o = -h; o < w; o += step) {
    const x1 = Math.max(x, x + o);
    const y1 = y + Math.max(0, -o);
    const x2 = Math.min(x + w, x + o + h);
    const y2 = y + Math.min(h, w - o);
    if (x2 > x1) els.push(ln(x1, y1, x2, y2, DCOL.faint, 0.5));
  }
}

export function drumBrakeDiagram(p: DrumBrakeParams): Diagram {
  const els: DiagramEl[] = [];
  const { spec } = p;
  const d = spec.dims;

  caption(
    els,
    "KASNAK FRENİ — DIN 15435 ÖLÇÜ RESMİ",
    [p.brand, spec.model, spec.thruster].filter(Boolean).join(" · ")
  );

  // ---------------------------------------------------------------- ölçek
  // Ön ve yan görünüş AYNI ölçektedir (katalogdaki gibi): ikisi de H'yi
  // paylaşır, ayrı ölçek verilseydi yükseklikler tutmazdı.
  const s = FRONT_W / d.a;
  const BASE_Y = DRAW_TOP + d.h * s;
  const X = (mm: number) => FRONT_X + mm * s;
  const Y = (mm: number) => BASE_Y - mm * s;

  const plateL = d.e - d.g;                 // taban plakasının sol kenarı [mm]
  const plateR = plateL + d.c;
  const plateTop = d.n;
  const drumCx = X(d.e);
  const drumCy = Y(d.n + d.l);
  const rMm = spec.drumDiaMm / 2;
  const rDrum = rMm * s;
  const liningMm = Math.max(spec.drumDiaMm * 0.035, 8);
  const holderMm = Math.max(spec.drumDiaMm * 0.055, 12);
  const armWmm = Math.max(0.024 * d.a, 15);
  const armPx = Math.max(6.5, armWmm * s);

  // ======================================================== ÖN GÖRÜNÜŞ
  els.push(txt(FRONT_X, TITLE_Y, "ÖN GÖRÜNÜŞ", 8, { fill: DCOL.accent, bold: true }));

  // --- taban plakası (kalınlık N; çoğu boyda 3 px'e düşer, çizgi olarak
  //     kaybolmasın diye alt sınır konur — ölçü etiketi GERÇEĞİ yazar)
  const plateH = Math.max(4.5, d.n * s);
  els.push({
    kind: "rect", x: X(plateL), y: BASE_Y - plateH, w: (plateR - plateL) * s, h: plateH,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  // Bağlantı delikleri: plakanın iki ucunda (planda her uçta J aralıklı İKİ
  // delik vardır; önden bakınca üst üste düşer, tek görünür).
  const holeXs = [plateL + 0.055 * d.c, plateR - 0.055 * d.c];
  const holeW = Math.max(3.5, d.boreD * s);
  for (const hx of holeXs) {
    els.push({
      kind: "rect", x: X(hx) - holeW / 2, y: BASE_Y - plateH, w: holeW, h: plateH,
      fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 0.9,
    });
  }

  // --- gövde kirişi: iki pabuç mafsalını taşıyan alt çerçeve
  const frameTop = Y(plateTop + Math.max(d.l * 0.20, 24));
  const frameL = X(d.e - d.k - armWmm * 0.9);
  const frameR = X(d.e + d.k + armWmm * 0.9);
  els.push({
    kind: "polygon",
    points: [
      [frameL, Y(plateTop)], [frameR, Y(plateTop)],
      [frameR - armPx * 0.4, frameTop], [frameL + armPx * 0.4, frameTop],
    ],
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });

  // --- kasnak, astar ve pabuç gövdeleri
  els.push({
    kind: "circle", cx: drumCx, cy: drumCy, r: rDrum,
    fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 1.5,
  });
  for (const mid of [180, 0]) {
    els.push({
      kind: "path",
      d: ringSector(drumCx, drumCy, rDrum, rDrum + liningMm * s, mid - 36, mid + 36),
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
    });
    els.push({
      kind: "path",
      d: ringSector(
        drumCx, drumCy, rDrum + liningMm * s, rDrum + (liningMm + holderMm) * s,
        mid - 40, mid + 40
      ),
      fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.3,
    });
    // Astarı pabuca bağlayan perçin izleri
    for (const off of [-24, 0, 24]) {
      const a = ((mid + off) * Math.PI) / 180;
      const rr = rDrum + liningMm * s * 0.5;
      els.push({
        kind: "circle", cx: drumCx + rr * Math.cos(a), cy: drumCy - rr * Math.sin(a),
        r: 1.6, fill: DCOL.muted,
      });
    }
  }
  // Kasnak eksen çizgileri
  els.push(ln(drumCx - rDrum - 22, drumCy, drumCx + rDrum + 22, drumCy, DCOL.faint, 0.7, "9,3,2,3"));
  els.push(ln(drumCx, drumCy - rDrum - 22, drumCx, BASE_Y + 58, DCOL.faint, 0.7, "9,3,2,3"));

  // --- kollar: mafsaldan (eksenin K kadar yanında) yükselir, kasnağın
  //     TEPESİNİ GEÇTİKTEN sonra üst mafsal takımına döner. Düz bir doğru
  //     büyük kasnaklarda çemberin içinden geçerdi.
  const knuckleXmm = d.e + rMm * 0.74;
  const knuckleYmm = Math.max(d.h * 0.80, plateTop + d.l + rMm * 1.16);
  const kx = X(knuckleXmm);
  const ky = Y(knuckleYmm);
  const shoePinR = Math.max(3, armPx * 0.34);
  // SOL kol kendi tepesinde biter ve oradan uzun çekme çubuğuyla mafsal
  // takımına bağlanır (katalogdaki düzen); SAĞ kol doğrudan mafsala girer.
  const leftTopXmm = d.e - rMm * 0.55;
  const leftTopYmm = Math.max(knuckleYmm * 0.92, plateTop + d.l + rMm * 1.10);
  const leftTop: [number, number] = [X(leftTopXmm), Y(leftTopYmm)];
  for (const side of [-1, 1] as const) {
    const pivotXmm = d.e + side * d.k;
    const shoeXmm = d.e + side * (rMm + liningMm + holderMm + armWmm * 0.45);
    const overXmm = d.e + side * (rMm + liningMm + holderMm) * 0.90;
    const overY = Y(plateTop + d.l + rMm * 1.08);
    linkBar(
      els,
      [
        [X(pivotXmm), Y(plateTop)],
        [X(shoeXmm), drumCy],
        [X(overXmm), overY],
        side < 0 ? leftTop : [kx + 6, ky],
      ],
      armPx,
      false
    );
    pin(els, X(pivotXmm), Y(plateTop), shoePinR);       // alt mafsal
    pin(els, X(shoeXmm), drumCy, shoePinR);              // pabuç mafsalı
  }

  // --- itici (Eldro): kanatlı gövde + kapak + klemens kutusu + alt kulak
  const thrRight = X(d.a);
  const thrW = 0.195 * d.a * s;
  const thrX = thrRight - thrW - 0.025 * d.a * s;
  const thrTop = Y(d.h * 0.575);
  const thrBot = Y(d.h * 0.135);
  els.push({
    kind: "rect", x: thrX, y: thrTop, w: thrW, h: thrBot - thrTop,
    fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  for (let i = 1; i < 8; i += 1) {
    const fx = thrX + (thrW * i) / 8;
    els.push(ln(fx, thrTop + 3, fx, thrBot - 3, DCOL.muted, 0.75));
  }
  els.push({
    kind: "rect", x: thrX + thrW * 0.18, y: thrTop - 7, w: thrW * 0.64, h: 7,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  els.push({
    kind: "rect", x: thrX + thrW, y: thrTop + (thrBot - thrTop) * 0.28,
    w: Math.max(6, thrW * 0.20), h: (thrBot - thrTop) * 0.30,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  // Alt kulak: iticiyi gövdeye bağlayan mafsal
  const thrPinX = thrX + thrW * 0.5;
  els.push({
    kind: "polygon",
    points: [
      [thrPinX - 7, thrBot], [thrPinX + 7, thrBot],
      [thrPinX + 5, thrBot + 12], [thrPinX - 5, thrBot + 12],
    ],
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  pin(els, thrPinX, thrBot + 12, 3.4);
  // İticinin ayağı taban plakasına oturur (gövde plakanın sağına taşar)
  els.push({
    kind: "polygon",
    points: [
      [thrPinX - 6, thrBot + 12], [thrPinX + 6, thrBot + 12],
      [Math.min(thrPinX + 13, X(plateR) - 2), Y(plateTop)],
      [Math.min(thrPinX - 15, X(plateR) - 30), Y(plateTop)],
    ],
    fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.1,
  });

  // --- üst mafsal takımı: sol çekme çubuğu (aşınma telafili) · üçgen levha ·
  //     iticiye giden kol · yay kovanına inen bağlantı
  const leverX = thrX + thrW * 0.5;
  const leverY = Y(d.h * 0.705);
  // Üçgen mafsal levhası
  els.push({
    kind: "polygon",
    points: [[kx - 13, ky + 8], [kx + 20, ky - 6], [kx + 6, ky + 16]],
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  // Sol çekme çubuğu: SOL KOLUN TEPESİNDEN gelir, ortasında aşınma telafisi
  const tieL = leftTop;
  linkBar(els, [tieL, [kx - 13, ky + 8]], 5.5);
  const tieMx = (tieL[0] + kx - 13) / 2;
  const tieMy = (tieL[1] + ky + 8) / 2;
  els.push({
    kind: "rect", x: tieMx - 13, y: tieMy - 5, w: 26, h: 10,
    fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  // İticiye giden kol
  linkBar(els, [[kx + 20, ky - 6], [leverX, leverY]], 7);
  els.push(ln(leverX, leverY, leverX, thrTop - 7, DCOL.ink, 1.6));

  // --- yay kovanı: kolun altından sarkar, gövde kirişine oturur; yüzünde
  //     ayar penceresi vardır
  const rodX = kx + (leverX - kx) * 0.42;
  const rodTop = ky + ((leverY - ky) * (rodX - kx)) / Math.max(1, leverX - kx) + 6;
  const rodW = Math.max(11, 0.022 * d.a * s);
  els.push({
    kind: "rect", x: rodX - rodW / 2, y: rodTop, w: rodW, h: frameTop - rodTop,
    fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  els.push({
    kind: "rect", x: rodX - rodW * 0.18, y: rodTop + (frameTop - rodTop) * 0.22,
    w: rodW * 0.36, h: (frameTop - rodTop) * 0.5,
    fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.8,
  });
  els.push(ln(rodX, rodTop - 6, rodX, rodTop, DCOL.ink, 1.6));

  // --- ön görünüş ölçüleri (katmanlar birbirinden en az bir satır boyu ayrı)
  dimH(els, X(0), X(d.a), DIM_TOP_Y, `A = ${fmtN(d.a)}`);
  dimH(els, X(0), X(d.e), DIM_TOP2_Y, `E = ${fmtN(d.e)}`);
  dimV(els, X(d.a) + 28, Y(d.h), Y(0), `H = ${fmtN(d.h)}`, { labelSide: "right" });
  dimV(els, X(0) - 26, drumCy, Y(plateTop), `L = ${fmtN(d.l)}`, { labelSide: "left" });
  dimV(els, X(0) - 26, Y(plateTop), BASE_Y, `N = ${fmtN(d.n)}`, { labelSide: "left" });
  dimH(els, X(plateL), X(d.e), BASE_Y + 38, `G = ${fmtN(d.g)}`);
  dimH(els, X(plateL), X(plateR), BASE_Y + 60, `C = ${fmtN(d.c)}`);

  // Ø d — delik çapı; ölçü oku sığmayacak kadar küçüktür, bağlantı çizgisiyle
  // yazılır ve G katmanının ÜSTÜNDE kalır.
  const holePx = X(holeXs[0]);
  els.push(ln(holePx, BASE_Y - plateH / 2, holePx - 10, BASE_Y + 16, DCOL.muted, 0.6));
  els.push(
    txt(holePx - 12, BASE_Y + 19, `Ø d = ${fmtN(d.boreD)}`, 8, {
      anchor: "end", fill: DCOL.ink, leaderTo: [holePx, BASE_Y - plateH / 2],
    })
  );

  // Ø D — kasnak çapı, katalogdaki gibi çemberin içinden geçen köşegen
  const dg = (deg: number): [number, number] => [
    drumCx + rDrum * Math.cos((deg * Math.PI) / 180),
    drumCy - rDrum * Math.sin((deg * Math.PI) / 180),
  ];
  const [dx1, dy1] = dg(142);
  const [dx2, dy2] = dg(-38);
  els.push(ln(dx1, dy1, dx2, dy2, DCOL.muted, 0.8));
  els.push(arrowHead(dx1, dy1, "left", DCOL.muted));
  els.push(arrowHead(dx2, dy2, "right", DCOL.muted));
  const dLabel = `Ø D = ${fmtN(spec.drumDiaMm)}`;
  els.push({
    kind: "rect", x: drumCx - dLabel.length * 2.7 - 4, y: drumCy - 24,
    w: dLabel.length * 5.4 + 8, h: 12, fill: FILL_VOID,
  });
  els.push(txt(drumCx, drumCy - 15, dLabel, 8.5, { anchor: "middle", fill: DCOL.ink }));

  // ======================================================== YANDAN GÖRÜNÜŞ
  const bodyL = SIDE_CX - (d.b / 2) * s;
  const bodyW = d.b * s;
  els.push(txt(SIDE_CX, TITLE_Y, "YANDAN GÖRÜNÜŞ", 8, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));

  // İtici gövdesi toplam genişliği (B) belirler
  els.push({
    kind: "rect", x: bodyL, y: Y(d.h * 0.90), w: bodyW, h: Y(d.h * 0.42) - Y(d.h * 0.90),
    fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  for (const off of [-0.5, 0.5]) {
    els.push(ln(
      SIDE_CX + off * bodyW * 0.62, Y(d.h * 0.90),
      SIDE_CX + off * bodyW * 0.62, Y(d.h * 0.42), DCOL.muted, 0.8
    ));
  }
  // Pabuç takımı: genişliği F
  els.push({
    kind: "rect", x: SIDE_CX - (d.f / 2) * s, y: Y(d.h * 0.42), w: d.f * s,
    h: Y(plateTop) - Y(d.h * 0.42),
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  // İki kol, aralarında kasnak (yandan bakınca bir bant)
  for (const off of [-1, 1] as const) {
    els.push({
      kind: "rect", x: SIDE_CX + off * (d.f / 2) * s - (off > 0 ? armPx * 0.8 : 0),
      y: Y(d.h * 0.42), w: armPx * 0.8, h: Y(plateTop) - Y(d.h * 0.42),
      fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1,
    });
  }
  const bandH = Math.max(8, liningMm * s * 2.4);
  els.push({
    kind: "rect", x: SIDE_CX - (d.q / 2) * s, y: drumCy - bandH / 2,
    w: d.q * s, h: bandH, fill: FILL_VOID, stroke: DCOL.muted, strokeWidth: 0.9,
  });
  els.push({
    kind: "rect", x: SIDE_CX - (d.r / 2) * s, y: BASE_Y - plateH, w: d.r * s, h: plateH,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  for (const off of [-d.j / 2, d.j / 2]) {
    els.push({
      kind: "rect", x: SIDE_CX + off * s - holeW / 2, y: BASE_Y - plateH, w: holeW, h: plateH,
      fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 0.9,
    });
  }
  // Orta düzlemden dışarı çıkan mil ucu — M ölçüsünün bittiği yer
  els.push(ln(SIDE_CX, drumCy, SIDE_CX + d.m * s, drumCy, DCOL.ink, 3.4));
  els.push(ln(SIDE_CX, drumCy, SIDE_CX + d.m * s, drumCy, DCOL.paper, 1.2));
  els.push({
    kind: "circle", cx: SIDE_CX + d.m * s, cy: drumCy, r: 3.2,
    fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 1,
  });
  // Orta eksen ÜSTTEN B, ALTTAN R etiketinin içine girmez: iki parça çizilir,
  // M ölçüsünün başlangıcı ayrı bir bakış çizgisiyle gösterilir.
  els.push(ln(SIDE_CX, Y(d.h * 0.94), SIDE_CX, BASE_Y + 18, DCOL.faint, 0.7, "9,3,2,3"));
  els.push(ln(SIDE_CX, BASE_Y + 44, SIDE_CX, BASE_Y + 64, DCOL.faint, 0.7, "9,3,2,3"));

  dimH(els, bodyL, bodyL + bodyW, DIM_TOP_Y, `B = ${fmtN(d.b)}`);
  dimH(els, SIDE_CX - (d.r / 2) * s, SIDE_CX + (d.r / 2) * s, BASE_Y + 38, `R = ${fmtN(d.r)}`);
  dimH(els, SIDE_CX, SIDE_CX + d.m * s, BASE_Y + 60, `M = ${fmtN(d.m)}`, { clearLabel: true });

  // ======================================================== PLAN GÖRÜNÜŞÜ
  // Planın KENDİ ölçeği vardır: pabuç takımı ön görünüşün ölçeğinde okunmayacak
  // kadar kısa kalırdı (2K, A'nın yarısı bile değildir). Birim K'dir; kutu
  // konsol (0,52 K) + iki pabuç (2 K) + itme çubuğu (0,5 K) olarak bölünür.
  const unit = PLAN_W / 3.05;
  const sp = unit / d.k;
  const brW = 0.52 * unit;
  const brX = PLAN_X;
  const pcx = PLAN_X + brW + unit;
  const planTop = BASE_Y + 112;
  const planBot = planTop + d.f * sp;
  const planCy = (planTop + planBot) / 2;
  const PY = (mm: number) => planCy + mm * sp;

  els.push(txt(PLAN_X - 36, BASE_Y + 92, "PABUÇ TAKIMI — PLAN", 8, {
    fill: DCOL.accent, bold: true,
  }));

  // Sol uçtaki konsol: genişliği F, içinde J aralıklı iki bağlantı deliği
  els.push({
    kind: "rect", x: brX, y: planTop, w: brW, h: d.f * sp,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  for (const off of [-d.j / 2, d.j / 2]) {
    els.push({
      kind: "circle", cx: brX + brW * 0.34, cy: PY(off), r: 4,
      fill: FILL_VOID, stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(ln(brX + brW * 0.34 - 6.5, PY(off), brX + brW * 0.34 + 6.5, PY(off), DCOL.faint, 0.6));
    els.push(ln(brX + brW * 0.34, PY(off) - 6.5, brX + brW * 0.34, PY(off) + 6.5, DCOL.faint, 0.6));
  }

  // İki pabuç: mafsallar (±K) arasında, ortada ayrık. Dış genişlik P, içindeki
  // astar bandı Q. Gövdeler kesit taramalıdır.
  const gap = 0.05 * unit;
  for (const side of [-1, 1] as const) {
    const x1 = side < 0 ? pcx - unit : pcx + gap;
    const wBlk = unit - gap;
    els.push({
      kind: "rect", x: x1, y: PY(-d.p / 2), w: wBlk, h: d.p * sp,
      fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.3,
    });
    hatch(els, x1 + 1, PY(-d.p / 2) + 1, wBlk - 2, d.p * sp - 2, 7);
    els.push({
      kind: "rect", x: x1 + 4, y: PY(-d.q / 2), w: wBlk - 8, h: d.q * sp,
      fill: FILL_VOID, stroke: DCOL.muted, strokeWidth: 1,
    });
    // Pabuç bağlantı cıvataları
    for (const cy of [PY(-d.p / 2) + 4, PY(d.p / 2) - 4]) {
      for (const t of [0.18, 0.82]) {
        els.push({ kind: "circle", cx: x1 + wBlk * t, cy, r: 2, fill: DCOL.muted });
      }
    }
  }
  // Mafsal göbekleri (iki K ölçüsünün uçları)
  for (const off of [-unit, unit]) {
    pin(els, pcx + off, planCy, 5);
  }
  // Çatal + itme çubuğu + ikinci çatal (iticiye giden bağlantı)
  const tailX = pcx + unit;
  els.push({
    kind: "rect", x: tailX, y: planCy - 11, w: 16, h: 22,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  els.push({
    kind: "rect", x: tailX + 16, y: planCy - 4.5, w: PLAN_X + PLAN_W - tailX - 34, h: 9,
    fill: FILL_BODY, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  els.push({
    kind: "rect", x: PLAN_X + PLAN_W - 18, y: planCy - 11, w: 18, h: 22,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
  });
  pin(els, PLAN_X + PLAN_W - 9, planCy, 4);
  els.push(ln(brX - 16, planCy, PLAN_X + PLAN_W + 10, planCy, DCOL.faint, 0.7, "9,3,2,3"));
  els.push(ln(pcx, planTop - 16, pcx, planBot + 34, DCOL.faint, 0.7, "9,3,2,3"));

  dimV(els, brX - 36, planTop, planBot, `F = ${fmtN(d.f)}`, { labelSide: "left" });
  // J etiketi SOLA yazılır: sağda pabuç mafsalının artı işaretine giriyordu.
  dimV(els, brX + brW * 0.34, PY(-d.j / 2), PY(d.j / 2), `J = ${fmtN(d.j)}`, {
    labelSide: "left", clearLabel: true, size: 8,
  });
  dimH(els, pcx - unit, pcx, planBot + 30, `K = ${fmtN(d.k)}`);
  dimH(els, pcx, pcx + unit, planBot + 30, `K = ${fmtN(d.k)}`);
  // P ve Q iki AYRI pabucun ortasına yazılır: ölçü çizgileri birbirine girmez.
  dimV(els, pcx - unit * 0.55, PY(-d.p / 2), PY(d.p / 2), `P = ${fmtN(d.p)}`, {
    labelSide: "right", clearLabel: true, size: 8,
  });
  dimV(els, pcx + unit * 0.34, PY(-d.q / 2), PY(d.q / 2), `Q = ${fmtN(d.q)}`, {
    labelSide: "right", clearLabel: true, size: 8,
  });

  // ======================================================== ÖZET SÜTUNU
  const STEP = 15.5;
  let ly = 70;
  const row = (k: string, v: string, color = DCOL.ink, bold = false) => {
    els.push(txt(SUM_X, ly, k, 7.5, { fill: DCOL.muted }));
    els.push(txt(SUM_R, ly, v, 8, { anchor: "end", fill: color, bold }));
    ly += STEP;
  };
  const rule = () => {
    ly += 3;
    els.push(ln(SUM_X, ly, SUM_R, ly, DCOL.line, 0.8));
    ly += 13;
  };

  els.push(txt(SUM_X, 50, "SEÇİM ÖZETİ", 9, { fill: DCOL.accent, bold: true }));
  if (p.brand) row("Marka", p.brand);
  row("Model", spec.model, DCOL.ink, true);
  row("Kasnak Çapı", `Ø${fmtN(spec.drumDiaMm)} mm`);
  row("İtici (Eldro)", spec.thruster);
  row("Ayar Aralığı", `${fmtN(spec.minTorqueNm)} – ${fmtN(spec.maxTorqueNm)} Nm`);

  rule();
  els.push(txt(SUM_X, ly, "AĞIRLIK", 8, { fill: DCOL.accent, bold: true }));
  ly += STEP + 2;
  row("Fren — İtici Hariç", `${fmtN(spec.brakeWeightKg)} kg`);
  row(
    "İtici (Eldro)",
    `${drumBrakeWeightText(spec.thrusterWeightKg, spec.thrusterWeightMaxKg)} kg`
  );
  row(
    "Bir Fren — Toplam",
    `${drumBrakeWeightText(spec.totalWeightKg, spec.totalWeightMaxKg)} kg`,
    DCOL.ink, true
  );
  const qty = p.qty !== undefined && Number.isFinite(p.qty) && p.qty > 0 ? Math.round(p.qty) : 0;
  if (qty > 0) {
    row("Fren Adedi", `${qty}`);
    row(
      "Tüm Frenler",
      `${drumBrakeWeightText(spec.totalWeightKg, spec.totalWeightMaxKg, qty)} kg`,
      DCOL.accent, true
    );
  }

  rule();
  row("İtici Gücü", `${fmtN(spec.thrusterPowerW)} W · ${fmtN(spec.thrusterCurrentA, 2)} A`);
  row("İtici Kuvveti", `${fmtN(spec.thrusterForceN)} N`);
  row("İtici Stroku", `${fmtN(spec.thrusterStrokeMm)} mm`);

  ly += 6;
  if (spec.thrusterWeightMaxKg !== undefined) {
    els.push(txt(SUM_X, ly, "İtici Ağırlığı Katalogda Aralıktır;", 7, { fill: DCOL.muted }));
    ly += 10;
    els.push(txt(SUM_X, ly, "Alt Sınır 60 mm Stroka Aittir.", 7, { fill: DCOL.muted }));
    ly += 15;
  }
  if (
    p.selectedWheelDiaMm !== undefined &&
    Number.isFinite(p.selectedWheelDiaMm) &&
    p.selectedWheelDiaMm > 0 &&
    Math.round(p.selectedWheelDiaMm) !== spec.drumDiaMm
  ) {
    // DIN 15435'te tip numarası KASNAK ÇAPIDIR; seçim ızgarasındaki çap
    // modelinkinden farklıysa iki alandan biri yanlıştır.
    els.push(
      txt(SUM_X, ly, `Seçimdeki Kasnak Ø${fmtN(p.selectedWheelDiaMm)} —`, 7.5, {
        fill: DCOL.accent, bold: true,
      })
    );
    ly += 11;
    els.push(txt(SUM_X, ly, `Model Kodu Ø${fmtN(spec.drumDiaMm)} Diyor.`, 7.5, {
      fill: DCOL.accent, bold: true,
    }));
    ly += 15;
  }
  els.push(txt(SUM_X, ly, "Ölçüler mm · Şema Ölçekli Değildir.", 7, { fill: DCOL.muted }));

  els.push(ln(SUM_X - 20, 40, SUM_X - 20, Math.max(ly + 10, 470), DCOL.line, 0.8));

  return fitDiagram(els, W, Math.max(planBot + 56, ly + 26));
}
