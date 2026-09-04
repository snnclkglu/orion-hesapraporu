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
  { key: "gecenYil", label: "Geçen Yıl" },
  { key: "6ay", label: "6 Ay" },
  { key: "12ay", label: "12 Ay" },
  { key: "tumu", label: "Tümü" },
] as const;

export type ProjeksiyonPencere = (typeof PROJEKSIYON_PENCERELERI)[number]["key"];

/** Analiz ekranı ilk açılışta önümüzdeki bir yılı gösterir. */
export const DEFAULT_PROJEKSIYON_PENCERE: ProjeksiyonPencere = "12ay";

export interface ProjeksiyonPencereAraligi {
  bas: string;
  bitis: string;
}

/**
 * Projeksiyonun kesin tarih aralığı; `tumu` iki yönde sınırsızdır.
 * Geçen yıl ayrı bir TAM takvim yılıdır, bu yıl ise ileriye bakan ekranın
 * mevcut anlamını koruyarak bugünden 31 Aralık'a uzanır.
 */
export function pencereAraligi(
  pencere: ProjeksiyonPencere,
  bugunIso: string
): ProjeksiyonPencereAraligi | null {
  const yil = Number(bugunIso.slice(0, 4));
  switch (pencere) {
    case "yil":
      return { bas: bugunIso, bitis: yilSonu(bugunIso) };
    case "gecenYil":
      return { bas: `${yil - 1}-01-01`, bitis: `${yil - 1}-12-31` };
    case "6ay":
      return { bas: bugunIso, bitis: donemSonu(bugunIso, 6) };
    case "12ay":
      return { bas: bugunIso, bitis: donemSonu(bugunIso, 12) };
    case "tumu":
      return null;
  }
}

