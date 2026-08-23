// Ana kiriş kutu kesiti — parametrik SVG üretici (7.1 bölümü).
// GirderInputs plaka girdilerinden ölçekli kesit çizer: üst/alt başlık
// plakaları, çift gövde sacı, ek flanş, ray; t1..t6 etiketleri, b/h ölçü
// okları, hesaplanan tarafsız eksen (Cz yatay, Cy düşey — kırmızı kesikli).
//
// Kesit yerleşimi (`layoutBoxSection`) ve plaka/ray çizimi (`pushBoxPlates`,
// `pushRail`) dışa aktarılır: gerilme diyagramı (girderStress.ts) AYNI
// parametrik kesiti kullanır, ikinci bir şematik kutu çizilmez.

import { FIELD_GROUPS } from "@/lib/calc/field-groups";
import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, dimV, fitDiagram, fmtN, ln, txt,
} from "./model";

/** Kutu kesitin plaka ölçüleri [mm] — kesit ve gerilme diyagramlarının ortak girdisi. */
export interface BoxPlateDims {
  railHeightMm: number;
  t1Mm: number; b1Mm: number;   // üst flanş (ray altı sacı)
  t2Mm: number; b2Mm: number;   // üst iç flanş
  t3Mm: number; h3Mm: number;   // ana gövde sacı
  t4Mm: number;                 // yardımcı gövde sacı
  t5Mm: number; b5Mm: number;   // alt flanş
  t6Mm: number; b6Mm: number;   // ek flanş
  aMm: number;                  // gövde sacları arası mesafe
  xMm: number;                  // kenar mesafesi (b2 sol kenarından)
  /**
   * Ray altı T PROFİLİ (opsiyonel, büyük tonajlı vinçler). Kutunun üstünde,
   * ray ekseninde durur ve kesitin ÜST BÖLÜMÜNÜN İÇİNE girer — kirişin
   * üstüne OTURMAZ:
   *   · T üst sacı, üst iç flanşla (t2) AYNI SEVİYEDEDİR ve b2'yi kendi
   *     genişliği kadar keser
   *   · T yan sacı onun altından iner, ana gövde sacı (t3) o kadar kısalır
   *   · ray altı sacı (t1/b1) İPTALDİR — rayı T'nin üst sacı taşır
   * Toplam yükseklik DEĞİŞMEZ. Ölçüler verilmezse çizim bugünkü hâlindedir.
   */
  tProfileOn?: boolean;
  tWebThkMm?: number;
  tWebHeightMm?: number;
  tTopThkMm?: number;
  tTopWidthMm?: number;
}

/**
 * Kesitteki T profilin çözülmüş ölçüleri. Motorun `railTProfile()` kuralıyla
 * AYNI şartı uygular: anahtar açık VE dört ölçü de pozitif olmalıdır — yarım
 * bir T çizilirse resim hesaptan başka bir kesit gösterirdi.
 */
export function tProfileDims(p: BoxPlateDims) {
  const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  const webThk = num(p.tWebThkMm);
  const webH = num(p.tWebHeightMm);
  const topThk = num(p.tTopThkMm);
  const topW = num(p.tTopWidthMm);
  const present =
    p.tProfileOn === true && webThk > 0 && webH > 0 && topThk > 0 && topW > 0;
  return {
    webThk: present ? webThk : 0,
    webH: present ? webH : 0,
    topThk: present ? topThk : 0,
    topW: present ? topW : 0,
    present,
  };
}

export interface GirderSectionParams extends BoxPlateDims {
  /** Tarafsız eksen — alttan Cz [mm] (hesaplanmışsa) */
  czMm?: number;
  /** Tarafsız eksen — b2 sol kenarından Cy [mm] (hesaplanmışsa) */
  cyMm?: number;
  /** Kesit şemasının sağındaki temel mühendislik özeti. */
  spanM?: number;
  areaCm2?: number;
  weightPerM?: number;
  iyyCm4?: number;
  approxGirderWeightKg?: number;
}

