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
import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  FONTS,
  PAGE,
  T,
  mm,
  trUpper,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { fmtMoney, fmtNum } from "@/lib/currency";
import { printedGeneralTerms, printedPayload } from "@/lib/offers/payload";
import { discountAmount, lineAmount, offerTotal, vatNote } from "@/lib/offers/pricing";
import { offerDocLine, offerRevLabel } from "@/lib/offers/no";
import {
  ETIKET_ARA,
  ETIKET_ORAN,
  SUTUN_BOSLUK,
  SUTUN_GENISLIK,
  blokBasligi,
  offerPdfSayfalari,
  type OfferPdfBlok,
} from "@/lib/offers/pdf-layout";
import { GENERAL_TERMS_TITLE } from "@/lib/offers/registry";
import { offerScopeSuffix } from "@/lib/offers/types";
import type {
  OfferItem,
  OfferPayload,
  OfferPriceLine,
  OfferRow,
  OfferRowScope,
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
  meta: { generatedAt: string };
}

// ————————————————————————————————————————————————————————————— ölçüler

/**
 * ETİKET SÜTUNU SABİT GENİŞLİKTEDİR — iki noktalar alt alta hizalansın diye.
 *
 * Devralınan belgelerde etiket ile değer arasındaki boşluk elle verilmişti ve
 * her sayfada başka bir yerde duruyordu; göz `Motor :` ile `Fren :` arasında
 * bir sütun aramak zorunda kalıyordu. Genişlik en uzun etikete (`Çalışma
 * Ortamı / Sıcaklığı`) göre seçildi; taşan etiket sarar, hizayı bozmaz.
 */
const ETIKET_GENISLIK = 148;

/** Kapak künyesindeki etiketler daha kısadır (`Referansımız`, `Müşteri`). */
const KUNYE_ETIKET_GENISLIK = 82;

/**
 * İki teknik blok arasındaki boşluk.
 *
 * `pdf-layout.ts` bu payı `BASLIK_YUK`ün İÇİNDE sayar (blok başına 10 pt);
 * buradaki sayı oradan ayrılırsa ölçü ile kâğıt ayrışır ve sütun taşar.
 */
const BLOK_ARA = 10;

/**
 * Firma künyesinin sayfa dibinden yüksekliği.
 *
 * `BrandPage`in folio satırı (ayırıcı çizgi + doküman satırı + sayfa numarası)
 * sayfa dibinden 12pt yer kaplar; künye onun ÜSTÜNE oturur ve araya 4pt hava
 * bırakır. Ölçü basılan belgeden alındı (çizgi 810,25pt'te), tahmin değildir:
 * pay 12'ye çekilseydi gri iletişim satırı ayırıcı çizgiye YAPIŞIRDI.
 */
const FOLIO_YUKSEKLIK = 16;

/**
 * Kapak sayfasının alt payı: folio satırı + tek satırlık firma künyesi.
 *
 * `BrandPage`in kendi künye payı (`company` prop'u) KULLANILMAZ — o prop iki
 * sütunlu `CompanyBlock`u çizerdi (bkz. `FirmaKunyesi`). Pay burada, teklifin
 * kendi künyesinin gerçek yüksekliğine göre verilir; eksik verilseydi kapak
 * metni künyenin üstüne binerdi.
 */
const KAPAK_ALT_PAY = PAGE.marginBottom + 14 + 22;

/**
 * FİYAT TABLOSU TEK ŞEMADIR — payların toplamı 100.
 *
 * Tutar sütunları GERÇEK BÜYÜKLÜKLERE göre ayrıldı ("1.575.000 €" gibi yedi
 * haneli değerler olağandır); dar bir sütunda bu tutar ikinci satıra iner ve
 * tablo okunmaz olurdu.
 */
const FIYAT_SUTUNLARI: { baslik: string; pay: number; sag?: boolean }[] = [
  { baslik: "No", pay: 5, sag: true },
  { baslik: "Tanımı", pay: 45 },
  { baslik: "Adet", pay: 13, sag: true },
  { baslik: "Birim Fiyat", pay: 18, sag: true },
  { baslik: "Toplam Fiyat", pay: 19, sag: true },
];

