// PDF hesap raporu — @react-pdf/renderer Document bileşeni.
// Marka Kimliği Kılavuzu REV 01 dili: Archivo gövde, IBM Plex Mono sayı/kod/etiket,
// kırmızı omurga + folio altbilgili BrandPage sayfaları (bkz. brand.tsx).
// İçerik modül adaptörlerinden (module-adapters.ts) üretilir; editör ile
// birebir aynı bölüm/satır/kontrol yapısı PDF'e dökülür.
// Yalnızca sunucuda çalışır (brand.tsx fontları dosya sisteminden okur).

import fs from "node:fs";
import path from "node:path";
import {
  Circle,
  Document,
  Font,
  Image,
  Line,
  Path,
  Polygon,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Diagram, DiagramEl } from "@/lib/diagrams/model";
import { diagramForSection } from "@/lib/diagrams/select";
import {
  BRAND,
  BrandPage,
  CheckGlyph,
  FONTS,
  Link,
  PageHeader,
  RuleRed,
  SectionTag,
  T,
} from "@/lib/pdf/brand";
import { PdfMath } from "@/lib/pdf/pdf-math";
import { toDisplayUnit, toDisplayUnitLabel } from "@/lib/units";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { SPEC_FIELDS, fieldLabel } from "@/lib/calc/fields";
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
  MODULE_ADAPTERS,
  buildModuleDeps,
  moduleDisplayNumbers,
  renumberSectionId,
  renumberTitle,
  type AdapterSection,
  type AnyFieldDef,
  type ModuleAdapter,
  type ModuleDepsBundle,
  type ModuleKey,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

// Orion Cranes logosu (kırmızı kilit, şeffaf zemin) — public/brand klasörü
// Vercel trace'ine next.config.ts outputFileTracingIncludes ile dahil edilir.
// Not: react-pdf string src'yi URL olarak fetch etmeye çalışır (Windows yolunda
// başarısız olur); bu yüzden dosya Buffer olarak okunup verilir.
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "orion-logo.png");
const LOGO_DATA = fs.readFileSync(LOGO_PATH);

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
 * Rapor seviyesi:
 * - "ozet": kapak + içindekiler + özet bölümü (kontroller dahil)
 * - "standart": + modül bölümleri (hesap satırlarında yalnız sonuç) + diyagramlar
 * - "detayli": tam rapor (formül/değer yerine koyma satırları dahil) — varsayılan
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
  input: CalcInput;
  result: CalcResult;
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
  const rev = String(revision.rev_no).padStart(2, "0");
  return `ORION CRANES · HESAP RAPORU · REV ${rev} · ${reportDate(revision).getFullYear()}`;
}

/** Doküman kodu: `ORC-HR-412-R03` */
function docCodeFor(project: ReportProject, revision: ReportRevision): string {
  return `ORC-HR-${project.doc_no}-R${String(revision.rev_no).padStart(2, "0")}`;
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
  coverLogo: { width: 168, height: 18.9 }, // 596×67 px oranı korunur
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
  kvCol: { flex: 1 },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.hairline,
    paddingVertical: 2.4,
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
  tblHeadCell: { fontFamily: FONTS.mono, fontSize: 6.2, fontWeight: 700, color: BRAND.gray700, paddingVertical: 3, paddingHorizontal: 2.5, lineHeight: 1.25 },
  tblCell: { fontFamily: FONTS.sans, fontSize: 6.8, color: BRAND.ink, paddingVertical: 2.4, paddingHorizontal: 2.5, lineHeight: 1.25 },
  tblCellNum: { fontFamily: FONTS.mono, fontSize: 6.8, color: BRAND.ink, paddingVertical: 2.4, paddingHorizontal: 2.5, lineHeight: 1.25, textAlign: "right" },
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
  // ---- içindekiler sayfasındaki okuma anahtarı
  legendHead: { fontFamily: FONTS.mono, fontSize: 6.6, fontWeight: 600, letterSpacing: 0.8, color: BRAND.red, marginBottom: 2.5 },
  legendText: { fontFamily: FONTS.sans, fontSize: 7.2, lineHeight: 1.45, color: BRAND.gray700 },
  legendRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 1.5 },
  legendKey: { width: 58, flexShrink: 0, fontFamily: FONTS.mono, fontSize: 6.8, color: BRAND.ink },
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
 */
