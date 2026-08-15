// SAC PLAKA YERLEŞİMİ — 2B dikdörtgen yerleştirme (nesting).
//
// Kullanıcı kararı (15.08.2026): *"Kullanıcı sacları listeleyecek, filtreleyerek
// veya seçerek, sonra tuşa basacak, sistem 1500 x 12000 mm ya da 2000 x 12000
// mm … sac plakasına bunları yerleştirecek. Tüm parçaları dikdörtgen olarak
// düşünüp, sacdan taşmayacak şekilde ve parçaların birbirine ve kenara olan
// mesafesini 5 mm paylı olacak şekilde … Bir veya birden fazla plaka dizilimi
// olabilir."*
//
// ═════════════════════════════════════════════════════ ALGORİTMA SEÇİMİ
//
// **MaxRects — BSSF (Best Short Side Fit), çok plakalı, açgözlü.**
//
// Neden bu: gerçek veriyle ölçüldü (0053 LITEC paketi, 1798 sac parçası,
// 26 kalınlık/kalite grubu). Yoğun gruplarda doluluk %84–92 çıkıyor ve bütün
// gruplar 143 ms'de yerleşiyor. Alternatifler:
//   · Shelf/NFDH — %60'larda kalır, farklı boydaki parçalarda rafın üstü boşa
//     gider; sac parçaları tam olarak öyledir (23 mm ile 11.990 mm yan yana).
//   · Guillotine — kesim makası için doğrudur (kenardan kenara kesim şartı) ama
//     firma PLAZMA ile kesiyor; gereksiz bir kısıt fireyi büyütürdü.
//   · Skyline — MaxRects'e yakın sonuç, daha az bellek; burada bellek sorun
//     değil ve MaxRects'in serbest dikdörtgen listesi ekranda çizilebiliyor.
//
// **DETERMİNİSTİKTİR ve bu bir şart:** aynı seçim iki kez yerleştirildiğinde
// aynı plan çıkmalıdır, yoksa atölyeye giden çıktı ile ekrandaki resim
// ayrışır. Sıralama tam belirlidir (alan → uzun kenar → kimlik → kopya no) ve
// hiçbir yerde rastgelelik yoktur.
//
// ══════════════════════════════════════════════════════════ PAY MODELİ
//
// Şart iki yönlüdür: parça parçaya EN AZ g, parça kenara EN AZ g.
//
// Modelleme: her parça (w+g)×(h+g)'ye büyütülür ve KULLANILABİLİR ALAN
// (W−g)×(H−g) sayılır; gerçek parça, kutusunun sol-alt köşesinden +g kaydırarak
// çizilir.
//
//   · İki komşu kutu bitişikse:  A.sağ = B.sol  ⟹  parçalar arası tam g.
//   · En soldaki kutu x=0'da:    parça x=g      ⟹  kenara tam g.
//   · En sağdaki kutu W−g'de biter ⟹ parça W−g'de biter ⟹ sağ kenara da g.
//
// Sığma şartı böylece `w ≤ W − 2g` olur — iki kenar payı gerçekten düşülür.
// "Parçayı büyüt, plakayı olduğu gibi bırak" biçimindeki basit model KENAR
// PAYINI SIFIR bırakır ve kullanıcının şartının yarısını sessizce çiğnerdi.
//
// ÇEKİRDEK SAFTIR: DB/HTTP/React importu yok.

import { CELIK_OZKUTLE_KG_MM3 } from "./siniflar";

// ═══════════════════════════════════════════════════════════════ TİPLER

export interface YerlesimParcasi {
  /** Kaynak satırın benzersiz anahtarı — çıktıda geri izlenir. */
  id: string;
  /** Etikette görünen kısa ad. */
  ad: string;
  enMm: number;
  boyMm: number;
  adet: number;
}

export interface PlakaOlcusu {
  enMm: number;
  boyMm: number;
}

export interface YerlesimSecenekleri {
  /** Parça–parça ve parça–kenar payı [mm]. */
  payMm: number;
  /**
   * 90° DÖNDÜRME SERBEST Mİ?
   *
   * Açık bir seçenektir, sessiz bir varsayım değil: haddeleme yönü ve tarama
   * deseni bazı parçalarda önemlidir ve o kararı yazılım veremez. Varsayılan
   * AÇIK'tır çünkü kullanıcı parçaları "dikdörtgen olarak düşün" dedi ve
   * döndürme fireyi belirgin düşürür.
   */
  dondur: boolean;
  /** Ağırlık için sac kalınlığı [mm]; verilmezse ağırlık hesaplanmaz. */
  kalinlikMm?: number | null;
}

