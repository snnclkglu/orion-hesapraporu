// Sadece development: TEKLİF EDİTÖRÜNÜ auth olmadan görsel test etmek için.
// Production'da 404 döner.
//
// ÖNİZLEME GERÇEK DOM'U TAKLİT EDER, benzerini değil. İki koşul birlikte
// kurulmadan kaydırma hatası burada GÖRÜNMEZ:
//
//   1. SABİT ÇERÇEVE — kabuk `/…/revisions/…` adreslerinde `lg` üstünde gövdeye
//      `h-dvh overflow-hidden` verir (`isFrame`, app-shell.tsx). Kutu onu
//      taklit eder.
//   2. BAŞLIK YUVASI — `PageHeader` başlığı kabuğun üst şeridine PORTALLAR ve
//      sayfada HİÇ DOM düğümü bırakmaz. Yuva basılmazsa başlık yerinde çizilir
//      ve sayfa iki çocuklu olur; ilk kaydırma düzeltmesi tam bu yüzden yalnız
//      önizlemede çalıştı, gerçek sayfada çalışmadı (kullanıcı bildirimi,
//      17.08.2026). Yuvalar aşağıda gerçekten basılır.
//
// Kaydetme ve yayımlama sunucu eylemleri sahte kimliklerle çağrılır ve hata
// döner; amaç yalnız YERLEŞİM ve ALAN TİPLERİNİN gözle doğrulanmasıdır.
//
import { notFound } from "next/navigation";
import { OfferEditor } from "@/app/(app)/offers/[id]/revisions/[revId]/offer-editor";
import { PageHeader } from "@/components/page-header";
import { APP_ACTIONS_SLOT_ID, APP_HEADER_SLOT_ID } from "@/lib/app";
import type { OfferOptionRow } from "@/app/(app)/offers/data";
import type { CustomerContact } from "@/lib/customer-contacts";
import type { OfferAuthor, OfferTemplateRow } from "@/app/(app)/offers/data";
import { applyDefaults, emptyItem, emptyPayload } from "@/lib/offers/payload";
import { composeValue, derivedParts } from "@/lib/offers/compose";
import { offerRowDef } from "@/lib/offers/registry";
import { composeItemTitle } from "@/lib/offers/title";

let sira = 0;
function opt(
  list_key: string,
  value: string,
  extra: Partial<OfferOptionRow> = {}
): OfferOptionRow {
  sira += 10;
  return {
    id: `${list_key}:${value}`,
    list_key,
    value,
    parent_id: null,
    sort: sira,
    active: true,
    is_default: false,
    note: "",
    ...extra,
  };
}

// Defter fikstürü — GERÇEK seed'den alınmış maddeler. Uydurma kısa metinler
// kullanılsaydı uzun kapsam dışı maddelerinin satırı nasıl sardığı görülmezdi.
const OPTIONS: OfferOptionRow[] = [
  opt("term.validity", "14 iş günü", { is_default: true }),
  opt("term.deliveryTime", "Avans Ödemesi Sonrası 10-12 Hafta"),
  opt("term.deliveryTime", "Avans Ödemesi Sonrası 18-20 Hafta"),
  opt("term.freight", "Dahil"),
  opt("term.freight", "Hariç"),
  opt("term.erection", "Vinçlerin yerine montajı ve devreye alınması dahildir."),
  opt("term.erection", "Hariç"),
  opt("term.deliveryPlace", "Yerinde çalışır halde teslim"),
  opt("term.deliveryPlace", "Ankara, Başkent OSB."),
  opt("term.paymentHeader", "KDV Dahil ödeme şekli aşağıda belirtilen şekildedir."),
  opt("term.paymentLine", "%40 Avans Sipariş ile Nakit"),
  opt("term.paymentLine", "%60 Teslimat Sonrası Nakit (Fatura + 30 Gün)"),
  opt("val.testDynamic", "Q x 1,1", { is_default: true }),
  opt("val.testStatic", "Q x 1,25", { is_default: true }),
  opt("val.reeving", "4/2"),
  opt("val.reeving", "8/2"),
  opt("val.hook", "DIN 15401/P Tek Ağızlı Kanca"),
  opt("val.craneClass", "FEM 3m / ISO M6"),
  opt("val.craneClass", "FEM 5m / ISO M8"),
  opt("val.environmentPlace", "Kapalı Alan"),
  opt("val.tempMin", "-10"),
  opt("val.tempMax", "+40"),
  opt("val.motorPower", "22"),
  opt("val.motorRpm", "1500"),
  opt("val.drivePower", "18,5"),
  opt("val.wheelDia", "400"),
  opt("val.ropeDia", "20"),
  opt("term.deliveryTrigger", "Avans Ödemesi Sonrası"),
  opt("val.deliveryWeeks", "6"),
  opt("val.deliveryWeeks", "10"),
  opt("val.deliveryUnit", "Hafta"),
  opt("term.warranty", "2 Yıl"),
  opt("val.rail", "60x40 Dikdörtgen Ray"),
  opt("brand.motor", "GAMAK"),
  opt("brand.motor", "ABB"),
  opt("brand.gearbox", "YILMAZ R."),
  opt("series.gearbox", "HT Sandık Tipi", { id: "seri:ht", parent_id: "brand.gearbox:YILMAZ R." }),
  opt("brand.brake", "SIBRE"),
  opt("val.brakeType", "Kasnak Fren"),
  opt("brand.drive", "SCHNEIDER"),
  opt("val.priceUnit", "Takım"),
  opt("cover.honorific", "Bey,"),
  opt("cover.honorific", "Hanım,"),
  opt(
    "cover.intro",
    "Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.",
    { is_default: true }
  ),
  opt("term.note", "Belirtilen fiyatlara KDV dahil değildir."),
  opt(
    "term.note",
    "Teklif fiyatına hiçbir yurtiçi vergi, harç, pul avans damga vergisi, banka komisyonu ve masrafları v.b. dahil değildir."
  ),
  opt("term.exclusion", "Vincin montaj sahasında gerekli olan tüm inşaat işleri"),
  opt("term.exclusion", "Köprü rayı ve hol bara montajı"),
  opt("term.exclusion", "Nakliye"),
  opt(
    "term.exclusion",
    "Test için gerekli uygun yük temini ve bu yükün bağlanması için gereken ekipmanlar"
  ),
  opt("term.exclusion", "Sahada ihtiyaç duyulacak her türlü enerji temini"),
];

