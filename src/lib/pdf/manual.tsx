// İŞLETME VE BAKIM EL KİTABI — PDF gövdesi.
//
// GÖVDE VE EKLER AYRIDIR (kullanıcı kararı, 19.08.2026). Bu dosya yalnız
// GÖVDEYİ üretir: kapak, künye, içindekiler ve bölümler. Müşterinin istediği
// yedi ek (mekanik/elektrik projeleri, katalog sayfaları, şartname) birer
// AYRAÇ KAPAĞI olarak basılır; belgelerin kendisi indirme ucunda `pdf-lib`
// ile o kapakların ardına eklenir. Gerekçe: ekleriyle birlikte yüz megabaytı
// bulan bir belge her önizlemede yeniden üretilemez.
//
// SÜZGEÇ TEK: `printedManual` (bkz. `lib/manual/payload.ts`). Bu dosya
// gizleme kararı VERMEZ, yalnız süzülmüş ağacı basar — ikinci bir süzgeç,
// ekrandan düşen bir bölümün belgeye girmeye devam etmesi demekti.
//
// OTOMATİK TABLOLAR ÇAĞIRANDAN ÇÖZÜLMÜŞ GELİR (`autoTableFor`): PDF katmanı
// hesap motorunu ya da Supabase'i tanımaz.

import React from "react";
import { Document, Image, Link, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  CheckGlyph,
  FONTS,
  RuleRed,
  T,
  mm,
  trUpper,
  type BrandBandLogo,
  type CompanyInfo,
} from "./brand";
import {
  flattenManual,
  numberManual,
  printedManual,
} from "@/lib/manual/payload";
import { autoTableFor, type ManualSourceData } from "@/lib/manual/sources";
import {
  SUTUN_BOSLUK,
  SUTUN_GENISLIK,
  TAM_GENISLIK,
  MANUAL_DIZIN_SAYFA_KAPASITESI,
  MANUAL_UST_BANT_ALT_BOSLUK,
  MANUAL_UST_BANT_YUKSEKLIK,
  bolumSayfalari,
  manualAtomlari,
  manualPdfSayfalari,
  tabloPaylari,
  type ManualAtom,
} from "@/lib/manual/pdf-layout";
import { manualAssetRatios } from "@/lib/manual/assets";
import {
  ManualNotIsareti,
  ManualSinyalCizelgesi,
  NOT_PIKTOGRAM_OLUK,
} from "./manual-marks";
import {
  MANUAL_APPENDIX_LABELS,
  MANUAL_NOTE_LABELS,
  type ManualAppendixKind,
  type ManualBlock,
  type ManualNoteLevel,
  type ManualPayload,
  type ManualTable,
} from "@/lib/manual/types";

void CheckGlyph;

/** Görselin baytları ve ölçüsü — çağıran depodan indirir. */
export interface ManualImageAsset {
  id: string;
  bytes: Buffer;
  width: number;
  height: number;
}

export interface ManualPdfProps {
  payload: ManualPayload;
  sources: ManualSourceData;
  images: readonly ManualImageAsset[];
  /** `ORC-BK-0019-00-R01` */
  docCode: string;
  /** Altbilgi sol satırı. */
  docLine: string;
  company?: CompanyInfo;
  /** Kapak künyesindeki sağ sütun satırları (revizyon · tarih). */
  bandLines?: string[];
  /** Tam sürümde her ek kapağından sonra eklenecek gerçek yaprak sayısı. */
  appendixPageCounts?: Partial<Record<ManualAppendixKind, number>>;
  /** Tam sürümde bulunup doğrulanmış ekler; gövde çıktısında boş listedir. */
  includedAppendices?: readonly ManualAppendixKind[];
  /** Nihai folio ekler birleştirildikten sonra pdf-lib tarafından basılacak. */
  deferFolio?: boolean;
}

/**
 * Uyarı kutusunun rengi — DÜZEY ARTTIKÇA KOYULAŞIR ve bu bir sıralamadır,
 * bir palet değil: okuyan kutunun rengine bakarak ciddiyeti anlamalı.
 * NOT gri, ÖNEMLİ ve DİKKAT çelik mavisi (biri açık biri koyu), UYARI marka
 * kırmızısı, TEHLİKE derin kırmızı + dolu zemin.
 */
const NOT_RENGI: Record<ManualNoteLevel, { kenar: string; zemin: string; metin: string }> = {
  not: { kenar: BRAND.line350, zemin: BRAND.paper100, metin: BRAND.gray700 },
  onemli: { kenar: BRAND.steel, zemin: BRAND.paper50, metin: BRAND.slate },
  dikkat: { kenar: BRAND.steel, zemin: BRAND.paper100, metin: BRAND.inkDeep },
  uyari: { kenar: BRAND.red, zemin: BRAND.paper50, metin: BRAND.inkDeep },
  tehlike: { kenar: BRAND.redDeep, zemin: BRAND.redPale, metin: BRAND.redDeep },
};

