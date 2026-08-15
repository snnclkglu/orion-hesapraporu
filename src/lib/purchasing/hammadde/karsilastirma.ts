// TEKLİF KARŞILAŞTIRMA ÇEKİRDEĞİ — saf.
//
// Kullanıcı kararı (15.08.2026), gösterdiği tabloyla birlikte:
//
//   Tanımı | Miktar-Ağırlık (Kg) | EAG DEMİR (90 Gün) | Teslim | RZK (90 Gün) | …
//   HEA 120 |               360  | 38,00 |  13.680 | 20 Gün | 37,50 | 13.500 | Hazır
//   ────────────────────────────────────────────────────────────────────────────
//   Toplam  |             6.530  |       | 266.240 |        |       | 261.165
//
// *"Hepsinin vadesi, teslim süresi, fiyatı vs farklı oluyor. Biz bunları
// sisteme gireriz teklif aç olarak. Teklifleri inceleyeceğimiz sayfada
// inceleriz. Sonra birine sipariş veririz, ya da bölüp de sipariş de
// verebiliriz."*
//
// ══════════════════════════════════════════════ ÜÇ KARAR
//
// 1. **SÜTUN TEDARİKÇİDİR, TEKLİF DEĞİL.** Aynı firma yirmi kaleme yirmi ayrı
//    teklif satırı yazar; tablo onları TEK SÜTUNDA toplar. Firma başlığı vade
//    ile birlikte yazılır çünkü vade satır satır değil FİRMA BAŞINA konuşulur.
//
// 2. **TUTAR MİKTARLA ÇARPILIR, BİRİM FİYAT DEĞİL.** En ucuz birim fiyat en
//    ucuz teklif değildir: 360 kg'lık bir kalemde 0,50 ₺'lik fark 180 ₺, 3.620
//    kg'lık bir kalemde 1.810 ₺ eder. Karar TOPLAM ÜZERİNDEN verilir.
//
// 3. **EKSİK TEKLİF TOPLAMA GİRMEZ ve bu SÖYLENİR.** Bir firma üç kalemin
//    ikisine fiyat vermişse onun toplamı ötekilerle karşılaştırılamaz;
//    `eksikKalem` sayısı sütunun künyesinde durur. Eksik satırı sıfır saymak,
//    o firmayı sahte bir farkla kazandırırdı.

/** Karşılaştırmaya giren bir talep satırı. */
export interface KarsilastirmaKalemi {
  key: string;
  tanim: string;
  /** Sipariş edilecek miktar (kg · boy · adet) — tutar bununla çarpılır. */
  miktar: number | null;
  birim: string;
}

/** Bir tedarikçinin bir kaleme verdiği fiyat. */
export interface KarsilastirmaTeklifi {
  key: string;
  tedarikci: string;
  /**
   * SÜTUN KİMLİĞİ — verilmezse TEDARİKÇİDİR.
   *
   * Kullanıcı kararı (15.08.2026): *"Teklif Aç Koduna göre satır satır gelsin.
   * Her açtığım teklifi ayrı ayrı değerlendirebileyim."* Aynı firmadan iki
   * hafta arayla alınmış iki teklif AYRI sütunlardır ve tek bir "tedarikçi"
   * sütununda toplanmaları, ikisinden hangisinin geçerli olduğunu ekranda
   * cevapsız bırakıyordu.
   *
   * Alan İSTEĞE BAĞLIDIR: ekipman tarafı hâlâ tedarikçi bazında karşılaştırır
   * ve orada parti kavramı bir şey eklemez.
   */
  sutunKey?: string;
  /** Sütun başlığı — verilmezse tedarikçi adı. */
  etiket?: string;
  /** Birim fiyat, TEKLİFİN KENDİ para biriminde. */
  birimFiyat: number;
  paraBirimi: string;
  /** Avro karşılığı; kur yoksa `null` ve satır yarışa GİRMEZ (md. 21). */
  birimFiyatEur: number | null;
  vadeGun: number;
  /** 0 = Hazır · null = söylenmedi. */
  teslimGun: number | null;
}

