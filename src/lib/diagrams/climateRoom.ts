// Mahal iklimlendirme yükü şeması — kabin, elektrik odası ve pano bölümleri.
//
// İki şeyi birden anlatır:
//   SOL  — mahallin KESİTİ: yalıtımlı zarf, cam, operatör, panolar ve
//          klima ünitesi. Isının HANGİ YOLDAN girdiği okla gösterilir.
//   ALT  — yük dağılımı çubuğu: hangi kalemin baskın olduğu tek bakışta
//          okunur. Sayı tablosunun anlatamadığı şey budur — mühendis
//          "yalıtımı artırsam ne olur" sorusunun cevabını buradan görür.
//
// YERLEŞİM İLKESİ — ETİKET ZARFIN ÜSTÜNE YAZILMAZ.
// Çizimin çevresi üç şeride ayrılır: SOL LULUK (dış koşul, iletim oku),
// KUTU (yalnız iç koşullar ve mahalin kendi içeriği) ve SAĞ ŞERİT (klima ve
// hava debileri). Mahalin içindekilerin (pano, operatör) etiketleri kutunun
// ALTINA, dışına yazılır. Genel çakışma çözücü (`resolveTextOverlaps`) yalnız
// metin-metin çakışmasını görür; metnin duvar çizgisine binmesini göremez, bu
// yüzden şeritler burada elle ayrılır.
//
// KESİT ÖLÇEKLİDİR: kutunun en/boy oranı mahalin yükseklik/uzunluk oranıdır ve
// içindekiler (pano, insan) GERÇEK boylarıyla ölçeklenir — 2 m'lik bir pano
// 2,6 m'lik odanın üçte ikisini kaplar. Yalnız duvar kalınlığı, kapı ve cam
// okunabilirlik için abartılır; ölçüler etiketle verilir.

import {
  DCOL, type Diagram, type DiagramEl, type LineEl,
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
  /** Kapı etiketi — pano yerleşiminde sızıntı yolu "Pano Kapağı"dır */
  doorLabel?: string;
  /** Elektrik odası kapı net ölçüsü [mm] — ısı hesabında kullanılır, çizilmez. */
  doorWidthMm?: number;
  doorHeightMm?: number;
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
  /**
   * Mahalde yan yana duran dolap adedi (pano). 0/verilmezse tek bir genel
   * "Cihazlar" konsolu çizilir — kabinde cihaz bir dolap değil, panelin
   * arkasındaki elektroniktir.
   */
  deviceCount?: number;
  /** Dolap etiketi ("Pano"). Adet önüne yazılır: "6 Pano". */
  deviceLabel?: string;
  /** Oda panolarının sıra bazlı enleri ve ortak gövde ölçüleri [mm]. */
  panelWidthsMm?: readonly number[];
  panelHeightMm?: number;
  panelDepthMm?: number;
  panelBaseHeightMm?: number;
}

const W = 700;
const ROOM_W = 840;
const H = 360;

/**
 * ÇİZİM KABULLERİ — girdi değil, ölçek için. Bunlar hesaba GİRMEZ; yalnız
 * kesitteki nesnelerin mahal yüksekliğine oranını verir ki "bu odaya kaç pano
 * sığar" sorusu şekilden okunabilsin. Bu yüzden etikete de yazılmazlar:
 * yazılsalardı hesaplanmış bir ölçüymüş gibi okunurdu.
 */
const PANEL_H_M = 2.0;   // tipik pano dolabı yüksekliği
const PANEL_W_M = 0.8;   // tipik pano gözü genişliği
const DOOR_H_M = 2.0;    // tipik kapı yüksekliği
const PERSON_H_M = 1.75; // ayakta insan boyu

/** Yük kalemi: etiket, değer, renk. */
interface Item {
  label: string;
  kw: number;
  fill: string;
}

/** Yuvarlak uçlu kalın çizgi — insan figürünün uzuvları. */
function limb(x1: number, y1: number, x2: number, y2: number, w: number): LineEl {
  return { kind: "line", x1, y1, x2, y2, stroke: DCOL.ink, strokeWidth: w, cap: "round" };
}

