// PDF hesap raporu — @react-pdf/renderer Document bileşeni.
// Marka Kimliği Kılavuzu REV 01 dili: Archivo gövde, IBM Plex Mono sayı/kod/etiket,
// kırmızı omurga + folio altbilgili BrandPage sayfaları (bkz. brand.tsx).
// İçerik modül adaptörlerinden (module-adapters.ts) üretilir; editör ile
// birebir aynı bölüm/satır/kontrol yapısı PDF'e dökülür.
// Yalnızca sunucuda çalışır (brand.tsx fontları dosya sisteminden okur).

import path from "node:path";
import React from "react";
import {
  Document,
  Font,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { diagramsForSection } from "@/lib/diagrams/select";
import { PdfDiagram } from "@/lib/pdf/diagram";
import {
  BRAND,
  BrandBand,
  BrandPage,
  CheckGlyph,
  FONTS,
  Link,
  PageHeader,
  RuleRed,
  SectionTag,
  T,
} from "@/lib/pdf/brand";
import { docCode } from "@/lib/pdf/doc-naming";
import { PdfMath } from "@/lib/pdf/pdf-math";
import { toDisplayUnit, toDisplayUnitLabel } from "@/lib/units";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import {
  SPEC_FIELDS,
  fieldLabel,
  specFieldVisibleForModules,
  type SpecFieldModuleScope,
} from "@/lib/calc/fields";
import { checkAnchor } from "@/lib/calc/presentation/check-anchors";
import { MODULE_LABELS } from "@/lib/calc/labels";
import {
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
} from "@/lib/calc/presentation/module-family";
import {
  ctxFor,
  moduleResult,
  moduleState,
} from "@/lib/calc/presentation/module-access";
import { checkDisplay, checkKind, checkSeverity } from "@/lib/calc/types";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "@/lib/calc/types";
import {
  altKeyFor,
  sectionNoteKeyFor,
  type RevisionAltState,
  type RevisionAlts,
  type RevisionSectionNotes,
} from "@/lib/revision-load";
import {
  MODULE_ADAPTERS,
  altOptionPass,
  buildModuleDeps,
  headlineItems,
  hiddenSectionCheckIds,
  moduleDisplayNumbers,
  renumberSectionId,
  renumberTitle,
  sectionDisplayNumbers,
  adapterTitle,
  type AdapterHeadline,
  type AdapterSection,
  type AnyFieldDef,
  type HeadlineItem,
  type ModuleAdapter,
  type ModuleDepsBundle,
  type ModuleKey,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

// Logo ve marka bandı `brand.tsx`tedir (BRAND_LOGO / BrandBand): hesap raporu
// kapağı ile ekipman listesinin ilk sayfası aynı bandı paylaşsın diye.

// DejaVu eğik varyantı: pdf-math italik değişken adları için şart — brand.tsx
// aileyi eğiksiz kaydeder; Font.register aynı aileye kaynak EKLER (ezmez).
Font.register({
  family: "DejaVu",
  fonts: [
    {
      src: path.join(process.cwd(), "src", "assets", "fonts", "DejaVuSans-Oblique.ttf"),
      fontStyle: "italic",
    },
  ],
});

// ---------------------------------------------------------------- Tipler

export interface ReportProject {
  doc_no: string;
  name: string;
  customer: string;
  crane_type: string;
}

export interface ReportRevision {
  rev_no: number;
  label: string;
  /** Yayın tarihi; yoksa updated_at kullanılır */
  issued_at?: string | null;
  updated_at?: string | null;
}

/**
 * Rapor seviyesi (kullanıcı kararı, 12.08.2026 — seviyeler içerikçe ayrıştı):
 * - "ozet": kapak + özet bölümü. İçindekiler, kontrol özeti, Ek (Kaynaklar) ve
 *   gizlilik koşulları YOKTUR — iki sayfalık bir belgede dizin ve ek, gösterdiği
 *   içerikten uzun olurdu.
 * - "standart": + modül bölümleri (hesap satırlarında yalnız sonuç) +
 *   diyagramlar + içindekiler + Ek (gizlilik koşullarının KISA metniyle).
 *   Kontrol özeti YOKTUR; satır içi kontroller bölümlerinde durur.
 * - "detayli": tam rapor (formül/değer yerine koyma satırları, kontrol özeti ve
 *   gizlilik koşullarının TAM metni dahil) — varsayılan.
 */
export type ReportLevel = "detayli" | "standart" | "ozet";

export const REPORT_LEVELS: readonly ReportLevel[] = ["detayli", "standart", "ozet"];

export function isReportLevel(v: unknown): v is ReportLevel {
  return REPORT_LEVELS.includes(v as ReportLevel);
}

export interface ReportProps {
  project: ReportProject;
  revision: ReportRevision;
  preparedBy: string;
  checkedBy?: string;
  input: CalcInput;
  result: CalcResult;
  /**
   * Alternatif (seçenekli) ekipman seçimleri — `selections.alts`.
   * `altsFromRevision()` ile okunur. Verilmezse ya da bir bölümde tek seçenek
   * varsa rapor bugünkü hâlini BİREBİR korur: "SEÇENEKLER" bloğu basılmaz.
   */
  alts?: RevisionAlts;
  /** Hesap alt bölümlerine ait, revizyon snapshot'ında saklanan mühendis notları. */
  sectionNotes?: RevisionSectionNotes;
  /**
   * Kullanıcının GİZLEDİĞİ alt bölümler (`inputs.hiddenSections`,
   * `hiddenSectionsFromRevision` ile okunur; anahtar `"trolley-5.7"` biçiminde).
   * Gizlenen bölüm hiç basılmaz; kontrolleri özet sayfasından, Kontrol
   * Özeti'nden ve "Ana Ekipman Seçimleri" bloğundan da düşer.
   */
  hiddenSections?: readonly string[];
  /** Panelden düzenlenebilir rapor ayarları (app_settings 'report') */
  settings?: ReportSettings;
  /** Rapor seviyesi (varsayılan "detayli") */
  level?: ReportLevel;
}

// ---------------------------------------------------------------- Yardımcılar

function fmt(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return v.toLocaleString("tr-TR");
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

/** Girdi/seçim değerleri: sayılar tr-TR, hassasiyet kaybını önlemek için 4 hane */
function fmtField(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return fmt(v, 4);
  return String(v);
}

function reportDate(revision: ReportRevision): Date {
  const iso = revision.issued_at ?? revision.updated_at;
  return iso ? new Date(iso) : new Date();
}

function reportDateLabel(revision: ReportRevision): string {
  return reportDate(revision)
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toLocaleUpperCase("tr-TR");
}

/** Altbilgi doküman satırı: `ORION CRANES · HESAP RAPORU · REV 03 · 2026` */
function docLineFor(revision: ReportRevision): string {
  return `ORION CRANES · ${coverDocLineFor(revision)}`;
}

/**
 * KAPAK altbilgisinin doküman satırı — marka öneki YOKTUR.
 *
 * Kapakta firma künyesi bu satırın hemen üstündedir; "ORION CRANES" ikisinde
 * birden yazınca altbilgi aynı adı iki kez tekrarlıyor ve üç satırlık gri bir
 * yığına dönüşüyordu (kullanıcı bildirimi, 12.08.2026). Diğer sayfalarda künye
 * BASILMAZ, orada marka önekini taşıyan tek şey bu satırdır — bu yüzden önek
 * kaldırılmaz, yalnız kapakta düşürülür.
 */
function coverDocLineFor(revision: ReportRevision): string {
  const rev = String(revision.rev_no).padStart(2, "0");
  return `HESAP RAPORU · REV ${rev} · ${reportDate(revision).getFullYear()}`;
}

/** Doküman kodu: `ORC-HR-412-R03` */
function docCodeFor(project: ReportProject, revision: ReportRevision): string {
  return docCode("HR", project.doc_no, revision.rev_no);
}

// Modül erişimi (girdi durumu / sonuç / sunum bağlamı) ortak katmandan gelir:
// aynı üçlü hem editörde hem burada kullanılır, çoğaltılmaz.

function sectionChecks(
  adapter: ModuleAdapter,
  section: AdapterSection,
  mr: ModuleResult<unknown> | undefined
): AnyCheck[] {
  if (!mr) return [];
  return section.checkSuffixes
    .map((s) => mr.checks.find((c) => c.id === `${adapter.checkPrefix}${s}`))
    .filter((c): c is AnyCheck => Boolean(c));
}

/**
 * Alt bölüm kullanıcı tarafından gizlendi mi (`inputs.hiddenSections`).
 * Anahtar biçimi `sectionHideKeyFor` iledir; ham bölüm id'si kullanılır
 * (köprüde görünen "6.8" değil "5.7").
 */
function isSectionHidden(
  hidden: ReadonlySet<string>,
  key: ModuleKey,
  rawId: string
): boolean {
  return hidden.has(`${key}-${rawId}`);
}

/** Props'tan gizli bölüm kümesi — bütün sayfa üreticileri aynı kümeyi okur. */
function hiddenSetOf(props: Pick<ReportProps, "hiddenSections">): Set<string> {
  return new Set(props.hiddenSections ?? []);
}

/**
 * Bir alt bölüm bu rapora giriyor mu — TEK YÜKLEM.
 *
 * Hem modül sayfasının süzgeci hem alt bölüm numaralarının dayanağı hem de
 * modülün BASILIP BASILMAYACAĞI (`modulePrintedIn`) buradan okur.
 */
function sectionPrintedFor(
  adapter: ModuleAdapter,
  specs: TechnicalSpecs,
  hidden: ReadonlySet<string>
): (section: AdapterSection) => boolean {
  return (section) =>
    (!section.visible || section.visible(specs)) &&
    // Kullanıcının gizlediği alt bölüm rapora hiç girmez; girdileri korunur,
    // kutucuk geri açılınca bölüm aynen döner.
    !isSectionHidden(hidden, adapter.key, section.rawId);
}

/**
 * Modül bu belgede BASILIYOR mu — numaranın, içindekilerin ve sayfa
 * üretiminin ORTAK yüklemi.
 *
 * Üç koşul da gerçektir ve üçü de tek yerde durmalıdır:
 *   1. Girdisi var mı (kapatılan bölüm `calcInput`ten silinir).
 *   2. SONUCU var mı. Girdisi olup sonucu olmayan bölümler gerçektir: köprü
 *      yürütme kapalıyken ana kirişin bağımlılıkları kurulamaz
 *      (`girderDepsFor` `undefined` döner) ve teker yükleri hiç hesaplanmaz.
 *      Yüklem yalnız girdiye baksaydı — eskiden öyleydi — o bölüm NUMARAYI
 *      HARCAR, içindekilerde bir satır açar, ama sayfası basılmazdı: müşteri
 *      belgede atlanmış bir numara ve hiçbir yere gitmeyen bir dizin satırı
 *      görürdü.
 *   3. Basılacak EN AZ BİR alt bölümü var mı. Bütün alt bölümleri gizlenmiş
 *      bir modül, başlığı basılıp altı boş kalan bir sayfa üretiyordu.
 */
function modulePrintedIn(
  props: Pick<ReportProps, "input" | "result" | "hiddenSections">
): (key: ModuleKey) => boolean {
  const hidden = hiddenSetOf(props);
  return (key) => {
    if (moduleState(props.input, key) === undefined) return false;
    if (moduleResult(props.result, key) === undefined) return false;
    const adapter = MODULE_ADAPTERS.find((a) => a.key === key);
    if (!adapter) return false;
    return adapter.sections.some(sectionPrintedFor(adapter, props.input.specs, hidden));
  };
}

/**
 * Bölüm kontrollerini hesap satırlarına dağıtır: bağlantı haritasında karşılığı
 * olanlar ilgili formül satırının altına, kalanlar bölüm sonundaki "Diğer
 * Kontroller" bloğuna gider.
 */
function distributeChecks(
  adapter: ModuleAdapter,
  section: AdapterSection,
  mr: ModuleResult<unknown> | undefined
): { byRow: Map<string, AnyCheck[]>; rest: AnyCheck[] } {
  const byRow = new Map<string, AnyCheck[]>();
  const rest: AnyCheck[] = [];
  const rowIds = new Set(section.rows.map((r) => r.anchorId));
  for (const c of sectionChecks(adapter, section, mr)) {
    const suffix = c.id.startsWith(adapter.checkPrefix)
      ? c.id.slice(adapter.checkPrefix.length)
      : c.id;
    const anchor = checkAnchor(adapter.key, section.rawId, suffix);
    if (anchor && rowIds.has(anchor)) {
      const list = byRow.get(anchor);
      if (list) list.push(c);
      else byRow.set(anchor, [c]);
    } else {
      rest.push(c);
    }
  }
  return { byRow, rest };
}

// ---------------------------------------------------------------- Stiller

const s = StyleSheet.create({
  // ---- kapak
  coverMetaLabel: { ...T.kickerInk, marginBottom: 2 },
  coverMetaValue: { fontFamily: FONTS.sans, fontSize: 9, fontWeight: 700, color: BRAND.ink },
  // Künye satırı (spec bloğu): etiket mono kicker, değer büyük mono
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.line300,
    paddingVertical: 6,
    gap: 10,
  },
  specLabel: { ...T.kickerInk },
  specGloss: { ...T.micro, marginTop: 1.5 },
  specValue: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.2,
    color: BRAND.ink,
    textAlign: "right",
  },
  // ---- içindekiler
  tocRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.line300,
    paddingVertical: 7,
    gap: 10,
  },
  tocLink: { textDecoration: "none", color: BRAND.ink },
  tocNo: { width: 30, fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: BRAND.red },
  tocTitle: { fontFamily: FONTS.sans, fontSize: 9.5, fontWeight: 700, color: BRAND.ink, maxWidth: 300 },
  // Başlık ile sayfa numarası arasını dolduran ince ayraç (metin değil ki sarmasın)
  tocDots: {
    flexGrow: 1,
    height: 1,
    marginHorizontal: 6,
    marginBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND.line300,
    borderBottomStyle: "dotted",
  },
  tocPage: { fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: BRAND.gray700 },
  // ---- etiket-değer tabloları (girdi/seçim/özet)
  kvGrid: { flexDirection: "row", gap: 14 },
  kvCol: { flex: 1, flexShrink: 0 },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingVertical: 2.4,
    // Satır ASLA sıkışmaz: sayfa dibinde yer kalmadığında react-pdf satırları
    // ezip üst üste bindiriyordu ("Fren Markası / Fren Modeli / Fren Torku"
    // tek satıra çöküyordu). Bölme kararı kvGrid'in wrap={false}'ında verilir.
    flexShrink: 0,
    gap: 6,
  },
  kvLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 7.6, color: BRAND.gray700 },
  // Katalog seçimi satırı: etiket de mono (seçim rolü, girdiden ayrışır)
  kvLabelMono: { flex: 1, fontFamily: FONTS.mono, fontSize: 7, color: BRAND.gray600 },
  // "Tambur kaplini" tek satıra sığacak genişlik (7,6pt Archivo ≈ 50pt).
  // DİKKAT: `flex: 0` YAZILMAZ — react-pdf bunu flexBasis:0'a açıyor ve
  // flexBasis ana eksende `width`i eziyor; etiket yine iki satıra kırılıyordu.
  kvLabelNarrow: { flexGrow: 0, flexShrink: 0, flexBasis: 53, width: 53 },
  kvValue: {
    fontFamily: FONTS.mono,
    fontSize: 7.6,
    fontWeight: 500,
    letterSpacing: 0.2,
    color: BRAND.ink,
    textAlign: "right",
    // Değer sütunu da PAY ALIR (yalnız flexShrink yetmiyor: react-pdf'te
    // genişliği verilmemiş Text doğal genişliğinin altına inmez). Böylece uzun
    // seçenek metni sarar; eskiden sütunu taşıp etiketin üzerine biniyordu
    // (ör. "Teker Çifti Düzeni" ↔ "CFF — Bağlı teker çifti, iki taraf da …").
    flex: 1,
  },
  // En uzun katalog dizesi ("SİBRE FLEXİBLE KAPLİN ALC A 90 · 3.600 Nm",
  // 41 karakter) iki sütunlu özet ızgarasında tek satırda kalsın diye küçültülür.
  kvValueWide: { flexGrow: 1, flexShrink: 1, flexBasis: 0, fontSize: 6.7, letterSpacing: 0.15 },
  kvUnit: { fontFamily: FONTS.mono, fontSize: 6.8, fontWeight: 400, color: BRAND.gray500 },
  // ---- hesap satırları
  // Anatomi: solda mono ADIM NUMARASI şeridi, ortada etiket + formül,
  // sağda kutulanmış SONUÇ. Satıra bağlı kontrol varsa sol şerit yeşil/kırmızı
  // renklenir — rapor sayfası tarandığında uygunsuz adım hemen görünür.
  calcRow: {
    flexDirection: "row",
    backgroundColor: BRAND.paper100,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.line300,
    borderLeftWidth: 2.5,
    borderLeftColor: BRAND.line350,
    paddingVertical: 2.2,
    paddingRight: 5,
  },
  // Adım numarası şeridi: "10.2.3.14" (9 hane) SIĞACAK kadar geniş olmalı —
  // dar kalırsa numara etiketin üzerine taşar ("2.2.1.05Eğilme Gerilmesi").
  calcStep: {
    width: 46,
    flexShrink: 0,
    fontFamily: FONTS.mono,
    fontSize: 6.4,
    fontWeight: 600,
    letterSpacing: 0.2,
    color: BRAND.gray500,
    paddingLeft: 5,
    paddingRight: 3,
    paddingTop: 0.8,
  },
  calcBody: { flex: 1 },
  calcTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  // Sonuç kutusu: beyaz zemin + ince çerçeve, değer kalın mono
  calcResult: {
    flexDirection: "row",
    alignItems: "baseline",
    flexShrink: 0,
    backgroundColor: BRAND.white,
    borderWidth: 0.5,
    borderColor: BRAND.line350,
    paddingVertical: 1.4,
    paddingHorizontal: 4,
  },
  // Birim değerden BOŞLUKLA ayrılır. Metin içindeki " " karakteri satır
  // başı/sonu kırpmasına takılıp yok oluyor ("4.000kg"); marj kaybolmaz.
  calcUnit: { fontFamily: FONTS.mono, fontSize: 6.6, fontWeight: 400, color: BRAND.gray500, marginLeft: 2.5 },
  // Bölüm özet tablosu (ör. ana kiriş gerilme tablosu)
  tblHeadRow: { flexDirection: "row", backgroundColor: BRAND.paper100, borderBottomWidth: 0.6, borderBottomColor: BRAND.gray500 },
  tblRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: BRAND.line300 },
  tblHeadCell: { fontFamily: FONTS.mono, fontSize: 6.2, fontWeight: 700, color: BRAND.gray700, paddingVertical: 3, paddingHorizontal: 4.5, lineHeight: 1.25 },
  tblCell: { fontFamily: FONTS.sans, fontSize: 6.8, color: BRAND.ink, paddingVertical: 2.4, paddingHorizontal: 4.5, lineHeight: 1.25 },
  tblCellNum: { fontFamily: FONTS.mono, fontSize: 6.8, color: BRAND.ink, paddingVertical: 2.4, paddingHorizontal: 4.5, lineHeight: 1.25, textAlign: "right" },
  tblAlignRight: { textAlign: "right" },
  tblNote: { fontFamily: FONTS.sans, fontSize: 6.2, lineHeight: 1.4, color: BRAND.gray500, marginTop: 4 },
  calcLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 7.8, fontWeight: 500, color: BRAND.ink },
  calcEq: { fontFamily: FONTS.mono, fontSize: 7.2, color: BRAND.gray450 },
  calcValue: {
    fontFamily: FONTS.mono,
    fontSize: 8.4,
    fontWeight: 600,
    letterSpacing: 0.2,
    color: BRAND.ink,
  },
  // Formül satırı DejaVu kalır: pdf-math italik değişkenler + √ gibi glifler
  // Archivo'da yok; fontFamily sarmalayıcıdan miras yoluyla PdfMath'e iner.
  calcFormula: { marginTop: 1.5, fontFamily: FONTS.glyph },
  calcMeta: { fontFamily: FONTS.mono, fontSize: 6, color: BRAND.gray500, marginTop: 1 },
  // ---- kontroller (düz satır: hairline, yalnız ✗ kırmızı)
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingVertical: 3,
    gap: 6,
  },
  checkLabel: { fontFamily: FONTS.sans, fontSize: 7.6, color: BRAND.ink },
  checkDetail: { fontFamily: FONTS.mono, fontSize: 6.4, color: BRAND.gray600, marginTop: 1 },
  checkBadge: { fontFamily: FONTS.mono, fontSize: 7, fontWeight: 600, letterSpacing: 0.6 },
  // ---- formül satırının altına iliştirilen kontrol şeridi
  inlineCheck: {
    marginTop: 2,
    paddingLeft: 5,
    paddingVertical: 1.6,
    paddingRight: 4,
    borderLeftWidth: 1.8,
  },
  inlineCheckTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  inlineCheckVerdict: { fontFamily: FONTS.mono, fontSize: 6.6, fontWeight: 700, letterSpacing: 0.4 },
  inlineCheckText: { fontFamily: FONTS.sans, fontSize: 6.9, color: BRAND.ink },
  // ---- "Hesaplanan X ≤ İzin Verilen Y" karşılaştırma şeridi
  cmp: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", marginTop: 1 },
  cmpLabel: { fontFamily: FONTS.mono, fontSize: 6.2, letterSpacing: 0.3, color: BRAND.gray500 },
  cmpValue: { fontFamily: FONTS.mono, fontSize: 7.4, fontWeight: 600, color: BRAND.ink },
  cmpUnit: { fontFamily: FONTS.mono, fontSize: 6.2, fontWeight: 400, color: BRAND.gray500 },
  /** Bağıntı işareti (≤ / ≥) — DejaVu, çünkü Plex Mono bu glifleri taşımaz */
  cmpOp: { fontFamily: FONTS.glyph, fontSize: 8, color: BRAND.gray600 },
  /** Karşılaştırma şeridi parçaları arası boşluk — boşluk karakteri kırpılıyor */
  cmpGap: { marginLeft: 3.5 },
  // ---- başlık kontrolü şeridi (girdiler ↔ katalog seçimi arası özet)
  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderLeftWidth: 1.8,
    paddingLeft: 5,
    paddingRight: 4,
    paddingVertical: 2,
    marginBottom: 1.5,
  },
  headlineLabel: {
    fontFamily: FONTS.sans,
    fontSize: 7.2,
    fontWeight: 600,
    color: BRAND.ink,
    width: 62,
    flexShrink: 0,
  },
  // ---- alternatif (seçenekli) ekipman satırı — "SEÇENEKLER" bloğu
  // Anatomi: solda renkli kenar + mono seçenek etiketi, sonra uygunluk rozeti,
  // sağda alternatifleri birbirinden AYIRAN büyüklükler. Aktif seçenek kağıt
  // zeminli ve "◆ SEÇİLEN" etiketlidir.
  altRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderLeftWidth: 1.8,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingLeft: 5,
    paddingRight: 4,
    paddingVertical: 2.4,
    gap: 5,
  },
  altNo: {
    fontFamily: FONTS.mono,
    fontSize: 6.6,
    fontWeight: 700,
    letterSpacing: 0.4,
    width: 74,
    flexShrink: 0,
  },
  altVerdict: {
    fontFamily: FONTS.mono,
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: 0.4,
    width: 48,
    flexShrink: 0,
  },
  altFields: { flex: 1, fontFamily: FONTS.mono, fontSize: 6.9, color: BRAND.ink },
  altFieldLabel: { fontFamily: FONTS.sans, fontSize: 6.4, fontWeight: 500, color: BRAND.gray600 },
  // ---- kontrol özeti (belge sonu): sol sütun sayfa no, sağda sonuç
  chkPage: {
    width: 22,
    flexShrink: 0,
    fontFamily: FONTS.mono,
    fontSize: 7.4,
    fontWeight: 600,
    color: BRAND.gray600,
    textDecoration: "none",
  },
  chkLead: { ...T.caption, marginBottom: 2 },
  // ---- özet kontrol tablosu
  sumModule: { marginTop: 6 },
  sumModuleTitle: { fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700, color: BRAND.ink, marginBottom: 1.5 },
});

