// TEKLİF ANALİZİ — kazanma puanı, projeksiyon ve dönem serileri. SAF çekirdek.
//
// Kullanıcı hedefi (17.08.2026): *"açık teklifler ve bu tekliflerin sıcaklık
// soğukluk oranına göre projeksiyon yapacağım … bu yıl içinde ya da önümüzdeki
// 6 ay 1 yıl içinde verdiğim verebileceğim teklifler ve alabileceğim işleri
// kontrol etmiş olacağız."*
//
// İKİ KAYNAK, TEK ÇİZELGE: verilmiş teklifler (`offers`) ve henüz verilmemiş
// beklenen işler (`offer_leads`). İkisi AYRI tablolardır (gerekçe migration
// 20260819000004'te) ama analiz onları tek bir satır tipinde konuşur — sayfanın
// sorduğu soru "önümüzdeki bir yılda ne kadar iş alırım"dır ve o soru teklifin
// hangi tabloda durduğunu umursamaz.

// ————————————————————————————————————————————————————————— satır

export type AnalizKaynak = "teklif" | "beklenen";

export interface AnalizSatiri {
  id: string;
  kaynak: AnalizKaynak;
  /** Teklif satırında teklif no; beklenen işte boş. */
  offerNo: string | null;
  customerName: string;
  customerShort?: string | null;
  customerHue?: number | null;
  subject: string;
  /** Teklif durumu; beklenen işte "beklenen". */
  status: string;
  /** Kararın beklendiği tarih (ISO) — dönem bundan okunur. */
  expectedOn: string | null;
  amount: number | null;
  currency: string;
  /** 1–10 kazanma yakınlığı; boş = puanlanmamış. */
  score: number | null;
  /** Beklenen işin bağlandığı teklif (varsa) — çift sayımı bu engeller. */
  offerId?: string | null;
  active: boolean;
}

// ————————————————————————————————————————————————————————— renk

/**
 * PUAN → OKLCH TON AÇISI. Soğuk (1) mavi, sıcak (10) kırmızı.
 *
 * Renk bir HEX değil AÇIDIR (değişmez md. 6): doygunluk ve parlaklık
 * `globals.css`teki `.oc-row-hue` / `.oc-tag` kurallarında, tema başına
 * verilir. Ölçek 240°'den (mavi) 25°'ye (kırmızı) DÜZ iner ve yolda yeşil ile
 * sarıdan geçer — yani "ısınma" duygusu renk çemberinin kendisinden gelir,
 * elle seçilmiş beş tondan değil.
 *
 * PUANSIZ SATIR RENKSİZDİR (`null`): uydurma bir orta değer, kullanıcının
 * henüz vermediği bir kararı vermiş gibi gösterirdi.
 */
export function scoreHue(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const s = Math.min(10, Math.max(1, Math.round(score)));
  const SOGUK = 240;
  const SICAK = 25;
  return Math.round(SOGUK - ((SOGUK - SICAK) * (s - 1)) / 9);
}

export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  const s = Math.min(10, Math.max(1, Math.round(score)));
  if (s >= 9) return "Çok yakın";
  if (s >= 7) return "Yakın";
  if (s >= 5) return "Orta";
  if (s >= 3) return "Uzak";
  return "Çok uzak";
}

// ————————————————————————————————————————————————————— projeksiyon

/**
 * AĞIRLIKLI TUTAR = tutar × puan/10.
 *
 * Projeksiyonun tamamı bu tek çarpımdır ve bilerek böyle basittir: puan zaten
 * kullanıcının kendi takdiridir, üstüne bir olasılık modeli koymak uydurma bir
 * kesinlik üretirdi. Puanı ya da tutarı OLMAYAN satır projeksiyona GİRMEZ —
 * eksik veriyi sıfır saymak, toplamı sessizce küçültmenin en kısa yoludur
 * (değişmez md. 4).
 */
export function agirlikliTutar(satir: Pick<AnalizSatiri, "amount" | "score">): number | null {
  if (satir.amount === null || satir.score === null) return null;
  return (satir.amount * Math.min(10, Math.max(1, satir.score))) / 10;
}