const s = StyleSheet.create({
  kapakBaslik: { fontSize: 24, fontWeight: 800, letterSpacing: 0.4, marginTop: mm(32) },
  kapakAlt: { fontSize: 14, fontWeight: 500, color: BRAND.gray700, marginTop: 6 },
  kapakDoc: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginTop: mm(10) },
  kunyeSatir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline, paddingVertical: 3 },
  kunyeEtiket: { width: "27%", fontSize: 8, color: BRAND.gray600 },
  kunyeDeger: { flex: 1, fontSize: 9 },

  h1: { fontSize: 14, fontWeight: 800, marginTop: 14, marginBottom: 5 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 9.5, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  h4: { fontSize: 9, fontWeight: 600, marginTop: 6, marginBottom: 2, color: BRAND.gray700 },
  numara: { fontFamily: FONTS.mono, color: BRAND.red },

  /* METİN SOLA YASLIDIR, İKİ YANA DEĞİL — ve bu bir zevk değil bir ÖLÇÜMDÜR.
     Sütun 234 pt geniştir ve `Font.registerHyphenationCallback` heceyi KAPALI
     tutar (`brand.tsx`); iki yana yaslama tireleme olmadan boşluğu kelimeler
     arasına dağıtır. Ölçüldü (ORC-BK-0019-00-R01): satırların %5'i karakter
     başına 7,97 pt yer kaplıyordu, medyan 5,39 — yani en kötü satırlar %48
     GERİLMİŞTİ ve sütunda gözle görülür "boşluk nehirleri" açılıyordu.
     Kullanıcının "yüksek kalite" örneği verdiği teklif ve hesap raporu
     PDF'lerinin hiçbiri iki yana yaslamaz; el kitabı tek istisnaydı. */
  p: { fontSize: 8.5, lineHeight: 1.5, marginBottom: 4 },
  kenarNot: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: BRAND.red,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  madde: { flexDirection: "row", marginBottom: 2 },
  maddeIsaret: { width: 12, fontSize: 8.5, color: BRAND.red },
  maddeMetin: { flex: 1, fontSize: 8.5, lineHeight: 1.45 },
  sonuc: { flexDirection: "row", marginTop: 2, marginBottom: 4 },

  /* KÖŞE YUVARLAMASI YOK — marka kılavuzunun ilk pazarlıksız maddesi
     ("Zero border radius. Cards, buttons, inputs, badges — all square").
     2 pt'lik yuvarlama kutuyu ekran arayüzü gibi gösteriyordu; belgenin
     geri kalanında (tablo, bant, künye) tek bir yuvarlak köşe yok. */
  kutu: { borderLeftWidth: 3, padding: 6, marginVertical: 5 },
  kutuBaslik: { fontSize: 8, fontWeight: 800, letterSpacing: 0.8, marginBottom: 2 },

  tabloBaslik: { flexDirection: "row", backgroundColor: BRAND.paper150, borderBottomWidth: 0.75, borderBottomColor: BRAND.line350 },
  tabloSatir: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: BRAND.hairline },
  hucre: { padding: 3, fontSize: 7.5, lineHeight: 1.35 },
  hucreBaslik: { padding: 3, fontSize: 7.5, fontWeight: 700 },
  /* ALTYAZI İTALİK DEĞİLDİR ve bu bir tercih değil bir ZORUNLULUKTUR:
     markanın Archivo ailesinde italik kesim YOKTUR (`brand.tsx` yalnız
     Regular/Medium/Bold/ExtraBold/Black kaydeder) ve @react-pdf eksik kesimi
     yedeklemez, BELGEYİ DÜŞÜRÜR ("Could not resolve font ... fontStyle
     italic"). Ayrım punto ve renkle kurulur. */
  altyazi: { fontSize: 7, color: BRAND.gray600, marginTop: 2 },

  icindekilerSatir: {
    flexDirection: "row",
    minHeight: 15,
    paddingVertical: 2.5,
    borderBottomWidth: 0.35,
    borderBottomColor: BRAND.hairline,
    alignItems: "flex-start",
    textDecoration: "none",
    color: BRAND.ink,
  },
  dizinSayfa: { width: 24, fontSize: 7.5, textAlign: "right", fontFamily: FONTS.mono },
  ekKapakBaslik: { fontSize: 18, fontWeight: 800, marginTop: mm(30) },

  /* İKİ SÜTUN — genişlikler yerleşim çekirdeğinin ÖLÇTÜĞÜ sayılardır
     (`manual/pdf-layout.ts`). Burada yeniden hesaplansaydı ölçü ile çizim
     ayrışır ve @react-pdf taşan satırı sessizce kırpardı. */
  ikiSutun: { flexDirection: "row", gap: SUTUN_BOSLUK },
  sutun: { width: SUTUN_GENISLIK },
  ortaCizgi: {
    position: "absolute",
    left: SUTUN_GENISLIK + SUTUN_BOSLUK / 2,
    top: 0,
    bottom: 0,
    width: 0.45,
    backgroundColor: BRAND.line300,
    opacity: 0.7,
  },
});