function fikstur() {
  const p = emptyPayload("EUR");
  p.cover.fromName = "SİNAN ÇOLAKOĞLU";
  p.cover.fromTitle = "Proje Müdürü";
  p.cover.fromEmail = "scolakoglu@orioncranes.com";
  p.cover.signatories = [
    { name: "Salih ERGÜVEN", title: "Genel Müdür" },
    { name: "Sinan ÇOLAKOĞLU", title: "Proje Müdürü" },
  ];
  const kalem = emptyItem("", [
    "general",
    "mainHoist",
    "trolley",
    "auxHoist",
    "auxTrolley",
    "bridge",
    "steel",
    "electrical",
  ]);
  kalem.craneType = "Çift Kirişli Gezer Köprülü Vinç";
  kalem.capacityT = 32;
  kalem.spanM = 26;

  // KÜNYE SATIRLARI DOLU GELİR ki başlık TÜRETMESİ önizlemede görülebilsin
  // (`32/5T x 26m ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ`); boş bir kalemde türetme
  // hiç çalışmaz ve özelliğin çalıştığı burada anlaşılmazdı.
  const genel = kalem.groups.find((g) => g.key === "general")!;
  genel.rows.find((r) => r.key === "capacity")!.parts = { main: "32", aux: "5" };
  genel.rows.find((r) => r.key === "span")!.parts = { value: "26" };
  genel.rows.find((r) => r.key === "craneType")!.value = "Çift Kirişli Gezer Köprülü Vinç";
  kalem.title = composeItemTitle(kalem.groups);

  // ÇİFT MARKA ve TÜRETİLEN TOPLAM GÜÇ: ikisi de gerçek tekliflerden alınmış
  // değerlerle kurulur — "SEW/FLENDER" iki kutu çizmeli, sürücünün toplamı
  // (4 × 18,5 = 74 kW) salt okunur kutuda görünmeli.
  const kaldirma = kalem.groups.find((g) => g.key === "mainHoist")!;
  const gearbox = kaldirma.rows.find((r) => r.key === "gearbox")!;
  gearbox.parts = { brand: "SEW/FLENDER" };
  gearbox.value = composeValue(offerRowDef("mainHoist", "gearbox")!.parts!, gearbox.parts);
  const surucu = kaldirma.rows.find((r) => r.key === "drive")!;
  surucu.parts = derivedParts(offerRowDef("mainHoist", "drive")!.parts!, {
    brand: "SCHNEIDER",
    power: "18,5",
    count: "4",
  });
  surucu.value = composeValue(offerRowDef("mainHoist", "drive")!.parts!, surucu.parts);

  p.items = [kalem, emptyItem("5T YARDIMCI MONORAY", ["general", "mainHoist", "steel"])];
  return applyDefaults(p, {
    "term.validity": "14 iş günü",
    "val.testDynamic": "Q x 1,1",
    "val.testStatic": "Q x 1,25",
    "cover.intro":
      "Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.",
  });
}

