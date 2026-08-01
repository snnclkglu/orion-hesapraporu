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
  PageHeader,
  RuleRed,
  SectionTag,
  T,
} from "@/lib/pdf/brand";
import { PdfMath } from "@/lib/pdf/pdf-math";
import { toDisplayUnit, toDisplayUnitLabel } from "@/lib/units";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { SPEC_FIELDS } from "@/lib/calc/fields";
import type { AnyCheck, ModuleResult } from "@/lib/calc/types";
import type { HoistCtx } from "@/lib/calc/presentation/hoistSections";
import type { HookBlockCtx } from "@/lib/calc/presentation/hookBlockSections";
import type { TravelCtx } from "@/lib/calc/presentation/travelSections";
import type { GirderCtx } from "@/lib/calc/presentation/girderSections";
import type { BucklingCtx } from "@/lib/calc/presentation/bucklingSections";
import type { EndCarriageCtx } from "@/lib/calc/presentation/endCarriageSections";
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

// Modül anahtarı -> CalcInput / CalcResult erişimi (editor'daki desenle aynı)

function moduleState(
  input: CalcInput,
  key: ModuleKey
): { inputs: object; selections: object } | undefined {
  switch (key) {
    case "main":
      return input.mainHoist;
    case "aux":
      return input.auxHoist;
    case "hookBlock":
      return input.hookBlock;
    case "trolley":
      return input.trolley;
    case "bridge":
      return input.bridge;
    case "girder":
      return input.girder;
    case "buckling":
      return input.buckling ? { inputs: input.buckling.inputs, selections: {} } : undefined;
    case "endCarriage":
      return input.endCarriage;
  }
}

function moduleResult(result: CalcResult, key: ModuleKey): ModuleResult<unknown> | undefined {
  const map: Record<ModuleKey, ModuleResult<unknown> | undefined> = {
    main: result.mainHoist,
    aux: result.auxHoist,
    hookBlock: result.hookBlock,
    trolley: result.trolley,
    bridge: result.bridge,
    girder: result.girder,
    buckling: result.buckling,
    endCarriage: result.endCarriage,
  };
  return map[key];
}

/** Sunum katmanı ctx'i — revision-editor.tsx'teki ctxFor ile aynı desen */
function ctxFor(
  key: ModuleKey,
  input: CalcInput,
  result: CalcResult,
  deps: ModuleDepsBundle
): unknown {
  const mr = moduleResult(result, key);
  const c = mr?.cells ?? {};
  const specs = input.specs;
  switch (key) {
    case "main":
    case "aux": {
      const st = key === "main" ? input.mainHoist! : input.auxHoist!;
      const ctx: HoistCtx = { c, inp: st.inputs, sel: st.selections, specs, which: key };
      return ctx;
    }
    case "hookBlock": {
      const ctx: HookBlockCtx = {
        c,
        v: result.hookBlock!.values,
        inp: input.hookBlock!.inputs,
        sel: input.hookBlock!.selections,
        deps: deps.hookBlock,
        specs,
      };
      return ctx;
    }
    case "trolley":
    case "bridge": {
      const st = key === "trolley" ? input.trolley! : input.bridge!;
      const ctx: TravelCtx = {
        c,
        v: (key === "trolley" ? result.trolley! : result.bridge!).values,
        inp: st.inputs,
        sel: st.selections,
        specs,
        deps: deps.travel,
        which: key,
      };
      return ctx;
    }
    case "girder": {
      const ctx: GirderCtx = {
        c,
        inp: input.girder!.inputs,
        sel: input.girder!.selections,
        deps: deps.girder,
        specs,
      };
      return ctx;
    }
    case "buckling": {
      const ctx: BucklingCtx = { c, inp: input.buckling!.inputs };
      return ctx;
    }
    case "endCarriage": {
      const ctx: EndCarriageCtx = {
        c,
        inp: input.endCarriage!.inputs,
        sel: input.endCarriage!.selections,
        deps: deps.endCarriage,
        specs,
      };
      return ctx;
    }
  }
}

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
  tocNo: { width: 30, fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: BRAND.red },
  tocTitle: { fontFamily: FONTS.sans, fontSize: 9.5, fontWeight: 700, color: BRAND.ink },
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
  kvValue: {
    fontFamily: FONTS.mono,
    fontSize: 7.6,
    fontWeight: 500,
    letterSpacing: 0.2,
    color: BRAND.ink,
    textAlign: "right",
  },
  kvUnit: { fontFamily: FONTS.mono, fontSize: 6.8, fontWeight: 400, color: BRAND.gray500 },
  // ---- hesap satırları (hesaplanan rol: paper100 zemin, gri etiket)
  calcRow: {
    backgroundColor: BRAND.paper100,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.line300,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
  },
  calcTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  calcLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 7.6, color: BRAND.gray700 },
  calcEq: { fontFamily: FONTS.mono, fontSize: 7.6, color: BRAND.gray500 },
  calcValue: {
    fontFamily: FONTS.mono,
    fontSize: 7.6,
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
  checkDetail: { fontFamily: FONTS.mono, fontSize: 6.2, color: BRAND.gray600, marginTop: 0.8 },
  checkBadge: { fontFamily: FONTS.mono, fontSize: 7, fontWeight: 600, letterSpacing: 0.6 },
  // ---- özet kontrol tablosu
  sumModule: { marginTop: 6 },
  sumModuleTitle: { fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700, color: BRAND.ink, marginBottom: 1.5 },
});