const S = StyleSheet.create({
  // ---- kapak
  kapakBaslik: { ...T.display, fontSize: 26, textAlign: "center", marginTop: 46, marginBottom: 34 },
  kunyeCerceve: { borderWidth: 0.8, borderColor: BRAND.line350 },
  kunyeBaslikSatiri: { flexDirection: "row", backgroundColor: BRAND.ink },
  kunyeBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6.6,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: BRAND.paper100,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  kunyeSutun: { width: "50%", paddingHorizontal: 6, paddingVertical: 2 },
  kunyeTamSatir: {
    borderTopWidth: 0.6,
    borderTopColor: BRAND.line300,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kunyeAyirac: { borderLeftWidth: 0.6, borderLeftColor: BRAND.line300 },
  // Unvan, adın tam ALTINA hizalanır: etiket genişliği + iki nokta sütunu.
  unvan: { ...T.caption, fontSize: 7, color: BRAND.gray600, marginLeft: KUNYE_ETIKET_GENISLIK + 9 },
  hitap: { ...T.body, fontSize: 9.5, color: BRAND.ink, marginTop: 26 },
  giris: { ...T.body, fontSize: 9.5, marginTop: 10, textAlign: "justify" },
  saygi: { ...T.body, fontSize: 9.5, color: BRAND.ink, marginTop: 16 },
  imzalar: { flexDirection: "row", gap: 40, marginTop: 26 },
  imzaAd: { fontFamily: FONTS.sans, fontSize: 9, fontWeight: 700, color: BRAND.ink },
  imzaUnvan: { ...T.caption, fontSize: 7.5, marginTop: 1.5 },

  // ---- kapak altbilgisi (teklife özel tek satırlık künye)
  kunyeFirma: {
    fontFamily: FONTS.sans,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.2,
    color: BRAND.ink,
  },
  // Punto adres satırının bugünküsünden (6) bir tık küçük ve harf aralığı
  // daraltıldı: dört alan TEK satıra iniyor ve A4 içerik genişliğine sığması
  // ancak böyle garanti oluyor (bkz. `FirmaKunyesi`).
  kunyeIletisim: { ...T.micro, fontSize: 5.4, letterSpacing: 0.15, color: BRAND.gray600, marginTop: 2 },

  // ---- teknik / ticari satır
  // KALEM BAŞLIĞI SAYFANIN BAŞLIĞIDIR (kullanıcı isteği, 17.08.2026: *"vinç
  // adının yazdığı başlık biraz daha büyük olsun"*). 11pt'de grup başlığının
  // (8,8) yalnız bir tık üstündeydi ve sayfada hangisinin kimin başlığı olduğu
  // seçilmiyordu; 15pt ile hiyerarşi tek bakışta okunur.
  bolumBaslik: { ...T.heading, marginBottom: 3 },
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
  grupBaslik: {
    fontFamily: FONTS.sans,
    fontSize: 8.8,
    fontWeight: 800,
    color: BRAND.red,
    marginTop: 9,
    marginBottom: 3,
  },
  // `flex-start`: uzun değer sarınca etiket YUKARIDA kalır, satırlar iç içe
  // geçmez (sipariş onayının md. 12 kuralıyla aynı).
  satir: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 1.6 },
  etiket: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.gray700, flexGrow: 0, flexShrink: 0 },
  ikiNokta: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.gray450, width: 9, flexGrow: 0, flexShrink: 0 },
  // `flexBasis: 0` ŞART: temel genişlik "auto" bırakılırsa yoga değerin
  // ÖLÇÜLEN uzunluğunu taban alır ve uzun bir müşteri unvanı ("… İSTİHSAL
  // ENDÜSTRİSİ A.Ş.") satırı kutunun dışına taşırır — sarmak yerine kenardan
  // taşar ve etiket sütununu da yerinden oynatır. Sıfır tabanla değer yalnız
  // ARTAN yeri kaplar, oraya sığmayan sarar.
  deger: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.ink, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  // KAPSAM EKİ DEĞERİN PARÇASI DEĞİLDİR: aynı satırda, değerin devamında ama
  // daha küçük ve daha silik basılır ki müşteri "SIBRE Kasnak Fren" ile
  // "(Müşteri Kapsamında)" notunu birbirine karıştırmasın. İç içe `Text`
  // kullanılır — ayrı bir kutu satırı kırar, metin katmanında da bölerdi.
  kapsamEki: { fontSize: 6.4, color: BRAND.gray600 },
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
    paddingTop: 2.4,
    paddingBottom: 2.4,
    borderBottomWidth: 0.4,
    borderBottomColor: BRAND.hairline,
  },
  // `maxWidth` KELEPÇESİ `ETIKET_ORAN`la aynı sayıdır: serbest kalemde etiketi
  // kullanıcı yazar ve kelepçesiz uzun bir etiket değere yer bırakmazdı.
  // Ölçüm modülü de aynı kelepçeyle ölçer (`satirYuksekligi`).
  ozellikEtiket: {
    fontFamily: FONTS.sans,
    fontSize: 7.8,
    lineHeight: 1.28,
    color: BRAND.gray700,
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: SUTUN_GENISLIK * ETIKET_ORAN,
  },
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
    lineHeight: 1.35,
    color: BRAND.ink,
    textAlign: "right",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginLeft: ETIKET_ARA,
  },

  // Ödeme planı satırları GİRİNTİLİ ve MADDE İŞARETSİZDİR: belgede "Ödeme :"
  // satırının devamıdırlar, ayrı bir liste değil.
  odemeSatiri: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: BRAND.ink,
    marginLeft: ETIKET_GENISLIK + 9,
    paddingVertical: 1.2,
  },

  // ---- ÇİFT SÜTUN (kullanıcı isteği 18.08.2026, md. 8)
  //
  // Sütunlar SABİT GENİŞLİKTİR (`SUTUN_GENISLIK`), esnek değil: sayfalama
  // modülü yüksekliği o genişliğe göre ÖLÇÜYOR (`pdf-layout.ts`) ve yoga
  // burada başka bir genişlik hesaplarsa ölçü ile çizim ayrışır — bir sütun
  // taşar, öteki boş kalır.
  sutunlar: { flexDirection: "row", gap: SUTUN_BOSLUK },
  sutun: { width: SUTUN_GENISLIK },
  /**
   * SAYFA BAŞLIĞI ALT ALTA ÜÇ SATIRDIR, YAN YANA İKİ SÜTUN DEĞİL.
   *
   * Önceki düzende büyük başlık solda, kalem adı künyesi sağda duruyordu ve
   * ikisi ÜST ÜSTE BİNİYORDU (kullanıcı bildirimi, 18.08.2026): esnek satırda
   * yalnız `flexGrow/flexShrink` verilmiş bir kutuda @react-pdf metni kutunun
   * DARALTILMIŞ genişliğine göre yeniden sarmıyor, ölçtüğü doğal genişlikte
   * çiziyor — 429 pt'lik başlık 337 pt'lik kutudan taşıp künyenin üstüne
   * biniyordu. Yan yana iki kutu kalmayınca çakışma da kalmaz: her satır
   * içerik genişliğinin TAMAMINI kullanır.
   */
  sayfaBasi: { marginBottom: 12 },
  sayfaKicker: { ...T.kicker, color: BRAND.red, marginBottom: 2 },
  /**
   * Sayfadaki öbeklerin dizini: `GENEL · KALDIRMA · ARABA`.
   *
   * Büyük başlığın ALTINDA ve sessizdir. İki sayfaya taşan bir kalemde ikinci
   * sayfanın dizini kendi öbeklerini sayar, yani hangi sayfada ne olduğu
   * başlıktan okunur — başlığın kendisi ise kalemin adıdır.
   */
  sayfaDizin: { ...T.micro, fontSize: 6.2, letterSpacing: 0.9, color: BRAND.gray500 },

  // ---- GENEL ŞARTLAR (md. 9)
  //
  // "Daha küçük ve biraz silik" (kullanıcı cümlesi): 6,6 pt gövde ve
  // `gray600`. Belgenin geri kalanı 8 pt / `ink`tir; şartlar okunabilir ama
  // ÖNE ÇIKMAZ — hukukî bir ek olduğu tipografiden anlaşılır.
  sartMadde: { marginBottom: 6 },
  sartBaslik: { fontFamily: FONTS.sans, fontSize: 7, fontWeight: 700, color: BRAND.gray700, marginBottom: 1.5 },
  sartGovde: { fontFamily: FONTS.sans, fontSize: 6.6, lineHeight: 1.45, color: BRAND.gray600, textAlign: "justify" },

  // ---- fiyat tablosu
  fiyatBaslikSatiri: { flexDirection: "row", backgroundColor: BRAND.ink, marginTop: 4 },
  fiyatBaslik: {
    fontFamily: FONTS.mono,
    fontSize: 6.6,
    fontWeight: 600,
    letterSpacing: 0.7,
    color: BRAND.paper100,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  fiyatSatiri: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 0.4,
    borderBottomColor: BRAND.hairline,
  },
  fiyatHucre: {
    fontFamily: FONTS.sans,
    fontSize: 7.8,
    lineHeight: 1.35,
    color: BRAND.ink,
    paddingVertical: 3.5,
    paddingHorizontal: 4,
  },
  fiyatMono: { fontFamily: FONTS.mono, fontSize: 7.6 },
  toplamSatiri: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1.2,
    borderTopColor: BRAND.ink,
    backgroundColor: BRAND.paper100,
  },
  toplamYazi: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    fontWeight: 800,
    color: BRAND.ink,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  dipnot: { ...T.caption, fontSize: 7, color: BRAND.gray600, marginTop: 5 },
  kdvNotu: { ...T.body, fontSize: 8, color: BRAND.ink, marginTop: 9 },

  // ---- notlar / kapsam dışı
  metinSatiri: { ...T.body, fontSize: 8, color: BRAND.ink, paddingVertical: 1.6, textAlign: "justify" },
  maddeSatiri: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 1.6 },
  maddeIsareti: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.red, width: 10, flexShrink: 0 },
});

