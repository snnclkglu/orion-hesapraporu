// Teker yükleri şemaları — üç parametrik diyagram:
//
//   1) wheelLoadElevationDiagram — vincin ÖNDEN görünüşü: açıklık, arabanın
//      yanaşma konumu, iki rayın teker grupları ve Pmaks / Pmin okları.
//   2) skewPlanDiagram — ÜSTTEN görünüş: savrulmuş vinç, anlık kayma kutbu,
//      kılavuz kuvveti S ve teker başına enine/boyuna teğetsel kuvvetler.
//   3) loadSummaryDiagram — ÖZET: bir tekerin ray üzerindeki bütün kuvvet
//      bileşenleri (düşey, enine, boyuna, kılavuz) iki ortogonal görünüşte.
//
// Hepsi teker adedine ve gerçek teker konumlarına göre kendini çizer; kuvvet
// okları büyüklükle orantılıdır. FEM 1.001 Kitapçık 9 md. 9.4.1 (F.9.4.b ve
// F.9.4.d şekillerinin uygulamaya uyarlanmış hâli).
//
// Vinç dört köşesinde eşit tekerle yürür: toplam/4 köşe başına, toplam/2 ray
// başına tekerdir. Çizimler bu düzeni ve teker kodlarını (A1…Ak, B1…Bk)
// gösterir.

import {
  DCOL,
  type Diagram,
  type DiagramEl,
  arrowHead,
  dimH,
  fitDiagram,
  fmtN,
  ln,
  txt,
} from "./model";

// ---------------------------------------------------------------- Önden görünüş

export interface WheelLoadElevationParams {
  spanM: number;
  minApproachM: number;
  wheelsPerSide: number;
  maxWheelLoadKg?: number;
  minWheelLoadKg?: number;
  designWheelLoadKg?: number;
  hoistLoadKg?: number;
  wheelbaseMm?: number;
}

const EW = 640;
const EH = 330;

/**
 * Vincin RAYLARA DİK (önden) görünüşü.
 *
 * Bu görünüşte bir başkirişin bütün tekerleri üst üste düşer — teker düzeni
 * bu şemanın değil savrulma plan şemasının konusudur. Burada her ray için TEK
 * teker çizilir, adet etiketle verilir; şema açıklığı, arabanın yanaşma
 * konumunu ve iki rayın düşey yüklerini anlatır.
 */
