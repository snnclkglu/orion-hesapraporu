// Kaldırma kirişi (§4.6) parametrik şemaları — üç çizim:
//
//   1) liftingBeamDiagram        — kirişin görünüşü: iki uçtan askı, iki
//                                  noktadan yük, x · y · z ölçü zinciri ve
//                                  Kesit 1 / Kesit 2 kesit çizgileri
//   2) liftingBeamMomentDiagram  — eğilme momenti diyagramı (motorun KENDİ
//                                  çözümünün düğümlerinden çizilir)
//   3) liftingBeamSectionsDiagram— iki kutu kesitin yan yana çizimi
//
// Üçü de saf veri modeli döndürür (React yok); web ve PDF aynı nesneyi çizer.
//
// ÖLÇEK GİRDİDEN GELİR: kullanıcı x/y/z ya da sac ölçülerini değiştirdiğinde
// şema kendini yeniden düzenler — sabit bir "temsilî resim" değildir.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, dimV, fitDiagram, fmtN, ln, loadArrow, txt,
} from "./model";

// --------------------------------------------------------------- 1) Görünüş

export interface LiftingBeamParams {
  /** Ölçü zinciri [mm] */
  xMm: number;
  yMm: number;
  zMm: number;
  /** Askı başına yük [kg] */
  loadPerHookKg: number;
  /** Mesnet tepkileri [kg] */
  reactionAKg?: number;
  reactionBKg?: number;
  /** Kesit 1 / Kesit 2 yan sac yüksekliği [mm] — kiriş boyu ölçekli çizilir */
  section1HeightMm?: number;
  section2HeightMm?: number;
  /** Kanca bloğu makara adedi (bilgi amaçlı; askı sembolünün yoğunluğu) */
  sheaveCount?: number;
}

const W = 700;
const H = 330;

