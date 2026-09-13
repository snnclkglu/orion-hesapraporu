// RAY PAKETLEYİCİ — bantlar, cepler ve DIN rayları (PANO-4 · PANO-37 · PANO-39).
//
// ═══════════════════════════════════════════════ NEDEN MaxRects DEĞİL
//
// Sac plaka yerleşimi (`lib/purchasing/hammadde/nesting.ts`) MaxRects kullanır
// ve doğrusu odur: parça plakada istediği yerde durabilir. PANODA DURAMAZ.
// Modüler cihaz 35 mm'lik TS35 rayına oturur ve ray YATAYDIR; serbest bir 2B
// paketleyici bir kontaktörü iki rayın arasında havada bırakırdı.
//
// ═══════════════════════════════════════════════ BANT + CEP (PANO-39)
//
// Plaka, tam enli BANTLARIN dikey yığınıdır. Bir bant ya bir DIN rayıdır ya da
// plakaya vidalanan cihazların yan yana durduğu bir PLAKA BANDIdır. Plaka
// bandında cihazlar BOYCA BÜYÜKTEN KÜÇÜĞE sola dizilir; en uzun cihazın
// yanında, kısa cihazların ALTINDA kalan dikdörtgen bir CEPtir ve o cebe DIN
// rayları açılır — rayın eni cebin eni kadardır, yine yataydır (PANO-4
// korunur).
//
// Ölçüldü (0026-01, 12.09.2026): 922 mm'lik 90 kW sürücü tam enli bir satır
// açıyordu; yanındaki üç 546 mm'lik sürücünün altında 436 × 633 mm = 0,28 m²
// ölü alan kalıyordu ve bütün kumanda rayları (250 mm × 1025 mm) o boşluğa
// sığarken pano ikiye bölünüp fazladan 400 mm'lik bir göz açılıyordu.
//
// Cep rayının solunda bir SÜTUN PAYI (`columnGapMm`) bırakılır: uzun cihazın
// kablo iniş yolu ve soğuma mesafesi.
//
// ÖNCE PLAKA, SONRA DIN. Sütunlu kipte plaka cihazlarının TAMAMI önce
// bantlara dağıtılır, DIN cihazları sonra gelir: cebin geometrisi bandın
// cihazlarından türer ve bant DIN rayı aldıktan sonra büyüyemez. İlk deneme
// bandı "donduruyordu" ve ölçüldü (0026): ana şalter `Q12`, `F14`ten sonra
// sıralandığı için donmuş bandın dışında kalıp panonun dibinde yeni bir bant
// açtı. Plaka bandı DIN raylarının üstünde durur — güç üstte, kumanda altta —
// ve bu, "sürücüler en üstte" kuralının doğal uzantısıdır.
//
// PLAKA BANDI EN AZ BÜYÜYEN BANTTIR. DIN cihazı "etkin ray"a (sonuncuya)
// eklenir; plaka cihazı için bu pahalıdır — 546 mm'lik bir sürücüyü 193 mm'lik
// bir banda atmak bandı tam enli 353 mm büyütür. Sütunlu kipte plaka cihazı
// önce büyütmeyen banda, yoksa en az büyüten banda gider.
//
// Anahtar `columnsEnabled` kapalıyken cep hiç açılmaz ve çıktı eski tam-enli
// raf modeliyle bit-aynıdır; gerileme bu anahtarla ölçülür.
//
// ═══════════════════════════════════════════════ İKİ GEÇİŞ
//
// Önce cihazlar raylara DAĞITILIR (bant/ray/cep seçimi), sonra geometri
// hesaplanır (bant yükseklikleri, cep konumları, y'ler). Tek geçişte
// yapılamaz: bir banda sonradan cihaz eklenebildiği için yüksekliği ancak
// dağıtım bittiğinde kesinleşir; cep de ancak o zaman ölçülebilir.
//
// ═══════════════════════════════════════════════ DETERMİNİZM BİR ŞARTTIR
//
// Aynı girdi iki kez yerleştirildiğinde aynı plan çıkmalıdır; yoksa ekrandaki
// resim ile imalatçıya giden çıktı ayrışır. Hiçbir yerde rastgelelik yoktur.

import { railCapacityMm } from "../sizes";
import type { DeviceBox, LayoutSettings, Placement, Rail, Unplaced, Zone } from "../types";
import { bolgeOf, sirala, turOf } from "./sirala";

