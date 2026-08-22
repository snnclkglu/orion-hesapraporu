// Ekipman listesi PDF çıktısı — @react-pdf/renderer. Panelden "PDF indir" ile
// üretilir. Marka altyapısı brand.tsx: BrandPage (kırmızı omurga + folio
// altbilgi), PageHeader bandı, Archivo gövde + PlexMono sayı/kod. Sütunlar:
// Ekipman · Marka · Model · Özellikler · Adet. Model hücresi katalog datasheet
// linki varsa köprülenir (çelik mavisi); klima satırları düz metindir.
// scope="full" → Teknik Ressam Özeti.
//
// Sütun metinleri `buildEquipmentGroups` içinde biçimlenmiş olarak gelir ve
// burada yeniden dokunulmaz: ekipman adı ile özellikler "Baş Harfler Büyük"
// (madde 33), MARKA ve MODEL ise BÜYÜK HARF (12.08.2026 kararı — ikisi de ürün
// kimliğidir). "Ek Özellikler" sütunu kullanıcının satıra yazdığı serbest
// nottur (equipment_notes, madde 34).

import React from "react";
import { Document, Image, Link, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type {
  EqGroup, SummarySection,
} from "@/lib/excel/equipment";
import {
  attachmentSummaryText, canLinkEquipmentModel, dsKey, rowSheetUrl, summaryRowValue,
} from "@/lib/excel/equipment";
import {
  BRAND, BrandBand, BrandPage, FONTS, PageHeader, RuleRed, T, trUpper,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { docCode } from "@/lib/pdf/doc-naming";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { toDisplayUnitLabel } from "@/lib/units";
import { PdfDiagram } from "@/lib/pdf/diagram";
// TEKNİK ÖZELLİKLER TABLOSU HESAP RAPORUNUNKİYLE AYNI BİLEŞENDİR: ikinci bir
// tablo yazmak, iki belgenin bir gün farklı alan basmasıyla biterdi.
import { FieldTable } from "@/lib/pdf/report";
import type { AnyFieldDef } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import type { TechnicalSpecs } from "@/lib/calc/types";

const s = StyleSheet.create({
  // meta ızgarası (Proje / Müşteri / Revizyon / Tarih)
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10, gap: 2 },
  metaItem: { width: "50%", flexDirection: "row" },
  metaLabel: { width: 70, fontFamily: FONTS.sans, fontSize: 7.5, fontWeight: 500, color: BRAND.gray600 },
  metaVal: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.ink },
  metaMono: { fontFamily: FONTS.mono, fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3, color: BRAND.ink },
  // tablo: kömür başlık zemini + hairline satır çizgileri
  tHead: { flexDirection: "row", backgroundColor: BRAND.ink },
  // Büyük harf dönüşümü stilde YAPILMAZ: @react-pdf'in textTransform'u
  // locale'siz toUpperCase() çağırıp Türkçe "i" harfini bozar. Metin çağrı
  // yerinde trUpper() ile büyütülür.
  th: {
    fontFamily: FONTS.mono, fontSize: 6.5, fontWeight: 600, letterSpacing: 0.8,
    color: BRAND.paper100, paddingVertical: 4, paddingHorizontal: 5,
  },
  groupRow: { backgroundColor: BRAND.paper150 },
  groupCell: {
    fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700, color: BRAND.ink,
    paddingVertical: 3, paddingHorizontal: 5,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline },
  td: { fontFamily: FONTS.sans, fontSize: 7.5, color: BRAND.ink, paddingVertical: 2.5, paddingHorizontal: 5 },
  mono: { fontFamily: FONTS.mono, fontSize: 7, fontWeight: 500, letterSpacing: 0.2 },
  // Ekipman listesi A4 yataydır. Uzun katalog kodlarının özellik hücresine
  // taşmaması için model sütunu özellikle geniş tutulur.
  cComp: { width: "15%" },
  cBrand: { width: "10%" },
  cModel: { width: "17%" },
  cSpec: { width: "30%" },
  // Ek Özellikler: kullanıcının satıra yazdığı serbest açıklama (madde 34).
  // Renk ayrı stildedir; genişlik stili başlık satırında da kullanılıyor ve
  // oradaki paper100 metin rengini ezmemelidir.
  cNote: { width: "14%" },
  noteText: { color: BRAND.gray700 },
  // Ek Belge: satıra elle yüklenmiş PDF'in sayfa adedi. Dar tutulur — hücrede
  // bir cümle değil bir ölçü durur ("2 sayfa").
  cAttach: { width: "8%" },
  cQty: { width: "6%", textAlign: "right" as const },
  custom: { color: BRAND.red },
  // Alternatif (seçenekli) satır: aktif seçim ana satırdır, alternatifler onun
  // ALTINDA soluk ve girintili durur. Eğik yazı KULLANILMAZ — Archivo eğik
  // varyantla kaydedilmediğinden react-pdf harfleri yapay eğmez, sessizce
  // düz basar; ayrım rengin ve girintinin üzerinden verilir.
  altRow: { backgroundColor: BRAND.paper50 },
  altText: { color: BRAND.gray600 },
  altIndent: { paddingLeft: 12 },
  // özet
  sumSection: {
    backgroundColor: BRAND.paper150, fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700,
    color: BRAND.ink, paddingVertical: 3, paddingHorizontal: 5,
  },
  sLabel: { flex: 1 },
  sVal: {
    fontFamily: FONTS.mono, fontSize: 7.4, fontWeight: 500, letterSpacing: 0.2,
    color: BRAND.ink, textAlign: "right" as const, flexShrink: 0,
  },
  sUnit: {
    fontFamily: FONTS.mono, fontSize: 6.6, color: BRAND.gray500,
    textAlign: "right" as const, width: 40, flexShrink: 0,
  },
  // Satırın ALTINA düşen açıklama — ölçü değil, ressamın bilmesi gereken şey.
  sNote: {
    fontFamily: FONTS.sans, fontSize: 6.2, color: BRAND.gray600,
    paddingHorizontal: 5, paddingBottom: 2,
  },
  // İki sütunlu özet ızgarası (yatay A4).
  sumBlock: { marginBottom: 8 },
  sumGrid: { flexDirection: "row", gap: 14 },
  sumCol: { flex: 1, flexShrink: 0 },
  sumRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingVertical: 2,
    // Satır ASLA sıkışmaz: yer kalmadığında react-pdf satırları ezip üst üste
    // bindiriyor. Bölme kararı ızgaranın `wrap={false}`ında verilir.
    flexShrink: 0,
    gap: 4,
  },
  sLabelText: { fontFamily: FONTS.sans, fontSize: 7.4, color: BRAND.gray700 },
  sValText: {},
  // NOTLAR kutusu: kırmızı omurga, kağıt zemin (hesap raporundaki mühendis
  // notu kutusuyla aynı dil).
  noteBox: {
    borderLeftWidth: 2, borderLeftColor: BRAND.red, backgroundColor: BRAND.paper100,
    paddingVertical: 5, paddingHorizontal: 8, marginTop: 3,
  },
  noteLine: { fontFamily: FONTS.sans, fontSize: 8, color: BRAND.ink, lineHeight: 1.4 },
  // ek: katalog sayfaları
  sheetHead: { marginBottom: 6 },
  sheetTitle: { fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, color: BRAND.ink },
  sheetMeta: { fontFamily: FONTS.mono, fontSize: 7, color: BRAND.gray600, marginTop: 2 },
  sheetImage: { width: "100%", objectFit: "contain" as const },
  hint: { fontFamily: FONTS.sans, fontSize: 7, color: BRAND.gray600, marginBottom: 6 },
  mainDrawingLink: {
    fontFamily: FONTS.sans, fontSize: 8, fontWeight: 500, color: BRAND.steel,
    textDecoration: "underline", marginBottom: 6,
  },
});