export function ManualPdf({
  payload,
  sources,
  images,
  docCode,
  docLine,
  company,
  bandLines,
  appendixPageCounts = {},
  includedAppendices = [],
  deferFolio = false,
}: ManualPdfProps) {
  const basilan = printedManual(payload);
  const numarali = numberManual(basilan.sections);
  const dahilEkler = new Set(includedAppendices);
  const gorseller = new Map(images.map((g) => [g.id, g]));
  // Ölçü için ORAN, çizim için BAYT. İki harita aynı kayıttan doğar ama
  // yerleşim çekirdeği React'i tanımaz; ona yalnız sayı gider.
  // Yüklenen görselin oranı ÖLÇÜLDÜ, şablon varlığınınki DEFTERDE; ikisi tek
  // haritada buluşur ve yerleşim çekirdeği farkı bilmez.
  const oranlar = new Map<string, number>([
    ...manualAssetRatios(),
    ...images.filter((g) => g.width > 0).map((g) => [g.id, g.height / g.width] as const),
  ]);

  // Ek kapsayıcısı gövdeden AYRILIR: ek kapakları KENDİ YAPRAKLARINDA kalmak
  // zorundadır (`pdfEkleriYerlestir` sözleşmesi — temel belgenin SON n sayfası
  // eklerle aynı sıradaki n kapaktır). İki sütunlu akışa girselerdi kapaklar
  // birbirine karışır ve her ek yanlış kapağın altına düşerdi.
  const ekKapsayici = numarali.find((b) => b.children.some((c) => c.appendix)) ?? null;
  const govdeBolumleri = numarali.filter((b) => b !== ekKapsayici);
  const ekKapaklari = (ekKapsayici?.children ?? []).filter(
    (c) => c.appendix && dahilEkler.has(c.appendix)
  );

  // GÖVDE DİZİNİNDE EK VAADİ YOKTUR. Tam sürümde ise yalnız gerçekten
  // çözülen ekler ve kapsayıcıları görünür; bulunamayan bir belge için boş
  // dizin satırı ya da ayraç kapağı üretmek kullanıcıyı yanıltır.
  const duz = flattenManual(numarali).filter((bolum) => {
    if (bolum.id === ekKapsayici?.id) return ekKapaklari.length > 0;
    return !bolum.appendix || dahilEkler.has(bolum.appendix);
  });

  // GÖVDE İKİ SÜTUNDA AKAR (kullanıcı isteği, 19.08.2026). Dağıtım saf
  // çekirdektedir (`manual/pdf-layout.ts`); burası yalnız çizer.
  // ANA BÖLÜMLER TEK AKIŞTIR: her bölüm için dağıtıcıyı yeniden başlatmak,
  // önceki bölümün sağ sütununu boş bırakıp gereksiz yaprak üretiyordu.
  // Tablonun tam genişlik kararı ölçüm çekirdeğindedir; kısa bakım ve yedek
  // tablolarını bölüm adına bakarak koca bir banda zorlamak boş yaprak
  // üretiyordu. Yalnız atom akışları birleşir, belge sırası değişmez.
  const govdeAtomlari = govdeBolumleri.flatMap((bolum) =>
    manualAtomlari([bolum], sources, oranlar)
  );
  const dagitilmisSayfalar = manualPdfSayfalari(govdeAtomlari);
  const govdeSayfalari = dagitilmisSayfalar.map((sayfa, sayfaIndisi) => {
    const atomlar = sayfa.bantlar.flatMap((bant) =>
      bant.kind === "full" ? bant.atoms : [...bant.sol, ...bant.sag]
    );
    const oncekiBaslik = dagitilmisSayfalar
      .slice(0, sayfaIndisi)
      .flatMap((oncekiSayfa) =>
        oncekiSayfa.bantlar.flatMap((bant) =>
          bant.kind === "full" ? bant.atoms : [...bant.sol, ...bant.sag]
        )
      )
      .filter(
        (atom): atom is Extract<ManualAtom, { kind: "heading" }> => atom.kind === "heading"
      )
      .at(-1);
    const ilkBaslik = atomlar.find(
      (atom): atom is Extract<ManualAtom, { kind: "heading" }> => atom.kind === "heading"
    );
    const sayfaBasligi = atomlar[0]?.kind === "heading"
      ? atomlar[0]
      : oncekiBaslik ?? ilkBaslik;
    return {
      sayfa,
      sectionLabel: sayfaBasligi ? anaBolumEtiketi(sayfaBasligi.section.number) : "",
    };
  });
  const sayfalar = govdeSayfalari.map((s) => s.sayfa);

  // DİZİN SAYFA NUMARASI DAĞITIMIN SONUCUNDAN gelir. Gövde belgede 3.
  // yapraktan başlar (kapak + içindekiler), o yüzden ofset 2'dir; dizin
  // yoksa 1. Ekler gövdeden sonra gelir ve kendi numaralarını alır.
  const dizinSayfaSayisi = Math.ceil(duz.length / MANUAL_DIZIN_SAYFA_KAPASITESI);
  // Birden çok dizin yaprağı gerekirse son yaprağı sekiz satırla yalnız
  // bırakma; satırları yapraklara dengeli dağıt. Tek yaprakta gövde dizininin
  // 70 satırı iki kolona 35+35 iner.
  const dengeliDizinKapasitesi = dizinSayfaSayisi > 0
    ? Math.ceil(duz.length / dizinSayfaSayisi)
    : MANUAL_DIZIN_SAYFA_KAPASITESI;
  const dizinSayfalari = Array.from({ length: dizinSayfaSayisi }, (_, i) =>
    duz.slice(i * dengeliDizinKapasitesi, (i + 1) * dengeliDizinKapasitesi)
  );
  const govdeOfset = 1 + dizinSayfalari.length;
  const sayfaNo = bolumSayfalari(sayfalar, govdeOfset);
  const ekKapsayiciSayfa = govdeOfset + sayfalar.length + 1;
  const ekIlkSayfa = ekKapsayici && ekKapaklari.length > 0
    ? ekKapsayiciSayfa + 1
    : ekKapsayiciSayfa;

  const kunye = payload.identity;
  const kunyeSatirlari: [string, string][] = [
    ["Üretici", kunye.manufacturer],
    ["Ürün", kunye.product],
    ["Vinç Tipi", kunye.craneType],
    ["Seri Numara", kunye.serialNo],
    ["Üretim Yılı", kunye.productionYear],
    ["Müşteri", kunye.customer],
    ["Saha / Konum", kunye.site],
    ["Doküman No", kunye.customerDocNo],
    ["Versiyon / Revizyon", kunye.customerRevision],
    ["Hazırlama Tarihi", kunye.preparedOn],
    ["Son Revizyon Tarihi", kunye.revisedOn],
    // BOŞ ALAN SATIR AÇMAZ: "Seri Numara : —" bilgi değil kusurdur
    // (teklifteki "değersiz satır basılmaz" kuralının aynısı).
  ].filter((r): r is [string, string] => Boolean(r[1]?.trim()));

  const ortaLogo = bandLogo(gorseller.get(payload.partnerLogos.centerImageId ?? ""));
  const sagLogo = bandLogo(gorseller.get(payload.partnerLogos.rightImageId ?? ""));
  const kapakGorseli = gorseller.get(payload.coverImageId ?? "") ?? null;

  const ustBant = () => (
    <BrandBand
      docCode={docCode}
      lines={bandLines ?? []}
      centerLogo={ortaLogo}
      rightLogo={sagLogo}
      manualHeight={MANUAL_UST_BANT_YUKSEKLIK}
      marginBottom={MANUAL_UST_BANT_ALT_BOSLUK}
    />
  );

  return (
    <Document
      title={`${payload.docTitle} — ${payload.coverTitle}`}
      author="ORION Cranes"
      subject={payload.coverTitle}
    >
      {/* KAPAK TEK SÜTUNDUR ve bu bir istisna değil bir tanımdır: kapak
          okunacak bir metin değil, belgenin kimliğidir. Künye bloğu ise iki
          sütuna geçer — on bir kısa satır tek sütunda sayfanın yarısını boş
          bırakıyordu. */}
      <BrandPage docLine={docLine} docCode={docCode} company={company} sectionLabel="K" hidePageNumber={deferFolio}>
        {ustBant()}
        <Text
          style={[
            s.kapakBaslik,
            kapakGorseli ? { marginTop: mm(12) } : {},
          ]}
        >
          {trUpper(payload.coverTitle || payload.identity.product)}
        </Text>
        <Text style={s.kapakAlt}>{trUpper(payload.docTitle)}</Text>
        {/* Kural çizgisi başlığa YAPIŞIYORDU (ölçüldü, kapak): `RuleRed`in
            kendi payı yok, çağıran verir. */}
        <View style={{ marginTop: 8 }}>
          <RuleRed width={64} />
        </View>
        <Text
          style={{
            marginTop: 7,
            fontFamily: FONTS.mono,
            fontSize: 7.5,
            letterSpacing: 0.8,
            color: BRAND.gray600,
          }}
        >
          OPERATÖR GÜVENLİĞİ · KULLANIM · BAKIM · MUAYENE
        </Text>
        <Text style={s.kapakDoc}>{docCode}</Text>

        {kapakGorseli ? <KapakGorseli image={kapakGorseli} /> : null}

        {kunyeSatirlari.length > 0 && (
          <View style={{ marginTop: kapakGorseli ? mm(8) : mm(16) }} wrap={false}>
            <Text style={T.kicker}>GENEL BİLGİLER</Text>
            <View>
              {kunyeSatirlari.map(([e, d]) => (
                <KunyeSatiri key={e} etiket={e} deger={d} />
              ))}
            </View>
          </View>
        )}

        {kunye.manufacturerAddress.trim() && (
          <View style={{ marginTop: mm(8) }}>
            <Text style={T.kicker}>ÜRETİCİ BİLGİLERİ</Text>
            <Text style={[s.p, { marginTop: 3 }]}>{kunye.manufacturerAddress}</Text>
          </View>
        )}

        {kunye.copyright.trim() && (
          <Text style={[s.p, { marginTop: mm(6), fontSize: 7, color: BRAND.gray600 }]}>
            {kunye.copyright}
          </Text>
        )}
      </BrandPage>

      {/* İÇİNDEKİLER DE İKİ SÜTUNDUR: elli kısa satır tek sütunda iki yaprak
          ederdi. Dizin ÖNCE SOL sütunu doldurup sonra sağa geçer — okuyan bir
          dizini yukarıdan aşağıya tarar, satır satır zikzak çizmez. */}
      {dizinSayfalari.map((dizinBolumu, dizinSayfaIndisi) => {
        const dizinYarim = Math.ceil(dizinBolumu.length / 2);
        return (
        <BrandPage key={dizinSayfaIndisi} docLine={docLine} docCode={docCode} sectionLabel="İÇ" hidePageNumber={deferFolio}>
          {ustBant()}
          <Text style={s.h1}>
            İÇİNDEKİLER{dizinSayfalari.length > 1 ? ` · ${dizinSayfaIndisi + 1}` : ""}
          </Text>
          <IkiSutun>
            {[dizinBolumu.slice(0, dizinYarim), dizinBolumu.slice(dizinYarim)].map((kol, ki) => (
              <View style={s.sutun} key={ki}>
                {kol.map((b) => {
                  // EK BÖLÜMLERİ GÖVDEDEN SONRA gelir ve sırayla numaralanır;
                  // her ek kapağı kendi yaprağındadır (KITAP-8 sözleşmesi).
                  const ekSira = ekKapaklari.findIndex((e) => e.id === b.id);
                  const oncekiEkSayfalari = ekKapaklari
                    .slice(0, Math.max(0, ekSira))
                    .reduce(
                      (toplam, ek) =>
                        toplam + (appendixPageCounts[ek.appendix as ManualAppendixKind] ?? 0),
                      0
                    );
                  const no = ekSira >= 0
                    ? ekIlkSayfa + ekSira + oncekiEkSayfalari
                    : b.id === ekKapsayici?.id
                      ? ekIlkSayfa - 1
                      : (sayfaNo.get(b.id) ?? null);
                  return (
                    <Link key={b.id} src={`#manual-${b.id}`} style={s.icindekilerSatir}>
                      {/* NUMARA KUTUSU EN DERİN GİRDİYE GÖRE ölçülür:
                          "4.8.3.1" 7,5 punto mono ile 31,5 pt tutar ve girinti
                          onu 36 pt'lik bir kutudan taşırıyordu — numara ile
                          başlık üst üste biniyordu (ölçüldü, içindekiler).
                          Girinti de ÜÇÜNCÜ düzeyde durur; daha derinde
                          numaranın kendisi zaten derinliği söylüyor. */}
                      <Text
                        style={[
                          s.numara,
                          {
                            width: 42,
                            fontSize: 7.5,
                            paddingLeft: (Math.min(b.depth, 3) - 1) * 5,
                          },
                        ]}
                      >
                        {b.number}
                      </Text>
                      {/* BAŞLIK ESNER, NUMARALAR SABİT: derin bir başlık
                          (4.8.3.1) uzun adıyla birlikte sütunu taşırıyordu.
                          `flex: 1` ile sarar, sayfa numarası sağda kalır. */}
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 7.5,
                          fontWeight: b.depth === 1 ? 700 : 400,
                        }}
                      >
                        {b.title}
                      </Text>
                      <View style={{ flex: 1, borderBottomWidth: 0.35, borderBottomColor: BRAND.line300, marginHorizontal: 4, marginTop: 7 }} />
                      <Text style={[s.dizinSayfa, { color: BRAND.gray600 }]}>{no ?? ""}</Text>
                    </Link>
                  );
                })}
              </View>
            ))}
          </IkiSutun>
        </BrandPage>
        );
      })}

      {/* GÖVDE — her sayfa çekirdeğin verdiği bantlardan çizilir. */}
      {govdeSayfalari.map(({ sayfa, sectionLabel }, si) => (
        <BrandPage key={si} docLine={docLine} docCode={docCode} sectionLabel={sectionLabel} hidePageNumber={deferFolio}>
          {ustBant()}
          {sayfa.bantlar.map((bant, bi) =>
            bant.kind === "full" ? (
              <View key={bi} wrap={false}>
                {bant.atoms.map((a, ai) => (
                  <Atom key={ai} atom={a} sources={sources} gorseller={gorseller} tam />
                ))}
              </View>
            ) : (
              <IkiSutun key={bi}>
                {[bant.sol, bant.sag].map((kol, ki) => (
                  <View style={s.sutun} key={ki}>
                    {kol.map((a, ai) => (
                      <Atom key={ai} atom={a} sources={sources} gorseller={gorseller} />
                    ))}
                  </View>
                ))}
              </IkiSutun>
            )
          )}
        </BrandPage>
      ))}

      {/* EKLER — yalnız TAM SÜRÜMDE ve yalnız gerçekten bulunan belgeler. */}
      {ekKapsayici && ekKapaklari.length > 0 && (
        <BrandPage docLine={docLine} docCode={docCode} sectionLabel="EK" hidePageNumber={deferFolio}>
          {ustBant()}
          <Text id={`manual-${ekKapsayici.id}`} style={s.h1}>{ekKapsayici.title}</Text>
          {ekKapsayici.blocks.map((b) => (
            <Blok
              key={b.id}
              blok={b}
              sources={sources}
              gorseller={gorseller}
              genislik={TAM_GENISLIK}
            />
          ))}
        </BrandPage>
      )}
      {ekKapaklari.map((ek) => (
        <BrandPage key={ek.id} docLine={docLine} docCode={docCode} sectionLabel={ek.number} hidePageNumber={deferFolio}>
          {ustBant()}
          <View id={`manual-${ek.id}`} style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={[s.h1, s.numara, { marginRight: 6 }]}>{ek.number}</Text>
            <Text style={s.h1}>{ek.title}</Text>
          </View>
          <Text style={s.ekKapakBaslik}>
            {trUpper(MANUAL_APPENDIX_LABELS[ek.appendix as ManualAppendixKind])}
          </Text>
          <RuleRed width={48} />
          <Text style={[s.p, { marginTop: 8, color: BRAND.gray600 }]}>
            Bu ek, belgenin tam sürümünde bu sayfadan sonra basılır.
          </Text>
        </BrandPage>
      ))}
    </Document>
  );
}

