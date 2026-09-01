// TEKLİF PDF'İ — müşteriye giden belgenin kendisi.
//
// Yapı firmanın on beş yıldır verdiği tekliflerden ÇIKARILDI, tasarlanmadı:
// kapak mektubu (KİMDEN/KİME künyesi + hitap + giriş + imzalar), her ekipman
// için ayrı bir teknik sayfa, test yükü, ticari şartlar, fiyat tablosu, notlar
// ve kapsam dışı işler. A4 DİKEY ve çok sayfalıdır.
//
// SÜZGEÇ TEKTİR. Belge `printedPayload()` çağırır ve YALNIZ onun döndürdüğünü
// basar; burada ikinci bir gizleme kuralı YOKTUR. Gizlenen satır belgede
// boşluk, tire ya da iz bırakmaz — bütün satırları gizlenmiş bir grup
// başlığıyla birlikte düşer (bkz. `offers/payload.ts` `printedRows`). İki
// yerde süzülseydi ekrandan düşen satır belgeye girmeye devam ederdi ve bu,
// bu bölümde olabilecek en pahalı hatadır.
//
// KAPSAM YALNIZ İSTİSNADA GÖRÜNÜR. `OfferRow.scope` varsayılan olarak
// `orion`dur ve belgede hiçbir iz bırakmaz; `customer` seçilen satırın değerine
// ` (Müşteri Kapsamında)` eki basılır (`offerScopeSuffix`). Bir teklifte
// satırların neredeyse tamamı bizim kapsamımızdadır — her satıra kapsam yazmak
// belgeyi okunmaz yapar, sapmayı yazmak ise onu görünür kılar.
//
// `textTransform` KULLANILMAZ: @react-pdf'in uygulaması locale'siz
// `toUpperCase()` çağırır ve "i" harfini "I" yapar ("Vinç" → "VINÇ").
// Büyük harf metnin kendisinde `trUpper()` ile verilir.