export interface EquipmentMetaPdf {
  docNo: string; projectName: string; customer: string;
  revLabel: string; revNo: number; date: string;
  preparedBy?: string;
  checkedBy?: string;
}

/**
 * Ek yaprağının tek bir görüntüsü.
 *
 * `orientation` ÇAĞIRANDAN gelir çünkü kararı ölçü verir: görüntü eninden
 * uzunsa yaprak yatay basılır (bkz. `catalog-sheet-images.ts`). PDF katmanı
 * dosyayı hiç görmediği için bunu kendisi ölçemez.
 */
export interface CatalogSheetImage {
  data: Buffer;
  format: "png" | "jpg";
  orientation: "portrait" | "landscape";
}

/**
 * Detaylı listenin ekindeki bir katalog sayfası.
 *
 * Görüntü BURAYA HAZIR gelir (`data` + `format`): kaynak dosyalar .webp'tir ve
 * react-pdf webp çözmez; dönüştürme çağıran taraftadır (indirme ucu, sharp).
 * PDF katmanı dosya sistemi bilmez — saf kalır ve testten geçirilebilir.
 */
export interface CatalogSheetPage {
  /**
   * Bu eke bağlanan ürünlerin anahtarları — `dsKey(kind, brand, model)`.
   * ÇOĞULDUR: aynı katalog sayfası birden çok ürüne hizmet edebilir (aynı
   * serinin iki boyu tek tabloda basılır) ve sayfa eke bir kez girer.
   */
  keys: string[];
  title: string;
  /** Ek sayfa başlığında görünen model kodu (birden çok ürünse ilki) */
  model: string;
  source: string;
  printedPages: string;
  images: CatalogSheetImage[];
}

