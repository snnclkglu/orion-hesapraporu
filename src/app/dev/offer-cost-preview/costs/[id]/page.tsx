// Sadece development: MALİYET EDİTÖRÜ, KABUĞUN GERÇEĞİNİN içinde.
// Production'da 404 döner.
//
// KARDEŞ ÖNİZLEME (`../../page.tsx`) kabuğun ata zincirini TAKLİT eder ve
// bunun bir sınırı vardır: kabuk çerçeve kipine ADRESE bakarak girer
// (`isFrame`, app-shell.tsx — `…/revisions/<id>` ya da `…/costs/<id>`) ve
// taklit kutusu `h-[640px]`tir, yani `dvh` zinciri hiç kurulmaz. Kaydırma
// hataları tam olarak orada yaşar: çift kaydırma çubuğu, kırpılan dip,
// "aşağı çekince sayfa bozuluyor".
//
// BU SAYFANIN ADRESİ `…/costs/onizleme` İLE BİTER — kalıp onu yakalar, kabuk
// çerçeve kipine girer, sol ray daralır ve editör gerçekte olduğu gibi tek
// bir kaydırma kabında yaşar. Kaydırma kabını SAYMAK için:
//
//   [...document.querySelectorAll("*")].filter((e) => {
//     const s = getComputedStyle(e);
//     return e.scrollHeight > e.clientHeight + 2 && ["auto","scroll"].includes(s.overflowY);
//   })
//
// Beklenen sonuç: BİR tane (bölüm gövdesi) ve `document` hiç kaymaz.

import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CostEditor } from "@/app/(app)/offers/[id]/costs/[costRevId]/cost-editor";
import { SAHTE, maliyetFiksturu, teklifFiksturu } from "../../fikstur";

export default function OfferCostShellPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const teklif = teklifFiksturu();
  const maliyet = maliyetFiksturu(teklif);

  return (
    <AppShell role="admin" displayName="Sinan Çolakoğlu" email="sinan@vigowood.com">
      {/* offers/layout.tsx — ZİNCİRİN EN KOLAY UNUTULAN HALKASI; burada da
          birebir kurulur, yoksa önizleme gerçeği değil kendini sınar. */}
      <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
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
    </AppShell>
  );
}
