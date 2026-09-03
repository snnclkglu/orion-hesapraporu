// İş Emri (form FR.11.02) PDF çıktısı — @react-pdf/renderer.
// İçerik düzeni Orion marka kimliğiyle: BrandPage (kırmızı omurga + folio
// altbilgi), PageHeader bandı, Archivo gövde + PlexMono sayı/kod.
// Tüm metinler Türkçedir; büyük harfe çevrim `trUpper` (tr-TR) ile yapılır —
// stil tabanlı `textTransform` Türkçe "i" harfini bozduğu için kullanılmaz.
//
// SAYFA DENGESİ: iş emirlerinin çoğu 1–2 kalemlidir. Kalem tablosu sabit
// ölçüde dizilirse tek kalemli bir emirde sayfanın üçte ikisi boş kalır ve
// belgenin ASIL BİLGİSİ (hangi ürün, hangi iş numarası, kaç adet) küçücük bir
// şeride sıkışır. Bu yüzden kalem satırları KALEM SAYISINA GÖRE ölçeklenir:
// az kalemde satırlar büyür ve nefes alır, çoktaysa sıkışır ve gerekiyorsa
// ikinci sayfaya taşar (başlık satırı her sayfada tekrarlanır).

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandPage, CheckGlyph, FONTS, PageHeader, RuleRed, T, trUpper } from "@/lib/pdf/brand";
import { workOrderDocCode } from "@/lib/pdf/doc-naming";
import { revizyonHarfi } from "@/lib/jobs/is-emri";
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
  /** Revizyon harfi (A · B · C…). BOŞ = hiç revize edilmemiş ilk yayın. */
  revision?: string;
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
  shipping_address?: string;
  assembly_address?: string;
  quantity_text?: string;
  job_leader?: string;
  project_manager?: string;
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

/**
 * Sayfa ölçeği — kalem sayısına göre.
 *
 * Eşikler basılı formun gerçek kullanımından gelir: işlerin çoğu 1–2 kalemdir,
 * üst sınır pratikte 10'dur. `body` gövde yazı boyu, `pad` satır iç boşluğu,
 * `sub` sıra numarasının boyudur.
 *
 * `notesMin` ve `pin` sayfa dengesini kurar:
 *   · Az kalemde açıklama kutusu BÜYÜR (atölyede elle not düşmeye yer kalır) ve
 *     imza bloğu esnek boşlukla sayfanın DİBİNE oturur — form dolu görünür.
 *   · Çok kalemde ikisi de kapanır; aksi hâlde imza bloğu tek başına ikinci
 *     sayfaya düşer ve neredeyse boş bir sayfa basılırdı.
 */
function itemScale(count: number, adresVar = false) {
  const olcek = (() => {
    if (count <= 2) return { body: 12, sub: 8, pad: 13, head: 8, notesMin: 90, gap: 14, scopePad: 10, pin: true };
    if (count <= 4) return { body: 11, sub: 7.5, pad: 10, head: 7.5, notesMin: 74, gap: 13, scopePad: 10, pin: true };
    if (count <= 7) return { body: 10, sub: 7, pad: 7.5, head: 7, notesMin: 58, gap: 12, scopePad: 9, pin: true };
    if (count <= 10) return { body: 9, sub: 6.5, pad: 4.5, head: 6.5, notesMin: 40, gap: 7, scopePad: 6, pin: false };
    return { body: 8.5, sub: 6, pad: 3, head: 6.5, notesMin: 30, gap: 6, scopePad: 5, pin: false };
  })();
  if (!adresVar) return olcek;
  // SEVK/MONTAJ BLOĞU YER İSTER ve o yer BİR YERDEN ALINIR. Blok eklendiğinde
  // ölçüldü (18.08.2026): 2 · 5 · 10 · 12 kalemli emirler ikinci sayfaya taştı,
  // yani "tek sayfa" dengesi kayboldu. Adres bloğunun payı açıklama kutusundan
  // ve bölüm aralıklarından kısılır — atölyeye giden formun tek yaprak kalması,
  // el yazısı için ayrılan boşluktan daha önemlidir.
  return {
    ...olcek,
    notesMin: Math.max(26, olcek.notesMin - 52),
    gap: Math.max(5, olcek.gap - 4),
    scopePad: Math.max(4, olcek.scopePad - 2),
    // Kalem satırı iç boşluğu da kısılır ve payı ÇOK KALEMDE büyüktür: 10
    // kalemde 1,5 punto satır başına 3 punto, tabloda 30 punto eder — açıklama
    // kutusundan kısılacak yer orada zaten kalmamıştı.
    pad: Math.max(2, olcek.pad - 1.5),
  };
}

