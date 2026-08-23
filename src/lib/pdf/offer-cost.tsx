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
// Sıra kararın sırasıdır — önce SONUÇ (ana başlıklar, kâr, tek listeli özet ve
// kırılım), sonra kalem kalem AĞIRLIK · HESAP · MALİYET. Yönetici İLK YAPRAKTA
// kararını verebilmeli, detayı ancak sorusu varsa açmalıdır.
//
// BELGE KOMPAKTTIR — VE BU BİR TASARIM KARARIDIR (kullanıcı isteği,
// 22.08.2026): *"Maliyet PDF ve excellerini mevcut maliyet yapısına göre
// yeniden dizayn etmek, kompakt hale getirmek istiyorum. En başta özet olsun.
// Sayfalarca doküman olmasın."* ASTOR fikstürü sekiz yaprak tutuyordu ve
// bunun büyük kısmı BOŞLUKTU: yüzden fazla etiket–değer satırı, her biri 487
// pt'lik içerik genişliğinin tamamını kaplayarak alt alta diziliyordu.
// Sıkıştırma İKİ SÜTUNLA yapılır (`IkiSutun`), punto kısarak değil: aynı
// sayılar, yarı boy. Neyin basıldığı DEĞİŞMEDİ — belge hâlâ altı ay sonra
// "bu 194.258 € nereden çıktı" sorusunu cevaplayabilmelidir.
//
// ÖZET `costOverview`DEN OKUNUR — ekranın ve Excel'in okuduğu yapının ta
// kendisi (MALIYET-29). Bu belge bugüne kadar kendi kârını `costMargin` ile
// AYRICA hesaplıyordu ve fiyat satırlarına elle yazılan maliyetleri hiç
// görmüyordu: ekran bir kâr, Excel başka bir kâr, PDF üçüncü bir kâr
// gösteriyordu. MALIYET-24'ün yasakladığı ayrışmanın kendisiydi.
//
// `textTransform` KULLANILMAZ (teklif PDF'iyle aynı gerekçe): @react-pdf'in
// uygulaması locale'siz `toUpperCase()` çağırır ve "i" harfini "I" yapar.

import React from "react";
import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, PAGE, T, mm, trUpper } from "@/lib/pdf/brand";
import { fmtMoney0, fmtNum, fmtTutar } from "@/lib/currency";
import { baslikDuzeni } from "@/lib/tr-text";
import {
  WEIGHT_SECTIONS,
  costFieldText,
  fmtCostField,
  qtySourceLabel,
} from "@/lib/offers/cost/labels";
import type { CostFieldDef } from "@/lib/offers/cost/labels";
import {
  costModels,
  costSteelWeights,
  costWeights,
  printedCostPayload,
} from "@/lib/offers/cost/payload";
import { MATERIAL_PRICE_DEFS, offerRefValue } from "@/lib/offers/cost/registry";
import { costHeatHex, costLargestAmount } from "@/lib/offers/cost/heat";
import {
  costBreakdown,
  costGroupTotal,
  costLineAmount,
  costOverview,
  costTotals,
} from "@/lib/offers/cost/totals";
import type { CostOverview } from "@/lib/offers/cost/totals";
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

/**
 * İKİ SÜTUNLU LİSTEDE değer sütunu (pt).
 *
 * Sütun genişliği (487,6 − 14 boşluk) / 2 ≈ 236,8 pt'dir; 74 pt değere, kalan
 * ~157 pt etikete gider. En uzun etiket ("Tahrik Grubu (motor + redüktör +
 * fren)") ölçülen ~122 pt yer ister, en uzun sayı ("2.100.000") ~46 pt —
 * ikisi de sığar. Kesit ölçüsü gibi UZUN DEĞERLER iki sütuna girmez, tam
 * genişlikte basılır (`Deger`); orada `DEGER_SUTUN` geçerlidir.
 */
const DAR_DEGER = 74;

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
  // ————————————————————————————————— ölçek (KOMPAKT)
  //
  // Punto kısılmadı, PAY kısıldı ve satırlar İKİ SÜTUNA bölündü. Bir etiket–
  // değer satırı 12,5 pt'den 10,2 pt'ye indi (%18); asıl kazanç ise sütunlarda
  // (%50). Yazının kendisi 7,6 → 7,2 pt: mono rakamlar 7 pt'nin altında
  // basılınca binlik ayraçları birbirine giriyor ve iç belge okunmaz oluyordu.
  bolumBaslik: { ...T.subhead, fontSize: 9, marginTop: 9, marginBottom: 3 },
  altBaslik: { ...T.kickerInk, marginTop: 5.5, marginBottom: 2 },
  satir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline, paddingVertical: 1.5 },
  basSatir: { flexDirection: "row", borderBottomWidth: 0.8, borderBottomColor: BRAND.line350, paddingBottom: 2 },
  bas: { ...T.kickerInk, fontSize: 6.2 },
  /**
   * İKİ SÜTUNLU LİSTE — belgenin dikey borcunu yarıya indiren şey.
   *
   * Bölünme BÖLÜM İÇİNDE olur, sayfa boyunca değil: her bölüm (ör. "ARABA")
   * kendi satırlarını ikiye ayırır ve bölüm bir bütün olarak (`wrap={false}`)
   * yerleşir. Sayfa boyunca akan iki bağımsız sütun kurulsaydı sayfa
   * sınırında ikisi ayrı yerde kırılır, sol sütunun devamı sağ sütunun
   * ortasından çıkardı — okuma sırası kaybolurdu.
   */
  ikiSutun: { flexDirection: "row", gap: 14 },
  sutun: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
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
  etiket: { ...T.body, fontSize: 7.2, paddingRight: 6 },
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
  deger: { ...T.data, fontSize: 7.2, textAlign: "right" },
  kalin: { fontWeight: 700, color: BRAND.ink },
  not: { ...T.caption, fontSize: 6.4, color: BRAND.gray500 },
  /**
   * DEĞERİN ALTINDAKİ YÜZDE (kullanıcı isteği 23.08.2026, md. 6).
   *
   * Aynı hücreye " · %16" diye eklemek 52 pt'lik sütuna sığmıyordu (ölçüldü:
   * "126.695 € · %65" ≈ 62 pt) ve @react-pdf sığmayanı KIRPMAZ, taşırır.
   * İkinci satır 5,6 pt'dir: bir yüzde en fazla dört karakterdir ve mono
   * rakamların binlik ayracı burada yoktur, yani 7 pt sınırı geçerli değil.
   */
  yuzde: { ...T.caption, fontSize: 5.6, color: BRAND.gray500, textAlign: "right" },
  /** Uyarı notu — sayılmayan ama SÖYLENEN şeyler (MALIYET-13/29). */
  uyari: { ...T.caption, fontSize: 6.6, color: BRAND.red, marginTop: 3 },
  ozetKutu: { borderWidth: 0.8, borderColor: BRAND.line350, padding: 6, marginTop: 8 },
  /** İki özet kutusu YAN YANA — ilk yaprağın en pahalı dikey borcu buydu. */
  kutuSirasi: { flexDirection: "row", gap: 10, marginTop: 8 },
  kutu: { flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 0.8, borderColor: BRAND.line350, padding: 6 },
  ozetSatir: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.6 },
  ozetToplam: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.8,
    borderTopColor: BRAND.ink,
    marginTop: 3,
    paddingTop: 3,
  },
  /**
   * KÜNYE TEK ŞERİTTİR, satır satır değil.
   *
   * Müşteri · para birimi · kaynak revizyon eskiden üç `Deger` satırıydı ve
   * ilk yaprağın 40 pt'sini yiyordu. Üçü de KISA değerlerdir; ayraçla yan yana
   * dizildiklerinde aynı bilgiyi tek satırda verirler.
   */
  kunyeSerit: { ...T.caption, fontSize: 7, color: BRAND.gray700, marginTop: 2 },
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