function SubHead({ tr, minPresenceAhead = 46 }: { tr: string; minPresenceAhead?: number }) {
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

/**
 * Rapora girecek teknik özellik alanları: vince dahil olmayan hesap
 * bölümlerinin alanları (kapalı yardımcı kaldırma, olmayan monoray) basılmaz.
 */
function specFieldsFor(input: CalcInput): AnyFieldDef[] {
  return (SPEC_FIELDS as AnyFieldDef[]).filter((f) => {
    const req = (f as { requiresModule?: ModuleKey }).requiresModule;
    return !req || moduleState(input, req) !== undefined;
  });
}

/** Alan listesini iki sütuna bölerek etiket-değer tablosu basar */
function FieldTable({
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
    <View style={s.kvGrid}>
      {cols.map((col, i) => (
        <View style={s.kvCol} key={i}>
          {col.map((f) => {
            const labels = (f as { optionLabels?: Record<string, string> }).optionLabels;
            const val = labels?.[String(rec[f.key])] ?? fmtField(rec[f.key]);
            return (
              <KvRow
                key={f.key}
                label={fieldLabel(f, specs)}
                value={val}
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
  return (
    <View style={s.cmp}>
      <Text style={s.cmpLabel}>HESAPLANAN </Text>
      <Text style={[s.cmpValue, { color }]}>
        {fmt(computed.value)}
        {unit ? <Text style={s.cmpUnit}>{unit}</Text> : null}
      </Text>
      {d.operator === "…" ? (
        <Text style={s.cmpLabel}>{"   "}</Text>
      ) : (
        <Text style={s.cmpOp}> {d.operator} </Text>
      )}
      <Text style={s.cmpLabel}>İZİN VERİLEN </Text>
      <Text style={s.cmpValue}>
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

// ---------------------------------------------------------------- Kapak

/** Kapak künyesi: kılavuz spec sırası — kapasite → açıklık → kanca yolu → FEM */
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
    out.push({ label: "KANCA YOLU", value: `${fmt(sp.mainLiftHeightM)} m` });
  const duty = [sp.hoistLoadClass, sp.hoistMechanismClass].filter(Boolean).join(" / ");
  if (duty) out.push({ label: "FEM SINIFI", value: duty });
  return out;
}

function CoverPage(props: ReportProps) {
  const { project, revision, preparedBy, input } = props;
  const st = { ...DEFAULT_REPORT_SETTINGS, ...props.settings };
  const dateLabel = reportDateLabel(revision);
  const docCode = docCodeFor(project, revision);
  const contact = [st.address, st.phone, st.email, st.web]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("  ·  ");
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCode} hideFooterRule>
      {/* Üst bant: lockup logo + sağda mono doküman kimliği */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottomWidth: 1.4,
          borderBottomColor: BRAND.ink,
          paddingBottom: 10,
        }}
      >
        <Image style={s.coverLogo} src={LOGO_DATA} />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ ...T.data, color: BRAND.gray600 }}>{docCode}</Text>
          <Text style={{ ...T.data, color: BRAND.gray600, marginTop: 1.5 }}>
            REV {String(revision.rev_no).padStart(2, "0")} · {dateLabel}
          </Text>
        </View>
      </View>

      {/* Başlık bloğu */}
      <View style={{ marginTop: 84 }}>
        <Text style={T.kicker}>ORION CRANES · HESAP RAPORU</Text>
        <RuleRed width={22} />
        <Text style={{ ...T.display, marginTop: 12 }}>
          {project.name.toLocaleUpperCase("tr-TR")}
        </Text>
        <Text style={{ ...T.caption, marginTop: 6 }}>{project.crane_type}</Text>
      </View>

      {/* Künye: kapasite → açıklık → kanca yolu → FEM sınıfı */}
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

      {/* Hesabın dayandığı standartlar — kapakta künyeden hemen sonra */}
      <View style={{ marginTop: 26 }}>
        <Text style={T.kickerInk}>DAYANAK STANDARTLAR</Text>
        <RuleRed width={16} />
        <Text style={{ ...T.caption, marginTop: 6, color: BRAND.gray700 }}>
          FEM 1.001 (3. Baskı) — sınıflandırma, yükler, mekanizma seçimi{"\n"}
          DIN 15018 — çelik yapı yorulması{"\n"}
          DIN 15400 / 15401 / 15402 — kanca · DIN 15061 — halat oluğu{"\n"}
          CMAA 70 — motor gücü, mil gerilmeleri, sehim sınırı
        </Text>
      </View>

      {/* Meta: müşteri / tarih / hazırlayan / revizyon */}
      <View style={{ marginTop: "auto" }}>
        <View style={{ flexDirection: "row", gap: 18, marginBottom: 14 }}>
          <View style={{ flex: 1.4 }}>
            <Text style={s.coverMetaLabel}>MÜŞTERİ</Text>
            <Text style={s.coverMetaValue}>{project.customer.toLocaleUpperCase("tr-TR")}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>TARİH</Text>
            <Text style={{ ...T.data }}>{dateLabel}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coverMetaLabel}>HAZIRLAYAN</Text>
            {/* Hazırlayan boş kalabilir (profil adı girilmemiş olabilir);
                rapor bu yüzden üretilememezlik etmemeli. */}
            <Text style={s.coverMetaValue}>
              {(preparedBy ?? "—").toLocaleUpperCase("tr-TR")}
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
        <View style={{ borderTopWidth: 0.75, borderTopColor: BRAND.line300, paddingTop: 4 }}>
          <Text style={T.micro}>
            {st.company} · {contact || st.city}
          </Text>
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
function anchorFor(key: ModuleKey | "ozet" | "specs"): string {
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
  present: (k: ModuleKey) => boolean
): TocEntry[] {
  const out: TocEntry[] = [
    { no: "—", title: "Özet Hesap Raporu", anchor: anchorFor("ozet") },
  ];
  if (level === "ozet") return out;
  out.push({ no: "01", title: "Teknik Özellikler", anchor: anchorFor("specs") });
  for (const a of MODULE_ADAPTERS) {
    if (!present(a.key)) continue;
    const [no, ...rest] = renumberTitle(a.title, numbers[a.key] ?? 0).split(" · ");
    out.push({ no, title: rest.join(" · "), anchor: anchorFor(a.key) });
  }
  return out;
}

function TocPage({
  project, revision, level,
  numbers, present, pageOf,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  present: (k: ModuleKey) => boolean;
  /** Çapa → başladığı sayfa numarası (ilk geçişte boş) */
  pageOf: Record<string, number>;
}) {
  const entries = tocEntries(level ?? "detayli", numbers, present);
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

      {/* Raporu okuma anahtarı — hesap satırının ve kontrol rozetinin anatomisi */}
      <View style={{ marginTop: 26 }}>
        <Text style={T.kickerInk}>RAPORU OKUMA ANAHTARI</Text>
        <View style={{ height: 1.2, backgroundColor: BRAND.ink, marginTop: 4, marginBottom: 8 }} />
        <View style={s.kvGrid}>
          <View style={s.kvCol}>
            <Text style={s.legendHead}>HESAP SATIRI</Text>
            <Text style={s.legendText}>
              Her hesap adımı kalıcı bir adım numarasıyla anılır (ör. 7.4.13): solda numara şeridi,
              ortada büyüklüğün adı ve sembolik bağıntısı, sağda çerçeveli sonuç ve birimi bulunur.
              Bağıntının altında dayandığı standart maddesi yazılıdır.
            </Text>
            <Text style={[s.legendHead, { marginTop: 8 }]}>KONTROL ŞERİDİ</Text>
            <Text style={s.legendText}>
              Bir adıma bağlı kontrol varsa satırın sol şeridi renklenir ve altına
              «HESAPLANAN … ≤ İZİN VERİLEN …» karşılaştırması eklenir. Yeşil şerit uygun,
              kırmızı şerit uygun değil demektir.
            </Text>
          </View>
          <View style={s.kvCol}>
            <Text style={s.legendHead}>KONTROLÜN DAYANAĞI</Text>
            {[
              ["standart", "FEM / DIN / CMAA maddesi şart koşuyor (etiket yazılmaz)"],
              ["üretici", "katalog/üretici kriteri"],
              ["firma kabulü", "Orion tasarım kabulü"],
              ["bilgilendirme", "sınır değil, bilgi amaçlı"],
            ].map(([k, v]) => (
              <View key={k} style={s.legendRow}>
                <Text style={s.legendKey}>{k}</Text>
                <Text style={[s.legendText, { flex: 1 }]}>{v}</Text>
              </View>
            ))}
            <Text style={[s.legendHead, { marginTop: 8 }]}>AĞIRLIK</Text>
            <View style={s.legendRow}>
              <Text style={s.legendKey}>engelleyici</Text>
              <Text style={[s.legendText, { flex: 1 }]}>
                sağlanmadan rapor yayınlanmamalıdır (varsayılan)
              </Text>
            </View>
            <View style={s.legendRow}>
              <Text style={s.legendKey}>uyarı</Text>
              <Text style={[s.legendText, { flex: 1 }]}>
                gözden geçirilmeli, yayını tek başına engellemez
              </Text>
            </View>
            <Text style={[s.legendHead, { marginTop: 8 }]}>BİRİMLER</Text>
            <Text style={s.legendText}>
              Gerilmeler MPa, momentler Nm, uzunluklar mm/cm/m, hızlar m/dak, devir d/dak.
            </Text>
          </View>
        </View>
      </View>
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

// ---------------------------------------------------------------- Özet

interface SummaryGroup {
  title: string;
  items: { label: string; value: string }[];
}

function hoistSelectionItems(st: { selections: object } | undefined): SummaryGroup["items"] {
  if (!st) return [];
  const sel = st.selections as Record<string, unknown>;
  const n = (k: string) => sel[k] as number | undefined;
  const t = (k: string) => (sel[k] as string | undefined) ?? "";
  return [
    {
      label: "Halat",
      value: `${t("ropeBrand")} Ø${fmt(n("ropeDiaMm"))} mm ${t("ropeConstruction")} ${t(
        "ropeCore"
      )} · ${fmt(n("ropeBreakingLoadKn"))} kN`,
    },
    { label: "Tambur", value: `Ø${fmt(n("drumDiaMm"))} mm · ${t("drumMaterial")}` },
    {
      label: "Redüktör",
      value: `${t("gearboxModel")} · i=${fmt(n("gearboxRatio"))} · ${fmt(
        n("gearboxNominalTorqueKnm")
      )} kNm`,
    },
    {
      label: "Motor",
      value: `${t("motorBrand")} ${fmt(n("motorPowerKw"))} kW · ${fmt(
        n("motorRpm")
      )} d/dak × ${fmt(n("motorCount"))}`,
    },
    {
      label: "Fren",
      value: `${t("brakeBrand")} ${t("brakeModel")} · ${fmt(n("brakeTorqueNm"))} Nm × ${fmt(
        n("brakeQty")
      )}`,
    },
    {
      label: "Motor kaplini",
      value: `${t("motorCouplingBrand")} ${t("motorCouplingModel")} · ${fmt(
        n("motorCouplingTorqueNm")
      )} Nm`,
    },
    {
      label: "Tambur kaplini",
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
      value: `Ø${fmt(n("wheelDiaMm"))} mm · ${t("wheelMaterial")} · ray ${t("railCode")}`,
    },
    {
      label: "Motor",
      value: `${t("motorBrand")} ${fmt(n("motorPowerKw"))} kW · ${fmt(
        n("motorRpm")
      )} d/dak × ${fmt(n("motorCount"))}`,
    },
    {
      label: "Redüktör",
      value: `${t("gearboxModel")} · i=${fmt(n("gearboxRatio"))} · ${fmt(
        n("gearboxOutputTorqueKnm")
      )} kNm`,
    },
    {
      label: "Motor kaplini",
      value: `${t("motorCouplingBrand")} ${t("motorCouplingModel")} · ${fmt(
        n("motorCouplingTorqueNm")
      )} Nm`,
    },
    {
      label: "Teker kaplini",
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
function summaryGroups(input: CalcInput): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  for (const key of MODULE_ORDER) {
    const state = moduleState(input, key);
    if (!state) continue;
    const title = (MODULE_LABELS[key] ?? key).replace(/^\d+\s*·\s*/, "");
    if (isHoistKey(key)) {
      groups.push({ title, items: hoistSelectionItems(state as never) });
    } else if (isHookBlockKey(key)) {
      const sel = state.selections as unknown as Record<string, unknown>;
      groups.push({
        title,
        items: [
          {
            label: "Kanca",
            value: `${String(sel.hookDesignation ?? "")} · ${fmt(
              sel.hookCapacityKg as number
            )} kg`,
          },
          {
            label: "Makara",
            value: `Ø${fmt(sel.sheaveDiaMm as number)} mm · rulman ${String(
              sel.sheaveBearingCode ?? ""
            )}`,
          },
        ],
      });
    } else if (isTravelKey(key)) {
      groups.push({ title, items: travelSelectionItems(state as never) });
    }
  }
  return groups.filter((g) => g.items.length > 0);
}

function SummarySection({
  input, result, project, revision, numbers, collect,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  collect?: (anchor: string, page: number) => void;
}) {
  const groups = summaryGroups(input);
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
      <FieldTable defs={specFieldsFor(input)} source={input.specs} specs={input.specs} />

      <SubHead tr="ANA EKİPMAN SEÇİMLERİ" />
      <View style={s.kvGrid}>
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

      <SubHead tr="KONTROLLER" />
      {MODULE_ADAPTERS.map((adapter) => {
        const mr = moduleResult(result, adapter.key);
        if (!mr || mr.checks.length === 0) return null;
        return (
          <View key={adapter.key} style={s.sumModule}>
            {/* minPresenceAhead YALNIZ başlığa: uzun bir kutuya konursa
                react-pdf "tamamı + boşluk sığmıyor" deyip bloğun hepsini
                sonraki sayfaya atar ve geride BOŞ sayfa bırakır. */}
            <Text style={s.sumModuleTitle} minPresenceAhead={34}>
              {renumberTitle(adapter.title, numbers[adapter.key] ?? 0)}
            </Text>
            {mr.checks.map((c) => (
              <CheckLine key={c.id} check={c} />
            ))}
          </View>
        );
      })}
    </BrandPage>
  );
}

// ---------------------------------------------------------------- Diyagramlar

// Saf Diagram modelini react-pdf Svg karşılığına çizer (web ile aynı üreticiler).
function pdfDiagramEl(el: DiagramEl, i: number) {
  switch (el.kind) {
    case "line":
      return (
        <Line
          key={i}
          x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
          stroke={el.stroke} strokeWidth={el.strokeWidth}
          strokeDasharray={el.dash} strokeLinecap={el.cap}
        />
      );
    case "rect":
      return (
        <Rect
          key={i}
          x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx}
          fill={el.fill ?? "none"} stroke={el.stroke} strokeWidth={el.strokeWidth}
        />
      );
    case "circle":
      return (
        <Circle
          key={i}
          cx={el.cx} cy={el.cy} r={el.r}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
        />
      );
    case "path":
      return (
        <Path
          key={i}
          d={el.d}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
          strokeLinecap={el.cap}
        />
      );
    case "polygon":
      return (
        <Polygon
          key={i}
          points={el.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={el.fill ?? "none"} stroke={el.stroke} strokeWidth={el.strokeWidth}
        />
      );
    case "text":
      return (
        <Text
          key={i}
          x={el.x} y={el.y}
          fill={el.fill}
          textAnchor={el.anchor}
          style={{
            // Diyagram metinleri DejaVu kalır: teknik semboller (Ø, ölçü okları,
            // Yunan harfleri) mono/Archivo kapsamı dışında olabilir.
            fontFamily: "DejaVu",
            fontSize: el.size,
            fontWeight: el.bold ? "bold" : undefined,
          }}
        >
          {el.text}
        </Text>
      );
  }
}

function PdfDiagram({ diagram }: { diagram: Diagram }) {
  // Sayfa içerik genişliği ~490pt; diyagram 468pt'e ölçeklenir
  const w = 468;
  const h = (diagram.height / diagram.width) * w;
  return (
    <View
      wrap={false}
      style={{
        marginTop: 5,
        marginBottom: 5,
        borderWidth: 0.75,
        borderColor: BRAND.line300,
        backgroundColor: BRAND.white,
        paddingVertical: 5,
        alignItems: "center",
      }}
    >
      {/* viewBox köşesi diyagramdan gelir: içerik 0'ın soluna taşarsa
          (uzun sol etiketler) kırpılmasın diye kutu o yöne büyütülmüştür. */}
      <Svg
        width={w}
        height={h}
        viewBox={`${diagram.x0 ?? 0} ${diagram.y0 ?? 0} ${diagram.width} ${diagram.height}`}
      >
        {diagram.els.map(pdfDiagramEl)}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- Modül bölümleri

/**
 * Bölüm sonundaki özet tablosu — web editöründeki `SectionTable`'ın PDF
 * karşılığı. İlk sütun geniş, kalanlar eşit paylaşır; sayısal hücreler sağa
 * yaslı ve mono basılır.
 */
function PdfSectionTable({
  table,
  ctx,
}: {
  table: NonNullable<AdapterSection["table"]>;
  ctx: unknown;
}) {
  let rows: (string | number)[][] = [];
  try {
    rows = table.build(ctx);
  } catch {
    rows = [];
  }
  if (rows.length === 0) return null;
  const n = table.headers.length;

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

  return (
    <View style={{ marginTop: 4 }}>
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
      {rows.map((r, ri) => (
        <View key={ri} style={s.tblRow} wrap={false}>
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
      ))}
      {table.note ? <Text style={s.tblNote}>{table.note}</Text> : null}
    </View>
  );
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
            <Text style={[s.calcValue, { marginLeft: 3 }]}>{fmt(value, row.digits ?? 2)}</Text>
            {unit ? <Text style={s.calcUnit}>{unit}</Text> : null}
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
  const [no, ...rest] = renumberTitle(adapter.title, moduleNo).split(" · ");

  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageProbe anchor={anchorFor(adapter.key)} collect={collect} />
      <PageHeader
        kicker={`BÖLÜM ${no}`}
        title={rest.join(" · ")}
        meta="FEM 1.001 · DIN 15018 · CMAA 70"
      />
      {adapter.sections.map((section) => {
        const inputs = state.inputs;
        const scoped = section.inputScope ? section.inputScope.get(inputs) : inputs;
        const { byRow, rest } = distributeChecks(adapter, section, mr);
        const secChecks = sectionChecks(adapter, section, mr);
        const diagram = diagramForSection(adapter.key, section.rawId, input, result);
        return (
          // DİKKAT: bu sarmalayıcıya minPresenceAhead KONMAZ. react-pdf ölçüyü
          // "kutunun tamamı + istenen boşluk" olarak okur; bölüm bir sayfaya
          // sığmadığında tamamını sonraki sayfaya atar ve geride yalnız sayfa
          // başlığının olduğu BOŞ bir sayfa bırakırdı (bkz. eski s.39, s.59).
          // Dul/yetim koruması başlıkların kendisinde (SectionTag / SubHead).
          <View key={section.id} style={{ marginBottom: 12 }}>
            {/* Başlık + diyagram bir arada kalır (kaymayı önler) */}
            <View wrap={false}>
              <SectionTag
                no={renumberSectionId(section.id, moduleNo)}
                title={section.title}
                status={
                  secChecks.length > 0
                    ? { pass: secChecks.filter((c) => c.pass).length, total: secChecks.length }
                    : undefined
                }
              />
              {diagram && <PdfDiagram diagram={diagram} />}
            </View>
            {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
              <View>
                <SubHead tr="GİRDİLER / TASARIM KABULLERİ" />
                <FieldTable defs={section.inputDefs} source={scoped} specs={input.specs} />
                {section.extraInputDefs && section.extraInputDefs.length > 0 && (
                  <FieldTable defs={section.extraInputDefs} source={inputs} specs={input.specs} />
                )}
              </View>
            )}
            {section.selectionDefs.length > 0 && (
              <View>
                <SubHead tr="KATALOG SEÇİMİ" />
                <FieldTable defs={section.selectionDefs} source={state.selections} labelMono specs={input.specs} />
              </View>
            )}
            {section.table && <PdfSectionTable table={section.table} ctx={ctx} />}
            {section.rows.length > 0 && (
              <View>
                <SubHead tr="HESAP VE KONTROLLER" />
                {section.rows.map((r, i) => (
                  <CalcRowLine
                    key={r.key}
                    row={r}
                    ctx={ctx}
                    showFormulas={showFormulas}
                    checks={byRow.get(r.anchorId)}
                    stepNo={`${renumberSectionId(section.id, moduleNo)}.${String(i + 1).padStart(2, "0")}`}
                  />
                ))}
              </View>
            )}
            {rest.length > 0 && (
              <View>
                <SubHead tr="DİĞER KONTROLLER" />
                {rest.map((c) => (
                  <CheckLine key={c.id} check={c} />
                ))}
              </View>
            )}
          </View>
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
  const present = (k: ModuleKey) => moduleState(input, k) !== undefined;
  const numbers = moduleDisplayNumbers(present);
  return (
    <Document
      title={`${project.doc_no}-V${revision.rev_no} Hesap Raporu`}
      author={(props.settings ?? DEFAULT_REPORT_SETTINGS).company}
      subject={`${project.customer} — ${project.name}`}
      language="tr"
    >
      <CoverPage {...props} />
      <TocPage
        {...props}
        level={level}
        numbers={numbers}
        present={present}
        pageOf={pageOf ?? {}}
      />
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
    // İlk yakalanan (en küçük) sayfa geçerlidir: bölüm oradan başlar.
    if (pageOf[anchor] === undefined || page < pageOf[anchor]) pageOf[anchor] = page;
  };
  await renderToBuffer(<ReportDocument {...props} collect={collect} />);
  return renderToBuffer(<ReportDocument {...props} pageOf={pageOf} />);
}
