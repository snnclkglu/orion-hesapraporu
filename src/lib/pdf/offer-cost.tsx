// MALİYET ÇALIŞMASI PDF'İ — İÇ BELGE.
//
// TEKLİF PDF'İNİN İKİZİ DEĞİL, KARŞITIDIR. Teklif müşteriye gider ve marka
// kapağıyla başlar; bu belge FİRMA İÇİNDE kalır, kâr marjını yazar ve her
// sayfasında "İÇ BELGE" damgası taşır. İkisinin karışması bu bölümde
// olabilecek en pahalı hatadır, o yüzden ayrım üç yerde birden işaretlidir:
// dosya adında (`offerCostFileName` — sonda "İÇ BELGE"), her sayfanın
// damgasında ve altbilgi künyesinde.
//
// KAPAK MEKTUBU, HİTAP VE İMZA YOKTUR: bu belge kimseye sunulmaz, okunur.
// Sıra kararın sırasıdır — önce SONUÇ (dört ana başlık ve kâr), sonra
// KIRILIM, sonra kalem kalem AĞIRLIK · HESAP · MALİYET. Yönetici ilk sayfada
// kararını verebilmeli, detayı ancak sorusu varsa açmalıdır.
//
// `textTransform` KULLANILMAZ (teklif PDF'iyle aynı gerekçe): @react-pdf'in
// uygulaması locale'siz `toUpperCase()` çağırır ve "i" harfini "I" yapar.

import React from "react";
import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, PAGE, T, mm, trUpper } from "@/lib/pdf/brand";
import { fmtMoney, fmtNum } from "@/lib/currency";
import { COST_PARAM_DEFS } from "@/lib/offers/cost/params";
import {
  CALC_SECTIONS,
  WEIGHT_SECTIONS,
  costFieldText,
  fmtCostField,
  qtySourceLabel,
} from "@/lib/offers/cost/labels";
import { costModels, costWeights, printedCostPayload } from "@/lib/offers/cost/payload";
import { MATERIAL_PRICE_DEFS, offerRefValue } from "@/lib/offers/cost/registry";
import {
  costBreakdown,
  costGroupTotal,
  costLineAmount,
  costMargin,
  costPerKg,
  costTotals,
} from "@/lib/offers/cost/totals";
import type { CostGroup, CostPayload } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";
import { offerDocLine } from "@/lib/offers/no";

export interface OfferCostDocumentProps {
  offer: {
    offerNo: string;
    subject: string;
    customerName: string;
    currency: string;
    /** Maliyetin kurulduğu teklif revizyonu — künyede karşılaştırılır. */
    offerRevNo: number | null;
  };
  costRevNo: number;
  /** HAM payload — bileşen süzgeci (`printedCostPayload`) KENDİ çağırır. */
  payload: CostPayload;
  /** Teklifin belgesi: satırların teknik karşılığı ve müşteri fiyatı buradan. */
  offerPayload: OfferPayload;
  company: { company: string };
  meta: { generatedAt: string };
}

/**
 * ETİKET–DEĞER satırlarının değer sütunu (pt) — TEK SABİT, İKİ ÇAĞRI YERİ.
 *
 * 110 pt'ken kesit ölçüsü satırı sığmıyordu: "750 × 1.900 × 750 · t 10 mm"
 * ölçülen 123 pt yer ister ve @react-pdf satırı kırpmaz, son sözcüğü ("mm")
 * tek başına alt satıra atar — belgede boşluğa asılı duran bir birim kalırdı.
 * 150 pt en uzun etikete (115 pt) hâlâ 330 pt bırakır.
 *
 * SABİT TEKTİR çünkü `Deger` satırları ile grup toplamı AYNI sütunu paylaşır;
 * biri büyütülüp öteki unutulursa toplamın sayısı satırların sayılarıyla
 * hizasını sessizce kaybeder — göz bunu ancak yan yana koyunca görür.
 */
const DEGER_SUTUN = 150;

