// SİPARİŞ ONAYI PDF'i — kullanıcı kararı (14.08.2026):
//   "Sipariş oluşturduğumda sipariş sayfasına düşüyor. Bu siparişin pdf olarak
//    oluşmuş halini listeleyip müşteriye sipariş onayı olarak göndermek
//    istiyorum. Sipariş no altına pdf indirebileceğim buton. PDF kurgusunu
//    diğer pdf'ler gibi, mümkünse dikey."
//
// A4 DİKEY, çok sayfalı; başlık satırı her sayfada tekrar eder. Satırlar
// `alignItems: flex-start` + `Text` sarması ile uzun yazıda büyür, iç içe
// geçmez (md. 12). KÜNYE/SÜZGEÇ NOTU YOKTUR (md. 11): tedarikçiye giden belgede
// iç bilgi gürültüdür.
//
// TALEP PDF'inden farkı FİYAT TAŞIMASIDIR: bu bir teklif isteği değil verilmiş
// bir SİPARİŞtir; birim fiyat, KDV ve KDV dahil tutar açıkça yazılır.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, T, trUpper } from "@/lib/pdf/brand";
import type { CompanyInfo } from "@/lib/pdf/brand";
import { fmtMoney } from "@/lib/currency";
import { orderVatTotals, vatRateOf } from "@/lib/purchasing/vat";

const SUTUNLAR: { baslik: string; pay: number; sag?: boolean }[] = [
  { baslik: "#", pay: 4, sag: true },
  { baslik: "Kalem", pay: 26 },
  { baslik: "İş No", pay: 9 },
  { baslik: "Marka/Kalite", pay: 12 },
  { baslik: "Adet", pay: 7, sag: true },
  { baslik: "Birim Fiyat", pay: 12, sag: true },
  { baslik: "KDV", pay: 5, sag: true },
  { baslik: "Tutar", pay: 11, sag: true },
  { baslik: "KDV Dahil", pay: 14, sag: true },
];

const S = StyleSheet.create({
  satir: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2.6 },
  ayrac: { borderBottomWidth: 0.4, borderBottomColor: BRAND.line300 },
  baslikSatiri: { flexDirection: "row", backgroundColor: BRAND.ink, paddingVertical: 3, marginBottom: 1 },
  baslikYazi: { fontSize: 7, color: BRAND.white, fontFamily: FONTS.sans, paddingHorizontal: 2 },
  hucre: { fontSize: 7.6, paddingHorizontal: 2 },
  mono: { fontSize: 7.6, fontFamily: FONTS.mono, paddingHorizontal: 2 },
  kunye: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginBottom: 8 },
  kunyeKutu: {
    width: "33.33%",
    paddingVertical: 3,
    paddingRight: 8,
  },
  kunyeEtiket: { fontSize: 6.5, color: BRAND.gray600, fontFamily: FONTS.sans, marginBottom: 1 },
  kunyeDeger: { fontSize: 9, color: BRAND.ink, fontFamily: FONTS.sans, fontWeight: 700 },
  toplamKutu: { marginTop: 6, marginLeft: "auto", width: "45%" },
  toplamSatir: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  imza: { marginTop: 20, flexDirection: "row", justifyContent: "space-between", gap: 24 },
  imzaKutu: { flex: 1, borderTopWidth: 0.6, borderTopColor: BRAND.line300, paddingTop: 4 },
});

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

export interface OrderConfirmationLine {
  sample: string;
  itemNo: string;
  quality: string;
  qty: number;
  unitPrice: number | null;
  vatRate: number;
}

export interface OrderConfirmationOrder {
  orderNo: string;
  supplier: string;
  orderedAt: string;
  dueAt: string | null;
  paymentLabel: string;
  currency: string;
  lines: OrderConfirmationLine[];
}

export interface OrderConfirmationProps {
  order: OrderConfirmationOrder;
  /** `preparedBy` — PDF'i basan kullanıcının adı; "Sipariş Veren" imzasına yazılır (md. 8). */
  meta: { docCode: string; generatedAt: string; preparedBy?: string };
  company: CompanyInfo;
}

function tarih(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("tr-TR");
}

