// Sadece development: SATIN ALMA bölümünün auth'suz görsel testi.
// Production'da 404 döner (panel-preview deseni).
//
// ÜÇ EKRAN ÜST ÜSTE BASILIR — bölüm rayı + Talep Havuzu + Teslim Takvimi +
// Fiyat Arşivi. Havuz ve teslimat için ayrı önizleme yoktu ve dar ekran
// düzenlemeleri (sütun önceliği, kaydırma kabı, tıklanabilir kategori çipleri)
// ancak gerçek bileşen ağacında görülür.
//
// FİKSTÜR DÖRT DURUMU DA TAŞIR (bekliyor · teklifli · kısmi · tamam): satır
// zemin renkleri ve durum çipleri tek durumlu bir örnekte sınanamazdı. Sayılar
// gerçek büyüklüktedir (personel önizlemesinin dersi) — 24.000 adetlik yanlış
// bir çarpanın tabloyu nasıl bozduğu ancak gerçek basamak sayısıyla görülür.

import { notFound } from "next/navigation";
import { PurchasingNav } from "@/app/(app)/purchasing/purchasing-nav";
import { DemandTable } from "@/app/(app)/purchasing/demand-table";
import { DeliveryBoard } from "@/app/(app)/purchasing/teslimat/delivery-board";
import { PriceArchive } from "@/app/(app)/purchasing/fiyatlar/price-archive";
import type { Siparis, TeklifSatiri, ArsivSonucu } from "@/app/(app)/purchasing/data";
import type { TalepHavuzu, TalepSatiri, TalepPayi } from "@/lib/purchasing/demand";

// `useSearchParams` kullanan istemci bileşenleri Suspense'e SARILMAZ, sayfa
// DİNAMİK yapılır: Suspense'e alınan alt ağacın hidrasyonu TEMBELdir ve gizli
// bir sekmede (Browser pane) süresiz ertelenir — önizlemede bütün tıklamalar
// ölü görünüyordu (16.08.2026'da ölçüldü; bkz. browser-pane notu). Gerçek
// (app) sayfaları zaten auth çerezleriyle dinamiktir; bu satır önizlemeyi
// onlarla aynı yola sokar ve build'in prerender şartını da düşürür.
export const dynamic = "force-dynamic";

// ————————————————————————————————————————————————— talep havuzu fikstürü

function pay(itemNo: string, adet: number | null, ek: Partial<TalepPayi> = {}): TalepPayi {
  return {
    packageId: "p1",
    packageLabel: "0053-01-0000 LITEC",
    itemNo,
    jobNo: itemNo.slice(0, 4),
    jobTitle: "ÇELİKHANE VİNCİ",
    customer: "LITEC",
    birimAdet: adet,
    carpan: 1,
    carpanBelirsiz: false,
    adet,
    partKey: `${itemNo}-x`,
    groupName: "KÖPRÜ YÜRÜTME GRUBU",
    ...ek,
  };
}

function talep(
  tanim: string,
  sinif: string,
  adet: number | null,
  ek: Partial<TalepSatiri> = {}
): TalepSatiri {
  return {
    key: tanim,
    tanim,
    parcaKodlari: [],
    birim: "Adet",
    olculer: { icCapMm: null, disCapMm: null, boyMm: null },
    not: "",
    hamTanimlar: [tanim],
    sinif,
    malzeme: "",
    malzemeler: [],
    anaGruplar: ["KÖPRÜ YÜRÜTME GRUBU"],
    adet,
    birimAgirlikKg: null,
    toplamAgirlikKg: null,
    paylar: [pay("0053-01", adet)],
    isSayisi: 1,
    carpanBelirsiz: false,
    ...ek,
  };
}