// ---------------------------------------------------------------- Alt bileşenler

/**
 * Alt başlık bandı: mono etiket, hairline altı.
 *
 * `minPresenceAhead` alt başlığın sayfa dibinde tek başına kalmasını engeller —
 * altında en az birkaç satır sığmıyorsa başlık bir sonraki sayfaya taşınır.
 *
 * DİKKAT — bu koruma başlık bir sarmalayıcının İLK ÇOCUĞU olduğunda ÇALIŞMAZ:
 * @react-pdf/layout `shouldBreak` içinde `breakingImprovesPresence` bayrağını
 * "aynı ebeveynde bu düğümden ÖNCE yerleşmiş kardeş var mı" diye sorar; yoksa
 * sayfa bölme işe yaramaz sayılır ve minPresenceAhead sessizce yok sayılır.
 * Bu yüzden başlıklar `<View>` kutularına sarılmaz, bölüm parçaları düz bir
 * kardeş dizisi (Fragment) olarak akar. Bkz. ModulePage.
 */
function SubHead({ tr, minPresenceAhead = 52 }: { tr: string; minPresenceAhead?: number }) {
  return (
    <View
      minPresenceAhead={minPresenceAhead}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        borderBottomWidth: 0.75,
        borderBottomColor: BRAND.line300,
        paddingBottom: 2,
        marginTop: 8,
        marginBottom: 3,
      }}
    >
      <Text style={T.kickerInk}>{tr}</Text>
    </View>
  );
}

