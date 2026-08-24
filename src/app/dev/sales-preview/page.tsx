// Sadece development: Satış Takibi ekranını auth olmadan görsel test etmek
// için. Production'da 404 döner. (jobs-preview ile aynı desen.)
//
// Veriler SAHTEDİR ve veritabanına dokunmaz; satıra tıklayınca açılan düzenleme
// penceresi gerçek kayıt üzerinde çalışmaz (sunucu eylemi sahte id ile hata
// döner). Amaç yalnız yerleşim, süzgeç/sıralama davranışı ve toplamların gözle
// doğrulanmasıdır.

import { notFound } from "next/navigation";
import { SalesTable } from "@/app/(app)/sales/sales-table";
import { JobListButton } from "@/app/(app)/sales/job-list-button";
import { PageHeader } from "@/components/page-header";
import { EMPTY_SALE, type SaleRow } from "@/app/(app)/sales/schema";
import type { SaleInput } from "@/app/(app)/sales/schema";

/** Müşteri defteri karşılığı: kısaltma + renk (defterde yoksa `null` geçilir). */
const BOOK: Record<string, { short: string; hue: number }> = {
  "KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.": { short: "KARÇEL", hue: 96 },
  "PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.": { short: "PLASTIC MASTER", hue: 300 },
  "YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.": { short: "YALCO", hue: 200 },
  "ASTOR A.Ş.": { short: "ASTOR", hue: 0 },
  "LITEC MAKİNA SAN. VE TİC. A.Ş.": { short: "LITEC", hue: 255 },
};

function row(
  itemNo: string,
  productName: string,
  customer: string,
  contractDate: string,
  sale: Partial<SaleInput> | null,
  /** İş emrinden gelen öneriler — pencerenin boş alanları bunlarla dolar. */
  isEmri?: Partial<Pick<SaleRow, "jobDeliveryDate" | "jobWorkshopExitDate" | "jobShippingAddress" | "jobShippingCountry">>
): SaleRow {
  const s: SaleInput = { ...EMPTY_SALE, ...(sale ?? {}) };
  const qty = s.quantity ?? 0;
  const total = qty * (s.unit_price ?? 0);
  return {
    itemId: itemNo,
    itemNo,
    productName,
    jobId: itemNo.split("-")[0],
    jobNo: itemNo.split("-")[0],
    customer,
    customerShort: BOOK[customer]?.short ?? null,
    customerHue: BOOK[customer]?.hue ?? null,
    jobStatus: "completed",
    contractDate,
    // İş emrinden gelen öneriler. Fikstürde YALNIZ BİR satır taşır (fiyatı
    // girilmemiş 0057-06): pencere açıldığında "İş emrindeki teslim tarihi"
    // ipucu ve sevk tarihinin "uygula" önerisi ancak dolu bir satırda görünür,
    // öteki satırlar da boş hâli göstersin diye dokunulmadan bırakıldı.
    jobDeliveryDate: isEmri?.jobDeliveryDate ?? null,
    jobWorkshopExitDate: isEmri?.jobWorkshopExitDate ?? null,
    jobShippingAddress: isEmri?.jobShippingAddress ?? "",
    jobShippingCountry: isEmri?.jobShippingCountry ?? "Türkiye",
    // Sözleşme YALNIZ BİR satırda dolu: sütunun hem dolu hem boş hâli aynı
    // ekranda görünsün (düğme yoksa hücre gerçekten boş kalmalı).
    contractPath: itemNo.startsWith("0002") ? "onizleme/sozlesme.pdf" : "",
    contractName: itemNo.startsWith("0002") ? "KARÇEL Sözleşme.pdf" : "",
    hasSale: sale !== null,
    sale: s,
    totalWeightKg: sale ? qty * (s.unit_weight_kg ?? 0) : null,
    totalPrice: sale ? total : null,
    eurAmount: sale && s.fx_rate ? total / s.fx_rate : null,
  };
}

const ROWS: SaleRow[] = [
  row("0002-00", "CÜRUF POTA TUMBA TESİSİ 100/50 TON KÖPRÜLÜ VİNÇ",
    "KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.", "2024-03-11", {
      scope: "Hazır Ekipmanlar ve Elektrik Hariç", due_date: "2025-02-04",
      shipment_date: "2025-01-06", quantity: 2, unit: "Adet",
      unit_weight_kg: 184000, unit_price: 787500, currency: "EUR", fx_rate: 1,
      shipment_place: "TÜRKİYE",
    }),
  row("0003-00", "1,5 TON KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ",
    "PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.", "2024-03-20", {
      scope: "Köprü İmalatı", due_date: "2024-04-15", shipment_date: "2024-04-16",
      quantity: 1, unit: "Adet", unit_weight_kg: 2010, unit_price: 225000,
      currency: "TRY", fx_rate: 34.5096, shipment_place: "TÜRKİYE",
    }),
  row("0040-00", "PANEL İMALATI", "YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.",
    "2025-11-13", {
      scope: "Komple İmalat", due_date: "2025-12-13", shipment_date: "2025-11-20",
      quantity: 13, unit: "Takım", unit_weight_kg: 28.92, unit_price: 83.86,
      currency: "USD", fx_rate: 1.1579, shipment_place: "TÜRKİYE",
    }),
  // Fiyatı girilmemiş kalem — listeden DÜŞMEZ, göze batar
  row("0057-06", "1,0 t Kapasiteli Pergel Vinç", "ASTOR A.Ş.", "2026-06-17", null, {
    jobDeliveryDate: "2026-12-15",
    jobWorkshopExitDate: "2026-11-20",
    jobShippingAddress: "ASTOR ENERJİ A.Ş. ANKARA OSB TESİSİ, SİNCAN / ANKARA",
    jobShippingCountry: "Türkiye",
  }),
  // Fiyatı var ama kuru yok: ciroya giremeyen satır
  row("0054-00", "75 t Kapasiteli Kaldırma Kirişi", "LITEC MAKİNA SAN. VE TİC. A.Ş.",
    "2026-03-16", {
      scope: "Komple İmalat", quantity: 1, unit: "Adet", unit_price: 42000,
      currency: "TRY", fx_rate: null,
    }),
];

export default function SalesPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Satış Takibi Önizleme (dev · sahte veri)</div>
      </header>
      <div className="grid w-full flex-1 gap-8 px-4 py-6 lg:px-8">
        {/* Başlık yuvası bu bağlamda YOKTUR: `PageHeader` yerinde çizilir ve
            İş Listesi düğmesi de auth'suz görülebilir. */}
        <PageHeader
          title="Satış Takibi"
          hint="İş kalemi başına fiyat, termin ve sevk takibi"
        >
          <JobListButton years={["2026", "2025", "2024"]} />
        </PageHeader>
        <SalesTable rows={ROWS} />
      </div>
    </div>
  );
}
