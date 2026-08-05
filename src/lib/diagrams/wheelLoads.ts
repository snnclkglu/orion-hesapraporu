// Teker yükleri şemaları — üç parametrik diyagram:
//
//   1) wheelLoadElevationDiagram — vincin RAYLARA DİK görünüşü: açıklık,
//      arabanın yanaşma konumu, iki rayın düşey teker yükleri.
//   2) skewPlanDiagram — ÜSTTEN görünüş: iki başkiriş, ana kirişler, teker
//      düzeni, savrulma açısı, anlık kayma kutbu ve teğetsel kuvvetler.
//   3) loadSummaryDiagram — ÖZET: aynı vinç siluetinde BÜTÜN kuvvet
//      bileşenleri (düşey, enine, kılavuz, boyuna) tek şemada.
//
// Üçü de vincin gerçek silüetini çizer (ana kiriş uçlarında daralan gövde,
// başkirişler, teker grupları) — teknik resmin okunuşuyla aynı dili konuşur.
// Teker adedine ve gerçek teker konumlarına göre kendini kurar; kuvvet okları
// büyüklükle orantılıdır.
//
// KURAL: şemadaki HER sayı birimiyle birlikte yazılır (kN, mm, m, mrad).
// Birimsiz sayı mühendis için anlam taşımaz.
//
// Vinç dört köşesinde eşit tekerle yürür: toplam/4 köşe başına, toplam/2 ray
// başına tekerdir. Çizimler bu düzeni ve teker kodlarını (A1…Ak, B1…Bk)
// gösterir. Dayanak: FEM 1.001 Kitapçık 9 md. 9.4.1 (F.9.4.b / F.9.4.d).

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

// ------------------------------------------------------------- birim yardımcıları

/** N → "12,3 kN" */
const kNof = (forceN: number, d = 1): string => `${fmtN(forceN / 1000, d)} kN`;
/** kg kuvvet → "12,3 kN" (1 kgf = 9,81 N) */
const kNofKg = (kg: number, d = 1): string => `${fmtN((kg * 9.81) / 1000, d)} kN`;
/** kg → "1.234 kg" */
const kgOf = (kg: number): string => `${fmtN(kg, 0)} kg`;
/** mm → "1.500 mm" */
const mmOf = (v: number): string => `${fmtN(v, 0)} mm`;
/** m → "13,82 m" */
const mOf = (v: number, d = 2): string => `${fmtN(v, d)} m`;

// --------------------------------------------------------- ortak vinç silueti

interface CraneSilhouette {
  xL: number;
  xR: number;
  yGirderTop: number;
  yGirderBotMid: number;
  yCarriageTop: number;
  yWheel: number;
  wheelR: number;
  yRail: number;
  yRunwayTop: number;
  yRunwayBot: number;
}

/**
 * Vincin raylara dik silueti: uçlarında daralan ana kiriş gövdesi, iki
 * başkiriş, tekerler, raylar ve yol kirişleri. İki şema (10.2 ve 10.5) aynı
 * silueti kullanır — okuyucu iki şemayı aynı vinç üzerinde birleştirebilsin.
 */
