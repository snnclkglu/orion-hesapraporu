// Sadece development: MALİYET EDİTÖRÜNÜ auth olmadan görsel test etmek için.
// Production'da 404 döner.
//
// ÖNİZLEME BENZERİNİ DEĞİL GERÇEĞİ KURAR (TEKLIF-17'nin dersi). Maliyet
// editörü teklif editörüyle AYNI yükseklik zincirinde yaşar ve o zincir bu
// depoda İKİ KEZ kırıldı; ikisinde de hata zincirin BAŞKA bir halkasında
// sanıldı. Bu yüzden burada kabuğun ata zinciri, başlık portal yuvaları ve
// bölüm kabı BİREBİR basılır — taklit edilmezse "scroll çalışmıyor" hatası
// önizlemede HİÇ görünmez.
//
// FİKSTÜR GERÇEKTİR: devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif
// Maliyet Çalışması V3" çalışma kitabının girdileri. Uydurma küçük sayılarla
// ("10 ton, 5 m") ağırlık tablosu tek satıra sığar ve sütun taşması hiç
// görülmez; gerçek bir portal vinç 59.500 kg ve altı haneli tutarlar taşır.

import { notFound } from "next/navigation";
import { CostEditor } from "@/app/(app)/offers/[id]/costs/[costRevId]/cost-editor";
import { PageHeader } from "@/components/page-header";
import { APP_ACTIONS_SLOT_ID, APP_HEADER_SLOT_ID } from "@/lib/app";
import { emptyPayload, groupFromKey, newOfferId, withDefaults } from "@/lib/offers/payload";
import { withTotal } from "@/lib/offers/pricing";
import {
  costItemFromOfferItem,
  costModels,
  costWeights,
  emptyCostPayload,
  withDefaultRates,
  withModelQuantities,
} from "@/lib/offers/cost/payload";
import { withCostTotals } from "@/lib/offers/cost/totals";
import type { OfferItem, OfferPayload } from "@/lib/offers/types";
import type { CostPayload } from "@/lib/offers/cost/types";

const SAHTE = "00000000-0000-0000-0000-000000000000";

function astorKalemi(): OfferItem {
  const item: OfferItem = {
    id: SAHTE,
    title: "32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ",
    craneType: "Portal Vinç",
    capacityT: 32,
    spanM: 30,
    groups: ["general", "mainHoist", "trolley", "gantry", "steel", "electrical"].map((k) =>
      groupFromKey(k)
    ),
  };
  const parca = (g: string, r: string, parts: Record<string, string>) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.parts = { ...row.parts, ...parts };
  };
  const deger = (g: string, r: string, v: string) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.value = v;
  };
  parca("general", "capacity", { main: "32" });
  parca("general", "span", { value: "30" });
  parca("general", "liftHeight", { value: "12" });
  parca("general", "gantryLegHeight", { value: "12" });
  deger("general", "craneClass", "FEM 3m / M6");
  deger("general", "craneType", "Portal Vinç");
  parca("mainHoist", "liftSpeed", { range: "4" });
  parca("mainHoist", "motor", { brand: "GAMAK", power: "30", rpm: "1500" });
  parca("mainHoist", "gearbox", { brand: "YILMAZ", series: "HT Tipi" });
  parca("trolley", "travelSpeed", { range: "20" });
  parca("trolley", "motor", { count: "2", brand: "GAMAK", power: "1,5" });
  parca("gantry", "travelSpeed", { range: "20" });
  parca("gantry", "motor", { count: "4", brand: "GAMAK", power: "1,5" });
  parca("gantry", "wheel", { count: "8", dia: "400" });
  deger("electrical", "panel", "EAE / TEMPA, kiriş üzerinde");
  return item;
}

function teklifFiksturu(): OfferPayload {
  const p = emptyPayload("EUR");
  p.items = [astorKalemi()];
  p.pricing.lines = [
    {
      id: newOfferId(),
      itemId: SAHTE,
      description: "32T x 30m Çift Kiriş Tam Portal Vinç",
      qty: 1,
      unit: "Takım",
      unitPrice: 308_222,
      inTotal: true,
    },
  ];
  p.pricing = withTotal(p.pricing);
  return withDefaults(p, "EUR");
}

/** Devralınan çalışmanın birim fiyatları — ELLE girilir, tablodan aranmaz. */
const FIYATLAR: Record<string, Record<string, number>> = {
  steel: { rawMaterial: 0.7, fabrication: 1.25, laserCut: 0.05, paint: 0.15 },
  hoist: {
    motor: 2457, gearbox: 6300, brake: 1256, drum: 2970.24, machining: 3470,
    hookBlock: 2760, bearings: 940, rope: 940, encoder: 337.5, loadpin: 337.5,
    drumLimit: 262.5, weightLimit: 150,
  },
  travel: {
    coupling: 2700, bridgeMotor: 161.4, bridgeGearbox: 792, trolleyMotor: 161.4,
    trolleyGearbox: 576, bridgeWheels: 297, trolleyWheels: 209, buffers: 12.5,
  },
  electrical: {
    hoistDrive: 2300, bridgeDrive: 358, trolleyDrive: 358, panels: 3800,
    brakeResistors: 1800, isolationTrafo: 600, powerSupply: 400,
    electricalLabour: 5800, switchgear: 5000, cables: 4800, cableTray: 1200,
    travelLimits: 400, remote: 500,
  },
  assembly: {
    mechanicalAssembly: 2190, siteAssembly: 2325, shipping: 3423,
    mobileCrane: 5963, fasteners: 10.8,
  },
};

