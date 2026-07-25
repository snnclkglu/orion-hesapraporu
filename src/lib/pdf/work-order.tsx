// İş Emri (Work Order, form FR.11.02) PDF çıktısı — @react-pdf/renderer.
// ASTOR örnek dokümanının düzenini yeniden üretir: başlık, iş kalemleri tablosu,
// müşteri bilgileri, iş bilgileri, kapsam kutucukları, açıklamalar, hazırlayan.

import fs from "node:fs";
import path from "node:path";
import {
  Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";

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
  ink: "#262626", muted: "#6B6663", faint: "#8A8480", line: "#B8B4B1",
  headBg: "#F1EEEC", accent: "#A41E1E",
};

export interface WorkOrderItem {
  item_no: string;
  product_name: string;
  quantity: string;
}

export interface WorkOrderData {
  job_no: string;
  title: string;
  form_code?: string;
  work_order_date?: string | null;
  customer: string;
  customer_address?: string;
  customer_tax_office?: string;
  customer_tax_no?: string;
  customer_phone?: string;
  customer_fax?: string;
  contract_exists?: boolean;
  contract_date?: string | null;
  workshop_exit_date?: string | null;
  delivery_date?: string | null;
  quantity_text?: string;
  job_leader?: string;
  scope?: Record<string, boolean>;
  prepared_by_name?: string;
  prepared_by_title?: string;
  notes?: string;
  items: WorkOrderItem[];
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

const s = StyleSheet.create({
  page: { fontFamily: "DejaVu", fontSize: 8.5, color: C.ink, paddingTop: 30, paddingBottom: 40, paddingHorizontal: 36 },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6, backgroundColor: C.accent },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 8, marginBottom: 2 },
  logo: { width: 128, height: 14.4 },
  company: { fontSize: 6.5, color: C.muted, letterSpacing: 1.2, marginTop: 4 },
  titleWrap: { alignItems: "flex-end" },
  title: { fontSize: 17, fontWeight: "bold", color: C.accent, letterSpacing: 2 },
  titleEn: { fontSize: 7, color: C.muted, letterSpacing: 1 },
  formMeta: { fontSize: 7, color: C.muted, marginTop: 3, textAlign: "right" },
  dateRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, marginBottom: 4 },
  dateLabel: { fontSize: 8.5, fontWeight: "bold" },
  // tablo
  sectionTitle: { fontSize: 8, fontWeight: "bold", backgroundColor: C.accent, color: "#fff", paddingVertical: 3, paddingHorizontal: 6, marginTop: 8, letterSpacing: 0.5 },
  tHead: { flexDirection: "row", backgroundColor: C.headBg, borderWidth: 0.75, borderColor: C.line },
  th: { fontWeight: "bold", fontSize: 7.5, paddingVertical: 3, paddingHorizontal: 5 },
  tr: { flexDirection: "row", borderLeftWidth: 0.75, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: C.line },
  td: { fontSize: 8, paddingVertical: 3, paddingHorizontal: 5 },
  cIdx: { width: "6%", textAlign: "center", borderRightWidth: 0.5, borderRightColor: C.line },
  cName: { width: "68%", borderRightWidth: 0.5, borderRightColor: C.line },
  cNo: { width: "16%", textAlign: "center", fontFamily: "DejaVu", borderRightWidth: 0.5, borderRightColor: C.line },
  cQty: { width: "10%", textAlign: "center" },
  // iki kutu
  twoCol: { flexDirection: "row", gap: 8, marginTop: 8 },
  box: { flex: 1, borderWidth: 0.75, borderColor: C.line },
  boxTitle: { fontSize: 7.5, fontWeight: "bold", backgroundColor: C.headBg, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.75, borderBottomColor: C.line },
  kv: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kvLabel: { width: "38%", color: C.muted, fontSize: 7.5 },
  kvVal: { flex: 1, fontSize: 8 },
  // kapsam
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, borderWidth: 0.75, borderColor: C.line, padding: 8, marginTop: 8 },
  chk: { flexDirection: "row", alignItems: "center", gap: 4, width: "28%" },
  box14: { width: 9, height: 9, borderWidth: 0.75, borderColor: C.ink, alignItems: "center", justifyContent: "center" },
  chkMark: { fontSize: 8, fontWeight: "bold", color: C.accent, lineHeight: 1 },
  notes: { borderWidth: 0.75, borderColor: C.line, padding: 8, marginTop: 8, minHeight: 46, fontSize: 8 },
  prep: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, alignItems: "flex-end" },
  prepLine: { fontSize: 8 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 18, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 4, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: C.faint },
});

function Chk({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={s.chk}>
      <View style={s.box14}>{on ? <Text style={s.chkMark}>✓</Text> : null}</View>
      <Text style={{ fontSize: 8 }}>{label}</Text>
    </View>
  );
}