export interface PackResult {
  rails: Rail[];
  placements: Placement[];
  unplaced: Unplaced[];
  /** Çözücünün nihai aygıt sırası (PANO-38). */
  order: string[];
  /** Uygulanamayan sabitlemeler — ekran söyler. */
  pinIssues: { key: string; sebep: string }[];
  /** Ray yığınının en alt noktası + kenar payı [mm]. */
  totalHeightMm: number;
  usedMm: number;
  capacityMm: number;
}

/**
 * ÜST SINIR — ölçüldü: 0019-00'da en kalabalık pano (LVD10) 659 parça taşıyor
 * ve bunların çoğu klemenstir. 4000 birim, o panonun altı katıdır; sınırın
 * kendisi bir kısıt değil, bozuk bir adetin (ör. birim hatası yüzünden 10^6)
 * tarayıcıyı kilitlemesine karşı bir emniyettir.
 */
export const MAX_UNITS = 4000;

interface Yerlesim {
  d: DeviceBox;
  dilim: number;
  adet: number;
  /** Ray içinde sol kenar [mm] — plaka bandında 2. geçişte yeniden yazılır. */
  xMm: number;
}

/** Bir plaka bandının kısa cihazlarının altında kalan boşluk. */
interface Cep {
  /** Cebin solu, ray başlangıcından [mm]. */
  x: number;
  w: number;
  /** Cebin üstü, bandın üstünden [mm]. */
  y0: number;
  /** Cebin toplam boyu [mm] — bandın kanalı hariç. */
  h: number;
  /** Cebe açılan raylar (yaratılış sırasıyla). */
  raylar: RayTaslagi[];
}

interface RayTaslagi {
  seri: number;
  kind: "din" | "plaka";
  /** Sol kenar, ray başlangıcından [mm]. */
  xMm: number;
  kapasite: number;
  /** Doldurma imleci [mm]. */
  x: number;
  /** En yüksek cihaz ihtiyacı (ısı payları dâhil) [mm]. */
  yukseklik: number;
  sonGrup: string | null;
  yerlesimler: Yerlesim[];
  /** Bu ray bir cepteyse cebi ve cepteki sırası. */
  cep: { band: RayTaslagi; cep: Cep } | null;
  /** Plaka bandının cepleri (2. geçişte ya da ilk cep isteğinde hesaplanır). */
  cepler: Cep[] | null;
}

function ihtiyac(d: DeviceBox): number {
  return (d.heightMm ?? 0) + d.clearanceTopMm + d.clearanceBottomMm;
}