function maliyetFiksturu(offer: OfferPayload): CostPayload {
  let p = withDefaultRates(emptyCostPayload("EUR"));
  p.items = [costItemFromOfferItem(offer.items[0], 1)];
  p.sourceRevNo = 0;
  for (const g of p.items[0].groups) {
    const fiyatlar = FIYATLAR[g.key] ?? {};
    for (const l of g.lines) {
      const f = fiyatlar[l.key];
      if (f !== undefined) l.unitPrice = f;
    }
  }
  // Defterde adedi BOŞ başlayan satırlar (fren, tampon) elle doldurulur —
  // "çoğunlukla iki" bir sayı değildir (değişmez md. 4). Fikstürde bunlar
  // girilmezse toplam devralınan çalışmadan 400 € geride kalır ve önizleme
  // yanlış bir rakamı doğruymuş gibi gösterir.
  const kaldirma = p.items[0].groups.find((g) => g.key === "hoist");
  const fren = kaldirma?.lines.find((l) => l.key === "brake");
  if (fren) {
    fren.qty = 2;
    fren.qtyManual = true;
  }
  if (kaldirma) {
    kaldirma.lines.push({
      id: newOfferId(),
      key: `serbest-${newOfferId().slice(0, 8)}`,
      label: "Fren Aşınma / Konum Sensör Paketi",
      qty: 1,
      unit: "takım",
      unitPrice: 300,
    });
  }
  const tampon = p.items[0].groups.find((g) => g.key === "travel")?.lines.find((l) => l.key === "buffers");
  if (tampon) {
    tampon.qty = 8;
    tampon.qtyManual = true;
  }
  p = withModelQuantities(p);
  return withCostTotals(p, costWeights(costModels(p)));
}

export default function OfferCostPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const teklif = teklifFiksturu();
  const maliyet = maliyetFiksturu(teklif);

  return (
    <div className="grid gap-2 p-2">
      <p className="font-mono text-xs text-muted-foreground">
        Maliyet editörü — KABUĞUN GERÇEK ATA ZİNCİRİ birebir kurulur; yalnız sol
        menü çizilmez. Fikstür: ASTOR 32T × 30 m tam portal (devralınan V3
        çalışması).
      </p>

      {/* ——— app-shell: gövde — `isFrame` dalı */}
      <div id="kabuk-govde" className="flex h-[640px] overflow-hidden rounded-lg border">
        <div id="kabuk-icerik" className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          {/* Üst şerit — PageHeader buraya PORTALLANIR, sayfada düğüm bırakmaz. */}
          <header className="sticky top-0 z-30 flex shrink-0 flex-col border-b bg-background lg:h-12 lg:flex-row lg:items-center lg:gap-2 lg:px-6">
            <div className="flex h-12 shrink-0 items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:h-auto lg:min-w-[10rem] lg:flex-1 lg:px-0">
              <div id={APP_HEADER_SLOT_ID} className="flex min-w-0 flex-1 items-center gap-x-3" />
            </div>
            <div id={APP_ACTIONS_SLOT_ID} className="flex items-center gap-2" />
          </header>

          <main
            id="kabuk-main"
            className="min-w-0 flex-1 px-3 py-3 sm:px-4 lg:min-h-0 lg:overflow-hidden lg:px-6"
          >
            <div id="kabuk-ickap" className="mx-auto w-full max-w-none lg:h-full">
              <div id="icerik" className="h-full outline-none">
                {/* offers/layout.tsx — ZİNCİRİN EN KOLAY UNUTULAN HALKASI. */}
                <div id="bolum-kabi" className="flex flex-col gap-4 lg:h-full lg:min-h-0">
                  {/* OffersNav maliyet ekranında da `null` döner — burada da yok. */}
                  <div id="sayfa-koku" className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
                    <PageHeader
                      kicker="Maliyet Çalışması"
                      title="ASTOR 32T x 30m PORTAL VİNÇ"
                      hint="ASTOR ENERJİ A.Ş."
                    />
                    <CostEditor
                      offerId={SAHTE}
                      offerNo="TETR-20260817-1"
                      costRevId={SAHTE}
                      costRevNo={1}
                      offerRevNo={0}
                      offerRevisionId={SAHTE}
                      readOnly={false}
                      initial={maliyet}
                      offer={teklif}
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
