// TEKLİF PDF'İNİN İKİ SÜTUNLU TEKNİK YERLEŞİMİ — saf çekirdek (DB/HTTP/React yok).
//
// Kullanıcı isteği (18.08.2026, md. 8): teknik sayfa iki sütuna geçer. Bir
// vincin teknik özellikleri altı öbek ve yetmişe yakın satırdır; tek sütunda
// bu iki A4 yaprak eder ve müşteri aynı vincin elektrik satırlarını çelik yapı
// satırlarından bir yaprak öteye çevirerek okur. `Etiket : Değer` satırı
// içerik alanının yarısını bile doldurmuyordu — sağ yarı boş kalıyordu.
//
// DAĞITIM BURADA, ÇİZİM `pdf/offer.tsx`TE. @react-pdf'in kendi kırma motoru
// SAYFA kırar, SÜTUN kırmaz: iki `View`in yan yana durması, birincisi dolunca
// içeriğin ikincisine akmasını sağlamaz. Akışın nereye gideceği bu yüzden
// çizimden ÖNCE karara bağlanır ve karar bir VERİDİR (`OfferPdfSayfa`) —
// çizerken verilen bir karar sınanamazdı, bu dosyanın kararları donmuş
// testlerle korunur.

import { offerScopeSuffix } from "./types";
import { offerGroupShort } from "./registry";
import type { OfferGroup, OfferRow } from "./types";

// ————————————————————————————————————————————————————————————— ölçüler
//
// ÖLÇÜLER `pdf/brand.tsx`İN GERÇEĞİDİR, tahmin değil; ama oradan İÇE
// AKTARILAMAZ (o dosya React ve @react-pdf taşır, bu çekirdek taşımaz).
// Bu yüzden sayı kopyalanmaz, ARİTMETİĞİ tekrarlanır: marj değişirse buradaki
// türetme de yanlış cevap verir ve `__tests__/pdf-layout.test.ts`teki donmuş
// genişlik düşer. Kopyalanmış tek bir "487,56" sessizce eskirdi.

const A4_GENISLIK = 595.28;
const mm = (n: number) => (n * 72) / 25.4;

/** `BrandPage` içerik alanı: A4 − (omurga 8 + iç marj 14) − dış marj 16. */
const ICERIK_GENISLIK = A4_GENISLIK - mm(8 + 14) - mm(16);

/**
 * İKİ SÜTUN ARASI BOŞLUK.
 *
 * 18pt, satır punto'sunun (8) iki katından biraz fazladır: göz bir satırın
 * nerede bittiğini boşluğun genişliğinden anlar. Daha dar bir oluk iki sütunu
 * tek bir geniş satır gibi okutur, daha genişi sütunları gereksiz daraltırdı.
 */
export const SUTUN_BOSLUK = 18;

export const SUTUN_GENISLIK = (ICERIK_GENISLIK - SUTUN_BOSLUK) / 2;

/** Teknik satırın puntosu (`S.satir` ailesiyle aynı). */
export const SATIR_PUNTO = 8;

/** Bir metin satırının kapladığı dikey yer. */
const SATIR_YUK = 10;

/** `S.satir` paddingVertical 1,6 — üstte ve altta. */
const SATIR_PAY = 3.2;

/**
 * Grup başlığının bloğa getirdiği yük: punto 8,8 + üst 9 + alt 3 pay.
 *
 * Bloğun İÇİNDEDİR, sütunun değil: başlık bir bloğun ilk satırıdır ve blok
 * nereye giderse başlık da oraya gider. Ayrı sayılsaydı bölünmüş bir dilimin
 * tekrar basılan başlığı hiçbir bütçeden düşmezdi.
 */
export const BASLIK_YUK = 21.8;

