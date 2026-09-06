// PANO YERLEŞİM ÇİZİMLERİ — dizilim görünüşü, iç yerleşim, kapak görünüşü.
//
// ═══════════════════════════════════════════════ NEDEN `Diagram` MODELİ
//
// Bu çizim iki hedefe birden basılır: ekrandaki `DiagramSvg` ve pano
// imalatçısına giden PDF (`lib/pdf/diagram.tsx`). Tek model iki çizici demek,
// birinde düzeltilen bir ölçünün ötekinde eskimemesi demektir. Ayrıca etiket
// çakışma çözücü ve viçBox oturtma (`fitDiagram`) bedavaya gelir.
//
// `select.ts`e KAYDEDİLMEZ: orası hesap raporu sihirbazının bölüm
// diyagramlarını yönlendirir. Bu şema bir hesap bölümü değildir ve
// `nesting.ts` gibi doğrudan çağrılır.
//
// ═══════════════════════════════════════════════ ETİKET SORUNU
//
// 17,5 mm'lik bir şalter 1:2 ölçekte 8,75 birim eder; üstüne "F31" yazmak
// imkânsızdır. Çözüm `nesting.ts`teki ile aynıdır ve gerçek yazılımlar da
// böyle yapar: ÇİZİM YERLEŞİMİ, LİSTE KİMLİĞİ anlatır. Sığan etiket yazılır,
// sığmayan yerine numara konur, o da sığmıyorsa yalnız dolgu kalır ve
// karşılığı yandaki listede durur. Sığmayan etiket ÇİZİLMEZ — uydurulmuş bir
// yazı okunmaz bir yazıdan iyidir.