export interface YerlesenParca {
  id: string;
  ad: string;
  /** Plakanın sol-alt köşesine göre konum [mm]. */
  x: number;
  y: number;
  /** PLAKADAKİ ölçü — parça döndüyse en ile boy YER DEĞİŞTİRMİŞTİR. */
  enMm: number;
  boyMm: number;
  /**
   * PARÇANIN KENDİ ölçüsü — kesim listesi bunu yazar.
   *
   * Döndürülmüş bir parçanın plakadaki eni onun eni DEĞİLDİR; listede
   * "SAC 15x375x1500" satırının karşısında 1500×375 görmek okuyanı parçanın
   * yanlış çizildiğine inandırır.
   */
  kaynakEnMm: number;
  kaynakBoyMm: number;
  dondu: boolean;
}

export interface Plaka {
  /** 1'den başlayan plaka sırası. */
  sira: number;
  enMm: number;
  boyMm: number;
  parcalar: YerlesenParca[];
  kullanilanAlanMm2: number;
  dolulukYuzde: number;
}

export interface SigmayanParca {
  id: string;
  ad: string;
  enMm: number;
  boyMm: number;
  adet: number;
  /** Neden sığmadı — ekranda olduğu gibi yazılır. */
  neden: string;
}

export interface YerlesimSonucu {
  plaka: PlakaOlcusu;
  payMm: number;
  dondurmeAcik: boolean;
  plakalar: Plaka[];
  /** Hiçbir plakaya sığmayan parçalar — SESSİZCE DÜŞÜRÜLMEZ. */
  sigmayanlar: SigmayanParca[];
  toplamParca: number;
  yerlesenParca: number;
  /** Kullanılan plakaların toplam alanı [mm²]. */
  plakaAlaniMm2: number;
  kullanilanAlanMm2: number;
  dolulukYuzde: number;
  fireYuzde: number;
  /** Satın alınacak plakaların toplam ağırlığı [kg]; kalınlık yoksa null. */
  plakaAgirlikKg: number | null;
  /** Yerleşen parçaların toplam ağırlığı [kg]; kalınlık yoksa null. */
  parcaAgirlikKg: number | null;
}

/**
 * ÜST SINIR — hesap tarayıcıyı ya da sunucuyu kilitlemesin.
 *
 * Seçim MaxRects'in maliyeti parça sayısının karesiyle büyür. 1798 parçalık
 * gerçek bir paket kalınlığa bölününce en büyük grup 515 parçaydı ve 17 ms
 * sürdü; 4000 parça yaklaşık dört saniye eder. Sınır aşılırsa hesap YAPILMAZ
 * ve sebebi söylenir — yarım bir plan, plan olmamasından beterdir.
 */
export const EN_COK_PARCA = 4000;

// ═══════════════════════════════════════════════════════════ ANA FONKSİYON