const SATIRLAR: TalepSatiri[] = [
  talep("RULMAN 22212 E", "Rulman", 8, {
    malzeme: "SKF",
    malzemeler: ["SKF"],
    olculer: { icCapMm: 60, disCapMm: 110, boyMm: null },
    parcaKodlari: ["0053-01-0304"],
  }),
  talep("CIVATA M20X80 DIN 931 8.8 GALVANİZLİ", "Bağlantı Elemanı", 240, {
    hamTanimlar: ["CIVATA M20X80", "M20X80 CIVATA GALVANİZ"],
  }),
  talep("REDÜKTÖR MK 100 B3", "Redüktör", 2, {
    malzeme: "YILMAZ",
    malzemeler: ["YILMAZ"],
    not: "Motor flanşı B5 olacak.",
  }),
  talep("KAPLİN N-EUPEX B 140", "Kaplin", 4, { malzeme: "FLENDER", malzemeler: ["FLENDER"] }),
  talep("YAĞ KEÇESİ 90X110X10", "Sızdırmazlık", 12, {
    olculer: { icCapMm: 90, disCapMm: 110, boyMm: null },
  }),
  talep("HALAT Ø14 EUROLIFT IWRC 1960 MPA", "Halat", null, {
    birim: "Metre",
    carpanBelirsiz: true,
    paylar: [pay("0053-01", null, { carpanBelirsiz: true })],
  }),
  talep("FREN BALATASI SHI 30", "Fren", 6, {
    paylar: [pay("0053-01", 4), pay("0057-00", 2, { customer: "ASTOR" })],
    isSayisi: 2,
  }),
  talep("SEGMAN Ø90 DIŞ", "Bağlantı Elemanı", 16, {
    olculer: { icCapMm: null, disCapMm: 90, boyMm: null },
  }),
];

const HAVUZ: TalepHavuzu = {
  satirlar: SATIRLAR,
  siniflar: [
    { sinif: "Rulman", satirSayisi: 1, adet: 8 },
    { sinif: "Bağlantı Elemanı", satirSayisi: 2, adet: 256 },
    { sinif: "Redüktör", satirSayisi: 1, adet: 2 },
    { sinif: "Kaplin", satirSayisi: 1, adet: 4 },
    { sinif: "Sızdırmazlık", satirSayisi: 1, adet: 12 },
    { sinif: "Halat", satirSayisi: 1, adet: 0 },
    { sinif: "Fren", satirSayisi: 1, adet: 6 },
  ],
  toplamKalem: SATIRLAR.length,
  toplamAdet: 288,
  kaynakSatiri: 14,
  cokIsliKalem: 1,
  belirsizKalem: 1,
  paketSayisi: 2,
};

const TEKLIFLER: TeklifSatiri[] = [
  {
    id: "t1",
    matchKey: "RULMAN 22212 E",
    sample: "RULMAN 22212 E",
    supplier: "DKS RULMAN",
    unitPrice: 41.5,
    currency: "EUR",
    fxRate: 1,
    unitPriceEur: 41.5,
    qty: null,
    unit: "Adet",
    quotedAt: "2026-08-12",
    validUntil: null,
    chosen: false,
    note: "",
    itemNo: "0053-01",
    paymentMethod: "vadeli",
    paymentTermDays: 60,
    leadTimeDays: 7,
    batchId: "b1",
    batchCode: "TK0004",
    batchStatus: "acik",
  },
  {
    id: "t2",
    matchKey: "REDÜKTÖR MK 100 B3",
    sample: "REDÜKTÖR MK 100 B3",
    supplier: "YILMAZ REDÜKTÖR",
    unitPrice: 1840,
    currency: "EUR",
    fxRate: 1,
    unitPriceEur: 1840,
    qty: null,
    unit: "Adet",
    quotedAt: "2026-08-13",
    validUntil: null,
    chosen: true,
    note: "",
    itemNo: "0053-01",
    paymentMethod: "pesin",
    paymentTermDays: 0,
    leadTimeDays: 28,
    batchId: "b2",
    batchCode: "TK0005",
    batchStatus: "acik",
  },
];

