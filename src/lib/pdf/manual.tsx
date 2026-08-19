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
import { Document, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  CheckGlyph,
  FONTS,
  PAGE,
  RuleRed,
  T,
  mm,
  trUpper,
  type CompanyInfo,
} from "./brand";
import {
  flattenManual,
  numberManual,
  printedManual,
  type NumberedSection,
} from "@/lib/manual/payload";
import { autoTableFor, type ManualSourceData } from "@/lib/manual/sources";
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
}

/** Uyarı kutusunun rengi — düzey arttıkça koyulaşır. */
const NOT_RENGI: Record<ManualNoteLevel, { kenar: string; zemin: string; metin: string }> = {
  bilgi: { kenar: BRAND.line350, zemin: BRAND.paper100, metin: BRAND.gray700 },
  onemli: { kenar: BRAND.steel, zemin: BRAND.paper50, metin: BRAND.slate },
  uyari: { kenar: BRAND.red, zemin: BRAND.paper50, metin: BRAND.inkDeep },
  tehlike: { kenar: BRAND.redDeep, zemin: BRAND.redPale, metin: BRAND.redDeep },
};

const s = StyleSheet.create({
  kapakBaslik: { fontSize: 24, fontWeight: 800, letterSpacing: 0.4, marginTop: mm(40) },
  kapakAlt: { fontSize: 14, fontWeight: 500, color: BRAND.gray700, marginTop: 6 },
  kapakDoc: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginTop: mm(10) },
  kunyeSatir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline, paddingVertical: 3 },
  kunyeEtiket: { width: "35%", fontSize: 8, color: BRAND.gray600 },
  kunyeDeger: { flex: 1, fontSize: 9 },

  h1: { fontSize: 14, fontWeight: 800, marginTop: 14, marginBottom: 5 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 9.5, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  h4: { fontSize: 9, fontWeight: 600, marginTop: 6, marginBottom: 2, color: BRAND.gray700 },
  numara: { fontFamily: FONTS.mono, color: BRAND.red },

  p: { fontSize: 8.5, lineHeight: 1.5, marginBottom: 4, textAlign: "justify" },
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

  kutu: { borderLeftWidth: 3, borderRadius: 2, padding: 6, marginVertical: 5 },
  kutuBaslik: { fontSize: 8, fontWeight: 800, letterSpacing: 0.8, marginBottom: 2 },

  tabloBaslik: { flexDirection: "row", backgroundColor: BRAND.paper150, borderBottomWidth: 0.75, borderBottomColor: BRAND.line350 },
  tabloSatir: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: BRAND.hairline },
  hucre: { padding: 3, fontSize: 7.5, lineHeight: 1.35 },
  hucreBaslik: { padding: 3, fontSize: 7.5, fontWeight: 700 },
  altyazi: { fontSize: 7, color: BRAND.gray600, marginTop: 2, fontStyle: "italic" },

  icindekilerSatir: { flexDirection: "row", marginBottom: 1.5 },
  ekKapakBaslik: { fontSize: 18, fontWeight: 800, marginTop: mm(30) },
});

/** Gövde genişliği (pt) — tablo sütun genişlikleri buradan pay alır. */
const GOVDE_GENISLIK = mm(210) - PAGE.contentLeft - PAGE.marginOuter;

