// PDF hesap raporu — @react-pdf/renderer Document bileşeni.
// Kaynak Excel raporun görünümüne sadık: TR ana başlık + EN alt başlık.
// İçerik modül adaptörlerinden (module-adapters.ts) üretilir; editör ile
// birebir aynı bölüm/satır/kontrol yapısı PDF'e dökülür.
// Yalnızca sunucuda çalışır (Font.register dosya sisteminden okur).

import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { SPEC_FIELDS } from "@/lib/calc/fields";
import { MODULE_LABELS } from "@/lib/calc/labels";
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
  type AdapterSection,
  type AnyFieldDef,
  type ModuleAdapter,
  type ModuleDepsBundle,
  type ModuleKey,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

// ---------------------------------------------------------------- Fontlar
// DejaVu Sans: Türkçe glifler (ğ, ş, İ, ı, ...) için şart — varsayılan
// Helvetica bu karakterleri basamaz. Vercel'de dosyaların bundle'a girmesi
// next.config.ts outputFileTracingIncludes ile sağlanır.

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

Font.register({
  family: "DejaVu",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSans.ttf") },
    { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONT_DIR, "DejaVuSans-Oblique.ttf"), fontStyle: "italic" },
  ],
});

// Türkçe kelimeler tirelenmesin (react-pdf varsayılan İngilizce heceleme yapar)
Font.registerHyphenationCallback((word) => [word]);

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

export interface ReportProps {
  project: ReportProject;
  revision: ReportRevision;
  preparedBy: string;
  input: CalcInput;
  result: CalcResult;
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

function reportDateLabel(revision: ReportRevision): string {
  const iso = revision.issued_at ?? revision.updated_at;
  const d = iso ? new Date(iso) : new Date();
  return d
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toLocaleUpperCase("tr-TR");
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

const C = {
  ink: "#1a1a1a",
  muted: "#666666",
  faint: "#999999",
  line: "#d5d5d5",
  headBg: "#f0f0f0",
  green: "#1b7a3d",
  greenBg: "#eaf5ee",
  red: "#b3261e",
  redBg: "#fbedec",
  accent: "#12395f",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "DejaVu",
    fontSize: 8,
    color: C.ink,
    paddingTop: 42,
    paddingBottom: 52,
    paddingHorizontal: 46,
  },
  // ---- footer
  footer: {
    position: "absolute",
    left: 46,
    right: 46,
    bottom: 24,
    borderTopWidth: 0.75,
    borderTopColor: C.line,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: C.muted,
  },
  // ---- kapak
  coverPage: {
    fontFamily: "DejaVu",
    fontSize: 9,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 44,
    paddingHorizontal: 52,
  },
  coverTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
    paddingBottom: 8,
  },
  coverBrand: { fontSize: 12, fontWeight: "bold", color: C.accent, letterSpacing: 1 },
  coverDocMeta: { fontSize: 8, color: C.muted, textAlign: "right" },
  coverCenter: { marginTop: 120, alignItems: "center" },
  coverTitle: { fontSize: 30, fontWeight: "bold", letterSpacing: 3, color: C.accent },
  coverSubtitle: { fontSize: 12, color: C.muted, marginTop: 6, letterSpacing: 2 },
  coverRule: {
    width: 220,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    marginVertical: 26,
  },
  coverCustomer: { fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  coverProject: { fontSize: 13, marginTop: 8, letterSpacing: 0.5 },
  coverCrane: { fontSize: 9, color: C.muted, marginTop: 8 },
  coverBoxes: {
    marginTop: "auto",
    borderWidth: 0.75,
    borderColor: C.line,
  },
  coverBoxRow: { flexDirection: "row" },
  coverBox: {
    flex: 1,
    flexDirection: "row",
    borderColor: C.line,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  coverBoxLabel: { width: 78, fontSize: 7, color: C.muted, fontWeight: "bold" },
  coverBoxValue: { flex: 1, fontSize: 8 },
  coverFootnote: { textAlign: "center", marginTop: 14, fontSize: 8, color: C.muted, letterSpacing: 1.5 },
  // ---- başlıklar
  h1: {
    fontSize: 13,
    fontWeight: "bold",
    color: C.accent,
    marginBottom: 2,
  },
  h1En: { fontSize: 8, color: C.muted, marginBottom: 10, letterSpacing: 1 },
  h2: {
    fontSize: 9.5,
    fontWeight: "bold",
    backgroundColor: C.headBg,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  h3: {
    fontSize: 7,
    fontWeight: "bold",
    color: C.muted,
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  // ---- içindekiler
  tocRow: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    paddingVertical: 7,
  },
  tocNo: { width: 34, fontWeight: "bold", fontSize: 10, color: C.accent },
  tocTitle: { fontSize: 9.5 },
  // ---- tablo (girdi/seçim/özet)
  kvGrid: { flexDirection: "row", gap: 12 },
  kvCol: { flex: 1 },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    paddingVertical: 2.25,
    gap: 6,
  },
  kvLabel: { flex: 1, color: C.muted },
  kvValue: { textAlign: "right", fontWeight: "bold" },
  kvUnit: { color: C.faint },
  // ---- hesap satırları
  calcRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    paddingVertical: 2.5,
  },
  calcTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  calcLabel: { flex: 1 },
  calcValue: { fontWeight: "bold" },
  calcFormula: { fontSize: 6.5, color: C.muted, marginTop: 1 },
  calcMeta: { fontSize: 6, color: C.faint, marginTop: 0.5 },
  // ---- kontroller
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.75,
    borderRadius: 2,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginTop: 2,
    gap: 6,
  },
  checkPass: { borderColor: C.green, backgroundColor: C.greenBg },
  checkFail: { borderColor: C.red, backgroundColor: C.redBg },
  checkLabel: { flex: 1 },
  checkDetail: { fontSize: 6.5, color: C.muted },
  checkBadge: { fontSize: 7.5, fontWeight: "bold" },
  // ---- özet kontrol tablosu
  sumModule: { marginTop: 5 },
  sumModuleTitle: { fontSize: 8, fontWeight: "bold", marginBottom: 1.5 },
});