export function sacYerlesimi(
  parcalar: readonly YerlesimParcasi[],
  plaka: PlakaOlcusu,
  secenekler: YerlesimSecenekleri
): YerlesimSonucu {
  const g = Math.max(0, secenekler.payMm);
  const dondur = secenekler.dondur;
  // Kullanılabilir alan: pay modeli gereği her iki kenardan g düşer.
  const PW = plaka.enMm - g;
  const PH = plaka.boyMm - g;

  const bos = (): YerlesimSonucu => ({
    plaka,
    payMm: g,
    dondurmeAcik: dondur,
    plakalar: [],
    sigmayanlar: [],
    toplamParca: 0,
    yerlesenParca: 0,
    plakaAlaniMm2: 0,
    kullanilanAlanMm2: 0,
    dolulukYuzde: 0,
    fireYuzde: 0,
    plakaAgirlikKg: null,
    parcaAgirlikKg: null,
  });

  interface Kopya {
    id: string;
    ad: string;
    /** Payla büyütülmüş kutu. */
    w: number;
    h: number;
    /** Gerçek parça ölçüsü. */
    ow: number;
    oh: number;
    /** Kaçıncı kopya — sıralamayı TAM belirli yapar. */
    no: number;
  }

  const kopyalar: Kopya[] = [];
  for (const p of parcalar) {
    const adet = Math.max(0, Math.floor(p.adet));
    for (let i = 0; i < adet; i++) {
      kopyalar.push({
        id: p.id,
        ad: p.ad,
        w: p.enMm + g,
        h: p.boyMm + g,
        ow: p.enMm,
        oh: p.boyMm,
        no: i,
      });
    }
  }
  if (kopyalar.length === 0) return bos();
  if (kopyalar.length > EN_COK_PARCA) {
    throw new Error(
      `Yerleşim ${EN_COK_PARCA} parçaya kadar hesaplanır; seçimde ${kopyalar.length} parça var. ` +
        `Süzgeci daraltın (ör. tek kalınlık) ve yeniden deneyin.`
    );
  }

  // SIRALAMA TAM BELİRLİ: alan azalanı → uzun kenar azalanı → kimlik → kopya no.
  kopyalar.sort(
    (a, b) =>
      b.w * b.h - a.w * a.h ||
      Math.max(b.w, b.h) - Math.max(a.w, a.h) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
      a.no - b.no
  );

  const sigmayanHarita = new Map<string, SigmayanParca>();
  const bekleyen: Kopya[] = [];
  for (const k of kopyalar) {
    const duz = k.w <= PW && k.h <= PH;
    const don = dondur && k.h <= PW && k.w <= PH;
    if (duz || don) {
      bekleyen.push(k);
      continue;
    }
    const mevcut = sigmayanHarita.get(k.id);
    if (mevcut) {
      mevcut.adet += 1;
    } else {
      sigmayanHarita.set(k.id, {
        id: k.id,
        ad: k.ad,
        enMm: k.ow,
        boyMm: k.oh,
        adet: 1,
        neden:
          `${fmt(k.ow)}×${fmt(k.oh)} mm parça ${fmt(plaka.enMm)}×${fmt(plaka.boyMm)} mm plakaya ` +
          `${g} mm payla sığmıyor`,
      });
    }
  }

  const plakalar: Plaka[] = [];
  let havuz = bekleyen;
  while (havuz.length > 0) {
    const bin = yeniBin(PW, PH);
    const kalan = havuz.slice();
    let yerlesti = false;
    for (;;) {
      const sec = enIyiSecim(bin, kalan, dondur);
      if (!sec) break;
      bosluklariBol(bin, sec.rect);
      bin.parcalar.push({
        id: sec.kopya.id,
        ad: sec.kopya.ad,
        // +g KAYDIRMA pay modelinin ikinci yarısıdır (dosya başlığı).
        x: sec.rect.x + g,
        y: sec.rect.y + g,
        enMm: sec.rect.w - g,
        boyMm: sec.rect.h - g,
        kaynakEnMm: sec.kopya.ow,
        kaynakBoyMm: sec.kopya.oh,
        dondu: sec.dondu,
      });
      kalan.splice(sec.i, 1);
      yerlesti = true;
    }
    // BOŞ PLAKAYA HİÇBİR PARÇA SIĞMADIYSA döngü sonsuza gider. Sığma kapısı
    // yukarıda geçildiği için buraya düşmek bir mantık hatasıdır ve sessizce
    // yutulmaz.
    if (!yerlesti) throw new Error("Yerleşim ilerlemiyor: boş plakaya hiçbir parça konamadı.");
    const kullanilan = bin.parcalar.reduce((t, p) => t + p.enMm * p.boyMm, 0);
    plakalar.push({
      sira: plakalar.length + 1,
      enMm: plaka.enMm,
      boyMm: plaka.boyMm,
      parcalar: bin.parcalar,
      kullanilanAlanMm2: kullanilan,
      dolulukYuzde: yuvarla((kullanilan / (plaka.enMm * plaka.boyMm)) * 100, 1),
    });
    havuz = kalan;
  }

  const plakaAlani = plakalar.length * plaka.enMm * plaka.boyMm;
  const kullanilan = plakalar.reduce((t, p) => t + p.kullanilanAlanMm2, 0);
  const yerlesen = plakalar.reduce((t, p) => t + p.parcalar.length, 0);
  const kalinlik = secenekler.kalinlikMm ?? null;

  return {
    plaka,
    payMm: g,
    dondurmeAcik: dondur,
    plakalar,
    sigmayanlar: [...sigmayanHarita.values()],
    toplamParca: kopyalar.length,
    yerlesenParca: yerlesen,
    plakaAlaniMm2: plakaAlani,
    kullanilanAlanMm2: kullanilan,
    dolulukYuzde: plakaAlani > 0 ? yuvarla((kullanilan / plakaAlani) * 100, 1) : 0,
    fireYuzde: plakaAlani > 0 ? yuvarla(100 - (kullanilan / plakaAlani) * 100, 1) : 0,
    plakaAgirlikKg: kalinlik ? yuvarla(plakaAlani * kalinlik * CELIK_OZKUTLE_KG_MM3, 1) : null,
    parcaAgirlikKg: kalinlik ? yuvarla(kullanilan * kalinlik * CELIK_OZKUTLE_KG_MM3, 1) : null,
  };
}

