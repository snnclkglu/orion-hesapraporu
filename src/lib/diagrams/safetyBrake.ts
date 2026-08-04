// Tambur emniyet freni — parametrik montaj ve ölçü şeması (2.8 bölümü).
//
// TEK GÖRÜNÜŞ: yerleşim ile ölçüler aynı parçanın üstünde gösterilir. İkisini
// ayrı çizmek aynı çemberi iki kez basmak olurdu; atölye de tek bir montaj
// görünüşü okur.
//
//   · Flanş (fren diski) ve tambur gövdesi GERÇEK oranda,
//   · katalogdan çıkan minimum flanş çapı kesikli çember olarak — yetersizse
//     seçilen flanşın DIŞINDA kalır, hata tek bakışta görünür,
//   · seçilen yerleşim düzenine göre kaliperler açısal konumlarında,
//   · sağda sayısal özet ve sonuç.
//
// Ölçüler mm.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, caption, fitDiagram, fmtN, ln, txt,
} from "./model";

export interface SafetyBrakeParams {
  /** Seçilen flanş (fren diski) dış çapı [mm] */
  flangeDiaMm: number;
  /** Katalogdan çıkan en küçük flanş dış çapı [mm] */
  minFlangeDiaMm: number;
  /** Tambur gövde çapı [mm] */
  drumDiaMm: number;
  /** Kaliper adedi (yerleşim düzeninden) */
  brakeCount: number;
  /** Yerleşim düzeni etiketi */
  arrangement?: string;
  /** Katalog modeli (SHI …) */
  model?: string;
  /** Flanş kalınlığı alt sınırı [mm] */
  minThicknessMm?: number;
  /** Bir kaliperin frenleme momenti [Nm] */
  torqueEachNm?: number;
  /** Toplam frenleme momenti [Nm] */
  totalTorqueNm?: number;
  /** Tamburda gereken (emniyetli) moment [Nm] */
  demandTorqueNm?: number;
}

const W = 700;
const H = 400;
const GREEN = "#1F8A5B";

/**
 * Yerleşim düzenine göre kaliperlerin açısal konumu [derece].
 * 0° sağ, 90° yukarı. Atölye montaj çizimindeki altı standart düzenle eşleşir:
 * tek fren alttan, çift fren karşılıklı, dört fren çapraz.
 */
function calliperAngles(count: number): number[] {
  switch (count) {
    case 1:
      return [215];
    case 2:
      return [215, 325];
    case 4:
      return [215, 325, 145, 35];
    default:
      return [215];
  }
}

/** Flanşın kenarına oturan kaliper gövdesi + konsol bağlantısı. */
function pushCalliper(
  els: DiagramEl[],
  cx: number, cy: number, rFlange: number, angleDeg: number, label: string
) {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = -Math.sin(a); // SVG'de y aşağı doğru büyür
  const bodyR = rFlange - 4;
  const bx = cx + ux * bodyR;
  const by = cy + uy * bodyR;
  const w = 30;
  const h = 24;
  const rot = (dx: number, dy: number): [number, number] => [
    bx + dx * ux - dy * uy,
    by + dx * uy + dy * ux,
  ];
  els.push({
    kind: "polygon",
    points: [rot(-w / 2, -h / 2), rot(w / 2, -h / 2), rot(w / 2, h / 2), rot(-w / 2, h / 2)],
    fill: "#FBEDEC", stroke: DCOL.accent, strokeWidth: 1.3,
  });
  // Konsol: kaliperden dışa doğru kısa ayak
  const [ox, oy] = rot(w / 2 + 14, 0);
  els.push(ln(bx + ux * (w / 2), by + uy * (w / 2), ox, oy, DCOL.muted, 1.1));
  els.push(
    txt(ox + ux * 5, oy + uy * 5 + 3, label, 7.5, {
      anchor: ux < -0.2 ? "end" : ux > 0.2 ? "start" : "middle",
      fill: DCOL.accent, bold: true,
    })
  );
}