/**
 * BİR BÖLÜMÜN DOLU ALANLARI — iki sütuna dağıtılacak satır listesi.
 *
 * Değer metni EKRANLA AYNI fonksiyondan çıkar (`costFieldText`): PDF bir
 * zamanlar ham `fmtCostField` çağırıyordu ve ⌀ öneki belgede düşüyordu, yani
 * aynı sayı iki yerde iki türlü görünüyordu.
 */
function alanSatirlari(
  fields: readonly CostFieldDef[],
  v: (k: string) => number | null,
  /** Isı ölçeğinin tabanı — kilogram alanları büyüklüğüne göre renklenir. */
  isiTabani?: number
): DegerSatiri[] {
  return fields
    .filter((f) => v(f.key) !== null)
    .map((f) => ({
      key: f.key,
      etiket: f.label,
      kalin: f.sum,
      deger: `${costFieldText(f, v(f.key))} ${f.unit}`.trim(),
      // AĞIRLIK ISISI BELGEDE DE VARDIR (kullanıcı isteği 23.08.2026, md. 3–4):
      // ekranla AYNI rampa (`costHeatHex`), yalnız kilogram alanlarında.
      renk:
        isiTabani === undefined || f.unit !== "kg"
          ? undefined
          : (costHeatHex(v(f.key), isiTabani) ?? undefined),
    }));
}

/** Bir `etiket … değer` satırının verisi — iki sütuna dağıtılabilmesi için. */
interface DegerSatiri {
  key: string;
  etiket: string;
  deger: string;
  kalin?: boolean;
  ipucu?: string;
  /** Değerin mürekkebi — ısı rengi; verilmezse belgenin kendi mürekkebi. */
  renk?: string;
}

/**
 * `etiket … değer` satırı — ağırlık, hesap ve katsayı listelerinin şekli.
 *
 * `dar` verildiğinde değer sütunu iki sütunlu ızgaraya göre daralır
 * (`DAR_DEGER`); tam genişlikte basılan satırlar (kesit ölçüleri, künye)
 * geniş sütunu kullanmaya devam eder.
 */
function Deger({
  etiket,
  deger,
  kalin,
  ipucu,
  dar,
  renk,
}: {
  etiket: string;
  deger: string;
  kalin?: boolean;
  ipucu?: string;
  dar?: boolean;
  /** Değerin mürekkebi — ısı rengi (md. 3–4); verilmezse belgenin mürekkebi. */
  renk?: string;
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
      <Text
        style={[
          S.deger,
          kalin ? S.kalin : {},
          { width: dar ? DAR_DEGER : DEGER_SUTUN },
          renk ? { color: renk } : {},
        ]}
      >
        {deger}
      </Text>
    </View>
  );
}

/**
 * SATIRLARI İKİ SÜTUNA BÖLER — belgenin kompaktlığı buradan gelir.
 *
 * SIRA SÜTUN SÜTUNDUR, satır satır DEĞİL: soldaki sütun listenin ilk yarısını,
 * sağdaki ikinci yarısını taşır. Zikzak (1-sol, 2-sağ, 3-sol…) dizilseydi göz
 * her satırda sayfayı yatay olarak taramak zorunda kalırdı; sütun sütun
 * dizilim, listeyi ikiye katlanmış TEK liste olarak okutur.
 *
 * TEK SATIRLIK LİSTE BÖLÜNMEZ: sağı boş bir ızgara, sayfanın yarısını
 * kullanılmamış gösterir ve okuyan "eksik mi basıldı" diye sorar.
 */