function KvRow({
  label,
  value,
  unit,
  labelMono,
  narrowLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  labelMono?: boolean;
  /**
   * Özet ekipman satırları: etiket kısa ("Motor"), değer uzun ("GAMAK 55 kW …").
   * Etiket sabit dar kalır, sarma değere düşer — aksi hâlde "Teker kaplini"
   * iki satıra bölünüyor, değer ise tek satıra sıkışıyordu.
   */
  narrowLabel?: boolean;
}) {
  const labelStyle = labelMono ? s.kvLabelMono : s.kvLabel;
  return (
    <View style={s.kvRow} wrap={false}>
      <Text style={narrowLabel ? [labelStyle, s.kvLabelNarrow] : labelStyle}>{label}</Text>
      <Text style={narrowLabel ? [s.kvValue, s.kvValueWide] : s.kvValue}>
        {value}
        {unit ? <Text style={s.kvUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** PDF özetinde teknik anlam taşımayan "Yok" / boş seçimleri basma. */
function isAbsentSummarySpec(f: AnyFieldDef, specs: TechnicalSpecs): boolean {
  const raw = (specs as unknown as Record<string, unknown>)[f.key];
  const normalized = typeof raw === "string" ? raw.trim().toLocaleLowerCase("tr-TR") : "";
  if (
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && (normalized === "" || normalized === "yok" || normalized === "none" || normalized === "no"))
  ) {
    return true;
  }
  const label = f.optionLabels?.[String(raw)];
  return label === "Yok";
}

/** Özet PDF'deki teknik özellik alanlarının görünürlük ve sıralama kuralları. */
export function specFieldsFor(input: CalcInput): AnyFieldDef[] {
  // Bölüm bağı EDİTÖRLE ORTAK yüklemden okunur (`specFieldVisibleForModules`):
  // alanın kendi `requiresModule`u, ait olduğu GRUBUN bağı ve bir girdiyi
  // paylaşan bölümler (`requiresAnyModule`, ör. Köprü Ağırlığı) hep orada
  // çözülür. Ayrı yazıldıkları sürece kapatılan köprünün alanları ekrandan
  // düşüyor ama rapora basılmaya devam ediyordu.
  const present = (k: ModuleKey) => moduleState(input, k) !== undefined;
  const fields = (SPEC_FIELDS as AnyFieldDef[]).filter((f) => {
    const visibleForModule = specFieldVisibleForModules(f as SpecFieldModuleScope, present);
    const visibleInReport =
      f.key !== "trolleyBufferImpactSpeedPct" &&
      f.key !== "bridgeBufferImpactSpeedPct";
    const visibleForSpecs = !(f as { visible?: (specs: TechnicalSpecs) => boolean }).visible ||
      (f as { visible?: (specs: TechnicalSpecs) => boolean }).visible!(input.specs);
    return visibleForModule && visibleInReport && visibleForSpecs && !isAbsentSummarySpec(f, input.specs);
  });

  // Özet sayfasının ilk teknik bilgisi her zaman ana kaldırma kapasitesidir.
  const mainCapacity = fields.find((f) => f.key === "mainCapacityT");
  return mainCapacity
    ? [mainCapacity, ...fields.filter((f) => f !== mainCapacity)]
    : fields;
}

/**
 * Özet teknik tabloya yalnız raporda görünen toplam ağırlık satırlarını ekler.
 * Toplam, bu tabloda AYRI AYRI GÖRÜNEN ağırlık satırlarının toplamıdır;
 * kapasite (kaldırılan yük) dahil edilmez.
 *
 * TOPLAM BASILAN SATIRLARDAN TÜRETİLİR, teknik özelliklerin tamamından değil
 * (kullanıcı kararı, 19.08.2026 — yalnız araba raporu). Köprü ağırlığı
 * tablodan düştüğü hâlde toplama girseydi, müşteri "ana araba + kanca ≠
 * toplam" farkından basılmayan bir kalem olduğunu çıkarırdı; gizleme,
 * aritmetikten sızarak kendini ele verirdi. Aynı sebeple satırın ADI da
 * kapsamla birlikte değişir: köprüsüz bir belgede "Vinç Toplam Ağırlığı"
 * olmayan bir vinci ölçer.
 */
export function summarySpecsForReport(input: CalcInput): {
  defs: AnyFieldDef[];
  source: Record<string, unknown>;
} {
  const source: Record<string, unknown> = { ...input.specs };
  const defs = specFieldsFor(input);
  const printed = (key: string) => defs.some((f) => f.key === key);

  const attachmentWeightT = Math.max(0, (input.mainHoist?.inputs.hookBlockWeightKg ?? 0) / 1000);
  const bridgePrinted = printed("bridgeWeightT");
  const craneTotalWeightT =
    Math.max(0, input.specs.mainTrolleyWeightT ?? 0) +
    (bridgePrinted ? Math.max(0, input.specs.bridgeWeightT ?? 0) : 0) +
    attachmentWeightT;
  source.summaryAttachmentWeightT = attachmentWeightT;
  source.summaryCraneTotalWeightT = craneTotalWeightT;

  const attachmentIsGrab = input.specs.hookType.toLocaleLowerCase("tr-TR").includes("kepçe");
  const extra: AnyFieldDef[] = [
    {
      key: "summaryAttachmentWeightT",
      label: attachmentIsGrab ? "Kepçe Ağırlığı" : "Kanca Bloğu Ağırlığı",
      unit: "t",
      type: "number",
    },
    {
      key: "summaryCraneTotalWeightT",
      label: bridgePrinted ? "Vinç Toplam Ağırlığı" : "Toplam Ağırlık",
      unit: "t",
      type: "number",
    },
  ];

  // Yerleşim çapası: iki ek satır ağırlık öbeğinin SONUNA girer. Çapa bir tek
  // alana bağlanamaz — köprü ağırlığı basılmıyorsa öbeğin son satırı ana araba
  // (ya da monoray arabası) olur; tek çapaya güvenmek satırları tablonun en
  // dibine, sınıflandırma alanlarının arkasına düşürüyordu.
  const lastWeightIndex = defs.reduce(
    (last, f, i) => (f.group === "weights" ? i : last),
    -1
  );
  const afterWeights = lastWeightIndex >= 0 ? lastWeightIndex + 1 : defs.length;
  defs.splice(afterWeights, 0, ...extra);
  return { defs, source };
}

/**
 * Bir alanın rapora basılan değeri (birimsiz).
 *
 * Seçenek etiketi varsa o kullanılır (ham kod değil), çap alanlarında değerin
 * başına "Ø" konur (madde 30 — boş değere konmaz). Alan tablosu ve alternatif
 * ("SEÇENEKLER") bloğu aynı biçimlemeyi paylaşsın diye ayrı fonksiyondur.
 */
/**
 * Alanın BASILAN değeri.
 *
 * DIŞA AÇIKTIR çünkü İşletme ve Bakım El Kitabı'nın otomatik tabloları da
 * teknik özellikleri BU biçimleyiciyle basar (`manual/sources-data.ts`).
 * İkinci bir biçimleyici yazılsaydı hesap raporundaki "Ø400 mm" el kitabında
 * "400" olur ve iki belge aynı vinç için başka şey söylerdi.
 */
export function fieldShownValue(f: AnyFieldDef, rec: Record<string, unknown>): string {
  const labels = (f as { optionLabels?: Record<string, string> }).optionLabels;
  const val = labels?.[String(rec[f.key])] ?? fmtField(rec[f.key]);
  return f.diameter && val !== "—" ? `Ø${val}` : val;
}

/**
 * Alan listesini iki sütuna bölerek etiket-değer tablosu basar.
 *
 * DIŞA AÇIKTIR çünkü EKİPMAN LİSTESİ PDF'i de ilk yaprağına AYNI teknik
 * özellik tablosunu basar (kullanıcı isteği, 19.08.2026: ressamın eline giden
 * belgenin ilk sayfası hesap raporundaki özet tablonun kendisi olsun). Aynı
 * tabloyu ikinci kez yazmak, iki belgenin bir gün farklı alan basmasıyla
 * biterdi; ressam hangisinin güncel olduğunu bilemezdi.
 */
export function FieldTable({
  defs,
  source,
  labelMono,
  specs,
}: {
  defs: AnyFieldDef[];
  source: object;
  /** Katalog seçimi tabloları: etiketler de mono (seçim rolü) */
  labelMono?: boolean;
  /** Teknik özelliklere göre değişen etiketleri (kanca/tutucu tipi) çözmek için */
  specs?: TechnicalSpecs;
}) {
  const rec = source as Record<string, unknown>;
  // HER ZAMAN iki sütun — tek sütunda etiket ile değer sayfanın iki ucuna
  // düşüyor ("Tambur Çapı .......................... 400 mm") ve okunmuyor.
  // Tek alan kalırsa sağdaki sütun boş bırakılır; hizalama bozulmaz.
  const mid = Math.ceil(defs.length / 2);
  const cols = [defs.slice(0, mid), defs.slice(mid)];
  return (
    // wrap={false}: satır yönlü flex kap sayfaya BÖLÜNEMEZ. Bölünmeye
    // zorlanınca react-pdf içerideki satırları ezip üst üste bindiriyor ve
    // altbilginin üzerine taşıyordu. Sığmıyorsa tablo bütün hâlde sonraki
    // sayfaya geçer (en büyük alan tablosu bile yarım sayfadan kısadır).
    <View style={s.kvGrid} wrap={false}>
      {cols.map((col, i) => (
        <View style={s.kvCol} key={i}>
          {col.map((f) => {
            // Madde 30: çap alanlarında değerin başına "Ø" konur (boş değere değil)
            const shown = fieldShownValue(f, rec);
            return (
              <KvRow
                key={f.key}
                label={fieldLabel(f, specs)}
                value={shown}
                unit={toDisplayUnitLabel(f.unit)}
                labelMono={labelMono}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Kontrolün dayanağı/ağırlığı — yalnız "standart + engelleyici" varsayılanının
 * dışındaki kontrollerde basılır.
 */
function checkOriginText(check: AnyCheck): string {
  const kind = checkKind(check);
  const severity = checkSeverity(check);
  const labels: Record<string, string> = {
    standart: "standart",
    uretici: "üretici",
    firma: "firma kabulü",
    bilgi: "bilgilendirme",
  };
  const parts: string[] = [];
  if (kind !== "standart") parts.push(labels[kind]);
  if (severity === "uyari") parts.push("uyarı");
  return parts.join(" · ");
}

/**
 * Kontrolün karşılaştırma şeridi:
 *
 *     HESAPLANAN  616,4 MPa   ≤   İZİN VERİLEN  2.450,0 MPa
 *
 * Hesaplanan değer KALIN ve kontrolün sonucuna göre renklidir (uygunsa yeşil,
 * değilse kırmızı); sınır değer nötr kalır. Hangi sayının hesaptan çıktığı
 * `checkDisplay` ile belirlenir — kontrolden kontrole değişir, tahmin edilmez.
 */
function CheckComparison({ check }: { check: AnyCheck }) {
  const d = checkDisplay(check);
  const color = check.pass ? BRAND.success : BRAND.red;
  const conv = (v: number) => toDisplayUnit(v, d.unit);
  const computed = conv(d.computed);
  const unit = computed.unit === "-" || !computed.unit ? "" : ` ${computed.unit}`;
  const limitText =
    d.operator === "…"
      ? `${fmt(conv(d.min ?? 0).value)} … ${fmt(conv(d.max ?? 0).value)}`
      : fmt(conv(d.limit ?? 0).value);
  // Parçalar arası boşluk MARJLA verilir. Kardeş <Text>'lerin baştaki boşluk
  // karakteri dizgide kırpılıyor ve bağıntı işareti birime yapışıyordu
  // ("40,71 kN≤ İZİN VERİLEN"); marj kırpılmaz.
  return (
    <View style={s.cmp}>
      <Text style={s.cmpLabel}>HESAPLANAN</Text>
      <Text style={[s.cmpValue, s.cmpGap, { color }]}>
        {fmt(computed.value)}
        {unit ? <Text style={s.cmpUnit}>{unit}</Text> : null}
      </Text>
      {d.operator === "…" ? null : <Text style={[s.cmpOp, s.cmpGap]}>{d.operator}</Text>}
      <Text style={[s.cmpLabel, s.cmpGap]}>İZİN VERİLEN</Text>
      <Text style={[s.cmpValue, s.cmpGap]}>
        {limitText}
        {unit ? <Text style={s.cmpUnit}>{unit}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * Formül satırının hemen altına iliştirilen kontrol şeridi. Kontroller
 * bölüm sonunda toplu değil, ilgili hesabın yanında görünür — hangi formülün
 * hangi kontrole karşılık geldiği tek bakışta okunur.
 */
function InlineCheckLine({ check }: { check: AnyCheck }) {
  const color = check.pass ? BRAND.success : BRAND.red;
  return (
    <View
      style={[
        s.inlineCheck,
        { borderLeftColor: color, backgroundColor: check.pass ? BRAND.white : "#FBF2F1" },
      ]}
      wrap={false}
    >
      <View style={s.inlineCheckTop}>
        <CheckGlyph pass={check.pass} size={7} />
        <Text style={[s.inlineCheckVerdict, { color }]}>
          {check.pass ? "UYGUN" : "UYGUN DEĞİL"}
        </Text>
        <Text style={s.inlineCheckText}>{check.label}</Text>
        {check.standard ? (
          <Text style={{ ...T.micro, color: BRAND.gray450 }}>{check.standard}</Text>
        ) : null}
      </View>
      <CheckComparison check={check} />
    </View>
  );
}

/**
 * BAŞLIK KONTROLÜ şeridi — girdiler ile katalog seçimi arasında duran özet
 * (madde 7). Editördeki şeridin PDF karşılığıdır; bölümün ayrıntılı hesap
 * satırları aşağıda AYNEN kalır, bu şerit yalnız kararı hızlandıran tekrardır.
 *
 * Sayılar ve renk kontrolün kendi `pass` değerinden gelir; eşik burada
 * hesaplanmaz. Etiketler bölüm tanımından okunur ("Oluşan / İzin verilen",
 * "Gerçekleşen / Gereken").
 */
function HeadlineLine({
  item,
  headline,
}: {
  item: HeadlineItem;
  headline: AdapterHeadline;
}) {
  const { check, label } = item;
  const d = checkDisplay(check);
  const color = check.pass ? BRAND.success : BRAND.red;
  const conv = (v: number) => toDisplayUnit(v, d.unit);
  const computed = conv(d.computed);
  const unit = computed.unit === "-" || !computed.unit ? "" : ` ${computed.unit}`;
  const limitText =
    d.operator === "…"
      ? `${fmt(conv(d.min ?? 0).value)} … ${fmt(conv(d.max ?? 0).value)}`
      : fmt(conv(d.limit ?? 0).value);
  return (
    <View
      style={[
        s.headlineRow,
        { borderLeftColor: color, backgroundColor: check.pass ? BRAND.white : "#FBF2F1" },
      ]}
      wrap={false}
    >
      <CheckGlyph pass={check.pass} size={7} />
      <Text style={s.headlineLabel}>{label}</Text>
      <Text style={s.cmpLabel}>{headline.computedLabel.toLocaleUpperCase("tr-TR")}</Text>
      <Text style={[s.cmpValue, s.cmpGap, { color }]}>
        {fmt(computed.value)}
        {unit ? <Text style={s.cmpUnit}>{unit}</Text> : null}
      </Text>
      {d.operator === "…" ? null : <Text style={[s.cmpOp, s.cmpGap]}>{d.operator}</Text>}
      <Text style={[s.cmpLabel, s.cmpGap]}>
        {headline.limitLabel.toLocaleUpperCase("tr-TR")}
      </Text>
      <Text style={[s.cmpValue, s.cmpGap]}>
        {limitText}
        {unit ? <Text style={s.cmpUnit}>{unit}</Text> : null}
      </Text>
    </View>
  );
}

function CheckLine({ check }: { check: AnyCheck }) {
  return (
    <View style={s.checkRow} wrap={false}>
      <CheckGlyph pass={check.pass} size={8} />
      <View style={{ flex: 1 }}>
        <Text style={s.checkLabel}>
          {check.label}
          {checkOriginText(check) ? (
            <Text style={{ color: BRAND.gray500 }}> ({checkOriginText(check)})</Text>
          ) : null}
          {check.standard ? (
            <Text style={{ ...T.micro, color: BRAND.gray450 }}> · {check.standard}</Text>
          ) : null}
        </Text>
        <CheckComparison check={check} />
      </View>
      {/* Marka: yalnız ✗/uygunsuz kırmızı; uygun durum nötr kalır */}
      <Text style={[s.checkBadge, { color: check.pass ? BRAND.gray700 : BRAND.red }]}>
        {check.pass ? "UYGUN" : "UYGUN DEĞİL"}
      </Text>
    </View>
  );
}

// ------------------------------------------- Alternatifler ("SEÇENEKLER")

/** Bir bölümde en çok kaç ayırt edici alan basılır (satır tek satırda kalsın) */
const ALT_FIELD_LIMIT = 6;

/**
 * Alternatifleri birbirinden AYIRAN seçim alanları.
 *
 * Bütün seçim alanlarını her seçenek için tekrar basmak sayfayı doldurur ve
 * kararı kolaylaştırmaz; okuyucunun aradığı, seçenekler arasında NEYİN
 * değiştiğidir. Bu yüzden değeri seçenekten seçeneğe DEĞİŞEN alanlar seçilir.
 * Kimlik alanları (bölümün ilk iki seçim alanı — tipik olarak marka/model)
 * değişmese bile taşınır: "Ø22 mm" tek başına hangi ürün olduğunu söylemez.
 */
function altDistinguishingDefs(
  section: AdapterSection,
  options: readonly Record<string, unknown>[]
): AnyFieldDef[] {
  const defs = section.selectionDefs;
  const identity = new Set(defs.slice(0, 2).map((f) => f.key));
  const differs = (f: AnyFieldDef) => {
    const first = JSON.stringify(options[0]?.[f.key] ?? null);
    return options.some((o) => JSON.stringify(o?.[f.key] ?? null) !== first);
  };
  const picked = defs.filter((f) => identity.has(f.key) || differs(f));
  return (picked.length > 0 ? picked : defs).slice(0, ALT_FIELD_LIMIT);
}

/**
 * Tek bir alternatif seçeneğin satırı.
 *
 * Uygunluk (`pass`) BURADA hesaplanmaz: editördeki rozetle aynı saf yardımcı
 * (`altOptionPass`) çağrılır. `null` = bölümde kontrol yok ya da hesap bu
 * seçimle koşamıyor — uydurma bir "uygun" basmaktansa bilinmez bırakılır.
 */
function AltOptionLine({
  index,
  active,
  pass,
  defs,
  option,
  fallback,
  specs,
}: {
  index: number;
  active: boolean;
  pass: boolean | null;
  defs: AnyFieldDef[];
  option: Record<string, unknown>;
  /** Seçenekte olmayan alanın değeri modülün canlı seçimlerinden okunur */
  fallback: Record<string, unknown>;
  specs: TechnicalSpecs;
}) {
  const color = pass === true ? BRAND.success : pass === false ? BRAND.red : BRAND.gray450;
  const rec: Record<string, unknown> = { ...fallback, ...option };
  return (
    <View
      style={[
        s.altRow,
        {
          borderLeftColor: color,
          backgroundColor: active ? BRAND.paper100 : BRAND.white,
        },
      ]}
      wrap={false}
    >
      <Text style={[s.altNo, { color: active ? BRAND.ink : BRAND.gray600 }]}>
        {active ? `◆ SEÇENEK ${index + 1}` : `SEÇENEK ${index + 1}`}
      </Text>
      <Text style={[s.altVerdict, { color }]}>
        {pass === true ? "UYGUN" : pass === false ? "UYGUN DEĞİL" : "—"}
      </Text>
      {/* Alanlar TEK bir Text içinde iç içe akar: kardeş <Text>'lerde baştaki
          boşluk dizgide kırpılıp etiket değere yapışıyordu (bkz. CheckComparison). */}
      <Text style={s.altFields}>
        {defs.map((f, i) => (
          <React.Fragment key={f.key}>
            <Text style={s.altFieldLabel}>
              {`${i > 0 ? "   ·   " : ""}${fieldLabel(f, specs)} `}
            </Text>
            <Text>
              {fieldShownValue(f, rec)}
              {toDisplayUnitLabel(f.unit) ? (
                <Text style={s.kvUnit}> {toDisplayUnitLabel(f.unit)}</Text>
              ) : null}
            </Text>
          </React.Fragment>
        ))}
      </Text>
    </View>
  );
}

/**
 * Bölümün "SEÇENEKLER" bloğu parçaları — KATALOG SEÇİMİ tablosunun ALTINA
 * girer. Alternatifi olmayan (tek seçenekli) bölümde BOŞ dizi döner ve rapor
 * bugünkü çıktısını birebir korur.
 */
export function altOptionNodes(
  key: ModuleKey,
  section: AdapterSection,
  state: { inputs: object; selections: object },
  alt: RevisionAltState | undefined,
  specs: TechnicalSpecs,
  deps: ModuleDepsBundle
): React.ReactNode[] {
  if (!alt || alt.options.length < 2 || section.selectionDefs.length === 0) return [];
  const fallback = state.selections as Record<string, unknown>;
  // AKTİF seçenek, saklanan kopyasından DEĞİL modülün CANLI seçimlerinden
  // okunur: rapor hesaplarını onlarla yaptı. Kayıtlı kopya bayatsa (eski bir
  // revizyon, elle düzeltilmiş bir seçim) "◆ Seçilen" satırı KATALOG SEÇİMİ
  // tablosundan farklı sayı gösterir ve rapor kendi kendisiyle çelişirdi.
  const options = alt.options.map((option, i) => {
    if (i !== alt.active) return option;
    const live: Record<string, unknown> = {};
    for (const key of section.selectionKeys) live[key] = fallback[key];
    return live;
  });
  const defs = altDistinguishingDefs(section, options);
  return options.map((option, i) => (
    <AltOptionLine
      key={i}
      index={i}
      active={i === alt.active}
      pass={altOptionPass(key, section, specs, state.inputs, state.selections, option, deps)}
      defs={defs}
      option={option}
      fallback={fallback}
      specs={specs}
    />
  ));
}

// ---------------------------------------------------------------- Kapak

/** Ana kaldırma mekanizması için FEM grubu ve ISO sınıfı eşlemesi. */
const FEM_GROUP_BY_ISO_CLASS: Record<string, string> = {
  M1: "1Bm", M2: "1Bm", M3: "1Am", M4: "2m",
  M5: "2m", M6: "3m", M7: "4m", M8: "5m",
};

/** Kapak künyesi: kılavuz spec sırası — kapasite → açıklık → kaldırma yüksekliği → sınıflar */
function coverSpecs(input: CalcInput): { label: string; value: string }[] {
  const sp = input.specs;
  const out: { label: string; value: string }[] = [];
  if (Number.isFinite(sp.mainCapacityT)) {
    const aux = input.auxHoist && Number.isFinite(sp.auxCapacityT) ? ` / ${fmt(sp.auxCapacityT)} t` : "";
    out.push({ label: "KAPASİTE", value: `${fmt(sp.mainCapacityT)} t${aux}` });
  }
  if (Number.isFinite(sp.spanM))
    out.push({ label: "AÇIKLIK", value: `${fmt(sp.spanM)} m` });
  if (Number.isFinite(sp.mainLiftHeightM))
    out.push({ label: "KALDIRMA YÜKSEKLİĞİ", value: `${fmt(sp.mainLiftHeightM)} m` });
  const femGroup = FEM_GROUP_BY_ISO_CLASS[sp.hoistMechanismClass] ?? "—";
  if (sp.hoistMechanismClass) {
    out.push({ label: "FEM SINIFI", value: `FEM ${femGroup} / ISO ${sp.hoistMechanismClass}` });
  }
  const loadGroup = sp.hoistLoadClass.split("/").map((part) => part.trim()).find((part) => /^B[1-6]$/.test(part));
  if (loadGroup) out.push({ label: "YÜK GRUBU", value: loadGroup });
  if (sp.structureClass) out.push({ label: "ÇELİK KONSTRÜKSİYON SINIFI", value: sp.structureClass });
  if (sp.hookType) out.push({ label: "KANCA TİPİ", value: sp.hookType });
  return out;
}

function CoverPage(props: ReportProps) {
  const { project, revision, preparedBy, checkedBy, input } = props;
  const st = { ...DEFAULT_REPORT_SETTINGS, ...props.settings };
  const dateLabel = reportDateLabel(revision);
  const docCode = docCodeFor(project, revision);
  return (
    // Künye ALTBİLGİNİN İÇİNDE: ayrı bir blok olarak akışın sonuna konduğunda
    // künye ile sayfa altbilgisi arasında doldurulmamış bir şerit kalıyordu
    // (altbilgi sayfanın en altına sabit, künye ise içeriğin bittiği yere).
    <BrandPage
      docLine={coverDocLineFor(revision)}
      docCode={docCode}
      company={{
        company: st.company,
        address: st.address || st.city,
        phone: st.phone,
        email: st.email,
        web: st.web,
      }}
    >
      {/* Üst bant: lockup logo + sağda mono doküman kimliği (ekipman listesiyle ortak) */}
      <BrandBand
        docCode={docCode}
        lines={[`REV ${String(revision.rev_no).padStart(2, "0")} · ${dateLabel}`]}
        logoWidth={168}
      />

      {/* Başlık bloğu */}
      <View style={{ marginTop: 84 }}>
        <Text style={T.kicker}>ORION CRANES · HESAP RAPORU</Text>
        <RuleRed width={22} />
        <Text style={{ ...T.display, marginTop: 12 }}>
          {project.name.toLocaleUpperCase("tr-TR")}
        </Text>
        <Text style={{ ...T.caption, marginTop: 6 }}>{project.crane_type}</Text>
      </View>

      {/* Künye: kapasite → açıklık → kaldırma yüksekliği → FEM sınıfı */}
      <View style={{ marginTop: 30, borderTopWidth: 1.4, borderTopColor: BRAND.ink }}>
        {coverSpecs(input).map((row) => (
          <View key={row.label} style={s.specRow}>
            <View>
              <Text style={s.specLabel}>{row.label}</Text>
            </View>
            <Text style={s.specValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Meta: müşteri / tarih / hazırlayan / kontrol / revizyon */}
      <View style={{ marginTop: "auto" }}>
        <View style={{ flexDirection: "row", gap: 14, marginBottom: 12 }}>
          <View style={{ flex: 1.25 }}>
            <Text style={s.coverMetaLabel}>MÜŞTERİ</Text>
            <Text style={s.coverMetaValue}>{project.customer.toLocaleUpperCase("tr-TR")}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>TARİH</Text>
            <Text style={{ ...T.data }}>{dateLabel}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>HAZIRLAYAN</Text>
            <Text style={s.coverMetaValue}>
              {(preparedBy ?? "—").toLocaleUpperCase("tr-TR")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>KONTROL</Text>
            <Text style={s.coverMetaValue}>
              {(checkedBy ?? "—").toLocaleUpperCase("tr-TR")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>REVİZYON</Text>
            <Text style={{ ...T.data }}>
              R{String(revision.rev_no).padStart(2, "0")}
              {revision.label && revision.label !== `V${revision.rev_no}` ? ` · ${revision.label}` : ""}
            </Text>
          </View>
        </View>
      </View>
    </BrandPage>
  );
}

// ---------------------------------------------------------------- İçindekiler

/**
 * Bölüm çapası: içindekilerden tıklanınca gidilecek hedef.
 * `<Link src="#hedef">` ile eşleşir (react-pdf iç bağlantı = named destination).
 */
function anchorFor(key: ModuleKey | "ozet" | "specs" | "kontroller"): string {
  return `bolum-${key}`;
}

interface TocEntry {
  no: string;
  title: string;
  anchor: string;
}

function tocEntries(
  level: ReportLevel,
  numbers: Partial<Record<ModuleKey, number>>,
  present: (k: ModuleKey) => boolean,
  /** Başlıkları çözmek için teknik özellikler (ör. "Ana Kiriş - 1") */
  specs?: TechnicalSpecs
): TocEntry[] {
  const out: TocEntry[] = [
    { no: "—", title: "Özet Hesap Raporu", anchor: anchorFor("ozet") },
    { no: "01", title: "Teknik Özellikler", anchor: anchorFor("specs") },
  ];
  for (const a of MODULE_ADAPTERS) {
    if (!present(a.key)) continue;
    const [no, ...rest] = renumberTitle(adapterTitle(a, specs), numbers[a.key] ?? 0).split(" · ");
    out.push({ no, title: rest.join(" · "), anchor: anchorFor(a.key) });
  }
  // Kontrol özeti belgenin EN SONUNDADIR (madde 24) ve içindekilerde de son
  // satırdır — ama YALNIZ DETAYLI raporda basılır, bkz. ReportDocument.
  // İçindekiler basılmayan bir bölümü listeleyemez: satırın sayfa numarası
  // "—" kalır ve bağlantı hiçbir yere gitmezdi.
  if (level === "detayli") {
    out.push({ no: "—", title: "Kontrol Özeti", anchor: anchorFor("kontroller") });
  }
  return out;
}

function TocPage({
  project, revision, level, input,
  numbers, present, pageOf,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  present: (k: ModuleKey) => boolean;
  /** Çapa → başladığı sayfa numarası (ilk geçişte boş) */
  pageOf: Record<string, number>;
}) {
  const entries = tocEntries(level ?? "detayli", numbers, present, input.specs);
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageHeader kicker="ORION CRANES · HESAP RAPORU" title="İçindekiler" />
      {entries.map((e) => (
        // Satırın tamamı tıklanabilir: PDF okuyucuda ilgili sayfaya atlar.
        <Link key={e.anchor} src={`#${e.anchor}`} style={s.tocLink}>
          <View style={s.tocRow}>
            <Text style={[s.tocNo, { color: e.no === "—" ? BRAND.gray450 : BRAND.red }]}>{e.no}</Text>
            <Text style={s.tocTitle}>{e.title.toLocaleUpperCase("tr-TR")}</Text>
            <View style={s.tocDots} />
            <Text style={s.tocPage}>
              {pageOf[e.anchor] ? String(pageOf[e.anchor]).padStart(2, "0") : "—"}
            </Text>
          </View>
        </Link>
      ))}
      <Text style={{ ...T.micro, marginTop: 8 }}>
        Satıra tıklayarak ilgili bölüme gidebilirsiniz.
      </Text>
    </BrandPage>
  );
}

/**
 * Sayfa numarası toplayıcı: bir bölümün BAŞLADIĞI sayfayı ilk render geçişinde
 * yakalar. `render` geri çağrısı yerleşim (layout) sırasında çalıştığı için
 * sayfa numarası ancak böyle öğrenilebilir; toplanan değerler ikinci geçişte
 * içindekiler tablosuna basılır.
 */
function PageProbe({ anchor, collect }: { anchor: string; collect?: (a: string, p: number) => void }) {
  return (
    <Text
      id={anchor}
      style={{ position: "absolute", top: 0, left: 0, fontSize: 1, color: BRAND.white }}
      render={({ pageNumber }) => {
        collect?.(anchor, pageNumber);
        return "";
      }}
      fixed={false}
    />
  );
}

/** Bir hesap bölümünün (2.5, 7.4 …) çapası — kontrol özetinde sayfa numarası */
function sectionAnchor(key: ModuleKey, rawId: string): string {
  return `sec-${key}-${rawId}`;
}

/**
 * Bölüm başına sayfa numarası toplayıcı.
 *
 * `PageProbe`den farkı AKIŞ İÇİNDE olmasıdır: mutlak konumlu bir düğüm sayfa
 * bölmede yerinde kalır ve hangi sayfaya düştüğü sorulamaz — modülün ilk
 * sayfasını bildirirdi. Bu sonda ise sıfır yükseklikli, görünmez bir metin
 * olarak bölümün başladığı yerde akar; `render` geri çağrısı gerçekten
 * yerleştiği sayfanın numarasını verir.
 */
function SectionProbe({
  anchor,
  collect,
}: {
  anchor: string;
  collect?: (a: string, p: number) => void;
}) {
  const style = { height: 0, fontSize: 1, lineHeight: 0, color: BRAND.white };
  // İkinci geçişte `collect` yoktur ama `id` KALMALI: kontrol özetindeki sayfa
  // numarası bu çapaya bağlanan tıklanabilir bir bağlantıdır.
  if (!collect) return <Text id={anchor} style={style} />;
  return (
    <Text
      id={anchor}
      style={style}
      render={({ pageNumber }) => {
        collect(anchor, pageNumber);
        return "";
      }}
    />
  );
}

// ---------------------------------------------------------------- Özet

interface SummaryGroup {
  title: string;
  /**
   * `sectionRawId`: satırın karşılık geldiği hesap alt bölümü — bölüm
   * GİZLENDİĞİNDE satır özetten de düşer. Bölümü olmayan satır her zaman kalır.
   */
  items: { label: string; value: string; sectionRawId?: string }[];
}

function hoistSelectionItems(st: { selections: object } | undefined): SummaryGroup["items"] {
  if (!st) return [];
  const sel = st.selections as Record<string, unknown>;
  const n = (k: string) => sel[k] as number | undefined;
  const t = (k: string) => (sel[k] as string | undefined) ?? "";
  return [
    {
      label: "Halat",
      sectionRawId: "2.1",
      value: `${t("ropeBrand")} Ø${fmt(n("ropeDiaMm"))} mm ${t("ropeConstruction")} ${t(
        "ropeCore"
      )} · ${fmt(n("ropeBreakingLoadKn"))} kN`,
    },
    {
      label: "Tambur",
      sectionRawId: "2.2.1",
      value: `Ø${fmt(n("drumDiaMm"))} mm · ${t("drumMaterial")}`,
    },
    {
      label: "Redüktör",
      sectionRawId: "2.3",
      value: `${t("gearboxModel")} · i=${fmt(n("gearboxRatio"))} · ${fmt(
        n("gearboxNominalTorqueKnm")
      )} kNm`,
    },
    {
      label: "Motor",
      sectionRawId: "2.4",
      value: `${t("motorBrand")} ${fmt(n("motorPowerKw"))} kW · ${fmt(
        n("motorRpm")
      )} d/dak × ${fmt(n("motorCount"))}`,
    },
    {
      label: "Fren",
      sectionRawId: "2.5",
      value: `${t("brakeBrand")} ${t("brakeModel")} · ${fmt(n("brakeTorqueNm"))} Nm × ${fmt(
        n("brakeQty")
      )}`,
    },
    {
      label: "Motor kaplini",
      sectionRawId: "2.6",
      value: `${t("motorCouplingBrand")} ${t("motorCouplingModel")} · ${fmt(
        n("motorCouplingTorqueNm")
      )} Nm`,
    },
    {
      label: "Tambur kaplini",
      sectionRawId: "2.7",
      value: `${t("drumCouplingBrand")} ${t("drumCouplingModel")} · ${fmt(
        n("drumCouplingTorqueNm")
      )} Nm`,
    },
  ];
}

function travelSelectionItems(st: { selections: object } | undefined): SummaryGroup["items"] {
  if (!st) return [];
  const sel = st.selections as Record<string, unknown>;
  const n = (k: string) => sel[k] as number | undefined;
  const t = (k: string) => (sel[k] as string | undefined) ?? "";
  return [
    {
      label: "Teker",
      sectionRawId: "5.1",
      value: `Ø${fmt(n("wheelDiaMm"))} mm · ${t("wheelMaterial")} · ray ${t("railCode")}`,
    },
    {
      label: "Motor",
      sectionRawId: "5.4",
      value: `${t("motorBrand")} ${fmt(n("motorPowerKw"))} kW · ${fmt(
        n("motorRpm")
      )} d/dak × ${fmt(n("motorCount"))}`,
    },
    {
      label: "Redüktör",
      sectionRawId: "5.5",
      value: `${t("gearboxModel")} · i=${fmt(n("gearboxRatio"))} · ${fmt(
        n("gearboxOutputTorqueKnm")
      )} kNm`,
    },
    {
      label: "Motor kaplini",
      sectionRawId: "5.6",
      value: `${t("motorCouplingBrand")} ${t("motorCouplingModel")} · ${fmt(
        n("motorCouplingTorqueNm")
      )} Nm`,
    },
    {
      // 5.7 = Teker – Redüktör Kaplini. Çapa YAZILMASAYDI bölüm gizlenmiş bir
      // vinçte kaplin "ana seçim" olarak özette durmaya devam ederdi — rapor
      // hesabı basılmayan bir ekipmanı satın alma satırı gibi gösterirdi.
      label: "Teker kaplini",
      sectionRawId: "5.7",
      value: `${t("wheelCouplingBrand")} ${t("wheelCouplingModel")} · ${fmt(
        n("wheelCouplingTorqueNm")
      )} Nm`,
    },
  ];
}

/**
 * Özet sayfasının ana ekipman blokları vincin GERÇEK topolojisinden üretilir:
 * hangi kaldırma grupları, kanca blokları ve arabalar hesaba giriyorsa hepsi
 * listelenir (yardımcı kanca bloğu, ayrı yardımcı araba, monoraylar dâhil).
 */
function summaryGroups(input: CalcInput, hidden: ReadonlySet<string>): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  for (const key of MODULE_ORDER) {
    const state = moduleState(input, key);
    if (!state) continue;
    const title = (MODULE_LABELS[key] ?? key).replace(/^\d+\s*·\s*/, "");
    let items: SummaryGroup["items"] | undefined;
    if (isHoistKey(key)) {
      items = hoistSelectionItems(state as never);
    } else if (isHookBlockKey(key)) {
      const sel = state.selections as unknown as Record<string, unknown>;
      items = [
        {
          label: "Kanca",
          sectionRawId: "4.1",
          value: `${String(sel.hookDesignation ?? "")} · ${fmt(
            sel.hookCapacityKg as number
          )} kg`,
        },
        {
          label: "Makara",
          sectionRawId: "4.2",
          value: `Ø${fmt(sel.sheaveDiaMm as number)} mm · rulman ${String(
            sel.sheaveBearingCode ?? ""
          )}`,
        },
      ];
    } else if (isTravelKey(key)) {
      items = travelSelectionItems(state as never);
    }
    if (!items) continue;
    // Gizlenen alt bölümün seçimi özet sayfasına da girmez: raporda hesabı
    // olmayan bir ekipmanın "ana seçim" olarak durması çelişki olurdu.
    groups.push({
      title,
      items: items.filter(
        (it) => !it.sectionRawId || !isSectionHidden(hidden, key, it.sectionRawId)
      ),
    });
  }
  return groups.filter((g) => g.items.length > 0);
}

function SummarySection({
  input, result, project, revision, numbers, collect, hiddenSections,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  collect?: (anchor: string, page: number) => void;
}) {
  const groups = summaryGroups(input, hiddenSetOf({ hiddenSections }));
  const summarySpecs = summarySpecsForReport(input);
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageProbe anchor={anchorFor("ozet")} collect={collect} />
      <PageHeader
        kicker="ORION CRANES · ÖZET"
        title="Özet Hesap Raporu"
        meta="TASARIM HESAP RAPORU"
      />

      <View id={anchorFor("specs")}>
        <PageProbe anchor={anchorFor("specs")} collect={collect} />
        <SectionTag no="01" title="Teknik Özellikler" />
      </View>
      <FieldTable defs={summarySpecs.defs} source={summarySpecs.source} specs={input.specs} />
      <SubHead tr="ANA EKİPMAN SEÇİMLERİ" />
      {/* Aynı gerekçe: iki sütunlu ızgara bölünemez, bütün hâlde taşınır. */}
      <View style={s.kvGrid} wrap={false}>
        {[groups.slice(0, Math.ceil(groups.length / 2)), groups.slice(Math.ceil(groups.length / 2))].map(
          (col, ci) => (
            <View style={s.kvCol} key={ci}>
              {col.map((g) => (
                <View key={g.title} style={s.sumModule} wrap={false}>
                  <Text style={s.sumModuleTitle}>{g.title}</Text>
                  {g.items.map((it) => (
                    <KvRow key={it.label} label={it.label} value={it.value} narrowLabel />
                  ))}
                </View>
              ))}
            </View>
          )
        )}
      </View>

      {/* Toplu kontrol listesi burada DEĞİL, belgenin en sonundadır
          (madde 24 — bkz. ChecksSummarySection). */}
    </BrandPage>
  );
}

// ------------------------------------------------------------ Kontrol özeti

/**
 * Kontrol kimliği → bağlı olduğu hesap bölümünün çapası.
 *
 * Bölüm tanımı hangi kontrol soneklerini taşıdığını zaten bildirir
 * (`checkSuffixes`); kontrol özetindeki sayfa numarası bu bağdan çıkar.
 * Kapalı (görünmeyen) bölümler atlanır — raporda basılmayan bir bölüme sayfa
 * numarası verilemez.
 */
function checkSectionAnchors(
  adapter: ModuleAdapter,
  mr: ModuleResult<unknown> | undefined,
  specs: TechnicalSpecs,
  /** Kullanıcının gizlediği alt bölümler — basılmayan bölüme sayfa verilmez */
  hidden: ReadonlySet<string>
): Map<string, string> {
  const out = new Map<string, string>();
  if (!mr) return out;
  for (const section of adapter.sections) {
    if (section.visible && !section.visible(specs)) continue;
    if (isSectionHidden(hidden, adapter.key, section.rawId)) continue;
    for (const c of sectionChecks(adapter, section, mr)) {
      if (!out.has(c.id)) out.set(c.id, sectionAnchor(adapter.key, section.rawId));
    }
  }
  return out;
}

/**
 * Kontrol özeti satırı: SOLDA hesabın geçtiği sayfa numarası, sağda sonuç.
 * Sayfa numarası tıklanabilir — okuyucu doğrudan o bölüme gider.
 */
function SummaryCheckLine({
  check,
  page,
  anchor,
}: {
  check: AnyCheck;
  /** Kontrolün bağlı olduğu bölümün sayfası; bilinmiyorsa "—" basılır */
  page?: number;
  anchor?: string;
}) {
  const pageText = page ? String(page).padStart(2, "0") : "—";
  return (
    <View style={s.checkRow} wrap={false}>
      {page && anchor ? (
        <Link src={`#${anchor}`} style={s.chkPage}>
          {pageText}
        </Link>
      ) : (
        <Text style={s.chkPage}>{pageText}</Text>
      )}
      <CheckGlyph pass={check.pass} size={8} />
      <View style={{ flex: 1 }}>
        <Text style={s.checkLabel}>
          {check.label}
          {checkOriginText(check) ? (
            <Text style={{ color: BRAND.gray500 }}> ({checkOriginText(check)})</Text>
          ) : null}
          {check.standard ? (
            <Text style={{ ...T.micro, color: BRAND.gray450 }}> · {check.standard}</Text>
          ) : null}
        </Text>
        <CheckComparison check={check} />
      </View>
      <Text style={[s.checkBadge, { color: check.pass ? BRAND.gray700 : BRAND.red }]}>
        {check.pass ? "UYGUN" : "UYGUN DEĞİL"}
      </Text>
    </View>
  );
}

/**
 * Hesap bölümlerinin ardından gelen kontrol özeti. Kaynaklar, kullanıcı
 * isteği doğrultusunda bunun da ardından belgenin en sonunda yer alır.
 * Satır içi kontroller yerinde kalır; buradaki liste bir DİZİN
 * gibidir — her satırın solunda hesabın yapıldığı sayfa vardır.
 */
function ChecksSummarySection({
  input, result, project, revision, numbers, pageOf, collect, hiddenSections,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  pageOf: Record<string, number>;
  collect?: (anchor: string, page: number) => void;
}) {
  const hidden = hiddenSetOf({ hiddenSections });
  // Gizlenen alt bölümün kontrolleri dizine GİRMEZ: bölümün kendisi
  // basılmıyor, dizin basılmayan bir hesaba sayfa numarası veremezdi.
  const hiddenIds = hiddenSectionCheckIds(hidden);
  const checksOf = (a: ModuleAdapter): AnyCheck[] =>
    (moduleResult(result, a.key)?.checks ?? []).filter((c) => !hiddenIds.has(c.id));
  const total = MODULE_ADAPTERS.reduce((n, a) => n + checksOf(a).length, 0);
  const failed = MODULE_ADAPTERS.reduce(
    (n, a) => n + checksOf(a).filter((c) => !c.pass).length,
    0
  );
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageProbe anchor={anchorFor("kontroller")} collect={collect} />
      <PageHeader
        kicker="ORION CRANES · KONTROLLER"
        title="Kontrol Özeti"
        meta={`${total} KONTROL · ${failed === 0 ? "TÜMÜ UYGUN" : `${failed} UYGUN DEĞİL`}`}
      />
      <Text style={s.chkLead}>
        Soldaki numara kontrolün dayandığı hesabın geçtiği sayfadır; numaraya
        tıklayarak o bölüme gidebilirsiniz.
      </Text>
      {MODULE_ADAPTERS.map((adapter) => {
        const mr = moduleResult(result, adapter.key);
        const checks = checksOf(adapter);
        if (!mr || checks.length === 0) return null;
        const anchors = checkSectionAnchors(adapter, mr, input.specs, hidden);
        const lines = checks.map((c) => {
          const anchor = anchors.get(c.id);
          return (
            <SummaryCheckLine
              key={c.id}
              check={c}
              anchor={anchor}
              page={anchor ? pageOf[anchor] : undefined}
            />
          );
        });
        return (
          // Modül başlığı ilk kontrol satırıyla birlikte kalır (madde 29).
          <React.Fragment key={adapter.key}>
            <KeepWithNext>
              <Text style={[s.sumModuleTitle, { marginTop: 8 }]}>
                {renumberTitle(adapterTitle(adapter, input.specs), numbers[adapter.key] ?? 0)}
              </Text>
              {lines[0]}
            </KeepWithNext>
            {lines.slice(1)}
          </React.Fragment>
        );
      })}
    </BrandPage>
  );
}

// ---------------------------------------------------------------- Diyagramlar
//
// Çevirici (`DiagramEl` → react-pdf SVG) ve `PdfDiagram` ORTAK dosyadadır
// (`pdf/diagram.tsx`): kesim planı belgesi de aynı modeli basar ve iki ayrı
// çeviri, ikincisinde daire/kalın/uç ayarlarının sessizce kaybolmasıyla
// sonuçlanmıştı.

// ---------------------------------------------------------------- Modül bölümleri

/**
 * Bölüm sonundaki özet tablosu — web editöründeki `SectionTable`'ın PDF
 * karşılığı. İlk sütun geniş, kalanlar eşit paylaşır; sayısal hücreler sağa
 * yaslı ve mono basılır.
 */
function sectionTableParts(
  table: NonNullable<AdapterSection["table"]>,
  ctx: unknown
): React.ReactNode[] {
  let rows: (string | number)[][] = [];
  try {
    rows = table.build(ctx);
  } catch {
    rows = [];
  }
  if (rows.length === 0) return [];

  // Sütun genişliği İÇERİKTEN çıkar. Eşit paylaştırmada "No" sütunu ("σ1")
  // gereksiz genişken açıklama sütunu ("Düşey Eğilme — Kiriş Öz Ağırlığı")
  // iki satıra kırılıyordu. Ağırlık = sütundaki en uzun metin (sınırlandırılmış).
  const weights = table.headers.map((h, i) => {
    let max = String(h).length;
    for (const r of rows) {
      const cell = r[i];
      const len = typeof cell === "number" ? fmt(cell).length : String(cell ?? "").length;
      if (len > max) max = len;
    }
    // +2 karakterlik pay: hücre dolgusu ve Yunan harflerinin (DejaVu yedeği,
    // Archivo'dan geniş) fazlası hesaba katılmazsa "γc·σcomb" iki satıra kırılır.
    return Math.min(32, Math.max(6, max + 2));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const widthOf = (i: number) => `${(weights[i] / total) * 100}%`;

  // Sayısal sütunlar bütünüyle sağa yaslanır — başlığı da dahil; rakamlar
  // sütun içinde hizalanmazsa tablo mühendislik belgesi gibi okunmuyor.
  const isNumericCol = (i: number) =>
    rows.some((r) => r[i] !== undefined && r[i] !== "") &&
    rows.every((r) => {
      const cell = r[i];
      if (cell === undefined || cell === "" || cell === "—") return true;
      if (typeof cell === "number") return true;
      return /^[-−+]?[\d.]*,?\d+$/.test(String(cell).trim());
    });
  const numericCols = table.headers.map((_, i) => isNumericCol(i));

  const dataRow = (r: (string | number)[], ri: number) => (
    <View key={`r${ri}`} style={s.tblRow} wrap={false}>
      {r.map((cell, ci) => (
        <Text
          key={ci}
          style={[
            typeof cell === "number" || numericCols[ci] ? s.tblCellNum : s.tblCell,
            { width: widthOf(ci) },
          ]}
        >
          {typeof cell === "number" ? fmt(cell) : String(cell)}
        </Text>
      ))}
    </View>
  );

  // Başlık + sütun başlıkları + İLK veri satırı ayrılmaz bir parçadır; kalan
  // satırlar serbest akar (bkz. KeepWithNext).
  const parts: React.ReactNode[] = [
    <KeepWithNext key="head">
      <SubHead tr={table.title.toLocaleUpperCase("tr-TR")} />
      <View style={s.tblHeadRow} wrap={false}>
        {table.headers.map((h, i) => (
          <Text
            key={h}
            style={[s.tblHeadCell, { width: widthOf(i) }, numericCols[i] ? s.tblAlignRight : {}]}
          >
            {h}
          </Text>
        ))}
      </View>
      {dataRow(rows[0], 0)}
    </KeepWithNext>,
  ];
  for (let ri = 1; ri < rows.length; ri++) parts.push(dataRow(rows[ri], ri));
  if (table.note) parts.push(<Text key="note" style={s.tblNote}>{table.note}</Text>);
  return parts;
}

/**
 * Tek bir hesap adımı.
 *
 * Anatomi (soldan sağa):
 *   [adım no] │ etiket ............................ [ = sonuç birim ]
 *             │ formül
 *             │ standart maddesi
 *             │ ✓ UYGUN — HESAPLANAN x ≤ İZİN VERİLEN y
 *
 * Adım numarası bölüm numarasının devamıdır (7.4 bölümünün 3. adımı → 7.4.03),
 * böylece rapordaki her sayı kalıcı bir adresle anılabilir. Satıra bağlı bir
 * kontrol varsa sol şerit yeşil/kırmızı renklenir.
 */
function CalcRowLine({
  row,
  ctx,
  showFormulas,
  checks,
  stepNo,
}: {
  row: AdapterSection["rows"][number];
  ctx: unknown;
  /** false (standart seviye): yalnız sonuç — sembolik formül satırı gizli */
  showFormulas: boolean;
  /** Bu satıra bağlı kontroller (check-anchors.ts) */
  checks?: AnyCheck[];
  /** Bölüm içi adım numarası ("7.4.03") */
  stepNo: string;
}) {
  let raw: number | string | undefined;
  try {
    raw = row.read(ctx);
  } catch {
    raw = undefined;
  }
  const { value, unit } = toDisplayUnit(raw, row.unit);
  // Sözel durumlar (ör. katalog yük diyagramı yok) sayısal birim almaz.
  const displayUnit = typeof value === "string" ? undefined : unit;
  const hasChecks = (checks?.length ?? 0) > 0;
  const allPass = hasChecks && checks!.every((c) => c.pass);
  const accent = !hasChecks ? BRAND.line350 : allPass ? BRAND.success : BRAND.red;
  return (
    <View style={[s.calcRow, { borderLeftColor: accent }]} wrap={false}>
      <Text style={s.calcStep}>{stepNo}</Text>
      <View style={s.calcBody}>
        <View style={s.calcTop}>
          <Text style={s.calcLabel}>{row.label}</Text>
          <View style={s.calcResult}>
            <Text style={s.calcEq}>=</Text>
            {/* Madde 30: çap satırlarında değerin başına "Ø" konur */}
            <Text style={[s.calcValue, { marginLeft: 3 }]}>
              {row.diameter ? "Ø" : ""}
              {fmt(value, row.digits ?? 2)}
            </Text>
            {displayUnit ? <Text style={s.calcUnit}>{displayUnit}</Text> : null}
          </View>
        </View>
        {showFormulas && row.formula && (
          <View style={s.calcFormula}>
            <PdfMath formula={row.formula} />
          </View>
        )}
        {row.standard && <Text style={s.calcMeta}>{row.standard}</Text>}
        {checks?.map((c) => (
          <InlineCheckLine key={c.id} check={c} />
        ))}
      </View>
    </View>
  );
}

/**
 * Başlık + onu izleyen İLK parça: ayrılmaz kutu.
 *
 * Madde 29'un kalıcı çözümü budur. `minPresenceAhead` yalnız "başlığın altında
 * şu kadar boşluk kalsın" diyebilir; ardından gelen parçanın GERÇEK yüksekliğini
 * bilemez. Bölünemeyen bir tablo (FieldTable `wrap={false}`) kalan boşluğa
 * sığmayıp sonraki sayfaya geçtiğinde başlık yine yalnız kalıyordu. Başlığı ilk
 * parçasıyla aynı bölünemez kutuya koymak sorunu yapısal olarak bitirir:
 * başlık nereye giderse en az bir satır içerik onunla birlikte gider.
 */
function KeepWithNext({ children }: { children: React.ReactNode }) {
  return <View wrap={false}>{children}</View>;
}

const REPORT_SOURCES = [
  "FEM 1.001 (3. Baskı) — Rules for the Design of Hoisting Appliances",
  "DIN 15018 — Cranes; Steel Structures; Design and Analysis",
  "DIN 15400 — Lifting Hooks; General Requirements",
  "DIN 15401 — Lifting Hooks; Single Hooks",
  "DIN 15402 — Lifting Hooks; Mechanical Properties, Load Capacities and Stresses",
  "DIN 15061 — Cranes; Wire Rope Drums; Dimensions",
  "CMAA Specification No. 70 — Specifications for Top Running and Under Running Single Girder and Multiple Girder Electric Overhead Traveling Cranes Utilizing Top Running and Under Running Trolley Hoist",
  "EN 13001-1 — Cranes; General Design; Part 1: General Principles and Requirements",
  "EN 13001-2 — Cranes; General Design; Part 2: Load Actions",
  "EN 13001-3-1 — Cranes; General Design; Part 3-1: Limit States and Proof of Competence of Steel Structures",
  "ISO 4301-1:2016 — Cranes; Classification; Part 1: General",
  "ISO 4309:2017 — Cranes; Wire Ropes; Care and Maintenance, Inspection and Discard",
  "ISO 9927-1:2013 — Cranes; Inspections; Part 1: General",
] as const;

/** Ticari unvan — hukukî metinde ticari ad değil TÜZEL KİŞİ adı geçer. */
const LEGAL_ENTITY = "ORION VİNÇ MÜHENDİSLİK SAN. VE TİC. LTD. ŞTİ.";

interface LegalParagraph {
  /** Paragraf başı vurgusu ("Mülkiyet.") — yoksa paragraf düz akar */
  lead?: string;
  text: string;
}

/**
 * DETAYLI raporun tam gizlilik ve kullanım metni (kullanıcı tarafından
 * yazılmıştır; sözcükleri DEĞİŞTİRİLMEZ — hukukî bir beyandır).
 */
const LEGAL_TERMS_FULL: readonly LegalParagraph[] = [
  {
    lead: "Mülkiyet.",
    text:
      `Bu rapor ${LEGAL_ENTITY} (“ORION CRANES”) tarafından kapakta belirtilen proje için ` +
      "hazırlanmıştır. Raporda yer alan özgün hesap düzeni, tasarım kabulleri, mühendislik " +
      "çözümleri ve seçim metodolojisi ORION CRANES'e ait fikri haklar ile gizli teknik bilgi " +
      "ve know-how içermektedir. Üçüncü kişilere ait standart, katalog ve ürün verileri " +
      "üzerindeki haklar ilgili hak sahiplerine aittir.",
  },
  {
    lead: "Kullanım ve gizlilik.",
    text:
      "Rapor yalnızca kapakta belirtilen Müşteri'ye, ilgili projenin teknik değerlendirme, onay " +
      "ve uygulama süreçlerinde kullanılmak üzere sunulmuştur. Rapor erişiminin proje kapsamında " +
      "bilmesi gereken personelle sınırlandırılması esastır. Başka bir üretici, tedarikçi veya " +
      "mühendislik kuruluşuyla paylaşılması ya da alternatif teklif, tasarım veya imalat amacıyla " +
      "kullanılması ORION CRANES'in önceden yazılı iznine tabidir. Mevzuat gereği zorunlu " +
      "açıklamalar ile bağımsız muayene ve belgelendirme süreçleri bu kapsamın dışındadır.",
  },
  {
    lead: "Teknik bilginin kullanımı.",
    text:
      "Rapordaki hesap yöntemleri, mühendislik çözümleri ve bileşen boyutlandırmaları, ORION " +
      "CRANES'in yazılı izni olmaksızın başka bir vinç, bileşen, şartname veya imalatın " +
      "geliştirilmesinde referans olarak kullanılamaz.",
  },
  {
    lead: "Teknik geçerlilik.",
    text:
      "Hesaplar yalnızca raporda tanımlanan proje parametreleri ve tasarım kabulleri için " +
      "geçerlidir. Rapor, doküman numarası ve revizyonuyla bir bütündür; münferit bölümler " +
      "bağlamından koparılarak veya farklı revizyonlarla birleştirilerek kullanılamaz. ORION " +
      "CRANES'in onayı dışında yapılan değişikliklerden veya amaç dışı kullanımdan doğacak " +
      "sonuçlardan ORION CRANES sorumlu tutulamaz.",
  },
  {
    text:
      "Taraflar arasındaki sözleşme ve gizlilik anlaşmaları saklıdır; çelişki hâlinde sözleşme " +
      "hükümleri uygulanır. ORION CRANES'in yürürlükteki mevzuattan doğan hakları saklıdır.",
  },
];

/**
 * STANDART raporun kısaltılmış metni (kullanıcı kararı: *"Standart rapor için
 * bunu da kısaltalım"*). Tam metnin dört başlığı iki paragrafa indirilir;
 * hiçbir koşul GEVŞETİLMEZ, yalnız aynı koşullar daha az sözcükle söylenir.
 */
const LEGAL_TERMS_SHORT: readonly LegalParagraph[] = [
  {
    lead: "Mülkiyet ve gizlilik.",
    text:
      `Bu rapor ${LEGAL_ENTITY} (“ORION CRANES”) tarafından kapakta belirtilen proje ve Müşteri ` +
      "için hazırlanmıştır; özgün hesap düzeni, tasarım kabulleri ve mühendislik çözümleri ORION " +
      "CRANES'e ait fikri haklar ile gizli teknik bilgi içerir. Rapor yalnızca ilgili projenin " +
      "teknik değerlendirme, onay ve uygulama süreçlerinde kullanılır; başka bir üretici, " +
      "tedarikçi veya mühendislik kuruluşuyla paylaşılması ya da alternatif teklif, tasarım veya " +
      "imalat amacıyla kullanılması ORION CRANES'in önceden yazılı iznine tabidir. Mevzuat gereği " +
      "zorunlu açıklamalar ile bağımsız muayene ve belgelendirme süreçleri bu kapsamın dışındadır.",
  },
  {
    lead: "Teknik geçerlilik.",
    text:
      "Hesaplar yalnızca raporda tanımlanan proje parametreleri ve tasarım kabulleri için " +
      "geçerlidir; rapor doküman numarası ve revizyonuyla bir bütündür ve münferit bölümleri " +
      "bağlamından koparılarak kullanılamaz. Taraflar arasındaki sözleşme ve gizlilik anlaşmaları " +
      "saklıdır.",
  },
];

/**
 * GİZLİLİK VE KULLANIM KOŞULLARI — Ek'in (Kaynaklar) ALTINDA, aynı yaprakta.
 *
 * Kullanıcı kararı (12.08.2026): *"Ek ve bu yazı 1 sayfayı geçmesin."* Bu yüzden
 * metin AYRI BİR SAYFA DEĞİLDİR ve daha küçük puntoyla, daha silik basılır —
 * kaynak listesiyle aynı ağırlıkta dizilseydi belgenin son sözü mühendislik
 * değil hukuk metni olurdu. Punto 6,5'tir (md. "içerik metninde 11px altına
 * inilmez" kuralı EKRAN içindir; basılı A4'te 6,5pt rahat okunur ve marka
 * kılavuzunun `micro` ölçeğiyle aynı ailededir).
 *
 * `wrap={false}` KONMAZ: blok kaynak listesiyle birlikte tek sayfaya sığar,
 * ama sığmadığı bir gün gelirse (kaynak listesi büyürse) metnin kırpılması
 * değil taşması doğrudur — hukukî beyan yarım basılamaz.
 */
function LegalTermsBlock({ level }: { level: ReportLevel }) {
  const paragraphs = level === "detayli" ? LEGAL_TERMS_FULL : LEGAL_TERMS_SHORT;
  return (
    <View style={{ marginTop: 18, borderTopWidth: 0.75, borderTopColor: BRAND.line300, paddingTop: 8 }}>
      <Text style={{ ...T.kickerInk, fontSize: 6.5, color: BRAND.gray450, marginBottom: 5 }}>
        GİZLİLİK VE KULLANIM KOŞULLARI
      </Text>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={{
            fontFamily: FONTS.sans,
            fontSize: 6.5,
            lineHeight: 1.5,
            color: BRAND.gray500,
            textAlign: "justify",
            marginTop: i === 0 ? 0 : 4,
          }}
        >
          {p.lead ? (
            <Text style={{ fontWeight: 700, color: BRAND.gray600 }}>{p.lead} </Text>
          ) : null}
          {p.text}
        </Text>
      ))}
    </View>
  );
}

/**
 * Hesap ve tasarımda başvurulan standartların tam adları, belgenin son
 * sayfasında yer alır; gizlilik ve kullanım koşulları da AYNI yaprağın altına
 * girer (kullanıcı kararı: ikisi birlikte tek sayfayı geçmez).
 */
function SourcesSection({
  project,
  revision,
  level,
}: Pick<ReportProps, "project" | "revision"> & { level: ReportLevel }) {
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageHeader kicker="EK" title="Kaynaklar ve Standartlar" />
      <Text style={{ ...T.caption, marginBottom: 10 }}>
        Hesap raporunda başvurulan kaynak dokümanlar.
      </Text>
      <View style={{ borderTopWidth: 0.75, borderTopColor: BRAND.line300 }}>
        {REPORT_SOURCES.map((source, index) => (
          <View
            key={source}
            style={{ flexDirection: "row", gap: 8, borderBottomWidth: 0.5, borderBottomColor: BRAND.line300, paddingVertical: 5 }}
          >
            <Text style={{ ...T.data, width: 17, color: BRAND.red }}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={{ ...T.caption, flex: 1, color: BRAND.gray700 }}>{source}</Text>
          </View>
        ))}
      </View>
      <LegalTermsBlock level={level} />
    </BrandPage>
  );
}

/** Editördeki hesap alt bölümü notunun PDF karşılığı. */
function EngineeringNote({ note }: { note: string }) {
  return (
    <View
      style={{
        borderLeftWidth: 2,
        borderLeftColor: BRAND.red,
        backgroundColor: BRAND.paper100,
        paddingHorizontal: 8,
        paddingVertical: 6,
      }}
      wrap={false}
    >
      <Text style={T.body}>{note}</Text>
    </View>
  );
}

function ModulePage({
  adapter,
  props,
  deps,
  showFormulas,
  moduleNo,
  collect,
}: {
  adapter: ModuleAdapter;
  props: ReportProps;
  deps: ModuleDepsBundle;
  showFormulas: boolean;
  /** Dinamik görüntü numarası (esnek modül numaralandırması) */
  moduleNo: number;
  collect?: (anchor: string, page: number) => void;
}) {
  const { input, result, project, revision } = props;
  const state = moduleState(input, adapter.key);
  const mr = moduleResult(result, adapter.key);
  if (!state || !mr) return null;
  const ctx = ctxFor(adapter.key, input, result, deps);
  const hidden = hiddenSetOf(props);
  const [no, ...rest] = renumberTitle(adapterTitle(adapter, input.specs), moduleNo).split(" · ");
  /**
   * Bölüm bu rapora giriyor mu — hem SÜZGEÇ hem NUMARANIN dayanağı.
   * İkisi tek yüklemden okur: numara basılan bölümlerin sırasıdır, ayrı
   * yazılsalardı gizlenen bölüm süzülür ama numarası harcanmaya devam ederdi.
   */
  const sectionPrinted = sectionPrintedFor(adapter, input.specs, hidden);
  // Numaralar bölümlerden ÖNCE tek seferde çözülür: gizlenen ya da o vinçte
  // olmayan bölüm numarasını da götürür, sonrakiler bir öne kayar.
  const secNos = sectionDisplayNumbers(adapter.sections, moduleNo, sectionPrinted);

  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageProbe anchor={anchorFor(adapter.key)} collect={collect} />
      <PageHeader
        kicker={`BÖLÜM ${no}`}
        title={rest.join(" · ")}
        meta="FEM 1.001 · DIN 15018 · CMAA 70"
      />
      {adapter.sections
        .filter(sectionPrinted)
        .map((section, si) => {
        const inputs = state.inputs;
        const scoped = section.inputScope ? section.inputScope.get(inputs) : inputs;
        const { byRow, rest } = distributeChecks(adapter, section, mr);
        const secChecks = sectionChecks(adapter, section, mr);
        const diagrams = diagramsForSection(adapter.key, section.rawId, input, result);
        const secNo = secNos.get(section.rawId) ?? renumberSectionId(section.id, moduleNo);

        // Bölüm gövdesi düz bir PARÇA dizisidir. Her alt başlık kendi ilk
        // satırıyla birlikte tek bir bölünemez kutuya konur (KeepWithNext).
        const body: React.ReactNode[] = [];
        const add = (node: React.ReactNode) =>
          body.push(<React.Fragment key={body.length}>{node}</React.Fragment>);
        const addHeaded = (tr: string, first: React.ReactNode, more: React.ReactNode[] = []) => {
          add(
            <KeepWithNext>
              <SubHead tr={tr} />
              {first}
            </KeepWithNext>
          );
          for (const n of more) add(n);
        };

        // Diyagramlar: her biri kendi başına bölünemez bir parça
        for (const [i, d] of diagrams.entries()) add(<PdfDiagram key={i} diagram={d} />);

        const inputTables: React.ReactNode[] = [];
        if (section.inputDefs.length > 0) {
          inputTables.push(<FieldTable key="in" defs={section.inputDefs} source={scoped} specs={input.specs} />);
        }
        if (section.extraInputDefs && section.extraInputDefs.length > 0) {
          inputTables.push(<FieldTable key="ex" defs={section.extraInputDefs} source={inputs} specs={input.specs} />);
        }
        if (inputTables.length > 0) {
          addHeaded("GİRDİLER / TASARIM KABULLERİ", inputTables[0], inputTables.slice(1));
        }

        // Başlık kontrolü (madde 3 / madde 7): editördekiyle AYNI özet şerit.
        // "band" yerleşiminde girdilerle katalog seçimi ARASINA, "catalog"
        // yerleşiminde katalog seçim başlığının altına girer.
        const headline = section.headline;
        const headlineNodes = headline
          ? headlineItems(adapter.checkPrefix, section, mr.checks).map((it) => (
              <HeadlineLine key={it.check.id} item={it} headline={headline} />
            ))
          : [];
        if (headline?.placement === "band" && headlineNodes.length > 0) {
          addHeaded(
            (headline.title ?? "ÖZET").toLocaleUpperCase("tr-TR"),
            headlineNodes[0],
            headlineNodes.slice(1)
          );
        }

        // `visibleWhen` seçim alanlarında EKRANLA AYNI süzgeci uygular: lamel
        // kanca seçilmiş bir raporda DIN 15400 mukavemet sınıfı satırı basılsa,
        // rapor sorulmamış bir soruya cevap veriyor gibi görünürdü. (Girdi
        // ızgarasının süzgeci ayrıdır ve bugünkü davranışını korur.)
        const visibleSelectionDefs = section.selectionDefs.filter(
          (f) => !f.visibleWhen || f.visibleWhen(state.selections as Record<string, unknown>)
        );
        if (visibleSelectionDefs.length > 0) {
          const selectionTable = (
            <FieldTable defs={visibleSelectionDefs} source={state.selections} labelMono specs={input.specs} />
          );
          // "catalog" yerleşiminde rozetler başlığın hemen altındadır: başlık
          // ilk parçasıyla birlikte taşınır (KeepWithNext), tablo peşinden gelir.
          if (headline?.placement === "catalog" && headlineNodes.length > 0) {
            addHeaded("KATALOG SEÇİMİ", headlineNodes[0], [
              ...headlineNodes.slice(1),
              selectionTable,
            ]);
          } else {
            addHeaded("KATALOG SEÇİMİ", selectionTable);
          }
        }

        // Madde 23 / 25: seçenekli ekipmanlar. Blok yalnız gerçekten birden
        // çok seçenek varsa basılır; yoksa bölüm çıktısı hiç değişmez.
        const altNodes = altOptionNodes(
          adapter.key,
          section,
          state,
          props.alts?.[altKeyFor(adapter.key, section.rawId)],
          input.specs,
          deps
        );
        if (altNodes.length > 0) {
          addHeaded("SEÇENEKLER", altNodes[0], altNodes.slice(1));
        }

        if (section.table) {
          for (const n of sectionTableParts(section.table, ctx)) add(n);
        }

        const visibleRows = section.rows.filter((r) => !r.visible || r.visible(ctx));
        if (visibleRows.length > 0) {
          const rowNodes = visibleRows.map((r, i) => (
            <CalcRowLine
              key={r.key}
              row={r}
              ctx={ctx}
              showFormulas={showFormulas}
              checks={byRow.get(r.anchorId)}
              stepNo={`${secNo}.${String(i + 1).padStart(2, "0")}`}
            />
          ));
          addHeaded("HESAP VE KONTROLLER", rowNodes[0], rowNodes.slice(1));
        }

        if (rest.length > 0) {
          const checkNodes = rest.map((c) => <CheckLine key={c.id} check={c} />);
          addHeaded("DİĞER KONTROLLER", checkNodes[0], checkNodes.slice(1));
        }

        const sectionNote = props.sectionNotes?.[
          sectionNoteKeyFor(adapter.key, section.rawId)
        ]?.trim();
        if (sectionNote) addHeaded("BÖLÜM NOTU", <EngineeringNote note={sectionNote} />);

        return (
          // Bölüm SARMALAYICI KUTUYA konmaz, düz bir kardeş dizisi olarak akar.
          // İki ayrı tuzak vardır ve ikisinden de bu yapı kurtarır:
          //   1) Bölümün TAMAMINI kapsayan kutuya minPresenceAhead konursa
          //      react-pdf "kutunun hepsi + boşluk sığmıyor" deyip bloğu
          //      tümüyle sonraki sayfaya atar, geride BOŞ sayfa kalır.
          //   2) Kutu minPresenceAhead'siz bırakılsa bile, içindeki İLK çocuk
          //      olan başlığın kendi minPresenceAhead'i çalışmaz: react-pdf
          //      sayfa bölmenin "görünürlüğü artıracağını" ancak düğümden ÖNCE
          //      yerleşmiş bir kardeş varsa kabul eder. Madde 29'daki dul
          //      başlıkların (2.5 FREN, KATALOG SEÇİMİ…) kök nedeni budur.
          // Bölümler arası boşluk marjla verilir.
          <React.Fragment key={section.id}>
            {/* Bölüm başlığı + gövdenin İLK parçası ayrılmaz: başlık asla
                sayfa dibinde yalnız kalmaz (madde 29). Sayfa sondası da bu
                kutunun İÇİNDEDİR — dışarıda kalsaydı başlık sonraki sayfaya
                taşındığında sonda önceki sayfanın dibinde kalır ve kontrol
                özetine bir eksik sayfa numarası yazardı. */}
            <View wrap={false} style={si === 0 ? undefined : { marginTop: 12 }}>
              <SectionProbe anchor={sectionAnchor(adapter.key, section.rawId)} collect={collect} />
              <SectionTag
                no={secNo}
                title={section.title}
                status={
                  secChecks.length > 0
                    ? { pass: secChecks.filter((c) => c.pass).length, total: secChecks.length }
                    : undefined
                }
              />
              {body[0]}
            </View>
            {body.slice(1)}
          </React.Fragment>
        );
      })}
    </BrandPage>
  );
}

// ---------------------------------------------------------------- Belge

export function ReportDocument(
  props: ReportProps & {
    /** Çapa → başlangıç sayfası (ikinci geçişte dolu) */
    pageOf?: Record<string, number>;
    /** İlk geçişte sayfa numaralarını toplayan geri çağrı */
    collect?: (anchor: string, page: number) => void;
  }
) {
  const { input, result, project, revision, pageOf, collect } = props;
  const level: ReportLevel = props.level ?? "detayli";
  const deps = buildModuleDeps(input, result);
  // Esnek modüller: revizyonda olmayan modül (yardımcı kaldırma / kanca bloğu
  // kapalı) rapora girmez; numaralar mevcut modüllere göre yeniden dizilir.
  // Yüklem BASILAN bölümü tarif eder (`modulePrintedIn`), yalnız girdisi olanı
  // değil — numara, içindekiler ve sayfa üretimi üçü birden ondan okur.
  const present = modulePrintedIn(props);
  const numbers = moduleDisplayNumbers(present);
  return (
    <Document
      title={`${project.doc_no}-V${revision.rev_no} Hesap Raporu`}
      author={(props.settings ?? DEFAULT_REPORT_SETTINGS).company}
      subject={`${project.customer} — ${project.name}`}
      language="tr"
    >
      <CoverPage {...props} />
      {/* ÖZET rapor içindekiler taşımaz (kullanıcı kararı): iki sayfalık bir
          belgede dizin, gösterdiği içerikten uzun olurdu. */}
      {level !== "ozet" && (
        <TocPage
          {...props}
          level={level}
          numbers={numbers}
          present={present}
          pageOf={pageOf ?? {}}
        />
      )}
      <SummarySection {...props} numbers={numbers} collect={collect} />
      {level !== "ozet" &&
        MODULE_ADAPTERS.filter((a) => present(a.key)).map((adapter) => (
          <ModulePage
            key={adapter.key}
            adapter={adapter}
            props={props}
            deps={deps}
            showFormulas={level === "detayli"}
            moduleNo={numbers[adapter.key] ?? 0}
            collect={collect}
          />
        ))}
      {/* KONTROL ÖZETİ YALNIZ DETAYLI RAPORDADIR (kullanıcı kararı,
          12.08.2026). Liste bir DİZİNdir: her satırın solunda kontrolün
          dayandığı hesabın sayfası vardır ve o hesap yalnız detaylı raporda
          tam olarak basılır. Standart raporda satır içi kontroller zaten
          bölümlerinde durur, özet raporda ise gidilecek bir hesap sayfası
          yoktur — dizin ikisinde de kendi kaynağını gösteremezdi. */}
      {level === "detayli" && (
        <ChecksSummarySection
          {...props}
          numbers={numbers}
          pageOf={pageOf ?? {}}
          collect={collect}
        />
      )}
      {/* ÖZET raporda Ek (Kaynaklar) ve gizlilik koşulları da yoktur. */}
      {level !== "ozet" && <SourcesSection {...props} level={level} />}
    </Document>
  );
}

/**
 * Revizyon PDF'ini üretir (route handler + yayınlama arşivi ortak girişi).
 *
 * İKİ GEÇİŞ: içindekiler tablosunda gerçek sayfa numaraları yazabilmek için
 * belge önce bir kez yerleştirilir (bu sırada her bölümün başladığı sayfa
 * toplanır), sonra numaralarla yeniden üretilir. Bölüm sayısı ve sayfa
 * uzunlukları önceden bilinemediğinden başka bir yolu yoktur; ikinci geçiş
 * yalnız yerleşim tekrarıdır, hesap yeniden koşmaz.
 */
export async function renderReportPdf(props: ReportProps): Promise<Buffer> {
  const pageOf: Record<string, number> = {};
  const collect = (anchor: string, page: number) => {
    // SON yazan kazanır. react-pdf sayfa bölerken dinamik düğümleri her aday
    // sayfa için YENİDEN çalıştırır; ara değerler bölümün gerçek yerini
    // göstermez. Kesin numara, yerleşim bittikten sonra sayfa indekslerini
    // çözen son geçişten gelir ve en sonda yazılır. (En küçüğü almak, ilerideki
    // bir bölüme geçici olarak hesaplanan erken sayfayı kalıcılaştırıyordu.)
    pageOf[anchor] = page;
  };
  await renderToBuffer(<ReportDocument {...props} collect={collect} />);
  return renderToBuffer(<ReportDocument {...props} pageOf={pageOf} />);
}