/** `4.8.3` gibi bir başlıktan üst bantta gösterilecek ana bölüm etiketi. */
function anaBolumEtiketi(number: string): string {
  return number.split(".")[0] ?? "";
}

/** Yüklenen görseli üçlü marka bandının ölçülmüş logo kaynağına çevirir. */
function bandLogo(image?: ManualImageAsset): BrandBandLogo | undefined {
  if (!image || image.width <= 0 || image.height <= 0) return undefined;
  return { src: image.bytes, ratio: image.height / image.width };
}

/**
 * Kapak görselini oranını bozmadan güvenli bir alana sığdırır.
 *
 * Sabit genişlik VE sabit yükseklik birlikte verilmez; önce gerçek oran
 * ölçülür, sonra 150 mm × 63,5 mm kutusunun içine contain edilir. Böylece
 * hem yatay genel montaj resmi hem dikey saha fotoğrafı ezilmeden basılır.
 */
function KapakGorseli({ image }: { image: ManualImageAsset }) {
  const maxWidth = mm(150);
  const maxHeight = mm(63.5);
  const oran = image.height / image.width;
  const width = Math.min(maxWidth, maxHeight / Math.max(oran, 0.001));
  const height = width * oran;
  return (
    <View style={{ marginTop: 14, alignItems: "center" }} wrap={false}>
      <Image src={image.bytes} style={{ width, height, objectFit: "contain" }} />
    </View>
  );
}

