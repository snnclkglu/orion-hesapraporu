// Sadece development: HAMMADDE HAVUZUNU ve PLAKA YERLEŞİMİNİ auth olmadan
// görsel test etmek için. Production'da 404 döner (panel-preview deseni).
//
// FİKSTÜR GERÇEKTİR: satırların tamamı 0053-01 LITEC portal vinç paketinin
// DEPO Excel'inden alınmıştır — `SAC 15x375x1500`, `NPU 100 L=12000`,
// `TAMBUR BORUSU Ø405 ( Ø415)/ Ø358x1870 (1900)` dâhil. Uydurma küçük
// sayılarla bakmak, 12.000 mm'lik bir plakanın ekranda ne yaptığını GÖSTERMEZ
// (personel önizlemesinin dersi).
//
// İKİ EKRAN ÜST ÜSTE BASILIR: havuz tablosu ve yerleşim çizimi. Yerleşim
// ekranı asıl görsel riski taşıyor — 1500×12.000'lik bir plakada 68 parçanın
// numarası okunuyor mu?

import { notFound } from "next/navigation";
import { hammaddeHavuzu, type HammaddeKaynagi, type HammaddePaketi } from "@/lib/purchasing/hammadde/havuz";
import {
  enIyiPlakaSecimi,
  yerlesimDenetimi,
  type YerlesimParcasi,
} from "@/lib/purchasing/hammadde/nesting";
import {
  karsilastirmaKur,
  type KarsilastirmaKalemi,
  type KarsilastirmaTeklifi,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { PLAKA_BOYLARI, PLAKA_ENLERI } from "@/lib/purchasing/hammadde/siniflar";
import { RawTable } from "@/app/(app)/purchasing/hammadde/raw-table";
import { NestingView, type YerlesimGrubu } from "@/app/(app)/purchasing/hammadde/yerlesim/nesting-view";
import { QuotesView } from "@/app/(app)/purchasing/hammadde/teklifler/quotes-view";
import type { PartiOzeti, TalepGorunumu } from "@/app/(app)/purchasing/hammadde/teklifler/types";

const PAKETLER: HammaddePaketi[] = [
  {
    packageId: "p1",
    label: "0053-01-0150 · BOJİ",
    itemNo: "0053-01",
    jobNo: "0053",
    jobTitle: "LITEC 40 T x 16,7 M PORTAL VİNÇ",
    customer: "LITEC",
    carpan: 2,
    carpanBelirsiz: false,
  },
  {
    packageId: "p2",
    label: "0057-00-0500 · MONORAY (1 TON)",
    itemNo: "0057-00",
    jobNo: "0057",
    jobTitle: "MUHTELİF VİNÇLER",
    customer: "ASTOR",
    carpan: 1,
    carpanBelirsiz: true,
  },
];

/** 0053 DEPO Excel'inin gerçek satırları (tanım · malzeme · kategori · adet). */
const HAM: [string, string, string, number][] = [
  ["SAC 15x375x1500", "S355JR", "Plazma", 8],
  ["SAC 15x300x1500", "S355JR", "Plazma", 4],
  ["SAC 15x300x850", "S355JR", "Plazma", 4],
  ["SAC 15x150x225", "S355JR", "Plazma", 8],
  ["SAC 15x23x150", "S355JR", "Plazma", 16],
  ["SAC 15x225x365", "S355JR", "Plazma", 8],
  ["SAC 15x180x300", "S355JR", "Plazma", 16],
  ["SAC 15x120x170", "S355JR", "Plazma", 8],
  ["SAC 50x290x325", "S355JR", "Plazma", 16],
  ["SAC 10x1300x11990", "S355JR", "Plazma", 4],
  ["SAC 10x500x11610", "S355JR", "Plazma", 2],
  ["SAC 8x410x1290", "S235JR", "Plazma", 22],
  ["KAPAK-1 30x190x190", "S235JR", "Plazma", 12],
  ["EMNIYET PULU 8x50x50", "S235JR", "Plazma", 4],
  ["RULMAN YATAGI SAC 50x257x257", "S355JR", "Plazma", 16],
  ["NPU 100 L=12000", "S235JR", "Testere", 20],
  ["NPU 100 L=9550", "S235JR", "Testere", 2],
  ["NPU 80 L=1000", "S235JR", "Testere", 4],
  ["NPI 280 L=2248", "S235JR", "Testere", 2],
  ["NPL 50x50x5 L=17000", "S235JR", "Testere", 8],
  ["NPL 120x120x10 L=2150", "S235JR", "Testere", 4],
  ["HEA 300 L=1955", "S235JR", "Testere", 2],
  ["KARE KUTU PROFİL 50x50x3 L=1600", "S235JR", "Testere", 6],
  ["SİLME 50x5 L=1220 mm", "S235JR", "Testere", 4],
  ["RAY - A65 - DIN536 GRADE 70 L=12000", "S235JR", "Testere", 20],
  ["KARE DEMİR 60x40x17456", "C 1040", "Testere", 2],
  ["MİL Ø90x453", "S235JR", "Talaşlı İmalat", 4],
  ["TEKER Ø315x105", "C 4140", "Talaşlı İmalat", 8],
  ["TAHRİKLİ TEKER MİLİ Ø98x495", "CK45", "Talaşlı İmalat", 4],
  ["MAKARA Ø470x74", "S355JR", "Talaşlı İmalat", 2],
  ["AVARE KASNAK Ø250", "S355JR", "Talaşlı İmalat", 2],
  ["NERVÜRLÜ DEMİR Ø22 L=1128,000 mm", "S235JR", "Testere", 790],
  ["İÇ BİLEZİK Ø140xØ90x69", "S235JR", "Talaşlı İmalat", 8],
  ["DAYAMA BİLEZİK Ø76xØ60x38,5", "S235JR", "Talaşlı İmalat", 8],
  ["TAMBUR BORUSU Ø405 ( Ø415)/ Ø358x1870 (1900)", "S275JR", "Talaşlı İmalat", 1],
  ["DİKİŞLİ BORU Ø33,7x3,25 L=13774", "S195T (St33)", "Testere", 1],
  ["DİKİŞLİ BORU Ø33,7x3,25 L=2562", "S195T (St33)", "Testere", 6],
  ["RAYALTI LASTİĞİ, 8x220x12000mm DKP SACLI", "-", "Makas", 21],
  ["KANCA DIN 15401-NR.16 T", "S235JR", "Talaşlı İmalat", 1],
];

// ————————————————————————————————————————— TEKLİFLER FİKSTÜRÜ
//
// SAYILAR KULLANICININ KENDİ ÇALIŞMA DOSYASINDANDIR (15.08.2026 ekran
// görüntüsü): üç HEA profili, üç firma, toplamlar 266.240 · 261.165 · 298.685.
// `karsilastirma.test.ts` de aynı fikstürü doğruluyor — önizleme ile test aynı
// gerçeği gösterir ve ekranda çıkan sayı testte geçen sayıdır.
const TEKLIF_KALEMLERI: KarsilastirmaKalemi[] = [
  { key: "HEA 120 S235JR", tanim: "HEA 120 S235JR", miktar: 360, birim: "Kg" },
  { key: "HEA 200 S235JR", tanim: "HEA 200 S235JR", miktar: 2550, birim: "Kg" },
  { key: "HEA 240 S235JR", tanim: "HEA 240 S235JR", miktar: 3620, birim: "Kg" },
];

const TEKLIF_FIRMALARI: {
  id: string;
  code: string;
  supplier: string;
  quotedAt: string;
  vadeGun: number;
  /** kalem sırası TEKLIF_KALEMLERI ile aynı: [birim fiyat, teslim günü]. */
  fiyatlar: [number, number | null][];
}[] = [
  {
    id: "b1",
    code: "TK0011",
    supplier: "EAG DEMİR",
    quotedAt: "2026-08-14",
    vadeGun: 90,
    fiyatlar: [
      [38, 20],
      [38, 0],
      [43, 0],
    ],
  },
  {
    id: "b2",
    code: "TK0012",
    supplier: "ARCELORMİTTAL RZK ÇELİK",
    quotedAt: "2026-08-15",
    vadeGun: 90,
    fiyatlar: [
      [37.5, 0],
      [37.5, 0],
      [42, 0],
    ],
  },
  {
    id: "b3",
    code: "TK0013",
    supplier: "HAKAN SAC METAL",
    quotedAt: "2026-08-15",
    vadeGun: 60,
    fiyatlar: [
      [42.5, 0],
      [43.7, 0],
      [47.5, 0],
    ],
  },
];

function teklifFiksturu(): TalepGorunumu {
  const partiler: PartiOzeti[] = TEKLIF_FIRMALARI.map((f) => {
    const satirlar = TEKLIF_KALEMLERI.map((k, i) => {
      const [fiyat, teslim] = f.fiyatlar[i];
      return {
        quoteId: `${f.id}-${i}`,
        key: k.key,
        tanim: k.tanim,
        miktar: k.miktar,
        birim: k.birim,
        birimFiyat: fiyat,
        paraBirimi: "EUR",
        kur: 1,
        birimFiyatEur: fiyat,
        tutarEur: (k.miktar ?? 0) * fiyat,
        teslimGun: teslim,
      };
    });
    return {
      id: f.id,
      code: f.code,
      supplier: f.supplier,
      quotedAt: f.quotedAt,
      status: "acik",
      note: "",
      cancelReason: "",
      vadeGun: f.vadeGun,
      paraBirimi: "EUR",
      kur: 1,
      toplamEur: satirlar.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
      kalemSayisi: satirlar.length,
      miktarsizKalem: 0,
      satirlar,
    };
  });

  const girdiler: KarsilastirmaTeklifi[] = partiler.flatMap((p) =>
    p.satirlar.map((s) => ({
      key: s.key,
      sutunKey: p.id,
      etiket: `${p.code} · ${p.supplier}`,
      tedarikci: p.supplier,
      birimFiyat: s.birimFiyat,
      paraBirimi: s.paraBirimi,
      birimFiyatEur: s.birimFiyatEur,
      vadeGun: p.vadeGun,
      teslimGun: s.teslimGun,
    }))
  );

  return {
    id: "t1",
    code: "TT0004",
    baslik: "HEA 120 S235JR + 2 kalem",
    gercek: true,
    partiler,
    tablo: karsilastirmaKur(TEKLIF_KALEMLERI, girdiler),
    kalemSayisi: TEKLIF_KALEMLERI.length,
    firmaSayisi: partiler.length,
    ilkTarih: "2026-08-14",
    sonTarih: "2026-08-15",
    tamameniIptal: false,
  };
}

export default function HammaddePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const kaynaklar: HammaddeKaynagi[] = HAM.map(([tanim, malzeme, kategori, qty], i) => ({
    packageId: i % 7 === 0 ? "p2" : "p1",
    partKey: `0053-01-0150-${String(i + 1).padStart(2, "0")}`,
    partCode: `0053-01-0150-${String(i + 1).padStart(2, "0")}`,
    tanim,
    malzeme,
    kategori,
    kind: "imalat",
    qty,
    groupCode: "0053-01-0150",
    groupName: i % 3 === 0 ? "BOJİ" : "ANAKİRİŞ",
  }));

  const havuz = hammaddeHavuzu(PAKETLER, kaynaklar);

  // ————————————————————————————————— yerleşim: en kalabalık iki sac grubu
  const sacGruplari = havuz.satirlar
    .filter((s) => s.sinif === "SAC")
    .sort((a, b) => b.parcaAdedi - a.parcaAdedi)
    .slice(0, 2);

  const adaylar = PLAKA_ENLERI.flatMap((e) => PLAKA_BOYLARI.map((b) => ({ enMm: e, boyMm: b })));
  const gruplar: YerlesimGrubu[] = sacGruplari.map((satir) => {
    const parcalar: YerlesimParcasi[] = [];
    let olcusuz = 0;
    for (const p of satir.parcalar) {
      if (p.enMm == null || p.boyMm == null || !p.adet) {
        olcusuz++;
        continue;
      }
      parcalar.push({ id: p.partKey, ad: p.tanim, enMm: p.enMm, boyMm: p.boyMm, adet: p.adet });
    }
    const kalinlik = satir.parcalar.find((p) => p.kalinlikMm != null)?.kalinlikMm ?? null;
    const sonuc = enIyiPlakaSecimi(parcalar, adaylar, {
      payMm: 5,
      dondur: true,
      kalinlikMm: kalinlik,
    });
    return {
      key: satir.key,
      tanim: satir.tanim,
      kalite: satir.kalite,
      kalinlikMm: kalinlik,
      olcusuzParca: olcusuz,
      hata: "",
      sonuc,
      denetim: sonuc ? yerlesimDenetimi(parcalar, sonuc) : [],
      paylar: satir.parcalar.map((p) => ({
        itemNo: p.itemNo,
        packageId: p.packageId,
        partKey: p.partKey,
        adet: p.adet ?? 0,
      })),
    };
  });

  return (
    <div className="grid gap-8 p-4">
      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Hammadde Havuzu</h2>
        <RawTable
          havuz={havuz}
          teklifler={[]}
          siparisAdetleri={[]}
          tedarikciler={["ÇOLAKOĞLU METALURJİ", "ERDEMİR", "KARDEMİR"]}
          defter={[]}
          siparisNolari={[]}
          sonKur={null}
          qualities={["S235JR", "S355JR", "CK45"]}
          defterVar
          isler={[
            { id: "j1", jobNo: "0053", itemNos: ["0053-01"], label: "0053 · LITEC PORTAL VİNÇ" },
            { id: "j2", jobNo: "0057", itemNos: ["0057-00"], label: "0057 · MUHTELİF VİNÇLER" },
          ]}
          canWrite
        />
      </section>

      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Plaka Yerleşimi</h2>
        <NestingView
          tumSaclar={havuz.satirlar
            .filter((s) => s.sinif === "SAC")
            .map((s) => ({
              key: s.key,
              tanim: s.tanim,
              parcaAdedi: s.parcaAdedi,
              agirlikKg: s.toplamAgirlikKg,
              isler: [...new Set(s.paylar.map((x) => x.jobNo).filter(Boolean))],
            }))}
          isSecenekleri={[{ value: "0053", label: "0053 · LITEC PORTAL VİNÇ", count: 5 }]}
          isSecili={[]}
          secili={sacGruplari.map((s) => s.key)}
          pay={5}
          en={null}
          boy={null}
          dondur
          gruplar={gruplar}
          // YAZMA AÇIK: "Plaka Teklifi Aç" ve "Plaka Siparişi Aç" düğmeleri
          // yalnız yetkili kullanıcıda çizilir; kapalıyken önizleme onları hiç
          // göstermiyor ve düğmelerin yerleşimi buradan denetlenemiyordu.
          canWrite
        />
      </section>

      {/* ÜÇÜNCÜ EKRAN: TEKLİFLER. Listeye tıklayınca açılan pencere asıl görsel
          riski taşıyor — üç firma altı sütun demektir ve sütun grubunun kime
          ait olduğu tek bakışta anlaşılmalı. */}
      <section className="grid gap-3">
        <h2 className="oc-kicker text-muted-foreground">Teklifler</h2>
        <QuotesView
          talepler={[teklifFiksturu()]}
          tur={null}
          turSayaclari={[{ tur: "PROFIL", adet: 3 }]}
          siparisAdetleri={[]}
          paylar={{}}
          tedarikciler={["EAG DEMİR", "ARCELORMİTTAL RZK ÇELİK", "HAKAN SAC METAL"]}
          defter={[]}
          siparisNolari={[]}
          sonKur={null}
          qualities={["S235JR", "S355JR"]}
          canWrite
          isAdmin
        />
      </section>
    </div>
  );
}
