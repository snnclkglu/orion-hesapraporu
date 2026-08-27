// Teker yükleri şemaları — beş parametrik diyagram:
//
//   1) wheelLoadElevationDiagram — vincin RAYLARA DİK görünüşü: açıklık,
//      arabanın yanaşma konumu, iki rayın düşey teker yükleri.
//   2) wheelLoadSideDiagram — RAYA PARALEL görünüş: 6.1'de tanımlanan gerçek
//      teker dizisi ve her tekerin düşey yükü; yakın ve uzak ray ayrı çizilir.
//   3) skewPlanDiagram — ÜSTTEN görünüş: iki başkiriş, ana kirişler, teker
//      düzeni, savrulma açısı, anlık kayma kutbu ve teğetsel kuvvetler.
//   4) longitudinalForceDiagram — RAYA PARALEL görünüş: hızlanma/frenleme
//      kuvvetinin ray ve tahrikli teker tabanına dağılımı ile FEM bandı.
//   5) loadSummaryDiagram — ÖZET: aynı vinç siluetinde BÜTÜN kuvvet
//      bileşenleri (düşey, enine, kılavuz, boyuna) tek şemada.
//
// Bu şemalar vincin gerçek silüetini çizer (ana kiriş uçlarında daralan gövde,
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
  diagramTitleCase,
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
  /** Bandaj (teker yüzeyi) ortası — kılavuz kuvveti bu kotta etkir */
  yWheel: number;
  /** Flanş dış yüzünün eksene uzaklığı — yan kuvvet okları buradan başlar */
  wheelHalfWidth: number;
  /** Ray başının üst kotu (bandajın oturduğu düzlem) */
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
  railNotes: [string, string] = ["RAY 1 — Araba Bu Raya Yanaşır", "RAY 2"]
): CraneSilhouette {
  const girderH = 30;
  const endH = 13; // kiriş uçlarındaki daralmış gövde yüksekliği
  const taper = 46; // daralma boyu
  const yGirderTop = yTop;
  const yGirderBotMid = yTop + girderH;
  const yGirderBotEnd = yTop + endH;
  const yCarriageTop = yGirderBotEnd + 8;
  const carriageH = 20;
  // Teker bu görünüşte ÖNDEN görülür: dönme ekseni bakış doğrultusuna diktir,
  // dolayısıyla daire değil BANDAJ GENİŞLİĞİ ve iki yanındaki FLANŞLAR görünür.
  // Daire ancak raya paralel bakışta (yandan) çıkar.
  const treadHalf = 17; // bandaj yarı genişliği
  const treadH = 21; // bandaj yüksekliği (görünen kısım)
  const flangeW = 4.5;
  const flangeDrop = 13; // flanşın bandaj altına sarkması
  const wheelHalfWidth = treadHalf + flangeW;
  const yWheelTop = yCarriageTop + carriageH + 2;
  const yWheel = yWheelTop + treadH / 2;
  const yRail = yWheelTop + treadH; // bandaj ray başına oturur
  // Ray kesiti: baş + gövde + taban
  const railHeadH = 7;
  const railWebH = 8;
  const railFootH = 5;
  const yRunwayTop = yRail + railHeadH + railWebH + railFootH + 2;
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
    // --- Teker: ÖNDEN görünüş (bandaj + iki flanş) -------------------------
    // Bu görünüşte bir rayın bütün tekerleri üst üste düşer, tek teker görülür.
    els.push({
      kind: "rect",
      x: xc - treadHalf,
      y: yWheelTop,
      w: 2 * treadHalf,
      h: treadH,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 1.4,
    });
    // Mil ekseni
    els.push(ln(xc - treadHalf - 7, yWheel, xc + treadHalf + 7, yWheel, DCOL.faint, 0.7, "6,3"));
    els.push({
      kind: "rect",
      x: xc - 5,
      y: yWheel - 3.5,
      w: 10,
      h: 7,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 0.9,
    });
    // Flanşlar — ray başını iki yandan kavrar, kılavuz boşluğu aradaki payıdır
    for (const s of [-1, 1]) {
      els.push({
        kind: "rect",
        x: s < 0 ? xc - treadHalf - flangeW : xc + treadHalf,
        y: yWheelTop + treadH - 15,
        w: flangeW,
        h: 15 + flangeDrop,
        fill: DCOL.line,
        stroke: DCOL.ink,
        strokeWidth: 1.1,
      });
    }
    // --- Ray kesiti: baş + gövde + taban -----------------------------------
    els.push({
      kind: "rect",
      x: xc - 9,
      y: yRail,
      w: 18,
      h: railHeadH,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    els.push({
      kind: "rect",
      x: xc - 3.5,
      y: yRail + railHeadH,
      w: 7,
      h: railWebH,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    els.push({
      kind: "rect",
      x: xc - 15,
      y: yRail + railHeadH + railWebH,
      w: 30,
      h: railFootH,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
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
      txt(xc, yRunwayBot + 22, `${railNotes[side]} · ${nWheels} Teker`, 7.5, {
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
    wheelHalfWidth,
    yRail,
    yRunwayTop,
    yRunwayBot,
  };
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
    txt(16, 34, "Araba En Yakın Konumda · FEM 1.001 §2.2 · Şematik", 8, {
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
      p.maxWheelLoadKg !== undefined ? `(${kgOf(p.maxWheelLoadKg)}) Teker Başına` : "",
      p.designWheelLoadKg !== undefined
        ? `Tasarım (φ2 Dahil) ${kNofKg(p.designWheelLoadKg)}`
        : "",
    ].filter(Boolean),
    DCOL.accent
  );
  loadLabel(
    xR,
    p.minWheelLoadKg !== undefined ? `Pmin = ${kNofKg(p.minWheelLoadKg)}` : "Pmin",
    [
      p.minWheelLoadKg !== undefined ? `(${kgOf(p.minWheelLoadKg)}) Teker Başına` : "",
      "Araba Karşı Uçtayken",
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

// ---------------------------------------------------------- Raya paralel görünüş

export interface WheelLoadSideParams {
  /** 6.1'deki bir ray üzerindeki teker kodları (A1…Ak, B1…Bk). */
  codes: string[];
  /** Aynı tekerlerin A1 ekseninden itibaren gerçek konumları [m]. */
  positionsM: number[];
  /** Karakteristik maksimum teker yükü [kg]. */
  maxWheelLoadKg: number;
  /** Karakteristik minimum teker yükü [kg]. */
  minWheelLoadKg: number;
  /** Dinamik katsayı dahil tasarım teker yükü [kg]. */
  designWheelLoadKg: number;
}

/**
 * Vincin RAYA PARALEL görünüşü — her tekerin düşey yükü.
 *
 * Raylara dik görünüş yükün iki ray arasındaki dağılımını anlatır; bu ikinci
 * görünüş aynı yük durumunu ray boyunca açar. 6.1'de girilen gerçek sıra ve
 * ölçü zinciri korunur. Araba RAY 1'e yanaşmışken o raydaki her teker Pmaks,
 * karşı raydaki her teker Pmin taşır; Pmaks,d yakın rayın tasarım değeridir.
 *
 * İki ray yandan bakışta geometrik olarak üst üste düşeceği için ayrı satırda
 * çizilir. Böylece her teker kodu kendi yük okuyla birebir eşleşir.
 */
export function wheelLoadSideDiagram(p: WheelLoadSideParams): Diagram {
  const count = Math.max(1, p.codes.length, p.positionsM.length);
  const codes = Array.from({ length: count }, (_, i) => p.codes[i] ?? `T${i + 1}`);
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = p.positionsM[i];
    const previous = positions[i - 1] ?? 0;
    positions.push(Number.isFinite(raw) ? Math.max(previous, raw) : previous);
  }

  // Teknik resimde büyük orta açıklık, küçük boji aralıklarını okunmaz hâle
  // getirmesin: oranlar korunur fakat tek bir aralık görselde en çok 6 kat
  // büyür. Alt ölçü zinciri her durumda GERÇEK değerleri yazar.
  const gaps = positions.slice(1).map((d, i) => Math.max(0, d - positions[i]));
  const positiveGaps = gaps.filter((g) => g > 0);
  const minGap = positiveGaps.length > 0 ? Math.min(...positiveGaps) : 1;
  const visualWeights = gaps.map((g) => Math.min(6, Math.max(1, g / minGap)));
  const totalWeight = visualWeights.reduce((sum, value) => sum + value, 0);
  const usableWidth = Math.min(650, Math.max(300, totalWeight * 44));
  const LEFT = 154;
  const RIGHT = 34;
  const PW = Math.max(660, Math.ceil(LEFT + usableWidth + RIGHT));
  const spare = PW - LEFT - RIGHT - usableWidth;
  const xFirst = LEFT + spare / 2;
  const visualScale = totalWeight > 0 ? usableWidth / totalWeight : 0;
  const xs = [xFirst];
  for (const weight of visualWeights) xs.push(xs[xs.length - 1] + weight * visualScale);
  const xLast = xs[xs.length - 1];

  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "DÜŞEY TEKER YÜKLERİ — RAYA PARALEL GÖRÜNÜŞ", 11, { bold: true }));
  els.push(
    txt(
      16,
      34,
      "Araba Ray 1'e En Yakın Konumda · İki Ray Ayrı Gösterilmiştir · Şematik",
      8,
      { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, PW - 16, 40, DCOL.line, 0.8));

  const drawRail = (
    yRail: number,
    railTitle: string,
    locationNote: string,
    loadName: string,
    loadKg: number,
    color: string,
    designKg?: number
  ) => {
    // Satır kimliği solda ayrı bir şerittedir; çok tekerli düzende yük
    // etiketleriyle çakışmadan iki rayın hangi durumu anlattığı okunur.
    els.push(txt(16, yRail - 58, railTitle, 8.5, { fill: color, bold: true }));
    els.push(txt(16, yRail - 44, locationNote, 7.2, { fill: DCOL.muted }));
    els.push(
      txt(16, yRail - 30, `Her Teker: ${loadName} = ${kNofKg(loadKg)}`, 7.5, {
        fill: color,
        bold: true,
      })
    );
    if (designKg !== undefined) {
      els.push(
        txt(16, yRail - 17, `Tasarım: Pmaks,d = ${kNofKg(designKg)}`, 7.2, {
          fill: DCOL.muted,
        })
      );
    }

    // Başkiriş, tekerler, ray ve yol kirişi — yandan görünüşte teker dairedir.
    els.push({
      kind: "rect",
      x: xFirst - 24,
      y: yRail - 43,
      w: xLast - xFirst + 48,
      h: 22,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.2,
    });
    els.push(
      txt((xFirst + xLast) / 2, yRail - 29, "BAŞKİRİŞ", 6.8, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
    els.push({
      kind: "rect",
      x: xFirst - 38,
      y: yRail,
      w: xLast - xFirst + 76,
      h: 6,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    els.push({
      kind: "rect",
      x: xFirst - 46,
      y: yRail + 6,
      w: xLast - xFirst + 92,
      h: 10,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });

    for (let i = 0; i < count; i += 1) {
      const x = xs[i];
      // Her tekerin üstünde kendi sayısal yükü ve kendi oku vardır. Yükler bu
      // denge modelinde ray içinde eşit olsa da tekrar kasıtlıdır: okuyucu
      // teker kodundan yol kirişi üzerindeki tekil kuvvete doğrudan gider.
      els.push(
        txt(x, yRail - 64, kNofKg(loadKg), 6.8, {
          anchor: "middle",
          fill: color,
          bold: true,
          fixed: true,
        })
      );
      els.push(ln(x, yRail - 59, x, yRail - 28, color, 1.5));
      els.push(arrowHead(x, yRail - 25, "down", color, 7, 2.8));
      els.push({
        kind: "circle",
        cx: x,
        cy: yRail - 12,
        r: 12,
        fill: "#FFFFFF",
        stroke: DCOL.ink,
        strokeWidth: 1.3,
      });
      els.push({
        kind: "circle",
        cx: x,
        cy: yRail - 12,
        r: 2.5,
        fill: DCOL.paper,
        stroke: DCOL.ink,
        strokeWidth: 0.8,
      });
      // Harf-rakam teker göbeğinin üstüne binmesin: yazı merkezi göbekten
      // yukarı alınır, ancak hâlâ teker dairesinin içinde kalır.
      els.push(txt(x, yRail - 17, codes[i], 6.2, { anchor: "middle", fixed: true }));
    }
  };

  drawRail(
    130,
    "RAY 1 · YAKIN RAY",
    "Araba Bu Raya Yanaşır",
    "Pmaks",
    p.maxWheelLoadKg,
    DCOL.accent,
    p.designWheelLoadKg
  );
  drawRail(
    238,
    "RAY 2 · UZAK RAY",
    "Araba Karşı Uçtadır",
    "Pmin",
    p.minWheelLoadKg,
    DCOL.muted
  );

  // 6.1'deki ölçü zincirinin aynısı yalnız bir kez basılır; iki rayın
  // geometrisi eşit olduğundan ikinci kez yazmak bilgi eklemez.
  const yDim = 274;
  els.push(txt(16, yDim + 3, "Ölçüler mm · İki Rayda Aynıdır", 7.2, { fill: DCOL.muted }));
  for (let i = 1; i < count; i += 1) {
    dimH(els, xs[i - 1], xs[i], yDim, fmtN(gaps[i - 1] * 1000, 0), {
      size: 6.8,
      labelDy: -3,
    });
  }
  const wheelbaseM = Math.max(0, positions[count - 1] - positions[0]);
  dimH(els, xFirst, xLast, yDim + 31, `Dingil Mesafesi = ${mmOf(wheelbaseM * 1000)}`, {
    size: 7.5,
    labelDy: 12,
  });
  els.push(
    txt(
      16,
      337,
      `${count} Teker / Ray · A: Ön Köşe · B: Arka Köşe · Oklar Teker Başına Karakteristik Düşey Yüktür`,
      7.5,
      { fill: DCOL.muted }
    )
  );

  return fitDiagram(els, PW, 350);
}

// ------------------------------------------------------------- Boyuna kuvvetler

export interface LongitudinalForceParams {
  /** 6.1'de tanımlanan bir ray üzerindeki gerçek teker kodları. */
  codes: string[];
  /** Tekerlerin A1 ekseninden itibaren konumları [m]. */
  positionsM: number[];
  /** Tahrikli/frenli toplam teker adedi; konumları modelde tanımlı değildir. */
  drivenWheels: number;
  travelSpeedMs: number;
  accelerationMs2: number;
  accelTimeS: number;
  inertiaForceN: number;
  drivenWheelLoadN: number;
  designLongitudinalN: number;
  longitudinalPerRailN: number;
  longitudinalPerDrivenWheelN: number;
  /** Hesap hücresindeki belirleyen sınır açıklaması. */
  bound: string;
}

/**
 * Köprü hızlanma/frenleme kuvvetinin raya paralel aktarım şeması.
 *
 * FEM 1.001 Kitapçık 2 md. 2.2.3.1.1'e göre kuvvet tahrikli/frenli
 * tekerlerin rayla temas tabanında etkir ve bu tekerlerin düşey yükünün
 * 1/30...1/4 aralığıyla sınırlandırılır. Veri modeli tahrikli teker A/B
 * kodlarını değil yalnız ADEDİNİ taşıdığı için plandaki hiçbir teker yanlış
 * biçimde tahrikli diye işaretlenmez; temas ayrıntısı genel bir teker olarak
 * ayrıca gösterilir.
 */
export function longitudinalForceDiagram(p: LongitudinalForceParams): Diagram {
  const W = 720;
  const H = 414;
  const els: DiagramEl[] = [];
  const count = Math.max(1, p.codes.length, p.positionsM.length);
  const codes = Array.from({ length: count }, (_, i) => p.codes[i] ?? `T${i + 1}`);
  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = p.positionsM[i];
    const previous = positions[i - 1] ?? 0;
    positions.push(Number.isFinite(raw) ? Math.max(previous, raw) : previous);
  }
  const first = positions[0] ?? 0;
  const range = Math.max(0.001, (positions[count - 1] ?? first) - first);
  const x1 = 122;
  const x2 = 652;
  const xOf = (value: number, i: number) =>
    range > 0.001 ? x1 + ((value - first) / range) * (x2 - x1) : x1 + (i / Math.max(1, count - 1)) * (x2 - x1);
  const xs = positions.map(xOf);

  els.push(txt(16, 22, "BOYUNA YATAY KUVVETLER — RAYA PARALEL ETKİ", 11, { bold: true }));
  els.push(
    txt(16, 35, "Hızlanma Ve Frenleme · Tahrikli Teker–Ray Temasında · FEM 1.001 §2.2.3.1.1", 8, {
      fill: DCOL.muted,
    })
  );
  els.push(ln(16, 42, W - 16, 42, DCOL.line, 0.8));
  els.push(
    txt(
      16,
      57,
      `v = ${mOf(p.travelSpeedMs, 3)}/s · a = ${fmtN(p.accelerationMs2, 3)} m/s² · t = ${fmtN(p.accelTimeS, 2)} s`,
      7.8,
      { fill: DCOL.muted }
    )
  );

  const drawRailRow = (yRail: number, title: string) => {
    els.push({
      kind: "rect",
      x: x1 - 22,
      y: yRail - 43,
      w: x2 - x1 + 44,
      h: 17,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.1,
    });
    els.push(
      txt((x1 + x2) / 2, yRail - 31.5, title, 7.1, {
        anchor: "middle",
        fill: DCOL.muted,
        bold: true,
        fixed: true,
      })
    );
    els.push({
      kind: "rect",
      x: x1 - 34,
      y: yRail,
      w: x2 - x1 + 68,
      h: 6,
      fill: DCOL.line,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });
    for (let i = 0; i < count; i += 1) {
      const x = xs[i];
      els.push({ kind: "circle", cx: x, cy: yRail - 14, r: 11, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
      els.push({ kind: "circle", cx: x, cy: yRail - 14, r: 2.3, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 0.7 });
      els.push(txt(x, yRail - 11.8, codes[i], 5.8, { anchor: "middle", fixed: true }));
    }
    const yForce = yRail + 22;
    els.push(ln(x1 + 18, yForce, x2 - 18, yForce, DCOL.accent, 2));
    els.push(arrowHead(x1 + 14, yForce, "left", DCOL.accent, 9, 3.4));
    els.push(arrowHead(x2 - 14, yForce, "right", DCOL.accent, 9, 3.4));
    els.push(
      txt((x1 + x2) / 2, yForce - 5, `± Ht/2 = ${kNof(p.longitudinalPerRailN)}`, 8.3, {
        anchor: "middle",
        fill: DCOL.accent,
        bold: true,
        fixed: true,
      })
    );
  };

  drawRailRow(104, "RAY 1 · YÜRÜME EKSENİ");
  drawRailRow(184, "RAY 2 · YÜRÜME EKSENİ");
  els.push(
    txt(
      16,
      224,
      "Tahrikli Teker Konumları Köprü Yürütme Tahrik Düzenine Göredir; Şemada Teker Adedi Esas Alınmıştır.",
      7.2,
      { fill: DCOL.muted }
    )
  );

  // Alt sol: kuvvetin tahrikli teker tabanında raya paralel etkidiği temas ayrıntısı.
  els.push(ln(16, 237, W - 16, 237, DCOL.line, 0.8));
  els.push(txt(16, 254, "TAHRİKLİ TEKER TEMASI", 8.5, { bold: true }));
  els.push({ kind: "circle", cx: 148, cy: 314, r: 34, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.5 });
  els.push({ kind: "circle", cx: 148, cy: 314, r: 7, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1 });
  els.push({ kind: "rect", x: 56, y: 348, w: 236, h: 7, fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 1 });
  els.push(ln(76, 340, 220, 340, DCOL.accent, 2.2));
  els.push(arrowHead(72, 340, "left", DCOL.accent, 9, 3.5));
  els.push(arrowHead(224, 340, "right", DCOL.accent, 9, 3.5));
  els.push(
    txt(148, 331, `± Ht / Tahrikli Teker = ${kNof(p.longitudinalPerDrivenWheelN)}`, 8.3, {
      anchor: "middle",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(148, 370, `Tahrikli/Frenli Teker Adedi = ${fmtN(p.drivenWheels, 0)}`, 7.4, {
      anchor: "middle",
      fill: DCOL.muted,
    })
  );

  // Alt sağ: standarttaki aktarılabilir kuvvet bandı ve belirleyen değer.
  const bx = 344;
  els.push(txt(bx, 254, "FEM AKTARIM BANDI", 8.5, { bold: true }));
  els.push({ kind: "rect", x: bx, y: 268, w: 360, h: 110, rx: 2, fill: DCOL.paper, stroke: DCOL.line, strokeWidth: 0.8 });
  els.push(txt(bx + 14, 287, `Alt Sınır · Wt/30 = ${kNof(p.drivenWheelLoadN / 30)}`, 7.7));
  els.push(txt(bx + 14, 306, `Hesaplanan · H = m·a = ${kNof(p.inertiaForceN)}`, 7.7));
  els.push(txt(bx + 14, 325, `Üst Sınır · Wt/4 = ${kNof(p.drivenWheelLoadN / 4)}`, 7.7));
  els.push(ln(bx + 14, 336, bx + 346, 336, DCOL.line, 0.8));
  els.push(
    txt(bx + 14, 354, `Tasarım · Ht = ${kNof(p.designLongitudinalN)}`, 8.4, {
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt(bx + 14, 369, `Belirleyen: ${diagramTitleCase(p.bound || "Hesaplanan Atalet Kuvveti")}`, 7.2, {
      fill: DCOL.muted,
    })
  );

  els.push(
    txt(16, 402, "Oklar Her İki Yürütme Yönündeki Hızlanma Ve Frenleme Durumlarını Birlikte Gösterir.", 7.2, {
      fill: DCOL.muted,
    })
  );
  return fitDiagram(els, W, H);
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
    txt(16, 34, "FEM 1.001 Kitapçık 9, Md. 9.4.1 · Savrulma Açısı Abartılmıştır", 8, {
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
  // --- Ana kirişler --------------------------------------------------------
  // Ana kirişler iki RAY ARASINDA, açıklık boyunca uzanır; her biri bir köşe
  // teker grubunun ortasına oturur. Açıklık (tipik 20 m) dingil mesafesinden
  // (tipik 3–14 m) çok daha uzundur — bu şemada dingil mesafesi ölçü zinciri
  // okunabilsin diye büyük çizildiğinden açıklık ÖLÇEKLİ DEĞİLDİR ve teknik
  // resim kuralınca KIRIK İŞARETİYLE kısaltılmış gösterilir.
  const girderW = 26;
  const centreOf = (from: number, to: number) => {
    const slice = wheels.slice(from, to);
    const sum = slice.reduce((a, w) => a + w.distanceM, 0);
    return xOf(sum / Math.max(1, slice.length));
  };
  const xG1 = centreOf(0, perCorner);
  const xG2 = centreOf(perCorner, nWheels);
  const gyTop = yRail1 + carriageHalf;
  const gyBot = yRail2 - carriageHalf;
  const gyMid = (gyTop + gyBot) / 2;
  for (const xg of [xG1, xG2]) {
    els.push({
      kind: "rect",
      x: xg - girderW / 2,
      y: gyTop,
      w: girderW,
      h: gyBot - gyTop,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.2,
    });
    // Kırık (kesme) işareti — kirişin kısaltıldığını söyler
    els.push({
      kind: "rect",
      x: xg - girderW / 2 - 1,
      y: gyMid - 7,
      w: girderW + 2,
      h: 14,
      fill: "#FFFFFF",
      stroke: "none",
    });
    for (const dy of [-7, 1]) {
      els.push(
        ln(xg - girderW / 2 - 1, gyMid + dy + 6, xg + girderW / 2 + 1, gyMid + dy, DCOL.ink, 1.1)
      );
    }
  }
  // Yalnız SOLDAKİ kiriş etiketlenir: sağdakinin etiketi anlık kayma kutbu
  // etiketiyle aynı banda düşüyordu, iki kiriş de aynı elemandır.
  els.push(
    txt(xG1 - girderW / 2 - 8, gyTop + 26, "ANA KİRİŞLER (2 Adet)", 7.5, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );
  // Açıklık ölçüsü — kırık işaretiyle kısaltıldığı için değeri yazılır
  const xSpanDim = Math.min(xG1 - girderW / 2 - 58, xL - 34);
  els.push(ln(xSpanDim, gyTop, xSpanDim, gyBot, DCOL.muted, 0.8));
  els.push(ln(xSpanDim - 4, gyTop, xSpanDim + 4, gyTop, DCOL.muted, 0.8));
  els.push(ln(xSpanDim - 4, gyBot, xSpanDim + 4, gyBot, DCOL.muted, 0.8));
  els.push(arrowHead(xSpanDim, gyTop, "up", DCOL.muted));
  els.push(arrowHead(xSpanDim, gyBot, "down", DCOL.muted));
  els.push(
    txt(xSpanDim - 7, gyMid - 4, `Açıklık l = ${mOf(p.spanM)}`, 7.5, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );
  els.push(
    txt(xSpanDim - 7, gyMid + 7, "(Ölçekli Değil — Kısaltılmıştır)", 6.8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );
  // Başkiriş adı ayrı etiket olarak yazılmaz: kutu siluetten anlaşılıyor ve
  // teker kodlarıyla aynı bantta çakışıyordu.
  const xNote = xLast + carriagePad + 14;
  els.push(
    txt(xNote, yRail1 - 7, "RAY 1 — Araba Bu Raya Yanaşır (Yakın Ray)", 7.5, {
      fill: DCOL.muted,
    })
  );
  els.push(
    txt(xNote, yRail2 + 14, "RAY 2 (Uzak Ray) — Aynı Teker Düzeni", 7.5, {
      fill: DCOL.muted,
    })
  );

  // --- Savrulma açısı göstergesi (F.9.4.d) --------------------------------
  // Teker alanının SOLUNA, kuvvet oklarının ulaşmadığı boş köşeye konur:
  // gerçek α birkaç mrad olduğu için çizimde abartılır.
  const yAng = 62;
  const angLen = 78;
  const angDrop = 20;
  els.push(txt(16, yAng - 14, "Yürüme Yönü", 8, { fill: DCOL.muted }));
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
    txt(16, yAng + angDrop + 27, "Kesikli: Ray Doğrultusu", 6.8, { fill: DCOL.muted })
  );
  els.push(
    txt(16, yAng + angDrop + 36, "Kırmızı: Hareket Doğrultusu", 6.8, {
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
        `Raya Paralel Teğetsel Fx = ${kNof(wheels[0].longitudinalN, 2)} / Teker`,
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
    txt(xFirst - 34, yRail1 - 13, "Kılavuz Kuvveti (Vinç Toplamı)", 7, {
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
      txt(xPole + 11, yPole - 5, "Anlık Kayma Kutbu", 7.5, { fill: DCOL.accent })
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
  els.push(txt(16, yDim + 3, "Ölçüler mm", 7.5, { fill: DCOL.muted }));
  let lastDimX = -Infinity;
  for (let i = 1; i < wheels.length; i += 1) {
    const x1 = xOf(wheels[i - 1].distanceM);
    const x2 = xOf(wheels[i].distanceM);
    const gapMm = (wheels[i].distanceM - wheels[i - 1].distanceM) * 1000;
    if (x2 - x1 < 30 || x1 < lastDimX) continue;
    dimH(els, x1, x2, yDim, fmtN(gapMm, 0), { size: 7, labelDy: -3 });
    lastDimX = x2;
  }
  dimH(els, xFirst, xLast, yDim + 34, `Dingil Mesafesi = ${mmOf(maxD * 1000)}`, {
    size: 8,
    labelDy: 13,
  });
  els.push(
    txt(
      16,
      PH - 12,
      `${nWheels} Teker / Ray · Köşe Başına ${perCorner} · ` +
        `Kılavuz: ${p.guideMeans === "flange" ? "Teker Flanşı" : "Kılavuz Teker"} · ` +
        "Enine Ok Uzunlukları Kuvvetle Orantılıdır",
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
  /** Teker eksenlerinin kılavuz elemandan uzaklıkları [m] — yandan görünüş */
  positionsM: number[];
}

const SW = 700;
const SH = 545;

/**
 * Yol kirişine aktarılan BÜTÜN kuvvetler — İKİ PANEL.
 *
 * Her kuvvet, gerçekten göründüğü bakış yönünde ve kendi oku ile verilir:
 *
 *   ÜST PANEL · raylara dik  → düşey (Pmaks/Pmin), enine (Fy1/Fy2), kılavuz (S)
 *   ALT PANEL · ray ekseni   → boyuna (H), savrulma teğetseli (Fx), tampon
 *
 * Bakış yönü değiştiği için TEKER GÖSTERİMİ de değişir: üstte bandaj + flanş
 * (önden), altta daire (yandan). Tek panelde boyuna kuvvetleri ⊗ simgesiyle
 * anlatmak yerine kendi görünüşünde ok olarak vermek, kuvvet setini tabloya
 * bakmadan okunur kılar.
 */
export function loadSummaryDiagram(p: LoadSummaryParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "YOL KİRİŞİNE AKTARILAN KUVVETLER", 11, { bold: true }));
  els.push(
    txt(
      16,
      34,
      `${p.totalWheels} Teker · Her Köşede ${p.wheelsPerCorner} · Rayda ${p.wheelsPerSide} · ` +
        "Düşey Ve Enine Değerler TEKER BAŞINA · FEM 1.001",
      8,
      { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, SW - 16, 40, DCOL.line, 0.8));

  // ======================================================== ÜST PANEL
  els.push(txt(16, 58, "1 · RAYLARA DİK GÖRÜNÜŞ", 9, { bold: true }));
  els.push(
    txt(SW - 16, 58, "Düşey · Enine · Kılavuz Kuvvetleri", 8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  const xL = 196;
  const xR = SW - 196;
  const c = drawCrane(els, xL, xR, 104, p.wheelsPerSide, [
    "RAY 1 — Araba Bu Raya Yanaşır",
    "RAY 2",
  ]);

  // Araba + yük
  const xTrolley = xL + 88;
  els.push({
    kind: "rect",
    x: xTrolley - 34,
    y: c.yGirderTop - 28,
    w: 68,
    h: 22,
    rx: 2,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  els.push(txt(xTrolley, c.yGirderTop - 13, "ARABA", 7.5, { anchor: "middle" }));
  els.push(
    ln(xTrolley + 28, c.yGirderTop - 28, xTrolley + 28, c.yWheel - 12, DCOL.faint, 0.9, "2,2")
  );
  els.push({
    kind: "circle",
    cx: xTrolley + 28,
    cy: c.yWheel - 4,
    r: 7,
    fill: "#FBEDEC",
    stroke: DCOL.accent,
    strokeWidth: 1.2,
  });

  // Düşey kuvvetler
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
      `φ2 = ${fmtN(p.phi2, 3)} Dahil · ${kgOf(p.designWheelLoadKg)}`,
      `Karakteristik Pmaks = ${kNofKg(p.maxWheelLoadKg)}`,
    ],
    DCOL.accent
  );
  vertical(
    xR,
    [
      `Pmin = ${kNofKg(p.minWheelLoadKg)}`,
      `(${kgOf(p.minWheelLoadKg)}) Araba Karşı Uçta`,
    ],
    DCOL.muted
  );

  // Kılavuz kuvveti — flanş temasında
  const yGuide = c.yRail - 4;
  els.push(ln(xL - 92, yGuide, xL - c.wheelHalfWidth - 6, yGuide, DCOL.accent, 2.4));
  els.push(
    arrowHead(xL - c.wheelHalfWidth - 2, yGuide, "right", DCOL.accent, 9, 3.6)
  );
  els.push(
    txt(xL - 98, yGuide + 3, `S = ${kNof(p.guideForceN)}`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );

  // Enine kuvvetler — ray kotunda
  const yLat = c.yRunwayTop + 7;
  els.push(ln(xL - 92, yLat, xL - 22, yLat, DCOL.accent, 2));
  els.push(arrowHead(xL - 18, yLat, "right", DCOL.accent, 8, 3.2));
  els.push(
    txt(xL - 98, yLat + 3, `Fy1 = ${kNof(p.lateralNearN)}`, 9, {
      anchor: "end",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(ln(xR + 22, yLat, xR + 92, yLat, DCOL.muted, 1.8));
  els.push(arrowHead(xR + 96, yLat, "right", DCOL.muted, 8, 3.2));
  els.push(
    txt(xR + 98, yLat + 3, `Fy2 = ${kNof(p.lateralFarN)}`, 9, { fill: DCOL.muted })
  );

  // ======================================================== ALT PANEL
  const yPanel2 = yV0 + 82;
  els.push(ln(16, yPanel2, SW - 16, yPanel2, DCOL.line, 0.8));
  els.push(txt(16, yPanel2 + 20, "2 · RAY EKSENİ BOYUNCA", 9, { bold: true }));
  els.push(
    txt(SW - 16, yPanel2 + 20, "Boyuna Kuvvetler · Aynı Vinç, Yandan", 8, {
      anchor: "end",
      fill: DCOL.muted,
    })
  );

  const yRailB = yPanel2 + 106;
  const wheelRB = 12;
  const xB1 = 150;
  const xB2 = SW - 150;
  const positions = p.positionsM.length > 0 ? p.positionsM : [0];
  const maxPos = Math.max(...positions, 0.001);
  const xB = (d: number) => xB1 + (d / maxPos) * (xB2 - xB1);

  // Başkiriş (yandan) + tekerler DAİRE olarak — bu bakışta dönme ekseni
  // görüşe diktir, dolayısıyla tekerin yuvarlak yüzü görünür.
  els.push({
    kind: "rect",
    x: xB1 - 26,
    y: yRailB - 2 * wheelRB - 26,
    w: xB2 - xB1 + 52,
    h: 24,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.2,
  });
  els.push(
    txt((xB1 + xB2) / 2, yRailB - 2 * wheelRB - 10, "BAŞKİRİŞ", 7.5, {
      anchor: "middle",
      fill: DCOL.muted,
    })
  );
  for (const d of positions) {
    const x = xB(d);
    els.push({
      kind: "circle",
      cx: x,
      cy: yRailB - wheelRB,
      r: wheelRB,
      fill: "#FFFFFF",
      stroke: DCOL.ink,
      strokeWidth: 1.3,
    });
    els.push({
      kind: "circle",
      cx: x,
      cy: yRailB - wheelRB,
      r: 3,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 0.9,
    });
  }
  // Ray + yol kirişi
  els.push({
    kind: "rect",
    x: 40,
    y: yRailB,
    w: SW - 80,
    h: 7,
    fill: DCOL.line,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  els.push({
    kind: "rect",
    x: 40,
    y: yRailB + 7,
    w: SW - 80,
    h: 13,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1.1,
  });
  for (let x = 46; x < SW - 40; x += 12) {
    els.push(ln(x, yRailB + 20, x - 6, yRailB + 28, DCOL.muted, 0.6));
  }

  // Boyuna kuvvet: tahrik ve frenleme — raya paralel, iki yönlü
  const yH = yRailB - 2 * wheelRB - 40;
  els.push(ln(xB1 - 100, yH, xB1 - 34, yH, DCOL.accent, 2.2));
  els.push(arrowHead(xB1 - 104, yH, "left", DCOL.accent, 9, 3.4));
  els.push(ln(xB2 + 34, yH, xB2 + 100, yH, DCOL.accent, 2.2));
  els.push(arrowHead(xB2 + 104, yH, "right", DCOL.accent, 9, 3.4));
  els.push(
    txt((xB1 + xB2) / 2, yH + 3, `H = ${kNof(p.driveLongitudinalN)} / Tahrikli Teker`, 9, {
      anchor: "middle",
      fill: DCOL.accent,
      bold: true,
    })
  );
  els.push(
    txt((xB1 + xB2) / 2, yH - 10, "Tahrik Ve Frenleme", 7.5, {
      anchor: "middle",
      fill: DCOL.muted,
    })
  );

  // Tampon — yolun ucunda
  if (p.bufferForceKn > 0) {
    const xBuf = SW - 44;
    els.push({
      kind: "rect",
      x: xBuf - 16,
      y: yRailB - 2 * wheelRB - 4,
      w: 16,
      h: 20,
      fill: DCOL.paper,
      stroke: DCOL.ink,
      strokeWidth: 1.2,
    });
    for (let i = 0; i < 3; i += 1) {
      els.push(
        ln(xBuf - 16, yRailB - 2 * wheelRB + i * 6, xBuf, yRailB - 2 * wheelRB + 3 + i * 6, DCOL.muted, 0.8)
      );
    }
    els.push(
      txt(xBuf - 8, yRailB - 2 * wheelRB - 12, "Tampon", 7, {
        anchor: "middle",
        fill: DCOL.muted,
      })
    );
    els.push(
      txt(xBuf - 24, yRailB - 2 * wheelRB + 8, `${fmtN(p.bufferForceKn, 1)} kN`, 8.5, {
        anchor: "end",
        fill: DCOL.ink,
        bold: true,
      })
    );
  }
  if (Math.abs(p.skewLongitudinalN) > 1) {
    // Savrulma teğetseli her tekerde doğar; teker araları ok çizilemeyecek
    // kadar dar olduğundan tek satırda, ok simgesiyle verilir.
    const yFx = yRailB + 44;
    els.push(ln((xB1 + xB2) / 2 - 116, yFx, (xB1 + xB2) / 2 - 96, yFx, DCOL.muted, 1.4));
    els.push(arrowHead((xB1 + xB2) / 2 - 93, yFx, "right", DCOL.muted, 7, 2.8));
    els.push(
      txt(
        (xB1 + xB2) / 2 - 86,
        yFx + 3,
        `Savrulma Fx = ${kNof(p.skewLongitudinalN, 2)} / Teker (Her Tekerde, Raya Paralel)`,
        8,
        { fill: DCOL.muted }
      )
    );
  }
  els.push(txt(16, yRailB + 62, "Yürüme Yönü", 7.5, { fill: DCOL.muted }));
  els.push(ln(80, yRailB + 59, 116, yRailB + 59, DCOL.muted, 1));
  els.push(arrowHead(119, yRailB + 59, "right", DCOL.muted, 8, 3));

  // ======================================================== Lejant
  els.push(ln(16, SH - 40, SW - 16, SH - 40, DCOL.line, 0.8));
  els.push(
    txt(
      16,
      SH - 26,
      "S: Kılavuz Kuvveti (VİNÇ TOPLAMI, Flanş Temasında)   ·   Fy1 · Fy2: Enine Teker Kuvveti   ·   " +
        "H: Tahrik/Fren Boyuna Kuvveti   ·   Fx: Savrulma Teğetsel Kuvveti",
      7.5,
      { fill: DCOL.muted }
    )
  );
  els.push(
    txt(
      16,
      SH - 14,
      "Kuvvetler Karakteristiktir; Kısmi Güvenlik Katsayıları Yol Kirişi Tasarımında Uygulanır. " +
        "Araba Karşı Uca Gittiğinde Raylar Yer Değiştirir — Her İki Ray Da Fy1 İle Boyutlandırılır.",
      7.5,
      { fill: DCOL.muted }
    )
  );

  return fitDiagram(els, SW, SH);
}
