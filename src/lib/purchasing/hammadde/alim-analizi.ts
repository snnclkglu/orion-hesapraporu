// SAC · PROFİL · RAY ALIM ANALİZİ — saf çekirdek.
//
// Kullanıcı kararı (15.08.2026), bir çalışma dosyasıyla birlikte: *"Ben bunları
// exceldeki gibi takip ediyordum. Yani bir analiz sayfası lazım. Önceden sadece
// sipariş toplamını kontrol ediyordum … sonrasında yanına bir analiz sayfası
// yapıp ortalama fiyatların gidişatını da kontrol ediyorum."*
//
// ═══════════════════════════════════════════ ORTALAMA = TOPLAM ÷ KİLO
//
// Kullanıcının kendi dosyasındaki "Birim Fiyat (Ortalama)" sütunu ARİTMETİK
// ORTALAMA DEĞİLDİR, ağırlıklıdır — ölçüldü: 2024 profil satırlarında
// 27.836,6467 € ÷ 38.777,01 kg = 0,7178647 ve dosyanın yazdığı sayı tam olarak
// budur. Aritmetik ortalama 40 kiloluk bir boruyu 12 tonluk bir sac partisiyle
// eşit ağırlıkta sayardı ve "gidişat" grafiği gerçeği anlatmazdı.
//
// Bu yüzden bu dosyada TEK BİR ortalama vardır ve her yerde aynıdır:
//
//     ortalama = Σ tutar ÷ Σ kilo
//
// ═══════════════════════════════════════════ İKİ KAYNAK, TEK SERİ
//
// Analiz iki defteri birleştirir ve ikisi de gereklidir:
//
//   `devralinan` — 2024-03 … 2026-08 arası 447 satırlık çalışma dosyası
//                  (`purchase_raw_purchases`). Geçmiş buradadır.
//   `siparis`    — uygulamanın kendi sipariş satırları. Bugün buradadır.
//
// KAYNAK SATIRDA DURUR ve ekran onu söyler: dışarıdan gelen bir çalışma dosyası
// ile uygulamanın kendi kaydı aynı güvende değildir (fiyat arşivinin kuralı,
// md. 21).
//
// ═══════════════════════════════════════════ YALNIZ KİLO KONUŞUR
//
// Analizin bütün büyüklükleri KİLO BAŞINADIR. Sipariş satırının birimi "Boy"
// ya da "Adet" ise kilosu BİLİNMEZ ve satır analize GİRMEZ — bir boyun kaç kilo
// olduğunu varsaymak, ortalama fiyatı sessizce bozardı. Dışarıda kalan satır
// sayılır ve ekranda yazar (md. 23: "hiçbir sayı uydurulmaz").
//
// ÇEKİRDEK SAFTIR: DB/HTTP/React importu yok.

import { trKatla } from "@/lib/drawings/tr-text";

export type AlimKaynagi = "devralinan" | "siparis";

/** Analize giren TEK bir alım satırı — iki defterin ortak dili. */
export interface AlimSatiri {
  id: string;
  kaynak: AlimKaynagi;
  /** `YYYY-MM-DD`. */
  gun: string;
  tedarikci: string;
  /** SAC · PROFIL · RAY · BORU · DOLU · DIGER */
  kategori: string;
  tanim: string;
  /** `match_key` — teklif, sipariş ve fiyat arşiviyle ORTAK uzay. */
  key: string;
  kalite: string;
  kg: number;
  tutarTry: number | null;
  tutarUsd: number | null;
  tutarEur: number | null;
  /** Sipariş kaynaklı satırda sipariş numarası; devralınanlarda boş. */
  siparisNo?: string;
}

/** Para birimi seçimi — ekran üçünü de gösterebilir. */
export type AlimBirimi = "EUR" | "USD" | "TRY";

export function tutarAl(s: AlimSatiri, birim: AlimBirimi): number | null {
  return birim === "EUR" ? s.tutarEur : birim === "USD" ? s.tutarUsd : s.tutarTry;
}

// ═══════════════════════════════════════════════════════ KATEGORİ ÇÖZÜCÜSÜ

