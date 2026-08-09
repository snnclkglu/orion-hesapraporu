// PDF antedi ve montaj resmindeki çocuk parça tablosu — SAF okuyucu.
//
// NEDEN DÜZ METİN DEĞİL, KONUM.
// İlk yaklaşım "etiketi metinde bul, aynı satırın kalanını değer say" idi.
// 240 gerçek PDF üzerinde ölçüldü ve ÇALIŞMIYOR: pdf.js'in metin katmanında
// antet bir IZGARADIR, satır değil. Yatay komşu hücreler aynı taban çizgisini
// paylaşır, yani tek bir "satır" şudur:
//
//     Rev / Rev | Tarih / Date | Çizen / Changed | Açıklama / Description |
//     Ağ/Wt : | 31,388kg | Ad/Qty : | 1
//
// Düz dizgede `^…$` çapalı bir kalıp bu satırdan ağırlığı 240 dosyanın
// 0'ında, resim numarasını 2'sinde bulabildi. Buna karşılık ETİKETE ÇAPALI
// GEOMETRİ 13 etiketin 13'ünü de 240/240 dosyada buldu.
//
// İKİ YÖN VAR ve ikisi de gerçek:
//   · SAĞ  — `Ağ/Wt :` · `Ad/Qty :` · `Çizen/Drawing by` · `Onay/Approved`
//            değerleri AYNI taban çizgisinde, etiketin sağındadır.
//   · ALT  — `Resim No` · `Proje` · `İş` · `Firma Adı` · `Ölçek` · `Metarial`
//            değerleri hücrenin ALTINDADIR (etiket yazı yüksekliğinin ~2,2 katı).
//
// BÜTÜN EŞİKLER ORANSALDIR. Altı ayrı sayfa boyu ölçüldü (A4 842×595'ten
// A0 3370×2384'e) ve antet sayfayla ölçekleniyor: A4'te etiket yazı yüksekliği
// 4,5, A0'da ~13. Mutlak bir eşik A0'da sessizce kırılırdı.
//
// YANLIŞ ALARM BU MODÜLÜN EN BÜYÜK DÜŞMANI. Üç koruma katmanı var:
//   1. IZGARA sözcükleri — şablonun değer taşımayan başlıkları; hem sütun
//      sınırı verirler hem de değer olarak seçilemezler.
//   2. SABIT_METINLER — telif uyarısı ve imalat notları. Boş bir hücrenin en
//      yakın komşusu bunlar olabiliyor; ölçüldü, hariç tutulmazlarsa 240
//      PDF'in 3'ünde "müşteri" alanına telif cümlesi yazılıyor.
//   3. ŞEKİL DENETİMİ — her alan kendi kalıbından geçer; geçemeyen değer
//      RAPOR EDİLMEZ. Boş kalmak yanlış söylemekten iyidir.

import { trKatla, trSayi, trTarih } from "./tr-text";

/**
 * Metin katmanındaki tek bir parça: konumlu bir dizge.
 *
 * `x`/`y` PDF kullanıcı uzayındadır (y YUKARI artar), `w` yatay ilerleme,
 * `h` yazı yüksekliğidir. Dönmüş parçalar bu modele HİÇ girmez: çağıran
 * onları dönüşüm matrisinden eleyerek verir (dönmüş ölçü yazısı antetin
 * hücrelerine karışırdı).
 */