// Kısmi + tamam durumları sipariş adetlerinden türer (`durumu`).
const SIPARIS_ADETLERI: [string, number][] = [
  ["KAPLİN N-EUPEX B 140", 2],
  ["YAĞ KEÇESİ 90X110X10", 12],
];

// ————————————————————————————————————————————————— teslimat fikstürü

type Satir = Siparis["satirlar"][number];

function satir(
  id: string,
  sample: string,
  qty: number,
  unit: string,
  unitPrice: number,
  ek: Partial<Satir> = {}
): Satir {
  return {
    id,
    matchKey: sample,
    sample,
    itemNo: "0053-01",
    packageId: null,
    partKey: "",
    qty,
    unit,
    unitPrice,
    vatRate: 20,
    quality: "",
    receivedQty: 0,
    note: "",
    ...ek,
  };
}

const SIPARISLER: Siparis[] = [
  {
    id: "d1",
    orderNo: "TD0007-03",
    supplier: "ARCELORMİTTAL RZK ÇELİK",
    orderedAt: "2026-07-14",
    dueAt: "2026-08-04",
    receivedAt: null,
    paymentMethod: "vadeli",
    paymentTermDays: 90,
    advancePct: null,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "USD",
    fxRate: 1.09,
    note: "",
    cancelledAt: null,
    satirlar: [
      satir("d1a", "SAC 10 X 1500 X 6000 ST37", 3537, "Kg", 0.69),
      satir("d1b", "SAC 12 X 1500 X 3000 S235JR", 1696, "Kg", 0.72, { receivedQty: 1696 }),
    ],
  },
  {
    id: "d2",
    orderNo: "TD0012-01",
    supplier: "YILMAZ REDÜKTÖR",
    orderedAt: "2026-08-11",
    dueAt: "2026-08-25",
    receivedAt: null,
    paymentMethod: "pesin",
    paymentTermDays: 0,
    advancePct: 40,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "EUR",
    fxRate: 1,
    note: "",
    cancelledAt: null,
    satirlar: [satir("d2a", "REDÜKTÖR MK 100 B3", 2, "Adet", 1840)],
  },
  {
    id: "d3",
    orderNo: "TD0003-07",
    supplier: "DESSAN DEMİR ÇELİK",
    orderedAt: "2026-08-09",
    dueAt: null,
    receivedAt: null,
    paymentMethod: "vadeli",
    paymentTermDays: 60,
    advancePct: null,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "TRY",
    fxRate: 47.2,
    note: "",
    cancelledAt: null,
    satirlar: [satir("d3a", "RAY A65 S235JR", 20688, "Kg", 42.5)],
  },
  {
    id: "d4",
    orderNo: "TD0021-02",
    supplier: "DKS RULMAN",
    orderedAt: "2026-08-01",
    dueAt: "2026-08-12",
    receivedAt: "2026-08-12",
    paymentMethod: "pesin",
    paymentTermDays: 0,
    advancePct: null,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "EUR",
    fxRate: 1,
    note: "",
    cancelledAt: null,
    satirlar: [satir("d4a", "RULMAN 22212 E", 8, "Adet", 41.5, { receivedQty: 8 })],
  },
];

// ————————————————————————————————————————————————— fiyat arşivi fikstürü