const s = StyleSheet.create({
  dateRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 },
  // --- kalem tablosu: kömür başlık zemini + hairline satır çizgileri
  tHead: { flexDirection: "row", backgroundColor: BRAND.ink, alignItems: "center" },
  th: {
    fontFamily: FONTS.mono, fontWeight: 600, letterSpacing: 0.8,
    color: BRAND.paper100, paddingVertical: 5, paddingHorizontal: 6,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.line300, alignItems: "center" },
  trAlt: { backgroundColor: BRAND.paper50 },
  td: { fontFamily: FONTS.sans, color: BRAND.ink, paddingHorizontal: 6 },
  mono: { fontFamily: FONTS.mono, fontWeight: 500, letterSpacing: 0.3 },
  cIdx: { width: "7%", textAlign: "right" as const },
  cName: { width: "55%" },
  cNo: { width: "23%" },
  cQty: { width: "15%", textAlign: "right" as const },
  // --- iki kutu
  twoCol: { flexDirection: "row", gap: 8, marginTop: 14 },
  box: { flex: 1, borderWidth: 0.75, borderColor: BRAND.line300 },
  boxTitle: {
    fontFamily: FONTS.mono, fontSize: 6.5, fontWeight: 600, letterSpacing: 1,
    color: BRAND.gray600, backgroundColor: BRAND.paper150,
    paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BRAND.line300,
  },
  kv: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: BRAND.hairline },
  kvLabel: { width: "38%", fontFamily: FONTS.sans, fontSize: 7.5, fontWeight: 500, color: BRAND.gray600 },
  kvVal: { flex: 1, fontFamily: FONTS.sans, fontSize: 8, color: BRAND.ink },
  kvMono: { fontFamily: FONTS.mono, fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3 },
  // Adres kutusu: etiket sütunu YOK (başlık zaten kutunun kendisinde), metin
  // tam genişlikte sarar.
  addr: { paddingVertical: 3.5, paddingHorizontal: 6 },
  addrText: { fontFamily: FONTS.sans, fontSize: 7.5, color: BRAND.ink, lineHeight: 1.3 },
  // --- kapsam
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, borderWidth: 0.75, borderColor: BRAND.line300, padding: 10 },
  chk: { flexDirection: "row", alignItems: "center", gap: 5, width: "28%" },
  box14: { width: 10, height: 10, borderWidth: 0.75, borderColor: BRAND.ink, alignItems: "center", justifyContent: "center" },
  chkLabel: { fontFamily: FONTS.sans, fontSize: 8.5, color: BRAND.ink },
  notes: { borderWidth: 0.75, borderColor: BRAND.line300, padding: 10 },
  // --- imza bloğu sayfanın DİBİNE oturur (flexGrow'lu boşluk ile itilir)
  prep: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    borderTopWidth: 0.75, borderTopColor: BRAND.line300, paddingTop: 10, marginTop: 14,
  },
  sign: { width: 150, borderBottomWidth: 0.75, borderBottomColor: BRAND.line350, height: 26 },
});