const S = StyleSheet.create({
  /**
   * DAMGA KÂĞIDA DEĞİL, İÇERİK IZGARASINA HİZALIDIR.
   *
   * @react-pdf'te mutlak konum Page'in KENAR kutusuna göre çözülür, dolgu
   * kutusuna göre değil: `right: 0` damgayı 16 mm'lik dış marjın DIŞINA
   * atıyordu (ölçüldü: kutunun sağ kenarı x≈592,9 pt; içerik sınırı 549,9 pt,
   * kâğıt kenarı 595,3 pt). Yazıcının kırpma bölgesine düşen bir "İÇ BELGE"
   * damgası hiç basılmayabilir — MALIYET-12'nin ikinci işareti orada ölür.
   *
   * `top` marja EŞİTLENMEZ: damga bilerek üst marj şeridinde durur. 16 mm
   * verilseydi içerik alanının tepesine, yani ilk sayfada marka bandının
   * üstüne otururdu.
   */
  damga: {
    position: "absolute",
    top: mm(6),
    right: PAGE.marginOuter,
    fontFamily: FONTS.mono,
    fontSize: 7,
    fontWeight: 600,
    letterSpacing: 1.6,
    color: BRAND.red,
    borderWidth: 0.8,
    borderColor: BRAND.red,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  bolumBaslik: { ...T.subhead, fontSize: 9.5, marginTop: 12, marginBottom: 4 },
  altBaslik: { ...T.kickerInk, marginTop: 8, marginBottom: 3 },
  satir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline, paddingVertical: 2.2 },
  basSatir: { flexDirection: "row", borderBottomWidth: 0.8, borderBottomColor: BRAND.line350, paddingBottom: 2.5 },
  bas: { ...T.kickerInk, fontSize: 6.4 },
  /**
   * ETİKETTE `flex` YOKTUR — ve bu, belgeyi bozan hatanın kendisiydi.
   *
   * Etiket bir SÜTUN kutusunun içinde durur (`Deger`, `MaliyetGrubu`): altında
   * ipucu ("Teklifte: …", "elle girildi") ve miktar kaynağı satırları vardır.
   * Sütun yönünde `flex: 1` yoga'da `flexBasis: 0` demektir ve bu, TEMEL
   * YÜKSEKLİĞİ sıfırlar: etiket sıfır yükseklikte ölçülür, altındaki ipucu
   * aynı taban çizgisine çizilir ve iki metin ÜST ÜSTE biner (belgede 36 yerde;
   * kullanıcı bildirimi 19.08.2026, md. 12). Yatay genişliği veren zaten
   * sarmalayan kutudur; etiketin kendi payına düşen tek şey yükseklikti.
   *
   * Tek satırlık yatay kullanımda (`MaliyetBaslik`, grup toplamı, özet kutusu)
   * genişlik `satirEtiket` ile verilir — orada kap SATIR yönündedir ve
   * `flexBasis: 0` genişliği sıfırlar, yüksekliği değil. Çıplak `{ flex: 1 }`
   * bu dosyada HİÇBİR yerde kullanılmaz: aynı kısayolun iki yönde iki ayrı
   * anlama gelmesi hatanın kaynağıydı, adlandırılmış stil yönü isimlendirir.
   */
  etiket: { ...T.body, fontSize: 7.6, paddingRight: 6 },
  /**
   * SATIR YÖNÜNDEKİ kapta etiketin artan yeri kaplaması için — değer sütunu
   * ancak böyle sağa yaslanır. Sütun yönündeki kaplarda KULLANILMAZ (yukarıdaki
   * gerekçe): orada `flexBasis: 0` yüksekliği sıfırlar ve satırlar üst üste biner.
   */
  satirEtiket: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  /**
   * DEĞER SÜTUNU. Buraya `flexShrink: 0` YAZILMAZ — @react-pdf'te böyle bir
   * kilit yoktur: `@react-pdf/layout` `setFlexShrink`i `value || 1` ile geçirir,
   * yani 0 sessizce 1 olur. Her düğüm daralabilir; sayıyı bir arada tutan şey
   * sabit genişliktir (`DEGER_SUTUN`, `MALIYET_SUTUN`), esneme kilidi değil.
   */
  deger: { ...T.data, fontSize: 7.6, textAlign: "right" },
  kalin: { fontWeight: 700, color: BRAND.ink },
  not: { ...T.caption, fontSize: 6.8, color: BRAND.gray500 },
  ozetKutu: { borderWidth: 0.8, borderColor: BRAND.line350, padding: 8, marginTop: 10 },
  ozetSatir: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  ozetToplam: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: BRAND.ink,
    marginTop: 4,
    paddingTop: 4,
  },
});

/** Her sayfada tekrar eden İÇ BELGE damgası. */
function Damga() {
  return (
    <Text fixed style={S.damga}>
      İÇ BELGE — MÜŞTERİYE VERİLMEZ
    </Text>
  );
}