export interface KarsilastirmaHucresi {
  birimFiyatEur: number | null;
  tutarEur: number | null;
  teslimGun: number | null;
  /** Bu satırın en ucuzu mu? */
  enUcuz: boolean;
}

export interface KarsilastirmaSutunu {
  /** Sütunun kimliği — `hucreler` haritasının anahtarı. */
  key: string;
  /** Başlıkta yazan ad (parti kipinde `TK0007 · EAG DEMİR`). */
  etiket: string;
  /** SİPARİŞ BU FİRMAYA açılır — etiket değişse de tedarikçi kimliği budur. */
  tedarikci: string;
  /** Firmanın verdiği vade — teklifleri çelişiyorsa EN UZUNU yazılır. */
  vadeGun: number;
  /** Fiyat verdiği kalem sayısı. */
  verdigi: number;
  /** Fiyat VERMEDİĞİ kalem sayısı — toplamın karşılaştırılabilirliği budur. */
  eksikKalem: number;
  /** Yalnız fiyat verdiği kalemlerin toplamı [EUR]. */
  toplamEur: number;
  /** En uzun teslim süresi — sipariş ne zaman tamamlanır. */
  enGecTeslimGun: number | null;
  /** Bütün kalemlere fiyat verdi mi? Yalnız o zaman toplam kıyaslanabilir. */
  tamKapsam: boolean;
}

export interface KarsilastirmaSatiri {
  kalem: KarsilastirmaKalemi;
  /** SÜTUN ANAHTARI → hücre (varsayılan kipte anahtar tedarikçi adıdır). */
  hucreler: Map<string, KarsilastirmaHucresi>;
  /** Bu satırın en ucuzunu veren SÜTUNUN anahtarı; teklif yoksa boş. */
  enUcuzTedarikci: string;
  enUcuzTutarEur: number | null;
}

export interface KarsilastirmaTablosu {
  satirlar: KarsilastirmaSatiri[];
  sutunlar: KarsilastirmaSutunu[];
  /** Her satırın en ucuzunu alırsak toplam — BÖLÜNMÜŞ siparişin bedeli. */
  enIyiBolunmusToplamEur: number;
  /** Tek firmadan alınırsa en ucuz seçenek; tam kapsamlı firma yoksa null. */
  enIyiTekFirma: { tedarikci: string; toplamEur: number } | null;
}

