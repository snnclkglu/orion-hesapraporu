// Satın alma talebi PDF'i — tedarikçiye gönderilip teklif alınacak belge.
//
// PARÇA DEFTERİNDEN AYRI BİR BELGEDİR ve amacı başkadır: defter atölyenin
// dökümüdür, bu ise DIŞARIYA gider. Bu yüzden burada kalınlık, DXF, montaj gibi
// imalat sütunları YOKTUR — tedarikçinin bilmesi gereken şey ne, kaç adet,
// hangi malzeme ve ne zaman lazım olduğudur.
//
// A4 DİKEY: yedi sütun dikey sayfada rahat okunur ve belge e-postayla
// gönderildiğinde karşı taraf onu yazdırıp üzerine fiyat yazar. Parça defteri
// yatay basılır çünkü on üç sütunu vardır; buradaki tercih körü körüne
// devralınmadı.
//
// Marka altyapısı (kırmızı omurga, bant, künye, folio) `brand.tsx`ten gelir —
// hesap raporu ve ekipman listesiyle aynı çerçeve, çünkü üçü de TESLİM EDİLEN
// belgelerdir.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, T, trUpper } from "@/lib/pdf/brand";
import type { CompanyInfo } from "@/lib/pdf/brand";

/** Sütun payları — toplamı 100. */
const SUTUNLAR: { baslik: string; pay: number; sag?: boolean }[] = [
  { baslik: "#", pay: 5, sag: true },
  { baslik: "Kategori", pay: 15 },
  { baslik: "Tanım", pay: 38 },
  { baslik: "Adet", pay: 7, sag: true },
  { baslik: "Malzeme", pay: 12 },
  { baslik: "Ağırlık", pay: 9, sag: true },
  { baslik: "Tahmini Teslim", pay: 14 },
];

const S = StyleSheet.create({
  satir: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2.6 },
  ayrac: { borderBottomWidth: 0.4, borderBottomColor: BRAND.line300 },
  baslikSatiri: {
    flexDirection: "row",
    backgroundColor: BRAND.ink,
    paddingVertical: 3,
    marginBottom: 1,
  },
  baslikYazi: { fontSize: 7, color: BRAND.white, fontFamily: FONTS.sans, paddingHorizontal: 2 },
  hucre: { fontSize: 7.4, paddingHorizontal: 2 },
  mono: { fontSize: 7.4, fontFamily: FONTS.mono, paddingHorizontal: 2 },
  grupSatiri: { backgroundColor: BRAND.paper200, paddingVertical: 3 },
  imza: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
  },
  imzaKutu: { flex: 1, borderTopWidth: 0.6, borderTopColor: BRAND.line300, paddingTop: 4 },
});

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

export interface PurchasingRowOut {
  sinif: string;
  tanim: string;
  adet: number | null;
  malzeme: string;
  toplamAgirlikKg: number | null;
  parcaKodu: string;
  /** `YYYY-MM-DD` ya da boş. */
  dueAt: string;
  alindi: boolean;
  teslim: boolean;
}

export interface PurchasingMeta {
  packageTitle: string;
  folderName: string;
  itemNo: string;
  groupCode: string;
  docCode: string;
  generatedAt: string;
  preparedBy: string;
  /** İnsan okunur süzgeç özeti — belgeyi alan kişi neyin listelendiğini bilmeli. */
  filterText: string;
}

function tarihGoster(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("tr-TR");
}

export interface PurchasingDocProps {
  rows: PurchasingRowOut[];
  meta: PurchasingMeta;
  company: CompanyInfo;
}