export function liftingBeamDiagram(p: LiftingBeamParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "KALDIRMA KİRİŞİ — YÜKLEME ŞEMASI", "Parametrik Çizim · Ölçüler mm");

  const x = Math.max(0, p.xMm);
  const y = Math.max(0, p.yMm);
  const z = Math.max(0, p.zMm);
  const spanMm = x + y + z;
  if (!(spanMm > 0)) {
    els.push(txt(W / 2, H / 2, "Kiriş Ölçüleri (x · y · z) Eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  // Yerleşim: kiriş yatay şeridi ekranın üst yarısında, askılar aşağı sarkar.
  const left = 86;
  const right = W - 86;
  const s = (right - left) / spanMm;          // px/mm
  const yBeamTop = 108;
  // Kiriş yüksekliği ŞEMATİKTİR: gerçek kesit yüksekliği kiriş boyunun yanında
  // görünmezdi (980 mm ↔ 4800 mm). Yine de girdiye BAĞLIDIR: iki kesitin
  // yüksekliği farklıysa fark şemada da görünür.
  const h1 = Math.max(14, Math.min(30, (p.section1HeightMm ?? 0) / 40));
  const h2 = Math.max(14, Math.min(34, (p.section2HeightMm ?? 0) / 40));
  const beamH = Math.max(h1, h2);
  const yBeamBot = yBeamTop + beamH;

  const xA = left;
  const xB = right;
  const x1 = left + x * s;
  const x2 = left + (x + y) * s;

  // --- Kiriş gövdesi. Kesit 2 bölgeleri (mesnet–yük arası) daha kalın çizilir:
  // hesapta da orada kalın kesit kullanılır ve resim bunu söylemelidir.
  const body = (xa: number, xb: number, h: number, fill: string): DiagramEl => ({
    kind: "rect", x: xa, y: yBeamBot - h, w: Math.max(1, xb - xa), h,
    fill, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  // Zeminler AYRIŞIR: mesnet–yük arası (Kesit 2) koyu kağıt, yükler arası
  // (Kesit 1) açık kağıt. İki kesitin yan sac kalınlığı çoğu zaman farklıdır
  // ama yükseklikleri aynıdır — fark yalnız renkten okunur.
  els.push(body(xA, x1, h2, DCOL.paper));
  els.push(body(x1, x2, h1, "#FAF8F7"));
  els.push(body(x2, xB, h2, DCOL.paper));

  // --- Mesnetler (askı): yukarı kırmızı ok + üçgen
  const support = (sx: number, label: string, force?: number) => {
    loadArrow(els, sx, yBeamTop + 2, yBeamTop - 52);
    els.push({
      kind: "polygon",
      points: [[sx, yBeamTop], [sx - 7, yBeamTop - 12], [sx + 7, yBeamTop - 12]],
      fill: "#FFFFFF", stroke: DCOL.accent, strokeWidth: 1,
    });
    els.push(
      txt(sx, yBeamTop - 58, force !== undefined ? `${label} = ${fmtN(force, 0)} kg` : label, 9, {
        anchor: "middle", fill: DCOL.accent, leaderTo: [sx, yBeamTop - 50],
      })
    );
  };
  support(xA, "R_A", p.reactionAKg);
  support(xB, "R_B", p.reactionBKg);

  // --- Askı noktaları (kanca blokları): aşağı kırmızı ok
  const hook = (hx: number, label: string) => {
    // Kanca sapı ve bloğu — şematik
    els.push(ln(hx, yBeamBot, hx, yBeamBot + 26, DCOL.ink, 1.2));
    els.push({
      kind: "rect", x: hx - 13, y: yBeamBot + 26, w: 26, h: 16,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push({ kind: "circle", cx: hx, cy: yBeamBot + 34, r: 4, stroke: DCOL.ink, strokeWidth: 0.8, fill: "none" });
    loadArrow(els, hx, yBeamBot + 44, yBeamBot + 86);
    els.push(
      txt(hx, yBeamBot + 100, `${label} = ${fmtN(p.loadPerHookKg, 0)} kg`, 9, {
        anchor: "middle", fill: DCOL.accent, leaderTo: [hx, yBeamBot + 86],
      })
    );
  };
  hook(x1, "F₁");
  hook(x2, "F₂");

  // --- Kesit çizgileri: Kesit 1 açıklık ortası, Kesit 2 mesnet–yük arası
  const cut = (cx: number, label: string) => {
    els.push(ln(cx, yBeamTop - 26, cx, yBeamBot + 20, DCOL.muted, 0.9, "5,3"));
    els.push(txt(cx, yBeamTop - 32, label, 9.5, { anchor: "middle", bold: true, fill: DCOL.ink }));
  };
  cut((x1 + x2) / 2, "Kesit 1");
  // Kesit 2, mesnetle ilk yük arasının ortasıdır; x = 0 ise sağ taraftaki
  // bölgeye düşer (asimetrik askıda ikisinden DOLU olanı gösterilir).
  const cut2X = x > 0 ? (xA + x1) / 2 : (x2 + xB) / 2;
  cut(cut2X, "Kesit 2");

  // --- Ölçü zinciri (kirişin altında)
  const yDim = yBeamBot + 130;
  if (x > 0) dimH(els, xA, x1, yDim, `x = ${fmtN(x)}`);
  if (y > 0) dimH(els, x1, x2, yDim, `y = ${fmtN(y)}`);
  if (z > 0) dimH(els, x2, xB, yDim, `z = ${fmtN(z)}`);
  dimH(els, xA, xB, yDim + 30, `L = x + y + z = ${fmtN(spanMm)}`, { size: 9 });

  return fitDiagram(els, W, H);
}

// ------------------------------------------------------- 2) Moment diyagramı

export interface LiftingBeamMomentParams {
  /** Motorun kiriş çözümünden gelen düğümler (x [cm], M [kg·cm]) */
  stations: { xCm: number; momentKgCm: number }[];
  spanMm: number;
  /** Kesit konumları [mm] — diyagramda işaretlenir */
  load1Mm: number;
  load2Mm: number;
  maxMomentKgCm: number;
  section2MomentKgCm: number;
}

const MW = 700;
const MH = 250;

export function liftingBeamMomentDiagram(p: LiftingBeamMomentParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "KALDIRMA KİRİŞİ — MOMENT DİYAGRAMI", "M(x) [kg·cm] · Pozitif Moment Sarkma");

  const pts = (p.stations ?? []).filter(
    (s) => Number.isFinite(s.xCm) && Number.isFinite(s.momentKgCm)
  );
  const spanMm = Math.max(0, p.spanMm);
  const peak = Math.max(...pts.map((s) => Math.abs(s.momentKgCm)), 0);
  if (pts.length < 2 || !(spanMm > 0) || !(peak > 0)) {
    els.push(txt(MW / 2, MH / 2, "Moment Diyagramı İçin Kiriş Ölçüleri Gerekli", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, MW, MH);
  }

  const left = 76;
  const right = MW - 60;
  const yAxis = 92;
  const depth = 108;                     // moment eğrisinin en derin noktası [px]
  const sx = (right - left) / spanMm;
  const sy = depth / peak;

  // Taban ekseni (kiriş)
  els.push(ln(left, yAxis, right, yAxis, DCOL.ink, 1.4));
  els.push(txt(left - 8, yAxis + 4, "0", 8.5, { anchor: "end", fill: DCOL.muted, fixed: true }));

  // MOMENT AŞAĞI ÇİZİLİR (sarkma yönü): eğri kirişin altında kalır ve şemayla
  // aynı yönü gösterir. Dolgu, alanın kendisini okunur kılar.
  const toPx = (s: { xCm: number; momentKgCm: number }) => ({
    x: left + s.xCm * 10 * sx,
    y: yAxis + s.momentKgCm * sy,
  });
  const path = pts.map(toPx);
  const d =
    `M ${left} ${yAxis} ` +
    path.map((q) => `L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") +
    ` L ${right} ${yAxis} Z`;
  els.push({ kind: "path", d, fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.4 });

  // Tepe değeri
  const peakStation = pts.reduce((a, b) =>
    Math.abs(b.momentKgCm) > Math.abs(a.momentKgCm) ? b : a
  );
  const peakPx = toPx(peakStation);
  els.push(ln(peakPx.x, yAxis, peakPx.x, peakPx.y, DCOL.accent, 0.8, "3,3"));
  els.push({ kind: "circle", cx: peakPx.x, cy: peakPx.y, r: 3, fill: DCOL.accent });
  els.push(
    txt(peakPx.x, peakPx.y + 16, `M_maks = ${fmtN(p.maxMomentKgCm, 0)} kg·cm`, 9, {
      anchor: "middle", fill: DCOL.accent, leaderTo: [peakPx.x, peakPx.y],
    })
  );

  // Yük noktaları ve Kesit 2 momenti
  const markLoad = (mm: number, label: string) => {
    if (!(mm > 0) || mm > spanMm) return;
    const px = left + mm * sx;
    els.push(ln(px, yAxis - 22, px, yAxis + depth + 8, DCOL.faint, 0.7, "4,3"));
    els.push(txt(px, yAxis - 26, label, 8.5, { anchor: "middle", fill: DCOL.muted }));
  };
  markLoad(p.load1Mm, "F₁");
  markLoad(p.load2Mm, "F₂");
  if (p.section2MomentKgCm > 0) {
    els.push(
      txt(left + p.load1Mm * sx + 6, yAxis + p.section2MomentKgCm * sy - 8,
        `M₂ = ${fmtN(p.section2MomentKgCm, 0)}`, 8.5, { fill: DCOL.ink })
    );
  }

  // Açıklık ölçüsü
  dimH(els, left, right, yAxis + depth + 42, `L = ${fmtN(spanMm)} mm`, { size: 9 });

  return fitDiagram(els, MW, MH);
}

// --------------------------------------------------------- 3) İki kutu kesit

/** Bir kaldırma kirişi kesitinin sac ölçüleri [mm]. */
export interface LiftingBeamSection {
  title: string;
  topThkMm: number; topWidthMm: number;
  webThkMm: number; webHeightMm: number;
  botThkMm: number; botWidthMm: number;
  /** Bölüm hesabından gelen kesit modülü ve yan sac alanı (altyazı) */
  sectionModulusCm3?: number;
  webAreaCm2?: number;
}

const SW = 700;
const SH = 340;

/**
 * İki kesit YAN YANA ve AYNI ÖLÇEKTE çizilir. Ayrı ölçek kullanılsaydı 10 mm ve
 * 60 mm yan sac ekranda aynı kalınlıkta görünür, resmin söylediği tek şey
 * (Kesit 2 daha kalındır) kaybolurdu.
 */
export function liftingBeamSectionsDiagram(sections: LiftingBeamSection[]): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "KALDIRMA KİRİŞİ — KESİTLER", "Parametrik Çizim · Ölçüler mm · İki Kesit AYNI Ölçekte");

  const valid = sections.filter(
    (s) => s.topThkMm + s.webHeightMm + s.botThkMm > 0 && Math.max(s.topWidthMm, s.botWidthMm) > 0
  );
  if (valid.length === 0) {
    els.push(txt(SW / 2, SH / 2, "Kesit Girdileri Eksik Veya Geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, SW, SH);
  }

  const maxH = Math.max(...valid.map((s) => s.topThkMm + s.webHeightMm + s.botThkMm));
  const maxB = Math.max(...valid.map((s) => Math.max(s.topWidthMm, s.botWidthMm)));
  const cellW = SW / valid.length;
  const drawW = Math.min(cellW - 150, 220);
  const drawH = 190;
  const s = Math.min(drawW / maxB, drawH / maxH);
  // Kesitler ALTTAN hizalanır (ortak taban) ama BAŞLIK en yüksek kesitin de
  // üstünde durmalıdır: kesitlerin biri diğerinden yüksekse başlık onun genişlik
  // ölçüsünün altında kalıyor ve resim "hangi kesit" sorusunu cevaplayamıyordu.
  const yBase = 92 + drawH;
  const titleY = yBase - maxH * s - 34;

  valid.forEach((sec, i) => {
    const cx = cellW * (i + 0.5);
    const totalH = sec.topThkMm + sec.webHeightMm + sec.botThkMm;
    const yB = yBase;                            // ortak taban (kesit alt kenarı)
    const yBotTop = yB - sec.botThkMm * s;
    const yWebTop = yBotTop - sec.webHeightMm * s;
    const yTop = yWebTop - sec.topThkMm * s;

    const plate = (x: number, y: number, w: number, h: number): DiagramEl => ({
      kind: "rect", x, y, w, h,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
    });
    if (sec.botThkMm > 0 && sec.botWidthMm > 0) {
      els.push(plate(cx - (sec.botWidthMm * s) / 2, yBotTop, sec.botWidthMm * s, sec.botThkMm * s));
    }
    if (sec.topThkMm > 0 && sec.topWidthMm > 0) {
      els.push(plate(cx - (sec.topWidthMm * s) / 2, yTop, sec.topWidthMm * s, sec.topThkMm * s));
    }
    // İki yan sac: kutunun dış kenarlarına oturur (üst/alt sacın uçlarında)
    if (sec.webThkMm > 0 && sec.webHeightMm > 0) {
      const innerW = Math.max(sec.topWidthMm, sec.botWidthMm);
      const wl = cx - (innerW * s) / 2;
      const wr = cx + (innerW * s) / 2 - sec.webThkMm * s;
      els.push(plate(wl, yWebTop, sec.webThkMm * s, sec.webHeightMm * s));
      els.push(plate(wr, yWebTop, sec.webThkMm * s, sec.webHeightMm * s));
    }

    // Başlık
    els.push(txt(cx, titleY, sec.title, 10.5, { anchor: "middle", bold: true, fill: DCOL.accent, fixed: true }));

    // Ölçüler: genişlik (üstte), yükseklik (sağda), yan sac kalınlığı (solda)
    const bw = Math.max(sec.topWidthMm, sec.botWidthMm);
    dimH(els, cx - (bw * s) / 2, cx + (bw * s) / 2, yTop - 14, `b = ${fmtN(bw)}`, { size: 8.5 });
    dimV(els, cx + (bw * s) / 2 + 22, yTop, yB, `h = ${fmtN(totalH)}`, { size: 8.5 });
    els.push(
      txt(cx - (bw * s) / 2 - 8, yWebTop + (sec.webHeightMm * s) / 2, `t_y = ${fmtN(sec.webThkMm)}`, 8.5, {
        anchor: "end", fill: DCOL.ink,
      })
    );
    els.push(
      txt(cx - (bw * s) / 2 - 8, yTop + (sec.topThkMm * s) / 2 - 2, `t_ü = ${fmtN(sec.topThkMm)}`, 8.5, {
        anchor: "end", fill: DCOL.ink,
      })
    );
    els.push(
      txt(cx - (bw * s) / 2 - 8, yBotTop + (sec.botThkMm * s) / 2 + 4, `t_a = ${fmtN(sec.botThkMm)}`, 8.5, {
        anchor: "end", fill: DCOL.ink,
      })
    );

    // Altyazı: hesabın kullandığı iki büyüklük
    const notes: string[] = [];
    if (sec.sectionModulusCm3 !== undefined && Number.isFinite(sec.sectionModulusCm3)) {
      notes.push(`w = ${fmtN(sec.sectionModulusCm3, 0)} cm³`);
    }
    if (sec.webAreaCm2 !== undefined && Number.isFinite(sec.webAreaCm2)) {
      notes.push(`A_y = ${fmtN(sec.webAreaCm2, 0)} cm²`);
    }
    if (notes.length > 0) {
      els.push(txt(cx, yB + 34, notes.join("  ·  "), 9, { anchor: "middle", fill: DCOL.muted, fixed: true }));
    }
  });

  return fitDiagram(els, SW, SH);
}
