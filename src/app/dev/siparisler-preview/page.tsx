// Sadece development: SİPARİŞLER ekranının auth'suz görsel testi.
// Production'da 404 döner (panel-preview deseni).
//
// EKRAN 15.08.2026'da İKİ İZLEYİCİYE BİRDEN AÇILDI (hammadde siparişleri
// sayfası kaldırıldı) ve asıl görsel risk odur: üç tür yan yana duracak,
// satırın rengi türü söyleyecek ve tablo yine okunur kalacak. Fikstür bu yüzden
// ÜÇ TÜRÜ DE taşır — tek türlü bir örnek, ayrımın çalışıp çalışmadığını
// gösteremez.
//
// SAYILAR GERÇEK BÜYÜKLÜKTEDİR (personel önizlemesinin dersi): 3.537 kg'lık bir
// plaka siparişi ile 4 adetlik bir rulman siparişi aynı sütunda duruyor ve
// hizalama ancak öyle sınanır.

import { notFound } from "next/navigation";
import { OrdersView } from "@/app/(app)/purchasing/siparisler/orders-view";
import type { Siparis } from "@/app/(app)/purchasing/data";

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
    id: "s1",
    orderNo: "TD0007-03",
    supplier: "ARCELORMİTTAL RZK ÇELİK",
    orderedAt: "2026-08-14",
    dueAt: "2026-09-04",
    receivedAt: null,
    paymentMethod: "vadeli",
    paymentTermDays: 90,
    advancePct: null,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "USD",
    fxRate: 1.09,
    note: "Proforma ekte.",
    cancelledAt: null,
    satirlar: [
      satir("s1a", "SAC 10 X 1500 X 6000 ST37", 3537, "Kg", 0.69, { quality: "ST37" }),
      satir("s1b", "SAC 12 X 1500 X 3000 S235JR", 1696, "Kg", 0.72, {
        quality: "S235JR",
        receivedQty: 1696,
      }),
    ],
  },
  {
    id: "s2",
    orderNo: "TD0012-01",
    supplier: "YILMAZ REDÜKTÖR",
    orderedAt: "2026-08-11",
    dueAt: "2026-08-29",
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
    satirlar: [
      satir("s2a", "REDÜKTÖR MK 100 B3", 2, "Adet", 1840, { quality: "YILMAZ" }),
      satir("s2b", "RULMAN 22212 E", 8, "Adet", 41.5, { quality: "SKF", receivedQty: 4 }),
      satir("s2c", "KAPLİN N-EUPEX B 140", 2, "Adet", 212, { quality: "FLENDER" }),
    ],
  },
  {
    id: "s3",
    orderNo: "TD0003-07",
    supplier: "DESSAN DEMİR ÇELİK",
    orderedAt: "2026-08-09",
    dueAt: "2026-08-20",
    receivedAt: null,
    paymentMethod: "vadeli",
    paymentTermDays: 60,
    advancePct: null,
    advanceAmount: null,
    advancePaidAt: null,
    balancePaidAt: null,
    currency: "TRY",
    fxRate: 47.2,
    note: "Ray ile birlikte bağlantı elemanları da alındı.",
    cancelledAt: null,
    satirlar: [
      satir("s3a", "RAY A65 S235JR", 20688, "Kg", 42.5, { quality: "S235JR" }),
      satir("s3b", "CIVATA M20X80 8.8 GALVANİZLİ", 240, "Adet", 18.4),
    ],
  },
];

export default function SiparislerPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="grid gap-3 p-4">
      <h2 className="oc-kicker text-muted-foreground">Siparişler — Hammadde + Ekipman</h2>
      <p className="max-w-3xl text-[12px] text-muted-foreground">
        Üç sipariş, üç tür: <strong>Hammadde</strong> (yalnız sac), <strong>Ekipman</strong>{" "}
        (redüktör, rulman, kaplin) ve <strong>Karma</strong> (ray + cıvata). Satırın zemin rengi
        ve tedarikçi adının yanındaki çip türü söyler; “Tür” süzgecinde karma sipariş HEM
        hammaddeye HEM ekipmana girer.
      </p>
      <OrdersView
        siparisler={SIPARISLER}
        tedarikciler={SIPARISLER.map((s) => s.supplier)}
        defter={[]}
        siparisNolari={SIPARISLER.map((s) => s.orderNo)}
        sonKur={null}
        qualities={["S235JR", "ST37", "SKF"]}
        canWrite
        isAdmin
      />
    </div>
  );
}