/** Pencerenin bitiş tarihi; "tümü" sınırsızdır. */
export function pencereBitisi(pencere: ProjeksiyonPencere, bugunIso: string): string | null {
  return pencereAraligi(pencere, bugunIso)?.bitis ?? null;
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
  const aralik = pencereAraligi(pencere, bugunIso);
  return aralik !== null && satir.expectedOn >= aralik.bas && satir.expectedOn <= aralik.bitis;
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

// ——————————————————————————————————————————————————— kazanılan işler

/** Kazanılan teklifin analiz ve çizelge için gereken tek satırı. */
export interface KazanilanIsSatiri {
  id: string;
  offerNo: string;
  customerName: string;
  customerShort?: string | null;
  customerHue?: number | null;
  subject: string;
  /** Müşteriye gönderim günü — karar süresi bundan ölçülür. */
  issuedOn: string | null;
  /** Teklifin `won` durumuna geçtiği gerçek gün; bilinmiyorsa boş. */
  wonOn: string | null;
  amount: number | null;
  currency: string;
  jobId: string | null;
  jobNo?: string | null;
  jobTitle?: string | null;
}

export const KAZANIM_DONEMLERI = [
  { key: "yil", label: "Bu Yıl" },
  { key: "gecenYil", label: "Geçen Yıl" },
  { key: "12ay", label: "Son 12 Ay" },
  { key: "tumu", label: "Tümü" },
] as const;

export type KazanimDonemi = (typeof KAZANIM_DONEMLERI)[number]["key"];

export const DEFAULT_KAZANIM_DONEMI: KazanimDonemi = "yil";

export interface KazanimDonemAraligi {
  bas: string;
  bitis: string;
}

function isoTarih(value: string | null | undefined): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

/**
 * Gerçekleşme ekranı GEÇMİŞE bakar: bu yıl ve geçen yıl on ikişer tam takvim
 * ayıdır; son 12 ay bugünden geriye gider. `Tümü` bilinen ilk kazanımdan bugüne kadar yoğundur;
 * aradaki sessiz ayların grafikten kaybolmaması gerekir.
 */
export function kazanimDonemAraligi(
  donem: KazanimDonemi,
  bugunIso: string,
  satirlar: readonly Pick<KazanilanIsSatiri, "wonOn">[] = []
): KazanimDonemAraligi {
  const yil = Number(bugunIso.slice(0, 4));
  if (donem === "yil") return { bas: `${yil}-01-01`, bitis: `${yil}-12-31` };
  if (donem === "gecenYil") return { bas: `${yil - 1}-01-01`, bitis: `${yil - 1}-12-31` };
  if (donem === "12ay") return { bas: donemSonu(bugunIso, -12), bitis: bugunIso };

  const tarihler = satirlar.map((s) => s.wonOn).filter(isoTarih);
  const ilk = tarihler.length ? tarihler.reduce((a, b) => (a < b ? a : b)) : bugunIso;
  const son = tarihler.length ? tarihler.reduce((a, b) => (a > b ? a : b)) : bugunIso;
  return { bas: ilk, bitis: son > bugunIso ? son : bugunIso };
}

/** Tarihi bilinmeyen kazanım yalnız `Tümü` görünümünde kalır. */
export function kazanilanDonemeGirer(
  satir: Pick<KazanilanIsSatiri, "wonOn">,
  donem: KazanimDonemi,
  bugunIso: string
): boolean {
  if (donem === "tumu") return true;
  if (!isoTarih(satir.wonOn)) return false;
  const aralik = kazanimDonemAraligi(donem, bugunIso);
  return satir.wonOn >= aralik.bas && satir.wonOn <= aralik.bitis;
}

export interface KazanimOzeti {
  adet: number;
  eurAdet: number;
  eurToplam: number;
  eurOrtalama: number | null;
  digerPara: number;
  tutariEksik: number;
  tarihiEksik: number;
  isEmirli: number;
}

/**
 * Para birimleri dönüştürülmeden toplanmaz. Toplam ve ortalama yalnız Avro
 * satırlarından çıkar; diğer para birimleri ayrıca sayılır ve çizelgede kendi
 * simgesiyle kalır.
 */
export function kazanimOzeti(satirlar: readonly KazanilanIsSatiri[]): KazanimOzeti {
  const eur = satirlar.filter((s) => s.currency === "EUR" && s.amount !== null);
  const eurToplam = eur.reduce((toplam, s) => toplam + (s.amount ?? 0), 0);
  return {
    adet: satirlar.length,
    eurAdet: eur.length,
    eurToplam,
    eurOrtalama: eur.length ? eurToplam / eur.length : null,
    digerPara: satirlar.filter((s) => s.currency !== "EUR").length,
    tutariEksik: satirlar.filter((s) => s.amount === null).length,
    tarihiEksik: satirlar.filter((s) => !isoTarih(s.wonOn)).length,
    isEmirli: satirlar.filter((s) => Boolean(s.jobId)).length,
  };
}

export interface KazanimAyNoktasi {
  ay: string;
  tutar: number;
  adet: number;
}

/** Aylık kazanım serisi YOĞUNDUR; kayıtsız aylar sıfırla görünür. */
export function aylikKazanimSerisi(
  satirlar: readonly KazanilanIsSatiri[],
  basIso: string,
  bitisIso: string
): KazanimAyNoktasi[] {
  const kova = new Map<string, KazanimAyNoktasi>();
  let imlec = basIso.slice(0, 7);
  const bitis = bitisIso.slice(0, 7);
  while (imlec <= bitis) {
    kova.set(imlec, { ay: imlec, tutar: 0, adet: 0 });
    const [yil, ay] = imlec.split("-").map(Number);
    imlec = ay === 12 ? `${yil + 1}-01` : `${yil}-${String(ay + 1).padStart(2, "0")}`;
  }
  for (const s of satirlar) {
    if (!isoTarih(s.wonOn) || s.amount === null) continue;
    const nokta = kova.get(s.wonOn.slice(0, 7));
    if (!nokta) continue;
    nokta.tutar += s.amount;
    nokta.adet += 1;
  }
  return [...kova.values()];
}

/** Müşteriye göre alınan iş tutarı — büyükten küçüğe. */
export function kazanilanMusteriKirilimi(satirlar: readonly KazanilanIsSatiri[]) {
  const kova = new Map<
    string,
    { musteri: string; hue: number | null; tutar: number; adet: number }
  >();
  for (const s of satirlar) {
    const musteri = s.customerName.trim() || "—";
    const mevcut = kova.get(musteri) ?? {
      musteri,
      hue: s.customerHue ?? null,
      tutar: 0,
      adet: 0,
    };
    if (mevcut.hue === null && s.customerHue !== null && s.customerHue !== undefined) {
      mevcut.hue = s.customerHue;
    }
    mevcut.tutar += s.amount ?? 0;
    mevcut.adet += 1;
    kova.set(musteri, mevcut);
  }
  return [...kova.values()].sort((a, b) => b.tutar - a.tutar || a.musteri.localeCompare(b.musteri, "tr"));
}

/** Gönderimden kazanıma kadar geçen takvim günü; eksik/ters tarihte boş. */
export function kararSuresiGun(
  satir: Pick<KazanilanIsSatiri, "issuedOn" | "wonOn">
): number | null {
  if (!isoTarih(satir.issuedOn) || !isoTarih(satir.wonOn)) return null;
  const bas = Date.parse(`${satir.issuedOn}T00:00:00Z`);
  const son = Date.parse(`${satir.wonOn}T00:00:00Z`);
  const gun = Math.round((son - bas) / 86_400_000);
  return gun < 0 ? null : gun;
}

/** Kazanılma tarihine göre yeniden eskiye; tarihi bilinmeyenler sonda kalır. */
export function siralaKazanilanIsler(
  satirlar: readonly KazanilanIsSatiri[]
): KazanilanIsSatiri[] {
  return [...satirlar].sort((a, b) => {
    if (!a.wonOn && b.wonOn) return 1;
    if (a.wonOn && !b.wonOn) return -1;
    const tarih = (b.wonOn ?? "").localeCompare(a.wonOn ?? "");
    return tarih !== 0 ? tarih : b.offerNo.localeCompare(a.offerNo, "tr");
  });
}