/** Piksel cinsinden çözülmüş kesit yerleşimi. */
export interface BoxLayout {
  s: number;             // ölçek [px/mm]
  /** ÇERÇEVE merkezi (zarfın ortası) — T flanşı taşarsa b2 merkezinden farklıdır */
  cx: number;
  /** b2 sacının MERKEZİ — alt/ek flanşlar buna göre ortalanır */
  plateCx: number;
  b2Left: number;
  web1X: number;         // ana gövde sacı sol yüzü
  web2X: number;         // yardımcı gövde sacı sol yüzü
  railCx: number;        // ray ekseni [px]
  railCenterYMm: number; // ray ekseni = b2 sol kenarından (x + t3/2) [mm]
  yB: number;            // kesit alt kenarı
  y6: number; y5: number; yWebBottom: number; y2: number; y1: number;
  /** ANA gövde sacının üstü — T profil varsa T'nin yan sacı kadar aşağıdadır */
  yWebTop: number;
  /** Gövde BÖLGESİNİN üstü (h3'ün tepesi); dış yan sac buradan başlar */
  yWebZoneTop: number;
  /** T profil yan sacının ÜST ucu (= T üst sacının alt yüzü); T yoksa y1 */
  yTWebTop: number;
  /** Kesitin en üstü — ray bu kotta oturur */
  yTop: number;
  railTop: number;       // ray mantarı üstü
  /** Çözülmüş T profil ölçüleri [mm] */
  t: ReturnType<typeof tProfileDims>;
  /** Ray altı sacının ÇİZİLECEK ölçüleri — T profil varsa 0 (iptal) */
  t1Mm: number;
  b1Mm: number;
  totalHMm: number;
  maxBMm: number;
  railHMm: number;
}

/** Çizim alanı tanımı (piksel). */
export interface BoxLayoutArea {
  cx: number;       // kesit merkezinin x'i
  drawW: number;    // ölçek için kullanılabilir genişlik
  drawH: number;    // ölçek için kullanılabilir yükseklik (ray dahil)
  areaTop: number;  // alanın üst y'si (dikey ortalama için)
  areaH: number;    // alanın yüksekliği
}

/**
 * Plaka ölçülerinden piksel yerleşimini çözer. Kesit geçersizse (yükseklik ya
 * da genişlik sıfır) `null` döner — çağıran uyarı metnini kendisi basar.
 */
export function layoutBoxSection(p: BoxPlateDims, a: BoxLayoutArea): BoxLayout | null {
  const t = tProfileDims(p);
  // T PROFİL VARKEN RAY ALTI SACI İPTALDİR (motorla aynı kural).
  const t1Mm = t.present ? 0 : p.t1Mm;
  const b1Mm = t.present ? 0 : p.b1Mm;
  // TOPLAM YÜKSEKLİK DEĞİŞMEZ: T profil kesitin İÇİNE girer, üstüne eklenmez.
  const totalHMm = t1Mm + p.t2Mm + p.h3Mm + p.t5Mm + p.t6Mm;
  // Kesitin YATAY ZARFI: plakalar b2'ye göre ortalanır ama T profilin üst sacı
  // ray ekseninde durur ve iki yana da TAŞABİLİR (özellikle sola — ray kesitin
  // sol yanındadır). Ölçek yalnız b2'ye bakarsa taşan flanş çerçeve dışında
  // kalır; zarf bu yüzden gerçek uçlardan hesaplanır.
  const railCenterYMm = p.xMm + p.t3Mm / 2;
  const spanLeftMm = Math.min(
    0,
    (p.b2Mm - p.b5Mm) / 2,
    (p.b2Mm - p.b6Mm) / 2,
    t.present ? railCenterYMm - t.topW / 2 : 0
  );
  const spanRightMm = Math.max(
    p.b2Mm,
    (p.b2Mm + p.b5Mm) / 2,
    (p.b2Mm + p.b6Mm) / 2,
    t.present ? railCenterYMm + t.topW / 2 : 0
  );
  const maxBMm = spanRightMm - spanLeftMm;
  if (!(totalHMm > 0) || !(maxBMm > 0)) return null;

  const railHMm = Math.max(0, p.railHeightMm);
  const s = Math.min(a.drawW / maxBMm, a.drawH / (totalHMm + railHMm));
  const contentH = (totalHMm + railHMm) * s;
  const yB = a.areaTop + (a.areaH - contentH) / 2 + contentH;

  const y6 = yB - p.t6Mm * s;
  const y5 = y6 - p.t5Mm * s;
  const yWebBottom = y5;
  // GÖVDE BÖLGESİ (h3) — dış yan sac tam boy burayı doldurur.
  const yWebZoneTop = y5 - p.h3Mm * s;
  const y2 = yWebZoneTop - p.t2Mm * s;   // üst iç flanşın üst yüzü
  const y1 = y2 - t1Mm * s;              // kesitin en üstü (T varken = y2)
  // T profilin üst sacı üst iç flanşla AYNI SEVİYEDE başlar (kesitin üstü);
  // yan sacı onun altından iner ve ANA gövde sacı o kotun ALTINDA kalır.
  const yTop = y1;
  const yTWebTop = yTop + t.topThk * s;
  const yWebTop = t.present ? yTWebTop + t.webH * s : yWebZoneTop;

  // b2Left, mm ölçüsündeki y = 0 noktasının pikseldeki karşılığıdır (b2'nin
  // nominal sol kenarı). Çerçeve zarfa göre ortalanır.
  const b2Left = a.cx - (maxBMm * s) / 2 - spanLeftMm * s;
  const web1X = b2Left + p.xMm * s;
  const web2X = b2Left + (p.xMm + p.t3Mm + p.aMm) * s;
  // Ray ana gövde sacı (web1) ekseninde durur; b1 "ray altı sacı" da bu eksende
  const railCx = b2Left + railCenterYMm * s;

  return {
    s, cx: a.cx, plateCx: b2Left + (p.b2Mm * s) / 2, b2Left, web1X, web2X, railCx, railCenterYMm,
    yB, y6, y5, yWebTop, yWebZoneTop, yWebBottom, y2, y1, yTWebTop, yTop,
    railTop: yTop - railHMm * s,
    t, t1Mm, b1Mm,
    totalHMm, maxBMm, railHMm,
  };
}