import React from "react";
import { Document, Image, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  BRAND,
  BRAND_LOGO_INK,
  BRAND_LOGO_PAPER,
  BrandPage,
  FONTS,
  LOGO_MONO_RATIO,
  PAGE,
  SYMBOL_INK_RATIO,
  StripeField,
  T,
  mm,
  trUpper,
  type BrandBandLogo,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { fmtMoney, fmtNum } from "@/lib/currency";
import {
  teknikDegerBuyuk,
  teknikEtiketBuyuk,
  teknikKapasiteDegerBuyuk,
} from "@/lib/offers/buyuk";
import { printedGeneralTerms, printedPayload } from "@/lib/offers/payload";
import {
  discountAmount,
  discountPercent,
  discountedLines,
  lineAmount,
  offerTotal,
  priceLineNumbers,
  vatBadge,
  vatNote,
} from "@/lib/offers/pricing";
import { offerDocLine, offerRevLabel } from "@/lib/offers/no";
import {
  ETIKET_ARA,
  SUTUN_BOSLUK,
  SUTUN_GENISLIK,
  TAM_GENISLIK,
  blokBasligi,
  etiketGenisligi,
  offerPdfSayfalari,
  type OfferPdfBlok,
} from "@/lib/offers/pdf-layout";
import { COMPANY_PROFILE, GENERAL_TERMS_TITLE } from "@/lib/offers/registry";
import { offerScopeSuffix } from "@/lib/offers/types";
import { prepareCustomerLogoForTechnicalHeader } from "@/lib/customers/logo-image";
import type {
  OfferItem,
  OfferLeadTimeUnit,
  OfferPayload,
  OfferPriceLine,
  OfferRow,
} from "@/lib/offers/types";

export interface OfferDocumentProps {
  offer: {
    offerNo: string;
    revNo: number;
    /** ISO (yyyy-aa-gg) — teklifin TARİHİ, basıldığı gün değil. */
    issueDate: string;
    subject: string;
    customerName: string;
    currency: string;
  };
  /** HAM payload — bileşen süzgeci (`printedPayload`) KENDİ çağırır. */
  payload: OfferPayload;
  company: CompanyInfo;
  /**
   * MÜŞTERİ LOGOSU — belge çekirdeği DB/HTTP görmez (değişmez md. 7).
   *
   * Dosyayı PDF ucu indirir ve BUFFER olarak geçirir; react-pdf string bir
   * `src`yi URL sayar ve Windows dosya yolunda düşer (`brand.tsx`). Logo yoksa
   * ya da indirilemezse `null` geçilir — belge logosuz basılır, DÜŞMEZ.
   */
  customerLogo?: Buffer | null;
  /**
   * TEKLİFİ HAZIRLAYAN PARTNERİN LOGOSU. `undefined` ORION'un yerleşik
   * markasını, `null` seçili partnerin logosu olmadığını anlatır.
   */
  issuerLogo?: Buffer | null;
  /** `renderOfferPdf`in hazırladığı, teknik başlığa özel sıkı ve sağ hizalı logo. */
  issuerTechnicalLogo?: BrandBandLogo | null;
  /** `signaturePath` anahtarlı, özel depodan sunucu tarafından indirilmiş PNG'ler. */
  signatureImages?: Record<string, Buffer>;
  meta: { generatedAt: string };
  /**
   * İKİ GEÇİŞİN İÇ ALANLARI — çağıran DOLDURMAZ (`renderOfferPdf` yönetir).
   *
   * Kapaktaki içindekiler bölümlerin GERÇEK sayfa numaralarını yazar; bir
   * bölümün kaç yaprak tuttuğu ancak yerleştirildikten sonra bilinir. Birinci
   * geçiş `collect` ile numaraları toplar, ikincisi `pageOf` ile basar.
   */
  collect?: (anchor: string, page: number) => void;
  pageOf?: Record<string, number>;
  /** Kapağın sıkışma kademesi — `renderOfferPdf` ÖLÇEREK seçer (bkz. `KapakYogunlugu`). */
  coverDensity?: KapakYogunlugu;
  /**
   * Fiyat satırları SIKI dizilsin mi — `renderOfferPdf` ÖLÇEREK seçer.
   *
   * Satır payı normalde satır sayısına göre açılır (`fiyatSatirPayi`); ama uzun
   * ticari şartlar, dört taksitlik bir plan ve uzun not/kapsam listeleri üst
   * üste geldiğinde o pay ticari sayfayı taşırıyordu. Taşma ölçüldüğünde
   * satırlar en sıkı hâllerine iner: **yer varken geniş, yer yokken sıkı.**
   */
  compactPrices?: boolean;
  /**
   * Fiyat tablosu KENDİ yaprağına geçsin mi — `renderOfferPdf` ÖLÇEREK seçer.
   *
   * Tablo normalde satır SAYISIYLA kendi yaprağına geçer (`FIYAT_SATIR_ESIGI`),
   * ama satır sayısı tek başına yeterli bir ölçü değildir: kalem bazında
   * iskonto basıldığında hücreler iki katmanlıdır, tablo aynı satır sayısıyla
   * daha uzundur. Sıkıştırma da yetmediğinde tabloyu kendi yaprağına almak
   * kalan tek çıkıştır — alternatifi tablonun ortadan ikiye bölünmesidir.
   */
  priceOwnPage?: boolean;
}

/**
 * KAPAĞIN SIKIŞMA KADEMESİ — tahmin edilmez, ÖLÇÜLÜR.
 *
 * Kapak TEK SAYFADIR ama üzerindeki metnin uzunluğu teklife göre değişir: konu
 * üç satıra çıkabilir, müşteri unvanı ("… İSTİHSAL ENDÜSTRİSİ A.Ş.") künye
 * kartında sarabilir, muhatabın bölümü uzun olabilir, iki imzacı girilebilir.
 * Tasarımın nefes payları bunların hepsi birden geldiğinde taşıyordu ve
 * @react-pdf taşan bloğu SESSİZCE ikinci bir yaprağa atıyordu — müşteriye
 * altbilgiden ibaret boş bir sayfa gidiyordu.
 *
 * Payları içeriğin uzunluğuna bakarak tahmin etmek yerine belge ÖLÇÜLÜR:
 * `renderOfferPdf` zaten iki geçiş yapıyor ve kapağın sonuna konan sonda
 * ("son:kapak") hangi yaprakta bittiğini söylüyor. Taşarsa kademe artar ve
 * yerleşim yeniden koşar.
 *
 *  - `0` — tasarımın kendi payları.
 *  - `1` — bölge araları kısalır (bant içi, içindekiler, hitap, iş kolu satırı).
 *  - `2` — İŞ KOLLARI ızgarası düşer. Tasarımın kendi anahtarıdır
 *    (`showBusinessLines`); kapağın en uzun ve en az kritik bloğudur —
 *    firmanın beyanı kalır, listesi düşer.
 */
export type KapakYogunlugu = 0 | 1 | 2;

// ————————————————————————————————————————————————————————————— ölçüler

/**
 * İki teknik blok arasındaki boşluk.
 *
 * `pdf-layout.ts` bu payı `BASLIK_YUK`ün İÇİNDE sayar (blok başına 10 pt);
 * buradaki sayı oradan ayrılırsa ölçü ile kâğıt ayrışır ve sütun taşar.
 */
const BLOK_ARA = 10;

/** A4 genişliği — kömür bandın şerit dokusu kağıdın iki kenarına da değer. */
const SAYFA_EN = mm(210);

/**
 * KÖMÜR BANDIN ŞERİT DOKUSUNUN BOYU — bandın kendi yüksekliği DEĞİL.
 *
 * Bant içeriğiyle büyür (başlık iki satır da olabilir üç de); doku ise sabit
 * ölçülü bir SVG'dir ve bandın kesebileceğinden BÜYÜK verilir — kutu
 * `overflow: "hidden"` ile fazlasını kırpar. Küçük verilseydi uzun bir konuda
 * bandın dibinde dokusuz bir şerit kalırdı.
 */
const BANT_DOKU_BOY = mm(200);

/**
 * Kapağın kağıt bölgesinin alt payı — markalı altbilgi (iki satır) buraya sığar.
 *
 * Altbilgi bloğu kağıt dibinden ~45 pt yükselir (kural + doküman satırı + künye
 * satırı); pay ondan 3 pt fazladır. Daha büyük vermek kapağın en kıt kaynağını
 * boşa harcamak, daha küçük vermek iş kolları listesini künyenin üstüne
 * bindirmek olurdu.
 */
const KAPAK_ALT_PAY = mm(17);

/**
 * KAPAĞIN NEFES PAYLARI — sıkışma kademesine göre (bkz. `KapakYogunlugu`).
 *
 * Kısalan şeyler BOŞLUKLARDIR, puntolar değil: metni küçültmek belgeyi okunmaz
 * yapar, aralığı kısmak yalnız daha yoğun gösterir. Kademe 2'de tek bir BLOK
 * düşer ve o blok tasarımın kendi anahtarını taşıyandır.
 */
function kapakPaylari(yogunluk: KapakYogunlugu) {
  const sik = yogunluk >= 1;
  return {
    bantKickerUst: sik ? mm(8) : mm(13),
    bantAlt: sik ? mm(9) : mm(13),
    icindekilerUst: sik ? mm(7) : mm(11),
    kagitUst: sik ? mm(6) : mm(8),
    hitapUst: sik ? mm(4) : mm(6),
    boslukEnAz: sik ? 0 : 12,
    tanitimGovdeAlt: sik ? 6 : 9,
    isKoluAlt: sik ? 3.5 : 5.25,
    isKollariVar: yogunluk < 2,
  };
}

/**
 * TİCARİ SAYFANIN BLOK BAŞLIKLARI.
 *
 * Defterde DEĞİLDİR ve olmamalıdır: bunlar kullanıcının düzenlediği bir metin
 * değil, sayfanın yerleşim etiketleridir. `terms.title` ("TESLİM VE ÖDEME
 * ŞEKLİ") sayfanın KICKER'IDIR ve payload'da durur; bunlar onun altındaki
 * blokların adıdır.
 */
const TESLIM_BASLIK = "TESLİM ŞARTLARI";
const ODEME_BASLIK = "ÖDEME PLANI";

/** Fiyat tablosunun bölüm başlığı (kullanıcı isteği 19.08.2026, md. 16). */
const FIYAT_BASLIK = "FİYATLAR";

const S = StyleSheet.create({
  // ————————————————————————————————————— KAPAK · KÖMÜR BANT
  //
  // Kapak TAM KANAMADIR (`bleed`): kömür bant kağıdın iki kenarına da değer,
  // kırmızı omurga onun ÜZERİNDEN geçer. Bandın kendi payları sayfanın
  // marjlarıyla AYNIDIR (16 üst / 16 dış / 22 iç) — alttaki kağıt bölgesi de
  // aynı sütuna oturur ve iki bölge tek bir ızgarayı paylaşır.
  bant: { position: "relative", overflow: "hidden", backgroundColor: BRAND.ink, flexGrow: 0, flexShrink: 0 },
  bantDoku: { position: "absolute", top: 0, left: 0 },
  bantIc: {
    position: "relative",
    paddingTop: PAGE.marginTop,
    paddingRight: PAGE.marginOuter,
    paddingBottom: mm(13),
    paddingLeft: PAGE.contentLeft,
  },
  // Üst satır KIRMIZI kuralla kapanır: kılavuz kömür zeminde sayfa kuralını
  // kırmızıya çevirir (kağıtta aynı kural kömürdür — bkz. `S.sayfaKurali`).
  bantUst: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.red,
    paddingBottom: 6.75,
  },
  bantMeta: {
    fontFamily: FONTS.mono,
    fontSize: 6.75,
    letterSpacing: 0.95,
    lineHeight: 1.8,
    color: BRAND.gray500,
    textAlign: "right",
  },
  /** Referans numarasının KENDİSİ kağıt rengi ve yarı kalın — etiketi değil. */
  bantMetaGuclu: { color: BRAND.paper100, fontWeight: 600 },
  bantKicker: { flexDirection: "row", alignItems: "center", marginTop: mm(13) },
  /** Kılavuzun 44×5 px kırmızı çizgisi, kapak ölçeğinde (33×3,75 pt). */
  bantKickerCubugu: { width: 33, height: 3.75, backgroundColor: BRAND.red, marginRight: 8.25 },
  // KİCKER MERCANDIR — kılavuz mercanı YALNIZ kömür zeminde kicker rengi
  // olarak tanımlar; kağıt üzerinde aynı rol kırmızıya döner.
  bantKickerYazi: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 1.65,
    color: BRAND.coral,
  },
  // Punto çağrı yerinde konunun uzunluğuna göre verilir (`kapakBaslikPunto`).
  bantBaslik: {
    fontFamily: FONTS.sans,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: -0.8,
    color: BRAND.paper50,
    maxWidth: mm(150),
    marginTop: 10.5,
  },
  bantMusteri: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    letterSpacing: 1.05,
    color: BRAND.gray500,
    marginTop: 9,
  },

  // ---- kapaktaki içindekiler
  icindekiler: { marginTop: mm(11) },
  icindekilerBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6.75,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: BRAND.gray500,
    marginBottom: 7.5,
  },
  icindekilerIzgara: { flexDirection: "row", gap: 9, alignItems: "stretch" },
  // Kutular EŞİT genişliktedir (`flexBasis: 0`): bölüm adlarının uzunluğu
  // sütunları yerinden oynatmaz, üstteki çizgiler aynı boyda kalır.
  icindekilerKutu: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderTopWidth: 2.25,
    borderTopColor: BRAND.inkLine,
    paddingTop: 6.75,
  },
  /** SAYFA BAŞINA TEK VURGU: yalnız ilk bölüm kırmızı açılır. */
  icindekilerKutuVurgu: { borderTopColor: BRAND.red },
  icindekilerSayfa: {
    fontFamily: FONTS.mono,
    fontSize: 6,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: BRAND.gray500,
  },
  icindekilerSayfaVurgu: { color: BRAND.coral },
  icindekilerAd: {
    fontFamily: FONTS.sans,
    fontSize: 9.75,
    fontWeight: 700,
    lineHeight: 1.25,
    color: BRAND.paper50,
    marginTop: 5.25,
  },

  // ————————————————————————————————————— KAPAK · KAĞIT BÖLGE
  kagit: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: BRAND.paper50,
    paddingTop: mm(8),
    paddingRight: PAGE.marginOuter,
    paddingBottom: KAPAK_ALT_PAY,
    paddingLeft: PAGE.contentLeft,
  },

  // ---- KİMDEN / KİME künyesi: TEK kutu, ortada bir ayraç
  //
  // İki ayrı kart arasındaki oluk kaldırıldı (kullanıcı tasarımı, 22.08.2026):
  // kutu tek olunca iki taraf aynı yüksekliğe kendiliğinden oturur ve künye
  // bir "kart çifti" değil bir MUHATAP ÇİZELGESİ gibi okunur.
  kunyeKutu: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 0.75,
    borderColor: BRAND.line300,
    backgroundColor: BRAND.white,
  },
  kunyeHucre: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingVertical: 10.5, paddingHorizontal: 12 },
  kunyeHucreAyrac: { borderRightWidth: 0.75, borderRightColor: BRAND.line300 },
  /**
   * ETİKET VE MARKA AYNI SATIRDA, SABİT YÜKSEKLİKTE.
   *
   * Yükseklik logonun standart tuvalinden gelir (120 × 32 pt, TEKLIF-43):
   * müşteri logosu olsa da olmasa da iki hücrenin metni aynı taban çizgisinden
   * başlar — rastlantısal bir logo oranı künyeyi aşağı itemez.
   */
  kunyeUst: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 32 },
  kunyeEtiket: {
    fontFamily: FONTS.mono,
    fontSize: 6.75,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: BRAND.red,
    flexShrink: 0,
  },
  kunyeAd: { fontFamily: FONTS.sans, fontSize: 11.25, fontWeight: 800, lineHeight: 1.2, color: BRAND.ink, marginTop: 8.25 },
  kunyeKisi: { fontFamily: FONTS.sans, fontSize: 8.25, lineHeight: 1.4, color: BRAND.gray600, marginTop: 3 },
  kunyeIletisim: { marginTop: 6.75, paddingTop: 6, borderTopWidth: 0.75, borderTopColor: BRAND.hairline },
  kunyeIletisimSatiri: {
    fontFamily: FONTS.mono,
    fontSize: 7.1,
    letterSpacing: 0.3,
    lineHeight: 1.7,
    color: BRAND.gray700,
  },

  // ---- hitap ve giriş
  hitapBlogu: { marginTop: mm(6), maxWidth: mm(150) },
  hitap: { fontFamily: FONTS.sans, fontSize: 9, lineHeight: 1.65, color: BRAND.gray700 },
  giris: { fontFamily: FONTS.sans, fontSize: 9, lineHeight: 1.65, color: BRAND.gray700 },
  saygi: { fontFamily: FONTS.sans, fontSize: 9, fontWeight: 700, color: BRAND.ink, marginTop: 5.25 },
  imzalar: { flexDirection: "row", gap: 40, marginTop: 12 },
  imzaGorsel: { width: 84, height: 28, objectFit: "contain", marginBottom: 3 },
  imzaAd: { fontFamily: FONTS.sans, fontSize: 8.5, fontWeight: 700, color: BRAND.ink },
  imzaUnvan: { ...T.caption, fontSize: 7, marginTop: 1 },

  // ---- firma tanıtımı ve iş kolları (kapağın alt bölgesi)
  kapakEsnekBosluk: { flexGrow: 1, minHeight: 12 },
  tanitim: { borderTopWidth: 2.25, borderTopColor: BRAND.red, paddingTop: 8.25, flexShrink: 0 },
  tanitimGovde: {
    fontFamily: FONTS.sans,
    fontSize: 7.9,
    lineHeight: 1.6,
    color: BRAND.gray600,
    maxWidth: mm(155),
    marginBottom: 9,
  },
  tanitimBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6.75,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: BRAND.red,
    marginBottom: 8.25,
  },
  // SIRA SATIR YÖNÜNDEDİR: `flexWrap` iki sütunlu bir ızgarayı soldan sağa
  // doldurur ve tasarımdaki okuma sırası ancak böyle korunur.
  isKollari: { flexDirection: "row", flexWrap: "wrap" },
  isKolu: { width: "50%", flexDirection: "row", alignItems: "flex-start", paddingRight: 16.5, paddingBottom: 5.25 },
  /** Kılavuzun 7 px kırmızı kare madde işareti. */
  isKoluIsareti: { width: 5.25, height: 5.25, backgroundColor: BRAND.red, marginTop: 3, marginRight: 6.75, flexShrink: 0 },
  isKoluYazi: { fontFamily: FONTS.sans, fontSize: 8.25, lineHeight: 1.45, color: BRAND.gray700, flexGrow: 1, flexShrink: 1, flexBasis: 0 },

  // ---- teknik / ticari satır
  // KALEM BAŞLIĞI SAYFANIN BAŞLIĞIDIR (kullanıcı isteği, 17.08.2026: *"vinç
  // adının yazdığı başlık biraz daha büyük olsun"*). 11pt'de grup başlığının
  // (8,8) yalnız bir tık üstündeydi ve sayfada hangisinin kimin başlığı olduğu
  // seçilmiyordu; 15pt ile hiyerarşi tek bakışta okunur.
  bolumBaslik: { ...T.heading },
  /**
   * BÖLÜM ŞERİDİ — bölüm adının üstündeki çizgi.
   *
   * Kullanıcının paylaştığı düzende (18.08.2026) her öbek bir çizgiyle açılır:
   * iki sütunda altı öbek alt alta dizildiğinde başlığın nerede başladığını
   * punto farkı tek başına söylemiyordu, çizgi söylüyor.
   */
  bolumSerit: { borderTopWidth: 1.2, borderTopColor: BRAND.ink, paddingTop: 4 },
  /** Sayfanın İLK öbeği kırmızı açılır — sayfa başına tek vurgu. */
  bolumSeritVurgu: { borderTopColor: BRAND.red },
  bolumAdi: {
    fontFamily: FONTS.mono,
    fontSize: 6.6,
    fontWeight: 600,
    letterSpacing: 1.3,
    lineHeight: 1.2,
    color: BRAND.ink,
    marginBottom: 4.5,
  },
  bolumAdiVurgu: { color: BRAND.red },
  // KAPSAM EKİ DEĞERİN PARÇASI DEĞİLDİR: aynı satırda, değerin devamında ama
  // daha küçük ve daha silik basılır ki müşteri "SIBRE Kasnak Fren" ile
  // "(Müşteri Kapsamında)" notunu birbirine karıştırmasın. İç içe `Text`
  // kullanılır — ayrı bir kutu satırı kırar, metin katmanında da bölerdi.
  // AİLE AÇIKÇA SANS: ek, mono dizilen değerin İÇİNDE bir `Text`tir ve aile
  // verilmezse mono'yu miras alır. Ayrı aile ekin değerin parçası olmadığını
  // gözle de söyler ("SIBRE KASNAK FREN" ile "(MÜŞTERİ KAPSAMINDA)"
  // karışmasın) — bu, stilin en baştaki gerekçesiydi zaten.
  kapsamEki: { fontFamily: FONTS.sans, fontSize: 6.4, color: BRAND.gray600 },
  // ---- TEKNİK ÖZELLİK SATIRI (çizelge düzeni, 18.08.2026)
  //
  // Etiket solda, DEĞER SAĞA YASLI ve altında ince bir ayırıcı çizgi. Devralınan
  // düzende ikisi arasında iki nokta vardı ve değer etiketin bittiği yerden
  // başlıyordu: sütunun sağ yarısı düzensiz bir kıyı oluşturuyor, göz "Motor"un
  // karşısındaki değeri ararken satır satır tarıyordu. Sağa yaslı değer sütunu
  // hem hizalı bir kıyı verir hem de satırı iki uçtan okunur kılar.
  ozellikSatiri: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 1.4,
    paddingBottom: 1.4,
    borderBottomWidth: 0.4,
    borderBottomColor: BRAND.hairline,
  },
  // ETİKET SÜTUNU SABİTTİR: her satırın değeri aynı x noktasından
  // başlar. Değer için kalan genişlik satırdan satıra değişmediği için uzun
  // metin öngörülebilir biçimde ikinci satıra iner; kısa bir "FREN" etiketi
  // değeri sağa, uzun bir etiket sola itmez.
  ozellikEtiket: {
    fontFamily: FONTS.sans,
    fontSize: 7.8,
    fontWeight: 500,
    lineHeight: 1.28,
    color: BRAND.gray600,
    flexGrow: 0,
    flexShrink: 0,
    width: etiketGenisligi(SUTUN_GENISLIK),
  },
  // TAM GENİŞLİKTE ETİKET DAHA GENİŞTİR (%34 değil %40) — gerekçesi
  // `pdf-layout.ts` `TAM_ETIKET_ORAN`da: geniş sayfada sarma sorunu değerin
  // değil ETİKETİN sorunudur. Sayı buraya yazılmaz, ölçüyle aynı fonksiyondan
  // okunur; iki yerde ayrı yazılan bir genişlik sessizce ayrışırdı.
  ozellikEtiketTam: { width: etiketGenisligi(TAM_GENISLIK) },
  // DEĞER MONO DİZİLİR: teknik değerlerin çoğu koddur ("SCHNEIDER ATV-340",
  // "Ø20 6x36", "A65") ve mono onları bir metin parçası değil VERİ gibi
  // okutur — marka kılavuzunun "her sayı, kod, etiket" kuralı.
  //
  // `flexBasis: 0` ŞART: temel genişlik "auto" bırakılırsa yoga değerin
  // ÖLÇÜLEN uzunluğunu taban alır ve uzun bir değer sarmak yerine sütunun
  // dışına taşar (aynı tuzak sayfa başlığında da yaşandı, bkz. `sayfaBasi`).
  ozellikDeger: {
    fontFamily: FONTS.mono,
    fontSize: 7.4,
    fontWeight: 500,
    lineHeight: 1.35,
    color: BRAND.ink,
    textAlign: "right",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginLeft: ETIKET_ARA,
  },
  /** Kapasite belge kararını taşıyan ana sayıdır; öteki değerlerden güçlüdür. */
  ozellikDegerGuclu: { fontWeight: 800 },

  // ---- ÇİFT SÜTUN (kullanıcı isteği 18.08.2026, md. 8)
  //
  // Sütunlar SABİT GENİŞLİKTİR (`SUTUN_GENISLIK`), esnek değil: sayfalama
  // modülü yüksekliği o genişliğe göre ÖLÇÜYOR (`pdf-layout.ts`) ve yoga
  // burada başka bir genişlik hesaplarsa ölçü ile çizim ayrışır — bir sütun
  // taşar, öteki boş kalır.
  sutunlar: { flexDirection: "row", gap: SUTUN_BOSLUK },
  sutun: { width: SUTUN_GENISLIK },
  /**
   * TEK SÜTUN — SAYFA GENİŞLİĞİNCE (kullanıcı bildirimi, 01.09.2026).
   *
   * Teknik özellikler az olduğunda iki sütun yaprağın sağ yarısını bomboş
   * bırakıyordu. Gövde bir yaprağa tek sütunla sığıyorsa `pdf-layout.ts`
   * sayfayı `tam` işaretler ve satırlar içerik alanının tamamını kullanır.
   * Genişlik yine SABİTTİR: ölçü de bu sayıya göre yapıldı.
   */
  sutunTam: { width: TAM_GENISLIK },
  /**
   * SAYFA BAŞLIĞI KAPAK BANDININ KAĞIT ÜZERİNDEKİ KARŞILIĞIDIR.
   *
   * Kapakta: kırmızı çubuk + mono kicker, sağda mono künye, altında büyük
   * başlık ve bölgeyi kapatan kural. İç sayfalarda aynı anatomi, kağıt
   * ölçeğinde — çubuk 18×2,4, kural KÖMÜR (kılavuz kuralı kömür zeminde
   * kırmızıya çevirir, kağıtta kömür bırakır).
   *
   * BÜYÜK BAŞLIK KENDİ SATIRINDA KALIR, künyeyle YAN YANA GELMEZ (kullanıcı
   * bildirimi, 18.08.2026): esnek satırda yalnız `flexGrow/flexShrink`
   * verilmiş bir kutuda @react-pdf metni DARALTILMIŞ genişliğe göre yeniden
   * sarmaz, ölçtüğü doğal genişlikte çizer — 429 pt'lik başlık 337 pt'lik
   * kutudan taşıp künyenin üstüne biniyordu. Kicker ile künye yan yanadır ama
   * ikisi de kısa mono metinlerdir ve toplamları içerik genişliğinin yarısını
   * bulmaz; aynı tuzağa düşmezler.
   *
   * YÜKSEKLİK BÜTÇESİ KORUNUR: blok ~43 pt'tir ve `PDF_SUTUN_KAPASITE` o payı
   * düşer. Buradaki her pt sütun kapasitesinden gider — bir teknik sayfa
   * yüzünden ikinci bir yaprak açılabilir.
   */
  sayfaBasi: { marginBottom: 9 },
  // ---- MARKA SATIRI (ticari ve genel şartlar sayfaları)
  //
  // Kömür kapak bandının kağıt üzerindeki karşılığı: solda KÖMÜR lockup, sağda
  // doküman künyesi, altında KIRMIZI kural. Teknik sayfalar aynı dili küçük
  // hazırlayan firma logosuyla konuşur — gerekçesi `SayfaBasi`da.
  sayfaMarkaSatiri: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.red,
    paddingBottom: 6.75,
  },
  sayfaMarkaMeta: {
    fontFamily: FONTS.mono,
    fontSize: 6.75,
    letterSpacing: 0.95,
    lineHeight: 1.8,
    color: BRAND.gray500,
    textAlign: "right",
  },
  sayfaMarkaMetaGuclu: { color: BRAND.ink, fontWeight: 600 },
  // Kapaktaki 33×3,75 çubuğun aynısı; teknik sayfada 18×2,4'e iner.
  sayfaKickerSatiri: { flexDirection: "row", alignItems: "center" },
  sayfaKickerCubugu: { width: 33, height: 3.75, backgroundColor: BRAND.red, marginRight: 8.25, flexShrink: 0 },
  sayfaKicker: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 1.65,
    color: BRAND.red,
    flexShrink: 1,
  },
  sayfaKickerCubuguKucuk: { width: 18, height: 2.4, backgroundColor: BRAND.red, marginRight: 6, flexShrink: 0 },
  sayfaKickerKucuk: { ...T.kicker, color: BRAND.red, flexShrink: 1 },
  sayfaTeknikLogo: {
    position: "absolute",
    bottom: -4.5,
    right: 0,
    width: 137.5,
    height: 30,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  /** Lockup'sız sayfalarda kimlik satırını kapatan KIRMIZI kural. */
  sayfaKurali: { height: 1.5, backgroundColor: BRAND.red, marginTop: 6 },
  sayfaBaslik: { ...T.heading, marginTop: 6 },
  ticariBaslik: { ...T.heading, fontSize: 19.5, lineHeight: 1, marginTop: 7.5 },

  // ---- GENEL ŞARTLAR (md. 9)
  //
  // "Daha küçük ve biraz silik" (kullanıcı cümlesi): 6,6 pt gövde ve
  // `gray600`. Belgenin geri kalanı 8 pt / `ink`tir; şartlar okunabilir ama
  // ÖNE ÇIKMAZ — hukukî bir ek olduğu tipografiden anlaşılır.
  sartMadde: { marginBottom: 6 },
  sartBaslik: { fontFamily: FONTS.sans, fontSize: 7, fontWeight: 700, color: BRAND.gray700, marginBottom: 1.5 },
  sartGovde: { fontFamily: FONTS.sans, fontSize: 6.6, lineHeight: 1.45, color: BRAND.gray600, textAlign: "justify" },

  // ————————————————————————————————— TİCARİ SAYFA (kullanıcı tasarımı, 22.08.2026)
  //
  // Üstte iki sütun: solda TESLİM ŞARTLARI çizelgesi (kırmızı açılır), sağda
  // ÖDEME PLANI ve TEST YÜKÜ. Her blok bir BAŞLIK + BEYAZ KUTU çiftidir; kutu
  // 1 px kıl çizgiyle çerçevelenir ve satırlar arasında aynı kıl çizgi durur.
  // Devralınan düzende bunlar çıplak `Etiket : Değer` satırlarıydı ve sayfanın
  // neresinin nerede bittiği ancak punto farkından okunuyordu.
  ticariUst: { flexDirection: "row", gap: 9, alignItems: "stretch" },
  /** Teslim şartları sütunu daha geniştir (tasarımda 1,55 / 1 oranı). */
  ticariSol: { flexGrow: 1.55, flexShrink: 1, flexBasis: 0 },
  ticariSag: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  /** Blok başlığı: 3 px şerit + mono etiket. Şerit KIRMIZIYSA blok vurguludur. */
  blokSerit: { borderTopWidth: 2.25, borderTopColor: BRAND.ink, paddingTop: 6.75 },
  blokSeritVurgu: { borderTopColor: BRAND.red },
  blokEtiket: { fontFamily: FONTS.mono, fontSize: 6.75, fontWeight: 600, letterSpacing: 1.5, color: BRAND.ink },
  blokEtiketVurgu: { color: BRAND.red },
  kutu: {
    marginTop: 6,
    borderWidth: 0.75,
    borderColor: BRAND.line300,
    backgroundColor: BRAND.white,
  },
  /** Kutunun SON satırı alt çizgisini taşımaz — çerçeve zaten oradadır. */
  kutuSatiri: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7.5,
    paddingVertical: 3,
    paddingHorizontal: 8.25,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.hairline,
  },
  kutuSonSatir: { borderBottomWidth: 0 },
  // ETİKET MONO VE GRİ, DEĞER SANS VE KOYU: renk farkı dekor değil,
  // tanım/veri ayrımıdır (TEKLIF-44'ün teknik satırdaki kuralı).
  sartEtiket: {
    fontFamily: FONTS.mono,
    fontSize: 6,
    fontWeight: 600,
    letterSpacing: 0.72,
    lineHeight: 1.35,
    color: BRAND.gray600,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  sartDeger: {
    fontFamily: FONTS.sans,
    fontSize: 7.2,
    fontWeight: 700,
    lineHeight: 1.35,
    color: BRAND.ink,
    flexGrow: 1.3,
    flexShrink: 1,
    flexBasis: 0,
  },
  // ---- ödeme planı
  //
  // ORAN SOLDA VE BÜYÜK; satırın sol kenarında 3 pt'lik bir omuz durur ve
  // İLK taksitinki kırmızıdır — plan bir sıradır ve gözün nereden başlayacağı
  // belli olmalıdır.
  odemeSatiri: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6.75,
    paddingVertical: 2.25,
    paddingHorizontal: 8.25,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.hairline,
    borderLeftWidth: 2.25,
    borderLeftColor: BRAND.line300,
  },
  odemeSatiriIlk: { borderLeftColor: BRAND.red },
  odemeOran: {
    fontFamily: FONTS.mono,
    fontSize: 8.25,
    fontWeight: 600,
    lineHeight: 1.35,
    color: BRAND.ink,
    flexShrink: 0,
  },
  odemeOranIlk: { color: BRAND.red },
  odemeAciklama: {
    fontFamily: FONTS.sans,
    fontSize: 6.75,
    fontWeight: 700,
    lineHeight: 1.35,
    color: BRAND.ink,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  // ---- test yükü
  testDeger: { fontFamily: FONTS.mono, fontSize: 8.25, fontWeight: 600, lineHeight: 1.35, color: BRAND.ink, flexShrink: 0 },

  // ————————————————————————————————— FİYAT TABLOSU
  fiyatUst: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 2.25,
    borderTopColor: BRAND.red,
    paddingTop: 6.75,
  },
  fiyatParaBirimi: { fontFamily: FONTS.mono, fontSize: 6, letterSpacing: 0.84, color: BRAND.gray500 },
  fiyatKutu: { marginTop: 6, borderWidth: 0.75, borderColor: BRAND.line300, backgroundColor: BRAND.white },
  fiyatBaslikSatiri: {
    flexDirection: "row",
    gap: 7.5,
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    backgroundColor: BRAND.ink,
  },
  fiyatBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6,
    fontWeight: 600,
    letterSpacing: 0.96,
    lineHeight: 1.35,
    color: BRAND.paper100,
  },
  fiyatSatiri: {
    flexDirection: "row",
    gap: 7.5,
    alignItems: "flex-start",
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.hairline,
  },
  /** ANA SATIR ZEMİNLİDİR: iki seviyeli sırada (1 / 1.1) hiyerarşi zeminle okunur. */
  fiyatSatiriAna: { backgroundColor: BRAND.paper100 },
  fiyatNo: { fontFamily: FONTS.mono, fontSize: 6.75, fontWeight: 600, lineHeight: 1.4, color: BRAND.gray500 },
  fiyatNoAna: { color: BRAND.red },
  fiyatTanim: { fontFamily: FONTS.sans, fontSize: 7.5, fontWeight: 500, lineHeight: 1.4, color: BRAND.ink },
  fiyatTanimAna: { fontWeight: 800 },
  /** Alt satırın adı bir tık içeridedir — sıra numarası tek başına yetmiyordu. */
  fiyatTanimAlt: { paddingLeft: 10.5 },
  fiyatVeri: { fontFamily: FONTS.mono, fontSize: 6.75, lineHeight: 1.4, color: BRAND.gray700, textAlign: "right" },
  fiyatTutar: { fontFamily: FONTS.mono, fontSize: 7.125, fontWeight: 600, lineHeight: 1.4, color: BRAND.ink, textAlign: "right" },
  /**
   * KALEM BAZINDA ÜSTÜ ÇİZİLİ ESKİ FİYAT — geçerli rakamın ÜSTÜNDE durur.
   *
   * Toplam şeridindekinin (`toplamAraUstuCizili`) küçük kardeşi: aynı dil, tablo
   * ölçüsünde. BİR KADEME KÜÇÜK VE SİLİKTİR — artık ödenmeyecek bir rakamdır ve
   * geçerli fiyatla aynı ağırlıkta dururken sütunda hangisinin fatura edileceği
   * okunamıyordu. Sıkı satır aralığı (1,2) iki katmanlı hücreyi tablo satırının
   * boyuna sığdırır (bkz. `FIYAT_ESKI_BOYU`).
   */
  fiyatEski: {
    fontFamily: FONTS.mono,
    fontSize: 6,
    lineHeight: 1.2,
    color: BRAND.gray500,
    textAlign: "right",
    textDecoration: "line-through",
  },
  /** İki katmanlı fiyat hücresi: eski rakam üstte, geçerli rakam altında. */
  fiyatYigin: { alignItems: "flex-end" },
  /** Geçerli birim fiyat ve kısa iskonto oranı aynı satırda kalır. */
  fiyatGecerliSatir: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  fiyatIskonto: {
    fontFamily: FONTS.mono,
    fontSize: 5.25,
    fontWeight: 600,
    lineHeight: 1.2,
    color: BRAND.red,
  },
  // ---- toplam şeritleri
  //
  // ÖDENECEK RAKAM KÖMÜR ŞERİTTEDİR ve tablonun en büyük yazısıdır; ara
  // toplamlar (TOPLAM, İSKONTO) onun üstünde açık zeminde durur.
  toplamAra: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.hairline,
    backgroundColor: BRAND.paper50,
  },
  toplamAraEtiket: { fontFamily: FONTS.mono, fontSize: 6.75, fontWeight: 600, letterSpacing: 1.2, color: BRAND.gray600 },
  toplamAraTutar: { fontFamily: FONTS.mono, fontSize: 8.25, fontWeight: 600, color: BRAND.ink },
  /**
   * ÜSTÜ ÇİZİLİ ESKİ FİYAT — iskontonun GÖRÜNMESİ (kullanıcı isteği, 22.08.2026).
   *
   * Bir kademe KÜÇÜK ve SİLİK: artık geçerli olmayan bir rakamdır ve ödenecek
   * tutarla aynı ağırlıkta durursa müşteri hangisini ödeyeceğini iki kez okur.
   */
  toplamAraUstuCizili: {
    fontFamily: FONTS.mono,
    fontSize: 7.5,
    fontWeight: 400,
    color: BRAND.gray600,
    textDecoration: "line-through",
  },
  toplamSerit: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: BRAND.ink,
  },
  toplamEtiket: { fontFamily: FONTS.mono, fontSize: 6.75, fontWeight: 600, letterSpacing: 1.5, color: BRAND.coral },
  toplamKdv: { fontFamily: FONTS.mono, fontSize: 6, letterSpacing: 0.84, color: BRAND.gray500 },
  toplamTutar: {
    fontFamily: FONTS.mono,
    fontSize: 14.25,
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: -0.14,
    color: BRAND.paper100,
  },
  dipnot: { ...T.caption, fontSize: 6.4, color: BRAND.gray600, marginTop: 5 },
  kdvNotu: { ...T.caption, fontSize: 6.4, color: BRAND.gray600, marginTop: 2 },

  // ————————————————————————————————— NOTLAR / KAPSAM DIŞI İŞLER
  altSutunlar: { flexDirection: "row", gap: 15, alignItems: "flex-start" },
  altSutun: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  altBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6.375,
    fontWeight: 600,
    letterSpacing: 1.28,
    color: BRAND.ink,
    marginBottom: 4.5,
  },
  altSerit: { borderTopWidth: 1.125, borderTopColor: BRAND.ink, paddingTop: 6 },
  maddeSatiri: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 2.25 },
  /** Kılavuzun kare madde işareti: notlarda kırmızı, kapsam dışında gri. */
  maddeIsareti: { width: 3.75, height: 3.75, marginTop: 3.75, marginRight: 5.25, flexShrink: 0, backgroundColor: BRAND.red },
  maddeIsaretiSilik: { backgroundColor: BRAND.gray400 },
  maddeYazi: {
    fontFamily: FONTS.sans,
    fontSize: 6.375,
    lineHeight: 1.53,
    color: BRAND.gray700,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
});

