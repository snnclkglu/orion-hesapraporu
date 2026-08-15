// HAMMADDE SINIFLARI — kullanıcı kararı (15.08.2026).
//
// Satın alma talep havuzu İKİYE bölündü:
//
//   EKİPMAN  — satın alınan ürünler (rulman, motor, cıvata) + nakliye/mobil
//              vinç gibi hizmetler. Bugüne kadarki havuzun tamamı.
//   HAMMADDE — İMALAT satırlarının tanımından çıkarılan malzeme ihtiyacı.
//
// İkisi AYNI SATIRLARI PAYLAŞMAZ ve bu bir çifte sayım değildir: `SAC
// 15x375x1500` bir imalat parçasıdır (atölye plazmada keser, `/progress`te
// takip edilir) ama KESİLECEĞİ PLAKA satın alınır. Parça üretim sorusunun,
// plaka satın alma sorusunun cevabıdır.
//
// BEŞ SINIF + BİR TORBA. Kullanıcının cümlesi: *"Hammadde temel olarak 5 ürün
// olarak kategorilenecek. Sac, Profil, Ray, Dolu, Boru malzemeleri… Tüm
// grupları tanımladım, eğer bunun harici varsa yine bu gruba diğer olarak
// getireceğiz."*
//
// TANIMLAYICILAR ASCII'DİR (`PROFIL`, `DIGER`): değer veritabanına yazılıyor ve
// `check` kısıtında geçiyor; Türkçe harf bir gün kodlama sorunu çıkarırsa
// kısıtı düşürmek gerekirdi. Ekrandaki ad ayrı bir sözlükte durur.

import { trKatla } from "@/lib/drawings/tr-text";

export type HammaddeSinifi = "SAC" | "PROFIL" | "RAY" | "DOLU" | "BORU" | "DIGER";

/** Ekrandaki ve süzgeçteki sıra — kullanıcının saydığı sıra. */
export const HAMMADDE_SINIFLARI: readonly HammaddeSinifi[] = [
  "SAC",
  "PROFIL",
  "RAY",
  "DOLU",
  "BORU",
  "DIGER",
] as const;

export const HAMMADDE_ADLARI: Record<HammaddeSinifi, string> = {
  SAC: "Sac",
  PROFIL: "Profil",
  RAY: "Ray",
  DOLU: "Dolu",
  BORU: "Boru",
  DIGER: "Diğer",
};

/**
 * Sınıf rengi HEX DEĞİL OKLCH TON AÇISIDIR (md. 14'ün kuralı).
 *
 * Doygunluk ve parlaklık `globals.css`teki `.oc-tag` kuralında ve TEMA BAŞINA
 * verilir; buradan yalnız açı gelir. Açılar birbirinden en az 40° uzaktır —
 * altı çip yan yana durduğunda ayırt edilebilmeleri veriye değil KURALA
 * bağlıdır.
 */
export const HAMMADDE_TONLARI: Record<HammaddeSinifi, number> = {
  SAC: 225, // çelik mavisi
  PROFIL: 150, // yeşil
  RAY: 45, // kehribar
  DOLU: 285, // mor
  BORU: 195, // camgöbeği
  DIGER: 0, // nötr — `.oc-tag` gri'ye düşürür
};

/** Veritabanı `check` kısıtıyla BİREBİR aynı liste (bkz. migration). */
export const HAMMADDE_SINIF_KISITI = HAMMADDE_SINIFLARI.join(",");

export function hammaddeSinifiMi(value: string): value is HammaddeSinifi {
  return (HAMMADDE_SINIFLARI as readonly string[]).includes(value);
}

// ═══════════════════════════════════════════════════════════════ ÖZKÜTLE

/**
 * ÇELİK ÖZKÜTLESİ — kullanıcı kararı: *"özkütlesi zaten bu hammaddelerin
 * hepsinin 7,85 alabiliriz."*
 *
 * Birim kg/mm³'tür çünkü bu modüldeki bütün ölçüler MİLİMETREDİR; hesabın
 * içinde birim çevirmek, çevirmeyi bir gün unutmanın en kolay yoludur.
 */
export const CELIK_OZKUTLE_KG_MM3 = 7.85e-6;

/**
 * ÇELİK OLMAYAN MALZEME SESSİZCE ÇELİK SAYILMAZ.
 *
 * Canlı veride ölçüldü: MTC paketinde üç parçanın malzemesi `Kestamid`
 * (poliamid) ve biri Ø375xØ311 L=90'lık bir kılavuz — çelik özkütlesiyle
 * hesaplanınca 7 kat ağır çıkıyor. Kullanıcının "hepsi 7,85" cümlesi
 * HAMMADDELER içindi; plastik bir kılavuz o kümede değildir.
 *
 * Liste KISADIR ve yalnız GERÇEK bir satırda görülmüş malzemeleri taşır
 * (`derive.ts`in sözlük kuralı): tanınmayan malzeme çelik sayılır ve bu bir
 * varsayım değil VARSAYILAN'dır — kaynak dosyaların %98'i yapı çeliğidir.
 */
