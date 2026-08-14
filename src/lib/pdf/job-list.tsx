// GÜNCEL İŞ LİSTESİ — müşteriye teklif ekinde giden referans belgesi.
//
// Teklif isteyen müşteri "başka neler yaptınız" diye sorar; cevabı bugüne
// kadar elle biçimlenmiş bir Excel çıktısıydı. Bu belge onun yerini alır ve
// veriyi Satış Takibi'nden ALIR — iki liste ayrışamaz.
//
// FİYAT BU BELGEYE GİREMEZ. Kural bir "unutmayalım" notu değil, TİP
// SEVİYESİNDE bir engeldir: `JobListRow` birim fiyat, toplam bedel, para
// birimi ya da kur alanı TAŞIMAZ. Belgeyi üreten uç satış satırından yalnız
// bu alanları kopyalar; ileride bir alan eklenmek istense derleyici durdurur.
//
// A4 YATAY: on bir sütunlu bir çizelge dikey sayfada okunmaz. Marka
// altyapısı (kırmızı omurga, bant, künye, folio) `brand.tsx`ten gelir —
// hesap raporu, ekipman listesi ve parça defteriyle aynı çerçeve, çünkü
// dördü de TESLİM EDİLEN belgelerdir.
//
// YAPI BÜYÜMEYE HAZIRDIR. Bugün 88 satır; yüzlerce satırda da aynı belge
// çıkar: başlık satırı her sayfada tekrar eder (`fixed`), yıl bandı sayfa
// dibinde yalnız kalmaz (`minPresenceAhead`) ve satırlar sayfa arasında
// bölünmez (`wrap={false}`).
//
// BELGE TEK BİR ÇİZELGEDİR. Bir süre sonuna "Müşteri Referansları" kapanış
// sayfası eklenmişti (müşteri başına iş adedi ve tonaj); kaldırıldı
// (kullanıcı kararı, 12.08.2026) — sayfa başındaki ölçü şeridiyle aynı
// gerekçe: firmanın toplam iş hacmi teklif ekinde rakamla açıklanmıyor.