/**
 * Archivo'nun ORTALAMA karakter genişliği — punto başına.
 *
 * Etiket ile değer için AYRI katsayı vardır çünkü ikisi aynı metin değildir:
 * etiketler cümle düzeninde ("Kaldırma Kapasiteleri (Q)"), değerler ise büyük
 * harf ve rakam ağırlıklıdır ("SCHNEIDER ATV-340", "Ø16 6x36") ve büyük harf
 * Archivo'da belirgin biçimde geniştir. Tek katsayı kullanılsaydı ya etiket
 * fazla ölçülür ya değer eksik ölçülürdü.
 */
const ETIKET_KATSAYI = 0.46;
const DEGER_KATSAYI = 0.52;

/** Etiket ile değer arasındaki boşluk (`S.ikiNokta` sütunu dahil). */
const ARA = 8;

/**
 * SÜTUN BÜTÇESİ %94'E KELEPÇELENİR ve katsayılar BİLEREK FAZLA ölçer.
 *
 * Ortalama karakter genişliğiyle yapılan her ölçüm yaklaşıktır; soru
 * yanılmanın YÖNÜDÜR. Fazla ölçmek sütunu erken kapatır: dipte bir parmak
 * boşluk kalır, belge okunur durur. Eksik ölçmek satırı sayfa dışına taşırır:
 * @react-pdf taşan içeriği kırpar ve müşteriye giden belgeden bir teknik satır
 * SESSİZCE düşer. İki hata eşit değildir, bu yüzden yön seçilmiştir.
 */
export const KAPASITE_PAYI = 0.94;

/**
 * BİR BLOK, ALTINDA EN AZ İKİ SATIR SIĞMAYAN KONUMA YERLEŞTİRİLMEZ.
 *
 * Sütun dibinde yalnız başlık ve tek bir satır bırakmak, öbeği ikiye böldüğünü
 * söylemeden bölmektir: okuyucu "KÖPRÜ GRUBU" başlığının altında bir satır
 * görür ve grubun bir satırdan ibaret olduğunu sanır. `pdf/offer.tsx`in
 * bugünkü `minPresenceAhead={46}` kuralının sütun karşılığıdır.
 */
const EN_AZ_KUYRUK = 2;

/**
 * Bölünen grubun sonraki diliminde başlığa eklenen kuyruk.
 *
 * Başlık dilimde TEKRAR basılır — fiyat tablosunun `fixed` başlık satırıyla
 * aynı ilke: ikinci sütunda hangi öbeğin okunduğu hatırlanmak zorunda değildir.
 */
export const DEVAM_EKI = " (devamı)";

// ————————————————————————————————————————————————————————————— tipler

/**
 * Bir sütuna yerleşen parça: bir grup ya da bölünmüş bir grubun DİLİMİ.
 *
 * `group` bölünse de DEĞİŞMEZ (kimliği, anahtarı ve başlığı aslındandır);
 * dilime ait olan `rows`tur. Dilim için kopya bir grup üretilseydi çizim
 * tarafında iki dilim iki ayrı grup gibi görünür, `id` ile kurulan bağ kopardı.
 */
export interface OfferPdfBlok {
  group: OfferGroup;
  rows: OfferRow[];
  /** Bu dilim bir öncekinin devamı — başlığı `DEVAM_EKI` ile basılır. */
  devam: boolean;
  /** Bloğun ölçülen yüksekliği (başlık dahil). */
  h: number;
}

export interface OfferPdfSayfa {
  sol: OfferPdfBlok[];
  sag: OfferPdfBlok[];
  /** Sayfadaki grupların adları — sırayla ve yinelenmeden. */
  basliklar: string[];
}

// ————————————————————————————————————————————————————————————— ölçme

/** Belgeye gerçekten giren satırlar. Çağıran `printedPayload`dan geçirir;
 *  bu süzgeç ikinci bir gizleme KURALI değil, bir savunmadır. */
function gorunurSatirlar(group: OfferGroup): OfferRow[] {
  return (group.rows ?? []).filter((r): r is OfferRow => Boolean(r) && !r.hidden);
}