export interface TextSpan {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Antetten okunan alanlar. HEPSİ boş olabilir — bu bir hata değildir. */
export interface TitleBlock {
  /** `ResimNo / Drawing No:` */
  drawingNo: string;
  /** `İş / Project No:` — kalem numarası ("0057-00") */
  projectNo: string;
  /** `İş / Job Name:` — parçanın kendi adı ("SAC 15x240x285") */
  jobName: string;
  /** `Proje / Project:` — üst montajın adı ("ŞASE") */
  parentProject: string;
  /** `Firma Adı / Customer:` */
  customer: string;
  weightKg: number | null;
  /** Antette ağırlık yerine "N/A" yazıyorsa: bilinmiyor DEĞİL, YOK demektir. */
  weightNA: boolean;
  /** `Ad/Qty :` */
  qty: number | null;
  /** `Malzeme Standart / Metarial` — desen DAYATILMAZ */
  material: string;
  /** `Ölçek/Scale` ham hâliyle ("1 : 2,5") */
  scale: string;
  /** `Tasarım / Design` — pafta boyu ("A4") */
  sheetSize: string;
  /** `Pafta No / Sht. No` */
  sheetNo: string;
  drawnBy: string;
  approvedBy: string;
  /** Çizim tarihi, ISO. `/CreationDate` GÜVENİLMEZ — antetteki tarih budur. */
  dateIso: string;
  approvedDateIso: string;
  revision: string;
}

/** Montaj resminin üzerindeki çocuk parça tablosunun bir satırı. */
export interface SheetBomRow {
  /** `No/Pos` */
  pos: string;
  partCode: string;
  /** `Parça Özellikleri/Designation` */
  designation: string;
  material: string;
  qty: number | null;
  /** Birim ağırlık */
  massKg: number | null;
  /** Yalnız bazı sayfalarda ayrı bir sütun olarak var */
  totalMassKg: number | null;
  /** 1 tabanlı sayfa numarası; çağıran doldurur */
  page: number;
}

export interface TitleBlockRead {
  titleBlock: TitleBlock;
  /** Kaç şablon etiketi bulundu (tanıma oranının antet ayağı) */
  labelsFound: number;
  labelsTotal: number;
  /** Tutan tanıyıcı; hiçbiri tutmadıysa "" */
  recognizedBy: string;
}

export function emptyTitleBlock(): TitleBlock {
  return {
    drawingNo: "", projectNo: "", jobName: "", parentProject: "", customer: "",
    weightKg: null, weightNA: false, qty: null, material: "", scale: "",
    sheetSize: "", sheetNo: "", drawnBy: "", approvedBy: "", dateIso: "",
    approvedDateIso: "", revision: "",
  };
}

// ---------------------------------------------------------------- oranlar --
// Hepsi ETİKETİN KENDİ YAZI YÜKSEKLİĞİNİN katıdır; hiçbiri punto değildir.

/** Bundan büyük yatay boşluk bir HÜCRE sınırıdır. */
const HUCRE_ORAN = 1.0;
/** Bundan büyük boşluk sözcük arası boşluk sayılır (span'lar arası). */
const SOZCUK_ORAN = 0.16;
/** Aynı taban çizgisi toleransı. */
const SATIR_ORAN = 0.4;
/** ALT yönlü değer bu kadar aşağıya kadar aranır. */
const ALT_PENCERE = 3.4;
/** ALT yönlü değer etiketten en çok bu kadar sağda olabilir (hücre genişliği). */
const ALT_EN_UZAK = 18;
/** SAĞ yönlü değerde bundan büyük boşluk değeri bitirir. */
const SAG_BOSLUK = 2.0;
/** Bir IZGARA sütunu değerin başlangıcına bu kadar yakınsa sınır sayılmaz. */
const SUTUN_TOLERANS = 2.5;
/** Geometrik yol için gereken en az etiket sayısı. */
const EN_AZ_ETIKET = 5;

/** Bu şablonun kimliği — `recognized_by` alanına yazılır. */
export const ANTET_TANIYICI = "orion-inventor-antet-v1";

// ------------------------------------------------------------- satır modeli --

interface Satir {
  y: number;
  /** Satırdaki en büyük yazı yüksekliği */
  h: number;
  hMin: number;
  spans: TextSpan[];
  /** Span metinlerinin birleşimi (span arası boşluklar eklenmiş) */
  text: string;
  /** Karakter başına başlangıç x'i */
  xs: number[];
  /** Karakter başına bitiş x'i */
  xe: number[];
  /** Karakter başına yazı yüksekliği */
  hs: number[];
}

/**
 * Span'ları taban çizgisine göre satırlara böler ve her satır için KARAKTER
 * DÜZEYİNDE x haritası kurar.
 *
 * Karakter düzeyi şart: etiket birden çok span'a bölünmüş gelebiliyor
 * (`Ağ/W` + `t :`) ve etiketin nerede bitip değerin nerede başladığı ancak
 * karakter konumlarından bilinebiliyor.
 *
 * Span araya eklenen BOŞLUK KARAKTERİ sıfır genişliktedir ve bir sonraki
 * span'ın başına konur. Gerçek genişlikte konsaydı boşluğun kendisi hücreler
 * arasındaki boşluğu köprüler ve hiçbir hücre sınırı görünmezdi — ölçüldü,
 * bütün satır tek hücre oluyordu.
 */
export function buildLines(spans: readonly TextSpan[]): Satir[] {
  const dolu = spans
    .filter((s) => s.text.trim() !== "")
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const satirlar: Satir[] = [];
  for (const s of dolu) {
    const son = satirlar[satirlar.length - 1];
    const h = s.h > 0 ? s.h : 1;
    const tol = son ? Math.max(0.4, SATIR_ORAN * Math.min(son.hMin, h)) : 0;
    if (son && Math.abs(son.y - s.y) <= tol) {
      son.spans.push(s);
      son.hMin = Math.min(son.hMin, h);
      son.h = Math.max(son.h, h);
    } else {
      satirlar.push({ y: s.y, h, hMin: h, spans: [s], text: "", xs: [], xe: [], hs: [] });
    }
  }

  for (const l of satirlar) {
    l.spans.sort((a, b) => a.x - b.x);
    let text = "";
    const xs: number[] = [];
    const xe: number[] = [];
    const hs: number[] = [];
    let oncekiSon: number | null = null;
    let oncekiH = l.h;
    for (const s of l.spans) {
      const h = s.h > 0 ? s.h : l.h;
      if (oncekiSon !== null && s.x - oncekiSon > SOZCUK_ORAN * Math.max(h, oncekiH)) {
        text += " ";
        xs.push(s.x);
        xe.push(s.x);
        hs.push(Math.max(h, oncekiH));
      }
      const n = s.text.length;
      for (let i = 0; i < n; i++) {
        text += s.text[i];
        xs.push(s.x + (s.w * i) / n);
        xe.push(s.x + (s.w * (i + 1)) / n);
        hs.push(h);
      }
      oncekiSon = s.x + s.w;
      oncekiH = h;
    }
    l.text = text;
    l.xs = xs;
    l.xe = xe;
    l.hs = hs;
  }
  return satirlar;
}

/** i ile i+1 arasındaki gerçek yatay boşluk. */
function aralik(l: Satir, i: number): number {
  return i + 1 < l.xs.length ? l.xs[i + 1] - l.xe[i] : Number.POSITIVE_INFINITY;
}

type Hucre = [bas: number, son: number];

/** Satırı hücrelere böler: boşluğu satır yüksekliğini aşan yerlerden. */
function hucreler(l: Satir): Hucre[] {
  const out: Hucre[] = [];
  let bas = 0;
  for (let i = 0; i < l.text.length; i++) {
    const h = Math.max(l.hs[i], l.hs[Math.min(i + 1, l.hs.length - 1)]);
    if (aralik(l, i) > HUCRE_ORAN * h) {
      out.push([bas, i]);
      bas = i + 1;
    }
  }
  out.push([bas, l.text.length - 1]);
  return out.filter(([a, b]) => l.text.slice(a, b + 1).trim() !== "");
}

function hucreMetni(l: Satir, [a, b]: Hucre): string {
  return l.text.slice(a, b + 1).trim();
}

/**
 * Katlanmış + BOŞLUKSUZ arama anahtarı; `map[i]` orijinal karakter indeksidir.
 *
 * Boşluk atılır çünkü aynı etiket dosyadan dosyaya `Firma Adı / Customer:` ya
 * da `FirmaAdı /Customer:` diye geliyor — boşluk ressamın değil pdf.js'in
 * kararı. `trKatla` da noktalı/noktasız i ayrımını kaldırır.
 */
function katlaAnahtar(s: string): { key: string; map: number[] } {
  const n = s.normalize("NFC");
  let key = "";
  const map: number[] = [];
  for (let i = 0; i < n.length; i++) {
    if (/\s/.test(n[i])) continue;
    key += trKatla(n[i]);
    map.push(i);
  }
  return { key, map };
}

/**
 * Satırda bir şablon sözcüğü arar.
 *
 * SINIR KURALI iki gerçek durumdan doğdu:
 *   · `Parça Özellikleri/Designation` içindeki `Design` — eşleşmenin ardından
 *     BİTİŞİK bir harf geliyorsa bu bir sözcüğün ortasıdır, reddedilir.
 *   · `Ölçek/Scale` + çerçeve harfi `A` — ardından harf geliyor ama ARADA
 *     boşluk var, yani ayrı bir nesne; kabul edilir.
 */
function etiketAra(l: Satir, etiket: string): { i0: number; i1: number } | null {
  const hedef = katlaAnahtar(etiket).key;
  if (!hedef) return null;
  const fk = katlaAnahtar(l.text);
  for (let j = fk.key.indexOf(hedef); j >= 0; j = fk.key.indexOf(hedef, j + 1)) {
    const i0 = fk.map[j];
    const i1 = fk.map[j + hedef.length - 1];
    const onceki = l.text[i0 - 1];
    if (onceki !== undefined && /[\p{L}\p{N}]/u.test(onceki) && aralik(l, i0 - 1) < 0.3 * l.hs[i0]) continue;
    const sonraki = l.text[i1 + 1];
    if (sonraki !== undefined && /\p{L}/u.test(sonraki) && aralik(l, i1) < 0.3 * l.hs[i1]) continue;
    return { i0, i1 };
  }
  return null;
}

// -------------------------------------------------------------- sözlükler --

type Yon = "sag" | "alt";
type Alan =
  | "drawingNo" | "projectNo" | "jobName" | "parentProject" | "customer"
  | "weightRaw" | "qtyRaw" | "scale" | "material" | "sheetSize" | "sheetNo"
  | "drawnBy" | "approvedBy" | "revision";

interface EtiketTanimi {
  alan: Alan;
  /** Eş anlamlılar; ilk tutan kazanır */
  adlar: string[];
  yon: Yon;
}

/**
 * Antet etiketleri. 13'ü de iki gerçek pakette 240/240 PDF'te bulundu.
 *
 * `Metarial` yazımı KAYNAKTA BÖYLEDİR (şablonun kendi yazım hatası) ve
 * düzeltilmemelidir: aranan şey doğru sözcük değil, gerçekten basılan sözcük.
 * Üst satırdaki `Malzeme Standart` bilerek aranmaz — o iki satırlı etiketin
 * ÜST yarısıdır ve altındaki hücre `Metarial`ın kendisidir, malzeme değil.
 */
const ETIKETLER: EtiketTanimi[] = [
  { alan: "drawingNo", adlar: ["ResimNo / Drawing No:", "Resim No / Drawing No"], yon: "alt" },
  { alan: "projectNo", adlar: ["İş / Project No:", "İş/ Project No"], yon: "alt" },
  { alan: "jobName", adlar: ["İş / Job Name:"], yon: "alt" },
  { alan: "parentProject", adlar: ["Proje / Project:"], yon: "alt" },
  { alan: "customer", adlar: ["Firma Adı / Customer:"], yon: "alt" },
  { alan: "weightRaw", adlar: ["Ağ/Wt :"], yon: "sag" },
  { alan: "qtyRaw", adlar: ["Ad/Qty :"], yon: "sag" },
  { alan: "scale", adlar: ["Ölçek/Scale"], yon: "alt" },
  { alan: "material", adlar: ["Metarial"], yon: "alt" },
  { alan: "sheetSize", adlar: ["Design"], yon: "alt" },
  { alan: "sheetNo", adlar: ["Sht. No"], yon: "alt" },
  { alan: "drawnBy", adlar: ["Çizen/Drawing by"], yon: "sag" },
  { alan: "approvedBy", adlar: ["Onay/Approved"], yon: "sag" },
  { alan: "revision", adlar: ["Rev / Rev"], yon: "alt" },
];

/**
 * Izgara sözcükleri: antetin sütun çizgilerini tanımlarlar ama DEĞER TAŞIMAZLAR.
 *
 * Olmasalar `Onay/Approved` değerinin nerede bitip onay tarihinin nerede
 * başladığı yalnız boşluk ölçüsünden tahmin edilirdi; ölçüldü, adı kısa olan
 * kişide tarih de değere karışıyordu.
 */
const IZGARA = [
  "İsim / Name", "Tarih / Date", "İmza / Signature", "Açıklama / Description",
  "Çizen / Changed", "Rev / Rev", "Malzeme", "Standart", "Tasarım", "Pafta No",
  "Ölçek/Scale", "Design", "Sht. No", "Metarial", "Ağ/Wt :", "Ad/Qty :",
];

/**
 * Şablonun değişmeyen metinleri: telif uyarısı ve genel imalat notları.
 *
 * Bunlar antet ızgarasının İÇİNDE yaşarlar. Boş bir hücrenin en yakın komşusu
 * oldukları için hariç tutulmazlarsa değer sanılırlar — ölçüldü, 240 PDF'in
 * 3'ünde "Firma Adı" alanına telif cümlesi yazılıyordu.
 */
const SABIT_METINLER = [
  "Copying of this", "express by Orion", "Dokümanın Orion", "dağıtılması yasaktır",
  "Edges of all parts", "Tüm keskin köşeler", "All radii and crossings",
  "Köşe ve radüsler", "Verilmeyen", "Unspecified",
].map((s) => katlaAnahtar(s).key);

/**
 * Şekil denetimleri. Geçemeyen değer atılır — alanın boş kalması, yanlış
 * dolması ihtimalinden iyidir.
 *
 * `material` ve serbest metin alanlarına DESEN DAYATILMAZ (gerçek malzemeler
 * `S235JR` · `BDS` · `Kestamid` · `Steel` · `-` kadar çeşitli); orada denetim
 * yalnız uzunluk sınırıdır.
 */
const DENETIM: Partial<Record<Alan, (v: string) => boolean>> = {
  drawingNo: (v) => /^[\p{L}\p{N}][\p{L}\p{N}._/-]{2,39}$/u.test(v) && /\d/.test(v),
  projectNo: (v) => /^[\p{L}\p{N}][\p{L}\p{N}._/-]{2,39}$/u.test(v) && /\d/.test(v),
  qtyRaw: (v) => /^\d{1,5}$/.test(v),
  scale: (v) => /^\d+([.,]\d+)?\s*:\s*\d+([.,]\d+)?$/.test(v),
  sheetSize: (v) => /^[A-Za-z]\d$/.test(v),
  sheetNo: (v) => /^\d{1,3}$/.test(v),
  // Revizyon tek harf ya da tek rakamdır. Gevşetilirse altındaki alt başlık
  // satırı ("İsim / Name") ya da onay tarihi revizyon sanılıyor.
  revision: (v) => /^[\p{L}\p{N}]{1,2}$/u.test(v),
  weightRaw: (v) => /^-?[\d.,]+\s*(kg)?$/i.test(v) || /^N\s*\/?\s*A$/i.test(v),
  // Adı olmayan bir hücrede sıradaki sütun tarihtir; tarih bir isim değildir.
  drawnBy: (v) => !/\d{1,2}[.,]\d{1,2}[.,]\d{4}/.test(v) && v.length <= 60,
  approvedBy: (v) => !/\d{1,2}[.,]\d{1,2}[.,]\d{4}/.test(v) && v.length <= 60,
  material: (v) => v.length <= 40,
  customer: (v) => v.length <= 60,
  jobName: (v) => v.length <= 80,
  parentProject: (v) => v.length <= 80,
};

// ------------------------------------------------------------ antet okuma --

interface BulunanEtiket {
  alan: Alan;
  yon: Yon;
  l: Satir;
  i0: number;
  i1: number;
  hucre: Hucre;
  x0: number;
  y: number;
  h: number;
}

/**
 * Antedi okur. Girdi BİR SAYFANIN span'larıdır; sonuç span SIRASINDAN
 * bağımsızdır (geometri sıraya değil konuma bakar).
 */
export function readTitleBlock(spans: readonly TextSpan[]): TitleBlockRead {
  const bos: TitleBlockRead = {
    titleBlock: emptyTitleBlock(),
    labelsFound: 0,
    labelsTotal: ETIKETLER.length,
    recognizedBy: "",
  };
  if (spans.length === 0) return bos;

  const satirlar = buildLines(spans);

  const bulunan: BulunanEtiket[] = [];
  for (const tanim of ETIKETLER) {
    for (const l of satirlar) {
      let m: { i0: number; i1: number } | null = null;
      for (const ad of tanim.adlar) {
        m = etiketAra(l, ad);
        if (m) break;
      }
      if (!m) continue;
      const hucre =
        hucreler(l).find(([a, b]) => a <= m!.i1 && m!.i1 <= b) ?? ([m.i0, m.i1] as Hucre);
      bulunan.push({
        alan: tanim.alan, yon: tanim.yon, l, i0: m.i0, i1: m.i1, hucre,
        x0: l.xs[m.i0], y: l.y, h: l.hs[m.i0],
      });
      break;
    }
  }

  // Çerçeve BİR-İKİ etiketten türetilemez: anlamsız küçük ya da devasa bir
  // dikdörtgen çıkar. Beş etiket bulunamadıysa bu şablon değildir; okuyucu
  // boş döner ve çağıran "antedini tanıyamadım" diyebilir.
  if (bulunan.length < EN_AZ_ETIKET) {
    return { ...bos, labelsFound: bulunan.length };
  }

  const cerceveSag = Math.max(...bulunan.map((e) => e.l.xe[e.hucre[1]]));

  // Değer olarak seçilemeyecek hücreler: etiketlerin ve ızgara sözcüklerinin
  // kendi hücreleri.
  const yasakli = new Set<string>();
  const izgara: { x0: number; y: number }[] = [];
  for (const e of bulunan) yasakli.add(`${e.y}|${e.hucre[0]}`);
  for (const l of satirlar) {
    const chs = hucreler(l);
    for (const ad of IZGARA) {
      const m = etiketAra(l, ad);
      if (!m) continue;
      izgara.push({ x0: l.xs[m.i0], y: l.y });
      const c = chs.find(([a, b]) => a <= m.i0 && m.i0 <= b);
      if (c) yasakli.add(`${l.y}|${c[0]}`);
    }
  }

  const ham: Partial<Record<Alan, string>> = {};
  const yaz = (alan: Alan, v: string): void => {
    const temiz = v.trim();
    if (!temiz) return;
    const d = DENETIM[alan];
    if (d && !d(temiz)) return;
    ham[alan] = temiz;
  };
  const tarihler: Partial<Record<"drawnBy" | "approvedBy", string>> = {};

  for (const e of bulunan) {
    if (e.yon === "sag") {
      const { deger, kalan } = sagdakiDeger(e, spans, izgara);
      yaz(e.alan, deger);
      if (e.alan === "drawnBy" || e.alan === "approvedBy") {
        const t = kalan.match(/\d{1,2}[.,]\d{1,2}[.,]\d{4}/);
        if (t) tarihler[e.alan] = t[0];
      }
    } else {
      const v = alttakiDeger(e, satirlar, yasakli, cerceveSag);
      if (v) yaz(e.alan, v);
    }
  }

  const agirlik = ham.weightRaw ?? "";
  const naMi = /^N\s*\/?\s*A$/i.test(agirlik);

  return {
    titleBlock: {
      drawingNo: ham.drawingNo ?? "",
      projectNo: ham.projectNo ?? "",
      jobName: ham.jobName ?? "",
      parentProject: ham.parentProject ?? "",
      customer: ham.customer ?? "",
      weightKg: naMi ? null : trSayi(agirlik),
      weightNA: naMi,
      qty: ham.qtyRaw ? Number(ham.qtyRaw) : null,
      material: ham.material ?? "",
      scale: ham.scale ?? "",
      sheetSize: ham.sheetSize ? ham.sheetSize.toUpperCase() : "",
      sheetNo: ham.sheetNo ?? "",
      drawnBy: ham.drawnBy ?? "",
      approvedBy: ham.approvedBy ?? "",
      dateIso: tarihler.drawnBy ? trTarih(tarihler.drawnBy) ?? "" : "",
      approvedDateIso: tarihler.approvedBy ? trTarih(tarihler.approvedBy) ?? "" : "",
      revision: ham.revision ?? "",
    },
    labelsFound: bulunan.length,
    labelsTotal: ETIKETLER.length,
    recognizedBy: ANTET_TANIYICI,
  };
}

/**
 * SAĞ yönlü değer: etiketin taban çizgisi BANDINDA, sağda.
 *
 * SATIR NESNESİ KULLANILMAZ, band kullanılır. Gerekçe ölçüldü: iki resimde
 * ağırlık değeri etiketin taban çizgisinden 1,6 punto YUKARIDA basılmış
 * (`0,338kg` ile `Ağ/Wt :` arasında 0,36 satır yüksekliği fark var). Satır
 * gruplaması bu farkı komşu span'ların yüksekliğine göre bazen yutuyor bazen
 * yutmuyordu — yani sonuç ANTETLE İLGİSİZ bir çizim yazısının varlığına
 * bağlıydı. Band, sonucu yalnız etiketin kendi ölçüsüne bağlar.
 *
 * Sınırı iki şey belirler ve yakın olan kazanır:
 *   1. IZGARA sütunu — değerin başlangıcından 2,5 satır yüksekliği ötedeki
 *      ilk sütun. Tolerans ŞART: değer kendi sütun başlığının SOLUNDAN
 *      başlıyor (ölçüldü: A4'te 1,9 · A1'de 0,9 satır yüksekliği kadar).
 *   2. iki satır yüksekliğini aşan bir boşluk.
 */
function sagdakiDeger(
  e: BulunanEtiket,
  spans: readonly TextSpan[],
  izgara: readonly { x0: number; y: number }[]
): { deger: string; kalan: string } {
  const bandH = 0.6 * e.h;
  const x1 = e.l.xe[e.i1];
  const band = spans
    .filter((s) => s.text.trim() !== "" && Math.abs(s.y - e.y) <= bandH && s.x >= x1 - 0.1 * e.h)
    .sort((a, b) => a.x - b.x);
  if (band.length === 0) return { deger: "", kalan: "" };

  const ilk = band[0];
  if (ilk.x - x1 > SAG_BOSLUK * Math.max(e.h, ilk.h)) return { deger: "", kalan: "" };

  let sinir = Number.POSITIVE_INFINITY;
  for (const g of izgara) {
    if (Math.abs(g.y - e.y) > 4 * e.h) continue;
    if (g.x0 <= ilk.x + SUTUN_TOLERANS * e.h) continue;
    if (g.x0 < sinir) sinir = g.x0;
  }

  let deger = "";
  let onceki: TextSpan | null = null;
  let kesildi = band.length;
  for (let i = 0; i < band.length; i++) {
    const s = band[i];
    if (s.x >= sinir - 0.1 * e.h) { kesildi = i; break; }
    if (onceki) {
      const bosluk = s.x - (onceki.x + onceki.w);
      if (bosluk > SAG_BOSLUK * Math.max(e.h, s.h)) { kesildi = i; break; }
      if (bosluk > SOZCUK_ORAN * Math.max(onceki.h, s.h)) deger += " ";
    }
    deger += s.text;
    onceki = s;
  }
  return { deger, kalan: band.slice(kesildi).map((s) => s.text).join(" ") };
}

/**
 * ALT yönlü değer: hücrenin altındaki ilk dolu hücre.
 *
 * "En yakın" ÖLÇÜ yatay uzaklıktır, dikey değil: aynı pencerede birden çok
 * satır olabiliyor (telif paragrafı dört satır) ve doğru değer her zaman
 * etiketin sütununda duruyor. Sola kaçan hücreler zaten elenir; 18 satır
 * yüksekliğinden uzak olanlar da elenir, çünkü ölçülen en uzak GERÇEK değer
 * 11,1 satır yüksekliğindeydi.
 */
function alttakiDeger(
  e: BulunanEtiket,
  satirlar: readonly Satir[],
  yasakli: ReadonlySet<string>,
  cerceveSag: number
): string {
  let en: { dx: number; metin: string } | null = null;
  for (const l of satirlar) {
    if (l.y >= e.y - 0.35 * e.h || l.y < e.y - ALT_PENCERE * e.h) continue;
    for (const c of hucreler(l)) {
      if (yasakli.has(`${l.y}|${c[0]}`)) continue;
      const metin = hucreMetni(l, c);
      const anahtar = katlaAnahtar(metin).key;
      if (SABIT_METINLER.some((s) => anahtar.includes(s))) continue;
      const cx0 = l.xs[c[0]];
      if (cx0 < e.x0 - 0.6 * e.h) continue;
      if (cx0 > cerceveSag + 2 * e.h) continue;
      const dx = cx0 - e.x0;
      if (dx > ALT_EN_UZAK * e.h) continue;
      if (!en || dx < en.dx) en = { dx, metin };
    }
  }
  return en?.metin ?? "";
}

// ------------------------------------------------- montaj parça tablosu ----

type BomAlan = "pos" | "qty" | "designation" | "material" | "massKg" | "totalMassKg" | "partCode";

/**
 * Tablo başlığı sözlüğü — SÜTUN İNDİSİ DEĞİL, SÜTUN ADI.
 *
 * excel.ts'in dersi burada da geçerli: aynı paketin içinde bile sütun kümesi
 * değişiyor. `0057-00-0510` ve `0057-00-0600` fazladan bir `Toplam Ağırlık`
 * sütunu taşıyor; indisle okumak o sayfalarda parça kodunu ağırlık sanardı.
 */
const BOM_SOZLUK: { alan: BomAlan; adlar: string[] }[] = [
  { alan: "pos", adlar: ["No/Pos", "No / Pos"] },
  { alan: "qty", adlar: ["Adet/Qty"] },
  { alan: "designation", adlar: ["Parça Özellikleri/Designation", "Parça Özellikleri"] },
  { alan: "material", adlar: ["Malzeme/Material"] },
  { alan: "massKg", adlar: ["Birim Ağırlık/Wt", "Ağırlık/Wt"] },
  { alan: "totalMassKg", adlar: ["Toplam Ağırlık"] },
  { alan: "partCode", adlar: ["Parça Kodu/Part Code", "Parça Kodu"] },
];

/** Başlık satırı bu kadar bilinen sütun taşımalı. */
const BOM_EN_AZ_SUTUN = 3;

interface BomSutun {
  alan: BomAlan;
  x0: number;
  x1: number;
}

/**
 * Montaj resminin üzerindeki çocuk parça tablosunu okur.
 *
 * NEDEN DEĞERLİ: ürün ağacı Excel'i olmayan bir pakette (MONORAY) parçaların
 * ağırlığı YALNIZ burada ve parçanın kendi antedinde var. Satın alınan
 * kalemler (redüktör, motor, pano) hiçbir resimde antet taşımaz; ağırlıkları
 * yalnız üst montajın bu tablosunda geçer.
 */
export function readSheetBom(spans: readonly TextSpan[], page = 1): SheetBomRow[] {
  const satirlar = buildLines(spans);
  if (satirlar.length === 0) return [];

  // Başlık: en çok sütun adı taşıyan satır.
  let bas: Satir | null = null;
  let enIyi = 0;
  for (const l of satirlar) {
    let n = 0;
    for (const s of BOM_SOZLUK) if (s.adlar.some((a) => etiketAra(l, a))) n++;
    if (n >= BOM_EN_AZ_SUTUN && n > enIyi) { enIyi = n; bas = l; }
  }
  if (!bas) return [];

  // Başlık İKİ-ÜÇ SATIRA bölünmüş olabilir (`Birim Ağırlık/Wt` üstte, `(Kg)`
  // altta); bu yüzden sütunlar başlığın çevresinde de aranır.
  const basSatirlari: Satir[] = [];
  const sutunlar: BomSutun[] = [];
  for (const s of BOM_SOZLUK) {
    for (const l of satirlar) {
      if (Math.abs(l.y - bas.y) > 2.2 * bas.h) continue;
      let m: { i0: number; i1: number } | null = null;
      for (const a of s.adlar) { m = etiketAra(l, a); if (m) break; }
      if (!m) continue;
      sutunlar.push({ alan: s.alan, x0: l.xs[m.i0], x1: l.xe[m.i1] });
      if (!basSatirlari.includes(l)) basSatirlari.push(l);
      break;
    }
  }
  if (sutunlar.length < BOM_EN_AZ_SUTUN) return [];
  sutunlar.sort((a, b) => a.x0 - b.x0);

  // ŞERİT: hücrenin gerçek yaşam alanı. Başlık ORTALANMIŞ ama veri SOLA
  // DAYALI — `SAC 8x475x8270` 2704'te başlıyor, kendi başlığı 2831'de. Orta
  // noktadan bölmek onu komşu "Adet" sütununa yazıyordu; bu yüzden bir sütunun
  // şeridi kendi başlığından değil, BİR ÖNCEKİ başlığın bittiği yerden başlar.
  const serit = sutunlar.map((c, i) => ({
    sol: i === 0 ? c.x0 - 3 * bas!.h : sutunlar[i - 1].x1,
    sag: i === sutunlar.length - 1 ? c.x1 + 8 * bas!.h : c.x1,
  }));
  const bosluk = (a0: number, a1: number, b0: number, b1: number): number => {
    const a = Math.max(a0, b0);
    const b = Math.min(a1, b1);
    return b >= a ? 0 : a - b;
  };
  const maliyet = (s: TextSpan, i: number): number =>
    bosluk(s.x, s.x + s.w, serit[i].sol, serit[i].sag) +
    0.3 * bosluk(s.x, s.x + s.w, sutunlar[i].x0, sutunlar[i].x1);

  const solSinir = sutunlar[0].x0 - 3 * bas.h;
  const sagSinir = sutunlar[sutunlar.length - 1].x1 + 6 * bas.h;
  // Başlığın ÜST kenarı YALNIZ başlık sözcüğü taşıyan satırlardan hesaplanır.
  // Yakındaki bütün satırları saymak, başlığın hemen üstündeki İLK VERİ
  // SATIRINI yutuyordu (ölçüldü: A0'da pos=1 satırı kayboluyordu).
  const basUst = Math.max(...basSatirlari.map((l) => l.y));

  const veri = satirlar
    .filter((l) => l.y > basUst + 0.5 * bas!.h)
    .sort((a, b) => a.y - b.y);

  const out: SheetBomRow[] = [];
  let sonY: number | null = null;
  let adim: number | null = null;
  for (const l of veri) {
    const icerdekiler = l.spans.filter((s) => s.x >= solSinir && s.x <= sagSinir);
    if (icerdekiler.length < 2) continue;

    const es = hizala(icerdekiler, sutunlar.length, maliyet, 3 * bas.h);
    const hucre: Partial<Record<BomAlan, string>> = {};
    icerdekiler.forEach((s, k) => {
      if (es[k] < 0) return;
      const alan = sutunlar[es[k]].alan;
      hucre[alan] = `${hucre[alan] ?? ""} ${s.text}`.trim();
    });

    // Sütun şekil denetimi. Kodu olmayan bir hücre parça koduna yazılmaz:
    // ölçüldü, ağırlık sütunundaki `0,0` ve `0 kg` parça kodu sanılıyordu.
    // Ondalık ayraç taşıyan hiçbir şey kod değildir; kod ya tireli
    // (`0043-00-0051`) ya da düz bir stok numarasıdır (`509010006`).
    if (hucre.pos && !/^\d{1,3}$/.test(hucre.pos)) delete hucre.pos;
    if (hucre.qty && !/^\d{1,4}$/.test(hucre.qty)) delete hucre.qty;
    if (hucre.partCode && !/^[\p{L}\p{N}][\p{L}\p{N}._/-]{3,}$/u.test(hucre.partCode)) {
      delete hucre.partCode;
    }
    if (hucre.partCode && (!/\d/.test(hucre.partCode) || /kg/i.test(hucre.partCode))) {
      delete hucre.partCode;
    }
    if (Object.keys(hucre).length < 2) continue;
    if (!hucre.pos && !hucre.partCode) continue;

    // Tablo SÜREKLİDİR: satır adımının üç katından uzak bir "satır" sayfanın
    // başka bir yerindeki çizim yazısıdır (ölçüldü: A1'de y=1589'da öyle bir
    // hayalet satır vardı).
    if (sonY !== null) {
      const d = l.y - sonY;
      if (adim === null) adim = d;
      else if (d > 3 * adim) break;
      else adim = Math.min(adim, d);
    }
    sonY = l.y;

    out.push({
      pos: hucre.pos ?? "",
      partCode: hucre.partCode ?? "",
      designation: hucre.designation ?? "",
      material: hucre.material ?? "",
      qty: hucre.qty ? Number(hucre.qty) : null,
      massKg: trSayi(hucre.massKg ?? ""),
      totalMassKg: trSayi(hucre.totalMassKg ?? ""),
      page,
    });
  }
  return out;
}

/**
 * Satırdaki hücreleri sütunlara TEK YÖNLÜ hizalar (Needleman-Wunsch benzeri).
 *
 * Sınır çizgisiyle bölmek yetmiyor çünkü veri sola dayalı, başlık ortalanmış.
 * Ama satırdaki hücrelerin SIRASI şaşmaz: soldan sağa sütun sırasıyla aynıdır.
 * Hizalama bu sırayı kullanır; boş sütun serbesttir, hücre düşürmek bedellidir.
 */
function hizala(
  spans: readonly TextSpan[],
  sutunSayisi: number,
  maliyet: (s: TextSpan, i: number) => number,
  atlamaBedeli: number
): number[] {
  const n = spans.length;
  const m = sutunSayisi;
  const INF = Number.POSITIVE_INFINITY;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const iz: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let j = 0; j <= m; j++) dp[0][j] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      let en = dp[i - 1][j] + atlamaBedeli;
      let k = 1;
      if (j > 0) {
        const e = dp[i - 1][j - 1] + maliyet(spans[i - 1], j - 1);
        if (e < en) { en = e; k = 2; }
        const f = dp[i][j - 1];
        if (f < en) { en = f; k = 3; }
      }
      dp[i][j] = en;
      iz[i][j] = k;
    }
  }
  let i = n;
  let j = 0;
  for (let jj = 0; jj <= m; jj++) if (dp[n][jj] < dp[n][j]) j = jj;
  const es = new Array<number>(n).fill(-1);
  while (i > 0) {
    const k = iz[i][j];
    if (k === 1) i--;
    else if (k === 2) { es[i - 1] = j - 1; i--; j--; }
    else j--;
  }
  return es;
}

