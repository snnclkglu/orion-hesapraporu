// Tambur emniyet freni — parametrik montaj ve ölçü şeması (2.8 bölümü).
//
// TEK GÖRÜNÜŞ: yerleşim ile ölçüler aynı parçanın üstünde gösterilir. İkisini
// ayrı çizmek aynı çemberi iki kez basmak olurdu; atölye de tek bir montaj
// görünüşü okur.
//
//   · Flanş (fren diski) ve tambur gövdesi GERÇEK oranda,
//   · katalogdan çıkan minimum flanş çapı kesikli çember olarak — yetersizse
//     seçilen flanşın DIŞINDA kalır, hata tek bakışta görünür,
//   · seçilen yerleşim düzeninin KENDİ açılarında kaliperler
//     (`BRAKE_ARRANGEMENT_DEFS.angles`),
//   · sağda sayısal özet ve sonuç.
//
// YERLEŞİM: ölçü okları kaliperlerin BOŞ bıraktığı açılara yerleştirilir ve
// sağ sütunun satır adımı yazı boyuna göre hesaplanır; ikisi de daha önce
// üst üste binmenin kaynağıydı.
//
// Ölçüler mm.

import { brakeArrangementOf } from "../calc/safety-brake";
import {
  DCOL, type Diagram, type DiagramEl, diagramTitleCase,
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
  /** Seçilen flanş kalınlığı [mm] */
  thicknessMm?: number;
  /** Bir kaliperin frenleme momenti [Nm] */
  torqueEachNm?: number;
  /** Toplam frenleme momenti [Nm] */
  totalTorqueNm?: number;
  /** Tamburda gereken (emniyetli) moment [Nm] */
  demandTorqueNm?: number;
  /** Seçilen hidrolik güç ünitesi kodu */
  hydraulicUnit?: string;
  /** Ünitenin açma basıncı [bar] */
  hydraulicPressureBar?: number;
}

const W = 760;
const H = 430;
const GREEN = "#1F8A5B";

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
  const w = 28;
  const h = 22;
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
  const [ox, oy] = rot(w / 2 + 12, 0);
  els.push(ln(bx + ux * (w / 2), by + uy * (w / 2), ox, oy, DCOL.muted, 1.1));
  els.push(
    txt(ox + ux * 6, oy + uy * 6 + 3, label, 7.5, {
      anchor: ux < -0.2 ? "end" : ux > 0.2 ? "start" : "middle",
      fill: DCOL.accent, bold: true,
    })
  );
}

/**
 * Ölçü oklarını kaliperlerden UZAK açılara yerleştirir.
 *
 * Aday açılar arasından, her kaliper açısına en az `minSep` derece uzak olan
 * ilk üçü seçilir; hiçbiri bulunamazsa kaliperlere en uzak açılar sıralanır.
 * Böylece yerleşim değişince ölçü okları da yer değiştirir ve kaliper
 * etiketiyle çakışmaz.
 */
function dimensionAngles(calliperAngles: number[]): [number, number, number] {
  const candidates = [90, 60, 120, 30, 150, 0, 180, 210, 240, 270, 300, 330];
  /** İki açı arasındaki en kısa fark [0…180] */
  const delta = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  /** Açının en yakın kalipere uzaklığı — büyük olan iyidir. */
  const clearance = (deg: number) =>
    calliperAngles.length === 0
      ? 180
      : Math.min(...calliperAngles.map((c) => delta(deg, c)));

  const ranked = [...candidates].sort((a, b) => clearance(b) - clearance(a));
  const picked: number[] = [];
  // Açgözlü seçim: kaliperlerden en uzak açıdan başlanır, her yeni ok
  // öncekilerden en az 40° ayrı durur — üç ok tek kadranda kümelenmez.
  for (const deg of ranked) {
    if (picked.some((p) => delta(deg, p) < 40)) continue;
    picked.push(deg);
    if (picked.length === 3) break;
  }
  // Yeterince ayrık açı bulunamazsa (dört kaliperli düzen) sıralamadan tamamla.
  for (const deg of ranked) {
    if (picked.length === 3) break;
    if (!picked.includes(deg)) picked.push(deg);
  }
  return [picked[0], picked[1], picked[2]];
}