// İKİ KİŞİLİ fikstür: muhatap seçicisi ancak birden çok kişi varken denetlenir,
// ve BİRİNCİL kişinin öne çıkması tek kişilik listede hiç görülmez.
const KISILER: CustomerContact[] = [
  {
    id: "k1",
    customerId: "c1",
    name: "ALİCAN ERASLAN",
    title: "Satın Alma Müdürü",
    department: "Satın Alma Departmanı",
    phone: "+90 216 453 67 51",
    email: "",
    note: "",
    isPrimary: true,
    active: true,
    sort: 10,
  },
  {
    id: "k2",
    customerId: "c1",
    name: "MEHMET EROL",
    title: "Proje Şefi",
    department: "Yatırımlar",
    phone: "+90 216 453 67 52",
    email: "",
    note: "",
    isPrimary: false,
    active: true,
    sort: 20,
  },
];

const YAZARLAR: OfferAuthor[] = [
  { id: "u1", name: "SİNAN ÇOLAKOĞLU", title: "Proje Müdürü", email: "scolakoglu@orioncranes.com" },
  { id: "u2", name: "SALİH ERGÜVEN", title: "Genel Müdür", email: "serguven@orioncranes.com" },
];

const SABLONLAR: OfferTemplateRow[] = [
  {
    id: "t1",
    name: "Çift Kirişli Gezer Köprülü Vinç",
    crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    skeleton: { groupKeys: ["general", "mainHoist", "trolley", "bridge", "steel", "electrical"] },
    sort: 10,
    active: true,
  },
  {
    id: "t2",
    name: "Çift Kirişli Vinç — İki Arabalı",
    crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    skeleton: {
      groupKeys: ["general", "mainHoist", "trolley", "auxHoist", "auxTrolley", "bridge", "steel", "electrical"],
    },
    sort: 20,
    active: true,
  },
];

export default function OfferEditorPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="grid gap-2 p-2">
      <p className="font-mono text-xs text-muted-foreground">
        Teklif editörü — KABUĞUN GERÇEK ATA ZİNCİRİ (app-shell.tsx satır 433–617)
        birebir kurulur; yalnız sol menü çizilmez.
      </p>

      {/* ——— app-shell: gövde (433) — `isFrame` dalı */}
      <div id="kabuk-govde" className="flex h-[640px] overflow-hidden rounded-lg border">
        {/* ——— app-shell: içerik sütunu (507) */}
        <div id="kabuk-icerik" className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          {/* ——— app-shell: üst şerit (525) — yuvalar burada */}
          <header className="sticky top-0 z-30 flex shrink-0 flex-col border-b bg-background lg:h-12 lg:flex-row lg:items-center lg:gap-2 lg:px-6">
            <div className="flex h-12 shrink-0 items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:h-auto lg:min-w-[10rem] lg:flex-1 lg:px-0">
              <div id={APP_HEADER_SLOT_ID} className="flex min-w-0 flex-1 items-center gap-x-3" />
            </div>
            <div id={APP_ACTIONS_SLOT_ID} className="flex items-center gap-2" />
          </header>

          {/* ——— app-shell: main (599) — `isFrame` dalı */}
          <main
            id="kabuk-main"
            className="min-w-0 flex-1 px-3 py-3 sm:px-4 lg:min-h-0 lg:overflow-hidden lg:px-6"
          >
            {/* ——— app-shell: iç kap (610) */}
            <div id="kabuk-ickap" className="mx-auto w-full max-w-none lg:h-full">
              {/* ——— (app)/layout.tsx: #icerik */}
              <div id="icerik" className="h-full outline-none">
                {/* ——— offers/layout.tsx — ZİNCİRİN EN KOLAY UNUTULAN HALKASI.
                       Bir süre düz `grid gap-4` idi ve yüksekliği geçirmiyordu;
                       hata iki kez tam burada saklandı. */}
                <div id="bolum-kabi" className="flex flex-col gap-4 lg:h-full lg:min-h-0">
                  {/* OffersNav revizyon ekranında `null` döner — burada da yok. */}
                  {/* ——— GERÇEK SAYFA KÖKÜ (page.tsx ile AYNI sınıflar) */}
                  <div id="sayfa-koku" className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
                  <PageHeader kicker="Teklif" title="32T VİNÇ" hint="ASTOR A.Ş." />
                  <OfferEditor
                    offerId="00000000-0000-0000-0000-000000000000"
                    offerSubject="32T x 30M ÇİFT KİRİŞ TAM PORTAL VİNÇ"
        offerNo="TETR-20260817-1"
                    revisionId="00000000-0000-0000-0000-000000000000"
                    revNo={0}
                    readOnly={false}
                    initial={fikstur()}
                    options={OPTIONS}
                    contacts={KISILER}
            authors={YAZARLAR}
            templates={SABLONLAR}
                    currency="EUR"
                    // ÖNİZLEMEDE MALİYET YOKTUR ve bu bilinçli: fikstür bir
                    // veritabanı okuması yapmaz, maliyet ise ayrı bir tabloda
                    // yaşar. Fiyat tablosu "maliyet çalışması yok" hâlini
                    // gösterir — o hâl de denetlenmeye değer bir ekrandır.
                    cost={null}
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