export function wheelLoadElevationDiagram(p: WheelLoadElevationParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "DÜŞEY TEKER YÜKLERİ — RAYLARA DİK GÖRÜNÜŞ", 11, { bold: true }));
  els.push(
    txt(16, 34, "araba en yakın konumda · FEM 1.001 §2.2 · şematik", 8, {
      fill: DCOL.muted,
    })
  );
  els.push(ln(16, 40, EW - 16, 40, DCOL.line, 0.8));

  const xL = 104;
  const xR = EW - 104;
  const spanPx = xR - xL;
  const yGirder = 138; // ana kiriş üst yüzü
  const girderH = 15;
  const yCarriage = yGirder + girderH; // başkiriş kutusu
  const carriageH = 19;
  const yWheel = yCarriage + carriageH + 15; // teker merkezi
  const wheelR = 14;
  const yRail = yWheel + wheelR; // ray üst kotu
  const yRunway = yRail + 8; // yol kirişi üst yüzü

  const span = Math.max(0.001, p.spanM);
  // Yanaşma oranı gerçektir; ancak araba kutusu başkirişin üstüne binmesin diye
  // çizimde en az bir kutu genişliği kadar sağa alınır (şema, ölçek değil).
  const approachFrac = Math.min(0.45, Math.max(0, p.minApproachM / span));
  const xTrolley = xL + Math.max(approachFrac * spanPx, 74);

  // --- Ana kiriş -----------------------------------------------------------
  els.push({
    kind: "rect",
    x: xL - 46,
    y: yGirder,
    w: spanPx + 92,
    h: girderH,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.3,
  });

  // --- Araba ve asılı yük --------------------------------------------------
  els.push({
    kind: "rect",
    x: xTrolley - 36,
    y: yGirder - 26,
    w: 72,
    h: 26,
    rx: 2,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  els.push(txt(xTrolley, yGirder - 9, "ARABA", 8, { anchor: "middle" }));
  // Halat arabanın sağından iner, ana kirişin yanından geçer
  const xRope = xTrolley + 30;
  els.push(ln(xRope, yGirder - 26, xRope, yWheel - 6, DCOL.faint, 0.9, "2,2"));
  els.push({
    kind: "circle",
    cx: xRope,
    cy: yWheel,
    r: 7,
    fill: "#FBEDEC",
    stroke: DCOL.accent,
    strokeWidth: 1.3,
  });
  if (p.hoistLoadKg) {
    els.push(
      txt(xRope + 12, yWheel + 3, `SL = ${fmtN(p.hoistLoadKg)} kg`, 8.5, {
        fill: DCOL.accent,
      })
    );
  }

  // --- Başkirişler, tekerler, raylar, yol kirişi ---------------------------
  const nWheels = Math.max(1, Math.round(p.wheelsPerSide));
  const drawSupport = (xc: number, railLabel: string) => {
    els.push({
      kind: "rect",
      x: xc - 46,
      y: yCarriage,
      w: 92,
      h: carriageH,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    els.push(
      txt(xc, yCarriage + 13.5, "BAŞKİRİŞ", 7.5, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
    // Teker — önden bakışta bir rayın bütün tekerleri üst üste düşer
    els.push({
      kind: "circle",
      cx: xc,
      cy: yWheel,
      r: wheelR,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 1.3,
    });
    els.push({
      kind: "circle",
      cx: xc,
      cy: yWheel,
      r: 3.5,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 0.9,
    });
    // Ray
    els.push({
      kind: "rect",
      x: xc - 13,
      y: yRail,
      w: 26,
      h: 8,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    // Yol kirişi + tarama
    els.push({
      kind: "rect",
      x: xc - 62,
      y: yRunway,
      w: 124,
      h: 15,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    for (let i = -7; i <= 7; i += 1) {
      els.push(
        ln(xc + i * 8, yRunway + 15, xc + i * 8 - 6, yRunway + 23, DCOL.muted, 0.6)
      );
    }
    els.push(
      txt(xc, yRunway + 36, railLabel, 8, { anchor: "middle", fill: DCOL.muted })
    );
  };
  drawSupport(xL, "RAY 1 — araba bu raya yanaşır");
  drawSupport(xR, "RAY 2");

  // --- Düşey yük okları ----------------------------------------------------
  const yArrow0 = yRunway + 46;
  const loadLabel = (xc: number, top: string, sub: string[], color: string) => {
    els.push(ln(xc, yArrow0, xc, yArrow0 + 22, color, 2));
    els.push(arrowHead(xc, yArrow0 + 26, "down", color, 9, 3.4));
    els.push(
      txt(xc, yArrow0 + 42, top, 9.5, { anchor: "middle", fill: color, bold: true })
    );
    sub.forEach((s, i) =>
      els.push(
        txt(xc, yArrow0 + 55 + i * 11, s, 8, { anchor: "middle", fill: DCOL.muted })
      )
    );
  };
  loadLabel(
    xL,
    p.maxWheelLoadKg !== undefined ? `Pmaks = ${fmtN(p.maxWheelLoadKg)} kg` : "Pmaks",
    [
      p.designWheelLoadKg !== undefined
        ? `tasarım (φ2 dahil) ${fmtN(p.designWheelLoadKg)} kg`
        : "",
      `teker başına · rayda ${nWheels} teker`,
    ].filter(Boolean),
    DCOL.accent
  );
  loadLabel(
    xR,
    p.minWheelLoadKg !== undefined ? `Pmin = ${fmtN(p.minWheelLoadKg)} kg` : "Pmin",
    ["araba karşı uçtayken", `teker başına · rayda ${nWheels} teker`],
    DCOL.muted
  );

  // --- Ölçüler -------------------------------------------------------------
  dimH(els, xL, xTrolley, yGirder - 44, `e = ${fmtN(p.minApproachM, 2)} m`, {
    size: 8,
    labelDy: -5,
  });
  dimH(els, xL, xR, yArrow0 + 96, `l = ${fmtN(p.spanM, 2)} m`, { labelDy: 14 });

  return fitDiagram(els, EW, EH);
}

// ---------------------------------------------------------------- Üstten görünüş

export interface SkewPlanWheel {
  code: string;
  distanceM: number;
  lateralNearN: number;
  lateralFarN: number;
  longitudinalN: number;
}

export interface SkewPlanParams {
  spanM: number;
  wheels: SkewPlanWheel[];
  alphaRad: number;
  poleDistanceM: number;
  /** Kayma kutbunun 1 numaralı raya normalize uzaklığı µ */
  mu: number;
  guideForceN: number;
  guideMeans: "flange" | "roller";
  applicable: boolean;
}

/**
 * Savrulan vincin ÜSTTEN görünüşü — FEM 1.001 Kitapçık 9 F.9.4.b / F.9.4.d.
 *
 * Yerleşim yatay bantlara ayrılmıştır: rayların dışında kuvvet okları, rayların
 * hemen içinde teker kodları, ortada köprü gövdesi ve anlık kayma kutbu, altta
 * ölçü zinciri. Teker adedi arttıkça tuval genişler; sığmayan ölçü ve kuvvet
 * etiketleri atlanır, böylece üst üste binen etiket üretilmez.
 */
export function skewPlanDiagram(p: SkewPlanParams): Diagram {
  const wheels =
    p.wheels.length > 0
      ? p.wheels
      : [
          {
            code: "A1",
            distanceM: 0,
            lateralNearN: 0,
            lateralFarN: 0,
            longitudinalN: 0,
          },
        ];
  const nWheels = wheels.length;
  const perCorner = Math.max(1, Math.round(nWheels / 2));

  // Köşe içi teker aralıkları (tipik 1.000–1.500 mm) ölçü etiketi sığacak
  // genişlikte kalsın diye tuval teker adediyle büyür.
  const PW = Math.max(640, 300 + nWheels * 58);
  const PH = 420;

  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "SAVRULMA (SKEWING) — ÜSTTEN GÖRÜNÜŞ", 11, { bold: true }));
  els.push(
    txt(16, 34, "FEM 1.001 Kitapçık 9, md. 9.4.1 · savrulma açısı abartılmıştır", 8, {
      fill: DCOL.muted,
    })
  );
  els.push(ln(16, 40, PW - 16, 40, DCOL.line, 0.8));

  // Yürüme yönü — teker alanının soluna, çakışmayacak yere
  els.push(txt(16, 58, "yürüme yönü", 8, { fill: DCOL.muted }));
  els.push(ln(74, 55, 104, 55, DCOL.muted, 1));
  els.push(arrowHead(107, 55, "right", DCOL.muted, 8, 3));

  const xL = 132;
  const xRight = PW - 132;
  const trackPx = xRight - xL;
  const yRail1 = 148;
  const yRail2 = 268;

  const maxD = Math.max(...wheels.map((w) => w.distanceM), 0.001);
  // Dingil mesafesi çizim genişliğinin bir bölümüne oturur; kalan yer anlık
  // kayma kutbu okuna ayrılır.
  const usable = trackPx * (nWheels > 6 ? 0.74 : 0.6);
  const xOf = (d: number) => xL + (d / maxD) * usable;

  // --- Köprü gövdesi (savrulmuş) ------------------------------------------
  const tilt = 20; // şematik eğim [px] — gerçek α görünmeyecek kadar küçüktür
  const bx1 = xL - 10;
  const bx2 = xL + usable + 10;
  const byTop = yRail1 + 24;
  const byBot = yRail2 - 30;
  els.push({
    kind: "polygon",
    points: [
      [bx1, byTop],
      [bx2, byTop + tilt],
      [bx2, byBot + tilt],
      [bx1, byBot],
    ],
    fill: DCOL.accentSoft,
    stroke: DCOL.accent,
    strokeWidth: 1,
  });
  const bxMid = (bx1 + bx2) / 2;
  const byMid = (byTop + byBot) / 2 + tilt / 2;
  els.push(
    txt(bxMid, byMid - 5, "KÖPRÜ (savrulmuş konum)", 8.5, {
      anchor: "middle",
      fill: DCOL.accent,
    })
  );
  els.push(
    txt(bxMid, byMid + 9, `α = ${fmtN(p.alphaRad * 1000, 2)} mrad`, 9, {
      anchor: "middle",
      fill: DCOL.accent,
      bold: true,
    })
  );

  // --- Raylar --------------------------------------------------------------
  // Ray etiketleri SAĞ uçta durur: sol taraf kılavuz kuvveti oku ve teker
  // kuvvet etiketleriyle doludur, sağ uç ise daima boştur.
  els.push(ln(16, yRail1, PW - 16, yRail1, DCOL.ink, 2.2));
  els.push(
    txt(PW - 16, yRail1 - 9, "RAY 1 — araba bu raya yanaşır (yakın ray)", 8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );
  els.push(ln(16, yRail2, PW - 16, yRail2, DCOL.ink, 2.2));
  els.push(
    txt(PW - 16, yRail2 - 9, "RAY 2 (uzak ray) — aynı teker düzeni", 8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  // --- Tekerler, kodlar ve kuvvet okları -----------------------------------
  const maxForce = Math.max(
    ...wheels.map((w) => Math.max(w.lateralNearN, w.lateralFarN)),
    1
  );
  const armPx = (f: number) => (Math.abs(f) / maxForce) * 38;
  let lastLabelX = -Infinity;

  wheels.forEach((w) => {
    const x = xOf(w.distanceM);
    const labelFits = x - lastLabelX >= 24;
    if (labelFits) lastLabelX = x;

    for (const [y, force, dir] of [
      [yRail1, w.lateralNearN, -1],
      [yRail2, w.lateralFarN, 1],
    ] as [number, number, number][]) {
      els.push({
        kind: "rect",
        x: x - 5,
        y: y - 9,
        w: 10,
        h: 18,
        rx: 1.5,
        fill: "#FFFFFF",
        stroke: DCOL.ink,
        strokeWidth: 1.1,
      });
      const a = armPx(force);
      if (a > 3) {
        // Ok GÖVDESİ daima rayın dış tarafındadır (teker kodları iç taraftadır,
        // çakışma olmaz). İşareti ok BAŞININ yönü taşır: anlık kayma kutbunun
        // ötesindeki tekerlerde (dᵢ > h) yanal kayma ters döner ve kuvvet
        // negatife geçer (FEM T.9.4: 1 − dᵢ/h < 0) — ok başı raya bakar.
        const yInner = y + dir * 11;
        const yOuter = y + dir * (13 + a);
        els.push(ln(x, yInner, x, yOuter, DCOL.accent, 1.7));
        if (force >= 0) {
          els.push(arrowHead(x, yOuter, dir < 0 ? "up" : "down", DCOL.accent, 7, 2.9));
        } else {
          els.push(arrowHead(x, yInner, dir < 0 ? "down" : "up", DCOL.accent, 7, 2.9));
        }
        if (labelFits) {
          els.push(
            txt(x, yOuter + (dir < 0 ? -8 : 15), fmtN(force / 1000, 1), 7.5, {
              anchor: "middle",
              fill: DCOL.accent,
            })
          );
        }
      }
      // Raya paralel teğetsel kuvvet — yalnız bağlı (C) teker çiftinde doğar
      if (Math.abs(w.longitudinalN) > 1) {
        els.push(ln(x + 7, y, x + 17, y, DCOL.muted, 1.1));
        els.push(arrowHead(x + 19, y, "right", DCOL.muted, 5, 2.2));
      }
    }
    // Teker kodu — rayların İÇ tarafında, köprü gövdesinin dışında
    els.push(
      txt(x, yRail1 + 18, w.code, 8, { anchor: "middle", fill: DCOL.ink, bold: true })
    );
    els.push(
      txt(x, yRail2 - 13, w.code, 8, { anchor: "middle", fill: DCOL.ink, bold: true })
    );
  });

  // --- Kılavuz eleman ve kılavuz kuvveti S ---------------------------------
  const xGuide = xOf(wheels[0].distanceM);
  els.push(
    txt(
      16,
      yRail1 - 22,
      p.guideMeans === "flange" ? "kılavuz: teker flanşı" : "kılavuz: makara",
      8,
      { fill: DCOL.muted }
    )
  );
  els.push(ln(xGuide - 84, yRail1, xGuide - 14, yRail1, DCOL.accent, 2.4));
  els.push(arrowHead(xGuide - 9, yRail1, "right", DCOL.accent, 9, 3.6));
  // Etiket okun ÜSTÜNE yazılır: ok ray çizgisiyle aynı kotta olduğu için
  // aynı satıra yazılan metnin üstünü çiziyordu.
  els.push(
    txt(xGuide - 14, yRail1 - 8, `S = ${fmtN(p.guideForceN / 1000, 1)} kN`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );

  // --- Anlık kayma kutbu ---------------------------------------------------
  const yPole = yRail1 + Math.min(1, Math.max(0, p.mu)) * (yRail2 - yRail1);
  if (p.applicable) {
    const xScaled = xOf(p.poleDistanceM);
    const fits = xScaled <= xRight;
    const xPole = fits ? xScaled : xRight;
    els.push(ln(xGuide, yPole, xPole - (fits ? 0 : 24), yPole, DCOL.muted, 0.9, "5,3"));
    if (!fits) {
      // Kopuk ölçü işareti — kutup çizim alanının dışında kalıyor
      els.push(ln(xPole - 28, yPole - 7, xPole - 20, yPole + 7, DCOL.muted, 0.9));
      els.push(ln(xPole - 22, yPole - 7, xPole - 14, yPole + 7, DCOL.muted, 0.9));
      els.push(ln(xPole - 12, yPole, xPole, yPole, DCOL.muted, 0.9, "5,3"));
    }
    els.push({
      kind: "circle",
      cx: xPole,
      cy: yPole,
      r: 5,
      fill: "#FFFFFF",
      stroke: DCOL.accent,
      strokeWidth: 1.6,
    });
    els.push(ln(xPole - 8, yPole, xPole + 8, yPole, DCOL.accent, 0.9));
    els.push(ln(xPole, yPole - 8, xPole, yPole + 8, DCOL.accent, 0.9));
    els.push(txt(xPole + 11, yPole - 5, "anlık kayma kutbu", 8, { fill: DCOL.accent }));
    els.push(
      txt(xPole + 11, yPole + 7, `h = ${fmtN(p.poleDistanceM, 2)} m`, 8.5, {
        fill: DCOL.accent,
        bold: true,
      })
    );
    els.push(
      txt(xGuide + 8, yPole + 12, `µ·l = ${fmtN(p.mu * p.spanM, 2)} m`, 7.5, {
        fill: DCOL.muted,
      })
    );
  } else {
    els.push(
      txt(
        xGuide + 8,
        yPole + 4,
        "Tekerler üst üste düştüğü için savrulma modeli tanımsızdır.",
        8.5,
        { fill: DCOL.muted }
      )
    );
  }

  // --- Ölçü zinciri --------------------------------------------------------
  // Ölçü zinciri, RAY 2'nin kuvvet oklarının (en çok 38 px + etiket) altında
  const yDim = yRail2 + 84;
  let lastDimX = -Infinity;
  for (let i = 1; i < wheels.length; i += 1) {
    const x1 = xOf(wheels[i - 1].distanceM);
    const x2 = xOf(wheels[i].distanceM);
    const gapMm = (wheels[i].distanceM - wheels[i - 1].distanceM) * 1000;
    if (x2 - x1 < 22 || x1 < lastDimX) continue;
    dimH(els, x1, x2, yDim, fmtN(gapMm, 0), { size: 7, labelDy: -3 });
    lastDimX = x2;
  }
  dimH(
    els,
    xOf(wheels[0].distanceM),
    xOf(wheels[wheels.length - 1].distanceM),
    yDim + 34,
    `dingil mesafesi = ${fmtN(maxD * 1000, 0)} mm`,
    { size: 8, labelDy: 13 }
  );
  els.push(
    txt(
      16,
      PH - 12,
      `${nWheels} teker / ray · köşe başına ${perCorner} · enine ok uzunlukları kuvvetle orantılıdır (kN)`,
      8,
      { fill: DCOL.muted }
    )
  );

  return fitDiagram(els, PW, PH);
}

// ----------------------------------------------------------------- Yük özeti

export interface LoadSummaryParams {
  /** Karakteristik maksimum teker yükü [kg] */
  maxWheelLoadKg: number;
  /** φ2 ile büyütülmüş tasarım teker yükü [kg] */
  designWheelLoadKg: number;
  /** Minimum teker yükü [kg] */
  minWheelLoadKg: number;
  /** Yakın raydaki en büyük enine teker kuvveti [N] */
  lateralNearN: number;
  /** Uzak raydaki en büyük enine teker kuvveti [N] */
  lateralFarN: number;
  /** Kılavuz kuvveti [N] */
  guideForceN: number;
  /** Savrulmadan doğan, raya paralel teker kuvveti [N] */
  skewLongitudinalN: number;
  /** Tahrikli teker başına boyuna kuvvet [N] */
  driveLongitudinalN: number;
  /** Tampon tepki kuvveti [kN]; 0 ise gösterilmez */
  bufferForceKn: number;
  phi2: number;
  totalWheels: number;
  wheelsPerCorner: number;
}

const SW = 620;
const SH = 330;

/** kg cinsinden bir kuvveti kN etiketine çevirir (1 kgf = 9,81 N). */
const kgLabel = (kg: number): string => `${fmtN((kg * 9.81) / 1000, 1)} kN`;
const nLabel = (forceN: number): string => `${fmtN(forceN / 1000, 1)} kN`;

/**
 * Yol kirişine aktarılan BÜTÜN kuvvetleri tek şemada verir: solda ray ekseni
 * boyunca (yandan) görünüş — düşey ve boyuna kuvvetler; sağda raya dik
 * (önden) görünüş — düşey, enine ve kılavuz kuvvetleri.
 *
 * Amaç, yapı mühendisinin hangi kuvvetin hangi doğrultuda etkidiğini tabloyu
 * okumadan görmesidir; sayılar oklarının yanında yazılıdır.
 */
export function loadSummaryDiagram(p: LoadSummaryParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "YOL KİRİŞİNE AKTARILAN KUVVETLER", 11, { bold: true }));
  els.push(
    txt(
      16,
      34,
      `${p.totalWheels} teker · her köşede ${p.wheelsPerCorner} · değerler teker başına · FEM 1.001`,
      8,
      { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, SW - 16, 40, DCOL.line, 0.8));

  const yRail = 196;
  const wheelR = 26;

  /** Ray kesiti + üstünde teker — iki görünüşte ortak. */
  const drawRailAndWheel = (cx: number, title: string, sub: string) => {
    els.push(txt(cx, 66, title, 9.5, { anchor: "middle", bold: true }));
    els.push(txt(cx, 78, sub, 8, { anchor: "middle", fill: DCOL.muted }));
    // Yol kirişi
    els.push({
      kind: "rect",
      x: cx - 86,
      y: yRail + 16,
      w: 172,
      h: 16,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    for (let i = -5; i <= 5; i += 1) {
      els.push(ln(cx + i * 16, yRail + 32, cx + i * 16 - 6, yRail + 40, DCOL.muted, 0.6));
    }
    // Ray
    els.push({
      kind: "rect",
      x: cx - 22,
      y: yRail + 6,
      w: 44,
      h: 10,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 0.9,
    });
    els.push({
      kind: "rect",
      x: cx - 14,
      y: yRail,
      w: 28,
      h: 6,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    // Teker
    els.push({
      kind: "circle",
      cx,
      cy: yRail - wheelR,
      r: wheelR,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 1.4,
    });
    els.push({
      kind: "circle",
      cx,
      cy: yRail - wheelR,
      r: 5,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
  };

  // ---------------------------------------------------- Sol: yandan görünüş
  const xL = 176;
  drawRailAndWheel(xL, "RAY EKSENİ BOYUNCA", "düşey + boyuna kuvvetler");

  // Düşey yük — teker merkezine inen ok
  els.push(ln(xL, 96, xL, yRail - 2 * wheelR - 8, DCOL.accent, 2));
  els.push(arrowHead(xL, yRail - 2 * wheelR - 4, "down", DCOL.accent, 8, 3.2));
  els.push(
    txt(xL + 8, 106, `Pmaks = ${kgLabel(p.maxWheelLoadKg)}`, 9, {
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(xL + 8, 118, `Pmaks,d = ${kgLabel(p.designWheelLoadKg)}`, 8, {
      fill: DCOL.accent,
    })
  );
  els.push(
    txt(xL + 8, 129, `(φ2 = ${fmtN(p.phi2, 3)})`, 7.5, { fill: DCOL.muted })
  );
  els.push(
    txt(xL + 8, 141, `Pmin = ${kgLabel(p.minWheelLoadKg)}`, 8, { fill: DCOL.muted })
  );

  // Boyuna kuvvetler — ray temas noktasında, raya paralel çift yönlü
  const yContact = yRail - 2;
  els.push(ln(xL - 78, yContact, xL - 30, yContact, DCOL.ink, 2));
  els.push(arrowHead(xL - 82, yContact, "left", DCOL.ink, 8, 3.2));
  els.push(ln(xL + 30, yContact, xL + 78, yContact, DCOL.ink, 2));
  els.push(arrowHead(xL + 82, yContact, "right", DCOL.ink, 8, 3.2));
  els.push(
    txt(xL, yRail + 62, `Tahrik / fren: ${nLabel(p.driveLongitudinalN)}`, 8.5, {
      anchor: "middle",
      bold: true,
    })
  );
  if (Math.abs(p.skewLongitudinalN) > 1) {
    els.push(
      txt(xL, yRail + 74, `Savrulma Fx: ${nLabel(p.skewLongitudinalN)}`, 8, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
  }
  if (p.bufferForceKn > 0) {
    els.push(
      txt(xL, yRail + 86, `Tampon: ${fmtN(p.bufferForceKn, 1)} kN`, 8, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
  }

  // Ayırıcı
  els.push(ln(SW / 2, 60, SW / 2, SH - 40, DCOL.line, 0.8, "4,3"));

  // ---------------------------------------------------- Sağ: önden görünüş
  const xR = SW - 176;
  drawRailAndWheel(xR, "RAYA DİK (ÖNDEN)", "düşey + enine + kılavuz kuvvetleri");

  // Teker flanşı — kılavuz kuvvetinin uygulandığı yer
  els.push({
    kind: "rect",
    x: xR - 22,
    y: yRail - 2 * wheelR,
    w: 6,
    h: 2 * wheelR,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });

  // Düşey yük
  els.push(ln(xR, 96, xR, yRail - 2 * wheelR - 8, DCOL.accent, 2));
  els.push(arrowHead(xR, yRail - 2 * wheelR - 4, "down", DCOL.accent, 8, 3.2));
  els.push(
    txt(xR + 8, 106, `Pmaks,d = ${kgLabel(p.designWheelLoadKg)}`, 9, {
      fill: DCOL.accent,
      bold: true,
    })
  );

  // Enine kuvvetler — raya dik, temas noktasında
  els.push(ln(xR + 30, yContact, xR + 84, yContact, DCOL.ink, 2));
  els.push(arrowHead(xR + 88, yContact, "right", DCOL.ink, 8, 3.2));
  els.push(
    txt(xR + 92, yContact + 3, `Fy1 = ${nLabel(p.lateralNearN)}`, 8.5, {
      bold: true,
    })
  );
  els.push(ln(xR - 84, yContact + 14, xR - 30, yContact + 14, DCOL.muted, 1.6));
  els.push(arrowHead(xR - 88, yContact + 14, "left", DCOL.muted, 7, 2.8));
  els.push(
    txt(xR - 92, yContact + 17, `Fy2 = ${nLabel(p.lateralFarN)}`, 8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  // Kılavuz kuvveti — flanş temasında
  els.push(ln(xR - 74, yRail - wheelR, xR - 26, yRail - wheelR, DCOL.accent, 2.2));
  els.push(arrowHead(xR - 22, yRail - wheelR, "right", DCOL.accent, 9, 3.6));
  els.push(
    txt(xR - 78, yRail - wheelR - 6, `S = ${nLabel(p.guideForceN)}`, 8.5, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(xR - 78, yRail - wheelR + 6, "(kılavuz kuvveti — vinç toplamı)", 7, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  els.push(
    txt(
      16,
      SH - 14,
      "Düşey ve enine değerler TEKER BAŞINA, kılavuz kuvveti S vincin " +
        "TOPLAMIDIR. Kısmi güvenlik katsayıları yol kirişi tasarımında uygulanır.",
      8,
      { fill: DCOL.muted }
    )
  );

  return fitDiagram(els, SW, SH);
}