// ————————————————————————————————————————————————————————————— yardımcı

/** ISO tarihi gg.aa.yyyy yapar; okunamayan değer olduğu gibi kalır. */
function tarih(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? "");
}

/**
 * `Etiket : Değer` satırı — belgenin en çok tekrar eden birimi.
 *
 * `wrap={false}`: iki satırlık bir değer sayfa dibinde ikiye BÖLÜNMEZ, bütün
 * olarak bir sonraki sayfaya geçer. Teknik bir satırın yarısı bir sayfada
 * yarısı ötekinde okunduğunda değer yanlış anlaşılabilir.
 *
 * KAPSAM YALNIZ İSTİSNADA BASILIR (`offerScopeSuffix`): satırların neredeyse
 * tamamı bizim kapsamımızdadır ve her birine "Orion Kapsamında" yazmak belgeyi
 * okunmaz yapardı — görünür olan, olağandan sapandır. Ek metnin KENDİSİNE
 * eklenir, ayrı bir sütun açılmaz: teknik sayfa iki sütunlu bir çizelge değil
 * bir okuma metnidir ve boş kalacak üçüncü bir sütun her satırda göze girerdi.
 */
function EtiketliSatir({
  label,
  value,
  labelWidth = ETIKET_GENISLIK,
  akis,
  scope,
}: {
  label: string;
  value: string;
  labelWidth?: number;
  /**
   * AKIŞ KİPİ — etiket SABİT SÜTUN DEĞİL, kendi boyunda.
   *
   * Tek sütunlu sayfada etiketler 148 pt'lik bir sütunda hizalıdır ve bu
   * okumayı kolaylaştırır. 234,78 pt'lik bir SÜTUNDA aynı genişlik değere
   * yalnız ~78 pt bırakır: "GAMAK 22 kW 1500 d/dak, Encoderli" dört satıra
   * sarar ve sayfalama modülünün ölçüsü (etiket + değer birlikte akar)
   * tutmaz — modül 2 satır sayarken çizim 4 satır çizer, sütun taşar.
   *
   * Ölçü ile çizim AYNI MODELİ kullanmak zorundadır; `pdf-layout.ts`
   * akış modelini ölçer, bu bayrak onu çizer.
   */
  akis?: boolean;
  scope?: OfferRowScope;
}) {
  const kapsam = offerScopeSuffix(scope);
  return (
    <View style={S.satir} wrap={false}>
      <Text style={[S.etiket, akis ? { flexShrink: 1 } : { width: labelWidth }]}>{label}</Text>
      <Text style={S.ikiNokta}>:</Text>
      <Text style={S.deger}>
        {value}
        {kapsam ? <Text style={S.kapsamEki}>{kapsam}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * Bir `OfferRow`un basılmış hâli. TEKNİK, TEST YÜKÜ ve TİCARİ ŞART satırları
 * aynı tipten olduğu için kapsam eki üçünde de AYNI yoldan geçer — üç ayrı
 * çağrı yerinde tekrarlansaydı biri unutulduğunda müşteri kapsamındaki bir
 * kalem belgede sessizce bizim üstümüze kalırdı.
 */
function SatirBasimi({ row }: { row: OfferRow }) {
  return <EtiketliSatir label={row.label} value={row.value} scope={row.scope} />;
}

/** Blok başlığı: `TEST YÜKÜ (TS 10116) :` — başlık + " :". */
function BlokBaslik({ text, ilk = false }: { text: string; ilk?: boolean }) {
  return <Text style={[S.grupBaslik, { marginTop: ilk ? 0 : 12 }]}>{trUpper(text)} :</Text>;
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
function OzellikSatiri({ row }: { row: OfferRow }) {
  const kapsam = offerScopeSuffix(row.scope);
  return (
    <View style={S.ozellikSatiri} wrap={false}>
      <Text style={S.ozellikEtiket}>{row.label}</Text>
      <Text style={S.ozellikDeger}>
        {row.value}
        {kapsam ? <Text style={S.kapsamEki}>{kapsam}</Text> : null}
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
function SutunBloku({ blok, vurgu }: { blok: OfferPdfBlok; vurgu?: boolean }) {
  return (
    <View>
      {/* Başlık sütun dibinde YALNIZ kalmasın: altında en az iki satır yer
          yoksa blok bir sonraki sütuna taşınır (dağıtımın `EN_AZ_KUYRUK`
          kuralının çizim tarafındaki karşılığı). */}
      <View style={vurgu ? [S.bolumSerit, S.bolumSeritVurgu] : [S.bolumSerit]} minPresenceAhead={40}>
        <Text style={vurgu ? [S.bolumAdi, S.bolumAdiVurgu] : [S.bolumAdi]}>
          {trUpper(blokBasligi(blok))}
        </Text>
      </View>
      {blok.rows.map((row, i) => (
        <OzellikSatiri key={row.key || i} row={row} />
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
  dizin,
  sol,
  sag,
  altBilgi,
}: {
  docLine: string;
  /** Sayfanın büyük başlığı: KALEMİN ADI. */
  baslik: string;
  kicker: string;
  /** Sayfadaki öbeklerin kısa adları — başlığın altındaki sessiz dizin. */
  dizin: string[];
  sol: OfferPdfBlok[];
  sag: OfferPdfBlok[];
  altBilgi?: React.ReactNode;
}) {
  return (
    <BrandPage docLine={docLine}>
      <View style={S.sayfaBasi}>
        <Text style={S.sayfaKicker}>{kicker}</Text>
        {/* BAŞLIK KALEMİN ADIDIR (kullanıcı bildirimi, 18.08.2026: *"burada
            başlık olarak 80T x 12.44m PORTAL VİNÇ yazması gerekiyor… yani kalem
            başlığından çekmesi gerek"*). Öbek adları bir gün başlığın yerini
            almıştı ve sayfanın hangi ekipmana ait olduğu ancak sağ üstteki
            küçük künyeden okunuyordu; ad başlığa dönünce o künye de gereksiz
            kaldı — çakışan iki kutudan biri böylece ortadan kalktı.

            AD OLDUĞU GİBİ BASILIR, büyütülmez: "80T x 12.44m" bir ürün adıdır
            ve birimleri küçük harfle yazılır — `trUpper` onu "12.44M" yapardı. */}
        <Text style={S.bolumBaslik}>{baslik}</Text>
        {/* ÖBEK DİZİNİ başlığın altında, sessiz: iki sayfaya taşan bir kalemde
            ikinci sayfanın dizini kendi öbeklerini sayar, yani hangi sayfada ne
            olduğu buradan okunur. */}
        {dizin.length > 0 ? <Text style={S.sayfaDizin}>{trUpper(dizin.join(" · "))}</Text> : null}
      </View>

      <View style={S.sutunlar}>
        <View style={S.sutun}>
          {sol.map((b, i) => (
            <View key={`${b.group.id}-${i}`} style={{ marginBottom: BLOK_ARA }}>
              {/* Sayfanın ilk öbeği (sol sütunun başı) kırmızı açılır. */}
              <SutunBloku blok={b} vurgu={i === 0} />
            </View>
          ))}
        </View>
        <View style={S.sutun}>
          {sag.map((b, i) => (
            <View key={`${b.group.id}-${i}`} style={{ marginBottom: BLOK_ARA }}>
              <SutunBloku blok={b} />
            </View>
          ))}
        </View>
      </View>
      {altBilgi}
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
  maddeler,
}: {
  docLine: string;
  maddeler: { no: number; title: string; body: string }[];
}) {
  if (maddeler.length === 0) return null;
  return (
    <BrandPage docLine={docLine}>
      <View style={S.sayfaBasi}>
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Text style={S.sayfaKicker}>EKLER</Text>
          <Text style={S.bolumBaslik}>{trUpper(GENERAL_TERMS_TITLE)}</Text>
        </View>
      </View>
      {maddeler.map((m) => (
        <View key={m.no} style={S.sartMadde} wrap={false}>
          <Text style={S.sartBaslik}>
            {m.no}. {m.title}
          </Text>
          <Text style={S.sartGovde}>{m.body}</Text>
        </View>
      ))}
    </BrandPage>
  );
}

// ————————————————————————————————————————————————————————————— kapak

interface KunyeSatiri {
  label: string;
  value: string;
  /** İkinci satır olarak, etiketsiz basılır (kişinin unvanı). */
  sub?: string;
}

/** BOŞ ALAN SATIRI HİÇ ÇİZİLMEZ — yer tutucu bir değer değildir (SATIS-16). */
function dolu(satirlar: KunyeSatiri[]): KunyeSatiri[] {
  return satirlar.filter((s) => s.value.trim() !== "");
}

function KunyeHucre({ satir }: { satir: KunyeSatiri }) {
  return (
    <View>
      <EtiketliSatir
        label={satir.label}
        value={satir.value}
        labelWidth={KUNYE_ETIKET_GENISLIK}
      />
      {/* Unvan ayrı bir künye satırı DEĞİLDİR: adın niteliğidir ve imza
          bloğuyla aynı düzeni izler (ad üstte, unvan altında). */}
      {satir.sub ? <Text style={S.unvan}>{satir.sub}</Text> : null}
    </View>
  );
}

function KapakKunyesi({ sol, sag, tam }: { sol: KunyeSatiri[]; sag: KunyeSatiri[]; tam: KunyeSatiri[] }) {
  return (
    <View style={S.kunyeCerceve}>
      <View style={S.kunyeBaslikSatiri}>
        <Text style={[S.kunyeBaslik, { width: "50%" }]}>KİMDEN</Text>
        <Text style={[S.kunyeBaslik, { width: "50%" }]}>KİME</Text>
      </View>
      <View style={{ flexDirection: "row", paddingVertical: 4 }}>
        <View style={S.kunyeSutun}>
          {sol.map((s) => (
            <KunyeHucre key={s.label} satir={s} />
          ))}
        </View>
        <View style={[S.kunyeSutun, S.kunyeAyirac]}>
          {sag.map((s) => (
            <KunyeHucre key={s.label} satir={s} />
          ))}
        </View>
      </View>
      {/* Konu ve e-posta SATIR BOYU BİRLEŞİKTİR: iki sütuna sıkıştırıldığında
          konu metni üç satıra iniyor ve künye okunmaz oluyordu. */}
      {tam.map((s) => (
        <View key={s.label} style={S.kunyeTamSatir}>
          <EtiketliSatir label={s.label} value={s.value} labelWidth={KUNYE_ETIKET_GENISLIK} />
        </View>
      ))}
    </View>
  );
}

/**
 * KAPAK ALTBİLGİSİNİN FİRMA KÜNYESİ — ADRES, TELEFON, E-POSTA, WEB TEK SATIRDA.
 *
 * `brand.tsx`in `CompanyBlock`u künyeyi iki sütuna böler ve telefonu adresten
 * ayırıp sağ üste alır. Teklifin kapağında bu, adres satırının bir ÜSTÜNDE tek
 * başına duran bir telefon numarası olarak okunuyordu (kullanıcı bildirimi,
 * 17.08.2026: dengesiz görünüyor). Burada dört alan ` · ` ile birleşip TEK
 * `Text` olarak basılır. Tek metin olması iki şeyi birden sağlar: göz tek çizgi
 * görür, ve PDF metin katmanında da tek parça kalır — alanlar ayrı kutulara
 * bölünseydi çözülen metne aralarına satır sonu girerdi ve künye "aynı satırda"
 * olduğunu KANITLAYAMAZDI (testin ölçtüğü şey tam olarak budur).
 *
 * `CompanyBlock` DEĞİŞTİRİLMEDİ: hesap raporu ve ekipman listesi de onu kullanır
 * ve orada künye sayfanın tek başlığı değil, iki sütunlu bir imzadır.
 *
 * Konum mutlaktır çünkü künye kapak METNİNİN devamı değil SAYFANIN dibidir:
 * kapak içeriği kısa da olsa uzun da olsa künye folio satırının hemen üstünde
 * durur.
 */
function FirmaKunyesi({ company }: { company: CompanyInfo }) {
  const iletisim = [company.address, company.phone, company.email, company.web]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return (
    <View
      style={{
        position: "absolute",
        left: PAGE.contentLeft,
        right: PAGE.marginOuter,
        bottom: mm(7) + FOLIO_YUKSEKLIK,
      }}
    >
      <Text style={S.kunyeFirma}>{company.company}</Text>
      {iletisim ? <Text style={S.kunyeIletisim}>{iletisim}</Text> : null}
    </View>
  );
}

function KapakSayfasi({ offer, payload, company }: OfferDocumentProps & { payload: OfferPayload }) {
  const { cover } = payload;
  const rev = offerRevLabel(offer.revNo);

  const sol = dolu([
    { label: "Adı ve Soyadı", value: cover.fromName, sub: cover.fromTitle.trim() || undefined },
    { label: "Tarih", value: tarih(offer.issueDate) },
    { label: "Referansımız", value: offer.offerNo },
  ]);
  const sag = dolu([
    { label: "Adı ve Soyadı", value: cover.toName },
    { label: "Müşteri", value: offer.customerName },
    { label: "Bölüm", value: cover.toDept },
    { label: "Telefon", value: cover.toPhone },
    { label: "Müşteri Referansı", value: cover.customerRef },
  ]);
  const tam = dolu([
    { label: "Konu", value: offer.subject },
    { label: "e-posta", value: cover.fromEmail },
  ]);

  // `company` BİLEREK GEÇİLMEZ: prop verilseydi `BrandPage` kendi iki sütunlu
  // künyesini çizerdi. Künye `FirmaKunyesi` ile tek satır basılır, sayfanın alt
  // payı da bu yüzden burada elle ayrılır.
  return (
    <BrandPage docLine={altbilgi(offer)} style={{ paddingBottom: KAPAK_ALT_PAY }}>
      <FirmaKunyesi company={company} />
      <BrandBand
        docCode={offer.offerNo}
        lines={[rev ? `${rev} · ${tarih(offer.issueDate)}` : tarih(offer.issueDate)]}
        logoWidth={150}
      />

      {/* Kapakta TEK KELİMELİK başlık: belgenin ne olduğunu söyleyen tek şey
          budur, geri kalanı künye ve mektuptur. */}
      <Text style={S.kapakBaslik}>TEKLİF</Text>

      <KapakKunyesi sol={sol} sag={sag} tam={tam} />

      {cover.greeting.trim() ? <Text style={S.hitap}>{cover.greeting}</Text> : null}
      {cover.intro.trim() ? <Text style={S.giris}>{cover.intro}</Text> : null}
      <Text style={S.saygi}>Saygılarımızla,</Text>

      {/* İMZA BLOĞU BOŞSA ÇİZİLMEZ: imzasız bir imza yeri, belgenin
          eksik kaldığını söyler. */}
      {cover.signatories.length > 0 ? (
        <View style={S.imzalar}>
          {cover.signatories.map((s, i) => (
            <View key={`${s.name}-${i}`}>
              <Text style={S.imzaAd}>{s.name}</Text>
              {s.title.trim() ? <Text style={S.imzaUnvan}>{s.title}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </BrandPage>
  );
}

// ————————————————————————————————————————————————————————————— bloklar

/** Test yükü bloğu basılacak mı — sayfa düzeni de buna bakar. */
function testYukuVar(payload: OfferPayload): boolean {
  return payload.testLoad.enabled && payload.testLoad.rows.length > 0;
}

function TestYuku({ payload, ilk }: { payload: OfferPayload; ilk?: boolean }) {
  const { testLoad } = payload;
  if (!testYukuVar(payload)) return null;
  return (
    <View>
      <BlokBaslik text={testLoad.title} ilk={ilk} />
      {testLoad.rows.map((row, i) => (
        <SatirBasimi key={row.key || i} row={row} />
      ))}
    </View>
  );
}

function TicariBlok({ payload, ilk }: { payload: OfferPayload; ilk?: boolean }) {
  const { terms } = payload;
  if (terms.rows.length === 0 && terms.paymentLines.length === 0) return null;
  return (
    <View>
      <BlokBaslik text={terms.title} ilk={ilk} />
      {terms.rows.map((row, i) => (
        <React.Fragment key={row.key || i}>
          <SatirBasimi row={row} />
          {/* ÖDEME PLANI "Ödeme" SATIRININ HEMEN ALTINDADIR: belgede o satırın
              cümlesi ("…aşağıda belirtilen şekildedir") planı işaret eder,
              araya başka bir şart girerse cümle boşa düşer. */}
          {row.key === "payment"
            ? terms.paymentLines.map((l) => (
                <Text key={l.id} style={S.odemeSatiri}>
                  {l.text}
                </Text>
              ))
            : null}
        </React.Fragment>
      ))}
      {/* "Ödeme" satırı gizlenmiş ya da boşsa plan yine basılır — yoksa
          ödeme şekli belgeden sessizce düşerdi. */}
      {terms.rows.some((r) => r.key === "payment")
        ? null
        : terms.paymentLines.map((l) => (
            <Text key={l.id} style={S.odemeSatiri}>
              {l.text}
            </Text>
          ))}
    </View>
  );
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

/** Tablonun altındaki toplam satırları — üçü de aynı ızgarayı paylaşır. */
function ToplamSatiri({
  baslik,
  tutar,
  currency,
  vurgu,
}: {
  baslik: string;
  tutar: number | null;
  currency: string;
  /** İskontolu toplam biraz daha belirgin basılır — ödenecek rakam odur. */
  vurgu?: boolean;
}) {
  const etiketPay =
    FIYAT_SUTUNLARI[0].pay + FIYAT_SUTUNLARI[1].pay + FIYAT_SUTUNLARI[2].pay + FIYAT_SUTUNLARI[3].pay;
  return (
    <View style={S.toplamSatiri} wrap={false}>
      <Text style={[S.toplamYazi, { width: `${etiketPay}%`, textAlign: "right" }]}>{baslik}</Text>
      <Text
        style={[
          S.toplamYazi,
          {
            fontFamily: FONTS.mono,
            fontWeight: vurgu ? 700 : 600,
            width: `${FIYAT_SUTUNLARI[4].pay}%`,
            textAlign: "right",
          },
        ]}
      >
        {tutar === null ? "—" : fmtMoney(tutar, currency)}
      </Text>
    </View>
  );
}

function FiyatTablosu({ payload, currency }: { payload: OfferPayload; currency: string }) {
  const lines = payload.pricing.lines;
  if (lines.length === 0) return null;
  const toplam = offerTotal(lines);
  const toplamDisiVar = lines.some((l) => !l.inTotal);
  // İSKONTO belgeye ancak satır toplamından FARKLIYSA girer (bkz. aşağıdaki
  // gerekçe); `discountAmount` bu farkı zaten `null`a çevirir.
  const iskonto = discountAmount(payload.pricing);
  const iskontolu = iskonto === null ? null : payload.pricing.discountTotal ?? null;

  return (
    <View style={{ marginTop: 14 }}>
      {/* Başlık satırı HER SAYFADA tekrar eder: on dokuz satırlık bir tabloda
          ikinci sayfada hangi sütunun ne olduğu hatırlanmak zorunda değildir. */}
      <View style={S.fiyatBaslikSatiri} fixed>
        {FIYAT_SUTUNLARI.map((s) => (
          <Text
            key={s.baslik}
            style={[S.fiyatBaslik, { width: `${s.pay}%`, textAlign: s.sag ? "right" : "left" }]}
          >
            {trUpper(s.baslik)}
          </Text>
        ))}
      </View>

      {lines.map((line, i) => {
        const tutar = lineAmount(line);
        return (
          <View key={line.id} style={S.fiyatSatiri} wrap={false}>
            <Text
              style={[S.fiyatHucre, S.fiyatMono, { width: `${FIYAT_SUTUNLARI[0].pay}%`, textAlign: "right" }]}
            >
              {i + 1}
            </Text>
            <Text style={[S.fiyatHucre, { width: `${FIYAT_SUTUNLARI[1].pay}%` }]}>
              {fiyatTanimi(line)}
            </Text>
            <Text
              style={[S.fiyatHucre, S.fiyatMono, { width: `${FIYAT_SUTUNLARI[2].pay}%`, textAlign: "right" }]}
            >
              {adetHucresi(line)}
            </Text>
            <Text
              style={[S.fiyatHucre, S.fiyatMono, { width: `${FIYAT_SUTUNLARI[3].pay}%`, textAlign: "right" }]}
            >
              {line.unitPrice === null ? "—" : fmtMoney(line.unitPrice, currency)}
            </Text>
            {/* TOPLAM HÜCRESİ BOŞ KALIR (tire bile değil): satır toplama
                girmiyorsa orada gösterilecek bir sayı YOKTUR ve bir tire,
                "hesaplanamadı" diye okunurdu. */}
            <Text
              style={[S.fiyatHucre, S.fiyatMono, { width: `${FIYAT_SUTUNLARI[4].pay}%`, textAlign: "right" }]}
            >
              {!line.inTotal ? "" : tutar === null ? "—" : fmtMoney(tutar, currency)}
            </Text>
          </View>
        );
      })}

      <ToplamSatiri baslik="TOPLAM" tutar={toplam} currency={currency} />

      {/*
        İSKONTO SATIRLARI YALNIZ FARK VARSA BASILIR (kullanıcı isteği,
        17.08.2026). Kullanıcı iskontoyu birim fiyatlara YANSITTIYSA tablodaki
        rakamlar zaten iskontoludur ve satır toplamı hedefe eşittir; o durumda
        ayrıca "İSKONTOLU TOPLAM" yazmak aynı sayıyı iki kez basmak, üstüne de
        müşteriye ikinci bir indirim vaat etmek gibi okunurdu.
      */}
      {iskonto !== null && iskontolu !== null ? (
        <>
          <ToplamSatiri baslik="İSKONTO" tutar={-iskonto} currency={currency} />
          <ToplamSatiri baslik="İSKONTOLU TOPLAM" tutar={iskontolu} currency={currency} vurgu />
        </>
      ) : null}

      {/* Dipnot YALNIZ böyle bir satır varsa basılır. */}
      {toplamDisiVar ? <Text style={S.dipnot}>* Toplam fiyata dahil değildir.</Text> : null}

      {/* KDV cümlesi TEK bayraktan türer (`vatNote`): belgede iki çelişen
          cümlenin yan yana durması devralınan tekliflerin gerçek hatasıydı. */}
      <Text style={S.kdvNotu}>{vatNote(payload.pricing.vatIncluded)}</Text>
    </View>
  );
}

function MetinBlogu({
  baslik,
  satirlar,
  madde,
}: {
  baslik: string;
  satirlar: readonly { id: string; text: string }[];
  madde?: boolean;
}) {
  if (satirlar.length === 0) return null;
  return (
    <View style={{ marginTop: 4 }}>
      <BlokBaslik text={baslik} />
      {satirlar.map((l) =>
        madde ? (
          <View key={l.id} style={S.maddeSatiri} wrap={false}>
            <Text style={S.maddeIsareti}>–</Text>
            <Text style={[S.metinSatiri, { flexGrow: 1, flexShrink: 1, paddingVertical: 0 }]}>
              {l.text}
            </Text>
          </View>
        ) : (
          <Text key={l.id} style={S.metinSatiri}>
            {l.text}
          </Text>
        )
      )}
    </View>
  );
}

// ————————————————————————————————————————————————————————————— belge

/**
 * SÜTUN KAPASİTESİ — bir teknik sayfada bir sütuna sığan yükseklik (pt).
 *
 * İçerik alanı 745,69 pt; sayfa başlığı bloğu (kicker 8,4 + 2 pay, kalem adı
 * 17,25 + 3 pay, öbek dizini 7,4, blok altı 12) 50 pt'ye yakın harcar ve 52
 * yazılır — fazla ölçmek seçilmiş yöndür. Kalanı `pdf-layout` ayrıca %94 ile
 * kelepçeler.
 */
const PDF_SUTUN_KAPASITE = 745.69 - 52;

/** Sayfa sırası için romen rakamı — "TEKNİK ÖZELLİKLER · II". */
function romen(n: number): string {
  const t = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return t[n] ?? String(n);
}

/** Altbilgi künyesi: `TETR-20260127-1 · REV 02 · HABAŞ DÖRTYOL 20T VİNÇ`. */
function altbilgi(offer: OfferDocumentProps["offer"]): string {
  const konu = offer.subject.trim();
  const kimlik = offerDocLine(offer.offerNo, offer.revNo);
  return konu ? `${kimlik} · ${trUpper(konu)}` : kimlik;
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
  const docLine = altbilgi(offer);

  return (
    <Document
      title={`Teklif — ${offer.offerNo}`}
      author="Orion Cranes"
      subject={offer.subject}
      keywords={meta.generatedAt}
    >
      {/* KAPAK — `cover.hidden` yalnız kapağı kaldırır; belge (teknik sayfalar,
          fiyat, şartlar) yerinde kalır. Bayrak payload'ın kendi alanıdır,
          burada tanımlanan ikinci bir süzgeç değildir. */}
      {payload.cover.hidden ? null : <KapakSayfasi {...props} payload={payload} />}

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
            baslik={item.title}
            kicker={
              sayfalar.length > 1
                ? `TEKNİK ÖZELLİKLER · ${romen(s + 1)}`
                : "TEKNİK ÖZELLİKLER"
            }
            dizin={sayfa.basliklar}
            sol={sayfa.sol}
            sag={sayfa.sag}
            altBilgi={
              /* TEST YÜKÜ "teknik" konumunda SON teknik sayfanın ardındadır.
                 Ayrı bir yaprağa alınmadı: iki satırlık bir bloğun tek başına
                 bir A4 tüketmesi belgeyi kalınlaştırır, okunur kılmaz. */
              testYukuTeknikte && i === items.length - 1 && s === sayfalar.length - 1 ? (
                <TestYuku payload={payload} />
              ) : null
            }
          />
        ));
      })}

      {/* TİCARİ SAYFA — şartlar, fiyat, notlar, kapsam dışı işler. */}
      <BrandPage docLine={docLine}>
        {/* Kalem hiç yoksa "teknik" konumdaki test yükü de burada basılır;
            aksi hâlde etkin bir blok belgeden sessizce düşerdi. */}
        {testYukuTicaride ? <TestYuku payload={payload} ilk /> : null}
        <TicariBlok payload={payload} ilk={!testYukuTicaride} />
        <FiyatTablosu payload={payload} currency={offer.currency} />
        {/* NOTLAR VE KAPSAM DIŞI İŞLER YAN YANA (kullanıcı isteği md. 8):
            ikisi de kısa listelerdir ve alt alta durduklarında ticari sayfanın
            yarısını boş bırakıyorlardı. */}
        <View style={[S.sutunlar, { marginTop: 4 }]}>
          <View style={S.sutun}>
            <MetinBlogu baslik="Notlar" satirlar={payload.notes} />
          </View>
          <View style={S.sutun}>
            <MetinBlogu baslik="Kapsam Dışı İşler" satirlar={payload.exclusions} madde />
          </View>
        </View>
      </BrandPage>

      {/* GENEL ŞARTLAR — belgenin SON sayfası (md. 9). */}
      <GenelSartlarSayfasi docLine={docLine} maddeler={printedGeneralTerms(payload)} />
    </Document>
  );
}

export async function renderOfferPdf(props: OfferDocumentProps): Promise<Buffer> {
  // TEK GEÇİŞ yeter: belgede içindekiler yoktur, sayfa numarası toplanacak
  // bir hedef listesi de. (Hesap raporu iki geçiş yapar; teklif yapmaz.)
  return renderToBuffer(<OfferDocument {...props} />);
}
