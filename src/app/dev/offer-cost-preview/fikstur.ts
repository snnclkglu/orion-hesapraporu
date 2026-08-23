// MALİYET ÖNİZLEMESİNİN FİKSTÜRÜ — iki önizleme sayfası da bunu okur.
//
// AYRI DOSYADIR ÇÜNKÜ İKİ SAYFA VARDIR: biri editörü kabuğun ata zincirini
// TAKLİT EDEN bir kutuda çizer (`../page.tsx`), öteki GERÇEK `AppShell`in
// içinde ve `…/costs/<id>` adresinde (`./costs/[id]/page.tsx`) — yani kabuğun
// çerçeve kipi de sınanır. Fikstür ikisinde birden kopyalansaydı biri
// güncellenir öteki eskirdi ve iki önizleme aynı ekranın iki farklı hâlini
// gösterirdi.
//
// FİKSTÜR GERÇEKTİR: devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif
// Maliyet Çalışması V3" çalışma kitabının girdileri. Uydurma küçük sayılarla
// ("10 ton, 5 m") ağırlık tablosu tek satıra sığar ve sütun taşması hiç
// görülmez; gerçek bir portal vinç 59.500 kg ve altı haneli tutarlar taşır.

import { emptyPayload, groupFromKey, newOfferId, withDefaults } from "@/lib/offers/payload";
import { withTotal } from "@/lib/offers/pricing";
import {
  costItemFromOfferItem,
  emptyCostPayload,
  withCostDerived,
  withDefaultRates,
} from "@/lib/offers/cost/payload";
import type { OfferItem, OfferPayload } from "@/lib/offers/types";
import type { CostPayload } from "@/lib/offers/cost/types";

export const SAHTE = "00000000-0000-0000-0000-000000000000";

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
  parca("mainHoist", "liftSpeed", { range: "4" });
  parca("mainHoist", "motor", { brand: "GAMAK", power: "30", rpm: "1500" });
  parca("mainHoist", "gearbox", { brand: "YILMAZ", series: "HT Tipi" });
  parca("trolley", "travelSpeed", { range: "20" });
  parca("trolley", "motor", { count: "2", brand: "GAMAK", power: "1,5" });
  parca("gantry", "travelSpeed", { range: "20" });
  parca("gantry", "motor", { count: "4", brand: "GAMAK", power: "1,5" });
  parca("gantry", "wheel", { count: "8", dia: "400" });
  // RAY, HIZLI TEKER SEÇİMİNİN TEK YENİ GİRDİSİDİR (md. 12) ve fikstürde DOLU
  // olmalıdır: boş bırakılırsa yüzey basıncı satırları "—" görünür ve önizleme
  // özelliğin çalıştığını hiç göstermez.
  deger("gantry", "rail", "A65");
  deger("electrical", "panel", "EAE / TEMPA, kiriş üzerinde");
  return item;
}

export function teklifFiksturu(): OfferPayload {
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
    // SERBEST FİYAT SATIRLARI FİKSTÜRDE DURMAK ZORUNDADIR (23.08.2026, md. 1):
    // özet tablosunun ELLE GİRİLEN sütunları yalnız bu satırlarda çizilir ve
    // fikstürde olmasalardı önizleme özelliğin çalıştığını hiç göstermezdi.
    //
    // ÜÇÜ ÜÇ AYRI HÂLİ ANLATIR ve bilerek öyle kuruldu:
    //   · maliyeti FİYAT sayfasından girilmiş (eski yol, yerinde kalır),
    //   · maliyeti HİÇ girilmemiş (özetten girilebilsin diye listede durur),
    //   · beş başlığı özetten girilmiş (kırılım toplamı geçerli olur).
    {
      id: "onizleme-yurume-yolu",
      itemId: null,
      description: "Yürüme Yolu A65",
      qty: 1,
      unit: "Takım",
      unitPrice: 18_000,
      inTotal: true,
      manualCost: 14_000,
    },
    {
      id: "onizleme-kapali-bara",
      itemId: null,
      description: "Kapalı Bara 40 Metre",
      qty: 1,
      unit: "Takım",
      unitPrice: 2_800,
      inTotal: true,
    },
    {
      id: "onizleme-kaldirma-traversi",
      itemId: null,
      description: "Kaldırma Traversi",
      qty: 1,
      unit: "Takım",
      unitPrice: 26_500,
      inTotal: true,
    },
  ];
  p.pricing = withTotal(p.pricing);
  return withDefaults(p, "EUR");
}

/** Devralınan çalışmanın birim fiyatları — ELLE girilir, tablodan aranmaz. */
const FIYATLAR: Record<string, Record<string, number>> = {
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

/**
 * HAMMADDE ŞERİDİ — çelik satırlarının fiyatı artık BURADAN gelir.
 *
 * Devralınan çalışmanın €/kg'leri satır satır değil şeritte durur: satırların
 * `priceSource`u onları oradan okur (`withMaterialPrices`). Toplam DEĞİŞMEZ —
 * aynı sayılar, tek bir yerden. Fikstürün bunu böyle kurması bilinçlidir;
 * satıra elle yazsaydı yeni yol hiç sınanmamış olurdu.
 */
// BUNLAR DEFTERİN ÖN TANIMLARI DEĞİLDİR (`MATERIAL_PRICE_DEFS`: çelik imalat
// 0,90 · boya 0,08). Devralınan ASTOR çalışmasının KENDİ rakamlarıdır ve
// öyle kalmalıdır: 194.257,74 €'luk proje maliyeti çapası onlara bağlı.
// `profil`, `rayKare`, `rayA` ve `boyaIsciligi` BOŞ bırakılır — o satırlar
// devralınan çalışmada yoktur ve varsayılana çekmek toplamı kaydırırdı.
const HAMMADDE_FIYATLARI: Record<string, number | null> = {
  sac: 0.7,
  celikIsciligi: 1.25,
  kesim: 0.05,
  boya: 0.15,
};

export function maliyetFiksturu(offer: OfferPayload): CostPayload {
  const p = withDefaultRates(emptyCostPayload("EUR"));
  p.items = [costItemFromOfferItem(offer.items[0], 1)];
  p.sourceRevNo = 0;
  p.materialPrices = { ...HAMMADDE_FIYATLARI };
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
  // ÖZETTEN GİRİLEN VERİ (23.08.2026, md. 1 · 22.08.2026, md. 7): ağırlıklar
  // ve serbest satır maliyetleri maliyet belgesinde yaşar, teklifinkinde değil
  // (MALIYET-1). Fikstür üç hâli birden kurar ki önizleme hepsini göstersin.
  p.manualLineWeights = {
    "onizleme-yurume-yolu": { steelKg: 4_000, totalKg: 4_000 },
    "onizleme-kaldirma-traversi": { steelKg: 7_000, totalKg: 7_000 },
  };
  p.manualLineCosts = {
    // TEK MALİYET özetten girildi — teklifin Fiyat sayfasındaki kutuya göre
    // önceliklidir ve orada da bu sayı görünür.
    "onizleme-kapali-bara": { total: 2_000, fabrication: null, project: null, rates: {} },
    // KIRILIM girildi: satırın maliyeti beş kutunun TOPLAMIDIR (20.000 €) ve
    // tek maliyet kutusu o satırda hiç okunmaz.
    "onizleme-kaldirma-traversi": {
      total: null,
      fabrication: 6_500,
      project: 11_000,
      rates: { fixed: 2_000, consumable: 300, finance: 200 },
    },
  };
  return withCostDerived(p);
}

