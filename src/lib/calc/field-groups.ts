// ALAN GRUPLARI — bir hesap bölümünün girdilerini GÖZLE TARANABİLİR öbeklere
// ayırır.
//
// Kullanıcı bildirimi (15.08.2026, ana kiriş kesit özellikleri):
//   *"hangisi üst sac hangi sac gözle arıyorum hep. bir örüntü, kolaylık yok.
//    belki renkle de kolay ayırt edilebilirlik eklenebilir ve düzen örüntüsü
//    ile."*
//
// Ana kiriş kesitinin on yedi ölçüsü tek bir düz ızgaraya diziliyordu; hepsi
// aynı ağırlıkta, aynı renkte ve resimdeki yerleriyle hiçbir bağı yoktu.
// Üç şey birden verilir:
//
//   1. ÖBEK  — alanlar kesitin PARÇALARINA göre ayrılır (ray · üst başlık ·
//              T profil · gövde · alt başlık · geometri) ve sıra RESMİN
//              SIRASIDIR: yukarıdan aşağıya.
//   2. RENK  — her öbeğin bir TON AÇISI vardır ve AYNI ton hem formda hem
//              KESİT ÇİZİMİNDE kullanılır. Formdaki mavi "üst başlık" öbeği
//              ile resimdeki mavi etiket aynı sacı gösterir; göz ikisini
//              renkten eşler.
//   3. ÖRÜNTÜ — etiketler SEMBOLLE BAŞLAR ("t2 · Üst İç Flanş Kalınlığı"),
//              böylece sol kenarda t1/b1/t2/b2… diye taranabilir bir sütun
//              oluşur. Sembol sonda olduğunda her etiketin farklı yerinde
//              duruyor ve göz her seferinde satırın sonuna kadar okuyordu.
//
// RENK İKİ SÖZDİZİMİYLE TUTULUR ama TEK renktir: `hue` OKLCH ton açısıdır ve
// CSS'e gider (doygunluk/parlaklık `globals.css`te, tema başına — evin
// kuralı: "renk bir HEX değil AÇIDIR"), `ink` ise aynı rengin diyagram
// katmanı için sabitlenmiş karşılığıdır. Diyagramlar hem web'e hem PDF'e
// basıldığı için orada CSS değişkeni kullanılamaz.

export type FieldGroupKey =
  | "rail"
  | "topFlange"
  | "tProfile"
  | "web"
  | "bottomFlange"
  | "geometry";

export interface FieldGroup {
  key: FieldGroupKey;
  /** Öbek başlığı (form) */
  title: string;
  /** OKLCH ton açısı — CSS `--oc-hue` */
  hue: number;
  /** Diyagram etiketlerinin rengi — CSS tonunun sabitlenmiş karşılığı */
  ink: string;
}

/**
 * Öbek sırası KESİTİN SIRASIDIR: yukarıdan aşağıya. Ray en üstte, geometri
 * (gövde arası, kenar mesafesi) en sonda çünkü o ikisi bir sac değil bir
 * YERLEŞİM ölçüsüdür.
 */
export const FIELD_GROUP_ORDER: readonly FieldGroupKey[] = [
  "rail",
  "topFlange",
  "tProfile",
  "web",
  "bottomFlange",
  "geometry",
];

export const FIELD_GROUPS: Record<FieldGroupKey, FieldGroup> = {
  rail: { key: "rail", title: "Ray", hue: 25, ink: "#A2542F" },
  topFlange: { key: "topFlange", title: "Üst Başlık", hue: 255, ink: "#3F5BA6" },
  // Yeşil, kullanıcının kendi AutoCAD çiziminde T profili işaretlediği renktir.
  tProfile: { key: "tProfile", title: "Ray Altı T Profil", hue: 150, ink: "#2E7A55" },
  web: { key: "web", title: "Gövde Sacları", hue: 65, ink: "#836A1C" },
  bottomFlange: { key: "bottomFlange", title: "Alt Başlık", hue: 310, ink: "#7C4A8E" },
  geometry: { key: "geometry", title: "Kesit Geometrisi", hue: 200, ink: "#2B6C80" },
};

/** Bir öbeğin diyagram rengi; tanımsız öbekte `undefined` (varsayılan mürekkep). */
export function fieldGroupInk(key: FieldGroupKey | undefined): string | undefined {
  return key ? FIELD_GROUPS[key]?.ink : undefined;
}