export function paketle(
  devices: DeviceBox[],
  panelWidthMm: number,
  s: LayoutSettings
): PackResult {
  const tamKapasite = railCapacityMm(panelWidthMm, s);
  const unplaced: Unplaced[] = [];
  const raylar: RayTaslagi[] = [];
  let seri = 0;

  const rayAc = (kind: "din" | "plaka", cep: { band: RayTaslagi; cep: Cep } | null): RayTaslagi => {
    const yeni: RayTaslagi = {
      seri: seri++,
      kind,
      xMm: cep ? cep.cep.x + s.columnGapMm : 0,
      kapasite: cep ? cep.cep.w - s.columnGapMm : tamKapasite,
      x: 0,
      yukseklik: 0,
      sonGrup: null,
      yerlesimler: [],
      cep,
      cepler: null,
    };
    raylar.push(yeni);
    if (cep) cep.cep.raylar.push(yeni);
    return yeni;
  };

  const aileP = (r: RayTaslagi, d: DeviceBox) =>
    r.x > 0 && r.sonGrup !== null && r.sonGrup !== d.colorGroup ? s.familyGapMm : 0;

  /** Bu rayda, aile payı düşülmüş, kaç mm yer var? */
  const bosluk = (r: RayTaslagi, d: DeviceBox): number => r.kapasite - r.x - aileP(r, d);

  /** Cepteki bir ray bu yüksekliğe BÜYÜYEBİLİR mi? Cebin dibini aşamaz. */
  const cepteSigar = (r: RayTaslagi, yeniYukseklik: number): boolean => {
    if (!r.cep) return true;
    const cep = r.cep.cep;
    let y = 0;
    for (const x of cep.raylar) {
      if (x === r) break;
      y += x.yukseklik + s.railDuctMm;
    }
    return y + yeniYukseklik + s.railDuctMm <= cep.h + 1e-6;
  };

  const koy = (r: RayTaslagi, d: DeviceBox, dilim: number, adet: number, birimEn: number) => {
    const pay = aileP(r, d);
    r.yerlesimler.push({ d, dilim, adet, xMm: r.x + pay });
    r.x += pay + birimEn * adet;
    r.sonGrup = d.colorGroup;
    r.yukseklik = Math.max(r.yukseklik, ihtiyac(d));
  };

  /**
   * Plaka bandının cepleri. Cihazlar BOYCA BÜYÜKTEN KÜÇÜĞE sola dizilir; en
   * uzun cihazdan sonraki kısa cihazların üstünde kalan boşluk tek bir ceptir,
   * bandın sağında kalan boş en ikinci bir cep.
   */
  const cepleriHesapla = (band: RayTaslagi): Cep[] => {
    if (band.cepler) return band.cepler;
    const sirali = [...band.yerlesimler].sort(
      (a, b) => ihtiyac(b.d) - ihtiyac(a.d) || a.xMm - b.xMm
    );
    // x'ler yeniden yazılır: uzun cihaz solda.
    let x = 0;
    let sonGrup: string | null = null;
    for (const y of sirali) {
      const pay = x > 0 && sonGrup !== null && sonGrup !== y.d.colorGroup ? s.familyGapMm : 0;
      y.xMm = x + pay;
      x = y.xMm + (y.d.widthMm ?? 0) * y.adet;
      sonGrup = y.d.colorGroup;
    }
    band.yerlesimler = sirali;
    band.x = x;

    const cepler: Cep[] = [];
    const H0 = band.yukseklik;
    // CEP = en uzun cihaz(lar)dan SONRAKİ kısa cihazların üstü. Boyca sıralı
    // olduğu için kısalar ardışıktır; eşit boyda iki uzun cihaz varsa cep
    // ikincisinden sonra başlar.
    const sonUzun = sirali.reduce((m, y, i) => (ihtiyac(y.d) >= H0 - 1e-6 ? i : m), -1);
    const kisa = sirali.slice(sonUzun + 1);
    if (kisa.length > 0) {
      const bas = kisa[0].xMm;
      const son = kisa[kisa.length - 1];
      const w = son.xMm + (son.d.widthMm ?? 0) * son.adet - bas;
      const y0 = Math.max(...kisa.map((y) => ihtiyac(y.d)));
      if (w - s.columnGapMm >= s.minRailMm && H0 - y0 > 0) {
        cepler.push({ x: bas, w, y0, h: H0 - y0, raylar: [] });
      }
    }
    // Sağda kalan boş en.
    const sagW = band.kapasite - band.x;
    if (sagW - s.columnGapMm >= s.minRailMm && H0 > 0) {
      cepler.push({ x: band.x, w: sagW, y0: 0, h: H0, raylar: [] });
    }
    band.cepler = cepler;
    return cepler;
  };

  /** Yeni bir DIN rayı için uygun cep — en erken bant, en soldaki cep. */
  const cepBul = (d: DeviceBox, birimEn: number): { band: RayTaslagi; cep: Cep } | null => {
    if (!s.columnsEnabled) return null;
    const gerekEn = d.splittable ? Math.max(s.minRailMm, birimEn) : Math.max(s.minRailMm, birimEn);
    for (const band of raylar) {
      if (band.kind !== "plaka" || band.yerlesimler.length === 0) continue;
      for (const cep of cepleriHesapla(band)) {
        if (cep.w - s.columnGapMm < gerekEn) continue;
        const dolu = cep.raylar.reduce((t, r) => t + r.yukseklik + s.railDuctMm, 0);
        if (dolu + ihtiyac(d) + s.railDuctMm <= cep.h + 1e-6) return { band, cep };
      }
    }
    return null;
  };

  // ── 1. GEÇİŞ: cihazları raylara dağıt ──────────────────────────────────
  const siralama = sirala(devices);
  const order = siralama.sira.map((d) => d.key);

  // Sütunlu kipte ÖNCE plaka, SONRA DIN (gerekçe dosya başında). Kapalıyken
  // sıra olduğu gibi tüketilir — eski raf modeli bit-aynı.
  const tuketim = s.columnsEnabled
    ? [
        ...siralama.sira.filter((d) => turOf(d) === "plaka"),
        ...siralama.sira.filter((d) => turOf(d) === "din"),
      ]
    : siralama.sira;

  for (const d of tuketim) {
    const kind = turOf(d);
    const birimEn = d.widthMm ?? 0;
    const gerek = ihtiyac(d);

    let kalan = Math.min(d.unitCount, MAX_UNITS);
    let dilim = 0;
    let guvenlik = 0;

    while (kalan > 0) {
      if (++guvenlik > MAX_UNITS + raylar.length + 8) break;

      const sigabilir = (r: RayTaslagi): number => {
        if (r.kind !== kind) return 0;
        const n = birimEn > 0 ? Math.floor(bosluk(r, d) / birimEn) : 0;
        return d.splittable ? Math.min(kalan, n) : n >= kalan ? kalan : 0;
      };

      let hedef: RayTaslagi | null = null;
      let konacak = 0;

      if (kind === "plaka" && s.columnsEnabled) {
        // EN AZ BÜYÜYEN BANT: önce büyütmeyen, yoksa en az büyüten.
        let enIyi: { r: RayTaslagi; buyume: number } | null = null;
        for (const r of raylar) {
          if (sigabilir(r) <= 0) continue;
          const buyume = Math.max(0, gerek - r.yukseklik);
          if (!enIyi || buyume < enIyi.buyume) enIyi = { r, buyume };
          if (buyume === 0) break;
        }
        if (enIyi) {
          hedef = enIyi.r;
          konacak = sigabilir(hedef);
        } else {
          // Yeni bant açılacak; aşağıdaki "hiçbir rayda yer yok" dalı.
          hedef = raylar.filter((r) => r.kind === "plaka").at(-1) ?? null;
        }
      } else {
        // AYNI TÜRDEN son ray etkin raydır — büyüyebilir (cepteyse cebin dibine kadar).
        for (let i = raylar.length - 1; i >= 0; i--) {
          if (raylar[i].kind === kind) {
            hedef = raylar[i];
            break;
          }
        }
        konacak = hedef ? sigabilir(hedef) : 0;
        if (hedef && konacak > 0 && gerek > hedef.yukseklik && !cepteSigar(hedef, gerek)) konacak = 0;
      }

      // ÖNCEKİ RAYLARDAKİ BOŞLUKLAR — yalnız rayı BÜYÜTMEYEN cihaz girer
      // (PANO-37 md. 5). Büyütseydi altındaki bütün rayların yeri kayar ve
      // kullanıcının şemada gördüğü sıra her yerleştirmede zıplardı.
      // SABİTLENMİŞ aygıt geriye bakmaz: komşusunun yanına yazıldı, oradan
      // başka bir rayın boşluğuna kaçmamalı (PANO-38).
      if (konacak <= 0 && d.anchorKey === null && !(kind === "plaka" && s.columnsEnabled)) {
        for (const r of raylar) {
          if (r === hedef) continue;
          if (gerek > r.yukseklik) continue;
          const k = sigabilir(r);
          if (k > 0) {
            hedef = r;
            konacak = k;
            break;
          }
        }
      }

      if (konacak <= 0) {
        // Hiçbir rayda yer yok. Yeni ray: DIN cihazı önce bir CEBE bakar
        // (PANO-39), yoksa tam enli ray. Etkin ray BOŞSA cihaz bu gövdeye
        // hiç sığmıyor demektir.
        if (hedef && hedef.x === 0 && hedef.kapasite >= tamKapasite - 1e-6) {
          unplaced.push({
            device: d,
            reason: "sigmadi",
            note: `${Math.round(birimEn * (d.splittable ? 1 : kalan))} mm, ray kapasitesi ${Math.round(tamKapasite)} mm`,
          });
          break;
        }
        const cep = kind === "din" ? cepBul(d, birimEn) : null;
        const yeni = rayAc(kind, cep);
        // Cep rayı bile bu cihazı almıyorsa (dar cep) tam enli ray açılır.
        if (cep && sigabilir(yeni) <= 0) {
          // Boş cep rayını geri al.
          raylar.pop();
          cep.cep.raylar.pop();
          rayAc(kind, null);
        }
        continue;
      }

      koy(hedef as RayTaslagi, d, dilim, konacak, birimEn);
      kalan -= konacak;
      dilim++;
    }
  }

  // ── 2. GEÇİŞ: geometri ─────────────────────────────────────────────────
  //
  // Tam enli raylar yaratılış sırasıyla yığılır; cep rayları kendi bandının
  // içinde, cebin üstünden aşağı yığılır. Sonra bütün raylar (y, x) sırasıyla
  // yeniden indekslenir — okuma sırası yukarıdan aşağıya, soldan sağa.
  // Cep hesabı bandı BOYCA sıralar; anahtar kapalıyken eski raf modelinin
  // sırası (yerleştirme sırası) bit-aynı korunur.
  if (s.columnsEnabled) {
    for (const band of raylar) {
      if (band.kind === "plaka" && band.yerlesimler.length > 0) cepleriHesapla(band);
    }
  }

  const yKonum = new Map<RayTaslagi, number>();
  let y = s.edgeGapMm;
  for (const r of raylar) {
    if (r.cep) continue;
    yKonum.set(r, y);
    y += r.yukseklik + s.railDuctMm;
  }
  for (const r of raylar) {
    if (!r.cep) continue;
    const bandY = yKonum.get(r.cep.band) ?? s.edgeGapMm;
    let yy = bandY + r.cep.cep.y0;
    for (const x of r.cep.cep.raylar) {
      if (x === r) break;
      yy += x.yukseklik + s.railDuctMm;
    }
    yKonum.set(r, yy);
  }

  // BOŞ RAY KALMAZ.
  const dolular = raylar
    .filter((r) => r.yerlesimler.length > 0)
    .sort((a, b) => (yKonum.get(a) ?? 0) - (yKonum.get(b) ?? 0) || a.xMm - b.xMm || a.seri - b.seri);

  const indeks = new Map<RayTaslagi, number>(dolular.map((r, i) => [r, i]));
  const rails: Rail[] = [];
  const placements: Placement[] = [];
  let enAlt = s.edgeGapMm;

  for (const r of dolular) {
    const ry = yKonum.get(r) ?? s.edgeGapMm;
    const i = indeks.get(r) ?? 0;

    // BASKIN BÖLGE: raydaki en çok en kaplayan bölge (PANO-37 md. 5 — bir
    // rayda birkaç bölge olabilir; etiket ilk cihazın değil çoğunluğun bölgesidir).
    const bolgeEn = new Map<Zone, number>();
    for (const yl of r.yerlesimler) {
      const z = bolgeOf(yl.d);
      bolgeEn.set(z, (bolgeEn.get(z) ?? 0) + (yl.d.widthMm ?? 0) * yl.adet);
    }
    const zone = [...bolgeEn.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "kumanda";

    rails.push({
      index: i,
      zone,
      kind: r.kind,
      yMm: ry,
      heightMm: r.yukseklik + s.railDuctMm,
      xMm: r.xMm,
      usedMm: r.x,
      capacityMm: r.kapasite,
      ductMm: s.railDuctMm,
      pocketOf: r.cep ? (indeks.get(r.cep.band) ?? null) : null,
    });
    enAlt = Math.max(enAlt, ry + r.yukseklik + s.railDuctMm);

    for (const yl of r.yerlesimler) {
      const d = yl.d;
      placements.push({
        deviceKey: d.key,
        label: yl.dilim === 0 ? d.label : `${d.label}/${yl.dilim + 1}`,
        panelCode: d.panelCode,
        colorGroup: d.colorGroup,
        mountType: r.kind,
        zone: bolgeOf(d),
        railIndex: i,
        xMm: r.xMm + yl.xMm,
        yMm: ry + d.clearanceTopMm,
        widthMm: (d.widthMm ?? 0) * yl.adet,
        heightMm: d.heightMm ?? 0,
        depthMm: d.depthMm ?? 0,
        unitCount: yl.adet,
        dimSource: d.dimSource ?? "tahmin",
        pinned: d.pinned,
      });
    }
  }

  // Yerleşimler ray sırasıyla, ray içinde soldan sağa.
  placements.sort((a, b) => a.railIndex - b.railIndex || a.xMm - b.xMm);

  const usedMm = rails.reduce((t, r) => t + r.usedMm, 0);
  const capacityMm = rails.reduce((t, r) => t + r.capacityMm, 0);
  return {
    rails,
    placements,
    unplaced,
    order,
    pinIssues: siralama.uygulanamayan,
    totalHeightMm: enAlt + s.edgeGapMm,
    usedMm,
    capacityMm,
  };
}