// ---------------------------------------------------------------- Alt bileşenler

function Footer({ docNo }: { docNo: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{docNo}</Text>
      <Text>HESAP RAPORU · DESIGN CALCULATION REPORT</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function KvRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={s.kvRow} wrap={false}>
      <Text style={s.kvLabel}>{label}</Text>
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
}: {
  defs: AnyFieldDef[];
  source: object;
}) {
  const rec = source as Record<string, unknown>;
  const mid = Math.ceil(defs.length / 2);
  const cols = defs.length > 3 ? [defs.slice(0, mid), defs.slice(mid)] : [defs];
  return (
    <View style={s.kvGrid}>
      {cols.map((col, i) => (
        <View style={s.kvCol} key={i}>
          {col.map((f) => (
            <KvRow key={f.key} label={f.label} value={fmtField(rec[f.key])} unit={f.unit} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CheckLine({ check }: { check: AnyCheck }) {
  const range = check.op === "range";
  const u = check.unit === "-" ? "" : ` ${check.unit}`;
  const detail = range
    ? `${fmt(check.provided)}${u} · izin: ${fmt((check as { min: number }).min)}…${fmt(
        (check as { max: number }).max
      )}`
    : `gereken ${fmt((check as { required: number }).required)}${u} · sağlanan ${fmt(
        check.provided
      )}${u}`;
  return (
    <View style={[s.checkRow, check.pass ? s.checkPass : s.checkFail]} wrap={false}>
      <View style={s.checkLabel}>
        <Text>
          {check.label}
          {check.nonExcel ? <Text style={{ color: C.faint }}> (ek kontrol)</Text> : null}
        </Text>
        <Text style={s.checkDetail}>
          {detail}
          {check.standard ? ` · ${check.standard}` : ""}
        </Text>
      </View>
      <Text style={[s.checkBadge, { color: check.pass ? C.green : C.red }]}>
        {check.pass ? "✓ UYGUN" : "✗ UYGUN DEĞİL"}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- Kapak

function CoverPage({ project, revision, preparedBy }: ReportProps) {
  const dateLabel = reportDateLabel(revision);
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverTopRow}>
        <Text style={s.coverBrand}>ORION CRANES</Text>
        <View>
          <Text style={s.coverDocMeta}>DOC {project.doc_no}</Text>
          <Text style={s.coverDocMeta}>
            REV V{revision.rev_no} · {dateLabel}
          </Text>
        </View>
      </View>

      <View style={s.coverCenter}>
        <Text style={s.coverTitle}>HESAP RAPORU</Text>
        <Text style={s.coverSubtitle}>DESIGN CALCULATION REPORT</Text>
        <View style={s.coverRule} />
        <Text style={s.coverCustomer}>{project.customer.toLocaleUpperCase("tr-TR")}</Text>
        <Text style={s.coverProject}>{project.name.toLocaleUpperCase("tr-TR")}</Text>
        <Text style={s.coverCrane}>{project.crane_type}</Text>
      </View>

      <View style={s.coverBoxes}>
        <View style={[s.coverBoxRow, { borderBottomWidth: 0.75, borderBottomColor: C.line }]}>
          <View style={[s.coverBox, { borderRightWidth: 0.75 }]}>
            <Text style={s.coverBoxLabel}>DOKÜMAN NO</Text>
            <Text style={s.coverBoxValue}>{project.doc_no}</Text>
          </View>
          <View style={s.coverBox}>
            <Text style={s.coverBoxLabel}>TARİH</Text>
            <Text style={s.coverBoxValue}>{dateLabel}</Text>
          </View>
        </View>
        <View style={s.coverBoxRow}>
          <View style={[s.coverBox, { borderRightWidth: 0.75 }]}>
            <Text style={s.coverBoxLabel}>REVİZYON</Text>
            <Text style={s.coverBoxValue}>
              V{revision.rev_no}
              {revision.label && revision.label !== `V${revision.rev_no}`
                ? ` · ${revision.label}`
                : ""}
            </Text>
          </View>
          <View style={s.coverBox}>
            <Text style={s.coverBoxLabel}>HAZIRLAYAN</Text>
            <Text style={s.coverBoxValue}>{preparedBy.toLocaleUpperCase("tr-TR")}</Text>
          </View>
        </View>
      </View>
      <Text style={s.coverFootnote}>ANKARA · TÜRKİYE</Text>
    </Page>
  );
}

// ---------------------------------------------------------------- İçindekiler

function TocPage({ project }: ReportProps) {
  const entries = Object.values(MODULE_LABELS).map((label) => {
    const [no, ...rest] = label.split(" · ");
    return { no, title: rest.join(" · ") };
  });
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.h1}>İÇİNDEKİLER</Text>
      <Text style={s.h1En}>CONTENTS</Text>
      <View style={s.tocRow}>
        <Text style={s.tocNo}>—</Text>
        <Text style={s.tocTitle}>ÖZET HESAP RAPORU</Text>
      </View>
      {entries.map((e) => (
        <View style={s.tocRow} key={e.no}>
          <Text style={s.tocNo}>{e.no}</Text>
          <Text style={s.tocTitle}>{e.title.toLocaleUpperCase("tr-TR")}</Text>
        </View>
      ))}
      <Footer docNo={project.doc_no} />
    </Page>
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

function SummarySection({ input, result, project }: ReportProps) {
  const groups = summaryGroups(input);
  const failCount = result.allChecks.filter((c) => !c.pass).length;
  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.h1}>ÖZET HESAP RAPORU</Text>
      <Text style={s.h1En}>SUMMARY · DESIGN CALCULATION REPORT</Text>

      <Text style={s.h2}>Teknik Özellikler</Text>
      <FieldTable defs={SPEC_FIELDS as AnyFieldDef[]} source={input.specs} />

      <Text style={s.h2}>Ana Ekipman Seçimleri</Text>
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

      <Text style={s.h2}>
        Kontrol Durumu — {result.allChecks.length} kontrol,{" "}
        {failCount === 0 ? "tümü uygun ✓" : `${failCount} uygun değil ✗`}
      </Text>
      {MODULE_ADAPTERS.map((adapter) => {
        const mr = moduleResult(result, adapter.key);
        if (!mr || mr.checks.length === 0) return null;
        return (
          <View key={adapter.key} style={s.sumModule}>
            <Text style={s.sumModuleTitle}>{adapter.title}</Text>
            {mr.checks.map((c) => (
              <CheckLine key={c.id} check={c} />
            ))}
          </View>
        );
      })}
      <Footer docNo={project.doc_no} />
    </Page>
  );
}

// ---------------------------------------------------------------- Modül bölümleri

function CalcRowLine({ row, ctx }: { row: AdapterSection["rows"][number]; ctx: unknown }) {
  let value: number | string | undefined;
  let subst: string | undefined;
  try {
    value = row.read(ctx);
  } catch {
    value = undefined;
  }
  try {
    subst = row.subst?.(ctx);
  } catch {
    subst = undefined;
  }
  return (
    <View style={s.calcRow} wrap={false}>
      <View style={s.calcTop}>
        <Text style={s.calcLabel}>{row.label}</Text>
        <Text style={s.calcValue}>
          = {fmt(value, row.digits ?? 2)}
          {row.unit ? <Text style={s.kvUnit}> {row.unit}</Text> : null}
        </Text>
      </View>
      {(row.formula || subst) && (
        <Text style={s.calcFormula}>
          {row.formula ?? ""}
          {subst ? `  =  ${subst}` : ""}
        </Text>
      )}
      {(row.standard || row.excelRef) && (
        <Text style={s.calcMeta}>
          {[row.standard, row.excelRef ? `Excel: ${row.excelRef}` : "yeniden yazım"]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
    </View>
  );
}

function ModulePage({
  adapter,
  props,
  deps,
}: {
  adapter: ModuleAdapter;
  props: ReportProps;
  deps: ModuleDepsBundle;
}) {
  const { input, result, project } = props;
  const state = moduleState(input, adapter.key);
  const mr = moduleResult(result, adapter.key);
  if (!state || !mr) return null;
  const ctx = ctxFor(adapter.key, input, result, deps);
  const [no, ...rest] = adapter.title.split(" · ");

  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.h1}>
        {no} · {rest.join(" · ").toLocaleUpperCase("tr-TR")}
      </Text>
      <Text style={s.h1En}>FEM 1.001 / DIN 15018 / CMAA 70</Text>
      {adapter.sections.map((section) => {
        const inputs = state.inputs;
        const scoped = section.inputScope ? section.inputScope.get(inputs) : inputs;
        const checks = sectionChecks(adapter, section, mr);
        return (
          <View key={section.id}>
            <Text style={s.h2}>
              {section.id}  {section.title}
            </Text>
            {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
              <View>
                <Text style={s.h3}>Girdiler / Tasarım Kabulleri</Text>
                <FieldTable defs={section.inputDefs} source={scoped} />
                {section.extraInputDefs && section.extraInputDefs.length > 0 && (
                  <FieldTable defs={section.extraInputDefs} source={inputs} />
                )}
              </View>
            )}
            {section.selectionDefs.length > 0 && (
              <View>
                <Text style={s.h3}>Katalog Seçimi</Text>
                <FieldTable defs={section.selectionDefs} source={state.selections} />
              </View>
            )}
            {section.rows.length > 0 && (
              <View>
                <Text style={s.h3}>Hesap</Text>
                {section.rows.map((r) => (
                  <CalcRowLine key={r.key} row={r} ctx={ctx} />
                ))}
              </View>
            )}
            {checks.length > 0 && (
              <View>
                <Text style={s.h3}>Kontroller</Text>
                {checks.map((c) => (
                  <CheckLine key={c.id} check={c} />
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Footer docNo={project.doc_no} />
    </Page>
  );
}

// ---------------------------------------------------------------- Belge

export function ReportDocument(props: ReportProps) {
  const { input, result, project, revision } = props;
  const deps = buildModuleDeps(input, result);
  return (
    <Document
      title={`${project.doc_no}-V${revision.rev_no} Hesap Raporu`}
      author="ORION CRANES"
      subject={`${project.customer} — ${project.name}`}
      language="tr"
    >
      <CoverPage {...props} />
      <TocPage {...props} />
      <SummarySection {...props} />
      {MODULE_ADAPTERS.map((adapter) => (
        <ModulePage key={adapter.key} adapter={adapter} props={props} deps={deps} />
      ))}
    </Document>
  );
}

/** Revizyon PDF'ini üretir (route handler + yayınlama arşivi ortak girişi) */
export async function renderReportPdf(props: ReportProps): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...props} />);
}