function drawCrane(
  els: DiagramEl[],
  xL: number,
  xR: number,
  yTop: number,
  wheelsPerSide: number,
  railNotes: [string, string] = ["RAY 1 — araba bu raya yanaşır", "RAY 2"]
): CraneSilhouette {
  const girderH = 30;
  const endH = 13; // kiriş uçlarındaki daralmış gövde yüksekliği
  const taper = 46; // daralma boyu
  const yGirderTop = yTop;
  const yGirderBotMid = yTop + girderH;
  const yGirderBotEnd = yTop + endH;
  const yCarriageTop = yGirderBotEnd + 8;
  const carriageH = 20;
  const wheelR = 13;
  const yWheel = yCarriageTop + carriageH + wheelR - 2;
  const yRail = yWheel + wheelR;
  const yRunwayTop = yRail + 9;
  const yRunwayBot = yRunwayTop + 15;

  const gx1 = xL - 54;
  const gx2 = xR + 54;
  // Üst sac (araba rayının oturduğu düzlem)
  els.push({
    kind: "rect",
    x: gx1,
    y: yGirderTop - 6,
    w: gx2 - gx1,
    h: 6,
    fill: DCOL.line,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  // Ana kiriş gövdesi — uçlarda daralır (teknik resimdeki siluet)
  els.push({
    kind: "polygon",
    points: [
      [gx1, yGirderTop],
      [gx2, yGirderTop],
      [gx2, yGirderBotEnd],
      [gx2 - taper, yGirderBotMid],
      [gx1 + taper, yGirderBotMid],
      [gx1, yGirderBotEnd],
    ],
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.3,
  });

  const nWheels = Math.max(1, Math.round(wheelsPerSide));
  [xL, xR].forEach((xc, side) => {
    // Başkiriş
    els.push({
      kind: "rect",
      x: xc - 44,
      y: yCarriageTop,
      w: 88,
      h: carriageH,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.2,
    });
    els.push(
      txt(xc, yCarriageTop + 14, "BAŞKİRİŞ", 7.5, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
    // Teker — bu görünüşte bir rayın bütün tekerleri üst üste düşer
    els.push({
      kind: "circle",
      cx: xc,
      cy: yWheel,
      r: wheelR,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 1.4,
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
      x: xc - 12,
      y: yRail,
      w: 24,
      h: 9,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    // Yol kirişi + zemin taraması
    els.push({
      kind: "rect",
      x: xc - 58,
      y: yRunwayTop,
      w: 116,
      h: 15,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    for (let i = -6; i <= 6; i += 1) {
      els.push(
        ln(xc + i * 9, yRunwayBot, xc + i * 9 - 6, yRunwayBot + 8, DCOL.muted, 0.6)
      );
    }
    // Ray adı ve teker adedi — taramanın ALTINDA, tek satırda
    els.push(
      txt(xc, yRunwayBot + 22, `${railNotes[side]} · ${nWheels} teker`, 7.5, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
  });

  return {
    xL,
    xR,
    yGirderTop,
    yGirderBotMid,
    yCarriageTop,
    yWheel,
    wheelR,
    yRail,
    yRunwayTop,
    yRunwayBot,
  };
}

/** Sayfa düzlemine DİK kuvvet simgesi: ⊗ (içeri) — boyuna kuvvetler için. */
function intoPageSymbol(els: DiagramEl[], cx: number, cy: number, r = 8) {
  els.push({
    kind: "circle",
    cx,
    cy,
    r,
    fill: "#FFFFFF",
    stroke: DCOL.ink,
    strokeWidth: 1.4,
  });
  const d = r * 0.62;
  els.push(ln(cx - d, cy - d, cx + d, cy + d, DCOL.ink, 1.3));
  els.push(ln(cx - d, cy + d, cx + d, cy - d, DCOL.ink, 1.3));
}

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

const EW = 660;
const EH = 360;

/**
 * Vincin RAYLARA DİK görünüşü — düşey teker yükleri.
 *
 * Bu görünüşte bir başkirişin bütün tekerleri üst üste düşer; teker düzeni
 * savrulma plan şemasının konusudur. Şema açıklığı, arabanın yanaşma konumunu
 * ve iki rayın düşey yüklerini anlatır.
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

  const xL = 116;
  const xR = EW - 116;
  const spanPx = xR - xL;
  const c = drawCrane(els, xL, xR, 132, p.wheelsPerSide);

  // --- Araba ve asılı yük --------------------------------------------------
  const span = Math.max(0.001, p.spanM);
  // Yanaşma oranı gerçektir; araba kutusu başkirişin üstüne binmesin diye
  // çizimde en az bir kutu genişliği kadar içeri alınır (şema, ölçek değil).
  const approachFrac = Math.min(0.45, Math.max(0, p.minApproachM / span));
  const xTrolley = xL + Math.max(approachFrac * spanPx, 82);
  els.push({
    kind: "rect",
    x: xTrolley - 38,
    y: c.yGirderTop - 34,
    w: 76,
    h: 28,
    rx: 2,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.1,
  });
  els.push(txt(xTrolley, c.yGirderTop - 16, "ARABA", 8, { anchor: "middle" }));
  const xRope = xTrolley + 32;
  els.push(ln(xRope, c.yGirderTop - 34, xRope, c.yWheel - 8, DCOL.faint, 0.9, "2,2"));
  els.push({
    kind: "circle",
    cx: xRope,
    cy: c.yWheel,
    r: 8,
    fill: "#FBEDEC",
    stroke: DCOL.accent,
    strokeWidth: 1.3,
  });
  if (p.hoistLoadKg) {
    els.push(
      txt(xRope + 13, c.yWheel + 3, `SL = ${kNofKg(p.hoistLoadKg)}`, 8.5, {
        fill: DCOL.accent,
        bold: true,
      })
    );
    els.push(
      txt(xRope + 13, c.yWheel + 14, `(${kgOf(p.hoistLoadKg)})`, 7.5, {
        fill: DCOL.muted,
      })
    );
  }

  // --- Düşey yük okları ----------------------------------------------------
  const yArrow0 = c.yRunwayBot + 34;
  const loadLabel = (xc: number, top: string, sub: string[], color: string) => {
    els.push(ln(xc, yArrow0, xc, yArrow0 + 22, color, 2));
    els.push(arrowHead(xc, yArrow0 + 26, "down", color, 9, 3.4));
    els.push(
      txt(xc, yArrow0 + 42, top, 9.5, { anchor: "middle", fill: color, bold: true })
    );
    sub.forEach((s, i) =>
      els.push(
        txt(xc, yArrow0 + 55 + i * 11, s, 7.5, { anchor: "middle", fill: DCOL.muted })
      )
    );
  };
  loadLabel(
    xL,
    p.maxWheelLoadKg !== undefined ? `Pmaks = ${kNofKg(p.maxWheelLoadKg)}` : "Pmaks",
    [
      p.maxWheelLoadKg !== undefined ? `(${kgOf(p.maxWheelLoadKg)}) teker başına` : "",
      p.designWheelLoadKg !== undefined
        ? `tasarım (φ2 dahil) ${kNofKg(p.designWheelLoadKg)}`
        : "",
    ].filter(Boolean),
    DCOL.accent
  );
  loadLabel(
    xR,
    p.minWheelLoadKg !== undefined ? `Pmin = ${kNofKg(p.minWheelLoadKg)}` : "Pmin",
    [
      p.minWheelLoadKg !== undefined ? `(${kgOf(p.minWheelLoadKg)}) teker başına` : "",
      "araba karşı uçtayken",
    ].filter(Boolean),
    DCOL.muted
  );

  // --- Ölçüler -------------------------------------------------------------
  dimH(els, xL, xTrolley, c.yGirderTop - 52, `e = ${mOf(p.minApproachM)}`, {
    size: 8,
    labelDy: -5,
  });
  dimH(els, xL, xR, yArrow0 + 88, `l = ${mOf(p.spanM)}`, { labelDy: 14 });

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
 * Vincin ÜSTTEN görünüşü — savrulma (FEM 1.001 Kitapçık 9 F.9.4.b / F.9.4.d).
 *
 * Vinç plan görünüşünde gerçek silüetiyle çizilir: iki rayın üzerinde birer
 * başkiriş, aralarında iki ana kiriş. Savrulma, FEM'in F.9.4.d şeklindeki gibi
 * RAY DOĞRULTUSU ile HAREKET DOĞRULTUSU arasındaki α açısıyla gösterilir —
 * gövdeyi eğmek yerine, çünkü α (birkaç mrad) çizimde görünmeyecek kadar
 * küçüktür.
 *
 * Teker adedi arttıkça tuval genişler; sığmayan ölçü ve kuvvet etiketleri
 * atlanır, böylece üst üste binen etiket üretilmez.
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

  // Tuval genişliği GEOMETRİDEN çıkar: en dar teker aralığının ölçü etiketi
  // (≈34 px) sığacak kadar geniş olmalıdır. Teker adedine göre sabit bir
  // genişlik, köşe içi 1.000–1.500 mm aralıklarda ölçüleri düşürüyordu.
  const distances = wheels.map((w) => w.distanceM);
  const maxDistance = Math.max(...distances, 0.001);
  const gapsM = distances.slice(1).map((d, i) => d - distances[i]).filter((g) => g > 0);
  const minGapM = gapsM.length > 0 ? Math.min(...gapsM) : maxDistance;
  const LABEL_PX = 34;
  const usableWidth = Math.min(
    1150,
    Math.max(340, (maxDistance / minGapM) * LABEL_PX)
  );
  const LEFT_PAD = 148;
  const POLE_SPACE = 170; // kayma kutbu oku ve etiketi için sağda ayrılan yer
  const PW = Math.max(680, Math.round(LEFT_PAD + usableWidth + POLE_SPACE));
  const PH = 470;

  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "SAVRULMA (SKEWING) — ÜSTTEN GÖRÜNÜŞ", 11, { bold: true }));
  els.push(
    txt(16, 34, "FEM 1.001 Kitapçık 9, md. 9.4.1 · savrulma açısı abartılmıştır", 8, {
      fill: DCOL.muted,
    })
  );
  els.push(ln(16, 40, PW - 16, 40, DCOL.line, 0.8));

  const xL = LEFT_PAD;
  const xRight = PW - 24;
  const yRail1 = 158;
  const yRail2 = 288;

  const maxD = maxDistance;
  const usable = usableWidth;
  const xOf = (d: number) => xL + (d / maxD) * usable;
  const xFirst = xOf(wheels[0].distanceM);
  const xLast = xOf(wheels[nWheels - 1].distanceM);

  // --- Raylar --------------------------------------------------------------
  // Ray adları vincin SAĞINDA, rayın hemen üstünde/altında durur: rayın dış
  // bandı kuvvet oklarına ayrılmıştır ve küçük kuvvetlerin etiketleri raya
  // yaklaştığı için orası güvenli değildir.
  els.push(ln(16, yRail1, PW - 16, yRail1, DCOL.ink, 2.4));
  els.push(ln(16, yRail2, PW - 16, yRail2, DCOL.ink, 2.4));

  // --- Vinç silueti: iki başkiriş + iki ana kiriş --------------------------
  const carriageHalf = 20;
  const carriagePad = 22;
  for (const y of [yRail1, yRail2]) {
    els.push({
      kind: "rect",
      x: xFirst - carriagePad,
      y: y - carriageHalf,
      w: xLast - xFirst + 2 * carriagePad,
      h: 2 * carriageHalf,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.2,
    });
  }
  // Ana kirişler — başkirişleri birbirine bağlar
  const girderW = 16;
  const xG1 = xOf(wheels[Math.max(0, Math.floor((perCorner - 1) / 2))].distanceM);
  const xG2 = xOf(
    wheels[Math.min(nWheels - 1, perCorner + Math.floor((perCorner - 1) / 2))]
      .distanceM
  );
  for (const xg of [xG1, xG2]) {
    els.push({
      kind: "rect",
      x: xg - girderW / 2,
      y: yRail1 + carriageHalf,
      w: girderW,
      h: yRail2 - yRail1 - 2 * carriageHalf,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
  }
  els.push(
    txt((xG1 + xG2) / 2, (yRail1 + yRail2) / 2 - 6, "ANA KİRİŞLER", 8, {
      anchor: "middle",
      fill: DCOL.muted,
    })
  );
  // Başkiriş adı ayrı etiket olarak yazılmaz: kutu siluetten anlaşılıyor ve
  // teker kodlarıyla aynı bantta çakışıyordu.
  const xNote = xLast + carriagePad + 14;
  els.push(
    txt(xNote, yRail1 - 7, "RAY 1 — araba bu raya yanaşır (yakın ray)", 7.5, {
      fill: DCOL.muted,
    })
  );
  els.push(
    txt(xNote, yRail2 + 14, "RAY 2 (uzak ray) — aynı teker düzeni", 7.5, {
      fill: DCOL.muted,
    })
  );

  // --- Savrulma açısı göstergesi (F.9.4.d) --------------------------------
  // Teker alanının SOLUNA, kuvvet oklarının ulaşmadığı boş köşeye konur:
  // gerçek α birkaç mrad olduğu için çizimde abartılır.
  const yAng = 62;
  const angLen = 78;
  const angDrop = 20;
  els.push(txt(16, yAng - 14, "yürüme yönü", 8, { fill: DCOL.muted }));
  els.push(ln(16, yAng, 16 + angLen, yAng, DCOL.faint, 1.2, "6,3"));
  els.push(ln(16, yAng, 16 + angLen, yAng + angDrop, DCOL.accent, 1.8));
  els.push(arrowHead(16 + angLen + 3, yAng + angDrop + 0.5, "right", DCOL.accent, 8, 3));
  els.push(
    txt(16, yAng + angDrop + 15, `α = ${fmtN(p.alphaRad * 1000, 2)} mrad`, 9, {
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(16, yAng + angDrop + 27, "kesikli: ray doğrultusu", 6.8, { fill: DCOL.muted })
  );
  els.push(
    txt(16, yAng + angDrop + 36, "kırmızı: hareket doğrultusu", 6.8, {
      fill: DCOL.accent,
    })
  );

  // --- Tekerler, kodlar ve kuvvet okları -----------------------------------
  const maxForce = Math.max(
    ...wheels.map((w) => Math.max(Math.abs(w.lateralNearN), Math.abs(w.lateralFarN))),
    1
  );
  const armPx = (f: number) => (Math.abs(f) / maxForce) * 38;
  let lastLabelX = -Infinity;

  wheels.forEach((w) => {
    const x = xOf(w.distanceM);
    const labelFits = x - lastLabelX >= 26;
    if (labelFits) lastLabelX = x;

    for (const [y, force, dir] of [
      [yRail1, w.lateralNearN, -1],
      [yRail2, w.lateralFarN, 1],
    ] as [number, number, number][]) {
      els.push({
        kind: "rect",
        x: x - 5,
        y: y - 10,
        w: 10,
        h: 20,
        rx: 1.5,
        fill: "#FFFFFF",
        stroke: DCOL.ink,
        strokeWidth: 1.2,
      });
      const a = armPx(force);
      if (a > 3) {
        // Ok GÖVDESİ daima rayın dış tarafındadır (teker kodları iç taraftadır,
        // çakışma olmaz). İşareti ok BAŞININ yönü taşır: anlık kayma kutbunun
        // ötesindeki tekerlerde (dᵢ > h) yanal kayma ters döner ve kuvvet
        // negatife geçer (FEM T.9.4: 1 − dᵢ/h < 0) — ok başı raya bakar.
        const yInner = y + dir * 16;
        const yOuter = y + dir * (18 + a);
        els.push(ln(x, yInner, x, yOuter, DCOL.accent, 1.7));
        if (force >= 0) {
          els.push(arrowHead(x, yOuter, dir < 0 ? "up" : "down", DCOL.accent, 7, 2.9));
        } else {
          els.push(arrowHead(x, yInner, dir < 0 ? "down" : "up", DCOL.accent, 7, 2.9));
        }
        if (labelFits) {
          els.push(
            txt(x, yOuter + (dir < 0 ? -8 : 15), kNof(force), 7.5, {
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
    // Teker kodu — başkirişin İÇİNDE, tekerin hemen altında. Rayın dış tarafı
    // tamamen kuvvet oklarına ayrılmıştır.
    els.push(
      txt(x, yRail1 + carriageHalf - 5, w.code, 7.5, {
        anchor: "middle",
        fill: DCOL.ink,
        bold: true,
      })
    );
    els.push(
      txt(x, yRail2 - carriageHalf + 12, w.code, 7.5, {
        anchor: "middle",
        fill: DCOL.ink,
        bold: true,
      })
    );
  });
  if (Math.abs(wheels[0].longitudinalN) > 1) {
    els.push(
      txt(
        xLast + carriagePad + 14,
        yRail2 + 26,
        `raya paralel teğetsel Fx = ${kNof(wheels[0].longitudinalN, 2)} / teker`,
        7.5,
        { fill: DCOL.muted }
      )
    );
  }

  // --- Kılavuz eleman ve kılavuz kuvveti S ---------------------------------
  els.push(ln(xFirst - 104, yRail1, xFirst - 30, yRail1, DCOL.accent, 2.4));
  els.push(arrowHead(xFirst - 25, yRail1, "right", DCOL.accent, 9, 3.6));
  els.push(
    txt(xFirst - 34, yRail1 - 24, `S = ${kNof(p.guideForceN)}`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(xFirst - 34, yRail1 - 13, "kılavuz kuvveti (vinç toplamı)", 7, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  // --- Anlık kayma kutbu ---------------------------------------------------
  const yPole = yRail1 + Math.min(1, Math.max(0, p.mu)) * (yRail2 - yRail1);
  if (p.applicable) {
    const xScaled = xOf(p.poleDistanceM);
    const fits = xScaled <= xRight;
    const xPole = fits ? xScaled : xRight;
    els.push(ln(xFirst, yPole, xPole - (fits ? 0 : 24), yPole, DCOL.muted, 0.9, "5,3"));
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
    els.push(
      txt(xPole + 11, yPole - 5, "anlık kayma kutbu", 7.5, { fill: DCOL.accent })
    );
    els.push(
      txt(xPole + 11, yPole + 8, `h = ${mOf(p.poleDistanceM)}`, 8.5, {
        fill: DCOL.accent,
        bold: true,
      })
    );
    els.push(
      txt(xFirst - 12, yPole + 3, `µ·l = ${mOf(p.mu * p.spanM)}`, 7.5, {
        anchor: "end",
        fill: DCOL.muted,
      })
    );
  } else {
    els.push(
      txt(
        xFirst + 8,
        yPole + 4,
        "Tekerler üst üste düştüğü için savrulma modeli tanımsızdır.",
        8.5,
        { fill: DCOL.muted }
      )
    );
  }

  // --- Ölçü zinciri --------------------------------------------------------
  // Ölçü zincirinde teknik resim kuralı geçerlidir: kotlar çıplak sayı, birim
  // zincirin başında bir kez yazılır (dar aralıklarda "1.100 mm" sığmıyor).
  // KUVVET değerleri bu kuralın DIŞINDADIR — hepsi kN ile yazılır.
  const yDim = yRail2 + 100;
  els.push(txt(16, yDim + 3, "ölçüler mm", 7.5, { fill: DCOL.muted }));
  let lastDimX = -Infinity;
  for (let i = 1; i < wheels.length; i += 1) {
    const x1 = xOf(wheels[i - 1].distanceM);
    const x2 = xOf(wheels[i].distanceM);
    const gapMm = (wheels[i].distanceM - wheels[i - 1].distanceM) * 1000;
    if (x2 - x1 < 30 || x1 < lastDimX) continue;
    dimH(els, x1, x2, yDim, fmtN(gapMm, 0), { size: 7, labelDy: -3 });
    lastDimX = x2;
  }
  dimH(els, xFirst, xLast, yDim + 34, `dingil mesafesi = ${mmOf(maxD * 1000)}`, {
    size: 8,
    labelDy: 13,
  });
  els.push(
    txt(
      16,
      PH - 12,
      `${nWheels} teker / ray · köşe başına ${perCorner} · ` +
        `kılavuz: ${p.guideMeans === "flange" ? "teker flanşı" : "kılavuz makarası"} · ` +
        "enine ok uzunlukları kuvvetle orantılıdır",
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
  wheelsPerSide: number;
  spanM: number;
}

const SW = 680;
const SH = 430;

/**
 * Yol kirişine aktarılan BÜTÜN kuvvetler tek vinç şemasında.
 *
 * Görünüş raylara diktir; boyuna kuvvetler bu düzleme dik olduğundan ⊗
 * (sayfa düzlemine dik, içeri) simgesiyle ray kotunda gösterilir. Böylece
 * mühendis üç doğrultunun tamamını tek resimde görür ve hangi kuvvetin hangi
 * doğrultuda etkidiğini tabloyu okumadan anlar.
 */
export function loadSummaryDiagram(p: LoadSummaryParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "YOL KİRİŞİNE AKTARILAN KUVVETLER", 11, { bold: true }));
  els.push(
    txt(
      16,
      34,
      `${p.totalWheels} teker · her köşede ${p.wheelsPerCorner} · rayda ${p.wheelsPerSide} · ` +
        "düşey ve enine değerler TEKER BAŞINA · FEM 1.001",
      8,
      { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, SW - 16, 40, DCOL.line, 0.8));

  const xL = 178;
  const xR = SW - 178;
  const c = drawCrane(els, xL, xR, 118, p.wheelsPerSide, [
    "RAY 1 — araba bu raya yanaşır",
    "RAY 2",
  ]);

  // --- Araba + yük ---------------------------------------------------------
  const xTrolley = xL + 92;
  els.push({
    kind: "rect",
    x: xTrolley - 36,
    y: c.yGirderTop - 30,
    w: 72,
    h: 24,
    rx: 2,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  els.push(txt(xTrolley, c.yGirderTop - 14, "ARABA", 7.5, { anchor: "middle" }));
  els.push(ln(xTrolley + 30, c.yGirderTop - 30, xTrolley + 30, c.yWheel - 10, DCOL.faint, 0.9, "2,2"));
  els.push({
    kind: "circle",
    cx: xTrolley + 30,
    cy: c.yWheel - 2,
    r: 7,
    fill: "#FBEDEC",
    stroke: DCOL.accent,
    strokeWidth: 1.2,
  });

  // --- Düşey kuvvetler -----------------------------------------------------
  // Ray adı satırı yRunwayBot + 22'de; oklar onun altından başlar.
  const yV0 = c.yRunwayBot + 32;
  const vertical = (xc: number, lines: string[], color: string) => {
    els.push(ln(xc, yV0, xc, yV0 + 20, color, 2));
    els.push(arrowHead(xc, yV0 + 24, "down", color, 9, 3.4));
    lines.forEach((line, i) =>
      els.push(
        txt(xc, yV0 + 40 + i * 12, line, i === 0 ? 9 : 7.8, {
          anchor: "middle",
          fill: i === 0 ? color : DCOL.muted,
          bold: i === 0,
        })
      )
    );
  };
  vertical(
    xL,
    [
      `Pmaks,d = ${kNofKg(p.designWheelLoadKg)}`,
      `φ2 = ${fmtN(p.phi2, 3)} dahil · ${kgOf(p.designWheelLoadKg)}`,
      `karakteristik Pmaks = ${kNofKg(p.maxWheelLoadKg)}`,
    ],
    DCOL.accent
  );
  vertical(
    xR,
    [
      `Pmin = ${kNofKg(p.minWheelLoadKg)}`,
      `(${kgOf(p.minWheelLoadKg)}) araba karşı uçta`,
    ],
    DCOL.muted
  );

  // --- Kılavuz ve enine kuvvetler: kenar sütunlarında, alt alta -----------
  // Etiketler yalnız DEĞER taşır; simgelerin ne olduğu alttaki lejantta yazar.
  // (Her okun yanına açıklama yazmak bu dar bantta çakışma üretiyordu.)
  const yGuide = c.yWheel;
  els.push(ln(xL - 84, yGuide, xL - c.wheelR - 6, yGuide, DCOL.accent, 2.4));
  els.push(arrowHead(xL - c.wheelR - 2, yGuide, "right", DCOL.accent, 9, 3.6));
  els.push(
    txt(xL - 90, yGuide + 3, `S = ${kNof(p.guideForceN)}`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );

  const yLat = c.yRunwayTop + 7;
  els.push(ln(xL - 84, yLat, xL - 22, yLat, DCOL.accent, 2));
  els.push(arrowHead(xL - 18, yLat, "right", DCOL.accent, 8, 3.2));
  els.push(
    txt(xL - 90, yLat + 3, `Fy1 = ${kNof(p.lateralNearN)}`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(ln(xR + 22, yLat, xR + 84, yLat, DCOL.muted, 1.8));
  els.push(arrowHead(xR + 88, yLat, "right", DCOL.muted, 8, 3.2));
  els.push(
    txt(xR + 90, yLat + 3, `Fy2 = ${kNof(p.lateralFarN)}`, 9, { fill: DCOL.muted })
  );

  // --- Boyuna kuvvetler: bu düzleme DİK → ⊗ simgesi ------------------------
  // Düşey yük etiketlerinin ALTINDA, ortada tek blok.
  const xMid = (xL + xR) / 2;
  const yLong = yV0 + 84;
  intoPageSymbol(els, xMid - 132, yLong, 9);
  els.push(
    txt(xMid - 116, yLong + 3, `Boyuna H = ${kNof(p.driveLongitudinalN)} / tahrikli teker`, 9, {
      bold: true,
    })
  );
  const extras: string[] = [];
  if (Math.abs(p.skewLongitudinalN) > 1) {
    extras.push(`savrulma Fx = ${kNof(p.skewLongitudinalN, 2)} / teker`);
  }
  if (p.bufferForceKn > 0) {
    extras.push(`tampon tepkisi = ${fmtN(p.bufferForceKn, 1)} kN / tampon`);
  }
  if (extras.length > 0) {
    els.push(
      txt(xMid, yLong + 20, extras.join("   ·   "), 8, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
  }

  // --- Lejant --------------------------------------------------------------
  els.push(ln(16, SH - 44, SW - 16, SH - 44, DCOL.line, 0.8));
  els.push(
    txt(
      16,
      SH - 30,
      "S: kılavuz kuvveti (VİNÇ TOPLAMI, flanş/makara temasında)   ·   " +
        "Fy1 · Fy2: enine teker kuvveti   ·   H: boyuna kuvvet, ⊗ = sayfa düzlemine dik (raya paralel)",
      7.5,
      { fill: DCOL.muted }
    )
  );
  els.push(
    txt(
      16,
      SH - 18,
      "Kuvvetler karakteristiktir; kısmi güvenlik katsayıları yol kirişi tasarımında uygulanır. " +
        "Araba karşı uca gittiğinde raylar yer değiştirir — her iki ray da Fy1 ile boyutlandırılır.",
      7.5,
      { fill: DCOL.muted }
    )
  );

  return fitDiagram(els, SW, SH);
}