export function PurchasingDocument({ rows, meta, company }: PurchasingDocProps) {
  // KATEGORİ BAŞLIĞI ATILIR, satır satır tekrar edilmez: tedarikçi listeyi
  // aileye göre okur ve aynı sözcüğü kırk kez görmek okumayı zorlaştırır.
  // Sıra çağıran tarafından verilmiştir (ekrandaki sıranın aynısı).
  const bloklar: { sinif: string; satirlar: PurchasingRowOut[] }[] = [];
  for (const r of rows) {
    const son = bloklar[bloklar.length - 1];
    if (son && son.sinif === r.sinif) son.satirlar.push(r);
    else bloklar.push({ sinif: r.sinif, satirlar: [r] });
  }

  const toplamAdet = rows.reduce((t, r) => t + (r.adet ?? 0), 0);
  const toplamAgirlik = rows.reduce((t, r) => t + (r.toplamAgirlikKg ?? 0), 0);

  let sira = 0;

  return (
    <Document
      title={`${meta.packageTitle} — Satın Alma Talebi`}
      author="Orion Cranes"
      subject={meta.docCode}
    >
      <BrandPage
        docLine={trUpper(`Orion Cranes · Satın Alma Talebi · ${meta.packageTitle}`)}
        docCode={meta.docCode}
        company={company}
      >
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} logoWidth={130} />

        <Text style={[T.heading, { fontSize: 11, marginBottom: 2 }]}>SATIN ALMA TALEBİ</Text>
        <Text style={[T.micro, { marginBottom: 2 }]}>{trUpper(meta.packageTitle)}</Text>
        <Text style={[T.micro, { marginBottom: 2 }]}>
          {[
            meta.itemNo ? `Kalem ${meta.itemNo}` : "Kalem eşleşmemiş",
            meta.groupCode && `Grup ${meta.groupCode}`,
            `${rows.length} kalem`,
            toplamAdet > 0 && `${say(toplamAdet)} adet`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={[T.micro, { marginBottom: 8, color: BRAND.gray600 }]}>
          Süzgeç: {meta.filterText}
          {meta.preparedBy ? ` · Hazırlayan: ${meta.preparedBy}` : ""}
        </Text>

        {/* Başlık satırı her sayfada tekrar eder. */}
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

        {/* ANAHTAR SIRA NUMARASINI TAŞIR, kategori adını değil: kullanıcı
            listeyi tanıma ya da teslim tarihine göre sıralarsa aynı kategori
            birden çok blok olur ve ad tek başına tekil değildir. */}
        {bloklar.map((blok, bi) => (
          <View key={`${bi}-${blok.sinif}`} wrap>
            <View style={[S.satir, S.grupSatiri]} wrap={false}>
              <Text style={[S.hucre, { width: "100%", fontFamily: FONTS.sans, fontSize: 7.6 }]}>
                {trUpper(blok.sinif)} — {blok.satirlar.length} kalem
              </Text>
            </View>
            {blok.satirlar.map((r, i) => {
              sira += 1;
              return (
                <View key={`${bi}-${i}`} style={[S.satir, S.ayrac]} wrap={false}>
                  <Text style={[S.mono, { width: `${SUTUNLAR[0].pay}%`, textAlign: "right" }]}>
                    {sira}
                  </Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[1].pay}%` }]}>{r.sinif}</Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[2].pay}%` }]}>
                    {r.tanim}
                    {r.parcaKodu ? `  (${r.parcaKodu})` : ""}
                  </Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[3].pay}%`, textAlign: "right" }]}>
                    {say(r.adet)}
                  </Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[4].pay}%` }]}>{r.malzeme}</Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[5].pay}%`, textAlign: "right" }]}>
                    {say(r.toplamAgirlikKg, 2)}
                  </Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[6].pay}%` }]}>
                    {r.teslim ? "Teslim alındı" : tarihGoster(r.dueAt)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        <View style={[S.satir, { borderTopWidth: 0.8, borderTopColor: BRAND.ink, marginTop: 2 }]}>
          <Text style={[S.hucre, { width: "58%", fontFamily: FONTS.sans }]}>TOPLAM</Text>
          <Text style={[S.mono, { width: "7%", textAlign: "right", fontFamily: FONTS.sans }]}>
            {say(toplamAdet)}
          </Text>
          <Text style={[S.mono, { width: "12%" }]} />
          <Text style={[S.mono, { width: "9%", textAlign: "right", fontFamily: FONTS.sans }]}>
            {toplamAgirlik > 0 ? say(toplamAgirlik, 2) : ""}
          </Text>
          <Text style={[S.mono, { width: "14%" }]} />
        </View>

        {/* FİYAT SÜTUNU YOKTUR ve bu bilinçlidir: bu belge teklif İSTEMEK için
            gider, fiyatı karşı taraf yazar. Boş bir fiyat sütunu basmak
            dosyayı "eksik doldurulmuş" gösterirdi; imza alanı ise belgenin
            gerçekten bir talep olduğunu söyler. */}
        <View style={S.imza}>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Talep eden</Text>
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Onay</Text>
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Tedarikçi / teklif</Text>
          </View>
        </View>
      </BrandPage>
    </Document>
  );
}

export async function renderPurchasingPdf(props: PurchasingDocProps): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<PurchasingDocument {...props} />);
  return new Uint8Array(buffer);
}