/**
 * Belgede BASILAN ek kapaklarının sırası.
 *
 * İndirme ucu birleştirmeyi bu sırayla yapar; PDF'in kendisi ile sıra AYNI
 * fonksiyondan gelir. İki yerde yazılsaydı bir ek yanlış kapağın altına düşer
 * ve okuyan bunu ancak belgeyi açınca görürdü.
 */
export function manualAppendixOrder(payload: ManualPayload): ManualAppendixKind[] {
  const numarali = numberManual(printedManual(payload).sections);
  const kapsayici = numarali.find((b) => b.children.some((c) => c.appendix));
  return (kapsayici?.children ?? [])
    .map((c) => c.appendix)
    .filter((k): k is ManualAppendixKind => Boolean(k));
}

function KunyeSatiri({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={s.kunyeSatir}>
      <Text style={s.kunyeEtiket}>{etiket}</Text>
      <Text style={s.kunyeDeger}>{deger}</Text>
    </View>
  );
}

/** İki sütunlu her bölgede okuma yönünü belirginleştiren soluk orta kural. */
function IkiSutun({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.ikiSutun}>
      <View style={s.ortaCizgi} />
      {children}
    </View>
  );
}

/**
 * Yerleşim atomunun çizimi.
 *
 * ATOM BÖLÜNMEZ: yüksekliği çekirdekte ölçüldü ve ona göre bir sütuna
 * yerleştirildi; @react-pdf'in onu ayrıca kırmaya kalkması ölçü ile çizimi
 * ayrıştırırdı.
 */
