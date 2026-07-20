// Ekipman listesi PDF çıktısı — @react-pdf/renderer. Panelden "PDF indir" ile
// üretilir. Marka kimliğine sadık (kırmızı omurga, logo, kurumsal footer).
// Sütunlar: Ekipman · Marka · Model · Özellikler · Adet. Model hücresi katalog
// datasheet linki varsa köprülenir. scope="full" ise Teknik Ressam Özeti eklenir.

import fs from "node:fs";
import path from "node:path";
import {
  Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import type {
  EqGroup, SummarySection,
} from "@/lib/excel/equipment";
import { dsKey } from "@/lib/excel/equipment";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { toDisplayUnitLabel } from "@/lib/units";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "orion-logo.png");
const LOGO_DATA = fs.readFileSync(LOGO_PATH);

Font.register({
  family: "DejaVu",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSans.ttf") },
    { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONT_DIR, "DejaVuSans-Oblique.ttf"), fontStyle: "italic" },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

const C = {
  ink: "#262626", muted: "#6B6663", faint: "#8A8480", line: "#DCD9D7",
  headBg: "#F1EEEC", groupBg: "#E7E4E2", accent: "#A41E1E", link: "#1155CC",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "DejaVu", fontSize: 8, color: C.ink,
    paddingTop: 40, paddingBottom: 52, paddingHorizontal: 40,
  },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: C.accent },
  topRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 8, marginBottom: 12,
  },
  logo: { width: 130, height: 14.6 },
  brand: { fontSize: 6.5, color: C.muted, letterSpacing: 1.2, marginTop: 4 },
  docMeta: { fontSize: 8, color: C.muted, textAlign: "right" },
  h1: { fontSize: 14, fontWeight: "bold", color: C.accent, letterSpacing: 1 },
  h1En: { fontSize: 7.5, color: C.muted, letterSpacing: 1, marginBottom: 8 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8, gap: 2 },
  metaItem: { width: "50%", flexDirection: "row", fontSize: 8 },
  metaLabel: { width: 70, color: C.muted, fontWeight: "bold" },
  // tablo
  tHead: { flexDirection: "row", backgroundColor: C.accent, color: "#fff" },
  th: { paddingVertical: 3.5, paddingHorizontal: 5, fontWeight: "bold", fontSize: 7.5 },
  groupRow: { backgroundColor: C.groupBg, borderTopWidth: 1, borderTopColor: C.accent },
  groupCell: { paddingVertical: 3, paddingHorizontal: 5, fontWeight: "bold", fontSize: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  td: { paddingVertical: 2.5, paddingHorizontal: 5, fontSize: 7.5 },
  cComp: { width: "21%" },
  cBrand: { width: "14%" },
  cModel: { width: "18%" },
  cSpec: { width: "39%" },
  cQty: { width: "8%", textAlign: "center" },
  custom: { color: C.accent },
  // özet
  sumHead: { flexDirection: "row", backgroundColor: C.accent, color: "#fff" },
  sumSection: { backgroundColor: C.groupBg, fontWeight: "bold", paddingVertical: 3, paddingHorizontal: 5, fontSize: 8 },
  sLabel: { width: "62%" }, sVal: { width: "24%", textAlign: "right" }, sUnit: { width: "14%", textAlign: "center", color: C.muted },
  footer: {
    position: "absolute", left: 40, right: 40, bottom: 20,
    borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 4, flexDirection: "column", gap: 1.5,
  },
  fRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fCompany: { fontSize: 7.5, fontWeight: "bold", color: C.accent, letterSpacing: 0.5 },
  fMeta: { fontSize: 7, color: C.muted },
  fContact: { fontSize: 6, color: C.faint },
});

export interface EquipmentMetaPdf {
  docNo: string; projectName: string; customer: string;
  revLabel: string; revNo: number; date: string;
}

export interface EquipmentPdfProps {
  meta: EquipmentMetaPdf;
  groups: EqGroup[];
  summary?: SummarySection[];
  settings?: ReportSettings;
  datasheetUrls?: Map<string, string>;
}

