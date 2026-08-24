// Redüktör mil yönleri şeması — ÜST GÖRÜNÜŞ.
//
// ÇİZİM ÜRETİCİNİN ÖLÇÜ RESMİNE GÖREDİR (`Redüktör Yönleri.dxf`, kullanıcı
// 24.08.2026). Öncekinden farkı yalnız süsleme değildir, GEOMETRİ farklıdır:
//
//   · Gövde ÜST GÖRÜNÜŞTE UZUN kenarı millere DİK duran bir dikdörtgendir.
//   · ÇIKIŞ MİLİ ile GİRİŞ MİLİ AYNI EKSENDE DEĞİLDİR ve birbirine dik de
//     değildir: paralel milli bir redüktörde ikisi de aynı yöne bakar, yalnız
//     gövdenin uzun ekseni boyunca KAÇIKTIR — çıkış üst üçte birde, giriş
//     alta yakın. Eski şema girişi dik kenardan çıkarıyordu; o redüktör
//     imalatta yoktur ve resmi okuyan ressamı yanıltır.
//   · Çıkış mili KALIN ve kamalı, giriş mili İNCE ve kamalıdır; ikisi de
//     gövde duvarında cıvatalı bir yatak kapağıyla oturur.
//   · Gövdenin üst ve alt kenarında delikli bağlantı kulakları, kapakta
//     cıvata deliği halkası ve ortada havalandırma/yağ tapası vardır.
//
// Yön kodu (R/L/U/V) bütün figürü döndürür: çizim ÖNCE yerel çerçevede
// (çıkış sağa bakar) kurulur, sonra tek bir dönüşümle yerine oturur. Böylece
// dört yön için dört ayrı çizim bakımı gerekmez.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, fitDiagram, fmtN, txt,
} from "./model";
import {
  gearboxOutputShape, gearboxShaftDir, type GearboxShaftShape,
} from "@/lib/calc/gearbox-shaft";

export interface GearboxShaftParams {
  /** Çıkış özelliği kodu (00…08, 0S) */
  feature?: string;
  /** Yön kodu (R1/L1/…/V2) */
  direction?: string;
  /** Çıkış mili çapı [mm] */
  outputShaftMm?: number;
  /** Giriş mili çapı [mm] */
  inputShaftMm?: number;
  /** Redüktör modeli (başlık notu) */
  model?: string;
  featureLabel?: string;
}

const W = 520;
const H = 360;

// --------------------------------------------------------------- yerleşim
//
// YEREL ÇERÇEVE: +x mil ekseni (çıkış sağa bakar), +y gövdenin uzun ekseni
// (aşağı). Orijin gövde merkezidir. Ölçüler DXF'teki oranlardan alınmıştır:
// gövde boyu ≈ 1,9 × eni, çıkış ekseni üst çeyrekte, giriş ekseni alt kenara
// yakın.
const BODY_W = 92;   // gövde eni (mil eksenine paralel)
const BODY_H = 176;  // gövde boyu (mil eksenine dik)
const Y_OUT = -BODY_H / 2 + 46;   // çıkış mili ekseni
const Y_IN = BODY_H / 2 - 28;     // giriş mili ekseni
const OUT_HALF = 13;  // çıkış mili yarı kalınlığı
const IN_HALF = 6;    // giriş mili yarı kalınlığı
const OUT_LEN = 62;
const IN_LEN = 40;

type Dir = "R" | "L" | "U" | "V";

/**
 * Yerel noktayı çizim düzlemine taşıyan dönüşüm.
 *
 * R kimliktir; L x'i aynalar; U ve V figürü çeyrek tur döndürür. Eksene hizalı
 * dikdörtgenler çeyrek turda yine eksene hizalı kalır — bu yüzden köşeleri
 * dönüştürüp normalleştirmek yeterlidir, dönme açısı taşımaya gerek yoktur.
 */
