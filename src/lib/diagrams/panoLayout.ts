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
import type {
  ColorGroup,
  DeviceBox,
  LayoutSettings,
  PanelLayout,
  Placement,
} from "@/lib/switchboard/types";
import { COLOR_GROUP_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import { naturalCompare } from "@/lib/switchboard/panels";
import {
  railCapacityMm,
  plateCapacityHeightMm,
  plateHeightMm,
  plateWidthMm,
} from "@/lib/switchboard/sizes";

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

/**
 * ŞEMA ÖLÇEĞİ 1:N BİÇİMİNDE TUTULUR — çizim çarpanı `k = 1 / N`.
 *
 * Altyazı, adres anahtarı ve açılır kutu aynı dili konuşsun diye payda
 * saklanır; tek dönüşüm noktası `1 / olcek`tir. Kullanıcı 1:2'yi "fazla" buldu
 * (08.09.2026) ve öntanım 1:4 oldu.
 *
 * 1:10 BİLEREK YOK: 85 mm'lik bir cihaz 8,5 birime iner ve `h >= 10` eşiğinin
 * altına düşer — o ölçekte HİÇBİR cihaz ne etiket ne numara alır, PANO-13'ün
 * "resim yerleşimi, liste kimliği" sözleşmesi iki yönden birden kopar.
 */
export const IC_OLCEKLERI = [2, 4, 5] as const;
export type IcOlcek = (typeof IC_OLCEKLERI)[number];
export const IC_OLCEK_ONTANIM: IcOlcek = 4;

/** Dizilim şeması ölçeği [1:N]. `1/6.25 === 0.16` — eski sabitle bit-aynı. */
const DIZILIM_OLCEK = 6.25;

/** `4` → `"1:4"`, `6.25` → `"1:6,25"`. */
export function olcekMetni(payda: number): string {
  return `1:${fmtN(payda, Number.isInteger(payda) ? 0 : 2)}`;
}

/** Adresten gelen ölçek YALNIZ izinli kümedeyse geçerlidir. */
export function icOlcekCoz(ham: string | string[] | undefined): IcOlcek {
  const t = Array.isArray(ham) ? ham[0] : ham;
  const n = t ? Number(t) : NaN;
  return (IC_OLCEKLERI as readonly number[]).includes(n) ? (n as IcOlcek) : IC_OLCEK_ONTANIM;
}

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

function cihazCiz(els: DiagramEl[], sembol: Sembol, x: number, y: number, w: number, h: number, fill: string, birim: number, k: number) {
  govde(els, x, y, w, h, fill);

  switch (sembol) {
    case "salter": {
      klemensAgzi(els, x, y, w, h);
      // Kutup ayrım çizgileri: 17,5 mm'lik modüller.
      // ADIM ÖLÇEKLE GELİR: sabit `0.5` bırakılsaydı 1:4'te üç kutuplu bir
      // şalter (13,1 birim) tek modül sayılır ve kutup ayrımları KAYBOLURDU.
      const modul = w / Math.max(1, Math.round(w / (17.5 * k)));
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
  /** Ölçek 1:N. Öntanım `DIZILIM_OLCEK` (1:6,25 — eski sabitle bit-aynı). */
  olcek?: number;
  /**
   * PANO YANINA ASILAN ekipman — siren, korna, ikaz kolonu, projektör.
   *
   * Dizinin sağında AYRI bir şeritte çizilir. Boşsa şerit hiç çizilmez
   * (`panoKapakDiagram`ın "boş kapak resmi bilgi taşımaz" ilkesi).
   */
  yanCihazlar?: readonly DeviceBox[];
}

/** Dizi ile yan şerit arasındaki ayırıcı boşluk [mm]. */
const YAN_BOSLUK_MM = 400;
/** Yan ekipmanlar arasındaki boşluk [mm]. */
const YAN_ARALIK_MM = 150;
/** Ölçüsü bilinmeyen yan ekipmanın YER TUTUCU kutusu [mm]. */
const YAN_VARSAYILAN_MM = 200;

/**
 * Panolar yan yana, altta tek parça baza.
 *
 * PANOLAR ARASINDA BOŞLUK YOKTUR: yan levhalar ortaktır ve dizinin toplam eni
 * gözlerin toplamıdır. Araya pay koyan bir çizim, imalatçıya yanlış bir toplam
 * en verirdi.
 *
 * GÖZLERİN BOYU AYNI OLMAK ZORUNDA DEĞİLDİR (PANO-33). Saha kutuları ortak boy
 * paylaşmaz (kullanıcı kararı, 09.09.2026); hepsi ORTAK ZEMİNE — bazanın üstüne
 * — oturur ve üst hizaları serbest kalır. Önceki sürüm `panels[0].heightMm`
 * okuyordu: beş kutunun beşi de birincinin boyunda çiziliyor, çizim ile sipariş
 * tablosu ayrışıyordu.
 */
export function panoDizilimDiagram(g: DizilimGirdisi): Diagram {
  const els: DiagramEl[] = [];
  const k = 1 / (g.olcek ?? DIZILIM_OLCEK);

  if (g.panels.length === 0) {
    caption(els, g.baslik, "Bu dizide pano yok.");
    return fitDiagram(els, 420, 90);
  }

  const sol = 90;
  const ust = 58;
  const toplamEn = g.panels.reduce((t, p) => t + p.widthMm, 0);
  const boy = Math.max(...g.panels.map((p) => p.heightMm));
  const esitBoy = g.panels.every((p) => p.heightMm === boy);
  const baza = Math.max(...g.panels.map((p) => p.baseMm));

  const gW = toplamEn * k;
  const gH = boy * k;
  const bH = baza * k;
  const yUst = ust;
  // ZEMİN HATTI: bazanın üstü. Bütün gözler buraya oturur; `yUst` yalnız EN
  // YÜKSEK gözün tepesidir, ötekiler aşağıdan başlar.
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
    const pH = p.heightMm * k;
    // Göz ZEMİNDEN yukarı çizilir; kısa gövdenin tepesi aşağıda kalır.
    const pUst = yAlt - pH;
    els.push({
      kind: "rect",
      x,
      y: pUst,
      w,
      h: pH,
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
        y: pUst + 3,
        w: kw - 4,
        h: pH - 6,
        fill: "none",
        stroke: DCOL.faint,
        strokeWidth: 0.6,
      });
      // Kulp: çift kapakta ORTAYA bakar (sol kanadın sağ, sağ kanadın sol
      // kenarı), tek kapakta sağ kenarda. İki dal aynı ifadeydi ve iki kulp
      // aynı kenara çiziliyordu (T10, 12.09.2026).
      const kulpX = kanat === 2 && i === 1 ? kx + 3 : kx + kw - 6;
      els.push({
        kind: "rect",
        x: kulpX,
        y: pUst + pH * 0.46,
        w: 3,
        h: pH * 0.08,
        fill: DCOL.muted,
        rx: 0.6,
      });
    }

    // Pano adı — sığıyorsa yazılır (etiket kuralı).
    const adBoyu = 7.5;
    if (w >= p.code.length * adBoyu * 0.58) {
      els.push(
        txt(x + w / 2, pUst - 8, p.code, adBoyu, {
          anchor: "middle",
          fixed: true,
          bold: true,
        })
      );
    }

    // Pano eni ölçüsü.
    dimH(els, x, x + w, yBazaAlt + 16, `${fmtN(p.widthMm, 0)}`, { size: 7.5, clearLabel: true });

    // BOYLAR AYRIYSA HER GÖZ KENDİ BOYUNU TAŞIR. Tek bir dikey ölçü zinciri
    // yalnız en yükseği anlatır; kısa kutunun boyu okunmadan sipariş edilemez.
    if (!esitBoy) {
      els.push(
        txt(x + w / 2, yBazaAlt + 27, `h ${fmtN(p.heightMm, 0)}`, 6.5, {
          anchor: "middle",
          fill: DCOL.muted,
          fixed: true,
        })
      );
    }

    x += w;
  }

  // Toplam en ve gövde yüksekliği. Boylar ayrıysa dikey zincir EN YÜKSEK gözü
  // ölçer ve etiketi bunu söyler.
  dimH(els, sol, sol + gW, yBazaAlt + (esitBoy ? 38 : 46), `Toplam ${fmtN(toplamEn, 0)} mm`, {
    size: 9,
  });
  dimV(els, sol - 22, yUst, yAlt, esitBoy ? `${fmtN(boy, 0)}` : `en yüksek ${fmtN(boy, 0)}`, {
    size: 8,
    labelSide: "left",
  });
  dimV(els, sol - 22, yAlt, yBazaAlt, `${fmtN(baza, 0)}`, { size: 8, labelSide: "left" });
  dimV(els, sol - 46, yUst, yBazaAlt, `Toplam ${fmtN(boy + baza, 0)}`, { size: 8, labelSide: "left" });

  const altSatirY = yBazaAlt + (esitBoy ? 58 : 66);
  els.push(
    txt(sol, altSatirY, `Derinlik ${fmtN(g.panels[0].depthMm, 0)} mm (bütün gözlerde ortak)`, 8.5, {
      fill: DCOL.muted,
      fixed: true,
    })
  );
  if (!esitBoy) {
    els.push(
      txt(
        sol,
        altSatirY + 12,
        "Yükseklik KUTU BAŞINADIR; gözler ortak zemine oturur, üst hizaları serbesttir.",
        8.5,
        { fill: DCOL.muted, fixed: true }
      )
    );
  }

  // ═══════════════════════════════════════════ PANO YANI EKİPMANLARI
  //
  // Kullanıcının cümlesi (08.09.2026): "şemada panoların yanında dursun,
  // bunlar genelde sahada oluyor ya da panonun yanına falan asılıyor."
  //
  // Şerit dizinin SAĞINDA, PANOLARLA AYNI ÖLÇEKTE durur ki okuyan kişi bir
  // sirenin panoya göre ne kadar olduğunu görebilsin. Kesikli bir ayırıcı,
  // şeridin bir göz sanılmasını engeller.
  //
  // TOPLAM EN ÖLÇÜSÜNE GİRMEZ: yukarıdaki `Toplam N mm` imalatçıya giden dizi
  // enidir ve bir sirenle büyümez. Yalnız çizim tuvali genişler.
  const yanlar = [...(g.yanCihazlar ?? [])].sort((a, b) => naturalCompare(a.label, b.label));
  // ÖLÇÜSÜ BİLİNEN yan ekipman kutu olarak çizilir; bilinmeyen LİSTELENİR (T11,
  // Plan S7). Soru işaretli dört kutu dizilimin yarısını kaplıyor ve hiçbir
  // bilgi taşımıyordu; bir satır metin aynı şeyi söyler ve şemayı bastırmaz.
  const cizilecek = yanlar.filter((d) => d.widthMm !== null && d.heightMm !== null);
  const listelenecek = yanlar.filter((d) => d.widthMm === null || d.heightMm === null);
  let yanSagKenar = sol + gW;
  let altSatir = altSatirY + (esitBoy ? 12 : 24);
  if (cizilecek.length > 0) {
    const ayiracX = sol + gW + (YAN_BOSLUK_MM / 2) * k;
    els.push(ln(ayiracX, yUst - 20, ayiracX, yBazaAlt + 6, DCOL.faint, 0.8, "5 4"));
    els.push(
      txt(ayiracX + 8, yUst - 24, `Pano yanı ekipmanları (${cizilecek.length})`, 8, {
        fill: DCOL.muted,
        fixed: true,
        bold: true,
      })
    );

    let yx = sol + gW + YAN_BOSLUK_MM * k;
    for (const d of cizilecek) {
      const enMm = d.widthMm ?? YAN_VARSAYILAN_MM;
      const boyMm = d.heightMm ?? YAN_VARSAYILAN_MM;
      const w = Math.max(4, enMm * k);
      const h = Math.max(4, boyMm * k);
      // Cihazlar panonun ALT hattına oturur: göz onları gövdeyle aynı zeminde
      // karşılaştırabilsin.
      const yy = yAlt - h;
      els.push({
        kind: "rect",
        x: yx,
        y: yy,
        w,
        h,
        fill: PANO_RENK[d.colorGroup],
        stroke: DCOL.ink,
        strokeWidth: 0.7,
        rx: 0.8,
      });
      els.push(txt(yx + w / 2, yAlt + 12, d.label, 7, { anchor: "middle", fixed: true }));
      els.push(
        txt(yx + w / 2, yAlt + 21, `${fmtN(enMm, 0)}×${fmtN(boyMm, 0)}`, 6, {
          anchor: "middle",
          fill: DCOL.muted,
          fixed: true,
        })
      );
      yx += w + YAN_ARALIK_MM * k;
    }
    yanSagKenar = yx;
  }
  if (listelenecek.length > 0) {
    els.push(
      txt(
        sol,
        altSatir,
        `Pano yanına asılır, ölçüsü defterde yok: ${listelenecek.map((d) => d.label).join(" · ")}`,
        8,
        { fill: DCOL.muted, fixed: true }
      )
    );
    altSatir += 12;
  }

  return fitDiagram(els, Math.max(460, yanSagKenar + 110), Math.max(yBazaAlt + (esitBoy ? 80 : 100), altSatir + 10));
}

// ═══════════════════════════════════════════════════════ İÇ YERLEŞİM

/**
 * Şemadaki bir cihazın TIKLANABİLİR dikdörtgeni [çizim birimi].
 *
 * Koordinatlar diyagramın kendi ekseninde verilir ve `fitDiagram` sonrasında da
 * geçerlidir: `fitDiagram` yalnız ÖLÇER ve görüş kutusunu genişletir, hiçbir
 * elemanı ötelemez. `resolveTextOverlaps` de yalnız `text` elemanlarını oynatır.
 */
export interface IcKutu {
  /** `panoNumaralari` ile AYNI anahtar — iki liste birbirine bağlanabilsin. */
  anahtar: string;
  deviceKey: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Şemaya yazılabilen numara; sığmadıysa `null`. */
  no: number | null;
}

export interface IcYerlesimCizimi {
  diagram: Diagram;
  kutular: IcKutu[];
  /** Ne etiketi ne numarası sığan cihaz sayısı — altyazı bunu söyler. */
  yazisiz: number;
}

/**
 * Bir noktaya en yakın cihaz kutusu — önce İÇİNDEKİ, sonra yakındaki.
 *
 * Hoşgörü olmadan 1:4'te 1,3 birimlik bir klemens hiç tıklanamazdı; parmakla
 * hiç tıklanamaz. Saf tutulur: DOM olmadan sınanabilir.
 */
export function kutuBul(kutular: readonly IcKutu[], x: number, y: number, tolerans = 4): IcKutu | null {
  let enYakin: IcKutu | null = null;
  let enKisa = Number.POSITIVE_INFINITY;
  for (const kutu of kutular) {
    const dx = x < kutu.x ? kutu.x - x : x > kutu.x + kutu.w ? x - (kutu.x + kutu.w) : 0;
    const dy = y < kutu.y ? kutu.y - y : y > kutu.y + kutu.h ? y - (kutu.y + kutu.h) : 0;
    if (dx === 0 && dy === 0) return kutu;
    const d = Math.hypot(dx, dy);
    if (d < enKisa) {
      enKisa = d;
      enYakin = kutu;
    }
  }
  return enKisa <= tolerans ? enYakin : null;
}

/**
 * SÜRÜKLENEN AYGITIN BIRAKILDIĞI KOMŞULUK — saf, DOM'suz, sınanabilir (PANO-38).
 *
 * `komsu` bırakıldığı yerdeki aygıt, `oncesine` imlecin o aygıtın orta
 * noktasının solunda olup olmadığı. Sonuç bir indeks DEĞİL bir komşuluktur:
 * "taşınan, komşunun önüne/sonrasına". İndeks, ekranın ve çözücünün aynı
 * listeyi saymasını gerektiriyordu ve ölçüldü (0026): first-fit iki listeyi
 * ayırınca cihaz bırakılan yere gitmiyordu.
 *
 * Aygıtı kendi üstüne bırakmak karar üretmez. Komşu ile taşınan zaten
 * bitişikse ve yön aynıysa yine karar üretmez — gereksiz bir sabitleme
 * yazılmaz.
 */
export interface BirakmaHedefi {
  komsu: string;
  yon: "once" | "sonra";
}

export function birakmaHedefi(
  sirali: readonly string[],
  tasinan: string,
  komsu: string,
  oncesine: boolean
): BirakmaHedefi | null {
  if (komsu === tasinan) return null;
  const k = sirali.indexOf(komsu);
  if (k < 0) return null;
  const eski = sirali.indexOf(tasinan);
  const yon: "once" | "sonra" = oncesine ? "once" : "sonra";
  if (eski >= 0) {
    if (yon === "once" && eski === k - 1) return null;
    if (yon === "sonra" && eski === k + 1) return null;
  }
  return { komsu, yon };
}

/**
 * ESKİ İNDEKS HESABI — yalnız eski biçim kayıtlar ve testler için durur;
 * ekran artık `birakmaHedefi` kullanır.
 */
export function birakmaIndeksi(
  sirali: readonly string[],
  tasinan: string,
  komsu: string,
  oncesine: boolean
): number | null {
  const k = sirali.indexOf(komsu);
  if (k < 0) return null;
  const eski = sirali.indexOf(tasinan);
  let hedef = oncesine ? k : k + 1;
  if (eski >= 0 && hedef > eski) hedef -= 1;
  return Math.max(0, Math.min(Math.max(0, sirali.length - 1), hedef));
}

export interface IcYerlesimGirdisi {
  panel: PanelLayout;
  settings: LayoutSettings;
  /** Ölçek 1:N. Öntanım `IC_OLCEK_ONTANIM` (1:4). */
  olcek?: IcOlcek;
  /**
   * Altyazıya "ölçek 1:N" YAZILSIN MI?
   *
   * Yalnız 1 çizim birimi = 1 piksel olan tüketicide DOĞRUDUR (ekran ve
   * indirilen SVG). PDF çizimi sayfaya yeniden sığdırır (`pdf/diagram.tsx`
   * `maxWidth`/`maxHeight` ile küçültür), yani kâğıttaki oran modelin ölçeği
   * DEĞİLDİR; orada bu ibare bir yalandır ve kapatılır.
   */
  olcekYazisi?: boolean;
}

/**
 * Bir panonun montaj plakası: raylar, kanallar, cihazlar GERÇEK ÖLÇEKTE.
 *
 * Gövde ile plaka arasındaki fark çizilir (PANO-3): plaka gövdeden küçüktür ve
 * ray boyu ondan da kısadır. Bu fark çizilmezse kullanıcı gövde enini ray boyu
 * sanır ve sığmayan bir pano sipariş eder.
 */
export function panoIcYerlesimDiagram(g: IcYerlesimGirdisi): Diagram {
  return panoIcYerlesim(g).diagram;
}

/**
 * Çizim VE tıklama kutuları — TEK GEOMETRİ GEÇİŞİNDEN.
 *
 * Şemada bir cihaza tıklayınca bilgi baloncuğu açılması isteniyor; bunun için
 * her cihazın çizim birimindeki dikdörtgeni gerekir. O dikdörtgeni İKİNCİ bir
 * döngüde yeniden hesaplamak, `pdf/diagram.tsx`in başındaki uyarının anlattığı
 * hatanın aynısı olurdu: iki paralel uygulama bir gün ayrışır ve baloncuk
 * YANLIŞ cihazı anlatır. Kutular çizimin kendi döngüsünde toplanır.
 */
export function panoIcYerlesim(g: IcYerlesimGirdisi): IcYerlesimCizimi {
  const { panel: p, settings: s } = g;
  const olcek = g.olcek ?? IC_OLCEK_ONTANIM;
  const els: DiagramEl[] = [];
  const kutular: IcKutu[] = [];
  let yazisiz = 0;
  const k = 1 / olcek;

  const sol = 78;
  const ust = 62;

  const gW = p.widthMm * k;
  const gH = p.heightMm * k;
  const plakaW = plateWidthMm(p.widthMm, s) * k;
  const plakaH = plateHeightMm(p.heightMm, s) * k;
  const plakaX = sol + s.plateSideMm * k;
  const plakaY = ust + s.plateTopMm * k;
  const rayX = plakaX + (s.sideDuctMm + s.edgeGapMm) * k;
  // PLAKANIN RAY KAPASİTESİ — ray yığını bunu aşarsa cihazlar plakanın DIŞINA
  // taşar ve bu GÖRÜNMEK ZORUNDADIR (PANO-37). Kullanıcının cümlesi
  // (09.09.2026): "bazı şeyler dışarda duruyor ama panoya sığmış gibi
  // görünüyor." Önceki sürüm taşan rayı sessizce plakanın altına çiziyordu.
  const kapasiteH = plateCapacityHeightMm(p.heightMm, s);
  // YIĞIN = en alttaki rayın alt kenarı (cep rayları bandın içindedir,
  // toplama girmez — PANO-39).
  const rayYigini = p.rails.reduce((t, r) => Math.max(t, r.yMm + r.heightMm), 0) - s.edgeGapMm;
  const tasti = rayYigini > kapasiteH;

  caption(
    els,
    `${p.code} — iç yerleşim`,
    `${fmtN(p.widthMm, 0)} × ${fmtN(p.heightMm, 0)} × ${fmtN(p.depthMm, 0)} mm · baza ${p.baseMm} · ${p.doorConfig === "cift" ? "çift kapak" : "tek kapak"}${g.olcekYazisi === false ? "" : ` · ölçek ${olcekMetni(olcek)}`}`
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

  // Dikey kablo kanalı — TEK ve HEP SOLDA (PANO-37, kullanıcı kararı).
  const dikeyW = s.sideDuctMm * k;
  kanalCiz(els, plakaX, plakaY, dikeyW, plakaH);

  const numaralar = panoNumaralari(p);
  const efsane: { grup: ColorGroup; sayi: number }[] = [];

  // PLAKA KAPASİTE SINIRI — taşma varsa çizilir ve etiketlenir.
  if (tasti) {
    const ySinir = plakaY + (s.edgeGapMm + kapasiteH) * k;
    els.push(ln(plakaX - 6, ySinir, plakaX + plakaW + 6, ySinir, DCOL.accent, 1.1, "6 4"));
    els.push(
      txt(plakaX + plakaW + 8, ySinir + 3, "plaka sınırı", 6.5, {
        fill: DCOL.accent,
        fixed: true,
        bold: true,
      })
    );
  }

  const tamKapasite = railCapacityMm(p.widthMm, s);
  for (const ray of p.rails) {
    const yRay = plakaY + ray.yMm * k;
    const hRay = ray.heightMm * k;
    const hKanal = ray.ductMm * k;
    // CEP RAYI kendi x'inden başlar ve cebin eni kadardır (PANO-39).
    const xRay = rayX + ray.xMm * k;
    const wRay = ray.capacityMm * k;
    // Bu ray plakanın ray kapasitesini aşıyor mu? (Sınırı KESEN ray de sayılır.)
    const rayTasti = ray.yMm + ray.heightMm > s.edgeGapMm + kapasiteH;

    // BÖLGE ADI BİR KEZ YAZILIR. Aynı bölge kapasite dolduğu için birden çok
    // raya taşabilir; her rayın yanına "Kumanda" yazmak beş kez aynı sözcüğü
    // basar ve bölge sınırının nerede olduğunu gizlerdi.
    //
    // BÖLGE ARTIK RAY AÇMIYOR (PANO-37): bir rayda birkaç bölge olabilir, o
    // yüzden yazılan ad rayın BASKIN bölgesidir ve yalnız değiştiğinde çıkar.
    const bolgeBasi = ray.index === 0 || p.rails[ray.index - 1]?.zone !== ray.zone;
    // Bölge çizgisi rayın kendi eni kadardır; cep rayında sürücünün üstünden
    // geçmez.
    els.push(
      ln(ray.pocketOf === null ? plakaX : xRay - 2, yRay, ray.pocketOf === null ? plakaX + plakaW : xRay + wRay + 2, yRay, bolgeBasi ? DCOL.muted : DCOL.line, bolgeBasi ? 0.7 : 0.4, bolgeBasi ? undefined : "2 3")
    );
    // CEBİN SOLUNDAKİ DİKEY KANAL — sürücü ile cep rayı arasındaki sütun payı.
    if (ray.pocketOf !== null) {
      kanalCiz(els, xRay - s.columnGapMm * k, yRay, Math.max(2, s.columnGapMm * k - 2), hRay);
    }
    if (bolgeBasi && ray.pocketOf === null) {
      els.push(
        txt(sol - 6, yRay + 8, ZONE_LABEL[ray.zone].split(" ")[0], 6.5, {
          anchor: "end",
          fill: DCOL.muted,
          fixed: true,
        })
      );
    }

    if (ray.kind === "din") {
      rayCiz(els, xRay, yRay + hRay - hKanal - 2.2, wRay);
    }
    kanalCiz(els, xRay, yRay + hRay - hKanal, wRay, Math.max(2, hKanal - 1));

    // TAŞAN RAY UYARI RENGİNDE ÇERÇEVELENİR: plakanın dışında duran bir cihaz,
    // sığmış gibi görünmemelidir.
    if (rayTasti) {
      els.push({
        kind: "rect",
        x: xRay - 3,
        y: yRay,
        w: wRay + 6,
        h: hRay,
        fill: "none",
        stroke: DCOL.accent,
        strokeWidth: 0.9,
        rx: 1,
      });
    }
  }

  for (const y of p.placements) {
    const ray = p.rails[y.railIndex];
    if (!ray) continue;
    const x = rayX + y.xMm * k;
    const w = y.widthMm * k;
    const h = y.heightMm * k;
    const yy = plakaY + y.yMm * k;
    const fill = PANO_RENK[y.colorGroup];

    cihazCiz(els, sembolFor(y.colorGroup), x, yy, w, h, fill, (y.widthMm / y.unitCount) * k, k);
    if (y.dimSource === "tahmin") tarama(els, x, yy, w, h);

    const numara = numaralar.get(yerlesimAnahtari(y)) ?? null;
    kutular.push({ anahtar: yerlesimAnahtari(y), deviceKey: y.deviceKey, label: y.label, x, y: yy, w, h, no: numara });

    const kayit = efsane.find((e) => e.grup === y.colorGroup);
    if (kayit) kayit.sayi += y.unitCount;
    else efsane.push({ grup: y.colorGroup, sayi: y.unitCount });

    // ETİKET KURALI: sığan etiket, sığmayan yerine numara, o da sığmıyorsa hiçbir şey.
    //
    // NUMARANIN ENİ RAKAM SAYISINA BAĞLIDIR (T9): 1:4'te 15,8 mm'lik röle 4
    // birimdir ve iki basamaklı bir numara komşusunun üstüne taşıyordu — eşik
    // yalnız "7 birim" diyordu, kaç rakam olduğuna bakmıyordu.
    const etiket = y.unitCount > 1 ? `${y.label}·${y.unitCount}` : y.label;
    const n = numaralar.get(yerlesimAnahtari(y));
    const numaraEni = n ? String(n).length * 3.6 + 1 : Number.POSITIVE_INFINITY;
    if (w >= etiket.length * 3.4 && w >= EN_KUCUK_ETIKET && h >= 10) {
      els.push(txt(x + w / 2, yy + h / 2 + 2.4, etiket, 6.5, { anchor: "middle", fixed: true }));
    } else if (n && w >= Math.max(EN_KUCUK_NUMARA, numaraEni) && h >= 10) {
      els.push(txt(x + w / 2, yy + h / 2 + 2.4, String(n), 6, { anchor: "middle", fixed: true }));
    } else {
      // NE ETİKET NE NUMARA SIĞDI. Ölçek küçüldükçe artar (1:4'te tek kutuplu
      // bir otomat 4,4 birime iner) ve kullanıcı bunu BİLMELİ — kimlik o zaman
      // yalnız cihaz listesindedir (PANO-13 merdiveninin son basamağı).
      yazisiz++;
    }
  }

  // Ölçü zincirleri.
  const yAlt = ust + gH;
  dimH(els, sol, sol + gW, yAlt + 18, `Gövde ${fmtN(p.widthMm, 0)}`, { size: 8 });
  dimH(els, plakaX, plakaX + plakaW, yAlt + 36, `Plaka ${fmtN(plateWidthMm(p.widthMm, s), 0)}`, {
    size: 7.5,
  });
  dimH(els, rayX, rayX + tamKapasite * k, yAlt + 52, `Ray ${fmtN(tamKapasite, 0)}`, {
    size: 7.5,
  });
  dimV(els, sol - 52, ust, yAlt, `${fmtN(p.heightMm, 0)}`, { size: 8, labelSide: "left" });

  // Efsane (renk grubu) — çizimin altında, SATIR SATIR.
  //
  // Sığmayan öğe bir alt satıra iner: eski sürüm `ex`i başa alıyor ama `ey`i
  // ilerletmiyordu; dar gövdede (400 mm) ikinci öğe birincinin ÜSTÜNE
  // yazılıyordu (T8, kullanıcı ekran görüntüsü 12.09.2026).
  let ex = sol;
  let ey = yAlt + 74;
  const efsaneSagSinir = Math.max(sol + gW + 180, sol + 420);
  els.push(txt(sol, ey - 12, "Renk grubu", 8, { fill: DCOL.muted, fixed: true, bold: true }));
  for (const e of efsane) {
    const metin = `${COLOR_GROUP_LABEL[e.grup]} (${e.sayi})`;
    const genislik = 12 + metin.length * 3.6 + 14;
    if (ex > sol && ex + genislik > efsaneSagSinir) {
      ex = sol;
      ey += 14;
    }
    els.push({ kind: "rect", x: ex, y: ey - 6, w: 9, h: 9, fill: PANO_RENK[e.grup], stroke: DCOL.ink, strokeWidth: 0.5 });
    els.push(txt(ex + 12, ey + 1.5, metin, 7, { fixed: true }));
    ex += genislik;
  }

  if (yazisiz > 0) {
    els.push(
      txt(sol, ey + 18, `${yazisiz} cihazın etiketi bu ölçekte sığmadı; kimlikleri listededir.`, 7, {
        fill: DCOL.muted,
        fixed: true,
      })
    );
  }
  if (tasti) {
    els.push(
      txt(
        sol,
        ey + (yazisiz > 0 ? 30 : 18),
        `Ray yığını ${fmtN(rayYigini, 0)} mm; plakada ${fmtN(kapasiteH, 0)} mm var — sınırın altındaki raylar BU GÖVDEYE SIĞMIYOR.`,
        7,
        { fill: DCOL.accent, fixed: true, bold: true }
      )
    );
  }

  return {
    diagram: fitDiagram(
      els,
      Math.max(520, sol + gW + 190),
      ey + 30 + (yazisiz > 0 ? 16 : 0) + (tasti ? 16 : 0)
    ),
    kutular,
    yazisiz,
  };
}