function Atom({
  atom,
  sources,
  gorseller,
  tam,
}: {
  atom: ManualAtom;
  sources: ManualSourceData;
  gorseller: Map<string, ManualImageAsset>;
  tam?: boolean;
}) {
  if (atom.kind === "heading") {
    const b = atom.section;
    const stil = [s.h1, s.h2, s.h3, s.h4][Math.min(b.depth, 4) - 1];
    // HİZA `flex-start`TİR, `baseline` DEĞİL (ölçüldü, s. 4): başlık sarınca
    // `baseline` numarayı SON satıra indiriyor ve "2" ikinci satırın soluna
    // düşüyordu. Numara ilk satırda kalmalı; sarma yalnız başlığı ilgilendirir.
    // `flex: 1` de şart: numarasız bir başlık kutusu genişlemezse uzun bir ad
    // sarmak yerine taşardı.
    return (
      <View
        id={`manual-${b.id}`}
        style={{ flexDirection: "row", alignItems: "flex-start" }}
        wrap={false}
      >
        {b.number ? <Text style={[stil, s.numara, { marginRight: 5 }]}>{b.number}</Text> : null}
        <Text style={[stil, { flex: 1 }]}>{b.title}</Text>
      </View>
    );
  }

  if (atom.kind === "block") {
    return (
      <Blok
        blok={atom.block}
        sources={sources}
        gorseller={gorseller}
        genislik={tam ? TAM_GENISLIK : SUTUN_GENISLIK}
        dilim={atom}
      />
    );
  }

  return null;
}