function Footer({ meta, settings }: { meta: EquipmentMetaPdf; settings?: ReportSettings }) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  const contact = [st.address, st.phone, st.email, st.web]
    .map((x) => (x ?? "").trim()).filter(Boolean).join("  ·  ");
  return (
    <View style={s.footer} fixed>
      <View style={s.fRow}>
        <Text style={s.fCompany}>{st.company}</Text>
        <Text style={s.fMeta}>
          {meta.docNo}
          {"   "}
          <Text render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`} />
        </Text>
      </View>
      <Text style={s.fContact}>{contact || st.city}</Text>
    </View>
  );
}

function Header({ meta, settings, title, titleEn }: {
  meta: EquipmentMetaPdf; settings?: ReportSettings; title: string; titleEn: string;
}) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  return (
    <View>
      <View style={s.topRow}>
        <View>
          <Image style={s.logo} src={LOGO_DATA} />
          <Text style={s.brand}>{st.company}</Text>
        </View>
        <View>
          <Text style={s.docMeta}>DOC {meta.docNo}</Text>
          <Text style={s.docMeta}>REV V{meta.revNo} · {meta.date}</Text>
        </View>
      </View>
      <Text style={s.h1}>{title}</Text>
      <Text style={s.h1En}>{titleEn}</Text>
      <View style={s.metaGrid}>
        <View style={s.metaItem}><Text style={s.metaLabel}>Proje</Text><Text>{meta.projectName}</Text></View>
        <View style={s.metaItem}><Text style={s.metaLabel}>Müşteri</Text><Text>{meta.customer}</Text></View>
        <View style={s.metaItem}><Text style={s.metaLabel}>Revizyon</Text><Text>V{meta.revNo}{meta.revLabel ? ` — ${meta.revLabel}` : ""}</Text></View>
        <View style={s.metaItem}><Text style={s.metaLabel}>Tarih</Text><Text>{meta.date}</Text></View>
      </View>
    </View>
  );
}

function ModelCell({ group, row, urls }: {
  group: string; row: EqGroup["rows"][number]; urls?: Map<string, string>;
}) {
  const url = row.kind ? urls?.get(dsKey(row.kind, row.brand, row.model)) : undefined;
  if (url && row.model && row.model !== "-") {
    return (
      <View style={[s.td, s.cModel]}>
        <Link src={url} style={{ color: C.link, textDecoration: "underline" }}>{row.model}</Link>
      </View>
    );
  }
  return <Text style={[s.td, s.cModel]}>{row.model}</Text>;
}

export function EquipmentDocument({ meta, groups, summary, settings, datasheetUrls }: EquipmentPdfProps) {
  return (
    <Document
      title={`${meta.docNo}-V${meta.revNo} Ekipman Listesi`}
      author={(settings ?? DEFAULT_REPORT_SETTINGS).company}
      subject={`${meta.customer} — ${meta.projectName}`}
      language="tr"
    >
      <Page size="A4" style={s.page} wrap>
        <View style={s.spine} fixed />
        <Header meta={meta} settings={settings} title="EKİPMAN LİSTESİ" titleEn="EQUIPMENT LIST" />

        <View style={s.tHead} fixed>
          <Text style={[s.th, s.cComp]}>Ekipman</Text>
          <Text style={[s.th, s.cBrand]}>Marka</Text>
          <Text style={[s.th, s.cModel]}>Model</Text>
          <Text style={[s.th, s.cSpec]}>Özellikler</Text>
          <Text style={[s.th, s.cQty]}>Adet</Text>
        </View>

        {groups.map((g) => (
          <View key={g.name} minPresenceAhead={30}>
            <View style={s.groupRow}><Text style={s.groupCell}>{g.name}</Text></View>
            {g.rows.map((r, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <Text style={[s.td, s.cComp, r.custom ? s.custom : {}]}>
                  {r.component}{r.custom ? " *" : ""}
                </Text>
                <Text style={[s.td, s.cBrand]}>{r.brand}</Text>
                <ModelCell group={g.name} row={r} urls={datasheetUrls} />
                <Text style={[s.td, s.cSpec]}>{r.spec}</Text>
                <Text style={[s.td, s.cQty]}>{String(r.qty)}</Text>
              </View>
            ))}
          </View>
        ))}

        {summary && summary.length > 0 && (
          <View break>
            <Text style={[s.h1, { marginTop: 4 }]}>TEKNİK RESSAM ÖZETİ</Text>
            <Text style={s.h1En}>FABRICATION SUMMARY</Text>
            <View style={s.sumHead} fixed>
              <Text style={[s.th, s.sLabel]}>Ölçü / Özellik</Text>
              <Text style={[s.th, s.sVal]}>Değer</Text>
              <Text style={[s.th, s.sUnit]}>Birim</Text>
            </View>
            {summary.map((sec) => (
              <View key={sec.name} minPresenceAhead={30}>
                <Text style={s.sumSection}>{sec.name}</Text>
                {sec.rows.map((r, i) => (
                  <View key={i} style={s.tr} wrap={false}>
                    <Text style={[s.td, s.sLabel]}>{r.label}</Text>
                    <Text style={[s.td, s.sVal]}>{String(r.value)}</Text>
                    <Text style={[s.td, s.sUnit]}>{toDisplayUnitLabel(r.unit) ?? ""}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <Footer meta={meta} settings={settings} />
      </Page>
    </Document>
  );
}

export async function renderEquipmentPdf(props: EquipmentPdfProps): Promise<Buffer> {
  return renderToBuffer(<EquipmentDocument {...props} />);
}