/** Kesit plakalarını çizer (alttan üste). b1, RAY EKSENİNDE ortalanır. */
export function pushBoxPlates(els: DiagramEl[], p: BoxPlateDims, g: BoxLayout) {
  const plate = (x: number, y: number, w: number, h: number): DiagramEl => ({
    kind: "rect", x, y, w, h,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  const s = g.s;
  if (p.t6Mm > 0 && p.b6Mm > 0) els.push(plate(g.plateCx - (p.b6Mm * s) / 2, g.y6, p.b6Mm * s, p.t6Mm * s));
  if (p.t5Mm > 0 && p.b5Mm > 0) els.push(plate(g.plateCx - (p.b5Mm * s) / 2, g.y5, p.b5Mm * s, p.t5Mm * s));
  // ANA GÖVDE SACI, T profilin yan sacı kadar KISALIR (üstten).
  const mainWebH = g.yWebBottom - g.yWebTop;
  if (p.t3Mm > 0 && mainWebH > 0) els.push(plate(g.web1X, g.yWebTop, p.t3Mm * s, mainWebH));
  // Dış (yardımcı) gövde sacı TAM BOY kalır.
  if (p.t4Mm > 0 && p.h3Mm > 0) els.push(plate(g.web2X, g.yWebZoneTop, p.t4Mm * s, p.h3Mm * s));
  // ÜST İÇ FLANŞ, T PROFİLİN SAĞ UCUNDAN BAŞLAR — T'nin solunda b2 parçası
  // YOKTUR (kullanıcı düzeltmesi). T yokken plaka tam boy çizilir.
  if (p.t2Mm > 0 && p.b2Mm > 0) {
    const left = g.b2Left;
    const right = left + p.b2Mm * s;
    const start = g.t.present
      ? Math.min(right, Math.max(left, g.railCx + (g.t.topW * s) / 2))
      : left;
    if (right > start) els.push(plate(start, g.y2, right - start, p.t2Mm * s));
  }
  // b1 (ray altı sacı) kirişin ortasında değil, RAYIN ortasında durur.
  // T profil varsa iptaldir (g.t1Mm = 0).
  if (g.t1Mm > 0 && g.b1Mm > 0) els.push(plate(g.railCx - (g.b1Mm * s) / 2, g.y1, g.b1Mm * s, g.t1Mm * s));
  // Ray altı T profili: üst sacı kesitin en üstünde ve üst iç flanşla aynı
  // seviyede, yan sacı onun TAM ORTASINDA aşağı iner.
  if (g.t.present) {
    els.push(plate(g.railCx - (g.t.topW * s) / 2, g.yTop, g.t.topW * s, g.t.topThk * s));
    els.push(plate(g.railCx - (g.t.webThk * s) / 2, g.yTWebTop, g.t.webThk * s, g.t.webH * s));
  }
}

/** Rayı çizer — ana gövde sacı (web1) ekseninde oturur. */
export function pushRail(els: DiagramEl[], g: BoxLayout, opts?: { label?: boolean }) {
  if (!(g.railHMm > 0)) return;
  const hr = g.railHMm * g.s;
  const fw = hr * 0.8;   // taban genişliği
  const hw = hr * 0.5;   // mantar
  const ww = hr * 0.22;  // gövde
  const footH = hr * 0.28;
  const headH = hr * 0.34;
  // Ray tabanı KESİTİN ÜSTÜDÜR: T profil varsa T'nin üst sacı, yoksa b1 sacı.
  const yRB = g.yTop;
  const yR2 = yRB - footH;
  const yR3 = yRB - (hr - headH);
  const yR4 = yRB - hr;
  const railCx = g.railCx;
  els.push({
    kind: "polygon",
    points: [
      [railCx - fw / 2, yRB], [railCx + fw / 2, yRB], [railCx + fw / 2, yR2],
      [railCx + ww / 2, yR2], [railCx + ww / 2, yR3], [railCx + hw / 2, yR3],
      [railCx + hw / 2, yR4], [railCx - hw / 2, yR4], [railCx - hw / 2, yR3],
      [railCx - ww / 2, yR3], [railCx - ww / 2, yR2], [railCx - fw / 2, yR2],
    ],
    fill: "#EDE6E6", stroke: DCOL.accent, strokeWidth: 1.1,
  });
  // Ray merkez ekseni (kesikli) — b1 ve gövde sacıyla hizası görünsün
  els.push(ln(railCx, yR4 - 4, railCx, g.yWebBottom, DCOL.accent, 0.6, "3,3"));
  if (opts?.label !== false) {
    els.push(txt(railCx, yR4 - 7, "Ray", 8, { anchor: "middle", fill: DCOL.accent }));
  }
}

const W = 800;
const H = 470;

export function girderSectionDiagram(p: GirderSectionParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "ANA KİRİŞ — KUTU KESİT", "Parametrik Çizim · Ölçüler mm");

  const g = layoutBoxSection(p, { cx: 275, drawW: 235, drawH: 340, areaTop: 72, areaH: 356 });
  if (!g) {
    els.push(txt(W / 2, H / 2, "Kesit Girdileri Eksik Veya Geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }
  const { s, cx, plateCx, b2Left, web1X, web2X, yB, yWebTop, yWebBottom, y1, y2, y5, y6 } = g;
  const totalH = g.totalHMm;
  const maxB = g.maxBMm;
  const tp = g.t;

  pushBoxPlates(els, p, g);
  pushRail(els, g);

  // Tarafsız eksen çizgileri ölçü ve açıklama metinlerinden ÖNCE boyanır.
  // SVG'de belge sırası boyama sırasıdır; eksenleri en sonda çizmek h3 ve
  // gövde aralığı kotlarının harflerinin üstüne kırmızı çizgi basıyordu.
  const neutralY =
    p.czMm !== undefined && Number.isFinite(p.czMm) && p.czMm > 0 && p.czMm < totalH
      ? yB - p.czMm * s
      : undefined;
  const neutralX =
    p.cyMm !== undefined && Number.isFinite(p.cyMm) && p.cyMm > 0 && p.cyMm < p.b2Mm
      ? b2Left + p.cyMm * s
      : undefined;
  if (neutralY !== undefined) {
    els.push(ln(cx - (maxB * s) / 2 - 22, neutralY, cx + (maxB * s) / 2 + 22, neutralY, DCOL.accent, 1, "6,3"));
  }
  if (neutralX !== undefined) {
    els.push(ln(neutralX, y1 - 12, neutralX, yB + 16, DCOL.accent, 1, "6,3"));
  }

  // --- Plaka etiketleri (sol: t1/t3/t5, sağ: t2/t4/t6 — çakışma önleme aralıklı)
  // Web kapsayıcısının 8 px iç dolgusu dâhil 840 px'lik çalışma alanına
  // sığması için sol açıklama sütununu biraz içeri al. Metinler viewBox'ı
  // sola doğru büyütürse masaüstünde gereksiz yatay kaydırma oluşuyordu.
  const leftX = 108;
  const rightX = 420;
  const leader = (fromX: number, fromY: number, toX: number, toY: number) =>
    els.push(ln(fromX, fromY, toX, toY, DCOL.faint, 0.8));

  const spread = (ys: number[], minGap = 15): number[] => {
    const out = [...ys];
    for (let i = 1; i < out.length; i++) {
      if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
    }
    return out;
  };

  // Sol etiketler (açıklayıcı ad + sembol). T profil varsa iki satırı da
  // buraya girer — kesitin üstündeki iki yeni sac adsız kalmamalı.
  // ETİKET RENGİ = FORMDAKİ ÖBEK RENGİ. Mühendis "üst başlık" öbeğindeki mavi
  // kutuları doldururken resimdeki mavi etiketi arar; iki yüzey aynı tonu
  // paylaştığı için göz eşleşmeyi okumadan yapar (bkz. `field-groups.ts`).
  const INK = {
    rail: FIELD_GROUPS.rail.ink,
    top: FIELD_GROUPS.topFlange.ink,
    tp: FIELD_GROUPS.tProfile.ink,
    web: FIELD_GROUPS.web.ink,
    bottom: FIELD_GROUPS.bottomFlange.ink,
    geo: FIELD_GROUPS.geometry.ink,
  };
  const mainWebH = g.yWebBottom - yWebTop;
  const leftItems = [
    ...(tp.present
      ? [
          {
            y: g.yTop + (tp.topThk * s) / 2,
            edgeX: g.railCx - (tp.topW * s) / 2,
            text: `T Profil Üst Sacı  tT = ${fmtN(tp.topThk)}`,
            ink: INK.tp,
          },
          {
            y: g.yTWebTop + (tp.webH * s) / 2,
            edgeX: g.railCx - (tp.webThk * s) / 2,
            text: `T Profil Yan Sacı  tTy = ${fmtN(tp.webThk)}`,
            ink: INK.tp,
          },
        ]
      : [{
          y: y1 + (g.t1Mm * s) / 2,
          edgeX: g.railCx - (g.b1Mm * s) / 2,
          text: `Ray Altı Sacı  t1 = ${fmtN(g.t1Mm)}`,
          ink: INK.top,
        }]),
    { y: yWebTop + mainWebH * 0.42, edgeX: web1X, text: `Gövde Sacı  t3 = ${fmtN(p.t3Mm)}`, ink: INK.web },
    { y: y5 + (p.t5Mm * s) / 2, edgeX: plateCx - (p.b5Mm * s) / 2, text: `Alt Başlık  t5 = ${fmtN(p.t5Mm)}`, ink: INK.bottom },
  ];
  const leftYs = spread(leftItems.map((i) => i.y));
  leftItems.forEach((it, i) => {
    leader(it.edgeX - 2, it.y, leftX + 6, leftYs[i]);
    els.push(txt(leftX, leftYs[i] + 3, it.text, 9.5, { anchor: "end", fill: it.ink }));
  });

  // Sağ etiketler (açıklayıcı ad + sembol)
  const rightItems = [
    { y: y2 + (p.t2Mm * s) / 2, edgeX: plateCx + (p.b2Mm * s) / 2, text: `t2 = ${fmtN(p.t2Mm)}  İç Başlık`, ink: INK.top },
    { y: g.yWebZoneTop + (p.h3Mm * s) * 0.32, edgeX: web2X + p.t4Mm * s, text: `t4 = ${fmtN(p.t4Mm)}  Gövde Sacı`, ink: INK.web },
    { y: y6 + (p.t6Mm * s) / 2, edgeX: plateCx + (p.b6Mm * s) / 2, text: `t6 = ${fmtN(p.t6Mm)}  Ek Flanş`, ink: INK.bottom },
  ];
  const rightYs = spread(rightItems.map((i) => i.y));
  rightItems.forEach((it, i) => {
    leader(it.edgeX + 2, it.y, rightX - 6, rightYs[i]);
    els.push(txt(rightX, rightYs[i] + 3, it.text, 9.5, { anchor: "start", fill: it.ink }));
  });

  // --- Ölçü okları: b1 (üstte, ray ekseninde), b5 (altta), h (sağda), a (gövdeler arası)
  if (g.b1Mm > 0) {
    // "ray" etiketi ray mantarının hemen üstünde durur; b1 ölçüsü ondan da
    // yukarıda olmalı, yoksa ölçü çizgisi etiketin içinden geçiyor.
    dimH(els, g.railCx - (g.b1Mm * s) / 2, g.railCx + (g.b1Mm * s) / 2, g.railTop - 24, `b1 = ${fmtN(g.b1Mm)}`, { labelColor: INK.top });
  }
  if (p.b5Mm > 0) {
    dimH(els, plateCx - (p.b5Mm * s) / 2, plateCx + (p.b5Mm * s) / 2, yB + 30, `b5 = ${fmtN(p.b5Mm)}`, { labelDy: 13, labelColor: INK.bottom });
  }
  // T profil ölçüleri: yan sac yüksekliği (sol iç) ve üst sac genişliği (üstte)
  if (tp.present) {
    // hT ölçüsü T yan sacının SAĞINDA durur: solu, sol etiket sütununa giden
    // bağlantı çizgileri kullanıyor ve ölçü yazısının içinden geçiyorlardı.
    dimV(els, g.railCx + (tp.webThk * s) / 2 + 16, g.yTWebTop, yWebTop,
      `hT = ${fmtN(tp.webH)}`, { labelSide: "right", size: 8.5, labelColor: INK.tp });
    dimH(els, g.railCx - (tp.topW * s) / 2, g.railCx + (tp.topW * s) / 2,
      g.railTop - 24, `bT = ${fmtN(tp.topW)}`, { size: 8.5, labelColor: INK.tp });
  }

  // h — toplam kesit yüksekliği (sağ dış). Sağ etiket sütunundan (rightX)
  // en uzun etiket kadar UZAKTA durmalı; yakın olursa ölçü çizgisi
  // "t4 = 8  gövde sacı" yazısının içine giriyor.
  const hX = Math.max(cx + (maxB * s) / 2 + 30, rightX + 102);
  els.push(ln(cx + (maxB * s) / 2 + 4, g.yTop, hX + 4, g.yTop, DCOL.faint, 0.6));
  els.push(ln(cx + (maxB * s) / 2 + 4, yB, hX + 4, yB, DCOL.faint, 0.6));
  dimV(els, hX, g.yTop, yB, `h = ${fmtN(totalH)}`);
  // a — gövde sacları arası (net açıklık, geometriden)
  if (p.aMm > 0 && p.h3Mm > 0) {
    dimH(
      els,
      web1X + p.t3Mm * s,
      web2X,
      yWebTop + (p.h3Mm * s) * 0.62,
      `Gövde Arası a = ${fmtN(p.aMm)}`,
      {
        size: 8.5,
        labelColor: INK.geo,
        // Ray ekseni/Cy ekseni kutunun içinden geçebilir; yazı için ayrı,
        // opak bir kâğıt şerit bırakılır.
        clearLabel: true,
      }
    );
  }
  // h3 — gövde (web) yüksekliği — sağ iç. T profil varsa ANA gövde kısaldığı
  // için ölçü DIŞ gövde sacında (tam boy) gösterilir, yanına da kısalmış ana
  // gövdenin boyu yazılır; ikisini tek okla göstermek yanlış olurdu.
  if (p.h3Mm > 0) {
    // Ölçü, ana gövdenin hemen sağındaki boş şeritte durur. Eski konum sağ
    // gövdeye yakındı; h3 yazısı Cy ekseniyle, ölçü çizgisi de t4 etiketiyle
    // kesişiyordu.
    dimV(
      els,
      web1X + p.t3Mm * s + 12,
      g.yWebZoneTop,
      yWebBottom,
      `h3 = ${fmtN(p.h3Mm)}`,
      { labelSide: "right", size: 8.5, labelColor: INK.web, clearLabel: true }
    );
    if (tp.present) {
      const h3MainMm = Math.round(((yWebBottom - yWebTop) / s) * 10) / 10;
      dimV(els, web1X - 12, yWebTop, yWebBottom, `h3' = ${fmtN(h3MainMm)}`, {
        labelSide: "left", size: 8.5, labelColor: INK.web,
      });
    }
  }
  // b2 — üst iç başlık genişliği (üstte, b1'in altında)
  if (p.b2Mm > 0) {
    // labelDy en az yazı boyu kadar olmalı: -3'te ölçü çizgisi ve uç tikleri
    // "b2 = 460" yazısının ortasından geçiyordu.
    // T profil varsa ölçü, PLAKANIN GERÇEK BAŞLANGICINDAN (T'nin sağ ucu)
    // başlar — nominal b2'yi ölçmek, resimde olmayan bir kenarı gösterirdi.
    const b2Right = b2Left + p.b2Mm * s;
    const b2Start = tp.present
      ? Math.min(b2Right, Math.max(b2Left, g.railCx + (tp.topW * s) / 2))
      : b2Left;
    if (b2Right > b2Start) {
      // Ölçü çizgisi üst başlık etiketinin bağlantı çizgisinden ayrılır;
      // yazı çizginin hemen üstünde ayrı bir kotta kalır.
      dimH(els, b2Start, b2Right, y2 - 16, `b2 = ${fmtN((b2Right - b2Start) / s)}`, {
        size: 8.5, labelDy: -8, labelColor: INK.top,
      });
    }
  }

  // Tarafsız eksen ETİKETLERİ en sonda kalır; çizgiler yukarıda, metinlerin
  // arkasında boyandı.
  if (neutralY !== undefined) {
    els.push(txt(cx - (maxB * s) / 2 - 26, neutralY + 3, `T.E. — Cz = ${fmtN(p.czMm)} mm`, 9, {
      anchor: "end", fill: DCOL.accent,
    }));
  }
  if (neutralX !== undefined) {
    // Etiket alt başlık plakasının altına iner (üstünde plakayla çakışıyordu)
    els.push(txt(neutralX + 4, yB + 14, `Cy = ${fmtN(p.cyMm)} mm`, 9, { fill: DCOL.accent }));
  }

  // --- Temel kesit özeti (kullanıcı kararı: şemanın sağında, kısa liste)
  const panelX = 590;
  els.push(ln(560, 58, 560, 432, DCOL.line, 1));
  els.push(txt(panelX, 78, "ANAKİRİŞİN TEMEL ÖZELLİKLERİ", 10.5, {
    bold: true, fill: DCOL.accent,
  }));
  const propertyRows: [string, string][] = [
    ["Kesit Alanı A", `${fmtN(p.areaCm2, 2)} cm²`],
    ["Birim Ağırlık G", `${fmtN(p.weightPerM, 2)} kg/m`],
    ["Kuvvetli Eksen Ataleti Iyy", `${fmtN(p.iyyCm4, 0)} cm⁴`],
    ["Ağırlık Merkezi Cz", `${fmtN(p.czMm, 1)} mm`],
    ["Ağırlık Merkezi Cy", `${fmtN(p.cyMm, 1)} mm`],
    ["Vinç Açıklığı L", `${fmtN(p.spanM, 2)} m`],
  ];
  propertyRows.forEach(([label, value], index) => {
    // Başlık ve değer ayrı satırlardadır. Özellikle uzun "Kuvvetli eksen
    // ataleti Iyy" etiketi aynı satırdaki büyük sayı ile üst üste geliyordu.
    const labelY = 108 + index * 39;
    const valueY = labelY + 15;
    els.push(txt(panelX, labelY, label, 8.5, { fill: DCOL.muted }));
    els.push(txt(780, valueY, value, 9.5, { anchor: "end", bold: true }));
    els.push(ln(panelX, valueY + 7, 780, valueY + 7, DCOL.line, 0.7));
  });
  els.push({
    kind: "rect", x: panelX, y: 357, w: 190, h: 65,
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 0.8,
  });
  els.push(txt(panelX + 12, 377, "YAKLAŞIK ANA KİRİŞ AĞIRLIĞI", 8.5, {
    fill: DCOL.accent, bold: true,
  }));
  els.push(txt(panelX + 12, 395, "G · L · 1,15 (Yaklaşık Perde Payı)", 8, {
    fill: DCOL.muted,
  }));
  els.push(txt(770, 411, `${fmtN(p.approxGirderWeightKg, 0)} kg`, 11, {
    anchor: "end", bold: true, fill: DCOL.accent,
  }));

  return fitDiagram(els, W, H);
}