function KV({ label, value }: { label: string; value?: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvVal}>{value && value.trim() ? value : "—"}</Text>
    </View>
  );
}

export function WorkOrderDocument({ data, settings }: { data: WorkOrderData; settings?: ReportSettings }) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  const sc = data.scope ?? {};
  return (
    <Document title={`İş Emri ${data.job_no}`} author={st.company} subject={data.title} language="tr">
      <Page size="A4" style={s.page}>
        <View style={s.spine} fixed />
        <View style={s.head}>
          <View>
            <Image style={s.logo} src={LOGO_DATA} />
            <Text style={s.company}>{st.company}</Text>
          </View>
          <View style={s.titleWrap}>
            <Text style={s.title}>İŞ EMRİ</Text>
            <Text style={s.titleEn}>WORK ORDER</Text>
            <Text style={s.formMeta}>Form Kodu {data.form_code || "FR.11.02"} · İş No {data.job_no}</Text>
          </View>
        </View>

        <View style={s.dateRow}>
          <Text style={s.dateLabel}>TARİH: {fmtDate(data.work_order_date)}</Text>
        </View>

        {/* İş kalemleri */}
        <View style={s.tHead}>
          <Text style={[s.th, s.cIdx]}>#</Text>
          <Text style={[s.th, s.cName]}>Ürün Adı</Text>
          <Text style={[s.th, s.cNo]}>İş Numarası</Text>
          <Text style={[s.th, s.cQty]}>Adet</Text>
        </View>
        {(data.items.length > 0 ? data.items : [{ item_no: "", product_name: "—", quantity: "" }]).map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.td, s.cIdx]}>{i + 1}</Text>
            <Text style={[s.td, s.cName]}>{it.product_name}</Text>
            <Text style={[s.td, s.cNo]}>{it.item_no || "—"}</Text>
            <Text style={[s.td, s.cQty]}>{it.quantity || "—"}</Text>
          </View>
        ))}

        {/* Müşteri + İş bilgileri */}
        <View style={s.twoCol}>
          <View style={s.box}>
            <Text style={s.boxTitle}>MÜŞTERİ BİLGİLERİ</Text>
            <KV label="Adı" value={data.customer} />
            <KV label="Adresi" value={data.customer_address} />
            <KV label="Vergi Dairesi" value={data.customer_tax_office} />
            <KV label="Vergi No" value={data.customer_tax_no} />
            <KV label="Telefon" value={data.customer_phone} />
            <KV label="Faks" value={data.customer_fax} />
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>İŞ BİLGİLERİ</Text>
            <KV label="Sözleşme" value={data.contract_exists ? "VAR" : "YOK"} />
            <KV label="Sözleşme Tarihi" value={fmtDate(data.contract_date)} />
            <KV label="Atölye Çıkış" value={fmtDate(data.workshop_exit_date)} />
            <KV label="Teslim Tarihi" value={fmtDate(data.delivery_date)} />
            <KV label="Adet" value={data.quantity_text} />
            <KV label="İş Lideri" value={data.job_leader} />
          </View>
        </View>

        {/* Kapsam */}
        <Text style={s.sectionTitle}>KAPSAM</Text>
        <View style={s.scopeRow}>
          <Chk label="Proje" on={sc.proje} />
          <Chk label="Devreye Alma" on={sc.devreyeAlma} />
          <Chk label="Malzeme" on={sc.malzeme} />
          <Chk label="Nakliye" on={sc.nakliye} />
          <Chk label="İmalat" on={sc.imalat} />
          <Chk label="Montaj" on={sc.montaj} />
        </View>

        {/* Açıklamalar */}
        <Text style={s.sectionTitle}>AÇIKLAMALAR</Text>
        <View style={s.notes}>
          <Text>{data.notes && data.notes.trim() ? data.notes : "—"}</Text>
        </View>

        {/* Hazırlayan */}
        <View style={s.prep}>
          <View>
            <Text style={s.prepLine}>İŞ EMRİNİ HAZIRLAYAN</Text>
            <Text style={[s.prepLine, { marginTop: 4 }]}>Adı Soyadı : {data.prepared_by_name || "—"}</Text>
            <Text style={s.prepLine}>Unvanı : {data.prepared_by_title || "—"}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{st.company}</Text>
          <Text>{[st.address, st.phone, st.web].filter(Boolean).join("  ·  ") || st.city}</Text>
          <Text>İş Emri · {data.job_no}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderWorkOrderPdf(data: WorkOrderData, settings?: ReportSettings): Promise<Buffer> {
  return renderToBuffer(<WorkOrderDocument data={data} settings={settings} />);
}