function Blok({
  blok,
  sources,
  gorseller,
  genislik,
  dilim,
}: {
  blok: ManualBlock;
  sources: ManualSourceData;
  gorseller: Map<string, ManualImageAsset>;
  /** Bloğun içine çizileceği genişlik — sütun ya da tam bant. */
  genislik: number;
  /**
   * Yerleşimin verdiği DİLİM — liste ve tablo sütunlar arasında bölünebilir
   * (`manual/pdf-layout.ts`). Verilmezse blok bütün hâlde basılır (ek
   * kapsayıcısı gibi akış dışı yerler).
   */
  dilim?: ManualAtom;
}) {
  switch (blok.kind) {
    case "text":
      return (
        <View wrap={false}>
          {blok.margin?.trim() ? <Text style={s.kenarNot}>{blok.margin}</Text> : null}
          <Text style={s.p}>{blok.text}</Text>
        </View>
      );

    case "list": {
      // DİLİM VARSA ONUN MADDELERİ basılır; numaralı listede sıra `itemOffset`
      // ile devam eder — ikinci dilim "1." diye yeniden başlasaydı okuyan iki
      // ayrı liste görürdü.
      const maddeler = dilim?.kind === "block" && dilim.items ? dilim.items : blok.items.filter((i) => i.trim());
      const ofset = dilim?.kind === "block" ? (dilim.itemOffset ?? 0) : 0;
      const sonucBas = dilim?.kind === "block" ? dilim.sonuc !== false : true;
      return (
        <View style={{ marginBottom: 4 }}>
          {maddeler.map((i, k) => (
            <View key={k} style={s.madde}>
              <Text style={s.maddeIsaret}>{blok.ordered ? `${ofset + k + 1}.` : "•"}</Text>
              <Text style={s.maddeMetin}>{i}</Text>
            </View>
          ))}
          {sonucBas && blok.result?.trim() ? (
            <View style={s.sonuc}>
              <Text style={s.maddeIsaret}>→</Text>
              <Text style={[s.maddeMetin, { color: BRAND.gray700 }]}>{blok.result}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    case "note": {
      const renk = NOT_RENGI[blok.level];
      // PİKTOGRAM VEKTÖRDÜR, raster değil (`pdf/manual-marks.tsx`).
      // Önceki hâl `public/manual-assets/` altındaki RGB PNG'lerdi ve
      // ÜÇÜNÜN DE ZEMİNİ OPAKTI: kutunun kâğıt tonlu zemininde her simge
      // BEYAZ BİR KARE olarak basılıyordu (ölçüldü, s. 4, 430 dpi).
      // Vektörde zemin yoktur; "NOT" simgesinin bulanıklığı da (64×101 px)
      // kendiliğinden düşer.
      return (
        <View
          style={[s.kutu, { borderLeftColor: renk.kenar, backgroundColor: renk.zemin }]}
          wrap={false}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ marginRight: NOT_PIKTOGRAM_OLUK, marginTop: 0.5 }}>
              <ManualNotIsareti level={blok.level} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.kutuBaslik, { color: renk.kenar }]}>
                {blok.title?.trim() || MANUAL_NOTE_LABELS[blok.level]}
              </Text>
              <Text style={[s.p, { marginBottom: 0, color: renk.metin }]}>{blok.text}</Text>
            </View>
          </View>
        </View>
      );
    }

    case "table":
      return <Tablo table={blok.table} dilim={dilim} />;

    case "image": {
      const en = (genislik * (blok.widthPct ?? 100)) / 100;
      // Şablondaki eski ekran görüntüsü yalnız veri anahtarı olarak kalır.
      // Nihai belgede işaretler, sinyal kelimeleri ve anlamlar seçilebilir,
      // aranabilir VEKTÖR çizelge olarak çizilir; rasterın beyaz zeminli,
      // bulanık kopyası artık baskıya girmez.
      if (blok.assetKey === "sinyalKelimeleri") {
        return (
          <View wrap={false}>
            <ManualSinyalCizelgesi genislik={en} />
            {blok.caption?.trim() ? <Text style={s.altyazi}>{blok.caption}</Text> : null}
          </View>
        );
      }
      // ŞABLON VARLIĞI DA YÜKLENEN GÖRSEL DE AYNI HARİTADAN çözülür: çağıran
      // ikisini birleştirir (`manual/[revId]/pdf/route.ts`), çizim ikisini
      // ayırt etmez — bir görselin nereden geldiği okuyanı ilgilendirmez.
      const g = gorseller.get(blok.assetKey ?? blok.imageId ?? "");
      // KAYIT YOKSA BLOK HİÇ BASILMAZ. Boş bir çerçeve, okuyana orada bir
      // şeyin eksildiğini söyler ve gizleme kuralının ruhuna aykırıdır.
      if (!g) return null;
      const yukseklik = g.width > 0 ? (en * g.height) / g.width : undefined;
      return (
        <View style={{ marginVertical: 6 }} wrap={false}>
          <Image src={g.bytes} style={{ width: en, height: yukseklik }} />
          {blok.caption?.trim() ? <Text style={s.altyazi}>{blok.caption}</Text> : null}
        </View>
      );
    }

    case "auto": {
      const tablo = autoTableFor(blok, sources);
      if (tablo.rows.length === 0) {
        // BOŞ KAYNAK SESSİZ KALMAZ ama uydurma da yazmaz: mühendisin yazdığı
        // açıklama varsa o basılır, yoksa blok hiç görünmez.
        return blok.emptyText?.trim() ? (
          <Text style={[s.p, { color: BRAND.gray600 }]}>{blok.emptyText}</Text>
        ) : null;
      }
      return <Tablo table={tablo} dilim={dilim} />;
    }
  }
}

