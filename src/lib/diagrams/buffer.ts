// Tampon diyagramı (5.8 / 6.9) — enerji–strok ve kuvvet–strok grafikleri.
//
// İki tampon tipi AYNI grafikte farklı eğrilerle gösterilir:
//   · HİDROLİK: kısma iğnesi kuvveti strok boyunca sabit tutar. Kuvvet yatay
//     bir doğru, yutulan enerji ise doğrusal artan bir doğrudur
//     (E(x) = F_maks · η · x).
//   · KAUÇUK: yay karakteristiği doğrusal DEĞİLDİR; eğriler katalogun yük
//     diyagramından (conductix_curves.json) gelir ve olduğu gibi çizilir.
//
// Her iki grafikte de ÇALIŞMA NOKTASI işaretlenir: hesaplanan sıkışma yolunda
// gereken enerji ve oluşan kuvvet. Katalog sınırları yatay kılavuz olarak
// görünür, altta enerji kullanım oranı çubuğu vardır.

import {
  CHART_COLORS, pushChartFrame, pushCurve, pushHGuide, pushLegend,
  pushPoint, pushUtilizationBar,
} from "./chart";
import {
  DCOL, type Diagram, type DiagramEl,
  fitDiagram, fmtN, ln, txt,
} from "./model";

export interface BufferDiagramParams {
  /** "hidrolik" | "kaucuk" | "yok" */
  type: string;
  /** Tampon modeli (başlıkta gösterilir) */
  model?: string;
  /** Hidrolikte tam strok, elastomerde izin verilen toplam sıkışma yolu [mm] */
  strokeMm: number;
  /** Hesapta kullanılan sıkışma yolu f′ [mm] */
  strokeUsedMm: number;
  /** Sönümlenmesi gereken toplam enerji E_a [kJ] */
  totalEnergyKj: number;
  /** Katalog enerji kapasitesi W_maks [kJ] */
  catalogEnergyKj: number;
  /** Tampon tepki kuvveti F_t [kN] */
  reactionForceKn: number;
  /** Katalog azami son kuvveti [kN] */
  catalogMaxForceKn: number;
  /** Hücresel eğrinin seçildiği gerçek çarpma hızı [m/s] */
  catalogCurveSpeedMps?: number;
  /** Kauçuk: enerji–sıkışma eğrisi [[%, J], …] */
  energyCurve?: readonly (readonly [number, number])[];
  /** Kauçuk: kuvvet–sıkışma eğrisi [[%, kN], …] */
  forceCurve?: readonly (readonly [number, number])[];
  /** Kauçuk / hücresel: izin verilen azami sıkışma [%] */
  maxCompressionPct?: number;
  /** Gerçekleşen sıkışma [%] */
  compressionPct?: number;
  /** Katalog eğrileriyle gerçek bir hesap üretilebildi mi? */
  computed?: boolean;
  /** Sönümleme verimi η (hidrolik) */
  dampingEfficiency?: number;
}

const W = 620;
const H = 380;

const finite = (v: number | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** Eğriyi [% , y] → [mm, y] uzayına taşır (yükseklikle ölçeklenir). */
function toStrokeCurve(
  curve: readonly (readonly [number, number])[] | undefined,
  heightMm: number,
  scaleY: number
): [number, number][] {
  if (!curve || curve.length < 2 || !(heightMm > 0)) return [];
  return curve
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [(p[0] / 100) * heightMm, p[1] * scaleY] as [number, number]);
}