export function ManualPdf({
  payload,
  sources,
  images,
  docCode,
  docLine,
  company,
  bandLines,
}: ManualPdfProps) {
  const basilan = printedManual(payload);
  const numarali = numberManual(basilan.sections);
  const duz = flattenManual(numarali);
  const gorseller = new Map(images.map((g) => [g.id, g]));

  // Ek kapsayıcısı gövdeden AYRILIR (bkz. aşağıdaki sözleşme notu).
  const ekKapsayici = numarali.find((b) => b.children.some((c) => c.appendix)) ?? null;
  const govdeBolumleri = numarali.filter((b) => b !== ekKapsayici);
  const ekKapaklari = (ekKapsayici?.children ?? []).filter((c) => c.appendix);

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

  return (
    <Document
      title={`${payload.docTitle} — ${payload.coverTitle}`}
      author="ORION Cranes"
      subject={payload.coverTitle}
    >
      {/* ————————————————————————————————————————————————— kapak */}
      <BrandPage docLine={docLine} docCode={docCode} company={company} hideFooterRule>
        <BrandBand docCode={docCode} lines={bandLines ?? []} />
        <Text style={s.kapakBaslik}>{trUpper(payload.coverTitle || payload.identity.product)}</Text>
        <Text style={s.kapakAlt}>{trUpper(payload.docTitle)}</Text>
        <RuleRed width={64} />
        <Text style={s.kapakDoc}>{docCode}</Text>

        {kunyeSatirlari.length > 0 && (
          <View style={{ marginTop: mm(18) }} wrap={false}>
            <Text style={T.kicker}>GENEL BİLGİLER</Text>
            <View style={{ marginTop: 4 }}>
              {kunyeSatirlari.map(([etiket, deger]) => (
                <View key={etiket} style={s.kunyeSatir}>
                  <Text style={s.kunyeEtiket}>{etiket}</Text>
                  <Text style={s.kunyeDeger}>{deger}</Text>
                </View>
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

      {/* ————————————————————————————————————————————— içindekiler */}
      {duz.length > 0 && (
        <BrandPage docLine={docLine} docCode={docCode}>
          <Text style={s.h1}>İÇİNDEKİLER</Text>
          {duz.map((b) => (
            <View key={b.id} style={[s.icindekilerSatir, { paddingLeft: (b.depth - 1) * 10 }]}>
              <Text style={[s.numara, { width: 46, fontSize: 8 }]}>{b.number}</Text>
              <Text style={{ fontSize: 8, fontWeight: b.depth === 1 ? 700 : 400 }}>{b.title}</Text>
            </View>
          ))}
        </BrandPage>
      )}

      {/* ————————————————————————————————————————————————— gövde */}
      {/* HER ANA BÖLÜM KENDİ SAYFASINDA BAŞLAR. `break` ile aynı sayfada
          zincirlemek 14 ana bölümlü bir belgede başlıkların sayfa dibinde
          asılı kalmasına yol açıyordu; ayrı `BrandPage` her bölümü temiz bir
          yaprakta açar (ekipman listesindeki üç yaprak grubunun dersi). */}
      {govdeBolumleri.map((bolum) => (
        <BrandPage key={bolum.id} docLine={docLine} docCode={docCode}>
          <Bolum bolum={bolum} sources={sources} gorseller={gorseller} />
        </BrandPage>
      ))}

      {/* ————————————————————————————————————————————————— ekler */}
      {/* EK KAPSAYICISI KENDİ YAPRAĞINDA, HER EK KAPAĞI AYRI YAPRAKTA.
          Bu bir yerleşim tercihi DEĞİL, `pdfEkleriYerlestir`in SÖZLEŞMESİDİR:
          temel belgenin SON n sayfası, eklerle AYNI SIRADAKİ n kapak olmalıdır.
          Kapaklar tek sayfada toplansaydı ekler yanlış yere düşerdi. Sıra
          `manualAppendixOrder` ile dışa verilir ve indirme ucu onu okur. */}
      {ekKapsayici && (
        <BrandPage docLine={docLine} docCode={docCode}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={s.h1}>{ekKapsayici.title}</Text>
          </View>
          {ekKapsayici.blocks.map((b) => (
            <Blok key={b.id} blok={b} sources={sources} gorseller={gorseller} />
          ))}
        </BrandPage>
      )}
      {ekKapaklari.map((ek) => (
        <BrandPage key={ek.id} docLine={docLine} docCode={docCode}>
          <Bolum bolum={ek} sources={sources} gorseller={gorseller} />
        </BrandPage>
      ))}
    </Document>
  );
}

/**
 * Belgede BASILAN ek kapaklarının sırası.
 *
 * İndirme ucu birleştirmeyi bu sırayla yapar; PDF'in kendisi ile sıra AYNI
 * fonksiyondan gelir, iki yerde yazılsaydı bir ek yanlış kapağın altına
 * düşerdi ve okuyan bunu ancak belgeyi açınca görürdü.
 */
export function manualAppendixOrder(payload: ManualPayload): ManualAppendixKind[] {
  const numarali = numberManual(printedManual(payload).sections);
  const kapsayici = numarali.find((b) => b.children.some((c) => c.appendix));
  return (kapsayici?.children ?? [])
    .map((c) => c.appendix)
    .filter((k): k is ManualAppendixKind => Boolean(k));
}

function Bolum({
  bolum,
  sources,
  gorseller,
}: {
  bolum: NumberedSection;
  sources: ManualSourceData;
  gorseller: Map<string, ManualImageAsset>;
}) {
  const baslikStili = [s.h1, s.h2, s.h3, s.h4][Math.min(bolum.depth, 4) - 1];
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline" }} wrap={false}>
        {bolum.number ? (
          <Text style={[baslikStili, s.numara, { marginRight: 6 }]}>{bolum.number}</Text>
        ) : null}
        <Text style={baslikStili}>{bolum.title}</Text>
      </View>

      {/* EK BÖLÜMÜ BİR AYRAÇ KAPAĞIDIR: gövdesi yoktur, belgenin kendisi
          indirme ucunda bu kapağın ardına eklenir. */}
      {bolum.appendix && (
        <View>
          <Text style={s.ekKapakBaslik}>{trUpper(MANUAL_APPENDIX_LABELS[bolum.appendix])}</Text>
          <RuleRed width={48} />
          <Text style={[s.p, { marginTop: 8, color: BRAND.gray600 }]}>
            Bu ek, belgenin tam sürümünde bu sayfadan sonra basılır.
          </Text>
        </View>
      )}

      {bolum.blocks.map((b) => (
        <Blok key={b.id} blok={b} sources={sources} gorseller={gorseller} />
      ))}

      {bolum.children.map((c) => (
        <Bolum key={c.id} bolum={c} sources={sources} gorseller={gorseller} />
      ))}
    </View>
  );
}

function Blok({
  blok,
  sources,
  gorseller,
}: {
  blok: ManualBlock;
  sources: ManualSourceData;
  gorseller: Map<string, ManualImageAsset>;
}) {
  switch (blok.kind) {
    case "text":
      return (
        <View wrap={false}>
          {blok.margin?.trim() ? <Text style={s.kenarNot}>{blok.margin}</Text> : null}
          <Text style={s.p}>{blok.text}</Text>
        </View>
      );

    case "list":
      return (
        <View style={{ marginBottom: 4 }}>
          {blok.items
            .filter((i) => i.trim())
            .map((i, k) => (
              <View key={k} style={s.madde}>
                <Text style={s.maddeIsaret}>{blok.ordered ? `${k + 1}.` : "•"}</Text>
                <Text style={s.maddeMetin}>{i}</Text>
              </View>
            ))}
          {blok.result?.trim() ? (
            <View style={s.sonuc}>
              <Text style={s.maddeIsaret}>→</Text>
              <Text style={[s.maddeMetin, { color: BRAND.gray700 }]}>{blok.result}</Text>
            </View>
          ) : null}
        </View>
      );

    case "note": {
      const renk = NOT_RENGI[blok.level];
      return (
        <View
          style={[s.kutu, { borderLeftColor: renk.kenar, backgroundColor: renk.zemin }]}
          wrap={false}
        >
          <Text style={[s.kutuBaslik, { color: renk.kenar }]}>
            {blok.title?.trim() || MANUAL_NOTE_LABELS[blok.level]}
          </Text>
          <Text style={[s.p, { marginBottom: 0, color: renk.metin }]}>{blok.text}</Text>
        </View>
      );
    }

    case "table":
      return <Tablo table={blok.table} />;

    case "image": {
      const g = gorseller.get(blok.imageId);
      // KAYIT YOKSA BLOK HİÇ BASILMAZ. Boş bir çerçeve, okuyana orada bir
      // şeyin eksildiğini söyler ve gizleme kuralının ruhuna aykırıdır.
      if (!g) return null;
      const genislik = (GOVDE_GENISLIK * (blok.widthPct ?? 100)) / 100;
      const yukseklik = g.width > 0 ? (genislik * g.height) / g.width : undefined;
      return (
        <View style={{ marginVertical: 6 }} wrap={false}>
          <Image src={g.bytes} style={{ width: genislik, height: yukseklik }} />
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
      return <Tablo table={tablo} />;
    }
  }
}

/**
 * Tablo — SÜTUN GENİŞLİKLERİ İÇERİKTEN ÇIKAR.
 *
 * Eşit paylı sütunlar 6 sütunlu bir malzeme listesinde "Adet" hücresine
 * 28 mm ayırıp "Tanım"ı üç satıra sarıyordu. Genişlik, sütunun EN UZUN
 * hücresinin karakter sayısıyla orantılıdır ve toplam 100'e normalize edilir;
 * tek bir çok uzun hücrenin tabloyu ezmemesi için pay KELEPÇELENİR.
 */
function Tablo({ table }: { table: ManualTable }) {
  const sutun = Math.max(table.head.length, ...table.rows.map((r) => r.length), 1);
  const uzunluk: number[] = Array.from({ length: sutun }, (_, j) => {
    let en = (table.head[j] ?? "").length;
    for (const r of table.rows) en = Math.max(en, (r[j] ?? "").length);
    // Kelepçe: 4 karakterden dar bir sütun okunmaz, 40'tan geniş olan komşusunu ezer.
    return Math.min(40, Math.max(4, en));
  });
  const toplam = uzunluk.reduce((a, b) => a + b, 0);
  const pay = uzunluk.map((u) => `${((u / toplam) * 100).toFixed(2)}%`);

  return (
    <View style={{ marginVertical: 5 }}>
      <View style={s.tabloBaslik} fixed>
        {Array.from({ length: sutun }).map((_, j) => (
          <Text key={j} style={[s.hucreBaslik, { width: pay[j] }]}>
            {table.head[j] ?? ""}
          </Text>
        ))}
      </View>
      {table.rows.map((r, i) => (
        <View key={i} style={s.tabloSatir} wrap={false}>
          {Array.from({ length: sutun }).map((_, j) => (
            <Text key={j} style={[s.hucre, { width: pay[j] }]}>
              {r[j] ?? ""}
            </Text>
          ))}
        </View>
      ))}
      {table.caption?.trim() ? <Text style={s.altyazi}>{table.caption}</Text> : null}
    </View>
  );
}