/**
 * Bölüm başlığı — SAYFA DİBİNDE YALNIZ KALMAZ.
 *
 * `minPresenceAhead` başlıktan sonra en az bu kadar yer kalmasını şart koşar,
 * yoksa başlık sonraki sayfaya iner (kullanıcı bildirimi 19.08.2026, md. 12:
 * "kaymalar"). 95 pt, altında AKAN bir liste olan başlıklar içindir: maliyet
 * grubunun bölünmez başlık kutusu (alt başlık + sütun adları ≈ 32 pt) artı üç
 * kalem satırı kadar yer. Değer BÜYÜTÜLMEZ: @react-pdf isteneni sonraki
 * kardeşlerin GERÇEK sonuyla sınırlar, yani liste kısaysa boşuna sayfa
 * atlatmaz — ama büyük bir sayı, kısa listelerde de sınırın devreye girip
 * sayfa dibini boş bırakmasına yol açardı.
 *
 * Altında BÖLÜNMEZ bir kutu olan başlıklar (AĞIRLIKLAR, HESAPLAR) bu yolla
 * korunamaz; onlar ilk bölümün kutusuna girer — gerekçesi çağrı yerinde.
 */
function Baslik({
  children,
  minPresenceAhead = 95,
}: {
  children: React.ReactNode;
  minPresenceAhead?: number;
}) {
  return (
    <Text style={S.bolumBaslik} minPresenceAhead={minPresenceAhead}>
      {children}
    </Text>
  );
}

function AltBaslik({
  children,
  minPresenceAhead,
}: {
  children: React.ReactNode;
  /** Yalnız kap `wrap={false}` DEĞİLKEN verilir; bölüm kutusu zaten bölünmez. */
  minPresenceAhead?: number;
}) {
  return (
    <Text style={S.altBaslik} minPresenceAhead={minPresenceAhead}>
      {children}
    </Text>
  );
}

/** İki sütunlu `etiket … değer` satırı — ağırlık ve hesap listelerinin şekli. */
function Deger({
  etiket,
  deger,
  kalin,
  ipucu,
}: {
  etiket: string;
  deger: string;
  kalin?: boolean;
  ipucu?: string;
}) {
  return (
    <View style={S.satir} wrap={false}>
      {/* Etiket kutusu SATIR yönündeki kabın çocuğudur; genişliği `satirEtiket`
          verir. Çıplak `{ flex: 1 }` YAZILMAZ — aynı kısayol sütun yönünde
          yüksekliği sıfırlar ve md. 12'nin üst üste binmesini geri getirir. */}
      <View style={[S.satirEtiket, { paddingRight: 6 }]}>
        <Text style={[S.etiket, kalin ? S.kalin : {}]}>{etiket}</Text>
        {ipucu ? <Text style={S.not}>{ipucu}</Text> : null}
      </View>
      <Text style={[S.deger, kalin ? S.kalin : {}, { width: DEGER_SUTUN }]}>{deger}</Text>
    </View>
  );
}

/**
 * TABLO SÜTUNLARI — her tablo için TEK tanım.
 *
 * Genişlik başlık satırında ve veri satırında AYRI AYRI yazılırsa ikisi
 * sessizce ayrışır: başlık bir sütuna, sayılar bir başkasına yaslanır ve kusur
 * ancak iki satır yan yana konunca görülür. Kalan pay etikete gider
 * (`satirEtiket`), o yüzden sabitlerin toplamı içerik genişliğinin (487,6 pt)
 * altında kalmalıdır — maliyet 240, kırılım 140, kalem 302 pt.
 */
const MALIYET_SUTUN = { miktar: 62, birim: 34, fiyat: 66, tutar: 78 };
const KIRILIM_SUTUN = { tutar: 90, pay: 50 };
const KALEM_SUTUN = { adet: 40, agirlik: 56, kgFiyat: 46, birim: 80, paket: 80 };

function MaliyetBaslik() {
  return (
    <View style={S.basSatir}>
      <Text style={[S.bas, S.satirEtiket]}>KALEM</Text>
      <Text style={[S.bas, { width: MALIYET_SUTUN.miktar, textAlign: "right" }]}>MİKTAR</Text>
      <Text style={[S.bas, { width: MALIYET_SUTUN.birim, textAlign: "right" }]}>BİRİM</Text>
      <Text style={[S.bas, { width: MALIYET_SUTUN.fiyat, textAlign: "right" }]}>BİRİM FİYAT</Text>
      <Text style={[S.bas, { width: MALIYET_SUTUN.tutar, textAlign: "right" }]}>TUTAR</Text>
    </View>
  );
}

/**
 * Maliyet grubu — satırlar ve grup toplamı.
 *
 * Grup toplamı BASILIR çünkü kırılım sayfası yüzdeyi verir ama tutarı vinç
 * bazında vermez; iki vinçli bir teklifte "elektrik 27.674 €" hangi vincin
 * elektriğidir sorusu ancak burada cevaplanır.
 */
