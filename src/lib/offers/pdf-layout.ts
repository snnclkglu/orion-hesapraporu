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

/**
 * TEK SÜTUN — İÇERİK ALANININ TAMAMI.
 *
 * Kullanıcı bildirimi (01.09.2026): kısa bir teknik gövde (bir yer vincinin
 * otuz küsur satırı) sol sütunu baştan sona doldurur, sağ yarı BOMBOŞ kalır.
 * Yaprağın yarısını beyaz bırakan bir belge, iki sütunun çözdüğü sorunun tam
 * tersini üretir. Gövde bir yaprağa TEK SÜTUNLA sığıyorsa sayfa genişliğinin
 * tamamı kullanılır; sığmıyorsa iki sütun kuralı yerinde durur (`offerPdfSayfalari`).
 *
 * ÖLÇÜ AYNI ÇEKİRDEKTEN OKUNUR: `satirYuksekligi` genişliği parametre alır,
 * çünkü geniş sütunda daha az satır sarar — dar sütunun ölçüsüyle karar
 * vermek tek yapraklık bir gövdeyi iki yaprak sanmaya yol açardı.
 */
export const TAM_GENISLIK = ICERIK_GENISLIK;

/** Teknik satırın ETİKET puntosu (`S.ozellikEtiket`). */
export const SATIR_PUNTO = 7.8;

/** DEĞER puntosu — değer mono dizilir (`S.ozellikDeger`). */
export const DEGER_PUNTO = 7.4;

/** Bir metin satırının kapladığı dikey yer (satır yüksekliği × punto ≈ 10). */
const SATIR_YUK = 10;

/**
 * Satırın metin dışı yükü: `S.ozellikSatiri`in 1,4 üst + 1,4 alt payı ve
 * altındaki 0,4 pt'lik AYIRICI ÇİZGİ. Çizgi satırın parçasıdır; ölçüye
 * girmeseydi yirmi satırlık bir öbekte 8 pt'lik bir sapma birikirdi.
 */
const SATIR_PAY = 3.2;

/**
 * Bloğun satır dışı yükü: ŞERİT + BÖLÜM ADI + bloklar arası boşluk.
 *
 * 1,2 (şerit) + 4 (şerit altı pay) + 7,92 (6,6 punto × 1,2 satır) + 4,5
 * (ad altı pay) + 10 (bir sonraki bloğa boşluk) = 27,6.
 *
 * BLOKLAR ARASI BOŞLUK DA BURADADIR. Ayrı tutulsaydı ölçü her blokta 10 pt
 * eksik kalırdı: sütuna dört blok giren bir sayfada 40 pt'lik bir sapma eder
 * ve eksik ölçmek modülün adını koyarak reddettiği yöndür (bkz.
 * `KAPASITE_PAYI`). Son bloğun kuyruğundaki boşluk sütun dibinde durur, kimseyi
 * incitmez.
 *
 * Bloğun İÇİNDEDİR, sütunun değil: başlık bir bloğun ilk satırıdır ve blok
 * nereye giderse başlık da oraya gider. Ayrı sayılsaydı bölünmüş bir dilimin
 * tekrar basılan başlığı hiçbir bütçeden düşmezdi.
 */
export const BASLIK_YUK = 27.6;

/**
 * KARAKTER GENİŞLİĞİ — punto başına.
 *
 * İki katsayı vardır çünkü iki metin iki ayrı ailede dizilir. ETİKET Archivo
 * iledir ve BÜYÜK HARF dizilir (kullanıcı isteği 19.08.2026, md. 18); 0,62
 * ölçülmüş bir ORTALAMADIR, yani yaklaşıktır. DEĞER ise IBM Plex Mono iledir
 * ve mono SABİT genişliktedir: her karakter tam 0,6 em'dir. Değerin genişliği
 * bu yüzden tahmin değil HESAPTIR — ve sütunda sarıp sarmayacağına karar veren
 * de odur.
 *
 * KATSAYI 0,46'DAN 0,62'YE ÇIKTI ÇÜNKÜ ETİKET BÜYÜDÜ. Archivo'da büyük harf
 * küçüğünden belirgin geniştir (fontkit ile on gerçek etiket ölçüldü: karışık
 * yazımda 0,482, büyük harfte 0,618; "Motor" +%42, "Redüktör" +%36). Eski
 * katsayı bırakılsaydı modül etiketi %28 dar sanardı ve iki ayrı yerden EKSİK
 * ölçerdi: kelepçeye çarpıp SARAN etiket tek satır sayılır, değere kalan alan
 * olduğundan geniş çıkardı. Eksik ölçmek modülün adını koyarak reddettiği
 * yöndür (bkz. `KAPASITE_PAYI`) — @react-pdf taşan satırı sessizce kırpar.
 */
