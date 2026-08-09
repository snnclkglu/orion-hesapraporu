// Mahal iklimlendirme yükü şeması — kabin ve elektrik odası bölümleri (11.x).
//
// İki şeyi birden anlatır:
//   SOL  — mahallin kesiti: yalıtımlı zarf, kapı, cam, operatör, cihazlar ve
//          klima ünitesi. Isının HANGİ YOLDAN girdiği ok ok gösterilir.
//   SAĞ  — yük dağılımı çubuğu: hangi kalemin baskın olduğu tek bakışta
//          okunur. Sayı tablosunun anlatamadığı şey budur — mühendis
//          "yalıtımı artırsam ne olur" sorusunun cevabını buradan görür.
//
// Şema ÖLÇEKLİ DEĞİLDİR: mahal oranları korunur ama duvar kalınlığı, kapı ve
// cam okunabilirlik için abartılır. Ölçüler etiketle verilir.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, caption, fitDiagram, fmtN, ln, txt,
} from "./model";

export interface ClimateRoomParams {
  /** Başlıkta görünen mahal adı ("Operatör Kabini" · "Elektrik Odası") */
  title: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  /** Yalıtım kalınlığı [mm] — zarf kesitinde etiketlenir */
  insulationMm: number;
  doorCount: number;
  ambientTempC: number;
  ambientRhPct: number;
  roomTempC: number;
  roomRhPct: number;
  outdoor: boolean;
  /** Yük kalemleri [kW] */
  transmissionKw: number;
  solarKw: number;
  radiationKw: number;
  deviceHeatKw: number;
  occupantKw: number;
  freshAirKw: number;
  totalKw: number;
  /** Taze hava debisi [m³/h] ve gereken üfleme debisi [m³/h] */
  freshAirM3h: number;
  airFlowM3h: number;
  /** Kabine özgü: cam alanı [m²] ve kişi adedi (0 ise çizilmez) */
  glazingAreaM2: number;
  occupantCount: number;
}

const W = 700;
const H = 400;

/** Yük kalemi: etiket, değer, renk. */
interface Item {
  label: string;
  kw: number;
  fill: string;
}