export function safetyBrakeDiagram(p: SafetyBrakeParams): Diagram {
  const els: DiagramEl[] = [];
  const arr = brakeArrangementOf(p.arrangement);
  caption(
    els,
    "EMNİYET FRENİ — TAMBUR MONTAJI VE ÖLÇÜLER",
    diagramTitleCase([p.model, arr.label].filter(Boolean).join(" · ")) || "Ölçüler mm",
  );

  const { flangeDiaMm: dF, minFlangeDiaMm: dMin, drumDiaMm: dD } = p;
  if (!(dF > 0) || !(dD > 0) || !Number.isFinite(dMin)) {
    els.push(txt(W / 2, H / 2, "Flanş / Tambur Ölçüleri Hesaplanamadı", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  const ok = dF >= dMin;
  const cx = 200;
  const cy = 232;
  const rMax = 118;
  // Ölçek en büyük çapa göre: yetersiz flanşta minimum çember dışarı taşar,
  // ölçek onu da kapsamalı ki kırpılmasın.
  const s = rMax / (Math.max(dF, dMin, dD) / 2);
  const rF = (dF / 2) * s;
  const rMinReq = (dMin / 2) * s;
  const rD = (dD / 2) * s;

  // Eksen çizgileri
  const axis = rMax + 30;
  els.push(ln(cx - axis, cy, cx + axis, cy, DCOL.faint, 0.7, "9,3,2,3"));
  els.push(ln(cx, cy - axis, cx, cy + axis, DCOL.faint, 0.7, "9,3,2,3"));

  // Flanş → tambur → minimum çember (üstte kalsın diye en son)
  els.push({ kind: "circle", cx, cy, r: rF, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.5 });
  els.push({ kind: "circle", cx, cy, r: rD, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
  els.push({
    kind: "circle", cx, cy, r: rMinReq, fill: "none",
    stroke: ok ? DCOL.muted : DCOL.accent, strokeWidth: 1.2, dash: "6,3",
  });

  // Kaliperler — düzenin KENDİ açılarında
  arr.angles.forEach((deg, i) => pushCalliper(els, cx, cy, rF, deg, `F${i + 1}`));

  // Yarıçap ölçü okları — kaliperlerin boş bıraktığı açılara
  const [aD, aMin, aF] = dimensionAngles(arr.angles);
  const radial = (r: number, deg: number, label: string, color: string) => {
    const a = (deg * Math.PI) / 180;
    const ex = cx + Math.cos(a) * r;
    const ey = cy - Math.sin(a) * r;
    els.push(ln(cx, cy, ex, ey, color, 0.9));
    els.push(arrowHead(ex, ey, Math.cos(a) >= 0 ? "right" : "left", color, 6, 2.4));
    els.push(
      txt(cx + Math.cos(a) * (r + 11), cy - Math.sin(a) * (r + 11) + 3, label, 7.5, {
        anchor: Math.cos(a) >= 0 ? "start" : "end", fill: color,
      })
    );
  };
  radial(rD, aD, `Ø${fmtN(dD)}`, DCOL.muted);
  radial(rMinReq, aMin, `Ø${fmtN(dMin)} Min.`, ok ? DCOL.muted : DCOL.accent);
  radial(rF, aF, `Ø${fmtN(dF)}`, DCOL.ink);

  // --- Sağ sütun: sayısal özet -------------------------------------------
  // Satır adımı yazı boyunun 1,75 katıdır: daha küçük adımda alt satırın
  // üst çıkıntısı üsttekinin alt çıkıntısına biniyordu.
  const lx = 408;
  const rx = W - 16;
  const STEP = 15.5;
  const top = 62;
  els.push(txt(lx, top, "SEÇİM ÖZETİ", 9, { fill: DCOL.accent, bold: true }));
  let ly = top + 20;
  const row = (k: string, v: string, color = DCOL.ink, bold = false) => {
    els.push(txt(lx, ly, k, 7.5, { fill: DCOL.muted }));
    els.push(txt(rx, ly, v, 8, { anchor: "end", fill: color, bold }));
    ly += STEP;
  };
  const rule = () => {
    ly += 3;
    els.push(ln(lx, ly, rx, ly, DCOL.line, 0.8));
    ly += 13;
  };

  if (p.model) row("Fren Modeli", p.model, DCOL.ink, true);
  row("Yerleşim", arr.code);
  row("Kaliper Adedi", `${arr.angles.length}`);
  rule();
  row("Tambur Çapı", `Ø${fmtN(dD)} mm`);
  row("Minimum Flanş Çapı", `Ø${fmtN(dMin)} mm`);
  row("Seçilen Flanş Çapı", `Ø${fmtN(dF)} mm`, ok ? DCOL.ink : DCOL.accent, true);
  if (p.minThicknessMm) row("Minimum Flanş Kalınlığı", `${fmtN(p.minThicknessMm)} mm`);
  if (p.thicknessMm) {
    const tOk = !p.minThicknessMm || p.thicknessMm >= p.minThicknessMm;
    row("Seçilen Flanş Kalınlığı", `${fmtN(p.thicknessMm)} mm`, tOk ? DCOL.ink : DCOL.accent, true);
  }
  rule();
  if (p.torqueEachNm) row("Bir Kaliperin Momenti", `${fmtN(p.torqueEachNm)} Nm`);
  if (p.totalTorqueNm) row("Toplam Frenleme Momenti", `${fmtN(p.totalTorqueNm)} Nm`, DCOL.ink, true);
  if (p.demandTorqueNm) row("İstenen Moment", `${fmtN(p.demandTorqueNm)} Nm`);
  if (p.hydraulicUnit && p.hydraulicUnit !== "—") {
    rule();
    row("Hidrolik Ünite", p.hydraulicUnit, DCOL.ink, true);
    if (p.hydraulicPressureBar) row("Açma Basıncı", `${fmtN(p.hydraulicPressureBar)} bar`);
  }

  // --- Sonuç satırları ----------------------------------------------------
  ly += 6;
  const torqueOk =
    p.totalTorqueNm !== undefined && p.demandTorqueNm !== undefined
      ? p.totalTorqueNm >= p.demandTorqueNm
      : undefined;
  const verdict = (label: string, good: boolean) => {
    els.push(txt(lx, ly, label, 8.5, { fill: good ? GREEN : DCOL.accent, bold: true }));
    ly += 14;
  };
  verdict(ok ? "Flanş Çapı Yeterli ✓" : "Flanş Çapı YETERSİZ ✗", ok);
  if (torqueOk !== undefined) {
    verdict(
      torqueOk ? "Frenleme Momenti Yeterli ✓" : "Frenleme Momenti YETERSİZ ✗",
      torqueOk
    );
  }
  els.push(txt(lx, ly + 2, "Min. Flanş = Maks(Katalog ; Tambur + Δ) + Pay", 7, {
    fill: DCOL.muted,
  }));

  // Ayraç çizgisi, sütunun GERÇEK yüksekliği kadar uzar — sabit uzunlukta
  // olduğunda kısa özetlerde havada asılı kalıyordu.
  els.push(ln(lx - 16, top - 8, lx - 16, ly + 12, DCOL.line, 0.8));

  return fitDiagram(els, W, Math.max(H, ly + 26));
}