/**
 * SİPARİŞ SATIRININ KATEGORİSİ — STOK ADINDAN.
 *
 * `cozumle.ts`teki `hammaddeCozumle` KULLANILMAZ ve bu bilinçli: o fonksiyon
 * bir KESİM PARÇASININ tanımını okur (`SAC 15x375x1500`) ve üç ölçü bekler.
 * Burada okunan şey bir STOK KALEMİDİR (`SAC 10 MM S355JR`, `UPN 100 S235JR`,
 * `SAC 10 X 1500 X 6000 ST37`) — ölçüsü değil AİLESİ sorulur. Aynı fonksiyona
 * iki sözleşme birden yüklemek, `tanimOlculeri`nin kapsamını genişletmek gibi
 * sessiz bir hata olurdu (md. 24).
 *
 * Sıra bir ÖNCELİKTİR: `RAY` önce sorulur çünkü "RAY A65" içinde başka hiçbir
 * anahtar geçmez; `SAC` en sonda değil ortada durur çünkü "DELİKLİ SAC" ve
 * "BAKLAVA DESENLİ SAC" da sactır.
 */
const KATEGORI_KALIPLARI: { kategori: string; re: RegExp }[] = [
  { kategori: "RAY", re: /(^|\s)RAY(\s|$)/ },
  { kategori: "BORU", re: /(^|\s)BORU(\s|$)/ },
  { kategori: "DOLU", re: /(^|\s)(DOLU|MIL|CUBUK)(\s|$)/ },
  { kategori: "SAC", re: /(^|\s)(SAC|LEVHA|PLAKA)(\s|$)/ },
  {
    kategori: "PROFIL",
    re: /(^|\s)(PROFIL|UPN|IPN|NPU|NPI|NPL|NPB|IPE|HEA|HEB|HEM|HE|UAP|LAMA|SILME|KOSEBENT|KUTU|KARE|DIKDORTGEN|L)(\s|$)/,
  },
];