/**
 * Tablo — SÜTUN GENİŞLİKLERİ İÇERİKTEN ÇIKAR ve YÜZDEDİR.
 *
 * Yüzde olmaları sayesinde tablo hangi kaba konursa onun genişliğini alır:
 * yarım sütunda da tam genişlik bandında da aynı bileşen çizer. Ölçü tarafı
 * (`manual/pdf-layout.ts`) kabın genişliğini AYRICA bilir ve aynı payları
 * kullanır — iki taraf aynı aritmetiği tekrarlar, sayı kopyalamaz.
 *
 * Eşit paylı sütunlar 6 sütunlu bir malzeme listesinde "Adet" hücresine
 * 28 mm ayırıp "Tanım"ı üç satıra sarıyordu. Genişlik, sütunun EN UZUN
 * hücresinin karakter sayısıyla orantılıdır ve toplam 100'e normalize edilir;
 * tek bir çok uzun hücrenin tabloyu ezmemesi için pay KELEPÇELENİR.
 */
function Tablo({ table, dilim }: { table: ManualTable; dilim?: ManualAtom }) {
  // DİLİM VARSA ONUN SATIRLARI basılır. Başlık satırı HER dilimde tekrar
  // eder (fiyat tablosunun `fixed` başlığıyla aynı ilke), altyazı ise yalnız
  // SON dilimde — ortada duran bir altyazı tabloyu bitmiş gösterirdi.
  const satirlar = dilim?.kind === "block" && dilim.rows ? dilim.rows : table.rows;
  const altyaziBas = dilim?.kind === "block" ? dilim.altyazi !== false : true;
  // Sütun payları TAM TABLODAN hesaplanır, dilimden değil: iki dilimin
  // sütunları farklı genişlikte çıkarsa okuyan iki ayrı tablo görürdü.
  const sutun = Math.max(table.head.length, ...table.rows.map((r) => r.length), 1);
  const genislik = dilim?.tam ? TAM_GENISLIK : SUTUN_GENISLIK;
  const mutlakPaylar = tabloPaylari(table, genislik);
  const toplam = mutlakPaylar.reduce((a, b) => a + b, 0);
  const pay = mutlakPaylar.map((u) => `${((u / toplam) * 100).toFixed(2)}%`);

  return (
    <View style={{ marginVertical: 5 }} wrap={false}>
      <View style={s.tabloBaslik} wrap={false}>
        {Array.from({ length: sutun }).map((_, j) => (
          <Text key={j} style={[s.hucreBaslik, { width: pay[j] }]}>
            {table.head[j] ?? ""}
          </Text>
        ))}
      </View>
      {satirlar.map((r, i) => (
        <View key={i} style={s.tabloSatir} wrap={false}>
          {Array.from({ length: sutun }).map((_, j) => (
            <Text key={j} style={[s.hucre, { width: pay[j] }]}>
              {r[j] ?? ""}
            </Text>
          ))}
        </View>
      ))}
      {altyaziBas && table.caption?.trim() ? (
        <Text style={s.altyazi}>{table.caption}</Text>
      ) : null}
    </View>
  );
}