/**
 * OTOMATİK PLAKA SEÇİMİ — hangi en/boy en az fire verir?
 *
 * Kullanıcı plakayı elle de seçebilir; bu, "sen karar ver" seçeneğidir.
 * Kıstas ÖNCE PLAKA ADEDİ, sonra TOPLAM ALANdır: iki plakayla biten bir
 * dizilim her zaman üç plakalıdan ucuzdur, ama aynı plaka adedinde dar olan
 * kazanır (3000'lik plaka pahalıdır ve fazlası fireye gider).
 *
 * Sığmayan parça bırakan aday ELENİR — ancak hiçbiri sığdıramıyorsa en az
 * sığmayan bırakan seçilir ki ekran yine de bir şey gösterebilsin.
 */
export function enIyiPlakaSecimi(
  parcalar: readonly YerlesimParcasi[],
  adaylar: readonly PlakaOlcusu[],
  secenekler: YerlesimSecenekleri
): YerlesimSonucu | null {
  let enIyi: YerlesimSonucu | null = null;
  for (const aday of adaylar) {
    let sonuc: YerlesimSonucu;
    try {
      sonuc = sacYerlesimi(parcalar, aday, secenekler);
    } catch {
      continue;
    }
    if (!enIyi) {
      enIyi = sonuc;
      continue;
    }
    const a = sonuc.sigmayanlar.reduce((t, s) => t + s.adet, 0);
    const b = enIyi.sigmayanlar.reduce((t, s) => t + s.adet, 0);
    if (a !== b) {
      if (a < b) enIyi = sonuc;
      continue;
    }
    if (sonuc.plakalar.length !== enIyi.plakalar.length) {
      if (sonuc.plakalar.length < enIyi.plakalar.length) enIyi = sonuc;
      continue;
    }
    if (sonuc.plakaAlaniMm2 < enIyi.plakaAlaniMm2) enIyi = sonuc;
  }
  return enIyi;
}

// ═══════════════════════════════════════════════════════ MaxRects ÇEKİRDEĞİ