export function alimKategorisi(tanim: string): string {
  const t = trKatla(tanim ?? "").replace(/[^A-Z0-9ØX.,/\- ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "DIGER";
  for (const k of KATEGORI_KALIPLARI) {
    if (k.re.test(t)) return k.kategori;
  }
  return "DIGER";
}

// ═══════════════════════════════════════════════════════ ÖZETLER

export interface AlimToplami {
  kg: number;
  tutar: number;
  /** Ağırlıklı ortalama birim fiyat [para/kg]; kilo yoksa null. */
  ortalama: number | null;
  satir: number;
}

function topla(satirlar: readonly AlimSatiri[], birim: AlimBirimi): AlimToplami {
  let kg = 0;
  let tutar = 0;
  let satir = 0;
  for (const s of satirlar) {
    const t = tutarAl(s, birim);
    // TUTARI OLMAYAN SATIR ORTALAMAYA GİRMEZ ve kilosu da SAYILMAZ: kilonun
    // paya girip tutarın girmemesi ortalamayı olduğundan düşük gösterirdi.
    if (t == null) continue;
    kg += s.kg;
    tutar += t;
    satir += 1;
  }
  return {
    kg: Math.round(kg * 1000) / 1000,
    tutar: Math.round(tutar * 100) / 100,
    ortalama: kg > 0 ? tutar / kg : null,
    satir,
  };
}

export function alimToplami(satirlar: readonly AlimSatiri[], birim: AlimBirimi): AlimToplami {
  return topla(satirlar, birim);
}

export interface YilKategoriSatiri {
  yil: string;
  kategori: string;
  toplam: AlimToplami;
}

/**
 * YIL × KATEGORİ MATRİSİ — kullanıcının Özet sayfasının birebir karşılığı.
 *
 * Sıra yıl ARTAN, kategori ise sabit sözlük sırasıdır: kullanıcının dosyasında
 * da öyle ve iki belge yan yana konup karşılaştırılıyor.
 */
export function yilKategoriMatrisi(
  satirlar: readonly AlimSatiri[],
  birim: AlimBirimi
): YilKategoriSatiri[] {
  const gruplar = new Map<string, AlimSatiri[]>();
  for (const s of satirlar) {
    const yil = s.gun.slice(0, 4);
    const anahtar = `${yil}|${s.kategori}`;
    const liste = gruplar.get(anahtar);
    if (liste) liste.push(s);
    else gruplar.set(anahtar, [s]);
  }
  return [...gruplar.entries()]
    .map(([anahtar, liste]) => {
      const [yil, kategori] = anahtar.split("|");
      return { yil, kategori, toplam: topla(liste, birim) };
    })
    .sort(
      (a, b) =>
        a.yil.localeCompare(b.yil) || kategoriSirasi(a.kategori) - kategoriSirasi(b.kategori)
    );
}

const KATEGORI_SIRASI = ["SAC", "PROFIL", "RAY", "BORU", "DOLU", "DIGER"];
export function kategoriSirasi(k: string): number {
  const i = KATEGORI_SIRASI.indexOf(k);
  return i < 0 ? KATEGORI_SIRASI.length : i;
}

export interface AylikNokta {
  /** `YYYY-MM`. */
  ay: string;
  kg: number;
  tutar: number;
  /** Ağırlıklı ortalama; o ay alım yoksa null (SIFIR DEĞİL). */
  ortalama: number | null;
}

/**
 * AYLIK SERİ — SEYREK DEĞİL YOĞUN.
 *
 * Alım yapılmayan ay dizide DURUR ama değeri `null`dur: sıfır yazmak "o ay
 * bedava aldık" demek olurdu ve eğri tabana çakılırdı. Boş ayı hiç yazmamak da
 * yanlıştır — zaman ekseni sıkışır ve iki yıl arası fark görünmez olur
 * (`consumables.ts`in dense serisinin aynı dersi).
 */
export function aylikSeri(satirlar: readonly AlimSatiri[], birim: AlimBirimi): AylikNokta[] {
  if (satirlar.length === 0) return [];
  const gunler = satirlar.map((s) => s.gun).sort();
  const bas = gunler[0].slice(0, 7);
  const son = gunler[gunler.length - 1].slice(0, 7);

  const kova = new Map<string, { kg: number; tutar: number }>();
  for (const s of satirlar) {
    const t = tutarAl(s, birim);
    if (t == null) continue;
    const ay = s.gun.slice(0, 7);
    const k = kova.get(ay);
    if (k) {
      k.kg += s.kg;
      k.tutar += t;
    } else {
      kova.set(ay, { kg: s.kg, tutar: t });
    }
  }

  const cikti: AylikNokta[] = [];
  let [yil, ayNo] = bas.split("-").map(Number);
  const [sonYil, sonAy] = son.split("-").map(Number);
  // Güvenlik kelepçesi: bozuk bir tarih sonsuz döngü üretmesin.
  for (let i = 0; i < 600; i++) {
    const ay = `${yil}-${String(ayNo).padStart(2, "0")}`;
    const k = kova.get(ay);
    cikti.push({
      ay,
      kg: k ? Math.round(k.kg * 1000) / 1000 : 0,
      tutar: k ? Math.round(k.tutar * 100) / 100 : 0,
      ortalama: k && k.kg > 0 ? k.tutar / k.kg : null,
    });
    if (yil === sonYil && ayNo === sonAy) break;
    ayNo += 1;
    if (ayNo > 12) {
      ayNo = 1;
      yil += 1;
    }
  }
  return cikti;
}

export interface KalemOzeti {
  key: string;
  tanim: string;
  kategori: string;
  toplam: AlimToplami;
  /** İlk ve son alımın birim fiyatı — "gidişat" tek satırda budur. */
  ilkGun: string;
  ilkBirim: number | null;
  sonGun: string;
  sonBirim: number | null;
  /** Son ÷ ilk − 1; iki uçtan biri yoksa null. */
  degisimOran: number | null;
  /** En ucuz ve en pahalı alım — pazarlık payı buradan okunur. */
  enUcuzBirim: number | null;
  enPahaliBirim: number | null;
  tedarikciSayisi: number;
}

/**
 * KALEM ÖZETİ — "bu malzemenin kilosu nereden nereye geldi".
 *
 * DEĞİŞİM İKİ UÇTAN OKUNUR, eğri uydurulmaz: aradaki dalgalanma grafiğin işi.
 * Tek alımı olan kalemde değişim `null`dur ve ekran tire basar — %0 yazmak
 * "fiyat sabit kaldı" derdi ve bu bir ölçüm değil bir yokluktur.
 */
export function kalemOzetleri(
  satirlar: readonly AlimSatiri[],
  birim: AlimBirimi
): KalemOzeti[] {
  const gruplar = new Map<string, AlimSatiri[]>();
  for (const s of satirlar) {
    const liste = gruplar.get(s.key);
    if (liste) liste.push(s);
    else gruplar.set(s.key, [s]);
  }

  return [...gruplar.values()]
    .map((liste) => {
      const sirali = [...liste].sort((a, b) => a.gun.localeCompare(b.gun));
      const birimFiyat = (s: AlimSatiri): number | null => {
        const t = tutarAl(s, birim);
        return t != null && s.kg > 0 ? t / s.kg : null;
      };
      const fiyatlar = sirali.map(birimFiyat).filter((v): v is number => v != null);
      const ilk = birimFiyat(sirali[0]);
      const sonSatir = sirali[sirali.length - 1];
      const son = birimFiyat(sonSatir);
      return {
        key: sirali[0].key,
        tanim: sirali[0].tanim,
        kategori: sirali[0].kategori,
        toplam: topla(sirali, birim),
        ilkGun: sirali[0].gun,
        ilkBirim: ilk,
        sonGun: sonSatir.gun,
        sonBirim: son,
        degisimOran: ilk != null && son != null && ilk > 0 && sirali.length > 1 ? son / ilk - 1 : null,
        enUcuzBirim: fiyatlar.length > 0 ? Math.min(...fiyatlar) : null,
        enPahaliBirim: fiyatlar.length > 0 ? Math.max(...fiyatlar) : null,
        tedarikciSayisi: new Set(sirali.map((s) => s.tedarikci)).size,
      };
    })
    .sort((a, b) => b.toplam.tutar - a.toplam.tutar);
}

export interface TedarikciOzeti {
  tedarikci: string;
  toplam: AlimToplami;
  kalemSayisi: number;
  ilkGun: string;
  sonGun: string;
}

export function tedarikciOzetleri(
  satirlar: readonly AlimSatiri[],
  birim: AlimBirimi
): TedarikciOzeti[] {
  const gruplar = new Map<string, AlimSatiri[]>();
  for (const s of satirlar) {
    const liste = gruplar.get(s.tedarikci);
    if (liste) liste.push(s);
    else gruplar.set(s.tedarikci, [s]);
  }
  return [...gruplar.entries()]
    .map(([tedarikci, liste]) => {
      const gunler = liste.map((s) => s.gun).sort();
      return {
        tedarikci,
        toplam: topla(liste, birim),
        kalemSayisi: new Set(liste.map((s) => s.key)).size,
        ilkGun: gunler[0],
        sonGun: gunler[gunler.length - 1],
      };
    })
    .sort((a, b) => b.toplam.tutar - a.toplam.tutar);
}

/**
 * AYLIK ORTALAMA SATIN ALIM — kullanıcının Özet sayfasındaki son kutu.
 *
 * Dosyada "İmalat Başlangıç Tarihi → Geçen Süre (Ay) → Aylık Ortalama Satın
 * Alım" olarak duruyor. Payda GERÇEKTEN GEÇEN AYDIR (ilk alımdan son alıma),
 * takvim yılı değil: firma nisan 2024'te başladı ve 2024'ü on iki aya bölmek
 * aylık ortalamayı üçte bir düşük gösterirdi.
 */
export function aylikOrtalamaKg(satirlar: readonly AlimSatiri[]): {
  ilkGun: string;
  sonGun: string;
  gun: number;
  ay: number;
  kgAylik: number;
} | null {
  if (satirlar.length === 0) return null;
  const gunler = satirlar.map((s) => s.gun).sort();
  const ilk = gunler[0];
  const son = gunler[gunler.length - 1];
  const fark = (Date.parse(`${son}T00:00:00Z`) - Date.parse(`${ilk}T00:00:00Z`)) / 86_400_000;
  const gun = Math.max(1, Math.round(fark));
  const ay = gun / 30;
  const kg = satirlar.reduce((t, s) => t + s.kg, 0);
  return { ilkGun: ilk, sonGun: son, gun, ay, kgAylik: kg / ay };
}