// ————————————————————————————————————————————————————————————— yardımcı

/** ISO tarihi gg.aa.yyyy yapar; okunamayan değer olduğu gibi kalır. */
function tarih(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? "");
}

/**
 * SAYFA KÜNYESİ — sayfa başlığının sağ üstündeki kimlik.
 *
 * `no` ve `alt` markalı başlıkta iki satır olarak (kapaktaki gibi) basılır.
 * Teknik sayfanın sağ üstü artık hazırlayan firma logosuna ayrılmıştır; teklif
 * numarası o yaprakta altbilgide yaşamaya devam eder.
 */
interface SayfaKunyesi {
  no: string;
  alt: string;
}

function sayfaKunyesi(offer: OfferDocumentProps["offer"]): SayfaKunyesi {
  const rev = offerRevLabel(offer.revNo);
  const gun = tarih(offer.issueDate);
  return {
    no: offer.offerNo,
    alt: rev ? `${rev} · TARİH · ${gun}` : `TARİH · ${gun}`,
  };
}

/** Sayfa başlığındaki kömür lockup'ın genişliği — yüksekliği ~19,5 pt yapar. */
const SAYFA_LOGO_EN = 160;
/** Teknik başlıkta akışı büyütmeden sağ üste oturan hazırlayan firma logosu. */
const TEKNIK_LOGO_EN = 137.5;
const TEKNIK_LOGO_BOY = 30;
/** Standart tuvaldeki 840×180 görünür alanın %25 büyütülmüş fiziksel karşılığı. */
const TEKNIK_PARTNER_LOGO_EN = 105;
const TEKNIK_PARTNER_LOGO_BOY = 22.5;

function TeknikBaslikLogosu({ logo }: { logo?: BrandBandLogo | null }) {
  if (logo === null) return null;
  const src = logo?.src ?? BRAND_LOGO_INK;
  const ratio = logo?.ratio ?? LOGO_MONO_RATIO;
  const partner = logo !== undefined;
  const maxWidth = partner ? TEKNIK_PARTNER_LOGO_EN : TEKNIK_LOGO_EN;
  const maxHeight = partner ? TEKNIK_PARTNER_LOGO_BOY : TEKNIK_LOGO_BOY;
  return (
    <View style={S.sayfaTeknikLogo}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        src={src}
        style={{
          width: Math.min(maxWidth, maxHeight / ratio),
          height: Math.min(maxHeight, maxWidth * ratio),
          objectFit: "contain",
        }}
      />
    </View>
  );
}

/**
 * SAYFA BAŞLIĞI — kapak bandının kağıt üzerindeki karşılığı.
 *
 * İki yoğunlukta aynı anatomi:
 *
 *  - **`marka`** (ticari şartlar, genel şartlar): solda KÖMÜR lockup, sağda
 *    iki satırlık doküman künyesi, altında KIRMIZI kural; sonra kırmızı çubuk
 *    + mono kicker ve sayfanın büyük başlığı. Kullanıcı tasarımının kendisi.
 *  - **teknik sayfalar**: çubuk + kicker solda, hazırlayan firmanın logosu
 *    sağda ve aynı kırmızı kural altta. Logo akış dışındadır; bu yüzden başlık
 *    yüksekliğini ve `PDF_SUTUN_KAPASITE` hesabını değiştirmez. Sağındaki eski
 *    teklif numarası kaldırılmıştır; belge kimliği altbilgide kalır.
 *
 * BÜYÜK BAŞLIK KENDİ SATIRINDA KALIR, künyeyle YAN YANA GELMEZ (kullanıcı
 * bildirimi, 18.08.2026): esnek satırda yalnız `flexGrow/flexShrink` verilmiş
 * bir kutuda @react-pdf metni DARALTILMIŞ genişliğe göre yeniden sarmaz,
 * ölçtüğü doğal genişlikte çizer ve komşusunun üstüne biner.
 */
function SayfaBasi({
  kicker,
  baslik,
  kunye,
  marka,
  buyuk,
  brandLogo,
  technicalLogo,
  brandName,
}: {
  kicker: string;
  baslik: string;
  kunye: SayfaKunyesi;
  /** Lockup taşıyan başlık — ticari ve genel şartlar sayfaları. */
  marka?: boolean;
  /** Ticari sayfanın başlığı bir tık büyüktür (TEKLIF-44). */
  buyuk?: boolean;
  /** `undefined` = ORION, `null` = logosuz partner, Buffer = partner logosu. */
  brandLogo?: Buffer | null;
  /** Teknik başlığa özel sıkı logo; görünür sağ kenarı kuralın ucuna oturur. */
  technicalLogo?: BrandBandLogo | null;
  brandName?: string;
}) {
  return (
    <View style={S.sayfaBasi}>
      {marka ? (
        <>
          <View style={S.sayfaMarkaSatiri}>
            {/* KÖMÜR LOCKUP: kapakta kağıt renkliydi, kağıt üzerinde kömür.
                Tam renkli sürüm belgenin bu yaprağında ikinci bir kırmızı
                lekesi olurdu — kırmızı bu sayfada kicker ve kurala ayrılmıştır. */}
            {brandLogo === undefined ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={BRAND_LOGO_INK}
                style={{ width: SAYFA_LOGO_EN, height: SAYFA_LOGO_EN * LOGO_MONO_RATIO }}
              />
            ) : brandLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={brandLogo}
                style={{
                  width: SAYFA_LOGO_EN,
                  height: SAYFA_LOGO_EN * PARTNER_LOGO_RATIO,
                  objectFit: "contain",
                }}
              />
            ) : (
              <Text style={S.sayfaMarkaMetaGuclu}>{trUpper(brandName || "TEKLİF")}</Text>
            )}
            <View>
              <Text style={S.sayfaMarkaMeta}>
                REFERANS NO · <Text style={S.sayfaMarkaMetaGuclu}>{kunye.no}</Text>
              </Text>
              <Text style={S.sayfaMarkaMeta}>{kunye.alt}</Text>
            </View>
          </View>
          <View style={[S.sayfaKickerSatiri, { marginTop: mm(6) }]}>
            <View style={S.sayfaKickerCubugu} />
            <Text style={S.sayfaKicker}>{kicker}</Text>
          </View>
        </>
      ) : (
        <>
          <View
            style={
              technicalLogo === null
                ? S.sayfaKickerSatiri
                : [S.sayfaKickerSatiri, { paddingRight: TEKNIK_LOGO_EN + 12 }]
            }
          >
            <View style={S.sayfaKickerCubuguKucuk} />
            <Text style={S.sayfaKickerKucuk}>{kicker}</Text>
            <TeknikBaslikLogosu logo={technicalLogo} />
          </View>
          <View style={S.sayfaKurali} />
        </>
      )}
      <Text style={buyuk ? S.ticariBaslik : S.sayfaBaslik}>{baslik}</Text>
    </View>
  );
}

/**
 * BÖLÜM SONDASI — bir bölümün hangi sayfaya düştüğünü BİRİNCİ GEÇİŞTE bildirir.
 *
 * Kapaktaki içindekiler gerçek sayfa numaraları yazar; bir bölümün kaç yaprak
 * tuttuğu ancak yerleştirildikten sonra bilinir (`report.tsx` `SectionProbe`
 * ile aynı reçete). Sonda AKIŞ İÇİNDE, sıfır yükseklikli ve görünmezdir:
 * mutlak konumlu bir düğüm sayfa bölmede yerinde kalır ve hangi yaprağa
 * düştüğü sorulamazdı.
 *
 * SON YAZAN KAZANIR: @react-pdf sayfa bölerken dinamik düğümleri her aday
 * sayfa için yeniden çalıştırır; kesin numara yerleşim bittikten sonraki son
 * geçişten gelir.
 */
