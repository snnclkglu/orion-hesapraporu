// İş Emri (Work Order, form FR.11.02) PDF çıktısı — @react-pdf/renderer.
// ASTOR örneğinin içerik düzeni Orion marka kimliğiyle: BrandPage (kırmızı
// omurga + folio altbilgi), PageHeader bandı, Archivo gövde + PlexMono sayı/kod.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandPage, CheckGlyph, PageHeader, RuleRed, T } from "@/lib/pdf/brand";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/settings";

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
  dateRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 },
  // tablo: kömür başlık zemini + hairline satır çizgileri
  tHead: { flexDirection: "row", backgroundColor: BRAND.ink },
  th: {
    fontFamily: "PlexMono", fontSize: 6.5, fontWeight: 600, letterSpacing: 0.8,
    textTransform: "uppercase" as const, color: BRAND.paper100,
    paddingVertical: 4, paddingHorizontal: 5,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline },
  td: { fontFamily: "Archivo", fontSize: 8, color: BRAND.ink, paddingVertical: 3, paddingHorizontal: 5 },
  mono: { fontFamily: "PlexMono", fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3 },
  cIdx: { width: "6%", textAlign: "right" as const },
  cName: { width: "68%" },
  cNo: { width: "16%" },
  cQty: { width: "10%", textAlign: "right" as const },
  // iki kutu
  twoCol: { flexDirection: "row", gap: 8, marginTop: 12 },
  box: { flex: 1, borderWidth: 0.75, borderColor: BRAND.line300 },
  boxTitle: {
    fontFamily: "PlexMono", fontSize: 6.5, fontWeight: 600, letterSpacing: 1,
    textTransform: "uppercase" as const, color: BRAND.gray600, backgroundColor: BRAND.paper150,
    paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BRAND.line300,
  },
  kv: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline },
  kvLabel: { width: "38%", fontFamily: "Archivo", fontSize: 7.5, fontWeight: 500, color: BRAND.gray600 },
  kvVal: { flex: 1, fontFamily: "Archivo", fontSize: 8, color: BRAND.ink },
  kvMono: { fontFamily: "PlexMono", fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3 },
  // kapsam
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, borderWidth: 0.75, borderColor: BRAND.line300, padding: 8 },
  chk: { flexDirection: "row", alignItems: "center", gap: 4, width: "28%" },
  box14: { width: 9, height: 9, borderWidth: 0.75, borderColor: BRAND.ink, alignItems: "center", justifyContent: "center" },
  chkLabel: { fontFamily: "Archivo", fontSize: 8, color: BRAND.ink },
  notes: { borderWidth: 0.75, borderColor: BRAND.line300, padding: 8, minHeight: 46 },
  prep: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, alignItems: "flex-end" },
});

/** Bölüm etiketi: mono kicker + kırmızı çizgi */
function SectionLabel({ title, gloss }: { title: string; gloss?: string }) {
  return (
    <View wrap={false} style={{ marginTop: 12, marginBottom: 5 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={T.kicker}>{title}</Text>
        {gloss ? <Text style={T.micro}>{gloss}</Text> : null}
      </View>
      <RuleRed />
    </View>
  );
}

function Chk({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={s.chk}>
      <View style={s.box14}>{on ? <CheckGlyph pass size={6.5} /> : null}</View>
      <Text style={s.chkLabel}>{label}</Text>
    </View>
  );
}

function KV({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  const has = Boolean(value && value.trim());
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={has && mono ? [s.kvVal, s.kvMono] : s.kvVal}>{has ? value : "—"}</Text>
    </View>
  );
}

export function WorkOrderDocument({ data, settings }: { data: WorkOrderData; settings?: ReportSettings }) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  const sc = data.scope ?? {};
  // İş emri formunun ayrı revizyon alanı yok — doküman kimliği R00 ile yayınlanır.
  const year = /^(\d{4})/.exec(data.work_order_date ?? "")?.[1] ?? String(new Date().getFullYear());
  return (
    <Document title={`İş Emri ${data.job_no}`} author={st.company} subject={data.title} language="tr">
      <BrandPage
        docLine={`ORION CRANES · İŞ EMRİ · REV 00 · ${year}`}
        docCode={`ORC-WO-${data.job_no}-R00`}
      >
        <PageHeader
          kicker="ORION CRANES · WORK ORDER"
          title="İŞ EMRİ"
          meta={`${data.form_code || "FR.11.02"} · İŞ NO ${data.job_no}`}
        />

        <View style={s.dateRow}>
          <Text style={T.data}>TARİH {fmtDate(data.work_order_date)}</Text>
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
            <Text style={[s.td, s.mono, s.cIdx]}>{i + 1}</Text>
            <Text style={[s.td, s.cName]}>{it.product_name}</Text>
            <Text style={[s.td, s.mono, s.cNo]}>{it.item_no || "—"}</Text>
            <Text style={[s.td, s.mono, s.cQty]}>{it.quantity || "—"}</Text>
          </View>
        ))}

        {/* Müşteri + İş bilgileri */}
        <View style={s.twoCol}>
          <View style={s.box}>
            <Text style={s.boxTitle}>Müşteri Bilgileri</Text>
            <KV label="Adı" value={data.customer} />
            <KV label="Adresi" value={data.customer_address} />
            <KV label="Vergi Dairesi" value={data.customer_tax_office} />
            <KV label="Vergi No" value={data.customer_tax_no} mono />
            <KV label="Telefon" value={data.customer_phone} mono />
            <KV label="Faks" value={data.customer_fax} mono />
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>İş Bilgileri</Text>
            <KV label="Sözleşme" value={data.contract_exists ? "VAR" : "YOK"} />
            <KV label="Sözleşme Tarihi" value={fmtDate(data.contract_date)} mono />
            <KV label="Atölye Çıkış" value={fmtDate(data.workshop_exit_date)} mono />
            <KV label="Teslim Tarihi" value={fmtDate(data.delivery_date)} mono />
            <KV label="Adet" value={data.quantity_text} mono />
            <KV label="İş Lideri" value={data.job_leader} />
          </View>
        </View>

        {/* Kapsam */}
        <SectionLabel title="KAPSAM" />
        <View style={s.scopeRow}>
          <Chk label="Proje" on={sc.proje} />
          <Chk label="Devreye Alma" on={sc.devreyeAlma} />
          <Chk label="Malzeme" on={sc.malzeme} />
          <Chk label="Nakliye" on={sc.nakliye} />
          <Chk label="İmalat" on={sc.imalat} />
          <Chk label="Montaj" on={sc.montaj} />
        </View>

        {/* Açıklamalar */}
        <SectionLabel title="AÇIKLAMALAR" />
        <View style={s.notes}>
          <Text style={{ ...T.body, color: BRAND.ink }}>{data.notes && data.notes.trim() ? data.notes : "—"}</Text>
        </View>

        {/* Hazırlayan */}
        <View style={s.prep}>
          <View>
            <Text style={T.kickerInk}>İŞ EMRİNİ HAZIRLAYAN</Text>
            <Text style={{ ...T.body, color: BRAND.ink, marginTop: 5 }}>Adı Soyadı : {data.prepared_by_name || "—"}</Text>
            <Text style={{ ...T.body, color: BRAND.ink }}>Unvanı : {data.prepared_by_title || "—"}</Text>
          </View>
        </View>
      </BrandPage>
    </Document>
  );
}

export async function renderWorkOrderPdf(data: WorkOrderData, settings?: ReportSettings): Promise<Buffer> {
  return renderToBuffer(<WorkOrderDocument data={data} settings={settings} />);
}
