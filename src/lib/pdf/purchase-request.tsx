// Satın alma talebi PDF'i — TALEP HAVUZUNDAN üretilir, tedarikçiye gider.
//
// Paket içi `drawing-purchasing.tsx`in yerini alır (o ekran kaldırıldı) ve
// ondan İKİ YERDE ayrılır:
//
//  1. SATIR ÇOK PROJELİDİR. Havuzda bir kalem birden çok işe hizmet eder ve
//     "İş No" sütunu birden çok numara taşıyabilir. Paket belgesinde tek bir
//     kalem numarası künyedeydi; burada satırın kendi bilgisidir.
//  2. SÜTUN DÜZENİ İŞ HAZIRLAMA LİSTESİ'nindir (kullanıcı kararı, md. 2):
//     ekip belgeyi o düzende okumaya alışkın ve tedarikçiyle onu paylaşıyor.
//
// A4 YATAY — dokuz sütun dikey sayfada okunmaz. Paket belgesi yedi sütunla
// dikey basılıyordu; tercih körü körüne devralınmadı, sütun sayısı değişti.
//
// FİYAT SÜTUNU YOKTUR ve bu bilinçlidir: belge tedarikçiye TEKLİF İSTEMEK için
// gider ve elimizdeki fiyatı göstermek pazarlığı baştan kaybettirirdi. Satış
// Takibi'nin "Güncel İş Listesi fiyatsızdır" kuralıyla aynı refleks.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, T, trUpper } from "@/lib/pdf/brand";
import type { CompanyInfo } from "@/lib/pdf/brand";

/** Sütun payları — toplamı 100. İŞ HAZIRLAMA LİSTESİ'nin sırası. */
const SUTUNLAR: { baslik: string; pay: number; sag?: boolean }[] = [
  { baslik: "#", pay: 3.5, sag: true },
  { baslik: "İş No", pay: 9 },
  { baslik: "Resim No", pay: 9 },
  { baslik: "Kullanıldığı Yer", pay: 12 },
  { baslik: "Tanımı", pay: 26 },
  { baslik: "Kalite", pay: 8 },
  { baslik: "Miktar", pay: 7, sag: true },
  { baslik: "Birim", pay: 5 },
  { baslik: "Ağırlık", pay: 7, sag: true },
  { baslik: "Not", pay: 13.5 },
];

const S = StyleSheet.create({
  satir: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2.4 },
  ayrac: { borderBottomWidth: 0.4, borderBottomColor: BRAND.line300 },
  baslikSatiri: {
    flexDirection: "row",
    backgroundColor: BRAND.ink,
    paddingVertical: 3,
    marginBottom: 1,
  },
  baslikYazi: { fontSize: 6.8, color: BRAND.white, fontFamily: FONTS.sans, paddingHorizontal: 2 },
  hucre: { fontSize: 7.2, paddingHorizontal: 2 },
  mono: { fontSize: 7.2, fontFamily: FONTS.mono, paddingHorizontal: 2 },
  grupSatiri: { backgroundColor: BRAND.paper200, paddingVertical: 3 },
  imza: { marginTop: 16, flexDirection: "row", justifyContent: "space-between", gap: 24 },
  imzaKutu: { flex: 1, borderTopWidth: 0.6, borderTopColor: BRAND.line300, paddingTop: 4 },
});

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

export interface PurchaseRequestRow {
  sinif: string;
  tanim: string;
  /** Birden çok iş olabilir — havuzun paket belgesinden en büyük farkı. */
  isNolari: string[];
  parcaKodlari: string[];
  kullanildigiYer: string;
  malzeme: string;
  /** Sipariş edilecek adet: kalan varsa o, yoksa gereken. */
  adet: number | null;
  birim: string;
  toplamAgirlikKg: number | null;
  not: string;
}

export interface PurchaseRequestMeta {
  docCode: string;
  generatedAt: string;
  preparedBy: string;
  /** İnsan okunur süzgeç özeti — belgeyi alan kişi neyin listelendiğini bilmeli. */
  filterText: string;
  /** Seçimle mi süzgeçle mi üretildi? Belgenin kapsamı budur. */
  scopeText: string;
}

export interface PurchaseRequestProps {
  rows: PurchaseRequestRow[];
  meta: PurchaseRequestMeta;
  company: CompanyInfo;
}

