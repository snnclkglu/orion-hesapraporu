// Ekipman listesi PDF çıktısı — @react-pdf/renderer. Panelden "PDF indir" ile
// üretilir. Marka altyapısı brand.tsx: BrandPage (kırmızı omurga + folio
// altbilgi), PageHeader bandı, Archivo gövde + PlexMono sayı/kod. Sütunlar:
// Ekipman · Marka · Model · Özellikler · Adet. Model hücresi katalog datasheet
// linki varsa köprülenir (çelik mavisi). scope="full" → Teknik Ressam Özeti.
//
// Sütun metinleri `buildEquipmentGroups` içinde `baslikDuzeni` ile "Baş Harfler
// Büyük" düzenine getirilmiş olarak gelir (madde 33) — burada yeniden
// biçimlenmez. "Ek Özellikler" sütunu kullanıcının satıra yazdığı serbest
// nottur (equipment_notes, madde 34).

import { Document, Link, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type {
  EqGroup, SummarySection,
} from "@/lib/excel/equipment";
import { dsKey } from "@/lib/excel/equipment";
import { BRAND, BrandPage, FONTS, PageHeader, RuleRed, T, trUpper } from "@/lib/pdf/brand";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";
import { toDisplayUnitLabel } from "@/lib/units";

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
  cComp: { width: "18%" },
  cBrand: { width: "12%" },
  cModel: { width: "15%" },
  cSpec: { width: "30%" },
  // Ek Özellikler: kullanıcının satıra yazdığı serbest açıklama (madde 34).
  // Renk ayrı stildedir; genişlik stili başlık satırında da kullanılıyor ve
  // oradaki paper100 metin rengini ezmemelidir.
  cNote: { width: "18%" },
  noteText: { color: BRAND.gray700 },
  cQty: { width: "7%", textAlign: "right" as const },
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
        {/* Başlık PageHeader içinde tr-TR ile büyütülür; kaynak Title Case yazılır */}
        <PageHeader kicker="ORION CRANES · EKİPMAN LİSTESİ" title="Ekipman Listesi" meta={docCode} />

        <View style={s.metaGrid}>
          <View style={s.metaItem}><Text style={s.metaLabel}>Proje</Text><Text style={s.metaVal}>{meta.projectName}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Müşteri</Text><Text style={s.metaVal}>{meta.customer}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Revizyon</Text><Text style={s.metaMono}>V{meta.revNo}{meta.revLabel ? ` — ${meta.revLabel}` : ""}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Tarih</Text><Text style={s.metaMono}>{meta.date}</Text></View>
        </View>

        <View style={s.tHead} fixed>
          <Text style={[s.th, s.cComp]}>{trUpper("Ekipman")}</Text>
          <Text style={[s.th, s.cBrand]}>{trUpper("Marka")}</Text>
          <Text style={[s.th, s.cModel]}>{trUpper("Model")}</Text>
          <Text style={[s.th, s.cSpec]}>{trUpper("Özellikler")}</Text>
          <Text style={[s.th, s.cNote]}>{trUpper("Ek Özellikler")}</Text>
          <Text style={[s.th, s.cQty]}>{trUpper("Adet")}</Text>
        </View>

        {groups.map((g) => (
          <View key={g.name} minPresenceAhead={30}>
            <View style={s.groupRow}><Text style={s.groupCell}>{trUpper(g.name)}</Text></View>
            {g.rows.map((r, i) => (
              <View key={i} style={[s.tr, r.alt ? s.altRow : {}]} wrap={false}>
                <Text
                  style={[
                    s.td, s.cComp,
                    r.custom ? s.custom : {},
                    r.alt ? s.altText : {}, r.alt ? s.altIndent : {},
                  ]}
                >
                  {r.component}{r.custom ? " *" : ""}
                </Text>
                <Text style={[s.td, s.cBrand, r.alt ? s.altText : {}]}>{r.brand}</Text>
                <ModelCell row={r} urls={datasheetUrls} />
                <Text style={[s.td, s.cSpec, r.alt ? s.altText : {}]}>{r.spec}</Text>
                <Text style={[s.td, s.cNote, s.noteText]}>{r.note ?? ""}</Text>
                <Text style={[s.td, s.mono, s.cQty, r.alt ? s.altText : {}]}>{String(r.qty)}</Text>
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
              <Text style={T.micro}>İMALAT ÖZETİ</Text>
            </View>
            <View style={s.tHead} fixed>
              <Text style={[s.th, s.sLabel]}>{trUpper("Ölçü / Özellik")}</Text>
              <Text style={[s.th, s.sVal]}>{trUpper("Değer")}</Text>
              <Text style={[s.th, s.sUnit]}>{trUpper("Birim")}</Text>
            </View>
            {summary.map((sec) => (
              <View key={sec.name} minPresenceAhead={30}>
                <Text style={s.sumSection}>{trUpper(sec.name)}</Text>
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