const ETIKET_KATSAYI = 0.62;
const DEGER_KATSAYI = 0.6;

/** Etiket ile değer sütunu arasındaki oluk (`S.ozellikDeger` marginLeft). */
export const ETIKET_ARA = 10;

/**
 * ETİKET SABİT OLARAK SÜTUNUN %34'ÜDÜR.
 *
 * Kullanıcı bildirimi (20.08.2026): değerin başlangıcı etiketin boyuna göre
 * değişince satırlar iç içe okunuyor ve uzun metin öngörülemez yerde sarıyordu.
 * Sabit etiket sütunu değere her satırda aynı genişliği verir; uzun değer
 * ikinci satıra kendi sütununda iner. Sayı çizimde (`width`) ve ölçüde
 * AYNIDIR — ayrışırsa ölçü ile kâğıt ayrışır.
 */
export const ETIKET_ORAN = 0.34;

/**
 * TAM GENİŞLİKTE ETİKET ORANI — %40.
 *
 * Oran DAR sütunun oranı değildir çünkü sorun da aynı değildir. 234,78 pt'lik
 * sütunda darlık DEĞERİ sardırır, o yüzden etikete az yer verilir; 487,56
 * pt'lik tek sütunda değer neredeyse hiç sarmaz ve sarma tek başına ETİKETE
 * kalır. %34 (166 pt) bırakılsaydı "KUMANDA PANELİNDE ACİL DURDURMA BUTONU"
 * gibi kırk karakterlik etiketler geniş sayfada da ikiye bölünür, satır
 * boşuna büyürdü. %40 (195 pt) o etiketleri tek satıra indirir ve değere
 * hâlâ 282 pt bırakır — defterdeki en uzun değerin iki katı.
 */
export const TAM_ETIKET_ORAN = 0.4;

/**
 * ETİKET SÜTUNUNUN GENİŞLİĞİ — ÖLÇÜ İLE ÇİZİMİN TEK KAYNAĞI.
 *
 * `pdf/offer.tsx` bu fonksiyonu `width` için, bu dosya sarma hesabı için
 * çağırır. Sayı iki yerde ayrı yazılsaydı biri değişip öteki kalabilirdi ve
 * ayrışmanın bedeli sessizdir: ölçü satırı bir, kâğıt iki satır çizer.
 */
export function etiketGenisligi(genislik: number): number {
  return genislik * (genislik >= TAM_GENISLIK ? TAM_ETIKET_ORAN : ETIKET_ORAN);
}

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
  /**
   * TEK SÜTUN, SAYFA GENİŞLİĞİNCE (`TAM_GENISLIK`).
   *
   * Yalnız bütün gövdenin bir yaprağa tek sütunla sığdığı belgelerde açılır ve
   * o belge TEK SAYFADIR; `sag` bu durumda hep boştur. Bayrak bir çizim tercihi
   * değil ÖLÇÜNÜN SONUCUDUR: blokların `h` değerleri de tam genişliğe göre
   * ölçülmüştür, çizim başka bir genişlik kullanırsa ölçü ile kâğıt ayrışır.
   */
  tam: boolean;
}

// ————————————————————————————————————————————————————————————— ölçme

/** Belgeye gerçekten giren satırlar. Çağıran `printedPayload`dan geçirir;
 *  bu süzgeç ikinci bir gizleme KURALI değil, bir savunmadır. */
function gorunurSatirlar(group: OfferGroup): OfferRow[] {
  return (group.rows ?? []).filter((r): r is OfferRow => Boolean(r) && !r.hidden);
}

/**
 * Satırın kapladığı dikey yer — İKİ SÜTUNLU model.
 *
 * ÖLÇÜ ÇİZİMİN MODELİDİR. Satır iki sabit kutudur: etiket solda,
 * değer sağda. Değer sardığında ikinci satır etiketin altına TAŞMAZ, kendi
 * sütununda kalır — ölçü de bu yüzden değeri sütunun tamamına değil
 * `SUTUN_GENISLIK − sabit etiket − oluk` genişliğine sarar. Eski akış modeli
 * (etiket ve değer tek akışta) sarma noktasını olduğundan geç hesaplıyordu ve
 * eksik ölçmek, @react-pdf'in taşan satırı SESSİZCE kırpması demektir.
 *
 * KAPSAM EKİ DEĞERİN UZUNLUĞUNA GİRER: " (Müşteri Kapsamında)" yirmi bir
 * karakterdir ve tek başına bir satırı sarmaya yeter. Ek daha küçük punto ile
 * basılır ama ölçüde küçültülmez — fazla ölçmek seçilmiş yöndür (bkz.
 * `KAPASITE_PAYI`).
 */
