// Sadece development: TEKLİF EDİTÖRÜNÜ auth olmadan görsel test etmek için.
// Production'da 404 döner.
//
// EDİTÖR SABİT YÜKSEKLİKLİ BİR KUTUYA SARILIR ve bu bilinçlidir: gerçek
// uygulamada kabuk `/…/revisions/…` adreslerini SABİT ÇERÇEVE sayar
// (`isFrame`, app-shell.tsx) ve `lg` üstünde gövdeye `h-dvh overflow-hidden`
// verir. Önizleme o kabı taklit etmezse "scroll çalışmıyor" hatası burada HİÇ
// görünmez — kullanıcı bildirimi (17.08.2026) tam olarak o koşuldan çıkmıştı.
//
// Kaydetme ve yayımlama sunucu eylemleri sahte kimliklerle çağrılır ve hata
// döner; amaç yalnız YERLEŞİM ve ALAN TİPLERİNİN gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import { OfferEditor } from "@/app/(app)/offers/[id]/revisions/[revId]/offer-editor";
import type { OfferOptionRow } from "@/app/(app)/offers/data";
import type { CustomerContact } from "@/lib/customer-contacts";
import { applyDefaults, emptyItem, emptyPayload } from "@/lib/offers/payload";

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
  opt("val.craneClass", "FEM 3m / ISO M6 - ISO/FEM A6 H3/B4"),
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
  const kalem = emptyItem("32T X 26M ÇİFT KİRİŞLİ VİNÇ", [
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

export default function OfferEditorPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="grid gap-3 p-4">
      <h1 className="font-mono text-sm text-muted-foreground">
        Teklif editörü — sabit çerçeve taklidi (600px kutu, taşan içerik KENDİ kabında kaymalı)
      </h1>
      {/* Kabuğun `lg:h-dvh lg:overflow-hidden` kabının birebir taklidi. */}
      <div id="cerceve" className="h-[600px] overflow-hidden rounded-lg border p-3">
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)]">
          <OfferEditor
            offerId="00000000-0000-0000-0000-000000000000"
            offerNo="TETR-20260817-1"
            revisionId="00000000-0000-0000-0000-000000000000"
            revNo={0}
            readOnly={false}
            initial={fikstur()}
            options={OPTIONS}
            contacts={KISILER}
            currency="EUR"
          />
        </div>
      </div>
    </main>
  );
}