function frame(dir: Dir, cx: number, cy: number) {
  const map = (lx: number, ly: number): [number, number] => {
    switch (dir) {
      case "R": return [cx + lx, cy + ly];
      case "L": return [cx - lx, cy + ly];
      case "U": return [cx + ly, cy - lx];
      case "V": return [cx - ly, cy + lx];
    }
  };
  return {
    map,
    /** Yerel dikdörtgen → çizim dikdörtgeni (köşeler dönüştürülüp normalleştirilir). */
    rect(lx: number, ly: number, lw: number, lh: number) {
      const [x1, y1] = map(lx, ly);
      const [x2, y2] = map(lx + lw, ly + lh);
      return {
        x: Math.min(x1, x2), y: Math.min(y1, y2),
        w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      };
    },
  };
}

type Frame = ReturnType<typeof frame>;

function box(
  els: DiagramEl[], f: Frame,
  lx: number, ly: number, lw: number, lh: number,
  fill: string | undefined, stroke: string, strokeWidth: number, rx?: number
) {
  els.push({ kind: "rect", ...f.rect(lx, ly, lw, lh), fill, stroke, strokeWidth, rx });
}

function seg(
  els: DiagramEl[], f: Frame,
  lx1: number, ly1: number, lx2: number, ly2: number,
  stroke: string, strokeWidth: number, dash?: string
) {
  const [x1, y1] = f.map(lx1, ly1);
  const [x2, y2] = f.map(lx2, ly2);
  els.push({ kind: "line", x1, y1, x2, y2, stroke, strokeWidth, dash });
}

function dot(
  els: DiagramEl[], f: Frame, lx: number, ly: number, r: number,
  fill: string | undefined, stroke: string, strokeWidth: number
) {
  const [cx, cy] = f.map(lx, ly);
  els.push({ kind: "circle", cx, cy, r, fill, stroke, strokeWidth });
}

/**
 * Gövdeden çıkan mil — yatak kapağı, kama yuvası ve (varsa) delik/flanş/sıkma
 * bilezik göstergeleriyle. `side` +1 sağ, −1 sol.
 */
function shaft(
  els: DiagramEl[], f: Frame,
  ly: number, side: 1 | -1, len: number, half: number, shape: GearboxShaftShape,
  detailed: boolean
) {
  const wall = (side * BODY_W) / 2;
  const tip = wall + side * len;
  const lx = Math.min(wall, tip);

  // YATAK KAPAĞI: duvarda milden geniş, kısa bir basamak. DXF'te milin
  // kökündeki cıvatalı kapak budur; onsuz mil gövdeden "fışkırmış" görünür.
  const capLen = 10;
  const capHalf = half + 6;
  const capX = side > 0 ? wall : wall - capLen;
  // Kapak MİLİN EKSENİNDEDİR — gövde merkezinde değil. (Eksen yerine 0
  // kullanmak kapağı gövdenin ortasına koyuyordu ve mil gövdeden kopuk
  // görünüyordu.)
  box(els, f, capX, ly - capHalf, capLen, 2 * capHalf, DCOL.paper, DCOL.ink, 1.2);
  for (const s of [-1, 1]) {
    dot(els, f, capX + capLen / 2, ly + s * (capHalf - 2.5), 1.4, DCOL.paper, DCOL.muted, 0.8);
  }

  // MİL GÖVDESİ
  box(els, f, lx, ly - half, len, 2 * half, DCOL.paper, DCOL.ink, 1.2);

  // KAMA YUVASI: milin üstünde ince uzun dikdörtgen (DXF'te de öyle basılır).
  if (detailed && len > 20) {
    const keyLen = len * 0.62;
    const keyX = side > 0 ? wall + len * 0.24 : wall - len * 0.24 - keyLen;
    box(els, f, keyX, ly - half * 0.42, keyLen, half * 0.84, undefined, DCOL.muted, 0.9);
  }

  // DELİK MİL: uçta iç çap dairesi + eksen boyunca ikinci çizgi
  if (shape.hollow) {
    const inner = half * 0.5;
    seg(els, f, wall, ly - inner, tip, ly - inner, DCOL.faint, 0.9);
    seg(els, f, wall, ly + inner, tip, ly + inner, DCOL.faint, 0.9);
  }
  // FLANŞ: ÜST GÖRÜNÜŞTE bir halka değil, milden geniş kısa bir PLAKADIR.
  // (Daire çizmek flanşı gövdenin köşesine taşan orantısız bir halka yapıyordu;
  // bu görünüşte flanş yandan görülür.)
  if (shape.flanged) {
    const plateLen = 7;
    const plateHalf = half + 11;
    const plateX = side > 0 ? wall + capLen : wall - capLen - plateLen;
    box(els, f, plateX, ly - plateHalf, plateLen, 2 * plateHalf, DCOL.paper, DCOL.accent, 1.4);
    if (shape.doubleFlange) {
      const secondX = side > 0 ? plateX + plateLen + 4 : plateX - plateLen - 4;
      box(els, f, secondX, ly - plateHalf, plateLen, 2 * plateHalf, DCOL.paper, DCOL.accent, 1.4);
    }
  }
  // SIKMA BİLEZİK: uçta iki halka
  if (shape.shrinkDisk) {
    for (const o of [0.62, 0.86]) {
      dot(els, f, wall + side * len * o, ly, half + 4, undefined, DCOL.ink, 1);
    }
  }
  return { tipX: tip };
}

