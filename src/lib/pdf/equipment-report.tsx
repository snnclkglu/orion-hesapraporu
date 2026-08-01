// Ekipman listesi PDF çıktısı — @react-pdf/renderer. Panelden "PDF indir" ile
// üretilir. Marka altyapısı brand.tsx: BrandPage (kırmızı omurga + folio
// altbilgi), PageHeader bandı, Archivo gövde + PlexMono sayı/kod. Sütunlar:
// Ekipman · Marka · Model · Özellikler · Adet. Model hücresi katalog datasheet
// linki varsa köprülenir (çelik mavisi). scope="full" → Teknik Ressam Özeti.

import { Document, Link, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type {
  EqGroup, SummarySection,
} from "@/lib/excel/equipment";
import { dsKey } from "@/lib/excel/equipment";
import { BRAND, BrandPage, PageHeader, RuleRed, T } from "@/lib/pdf/brand";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { toDisplayUnitLabel } from "@/lib/units";

const s = StyleSheet.create({
  // meta ızgarası (Proje / Müşteri / Revizyon / Tarih)
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10, gap: 2 },
  metaItem: { width: "50%", flexDirection: "row" },
  metaLabel: { width: 70, fontFamily: "Archivo", fontSize: 7.5, fontWeight: 500, color: BRAND.gray600 },
  metaVal: { fontFamily: "Archivo", fontSize: 8, color: BRAND.ink },
  metaMono: { fontFamily: "PlexMono", fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3, color: BRAND.ink },
  // tablo: kömür başlık zemini + hairline satır çizgileri
  tHead: { flexDirection: "row", backgroundColor: BRAND.ink },
  th: {
    fontFamily: "PlexMono", fontSize: 6.5, fontWeight: 600, letterSpacing: 0.8,
    textTransform: "uppercase" as const, color: BRAND.paper100,
    paddingVertical: 4, paddingHorizontal: 5,
  },
  groupRow: { backgroundColor: BRAND.paper150 },
  groupCell: {
    fontFamily: "Archivo", fontSize: 8, fontWeight: 700, color: BRAND.ink,
    textTransform: "uppercase" as const, paddingVertical: 3, paddingHorizontal: 5,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline },
  td: { fontFamily: "Archivo", fontSize: 7.5, color: BRAND.ink, paddingVertical: 2.5, paddingHorizontal: 5 },
  mono: { fontFamily: "PlexMono", fontSize: 7, fontWeight: 500, letterSpacing: 0.2 },
  cComp: { width: "21%" },
  cBrand: { width: "14%" },
  cModel: { width: "18%" },
  cSpec: { width: "39%" },
  cQty: { width: "8%", textAlign: "right" as const },
  custom: { color: BRAND.red },
  // özet
  sumSection: {
    backgroundColor: BRAND.paper150, fontFamily: "Archivo", fontSize: 8, fontWeight: 700,
    color: BRAND.ink, textTransform: "uppercase" as const, paddingVertical: 3, paddingHorizontal: 5,
  },
  sLabel: { width: "62%" },
  sVal: { width: "24%", textAlign: "right" as const },
  sUnit: { width: "14%", textAlign: "right" as const, color: BRAND.gray600 },
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

function ModelCell({ row, urls }: { row: EqGroup["rows"][number]; urls?: Map<string, string> }) {
  const url = row.kind ? urls?.get(dsKey(row.kind, row.brand, row.model)) : undefined;
  if (url && row.model && row.model !== "-") {
    return (
      <View style={[s.td, s.cModel]}>
        <Link src={url} style={[s.mono, { color: BRAND.steel, textDecoration: "underline" }]}>{row.model}</Link>
      </View>
    );
  }
  return <Text style={[s.td, s.mono, s.cModel]}>{row.model}</Text>;
}

export function EquipmentDocument({ meta, groups, summary, settings, datasheetUrls }: EquipmentPdfProps) {
  const rev = String(meta.revNo).padStart(2, "0");
  const year = /(\d{4})/.exec(meta.date)?.[1] ?? String(new Date().getFullYear());
  const docCode = `ORC-EQ-${meta.docNo}-R${rev}`;
  return (
    <Document
      title={`${meta.docNo}-V${meta.revNo} Ekipman Listesi`}
      author={(settings ?? DEFAULT_REPORT_SETTINGS).company}
      subject={`${meta.customer} — ${meta.projectName}`}
      language="tr"
    >
      <BrandPage
        docLine={`ORION CRANES · EKİPMAN LİSTESİ · REV ${rev} · ${year}`}
        docCode={docCode}
      >
        <PageHeader kicker="ORION CRANES · EQUIPMENT LIST" title="EKİPMAN LİSTESİ" meta={docCode} />

        <View style={s.metaGrid}>
          <View style={s.metaItem}><Text style={s.metaLabel}>Proje</Text><Text style={s.metaVal}>{meta.projectName}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Müşteri</Text><Text style={s.metaVal}>{meta.customer}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Revizyon</Text><Text style={s.metaMono}>V{meta.revNo}{meta.revLabel ? ` — ${meta.revLabel}` : ""}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Tarih</Text><Text style={s.metaMono}>{meta.date}</Text></View>
        </View>

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
                <ModelCell row={r} urls={datasheetUrls} />
                <Text style={[s.td, s.cSpec]}>{r.spec}</Text>
                <Text style={[s.td, s.mono, s.cQty]}>{String(r.qty)}</Text>
              </View>
            ))}
          </View>
        ))}

        {summary && summary.length > 0 && (
          <View break>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
              <View>
                <Text style={T.kicker}>TEKNİK RESSAM ÖZETİ</Text>
                <RuleRed />
              </View>
              <Text style={T.micro}>FABRICATION SUMMARY</Text>
            </View>
            <View style={s.tHead} fixed>
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
                    <Text style={[s.td, s.mono, s.sVal]}>{String(r.value)}</Text>
                    <Text style={[s.td, s.mono, s.sUnit, { color: BRAND.gray600 }]}>{toDisplayUnitLabel(r.unit) ?? ""}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </BrandPage>
    </Document>
  );
}

export async function renderEquipmentPdf(props: EquipmentPdfProps): Promise<Buffer> {
  return renderToBuffer(<EquipmentDocument {...props} />);
}