import {
  DCOL,
  caption,
  dimH,
  dimV,
  fitDiagram,
  fmtN,
  ln,
  txt,
  type Diagram,
  type DiagramEl,
} from "./model";
import type { ColorGroup, LayoutSettings, PanelLayout, Placement } from "@/lib/switchboard/types";
import { COLOR_GROUP_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import { plateHeightMm, plateWidthMm, sideDuctCount } from "@/lib/switchboard/sizes";

// ═══════════════════════════════════════════════════ KATEGORİ PALETİ
//
// DOKUZ RENK, 25 KATEGORİ DEĞİL. Göz bir şemada ancak sekiz-dokuz dolguyu
// birbirinden ayırır; 25 renk bir gökkuşağı olur ve hiçbir şey anlatmaz. Renk
// `mount.ts`teki İŞLEV GRUBUNA verilir, kategoriye değil.
//
// Değerler BASKI hex'idir (`DCOL` ile aynı sözleşme) ve `diagram-svg.tsx`teki
// `THEME_PAINT` onları koyu temada CSS değişkenine çevirir. Oraya
// EKLENMEYEN bir hex sessizce ham geçer ve koyu zeminde açık pastel kalır —
// `panoLayout.palette.test.ts` bunu sabitler.
//
// `DCOL` genişletilmedi: o, 25 diyagram modülünün ortak mürekkep/kâğıt
// sözlüğüdür ve oraya konan bir alan paleti herkesi oraya uzanmaya çağırırdı.
export const PANO_RENK: Record<ColorGroup, string> = {
  giris: "#D7E4F2", // mavi — giriş ve koruma
  surucu: "#F3DCDA", // kırmızı — sürücü ve güç elektroniği
  anahtarlama: "#F6E3CE", // turuncu — kontaktör, motor koruma
  kumanda: "#F4EDC9", // sarı — röle, ölçü, kumanda elemanı
  otomasyon: "#E4DCEF", // mor — PLC, HMI, haberleşme
  besleme: "#D9EDDD", // yeşil — güç kaynağı, trafo
  klemens: "#D3E9E6", // turkuaz — klemens ve bağlantı
  iklim: "#E8E1D8", // kahve — iklimlendirme, aydınlatma
  diger: "#E4E1DF", // nötr — sınıflanmamış / pano dışı
};

/**
 * Tuval zemini — `DCOL`de karşılığı yok ama `THEME_PAINT`te var
 * (`#FAF8F7` → `--oc-diagram-canvas-soft`). `DCOL` genişletilmedi: orası
 * bütün diyagramların ortak sözlüğüdür.
 */
const TUVAL_SOFT = "#FAF8F7";

/** Şema ölçekleri [çizim birimi / mm]. */
const OLCEK_DIZILIM = 0.16;
const OLCEK_IC = 0.5;

/** Bu birim genişliğin altına yazı KONMAZ (ölçüldü: 2 karakter ≈ 7 birim). */
const EN_KUCUK_ETIKET = 12;
const EN_KUCUK_NUMARA = 7;

// ═══════════════════════════════════════════════════════ SEMBOL KİTAPLIĞI
//
// Cihazlar gerçek gövdelerine benzetilir: göz bir kontaktörü bir şalterden
// biçiminden tanır ve etiketi okumadan panonun neye benzediğini anlar.

type Sembol = "salter" | "kontaktor" | "surucu" | "psu" | "plc" | "role" | "klemens" | "kutu";

function sembolFor(grup: ColorGroup): Sembol {
  switch (grup) {
    case "giris":
      return "salter";
    case "anahtarlama":
      return "kontaktor";
    case "surucu":
      return "surucu";
    case "besleme":
      return "psu";
    case "otomasyon":
      return "plc";
    case "kumanda":
      return "role";
    case "klemens":
      return "klemens";
    default:
      return "kutu";
  }
}

/** Tahmin edilmiş ölçü TARAMAYLA ayrılır — renk tek başına yetmez (PANO-13). */
function tarama(els: DiagramEl[], x: number, y: number, w: number, h: number) {
  const adim = 4;
  for (let d = -h; d < w; d += adim) {
    const x1 = Math.max(x, x + d);
    const y1 = d < 0 ? y - d : y;
    const x2 = Math.min(x + w, x + d + h);
    const y2 = y1 + (x2 - x1);
    if (x2 > x1 && y2 <= y + h) els.push(ln(x1, y1, x2, y2, DCOL.faint, 0.4));
  }
}

function govde(els: DiagramEl[], x: number, y: number, w: number, h: number, fill: string) {
  els.push({ kind: "rect", x, y, w, h, fill, stroke: DCOL.ink, strokeWidth: 0.7, rx: 0.8 });
}

/** Üst ve alt klemens ağızları — modüler cihazın tanıdık yüzü. */
function klemensAgzi(els: DiagramEl[], x: number, y: number, w: number, h: number) {
  if (w < 4) return;
  const ic = Math.min(3, h * 0.12);
  els.push(ln(x + 1, y + ic, x + w - 1, y + ic, DCOL.muted, 0.4));
  els.push(ln(x + 1, y + h - ic, x + w - 1, y + h - ic, DCOL.muted, 0.4));
}

function cihazCiz(els: DiagramEl[], sembol: Sembol, x: number, y: number, w: number, h: number, fill: string, birim: number) {
  govde(els, x, y, w, h, fill);

  switch (sembol) {
    case "salter": {
      klemensAgzi(els, x, y, w, h);
      // Kutup ayrım çizgileri: 17,5 mm'lik modüller.
      const modul = w / Math.max(1, Math.round(w / (17.5 * OLCEK_IC)));
      for (let m = modul; m < w - 0.5; m += modul) {
        els.push(ln(x + m, y + 2, x + m, y + h - 2, DCOL.faint, 0.4));
      }
      // Kol: gövdenin ortasında küçük bir dikdörtgen.
      if (w >= 5 && h >= 12) {
        const kw = Math.min(w * 0.5, 5);
        els.push({
          kind: "rect",
          x: x + (w - kw) / 2,
          y: y + h * 0.42,
          w: kw,
          h: Math.min(h * 0.18, 7),
          fill: DCOL.paper,
          stroke: DCOL.muted,
          strokeWidth: 0.5,
          rx: 0.6,
        });
      }
      break;
    }
    case "kontaktor": {
      klemensAgzi(els, x, y, w, h);
      // Üstte ve altta üç güç klemensi.
      if (w >= 12) {
        for (let i = 0; i < 3; i++) {
          const cx = x + w * (0.22 + i * 0.28);
          els.push({ kind: "circle", cx, cy: y + 3, r: 1.1, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
          els.push({ kind: "circle", cx, cy: y + h - 3, r: 1.1, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
        }
      }
      // Yardımcı kontak bloğu — sağ üst köşede ince şerit.
      if (w >= 14) {
        els.push({ kind: "rect", x: x + w - 3.5, y: y + h * 0.25, w: 3, h: h * 0.5, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
      }
      break;
    }
    case "surucu": {
      // Havalandırma dilimleri (üst ve alt) + ön panel ekranı.
      const dilim = Math.max(2, h * 0.02);
      for (let i = 0; i < 4; i++) {
        const yy = y + 2 + i * (dilim + 1.2);
        if (yy + dilim < y + h * 0.28) els.push(ln(x + 2, yy, x + w - 2, yy, DCOL.muted, 0.5));
      }
      for (let i = 0; i < 4; i++) {
        const yy = y + h - 2 - i * (dilim + 1.2);
        if (yy - dilim > y + h * 0.72) els.push(ln(x + 2, yy, x + w - 2, yy, DCOL.muted, 0.5));
      }
      if (w >= 16 && h >= 24) {
        els.push({
          kind: "rect",
          x: x + w * 0.2,
          y: y + h * 0.38,
          w: w * 0.6,
          h: Math.min(h * 0.16, 14),
          fill: DCOL.paper,
          stroke: DCOL.muted,
          strokeWidth: 0.5,
          rx: 0.8,
        });
      }
      break;
    }
    case "psu": {
      klemensAgzi(els, x, y, w, h);
      if (w >= 10) {
        els.push({ kind: "circle", cx: x + w * 0.5, cy: y + h * 0.45, r: 1.4, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
        els.push(ln(x + 2, y + h * 0.62, x + w - 2, y + h * 0.62, DCOL.muted, 0.4));
      }
      break;
    }
    case "plc": {
      klemensAgzi(els, x, y, w, h);
      // I/O gösterge dizisi.
      if (w >= 10 && h >= 20) {
        const n = Math.min(8, Math.floor((h - 10) / 4));
        for (let i = 0; i < n; i++) {
          els.push({ kind: "rect", x: x + 2, y: y + 6 + i * 4, w: 1.6, h: 1.6, fill: DCOL.muted });
        }
      }
      break;
    }
    case "role": {
      klemensAgzi(els, x, y, w, h);
      // Soket + şeffaf gövde ayrımı.
      els.push(ln(x + 0.5, y + h * 0.68, x + w - 0.5, y + h * 0.68, DCOL.muted, 0.5));
      break;
    }
    case "klemens": {
      // Şerit: birim genişliği çizilebiliyorsa her klemens ayrı dilim.
      if (birim >= 1.6) {
        for (let d = birim; d < w - 0.3; d += birim) {
          els.push(ln(x + d, y + 1, x + d, y + h - 1, DCOL.muted, 0.35));
        }
      }
      els.push(ln(x + 1, y + h * 0.5, x + w - 1, y + h * 0.5, DCOL.muted, 0.5));
      break;
    }
    default:
      break;
  }
}

/** Kablo kanalı — tarak dişleriyle. */
function kanalCiz(els: DiagramEl[], x: number, y: number, w: number, h: number) {
  els.push({ kind: "rect", x, y, w, h, fill: DCOL.paper, stroke: DCOL.faint, strokeWidth: 0.5 });
  const adim = 5;
  for (let d = adim; d < w; d += adim) {
    els.push(ln(x + d, y + 1, x + d, y + h - 1, DCOL.line, 0.4));
  }
}

/** TS35 rayı — kesitten görünen ince profil. */
function rayCiz(els: DiagramEl[], x: number, y: number, w: number) {
  els.push({ kind: "rect", x, y, w, h: 2.2, fill: DCOL.line, stroke: DCOL.faint, strokeWidth: 0.4 });
  for (let d = 6; d < w; d += 12) {
    els.push({ kind: "circle", cx: x + d, cy: y + 1.1, r: 0.5, fill: DCOL.paper });
  }
}

// ═══════════════════════════════════════════════════════ NUMARALANDIRMA

/**
 * Etiketi sığmayan cihazlara 1'den başlayan numara verir.
 *
 * Numara ÇİZİM SIRASINDANDIR (ray, sonra x): göz soldan sağa ve yukarıdan
 * aşağıya okur; alfabetik bir numara listeyi resimden koparırdı.
 */
export function panoNumaralari(panel: PanelLayout): Map<string, number> {
  const sirali = [...panel.placements].sort(
    (a, b) => a.railIndex - b.railIndex || a.xMm - b.xMm
  );
  const out = new Map<string, number>();
  let n = 1;
  for (const p of sirali) {
    const anahtar = `${p.deviceKey}#${p.railIndex}#${Math.round(p.xMm)}`;
    out.set(anahtar, n++);
  }
  return out;
}

function yerlesimAnahtari(p: Placement): string {
  return `${p.deviceKey}#${p.railIndex}#${Math.round(p.xMm)}`;
}

// ═══════════════════════════════════════════════════════ DİZİLİM GÖRÜNÜŞÜ

export interface DizilimGirdisi {
  panels: PanelLayout[];
  baslik: string;
  not?: string;
}

/**
 * Panolar yan yana, altta tek parça baza.
 *
 * PANOLAR ARASINDA BOŞLUK YOKTUR: yan levhalar ortaktır ve dizinin toplam eni
 * gözlerin toplamıdır. Araya pay koyan bir çizim, imalatçıya yanlış bir toplam
 * en verirdi.
 */
export function panoDizilimDiagram(g: DizilimGirdisi): Diagram {
  const els: DiagramEl[] = [];
  const k = OLCEK_DIZILIM;

  if (g.panels.length === 0) {
    caption(els, g.baslik, "Bu dizide pano yok.");
    return fitDiagram(els, 420, 90);
  }

  const sol = 90;
  const ust = 58;
  const toplamEn = g.panels.reduce((t, p) => t + p.widthMm, 0);
  const boy = g.panels[0].heightMm;
  const baza = g.panels[0].baseMm;

  const gW = toplamEn * k;
  const gH = boy * k;
  const bH = baza * k;
  const yUst = ust;
  const yAlt = yUst + gH;
  const yBazaAlt = yAlt + bH;

  caption(els, g.baslik, g.not);

  // Baza: dizinin altında TEK PARÇA — kablo girişi buradandır.
  els.push({
    kind: "rect",
    x: sol,
    y: yAlt,
    w: gW,
    h: bH,
    fill: DCOL.paper,
    stroke: DCOL.ink,
    strokeWidth: 1,
  });
  for (let d = 6; d < gW; d += 9) {
    els.push(ln(sol + d, yAlt + 2, sol + d - 4, yBazaAlt - 2, DCOL.faint, 0.4));
  }
  els.push(txt(sol + gW + 8, yAlt + bH / 2 + 3, `Baza ${baza} mm`, 8, { fill: DCOL.muted, fixed: true }));

  let x = sol;
  for (const p of g.panels) {
    const w = p.widthMm * k;
    els.push({
      kind: "rect",
      x,
      y: yUst,
      w,
      h: gH,
      fill: TUVAL_SOFT,
      stroke: DCOL.ink,
      strokeWidth: 1,
    });

    // Kapak(lar) ve kulplar.
    const kanat = p.doorConfig === "cift" ? 2 : 1;
    const kw = w / kanat;
    for (let i = 0; i < kanat; i++) {
      const kx = x + i * kw;
      els.push({
        kind: "rect",
        x: kx + 2,
        y: yUst + 3,
        w: kw - 4,
        h: gH - 6,
        fill: "none",
        stroke: DCOL.faint,
        strokeWidth: 0.6,
      });
      // Kulp: çift kapakta ortaya bakar, tek kapakta sağ kenarda.
      const kulpX = kanat === 2 && i === 0 ? kx + kw - 6 : kx + kw - 6;
      els.push({
        kind: "rect",
        x: kulpX,
        y: yUst + gH * 0.46,
        w: 3,
        h: gH * 0.08,
        fill: DCOL.muted,
        rx: 0.6,
      });
    }

    // Pano adı — sığıyorsa yazılır (etiket kuralı).
    const adBoyu = 7.5;
    if (w >= p.code.length * adBoyu * 0.58) {
      els.push(
        txt(x + w / 2, yUst - 8, p.code, adBoyu, {
          anchor: "middle",
          fixed: true,
          bold: true,
        })
      );
    }

    // Pano eni ölçüsü.
    dimH(els, x, x + w, yBazaAlt + 16, `${fmtN(p.widthMm, 0)}`, { size: 7.5, clearLabel: true });

    x += w;
  }

  // Toplam en ve gövde yüksekliği.
  dimH(els, sol, sol + gW, yBazaAlt + 38, `Toplam ${fmtN(toplamEn, 0)} mm`, { size: 9 });
  dimV(els, sol - 22, yUst, yAlt, `${fmtN(boy, 0)}`, { size: 8, labelSide: "left" });
  dimV(els, sol - 22, yAlt, yBazaAlt, `${fmtN(baza, 0)}`, { size: 8, labelSide: "left" });
  dimV(els, sol - 46, yUst, yBazaAlt, `Toplam ${fmtN(boy + baza, 0)}`, { size: 8, labelSide: "left" });

  els.push(
    txt(sol, yBazaAlt + 58, `Derinlik ${fmtN(g.panels[0].depthMm, 0)} mm (bütün gözlerde ortak)`, 8.5, {
      fill: DCOL.muted,
      fixed: true,
    })
  );

  return fitDiagram(els, Math.max(460, sol + gW + 110), yBazaAlt + 80);
}

// ═══════════════════════════════════════════════════════ İÇ YERLEŞİM

export interface IcYerlesimGirdisi {
  panel: PanelLayout;
  settings: LayoutSettings;
}

/**
 * Bir panonun montaj plakası: raylar, kanallar, cihazlar GERÇEK ÖLÇEKTE.
 *
 * Gövde ile plaka arasındaki fark çizilir (PANO-3): plaka gövdeden küçüktür ve
 * ray boyu ondan da kısadır. Bu fark çizilmezse kullanıcı gövde enini ray boyu
 * sanır ve sığmayan bir pano sipariş eder.
 */
export function panoIcYerlesimDiagram(g: IcYerlesimGirdisi): Diagram {
  const { panel: p, settings: s } = g;
  const els: DiagramEl[] = [];
  const k = OLCEK_IC;

  const sol = 78;
  const ust = 62;

  const gW = p.widthMm * k;
  const gH = p.heightMm * k;
  const plakaW = plateWidthMm(p.widthMm, s) * k;
  const plakaH = plateHeightMm(p.heightMm, s) * k;
  const plakaX = sol + s.plateSideMm * k;
  const plakaY = ust + s.plateTopMm * k;
  const kanalSayisi = sideDuctCount(p.widthMm, s);
  const rayX = plakaX + (s.sideDuctMm + s.edgeGapMm) * k;

  caption(
    els,
    `${p.code} — iç yerleşim`,
    `${fmtN(p.widthMm, 0)} × ${fmtN(p.heightMm, 0)} × ${fmtN(p.depthMm, 0)} mm · baza ${p.baseMm} · ${p.doorConfig === "cift" ? "çift kapak" : "tek kapak"} · ölçek 1:2`
  );

  // Gövde ve montaj plakası.
  els.push({ kind: "rect", x: sol, y: ust, w: gW, h: gH, fill: "none", stroke: DCOL.ink, strokeWidth: 1.2 });
  els.push({
    kind: "rect",
    x: plakaX,
    y: plakaY,
    w: plakaW,
    h: plakaH,
    fill: TUVAL_SOFT,
    stroke: DCOL.muted,
    strokeWidth: 0.8,
  });

  // Dikey kablo kanalı — dar gövdede TEK yandan (PANO-3).
  const dikeyW = s.sideDuctMm * k;
  kanalCiz(els, plakaX, plakaY, dikeyW, plakaH);
  if (kanalSayisi === 2) kanalCiz(els, plakaX + plakaW - dikeyW, plakaY, dikeyW, plakaH);

  const numaralar = panoNumaralari(p);
  const efsane: { grup: ColorGroup; sayi: number }[] = [];

  for (const ray of p.rails) {
    const yRay = plakaY + ray.yMm * k;
    const hRay = ray.heightMm * k;
    const hKanal = ray.ductMm * k;

    // BÖLGE ADI BİR KEZ YAZILIR. Aynı bölge kapasite dolduğu için birden çok
    // raya taşabilir; her rayın yanına "Kumanda" yazmak beş kez aynı sözcüğü
    // basar ve bölge sınırının nerede olduğunu gizlerdi.
    const bolgeBasi = ray.index === 0 || p.rails[ray.index - 1]?.zone !== ray.zone;
    els.push(
      ln(plakaX, yRay, plakaX + plakaW, yRay, bolgeBasi ? DCOL.muted : DCOL.line, bolgeBasi ? 0.7 : 0.4, bolgeBasi ? undefined : "2 3")
    );
    if (bolgeBasi) {
      els.push(
        txt(sol - 6, yRay + 8, ZONE_LABEL[ray.zone].split(" ")[0], 6.5, {
          anchor: "end",
          fill: DCOL.muted,
          fixed: true,
        })
      );
    }

    if (ray.kind === "din") {
      rayCiz(els, rayX, yRay + hRay - hKanal - 2.2, ray.capacityMm * k);
    }
    kanalCiz(els, rayX, yRay + hRay - hKanal, ray.capacityMm * k, Math.max(2, hKanal - 1));
  }

  for (const y of p.placements) {
    const ray = p.rails[y.railIndex];
    if (!ray) continue;
    const x = rayX + y.xMm * k;
    const w = y.widthMm * k;
    const h = y.heightMm * k;
    const yy = plakaY + y.yMm * k;
    const fill = PANO_RENK[y.colorGroup];

    cihazCiz(els, sembolFor(y.colorGroup), x, yy, w, h, fill, (y.widthMm / y.unitCount) * k);
    if (y.dimSource === "tahmin") tarama(els, x, yy, w, h);

    const kayit = efsane.find((e) => e.grup === y.colorGroup);
    if (kayit) kayit.sayi += y.unitCount;
    else efsane.push({ grup: y.colorGroup, sayi: y.unitCount });

    // ETİKET KURALI: sığan etiket, sığmayan yerine numara, o da sığmıyorsa hiçbir şey.
    const etiket = y.unitCount > 1 ? `${y.label}·${y.unitCount}` : y.label;
    if (w >= etiket.length * 3.4 && w >= EN_KUCUK_ETIKET && h >= 10) {
      els.push(txt(x + w / 2, yy + h / 2 + 2.4, etiket, 6.5, { anchor: "middle", fixed: true }));
    } else if (w >= EN_KUCUK_NUMARA && h >= 10) {
      const n = numaralar.get(yerlesimAnahtari(y));
      if (n) els.push(txt(x + w / 2, yy + h / 2 + 2.4, String(n), 6, { anchor: "middle", fixed: true }));
    }
  }

  // Ölçü zincirleri.
  const yAlt = ust + gH;
  dimH(els, sol, sol + gW, yAlt + 18, `Gövde ${fmtN(p.widthMm, 0)}`, { size: 8 });
  dimH(els, plakaX, plakaX + plakaW, yAlt + 36, `Plaka ${fmtN(plateWidthMm(p.widthMm, s), 0)}`, {
    size: 7.5,
  });
  dimH(els, rayX, rayX + (p.rails[0]?.capacityMm ?? 0) * k, yAlt + 52, `Ray ${fmtN(p.rails[0]?.capacityMm ?? 0, 0)}`, {
    size: 7.5,
  });
  dimV(els, sol - 52, ust, yAlt, `${fmtN(p.heightMm, 0)}`, { size: 8, labelSide: "left" });

  // Efsane (renk grubu) — çizimin altında.
  let ex = sol;
  const ey = yAlt + 74;
  els.push(txt(sol, ey - 12, "Renk grubu", 8, { fill: DCOL.muted, fixed: true, bold: true }));
  for (const e of efsane) {
    els.push({ kind: "rect", x: ex, y: ey - 6, w: 9, h: 9, fill: PANO_RENK[e.grup], stroke: DCOL.ink, strokeWidth: 0.5 });
    const metin = `${COLOR_GROUP_LABEL[e.grup]} (${e.sayi})`;
    els.push(txt(ex + 12, ey + 1.5, metin, 7, { fixed: true }));
    ex += 12 + metin.length * 3.6 + 14;
    if (ex > sol + gW + 180) {
      ex = sol;
      // Sığmayan efsane satırı bir alta iner; `fitDiagram` çerçeveyi büyütür.
    }
  }

  return fitDiagram(els, Math.max(520, sol + gW + 190), ey + 30);
}

// ═══════════════════════════════════════════════════════ KAPAK GÖRÜNÜŞÜ

/** Kapak üstü cihaz yoksa çizim ÜRETİLMEZ — boş bir kapak resmi bilgi taşımaz. */
export function panoKapakDiagram(g: IcYerlesimGirdisi): Diagram | null {
  const { panel: p } = g;
  if (p.doorPlacements.length === 0) return null;

  const els: DiagramEl[] = [];
  const k = OLCEK_IC;
  const sol = 60;
  const ust = 58;
  const gW = p.widthMm * k;
  const gH = p.heightMm * k;

  caption(els, `${p.code} — kapak görünüşü`, `${p.doorPlacements.length} kapak elemanı · ölçek 1:2`);

  els.push({ kind: "rect", x: sol, y: ust, w: gW, h: gH, fill: TUVAL_SOFT, stroke: DCOL.ink, strokeWidth: 1.2 });
  if (p.doorConfig === "cift") {
    els.push(ln(sol + gW / 2, ust, sol + gW / 2, ust + gH, DCOL.faint, 0.8, "4 3"));
  }

  for (const y of p.doorPlacements) {
    const cx = sol + (y.xMm + y.widthMm / 2) * k;
    const cy = ust + (y.yMm + y.heightMm / 2) * k;
    const fill = PANO_RENK[y.colorGroup];

    if (y.colorGroup === "otomasyon") {
      // HMI: ekran çerçevesi.
      const w = Math.max(20, y.widthMm * k);
      const h = Math.max(14, y.heightMm * k);
      els.push({ kind: "rect", x: cx - w / 2, y: cy - h / 2, w, h, fill, stroke: DCOL.ink, strokeWidth: 0.8, rx: 1 });
      els.push({ kind: "rect", x: cx - w / 2 + 2, y: cy - h / 2 + 2, w: w - 4, h: h - 4, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
    } else {
      // Buton / sinyal lambası: 22 mm delik.
      const r = Math.max(4.5, (y.widthMm * k) / 2);
      els.push({ kind: "circle", cx, cy, r, fill, stroke: DCOL.ink, strokeWidth: 0.8 });
      els.push({ kind: "circle", cx, cy, r: r * 0.55, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.4 });
    }
    if (y.dimSource === "tahmin") tarama(els, cx - 5, cy - 5, 10, 10);
    els.push(txt(cx, cy + 16, y.label, 6.5, { anchor: "middle", fixed: true }));
  }

  dimH(els, sol, sol + gW, ust + gH + 18, `${fmtN(p.widthMm, 0)}`, { size: 8 });
  dimV(els, sol - 24, ust, ust + gH, `${fmtN(p.heightMm, 0)}`, { size: 8, labelSide: "left" });

  return fitDiagram(els, Math.max(420, sol + gW + 80), ust + gH + 50);
}