/** Gövde: bağlantı kulakları, kontrol kapağı, cıvata halkası, tapa. */
function housing(els: DiagramEl[], f: Frame) {
  const hw = BODY_W / 2;
  const hh = BODY_H / 2;

  // BAĞLANTI KULAKLARI — üst ve alt kenarda, delikli. Gövdeden yanlara taşar.
  const lugW = 20;
  const lugH = 26;
  for (const sy of [-1, 1] as const) {
    for (const sx of [-1, 1] as const) {
      const lx = sx < 0 ? -hw - lugW * 0.35 : hw - lugW * 0.65;
      const ly = sy < 0 ? -hh : hh - lugH;
      box(els, f, lx, ly, lugW, lugH, DCOL.paper, DCOL.ink, 1.2);
      dot(els, f, lx + lugW / 2, ly + lugH / 2, 4, undefined, DCOL.ink, 1);
    }
    // Kulakların arasındaki kenar bandı + orta cıvata
    box(els, f, -hw, sy < 0 ? -hh : hh - lugH, BODY_W, lugH, DCOL.paper, DCOL.ink, 1.2);
    dot(els, f, 0, sy * (hh - lugH / 2), 3.4, DCOL.paper, DCOL.ink, 1);
    dot(els, f, 0, sy * (hh - lugH / 2), 1.6, undefined, DCOL.ink, 0.9);
  }

  // GÖVDE dış hattı (kulakların üstüne çizilir, kenarları kapatır)
  box(els, f, -hw, -hh, BODY_W, BODY_H, undefined, DCOL.ink, 1.6);

  // KONTROL KAPAĞI — köşeleri yuvarlatılmış, çevresi cıvata delikli.
  const cw = BODY_W - 30;
  const ch = BODY_H - 76;
  box(els, f, -cw / 2, -ch / 2 + 6, cw, ch, DCOL.paper, DCOL.ink, 1.1, 8);
  const bolts = 7;
  for (let i = 0; i < bolts; i++) {
    const t = -ch / 2 + 6 + 10 + (i * (ch - 20)) / (bolts - 1);
    for (const sx of [-1, 1] as const) dot(els, f, (sx * cw) / 2 + sx * -5, t, 2, undefined, DCOL.muted, 0.8);
  }
  for (const sy of [-1, 1] as const) {
    for (const t of [-0.28, -0.1, 0.1, 0.28]) {
      dot(els, f, t * cw, -ch / 2 + 6 + (sy < 0 ? 5 : ch - 5), 2, undefined, DCOL.muted, 0.8);
    }
  }
  // Havalandırma / yağ tapası (kapağın ortası)
  dot(els, f, 0, 6, 5, DCOL.paper, DCOL.ink, 1);
  dot(els, f, 0, 6, 2.4, undefined, DCOL.ink, 0.9);
}