/** Bölüm etiketi: mono kicker + kırmızı çizgi (başlık tr-TR ile büyütülür) */
function SectionLabel({ title, gloss, gap = 14 }: { title: string; gloss?: string; gap?: number }) {
  return (
    <View wrap={false} style={{ marginTop: gap, marginBottom: 5 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={T.kicker}>{trUpper(title)}</Text>
        {gloss ? <Text style={T.micro}>{gloss}</Text> : null}
      </View>
      <RuleRed />
    </View>
  );
}

function Chk({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={s.chk}>
      <View style={s.box14}>{on ? <CheckGlyph pass size={7} /> : null}</View>
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

/**
 * İş kalemleri tablosu. Ürün adı belgenin ana bilgisidir: satırın en geniş
 * sütununda ve en büyük punto ile dizilir; iş numarası onun altında ikinci
 * satır olarak DEĞİL, kendi sütununda mono dizilir (form düzeni korunur).
 */
function ItemsTable({ items }: { items: WorkOrderItem[] }) {
  const sc = itemScale(items.length);
  const rows = items.length > 0 ? items : [{ item_no: "", product_name: "—", quantity: "" }];
  return (
    <View>
      {/* Başlık satırı her sayfada tekrarlanır (10+ kalemde tablo taşar) */}
      <View style={s.tHead} fixed={items.length > 10}>
        <Text style={[s.th, s.cIdx, { fontSize: sc.head }]}>#</Text>
        <Text style={[s.th, s.cName, { fontSize: sc.head }]}>{trUpper("Ürün Adı")}</Text>
        <Text style={[s.th, s.cNo, { fontSize: sc.head }]}>{trUpper("İş Numarası")}</Text>
        <Text style={[s.th, s.cQty, { fontSize: sc.head }]}>{trUpper("Adet")}</Text>
      </View>
      {rows.map((it, i) => (
        <View
          key={i}
          style={i % 2 === 1 ? [s.tr, s.trAlt] : s.tr}
          wrap={false}
        >
          <Text style={[s.td, s.mono, s.cIdx, { fontSize: sc.sub, paddingVertical: sc.pad, color: BRAND.gray500 }]}>
            {i + 1}
          </Text>
          <Text style={[s.td, s.cName, { fontSize: sc.body, fontWeight: 500, paddingVertical: sc.pad }]}>
            {it.product_name}
          </Text>
          <Text style={[s.td, s.mono, s.cNo, { fontSize: sc.body - 1.5, paddingVertical: sc.pad, color: BRAND.red }]}>
            {it.item_no || "—"}
          </Text>
          <Text style={[s.td, s.mono, s.cQty, { fontSize: sc.body, paddingVertical: sc.pad }]}>
            {it.quantity || "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Belgenin kuyruğu: Kapsam · Açıklamalar · Hazırlayan/İmza.
 *
 * İki farklı sayfa davranışı gerekir ve ikisi aynı anda kurulamaz:
 *   · AZ KALEMDE (`pin`) blok bölünmez zaten; öncesine konan esnek boşluk
 *     imzayı sayfanın DİBİNE oturtur ve form dolu görünür.
 *   · ÇOK KALEMDE sayfa dolmuştur; üçlü tek `wrap={false}` kutuya alınır ki
 *     taşma hâlinde BİRLİKTE ikinci sayfaya geçsin — aksi hâlde yalnız imza
 *     bloğu taşar ve neredeyse boş bir sayfa basılırdı.
 */
function Tail({
  data,
  layout,
}: {
  data: WorkOrderData;
  layout: ReturnType<typeof itemScale>;
}) {
  const sc = data.scope ?? {};
  const body = (
    <>
      <SectionLabel title="Kapsam" gap={layout.gap} />
      <View style={[s.scopeRow, { padding: layout.scopePad, gap: layout.scopePad + 4 }]}>
        <Chk label="Proje" on={sc.proje} />
        <Chk label="Devreye Alma" on={sc.devreyeAlma} />
        <Chk label="Malzeme" on={sc.malzeme} />
        <Chk label="Nakliye" on={sc.nakliye} />
        <Chk label="İmalat" on={sc.imalat} />
        <Chk label="Montaj" on={sc.montaj} />
      </View>

      {/* Açıklamalar — az kalemli emirde kutu büyür, çok kalemlide daralır */}
      <SectionLabel title="Açıklamalar" gap={layout.gap} />
      <View style={[s.notes, { minHeight: layout.notesMin }]}>
        <Text style={{ ...T.body, fontSize: 9, color: BRAND.ink }}>
          {data.notes && data.notes.trim() ? data.notes : "—"}
        </Text>
      </View>

      {layout.pin && <View style={{ flexGrow: 1 }} />}

      <View
        wrap={false}
        style={[s.prep, { marginTop: layout.gap, paddingTop: layout.pin ? 10 : 6 }]}
      >
        <View>
          <Text style={T.kickerInk}>{trUpper("İş Emrini Hazırlayan")}</Text>
          <Text style={{ ...T.body, fontSize: 9, color: BRAND.ink, marginTop: 5 }}>
            Adı Soyadı: {data.prepared_by_name || "—"}
          </Text>
          <Text style={{ ...T.body, fontSize: 9, color: BRAND.ink }}>
            Unvanı: {data.prepared_by_title || "—"}
          </Text>
        </View>
        <View>
          <View style={s.sign} />
          <Text style={{ ...T.micro, marginTop: 3, textAlign: "right" }}>{trUpper("İmza")}</Text>
        </View>
      </View>
    </>
  );

  // `pin` tiplerinde esnek boşluğun sayfa yüksekliğine erişebilmesi için
  // kuyruk SARMALANMAZ; yoğun tiplerde tek kutuya alınır.
  return layout.pin ? body : <View wrap={false}>{body}</View>;
}

export function WorkOrderDocument({ data, settings }: { data: WorkOrderData; settings?: ReportSettings }) {
  const st = { ...DEFAULT_REPORT_SETTINGS, ...settings };
  // REVİZYON HARFİ künyeye girer (kullanıcı kararı, 18.08.2026): iş emri
  // yayımlandıktan sonra kalem eklenip çıkarılabildiği için atölyedeki asıl
  // soru "elimdeki kâğıt hangi revizyon"dur. İLK YAYINDA HARF YOKTUR ve künye
  // o zaman revizyondan hiç söz etmez — "REV —" gibi bir yer tutucu, belgenin
  // bilmediği bir şeyi biliyormuş gibi göstermek olurdu (md. 5).
  const rev = revizyonHarfi(data.revision);
  const adresVar = Boolean(data.shipping_address?.trim() || data.assembly_address?.trim());
  const layout = itemScale(data.items.length, adresVar);
  const year = /^(\d{4})/.exec(data.work_order_date ?? "")?.[1] ?? String(new Date().getFullYear());
  return (
    <Document
      title={rev ? `İş Emri ${data.job_no} Rev ${rev}` : `İş Emri ${data.job_no}`}
      author={st.company}
      subject={data.title}
      language="tr"
    >
      <BrandPage
        docLine={`ORION CRANES · İŞ EMRİ${rev ? ` · REV ${rev}` : ""} · ${year}`}
        docCode={workOrderDocCode(data.job_no, rev)}
      >
        <PageHeader
          kicker="ORION CRANES · İş Emri"
          title="İş Emri"
          meta={
            `${data.form_code || "FR.11.02"} · ${trUpper("İş No")} ${data.job_no}` +
            (rev ? ` · ${trUpper("Rev")} ${rev}` : "")
          }
        />

        {/* İşin adı belgenin üstünde bir kez, tam genişlikte durur: iş emrini
            eline alan atölye önce hangi işe baktığını görmelidir. */}
        <View style={s.dateRow}>
          <Text style={T.data}>{trUpper("Tarih")} {fmtDate(data.work_order_date)}</Text>
        </View>
        <View style={{ marginBottom: layout.pin ? 10 : 6 }}>
          <Text style={T.kickerInk}>{trUpper("İşin Adı")}</Text>
          <Text style={{ ...T.subhead, fontSize: layout.pin ? 12 : 10.5, marginTop: 3 }}>
            {data.title || "—"}
          </Text>
        </View>

        <SectionLabel
          title="İş Kalemleri"
          gloss={`${data.items.length || 1} KALEM`}
          gap={layout.gap - 4}
        />
        <ItemsTable items={data.items} />

        {/* Müşteri + İş bilgileri */}
        <View style={[s.twoCol, { marginTop: layout.gap }]}>
          <View style={s.box}>
            <Text style={s.boxTitle}>{trUpper("Müşteri Bilgileri")}</Text>
            <KV label="Adı" value={data.customer} />
            <KV label="Adresi" value={data.customer_address} />
            <KV label="Vergi Dairesi" value={data.customer_tax_office} />
            <KV label="Vergi No" value={data.customer_tax_no} mono />
            <KV label="Telefon" value={data.customer_phone} mono />
            <KV label="Faks" value={data.customer_fax} mono />
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>{trUpper("İş Bilgileri")}</Text>
            <KV label="Sözleşme" value={data.contract_exists ? "Var" : "Yok"} />
            <KV label="Sözleşme Tarihi" value={fmtDate(data.contract_date)} mono />
            <KV label="Atölye Çıkış" value={fmtDate(data.workshop_exit_date)} mono />
            <KV label="Teslim Tarihi" value={fmtDate(data.delivery_date)} mono />
            <KV label="Adet" value={data.quantity_text} mono />
            <KV label="İş Lideri" value={data.job_leader} />
            <KV label="Proje Yöneticisi" value={data.project_manager} />
          </View>
        </View>

        {/* SEVK VE MONTAJ ADRESİ. İki kutunun İÇİNE değil ALTINA konur: adres
            uzun bir metindir ve %38'lik etiket sütununun yanında kalan yere
            sığmayıp kutuyu komşusundan iki kat uzun yapardı. İkisi de boşsa
            bölüm hiç basılmaz — boş çerçeve, belgeye doldurulmamış bir alan
            olduğunu söyler ki burada söylenecek bir şey yok. */}
        {adresVar && (
          <View style={[s.twoCol, { marginTop: layout.gap }]}>
            <View style={s.box}>
              <Text style={s.boxTitle}>{trUpper("Sevk Adresi")}</Text>
              <View style={s.addr}>
                <Text style={s.addrText}>{data.shipping_address?.trim() || "—"}</Text>
              </View>
            </View>
            <View style={s.box}>
              <Text style={s.boxTitle}>{trUpper("Montaj Adresi")}</Text>
              <View style={s.addr}>
                <Text style={s.addrText}>{data.assembly_address?.trim() || "—"}</Text>
              </View>
            </View>
          </View>
        )}

        <Tail data={data} layout={layout} />
      </BrandPage>
    </Document>
  );
}

export async function renderWorkOrderPdf(data: WorkOrderData, settings?: ReportSettings): Promise<Buffer> {
  return renderToBuffer(<WorkOrderDocument data={data} settings={settings} />);
}