export function OrderConfirmationDocument({ order, meta, company }: OrderConfirmationProps) {
  const cur = order.currency;
  const toplamlar = orderVatTotals(order.lines);

  return (
    <Document title="Sipariş Onayı" author="Orion Cranes" subject={meta.docCode}>
      <BrandPage
        docLine={trUpper("Orion Cranes · Satın Alma Siparişi")}
        docCode={meta.docCode}
        company={company}
      >
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} logoWidth={120} />

        <Text style={[T.heading, { fontSize: 12, marginBottom: 8 }]}>SİPARİŞ ONAYI</Text>

        <View style={S.kunye}>
          {[
            ["Tedarikçi", order.supplier || "—"],
            ["Sipariş No", order.orderNo || "—"],
            ["Sipariş Tarihi", tarih(order.orderedAt)],
            ["Termin", tarih(order.dueAt)],
            ["Ödeme", order.paymentLabel],
            ["Para Birimi", cur],
          ].map(([etiket, deger]) => (
            <View key={etiket} style={S.kunyeKutu}>
              <Text style={S.kunyeEtiket}>{etiket}</Text>
              <Text style={S.kunyeDeger}>{deger}</Text>
            </View>
          ))}
        </View>

        <View style={S.baslikSatiri} fixed>
          {SUTUNLAR.map((s) => (
            <Text
              key={s.baslik}
              style={[S.baslikYazi, { width: `${s.pay}%`, textAlign: s.sag ? "right" : "left" }]}
            >
              {s.baslik}
            </Text>
          ))}
        </View>

        {order.lines.map((l, i) => {
          const oran = vatRateOf(l.vatRate);
          const net = l.qty * (l.unitPrice ?? 0);
          return (
            <View key={i} style={[S.satir, S.ayrac]} wrap={false}>
              <Text style={[S.mono, { width: `${SUTUNLAR[0].pay}%`, textAlign: "right" }]}>{i + 1}</Text>
              <Text style={[S.hucre, { width: `${SUTUNLAR[1].pay}%` }]}>{l.sample}</Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[2].pay}%` }]}>{l.itemNo || "—"}</Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[3].pay}%` }]}>{l.quality || "—"}</Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[4].pay}%`, textAlign: "right" }]}>
                {say(l.qty)}
              </Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[5].pay}%`, textAlign: "right" }]}>
                {l.unitPrice == null ? "—" : fmtMoney(l.unitPrice, cur)}
              </Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[6].pay}%`, textAlign: "right" }]}>%{oran}</Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[7].pay}%`, textAlign: "right" }]}>
                {fmtMoney(net, cur)}
              </Text>
              <Text style={[S.mono, { width: `${SUTUNLAR[8].pay}%`, textAlign: "right" }]}>
                {fmtMoney(net * (1 + oran / 100), cur)}
              </Text>
            </View>
          );
        })}

        <View style={S.toplamKutu} wrap={false}>
          <View style={S.toplamSatir}>
            <Text style={[S.hucre, { fontSize: 8 }]}>KDV Hariç Tutar</Text>
            <Text style={[S.mono, { fontSize: 8 }]}>{fmtMoney(toplamlar.net, cur)}</Text>
          </View>
          <View style={S.toplamSatir}>
            <Text style={[S.hucre, { fontSize: 8 }]}>KDV</Text>
            <Text style={[S.mono, { fontSize: 8 }]}>{fmtMoney(toplamlar.vat, cur)}</Text>
          </View>
          <View style={[S.toplamSatir, { borderTopWidth: 0.8, borderTopColor: BRAND.ink }]}>
            <Text style={[S.hucre, { fontSize: 9, fontFamily: FONTS.sans, fontWeight: 700 }]}>
              KDV Dahil Tutar
            </Text>
            <Text style={[S.mono, { fontSize: 9, fontWeight: 600 }]}>
              {fmtMoney(toplamlar.gross, cur)}
            </Text>
          </View>
        </View>

        <View style={S.imza} wrap={false}>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Sipariş Veren</Text>
            {/* PDF'İ BASAN KİŞİNİN ADI (md. 8): boşsa satır yine imzaya açıktır. */}
            {meta.preparedBy ? (
              <Text style={{ fontSize: 8, fontFamily: FONTS.sans, marginTop: 2 }}>
                {meta.preparedBy}
              </Text>
            ) : null}
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Onaylayan</Text>
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Tedarikçi Kaşe / İmza</Text>
          </View>
        </View>
      </BrandPage>
    </Document>
  );
}

export async function renderOrderConfirmationPdf(props: OrderConfirmationProps): Promise<Buffer> {
  return renderToBuffer(<OrderConfirmationDocument {...props} />);
}