export function karsilastirmaKur(
  kalemler: readonly KarsilastirmaKalemi[],
  teklifler: readonly KarsilastirmaTeklifi[]
): KarsilastirmaTablosu {
  const sutunKimligi = (t: KarsilastirmaTeklifi) => t.sutunKey ?? t.tedarikci;

  /** Sütun anahtarı → künye. Sıra ETİKETE göredir (okunan şey odur). */
  const kunyeler = new Map<string, { key: string; etiket: string; tedarikci: string }>();
  for (const t of teklifler) {
    const key = sutunKimligi(t);
    if (!kunyeler.has(key)) {
      kunyeler.set(key, { key, etiket: t.etiket ?? t.tedarikci, tedarikci: t.tedarikci });
    }
  }
  const sutunKunyeleri = [...kunyeler.values()].sort(
    (a, b) => a.etiket.localeCompare(b.etiket, "tr") || a.key.localeCompare(b.key, "tr")
  );

  /** (kalem, sütun) → EN UCUZ teklif. Aynı sütun birden çok kez girmişse. */
  const enIyi = new Map<string, KarsilastirmaTeklifi>();
  for (const t of teklifler) {
    if (t.birimFiyatEur == null) continue;
    const anahtar = `${t.key}|${sutunKimligi(t)}`;
    const mevcut = enIyi.get(anahtar);
    if (!mevcut || (mevcut.birimFiyatEur ?? Infinity) > t.birimFiyatEur) enIyi.set(anahtar, t);
  }

  const satirlar: KarsilastirmaSatiri[] = kalemler.map((kalem) => {
    const hucreler = new Map<string, KarsilastirmaHucresi>();
    let enUcuzTutar: number | null = null;
    let enUcuzFirma = "";

    for (const k of sutunKunyeleri) {
      const t = enIyi.get(`${kalem.key}|${k.key}`);
      if (!t) continue;
      const tutar =
        kalem.miktar != null && t.birimFiyatEur != null ? kalem.miktar * t.birimFiyatEur : null;
      hucreler.set(k.key, {
        birimFiyatEur: t.birimFiyatEur,
        tutarEur: tutar,
        teslimGun: t.teslimGun,
        enUcuz: false,
      });
      if (tutar != null && (enUcuzTutar == null || tutar < enUcuzTutar)) {
        enUcuzTutar = tutar;
        enUcuzFirma = k.key;
      }
    }
    const kazanan = hucreler.get(enUcuzFirma);
    if (kazanan) kazanan.enUcuz = true;

    return { kalem, hucreler, enUcuzTedarikci: enUcuzFirma, enUcuzTutarEur: enUcuzTutar };
  });

  const sutunlar: KarsilastirmaSutunu[] = sutunKunyeleri.map((k) => {
    let toplam = 0;
    let verdigi = 0;
    let enGec: number | null = null;
    let teslimBilinmeyen = false;
    for (const s of satirlar) {
      const h = s.hucreler.get(k.key);
      if (!h) continue;
      verdigi += 1;
      if (h.tutarEur != null) toplam += h.tutarEur;
      if (h.teslimGun == null) teslimBilinmeyen = true;
      else if (enGec == null || h.teslimGun > enGec) enGec = h.teslimGun;
    }
    // VADE SÜTUN BAŞINADIR ama satırlar çelişebilir; EN UZUNU yazılır —
    // satınalmacı en kötü hâli görmelidir.
    const vade = teklifler
      .filter((t) => sutunKimligi(t) === k.key)
      .reduce((m, t) => Math.max(m, t.vadeGun), 0);
    return {
      key: k.key,
      etiket: k.etiket,
      tedarikci: k.tedarikci,
      vadeGun: vade,
      verdigi,
      eksikKalem: kalemler.length - verdigi,
      toplamEur: Math.round(toplam * 100) / 100,
      // TESLİMİ BİLİNMEYEN VARSA "EN GEÇ" DE BİLİNMEZ: eksik bir sayıyı
      // toplamın tamamı gibi göstermek, bir haftalık gecikmeyi gizlerdi.
      enGecTeslimGun: teslimBilinmeyen ? null : enGec,
      tamKapsam: verdigi === kalemler.length && kalemler.length > 0,
    };
  });

  const enIyiBolunmus = satirlar.reduce((t, s) => t + (s.enUcuzTutarEur ?? 0), 0);
  const tamKapsamlilar = sutunlar.filter((s) => s.tamKapsam);
  const enIyiTek =
    tamKapsamlilar.length > 0
      ? tamKapsamlilar.reduce((a, b) => (b.toplamEur < a.toplamEur ? b : a))
      : null;

  return {
    satirlar,
    sutunlar,
    enIyiBolunmusToplamEur: Math.round(enIyiBolunmus * 100) / 100,
    enIyiTekFirma: enIyiTek
      ? { tedarikci: enIyiTek.tedarikci, toplamEur: enIyiTek.toplamEur }
      : null,
  };
}

/** "Hazır" · "20 Gün" · "—" — teslim süresinin insan okunur hâli. */
export function teslimYazisi(gun: number | null): string {
  if (gun == null) return "—";
  if (gun === 0) return "Hazır";
  return `${gun} Gün`;
}

/** "Peşin" · "90 Gün" — vadenin insan okunur hâli. */
export function vadeYazisi(gun: number): string {
  return gun > 0 ? `${gun} Gün` : "Peşin";
}