/**
 * Kullanıcının ekipman satırına ELLE eklediği PDF ekinin KAPAK yaprağı.
 *
 * Belgenin kendi sayfaları buraya GİRMEZ: onlar var olan bir PDF'in
 * sayfalarıdır ve react-pdf var olan bir PDF'i okuyamaz (bkz. `pdf/merge.ts`
 * başlığı). Bu yüzden react-pdf yalnız kapağı basar, gerçek sayfalar
 * indirme ucunda pdf-lib ile kapağın HEMEN ARDINA eklenir.
 *
 * Kapak neden var: birleştirilmiş sayfalara Türkçe başlık BASILAMAZ (pdf-lib'in
 * gömülü standart fontları WinAnsi'dir, "ş/ğ/ı/İ" kodlanamaz — merge.ts bunu
 * belgeliyor). Kapak olmasa otuz sayfalık bir ekin ortasındaki yaprağın hangi
 * ekipmana ait olduğu okunamazdı; üstelik listedeki bağlantının gideceği bir
 * çapa da kalmazdı.
 */
export interface EquipmentAttachmentCover {
  /** `dsKey(kind, brand, model)` DEĞİL, satırın `rowKey`i — ek satıra bağlıdır. */
  rowKey: string;
  /** Ekipman adı (listede görünen hâli) */
  component: string;
  /** Kullanıcının dosya adı */
  fileName: string;
  /** Sunucunun okuyarak saydığı sayfa adedi */
  pageCount: number;
}

export interface EquipmentPdfProps {
  meta: EquipmentMetaPdf;
  groups: EqGroup[];
  summary?: SummarySection[];
  /**
   * Belgenin İLK yaprağına basılan TEKNİK ÖZELLİKLER tablosu.
   *
   * Hazır gelir (`summarySpecsForReport`) — PDF katmanı hesap girdisini
   * yeniden süzmez; hesap raporunun özet sayfasıyla aynı alan listesini ve
   * aynı bileşeni (`FieldTable`) kullanır. Verilmezse yaprak hiç basılmaz
   * (müşteri kapsamındaki liste bugünkü hâlinde kalır).
   */
  specTable?: {
    defs: AnyFieldDef[];
    source: Record<string, unknown>;
    /** Teknik özelliklere göre çözülen etiketler için (kanca/tutucu tipi). */
    specs?: TechnicalSpecs;
  };
  settings?: ReportSettings;
  datasheetUrls?: Map<string, string>;
  /**
   * Ekipman ADINA bağlanan katalog sayfası adresleri (MUTLAK). Standart
   * listede kullanılır: PDF Acrobat'ta açıldığında bağlantı uygulamanın
   * katalog görüntüleyicisini yeni sekmede açar.
   */
  sheetUrls?: Map<string, string>;
  /** Müşterinin üyelik olmadan açacağı seçilmiş proje ana paftası. */
  mainDrawingUrl?: string;
  /**
   * Detaylı liste: katalog sayfaları belgenin SONUNA eklenir ve ekipman adı
   * DIŞ adrese değil, belge içindeki o sayfaya bağlanır. Boşsa belge standart
   * listedir.
   */
  sheetPages?: CatalogSheetPage[];
  /**
   * Detaylı listede kullanıcının yüklediği PDF eklerinin KAPAKLARI — belgenin
   * en sonunda, katalog sayfalarından sonra. Ekin gerçek sayfaları burada
   * DEĞİLDİR; onları indirme ucu pdf-lib ile her kapağın ardına ekler
   * (`EquipmentAttachmentCover`).
   */
  attachmentCovers?: EquipmentAttachmentCover[];
}

/**
 * Ek yaprağındaki görüntünün EN ÇOK yüksekliği (pt), sayfa yönüne göre.
 *
 * NEDEN GEREKLİ: görüntüye yalnız `width: "100%"` verildiğinde yükseklik en/boy
 * oranından türer. Dikey bir taramada bu sığar; YATAY bir taramada (~1,41 oran)
 * türeyen yükseklik sayfanın kalanını aşar ve react-pdf yaprağı ikiye bölüp
 * "IMAGE can't wrap between pages" uyarısı verir. Kutu yukarıdan kelepçelenince
 * `objectFit: contain` görüntüyü içine oturtur.
 *
 * Türetme (A4, `PAGE` marjları): sayfa boyu − üst marj mm(16) − alt marj
 * mm(13) − altbilgi payı 14pt − başlık bloğu (kicker + kural + ad + künye +
 * boşluk ≈ 55pt).
 *   dikey : 842 − 45 − 37 − 14 − 55 ≈ 690
 *   yatay : 595 − 45 − 37 − 14 − 55 ≈ 444
 */
const SHEET_MAX_HEIGHT = { portrait: 690, landscape: 444 } as const;

/**
 * Özet şemalarının ölçü kelepçeleri (yatay A4 içerik kutusu ≈ 734 × 470 pt).
 *
 * Şema TAM GENİŞLİK bölümünde durur; yine de yüksekliği kelepçelenir, aksi
 * hâlde kareye yakın bir çizim (`wrap={false}` kutusuyla birlikte) yaprağı
 * taşırır ve bir sonrakine atlar.
 */