function IkiSutunlu({ satirlar }: { satirlar: readonly DegerSatiri[] }) {
  if (satirlar.length === 0) return null;
  if (satirlar.length === 1) {
    const r = satirlar[0];
    return <Deger etiket={r.etiket} deger={r.deger} kalin={r.kalin} ipucu={r.ipucu} renk={r.renk} />;
  }
  const orta = Math.ceil(satirlar.length / 2);
  const sutunlar = [satirlar.slice(0, orta), satirlar.slice(orta)];
  return (
    <View style={S.ikiSutun}>
      {sutunlar.map((sutun, i) => (
        // `S.sutun`daki `flexBasis: 0` SATIR yönündedir (kap `ikiSutun`) ve
        // GENİŞLİĞİ eşitler — MALIYET-30'un yasakladığı sütun yönündeki
        // kullanım değildir. İçerideki `Deger` satırları kendi kaplarının
        // çocuğudur ve yükseklikleri normal ölçülür.
        <View key={i} style={S.sutun}>
          {sutun.map((r) => (
            <Deger
              key={r.key}
              etiket={r.etiket}
              deger={r.deger}
              kalin={r.kalin}
              ipucu={r.ipucu}
              renk={r.renk}
              dar
            />
          ))}
        </View>
      ))}
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
const MALIYET_SUTUN = { miktar: 58, birim: 32, fiyat: 62, tutar: 74 };
/** Kırılım İKİ IZGARADA yan yana basılır; sütunlar bir yarının ölçüsüdür. */
const KIRILIM_SUTUN = { tutar: 62, pay: 28 };
/**
 * ÖZET LİSTESİ — vinçler VE serbest fiyat satırları, tek tabloda (MALIYET-38).
 *
 * Sabitlerin toplamı 322 pt; kalan ~165 pt kalem adına gider ve "32T X 30M
 * ÇİFT KİRİŞ TAM PORTAL VİNÇ" orada iki satıra sarar. Ekranın beş başlığından
 * ORAN SÜTUNLARI BİRLEŞTİRİLDİ ("GENEL GİDER"): üç oranı ayrı sütun yapmak
 * kalem adına 30 pt bırakıyordu ve belgede asıl soru "bu kalem ne tutuyor"dur;
 * oranların kendi dağılımı zaten ANA BAŞLIKLAR kutusundadır.
 */
const OZET_SUTUN = { adet: 26, celik: 48, agirlik: 48, imalat: 52, proje: 52, genel: 52, maliyet: 58 };

/**
 * BİR SAYININ TABANINA ORANI (%) — ekranla AYNI kural (`overview-view.tsx`).
 *
 * Kullanıcı isteği (23.08.2026, md. 6): *"çelik, toplam, imalat, proje ve genel
 * gider kısımlarının değerlerinin yanına maliyet toplamlarına % oranı da
 * yazmanı istiyorum. Hem uygulamaya hem pdf excel raporlara."*
 *
 * İKİ TABAN VARDIR ve fark bilinçlidir — bir kilogramın bir avroya oranı diye
 * bir şey yoktur: PARA sütunları SATIRIN KENDİ MALİYETİNE, AĞIRLIK sütunları
 * belgenin dip toplamına oranlanır. MALİYET sütununda yüzde YOKTUR; o tabandır.
 */
function oran(pay: number | null, taban: number | null): number | null {
  if (pay === null || taban === null || taban === 0 || !Number.isFinite(taban)) return null;
  return (pay / taban) * 100;
}

/**
 * ÖZET TABLOSUNUN İKİ SATIRLI HÜCRESİ — üstte değer, altında yüzde.
 *
 * `View`e SABİT GENİŞLİK verilir, `flex` DEĞİL (MALIYET-30): sütun yönündeki
 * bir kapta `flexBasis: 0` yüksekliği sıfırlar ve iki satır ÜST ÜSTE binerdi.
 */
function OzetHucre({
  genislik,
  deger,
  yuzde,
  kalin,
  renk,
}: {
  genislik: number;
  deger: string;
  yuzde: number | null;
  kalin?: boolean;
  renk?: string;
}) {
  return (
    <View style={{ width: genislik }}>
      <Text style={[S.deger, kalin ? S.kalin : {}, renk ? { color: renk } : {}]}>{deger}</Text>
      {yuzde === null ? null : <Text style={S.yuzde}>%{fmtCostField(yuzde, 0)}</Text>}
    </View>
  );
}

/** Özet kutusunun bir satırı; `cizgi` üstüne kalın ayraç koyar (ara toplam). */
function OzetSatir({
  etiket,
  tutar,
  currency,
  cizgi,
}: {
  etiket: string;
  tutar: number | null;
  currency: string;
  cizgi?: boolean;
}) {
  return (
    <View style={cizgi ? S.ozetToplam : S.ozetSatir} wrap={false}>
      <Text style={[S.etiket, S.satirEtiket, cizgi ? S.kalin : {}]}>{etiket}</Text>
      <Text style={[S.deger, cizgi ? S.kalin : {}]}>{fmtMoney0(tutar, currency)}</Text>
    </View>
  );
}

/**
 * MALİYET ÖZETİ LİSTESİ — vinçler ve serbest fiyat satırları TEK tabloda.
 *
 * Ekranın `OzetSayfasi` tablosunun belgedeki karşılığıdır (MALIYET-38) ve aynı
 * `costOverview` alanlarını okur. İKİ FARK vardır ve ikisi de bilinçlidir:
 *
 *   · KÂR YÜZDESİ VE TAHMİNİ SATIŞ SÜTUNLARI YOKTUR. Onlar ekranda bir ÖN
 *     ÇALIŞMA aracıdır (MALIYET-39) ve teklife yazılmazlar; basılmış bir
 *     belgede duran bir "tahmini satış" rakamı, altı ay sonra teklifin
 *     kendisiyle karıştırılırdı.
 *   · ORAN SÜTUNLARI "GENEL GİDER"DE BİRLEŞİR — gerekçesi `OZET_SUTUN`da.
 *
 * SERBEST SATIRIN BEŞ BAŞLIĞI ELLE GİRİLİR (23.08.2026, md. 1) ve
 * GİRİLMEMİŞSE UYDURULMAZ: bir nakliyenin "imalat payı" diye bir şey yoktur
 * (değişmez md. 4); dokunulmamış hücre "—" kalır.
 */
function OzetListesi({
  ozet,
  currency,
}: {
  ozet: CostOverview;
  currency: string;
}) {
  const para = (v: number | null) => fmtMoney0(v, currency);
  const kg = (v: number | null) => (v === null ? "—" : fmtCostField(v, 0));

  const satirlar = [
    ...ozet.items.map((i) => ({
      id: i.id,
      baslik: i.title || "—",
      vinc: true,
      qty: i.qty,
      celik: i.steelPackageKg,
      agirlik: i.weightPackageKg,
      imalat: i.headings.fabrication,
      proje: i.headings.project,
      genel: topla(i.headings.rates.map((r) => r.amount)),
      maliyet: i.headings.loaded,
    })),
    // SERBEST SATIRIN BEŞ BAŞLIĞI DA BASILIR (23.08.2026, md. 1): kullanıcı
    // onları Özet sayfasından ELLE giriyor ve girdiği sayı belgede görünmek
    // zorundadır. Bu üç alan bir süre sabit `null` yazılıydı — o hâl, özetten
    // girilen imalat/proje/genel gider tutarlarının PDF'te sessizce "—"
    // görünmesi ve TOPLAM satırının yalnız vinçleri sayması demekti.
    // UYDURULMAZ AMA YOK SAYILMAZ DA: dokunulmamış hücre yine `null` gelir
    // (`costOverview`), yani "—" ancak GERÇEKTEN girilmemişse basılır.
    ...ozet.manualLines.map((l) => ({
      id: l.id,
      baslik: l.description || "—",
      vinc: false,
      qty: null,
      celik: l.steelKg,
      agirlik: l.totalKg,
      imalat: l.headings.fabrication,
      proje: l.headings.project,
      genel: topla(l.headings.rates.map((r) => r.amount)),
      maliyet: l.amount,
    })),
  ];
  if (satirlar.length === 0) {
    return <Text style={S.not}>Bu maliyet çalışmasında henüz kalem yok.</Text>;
  }

  // ISI ÖLÇEKLERİ SÜTUN BAZINDADIR (kullanıcı isteği 23.08.2026, md. 4):
  // "bu sütunun en büyüğü" cümlesi literal olarak doğrudur. Tek bir ölçek
  // kurulsaydı çelik ağırlığı toplam ağırlıkla yarışır ve HER ZAMAN daha soğuk
  // görünürdü — sütunun kendi içindeki fark hiç okunmazdı.
  const enBuyukMaliyet = costLargestAmount(satirlar.map((r) => r.maliyet));
  const enBuyukCelik = costLargestAmount(satirlar.map((r) => r.celik));
  const enBuyukAgirlik = costLargestAmount(satirlar.map((r) => r.agirlik));

  return (
    <View>
      <View style={S.basSatir}>
        <Text style={[S.bas, S.satirEtiket]}>KALEM</Text>
        <Text style={[S.bas, { width: OZET_SUTUN.adet, textAlign: "right" }]}>ADET</Text>
        {/* BİRİM BAŞLIĞIN İKİNCİ SATIRINDADIR: tek satıra sığdırıldığında
            harf aralıklı mono başlıklar komşusuna yapışıyordu ("ÇELİK
            KGTOPLAM KG") — sütun genişliğini büyütmek ise kalem adının
            payından yerdi. */}
        <Text style={[S.bas, { width: OZET_SUTUN.celik, textAlign: "right" }]}>{"ÇELİK\n(KG)"}</Text>
        <Text style={[S.bas, { width: OZET_SUTUN.agirlik, textAlign: "right" }]}>
          {"TOPLAM\n(KG)"}
        </Text>
        <Text style={[S.bas, { width: OZET_SUTUN.imalat, textAlign: "right" }]}>İMALAT</Text>
        <Text style={[S.bas, { width: OZET_SUTUN.proje, textAlign: "right" }]}>PROJE</Text>
        <Text style={[S.bas, { width: OZET_SUTUN.genel, textAlign: "right" }]}>GENEL GİDER</Text>
        <Text style={[S.bas, { width: OZET_SUTUN.maliyet, textAlign: "right" }]}>MALİYET</Text>
      </View>
      {satirlar.map((r) => (
        <View key={r.id} style={S.satir} wrap={false}>
          <View style={[S.satirEtiket, { paddingRight: 6 }]}>
            <Text style={S.etiket}>{trUpper(r.baslik)}</Text>
            {/* KAYNAK BİR SÜTUN DEĞİL, BİR İŞARET (ekranla aynı karar): tek
                listenin amacı ayrımı kaldırmaktı, ama "bu satır nereden
                geliyor" sorusunun cevabı yine de görünmeli. */}
            {r.vinc ? null : <Text style={S.not}>fiyat satırı</Text>}
          </View>
          <Text style={[S.deger, { width: OZET_SUTUN.adet }]}>
            {r.qty === null ? "—" : fmtCostField(r.qty, 0)}
          </Text>
          {/* AĞIRLIK YÜZDESİNİN TABANI BELGENİN DİP TOPLAMIDIR ("bu kalem
              belgedeki çeliğin %75'i"); PARA yüzdelerininki SATIRIN KENDİ
              MALİYETİDİR ("bu vincin maliyetinin %65'i proje"). */}
          <OzetHucre
            genislik={OZET_SUTUN.celik}
            deger={kg(r.celik)}
            yuzde={oran(r.celik, ozet.steelKgAll)}
            renk={costHeatHex(r.celik, enBuyukCelik) ?? undefined}
          />
          <OzetHucre
            genislik={OZET_SUTUN.agirlik}
            deger={kg(r.agirlik)}
            yuzde={oran(r.agirlik, ozet.weightKgAll)}
            renk={costHeatHex(r.agirlik, enBuyukAgirlik) ?? undefined}
          />
          <OzetHucre
            genislik={OZET_SUTUN.imalat}
            deger={para(r.imalat)}
            yuzde={oran(r.imalat, r.maliyet)}
          />
          <OzetHucre
            genislik={OZET_SUTUN.proje}
            deger={para(r.proje)}
            yuzde={oran(r.proje, r.maliyet)}
          />
          <OzetHucre
            genislik={OZET_SUTUN.genel}
            deger={para(r.genel)}
            yuzde={oran(r.genel, r.maliyet)}
          />
          {/* MALİYET SÜTUNUNDA YÜZDE YOKTUR: o, ötekilerin TABANIDIR. Rengi
              satırın büyüklüğünü söyler (MALIYET-44'ün belgedeki karşılığı). */}
          <OzetHucre
            genislik={OZET_SUTUN.maliyet}
            deger={para(r.maliyet)}
            yuzde={null}
            kalin
            renk={costHeatHex(r.maliyet, enBuyukMaliyet) ?? undefined}
          />
        </View>
      ))}
      {/* DİP TOPLAM AĞIRLIKLARI serbest satırların elle girilen kilolarını da
          içerir (`steelKgAll` / `weightKgAll`); €/kg metriği ise yalnız
          VİNÇLERİN kilosunu okur ve o sayı kalem sayfasındadır.
          MALİYET SÜTUNUNUN DİP TOPLAMI belge toplamı + elle maliyetlerdir
          (`margin.cost`) — sütunu toplamak dağıtılamayan yükü (`unallocated`)
          dışarıda bırakır ve okuyan kâr satırıyla tutturamazdı. */}
      <View style={[S.satir, { borderBottomWidth: 0.8, borderBottomColor: BRAND.line350 }]} wrap={false}>
        <Text style={[S.etiket, S.satirEtiket, S.kalin]}>TOPLAM</Text>
        <Text style={[S.deger, { width: OZET_SUTUN.adet }]} />
        {/* AĞIRLIK DİP TOPLAMINDA YÜZDE YOKTUR: o hücre zaten satır
            yüzdelerinin TABANIDIR ve %100 yazmak hiçbir şey söylemezdi. */}
        <Text style={[S.deger, S.kalin, { width: OZET_SUTUN.celik }]}>{kg(ozet.steelKgAll)}</Text>
        <Text style={[S.deger, S.kalin, { width: OZET_SUTUN.agirlik }]}>{kg(ozet.weightKgAll)}</Text>
        {/* PARA SÜTUNLARININ DİP TOPLAMI KENDİ SÜTUNUNU TOPLAR, `costTotals`i
            DEĞİL: serbest fiyat satırlarının beş başlığı artık elle
            girilebiliyor (23.08.2026, md. 1) ve `totals.fabrication` yalnız
            VİNÇLERİ sayar. İkisi karışsaydı sütunun gözle toplanan hâli dip
            toplamı tutturmazdı. Yüzdenin tabanı belgenin toplam maliyetidir —
            satırdaki cümlenin belge düzeyindeki karşılığı. */}
        <OzetHucre
          genislik={OZET_SUTUN.imalat}
          deger={para(topla(satirlar.map((r) => r.imalat)))}
          yuzde={oran(topla(satirlar.map((r) => r.imalat)), ozet.margin.cost)}
          kalin
        />
        <OzetHucre
          genislik={OZET_SUTUN.proje}
          deger={para(topla(satirlar.map((r) => r.proje)))}
          yuzde={oran(topla(satirlar.map((r) => r.proje)), ozet.margin.cost)}
          kalin
        />
        <OzetHucre
          genislik={OZET_SUTUN.genel}
          deger={para(topla(satirlar.map((r) => r.genel)))}
          yuzde={oran(topla(satirlar.map((r) => r.genel)), ozet.margin.cost)}
          kalin
        />
        <Text style={[S.deger, S.kalin, { width: OZET_SUTUN.maliyet }]}>{para(ozet.margin.cost)}</Text>
      </View>
    </View>
  );
}

/** Boş değeri SIFIR SAYMAYAN toplam — hiç sayı yoksa `null` (değişmez md. 4). */
function topla(list: readonly (number | null)[]): number | null {
  const dolu = list.filter((n): n is number => n !== null);
  return dolu.length ? dolu.reduce((t, n) => t + n, 0) : null;
}

/**
 * ANA KALEM KIRILIMI — İKİ IZGARADA yan yana.
 *
 * Altı satırlık bir liste sayfanın tam genişliğini kullandığında karar
 * yaprağının kalan yerini harcıyordu; iki ızgara aynı listeyi yarı boyda
 * verir. Sıra SÜTUN SÜTUNDUR (`IkiSutunlu` ile aynı gerekçe).
 */
function Kirilim({
  satirlar,
  currency,
}: {
  satirlar: readonly { key: string; title: string; amount: number; share: number | null }[];
  currency: string;
}) {
  if (satirlar.length === 0) return <Text style={S.not}>Kırılacak bir grup yok.</Text>;
  const orta = Math.ceil(satirlar.length / 2);
  // TEK SATIRLIK KIRILIM BÖLÜNMEZ: ikiye ayrılsaydı sağ ızgara satırsız bir
  // "GRUP · TUTAR · PAY" başlığından ibaret kalır ve okuyan orada eksik bir
  // şey arardı (`IkiSutunlu` ile aynı kural).
  const yarilar =
    satirlar.length === 1 ? [satirlar] : [satirlar.slice(0, orta), satirlar.slice(orta)];
  return (
    <View style={S.ikiSutun}>
      {yarilar.map((yari, i) => (
        <View key={i} style={S.sutun}>
          <View style={S.basSatir}>
            <Text style={[S.bas, S.satirEtiket]}>GRUP</Text>
            <Text style={[S.bas, { width: KIRILIM_SUTUN.tutar, textAlign: "right" }]}>TUTAR</Text>
            <Text style={[S.bas, { width: KIRILIM_SUTUN.pay, textAlign: "right" }]}>PAY</Text>
          </View>
          {yari.map((r) => (
            <View key={r.key} style={S.satir} wrap={false}>
              <Text style={[S.etiket, S.satirEtiket]}>{trUpper(r.title)}</Text>
              <Text style={[S.deger, { width: KIRILIM_SUTUN.tutar }]}>
                {fmtMoney0(r.amount, currency)}
              </Text>
              <Text style={[S.deger, { width: KIRILIM_SUTUN.pay }]}>
                {r.share === null ? "—" : `%${fmtCostField(r.share * 100, 0)}`}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

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
  enBuyukTutar,
  refOf,
}: {
  group: CostGroup;
  currency: string;
  /**
   * ISI ÖLÇEĞİNİN TABANI — BELGENİN en büyük satır tutarı (MALIYET-44).
   *
   * Grubun kendi en büyüğü DEĞİL ve bu bilinçlidir: 500 €'luk bir grubun en
   * pahalı satırı, 70.000 €'luk grubunkiyle aynı kırmızıyı alırdı. Ekran da
   * aynı tabanı kullanır (`lines-view`), yani aynı satır iki yerde aynı renk.
   */
  enBuyukTutar: number;
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
        // ÜÇ İPUCU TEK SATIRDA (kompaktlık, 22.08.2026): "Teklifte: …",
        // "Miktar: …" ve serbest not eskiden ayrı ayrı `Text`lerdi ve her biri
        // satıra ~8 pt dikey borç yazıyordu (MALIYET-25). Üçü de KISA
        // metinlerdir ve ayraçla yan yana dizildiklerinde aynı şeyi söylerler.
        // BİLGİ DÜŞMEDİ — düşen yalnız boşluktur.
        const ipucu = [
          teklifte ? `Teklifte: ${teklifte}` : null,
          !l.qtyManual && kaynak ? `Miktar: ${kaynak}` : null,
          l.note || null,
        ]
          .filter(Boolean)
          .join("  ·  ");
        return (
          <View key={l.id} style={S.satir} wrap={false}>
            <View style={[S.satirEtiket, { paddingRight: 6 }]}>
              <Text style={S.etiket}>{l.label || "—"}</Text>
              {ipucu ? <Text style={S.not}>{ipucu}</Text> : null}
            </View>
            <Text style={[S.deger, { width: MALIYET_SUTUN.miktar }]}>{fmtNum(l.qty)}</Text>
            <Text style={[S.deger, { width: MALIYET_SUTUN.birim }]}>{baslikDuzeni(l.unit) || "—"}</Text>
            <Text style={[S.deger, { width: MALIYET_SUTUN.fiyat }]}>
              {l.priceSource ? fmtNum(l.unitPrice) : fmtTutar(l.unitPrice)}
            </Text>
            {/* TUTAR ISISI BELGEDE DE VARDIR (md. 4): ekranla AYNI rampa
                (`costHeatHex`), aynı taban. Renk TEK TAŞIYICI değildir —
                sayının kendisi zaten yazılıdır. */}
            <Text
              style={[
                S.deger,
                { width: MALIYET_SUTUN.tutar },
                (() => {
                  const renk = costHeatHex(costLineAmount(l), enBuyukTutar);
                  return renk ? { color: renk } : {};
                })(),
              ]}
            >
              {fmtMoney0(costLineAmount(l), currency)}
            </Text>
          </View>
        );
      })}
      {/* TOPLAM SATIRI DA BÖLÜNMEZ: grup artık sayfa bölebildiği için bu satır
          bir sayfa sınırına denk gelebilir; kendi içinde ikiye ayrılırsa
          kalın çizgisi bir sayfada, sayısı ötekinde kalırdı. */}
      <View style={[S.satir, { borderBottomWidth: 0.8, borderBottomColor: BRAND.line350 }]} wrap={false}>
        <Text style={[S.etiket, S.satirEtiket, S.kalin]}>{trUpper(group.title)} TOPLAMI</Text>
        <Text style={[S.deger, S.kalin, { width: DEGER_SUTUN }]}>{fmtMoney0(toplam, currency)}</Text>
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
  const kirilim = costBreakdown(basilan, totals).sort((a, b) => b.amount - a.amount);
  // ÖZET ÇEKİRDEKTEN OKUNUR (MALIYET-29): ekran ve Excel de aynı yapıyı okur.
  // Belge bugüne kadar kârı kendi hesaplıyordu (`costMargin`) ve fiyat
  // satırlarına elle yazılan maliyetleri görmüyordu — üç İÇ BELGE üç ayrı kâr
  // gösteriyordu. `payload` da verilir: beş başlığın kalem bazında dağılımı ve
  // serbest satırların elle girilen ağırlıkları ondan okunur.
  const ozet = costOverview(totals, offerPayload, costSteelWeights(models), basilan);
  const kar = ozet.margin;
  const cur = payload.currency || offer.currency;

  // ISI ÖLÇEĞİNİN TABANI BİR KEZ HESAPLANIR VE AŞAĞI GEÇİRİLİR (MALIYET-44):
  // her grubun kendi tabanını bulması, aynı sayının belgenin iki yerinde iki
  // farklı renk alması demekti.
  const enBuyukTutar = costLargestAmount([
    ...basilan.items.flatMap((i) => i.groups.flatMap((g) => g.lines.map(costLineAmount))),
    ...basilan.general.lines.map(costLineAmount),
    ...basilan.rates.flatMap((r) => r.lines.map(costLineAmount)),
  ]);

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
        {/* KÜNYE TEK ŞERİTTİR: üç kısa değer için üç satır harcamak, kararın
            verildiği yaprakta en pahalı boşluktu. */}
        <Text style={S.kunyeSerit}>
          {[
            offer.customerName || "—",
            `Para birimi ${cur}`,
            `Kurulduğu teklif revizyonu ${payload.sourceRevNo === null ? "—" : `R${payload.sourceRevNo}`}`,
          ].join("  ·  ")}
        </Text>
        {/* MALİYET GERİDE KALABİLİR (MALIYET-2) ve bu meşrudur — ama sessiz
            kalması kâr marjını yanlış gösterir. */}
        {payload.sourceRevNo !== null &&
        offer.offerRevNo !== null &&
        payload.sourceRevNo !== offer.offerRevNo ? (
          <Text style={S.uyari}>
            DİKKAT: teklif R{offer.offerRevNo}&apos;e geçmiş — maliyet tazelenmemiş olabilir.
          </Text>
        ) : null}

        {/* İKİ KUTU YAN YANA: solda maliyetin kurulduğu başlıklar, sağda
            kararın kendisi. Alt alta dizildiklerinde ilk yaprağın 170 pt'sini
            yiyorlar ve özet listesini ikinci yaprağa itiyorlardı. */}
        <View style={S.kutuSirasi}>
          <View style={S.kutu}>
            <Text style={[T.kicker, { marginBottom: 3 }]}>MALİYETİN ANA BAŞLIKLARI</Text>
            {/* İMALAT VE PROJE AYRI SATIRDIR AMA TOPLAMA İKİ KEZ GİRMEZ:
                imalat `direct`in İÇİNDEDİR (`totals.ts`) ve altındaki DOĞRUDAN
                MALİYET satırı ikisinin toplamıdır. Belge bugüne kadar
                `totals.direct`i "PROJE MALİYETİ" diye basıyordu — modeldeki
                `project` ise `direct` eksi imalattır, yani belgedeki etiket
                Excel'in ve ekranın aynı adlı satırından BAŞKA bir sayıyı
                gösteriyordu. */}
            <OzetSatir etiket="İMALAT MALİYETİ" tutar={totals.fabrication} currency={cur} />
            <OzetSatir etiket="PROJE MALİYETİ" tutar={totals.project} currency={cur} />
            <OzetSatir
              etiket="DOĞRUDAN MALİYET (ORAN TABANI)"
              tutar={totals.direct}
              currency={cur}
              cizgi
            />
            {totals.rates.map((r) => (
              <OzetSatir
                key={r.key}
                etiket={`${r.title}${r.mode === "oran" && r.percent !== null ? ` (%${fmtNum(r.percent)})` : " (kalem)"}`}
                tutar={r.amount}
                currency={cur}
              />
            ))}
            {/* ORAN TABANI NOTU KALDIRILDI (kullanıcı isteği 23.08.2026, md. 5).
                KURAL DEĞİŞMEDİ (MALIYET-5: taban DOĞRUDAN MALİYETTİR) ve
                belgede zaten YAZILIDIR: ara toplam satırının etiketi "DOĞRUDAN
                MALİYET (ORAN TABANI)"dır ve her oran satırı kendi yüzdesini
                taşır. Not, aynı cümleyi ikinci kez söylüyordu. */}
            <OzetSatir etiket="TOPLAM MALİYET" tutar={totals.total} currency={cur} cizgi />
          </View>

          <View style={S.kutu}>
            <Text style={[T.kicker, { marginBottom: 3 }]}>TEKLİF VE KÂR</Text>
            {/* BELGE TOPLAMI İLE TOPLAM MALİYET AYRI SATIRLARDIR ve ayrı olmak
                ZORUNDADIR: ikincisi, teklifin SERBEST fiyat satırlarına elle
                yazılmış maliyetleri de ekler (MALIYET-11). Aynı adı taşısalardı
                belge kendi kendisiyle çelişir, okuyan hangisinin kâr hesabına
                girdiğini ancak toplayarak anlardı. */}
            <OzetSatir etiket="Maliyet belgesinin toplamı" tutar={ozet.documentTotal} currency={cur} />
            <OzetSatir etiket="Fiyat satırlarının elle maliyeti" tutar={ozet.manualTotal} currency={cur} />
            <OzetSatir etiket="TOPLAM MALİYET" tutar={kar.cost} currency={cur} cizgi />
            {/* TEKLİF TUTARI İSKONTOLUDUR (`effectiveTotal`, `costOverview`):
                pazarlıkta konuşulan rakam neyse kâr da onun üstünden okunur. */}
            <OzetSatir etiket="TEKLİF TUTARI" tutar={kar.price} currency={cur} />
            <OzetSatir etiket="KÂR" tutar={kar.profit} currency={cur} cizgi />
            {/* İKİ ORAN BİRDEN (MALIYET-11): "%25 kâr" cümlesi satışın %25'ini
                de maliyetin %25'ini de anlatabilir ve ikisi farklı sayılardır. */}
            <Text style={[S.not, { marginTop: 3 }]}>
              {kar.marginPercent === null
                ? "Kâr oranı hesaplanamadı — teklif tutarı ya da maliyet eksik."
                : `Satış üzerinden %${fmtCostField(kar.marginPercent, 0)} · maliyet üzerinden %${fmtCostField(kar.markupPercent, 0)}`}
            </Text>
          </View>
        </View>

        {/* ÖZET TEK LİSTEDİR (MALIYET-38): vinçler ve teklifin serbest fiyat
            satırları aynı tablonun satırlarıdır; ayrımı bir işaret söyler, ayrı
            bir bölüm değil. Ekranın kendi listesiyle aynı `costOverview`
            alanlarını okur. */}
        <Baslik>MALİYET ÖZETİ</Baslik>
        <OzetListesi ozet={ozet} currency={cur} />

        {/* DAĞITILAMAYAN YÜK VE MALİYETİ AÇILMAMIŞ KALEM SESSİZ GEÇİLMEZ. */}
        {Math.abs(ozet.unallocated) > 0 ? (
          <Text style={S.uyari}>
            Proje geneli ve oranlı giderlerin {fmtMoney0(ozet.unallocated, cur)} kadarı hiçbir kaleme
            dağıtılamadı — dağıtım paket maliyete göredir, fiyatı girilmemiş kalemin payı sıfırdır.
          </Text>
        ) : null}
        {ozet.uncostedItems.length > 0 ? (
          <Text style={S.uyari}>
            Teklifte olup maliyeti açılmamış {ozet.uncostedItems.length} kalem var:{" "}
            {ozet.uncostedItems.map((u) => u.title || "—").join(", ")}. Tutarları teklife giriyor,
            maliyete girmiyor — kâr olduğundan yüksek görünür.
          </Text>
        ) : null}

        {/* KIRILIM İKİ IZGARADA: altı satırlık bir liste için sayfanın tam
            genişliğini kullanmak, özet yaprağının kalan yerini harcıyordu. */}
        <Baslik>ANA KALEM KIRILIMI</Baslik>
        <Kirilim satirlar={kirilim} currency={cur} />

        {payload.notes.trim() ? (
          <>
            <Baslik>NOTLAR</Baslik>
            <Text style={[T.body, { fontSize: 7.4 }]}>{payload.notes}</Text>
          </>
        ) : null}
      </BrandPage>

      {/*
        ————————————————————— 2. AYRINTI: ağırlık · hesap · maliyet · arşiv

        TEK <Page>, KALEM BAŞINA `break` — iki yaprak kazandıran şey buydu.
        Her kalem KENDİ <Page>'inde başlarken son kalemin maliyet listesi
        yaprağın sekizinci satırında bitiyor ve 671 pt boş kalıyordu; ardından
        gelen arşiv bloğu (proje geneli, oranlar, hammadde, katsayılar) o
        boşluğu KULLANAMIYORDU, çünkü ayrı bir <Page>'di. Artık ayrıntı bölümü
        TEK AKIŞTIR: her kalem `break` ile yeni yaprakta başlar (iki vincin
        ağırlık listesi asla iç içe geçmez), arşiv bloğu ise nerede yer varsa
        orada devam eder.

        `Damga` `fixed`tir ve akışın HER yaprağında tekrar eder (MALIYET-12);
        sayfa başına bir kez yazılsaydı taşan yapraklarda düşerdi.
      */}
      <BrandPage docLine={docLine} docCode={`M${costRevNo}`}>
        <Damga />
        {basilan.items.map((item, sira) => {
        const model = models[item.id];
        const v = (k: string) => model?.values[k] ?? null;
        const doluBolum = (fields: readonly { key: string }[]) =>
          fields.some((f) => v(f.key) !== null);
        // Basılacak bölümler ÖNCE süzülür: bölüm başlığı ilk bölümün kutusuna
        // girecek (aşağıdaki gerekçe) ve bunun için "ilk"in kim olduğu render
        // sırasında bilinmelidir.
        const agirlikBolumleri = WEIGHT_SECTIONS.filter((s) => doluBolum(s.fields));
        // AĞIRLIK ISISININ TABANI — KALEMİN EN AĞIR SATIRI (md. 3–4). Ekranın
        // `AgirlikSayfasi`ndaki ölçeğin belgedeki ikizi: toplam satırları da
        // tabana girer, yoksa aynı sayı özet kutusunda ve kırılımda iki farklı
        // renk alırdı.
        const isiTabani = costLargestAmount(
          WEIGHT_SECTIONS.flatMap((sec) =>
            sec.fields.filter((f) => f.unit === "kg").map((f) => v(f.key))
          )
        );
        return (
          // İLK KALEM YAPRAK BAŞLATMAZ: bu <Page> zaten özetin ardındaki yeni
          // yaprakta açılır. Sonrakiler `break` ile kendi yapraklarını alır.
          <View key={item.id} break={sira > 0}>
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

            {/* AĞIRLIK BÖLÜMLERİ BÜTÜN KALIR (`wrap={false}`) — maliyet
                grubunun tersine, ve bilerek. Bu bölümlerin alan sayısı KODDA
                sabittir; en kalabalığı 13 satır ≈ 240 pt, yani hiçbiri sayfa
                boyunu (745,7 pt) aşamaz ve altbilgiye taşma riski yoktur.
                Maliyet grubunun satırları ise kullanıcının açtığı serbest
                satırlarla sınırsız büyür — orada bütünlük tehlikeliydi. */}
            {/* BÖLÜM BAŞLIĞI İLK BÖLÜMÜN KUTUSUNDADIR, kardeşi değil:
                başlık bölümüyle birlikte taşınır ve sayfa dibinde tek başına
                kalmaz. `minPresenceAhead` bunu çözmez — sığmayan şey 13
                satırlık (≈240 pt) BÖLÜNMEZ bölümün kendisidir.

                HESAPLAR BÖLÜMÜ VE KESİT ÖLÇÜLERİ BU BELGEDE YOKTUR (kullanıcı
                isteği 23.08.2026, md. 8: *"Hesaplar ve MODEL KATSAYILARI kısmı
                maliyet hem pdf hem excelde olmasın."*). Halat, tambur, motor,
                teker ve kiriş kesidi bir MALİYET sorusunun cevabı değildir;
                onların yeri hesap raporudur (`/projects`). Belge maliyetin
                kendisine daraldı: ağırlık → maliyet kalemleri. */}
            {agirlikBolumleri.length === 0 ? <Baslik>AĞIRLIKLAR</Baslik> : null}
            {agirlikBolumleri.map((s, i) => (
              <View key={s.key} wrap={false}>
                {i === 0 ? <Baslik>AĞIRLIKLAR</Baslik> : null}
                <AltBaslik>{s.title}</AltBaslik>
                {/* "ELLE GİRİLDİ" İŞARETİ KALKTI (kullanıcı isteği md. 7):
                    belgede 36 satıra kadar çıkabilen bir ipucu satırıydı ve
                    okuyanın sorusuna ("bu vinç kaç kilo") cevap vermiyordu.
                    Bilgi ekranda durur — orada asa düğmesi zaten görünür. */}
                <IkiSutunlu satirlar={alanSatirlari(s.fields, v, isiTabani)} />
              </View>
            ))}

            <Baslik>MALİYET KALEMLERİ</Baslik>
            {item.groups.map((g) => (
              <MaliyetGrubu
                key={g.id}
                group={g}
                currency={cur}
                enBuyukTutar={enBuyukTutar}
                refOf={refFor(item.offerItemId)}
              />
            ))}
          </View>
        );
      })}

        {/* ARŞİV BLOĞU — kalemlerin ardından AKAR, yeni yaprak açmaz.
            Proje geneli, oranlı gruplar, hammadde fiyatları ve model
            katsayıları: hiçbiri karar girdisi değildir, hepsi "altı ay sonra
            sorulacak soru"nun cevabıdır (MALIYET-6/22). */}
        <Baslik>PROJE GENELİ VE ORANLI GRUPLAR</Baslik>
        {basilan.general.lines.length ? (
          <MaliyetGrubu
            group={basilan.general}
            currency={cur}
            enBuyukTutar={enBuyukTutar}
            refOf={() => null}
          />
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
                  //
                  // TABANIN ADI DOĞRUDAN MALİYETTİR. Etiket "Proje maliyeti ×
                  // %15" diyordu ama çarpan `totals.direct`ti (imalat dahil) —
                  // okuyan çarpımı proje maliyetiyle tutturmaya çalışsa ASTOR
                  // ölçeğinde 10.519 € sapardı.
                  etiket={`Doğrudan maliyet × %${fmtNum(r.percent)}`}
                  deger={fmtMoney0(tutar, cur)}
                  kalin
                />
              ) : (
                <>
                  {r.lines.map((l) => (
                    <Deger
                      key={l.id}
                      etiket={l.label || "—"}
                      deger={fmtMoney0(costLineAmount(l), cur)}
                      renk={costHeatHex(costLineAmount(l), enBuyukTutar) ?? undefined}
                    />
                  ))}
                  <Deger etiket="TOPLAM" deger={fmtMoney0(tutar, cur)} kalin />
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
        <IkiSutunlu
          satirlar={MATERIAL_PRICE_DEFS.map((d) => ({
            key: d.key,
            etiket: `${d.label} [${cur}/${d.unit}]`,
            deger: fmtCostField(payload.materialPrices?.[d.key] ?? null, 2),
          }))}
        />

        {/* MODEL KATSAYILARI BU BELGEDE YOKTUR (kullanıcı isteği 23.08.2026,
            md. 8). Kırk katsayı iki sütunda bile bir yaprağın yarısını
            tutuyordu ve okunma sıklığı belgedeki en düşük olandı. MALIYET-6
            değişmedi — katsayılar hâlâ BELGEYE aittir ve `payload.params`ta
            saklanır; yalnız BASILMAZLAR. Kayıt, kaynağın kendisidir: bir
            revizyonun katsayıları ekranda Katsayılar bölümünden okunur. */}
      </BrandPage>
    </Document>
  );
}

export async function renderOfferCostPdf(props: OfferCostDocumentProps): Promise<Buffer> {
  return renderToBuffer(<OfferCostDocument {...props} />);
}