/**
 * Satırın kapladığı dikey yer.
 *
 * KAPSAM EKİ DEĞERİN UZUNLUĞUNA GİRER: " (Müşteri Kapsamında)" yirmi bir
 * karakterdir ve tek başına bir satırı sarmaya yeter (`Hol Boyu Elektrik :
 * Kapalı Kutu Bara Tesisatı` eksiz tek satır, ekli iki satırdır). Ek daha
 * küçük punto ile basılır ama ölçüde küçültülmez — fazla ölçmek seçilmiş
 * yöndür (bkz. `KAPASITE_PAYI`).
 */
export function satirYuksekligi(row: OfferRow): number {
  const etiket = (row.label ?? "").length * ETIKET_KATSAYI * SATIR_PUNTO;
  const deger = ((row.value ?? "") + offerScopeSuffix(row.scope)).length * DEGER_KATSAYI * SATIR_PUNTO;
  const gereken = etiket + ARA + deger;
  const satirSayisi = Math.max(1, Math.ceil(gereken / SUTUN_GENISLIK));
  return satirSayisi * SATIR_YUK + SATIR_PAY;
}

/**
 * Grubun tam yüksekliği. BASILMAYAN GRUP SIFIRDIR: gizli ya da satırsız bir
 * öbek belgede başlığını da bırakmaz, dolayısıyla bütçeden de yer yemez.
 */
export function grupYuksekligi(g: OfferGroup): number {
  if (g.hidden) return 0;
  const satirlar = gorunurSatirlar(g);
  if (satirlar.length === 0) return 0;
  return BASLIK_YUK + satirlar.reduce((t, r) => t + satirYuksekligi(r), 0);
}

/** Bloğun BASILAN başlığı — devam dilimi kendini böyle tanıtır. */
export function blokBasligi(blok: OfferPdfBlok): string {
  return blok.devam ? `${blok.group.title}${DEVAM_EKI}` : blok.group.title;
}

// ————————————————————————————————————————————————————————————— bölme

interface Dilim {
  blok: OfferPdfBlok;
  kalan: OfferRow[];
}

/**
 * Grubun kalan satırlarından `alan` kadarına sığanı keser.
 *
 * `null` = BURAYA KONMAZ (çağıran sütunu kapatır). `zorla`, sütun bomboşken
 * verilir ve İLERLEMEYİ GARANTİ EDER: tek satırı bile boş bir sütuna sığmayan
 * patolojik bir blok reddedilmeye devam etseydi döngü sonsuza girerdi. Böyle
 * bir blok taşarak da olsa basılır — sonsuz döngü sessiz bir kilittir, taşma
 * ise gözle görülür.
 */
function blokBol(
  group: OfferGroup,
  rows: readonly OfferRow[],
  devam: boolean,
  alan: number,
  zorla: boolean
): Dilim | null {
  const yuk = rows.map(satirYuksekligi);
  const tam = BASLIK_YUK + yuk.reduce((t, h) => t + h, 0);
  if (tam <= alan) {
    return { blok: { group, rows: [...rows], devam, h: tam }, kalan: [] };
  }

  let n = 0;
  let h = BASLIK_YUK;
  while (n < rows.length && h + yuk[n] <= alan) {
    h += yuk[n];
    n += 1;
  }

  // Tek satırlık bir grup için "en az iki satır" istenemez; kural grubun
  // gerçek boyuna göre okunur.
  const enAz = Math.min(EN_AZ_KUYRUK, rows.length);
  if (n < enAz) {
    if (!zorla) return null;
    n = Math.max(1, n);
    h = BASLIK_YUK + yuk.slice(0, n).reduce((t, x) => t + x, 0);
  }

  // ARTAN TEK SATIR BIRAKILMAZ. Sonraki sütuna yalnız bir satır geçerse orada
  // "… (devamı)" başlığının altında tek satır durur — kaçınmak için burada
  // bıraktığımız kuralın aynısının ötekine düşmüş hâli. Bir satır aşağı
  // itilerek devam dilimi de en az iki satırla açılır.
  if (rows.length - n === 1 && n - 1 >= enAz) {
    n -= 1;
    h -= yuk[n];
  }

  return { blok: { group, rows: rows.slice(0, n), devam, h }, kalan: rows.slice(n) };
}