const SUM_DIAGRAM_MAX_W = 660;
const SUM_DIAGRAM_MAX_H = 250;

/**
 * Bir bölünemez ızgaraya en çok kaç satır girer (iki sütun × 10).
 *
 * Yatay A4'ün iç yüksekliği ≈ 470 pt; 10 satırlık bir sütun ≈ 130 pt. Uzun
 * çizelgeler (tambur, kamber kotları) bu öbeklerle yaprak sınırından devam
 * eder — tek parça bir ızgara "sayfaya sığmıyor" uyarısı üretiyor ve ya
 * taşıyor ya boş yaprak bırakıyordu.
 */
const SUM_ROWS_PER_BLOCK = 20;

/** Satır sonu ayracı — CRLF ve LF birlikte. */
const NOTE_LINE_BREAK = /\r?\n/;

function chunk<T>(list: readonly T[], size: number): T[][] {
  if (list.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Ek sayfa çapası — `Link src="#…"` ile `View id="…"` bu adı paylaşır. */
function anchorId(key: string): string {
  return `katalog-${key.replace(/[^a-z0-9]+/gi, "-")}`;
}

/**
 * Elle yüklenen ekin çapası. Katalog sayfası çapasından AYRI ad alanı taşır:
 * bir ürünün hem defterden gelen sayfası hem kullanıcının yüklediği yaprağı
 * olabilir ve ikisi belgenin farklı yerlerinde durur.
 */
export function attachmentAnchorId(rowKey: string): string {
  return `ek-belge-${rowKey.replace(/[^a-z0-9]+/gi, "-")}`;
}

/** Uzun katalog kodlarının sütun sınırında güvenle kırılabileceği işaretler. */
export function breakEquipmentModelCode(model: string): string {
  return model.replace(/([./_-])/g, "$1\u200B");
}

/**
 * Firma künyesi — `BrandPage`in altbilgisine verilir, AYRI BİR BLOK OLARAK
 * DEĞİL. Ayrı bir `fixed` katman olduğunda künyenin çizgisi ile altbilgi
 * çizgisi alt alta iki ince çizgi basılıyor ve aralarında boş bir şerit
 * kalıyordu; sayfanın alt payını da çağıranın elle vermesi gerekiyordu.
 */
function companyInfo(settings?: ReportSettings): CompanyInfo {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  return {
    company: st.company,
    address: st.address || st.city,
    phone: st.phone,
    email: st.email,
    web: st.web,
  };
}

function ModelCell({ row, urls }: { row: EqGroup["rows"][number]; urls?: Map<string, string> }) {
  const url = row.kind ? urls?.get(dsKey(row.kind, row.brand, row.model)) : undefined;
  const model = breakEquipmentModelCode(row.model);
  // Klima tipleri için üretici websitesi bağlantısı müşteri çıktılarında
  // istenmiyor; diğer katalog ekipmanlarının datasheet bağlantıları korunur.
  if (canLinkEquipmentModel(row.kind) && url && row.model && row.model !== "-") {
    return (
      <View style={[s.td, s.cModel]}>
        <Link src={url} style={[s.mono, { color: BRAND.steel, textDecoration: "underline" }]}>{model}</Link>
      </View>
    );
  }
  return <Text style={[s.td, s.mono, s.cModel]}>{model}</Text>;
}

/**
 * Ekipman adı hücresi.
 *
 * Katalog sayfası varsa ad tıklanabilir olur; NEREYE gittiği belgenin türüne
 * bağlıdır: detaylı listede belgenin kendi ek sayfasına (iç bağlantı), standart
 * listede uygulamadaki katalog görüntüleyicisine (dış adres). Bağlantı ADA
 * bağlanır çünkü mühendis ürünü adıyla arar; model kodu üretici datasheet'ine
 * ayrılmıştır.
 */
function ComponentCell({
  row,
  href,
  style,
}: {
  row: EqGroup["rows"][number];
  href?: string;
  style: React.ComponentProps<typeof View>["style"];
}) {
  const text = `${row.component}${row.custom ? " *" : ""}`;
  if (!href) return <Text style={style}>{text}</Text>;
  return (
    <View style={style}>
      <Link src={href} style={{ color: BRAND.steel, textDecoration: "underline" }}>
        {text}
      </Link>
    </View>
  );
}

/**
 * "Ek Belge" hücresi — satıra yüklenmiş PDF'in ölçüsü ("2 sayfa · katalog.pdf").
 *
 * Detaylı listede belgenin sonundaki yaprağa bağlanır; standart listede düz
 * metindir çünkü ek o dosyada YOKTUR ve var olmayan bir hedefe bağlantı vermek,
 * tıklayınca hiçbir şey olmaması demektir.
 */
function AttachmentCell({
  row,
  href,
}: {
  row: EqGroup["rows"][number];
  href?: string;
}) {
  const text = attachmentSummaryText(row.attachments);
  if (!text) return <Text style={[s.td, s.cAttach]} />;
  if (!href) return <Text style={[s.td, s.cAttach, s.noteText]}>{text}</Text>;
  return (
    <View style={[s.td, s.cAttach]}>
      <Link src={href} style={{ color: BRAND.steel, textDecoration: "underline" }}>
        {text}
      </Link>
    </View>
  );
}

/** Belge künyesi — ilk yaprakta ve teknik özellik yaprağında AYNI ızgara. */
function MetaGrid({ meta }: { meta: EquipmentMetaPdf }) {
  return (
    <View style={s.metaGrid}>
      <View style={s.metaItem}><Text style={s.metaLabel}>Müşteri</Text><Text style={s.metaVal}>{meta.customer}</Text></View>
      <View style={s.metaItem}><Text style={s.metaLabel}>Doküman</Text><Text style={s.metaMono}>{meta.docNo}</Text></View>
      <View style={s.metaItem}><Text style={s.metaLabel}>Revizyon</Text><Text style={s.metaMono}>V{meta.revNo}{meta.revLabel ? ` — ${meta.revLabel}` : ""}</Text></View>
      <View style={s.metaItem}><Text style={s.metaLabel}>Tarih</Text><Text style={s.metaMono}>{meta.date}</Text></View>
      <View style={s.metaItem}><Text style={s.metaLabel}>Hazırlayan</Text><Text style={s.metaVal}>{meta.preparedBy || "—"}</Text></View>
      <View style={s.metaItem}><Text style={s.metaLabel}>Kontrol</Text><Text style={s.metaVal}>{meta.checkedBy || "—"}</Text></View>
    </View>
  );
}

export function EquipmentDocument({
  meta, groups, summary, specTable, settings, datasheetUrls, sheetUrls, mainDrawingUrl, sheetPages,
  attachmentCovers,
}: EquipmentPdfProps) {
  const covers = attachmentCovers ?? [];
  const detailed = (!!sheetPages && sheetPages.length > 0) || covers.length > 0;
  /**
   * Ürün anahtarı → belge içi çapa. Çapa sayfanın İLK ürününün anahtarından
   * türer; aynı sayfayı paylaşan diğer ürünler de oraya gider (yoksa
   * bağlantı var olmayan bir hedefe düşer ve tıklama hiçbir şey yapmaz).
   */
  const anchorByKey = new Map<string, string>();
  for (const page of sheetPages ?? []) {
    const anchor = anchorId(page.keys[0] ?? "");
    for (const key of page.keys) anchorByKey.set(key, anchor);
  }
  /** Ekin kapağı basılan satırlar — listedeki "Ek Belge" hücresi oraya bağlanır. */
  const coverKeys = new Set(covers.map((c) => c.rowKey));
  const linkFor = (row: EqGroup["rows"][number]): string | undefined => {
    if (detailed) {
      // ÖNCELİK DEFTERDEN GELEN KATALOG SAYFASINDADIR: ürünün üretici sayfası
      // kimliğin kendisidir. Kullanıcının yüklediği ek onu tamamlar; sayfa
      // yoksa ad doğrudan eke gider, böylece defterde karşılığı olmayan
      // ürünlerin (kanca, makara, teker…) adı da tıklanabilir olur.
      const sheetAnchor = row.kind
        ? anchorByKey.get(dsKey(row.kind, row.brand, row.model))
        : undefined;
      if (sheetAnchor) return `#${sheetAnchor}`;
      if (row.rowKey && coverKeys.has(row.rowKey)) {
        return `#${attachmentAnchorId(row.rowKey)}`;
      }
      return undefined;
    }
    if (!row.kind) return undefined;
    return rowSheetUrl(row, sheetUrls);
  };
  /** "Ek Belge" hücresi — detaylı listede belgenin sonundaki yaprağa bağlanır. */
  const attachmentLinkFor = (row: EqGroup["rows"][number]): string | undefined =>
    detailed && row.rowKey && coverKeys.has(row.rowKey)
      ? `#${attachmentAnchorId(row.rowKey)}`
      : undefined;
  const rev = String(meta.revNo).padStart(2, "0");
  const year = /(\d{4})/.exec(meta.date)?.[1] ?? String(new Date().getFullYear());
  const code = docCode("EQ", meta.docNo, meta.revNo);
  return (
    <Document
      title={`${meta.docNo}-V${meta.revNo} Ekipman Listesi`}
      author={(settings ?? DEFAULT_REPORT_SETTINGS).company}
      subject={`${meta.customer} — ${meta.projectName}`}
      language="tr"
    >
      {/*
        TEKNİK ÖZELLİKLER İLK YAPRAKTADIR (kullanıcı isteği, 19.08.2026).
        Ressamın eline giden belge "bu vinç nedir" ile başlar; ekipman dökümü
        ve ölçü çizelgeleri ondan sonra gelir. Tablo hesap raporunun özet
        sayfasındakiyle AYNI bileşendir (`FieldTable`) ve aynı süzgeçten
        geçer — kapatılan bölümlerin alanları burada da basılmaz.

        AYRI BİR `BrandPage`TİR, `break` DEĞİL: ekipman tablosunun başlığı
        `fixed`tir ve aynı sayfa bileşeninin BÜTÜN yapraklarında tekrar eder;
        teknik özellik yaprağının üstünde "Ekipman · Marka · Model" şeridi
        çıkardı.
      */}
      {specTable && (
        <BrandPage
          docLine={`ORION CRANES · TEKNİK ÖZELLİKLER · REV ${rev} · ${year}`}
          docCode={code}
          orientation="landscape"
          company={companyInfo(settings)}
        >
          <BrandBand docCode={code} lines={[`REV ${rev} · ${meta.date}`]} logoWidth={150} />
          <PageHeader kicker="Teknik Özellikler" title={meta.projectName || "Ekipman Listesi"} />
          <MetaGrid meta={meta} />
          <FieldTable defs={specTable.defs} source={specTable.source} specs={specTable.specs} />
        </BrandPage>
      )}

      <BrandPage
        docLine={`ORION CRANES · EKİPMAN LİSTESİ · REV ${rev} · ${year}`}
        docCode={code}
        orientation="landscape"
        company={companyInfo(settings)}
      >
        {/* Marka bandı: lockup logo + doküman kimliği. Müşteriye teslim edilen
            belgenin ilk sayfası markayı taşır (hesap raporu kapağıyla aynı).
            Teknik özellik yaprağı varsa bant ORADADIR; iki kez basılmaz. */}
        {!specTable && (
          <BrandBand docCode={code} lines={[`REV ${rev} · ${meta.date}`]} logoWidth={150} />
        )}

        {/* Başlık PageHeader içinde tr-TR ile büyütülür; kaynak Title Case yazılır.
            Kicker'da firma adı, sağda doküman kodu TEKRARLANMAZ — ikisi de marka
            bandında. */}
        <PageHeader
          kicker={detailed ? "Ekipman Listesi · Katalog Sayfaları Ekli" : "Ekipman Listesi"}
          title={meta.projectName || "Ekipman Listesi"}
        />

        {/* PROJE künyeden çıktı: artık sayfa BAŞLIĞI o. Aynı bilgiyi hem
            başlıkta hem künyede tekrarlamak künyeyi gereksiz uzatıyordu. */}
        <MetaGrid meta={meta} />

        {mainDrawingUrl && (
          <Link src={mainDrawingUrl} style={s.mainDrawingLink}>
            Proje Ana Paftasını Aç ↗
          </Link>
        )}

        {(detailed || (sheetUrls && sheetUrls.size > 0)) && (
          <Text style={s.hint}>
            {detailed
              ? "Altı çizili ekipman adına tıklayınca belgenin sonundaki ilgili katalog sayfasına gidilir."
              : "Altı çizili ekipman adına tıklayınca ürünün katalog sayfası tarayıcıda açılır."}
          </Text>
        )}

        <View style={s.tHead} fixed>
          <Text style={[s.th, s.cComp]}>{trUpper("Ekipman")}</Text>
          <Text style={[s.th, s.cBrand]}>{trUpper("Marka")}</Text>
          <Text style={[s.th, s.cModel]}>{trUpper("Model")}</Text>
          <Text style={[s.th, s.cSpec]}>{trUpper("Özellikler")}</Text>
          <Text style={[s.th, s.cNote]}>{trUpper("Ek Özellikler")}</Text>
          <Text style={[s.th, s.cAttach]}>{trUpper("Ek Belge")}</Text>
          <Text style={[s.th, s.cQty]}>{trUpper("Adet")}</Text>
        </View>

        {/*
          GRUP SARMALAYICI KUTUYA KONMAZ — düz bir kardeş dizisi olarak akar
          (hesap raporunun bölüm düzeniyle aynı gerekçe, `report.tsx`).
          Grubun TAMAMINI kapsayan kutuya `minPresenceAhead` konduğunda
          react-pdf "kutunun hepsi + istenen boşluk sığmıyor" deyip bloğu
          bütünüyle sonraki sayfaya atıyor ve geride BOŞ BİR SAYFA kalıyordu:
          ilk yaprakta yalnız marka bandı, künye ve tablo başlığı duruyordu
          (kullanıcı bildirimi, 12.08.2026 — detaylı ekipman listesi). Koşul
          dardır ve bu yüzden gözden kaçmıştı: grup sayfaya SIĞIYOR ama
          bitişinden sonra 30pt kalmıyorsa tetiklenir.

          Grup başlığı yerine İLK SATIRIYLA aynı bölünemez kutuya konur:
          başlık nereye giderse en az bir satır onunla birlikte gider ve
          hiçbir zaman sayfa dibinde yalnız kalmaz.
        */}
        {groups.map((g) => {
          const rows = g.rows.map((r, i) => (
            <View key={i} style={[s.tr, r.alt ? s.altRow : {}]} wrap={false}>
              <ComponentCell
                row={r}
                href={linkFor(r)}
                style={[
                  s.td, s.cComp,
                  r.custom ? s.custom : {},
                  r.alt ? s.altText : {}, r.alt ? s.altIndent : {},
                ]}
              />
              <Text style={[s.td, s.cBrand, r.alt ? s.altText : {}]}>{r.brand}</Text>
              <ModelCell row={r} urls={datasheetUrls} />
              <Text style={[s.td, s.cSpec, r.alt ? s.altText : {}]}>{r.spec}</Text>
              <Text style={[s.td, s.cNote, s.noteText]}>{r.note ?? ""}</Text>
              <AttachmentCell row={r} href={attachmentLinkFor(r)} />
              <Text style={[s.td, s.mono, s.cQty, r.alt ? s.altText : {}]}>{String(r.qty)}</Text>
            </View>
          ));
          return (
            <React.Fragment key={g.name}>
              <View wrap={false}>
                <View style={s.groupRow}><Text style={s.groupCell}>{trUpper(g.name)}</Text></View>
                {rows[0]}
              </View>
              {rows.slice(1)}
            </React.Fragment>
          );
        })}

      </BrandPage>

      {/*
        TEKNİK RESSAM ÖZETİ KENDİ YAPRAĞINDADIR.
        Eskiden ekipman sayfasının içinde `break` ile duruyordu; ekipman
        tablosunun `fixed` başlığı özet yapraklarının da tepesinde tekrar
        ediyordu. Ayrı bir sayfa bileşeni başlık kapsamını da ayırır.
      */}
      {summary && summary.length > 0 && (
        <BrandPage
          docLine={`ORION CRANES · TEKNİK RESSAM ÖZETİ · REV ${rev} · ${year}`}
          docCode={code}
          orientation="landscape"
          company={companyInfo(settings)}
        >
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
              <View>
                <Text style={T.kicker}>TEKNİK RESSAM ÖZETİ</Text>
                <RuleRed />
              </View>
              <Text style={T.micro}>İMALAT ÖZETİ</Text>
            </View>
            {summary.map((sec) => {
              // NOTLAR bir çizelge değildir: mühendisin cümleleri satır
              // sonlarıyla korunur ve kırmızı omurgalı bir kutuda durur.
              if (sec.kind === "notes") {
                return (
                  <View key={sec.name} style={s.sumBlock} wrap={false}>
                    <Text style={s.sumSection}>{trUpper(sec.name)}</Text>
                    <View style={s.noteBox}>
                      {(sec.text ?? "").split(NOTE_LINE_BREAK).map((line, i) => (
                        <Text key={i} style={s.noteLine}>{line || " "}</Text>
                      ))}
                    </View>
                  </View>
                );
              }
              return (
                <View key={sec.name} style={s.sumBlock}>
                  {/* Başlık ŞEMASIYLA BİRLİKTE taşınır: ikisi ayrı yapraklara
                      düşerse okuyucu resmin hangi bölüme ait olduğunu
                      bilemez. */}
                  <View wrap={false}>
                    <Text style={s.sumSection}>{trUpper(sec.name)}</Text>
                    {sec.diagram && (
                      <PdfDiagram
                        diagram={sec.diagram}
                        maxWidth={SUM_DIAGRAM_MAX_W}
                        maxHeight={SUM_DIAGRAM_MAX_H}
                      />
                    )}
                  </View>
                  {/*
                    ÇİZELGE YATAYDA İKİYE BÖLÜNÜR (kullanıcı isteği,
                    19.08.2026). Sayfa zaten yatay; tek sütunda etiket ile
                    değer kâğıdın iki ucuna düşüyor ve aradaki boşluk satırı
                    okunmaz yapıyordu.

                    Izgara `wrap={false}`: satır yönlü bir kap sayfaya
                    BÖLÜNEMEZ — react-pdf bölünmeye zorlanınca içerideki
                    satırları ezip üst üste bindirir. Bu yüzden satırlar
                    ÖNCEDEN öbeklenir (`SUM_ROWS_PER_BLOCK`): her ızgara
                    yarım yapraktan kısa kalır ve uzun bir çizelge (tambur,
                    kamber kotları) yaprak sınırında kendi öbeğinden devam
                    eder.
                  */}
                  {chunk(sec.rows, SUM_ROWS_PER_BLOCK).map((part, bi) => {
                    const mid = Math.ceil(part.length / 2);
                    return (
                      <View key={bi} style={s.sumGrid} wrap={false}>
                        {[part.slice(0, mid), part.slice(mid)].map((col, ci) => (
                          <View key={ci} style={s.sumCol}>
                            {col.map((r, i) => (
                              <View key={i} style={s.sumRow}>
                                <View style={s.sLabel}>
                                  <Text style={s.sLabelText}>{r.label}</Text>
                                  {r.note && <Text style={s.sNote}>{r.note}</Text>}
                                </View>
                                <Text style={s.sVal}>{summaryRowValue(r)}</Text>
                                <Text style={s.sUnit}>{toDisplayUnitLabel(r.unit) ?? ""}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </BrandPage>
      )}

      {/*
        EK — KATALOG SAYFALARI (yalnız detaylı liste).
        YAPRAK YÖNÜ GÖRÜNTÜNÜN KENDİSİNDEN gelir (`image.orientation`). Bir
        süre hepsi dikey basıldı; gerekçe "kaynak taramalar dikeydir" idi ve
        yanlıştı — çok sütunlu boy tabloları yatay basılır ve dikey A4'e
        sığdırılınca okunmaz oluyordu (kullanıcı bildirimi). Ölçüyü sharp
        yapar, karar `catalog-sheet-images.ts`tedir.
        Her katalog sayfası kendi yaprağını alır; listeden gelen iç bağlantı
        ilk yaprağın çapasına düşer.
      */}
      {(sheetPages ?? []).flatMap((sheet) =>
        sheet.images.map((image, i) => (
          <BrandPage
            key={`${sheet.keys[0]}-${i}`}
            docLine={`ORION CRANES · KATALOG SAYFASI · REV ${rev} · ${year}`}
            docCode={code}
            orientation={image.orientation}
          >
            {/* `id` ALANI HİÇ VERİLMEZ — `id={undefined}` AYNI ŞEY DEĞİLDİR:
                @react-pdf `'id' in props` diye bakar ve tanımsız değeri de bir
                hedef sayar, belgeye "undefined" adlı bir adlandırılmış hedef
                yazar (çok yapraklı her katalog sayfası bunu üretiyordu). */}
            <View {...(i === 0 ? { id: anchorId(sheet.keys[0] ?? "") } : {})} style={s.sheetHead}>
              <Text style={T.kicker}>KATALOG SAYFASI</Text>
              <RuleRed />
              <Text style={[s.sheetTitle, { marginTop: 5 }]}>
                {sheet.title} — {sheet.model}
              </Text>
              <Text style={s.sheetMeta}>
                {sheet.source} · {sheet.printedPages}
                {sheet.images.length > 1 ? ` · sayfa ${i + 1}/${sheet.images.length}` : ""}
              </Text>
            </View>
            <Image
              src={image}
              style={[s.sheetImage, { maxHeight: SHEET_MAX_HEIGHT[image.orientation] }]}
            />
          </BrandPage>
        ))
      )}

      {/*
        EK — KULLANICININ YÜKLEDİĞİ BELGELER (yalnız detaylı liste).
        Burada YALNIZ KAPAK vardır; ekin gerçek sayfaları var olan bir PDF'in
        sayfalarıdır ve react-pdf onları okuyamaz. İndirme ucu bu kapağın
        HEMEN ARDINA pdf-lib ile ekler (bkz. `EquipmentAttachmentCover`).
        Kapak sırası listedeki satır sırasıdır — deste, tabloyu izler.
      */}
      {covers.map((cover, i) => (
        <BrandPage
          key={`${cover.rowKey}-${i}`}
          docLine={`ORION CRANES · EK BELGE · REV ${rev} · ${year}`}
          docCode={code}
        >
          {/* Çapa YALNIZ satırın İLK kapağındadır: bir ekipmana iki belge
              yüklenmişse ikisi de aynı adı taşıyıp adlandırılmış hedefi
              ikizlerdi. Listeden gelen bağlantı ilk yaprağa düşer, ikincisi
              onun hemen ardındadır. */}
          <View
            {...(covers.findIndex((c) => c.rowKey === cover.rowKey) === i
              ? { id: attachmentAnchorId(cover.rowKey) }
              : {})}
            style={s.sheetHead}
          >
            <Text style={T.kicker}>EK BELGE</Text>
            <RuleRed />
            <Text style={[s.sheetTitle, { marginTop: 5 }]}>{cover.component}</Text>
            <Text style={s.sheetMeta}>
              {cover.fileName}
              {cover.pageCount > 0 ? ` · ${cover.pageCount} sayfa` : ""}
            </Text>
          </View>
          <Text style={s.hint}>
            Bu sayfadan sonraki {cover.pageCount > 0 ? `${cover.pageCount} sayfa` : "sayfalar"}{" "}
            yukarıdaki ekipmana ait ektir.
          </Text>
        </BrandPage>
      ))}
    </Document>
  );
}

export async function renderEquipmentPdf(props: EquipmentPdfProps): Promise<Buffer> {
  return renderToBuffer(<EquipmentDocument {...props} />);
}