interface Dikdortgen {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Bin {
  W: number;
  H: number;
  /** Boş kalan serbest dikdörtgenler — çakışabilirler (MaxRects'in özü). */
  bos: Dikdortgen[];
  parcalar: YerlesenParca[];
}

function yeniBin(W: number, H: number): Bin {
  return { W, H, bos: [{ x: 0, y: 0, w: W, h: H }], parcalar: [] };
}

interface Secim {
  i: number;
  kopya: { id: string; ad: string; w: number; h: number; ow: number; oh: number; no: number };
  dondu: boolean;
  skor: number[];
  rect: Dikdortgen;
}

/**
 * BSSF — en kısa KALAN kenarı en küçük olan yerleşim kazanır.
 *
 * Eşitlikte sırasıyla: en uzun kalan kenar, sonra y, sonra x. Son iki kıstas
 * kaliteyi değil BELİRLİLİĞİ sağlar — aynı skorlu iki boşluktan hep sol-alttaki
 * seçilir ve plan iki koşuda aynı çıkar.
 */
function enIyiSecim(
  bin: Bin,
  havuz: readonly Secim["kopya"][],
  dondur: boolean
): Secim | null {
  let best: Secim | null = null;
  for (let i = 0; i < havuz.length; i++) {
    const k = havuz[i];
    const yonler: [number, number, boolean][] =
      dondur && k.w !== k.h
        ? [
            [k.w, k.h, false],
            [k.h, k.w, true],
          ]
        : [[k.w, k.h, false]];
    for (const [w, h, dondu] of yonler) {
      for (const f of bin.bos) {
        if (w > f.w || h > f.h) continue;
        const kisa = Math.min(f.w - w, f.h - h);
        const uzun = Math.max(f.w - w, f.h - h);
        const skor = [kisa, uzun, f.y, f.x];
        if (!best || dahaIyi(skor, best.skor)) {
          best = { i, kopya: k, dondu, skor, rect: { x: f.x, y: f.y, w, h } };
        }
      }
    }
  }
  return best;
}

function dahaIyi(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Yerleştirilen dikdörtgen serbest alanları böler; kapsananlar atılır. */
function bosluklariBol(bin: Bin, r: Dikdortgen): void {
  const yeni: Dikdortgen[] = [];
  for (const f of bin.bos) {
    if (!kesisir(f, r)) {
      yeni.push(f);
      continue;
    }
    if (r.x > f.x) yeni.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
    if (r.x + r.w < f.x + f.w) {
      yeni.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
    }
    if (r.y > f.y) yeni.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
    if (r.y + r.h < f.y + f.h) {
      yeni.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
    }
  }
  bin.bos = sadelestir(yeni);
}

function kesisir(a: Dikdortgen, b: Dikdortgen): boolean {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y);
}

function icerir(a: Dikdortgen, b: Dikdortgen): boolean {
  return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
}

/**
 * Başka bir serbest alanın İÇİNDE kalan alanlar atılır.
 *
 * Bu adım olmadan liste her yerleştirmede katlanır ve seçim maliyeti patlar.
 * Aynı ölçüdeki iki alandan yalnız BİRİ atılır (`j > i` kelepçesi), yoksa
 * ikisi birbirini yutar ve gerçek bir boşluk kaybolurdu.
 */
function sadelestir(list: readonly Dikdortgen[]): Dikdortgen[] {
  const gecerli = list.filter((r) => r.w > 0 && r.h > 0);
  const kalan: Dikdortgen[] = [];
  for (let i = 0; i < gecerli.length; i++) {
    let yutuldu = false;
    for (let j = 0; j < gecerli.length; j++) {
      if (i === j) continue;
      if (!icerir(gecerli[j], gecerli[i])) continue;
      const ayni =
        gecerli[i].w === gecerli[j].w &&
        gecerli[i].h === gecerli[j].h &&
        gecerli[i].x === gecerli[j].x &&
        gecerli[i].y === gecerli[j].y;
      if (ayni && j > i) continue;
      yutuldu = true;
      break;
    }
    if (!yutuldu) kalan.push(gecerli[i]);
  }
  return kalan;
}

// ══════════════════════════════════════════════════════════════ DOĞRULAMA

/**
 * YERLEŞİM DENETÇİSİ — testlerin ve betiklerin ortak kapısı.
 *
 * Üç şeyi sayar ve İLK hatayı döndürür: kenar payı, parça–parça payı, plaka
 * dışına taşma. Algoritmanın kendi iddiasına inanmak yerine SONUCU ölçer;
 * yerleştirme kodunda bir işaret hatası yapmak (`+g` yerine `−g`) sessizdir ve
 * ancak atölyede görünürdü.
 */
export function yerlesimiDenetle(sonuc: YerlesimSonucu): string | null {
  const g = sonuc.payMm;
  const eps = 1e-9;
  for (const plaka of sonuc.plakalar) {
    for (let i = 0; i < plaka.parcalar.length; i++) {
      const a = plaka.parcalar[i];
      if (
        a.x < g - eps ||
        a.y < g - eps ||
        a.x + a.enMm > plaka.enMm - g + eps ||
        a.y + a.boyMm > plaka.boyMm - g + eps
      ) {
        return `Kenar payı: plaka ${plaka.sira}, ${a.ad} @${a.x},${a.y}`;
      }
      for (let j = i + 1; j < plaka.parcalar.length; j++) {
        const b = plaka.parcalar[j];
        const ayirimX = Math.max(b.x - (a.x + a.enMm), a.x - (b.x + b.enMm));
        const ayirimY = Math.max(b.y - (a.y + a.boyMm), a.y - (b.y + b.boyMm));
        if (Math.max(ayirimX, ayirimY) < g - eps) {
          return `Pay/çakışma: plaka ${plaka.sira}, ${a.ad} ile ${b.ad}`;
        }
      }
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════ YARDIMCI

function yuvarla(v: number, basamak = 2): number {
  const k = 10 ** basamak;
  return Math.round(v * k) / k;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(yuvarla(v, 1)).replace(".", ",");
}