export function satirYuksekligi(row: OfferRow, genislik: number = SUTUN_GENISLIK): number {
  const etiketTam = (row.label ?? "").length * ETIKET_KATSAYI * SATIR_PUNTO;
  const etiketEn = etiketGenisligi(genislik);
  const etiketSatir = etiketEn > 0 ? Math.max(1, Math.ceil(etiketTam / etiketEn)) : 1;

  const alan = Math.max(1, genislik - etiketEn - ETIKET_ARA);
  const deger = ((row.value ?? "") + offerScopeSuffix(row.scope)).length * DEGER_KATSAYI * DEGER_PUNTO;
  const degerSatir = Math.max(1, Math.ceil(deger / alan));

  return Math.max(etiketSatir, degerSatir) * SATIR_YUK + SATIR_PAY;
}

/**
 * Grubun tam yüksekliği. BASILMAYAN GRUP SIFIRDIR: gizli ya da satırsız bir
 * öbek belgede başlığını da bırakmaz, dolayısıyla bütçeden de yer yemez.
 */
export function grupYuksekligi(g: OfferGroup, genislik: number = SUTUN_GENISLIK): number {
  if (g.hidden) return 0;
  const satirlar = gorunurSatirlar(g);
  if (satirlar.length === 0) return 0;
  return BASLIK_YUK + satirlar.reduce((t, r) => t + satirYuksekligi(r, genislik), 0);
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
  // GENİŞLİK AÇIKÇA VERİLİR. `rows.map(satirYuksekligi)` yazılamaz: `map`
  // geri çağrıya DİZİNİ de geçer ve dizin ikinci parametreye, yani sütun
  // genişliğine düşerdi (0, 1, 2 pt'lik sütunlar → yüzlerce yaprak).
  const yuk = rows.map((r) => satirYuksekligi(r, SUTUN_GENISLIK));
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
 * KISA GÖVDENİN TEK SÜTUNLU YAPRAĞI — sığmıyorsa `null`.
 *
 * Kullanıcı bildirimi (01.09.2026): teknik özellikler az olduğunda iki sütun
 * yaprağın sağ yarısını boş bırakıyor. Karar burada verilir ve tek bir soruya
 * bakar: BÜTÜN gövde, sayfa genişliğince tek sütunla BİR yaprağa sığıyor mu?
 *
 * SORU TAM GENİŞLİKTE SORULUR. Dar sütunun ölçüsüyle sorulsaydı yanlış cevap
 * verirdi: aynı satır 234,78 pt'de iki, 487,56 pt'de tek satır çizer, yani
 * gövde geniş sütunda DAHA KISADIR. "Sol sütun dolduysa vazgeç" gibi bir eşik
 * de aynı sebeple yanlış olurdu — tam sayfaya sığan bir gövde dar sütunda
 * taşmış görünür.
 *
 * SIĞMIYORSA İKİ SÜTUN KURALI YERİNDE DURUR (kullanıcı: *"sayfayı ikiye
 * bölmek istiyorum, o özellik kalsın"*). Tek sütun kapasitesi sütununkiyle
 * AYNIDIR — ikisi de yaprağın aynı dikey boşluğudur — dolayısıyla tek sütuna
 * sığmayan gövde zaten iki sütuna gider, ikinci bir yaprak açılmaz.
 */
function tamSayfa(groups: readonly OfferGroup[], kapasite: number): OfferPdfSayfa | null {
  const sayfa: OfferPdfSayfa = { sol: [], sag: [], basliklar: [], tam: true };
  let toplam = 0;

  for (const group of groups) {
    if (!group || group.hidden) continue;
    const rows = gorunurSatirlar(group);
    if (rows.length === 0) continue;

    const h = BASLIK_YUK + rows.reduce((t, r) => t + satirYuksekligi(r, TAM_GENISLIK), 0);
    toplam += h;
    if (toplam > kapasite) return null;

    sayfa.sol.push({ group, rows, devam: false, h });
    const kisa = offerGroupShort(group.key, group.title);
    if (!sayfa.basliklar.includes(kisa)) sayfa.basliklar.push(kisa);
  }

  return sayfa.sol.length > 0 ? sayfa : null;
}

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

  // ÖNCE TEK SÜTUN DENENİR: kısa gövde yaprağın yarısını boş bırakmaz.
  const tek = tamSayfa(groups, kapasite);
  if (tek) return [tek];

  const sayfalar: OfferPdfSayfa[] = [];
  let sagda = false;
  let kalan = kapasite;

  const sonSayfa = (): OfferPdfSayfa => {
    const s = sayfalar[sayfalar.length - 1];
    if (s) return s;
    const yeni: OfferPdfSayfa = { sol: [], sag: [], basliklar: [], tam: false };
    sayfalar.push(yeni);
    return yeni;
  };

  const sutunuKapat = () => {
    if (sayfalar.length === 0 || sagda) {
      sayfalar.push({ sol: [], sag: [], basliklar: [], tam: false });
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