export interface ProjeksiyonOzeti {
  /** Kaç satır toplama girdi. */
  adet: number;
  /** Ham tutarların toplamı (puansız da olsa tutarı olanlar). */
  hamToplam: number;
  /** Ağırlıklı toplam — yalnız hem tutarı hem puanı olan satırlar. */
  agirlikliToplam: number;
  /** Tutarı ya da puanı eksik olduğu için toplama giremeyen satır sayısı. */
  eksik: number;
}

/** Yeni tekliflerde kullanıcının sonradan değiştirebildiği başlangıç puanı. */
export const DEFAULT_OFFER_WIN_SCORE = 5;

/**
 * Yeni teklifin varsayılan karar tarihi: teklif tarihinden bir takvim ayı sonra.
 *
 * Ay sonu taşması KELEPÇELENİR: 31 Ocak + 1 ay, mart ayına sarkmak yerine
 * şubatın son günüdür. Veritabanı tetikleyicisi de aynı takvim kuralını taşır.
 */
export function defaultOfferExpectedOn(issueDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issueDate);
  if (!match) throw new Error("Teklif tarihi ISO biçiminde olmalıdır.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetMonthIndex = month;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

/**
 * Dönem penceresi — bugünden ileriye N ay.
 *
 * `bugun` DIŞARIDAN gelir: çekirdek saf kalmalıdır, içeride `new Date()`
 * çağırmak testi saate bağımlı yapar ve sunucu/istemci boyamasını ayrıştırır.
 */
export function donemSonu(bugunIso: string, ay: number): string {
  const d = new Date(`${bugunIso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + ay);
  return d.toISOString().slice(0, 10);
}

/** Bu yılın sonu — "bu yıl içinde ne alırım" penceresi. */
export function yilSonu(bugunIso: string): string {
  return `${bugunIso.slice(0, 4)}-12-31`;
}

export const PROJEKSIYON_PENCERELERI = [
  { key: "yil", label: "Bu Yıl" },
  { key: "6ay", label: "6 Ay" },
  { key: "12ay", label: "12 Ay" },
  { key: "tumu", label: "Tümü" },
] as const;

export type ProjeksiyonPencere = (typeof PROJEKSIYON_PENCERELERI)[number]["key"];

/** Analiz ekranı ilk açılışta önümüzdeki bir yılı gösterir. */
export const DEFAULT_PROJEKSIYON_PENCERE: ProjeksiyonPencere = "12ay";

/** Pencerenin bitiş tarihi; "tümü" sınırsızdır. */
export function pencereBitisi(pencere: ProjeksiyonPencere, bugunIso: string): string | null {
  switch (pencere) {
    case "yil":
      return yilSonu(bugunIso);
    case "6ay":
      return donemSonu(bugunIso, 6);
    case "12ay":
      return donemSonu(bugunIso, 12);
    case "tumu":
      return null;
  }
}

/**
 * Satır pencereye giriyor mu.
 *
 * BEKLENEN TARİHİ OLMAYAN SATIR "TÜMÜ" DIŞINDAKİ PENCERELERE GİRMEZ ve bu
 * bilinçlidir: tarihi bilinmeyen bir işi "bu yıl gelecek" saymak, projeksiyonu
 * kullanıcının söylemediği bir varsayımla şişirirdi. Sayfa onları ayrıca
 * sayar ki gözden kaçmasınlar.
 */
export function pencereyeGirer(
  satir: Pick<AnalizSatiri, "expectedOn">,
  pencere: ProjeksiyonPencere,
  bugunIso: string
): boolean {
  if (pencere === "tumu") return true;
  if (!satir.expectedOn) return false;
  const bitis = pencereBitisi(pencere, bugunIso);
  return bitis !== null && satir.expectedOn <= bitis;
}

export function projeksiyon(satirlar: readonly AnalizSatiri[]): ProjeksiyonOzeti {
  let hamToplam = 0;
  let agirlikliToplam = 0;
  let adet = 0;
  let eksik = 0;
  for (const s of satirlar) {
    if (s.amount === null) {
      eksik += 1;
      continue;
    }
    hamToplam += s.amount;
    const a = agirlikliTutar(s);
    if (a === null) {
      eksik += 1;
      continue;
    }
    agirlikliToplam += a;
    adet += 1;
  }
  return { adet, hamToplam, agirlikliToplam, eksik };
}

// ————————————————————————————————————————————————————————— seriler

export interface AySerisiNoktasi {
  /** `2026-09` */
  ay: string;
  ham: number;
  agirlikli: number;
  adet: number;
}

/**
 * AYLIK SERİ — YOĞUNDUR, yani boş ay atlanmaz.
 *
 * Seyrek bir seri grafikte iki noktayı yan yana koyar ve aradaki üç aylık
 * boşluğu görünmez kılar; kullanıcı "eylülden aralığa sıçrama" diye okur
 * (Personel ve Sarf panolarında aynı kural). Pencere `bas`tan `bitis`e kadar
 * her ayı üretir.
 */
export function aylikSeri(
  satirlar: readonly AnalizSatiri[],
  basIso: string,
  bitisIso: string
): AySerisiNoktasi[] {
  const kova = new Map<string, AySerisiNoktasi>();
  const bas = basIso.slice(0, 7);
  const bitis = bitisIso.slice(0, 7);

  let imlec = bas;
  while (imlec <= bitis) {
    kova.set(imlec, { ay: imlec, ham: 0, agirlikli: 0, adet: 0 });
    const [y, m] = imlec.split("-").map(Number);
    imlec = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  for (const s of satirlar) {
    if (!s.expectedOn || s.amount === null) continue;
    const ay = s.expectedOn.slice(0, 7);
    const nokta = kova.get(ay);
    if (!nokta) continue;
    nokta.ham += s.amount;
    nokta.agirlikli += agirlikliTutar(s) ?? 0;
    nokta.adet += 1;
  }
  return [...kova.values()];
}

/** Müşteri kırılımı — kim ne kadar iş getirebilir. */
export function musteriKirilimi(satirlar: readonly AnalizSatiri[]) {
  const kova = new Map<string, { musteri: string; hue: number | null; ham: number; agirlikli: number; adet: number }>();
  for (const s of satirlar) {
    const ad = s.customerName.trim() || "—";
    const k = kova.get(ad) ?? { musteri: ad, hue: s.customerHue ?? null, ham: 0, agirlikli: 0, adet: 0 };
    k.ham += s.amount ?? 0;
    k.agirlikli += agirlikliTutar(s) ?? 0;
    k.adet += 1;
    kova.set(ad, k);
  }
  return [...kova.values()].sort((a, b) => b.agirlikli - a.agirlikli);
}

/** Puan dağılımı — sıcak/soğuk dengesi tek bakışta. */
export function puanDagilimi(satirlar: readonly AnalizSatiri[]) {
  const kova = new Map<number, { score: number; adet: number; tutar: number }>();
  for (const s of satirlar) {
    if (s.score === null) continue;
    const k = kova.get(s.score) ?? { score: s.score, adet: 0, tutar: 0 };
    k.adet += 1;
    k.tutar += s.amount ?? 0;
    kova.set(s.score, k);
  }
  return [...kova.values()].sort((a, b) => b.score - a.score);
}

/**
 * ÇİFT SAYIM ENGELİ: teklife dönüşmüş beklenen iş satırı analizden DÜŞER.
 *
 * Satır silinmez (tahminin ne kadar tuttuğu ancak geçmişle ölçülür) ama
 * teklifin kendisi zaten listede olduğu için ikisini birden toplamak aynı işi
 * iki kez saymak olurdu.
 */
export function tekilSatirlar(satirlar: readonly AnalizSatiri[]): AnalizSatiri[] {
  return satirlar.filter((s) => !(s.kaynak === "beklenen" && s.offerId));
}