function Sonda({ anchor, collect }: { anchor: string; collect?: (a: string, p: number) => void }) {
  if (!collect) return null;
  return (
    <Text
      style={{ height: 0, fontSize: 1, lineHeight: 0, color: BRAND.white }}
      render={({ pageNumber }) => {
        collect(anchor, pageNumber);
        return "";
      }}
    />
  );
}

/**
 * BÖLÜM BAŞLIĞI — üstte şerit, altında harf aralıklı ad.
 *
 * BELGENİN HER BÖLÜMÜ AYNI BAŞLIĞI KULLANIR: teknik öbekler, teslim şartları,
 * ödeme, test yükü, fiyatlar, notlar, kapsam dışı işler. Devralınan düzende
 * ticari sayfanın başlıkları kalın kırmızı ve iki noktalıydı ("TEST YÜKÜ :"),
 * teknik sayfanınkiler ise şeritliydi; aynı belgenin iki yaprağı iki ayrı
 * belgeden çıkmış gibi duruyordu.
 *
 * `vurgu` sayfanın İLK bölümüne verilir: şerit ve ad kırmızı basılır. Sayfa
 * başına tek vurgu — bütün başlıklar kırmızı olsaydı vurgu vurgu olmaktan
 * çıkar, altı kırmızı satır sayfayı kendi başına bir listeye çevirirdi.
 */
function BolumBasligi({ text, vurgu }: { text: string; vurgu?: boolean }) {
  return (
    // Başlık sütun/sayfa dibinde YALNIZ kalmasın: altında en az iki satır yer
    // yoksa blok bir sonrakine taşınır (dağıtımın `EN_AZ_KUYRUK` karşılığı).
    <View style={vurgu ? [S.bolumSerit, S.bolumSeritVurgu] : [S.bolumSerit]} minPresenceAhead={40}>
      <Text style={[S.bolumAdi, ...(vurgu ? [S.bolumAdiVurgu] : [])]}>
        {trUpper(text)}
      </Text>
    </View>
  );
}

/**
 * TEKNİK ÖZELLİK SATIRI — etiket solda, değer sağa yaslı, altında ayırıcı.
 *
 * Etiket genişliği SABİT DEĞİLDİR: tek sütunda 148 pt'lik bir etiket sütunu
 * vardı ve 234,78 pt'lik bir sütunda o düzen değerin çoğunu sardırırdı.
 * Burada etiket kendi boyunu (en çok yarım sütun) alır, değer ARTAN yeri
 * kaplar. Ölçüm bu düzenle yapıldı (`pdf-layout.ts` `satirYuksekligi`) —
 * çizimi değiştirmek ölçüyü de geçersiz kılar.
 *
 * `wrap={false}`: iki satırlık bir değer sütun dibinde ikiye BÖLÜNMEZ.
 */