import { Document, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  FONTS,
  PageHeader,
  T,
  trUpper,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { fmtNum } from "@/lib/currency";

/**
 * Belgeye giren tek satır — İŞ KALEMİ.
 *
 * Ticari alan YOKTUR (bkz. dosya başlığı). `deliveredAt` bir tarih değil bir
 * DURUM üretir: müşteri "hangileri bitti" diye bakar, sevk tarihinin kendisi
 * zaten ayrı bir sütundadır.
 */
export interface JobListRow {
  itemNo: string;
  productName: string;
  /** Görünen müşteri adı (defterdeki kısaltma) */
  customer: string;
  scope: string;
  quantity: number | null;
  unit: string;
  totalWeightKg: number | null;
  /** ISO tarih (yyyy-aa-gg) ya da null */
  contractDate: string | null;
  dueDate: string | null;
  shipmentDate: string | null;
  shipmentPlace: string;
}

export interface JobListMeta {
  /** "AĞUSTOS 2026" — belgenin dönemi, adında da geçer */
  periodLabel: string;
  /** `ORC-IL-2026-08` */
  docCode: string;
  /** "11.08.2026" */
  generatedAt: string;
  /** Süzgeç uygulandıysa künyeye yazılır ("yalnız 2026") */
  filterText?: string;
}

export interface JobListDocProps {
  rows: JobListRow[];
  meta: JobListMeta;
  company: CompanyInfo;
}

/**
 * Sütun payları — toplamı 100.
 *
 * Paylar BAŞLIĞIN TEK SATIRA SIĞMASINA göre ayarlıdır: kömür başlık bandı
 * `fixed` olduğu için iki satıra çıktığında bedeli bir sayfa değil HER SAYFA
 * olur. Ağırlık sütununun başlığı bu yüzden birimsizdir ("Ağırlık (kg)" tek
 * satıra sığmıyordu); birim çizelgenin altındaki dipnotta söylenir.
 */
// KAPSAM VE TERMİN SÜTUNLARI KALDIRILDI (kullanıcı kararı, 14.08.2026):
// müşteriye giden referans belgesinde iç kapsam metni ve taahhüt tarihi
// gereksizdir. Kalan on sütun daha rahat okunur; boşalan pay İşin Adı'na gitti.
const SUTUNLAR: { baslik: string; pay: number; hiza?: "right" | "center" }[] = [
  { baslik: "No", pay: 2.5, hiza: "right" },
  { baslik: "İş No", pay: 6 },
  { baslik: "Müşteri", pay: 11 },
  { baslik: "İşin Adı", pay: 34 },
  { baslik: "Miktar", pay: 7, hiza: "right" },
  { baslik: "Ağırlık", pay: 8, hiza: "right" },
  { baslik: "Sözleşme", pay: 7, hiza: "center" },
  { baslik: "Sevk", pay: 7, hiza: "center" },
  { baslik: "Sevk Yeri", pay: 8, hiza: "center" },
  { baslik: "Durum", pay: 9.5 },
];

const S = StyleSheet.create({
  // ---- çizelge
  baslikSatiri: { flexDirection: "row", backgroundColor: BRAND.ink },
  baslikYazi: {
    fontFamily: FONTS.mono,
    fontSize: 6.2,
    fontWeight: 600,
    letterSpacing: 0.7,
    color: BRAND.paper100,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  yilBandi: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BRAND.paper200,
    borderLeftWidth: 2,
    borderLeftColor: BRAND.red,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  yilYazi: { fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: BRAND.ink },
  yilSayac: { fontFamily: FONTS.sans, fontSize: 7, fontWeight: 500, color: BRAND.gray600 },
  satir: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 0.4,
    borderBottomColor: BRAND.hairline,
  },
  satirAlt: { backgroundColor: BRAND.paper50 },
  hucre: {
    fontFamily: FONTS.sans,
    fontSize: 6.8,
    lineHeight: 1.35,
    color: BRAND.ink,
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  mono: { fontFamily: FONTS.mono, fontSize: 6.6, letterSpacing: 0.2 },
  sonuk: { color: BRAND.gray600 },
  urunAdi: { fontWeight: 500 },

  // ---- durum rozeti
  durum: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 3 },
  nokta: { width: 4, height: 4, borderRadius: 2 },
  durumYazi: { fontFamily: FONTS.sans, fontSize: 6.4, fontWeight: 500 },

  dipnot: { ...T.caption, fontSize: 6.8, color: BRAND.gray600, marginTop: 8 },
});

/** ISO tarihi gg.aa.yyyy yapar; boşsa yarım tire. */
function tarih(iso: string | null): string {
  if (!iso) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Satırın yılı — sözleşme tarihinden. Tarihsiz satırlar sona düşer. */
export function jobListYear(r: JobListRow): string {
  return /^(\d{4})/.exec(r.contractDate ?? "")?.[1] ?? "";
}

/**
 * Satırın durumu — SEVK TARİHİNDEN türer, iş emrinin `status` alanından
 * DEĞİL. Devralınan iş emirlerinin neredeyse tamamı "tamamlandı" olarak
 * aktarılmıştı; müşteriye giden belgede o alan gerçeği söylemiyor. Sevk
 * tarihi ise ölçülmüş bir olaydır.
 */
function durumu(r: JobListRow, bugun: string): { yazi: string; renk: string } {
  if (r.shipmentDate && r.shipmentDate <= bugun) {
    return { yazi: "Sevk Edildi", renk: BRAND.success };
  }
  if (r.shipmentDate || r.dueDate) return { yazi: "Devam Ediyor", renk: BRAND.steel };
  return { yazi: "Planlamada", renk: BRAND.gray500 };
}

function miktar(r: JobListRow): string {
  if (r.quantity === null) return "–";
  return `${fmtNum(r.quantity)} ${r.unit}`.trim();
}

function Hucre({
  i,
  children,
  mono,
  sonuk,
  kalin,
}: {
  i: number;
  children: React.ReactNode;
  mono?: boolean;
  sonuk?: boolean;
  kalin?: boolean;
}) {
  const s = SUTUNLAR[i];
  return (
    <Text
      style={[
        S.hucre,
        ...(mono ? [S.mono] : []),
        ...(sonuk ? [S.sonuk] : []),
        ...(kalin ? [S.urunAdi] : []),
        { width: `${s.pay}%`, textAlign: s.hiza ?? "left" },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Yıl → o yılın satırları. Yılsızlar en sona, "Tarihsiz" başlığıyla.
 *
 * SIRA BAŞTAN SONA İŞ NUMARASINA GÖRE BÜYÜKTEN KÜÇÜĞEDİR (kullanıcı kararı,
 * 12.08.2026): en yeni iş en üstte. Yıl bantları bunun kendiliğinden çıkan
 * sonucudur — numara kronolojik arttığı için yıllar da yeniden eskiye dizilir
 * ve bant içindeki satırlar aynı yönü sürdürür. SIRALAMA BELGENİN KENDİ
 * İŞİDİR, çağıranın değil: iki tüketici (indirme ucu ve duman testi) ayrı
 * sıralarsa aynı belge iki farklı düzende basılırdı.
 *
 * SIRA NUMARASI BURADA VERİLİR, çizim sırasında değil: numara çizelge boyunca
 * AKAR (yıl bandı sıfırlamaz) ve bunu boyama sırasında bir sayaçla üretmek
 * bileşeni tekrar boyandığında bozulan bir yan etki olurdu.
 */
function yillaraBol(
  rows: JobListRow[]
): { yil: string; satirlar: { r: JobListRow; sira: number }[] }[] {
  const harita = new Map<string, JobListRow[]>();
  const sirali = [...rows].sort((a, b) =>
    b.itemNo.localeCompare(a.itemNo, "tr", { numeric: true })
  );
  for (const r of sirali) {
    const y = jobListYear(r);
    const liste = harita.get(y);
    if (liste) liste.push(r);
    else harita.set(y, [r]);
  }
  let n = 0;
  return [...harita.entries()]
    // Tarihsiz grup yönden BAĞIMSIZ olarak en sondadır: bir yıl değil, bir
    // eksiktir — listenin başına konsaydı belge onunla açılırdı.
    .sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : b[0].localeCompare(a[0])))
    .map(([yil, satirlar]) => ({
      yil,
      satirlar: satirlar.map((r) => ({ r, sira: (n += 1) })),
    }));
}

export function JobListDocument({ rows, meta, company }: JobListDocProps) {
  const bugun = new Date().toISOString().slice(0, 10);
  const gruplar = yillaraBol(rows);

  return (
    <Document
      title={`Orion Cranes — Güncel İş Listesi (${meta.periodLabel})`}
      author="Orion Cranes"
      subject={meta.docCode}
    >
      <BrandPage
        orientation="landscape"
        docLine={trUpper(`Orion Cranes · Güncel İş Listesi · ${meta.periodLabel}`)}
        docCode={meta.docCode}
        company={company}
      >
        <BrandBand docCode={meta.docCode} lines={[meta.generatedAt]} logoWidth={130} />

        {/* GİRİŞ CÜMLESİ VE ÖLÇÜ ŞERİDİ YOKTUR (kullanıcı kararı, 11.08.2026).
            Sayfa bir süre "88 iş kalemi · 23 müşteri · 1.134 ton" diye açıyordu;
            firmanın toplam iş hacmini teklif ekinde rakamlarla açıklamak
            istenmiyor. Çizelgenin kendisi zaten aynı bilgiyi kanıtla verir,
            özetlemesi gerekmez — belge doğrudan listeyle başlar. */}
        <PageHeader
          kicker="Referans Belgesi"
          title="Güncel İş Listesi"
          meta={trUpper(
            meta.filterText ? `${meta.periodLabel} · ${meta.filterText}` : meta.periodLabel
          )}
        />

        {/* Başlık satırı HER SAYFADA tekrar eder: sekizinci sayfada hangi
            sütunun ne olduğu hatırlanmak zorunda kalınmamalı. */}
        <View style={S.baslikSatiri} fixed>
          {SUTUNLAR.map((s) => (
            <Text
              key={s.baslik}
              style={[S.baslikYazi, { width: `${s.pay}%`, textAlign: s.hiza ?? "left" }]}
            >
              {trUpper(s.baslik)}
            </Text>
          ))}
        </View>

        {gruplar.map((g) => (
          <View key={g.yil || "tarihsiz"}>
            {/* Bant sayfa dibinde YALNIZ kalmaz: altında en az birkaç satır
                yer yoksa bir sonraki sayfaya taşınır. */}
            <View style={S.yilBandi} wrap={false} minPresenceAhead={60}>
              <Text style={S.yilYazi}>{g.yil || "TARİHSİZ"}</Text>
              <Text style={S.yilSayac}>{g.satirlar.length} iş kalemi</Text>
            </View>
            {g.satirlar.map(({ r, sira }, i) => {
              const d = durumu(r, bugun);
              return (
                <View
                  key={r.itemNo || `${g.yil}-${i}`}
                  // Şerit YIL BANDINDA SIFIRLANMAZ: parite akan sıra
                  // numarasından gelir, göz çizelgeyi tek bir ritim olarak
                  // okur.
                  style={[S.satir, ...(sira % 2 === 0 ? [S.satirAlt] : [])]}
                  wrap={false}
                >
                  <Hucre i={0} mono sonuk>
                    {sira}
                  </Hucre>
                  <Hucre i={1} mono>
                    {r.itemNo || "–"}
                  </Hucre>
                  <Hucre i={2}>{r.customer || "–"}</Hucre>
                  <Hucre i={3} kalin>
                    {r.productName || "–"}
                  </Hucre>
                  <Hucre i={4} mono>
                    {miktar(r)}
                  </Hucre>
                  <Hucre i={5} mono>
                    {r.totalWeightKg ? fmtNum(Math.round(r.totalWeightKg)) : "–"}
                  </Hucre>
                  <Hucre i={6} mono sonuk>
                    {tarih(r.contractDate)}
                  </Hucre>
                  <Hucre i={7} mono sonuk>
                    {tarih(r.shipmentDate)}
                  </Hucre>
                  <Hucre i={8} sonuk>
                    {r.shipmentPlace || "–"}
                  </Hucre>
                  <View style={[S.durum, { width: `${SUTUNLAR[9].pay}%` }]}>
                    <View style={[S.nokta, { backgroundColor: d.renk }]} />
                    <Text style={[S.durumYazi, { color: d.renk }]}>{d.yazi}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={S.dipnot}>
          Ağırlık sütunu imal edilen çelik konstrüksiyonun toplam ağırlığıdır
          (kg). Durum sütunu sevk tarihine göre üretilir; tarihler sözleşme,
          taahhüt edilen termin ve gerçekleşen sevk tarihleridir. Liste
          {" "}{meta.generatedAt} tarihli kayıtlardan üretilmiştir.
        </Text>
      </BrandPage>

    </Document>
  );
}

export function renderJobListPdf(props: JobListDocProps): Promise<Buffer> {
  return renderToBuffer(<JobListDocument {...props} />);
}