// ------------------------------------------------- geometrisiz düşük irtifa --

/**
 * Geometri yokken çalışan yedek yol: YALNIZ kendi şekliyle kendini tanıtan
 * ve metinde TEK BİR kez geçen değerleri alır.
 *
 * "Tek geçmesi" şartı bu fonksiyonun bütün güvencesidir ve onu SIRADAN
 * BAĞIMSIZ yapar: belirteçler karıştırılsa da sonuç değişmez, çünkü hiçbir
 * karar komşuluğa dayanmaz. Bir sayfada iki farklı ölçek yazıyorsa ölçek
 * boş kalır — yanlış olanı seçmektense hiçbirini seçmemek doğrudur.
 */
export function readTitleBlockFromText(text: string): TitleBlock {
  const tb = emptyTitleBlock();
  if (!text) return tb;

  const tek = (kalip: RegExp, temizle?: (m: RegExpMatchArray) => string): string => {
    const kume = new Set<string>();
    for (const m of text.matchAll(kalip)) kume.add(temizle ? temizle(m) : m[0]);
    return kume.size === 1 ? [...kume][0] : "";
  };

  const agirlik = tek(/(-?[\d.,]+)\s*kg\b/gi, (m) => m[1]);
  if (agirlik) tb.weightKg = trSayi(agirlik);

  tb.scale = tek(/\b(\d{1,3}\s*:\s*\d{1,3}(?:[.,]\d+)?)\b/g, (m) => m[1]);
  tb.sheetSize = tek(/\b(A[0-4])\b/g, (m) => m[1]);
  tb.drawingNo = tek(/\b(\d{4,5}-\d{2}(?:-\d+)+)\b/g, (m) => m[1]);

  // Tarihte "tek geçme" şartı fazla katı olurdu: çizim ve onay tarihi aynı
  // gün olduğu için iki kez yazılıyor. Kural TEK BENZERSİZ DEĞER olsun.
  const tarihler = new Set<string>();
  for (const m of text.matchAll(/\b\d{1,2}[.,]\d{1,2}[.,]\d{4}\b/g)) {
    const iso = trTarih(m[0]);
    if (iso) tarihler.add(iso);
  }
  if (tarihler.size === 1) tb.dateIso = [...tarihler][0];

  return tb;
}