export function safetyBrakeDiagram(p: SafetyBrakeParams): Diagram {
  const els: DiagramEl[] = [];
  caption(
    els,
    "EMNİYET FRENİ — TAMBUR MONTAJI VE ÖLÇÜLER",
    [p.model, p.arrangement].filter(Boolean).join(" · ") || "ölçüler mm",
  );

  const { flangeDiaMm: dF, minFlangeDiaMm: dMin, drumDiaMm: dD } = p;
  if (!(dF > 0) || !(dD > 0) || !Number.isFinite(dMin)) {
    els.push(txt(W / 2, H / 2, "Flanş / tambur ölçüleri hesaplanamadı", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  const ok = dF >= dMin;
  const cx = 208;
  const cy = 214;
  const rMax = 122;
  // Ölçek en büyük çapa göre: yetersiz flanşta minimum çember dışarı taşar,
  // ölçek onu da kapsamalı ki kırpılmasın.
  const s = rMax / (Math.max(dF, dMin, dD) / 2);
  const rF = (dF / 2) * s;
  const rMinReq = (dMin / 2) * s;
  const rD = (dD / 2) * s;

  // Eksen çizgileri
  const axis = rMax + 26;
  els.push(ln(cx - axis, cy, cx + axis, cy, DCOL.faint, 0.7, "9,3,2,3"));
  els.push(ln(cx, cy - axis, cx, cy + axis, DCOL.faint, 0.7, "9,3,2,3"));

  // Flanş → tambur → minimum çember (üstte kalsın diye en son)
  els.push({ kind: "circle", cx, cy, r: rF, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.5 });
  els.push({ kind: "circle", cx, cy, r: rD, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
  els.push({
    kind: "circle", cx, cy, r: rMinReq, fill: "none",
    stroke: ok ? DCOL.muted : DCOL.accent, strokeWidth: 1.2, dash: "6,3",
  });

  // Kaliperler
  const angles = calliperAngles(p.brakeCount);
  angles.forEach((deg, i) => pushCalliper(els, cx, cy, rF, deg, `F${i + 1}`));

  // Yarıçap ölçü okları — üç farklı açıda, birbirine girmesin
  const radial = (r: number, deg: number, label: string, color: string) => {
    const a = (deg * Math.PI) / 180;
    const ex = cx + Math.cos(a) * r;
    const ey = cy - Math.sin(a) * r;
    els.push(ln(cx, cy, ex, ey, color, 0.9));
    els.push(arrowHead(ex, ey, Math.cos(a) >= 0 ? "right" : "left", color, 6, 2.4));
    els.push(
      txt(cx + Math.cos(a) * (r + 10), cy - Math.sin(a) * (r + 10) + 3, label, 7.5, {
        anchor: Math.cos(a) >= 0 ? "start" : "end", fill: color,
      })
    );
  };
  radial(rD, 118, `Ø${fmtN(dD)}`, DCOL.muted);
  radial(rMinReq, 62, `Ø${fmtN(dMin)} min.`, ok ? DCOL.muted : DCOL.accent);
  radial(rF, 8, `Ø${fmtN(dF)}`, DCOL.ink);

  // --- Sağ sütun: sayısal özet -------------------------------------------
  const lx = 400;
  const rx = W - 18;
  els.push(ln(lx - 16, 62, lx - 16, 330, DCOL.line, 0.8));
  els.push(txt(lx, 62, "SEÇİM ÖZETİ", 9, { fill: DCOL.accent, bold: true }));
  let ly = 82;
  const row = (k: string, v: string, color = DCOL.ink, bold = false) => {
    els.push(txt(lx, ly, k, 7.5, { fill: DCOL.muted }));
    els.push(txt(rx, ly, v, 8, { anchor: "end", fill: color, bold }));
    ly += 15;
  };
  if (p.model) row("Fren modeli", p.model, DCOL.ink, true);
  row("Kaliper adedi", `${angles.length}`);
  row("Tambur çapı", `Ø${fmtN(dD)} mm`);
  row("Minimum flanş dış çapı", `Ø${fmtN(dMin)} mm`);
  row("Seçilen flanş dış çapı", `Ø${fmtN(dF)} mm`, ok ? DCOL.ink : DCOL.accent, true);
  if (p.minThicknessMm) row("Minimum flanş kalınlığı", `${fmtN(p.minThicknessMm)} mm`);

  ly += 4;
  els.push(ln(lx, ly, rx, ly, DCOL.line, 0.8));
  ly += 16;
  if (p.torqueEachNm) row("Bir kaliperin momenti", `${fmtN(p.torqueEachNm)} Nm`);
  if (p.totalTorqueNm) row("Toplam frenleme momenti", `${fmtN(p.totalTorqueNm)} Nm`, DCOL.ink, true);
  if (p.demandTorqueNm) row("İstenen moment", `${fmtN(p.demandTorqueNm)} Nm`);

  ly += 6;
  const torqueOk =
    p.totalTorqueNm !== undefined && p.demandTorqueNm !== undefined
      ? p.totalTorqueNm >= p.demandTorqueNm
      : undefined;
  els.push(
    txt(lx, ly, ok ? "Flanş çapı yeterli ✓" : "Flanş çapı YETERSİZ ✗", 8.5, {
      fill: ok ? GREEN : DCOL.accent, bold: true,
    })
  );
  ly += 14;
  if (torqueOk !== undefined) {
    els.push(
      txt(lx, ly, torqueOk ? "Frenleme momenti yeterli ✓" : "Frenleme momenti YETERSİZ ✗", 8.5, {
        fill: torqueOk ? GREEN : DCOL.accent, bold: true,
      })
    );
    ly += 14;
  }
  els.push(txt(lx, ly, "min. flanş = maks(katalog ; tambur + Δ) + pay", 7, { fill: DCOL.muted }));

  return fitDiagram(els, W, H);
}