function OzellikSatiri({ row, buyuk, tam }: { row: OfferRow; buyuk?: boolean; tam?: boolean }) {
  const kapsam = offerScopeSuffix(row.scope);
  /* BÜYÜK HARF SUNUM KATMANINDADIR, VERİDE DEĞİL (kullanıcı isteği 19.08.2026,
     md. 18). `row.value` kullanıcının yazdığı metindir; teklif ekranında,
     analizde ve maliyet eşleşmesinde aynen kullanılır — büyütmeyi payload'a
     yazmak aynı bilgiyi iki yazımla saklamak olurdu. Birimler ve ölçüler
     korunur, gerekçesi `offers/buyuk.ts`te.

     TEKNİK SATIRLAR ile teslim/test satırları büyür. Ticari kullanım çağrı
     yerinde açıkça `buyuk` verir (TEKLIF-45); genel şart maddeleri ve serbest
     notlar bu yoldan geçmez. */
  const etiket = buyuk ? teknikEtiketBuyuk(row.label) : row.label;
  const kapasite = row.key === "capacity";
  const deger = buyuk
    ? kapasite
      ? teknikKapasiteDegerBuyuk(row.value)
      : teknikDegerBuyuk(row.value)
    : row.value;
  return (
    <View style={S.ozellikSatiri} wrap={false}>
      <Text style={tam ? [S.ozellikEtiket, S.ozellikEtiketTam] : S.ozellikEtiket}>{etiket}</Text>
      <Text style={kapasite ? [S.ozellikDeger, S.ozellikDegerGuclu] : S.ozellikDeger}>
        {deger}
        {kapsam ? <Text style={S.kapsamEki}>{buyuk ? trUpper(kapsam) : kapsam}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * SÜTUNDAKİ BİR BLOK — grup ya da grubun devamı.
 *
 * `vurgu` sayfanın İLK öbeğine verilir: şerit ve ad kırmızı basılır. Sayfa
 * başına tek vurgu — bütün başlıklar kırmızı olsaydı vurgu vurgu olmaktan
 * çıkar, altı kırmızı satır sayfayı kendi başına bir listeye çevirirdi.
 */
function SutunBloku({
  blok,
  vurgu,
  tam,
}: {
  blok: OfferPdfBlok;
  vurgu?: boolean;
  tam?: boolean;
}) {
  return (
    <View>
      <BolumBasligi text={blokBasligi(blok)} vurgu={vurgu} />
      {blok.rows.map((row, i) => (
        <OzellikSatiri key={row.key || i} row={row} buyuk tam={tam} />
      ))}
    </View>
  );
}

/**
 * BİR SÜTUN — dar (`SUTUN_GENISLIK`) ya da sayfa genişliğince (`tam`).
 *
 * İki yerleşim aynı bileşenden çıkar: tek sütunlu yaprakta değişen yalnız
 * GENİŞLİKTİR, blokların anatomisi değil. Ayrı bir "tam sayfa" çizimi
 * yazılsaydı bölüm başlığı, vurgu ve blok arası boşluk iki yerde yaşar,
 * birinde yapılan düzeltme ötekine geçmezdi.
 */
function Sutun({
  bloklar,
  tam,
  ilkVurgu,
}: {
  bloklar: OfferPdfBlok[];
  tam?: boolean;
  /** Sayfanın İLK öbeği kırmızı açılır — yalnız sol/tek sütuna verilir. */
  ilkVurgu?: boolean;
}) {
  return (
    <View style={tam ? S.sutunTam : S.sutun}>
      {bloklar.map((b, i) => (
        <View key={`${b.group.id}-${i}`} style={{ marginBottom: BLOK_ARA }}>
          <SutunBloku blok={b} vurgu={ilkVurgu && i === 0} tam={tam} />
        </View>
      ))}
    </View>
  );
}

/**
 * TEKNİK SAYFA — iki sütun.
 *
 * `wrap` AÇIK BIRAKILIR (varsayılan). `wrap={false}` verilseydi ölçü tahmini
 * yanıldığında react-pdf içeriği KIRPARDI: müşteriye giden belgede sessiz veri
 * kaybı. Açıkken taşan blok bir sonraki sayfaya iner — çirkin ama eksiksiz.
 */
function TeknikSayfa({
  docLine,
  baslik,
  kicker,
  kunye,
  sol,
  sag,
  tam,
  altBilgi,
  ustSonda,
  altSonda,
  watermarkLogo,
  brandLogo,
  technicalLogo,
}: {
  docLine: string;
  /** Sayfanın büyük başlığı: KALEMİN ADI. */
  baslik: string;
  kicker: string;
  kunye: SayfaKunyesi;
  sol: OfferPdfBlok[];
  sag: OfferPdfBlok[];
  /** Gövde tek sütuna sığdı: satırlar sayfa genişliğini kullanır. */
  tam?: boolean;
  altBilgi?: React.ReactNode;
  /** İçindekiler sondaları — yalnız bölümün İLK ve SON yaprağında verilir. */
  ustSonda?: React.ReactNode;
  altSonda?: React.ReactNode;
  watermarkLogo?: BrandBandLogo | null;
  /** `undefined` = ORION, `null` = logosuz partner, Buffer = partner logosu. */
  brandLogo?: Buffer | null;
  technicalLogo?: BrandBandLogo | null;
}) {
  return (
    <BrandPage docLine={docLine} brandFooter={{}} watermarkLogo={watermarkLogo}>
      {ustSonda}
      {/* BAŞLIK KALEMİN ADIDIR (kullanıcı bildirimi, 18.08.2026: *"burada
          başlık olarak 80T x 12.44m PORTAL VİNÇ yazması gerekiyor… yani kalem
          başlığından çekmesi gerek"*). Öbek adları bir gün başlığın yerini
          almıştı ve sayfanın hangi ekipmana ait olduğu ancak sağ üstteki
          küçük künyeden okunuyordu.

          AD OLDUĞU GİBİ BASILIR, büyütülmez: "80T x 12.44m" bir ürün adıdır
          ve birimleri küçük harfle yazılır — `trUpper` onu "12.44M" yapardı. */}
      <SayfaBasi
        kicker={kicker}
        baslik={baslik}
        kunye={kunye}
        brandLogo={brandLogo}
        technicalLogo={technicalLogo}
      />

      {/* TEK SÜTUN ya da İKİ SÜTUN — kararı `pdf-layout.ts` verir, burada
          yalnız çizilir. Kısa bir teknik gövde (kullanıcı bildirimi,
          01.09.2026) iki sütunda yaprağın sağ yarısını boş bırakıyordu; bir
          yaprağa tek sütunla sığıyorsa sayfa genişliğinin tamamı kullanılır.
          `sag` o durumda hep boştur. */}
      {tam ? (
        <Sutun bloklar={sol} tam ilkVurgu />
      ) : (
        <View style={S.sutunlar}>
          {/* Sayfanın ilk öbeği (sol sütunun başı) kırmızı açılır. */}
          <Sutun bloklar={sol} ilkVurgu />
          <Sutun bloklar={sag} />
        </View>
      )}
      {altBilgi}
      {altSonda}
    </BrandPage>
  );
}

/**
 * GENEL ŞARTLAR SAYFASI — belgenin sonunda, küçük ve silik.
 *
 * Kullanıcı isteği (18.08.2026, md. 9). NUMARA VERİDE DEĞİL, burada da
 * hesaplanmaz: `printedGeneralTerms` gizli maddeleri düşürdükten SONRA
 * numaralar. Gizlenen bir madde numarayı da götürür, yani belgede 1..N
 * kesintisizdir — "3. madde yok" diye okunan bir teklif, silinmiş bir şart
 * arattırırdı.
 *
 * İKİ SÜTUN DEĞİL TEK SÜTUN: şartlar bir okuma metnidir ve 6,6 pt'de 235 pt
 * genişlik satır başına ~38 karakter demektir — hukukî bir paragraf o
 * genişlikte okunmaz.
 */
function GenelSartlarSayfasi({
  docLine,
  kunye,
  maddeler,
  ustSonda,
  altSonda,
  watermarkLogo,
  brandLogo,
  brandName,
}: {
  docLine: string;
  kunye: SayfaKunyesi;
  maddeler: { no: number; title: string; body: string }[];
  ustSonda?: React.ReactNode;
  altSonda?: React.ReactNode;
  watermarkLogo?: BrandBandLogo | null;
  brandLogo?: Buffer | null;
  brandName?: string;
}) {
  if (maddeler.length === 0) return null;
  return (
    <BrandPage docLine={docLine} brandFooter={{}} watermarkLogo={watermarkLogo}>
      {ustSonda}
      <SayfaBasi
        kicker="EKLER"
        baslik={trUpper(GENERAL_TERMS_TITLE)}
        kunye={kunye}
        marka
        buyuk
        brandLogo={brandLogo}
        brandName={brandName}
      />
      {maddeler.map((m) => (
        <View key={m.no} style={S.sartMadde} wrap={false}>
          <Text style={S.sartBaslik}>
            {m.no}. {m.title}
          </Text>
          <Text style={S.sartGovde}>{m.body}</Text>
        </View>
      ))}
      {altSonda}
    </BrandPage>
  );
}

// ————————————————————————————————————————————————————————————— kapak
//
// KAPAK TASARIMI KULLANICININ KENDİ ÇALIŞMASIDIR (Claude Design, 22.08.2026)
// ve iki bölgeden oluşur: üstte kenardan kenara KÖMÜR BİR BANT (çapraz şerit
// dokusu + lockup + künye + konu + içindekiler), altta KAĞIT BİR BÖLGE
// (KİMDEN/KİME künyesi + hitap + firma beyanı + iş kolları). Kırmızı omurga
// ikisinin de üzerinden geçer.
//
// ÖLÇÜLER TASARIMDAN ÇEVRİLDİ, YENİDEN UYDURULMADI: tasarım CSS px'te
// çalışıyordu ve 210 mm'lik bir sayfada 1 px = 0,75 pt'tir. mm cinsinden
// verilen paylar (16/16/13/22) sayfanın kendi marjlarıyla zaten aynıydı.

/**
 * KAPAK BAŞLIĞININ PUNTOSU — konunun uzunluğuna göre kademeli.
 *
 * Başlık teklifin KONUSUDUR (TEKLIF-39) ve uzunluğu bir teklife göre değişir:
 * "80T x 12.44m PORTAL VİNÇ TEKLİFİ" 32 karakter, "MUHTELİF VİNÇLER — SEKİZ
 * KALEM İÇİN TEKNİK VE TİCARİ TEKLİF" 58. @react-pdf'te `maxLines` YOKTUR,
 * yani kırpma seçeneği de yok — punto kademelenir.
 *
 * Eşikler ÖLÇÜLDÜ: Archivo Black'te karakter ~0,62 em ve başlık kutusu 150 mm
 * (425 pt); 33 pt'de satıra ~21, 26 pt'de ~26, 21 pt'de ~33 karakter sığar.
 * Hedef EN ÇOK ÜÇ SATIRDIR — dördüncü satır kömür bandı kağıt bölgesinin
 * üstüne taşırırdı.
 */
function kapakBaslikPunto(konu: string): number {
  if (konu.length <= 42) return 33;
  if (konu.length <= 72) return 26;
  return 21;
}

/**
 * KAPAK KİCKER'I BELGENİN NE OLDUĞUNU SÖYLER — ve sabit değildir.
 *
 * Teknik yaprağı olmayan bir teklif (yalnız fiyat ve şartlar) "TEKNİK VE
 * TİCARİ TEKLİF" diye adlandırılamaz: kapakta vaat edilen bölüm belgede
 * yoktur. Ad, belgenin kendi içeriğinden çıkar.
 */
function kapakKickeri(payload: OfferPayload, ticariVar: boolean): string {
  if (payload.items.length > 0 && ticariVar) return "TEKNİK VE TİCARİ TEKLİF";
  if (payload.items.length > 0) return "TEKNİK TEKLİF";
  return "TİCARİ TEKLİF";
}

// ---- içindekiler
//
// BÖLÜM ADLARI TEK KAYNAKTIR: aynı metin hem içindekiler kartına hem sayfanın
// kicker'ına gider (kicker `trUpper` ile büyür). İki yere ayrı yazılsaydı biri
// değiştiğinde içindekiler var olmayan bir bölümü işaret ederdi.

export const OFFER_SECTIONS = {
  teknik: "Teknik Özellikler",
  ticari: "Ticari Şartlar ve Fiyatlar",
  /**
   * Bölümün KENDİ başlığı `GENERAL_TERMS_TITLE`dır (defterde, BÜYÜK HARF);
   * burada onun başlık yazımı durur. İki metin ayrışırsa içindekiler var
   * olmayan bir bölümü işaret eder — `offer.test.tsx` ayrışmayı engeller
   * (değişmez md. 8).
   */
  sartlar: "Genel Şartlar",
  /** Fiyat tablosu KENDİ yaprağına geçtiğinde açılan satır. */
  fiyat: "Fiyatlar",
} as const;

/**
 * FİYAT TABLOSUNUN TİCARİ SAYFADA DURABİLECEĞİ EN ÇOK SATIR SAYISI.
 *
 * Kullanıcı isteği (22.08.2026): *"Fiyatlar tablosunda 12 satıra kadar bu
 * dizayn uygulanabiliyor. Eğer 12 satırın üstünde bir fiyat kalemi varsa fiyat
 * tablosu ayrı sayfaya geçsin. Tablo ikiye bölünmesin."*
 *
 * EŞİK SAYFANIN KENDİ ÖLÇÜSÜNDEN GELİR: ticari sayfada başlık (~95 pt), teslim/
 * ödeme bloğu (~135 pt), notlar ve kapsam dışı işler (~90 pt) ve altbilgi
 * payı düşüldüğünde tabloya ~300 pt kalır; bir satır ~22 pt'dir. On üçüncü
 * satır tabloyu notların üstüne bindirir ya da @react-pdf tabloyu ikiye böler.
 */
export const FIYAT_SATIR_ESIGI = 12;

/**
 * FİYAT SATIRININ YÜKSEKLİĞİ SATIR SAYISINA GÖRE DEĞİŞİR.
 *
 * Kullanıcı isteği (22.08.2026): *"12 satır varsa 20 yükseklik, 4 satır varsa
 * 30 yükseklik olsun… az satır varken satırların sıkışık görünmesi mantıklı
 * değil."* Dört satırlık bir tablo, on iki satırlık bir tablonun sıkılığıyla
 * dizildiğinde sayfanın ortasında küçük ve ezik duruyordu.
 *
 * ÖLÇEKLENEN ŞEY PAYDIR, PUNTO DEĞİL: metni büyütmek tabloyu bir başlığa
 * çevirirdi; payı açmak yalnız nefes verir. Ara değerler DOĞRUSALDIR ve iki
 * uçta kelepçelenir — üç satırlık bir tablo dört satırlıktan daha havalı
 * olmaz, on beş satırlık on ikiden daha sıkı olmaz.
 *
 * ÜST SINIR EŞİKLE AYNI YERDE (12): o sayıdan sonra tablo zaten kendi
 * yaprağına geçer ve orada sıkı satır DAHA ÇOK satır demektir — yani tablonun
 * ikiye bölünme ihtimalinin azalması demektir (TEKLIF-54).
 */
const FIYAT_SATIR_BOYU = { azSatir: 4, azBoy: 30, cokSatir: FIYAT_SATIR_ESIGI, cokBoy: 20 } as const;

/** Bir satırlık tanım metninin yüksekliği (7,5 pt × 1,4 satır aralığı). */
const FIYAT_METIN_BOYU = 10.5;

/** Üstü çizili eski fiyatın yüksekliği (6 pt × 1,2 satır aralığı). */
const FIYAT_ESKI_BOYU = 7.2;

/**
 * SATIR PAYININ EN AZI — iki katmanlı hücrede bile satırlar birbirine yapışmaz.
 *
 * Kalem bazında iskonto basıldığında hücre yaklaşık yedi punto uzar ve hedef
 * boydan (20 pt) çıkan pay eksiye düşerdi. Kelepçe satırı hedefin birkaç punto
 * üstüne taşırır; taşma ölçülür ve tablo gerekirse kendi yaprağına geçer
 * (bkz. `renderOfferPdf`), yani pay uğruna okunmaz bir tablo basılmaz.
 */
const FIYAT_PAY_EN_AZ = 2.25;

/**
 * Satır sayısına düşen dikey pay — hedef boydan metin yüksekliği düşülür.
 *
 * `sik` verildiğinde satır sayısına bakılmaz ve en sıkı boy kullanılır: ticari
 * sayfa taştığında geniş satır bir lüks değil, ikinci bir yaprak demektir
 * (bkz. `OfferDocumentProps.compactPrices`).
 *
 * `iskontolu` ise fiyat hücreleri İKİ KATMANLIDIR (üstü çizili eski rakam +
 * geçerli rakam) ve hesaba giren metin yüksekliği o kadar büyür: pay aynı
 * kalsaydı satır boyu kendiliğinden yedi punto uzar, on iki satırlık bir tablo
 * ticari sayfayı taşırırdı.
 */
function fiyatSatirPayi(adet: number, sik?: boolean, iskontolu?: boolean): number {
  const { azSatir, azBoy, cokSatir, cokBoy } = FIYAT_SATIR_BOYU;
  const boy =
    sik || adet >= cokSatir
      ? cokBoy
      : adet <= azSatir
        ? azBoy
        : azBoy - ((adet - azSatir) * (azBoy - cokBoy)) / (cokSatir - azSatir);
  const metin = FIYAT_METIN_BOYU + (iskontolu ? FIYAT_ESKI_BOYU : 0);
  return Math.max(FIYAT_PAY_EN_AZ, (boy - metin) / 2);
}

interface OfferTocEntry {
  key: string;
  label: string;
}

/** Belgede GERÇEKTEN basılan bölümler — basılmayan bölüm listelenmez. */
function tocBolumleri(
  payload: OfferPayload,
  sartVar: boolean,
  fiyatAyriYaprakta: boolean,
  ticariVar: boolean,
  ticariEtiketi: string
): OfferTocEntry[] {
  const out: OfferTocEntry[] = [];
  if (payload.items.length > 0) out.push({ key: "teknik", label: OFFER_SECTIONS.teknik });
  if (ticariVar) out.push({ key: "ticari", label: ticariEtiketi });
  // Fiyat tablosu kendi yaprağına geçtiyse KENDİ SATIRINI da açar: müşteri
  // içindekilerde "Fiyatlar"ı arar ve o yaprak artık ticari sayfa değildir.
  if (fiyatAyriYaprakta) out.push({ key: "fiyat", label: OFFER_SECTIONS.fiyat });
  if (sartVar) out.push({ key: "sartlar", label: OFFER_SECTIONS.sartlar });
  return out;
}

const iki = (n: number) => String(n).padStart(2, "0");

/**
 * `S. 02–03` · `S. 04` — bölümün kapladığı yaprak aralığı.
 *
 * Numara İKİ GEÇİŞLE öğrenilir (`Sonda`); birinci geçişte henüz yoktur ve
 * aralık `S. —` basılır. UYDURULMAZ: bilinmeyen bir sayfa numarası yerine
 * tahmin yazmak, müşteriyi olmayan bir yaprağa göndermek olurdu.
 */
function sayfaAraligi(bas?: number, son?: number): string {
  if (!bas) return "S. —";
  return son && son > bas ? `S. ${iki(bas)}–${iki(son)}` : `S. ${iki(bas)}`;
}

function Icindekiler({
  bolumler,
  pageOf,
  ustPay,
}: {
  bolumler: OfferTocEntry[];
  pageOf?: Record<string, number>;
  ustPay: number;
}) {
  if (bolumler.length === 0) return null;
  return (
    <View style={[S.icindekiler, { marginTop: ustPay }]}>
      <Text style={S.icindekilerBaslik}>İÇİNDEKİLER</Text>
      <View style={S.icindekilerIzgara}>
        {bolumler.map((b, i) => (
          <View
            key={b.key}
            style={i === 0 ? [S.icindekilerKutu, S.icindekilerKutuVurgu] : [S.icindekilerKutu]}
          >
            <Text style={i === 0 ? [S.icindekilerSayfa, S.icindekilerSayfaVurgu] : [S.icindekilerSayfa]}>
              {sayfaAraligi(pageOf?.[`bas:${b.key}`], pageOf?.[`son:${b.key}`])}
            </Text>
            <Text style={S.icindekilerAd}>{b.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * KÖMÜR BANT — kapağın üst bölgesi.
 *
 * ŞERİT DOKUSU MUTLAK KONUMLUDUR VE KUTU ONU KIRPAR (`overflow: "hidden"`):
 * bandın yüksekliği içerikle belirlenir (başlık iki satır da olabilir üç de),
 * SVG ise sabit ölçülüdür. Doku bandın kesebileceğinden büyük verilir; eksik
 * verilseydi uzun bir konuda bandın dibinde dokusuz bir şerit kalırdı.
 *
 * Dokuyu taşıyan kutunun KENDİ PAYI YOKTUR; paylar iç kutudadır. Mutlak
 * konumlu bir çocuğun sıfır noktası kabın pay kenarına göre çözülür ve
 * dış kutuya pay verilseydi doku sağa/aşağı kayardı.
 */
function KapakBandi({
  offer,
  kicker,
  bolumler,
  pageOf,
  paylar,
  brandLogo,
  brandName,
}: {
  offer: OfferDocumentProps["offer"];
  kicker: string;
  bolumler: OfferTocEntry[];
  pageOf?: Record<string, number>;
  paylar: ReturnType<typeof kapakPaylari>;
  brandLogo?: Buffer | null;
  brandName: string;
}) {
  const rev = offerRevLabel(offer.revNo);
  const gun = tarih(offer.issueDate);
  const konu = trUpper(offer.subject.trim()) || "TEKLİF";
  return (
    <View style={S.bant}>
      <View style={S.bantDoku}>
        <StripeField width={SAYFA_EN} height={BANT_DOKU_BOY} />
      </View>
      <View style={[S.bantIc, { paddingBottom: paylar.bantAlt }]}>
        <View style={S.bantUst}>
          {/* KAĞIT RENKLİ LOCKUP: tam renkli logonun kırmızı kilidi kömür
              zeminde gömülür, "CRANES" grisi de kaybolurdu. */}
          {brandLogo === undefined ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image
              src={BRAND_LOGO_PAPER}
              style={{ width: KAPAK_LOGO_EN, height: KAPAK_LOGO_EN * LOGO_MONO_RATIO }}
            />
          ) : brandLogo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image
              src={brandLogo}
              style={{
                width: KAPAK_LOGO_EN,
                height: KAPAK_LOGO_EN * PARTNER_LOGO_RATIO,
                objectFit: "contain",
              }}
            />
          ) : (
            <Text style={[S.bantMetaGuclu, { fontSize: 12 }]}>{trUpper(brandName)}</Text>
          )}
          <View>
            <Text style={S.bantMeta}>
              REFERANS NO · <Text style={S.bantMetaGuclu}>{offer.offerNo}</Text>
            </Text>
            <Text style={S.bantMeta}>{rev ? `${rev} · TARİH · ${gun}` : `TARİH · ${gun}`}</Text>
          </View>
        </View>

        <View style={[S.bantKicker, { marginTop: paylar.bantKickerUst }]}>
          <View style={S.bantKickerCubugu} />
          <Text style={S.bantKickerYazi}>{kicker}</Text>
        </View>
        <Text style={[S.bantBaslik, { fontSize: kapakBaslikPunto(konu) }]}>{konu}</Text>
        {/* MÜŞTERİ ADI YALNIZ ADDIR: tasarımın şehir/ülke kuyruğu için canlı bir
            kaynak yok ve uydurma veri girilmez (değişmez md. 4). */}
        {offer.customerName.trim() ? (
          <Text style={S.bantMusteri}>{offer.customerName}</Text>
        ) : null}

        <Icindekiler bolumler={bolumler} pageOf={pageOf} ustPay={paylar.icindekilerUst} />
      </View>
    </View>
  );
}

/** Kömür banttaki lockup'ın genişliği — yüksekliği ~19,5 pt yapar. */
const KAPAK_LOGO_EN = 160;

/** Müşteri/partner logolarının yükleme sırasında normalize edildiği 900×240 tuval. */
const PARTNER_LOGO_RATIO = 240 / 900;

// ---- KİMDEN / KİME künyesi

interface KunyeTarafi {
  etiket: string;
  /** Kurumun adı — kartın büyük satırı. */
  ad: string;
  /** `Ad Soyad · Ünvan` — muhatap satırı; boşsa çizilmez. */
  kisi: string;
  /** Telefon, e-posta, müşteri referansı … — boş olanlar hiç girmez. */
  iletisim: string[];
}

/** BOŞ ALAN HİÇ ÇİZİLMEZ — yer tutucu bir değer değildir (SATIS-16). */
function birlestir(parcalar: (string | undefined)[], ayrac: string): string {
  return parcalar.map((p) => (p ?? "").trim()).filter(Boolean).join(ayrac);
}

/**
 * KÜNYE MARKASI — oranı BİLİNMEYEN bir görsel kutuya nasıl sığdırılır.
 *
 * Müşteri logosu yükleme sırasında 900 × 240 px'lik standart tuvale
 * normalleştirilir (TEKLIF-43) ve burada o tuval 120 × 32 pt çizilir; kartın
 * üst satırı da bu yüzden 32 pt yüksekliktedir. Bizim tarafımızda kelime
 * markası değil YALNIZ MONOGRAM durur — firma adı zaten kartın içinde yazılı.
 *
 * LOGO YOKSA HİÇBİR ŞEY ÇİZİLMEZ (boş bir yer tutucu bile): boş bir kutu,
 * kullanıcının istemediği "eksik" izlenimini verirdi.
 */
function KunyeMarkasi({ logo, monogram }: { logo?: Buffer | null; monogram?: boolean }) {
  if (monogram) {
    const boy = 19;
    return (
      // KİMDEN kartındaki kısa işaret marka kırmızısıdır. Raster "ink" varlığı
      // kömür renkti; var olan kurumsal SVG yolları React-PDF içinde vektör
      // olarak çizilir, böylece baskıda renk ve keskinlik korunur.
      <Svg viewBox="0 0 147.652 95.921" style={{ width: boy / SYMBOL_INK_RATIO, height: boy }}>
        <Path
          fill={BRAND.red}
          d="M47.393 1.826C56.099 1.983 64.655 4.729 72.248 10.403C73.229 11.136 73.521 11.608 72.625 12.688C69.038 17.007 66.414 21.89 64.471 27.149C63.797 28.973 63.786 28.969 62.372 27.736C52.85 19.432 39.976 19.318 31.005 27.791C24.187 34.23 21.919 42.284 24.719 51.283C27.505 60.238 33.784 65.777 43.095 67.222C57.375 69.439 69.61 58.781 69.694 44.368C69.817 23.237 85.097 5.25 106.122 2.318C122.745 0 136.354 5.919 146.77 19.127C147.652 20.244 147.444 20.805 146.324 21.541C141.771 24.533 137.243 27.565 132.771 30.674C131.684 31.429 131.226 31.22 130.432 30.264C124.423 23.025 116.652 20.049 107.502 22.046C98.123 24.092 92.33 30.231 89.903 39.542C89.086 42.675 89.509 45.887 89.113 49.051C87.28 63.72 79.992 74.868 67.109 81.946C41.668 95.921 10.533 81.195 4.724 52.673C0 29.48 16.186 6.172 39.579 2.471C41.928 2.099 44.283 1.823 47.393 1.826"
        />
        <Path
          fill={BRAND.red}
          d="M112.73 87.264C102.969 87.068 94.416 84.306 86.804 78.673C85.717 77.868 85.59 77.344 86.497 76.247C90.111 71.875 92.788 66.945 94.661 61.597C95.108 60.323 95.341 60.028 96.499 61.09C106.887 70.618 121.605 69.532 130.565 58.582C131.33 57.648 131.771 57.736 132.645 58.338C137.228 61.492 141.843 64.601 146.478 67.678C147.383 68.278 147.63 68.713 146.895 69.692C140.006 78.87 130.941 84.51 119.657 86.57C117.26 87.007 114.832 87.183 112.73 87.264"
        />
      </Svg>
    );
  }
  if (!logo) return null;
  // React PDF'nin Image bileşeni HTML `img` değildir ve `alt` özelliği
  // desteklemez; bu logo metinsel PDF içeriğinin yerine geçmez.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={logo} style={{ width: 120, height: 32 }} />;
}

function KunyeHucresi({
  taraf,
  marka,
  ayrac,
}: {
  taraf: KunyeTarafi;
  marka: React.ReactNode;
  /** Sol hücre sağ kenarına ayırıcı çizer; iki hücre TEK kutunun içindedir. */
  ayrac?: boolean;
}) {
  return (
    <View style={ayrac ? [S.kunyeHucre, S.kunyeHucreAyrac] : [S.kunyeHucre]}>
      <View style={S.kunyeUst}>
        <Text style={S.kunyeEtiket}>{taraf.etiket}</Text>
        {marka}
      </View>
      <Text style={S.kunyeAd}>{taraf.ad}</Text>
      {taraf.kisi ? <Text style={S.kunyeKisi}>{taraf.kisi}</Text> : null}
      {taraf.iletisim.length > 0 ? (
        <View style={S.kunyeIletisim}>
          {/* ANAHTAR SIRAYI DA TAŞIR: künyede artık telefon VE e-posta yan
              yana durur (md. 1) ve iki satırın metni birbirine eşit olabilir
              — yalnız metni anahtar yapmak yinelenen anahtar demekti. */}
          {taraf.iletisim.map((satir, i) => (
            <Text key={`${i}-${satir}`} style={S.kunyeIletisimSatiri}>
              {satir}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function KapakKunyesi({
  sol,
  sag,
  musteriLogosu,
  hazirlayanLogosu,
}: {
  sol: KunyeTarafi;
  sag: KunyeTarafi;
  musteriLogosu?: Buffer | null;
  /** `undefined` ORION monogramı, `null` logosuz partnerdir. */
  hazirlayanLogosu?: Buffer | null;
}) {
  return (
    <View style={S.kunyeKutu}>
      <KunyeHucresi
        taraf={sol}
        marka={
          hazirlayanLogosu === undefined ? (
            <KunyeMarkasi monogram />
          ) : (
            <KunyeMarkasi logo={hazirlayanLogosu} />
          )
        }
        ayrac
      />
      <KunyeHucresi taraf={sag} marka={<KunyeMarkasi logo={musteriLogosu} />} />
    </View>
  );
}

/**
 * FİRMA BEYANI VE İŞ KOLLARI — kapağın alt bölgesi (TEKLIF-46).
 *
 * Kırmızı 3 px kuralla açılır ve sayfanın dibine, altbilginin hemen üstüne
 * oturur; yerini `kapakEsnekBosluk` verir. Mutlak konum KULLANILMAZ: uzun bir
 * giriş geldiğinde esnek boşluk daralır ve iki metin üst üste binmez.
 *
 * `wrap={false}`: blok ikiye bölünüp yarısı ikinci bir yaprağa düşemez —
 * kapak TEK SAYFADIR.
 */
function FirmaTanitimi({
  paylar,
  company,
  partner,
}: {
  paylar: ReturnType<typeof kapakPaylari>;
  company: CompanyInfo;
  partner: boolean;
}) {
  if (partner) {
    const kimlik = birlestir(
      [
        company.address,
        company.phone ? `Tel: ${company.phone}` : "",
        company.fax ? `Faks: ${company.fax}` : "",
        company.taxOffice ? `Vergi Dairesi: ${company.taxOffice}` : "",
        company.taxNo ? `Vergi No: ${company.taxNo}` : "",
        company.email,
        company.web,
      ],
      " · "
    );
    return (
      <View style={S.tanitim} wrap={false}>
        <Text style={S.tanitimBaslik}>TEKLİFİ HAZIRLAYAN FİRMA</Text>
        <Text style={[S.tanitimGovde, { marginTop: 5 }]}>{company.company}</Text>
        {kimlik ? <Text style={[S.tanitimGovde, { marginTop: 3 }]}>{kimlik}</Text> : null}
      </View>
    );
  }
  return (
    <View style={S.tanitim} wrap={false}>
      <Text style={[S.tanitimGovde, { marginBottom: paylar.tanitimGovdeAlt }]}>
        {COMPANY_PROFILE.body}
      </Text>
      {/* İŞ KOLLARI EN SIKIŞIK KADEMEDE DÜŞER (tasarımın kendi anahtarı):
          kapağın en uzun ve en az kritik bloğudur — firmanın BEYANI kalır,
          listesi düşer. Alternatif, ikinci bir yaprağa taşan bir kapaktı. */}
      {paylar.isKollariVar ? (
        <>
          <Text style={S.tanitimBaslik}>{COMPANY_PROFILE.linesTitle}</Text>
          <View style={S.isKollari}>
            {COMPANY_PROFILE.lines.map((satir) => (
              <View key={satir} style={[S.isKolu, { paddingBottom: paylar.isKoluAlt }]}>
                <View style={S.isKoluIsareti} />
                <Text style={S.isKoluYazi}>{satir}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function KapakSayfasi({
  offer,
  payload,
  company,
  customerLogo,
  issuerLogo,
  signatureImages,
  bolumler,
  pageOf,
  coverDensity = 0,
}: OfferDocumentProps & {
  payload: OfferPayload;
  bolumler: OfferTocEntry[];
}) {
  const { cover } = payload;
  const paylar = kapakPaylari(coverDensity);
  const partner = payload.issuer.customerId !== null;
  const brandName = company.company || "ORION CRANES";

  // KİMDEN: bizim kurumumuz, kişimiz ve iletişimimiz. KİME: müşteri, muhatap
  // ve onun numaraları. Boş kalan her alan künyeye hiç girmez (TEKLIF-36).
  const sol: KunyeTarafi = {
    etiket: "KİMDEN",
    ad: company.company,
    kisi: birlestir([cover.fromName, cover.fromTitle], " · "),
    // Partner teklifinde ORION kullanıcısının e-posta alanı partner markasına
    // sızmaz; partnerin snapshot e-postası varsa o basılır.
    iletisim: [company.phone, partner ? company.email : cover.fromEmail]
      .map((v) => (v ?? "").trim())
      .filter(Boolean),
  };
  const sag: KunyeTarafi = {
    etiket: "KİME",
    ad: offer.customerName,
    kisi: birlestir([cover.toName, cover.toDept], " · "),
    iletisim: [
      cover.toPhone.trim(),
      // E-POSTA TELEFONLA AYNI SÜTUNDA, KENDİ SATIRINDA (md. 1). KİMDEN
      // tarafında da telefon ve e-posta iki ayrı satırdır; muhatabınkini tek
      // satıra sıkıştırmak iki tarafı ayrıştırırdı.
      cover.toEmail.trim(),
      // MÜŞTERİ REFERANSI MUHATABIN NUMARASIDIR, bizim künyemizin değil:
      // müşterinin kendi talep/sipariş numarası KİME tarafında durur.
      cover.customerRef.trim() ? `MÜŞTERİ REF · ${cover.customerRef.trim()}` : "",
    ].filter(Boolean),
  };

  return (
    <BrandPage
      bleed
      docLine={altbilgi(offer, false, brandName)}
      brandFooter={{ note: birlestir([company.address, company.phone, company.email, company.web], " · ") }}
    >
      <KapakBandi
        offer={offer}
        kicker={kapakKickeri(payload, bolumler.some((bolum) => bolum.key !== "teknik"))}
        bolumler={bolumler}
        pageOf={pageOf}
        paylar={paylar}
        brandLogo={partner ? issuerLogo ?? null : undefined}
        brandName={brandName}
      />

      <View style={[S.kagit, { paddingTop: paylar.kagitUst }]}>
        <KapakKunyesi
          sol={sol}
          sag={sag}
          musteriLogosu={customerLogo}
          hazirlayanLogosu={partner ? issuerLogo ?? null : undefined}
        />

        <View style={[S.hitapBlogu, { marginTop: paylar.hitapUst }]}>
          {cover.greeting.trim() ? <Text style={S.hitap}>{cover.greeting}</Text> : null}
          {cover.intro.trim() ? <Text style={S.giris}>{cover.intro}</Text> : null}
          <Text style={S.saygi}>Saygılarımızla,</Text>
          {/* İMZA BLOĞU BOŞSA ÇİZİLMEZ: imzasız bir imza yeri, belgenin eksik
              kaldığını söyler. Muhatap zaten KİMDEN kartında yazılıdır; blok
              yalnız kullanıcı ayrıca imzacı girdiyse basılır. */}
          {cover.signatories.length > 0 ? (
            <View style={S.imzalar}>
              {cover.signatories.map((s, i) => (
                <View key={`${s.name}-${i}`}>
                  {s.signaturePath && signatureImages?.[s.signaturePath] ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={signatureImages[s.signaturePath]} style={S.imzaGorsel} />
                  ) : null}
                  <Text style={S.imzaAd}>{s.name}</Text>
                  {s.title.trim() ? <Text style={S.imzaUnvan}>{s.title}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={[S.kapakEsnekBosluk, { minHeight: paylar.boslukEnAz }]} />
        <FirmaTanitimi paylar={paylar} company={company} partner={partner} />
      </View>
    </BrandPage>
  );
}

// ————————————————————————————————————————————————————————————— bloklar

/**
 * TİCARİ BLOK BAŞLIĞI — 3 pt şerit + mono etiket, altında beyaz kutu.
 *
 * `vurgu` bloğu kırmızı açar. SAYFA BAŞINA TEK VURGU: teslim şartları ve
 * fiyatlar kırmızı, ödeme planı ile test yükü kömürdür — hepsi kırmızı olsaydı
 * vurgu vurgu olmaktan çıkardı.
 */
function TicariBlokBasligi({ text, vurgu }: { text: string; vurgu?: boolean }) {
  return (
    <View style={vurgu ? [S.blokSerit, S.blokSeritVurgu] : [S.blokSerit]}>
      <Text style={vurgu ? [S.blokEtiket, S.blokEtiketVurgu] : [S.blokEtiket]}>{trUpper(text)}</Text>
    </View>
  );
}

/**
 * TESLİM ŞARTLARI — etiket/değer çizelgesi, beyaz kutunun içinde.
 *
 * Ödeme satırı burada YOKTUR: o, kendi bloğuyla sağ sütuna geçti (TEKLIF-40).
 * Devralınan düzende ödeme planı "Ödeme :" satırının altında girintili küçük
 * satırlardı ve teklifin en çok bakılan iki rakamı sayfanın en silik yerindeydi.
 */
function TeslimSartlari({ payload }: { payload: OfferPayload }) {
  const rows = payload.terms.rows.filter((r) => r.key !== "payment");
  if (rows.length === 0) return null;
  return (
    <View>
      <TicariBlokBasligi text={TESLIM_BASLIK} vurgu />
      <View style={S.kutu}>
        {rows.map((row, i) => (
          <View
            key={row.key || i}
            style={i === rows.length - 1 ? [S.kutuSatiri, S.kutuSonSatir] : [S.kutuSatiri]}
            wrap={false}
          >
            <Text style={S.sartEtiket}>{teknikEtiketBuyuk(row.label)}</Text>
            <Text style={S.sartDeger}>
              {teknikDegerBuyuk(row.value)}
              {offerScopeSuffix(row.scope) ? (
                <Text style={S.kapsamEki}>{trUpper(offerScopeSuffix(row.scope))}</Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "%40 Avans Sipariş ile Nakit" → oran ve açıklama; oran yoksa `null`. */
const ODEME_ORANI = /^\s*(%\s*\d+(?:[.,]\d+)?)\s*(.*)$/;

/**
 * Ödeme bloğu basılacak mı — sayfa düzeni de buna bakar.
 *
 * YALNIZ PLANIN KENDİSİNE bakar. Ticari şart satırlarındaki `payment` alanı
 * defterden gelen bir GİRİŞ CÜMLESİdir ("Ödeme şekli aşağıda belirtilen
 * şekildedir") ve artık basılmıyor (bkz. `Odeme`); ona bakmak, planı olmayan
 * bir teklifte boş bir kutu açtırırdı.
 */
function odemeVar(payload: OfferPayload): boolean {
  return payload.terms.paymentLines.length > 0;
}

/**
 * ÖDEME PLANI — oran solda ve büyük, satırın sol kenarında bir omuz.
 *
 * Oran METİNDEN OKUNUR, ayrı bir alandan değil: ödeme satırları serbest
 * metindir ("%40 Avans Sipariş ile Nakit") ve on dört devralınan teklifin
 * hepsinde bu yazımdadır. Veriye ayrı bir "yüzde" alanı açmak, kullanıcının
 * yazdığı metinle çelişebilecek ikinci bir gerçek üretirdi; okumak çelişemez.
 * Yazım tutmazsa satır olduğu gibi basılır — bilgi kaybolmaz.
 *
 * GİRİŞ CÜMLESİ BASILMAZ (kullanıcı isteği, 22.08.2026). Defterden gelen
 * "Ödeme şekli aşağıda belirtilen şekildedir." satırı, hemen üstündeki
 * ÖDEME PLANI başlığının söylediğini ikinci kez söylüyordu; kutunun altında
 * asılı kalan gri bir cümleydi. Satır payload'da durmaya devam eder (defterin
 * alanıdır), belgede yeri yoktur.
 */
function Odeme({ payload }: { payload: OfferPayload }) {
  if (!odemeVar(payload)) return null;
  const lines = payload.terms.paymentLines;
  return (
    <View>
      <TicariBlokBasligi text={ODEME_BASLIK} />
      <View style={S.kutu}>
          {lines.map((l, i) => {
            const buyuk = trUpper(l.text);
            const m = ODEME_ORANI.exec(buyuk);
            // İLK TAKSİTİN OMZU KIRMIZI: plan bir SIRADIR ve gözün nereden
            // başlayacağı belli olmalıdır.
            return (
              <View
                key={l.id}
                style={[
                  S.odemeSatiri,
                  ...(i === 0 ? [S.odemeSatiriIlk] : []),
                  ...(i === lines.length - 1 ? [S.kutuSonSatir] : []),
                ]}
                wrap={false}
              >
                {m ? (
                  <>
                    <Text style={i === 0 ? [S.odemeOran, S.odemeOranIlk] : [S.odemeOran]}>
                      {m[1].replace(/\s+/g, "")}
                    </Text>
                    <Text style={S.odemeAciklama}>{m[2]}</Text>
                  </>
                ) : (
                  <Text style={S.odemeAciklama}>{buyuk}</Text>
                )}
              </View>
            );
          })}
      </View>
    </View>
  );
}

/** Test yükü bloğu basılacak mı — sayfa düzeni de buna bakar. */
function testYukuVar(payload: OfferPayload): boolean {
  return payload.testLoad.enabled && payload.testLoad.rows.length > 0;
}

function TestYuku({ payload }: { payload: OfferPayload }) {
  const { testLoad } = payload;
  if (!testYukuVar(payload)) return null;
  const rows = testLoad.rows;
  return (
    <View>
      <TicariBlokBasligi text={testLoad.title} />
      <View style={S.kutu}>
        {rows.map((row, i) => (
          <View
            key={row.key || i}
            style={i === rows.length - 1 ? [S.kutuSatiri, S.kutuSonSatir] : [S.kutuSatiri]}
            wrap={false}
          >
            <Text style={S.sartEtiket}>{teknikEtiketBuyuk(row.label)}</Text>
            <Text style={S.testDeger}>
              {teknikDegerBuyuk(row.value)}
              {offerScopeSuffix(row.scope) ? (
                <Text style={S.kapsamEki}>{trUpper(offerScopeSuffix(row.scope))}</Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ————————————————————————————————————————————————————————————— fiyat tablosu

/**
 * FİYAT TABLOSUNUN SÜTUNLARI — TEK ŞEMA, tek yerde.
 *
 * Genişlikler SABİT PT'DİR (tanım sütunu hariç): tutarlar yedi haneli olabilir
 * ("1.575.000 €") ve yüzdeyle bölünen bir ızgarada o değer ikinci satıra iner.
 * Tanım kalan yeri kaplar ve yalnız o sarar.
 */
interface FiyatSutunu {
  key: "no" | "tanim" | "teslim" | "adet" | "birim" | "toplam";
  baslik: string;
  /** Sabit genişlik (pt); `null` = kalan alanı kaplayan sütun. */
  en: number | null;
}

/**
 * TESLİM SÜRESİ SÜTUNU OPSİYONELDİR ve ADET'İN SOLUNDA durur.
 *
 * Kullanıcı isteği (22.08.2026): *"Fiyat tablosunda Adet'in soluna Teslim
 * Süresi sütunu açılsın… dar bir sütun olsun. Bu opsiyonel olacak."* Birim
 * SÜTUN BAŞLIĞINDADIR ("TESLİM (HAFTA)"): her satıra "hafta" yazmak dar bir
 * sütunu okunmaz yapardı ve zaten tek bir birim geçerlidir.
 */
function fiyatSutunlari(birim: OfferLeadTimeUnit | null | undefined): FiyatSutunu[] {
  return [
    { key: "no", baslik: "NO", en: 24 },
    { key: "tanim", baslik: "TANIMI", en: null },
    ...(birim ? [{ key: "teslim" as const, baslik: `TESLİM\n(${trUpper(birim)})`, en: 52 }] : []),
    { key: "adet", baslik: "ADET", en: 62 },
    { key: "birim", baslik: "BİRİM FİYAT", en: 63 },
    { key: "toplam", baslik: "TOPLAM FİYAT", en: 69 },
  ];
}

/** Sütunun yerleşim stili — sabit genişlik ya da kalan alan. */
function sutunStili(s: FiyatSutunu) {
  return s.en === null
    ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 }
    : { width: s.en, flexGrow: 0, flexShrink: 0 };
}

/** Fiyat satırının tanımı: `*` (toplam dışı) ve `(Opsiyonel)` kuyruğu ile. */
function fiyatTanimi(line: OfferPriceLine): string {
  const govde = line.optional ? `${line.description} (Opsiyonel)` : line.description;
  return line.inTotal ? govde : `* ${govde}`;
}

function adetHucresi(line: OfferPriceLine): string {
  if (line.qty === null) return line.unit.trim();
  return `${fmtNum(line.qty)} ${line.unit}`.trim();
}

/** Ara toplam şeridi — TOPLAM ve İSKONTO, açık zeminde, sağa yaslı. */
function AraToplam({
  baslik,
  tutar,
  currency,
  ustuCizili,
}: {
  baslik: string;
  tutar: number | null;
  currency: string;
  /** ARTIK GEÇERLİ OLMAYAN rakam — üstü çizili ve bir kademe küçük basılır. */
  ustuCizili?: boolean;
}) {
  return (
    <View style={S.toplamAra} wrap={false}>
      <Text style={S.toplamAraEtiket}>{baslik}</Text>
      <Text style={ustuCizili ? S.toplamAraUstuCizili : S.toplamAraTutar}>
        {tutar === null ? "—" : fmtMoney(tutar, currency)}
      </Text>
    </View>
  );
}

/**
 * ÖDENECEK RAKAMIN ŞERİDİ — kömür zemin, mercan etiket, tablonun en büyük yazısı.
 *
 * KDV rozeti ve altındaki cümle AYNI BAYRAKTAN türer (`vatIncluded`): belgede
 * iki çelişen KDV cümlesinin yan yana durması devralınan tekliflerin gerçek
 * hatasıydı.
 */
function ToplamSeridi({
  baslik,
  tutar,
  currency,
  vatIncluded,
}: {
  baslik: string;
  tutar: number | null;
  currency: string;
  vatIncluded: boolean;
}) {
  return (
    <View style={S.toplamSerit} wrap={false}>
      <Text style={S.toplamEtiket}>{baslik}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}>
        <Text style={S.toplamKdv}>{vatBadge(vatIncluded)}</Text>
        <Text style={S.toplamTutar}>{tutar === null ? "—" : fmtMoney(tutar, currency)}</Text>
      </View>
    </View>
  );
}

function FiyatTablosu({
  payload,
  currency,
  kendiYapraginda,
  sik,
}: {
  payload: OfferPayload;
  currency: string;
  /** Ticari sayfa taştığında satırlar en sıkı boya iner (ölçülür, seçilmez). */
  sik?: boolean;
  /**
   * Tablo KENDİ yaprağındaysa "FİYATLAR" zaten sayfanın büyük başlığıdır;
   * şeritte ikinci kez yazılmaz, yalnız para birimi kalır.
   */
  kendiYapraginda?: boolean;
}) {
  const lines = payload.pricing.lines;
  if (lines.length === 0) return null;
  const siralar = priceLineNumbers(lines);
  const toplam = offerTotal(lines);
  const toplamDisiVar = lines.some((l) => !l.inTotal);
  // İSKONTO belgeye ancak satır toplamından FARKLIYSA girer; `discountAmount`
  // bu farkı zaten `null`a çevirir.
  const iskonto = discountAmount(payload.pricing);
  const iskontoOrani = discountPercent(payload.pricing);
  const iskontolu = iskonto === null ? null : payload.pricing.discountTotal ?? null;
  // KALEM BAZINDA İSKONTO (kullanıcı isteği, 22.08.2026): fatura satır satır
  // kesileceği için kalem fiyatları da iskontolu hâlleriyle görünür. Rakamlar
  // burada üretilmez; `discountedLines` toplamı birebir tutan sayıları verir.
  const satirIskontosu = discountedLines(payload.pricing);
  const birim = payload.pricing.leadTimeUnit ?? null;
  const sutunlar = fiyatSutunlari(birim);
  const vatIncluded = payload.pricing.vatIncluded;
  // SATIR PAYI TABLONUN KENDİ BOYUNDAN ÇIKAR (bkz. `FIYAT_SATIR_BOYU`).
  // Kendi yaprağındaki tablo hiç sıkışmaz: orada yer sorunu yoktur.
  const satirPayi = fiyatSatirPayi(lines.length, sik && !kendiYapraginda, satirIskontosu.size > 0);

  return (
    <View style={{ marginTop: kendiYapraginda ? 0 : mm(6) }}>
      <View style={S.fiyatUst}>
        {kendiYapraginda ? null : (
          <Text style={[S.blokEtiket, S.blokEtiketVurgu, { marginRight: "auto" }]}>
            {FIYAT_BASLIK}
          </Text>
        )}
        {/* PARA BİRİMİ BİR KEZ, BAŞLIKTA: her tutara sembol basmak tabloyu
            gürültüye çeviriyordu ve teklifin TEK para birimi vardır. */}
        <Text style={S.fiyatParaBirimi}>PARA BİRİMİ · {trUpper(currency)}</Text>
      </View>

      <View style={S.fiyatKutu}>
        {/* Başlık satırı HER SAYFADA tekrar eder: on dokuz satırlık bir tabloda
            ikinci sayfada hangi sütunun ne olduğu hatırlanmak zorunda değildir. */}
        <View style={S.fiyatBaslikSatiri} fixed>
          {sutunlar.map((s) => (
            <Text
              key={s.key}
              style={[S.fiyatBaslik, sutunStili(s), s.key === "no" || s.key === "tanim" ? {} : { textAlign: "right" }]}
            >
              {s.baslik}
            </Text>
          ))}
        </View>

        {lines.map((line, i) => {
          const tutar = lineAmount(line);
          const indirimli = satirIskontosu.get(line.id) ?? null;
          const ana = siralar[i].level === 0;
          const son = i === lines.length - 1;
          return (
            <View
              key={line.id}
              style={[
                S.fiyatSatiri,
                { paddingVertical: satirPayi },
                ...(ana ? [S.fiyatSatiriAna] : []),
                ...(son ? [S.kutuSonSatir] : []),
              ]}
              wrap={false}
            >
              {sutunlar.map((s) => {
                const yerlesim = sutunStili(s);
                if (s.key === "no")
                  return (
                    <Text key={s.key} style={[S.fiyatNo, yerlesim, ...(ana ? [S.fiyatNoAna] : [])]}>
                      {siralar[i].label}
                    </Text>
                  );
                if (s.key === "tanim")
                  return (
                    <Text
                      key={s.key}
                      style={[
                        S.fiyatTanim,
                        yerlesim,
                        ...(ana ? [S.fiyatTanimAna] : [S.fiyatTanimAlt]),
                      ]}
                    >
                      {trUpper(fiyatTanimi(line))}
                    </Text>
                  );
                if (s.key === "teslim")
                  return (
                    <Text key={s.key} style={[S.fiyatVeri, yerlesim]}>
                      {(line.leadTime ?? "").trim()}
                    </Text>
                  );
                if (s.key === "adet")
                  return (
                    <Text key={s.key} style={[S.fiyatVeri, yerlesim]}>
                      {trUpper(adetHucresi(line))}
                    </Text>
                  );
                // İSKONTOLU SATIRDA HÜCRE İKİ KATMANLIDIR: üstte üstü çizili
                // eski rakam, ALTINDA ödenecek olan. Sıra kullanıcının kendi
                // tarifidir ("normal fiyatın üstünü çizsin, altına iskontolu
                // fiyat yazsın") ve okuma yönüyle de uyumludur — göz son
                // gördüğü rakamı geçerli sayar.
                if (s.key === "birim")
                  return indirimli ? (
                    <View key={s.key} style={[S.fiyatYigin, yerlesim]}>
                      <Text style={S.fiyatEski}>{fmtMoney(line.unitPrice, currency)}</Text>
                      <View style={S.fiyatGecerliSatir}>
                        <Text style={S.fiyatVeri}>{fmtMoney(indirimli.unitPrice, currency)}</Text>
                        {indirimli.discountPercent !== null ? (
                          <Text style={S.fiyatIskonto}>
                            %{String(indirimli.discountPercent).replace(".", ",")}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <Text key={s.key} style={[S.fiyatVeri, yerlesim]}>
                      {line.unitPrice === null ? "—" : fmtMoney(line.unitPrice, currency)}
                    </Text>
                  );
                if (indirimli)
                  return (
                    <View key={s.key} style={[S.fiyatYigin, yerlesim]}>
                      <Text style={S.fiyatEski}>{fmtMoney(tutar, currency)}</Text>
                      <Text style={S.fiyatTutar}>{fmtMoney(indirimli.amount, currency)}</Text>
                    </View>
                  );
                // TOPLAM HÜCRESİ BOŞ KALIR (tire bile değil): satır toplama
                // girmiyorsa orada gösterilecek bir sayı YOKTUR ve bir tire
                // "hesaplanamadı" diye okunurdu.
                return (
                  <Text key={s.key} style={[S.fiyatTutar, yerlesim]}>
                    {!line.inTotal ? "" : tutar === null ? "—" : fmtMoney(tutar, currency)}
                  </Text>
                );
              })}
            </View>
          );
        })}

        {/*
          İSKONTO SATIRLARI YALNIZ FARK VARSA BASILIR (kullanıcı isteği,
          17.08.2026). Kullanıcı iskontoyu birim fiyatlara YANSITTIYSA tablodaki
          rakamlar zaten iskontoludur ve satır toplamı hedefe eşittir; o durumda
          ayrıca "İSKONTOLU TOPLAM" yazmak aynı sayıyı iki kez basmak, üstüne de
          müşteriye ikinci bir indirim vaat etmek gibi okunurdu.

          ÖDENECEK RAKAM KÖMÜR ŞERİTTEDİR: iskonto varsa o İSKONTOLU TOPLAM'dır.
        */}
        {iskonto !== null && iskontolu !== null ? (
          <>
            {/* ESKİ FİYAT ÜSTÜ ÇİZİLİ, YENİSİ YERİNE (kullanıcı isteği,
                22.08.2026: *"yapılan iskonto görünsün istiyorum. Mevcut fiyat
                üstü çizili küçük yazabilir. Yeni iskontolu fiyat yerine
                yazabilir."*). İskontonun kendisi ayrı bir satır olarak KALIR:
                üstü çizili rakam "ne kadar indirim yapıldı" sorusunu ancak
                çıkarma yaparak cevaplar, satır ise doğrudan söyler. */}
            <AraToplam baslik="TOPLAM" tutar={toplam} currency={currency} ustuCizili />
            <AraToplam
              baslik={`İSKONTO${
                iskontoOrani === null
                  ? ""
                  : ` (%${iskontoOrani.toFixed(2).replace(/\.00$/, "").replace(".", ",")})`
              }`}
              tutar={-iskonto}
              currency={currency}
            />
            <ToplamSeridi
              baslik="İSKONTOLU TOPLAM"
              tutar={iskontolu}
              currency={currency}
              vatIncluded={vatIncluded}
            />
          </>
        ) : (
          <ToplamSeridi baslik="TOPLAM" tutar={toplam} currency={currency} vatIncluded={vatIncluded} />
        )}
      </View>

      {/* Dipnot YALNIZ böyle bir satır varsa basılır. */}
      {toplamDisiVar ? <Text style={S.dipnot}>* Toplam fiyata dahil değildir.</Text> : null}
      {/* KDV cümlesi rozetle AYNI bayraktan türer; ikisi çelişemez. */}
      <Text style={S.kdvNotu}>{vatNote(vatIncluded)}</Text>
    </View>
  );
}

/**
 * NOTLAR / KAPSAM DIŞI İŞLER — kare madde işaretli iki sütun.
 *
 * Notlar KIRMIZI, kapsam dışı işler GRİ madde işareti taşır: biri teklifin
 * kendi sözü, öteki teklifin DIŞINDA kalanların listesidir ve okurun ikisini
 * karıştırmaması gerekir.
 */
function MetinBlogu({
  baslik,
  satirlar,
  silik,
}: {
  baslik: string;
  satirlar: readonly { id: string; text: string }[];
  silik?: boolean;
}) {
  if (satirlar.length === 0) return null;
  return (
    <View style={S.altSerit}>
      <Text style={S.altBaslik}>{trUpper(baslik)}</Text>
      {satirlar.map((l) => (
        <View key={l.id} style={S.maddeSatiri} wrap={false}>
          <View style={silik ? [S.maddeIsareti, S.maddeIsaretiSilik] : [S.maddeIsareti]} />
          <Text style={S.maddeYazi}>{l.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ————————————————————————————————————————————————————————————— belge

/**
 * SÜTUN KAPASİTESİ — bir teknik sayfada bir sütuna sığan yükseklik (pt).
 *
 * İçerik alanı 745,69 pt; sayfa başlığı bloğu (kicker satırı 8,4 + 2 pay,
 * kalem adı 17,25, kural 5 pay + 1,4, blok altı 9) ~43 pt harcar ve 45
 * yazılır — fazla ölçmek seçilmiş yöndür. Kalanı `pdf-layout` ayrıca %94 ile
 * kelepçeler.
 *
 * BAŞLIĞA KURAL EKLENDİĞİNDE (22.08.2026) BÜTÇE KORUNDU: kicker ile ad
 * arasındaki paylar kısaldı ve blok altı 12'den 9'a indi; kural bedavaya
 * gelmedi ama kapasiteden de bir pt almadı. Buraya dokunan herkes aynı
 * hesabı yeniden yapmak zorundadır — bir teknik sayfa 1 pt yüzünden ikiye
 * bölünür.
 *
 * ÖBEK DİZİNİ KALKINCA 7 PT GERİ GELDİ (md. 19) ve o yedi puan boşa gitmedi:
 * etiketler büyük harfe döndüğü için (md. 18) `ETIKET_KATSAYI` 0,46'dan
 * 0,62'ye çıktı ve satırlar genişledi. Aynı vinç gövdesi tek yaprakta ancak bu
 * iki değişiklik BİRLİKTE kalıyor.
 */
const PDF_SUTUN_KAPASITE = 745.69 - 53;

/** Sayfa sırası için romen rakamı — "TEKNİK ÖZELLİKLER · II". */
function romen(n: number): string {
  const t = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return t[n] ?? String(n);
}

/** ORION seçiliyken altbilgi satırının ilk parçası. */
const MARKA_ADI = "ORION CRANES";

/**
 * ALTBİLGİ DOKÜMAN SATIRI — her yaprakta, markayla açılır.
 *
 * `ORION CRANES · TETR-20260127-1 · REV 02 · 27.01.2026 · HABAŞ DÖRTYOL 20T VİNÇ`
 *
 * Müşteri belgenin BİR YAPRAĞINI tek başına fotoğraflasa bile kimin, hangi
 * teklifinin, hangi revizyonunun, hangi işi olduğu okunabilmelidir; devralınan
 * belgelerde iç sayfalar bağlamsızdı.
 *
 * KAPAKTA KONU DÜŞER (`konuVar = false`): konu zaten kapağın 33 pt'lik
 * başlığıdır ve altbilgide tekrarı, aynı sözü aynı yaprakta iki kez söylemek
 * olurdu (hesap raporunun `coverDocLineFor` kuralıyla aynı gerekçe).
 */
function altbilgi(
  offer: OfferDocumentProps["offer"],
  konuVar: boolean,
  markaAdi = MARKA_ADI
): string {
  const konu = offer.subject.trim();
  const parcalar = [trUpper(markaAdi), offerDocLine(offer.offerNo, offer.revNo), tarih(offer.issueDate)];
  if (konuVar && konu) parcalar.push(trUpper(konu));
  return parcalar.join(" · ");
}

/**
 * KAPAKTAN SONRAKİ İLK BÖLÜMÜN AÇILDIĞI YAPRAK — kapağın kaç sayfa tuttuğunun
 * ÖLÇÜSÜ. Kapak tek yapraksa 2'dir; 3 ise kapak taşmış demektir.
 *
 * Bölüm listesi burada yeniden kurulmaz: toplanan bütün `bas:` çapalarının en
 * küçüğü, hangi bölümlerin basıldığından bağımsız olarak belgenin kapaktan
 * sonraki ilk yaprağıdır.
 */
function ilkBolumSayfasi(pageOf: Record<string, number>): number {
  const baslar = Object.entries(pageOf)
    .filter(([anchor]) => anchor.startsWith("bas:"))
    .map(([, page]) => page);
  return baslar.length > 0 ? Math.min(...baslar) : 2;
}

export function OfferDocument(props: OfferDocumentProps): React.ReactElement {
  const { offer, meta } = props;
  // SÜZGEÇ BURADA, TEK KEZ ÇAĞRILIR; aşağıdaki hiçbir bileşen `hidden`
  // bakmaz — gizlenen şey buraya zaten gelmez.
  const payload = printedPayload(props.payload);
  const items: OfferItem[] = payload.items;
  // TEST YÜKÜ İKİ YERDEN BİRİNDE durur, ikisinde birden asla: "teknik" son
  // kalemin ardında, "ticari" ticari şartların üstünde. Kalem hiç yoksa
  // "teknik" seçimi de ticari sayfaya düşer — yoksa etkin bir blok belgeden
  // sessizce kaybolurdu.
  const testYukuTeknikte =
    testYukuVar(payload) && payload.testLoad.position === "teknik" && items.length > 0;
  const testYukuTicaride = testYukuVar(payload) && !testYukuTeknikte;
  const partner = payload.issuer.customerId !== null;
  const brandName = props.company.company || MARKA_ADI;
  const brandLogo = partner ? props.issuerLogo ?? null : undefined;
  const watermarkLogo: BrandBandLogo | null | undefined =
    brandLogo === undefined
      ? undefined
      : brandLogo
        ? { src: brandLogo, ratio: PARTNER_LOGO_RATIO }
        : null;
  const technicalLogo: BrandBandLogo | null | undefined =
    brandLogo === undefined
      ? undefined
      : brandLogo === null
        ? null
        : props.issuerTechnicalLogo ?? { src: brandLogo, ratio: PARTNER_LOGO_RATIO };
  // Sağ sütun ÖDEME bloğudur; o yoksa ticari sayfa tek sütuna döner.
  const sagSutunVar = odemeVar(payload);
  const docLine = altbilgi(offer, true, brandName);
  const kunye = sayfaKunyesi(offer);
  const sartlar = printedGeneralTerms(payload).map((madde) =>
    partner
      ? {
          ...madde,
          title: madde.title.replace(/ORION CRANES/gi, brandName),
          body: madde.body.replace(/ORION CRANES/gi, brandName),
        }
      : madde
  );
  const teslimVar = payload.terms.rows.some((row) => row.key !== "payment");
  const sartVeOdemeVar = teslimVar || sagSutunVar;
  const fiyatVar = payload.pricing.lines.length > 0;
  const notVar = payload.notes.length > 0;
  const kapsamDisiVar = payload.exclusions.length > 0;
  // İÇİNDEKİLER BELGENİN KENDİSİNDEN ÇIKAR: hangi bölümlerin BASILDIĞINI
  // aşağıdaki JSX'le aynı koşullar söyler (kalem var mı, şart maddesi kaldı
  // mı). Ayrı bir liste tutulsaydı gizlenen bir bölüm kapakta durmaya devam
  // ederdi.
  // FİYAT TABLOSU KENDİ YAPRAĞINA GEÇER Mİ (bkz. `FIYAT_SATIR_ESIGI`) — ya da
  // ticari sayfa ölçülüp taştığı için oraya SÜRÜLDÜ MÜ (`priceOwnPage`).
  const fiyatAyriYaprakta =
    fiyatVar && (props.priceOwnPage === true || payload.pricing.lines.length > FIYAT_SATIR_ESIGI);
  const ticariSayfaVar =
    sartVeOdemeVar || testYukuTicaride || notVar || kapsamDisiVar || (fiyatVar && !fiyatAyriYaprakta);
  const ticariEtiketi = sartVeOdemeVar
    ? OFFER_SECTIONS.ticari
    : testYukuTicaride
      ? payload.testLoad.title
      : fiyatVar && !fiyatAyriYaprakta
        ? OFFER_SECTIONS.fiyat
        : notVar
          ? "Teklif Notları"
          : "Kapsam Dışı İşler";
  const ticariKicker = sartVeOdemeVar
    ? payload.terms.title
    : testYukuTicaride
      ? payload.testLoad.title
      : fiyatVar && !fiyatAyriYaprakta
        ? OFFER_SECTIONS.fiyat
        : "TEKLİF EKLERİ";
  const bolumler = tocBolumleri(
    payload,
    sartlar.length > 0,
    fiyatAyriYaprakta,
    ticariSayfaVar,
    ticariEtiketi
  );
  // `pageOf` bileşene `props` yayılımıyla gider (`KapakSayfasi`).
  const { collect } = props;

  return (
    <Document
      title={`Teklif - ${offer.offerNo}`}
      author={brandName}
      subject={offer.subject}
      keywords={meta.generatedAt}
    >
      {/* KAPAK — `cover.hidden` yalnız kapağı kaldırır; belge (teknik sayfalar,
          fiyat, şartlar) yerinde kalır. Bayrak payload'ın kendi alanıdır,
          burada tanımlanan ikinci bir süzgeç değildir. */}
      {payload.cover.hidden ? null : (
        <KapakSayfasi {...props} payload={payload} bolumler={bolumler} />
      )}

      {/* TEKNİK SAYFALAR — HER KALEM YENİ SAYFADA. Bir ekipmanın özellikleri
          bir öncekinin dibinden devam ettiğinde müşteri iki vincin satırlarını
          karıştırıyordu; ayrım sayfa ile yapılır. */}
      {items.flatMap((item, i) => {
        // SAYFALAMA ÇİZİMDEN AYRIDIR (`pdf-layout.ts`): hangi grubun hangi
        // sütuna ve hangi sayfaya düşeceğini saf bir modül hesaplar ve o modül
        // vitest ile sınanır. Burada hesaplansaydı sütun düzenini ölçmenin tek
        // yolu PDF üretip metnini geri okumak olurdu.
        //
        // İLK SAYFANIN KAPASİTESİ AZDIR: sayfa başlığı (kicker + büyük başlık)
        // yaklaşık 46 pt yer kaplar ve o pay yalnız ilk sayfada harcanır.
        const sayfalar = offerPdfSayfalari(item.groups, PDF_SUTUN_KAPASITE);
        return sayfalar.map((sayfa, s) => (
          <TeknikSayfa
            key={`${item.id}-${s}`}
            docLine={docLine}
            kunye={kunye}
            baslik={item.title}
            kicker={
              sayfalar.length > 1
                ? `${trUpper(OFFER_SECTIONS.teknik)} · ${romen(s + 1)}`
                : trUpper(OFFER_SECTIONS.teknik)
            }
            sol={sayfa.sol}
            sag={sayfa.sag}
            tam={sayfa.tam}
            ustSonda={
              i === 0 && s === 0 ? <Sonda anchor="bas:teknik" collect={collect} /> : null
            }
            altSonda={
              i === items.length - 1 && s === sayfalar.length - 1 ? (
                <Sonda anchor="son:teknik" collect={collect} />
              ) : null
            }
            altBilgi={
              /* TEST YÜKÜ "teknik" konumunda SON teknik sayfanın ardındadır.
                 Ayrı bir yaprağa alınmadı: iki satırlık bir bloğun tek başına
                 bir A4 tüketmesi belgeyi kalınlaştırır, okunur kılmaz. */
              testYukuTeknikte && i === items.length - 1 && s === sayfalar.length - 1 ? (
                <TestYuku payload={payload} />
              ) : null
            }
            watermarkLogo={watermarkLogo}
            brandLogo={brandLogo}
            technicalLogo={technicalLogo}
          />
        ));
      })}

      {/* TİCARİ SAYFA — şartlar, (sığıyorsa) fiyat, notlar, kapsam dışı işler. */}
      {ticariSayfaVar ? (
      <BrandPage docLine={docLine} brandFooter={{}} watermarkLogo={watermarkLogo}>
        <Sonda anchor="bas:ticari" collect={collect} />
        {/* SAYFANIN BAŞLIĞI `terms.title`DIR (md. 16). Devralınan düzende bu
            metin bir blok başlığıydı ("FİYAT, TESLİM VE ÖDEME ŞEKLİ :") ve
            altındaki fiyat tablosunun kendi adı yoktu — tablo başlıksız
            duruyordu. Artık metin sayfayı adlandırır, tablo da kendi
            "FİYATLAR" başlığını taşır. */}
        <SayfaBasi
          kicker={trUpper(ticariKicker)}
          baslik={trUpper(ticariEtiketi)}
          kunye={kunye}
          marka
          buyuk
          brandLogo={brandLogo}
          brandName={brandName}
        />

        {/* İKİ SÜTUN: solda teslim şartları, sağda ödeme planı ve test yükü.
            Sağ sütun boşsa TEK SÜTUNA dönülür — yarısı boş bir sayfa,
            bölünmüş bir sayfadan daha kötü okunur. */}
        {sartVeOdemeVar || testYukuTicaride ? (sagSutunVar || testYukuTicaride ? (
          <View style={[S.ticariUst, { marginTop: mm(6) }]}>
            <View style={S.ticariSol}>
              <TeslimSartlari payload={payload} />
            </View>
            <View style={S.ticariSag}>
              <Odeme payload={payload} />
              {testYukuTicaride ? (
                <View style={{ marginTop: odemeVar(payload) ? mm(3) : 0 }}>
                  <TestYuku payload={payload} />
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: mm(6) }}>
            <TeslimSartlari payload={payload} />
          </View>
        )) : null}

        {/* FİYAT TABLOSU KENDİ YAPRAĞINA GEÇTİYSE burada basılmaz. */}
        {fiyatVar && !fiyatAyriYaprakta ? (
          <FiyatTablosu payload={payload} currency={offer.currency} sik={props.compactPrices} />
        ) : null}

        {/* NOTLAR VE KAPSAM DIŞI İŞLER SAYFANIN DİBİNDE, yan yana: ikisi de
            kısa listelerdir ve alt alta durduklarında ticari sayfanın yarısını
            boş bırakıyorlardı. Esnek boşluk onları aşağı iter; mutlak konum
            KULLANILMAZ, uzun bir liste geldiğinde boşluk kendiliğinden kapanır. */}
        {notVar || kapsamDisiVar ? (
          <>
            <View style={S.kapakEsnekBosluk} />
            <View style={S.altSutunlar}>
              <View style={S.altSutun}>
                <MetinBlogu baslik="Notlar" satirlar={payload.notes} />
              </View>
              <View style={S.altSutun}>
                <MetinBlogu baslik="Kapsam Dışı İşler" satirlar={payload.exclusions} silik />
              </View>
            </View>
          </>
        ) : null}
        <Sonda anchor="son:ticari" collect={collect} />
      </BrandPage>
      ) : null}

      {/* FİYAT TABLOSU KENDİ YAPRAĞINDA (kullanıcı isteği, 22.08.2026:
          *"eğer 12 satırın üstünde bir fiyat kalemi varsa fiyat tablosu ayrı
          sayfaya geçsin, tablo ikiye bölünmesin"*). */}
      {fiyatAyriYaprakta ? (
        <BrandPage docLine={docLine} brandFooter={{}} watermarkLogo={watermarkLogo}>
          <Sonda anchor="bas:fiyat" collect={collect} />
          <SayfaBasi
            kicker={trUpper(OFFER_SECTIONS.fiyat)}
            baslik={FIYAT_BASLIK}
            kunye={kunye}
            marka
            buyuk
            brandLogo={brandLogo}
            brandName={brandName}
          />
          <FiyatTablosu payload={payload} currency={offer.currency} kendiYapraginda />
          <Sonda anchor="son:fiyat" collect={collect} />
        </BrandPage>
      ) : null}

      {/* GENEL ŞARTLAR — belgenin SON sayfası (md. 9). */}
      <GenelSartlarSayfasi
        docLine={docLine}
        kunye={kunye}
        maddeler={sartlar}
        ustSonda={<Sonda anchor="bas:sartlar" collect={collect} />}
        altSonda={<Sonda anchor="son:sartlar" collect={collect} />}
        watermarkLogo={watermarkLogo}
        brandLogo={brandLogo}
        brandName={brandName}
      />
    </Document>
  );
}

/**
 * YERLEŞİM ÖNCE ÖLÇÜLÜR, SONRA BASILIR — en az iki geçiş.
 *
 * İki ayrı soruyu aynı ölçüm cevaplar:
 *
 *  1. **İçindekiler.** Bir bölümün kaç yaprak tuttuğu önceden bilinemez:
 *     teknik sayfa sayısını `pdf-layout` hesaplar ama ticari sayfa da genel
 *     şartlar da içeriğine göre taşabilir. Bölümlerin açıldığı ve kapandığı
 *     yapraklar birinci geçişte toplanır.
 *  2. **Kapağın sıkışması.** Kapak TEK SAYFADIR; konu üç satıra çıkıp müşteri
 *     unvanı künyede sarınca tasarımın nefes payları taşıyordu ve @react-pdf
 *     taşan bloğu sessizce ikinci bir yaprağa atıyordu. `son:kapak` sondası
 *     kapağın hangi yaprakta bittiğini söyler; taşmışsa kademe artar ve
 *     yerleşim yeniden koşar (bkz. `KapakYogunlugu`).
 *
 * OLAĞAN TEKLİF İKİ GEÇİŞTİR: kapak taşmazsa döngü ilk turda biter. Taşan
 * kapak en çok iki ölçüm daha ister ve o bedel yılda birkaç teklifte ödenir.
 *
 * KAPAK GİZLİYSE de ölçülür: numara toplamak ucuzdur, "hangi durumda tek geçiş
 * yeter" sorusunu her değişiklikte yeniden cevaplamak değildir.
 */
export async function renderOfferPdf(props: OfferDocumentProps): Promise<Buffer> {
  const hazirlananTeknikLogo = props.issuerLogo
    ? await prepareCustomerLogoForTechnicalHeader(props.issuerLogo)
    : null;
  const documentProps: OfferDocumentProps = {
    ...props,
    issuerTechnicalLogo:
      props.issuerLogo === undefined
        ? undefined
        : props.issuerLogo === null
          ? null
          : hazirlananTeknikLogo
            ? { src: hazirlananTeknikLogo.png, ratio: hazirlananTeknikLogo.ratio }
            : { src: props.issuerLogo, ratio: PARTNER_LOGO_RATIO },
  };
  const EN_SIK: KapakYogunlugu = 2;
  let coverDensity: KapakYogunlugu = 0;
  let compactPrices = false;
  let priceOwnPage = false;
  let pageOf: Record<string, number> = {};
  // Fiyat tablosu kendi yaprağındaysa ticari sayfada tablo YOKTUR; orada bir
  // taşma satır payından gelmez ve sıkıştırmak hiçbir şeyi kurtarmaz.
  const fiyatTicaride =
    printedPayload(documentProps.payload).pricing.lines.length <= FIYAT_SATIR_ESIGI;

  for (;;) {
    const toplanan: Record<string, number> = {};
    // SON YAZAN KAZANIR: @react-pdf sayfa bölerken dinamik düğümleri her aday
    // sayfa için yeniden çalıştırır ve ara değerler bölümün gerçek yerini
    // göstermez (hesap raporunun `renderReportPdf` kuralıyla aynı).
    await renderToBuffer(
      <OfferDocument
        {...documentProps}
        coverDensity={coverDensity}
        compactPrices={compactPrices}
        priceOwnPage={priceOwnPage}
        collect={(anchor, page) => {
          toplanan[anchor] = page;
        }}
      />
    );
    pageOf = toplanan;

    // KAPAK KAÇ YAPRAK TUTTU? İlk bölümün başladığı sayfadan okunur. Kapağın
    // SONUNA konan bir sonda bu soruyu cevaplamıyordu: taşan blok kağıdın
    // dışına çizilir ama sıfır yükseklikli düğüm hâlâ birinci yaprakta
    // yerleşmiş sayılır ve sonda "1" bildirir. Bir sonraki bölümün nerede
    // AÇILDIĞI ise ölçülen bir olgudur.
    const kapakTasti =
      !documentProps.payload.cover.hidden && coverDensity < EN_SIK && ilkBolumSayfasi(toplanan) > 2;
    if (kapakTasti) {
      coverDensity = (coverDensity + 1) as KapakYogunlugu;
      continue;
    }

    // TİCARİ SAYFA KAÇ YAPRAK TUTTU? Bölümün açıldığı ve kapandığı yaprak
    // farklıysa taşmıştır; fiyat satırlarının payı ilk kısılacak yerdir.
    //
    // SIKIŞTIRMA YETMEZSE TABLO KENDİ YAPRAĞINA SÜRÜLÜR. Kalem bazında iskonto
    // basıldığında hücreler iki katmanlıdır ve satır payı en aza indiğinde bile
    // tablo eski boyuna dönmez; satır sayısı eşiğin altında olsa da ticari
    // sayfa taşabilir. Tabloyu bütün hâlde taşımak, @react-pdf'in onu notların
    // üstünde ikiye bölmesinden iyidir (TEKLIF-54'ün kendi gerekçesi).
    const ticariTasti = (pageOf["son:ticari"] ?? 0) > (pageOf["bas:ticari"] ?? 0);
    if (ticariTasti && fiyatTicaride && !compactPrices) {
      compactPrices = true;
      continue;
    }
    if (ticariTasti && fiyatTicaride && !priceOwnPage) {
      priceOwnPage = true;
      continue;
    }
    break;
  }

  return renderToBuffer(
    <OfferDocument
      {...documentProps}
      coverDensity={coverDensity}
      compactPrices={compactPrices}
      priceOwnPage={priceOwnPage}
      pageOf={pageOf}
    />
  );
}