// ---------------------------------------------------------------- Alt bileşenler

/** Alt başlık bandı: mono TR etiket + sağda mono EN gloss, hairline altı */
function SubHead({ tr, en }: { tr: string; en?: string }) {
  return (
    <View
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
      {en ? <Text style={T.micro}>{en}</Text> : null}
    </View>
  );
}

function KvRow({
  label,
  value,
  unit,
  labelMono,
}: {
  label: string;
  value: string;
  unit?: string;
  labelMono?: boolean;
}) {
  return (
    <View style={s.kvRow} wrap={false}>
      <Text style={labelMono ? s.kvLabelMono : s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>
        {value}
        {unit ? <Text style={s.kvUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** Alan listesini iki sütuna bölerek etiket-değer tablosu basar */
function FieldTable({
  defs,
  source,
  labelMono,
}: {
  defs: AnyFieldDef[];
  source: object;
  /** Katalog seçimi tabloları: etiketler de mono (seçim rolü) */
  labelMono?: boolean;
}) {
  const rec = source as Record<string, unknown>;
  const mid = Math.ceil(defs.length / 2);
  const cols = defs.length > 3 ? [defs.slice(0, mid), defs.slice(mid)] : [defs];
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
                label={f.label}
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

function CheckLine({ check }: { check: AnyCheck }) {
  const range = check.op === "range";
  const prov = toDisplayUnit(check.provided, check.unit);
  const u = prov.unit === "-" || !prov.unit ? "" : ` ${prov.unit}`;
  const detail = range
    ? `${fmt(prov.value)}${u} · izin: ${fmt(
        toDisplayUnit((check as { min: number }).min, check.unit).value
      )}…${fmt(toDisplayUnit((check as { max: number }).max, check.unit).value)}`
    : `gereken ${fmt(
        toDisplayUnit((check as { required: number }).required, check.unit).value
      )}${u} · sağlanan ${fmt(prov.value)}${u}`;
  return (
    <View style={s.checkRow} wrap={false}>
      <CheckGlyph pass={check.pass} size={8} />
      <View style={{ flex: 1 }}>
        <Text style={s.checkLabel}>
          {check.label}
          {check.nonExcel ? (
            <Text style={{ color: BRAND.gray500 }}> (ek kontrol)</Text>
          ) : null}
        </Text>
        <Text style={s.checkDetail}>
          {detail}
          {check.standard ? ` · ${check.standard}` : ""}
        </Text>
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
function coverSpecs(input: CalcInput): { label: string; gloss: string; value: string }[] {
  const sp = input.specs;
  const out: { label: string; gloss: string; value: string }[] = [];
  if (Number.isFinite(sp.mainCapacityT)) {
    const aux = input.auxHoist && Number.isFinite(sp.auxCapacityT) ? ` / ${fmt(sp.auxCapacityT)} t` : "";
    out.push({ label: "KAPASİTE", gloss: "CAPACITY", value: `${fmt(sp.mainCapacityT)} t${aux}` });
  }
  if (Number.isFinite(sp.spanM))
    out.push({ label: "AÇIKLIK", gloss: "SPAN", value: `${fmt(sp.spanM)} m` });
  if (Number.isFinite(sp.mainLiftHeightM))
    out.push({ label: "KANCA YOLU", gloss: "HEIGHT OF LIFT", value: `${fmt(sp.mainLiftHeightM)} m` });
  const duty = [sp.hoistLoadClass, sp.hoistMechanismClass].filter(Boolean).join(" / ");
  if (duty) out.push({ label: "FEM SINIFI", gloss: "DUTY CLASS", value: duty });
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
        <Text style={T.kicker}>HESAP RAPORU · CALCULATION REPORT</Text>
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
              <Text style={s.specGloss}>{row.gloss}</Text>
            </View>
            <Text style={s.specValue}>{row.value}</Text>
          </View>
        ))}
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
            <Text style={s.coverMetaValue}>{preparedBy.toLocaleUpperCase("tr-TR")}</Text>
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

function TocPage({
  project, revision, level,
  numbers, present,
}: ReportProps & {
  numbers: Partial<Record<ModuleKey, number>>;
  present: (k: ModuleKey) => boolean;
}) {
  // Özet seviyede modül bölümleri rapora girmez; içindekiler de onları listelemez.
  // Mevcut modüller (esnek) yeniden numaralandırılarak listelenir.
  const entries =
    level === "ozet"
      ? []
      : [
          { no: "01", title: "Teknik Özellikler" },
          ...MODULE_ADAPTERS.filter((a) => present(a.key)).map((a) => {
            const [no, ...rest] = renumberTitle(a.title, numbers[a.key] ?? 0).split(" · ");
            return { no, title: rest.join(" · ") };
          }),
        ];
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageHeader
        kicker="HESAP RAPORU · CALCULATION REPORT"
        title="İçindekiler"
        meta="CONTENTS"
      />
      <View style={s.tocRow}>
        <Text style={{ ...s.tocNo, color: BRAND.gray450 }}>—</Text>
        <Text style={s.tocTitle}>ÖZET HESAP RAPORU</Text>
      </View>
      {entries.map((e) => (
        <View style={s.tocRow} key={e.no}>
          <Text style={s.tocNo}>{e.no}</Text>
          <Text style={s.tocTitle}>{e.title.toLocaleUpperCase("tr-TR")}</Text>
        </View>
      ))}
    </BrandPage>
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

function summaryGroups(input: CalcInput): SummaryGroup[] {
  const groups: SummaryGroup[] = [
    { title: "Ana Kaldırma Grubu", items: hoistSelectionItems(input.mainHoist) },
    { title: "Yardımcı Kaldırma Grubu", items: hoistSelectionItems(input.auxHoist) },
  ];
  if (input.hookBlock) {
    const sel = input.hookBlock.selections as unknown as Record<string, unknown>;
    groups.push({
      title: "Kanca Bloğu",
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
  }
  groups.push(
    { title: "Araba Yürütme Grubu", items: travelSelectionItems(input.trolley) },
    { title: "Köprü Yürütme Grubu", items: travelSelectionItems(input.bridge) }
  );
  return groups.filter((g) => g.items.length > 0);
}

function SummarySection({
  input, result, project, revision, numbers,
}: ReportProps & { numbers: Partial<Record<ModuleKey, number>> }) {
  const groups = summaryGroups(input);
  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageHeader
        kicker="ÖZET · SUMMARY"
        title="Özet Hesap Raporu"
        meta="DESIGN CALCULATION REPORT"
      />

      <SectionTag no="01" title="Teknik Özellikler" gloss="TECHNICAL SPECIFICATIONS" />
      <FieldTable defs={SPEC_FIELDS as AnyFieldDef[]} source={input.specs} />

      <SubHead tr="ANA EKİPMAN SEÇİMLERİ" en="EQUIPMENT SELECTIONS" />
      <View style={s.kvGrid}>
        <View style={s.kvCol}>
          {groups.slice(0, Math.ceil(groups.length / 2)).map((g) => (
            <View key={g.title} style={s.sumModule} wrap={false}>
              <Text style={s.sumModuleTitle}>{g.title}</Text>
              {g.items.map((it) => (
                <KvRow key={it.label} label={it.label} value={it.value} />
              ))}
            </View>
          ))}
        </View>
        <View style={s.kvCol}>
          {groups.slice(Math.ceil(groups.length / 2)).map((g) => (
            <View key={g.title} style={s.sumModule} wrap={false}>
              <Text style={s.sumModuleTitle}>{g.title}</Text>
              {g.items.map((it) => (
                <KvRow key={it.label} label={it.label} value={it.value} />
              ))}
            </View>
          ))}
        </View>
      </View>

      <SubHead tr="KONTROLLER" en="DESIGN CHECKS" />
      {MODULE_ADAPTERS.map((adapter) => {
        const mr = moduleResult(result, adapter.key);
        if (!mr || mr.checks.length === 0) return null;
        return (
          <View key={adapter.key} style={s.sumModule} minPresenceAhead={36}>
            <Text style={s.sumModuleTitle}>
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
  // Sayfa içerik genişliği ~490pt; diyagram 460pt'e ölçeklenir
  const w = 460;
  const h = (diagram.height / diagram.width) * w;
  return (
    <View
      wrap={false}
      style={{
        marginTop: 4,
        marginBottom: 3,
        borderWidth: 0.75,
        borderColor: BRAND.line300,
        paddingVertical: 4,
        alignItems: "center",
      }}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${diagram.width} ${diagram.height}`}>
        {diagram.els.map(pdfDiagramEl)}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- Modül bölümleri

function CalcRowLine({
  row,
  ctx,
  showFormulas,
}: {
  row: AdapterSection["rows"][number];
  ctx: unknown;
  /** false (standart seviye): yalnız sonuç — sembolik formül satırı gizli */
  showFormulas: boolean;
}) {
  let raw: number | string | undefined;
  try {
    raw = row.read(ctx);
  } catch {
    raw = undefined;
  }
  const { value, unit } = toDisplayUnit(raw, row.unit);
  return (
    <View style={s.calcRow} wrap={false}>
      <View style={s.calcTop}>
        <Text style={s.calcLabel}>{row.label}</Text>
        <Text style={s.calcValue}>
          <Text style={s.calcEq}>= </Text>
          {fmt(value, row.digits ?? 2)}
          {unit ? <Text style={s.kvUnit}> {unit}</Text> : null}
        </Text>
      </View>
      {showFormulas && row.formula && (
        <View style={s.calcFormula}>
          <PdfMath formula={row.formula} />
        </View>
      )}
      {row.standard && <Text style={s.calcMeta}>{row.standard}</Text>}
    </View>
  );
}

function ModulePage({
  adapter,
  props,
  deps,
  showFormulas,
  moduleNo,
}: {
  adapter: ModuleAdapter;
  props: ReportProps;
  deps: ModuleDepsBundle;
  showFormulas: boolean;
  /** Dinamik görüntü numarası (esnek modül numaralandırması) */
  moduleNo: number;
}) {
  const { input, result, project, revision } = props;
  const state = moduleState(input, adapter.key);
  const mr = moduleResult(result, adapter.key);
  if (!state || !mr) return null;
  const ctx = ctxFor(adapter.key, input, result, deps);
  const [no, ...rest] = renumberTitle(adapter.title, moduleNo).split(" · ");

  return (
    <BrandPage docLine={docLineFor(revision)} docCode={docCodeFor(project, revision)}>
      <PageHeader
        kicker={`BÖLÜM ${no} · SECTION ${no}`}
        title={rest.join(" · ")}
        meta="FEM 1.001 · DIN 15018 · CMAA 70"
      />
      {adapter.sections.map((section) => {
        const inputs = state.inputs;
        const scoped = section.inputScope ? section.inputScope.get(inputs) : inputs;
        const checks = sectionChecks(adapter, section, mr);
        const diagram = diagramForSection(adapter.key, section.rawId, input, result);
        return (
          // Bölüm başlığı sayfa sonunda yalnız kalmasın: minPresenceAhead ile
          // yeterli boşluk yoksa bölüm bir sonraki sayfaya taşınır.
          <View key={section.id} minPresenceAhead={70} style={{ marginBottom: 10 }}>
            {/* Başlık + diyagram bir arada kalır (kaymayı önler) */}
            <View wrap={false}>
              <SectionTag no={renumberSectionId(section.id, moduleNo)} title={section.title} />
              {diagram && <PdfDiagram diagram={diagram} />}
            </View>
            {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
              <View minPresenceAhead={30}>
                <SubHead tr="GİRDİLER / TASARIM KABULLERİ" en="INPUTS" />
                <FieldTable defs={section.inputDefs} source={scoped} />
                {section.extraInputDefs && section.extraInputDefs.length > 0 && (
                  <FieldTable defs={section.extraInputDefs} source={inputs} />
                )}
              </View>
            )}
            {section.selectionDefs.length > 0 && (
              <View minPresenceAhead={30}>
                <SubHead tr="KATALOG SEÇİMİ" en="SELECTION" />
                <FieldTable defs={section.selectionDefs} source={state.selections} labelMono />
              </View>
            )}
            {section.rows.length > 0 && (
              <View minPresenceAhead={30}>
                <SubHead tr="HESAP" en="CALCULATION" />
                {section.rows.map((r) => (
                  <CalcRowLine key={r.key} row={r} ctx={ctx} showFormulas={showFormulas} />
                ))}
              </View>
            )}
            {checks.length > 0 && (
              <View minPresenceAhead={30}>
                <SubHead tr="KONTROLLER" en="CHECKS" />
                {checks.map((c) => (
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

export function ReportDocument(props: ReportProps) {
  const { input, result, project, revision } = props;
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
      <TocPage {...props} level={level} numbers={numbers} present={present} />
      <SummarySection {...props} numbers={numbers} />
      {level !== "ozet" &&
        MODULE_ADAPTERS.filter((a) => present(a.key)).map((adapter) => (
          <ModulePage
            key={adapter.key}
            adapter={adapter}
            props={props}
            deps={deps}
            showFormulas={level === "detayli"}
            moduleNo={numbers[adapter.key] ?? 0}
          />
        ))}
    </Document>
  );
}

/** Revizyon PDF'ini üretir (route handler + yayınlama arşivi ortak girişi) */
export async function renderReportPdf(props: ReportProps): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...props} />);
}
