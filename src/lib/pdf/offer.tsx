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
  T,
  trUpper,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { fmtMoney, fmtNum } from "@/lib/currency";
import { printedPayload } from "@/lib/offers/payload";
import { lineAmount, offerTotal, vatNote } from "@/lib/offers/pricing";
import { offerDocLine, offerRevLabel } from "@/lib/offers/no";
import type {
  OfferGroup,
  OfferItem,
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

  // ---- teknik / ticari satır
  bolumBaslik: { ...T.subhead, fontSize: 11, color: BRAND.ink, marginBottom: 10 },
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
  // Ödeme planı satırları GİRİNTİLİ ve MADDE İŞARETSİZDİR: belgede "Ödeme :"
  // satırının devamıdırlar, ayrı bir liste değil.
  odemeSatiri: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: BRAND.ink,
    marginLeft: ETIKET_GENISLIK + 9,
    paddingVertical: 1.2,
  },

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
 */
function EtiketliSatir({
  label,
  value,
  labelWidth = ETIKET_GENISLIK,
}: {
  label: string;
  value: string;
  labelWidth?: number;
}) {
  return (
    <View style={S.satir} wrap={false}>
      <Text style={[S.etiket, { width: labelWidth }]}>{label}</Text>
      <Text style={S.ikiNokta}>:</Text>
      <Text style={S.deger}>{value}</Text>
    </View>
  );
}

/** Blok başlığı: `TEST YÜKÜ (TS 10116) :` — başlık + " :". */
function BlokBaslik({ text, ilk = false }: { text: string; ilk?: boolean }) {
  return <Text style={[S.grupBaslik, { marginTop: ilk ? 0 : 12 }]}>{trUpper(text)} :</Text>;
}

function GrupBloku({ group }: { group: OfferGroup }) {
  return (
    <View>
      {/* Başlık sayfa dibinde YALNIZ kalmasın: altında en az birkaç satır
          yer yoksa grup bir sonraki sayfaya taşınır. */}
      <View minPresenceAhead={46}>
        <BlokBaslik text={group.title} />
      </View>
      {group.rows.map((row: OfferRow, i) => (
        <EtiketliSatir key={row.key || i} label={row.label} value={row.value} />
      ))}
    </View>
  );
}

/**
 * Kalem başlığı: `20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ ÖZELLİKLERİ`.
 *
 * Ek KODDA yapılır, veride değil: `OfferItem.title` fiyat tablosunda ve
 * listede de kullanılır ve orada "ÖZELLİKLERİ" kuyruğu yanlış olurdu.
 * Kullanıcı kuyruğu başlığa kendi yazdıysa ikilenmez.
 */
function kalemBasligi(title: string): string {
  const buyuk = trUpper(title.trim());
  return buyuk.endsWith("ÖZELLİKLERİ") ? buyuk : `${buyuk} ÖZELLİKLERİ`;
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

  return (
    <BrandPage docLine={altbilgi(offer)} company={company}>
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
        <EtiketliSatir key={row.key || i} label={row.label} value={row.value} />
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
          <EtiketliSatir label={row.label} value={row.value} />
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

function FiyatTablosu({ payload, currency }: { payload: OfferPayload; currency: string }) {
  const lines = payload.pricing.lines;
  if (lines.length === 0) return null;
  const toplam = offerTotal(lines);
  const toplamDisiVar = lines.some((l) => !l.inTotal);

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

      <View style={S.toplamSatiri} wrap={false}>
        <Text
          style={[
            S.toplamYazi,
            {
              width: `${FIYAT_SUTUNLARI[0].pay + FIYAT_SUTUNLARI[1].pay + FIYAT_SUTUNLARI[2].pay + FIYAT_SUTUNLARI[3].pay}%`,
              textAlign: "right",
            },
          ]}
        >
          TOPLAM
        </Text>
        <Text
          style={[
            S.toplamYazi,
            { fontFamily: FONTS.mono, fontWeight: 600, width: `${FIYAT_SUTUNLARI[4].pay}%`, textAlign: "right" },
          ]}
        >
          {toplam === null ? "—" : fmtMoney(toplam, currency)}
        </Text>
      </View>

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
      {items.map((item, i) => (
        <BrandPage key={item.id} docLine={docLine}>
          <Text style={S.bolumBaslik}>{kalemBasligi(item.title)}</Text>
          {item.groups.map((group) => (
            <GrupBloku key={group.id} group={group} />
          ))}
          {/* TEST YÜKÜ "teknik" konumunda SON teknik sayfanın ardındadır.
              Ayrı bir yaprağa alınmadı: iki satırlık bir bloğun tek başına
              bir A4 tüketmesi belgeyi kalınlaştırır, okunur kılmaz. */}
          {testYukuTeknikte && i === items.length - 1 ? <TestYuku payload={payload} /> : null}
        </BrandPage>
      ))}

      {/* TİCARİ SAYFA — şartlar, fiyat, notlar, kapsam dışı işler. */}
      <BrandPage docLine={docLine}>
        {/* Kalem hiç yoksa "teknik" konumdaki test yükü de burada basılır;
            aksi hâlde etkin bir blok belgeden sessizce düşerdi. */}
        {testYukuTicaride ? <TestYuku payload={payload} ilk /> : null}
        <TicariBlok payload={payload} ilk={!testYukuTicaride} />
        <FiyatTablosu payload={payload} currency={offer.currency} />
        <MetinBlogu baslik="Notlar" satirlar={payload.notes} />
        <MetinBlogu baslik="Kapsam Dışı İşler" satirlar={payload.exclusions} madde />
      </BrandPage>
    </Document>
  );
}

export async function renderOfferPdf(props: OfferDocumentProps): Promise<Buffer> {
  // TEK GEÇİŞ yeter: belgede içindekiler yoktur, sayfa numarası toplanacak
  // bir hedef listesi de. (Hesap raporu iki geçiş yapar; teklif yapmaz.)
  return renderToBuffer(<OfferDocument {...props} />);
}