export function PurchaseRequestDocument({ rows, meta, company }: PurchaseRequestProps) {
  // KATEGORİ BAŞLIĞI ATILIR, satır satır tekrar edilmez: tedarikçi listeyi
  // aileye göre okur ve aynı sözcüğü kırk kez görmek okumayı zorlaştırır.
  // Sıra çağıran tarafından verilmiştir (ekrandaki sıranın aynısı).
  const bloklar: { sinif: string; satirlar: PurchaseRequestRow[] }[] = [];
  for (const r of rows) {
    const son = bloklar[bloklar.length - 1];
    if (son && son.sinif === r.sinif) son.satirlar.push(r);
    else bloklar.push({ sinif: r.sinif, satirlar: [r] });
  }

  const toplamAdet = rows.reduce((t, r) => t + (r.adet ?? 0), 0);
  const toplamAgirlik = rows.reduce((t, r) => t + (r.toplamAgirlikKg ?? 0), 0);

  let sira = 0;

  return (
    <Document title="Satın Alma Talebi" author="Orion Cranes" subject={meta.docCode}>
      <BrandPage
        orientation="landscape"
        docLine={trUpper("Orion Cranes · Satın Alma Talebi")}
        docCode={meta.docCode}
        company={company}
      >
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} logoWidth={130} />

        {/* KÜNYE NOTLARI KALDIRILDI (kullanıcı kararı, 14.08.2026): kalem/adet/
            kg özeti ile süzgeç ve "Hazırlayan" satırı belgeden çıkarıldı —
            tedarikçiye giden talepte iç süzgeç bilgisi gürültüdür ve toplam
            zaten sonda yazar. */}
        <Text style={[T.heading, { fontSize: 11, marginBottom: 8 }]}>SATIN ALMA TALEBİ</Text>

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
            listeyi tanıma göre sıralarsa aynı kategori birden çok blok olur ve
            ad tek başına tekil değildir. */}
        {bloklar.map((blok, bi) => (
          <View key={`${bi}-${blok.sinif}`} wrap>
            <View style={[S.satir, S.grupSatiri]} wrap={false}>
              <Text style={[S.hucre, { width: "100%", fontFamily: FONTS.sans, fontSize: 7.4 }]}>
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
                  <Text style={[S.mono, { width: `${SUTUNLAR[1].pay}%` }]}>
                    {r.isNolari.join(", ")}
                  </Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[2].pay}%` }]}>
                    {r.parcaKodlari.join(", ")}
                  </Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[3].pay}%` }]}>
                    {r.kullanildigiYer}
                  </Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[4].pay}%` }]}>{r.tanim}</Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[5].pay}%` }]}>{r.malzeme}</Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[6].pay}%`, textAlign: "right" }]}>
                    {say(r.adet)}
                  </Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[7].pay}%` }]}>{r.birim}</Text>
                  <Text style={[S.mono, { width: `${SUTUNLAR[8].pay}%`, textAlign: "right" }]}>
                    {say(r.toplamAgirlikKg, 1)}
                  </Text>
                  <Text style={[S.hucre, { width: `${SUTUNLAR[9].pay}%` }]}>{r.not}</Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* TOPLAM SATIRI listenin sonunda: tedarikçi teklifi verirken kaç
            kalem ve kaç kilo konuştuğumuzu tek bakışta görmeli. */}
        <View style={[S.satir, { borderTopWidth: 0.8, borderTopColor: BRAND.ink, marginTop: 2 }]} wrap={false}>
          <Text style={[S.hucre, { width: "58.5%", fontFamily: FONTS.sans }]}>
            TOPLAM — {rows.length} kalem
          </Text>
          <Text style={[S.mono, { width: "7%", textAlign: "right", fontFamily: FONTS.sans }]}>
            {say(toplamAdet)}
          </Text>
          <Text style={[S.hucre, { width: "5%" }]} />
          <Text style={[S.mono, { width: "7%", textAlign: "right", fontFamily: FONTS.sans }]}>
            {say(toplamAgirlik, 1)}
          </Text>
          <Text style={[S.hucre, { width: "13.5%" }]} />
        </View>

        {/* İmza kutuları: belge basılıp elden de dolaşıyor. */}
        <View style={S.imza} wrap={false}>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Hazırlayan</Text>
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Onaylayan</Text>
          </View>
          <View style={S.imzaKutu}>
            <Text style={T.micro}>Tedarikçi / Teklif</Text>
          </View>
        </View>
      </BrandPage>
    </Document>
  );
}

export async function renderPurchaseRequestPdf(props: PurchaseRequestProps): Promise<Buffer> {
  return renderToBuffer(<PurchaseRequestDocument {...props} />);
}