/**
 * Ayakta duran insan silueti — GERÇEK BOYDA.
 *
 * Çöp adam kesitte ölçek vermiyordu: 2,4 m'lik kabinde 25 px'lik bir figür
 * mahalin ne kadarını doldurduğunu göstermiyor. Figür artık 1,75 m'lik bir
 * insanın mahal yüksekliğine oranından ölçeklenir ve klasik 7,5 baş
 * oranlarıyla çizilir (baş · omuz · kalça · bacak), böylece "bu kabine iki
 * kişi sığar mı" sorusu şemadan okunur.
 */
function person(els: DiagramEl[], cx: number, footY: number, h: number) {
  const headR = h * 0.057;
  const topY = footY - h;
  const shoulderY = topY + h * 0.175;
  const hipY = topY + h * 0.50;
  const shoulderHalf = h * 0.098;
  const hipHalf = h * 0.068;

  els.push({ kind: "circle", cx, cy: topY + headR * 1.15, r: headR, fill: DCOL.ink });
  // boyun
  els.push(limb(cx, topY + headR * 1.9, cx, shoulderY, h * 0.032));
  // gövde — omuzdan kalçaya daralan silüet
  els.push({
    kind: "polygon",
    points: [
      [cx - shoulderHalf, shoulderY],
      [cx + shoulderHalf, shoulderY],
      [cx + hipHalf, hipY],
      [cx - hipHalf, hipY],
    ],
    fill: DCOL.ink,
  });
  // kollar — omuzdan kalça hizasına, gövdeye yakın (yana açılmış kollar
  // figürü gerçek insandan geniş gösteriyordu)
  els.push(limb(cx - shoulderHalf * 0.85, shoulderY + h * 0.015, cx - shoulderHalf * 1.08, hipY + h * 0.05, h * 0.034));
  els.push(limb(cx + shoulderHalf * 0.85, shoulderY + h * 0.015, cx + shoulderHalf * 1.08, hipY + h * 0.05, h * 0.034));
  // bacaklar — kalçadan tabana
  els.push(limb(cx - hipHalf * 0.5, hipY, cx - hipHalf * 0.7, footY, h * 0.046));
  els.push(limb(cx + hipHalf * 0.5, hipY, cx + hipHalf * 0.7, footY, h * 0.046));
}

/** Figürün kolları dâhil yarı genişliği — yerleştirme bununla yapılır. */
function personHalfWidth(h: number): number {
  return h * 0.098 * 1.08 + h * 0.017;
}