function MaliyetGrubu({
  group,
  currency,
  refOf,
}: {
  group: CostGroup;
  currency: string;
  /** Satırın teklifteki karşılığı — `offerRefValue` ile çözülür. */
  refOf: (groupKey: string, lineKey: string) => string | null;
}) {
  const toplam = costGroupTotal(group);
  return (
    // GRUP SAYFA BÖLEBİLİR — dış kaptaki `wrap={false}` KALDIRILDI.
    //
    // Bütün grubu bir arada tutmak iki şey yapıyordu: on üç satırlık ELEKTRİK
    // grubu sığmayınca komple sonraki sayfaya atlıyor ve önceki sayfanın
    // dibinde ölçülen 163 pt boşluk bırakıyordu (kullanıcı bildirimi
    // 19.08.2026, md. 12: "kaymalar"); daha kötüsü, bir grup tam sayfa boyunu
    // (745,7 pt) aşarsa @react-pdf onu bölemez, olduğu yerde bırakır ve
    // ALTBİLGİNİN ÜSTÜNE taşırır — yalnızca bir konsol uyarısıyla.
    // Satırın kendisi zaten bölünmez (aşağıdaki satır bazlı `wrap={false}`),
    // bölünme ancak satır aralarından geçer.
    <View>
      {/* GÖTÜRÜ KİP BELGEDE YAZAR (kullanıcı isteği 18.08.2026, md. 10).
          `printedCostPayload` götürü kipte kalem satırlarını süzer; işaret
          olmasaydı okuyan on üç satırlık bir grubun neden tek satır bastığını
          anlayamaz, "eksik basılmış" sanardı. */}
      {/* BAŞLIK + SÜTUN ADLARI TEK PARÇADIR ve sayfa dibinde YALNIZ KALMAZ:
          `minPresenceAhead` ardından en az üç kalem satırlık yer (≈60 pt)
          kalmasını şart koşar. Kap, ardından gelen kardeşlerin gerçek sonunu
          da gözettiği için kısa gruplar boşuna sayfa atlamaz. */}
      <View wrap={false} minPresenceAhead={60}>
        <AltBaslik>
          {trUpper(group.title)}
          {group.lump ? "  ·  GÖTÜRÜ (TEK FİYAT)" : ""}
        </AltBaslik>
        <MaliyetBaslik />
      </View>
      {group.lines.map((l) => {
        const teklifte = refOf(group.key, l.key);
        const kaynak = qtySourceLabel(l.qtySource);
        const ipucu = [teklifte ? `Teklifte: ${teklifte}` : null, l.note || null]
          .filter(Boolean)
          .join(" · ");
        return (
          <View key={l.id} style={S.satir} wrap={false}>
            <View style={[S.satirEtiket, { paddingRight: 6 }]}>
              <Text style={S.etiket}>{l.label || "—"}</Text>
              {ipucu ? <Text style={S.not}>{ipucu}</Text> : null}
              {!l.qtyManual && kaynak ? <Text style={S.not}>Miktar: {kaynak}</Text> : null}
            </View>
            <Text style={[S.deger, { width: MALIYET_SUTUN.miktar }]}>{fmtNum(l.qty)}</Text>
            <Text style={[S.deger, { width: MALIYET_SUTUN.birim }]}>{l.unit || "—"}</Text>
            <Text style={[S.deger, { width: MALIYET_SUTUN.fiyat }]}>{fmtNum(l.unitPrice)}</Text>
            <Text style={[S.deger, { width: MALIYET_SUTUN.tutar }]}>
              {fmtMoney(costLineAmount(l), currency)}
            </Text>
          </View>
        );
      })}
      {/* TOPLAM SATIRI DA BÖLÜNMEZ: grup artık sayfa bölebildiği için bu satır
          bir sayfa sınırına denk gelebilir; kendi içinde ikiye ayrılırsa
          kalın çizgisi bir sayfada, sayısı ötekinde kalırdı. */}
      <View style={[S.satir, { borderBottomWidth: 0.8, borderBottomColor: BRAND.line350 }]} wrap={false}>
        <Text style={[S.etiket, S.satirEtiket, S.kalin]}>{trUpper(group.title)} TOPLAMI</Text>
        <Text style={[S.deger, S.kalin, { width: DEGER_SUTUN }]}>{fmtMoney(toplam, currency)}</Text>
      </View>
    </View>
  );
}