const OZKUTLELER: { anahtar: string; kgMm3: number; ad: string }[] = [
  { anahtar: "KESTAMID", kgMm3: 1.15e-6, ad: "Kestamid" },
  { anahtar: "POLIAMID", kgMm3: 1.15e-6, ad: "Poliamid" },
  { anahtar: "PA6", kgMm3: 1.15e-6, ad: "PA6" },
  { anahtar: "POM", kgMm3: 1.41e-6, ad: "POM" },
  { anahtar: "ALUMINYUM", kgMm3: 2.7e-6, ad: "Alüminyum" },
  { anahtar: "BRONZ", kgMm3: 8.8e-6, ad: "Bronz" },
  { anahtar: "PIRINC", kgMm3: 8.5e-6, ad: "Pirinç" },
  { anahtar: "PASLANMAZ", kgMm3: 7.9e-6, ad: "Paslanmaz" },
];

export interface OzkutleSonucu {
  kgMm3: number;
  /** Çelik varsayılanı mı kullanıldı, yoksa malzeme tanındı mı? */
  celikVarsayildi: boolean;
  /** Tanınan malzemenin adı; çelikte boş. */
  ad: string;
}

export function ozkutleBul(malzeme: string | null | undefined): OzkutleSonucu {
  const a = trKatla(malzeme ?? "");
  if (a) {
    for (const o of OZKUTLELER) {
      if (a.includes(o.anahtar)) return { kgMm3: o.kgMm3, celikVarsayildi: false, ad: o.ad };
    }
  }
  return { kgMm3: CELIK_OZKUTLE_KG_MM3, celikVarsayildi: true, ad: "" };
}

// ═══════════════════════════════════════════════════════ MALZEME KALİTESİ

/**
 * KALİTE OLMAYAN MALZEME DEĞERLERİ.
 *
 * Inventor malzeme alanını boş bırakmaz; kaynak dosyalarda `Steel, Mild`,
 * `Generic` ve `-` üçü birden geçiyor (ölçüldü: 888 farklı tanımın 176'sı).
 * Bunlar bir çelik KALİTESİ değil, "söylenmedi"nin üç yazımıdır. Stok kalemi
 * adına yazılırlarsa aynı sacı iki ayrı kaleme bölerler:
 * `SAC 15 MM S355JR` ile `SAC 15 MM STEEL, MILD` iki ayrı sipariş olurdu.
 */
const KALITE_SAYILMAZ = new Set(["", "-", "GENERIC", "STEEL, MILD", "STEEL MILD", "FST", "ST"]);

/** Malzeme alanı gerçek bir kalite mi? Değilse boş dizge döner. */
export function kaliteAyikla(malzeme: string | null | undefined): string {
  const ham = (malzeme ?? "").trim();
  if (!ham) return "";
  return KALITE_SAYILMAZ.has(trKatla(ham)) ? "" : ham.toLocaleUpperCase("tr-TR");
}

// ══════════════════════════════════════════════════════════ STOK BOYLARI

/**
 * SATIN ALMA BOYU — kullanıcı kararı, malzeme ailesi başına.
 *
 * *"profilleri genelde 12 metre olarak satın alıyoruz"* · *"biz rayları da 12
 * metre olarak satın alırız"* · *"bu tarz korkuluk boruları 12 metre boy
 * olarak alınıyor"*.
 *
 * DOLU MALZEMEDE BOY YOKTUR ve uydurulmaz: kullanıcı yuvarlak malzeme için bir
 * standart boy söylemedi, mil ve teker çoğu zaman kilo üzerinden alınır.
 * `null` "bilinmiyor" demektir; ekran o sütunu boş bırakır (evin kuralı).
 */
export const STOK_BOYU_MM: Record<HammaddeSinifi, number | null> = {
  SAC: null, // plaka ölçüsü yerleşim modülünün kararıdır
  PROFIL: 12000,
  RAY: 12000,
  DOLU: null,
  BORU: 12000,
  DIGER: null,
};

/** Sac plakası standart enleri [mm] — kullanıcı: *"1500 2000 2500 ve 3000"*. */
export const PLAKA_ENLERI = [1500, 2000, 2500, 3000] as const;

/** Sac plakası standart boyları [mm] — *"çoğu zaman 12000 ama bazen 6000"*. */
export const PLAKA_BOYLARI = [6000, 12000] as const;

/** Kesim payı seçenekleri [mm] — *"bazen 3 4 5 6 7 8 olabiliyor"*. */
export const KESIM_PAYLARI = [3, 4, 5, 6, 7, 8] as const;

export const VARSAYILAN_KESIM_PAYI = 5;