const ARSIV: ArsivSonucu = {
  satirlar: [
    {
      matchKey: "RULMAN 22212 E",
      sample: "RULMAN 22212 E",
      sonHareket: "2026-08-12",
      sonAlisGun: "2026-08-12",
      sonAlisFirma: "DKS RULMAN",
      sonAlisEur: 41.5,
      sonAlisBirim: 41.5,
      sonAlisPara: "EUR",
      enDusuk: 38.2,
      enYuksek: 44.9,
      teklifSayisi: 3,
      siparisSayisi: 2,
      gecmisSayisi: 4,
      firmalar: ["DKS RULMAN", "ERKAN RULMAN"],
      kategoriler: ["Rulman"],
    },
    {
      matchKey: "SAC 10 X 1500 X 6000 ST37",
      sample: "SAC 10 X 1500 X 6000 ST37",
      sonHareket: "2026-08-14",
      sonAlisGun: "2026-08-14",
      sonAlisFirma: "ARCELORMİTTAL RZK ÇELİK",
      sonAlisEur: 0.63,
      sonAlisBirim: 0.69,
      sonAlisPara: "USD",
      enDusuk: 0.58,
      enYuksek: 0.71,
      teklifSayisi: 2,
      siparisSayisi: 1,
      gecmisSayisi: 11,
      firmalar: ["ARCELORMİTTAL RZK ÇELİK", "DESSAN DEMİR ÇELİK"],
      kategoriler: ["Sac"],
    },
    {
      matchKey: "CIVATA M20X80 DIN 931 8.8 GALVANİZLİ",
      sample: "CIVATA M20X80 DIN 931 8.8 GALVANİZLİ",
      sonHareket: "2026-06-02",
      sonAlisGun: "2026-06-02",
      sonAlisFirma: "BİRLİK BAĞLANTI",
      sonAlisEur: 0.41,
      sonAlisBirim: 19.4,
      sonAlisPara: "TRY",
      enDusuk: 0.34,
      enYuksek: 0.48,
      teklifSayisi: 0,
      siparisSayisi: 0,
      gecmisSayisi: 6,
      firmalar: ["BİRLİK BAĞLANTI"],
      kategoriler: ["Bağlantı Elemanı"],
    },
  ],
  toplam: 3,
  sayfa: 1,
  sayfaBoyu: 100,
};

export default function PurchasingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="grid gap-6 p-4">
      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Bölüm Rayı — Proje | Sarf Ayracı</h2>
        {/* Rozet fikstürü: gecikmiş > 0 hâli ancak burada görülür. */}
        <PurchasingNav gecikmis={2} />
      </section>

      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Talep Havuzu — Dört Durum</h2>
        <p className="max-w-3xl text-[12px] text-muted-foreground">
          Bekliyor · Teklifli (rulman, redüktör) · Kısmi (kaplin 2/4) · Tamam (keçe 12/12).
          Kategori çipleri tıklanınca süzgeç uygular; telefonda Kategori ve Sipariş sütunları
          Tanımı hücresinin altına iner.
        </p>
        <DemandTable
          havuz={HAVUZ}
          teklifler={TEKLIFLER}
          siparisAdetleri={SIPARIS_ADETLERI}
          tedarikciler={["DKS RULMAN", "YILMAZ REDÜKTÖR"]}
          defter={[]}
          siparisNolari={[]}
          sonKur={null}
          qualities={["SKF", "YILMAZ", "FLENDER"]}
          kategoriler={[
            "Rulman",
            "Redüktör",
            "Kaplin",
            "Fren",
            "Halat",
            "Sızdırmazlık",
            "Bağlantı Elemanı",
          ]}
          isler={[
            { id: "j1", itemNos: ["0053-01"], label: "0053 · ÇELİKHANE VİNCİ" },
            { id: "j2", itemNos: ["0057-00"], label: "0057 · MONORAY" },
          ]}
          canWrite
        />
      </section>

      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Teslim Takvimi — Gecikmiş + Terminsiz + Teslim</h2>
        <DeliveryBoard siparisler={SIPARISLER} canWrite />
      </section>

      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Fiyat Arşivi — Kaydırma Kabı + Silme Onayı</h2>
        <PriceArchive
            sonuc={ARSIV}
            secenekler={{
              kategoriler: ["Rulman", "Sac", "Bağlantı Elemanı"],
              tedarikciler: ["DKS RULMAN", "ARCELORMİTTAL RZK ÇELİK", "BİRLİK BAĞLANTI"],
              toplam: 3,
            }}
            filtre={{ q: "", kategoriler: [], tedarikciler: [], kaynaklar: [] }}
            isAdmin
          />
      </section>
    </div>
  );
}