export function OfferCostDocument({
  offer,
  costRevNo,
  payload,
  offerPayload,
  company,
  meta,
}: OfferCostDocumentProps) {
  const basilan = printedCostPayload(payload);
  const models = costModels(payload);
  const totals = costTotals(basilan, costWeights(models));
  const kirilim = costBreakdown(basilan, totals);
  const kar = costMargin(offerPayload.pricing.total ?? null, totals.total);
  const cur = payload.currency || offer.currency;

  const docLine = `${offerDocLine(offer.offerNo, offer.offerRevNo ?? 0)} · MALİYET M${costRevNo} · İÇ BELGE`;

  // Satırın teklifteki karşılığı EKRANLA AYNI fonksiyondan gelir
  // (`offerRefValue`): iki yerde yazılsaydı belgede görünen not ekrandakinden
  // başka bir şey olabilirdi.
  const refFor = (itemOfferId: string | null) => (groupKey: string, lineKey: string) =>
    offerRefValue(offerPayload, itemOfferId, groupKey, lineKey);

  return (
    <Document
      title={`Maliyet Çalışması — ${offer.offerNo} M${costRevNo}`}
      author={company.company}
      subject="İÇ BELGE — müşteriye verilmez"
    >
      {/* ————————————————————————————————————————— 1. SONUÇ SAYFASI */}
      <BrandPage docLine={docLine} docCode={`M${costRevNo}`}>
        <Damga />
        <BrandBand
          docCode="MALİYET ÇALIŞMASI"
          lines={[
            offer.offerNo,
            `TEKLİF R${offer.offerRevNo ?? 0} · MALİYET M${costRevNo}`,
            meta.generatedAt,
          ]}
        />

        <Baslik>{trUpper(offer.subject || "MALİYET ÇALIŞMASI")}</Baslik>
        <Deger etiket="Müşteri" deger={offer.customerName || "—"} />
        <Deger etiket="Para Birimi" deger={cur} />
        <Deger
          etiket="Kurulduğu Teklif Revizyonu"
          deger={payload.sourceRevNo === null ? "—" : `R${payload.sourceRevNo}`}
          ipucu={
            payload.sourceRevNo !== null && offer.offerRevNo !== null && payload.sourceRevNo !== offer.offerRevNo
              ? `DİKKAT: teklif R${offer.offerRevNo}'e geçmiş — maliyet tazelenmemiş olabilir.`
              : undefined
          }
        />

        <View style={S.ozetKutu}>
          <Text style={[T.kicker, { marginBottom: 4 }]}>DÖRT ANA BAŞLIK</Text>
          <View style={S.ozetSatir}>
            <Text style={[S.etiket, S.satirEtiket]}>PROJE MALİYETİ</Text>
            <Text style={[S.deger, S.kalin]}>{fmtMoney(totals.direct, cur)}</Text>
          </View>
          {totals.rates.map((r) => (
            <View key={r.key} style={S.ozetSatir}>
              <Text style={[S.etiket, S.satirEtiket]}>
                {r.title}
                {r.mode === "oran" && r.percent !== null ? `  (%${fmtNum(r.percent)})` : "  (kalem)"}
              </Text>
              <Text style={S.deger}>{fmtMoney(r.amount, cur)}</Text>
            </View>
          ))}
          <View style={S.ozetToplam}>
            <Text style={[S.etiket, S.satirEtiket, S.kalin]}>TOPLAM MALİYET</Text>
            <Text style={[S.deger, S.kalin]}>{fmtMoney(totals.total, cur)}</Text>
          </View>
          <Text style={[S.not, { marginTop: 4 }]}>
            Oranlar PROJE MALİYETİ üzerinden hesaplanır (kullanıcı kararı,
            17.08.2026); toplam = proje maliyeti × (1 + oranların toplamı).
          </Text>
        </View>

        <View style={S.ozetKutu}>
          <Text style={[T.kicker, { marginBottom: 4 }]}>TEKLİF VE KÂR</Text>
          <View style={S.ozetSatir}>
            <Text style={[S.etiket, S.satirEtiket]}>Teklif Tutarı (müşterinin ödeyeceği)</Text>
            <Text style={S.deger}>{fmtMoney(kar.price, cur)}</Text>
          </View>
          <View style={S.ozetSatir}>
            <Text style={[S.etiket, S.satirEtiket]}>Toplam Maliyet</Text>
            <Text style={S.deger}>{fmtMoney(kar.cost, cur)}</Text>
          </View>
          <View style={S.ozetToplam}>
            <Text style={[S.etiket, S.satirEtiket, S.kalin]}>KÂR</Text>
            <Text style={[S.deger, S.kalin]}>
              {fmtMoney(kar.profit, cur)}
              {kar.marginPercent === null
                ? ""
                : `   (satış üzerinden %${fmtCostField(kar.marginPercent, 1)} · maliyet üzerinden %${fmtCostField(kar.markupPercent, 1)})`}
            </Text>
          </View>
        </View>

        <Baslik>ANA KALEM KIRILIMI</Baslik>
        <View style={S.basSatir}>
          <Text style={[S.bas, S.satirEtiket]}>GRUP</Text>
          <Text style={[S.bas, { width: KIRILIM_SUTUN.tutar, textAlign: "right" }]}>TUTAR</Text>
          <Text style={[S.bas, { width: KIRILIM_SUTUN.pay, textAlign: "right" }]}>PAY</Text>
        </View>
        {kirilim.map((r) => (
          <View key={r.key} style={S.satir} wrap={false}>
            <Text style={[S.etiket, S.satirEtiket]}>{trUpper(r.title)}</Text>
            <Text style={[S.deger, { width: KIRILIM_SUTUN.tutar }]}>{fmtMoney(r.amount, cur)}</Text>
            <Text style={[S.deger, { width: KIRILIM_SUTUN.pay }]}>
              {r.share === null ? "—" : `%${fmtCostField(r.share * 100, 1)}`}
            </Text>
          </View>
        ))}

        <Baslik>KALEM BAZINDA</Baslik>
        <View style={S.basSatir}>
          <Text style={[S.bas, S.satirEtiket]}>KALEM</Text>
          <Text style={[S.bas, { width: KALEM_SUTUN.adet, textAlign: "right" }]}>ADET</Text>
          <Text style={[S.bas, { width: KALEM_SUTUN.agirlik, textAlign: "right" }]}>AĞIRLIK</Text>
          <Text style={[S.bas, { width: KALEM_SUTUN.kgFiyat, textAlign: "right" }]}>€/KG</Text>
          <Text style={[S.bas, { width: KALEM_SUTUN.birim, textAlign: "right" }]}>BİRİM MALİYET</Text>
          <Text style={[S.bas, { width: KALEM_SUTUN.paket, textAlign: "right" }]}>PAKET MALİYET</Text>
        </View>
        {totals.items.map((i) => (
          <View key={i.id} style={S.satir} wrap={false}>
            <Text style={[S.etiket, S.satirEtiket]}>{trUpper(i.title || "—")}</Text>
            <Text style={[S.deger, { width: KALEM_SUTUN.adet }]}>{fmtNum(i.qty)}</Text>
            <Text style={[S.deger, { width: KALEM_SUTUN.agirlik }]}>{fmtNum(i.weightKg)}</Text>
            <Text style={[S.deger, { width: KALEM_SUTUN.kgFiyat }]}>
              {fmtCostField(costPerKg(i.unit, i.weightKg), 2)}
            </Text>
            <Text style={[S.deger, { width: KALEM_SUTUN.birim }]}>{fmtMoney(i.unit, cur)}</Text>
            <Text style={[S.deger, { width: KALEM_SUTUN.paket }]}>{fmtMoney(i.package, cur)}</Text>
          </View>
        ))}
      </BrandPage>

      {/* ————————————————————— 2. KALEM SAYFALARI: ağırlık · hesap · maliyet */}
      {basilan.items.map((item) => {
        const model = models[item.id];
        const v = (k: string) => model?.values[k] ?? null;
        const doluBolum = (fields: readonly { key: string }[]) =>
          fields.some((f) => v(f.key) !== null);
        // Basılacak bölümler ÖNCE süzülür: bölüm başlığı ilk bölümün kutusuna
        // girecek (aşağıdaki gerekçe) ve bunun için "ilk"in kim olduğu render
        // sırasında bilinmelidir.
        const agirlikBolumleri = WEIGHT_SECTIONS.filter((s) => doluBolum(s.fields));
        const hesapBolumleri = CALC_SECTIONS.filter((s) => doluBolum(s.fields));
        return (
          <BrandPage key={item.id} docLine={docLine} docCode={`M${costRevNo}`}>
            <Damga />
            <Baslik>{trUpper(item.title || "KALEM")}</Baslik>
            <Text style={S.not}>
              {[
                item.craneType,
                item.inputs.capacityT === null ? null : `${fmtNum(item.inputs.capacityT)} ton`,
                item.inputs.spanM === null ? null : `${fmtNum(item.inputs.spanM)} m açıklık`,
                item.inputs.liftHeightM === null ? null : `${fmtNum(item.inputs.liftHeightM)} m kaldırma`,
                item.inputs.craneClass,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {model?.eksik.length ? (
              <Text style={[S.not, { color: BRAND.red, marginTop: 4 }]}>
                {model.eksik.join(" ")}
              </Text>
            ) : null}

            {/* AĞIRLIK VE HESAP BÖLÜMLERİ BÜTÜN KALIR (`wrap={false}`) — maliyet
                grubunun tersine, ve bilerek. Bu bölümlerin alan sayısı KODDA
                sabittir; en kalabalığı 13 satır ≈ 240 pt, yani hiçbiri sayfa
                boyunu (745,7 pt) aşamaz ve altbilgiye taşma riski yoktur.
                Maliyet grubunun satırları ise kullanıcının açtığı serbest
                satırlarla sınırsız büyür — orada bütünlük tehlikeliydi. */}
            {/* BÖLÜM BAŞLIĞI İLK BÖLÜMÜN KUTUSUNDADIR, kardeşi değil.
                Ölçülen kusur: "HESAPLAR" 2. sayfanın dibinde tek başına kaldı,
                altındaki 132 pt boş durdu, ilk hesap bölümü 3. sayfada başladı.
                `minPresenceAhead` bunu ÇÖZMEZ — başlıktan sonra 124 pt yer
                vardı, sığmayan şey 13 satırlık (≈240 pt) bölünmez bölümdü.
                Aynı kutuya girince başlık bölümüyle birlikte taşınır ve boşluk
                veri bağımlı bir sayıya değil, yapıya bağlanmış olur. */}
            {agirlikBolumleri.length === 0 ? <Baslik>AĞIRLIKLAR</Baslik> : null}
            {agirlikBolumleri.map((s, i) => (
              <View key={s.key} wrap={false}>
                {i === 0 ? <Baslik>AĞIRLIKLAR</Baslik> : null}
                <AltBaslik>{s.title}</AltBaslik>
                {s.fields
                  .filter((f) => v(f.key) !== null)
                  .map((f) => (
                    <Deger
                      key={f.key}
                      etiket={f.label}
                      kalin={f.sum}
                      deger={`${costFieldText(f, v(f.key))} ${f.unit}`.trim()}
                      ipucu={item.overrides[f.key] === undefined ? undefined : "elle girildi"}
                    />
                  ))}
              </View>
            ))}

            {hesapBolumleri.length === 0 ? <Baslik>HESAPLAR</Baslik> : null}
            {hesapBolumleri.map((s, i) => (
              <View key={s.key} wrap={false}>
                {i === 0 ? <Baslik>HESAPLAR</Baslik> : null}
                <AltBaslik>{s.title}</AltBaslik>
                {s.fields
                  .filter((f) => v(f.key) !== null)
                  .map((f) => (
                    <Deger
                      key={f.key}
                      etiket={f.label}
                      kalin={f.sum}
                      // ⌀ ÖNEKİ BELGEDE DE BASILIR (kullanıcı isteği md. 4).
                      // Ekran `costFieldText`i çağırıyordu, PDF ham
                      // `fmtCostField`i — aynı sayı iki belgede iki türlü
                      // görünüyordu.
                      deger={`${costFieldText(f, v(f.key))} ${f.unit}`.trim()}
                      ipucu={item.overrides[f.key] === undefined ? undefined : "elle girildi"}
                    />
                  ))}
              </View>
            ))}
            {/* KESİT ÖLÇÜLERİ BELGEDE DE DURUR (kullanıcı isteği md. 6).
                Ekranda pop-up'ta açılan ölçüler burada satır satır basılır:
                iç belgeyi altı ay sonra açan mühendis "bu 27.850 kg hangi
                kesitten çıktı" sorusunu ekrana dönmeden cevaplayabilmelidir.
                Ad tek başına ("750x1900x750 t10") ataleti ve kg/m'yi
                söylemiyordu. */}
            {model?.section ? (
              <>
                <Deger
                  etiket="Seçilen Kiriş Kesiti"
                  deger={model.section.name}
                  kalin
                  ipucu={model.deflectionOk === false ? "SEHİM ŞARTI SAĞLANMIYOR" : undefined}
                />
                <Deger
                  etiket="Kesit Ölçüleri (üst × perde × alt, et)"
                  deger={`${fmtNum(model.section.topMm)} × ${fmtNum(model.section.webMm)} × ${fmtNum(model.section.botMm)} · t ${fmtNum(model.section.tMm)} mm`}
                />
                <Deger etiket="Kesit Alanı" deger={`${fmtCostField(model.section.areaCm2, 1)} cm²`} />
                <Deger etiket="Kesit Ataleti" deger={`${fmtCostField(model.section.inertiaCm4, 0)} cm⁴`} />
                <Deger etiket="Sac Metre Ağırlığı" deger={`${fmtCostField(model.section.kgPerM, 1)} kg/m`} />
                {model.camber ? <Deger etiket="Kamber" deger="Verilecek" /> : null}
              </>
            ) : null}

            <Baslik>MALİYET KALEMLERİ</Baslik>
            {item.groups.map((g) => (
              <MaliyetGrubu key={g.id} group={g} currency={cur} refOf={refFor(item.offerItemId)} />
            ))}
          </BrandPage>
        );
      })}

      {/* ————————————————————— 3. PROJE GENELİ, ORANLAR VE KATSAYILAR */}
      <BrandPage docLine={docLine} docCode={`M${costRevNo}`}>
        <Damga />
        <Baslik>PROJE GENELİ VE ORANLI GRUPLAR</Baslik>
        {basilan.general.lines.length ? (
          <MaliyetGrubu group={basilan.general} currency={cur} refOf={() => null} />
        ) : (
          <Text style={S.not}>Proje geneli gideri girilmemiş.</Text>
        )}

        {basilan.rates.map((r) => {
          const tutar = totals.rates.find((x) => x.key === r.key)?.amount ?? null;
          return (
            // ORANLI GRUP DA SAYFA BÖLEBİLİR: "kalem" kipindeki satırları
            // kullanıcı yazar, yani sayısı sınırsızdır — maliyet grubuyla aynı
            // tehlike. Başlık `minPresenceAhead` ile korunur (≈ iki satır),
            // satırların kendisi zaten `Deger` içinde bölünmez.
            <View key={r.key}>
              <AltBaslik minPresenceAhead={40}>{trUpper(r.title)}</AltBaslik>
              {r.mode === "oran" ? (
                <Deger
                  // Ek KULLANILMAZ ("%2'i" yanlış, "%2'si" doğru): Türkçe uyum
                  // sayının OKUNUŞUNA bağlıdır. Çarpım biçimi hepsinde doğru.
                  etiket={`Proje maliyeti × %${fmtNum(r.percent)}`}
                  deger={fmtMoney(tutar, cur)}
                  kalin
                />
              ) : (
                <>
                  {r.lines.map((l) => (
                    <Deger
                      key={l.id}
                      etiket={l.label || "—"}
                      deger={fmtMoney(costLineAmount(l), cur)}
                    />
                  ))}
                  <Deger etiket="TOPLAM" deger={fmtMoney(tutar, cur)} kalin />
                </>
              )}
            </View>
          );
        })}

        {/* HAMMADDE BİRİM FİYATLARI BELGEYE GİRER (kullanıcı isteği md. 12).
            Sekiz sayı maliyetin TABANIDIR: sac, kesim, boya ve imalat
            işçiliği satırlarının hepsi buradan besleniyor. Belgede
            görünmeseler "bu 194.258 € hangi sac fiyatıyla çıktı" sorusu
            cevapsız kalırdı — ve o soru tam olarak altı ay sonra sorulur. */}
        <Baslik>HAMMADDE BİRİM FİYATLARI</Baslik>
        <Text style={S.not}>
          Bu fiyatlar BU maliyet çalışmasına aittir; sonradan değişen bir tedarikçi
          fiyatı bu belgeyi etkilemez.
        </Text>
        {MATERIAL_PRICE_DEFS.map((d) => (
          <Deger
            key={d.key}
            etiket={`${d.label} [${cur} / ${d.unit}]`}
            deger={fmtCostField(payload.materialPrices?.[d.key] ?? null, 2)}
          />
        ))}

        <Baslik>MODEL KATSAYILARI</Baslik>
        <Text style={S.not}>
          Bu katsayılar BU maliyet çalışmasına aittir; sonradan değiştirilen bir
          varsayılan bu belgeyi etkilemez.
        </Text>
        {COST_PARAM_DEFS.map((d) => (
          <Deger
            key={d.key}
            etiket={`${d.label}${d.unit ? ` [${d.unit}]` : ""}`}
            deger={fmtNum(payload.params[d.key] ?? d.value)}
          />
        ))}

        {payload.notes.trim() ? (
          <>
            <Baslik>NOTLAR</Baslik>
            <Text style={T.body}>{payload.notes}</Text>
          </>
        ) : null}
      </BrandPage>
    </Document>
  );
}

export async function renderOfferCostPdf(props: OfferCostDocumentProps): Promise<Buffer> {
  return renderToBuffer(<OfferCostDocument {...props} />);
}