// ————————————————————————————————————————————————————————————— dağıtım

/**
 * Grupları sütunlara ve sayfalara dağıtır.
 *
 * `sutunKapasite` bir sütunun HAM dikey bütçesidir (teknik sayfada: içerik
 * yüksekliği eksi kalem başlığı bloğu); kelepçe burada uygulanır ki çağıran
 * payı da hatırlamak zorunda kalmasın.
 *
 * SIRA KORUNUR, DENGE ARANMAZ. Bloklar sırayla önce sol sütunu doldurur, sol
 * dolunca sağa, sağ dolunca yeni sayfaya geçer. Serbest dengeleme (bin
 * packing) KASITLI OLARAK YAPILMAZ: defterdeki sıra belgenin sırasıdır
 * (`registry.ts` — genel özelliklerden başlanır, tahrik grupları izler, çelik
 * yapı ve elektrik sona kalır) ve bu düzen on dört teklifin on dördünde
 * aynıdır. Sütunları eşitlemek için "ELEKTRİK SİSTEMİ"ni sola, "GENEL
 * ÖZELLİKLER"i sağa almak sayfayı düzgün ama belgeyi YANLIŞ yapardı; müşteri
 * teknik sayfayı yukarıdan aşağıya, soldan sağa okur.
 */
export function offerPdfSayfalari(
  groups: readonly OfferGroup[],
  sutunKapasite: number
): OfferPdfSayfa[] {
  const kapasite = Number.isFinite(sutunKapasite) ? sutunKapasite * KAPASITE_PAYI : 0;
  if (kapasite <= 0) return [];

  const sayfalar: OfferPdfSayfa[] = [];
  let sagda = false;
  let kalan = kapasite;

  const sonSayfa = (): OfferPdfSayfa => {
    const s = sayfalar[sayfalar.length - 1];
    if (s) return s;
    const yeni: OfferPdfSayfa = { sol: [], sag: [], basliklar: [] };
    sayfalar.push(yeni);
    return yeni;
  };

  const sutunuKapat = () => {
    if (sayfalar.length === 0 || sagda) {
      sayfalar.push({ sol: [], sag: [], basliklar: [] });
      sagda = false;
    } else {
      sagda = true;
    }
    kalan = kapasite;
  };

  for (const group of groups) {
    if (!group || group.hidden) continue;
    let bekleyen: OfferRow[] = gorunurSatirlar(group);
    if (bekleyen.length === 0) continue;
    let devam = false;

    while (bekleyen.length > 0) {
      // Sütuna henüz hiçbir blok girmediyse reddetmek anlamsızdır: bir sonraki
      // sütun da aynı boyda olacaktır.
      const bosSutun = kalan >= kapasite;
      const dilim = blokBol(group, bekleyen, devam, kalan, bosSutun);
      if (dilim === null) {
        sutunuKapat();
        continue;
      }

      const sayfa = sonSayfa();
      (sagda ? sayfa.sag : sayfa.sol).push(dilim.blok);
      // BAŞLIK LİSTESİ SAYFANINDIR: sayfada görünen öbeklerin adlarını sırayla
      // taşır. Aynı grubun ikinci dilimi aynı sayfadaysa ad İKİNCİ KEZ girmez —
      // liste bir dizin, bir blok sayacı değildir.
      // BAŞLIK KISA ADDIR ("GENEL · KALDIRMA · ARABA"). Tam başlıkları dizmek
      // altı gruplu bir sayfada üç satırlık bir başlık üretiyordu — başlık
      // olmaktan çıkıyordu. Kısa ad defterdedir (`OFFER_GROUP_SHORT`).
      const kisa = offerGroupShort(group.key, group.title);
      if (!sayfa.basliklar.includes(kisa)) sayfa.basliklar.push(kisa);
      kalan -= dilim.blok.h;
      bekleyen = dilim.kalan;
      devam = true;
    }
  }

  return sayfalar;
}