export function climateRoomDiagram(p: ClimateRoomParams): Diagram {
  const els: DiagramEl[] = [];
  caption(
    els,
    `${p.title.toLocaleUpperCase("tr")} · ISI YÜKÜ ŞEMASI`,
    `${fmtN(p.lengthM, 2)} × ${fmtN(p.widthM, 2)} × ${fmtN(p.heightM, 2)} m · ` +
      `${p.outdoor ? "açık hava" : "kapalı mahal"} · ortam ${fmtN(p.ambientTempC, 0)} °C / %${fmtN(p.ambientRhPct, 0)}`
  );

  // ---------------------------------------------------------------- mahal kutusu
  // Oranlar korunur; kutu sabit bir alana sığdırılır.
  const boxMaxW = 250;
  const boxMaxH = 150;
  const ratio = p.heightM > 0 && p.lengthM > 0 ? p.heightM / p.lengthM : 0.6;
  let bw = boxMaxW;
  let bh = bw * ratio;
  if (bh > boxMaxH) { bh = boxMaxH; bw = bh / ratio; }
  const bx = 96;
  const by = 132;

  // Zarf: dış çizgi + yalıtım dolgusu + iç çizgi
  const t = 7; // yalıtım kalınlığı [px] — okunabilirlik için abartılı
  els.push({
    kind: "rect", x: bx, y: by, w: bw, h: bh,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.4,
  });
  els.push({
    kind: "rect", x: bx + t, y: by + t, w: bw - 2 * t, h: bh - 2 * t,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1,
  });
  // Yalıtım tarama çizgileri (üst bant)
  for (let x = bx + 6; x < bx + bw - 6; x += 9) {
    els.push(ln(x, by + 1.5, x + 4.5, by + t - 1.5, DCOL.faint, 0.6));
  }
  els.push(
    txt(bx + bw / 2, by - 8, `taş yünü ${fmtN(p.insulationMm, 0)} mm`, 8.5, {
      anchor: "middle", fill: DCOL.muted,
    })
  );

  // İç koşullar
  els.push(
    txt(bx + bw / 2, by + bh / 2 - 20, `${fmtN(p.roomTempC, 0)} °C`, 13, {
      anchor: "middle", bold: true,
    })
  );
  els.push(
    txt(bx + bw / 2, by + bh / 2 - 7, `%${fmtN(p.roomRhPct, 0)} bağıl nem`, 8.5, {
      anchor: "middle", fill: DCOL.muted,
    })
  );

  // ---------------------------------------------------------------- kapı
  if (p.doorCount > 0) {
    const dh = Math.min(bh - 2 * t - 6, 34);
    const dy = by + bh - t - dh;
    els.push({
      kind: "rect", x: bx + t - 1, y: dy, w: 5, h: dh,
      fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(
      txt(bx - 8, dy + dh / 2, `${fmtN(p.doorCount, 0)} kapı`, 8.5, {
        anchor: "end", fill: DCOL.muted,
      })
    );
  }

  // ---------------------------------------------------------------- cam
  if (p.glazingAreaM2 > 0) {
    const gh = Math.min(bh - 2 * t - 10, 46);
    const gy = by + t + 8;
    els.push({
      kind: "rect", x: bx + bw - t - 4, y: gy, w: 5, h: gh,
      fill: "#DCEAF2", stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(ln(bx + bw - t - 4, gy + gh / 3, bx + bw - t + 1, gy + gh / 3, DCOL.faint, 0.7));
    els.push(
      txt(bx + bw + 8, gy + gh / 2, `cam ${fmtN(p.glazingAreaM2, 1)} m²`, 8.5, {
        fill: DCOL.muted,
      })
    );
  }

  // ---------------------------------------------------------------- operatör
  if (p.occupantCount > 0) {
    const px = bx + bw * 0.34;
    const py = by + bh - t - 8;
    els.push({ kind: "circle", cx: px, cy: py - 21, r: 4.2, fill: DCOL.ink });
    els.push(ln(px, py - 17, px, py - 7, DCOL.ink, 1.6));
    els.push(ln(px - 6, py - 13, px + 6, py - 13, DCOL.ink, 1.4));
    els.push(ln(px, py - 7, px - 5, py, DCOL.ink, 1.4));
    els.push(ln(px, py - 7, px + 5, py, DCOL.ink, 1.4));
    els.push(
      txt(px, py + 11, `${fmtN(p.occupantCount, 0)} operatör`, 8, {
        anchor: "middle", fill: DCOL.muted,
      })
    );
  }

  // ---------------------------------------------------------------- cihazlar
  const eqW = 30;
  const eqH = 26;
  const eqX = bx + bw - t - eqW - 10;
  const eqY = by + bh - t - eqH - 4;
  els.push({
    kind: "rect", x: eqX, y: eqY, w: eqW, h: eqH,
    fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 1,
  });
  els.push(ln(eqX + 5, eqY + 8, eqX + eqW - 5, eqY + 8, DCOL.muted, 0.7));
  els.push(ln(eqX + 5, eqY + 14, eqX + eqW - 5, eqY + 14, DCOL.muted, 0.7));
  els.push(
    txt(eqX + eqW / 2, eqY + eqH + 10, "cihazlar", 8, {
      anchor: "middle", fill: DCOL.muted,
    })
  );

  // ---------------------------------------------------------------- ısı okları
  /** Zarfa dışarıdan giren yük oku — etiket kırmızı, değer kW. */
  const heatArrow = (
    x1: number, y1: number, x2: number, y2: number, label: string, kw: number
  ) => {
    if (!(kw > 0)) return;
    els.push(ln(x1, y1, x2, y2, DCOL.accent, 1.6));
    const dir = Math.abs(x2 - x1) > Math.abs(y2 - y1)
      ? (x2 > x1 ? "right" : "left")
      : (y2 > y1 ? "down" : "up");
    els.push(arrowHead(x2, y2, dir as "left" | "right" | "up" | "down", DCOL.accent, 8, 3.2));
    els.push(
      txt(x1, y1 - 5, `${label} ${fmtN(kw, 2)} kW`, 8.5, {
        anchor: x2 > x1 ? "end" : "start", fill: DCOL.accent,
        leaderTo: [x2, y2],
      })
    );
  };

  // İletim — sol duvardan içeri
  heatArrow(bx - 46, by + bh * 0.34, bx - 3, by + bh * 0.34, "iletim", p.transmissionKw);
  // Güneş — çatıdan (yalnız açık havada)
  if (p.outdoor && p.solarKw > 0) {
    const sx = bx + bw * 0.62;
    els.push({ kind: "circle", cx: sx + 40, cy: by - 44, r: 8, fill: "#F2C94C" });
    for (let a = 0; a < 8; a += 1) {
      const ang = (a * Math.PI) / 4;
      els.push(ln(
        sx + 40 + Math.cos(ang) * 11, by - 44 + Math.sin(ang) * 11,
        sx + 40 + Math.cos(ang) * 15, by - 44 + Math.sin(ang) * 15,
        "#F2C94C", 1.2
      ));
    }
    heatArrow(sx, by - 30, sx, by - 3, "güneş", p.solarKw);
  }
  // Işınım — sağ duvardan (yalnız girilmişse)
  heatArrow(bx + bw + 52, by + bh * 0.62, bx + bw + 3, by + bh * 0.62, "ışınım", p.radiationKw);

  // ---------------------------------------------------------------- klima ünitesi
  const acX = bx + bw + 78;
  const acY = by + bh - 56;
  els.push({
    kind: "rect", x: acX, y: acY, w: 54, h: 44,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  els.push(txt(acX + 27, acY + 20, "KLİMA", 9, { anchor: "middle", bold: true }));
  els.push(
    txt(acX + 27, acY + 32, `${fmtN(p.totalKw, 2)} kW`, 9, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    })
  );
  // Üfleme (mahalle) ve dönüş (mahalden) okları
  els.push(ln(acX, acY + 12, bx + bw + 6, acY + 12, DCOL.ink, 1.3));
  els.push(arrowHead(bx + bw + 4, acY + 12, "left", DCOL.ink, 7, 2.8));
  els.push(
    txt(acX - 4, acY + 7, `üfleme ${fmtN(p.airFlowM3h, 0)} m³/h`, 8, {
      anchor: "end", fill: DCOL.muted,
    })
  );
  els.push(ln(bx + bw + 6, acY + 34, acX, acY + 34, DCOL.faint, 1.1, "4,3"));
  els.push(arrowHead(acX - 2, acY + 34, "right", DCOL.faint, 7, 2.8));
  els.push(txt(acX - 4, acY + 44, "dönüş", 8, { anchor: "end", fill: DCOL.muted }));

  // Taze hava — dışarıdan klimaya
  els.push(ln(acX + 27, acY - 26, acX + 27, acY - 2, DCOL.muted, 1.2));
  els.push(arrowHead(acX + 27, acY, "down", DCOL.muted, 7, 2.8));
  els.push(
    txt(acX + 33, acY - 16, `taze hava ${fmtN(p.freshAirM3h, 1)} m³/h`, 8, {
      fill: DCOL.muted,
    })
  );

  // Dış koşul kartuşu
  els.push(
    txt(bx - 46, by + 6, `dış ortam ${fmtN(p.ambientTempC, 0)} °C`, 9, {
      anchor: "start", fill: DCOL.muted,
    })
  );

  // ---------------------------------------------------------------- yük çubuğu
  const items: Item[] = [
    { label: "iletim", kw: p.transmissionKw, fill: "#8A8480" },
    { label: "güneş", kw: p.solarKw, fill: "#F2C94C" },
    { label: "ışınım", kw: p.radiationKw, fill: "#E2A05A" },
    { label: "cihaz", kw: p.deviceHeatKw, fill: "#A41E1E" },
    { label: "operatör", kw: p.occupantKw, fill: "#5B8C7B" },
    { label: "taze hava", kw: p.freshAirKw, fill: "#4A7A96" },
  ].filter((i) => i.kw > 0);

  const sum = items.reduce((a, i) => a + i.kw, 0);
  const barX = 96;
  const barY = 330;
  const barW = 520;
  const barH = 20;
  els.push(txt(barX, barY - 8, "YÜK DAĞILIMI", 8.5, { fill: DCOL.muted, fixed: true }));

  if (sum > 0) {
    let x = barX;
    for (const it of items) {
      const w = (it.kw / sum) * barW;
      els.push({
        kind: "rect", x, y: barY, w, h: barH,
        fill: it.fill, stroke: "#FFFFFF", strokeWidth: 0.6, obstacle: true,
      });
      // Etiket yalnız dilim yeterince genişse içine yazılır; dar dilimler
      // aşağıdaki lejantta kalır.
      if (w > 54) {
        els.push(
          txt(x + w / 2, barY + 13.5, `${it.label} %${fmtN((it.kw / sum) * 100, 0)}`, 8, {
            anchor: "middle", fill: "#FFFFFF", fixed: true,
          })
        );
      }
      x += w;
    }
    // Lejant — her kalemin kW değeri
    let lx = barX;
    for (const it of items) {
      els.push({ kind: "rect", x: lx, y: barY + 30, w: 8, h: 8, fill: it.fill });
      els.push(txt(lx + 12, barY + 37, `${it.label} ${fmtN(it.kw, 2)}`, 8, { fill: DCOL.ink }));
      lx += 88;
    }
  }
  els.push(
    txt(barX + barW + 8, barY + 14, `Σ ${fmtN(p.totalKw, 2)} kW`, 10, {
      fill: DCOL.accent, bold: true, fixed: true,
    })
  );
  els.push(
    txt(barX + barW + 8, barY + 26, "emniyet katsayısı dâhil", 7.5, {
      fill: DCOL.muted, fixed: true,
    })
  );

  return fitDiagram(els, W, H);
}