export function bufferDiagram(p: BufferDiagramParams): Diagram {
  const els: DiagramEl[] = [];
  const curveDriven = p.type === "kaucuk" || p.type === "hucresel";
  const cellular = p.type === "hucresel";
  const eta = finite(p.dampingEfficiency) || 0.85;
  const height = finite(p.strokeMm);
  const used = finite(p.strokeUsedMm);
  const Ea = finite(p.totalEnergyKj);
  const Ft = finite(p.reactionForceKn);

  const baslik = cellular ? "TAMPON — HÜCRESEL" : curveDriven ? "TAMPON — KAUÇUK" : "TAMPON — HİDROLİK";
  els.push(txt(16, 22, baslik, 11, { bold: true }));
  const energyCurve = p.energyCurve;
  const forceCurve = p.forceCurve;
  const elasticHeight = finite(p.maxCompressionPct) > 0
    ? (height * 100) / finite(p.maxCompressionPct)
    : height;

  els.push(
    txt(
      16, 34,
      curveDriven
        ? cellular
          ? `${p.model ?? "—"} · KAT0180 hız eğrisinden enterpolasyon · v_ç = ${fmtN(finite(p.catalogCurveSpeedMps), 3)} m/s · s = ${fmtN(height)} mm`
          : `${p.model ?? "—"} · katalog yük diyagramından enterpolasyon · s = ${fmtN(height)} mm`
        : `${p.model ?? "—"} · sabit kuvvetli sönümleme · s = ${fmtN(height)} mm · η = ${fmtN(eta, 2)}`,
      8, { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  if (p.type === "yok" || !(height > 0)) {
    els.push(
      txt(W / 2, 120, "Bu grupta tampon seçilmemiştir — hesap yapılmadı.", 10, {
        anchor: "middle", fill: DCOL.muted,
      })
    );
    return fitDiagram(els, W, 160);
  }

  if (curveDriven && p.computed === false) {
    els.push(
      txt(
        W / 2, 120,
        cellular
          ? "Hücresel tampon için çarpma hızında KAT0180 enerji/kuvvet eğrisi bulunamadı."
          : "Seçilen kauçuk tampon için doğrulanmış yük eğrisi yoktur.",
        10,
        { anchor: "middle", fill: DCOL.muted }
      )
    );
    els.push(
      txt(
        W / 2, 138,
        "0–4 m/s dışındaki hızlar veya katalogda olmayan modeller üretici teyidi gerektirir.",
        8.5,
        { anchor: "middle", fill: DCOL.muted }
      )
    );
    return fitDiagram(els, W, 170);
  }

  // --- Eğriler ------------------------------------------------------------
  // Enerji eğrisi [mm → kJ]; kauçukta katalog J cinsindendir (1/1000 ölçek).
  const energyPts: [number, number][] = curveDriven
    ? toStrokeCurve(energyCurve, elasticHeight, 1 / 1000)
    : [
        [0, 0],
        // Hidrolikte kısma iğnesi kuvveti strok boyunca sabit tutar; yutulan
        // enerji bu yüzden yolla DOĞRUSAL artar ve sıkışma sonunda E_a olur.
        // Katalog kapasitesi W_maks bu doğrunun değil, SINIRIN kendisidir ve
        // ayrı bir yatay kılavuz olarak çizilir.
        [used > 0 ? used : height, Ea],
      ];
  // Kuvvet eğrisi [mm → kN]
  const forcePts: [number, number][] = curveDriven
    ? toStrokeCurve(forceCurve, elasticHeight, 1)
    : [
        [0, Ft],
        [height, Ft],
      ];

  const maxE = Math.max(
    ...energyPts.map((q) => q[1]),
    Ea,
    finite(p.catalogEnergyKj),
    1e-6
  );
  const maxF = Math.max(
    ...forcePts.map((q) => q[1]),
    Ft,
    finite(p.catalogMaxForceKn),
    1e-6
  );

  const chartW = 250;
  const chartH = 150;
  const topY = 88;

  // --- Enerji grafiği -----------------------------------------------------
  const fe = pushChartFrame(
    els,
    { x: 62, y: topY, w: chartW, h: chartH },
    { min: 0, max: height, label: "sıkışma yolu [mm]" },
    { min: 0, max: maxE * 1.12, label: "yutulan enerji [kJ]" },
    { grid: true, title: "ENERJİ – STROK" }
  );
  if (energyPts.length > 1) {
    pushCurve(els, fe, energyPts, { color: DCOL.ink, width: 1.8 });
  }
  if (finite(p.catalogEnergyKj) > 0) {
    pushHGuide(els, fe, p.catalogEnergyKj, `W_maks = ${fmtN(p.catalogEnergyKj, 2)} kJ`, {
      color: CHART_COLORS.ok,
    });
  }
  pushPoint(els, fe, used, Ea, `E_a = ${fmtN(Ea, 3)} kJ`, {
    color: Ea <= finite(p.catalogEnergyKj) ? CHART_COLORS.ok : CHART_COLORS.bad,
  });

  // --- Kuvvet grafiği -----------------------------------------------------
  const ff = pushChartFrame(
    els,
    { x: 62 + chartW + 62, y: topY, w: chartW, h: chartH },
    { min: 0, max: height, label: "sıkışma yolu [mm]" },
    { min: 0, max: maxF * 1.15, label: "kuvvet [kN]" },
    { grid: true, title: "KUVVET – STROK" }
  );
  if (forcePts.length > 1) {
    pushCurve(els, ff, forcePts, { color: DCOL.accent, width: 1.8 });
  }
  if (finite(p.catalogMaxForceKn) > 0) {
    pushHGuide(els, ff, p.catalogMaxForceKn, `sınır = ${fmtN(p.catalogMaxForceKn, 1)} kN`, {
      color: CHART_COLORS.ok,
    });
  }
  pushPoint(els, ff, used, Ft, `F_t = ${fmtN(Ft, 2)} kN`, {
    color: Ft <= finite(p.catalogMaxForceKn) ? CHART_COLORS.ok : CHART_COLORS.bad,
  });

  // --- Gösterge + kullanım oranı -----------------------------------------
  const legendY = topY + chartH + 52;
  pushLegend(els, 62, legendY, [
    {
      color: DCOL.ink,
      label: cellular ? "KAT0180 hız enterpolasyonlu enerji eğrisi" : curveDriven ? "katalog enerji eğrisi" : "yutulan enerji (doğrusal)",
    },
    {
      color: DCOL.accent,
      label: cellular ? "KAT0180 hız enterpolasyonlu kuvvet eğrisi" : curveDriven ? "katalog kuvvet eğrisi" : "tepe kuvveti (sabit)",
    },
  ]);

  const barY = legendY - 6;
  const catE = finite(p.catalogEnergyKj);
  if (catE > 0) {
    pushUtilizationBar(els, 300, barY, 190, 12, Ea / catE, {
      label: "enerji kullanımı",
      valueText: `%${fmtN((Ea / catE) * 100, 1)}`,
    });
  }
  const catF = finite(p.catalogMaxForceKn);
  if (catF > 0) {
    pushUtilizationBar(els, 300, barY + 34, 190, 12, Ft / catF, {
      label: "kuvvet kullanımı",
      valueText: `%${fmtN((Ft / catF) * 100, 1)}`,
    });
  }

  if (curveDriven && finite(p.maxCompressionPct) > 0) {
    const pct = finite(p.compressionPct);
    const ok = pct <= p.maxCompressionPct!;
    els.push(
      txt(
        62, legendY + 44,
        `sıkışma: %${fmtN(pct, 1)} / izin %${fmtN(p.maxCompressionPct!, 0)}  ${ok ? "✓" : "✗"}`,
        9.5,
        { fill: ok ? CHART_COLORS.ok : CHART_COLORS.bad, bold: true }
      )
    );
  }

  return fitDiagram(els, W, H);
}