export function gearboxShaftDiagram(p: GearboxShaftParams): Diagram {
  const els: DiagramEl[] = [];
  const shape = gearboxOutputShape(p.feature);
  const { dir, inputCount } = gearboxShaftDir(p.direction);
  caption(
    els,
    "REDÜKTÖR MİL YÖNLERİ (ÜST GÖRÜNÜŞ)",
    p.model ? `${p.model}${p.featureLabel ? " · " + p.featureLabel : ""}` : p.featureLabel
  );

  // Dikey yönlerde (U/V) figür çeyrek tur döner ve geniş kalır; merkez ona
  // göre kaydırılır ki künye bloğuyla çakışmasın.
  const vertical = dir === "U" || dir === "V";
  const f = frame(dir, vertical ? 250 : 210, vertical ? 200 : 195);

  // EKSEN ÇİZGİLERİ — millerin eksenleri gövdeyi boydan boya geçer (DXF'te de
  // öyle). Nokta-çizgi, mil eksenlerinin işaretidir.
  const axisReach = BODY_W / 2 + OUT_LEN + 14;
  seg(els, f, -axisReach, Y_OUT, axisReach, Y_OUT, DCOL.faint, 0.8, "9 3 2 3");
  seg(els, f, -axisReach, Y_IN, axisReach, Y_IN, DCOL.faint, 0.8, "9 3 2 3");
  seg(els, f, 0, -BODY_H / 2 - 12, 0, BODY_H / 2 + 12, DCOL.faint, 0.8, "9 3 2 3");

  housing(els, f);

  // ÇIKIŞ MİLİ — yön kodunun gösterdiği tarafta (yerel çerçevede daima sağ).
  shaft(els, f, Y_OUT, 1, OUT_LEN, OUT_HALF, shape, true);
  if (shape.doubleOutput) shaft(els, f, Y_OUT, -1, OUT_LEN, OUT_HALF, shape, true);

  // GİRİŞ MİLİ — ÇIKIŞLA AYNI YÖNE bakar, gövdenin alt ucundadır. Çift giriş
  // milli tipte iki uçtan da çıkar.
  const NO_SHAPE: GearboxShaftShape = {
    hollow: false, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false,
  };
  shaft(els, f, Y_IN, 1, IN_LEN, IN_HALF, NO_SHAPE, true);
  if (inputCount === 2) shaft(els, f, Y_IN, -1, IN_LEN, IN_HALF, NO_SHAPE, true);

  // ÇAP ETİKETLERİ — mil ucunun hemen dışında, eksen üstünde.
  const label = (ly: number, len: number, text: string, accent: boolean) => {
    const [x, y] = f.map(BODY_W / 2 + len + 8, ly);
    const anchor = dir === "L" ? "end" : dir === "R" ? "start" : "middle";
    els.push(txt(x, dir === "U" ? y - 4 : dir === "V" ? y + 11 : y + 3, text, 9, {
      anchor, fill: accent ? DCOL.accent : DCOL.ink, bold: accent,
    }));
  };
  label(Y_OUT, OUT_LEN, `ÇIKIŞ Ø${fmtN(p.outputShaftMm ?? 0, 0)}`, true);
  label(Y_IN, IN_LEN, `GİRİŞ Ø${fmtN(p.inputShaftMm ?? 0, 0)}${inputCount === 2 ? " · Çift" : ""}`, false);

  // YÖN KÜNYESİ (sağ blok)
  const bx = 402;
  let by = 96;
  const line = (t: string, accent = false) => {
    els.push(txt(bx, by, t, 8.5, { fill: accent ? DCOL.accent : DCOL.ink, bold: accent }));
    by += 15;
  };
  els.push(txt(bx, by - 16, "YÖN", 9, { fill: DCOL.accent, bold: true }));
  line(`Kod: ${p.direction ?? "—"}`, true);
  line(`Çıkış Yönü: ${({ R: "Sağ", L: "Sol", U: "Üst", V: "Alt" } as const)[dir]}`);
  line(`Giriş Mili: ${inputCount === 2 ? "Çift" : "Tek"}`);
  if (shape.hollow) line("Delik Milli");
  if (shape.flanged) line(shape.doubleFlange ? "Çift Flanşlı" : "Flanşlı");
  if (shape.doubleOutput) line("Çift Çıkış Milli");
  if (shape.shrinkDisk) line("Sıkma bilezik");

  return fitDiagram(els, W, H);
}