export function climateRoomDiagram(p: ClimateRoomParams): Diagram {
  const els: DiagramEl[] = [];
  caption(
    els,
    `${p.title.toLocaleUpperCase("tr")} · ISI YÜKÜ ŞEMASI`,
    `${fmtN(p.lengthM, 2)} × ${fmtN(p.widthM, 2)} × ${fmtN(p.heightM, 2)} m · ` +
      `${p.outdoor ? "Açık Hava" : "Kapalı Mahal"} · Ortam ${fmtN(p.ambientTempC, 0)} °C / %${fmtN(p.ambientRhPct, 0)}`
  );

  // ---------------------------------------------------------------- mahal kutusu
  // Oranlar korunur; kutu sabit bir alana sığdırılır.
  const boxMaxW = 300;
  const boxMaxH = 168;
  const ratio = p.heightM > 0 && p.lengthM > 0 ? p.heightM / p.lengthM : 0.6;
  let bw = boxMaxW;
  let bh = bw * ratio;
  if (bh > boxMaxH) { bh = boxMaxH; bw = bh / ratio; }
  // SOL ŞERİT: iletim oku ve etiketi buraya sığmalı ("İletim 0,00 kW" ≈ 75 px
  // + ok 46 px). Dar bırakılırsa etiket duvarın üstüne biner.
  const bx = 140;
  const by = 70;
  const boxRight = bx + bw;
  const boxBottom = by + bh;
  /** Metrenin piksel karşılığı — içerideki her şey bununla ölçeklenir. */
  const pxPerM = p.heightM > 0 ? bh / p.heightM : 0;
  const pxPerLengthM = p.lengthM > 0 ? (bw - 14) / p.lengthM : 0;
  const hasRoomPanelLayout =
    Array.isArray(p.panelWidthsMm) && p.panelWidthsMm.length > 0;
  const panelBodyHeightM = (p.panelHeightMm ?? PANEL_H_M * 1000) / 1000;
  const panelBaseHeightM = (p.panelBaseHeightMm ?? 0) / 1000;
  const panelOverallHeightM = panelBodyHeightM + panelBaseHeightM;
  // Elektrik odasının yan görünüşü ön görünüşün SAĞINDA yer alır. Geometri
  // burada bir kez kurulur; hem çizim hem klima yerleşimi aynı sınırları okur.
  const sideLayout = (() => {
    if (!hasRoomPanelLayout) return undefined;
    const sideMaxW = 170;
    const sideMaxH = 116;
    const sideRatio = p.widthM > 0 ? p.heightM / p.widthM : 0.8;
    let sideW = sideMaxW;
    let sideH = sideW * sideRatio;
    if (sideH > sideMaxH) {
      sideH = sideMaxH;
      sideW = sideH / Math.max(sideRatio, 0.001);
    }
    const sideX = boxRight + 36;
    const sideY = by;
    return {
      sideX,
      sideY,
      sideW,
      sideH,
      sideRight: sideX + sideW,
      sideBottom: sideY + sideH,
    };
  })();

  if (hasRoomPanelLayout) {
    els.push(txt(bx, by - 31, "ÖN GÖRÜNÜŞ", 8.5, { fill: DCOL.muted, bold: true }));
  }

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
  for (let x = bx + 6; x < boxRight - 6; x += 9) {
    els.push(ln(x, by + 1.5, x + 4.5, by + t - 1.5, DCOL.faint, 0.6));
  }
  const innerTop = by + t;
  const floorY = boxBottom - t;

  // ZARF ETİKETLERİ KUTUNUN ÜSTÜNDE. İç koşullar eskiden kutunun ORTASINA
  // yazılıyordu; içerik gerçek boyuna çıkınca (2 m'lik pano 2,6 m'lik odada)
  // panolar yazının üstünü örttü. Mahalin içi artık yalnız MAHALİN İÇİNDEKİLERE
  // ayrılmıştır.
  const insLabel = `Taş Yünü ${fmtN(p.insulationMm, 0)} mm`;
  const inLabel = `İç ${fmtN(p.roomTempC, 0)} °C · %${fmtN(p.roomRhPct, 0)} Bağıl Nem`;
  if (bw >= 210) {
    // Geniş kutu: yalıtım solda, iç koşul sağda — tek satır.
    els.push(txt(bx + 2, by - 9, insLabel, 8.5, { fill: DCOL.muted }));
    els.push(txt(boxRight - 2, by - 9, inLabel, 8.5, { anchor: "end", fill: DCOL.ink }));
  } else {
    // Dar kutu (kabin): iki satır, ortalanmış.
    els.push(txt(bx + bw / 2, by - 21, insLabel, 8.5, { anchor: "middle", fill: DCOL.muted }));
    els.push(txt(bx + bw / 2, by - 9, inLabel, 8.5, { anchor: "middle", fill: DCOL.ink }));
  }

  // ---------------------------------------------------------------- kapı
  // Elektrik odasının ön görünüşü yalnız pano dizisini anlatır; kapı ısı
  // hesabında gerçek ölçüsüyle kalır fakat burada şematik olarak çizilmez.
  // Operatör kabini gibi öteki mahaller eski kapı göstergesini korur.
  const belowY = boxBottom + 13;
  const inner1 = bx + t;
  const inner2 = boxRight - t;
  if (p.doorCount > 0 && !hasRoomPanelLayout) {
    const doorHeightM = DOOR_H_M;
    const dh = Math.min(bh - 2 * t - 6, Math.max(26, doorHeightM * pxPerM));
    const dw = 5;
    els.push({
      kind: "rect", x: bx + t - 1,
      y: floorY - dh, w: dw, h: dh,
      fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(
      txt(inner1, belowY, `${fmtN(p.doorCount, 0)} ${p.doorLabel ?? "Kapı"}`, 8, {
        fill: DCOL.muted, push: "down",
      })
    );
  }

  // ---------------------------------------------------------------- cam
  if (p.glazingAreaM2 > 0) {
    const gh = Math.min(bh - 2 * t - 10, 52);
    const gy = innerTop + 40;
    els.push({
      kind: "rect", x: boxRight - t - 4, y: gy, w: 5, h: gh,
      fill: "#DCEAF2", stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(ln(boxRight - t - 4, gy + gh / 3, boxRight - t + 1, gy + gh / 3, DCOL.faint, 0.7));
    // Cam etiketi kutunun ALTINDA: içeride operatör figürünün, sağda ise
    // klima şeridinin altında kalıyordu.
    els.push(
      txt(inner2, boxBottom + 13, `Cam ${fmtN(p.glazingAreaM2, 1)} m²`, 8, {
        anchor: "end", fill: DCOL.muted, push: "down",
      })
    );
  }

  // ---------------------------------------------- mahalin içindekiler (zeminde)
  // Etiketler kutunun ALTINA yazılır — duvarın üstüne binmesin.

  // Panolar: yan yana dolaplar. Adet verilmezse tek bir genel konsol.
  const cabCount = Math.max(0, Math.floor(p.deviceCount ?? 0));
  const cabH = Math.min(
    bh - 2 * t - 8,
    Math.max(22, (hasRoomPanelLayout ? panelOverallHeightM : PANEL_H_M) * pxPerM)
  );
  const baseH = hasRoomPanelLayout
    ? Math.min(cabH, Math.max(3, panelBaseHeightM * pxPerM))
    : 0;
  let deviceLeft: number;
  let deviceRight: number;
  if (cabCount > 0) {
    // Oda görünüşünde pano enleri gerçek ölçekte, öteki mahallerde nominal
    // 0,8 m'lik eşit gözlerdir. Sığmıyorsa yalnız çizim okunabilirliği için
    // mevcut zemine oransal daraltılır; hesap satırı gerçek toplamı korur.
    const gap = 2.5;
    const avail = (inner2 - inner1) * (hasRoomPanelLayout ? 0.68 : 0.62);
    const widths = hasRoomPanelLayout
      ? Array.from({ length: cabCount }, (_, index) =>
          Math.max(6, ((p.panelWidthsMm?.[index] ?? 800) / 1000) * pxPerLengthM)
        )
      : Array.from({ length: cabCount }, () =>
          Math.max(6, PANEL_W_M * ((bw - 2 * t) / Math.max(p.lengthM, 0.001)))
        );
    const rawTotal = widths.reduce((sum, width) => sum + width, 0) + gap * (cabCount - 1);
    const scale = rawTotal > avail ? avail / rawTotal : 1;
    const drawnWidths = widths.map((width) => width * scale);
    const total = drawnWidths.reduce((sum, width) => sum + width, 0) + gap * (cabCount - 1);
    deviceRight = inner2 - 6;
    deviceLeft = deviceRight - total;
    let panelX = deviceLeft;
    for (let i = 0; i < cabCount; i++) {
      const wCab = drawnWidths[i];
      const x = panelX;
      els.push({
        kind: "rect", x, y: floorY - cabH, w: wCab, h: cabH - baseH,
        fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 0.9,
      });
      if (baseH > 0) {
        els.push({
          kind: "rect", x, y: floorY - baseH, w: wCab, h: baseH,
          fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 0.9,
        });
      }
      // Kapak kolu + havalandırma çizgileri — dolap olduğu okunsun
      els.push(ln(x + wCab - 2.5, floorY - cabH * 0.58, x + wCab - 2.5, floorY - cabH * 0.45, DCOL.ink, 0.9));
      for (let k = 1; k <= 3; k++) {
        const yy = floorY - cabH + (cabH - baseH) * (0.16 * k);
        els.push(ln(x + 2, yy, x + wCab - 4, yy, DCOL.muted, 0.5));
      }
      if (hasRoomPanelLayout && wCab >= 18) {
        els.push(txt(x + wCab / 2, floorY - cabH - 5,
          `P${i + 1} · ${fmtN(p.panelWidthsMm?.[i] ?? 800, 0)}`, 7, {
            anchor: "middle", fill: DCOL.muted,
          }));
      }
      panelX += wCab + gap;
    }
    els.push(
      txt((deviceLeft + deviceRight) / 2, belowY,
        hasRoomPanelLayout
          ? `${fmtN(cabCount, 0)} ${p.deviceLabel ?? "Pano"} · H ${fmtN(p.panelHeightMm ?? 1800, 0)} + ${fmtN(p.panelBaseHeightMm ?? 0, 0)} Baza mm`
          : `${fmtN(cabCount, 0)} ${p.deviceLabel ?? "Pano"}`,
        8, {
        anchor: "middle", fill: DCOL.muted, push: "down",
      })
    );
  } else {
    const eqW = Math.min(52, (inner2 - inner1) * 0.34);
    const eqH = Math.min(bh - 2 * t - 8, Math.max(20, 0.9 * pxPerM));
    deviceRight = inner2 - 8;
    deviceLeft = deviceRight - eqW;
    els.push({
      kind: "rect", x: deviceLeft, y: floorY - eqH, w: eqW, h: eqH,
      fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 1,
    });
    for (let k = 1; k <= 2; k++) {
      const yy = floorY - eqH + (eqH / 3) * k;
      els.push(ln(deviceLeft + 5, yy, deviceRight - 5, yy, DCOL.muted, 0.7));
    }
    els.push(
      txt((deviceLeft + deviceRight) / 2, belowY, "Cihazlar", 8, {
        anchor: "middle", fill: DCOL.muted, push: "down",
      })
    );
  }

  // Operatörler — cihazların SOLUNDA kalan SERBEST ZEMİNE eşit aralıklarla,
  // gerçek boyla (1,75 m). Kişiler zemine dizilir; kalan yer dar ise omuz omuza
  // gelirler — 1,8 m'lik bir kabinde gerçekte olan da budur ve şemanın söylediği
  // şey tam olarak budur.
  if (p.occupantCount > 0) {
    const ph = Math.min(bh - 2 * t - 6, Math.max(26, PERSON_H_M * pxPerM));
    const n = Math.min(p.occupantCount, 3);
    const freeL = inner1 + 3;
    const freeR = deviceLeft - 5;
    const slot = Math.max((freeR - freeL) / n, personHalfWidth(ph));
    const cxOf = (i: number) => freeL + slot * (i + 0.5);
    for (let i = 0; i < n; i++) person(els, cxOf(i), floorY, ph);
    els.push(
      txt((cxOf(0) + cxOf(n - 1)) / 2, belowY, `${fmtN(p.occupantCount, 0)} Operatör`, 8, {
        anchor: "middle", fill: DCOL.muted, push: "down",
      })
    );
  }

  // ---------------------------------------------------------------- ısı okları
  /**
   * Zarfa dışarıdan giren yük oku. Etiket okun KUYRUK tarafına, çizimden
   * DIŞARI doğru yazılır: ok yönünün tersine yazmak etiketi kutunun üstüne
   * bindiriyordu.
   */
  const heatArrow = (
    x1: number, y1: number, x2: number, y2: number,
    label: string, kw: number,
    labelPos: { x: number; y: number; anchor: "start" | "middle" | "end" }
  ) => {
    if (!(kw > 0)) return;
    els.push(ln(x1, y1, x2, y2, DCOL.accent, 1.6));
    const dir = Math.abs(x2 - x1) > Math.abs(y2 - y1)
      ? (x2 > x1 ? "right" : "left")
      : (y2 > y1 ? "down" : "up");
    els.push(arrowHead(x2, y2, dir as "left" | "right" | "up" | "down", DCOL.accent, 8, 3.2));
    els.push(
      txt(labelPos.x, labelPos.y, `${label} ${fmtN(kw, 2)} kW`, 8.5, {
        anchor: labelPos.anchor, fill: DCOL.accent, leaderTo: [x2, y2],
      })
    );
  };

  // İletim — sol duvardan içeri (etiket sol şeritte)
  const condY = by + bh * 0.55;
  heatArrow(bx - 52, condY, bx - 3, condY, "İletim", p.transmissionKw,
    { x: bx - 58, y: condY + 3, anchor: "end" });

  // Güneş — çatıdan (yalnız açık havada). Güneş simgesi sağ üstte, yalıtım
  // etiketinin dışında kalır.
  if (p.outdoor && p.solarKw > 0) {
    const sx = bx + bw * 0.74;
    const sunX = boxRight + 26;
    const sunY = by - 34;
    els.push({ kind: "circle", cx: sunX, cy: sunY, r: 7, fill: "#F2C94C" });
    for (let a = 0; a < 8; a += 1) {
      const ang = (a * Math.PI) / 4;
      els.push(ln(
        sunX + Math.cos(ang) * 10, sunY + Math.sin(ang) * 10,
        sunX + Math.cos(ang) * 14, sunY + Math.sin(ang) * 14,
        "#F2C94C", 1.2
      ));
    }
    heatArrow(sx, by - 30, sx, by - 3, "Güneş", p.solarKw,
      { x: sx + 8, y: by - 20, anchor: "start" });
  }

  // Işınım — ALTTAN. Fiziksel olarak da doğru yer: yakındaki sıcak yüzey
  // (platform altı) ışınımı tabandan gelir. Sağ şerit klimaya ayrıldı.
  if (p.radiationKw > 0) {
    const rx = bx + bw * 0.28;
    heatArrow(rx, boxBottom + 46, rx, boxBottom + 3, "Işınım", p.radiationKw,
      { x: rx - 6, y: boxBottom + 44, anchor: "end" });
  }

  // ---------------------------------------------------------------- klima ünitesi
  // SAĞ ŞERİT: kutu ile klima arasındaki boşluk debi etiketlerinin genişliğine
  // göre seçilir — "Üfleme 1.212 m³/h" ≈ 105 px.
  const gapAc = hasRoomPanelLayout ? 92 : 128;
  const acW = 60;
  const acH = 46;
  const acX = (sideLayout?.sideRight ?? boxRight) + gapAc;
  const acY = sideLayout
    // Yan görünüşün ölçü zinciri sideBottom + 18 seviyesindedir. Klima
    // hava oklarını bunun da altına alarak iki anlatımın kesişmesini önle.
    ? Math.max(boxBottom - acH - 6, sideLayout.sideBottom + 44)
    : boxBottom - acH - 6;
  const midX = (boxRight + acX) / 2;
  let contentBottom = Math.max(
    boxBottom,
    acY + acH,
    hasRoomPanelLayout && p.radiationKw > 0 ? boxBottom + 50 : boxBottom
  );
  els.push({
    kind: "rect", x: acX, y: acY, w: acW, h: acH,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
  });
  els.push(txt(acX + acW / 2, acY + 20, "KLİMA", 9, { anchor: "middle", bold: true }));
  els.push(
    txt(acX + acW / 2, acY + 33, `${fmtN(p.totalKw, 2)} kW`, 9, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    })
  );
  // Üfleme (mahalle) — etiket okun ÜSTÜNDE, iki kutunun tam ortasında
  const supplyY = acY + 13;
  els.push(ln(acX, supplyY, boxRight + 6, supplyY, DCOL.ink, 1.3));
  els.push(arrowHead(boxRight + 4, supplyY, "left", DCOL.ink, 7, 2.8));
  els.push(
    txt(midX, supplyY - 5, `Üfleme ${fmtN(p.airFlowM3h, 0)} m³/h`, 8, {
      anchor: "middle", fill: DCOL.muted,
    })
  );
  // Dönüş (mahalden) — etiket okun ALTINDA
  const returnY = acY + acH - 10;
  els.push(ln(boxRight + 6, returnY, acX, returnY, DCOL.faint, 1.1, "4,3"));
  els.push(arrowHead(acX - 2, returnY, "right", DCOL.faint, 7, 2.8));
  els.push(txt(midX, returnY + 10, "Dönüş", 8, { anchor: "middle", fill: DCOL.muted }));

  // Taze hava — dışarıdan klimaya (etiket ünitenin üstünde)
  els.push(ln(acX + acW / 2, acY - 30, acX + acW / 2, acY - 2, DCOL.muted, 1.2));
  els.push(arrowHead(acX + acW / 2, acY, "down", DCOL.muted, 7, 2.8));
  els.push(
    txt(acX + acW / 2, acY - 36, `Taze Hava ${fmtN(p.freshAirM3h, 1)} m³/h`, 8, {
      anchor: "middle", fill: DCOL.muted,
    })
  );

  // Dış koşul — SOL ŞERİDİN üstünde, kutunun dışında
  els.push(
    txt(bx - 14, by + 12, `Dış Ortam ${fmtN(p.ambientTempC, 0)} °C`, 8.5, {
      anchor: "end", fill: DCOL.muted,
    })
  );

  // ---------------------------------------------------------- oda yan görünüşü
  // Yalnız gerçek pano ölçüleri bulunan elektrik odasında çizilir. Panolar
  // bir duvara yaslanır; karşı duvar ile pano yüzü arasındaki net mesafe
  // kullanıcının oda içindeki yürüme/servis koridorudur.
  if (sideLayout) {
    const { sideX, sideY, sideW, sideH, sideRight, sideBottom } = sideLayout;
    const sideT = 6;
    const sideInnerLeft = sideX + sideT;
    const sideInnerRight = sideRight - sideT;
    const sideFloor = sideBottom - sideT;
    const sidePxPerHeightM = p.heightM > 0 ? (sideH - 2 * sideT) / p.heightM : 0;
    const sidePxPerWidthM = p.widthM > 0 ? (sideW - 2 * sideT) / p.widthM : 0;
    const depthM = (p.panelDepthMm ?? 600) / 1000;
    const panelDepthPx = Math.min(
      sideInnerRight - sideInnerLeft,
      Math.max(8, depthM * sidePxPerWidthM)
    );
    const overallPanelH = Math.min(
      sideH - 2 * sideT,
      Math.max(18, panelOverallHeightM * sidePxPerHeightM)
    );
    const sideBaseH = Math.min(
      overallPanelH,
      Math.max(3, panelBaseHeightM * sidePxPerHeightM)
    );
    const panelFaceX = sideInnerRight - panelDepthPx;

    els.push(txt(sideX, sideY - 10, "YAN GÖRÜNÜŞ", 8.5, {
      fill: DCOL.muted, bold: true,
    }));
    els.push({
      kind: "rect", x: sideX, y: sideY, w: sideW, h: sideH,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
    });
    els.push({
      kind: "rect", x: sideInnerLeft, y: sideY + sideT,
      w: sideW - 2 * sideT, h: sideH - 2 * sideT,
      fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 0.8,
    });
    els.push({
      kind: "rect", x: panelFaceX, y: sideFloor - overallPanelH,
      w: panelDepthPx, h: overallPanelH - sideBaseH,
      fill: DCOL.line, stroke: DCOL.ink, strokeWidth: 0.9,
    });
    els.push({
      kind: "rect", x: panelFaceX, y: sideFloor - sideBaseH,
      w: panelDepthPx, h: sideBaseH,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 0.9,
    });
    els.push(txt((panelFaceX + sideInnerRight) / 2, sideFloor - overallPanelH - 5,
      `Pano D ${fmtN(p.panelDepthMm ?? 600, 0)} mm`, 7.5, {
        anchor: "middle", fill: DCOL.muted,
      }));

    // Yürüme mesafesi ölçü zinciri — çift ok, pano yüzü ile karşı duvar arası.
    const dimY = sideBottom + 18;
    els.push(ln(sideInnerLeft, dimY, panelFaceX, dimY, DCOL.accent, 1));
    els.push(arrowHead(sideInnerLeft, dimY, "left", DCOL.accent, 6, 2.4));
    els.push(arrowHead(panelFaceX, dimY, "right", DCOL.accent, 6, 2.4));
    els.push(ln(sideInnerLeft, sideFloor, sideInnerLeft, dimY + 4, DCOL.faint, 0.7));
    els.push(ln(panelFaceX, sideFloor, panelFaceX, dimY + 4, DCOL.faint, 0.7));
    const walkingMm = p.widthM * 1000 - (p.panelDepthMm ?? 600);
    els.push(txt((sideInnerLeft + panelFaceX) / 2, dimY - 5,
      `Yürüme Mesafesi ${fmtN(walkingMm, 0)} mm`, 8, {
        anchor: "middle", fill: DCOL.accent, bold: true,
      }));
    els.push(txt(sideRight + 10, sideY + 14,
      `Oda B ${fmtN(p.widthM * 1000, 0)} mm`, 7.5, { fill: DCOL.muted }));

    contentBottom = Math.max(contentBottom, dimY + 10);
  }

  // ---------------------------------------------------------------- yük çubuğu
  const items: Item[] = [
    { label: "İletim", kw: p.transmissionKw, fill: "#8A8480" },
    { label: "Güneş", kw: p.solarKw, fill: "#F2C94C" },
    { label: "Işınım", kw: p.radiationKw, fill: "#E2A05A" },
    { label: "Cihaz", kw: p.deviceHeatKw, fill: "#A41E1E" },
    { label: "Operatör", kw: p.occupantKw, fill: "#5B8C7B" },
    { label: "Taze Hava", kw: p.freshAirKw, fill: "#4A7A96" },
  ].filter((i) => i.kw > 0);

  const sum = items.reduce((a, i) => a + i.kw, 0);
  const barX = 96;
  // Çubuk, kesitin ALTINDAKİ en alçak öğeden sonra başlar: ışınım oku ve
  // içerik etiketleri oraya iniyor.
  const barY = Math.max(262, contentBottom + (hasRoomPanelLayout ? 34 : (p.radiationKw > 0 ? 78 : 52)));
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
      // Dilim dar ise ETİKET DÜŞER ama YÜZDE KALIR: renkli bir blok tek
      // başına hiçbir şey söylemiyordu, kalemin adı zaten lejantta duruyor.
      const pct = `%${fmtN((it.kw / sum) * 100, 0)}`;
      const inner = w > 62 ? `${it.label} ${pct}` : w > 24 ? pct : "";
      if (inner) {
        els.push(
          txt(x + w / 2, barY + 13.5, inner, 8, {
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
      lx += 92;
    }
  }
  els.push(
    txt(barX + barW + 8, barY + 14, `Σ ${fmtN(p.totalKw, 2)} kW`, 10, {
      fill: DCOL.accent, bold: true, fixed: true,
    })
  );
  els.push(
    txt(barX + barW + 8, barY + 26, "Emniyet Katsayısı Dâhil", 7.5, {
      fill: DCOL.muted, fixed: true,
    })
  );

  return fitDiagram(
    els,
    hasRoomPanelLayout ? ROOM_W : W,
    hasRoomPanelLayout ? Math.max(370, barY + 72) : H
  );
}
