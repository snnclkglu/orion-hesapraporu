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
// TAKLİT YETMEDİĞİ YER: kabuğun ÇERÇEVE KİPİ (`isFrame`) adrese bakar ve bu
// sayfanın adresi `…/costs/<id>` değildir; buradaki kutu da `h-[640px]`tir,
// yani gerçek `dvh` zinciri sınanmaz. Onun için kardeş sayfa vardır:
// `/dev/offer-cost-preview/costs/onizleme` GERÇEK `AppShell`i kurar.
//
// FİKSTÜR ORTAKTIR (`./fikstur.ts`) — iki önizleme aynı sayıları gösterir.

import { notFound } from "next/navigation";
import { CostEditor } from "@/app/(app)/offers/[id]/costs/[costRevId]/cost-editor";
import { PageHeader } from "@/components/page-header";
import { APP_ACTIONS_SLOT_ID, APP_HEADER_SLOT_ID } from "@/lib/app";
import { SAHTE, maliyetFiksturu, teklifFiksturu } from "./fikstur";

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
